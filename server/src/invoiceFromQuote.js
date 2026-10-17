import nodemailer from 'nodemailer';
import { query, pool } from './db.js';
import { buildInvoicePdf } from './invoicePdf.js';
import { paymentPageLinks } from './payments.js';

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

function buildInvoiceMessage(invoice, urls, payLinks) {
  const lines = [
    `Hi ${invoice.customer_name},`,
    '',
    `Thanks for accepting quote ${invoice.quote_number}. Your invoice ${invoice.invoice_number} is attached and ready for payment.`,
    '',
    `View invoice: ${urls.view_url}`,
    `PDF download: ${urls.pdf_url}`,
  ];
  if (payLinks.yoco) lines.push(`Pay with Yoco: ${payLinks.yoco}`);
  if (payLinks.payfast) lines.push(`Pay with Payfast: ${payLinks.payfast}`);
  if (!payLinks.yoco && !payLinks.payfast) {
    lines.push('', 'Pay by EFT and use your invoice number as the payment reference.');
  }
  lines.push(
    '',
    invoice.description || '',
    '',
    `Amount due: ${zar(invoice.balance ?? invoice.total)}`,
    `Due date: ${invoice.due_date}`,
    '',
    'Thanks,',
    'PrintShop Pro'
  );
  return lines.filter((line, i, arr) => !(line === '' && arr[i - 1] === '')).join('\n');
}

function whatsAppNumber(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `27${digits.slice(1)}`;
  return digits;
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

async function sendInvoiceEmail(invoice, subject, body, pdf) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM) {
    return { ok: false, error: 'SMTP is not configured' };
  }
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
    attachments: pdf
      ? [{ filename: `${invoice.invoice_number}.pdf`, content: pdf, contentType: 'application/pdf' }]
      : [],
  });
  return { ok: true };
}

async function sendInvoiceWhatsApp(to, body, invoice, payLinks) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return { ok: false, error: 'WhatsApp is not configured' };
  const template = process.env.WHATSAPP_TEMPLATE_NAME;
  const payUrl = payLinks.yoco || payLinks.payfast || invoice.view_url;
  const payload = template
    ? {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: template,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG || 'en' },
          components: [{
            type: 'body',
            parameters: [
              { type: 'text', text: invoice.customer_name },
              { type: 'text', text: invoice.invoice_number },
              { type: 'text', text: zar(invoice.balance ?? invoice.total) },
              { type: 'text', text: payUrl },
            ],
          }],
        },
      }
    : {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { preview_url: true, body },
      };
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.error?.message || 'WhatsApp send failed';
    return { ok: false, error: message };
  }
  return { ok: true };
}

/** Email the invoice PDF and send the same message on WhatsApp. */
export async function dispatchInvoiceToClient(req, invoice) {
  const urls = invoicePublicUrls(req, invoice.share_token);
  const payLinks = paymentPageLinks(req, invoice.share_token);
  const body = buildInvoiceMessage(invoice, urls, payLinks);
  const subject = `Invoice ${invoice.invoice_number} — payment due`;
  const result = {
    whatsapp: false,
    email: false,
    urls,
    payLinks,
    body,
    subject,
    errors: [],
  };

  const { rows: items } = await query(
    `SELECT description, quantity, unit_price, line_total
       FROM invoice_items WHERE invoice_id = $1 ORDER BY description`,
    [invoice.id]
  );
  let pdf = null;
  try {
    pdf = await buildInvoicePdf({ invoice, items });
  } catch (err) {
    console.error('Invoice PDF for email failed:', err);
  }

  if (invoice.customer_email) {
    try {
      const sent = await sendInvoiceEmail(invoice, subject, body, pdf);
      result.email = sent.ok;
      if (!sent.ok) result.errors.push(sent.error);
      if (sent.ok) {
        await query(
          `INSERT INTO payment_reminders (invoice_id, stage, channel, created_by)
           VALUES ($1, 1, 'email', NULL)`,
          [invoice.id]
        );
      }
    } catch (err) {
      console.error('Invoice email failed:', err);
      result.errors.push(err.message || 'Email failed');
    }
  }

  const to = whatsAppNumber(invoice.customer_phone);
  if (to) {
    let status = 'failed';
    try {
      const sent = await sendInvoiceWhatsApp(to, body, { ...invoice, view_url: urls.view_url }, payLinks);
      result.whatsapp = sent.ok;
      status = sent.ok ? 'sent' : 'failed';
      if (!sent.ok) result.errors.push(sent.error);
      if (sent.ok) {
        await query(
          `INSERT INTO payment_reminders (invoice_id, stage, channel, created_by)
           VALUES ($1, 1, 'whatsapp', NULL)`,
          [invoice.id]
        );
      }
    } catch (err) {
      console.error('Invoice WhatsApp failed:', err);
      result.errors.push(err.message || 'WhatsApp failed');
    }
    await query(
      `INSERT INTO whatsapp_messages (customer_id, template, body, status, created_by)
       VALUES ($1, 'invoice_payment', $2, $3, NULL)`,
      [invoice.customer_id, body, status]
    );
  }

  return result;
}
