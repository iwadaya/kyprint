-- 007_comms.sql
-- WhatsApp notifications, payment reminders, and an overdue-invoice view.

-- ---------- WHATSAPP ----------
CREATE TABLE whatsapp_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  template    TEXT,                            -- order_in_production | proof_ready | ...
  body        TEXT NOT NULL,
  status      wa_status NOT NULL DEFAULT 'queued',
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID REFERENCES users(id),       -- "Captured by"
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_wa_customer ON whatsapp_messages(customer_id);

-- ---------- PAYMENT REMINDERS ----------
CREATE TABLE payment_reminders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  stage       INT  NOT NULL DEFAULT 1,         -- 1st / 2nd / 3rd notice
  channel     reminder_channel NOT NULL DEFAULT 'whatsapp',
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID REFERENCES users(id),       -- "Captured by"
  CONSTRAINT reminder_stage_range CHECK (stage BETWEEN 1 AND 5)
);
CREATE INDEX idx_reminders_invoice ON payment_reminders(invoice_id);

-- Overdue invoices feed the Payment Reminders screen.
CREATE OR REPLACE VIEW overdue_invoices AS
SELECT i.id,
       i.invoice_number,
       i.customer_id,
       customer_display_name(c) AS customer_name,
       c.phone,
       i.balance,
       i.due_date,
       (current_date - i.due_date)                       AS days_overdue,
       COALESCE(MAX(r.stage), 0)                          AS last_stage,
       COALESCE(MAX(r.stage), 0) + 1                      AS next_stage
FROM invoices i
JOIN customers c            ON c.id = i.customer_id
LEFT JOIN payment_reminders r ON r.invoice_id = i.id
WHERE i.balance > 0
  AND i.due_date IS NOT NULL
  AND i.due_date < current_date
GROUP BY i.id, c.id, c.phone;
