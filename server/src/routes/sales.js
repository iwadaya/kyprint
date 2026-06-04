import { Router } from 'express';
import { query } from '../db.js';
import { requirePermission } from '../auth.js';
import { redactList } from '../permissions.js';

const r = Router();

const MONEY_FIELDS = ['subtotal', 'vat_amount', 'total', 'deposit_amount'];

// ---------- ORDERS ----------
r.get('/orders', async (req, res) => {
  const { rows } = await query(
    `SELECT o.id, o.order_number, o.description, o.status,
            o.subtotal, o.vat_amount, o.total, o.deposit_amount,
            o.order_date, o.due_date,
            customer_display_name(c) AS customer_name, c.id AS customer_id,
            u.first_name || ' ' || u.surname AS captured_by
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
       LEFT JOIN users u ON u.id = o.created_by
      ORDER BY o.created_at DESC`);
  res.json(redactList(rows, MONEY_FIELDS, req.user));
});

r.post('/orders', requirePermission('orders.create'), async (req, res) => {
  const b = req.body;
  const sub = Number(b.subtotal || 0);
  const vat = +(sub * 0.15).toFixed(2);
  const { rows } = await query(
    `INSERT INTO orders (order_number, customer_id, description, status, subtotal, vat_amount,
                         total, deposit_amount, due_date, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [b.order_number, b.customer_id, b.description, b.status || 'in_production',
     sub, vat, sub + vat, Number(b.deposit_amount || 0), b.due_date || null, req.user.id]);
  res.status(201).json({ id: rows[0].id });
});

r.patch('/orders/:id/status', requirePermission('orders.edit'), async (req, res) => {
  await query(`UPDATE orders SET status = $1 WHERE id = $2`, [req.body.status, req.params.id]);
  res.json({ ok: true });
});

// ---------- QUOTES ----------
r.get('/quotes', async (req, res) => {
  const { rows } = await query(
    `SELECT q.id, q.quote_number, q.description, q.status, q.subtotal, q.vat_amount, q.total,
            q.valid_until, customer_display_name(c) AS customer_name, c.id AS customer_id
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
