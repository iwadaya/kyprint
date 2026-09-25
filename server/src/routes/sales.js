import { Router } from 'express';
import { query, pool } from '../db.js';
import { requirePermission } from '../auth.js';
import { redactList, can } from '../permissions.js';
import { buildQuotePdf } from '../quotePdf.js';

const r = Router();

const MONEY_FIELDS = ['subtotal', 'vat_amount', 'total', 'deposit_amount'];

async function nextOrderNumber(client = null) {
  const run = client ? client.query.bind(client) : query;
  const { rows } = await run(`
    SELECT 'ORD-' || (COALESCE(MAX(CAST(SUBSTRING(order_number FROM 5) AS INTEGER)), 0) + 1)::text AS order_number
      FROM orders
     WHERE order_number ~ '^ORD-[0-9]+$'
  `);
  return rows[0].order_number;
}

function normalizeItems(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((i) => ({
      product_id: i.product_id,
      quantity: Number(i.quantity),
    }))
    .filter((i) => i.product_id);
}

async function loadProducts(client, productIds) {
  const { rows } = await client.query(
    `SELECT id, name, price FROM products WHERE id = ANY($1::uuid[])`,
    [productIds]
  );
  return new Map(rows.map((p) => [p.id, p]));
}

async function aggregateMaterials(client, items) {
  const needed = new Map();
  for (const item of items) {
    const { rows } = await client.query(
      `SELECT stock_item_id, quantity FROM product_materials WHERE product_id = $1`,
      [item.product_id]
    );
    if (!rows.length) {
      throw Object.assign(new Error('Each product must have stock materials configured'), { status: 400 });
    }
    for (const m of rows) {
      const key = m.stock_item_id;
      const qty = Number(m.quantity) * item.quantity;
      needed.set(key, (needed.get(key) || 0) + qty);
    }
  }
  return needed;
}

async function deductStock(client, items) {
  const needed = await aggregateMaterials(client, items);
  for (const [stockId, qty] of needed) {
    const { rows } = await client.query(
      `UPDATE stock_items
          SET on_hand = on_hand - $1
        WHERE id = $2 AND on_hand >= $1
        RETURNING id, name, on_hand`,
      [qty, stockId]
    );
    if (!rows[0]) {
      const info = await client.query(`SELECT name, on_hand FROM stock_items WHERE id = $1`, [stockId]);
      const name = info.rows[0]?.name || 'stock item';
      const onHand = info.rows[0]?.on_hand ?? 0;
      throw Object.assign(
        new Error(`Insufficient stock for ${name} (need ${qty}, have ${onHand})`),
        { status: 400 }
      );
    }
  }
}

async function restoreStockForOrder(client, orderId) {
  const { rows: items } = await client.query(
    `SELECT product_id, quantity FROM order_items WHERE order_id = $1 AND product_id IS NOT NULL`,
    [orderId]
  );
  if (!items.length) return;
  const needed = await aggregateMaterials(
    client,
    items.map((i) => ({ product_id: i.product_id, quantity: Number(i.quantity) }))
  );
  for (const [stockId, qty] of needed) {
    await client.query(
      `UPDATE stock_items SET on_hand = on_hand + $1 WHERE id = $2`,
      [qty, stockId]
    );
  }
}

function moneyFromProducts(productsTotal, deposit) {
  const dep = Math.max(0, Number(deposit) || 0);
  const sub = Math.max(0, +(productsTotal - dep).toFixed(2));
  const vat = +(sub * 0.15).toFixed(2);
  return { deposit: dep, subtotal: sub, vat_amount: vat, total: +(sub + vat).toFixed(2) };
}

// ---------- ORDERS ----------
r.get('/orders/staff', async (_req, res) => {
  const { rows } = await query(
    `SELECT id, first_name, surname, role_label FROM users ORDER BY first_name, surname`
  );
  res.json(rows);
});

r.get('/orders', async (req, res) => {
  const { rows } = await query(
    `SELECT o.id, o.order_number, o.description, o.status, o.notes,
            o.subtotal, o.vat_amount, o.total, o.deposit_amount,
            o.order_date, o.due_date,
            customer_display_name(c) AS customer_name, c.id AS customer_id,
            u.first_name || ' ' || u.surname AS captured_by,
            a.id AS assigned_to_id,
            a.first_name AS assigned_to,
            COALESCE(
              (SELECT json_agg(
                 json_build_object(
                   'id', oi.id,
                   'product_id', oi.product_id,
                   'product_name', p.name,
                   'quantity', oi.quantity,
                   'unit_price', oi.unit_price,
                   'line_total', oi.line_total
                 ) ORDER BY p.name
               )
                 FROM order_items oi
                 LEFT JOIN products p ON p.id = oi.product_id
                WHERE oi.order_id = o.id),
              '[]'
            ) AS items
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
       LEFT JOIN users u ON u.id = o.created_by
       LEFT JOIN users a ON a.id = o.assigned_to
      ORDER BY o.created_at DESC`
  );
  res.json(redactList(rows, MONEY_FIELDS, req.user));
});

