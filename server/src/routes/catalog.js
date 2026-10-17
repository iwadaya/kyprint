import { Router } from 'express';
import { query, pool } from '../db.js';
import { requirePermission } from '../auth.js';
import { redactList, can, canSeeFinancials } from '../permissions.js';

const r = Router();

r.get('/proofs', async (_req, res) => {
  const { rows } = await query(
    `SELECT p.id, p.filename, p.version, p.status, p.sent_at,
            o.order_number, customer_display_name(c) AS customer_name
       FROM proofs p JOIN orders o ON o.id = p.order_id
       JOIN customers c ON c.id = o.customer_id
      ORDER BY p.sent_at DESC`);
  res.json(rows);
});

r.patch('/proofs/:id', requirePermission('proofing.manage'), async (req, res) => {
  await query(`UPDATE proofs SET status=$1, approved_at = CASE WHEN $1='approved' THEN now() ELSE approved_at END WHERE id=$2`,
    [req.body.status, req.params.id]);
  res.json({ ok: true });
});

r.get('/stock', async (_req, res) => {
  const { rows } = await query(
    `SELECT id, name, category, sku, on_hand, reorder_at, unit_cost, updated_at,
            stock_state(on_hand, reorder_at) AS state
       FROM stock_items ORDER BY name`);
  res.json(rows);
});

function validateStock(body) {
  const errors = [];
  if (!body.name?.trim()) errors.push('Item name is required');
  if (body.on_hand === undefined || body.on_hand === null || body.on_hand === '' || Number(body.on_hand) < 0)
    errors.push('On hand must be zero or greater');
  if (body.reorder_at === undefined || body.reorder_at === null || body.reorder_at === '' || Number(body.reorder_at) < 0)
    errors.push('Reorder level must be zero or greater');
  if (body.unit_cost !== undefined && body.unit_cost !== null && body.unit_cost !== '' && Number(body.unit_cost) < 0)
    errors.push('Unit cost must be zero or greater');
  return errors;
}

function stockValues(body) {
  const sku = body.sku?.trim();
  return {
    name: body.name.trim(),
    sku: sku ? sku.toUpperCase() : null,
    on_hand: Number(body.on_hand),
    reorder_at: Math.floor(Number(body.reorder_at)),
    unit_cost: body.unit_cost === undefined || body.unit_cost === null || body.unit_cost === ''
      ? 0
      : Number(body.unit_cost),
  };
}

