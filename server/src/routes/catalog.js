import { Router } from 'express';
import { query } from '../db.js';
import { requirePermission } from '../auth.js';

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
    `SELECT id, name, category, sku, on_hand, reorder_at, unit_cost,
            stock_state(on_hand, reorder_at) AS state
       FROM stock_items ORDER BY name`);
  res.json(rows);
});

r.get('/deliveries', async (_req, res) => {
  const { rows } = await query(
    `SELECT d.id, d.reference, d.carrier, d.tracking_ref, d.status, d.scheduled_for,
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