r.post('/orders', requirePermission('orders.create'), async (req, res) => {
  const b = req.body;
  const items = normalizeItems(b.items);
  if (!b.customer_id) return res.status(400).json({ error: 'Customer is required' });
  if (!items.length) return res.status(400).json({ error: 'At least one product is required' });
  if (items.some((i) => !i.quantity || i.quantity <= 0)) {
    return res.status(400).json({ error: 'Each product quantity must be greater than zero' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const productIds = [...new Set(items.map((i) => i.product_id))];
    const products = await loadProducts(client, productIds);
    if (products.size !== productIds.length) {
      throw Object.assign(new Error('One or more products were not found'), { status: 400 });
    }

    let productsTotal = 0;
    const resolved = items.map((i) => {
      const p = products.get(i.product_id);
      const line = +(Number(p.price) * i.quantity).toFixed(2);
      productsTotal += line;
      return { ...i, name: p.name, unit_price: Number(p.price), line_total: line };
    });
    productsTotal = +productsTotal.toFixed(2);

    const money = moneyFromProducts(productsTotal, b.deposit_amount);
    const description =
      b.description?.trim() ||
      resolved.map((i) => `${i.name} ×${i.quantity}`).join(', ');
    const orderNumber = await nextOrderNumber(client);

    await deductStock(client, resolved);

    const { rows } = await client.query(
      `INSERT INTO orders (order_number, customer_id, description, status, notes,
                           subtotal, vat_amount, total, deposit_amount, due_date,
                           created_by, assigned_to, product_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id, order_number`,
      [
        orderNumber,
        b.customer_id,
        description,
        b.status || 'in_production',
        b.notes?.trim() || null,
        money.subtotal,
        money.vat_amount,
        money.total,
        money.deposit,
        b.due_date || null,
        req.user.id,
        b.assigned_to || null,
        resolved[0].product_id,
      ]
    );
    const orderId = rows[0].id;

    for (const item of resolved) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, description, quantity, unit_price)
         VALUES ($1,$2,$3,$4,$5)`,
        [orderId, item.product_id, item.name, item.quantity, item.unit_price]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.status) return res.status(err.status).json({ error: err.message });
    throw err;
  } finally {
    client.release();
  }
});

r.put('/orders/:id', requirePermission('orders.edit'), async (req, res) => {
  const b = req.body;
  // Products / quantities / money are locked after create.
  await query(
    `UPDATE orders SET status=$1, due_date=$2, assigned_to=$3, notes=$4
     WHERE id=$5`,
    [b.status, b.due_date || null, b.assigned_to || null, b.notes?.trim() || null, req.params.id]
  );
  res.json({ ok: true });
});

r.delete('/orders/:id', requirePermission('orders.delete'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`SELECT id FROM orders WHERE id = $1 FOR UPDATE`, [req.params.id]);
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found' });
    }
    await restoreStockForOrder(client, req.params.id);
    await client.query(`DELETE FROM deliveries WHERE order_id = $1`, [req.params.id]);
    await client.query(`UPDATE invoices SET order_id = NULL WHERE order_id = $1`, [req.params.id]);
    await client.query(
      `UPDATE payments SET order_id = NULL WHERE order_id = $1 AND invoice_id IS NOT NULL`,
      [req.params.id]
    );
    await client.query(
      `DELETE FROM payments WHERE order_id = $1 AND invoice_id IS NULL`,
      [req.params.id]
    );
    await client.query(`DELETE FROM orders WHERE id = $1`, [req.params.id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

r.patch('/orders/:id/status', requirePermission('orders.edit'), async (req, res) => {
  await query(`UPDATE orders SET status = $1 WHERE id = $2`, [req.body.status, req.params.id]);
  res.json({ ok: true });
});

// ---------- QUOTES ----------
async function nextQuoteNumber(client = null) {
  const run = client ? client.query.bind(client) : query;
  const { rows } = await run(`
    SELECT 'QUO-' || (COALESCE(MAX(CAST(SUBSTRING(quote_number FROM 5) AS INTEGER)), 0) + 1)::text AS quote_number
      FROM quotes
     WHERE quote_number ~ '^QUO-[0-9]+$'
  `);
  return rows[0].quote_number;
}

async function expireStaleQuotes(client = null) {
  const run = client ? client.query.bind(client) : query;
  await run(`
    UPDATE quotes
       SET status = 'expired'
     WHERE valid_until < CURRENT_DATE
       AND status IN ('draft', 'sent')
  `);
}

function formatZar(n) {
  return `R ${Number(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function publicAppBase(req) {
  const env = process.env.PUBLIC_APP_URL || process.env.CLIENT_ORIGIN;
  if (env && env !== 'true') return env.replace(/\/$/, '');
  const host = req.get('x-forwarded-host') || req.get('host');
  const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
  return `${proto}://${host}`;
}

function pdfPublicUrl(req, shareToken) {
  return `${publicAppBase(req)}/api/public/quotes/${shareToken}/pdf`;
}

function quoteRespondUrl(req, shareToken) {
  return `${publicAppBase(req)}/quote/${shareToken}`;
}

async function ensureShareToken(quoteId) {
  const { rows } = await query(
    `UPDATE quotes
        SET share_token = COALESCE(share_token, gen_random_uuid())
      WHERE id = $1
      RETURNING share_token`,
    [quoteId]
  );
  return rows[0]?.share_token;
}

async function loadQuoteForPdf(id) {
  const { rows } = await query(
    `SELECT q.id, q.quote_number, q.description, q.status, q.subtotal, q.vat_amount, q.total,
            q.valid_until::text AS valid_until, q.share_token,
            customer_display_name(c) AS customer_name,
            c.email AS customer_email, c.phone AS customer_phone
       FROM quotes q JOIN customers c ON c.id = q.customer_id
      WHERE q.id = $1`,
    [id]
  );
  return rows[0] || null;
}

function buildQuoteMessage(quote, items, pdfUrl, respondUrl) {
  const lines = [
    `Hi ${quote.customer_name},`,
    '',
    `Please find quote ${quote.quote_number} from PrintShop Pro.`,
    '',
    `PDF download: ${pdfUrl}`,
    '',
    `Accept or decline this quote here:`,
    respondUrl,
    '',
    quote.description,
    '',
  ];
  for (const it of items) {
    lines.push(`• ${it.description} × ${Number(it.quantity)} @ ${formatZar(it.unit_price)} = ${formatZar(it.line_total)}`);
  }
  lines.push(
    '',
    `Subtotal: ${formatZar(quote.subtotal)}`,
    `VAT (15%): ${formatZar(quote.vat_amount)}`,
    `Total: ${formatZar(quote.total)}`,
    '',
    `This quote is valid until ${quote.valid_until}.`,
    '',
    'Thanks,',
    'PrintShop Pro'
  );
  return lines.join('\n');
}

function phoneForWhatsApp(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits || null;
}

r.get('/quotes', async (req, res) => {
  await expireStaleQuotes();
  const { rows } = await query(
    `SELECT q.id, q.quote_number, q.description, q.status, q.subtotal, q.vat_amount, q.total,
            q.valid_until, q.created_at,
            customer_display_name(c) AS customer_name, c.id AS customer_id,
            c.email AS customer_email, c.phone AS customer_phone,
            u.first_name || ' ' || u.surname AS captured_by,
            COALESCE((
              SELECT json_agg(json_build_object(
                'id', qi.id,
                'description', qi.description,
                'quantity', qi.quantity,
                'unit_price', qi.unit_price,
                'line_total', qi.line_total
              ) ORDER BY qi.description)
              FROM quote_items qi WHERE qi.quote_id = q.id
            ), '[]'::json) AS items
       FROM quotes q
       JOIN customers c ON c.id = q.customer_id
       LEFT JOIN users u ON u.id = q.created_by
      ORDER BY q.created_at DESC`);
  res.json(redactList(rows, ['subtotal', 'vat_amount', 'total'], req.user));
});

r.post('/quotes', requirePermission('quotes.create'), async (req, res) => {
  const b = req.body;
  const errors = [];
  if (!b.customer_id) errors.push('Customer is required');
  const description = (b.description || '').trim();
  if (!description) errors.push('Description is required');

  const items = normalizeItems(b.items);
  if (!items.length) errors.push('At least one product is required');
  const seen = new Set();
  for (const i of items) {
    if (!i.quantity || i.quantity <= 0) errors.push('Each product quantity must be greater than zero');
    if (seen.has(i.product_id)) errors.push('Each product can only appear once');
    seen.add(i.product_id);
  }
  if (errors.length) return res.status(422).json({ errors: [...new Set(errors)] });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const products = await loadProducts(client, items.map((i) => i.product_id));
    if (products.size !== items.length) {
      throw Object.assign(new Error('One or more products were not found'), { status: 400 });
    }

    let productsTotal = 0;
    const lines = items.map((i) => {
      const p = products.get(i.product_id);
      const unit = Number(p.price) || 0;
      productsTotal += unit * i.quantity;
      return {
        description: p.name,
        quantity: i.quantity,
        unit_price: unit,
      };
    });
    productsTotal = +productsTotal.toFixed(2);
    const vat = +(productsTotal * 0.15).toFixed(2);
    const total = +(productsTotal + vat).toFixed(2);
    const quoteNumber = await nextQuoteNumber(client);

    const { rows } = await client.query(
      `INSERT INTO quotes (quote_number, customer_id, description, status, subtotal, vat_amount, total, valid_until, created_by)
       VALUES ($1,$2,$3,'draft',$4,$5,$6, CURRENT_DATE + 30, $7)
       RETURNING id, valid_until`,
      [quoteNumber, b.customer_id, description, productsTotal, vat, total, req.user.id]
    );
    const quoteId = rows[0].id;

    for (const line of lines) {
      await client.query(
        `INSERT INTO quote_items (quote_id, description, quantity, unit_price)
         VALUES ($1,$2,$3,$4)`,
        [quoteId, line.description, line.quantity, line.unit_price]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ id: quoteId, quote_number: quoteNumber, valid_until: rows[0].valid_until });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.status) return res.status(err.status).json({ errors: [err.message] });
    throw err;
  } finally {
    client.release();
  }
});

r.post('/quotes/:id/send', requirePermission('quotes.create'), async (req, res) => {
  const channel = req.body.channel === 'whatsapp' ? 'whatsapp' : req.body.channel === 'email' ? 'email' : null;
  if (!channel) return res.status(422).json({ errors: ['channel must be email or whatsapp'] });
  if (channel === 'whatsapp' && !can(req.user, 'whatsapp.send')) {
    return res.status(403).json({ error: 'Missing permission: whatsapp.send' });
  }

  await expireStaleQuotes();

  const { rows } = await query(
    `SELECT q.id, q.quote_number, q.description, q.status, q.subtotal, q.vat_amount, q.total,
            q.valid_until::text AS valid_until, q.share_token,
            customer_display_name(c) AS customer_name, c.id AS customer_id,
            c.email AS customer_email, c.phone AS customer_phone
       FROM quotes q JOIN customers c ON c.id = q.customer_id
      WHERE q.id = $1`,
    [req.params.id]
  );
  const quote = rows[0];
  if (!quote) return res.status(404).json({ error: 'Not found' });
  if (quote.status === 'expired') {
    return res.status(400).json({ errors: ['This quote has expired and cannot be sent'] });
  }
  if (quote.status === 'declined') {
    return res.status(400).json({ errors: ['This quote was declined and cannot be sent'] });
  }
  if (channel === 'email' && !quote.customer_email) {
    return res.status(400).json({ errors: ['Customer has no email address'] });
  }
  if (channel === 'whatsapp') {
    const phone = phoneForWhatsApp(quote.customer_phone);
    if (!phone) return res.status(400).json({ errors: ['Customer has no phone number'] });
  }

  const shareToken = quote.share_token || (await ensureShareToken(quote.id));
  const pdfUrl = pdfPublicUrl(req, shareToken);
  const respondUrl = quoteRespondUrl(req, shareToken);

  const { rows: items } = await query(
    `SELECT description, quantity, unit_price, line_total FROM quote_items WHERE quote_id = $1 ORDER BY description`,
    [quote.id]
  );
  const body = buildQuoteMessage(quote, items, pdfUrl, respondUrl);
  const subject = `Quote ${quote.quote_number} — PrintShop Pro`;

  let url;
  if (channel === 'email') {
    url = `mailto:${quote.customer_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  } else {
    const phone = phoneForWhatsApp(quote.customer_phone);
    url = `https://wa.me/${phone}?text=${encodeURIComponent(body)}`;
    await query(
      `INSERT INTO whatsapp_messages (customer_id, template, body, status, created_by)
       VALUES ($1,'quote_sent',$2,'sent',$3)`,
      [quote.customer_id, body, req.user.id]
    );
  }

  if (quote.status === 'draft' || quote.status === 'sent') {
    await query(`UPDATE quotes SET status = 'sent' WHERE id = $1`, [quote.id]);
  }

  res.json({ ok: true, channel, url, subject, body, pdf_url: pdfUrl, respond_url: respondUrl });
});

r.get('/quotes/:id/pdf', async (req, res) => {
  const quote = await loadQuoteForPdf(req.params.id);
  if (!quote) return res.status(404).json({ error: 'Not found' });

  const { rows: items } = await query(
    `SELECT description, quantity, unit_price, line_total
       FROM quote_items WHERE quote_id = $1 ORDER BY description`,
    [quote.id]
  );

  try {
    const pdf = await buildQuotePdf({ quote, items });
    const filename = `${quote.quote_number}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdf);
  } catch (err) {
    console.error('Quote PDF failed:', err);
    res.status(500).json({ error: 'Could not generate PDF' });
  }
});

export default r;
