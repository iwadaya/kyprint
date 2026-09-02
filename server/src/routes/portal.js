import { Router } from 'express';
import { query } from '../db.js';

const r = Router();

// Public, token-authenticated. The portal_token in the URL is the credential —
// no staff JWT required. A customer sees only their own data.
r.get('/:token', async (req, res) => {
  const c = (await query(
    `SELECT id, customer_display_name(c) AS display_name, first_name, surname, email, phone
       FROM customers c WHERE portal_token = $1`, [req.params.token])).rows[0];
  if (!c) return res.status(404).json({ error: 'Portal not found' });

  // Map order status to a 0–5 progress step for the progress bars.
  const orders = (await query(
    `SELECT order_number, description, status, due_date,
            CASE status WHEN 'in_production' THEN 2 WHEN 'proofing' THEN 1
                        WHEN 'ready' THEN 4 WHEN 'completed' THEN 5
                        WHEN 'delivered' THEN 5 ELSE 0 END AS step
       FROM orders WHERE customer_id = $1 ORDER BY created_at DESC`, [c.id])).rows;

  const proofs = (await query(
    `SELECT p.filename, p.status, o.order_number
       FROM proofs p JOIN orders o ON o.id = p.order_id
      WHERE o.customer_id = $1 ORDER BY p.sent_at DESC`, [c.id])).rows;

  const invoices = (await query(
    `SELECT invoice_number, issue_date, status, total, balance
       FROM invoices WHERE customer_id = $1 ORDER BY issue_date DESC`, [c.id])).rows;

  const balance = invoices.reduce((s, i) => s + Number(i.balance), 0);
  res.json({ customer: c, orders, proofs, invoices, balance, lifetime_orders: orders.length });
});

export default r;
