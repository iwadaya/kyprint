-- 009_orders_assigned_to.sql
-- Track which staff member owns production work on an order.

ALTER TABLE orders
  ADD COLUMN assigned_to UUID REFERENCES users(id);

CREATE INDEX idx_orders_assigned ON orders(assigned_to);

-- Backfill existing rows for demo / live databases.
UPDATE orders o
   SET assigned_to = (SELECT id FROM users WHERE role_label = 'Production' LIMIT 1)
 WHERE o.status IN ('in_production', 'ready')
   AND o.assigned_to IS NULL;

UPDATE orders o
   SET assigned_to = (SELECT id FROM users WHERE role_label = 'Design' LIMIT 1)
 WHERE o.status = 'proofing'
   AND o.assigned_to IS NULL;
