import { Router } from 'express';
import { query } from '../db.js';
import { canSeeFinancials } from '../permissions.js';

const r = Router();

const MONTH = `date_trunc('month', current_date)`;

// Returns metrics shaped by what the user is allowed to see.
// Employees without finance.view get operational counts only; money keys come back null.
// All counts are scoped to the current calendar month.
r.get('/', async (req, res) => {
  const fin = canSeeFinancials(req.user);

  const [counts] = (await query(`
    SELECT
      (SELECT count(*) FROM orders
        WHERE status <> 'delivered' AND status <> 'cancelled' AND status <> 'completed'
          AND date_trunc('month', order_date) = ${MONTH}) AS active_orders,
      (SELECT count(*) FROM orders
        WHERE status = 'in_production'
          AND date_trunc('month', order_date) = ${MONTH}) AS in_production,
      (SELECT count(*) FROM orders
        WHERE status = 'proofing'
          AND date_trunc('month', order_date) = ${MONTH}) AS proofing,
      (SELECT count(*) FROM orders
        WHERE status = 'ready'
          AND date_trunc('month', order_date) = ${MONTH}) AS ready,
      (SELECT count(*) FROM proofs
        WHERE status = 'awaiting'
          AND date_trunc('month', sent_at) = ${MONTH}) AS awaiting_proof,
      (SELECT count(*) FROM deliveries
        WHERE status = 'in_transit'
          AND date_trunc('month', created_at) = ${MONTH}) AS out_for_delivery,
      (SELECT count(*) FROM overdue_invoices
        WHERE date_trunc('month', due_date) = ${MONTH}) AS overdue_count
  `)).rows;

  let money = { revenue_month: null, outstanding: null, deposits_held: null };
  if (fin) {
    const [m] = (await query(`
      SELECT
        COALESCE((SELECT SUM(amount) FROM payments WHERE type='payment'
                   AND date_trunc('month', paid_at)=${MONTH}),0) AS revenue_month,
        COALESCE((SELECT SUM(balance) FROM invoices
                   WHERE balance > 0 AND date_trunc('month', issue_date)=${MONTH}),0) AS outstanding,
        COALESCE((SELECT SUM(amount) FROM payments WHERE type='deposit'
                   AND date_trunc('month', paid_at)=${MONTH}),0) AS deposits_held
    `)).rows;
    money = m;
  }

  res.json({ ...counts, ...money, can_see_financials: fin });
});

export default r;
