import crypto from 'node:crypto';
import { query } from './db.js';

function publicAppBase(req) {
  const env = process.env.PUBLIC_APP_URL || process.env.CLIENT_ORIGIN;
  if (env && env !== 'true') return env.replace(/\/$/, '');
  const host = req.get('x-forwarded-host') || req.get('host');
  const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
  return `${proto}://${host}`;
}

function pfEncode(value) {
  return encodeURIComponent(String(value).trim())
    .replace(/%20/gi, '+')
    .replace(/%[0-9a-f]{2}/gi, (hex) => hex.toUpperCase());
}

export function payfastSignature(fields, passphrase) {
  const parts = [];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || String(value).trim() === '') continue;
    parts.push(`${key}=${pfEncode(value)}`);
  }
  let str = parts.join('&');
  if (passphrase) str += `&passphrase=${pfEncode(passphrase)}`;
  return crypto.createHash('md5').update(str).digest('hex');
}

export function payfastConfigured() {
  return Boolean(process.env.PAYFAST_MERCHANT_ID && process.env.PAYFAST_MERCHANT_KEY);
}

export function yocoConfigured() {
  return Boolean(process.env.YOCO_SECRET_KEY);
}

export function paymentPageLinks(req, shareToken) {
  const base = publicAppBase(req);
  const links = {};
  if (payfastConfigured()) links.payfast = `${base}/api/public/invoices/${shareToken}/pay/payfast`;
  if (yocoConfigured()) links.yoco = `${base}/api/public/invoices/${shareToken}/pay/yoco`;
  return links;
}

function splitName(displayName) {
  const parts = String(displayName || 'Customer').trim().split(/\s+/);
  return { first: parts[0] || 'Customer', last: parts.slice(1).join(' ') || 'Customer' };
}

function payfastHost() {
  return process.env.PAYFAST_MODE === 'live' ? 'www.payfast.co.za' : 'sandbox.payfast.co.za';
}

export function payfastCheckoutFields(req, invoice) {
  const base = publicAppBase(req);
  const names = splitName(invoice.customer_name);
  const amount = Number(invoice.balance ?? invoice.total).toFixed(2);
  const fields = {
    merchant_id: process.env.PAYFAST_MERCHANT_ID,
    merchant_key: process.env.PAYFAST_MERCHANT_KEY,
    return_url: `${base}/invoice/${invoice.share_token}?paid=1`,
    cancel_url: `${base}/invoice/${invoice.share_token}?cancelled=1`,
    notify_url: `${base}/api/public/payfast/notify`,
    name_first: names.first,
    name_last: names.last,
    email_address: invoice.customer_email || '',
    m_payment_id: invoice.invoice_number,
    amount,
    item_name: `Invoice ${invoice.invoice_number}`,
    item_description: (invoice.description || 'PrintShop Pro invoice').slice(0, 255),
  };
  fields.signature = payfastSignature(fields, process.env.PAYFAST_PASSPHRASE || null);
  return { fields, action: `https://${payfastHost()}/eng/process` };
}

