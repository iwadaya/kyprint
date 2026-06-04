import { Router } from 'express';
import { query } from '../db.js';
import { requirePermission } from '../auth.js';
import { redactList } from '../permissions.js';

const r = Router();

// ---------- INVOICES ----------
r.get('/invoices', async (req, res) => {
  const { rows } = await query(
    `SELECT i.id, i.invoice_number, i.status, i.subtotal, i.vat_amount, i.total, i.balance,
            i.issue_date, i.due_date, customer_display_name(c) AS customer_name
       FROM invoices i JOIN customers c ON c.id = i.customer_id
      ORDER BY i.issue_date DESC`);
  res.json(redactList(rows, ['subtotal', 'vat_amount', 'total', 'balance'], req.user));
});

r.post('/invoices', requirePermission('invoices.create'), async (req, res) => {
  const b = req.body;
  const sub = Number(b.subtotal || 0);
  const vat = +(sub * 0.15).toFixed(2);
  const { rows } = await query(
    `INSERT INTO invoices (invoice_number, customer_id, order_id, status, subtotal, vat_amount, total, due_date, created_by)
     VALUES ($1,$2,$3,'sent',$4,$5,$6,$7,$8) RETURNING id`,
    [b.invoice_number, b.customer_id, b.order_id || null, sub, vat, sub + vat, b.due_date || null, req.user.id]);
  res.status(201).json({ id: rows[0].id });
});

// ---------- PAYMENTS ----------
r.get('/payments', async (req, res) => {
  const { rows } = await query(
    `SELECT p.id, p.reference, p.type, p.method, p.amount, p.bank_ref, p.paid_at,
            i.invoice_number, o.order_number,
            u.first_name || ' ' || u.surname AS captured_by
       FROM payments p
       LEFT JOIN invoices i ON i.id = p.invoice_id
       LEFT JOIN orders   o ON o.id = p.order_id
       LEFT JOIN users    u ON u.id = p.created_by
      ORDER BY p.paid_at DESC, p.created_at DESC`);
  res.json(redactList(rows, ['amount'], req.user));
});

r.post('/payments', requirePermission('payments.record'), async (req, res) => {
  const b = req.body;
  if (b.type === 'refund' && !req.user.is_owner && !req.user.permissions.includes('payments.refund'))
    return res.status(403).json({ error: 'Missing permission: payments.refund' });
  const { rows } = await query(
    `INSERT INTO payments (reference, invoice_id, order_id, type, method, amount, bank_ref, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [b.reference, b.invoice_id || null, b.order_id || null, b.type || 'payment',
     b.method || 'eft', Number(b.amount), b.bank_ref || null, req.user.id]);
  res.status(201).json({ id: rows[0].id });
});

// ---------- REMINDERS (overdue feed) ----------
r.get('/reminders', async (req, res) => {
  const { rows } = await query(
    `SELECT invoice_number, customer_name, phone, balance, days_overdue, next_stage
       FROM overdue_invoices ORDER BY days_overdue DESC`);
  res.json(redactList(rows, ['balance'], req.user));
});

export default r;
