import { Router } from 'express';
import { query, pool } from '../db.js';
import { requirePermission } from '../auth.js';
import { redactList, canSeeFinancials } from '../permissions.js';

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
r.get('/quotes', async (req, res) => {
  const { rows } = await query(
    `SELECT q.id, q.quote_number, q.description, q.status, q.subtotal, q.vat_amount, q.total,
            q.valid_until, q.created_at, customer_display_name(c) AS customer_name, c.id AS customer_id
       FROM quotes q JOIN customers c ON c.id = q.customer_id
      ORDER BY q.created_at DESC`);
  res.json(redactList(rows, ['subtotal', 'vat_amount', 'total'], req.user));
});

r.post('/quotes', requirePermission('quotes.create'), async (req, res) => {
  const b = req.body;
  const sub = Number(b.subtotal || 0);
  const vat = +(sub * 0.15).toFixed(2);
  const { rows } = await query(
    `INSERT INTO quotes (quote_number, customer_id, description, status, subtotal, vat_amount, total, valid_until, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [b.quote_number, b.customer_id, b.description, b.status || 'draft', sub, vat, sub + vat,
     b.valid_until || null, req.user.id]);
  res.status(201).json({ id: rows[0].id });
});

export default r;