r.post('/stock', requirePermission('stock.manage'), async (req, res) => {
  const errors = validateStock(req.body);
  if (errors.length) return res.status(422).json({ errors });
  const s = stockValues(req.body);
  try {
    const { rows } = await query(
      `INSERT INTO stock_items (name, sku, on_hand, reorder_at, unit_cost)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [s.name, s.sku, s.on_hand, s.reorder_at, s.unit_cost]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    if (err.code === '23505') return res.status(422).json({ errors: ['SKU already exists'] });
    throw err;
  }
});

r.put('/stock/:id', requirePermission('stock.manage'), async (req, res) => {
  const errors = validateStock(req.body);
  if (errors.length) return res.status(422).json({ errors });
  const s = stockValues(req.body);
  try {
    const { rowCount } = await query(
      `UPDATE stock_items
          SET name=$1, sku=$2, on_hand=$3, reorder_at=$4, unit_cost=$5
        WHERE id=$6`,
      [s.name, s.sku, s.on_hand, s.reorder_at, s.unit_cost, req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === '23505') return res.status(422).json({ errors: ['SKU already exists'] });
    throw err;
  }
});

r.delete('/stock/:id', requirePermission('stock.manage'), async (req, res) => {
  try {
    const { rowCount } = await query(`DELETE FROM stock_items WHERE id = $1`, [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(422).json({ errors: ['This item is used by a product and cannot be deleted'] });
    }
    throw err;
  }
});

// ---------- PRODUCTS ----------
function validateProduct(body) {
  const errors = [];
  if (!body.name?.trim()) errors.push('Product name is required');
  if (body.price === undefined || body.price === null || Number(body.price) < 0)
    errors.push('Price must be zero or greater');
  const materials = Array.isArray(body.materials) ? body.materials : [];
  if (materials.length === 0)
    errors.push('At least one stock material with a quantity is required');
  const seen = new Set();
  for (const m of materials) {
    if (!m.stock_item_id) errors.push('Each material must select a stock item');
    if (!m.quantity || Number(m.quantity) <= 0)
      errors.push('Each material quantity must be greater than zero');
    if (m.stock_item_id) {
      if (seen.has(m.stock_item_id)) errors.push('Duplicate stock items are not allowed');
      seen.add(m.stock_item_id);
    }
  }
  return errors;
}

r.get('/products', async (req, res) => {
  const { rows } = await query(
    `SELECT p.id, p.name, p.price, p.created_at, p.updated_at,
            (SELECT COALESCE(SUM(oi.quantity), 0)::numeric FROM order_items oi
               JOIN orders o ON o.id = oi.order_id
              WHERE oi.product_id = p.id AND o.status <> 'cancelled') AS times_ordered,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', pm.id,
                  'stock_item_id', pm.stock_item_id,
                  'stock_name', s.name,
                  'sku', s.sku,
                  'quantity', pm.quantity
                ) ORDER BY s.name
              ) FILTER (WHERE pm.id IS NOT NULL),
              '[]'
            ) AS materials
       FROM products p
       LEFT JOIN product_materials pm ON pm.product_id = p.id
       LEFT JOIN stock_items s ON s.id = pm.stock_item_id
      GROUP BY p.id
      ORDER BY p.name`
  );
  const moneyVisible = canSeeFinancials(req.user) || can(req.user, 'stock.manage');
  res.json(moneyVisible ? rows : redactList(rows, ['price'], req.user));
});

r.post('/products', requirePermission('stock.manage'), async (req, res) => {
  const errors = validateProduct(req.body);
  if (errors.length) return res.status(400).json({ error: errors[0], errors });

  const name = req.body.name.trim();
  const price = Number(req.body.price);
  const materials = req.body.materials;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO products (name, price, created_by) VALUES ($1,$2,$3) RETURNING id`,
      [name, price, req.user.id]
    );
    const productId = rows[0].id;
    for (const m of materials) {
      await client.query(
        `INSERT INTO product_materials (product_id, stock_item_id, quantity) VALUES ($1,$2,$3)`,
        [productId, m.stock_item_id, Number(m.quantity)]
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ id: productId });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(400).json({ error: 'A product with that name already exists' });
    throw err;
  } finally {
    client.release();
  }
});

r.put('/products/:id', requirePermission('stock.manage'), async (req, res) => {
  const errors = validateProduct(req.body);
  if (errors.length) return res.status(400).json({ error: errors[0], errors });

  const name = req.body.name.trim();
  const price = Number(req.body.price);
  const materials = req.body.materials;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const upd = await client.query(
      `UPDATE products SET name=$1, price=$2 WHERE id=$3 RETURNING id`,
      [name, price, req.params.id]
    );
    if (!upd.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Product not found' });
    }
    await client.query(`DELETE FROM product_materials WHERE product_id=$1`, [req.params.id]);
    for (const m of materials) {
      await client.query(
        `INSERT INTO product_materials (product_id, stock_item_id, quantity) VALUES ($1,$2,$3)`,
        [req.params.id, m.stock_item_id, Number(m.quantity)]
      );
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(400).json({ error: 'A product with that name already exists' });
    throw err;
  } finally {
    client.release();
  }
});

r.get('/deliveries', async (_req, res) => {
  const { rows } = await query(
    `SELECT d.id, d.reference, d.carrier, d.tracking_ref, d.status, d.scheduled_for, d.created_at,
            o.order_number, customer_display_name(c) AS customer_name
       FROM deliveries d JOIN orders o ON o.id = d.order_id
       JOIN customers c ON c.id = o.customer_id
      ORDER BY d.created_at DESC`);
  res.json(rows);
});

r.get('/whatsapp', async (_req, res) => {
  const { rows } = await query(
    `SELECT w.id, w.template, w.body, w.status, w.sent_at,
            customer_display_name(c) AS customer_name
       FROM whatsapp_messages w JOIN customers c ON c.id = w.customer_id
      ORDER BY w.sent_at DESC`);
  res.json(rows);
});

r.post('/whatsapp', requirePermission('whatsapp.send'), async (req, res) => {
  const b = req.body;
  const { rows } = await query(
    `INSERT INTO whatsapp_messages (customer_id, template, body, status, created_by)
     VALUES ($1,$2,$3,'sent',$4) RETURNING id`,
    [b.customer_id, b.template || null, b.body, req.user.id]);
  res.status(201).json({ id: rows[0].id });
});

export default r;