export function payfastFormHtml(req, invoice) {
  const { fields, action } = payfastCheckoutFields(req, invoice);
  const inputs = Object.entries(fields)
    .map(([name, value]) => {
      const safe = String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
      return `<input type="hidden" name="${name}" value="${safe}" />`;
    })
    .join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Pay ${invoice.invoice_number}</title></head>
<body style="font-family:sans-serif;padding:40px">
<p>Sending you to Payfast to pay ${invoice.invoice_number}…</p>
<form id="pf" action="${action}" method="post">${inputs}<button type="submit">Continue to Payfast</button></form>
<script>document.getElementById('pf').submit()</script>
</body></html>`;
}

export async function createYocoCheckout(req, invoice) {
  const base = publicAppBase(req);
  const amount = Math.round(Number(invoice.balance ?? invoice.total) * 100);
  if (amount < 200) {
    throw Object.assign(new Error('Yoco requires a payment of at least R2.00'), { status: 400 });
  }
  const res = await fetch('https://payments.yoco.com/api/checkouts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.YOCO_SECRET_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `${invoice.id}-${amount}`,
    },
    body: JSON.stringify({
      amount,
      currency: 'ZAR',
      successUrl: `${base}/invoice/${invoice.share_token}?paid=1`,
      cancelUrl: `${base}/invoice/${invoice.share_token}?cancelled=1`,
      failureUrl: `${base}/invoice/${invoice.share_token}?failed=1`,
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
      },
      lineItems: [{
        displayName: `Invoice ${invoice.invoice_number}`,
        quantity: 1,
        pricingDetails: { price: amount },
      }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.redirectUrl) {
    throw Object.assign(new Error(data.description || data.message || 'Yoco checkout failed'), { status: 502 });
  }
  return data.redirectUrl;
}

const ITN_ORDER = [
  'm_payment_id', 'pf_payment_id', 'payment_status', 'item_name', 'item_description',
  'amount_gross', 'amount_fee', 'amount_net',
  'custom_str1', 'custom_str2', 'custom_str3', 'custom_str4', 'custom_str5',
  'custom_int1', 'custom_int2', 'custom_int3', 'custom_int4', 'custom_int5',
  'name_first', 'name_last', 'email_address', 'merchant_id', 'token', 'billing_date',
];

export async function handlePayfastNotify(body) {
  const ordered = {};
  for (const key of ITN_ORDER) {
    if (body[key] !== undefined && body[key] !== '') ordered[key] = body[key];
  }
  const expected = payfastSignature(ordered, process.env.PAYFAST_PASSPHRASE || null);
  if (!body.signature || body.signature !== expected) {
    return { ok: false, status: 400, error: 'Invalid Payfast signature' };
  }
  if (String(body.merchant_id) !== String(process.env.PAYFAST_MERCHANT_ID)) {
    return { ok: false, status: 400, error: 'Merchant mismatch' };
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) params.append(key, value);
  const validateUrl = `https://${payfastHost()}/eng/query/validate`;
  const check = await fetch(validateUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const verdict = (await check.text()).trim();
  if (verdict !== 'VALID') return { ok: false, status: 400, error: 'Payfast rejected the notification' };
  if (body.payment_status !== 'COMPLETE') return { ok: true, ignored: true };

  const { rows } = await query(
    `SELECT id, total, balance FROM invoices WHERE invoice_number = $1`,
    [body.m_payment_id]
  );
  const invoice = rows[0];
  if (!invoice) return { ok: false, status: 404, error: 'Invoice not found' };
  const paid = Number(body.amount_gross);
  if (Math.abs(paid - Number(invoice.balance)) > 0.01 && Math.abs(paid - Number(invoice.total)) > 0.01) {
    return { ok: false, status: 400, error: 'Amount mismatch' };
  }
  await recordGatewayPayment({
    reference: `PF-${body.pf_payment_id}`,
    invoiceId: invoice.id,
    method: 'eft',
    amount: paid,
    bankRef: String(body.pf_payment_id),
    note: 'Payfast',
  });
  return { ok: true };
}

function verifyYocoSignature(req) {
  const secret = process.env.YOCO_WEBHOOK_SECRET;
  if (!secret) return false;
  const id = req.get('webhook-id');
  const timestamp = req.get('webhook-timestamp');
  const header = req.get('webhook-signature') || '';
  if (!id || !timestamp || !req.rawBody) return false;
  const key = secret.startsWith('whsec_')
    ? Buffer.from(secret.slice('whsec_'.length), 'base64')
    : Buffer.from(secret);
  const signed = `${id}.${timestamp}.${req.rawBody.toString('utf8')}`;
  const digest = crypto.createHmac('sha256', key).update(signed).digest('base64');
  return header.split(' ').some((part) => {
    const value = part.includes(',') ? part.split(',').slice(1).join(',') : part;
    const a = Buffer.from(value);
    const b = Buffer.from(digest);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}

export async function handleYocoWebhook(req) {
  if (!verifyYocoSignature(req)) {
    return { ok: false, status: 401, error: 'Invalid Yoco webhook signature' };
  }
  const event = req.body || {};
  if (event.type !== 'payment.succeeded') return { ok: true, ignored: true };
  const payload = event.payload || event.data || {};
  const invoiceId = payload.metadata?.invoiceId;
  const amount = Number(payload.amount) / 100;
  const paymentId = payload.id || event.id;
  if (!invoiceId || !paymentId || !Number.isFinite(amount)) {
    return { ok: false, status: 400, error: 'Yoco payload is missing invoice details' };
  }
  await recordGatewayPayment({
    reference: `YOCO-${paymentId}`,
    invoiceId,
    method: 'card',
    amount,
    bankRef: paymentId,
    note: 'Yoco',
  });
  return { ok: true };
}

async function recordGatewayPayment({ reference, invoiceId, method, amount, bankRef, note }) {
  const existing = await query(`SELECT id FROM payments WHERE reference = $1`, [reference]);
  if (existing.rows[0]) return;
  await query(
    `INSERT INTO payments (reference, invoice_id, type, method, amount, bank_ref, note)
     VALUES ($1,$2,'payment',$3,$4,$5,$6)`,
    [reference, invoiceId, method, amount, bankRef, note]
  );
}
