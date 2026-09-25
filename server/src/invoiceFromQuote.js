import { query, pool } from './db.js';

function zar(n) {
  return `R ${Number(n || 0).toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function publicAppBase(req) {
  const env = process.env.PUBLIC_APP_URL || process.env.CLIENT_ORIGIN;
  if (env && env !== 'true') return env.replace(/\/$/, '');
  const host = req.get('x-forwarded-host') || req.get('host');
  const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
  return `${proto}://${host}`;
}

export function invoicePublicUrls(req, shareToken) {
  const base = publicAppBase(req);
  return {
    view_url: `${base}/invoice/${shareToken}`,
    pdf_url: `${base}/api/public/invoices/${shareToken}/pdf`,
  };
}

async function nextInvoiceNumber(client) {
  const { rows } = await client.query(`
    SELECT 'INV-' || (COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 5) AS INTEGER)), 0) + 1)::text AS invoice_number
      FROM invoices
     WHERE invoice_number ~ '^INV-[0-9]+$'
  `);
  return rows[0].invoice_number;
}

function buildInvoiceMessage(invoice, urls) {
  return [
    `Hi ${invoice.customer_name},`,
    '',
    `Thanks for accepting quote ${invoice.quote_number}. Your invoice ${invoice.invoice_number} is ready for payment.`,
    '',
    `View invoice: ${urls.view_url}`,
    `PDF download: ${urls.pdf_url}`,
    '',
    invoice.description || '',
    '',
    `Amount due: ${zar(invoice.balance ?? invoice.total)}`,
    `Due date: ${invoice.due_date}`,
    '',
    'Please use your invoice number as the EFT payment reference.',
    '',
    'Thanks,',
    'PrintShop Pro',
  ].filter((line, i, arr) => !(line === '' && arr[i - 1] === '')).join('\n');
}

/**
 * Create an invoice from an accepted quote (idempotent on quote_id).
 * Returns invoice row + items + whether it was newly created.
 */
export async function createInvoiceFromQuote(quote) {
  const existing = await query(
    `SELECT i.id, i.invoice_number, i.share_token, i.status, i.subtotal, i.vat_amount, i.total, i.balance,
            i.issue_date::text AS issue_date, i.due_date::text AS due_date,
            i.customer_id, q.quote_number, q.description,
            customer_display_name(c) AS customer_name,
            c.email AS customer_email, c.phone AS customer_phone
       FROM invoices i
       JOIN quotes q ON q.id = i.quote_id
       JOIN customers c ON c.id = i.customer_id
      WHERE i.quote_id = $1`,
    [quote.id]
  );
  if (existing.rows[0]) {
    const inv = existing.rows[0];
    const items = await query(
      `SELECT description, quantity, unit_price, line_total FROM invoice_items WHERE invoice_id = $1 ORDER BY description`,
      [inv.id]
    );
    return { invoice: inv, items: items.rows, created: false };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const again = await client.query(
      `SELECT i.id, i.invoice_number, i.share_token, i.status, i.subtotal, i.vat_amount, i.total, i.balance,
              i.issue_date::text AS issue_date, i.due_date::text AS due_date, i.customer_id
         FROM invoices i WHERE i.quote_id = $1`,
      [quote.id]
    );
    if (again.rows[0]) {
      await client.query('ROLLBACK');
      const inv = {
        ...again.rows[0],
        quote_number: quote.quote_number,
        description: quote.description,
        customer_name: quote.customer_name,
        customer_email: quote.customer_email,
        customer_phone: quote.customer_phone,
      };
      const items = await query(
        `SELECT description, quantity, unit_price, line_total FROM invoice_items WHERE invoice_id = $1 ORDER BY description`,
        [inv.id]
      );
      return { invoice: inv, items: items.rows, created: false };
    }

    const itemsRes = await client.query(
      `SELECT description, quantity, unit_price FROM quote_items WHERE quote_id = $1 ORDER BY description`,
      [quote.id]
    );
    const invoiceNumber = await nextInvoiceNumber(client);

    const { rows } = await client.query(
      `INSERT INTO invoices (
         invoice_number, customer_id, quote_id, status,
         subtotal, vat_amount, total, due_date, created_by
       ) VALUES (
         $1, $2, $3, 'sent',
         $4, $5, $6, CURRENT_DATE + 14, NULL
       )
       RETURNING id, invoice_number, share_token, status, subtotal, vat_amount, total, balance,
                 issue_date::text AS issue_date, due_date::text AS due_date, customer_id`,
      [
        invoiceNumber,
        quote.customer_id,
        quote.id,
        quote.subtotal,
        quote.vat_amount,
        quote.total,
      ]
    );
    const inv = rows[0];

    for (const line of itemsRes.rows) {
      await client.query(
        `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price)
         VALUES ($1, $2, $3, $4)`,
        [inv.id, line.description, line.quantity, line.unit_price]
      );
    }

    await client.query('COMMIT');

    const invoice = {
      ...inv,
      quote_number: quote.quote_number,
      description: quote.description,
      customer_name: quote.customer_name,
      customer_email: quote.customer_email,
      customer_phone: quote.customer_phone,
    };
    const items = itemsRes.rows.map((l) => ({
      ...l,
      line_total: Number(l.quantity) * Number(l.unit_price),
    }));
    return { invoice, items, created: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Log WhatsApp + email reminder records; optionally send SMTP email when configured. */
export async function dispatchInvoiceToClient(req, invoice) {
  const urls = invoicePublicUrls(req, invoice.share_token);
  const body = buildInvoiceMessage(invoice, urls);
  const subject = `Invoice ${invoice.invoice_number} — payment due`;
  const result = { whatsapp: false, email: false, urls, body, subject };

  if (invoice.customer_phone) {
    await query(
      `INSERT INTO whatsapp_messages (customer_id, template, body, status, created_by)
       VALUES ($1, 'invoice_payment', $2, 'sent', NULL)`,
      [invoice.customer_id, body]
    );
    await query(
      `INSERT INTO payment_reminders (invoice_id, stage, channel, created_by)
       VALUES ($1, 1, 'whatsapp', NULL)`,
      [invoice.id]
    );
    result.whatsapp = true;
  }

  if (invoice.customer_email) {
    await query(
      `INSERT INTO payment_reminders (invoice_id, stage, channel, created_by)
       VALUES ($1, 1, 'email', NULL)`,
      [invoice.id]
    );
    result.email = true;

    // Optional real SMTP send when configured.
    if (process.env.SMTP_HOST && process.env.SMTP_FROM) {
      try {
        const nodemailer = await import('nodemailer');
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: process.env.SMTP_SECURE === 'true',
          auth: process.env.SMTP_USER
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            : undefined,
        });
        await transporter.sendMail({
          from: process.env.SMTP_FROM,
          to: invoice.customer_email,
          subject,
          text: body,
        });
      } catch (err) {
        console.error('Invoice email SMTP send failed:', err.message);
      }
    }
  }

  // Deep links (opened after accept so the customer receives the invoice on their device channels).
  result.email_url = invoice.customer_email
    ? `mailto:${invoice.customer_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    : null;
  const digits = String(invoice.customer_phone || '').replace(/\D/g, '');
  result.whatsapp_url = digits
    ? `https://wa.me/${digits}?text=${encodeURIComponent(body)}`
    : null;

  return result;
}
