import { Router } from 'express';
import { query } from '../db.js';
import { buildQuotePdf } from '../quotePdf.js';
import { buildInvoicePdf } from '../invoicePdf.js';
import { createInvoiceFromQuote, dispatchInvoiceToClient } from '../invoiceFromQuote.js';

const r = Router();

async function expireStaleQuotes() {
  await query(`
    UPDATE quotes
       SET status = 'expired'
     WHERE valid_until < CURRENT_DATE
       AND status IN ('draft', 'sent')
  `);
}

async function loadQuoteByShareToken(token) {
  const { rows } = await query(
    `SELECT q.id, q.customer_id, q.quote_number, q.description, q.status,
            q.subtotal, q.vat_amount, q.total,
            q.valid_until::text AS valid_until, q.share_token,
            customer_display_name(c) AS customer_name,
            c.email AS customer_email, c.phone AS customer_phone
       FROM quotes q JOIN customers c ON c.id = q.customer_id
      WHERE q.share_token = $1`,
    [token]
  );
  return rows[0] || null;
}

async function loadQuoteItems(quoteId) {
  const { rows } = await query(
    `SELECT description, quantity, unit_price, line_total
       FROM quote_items WHERE quote_id = $1 ORDER BY description`,
    [quoteId]
  );
  return rows;
}

async function loadInvoiceByShareToken(token) {
  const { rows } = await query(
    `SELECT i.id, i.invoice_number, i.status, i.subtotal, i.vat_amount, i.total, i.balance,
            i.issue_date::text AS issue_date, i.due_date::text AS due_date, i.share_token,
            i.customer_id, q.quote_number, q.description,
            customer_display_name(c) AS customer_name,
            c.email AS customer_email, c.phone AS customer_phone
       FROM invoices i
       JOIN customers c ON c.id = i.customer_id
       LEFT JOIN quotes q ON q.id = i.quote_id
      WHERE i.share_token = $1`,
    [token]
  );
  return rows[0] || null;
}

async function loadInvoiceItems(invoiceId) {
  const { rows } = await query(
    `SELECT description, quantity, unit_price, line_total
       FROM invoice_items WHERE invoice_id = $1 ORDER BY description`,
    [invoiceId]
  );
  return rows;
}

async function invoiceForQuote(quoteId) {
  const { rows } = await query(
    `SELECT i.invoice_number, i.share_token, i.total, i.balance, i.due_date::text AS due_date, i.status
       FROM invoices i WHERE i.quote_id = $1`,
    [quoteId]
  );
  return rows[0] || null;
}

// Public quote summary for the accept / decline page.
r.get('/quotes/:token', async (req, res) => {
  await expireStaleQuotes();
  const quote = await loadQuoteByShareToken(req.params.token);
  if (!quote) return res.status(404).json({ error: 'Quote not found' });
  const items = await loadQuoteItems(quote.id);
  const invoice = quote.status === 'accepted' ? await invoiceForQuote(quote.id) : null;
  res.json({
    quote: {
      quote_number: quote.quote_number,
      description: quote.description,
      status: quote.status,
      subtotal: quote.subtotal,
      vat_amount: quote.vat_amount,
      total: quote.total,
      valid_until: quote.valid_until,
      customer_name: quote.customer_name,
      pdf_url: `/api/public/quotes/${quote.share_token}/pdf`,
    },
    items,
    can_respond: quote.status === 'sent',
    invoice: invoice
      ? {
          invoice_number: invoice.invoice_number,
          status: invoice.status,
          total: invoice.total,
          balance: invoice.balance,
          due_date: invoice.due_date,
          view_url: `/invoice/${invoice.share_token}`,
          pdf_url: `/api/public/invoices/${invoice.share_token}/pdf`,
        }
      : null,
  });
});

