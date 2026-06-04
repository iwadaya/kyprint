import { Router } from 'express';
import { query } from '../db.js';
import { canSeeFinancials } from '../permissions.js';

const r = Router();

// Returns metrics shaped by what the user is allowed to see.
// Employees without finance.view get operational counts only; money keys come back null.
r.get('/', async (req, res) => {
  const fin = canSeeFinancials(req.user);

  const [counts] = (await query(`
    SELECT
      (SELECT count(*) FROM orders  WHERE status <> 'delivered' AND status <> 'cancelled') AS active_orders,
      (SELECT count(*) FROM orders  WHERE status = 'in_production') AS in_production,
      (SELECT count(*) FROM orders  WHERE status = 'proofing')      AS proofing,
      (SELECT count(*) FROM orders  WHERE status = 'ready')         AS ready,
      (SELECT count(*) FROM proofs  WHERE status = 'awaiting')      AS awaiting_proof,
      (SELECT count(*) FROM deliveries WHERE status = 'in_transit') AS out_for_delivery,
      (SELECT count(*) FROM overdue_invoices)                       AS overdue_count
  `)).rows;

  let money = { revenue_month: null, outstanding: null, deposits_held: null };
  if (fin) {
    const [m] = (await query(`
      SELECT
        COALESCE((SELECT SUM(amount) FROM payments WHERE type='payment'
                   AND date_trunc('month', paid_at)=date_trunc('month',current_date)),0) AS revenue_month,
        COALESCE((SELECT SUM(balance) FROM invoices WHERE balance > 0),0)                 AS outstanding,
        COALESCE((SELECT SUM(amount) FROM payments WHERE type='deposit'),0)               AS deposits_held
    `)).rows;
    money = m;
  }

  res.json({ ...counts, ...money, can_see_financials: fin });
});

export default r;
