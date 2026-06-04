-- 008_audit.sql
-- Generic audit trail (who did what) plus a couple of reporting views.

CREATE TABLE audit_log (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES users(id),
  action      TEXT NOT NULL,                   -- create | update | delete | send | login ...
  entity_type TEXT NOT NULL,                   -- order | invoice | payment | customer ...
  entity_id   TEXT,
  detail      JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_user   ON audit_log(user_id);

-- Convenience view: customers with rolled-up order count + lifetime spend.
CREATE OR REPLACE VIEW customer_summary AS
SELECT c.*,
       customer_display_name(c)                      AS display_name,
       COUNT(DISTINCT o.id)                           AS order_count,
       COALESCE(SUM(p.amount) FILTER
         (WHERE p.type <> 'refund'), 0)               AS lifetime_spend
FROM customers c
LEFT JOIN orders o   ON o.customer_id = c.id
LEFT JOIN invoices i ON i.customer_id = c.id
LEFT JOIN payments p ON p.invoice_id  = i.id
GROUP BY c.id;