// Customer accept / decline — share_token is the credential.
r.post('/quotes/:token/respond', async (req, res) => {
  const decision = req.body?.decision === 'accepted'
    ? 'accepted'
    : req.body?.decision === 'declined'
      ? 'declined'
      : null;
  if (!decision) {
    return res.status(422).json({ errors: ['decision must be accepted or declined'] });
  }

  await expireStaleQuotes();
  const quote = await loadQuoteByShareToken(req.params.token);
  if (!quote) return res.status(404).json({ error: 'Quote not found' });

  if (quote.status === 'expired') {
    return res.status(400).json({ errors: ['This quote has expired'] });
  }

  if (quote.status === 'accepted' || quote.status === 'declined') {
    let invoicePayload = null;
    if (quote.status === 'accepted') {
      const inv = await invoiceForQuote(quote.id);
      if (inv) {
        invoicePayload = {
          invoice_number: inv.invoice_number,
          status: inv.status,
          total: inv.total,
          balance: inv.balance,
          due_date: inv.due_date,
          view_url: `/invoice/${inv.share_token}`,
          pdf_url: `/api/public/invoices/${inv.share_token}/pdf`,
        };
      }
    }
    return res.json({ ok: true, status: quote.status, already: true, invoice: invoicePayload });
  }

  if (quote.status !== 'sent') {
    return res.status(400).json({
      errors: ['This quote cannot be accepted or declined yet. Ask the shop to send it first.'],
    });
  }

  const { rows } = await query(
    `UPDATE quotes SET status = $1::quote_status
      WHERE id = $2 AND status = 'sent'
      RETURNING status`,
    [decision, quote.id]
  );
  if (!rows[0]) {
    return res.status(409).json({ errors: ['Quote status changed. Please refresh and try again.'] });
  }

  let invoicePayload = null;

  if (decision === 'accepted') {
    try {
      const { invoice, created } = await createInvoiceFromQuote(quote);
      const delivery = created
        ? await dispatchInvoiceToClient(req, invoice)
        : null;
      invoicePayload = {
        invoice_number: invoice.invoice_number,
        status: invoice.status,
        total: invoice.total,
        balance: invoice.balance,
        due_date: invoice.due_date,
        view_url: `/invoice/${invoice.share_token}`,
        pdf_url: `/api/public/invoices/${invoice.share_token}/pdf`,
        email_sent: !!delivery?.email,
        whatsapp_sent: !!delivery?.whatsapp,
        email_url: delivery?.email_url || null,
        whatsapp_url: delivery?.whatsapp_url || null,
      };
    } catch (err) {
      console.error('Auto-invoice on quote accept failed:', err);
      return res.status(500).json({
        errors: ['Quote was accepted but creating the invoice failed. Please contact the shop.'],
        status: 'accepted',
      });
    }
  }

  res.json({
    ok: true,
    status: rows[0].status,
    already: false,
    invoice: invoicePayload,
  });
});

// Public PDF download — share_token in the URL is the credential (for email / WhatsApp links).
r.get('/quotes/:token/pdf', async (req, res) => {
  const quote = await loadQuoteByShareToken(req.params.token);
  if (!quote) return res.status(404).json({ error: 'Quote not found' });

  const items = await loadQuoteItems(quote.id);

  try {
    const pdf = await buildQuotePdf({ quote, items });
    const filename = `${quote.quote_number}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(pdf);
  } catch (err) {
    console.error('Quote PDF failed:', err);
    res.status(500).json({ error: 'Could not generate PDF' });
  }
});

// ---------- PUBLIC INVOICES ----------
r.get('/invoices/:token', async (req, res) => {
  const invoice = await loadInvoiceByShareToken(req.params.token);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  const items = await loadInvoiceItems(invoice.id);
  res.json({
    invoice: {
      invoice_number: invoice.invoice_number,
      description: invoice.description,
      quote_number: invoice.quote_number,
      status: invoice.status,
      subtotal: invoice.subtotal,
      vat_amount: invoice.vat_amount,
      total: invoice.total,
      balance: invoice.balance,
      issue_date: invoice.issue_date,
      due_date: invoice.due_date,
      customer_name: invoice.customer_name,
      pdf_url: `/api/public/invoices/${invoice.share_token}/pdf`,
    },
    items,
  });
});

r.get('/invoices/:token/pdf', async (req, res) => {
  const invoice = await loadInvoiceByShareToken(req.params.token);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  const items = await loadInvoiceItems(invoice.id);

  try {
    const pdf = await buildInvoicePdf({ invoice, items });
    const filename = `${invoice.invoice_number}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(pdf);
  } catch (err) {
    console.error('Invoice PDF failed:', err);
    res.status(500).json({ error: 'Could not generate PDF' });
  }
});

export default r;
