-- 005_billing.sql
-- Invoices (with line items) and the payment ledger.
-- Payments store a POSITIVE amount; direction is derived from `type`
-- (refund = money out). The invoice `balance` is maintained by a trigger.

-- ---------- INVOICES ----------
CREATE TABLE invoices (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,        -- e.g. INV-1192
  customer_id    UUID NOT NULL REFERENCES customers(id),
  order_id       UUID REFERENCES orders(id),
  status         invoice_status NOT NULL DEFAULT 'draft',
  subtotal       NUMERIC(12,2) NOT NULL DEFAULT 0,
  vat_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  total          NUMERIC(12,2) NOT NULL DEFAULT 0,
  balance        NUMERIC(12,2) NOT NULL DEFAULT 0,   -- outstanding; kept in sync by trigger
  issue_date     DATE NOT NULL DEFAULT current_date,
  due_date       DATE,
  created_by     UUID REFERENCES users(id),    -- "Captured by"
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE invoice_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity    NUMERIC(12,2) NOT NULL DEFAULT 1,
  unit_price  NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_total  NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED
);

-- ---------- PAYMENTS ----------
CREATE TABLE payments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference   TEXT NOT NULL UNIQUE,            -- e.g. PMT-3310
  invoice_id  UUID REFERENCES invoices(id),
  order_id    UUID REFERENCES orders(id),      -- deposits often attach to an order
  type        payment_type   NOT NULL DEFAULT 'payment',
  method      payment_method NOT NULL DEFAULT 'eft',
  amount      NUMERIC(12,2)  NOT NULL CHECK (amount > 0),
  bank_ref    TEXT,
  note        TEXT,
  paid_at     DATE NOT NULL DEFAULT current_date,
  created_by  UUID REFERENCES users(id),       -- "Captured by"
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payment_target CHECK (invoice_id IS NOT NULL OR order_id IS NOT NULL)
);

CREATE INDEX idx_invoices_customer ON invoices(customer_id);
CREATE INDEX idx_invoices_status   ON invoices(status);
CREATE INDEX idx_payments_invoice  ON payments(invoice_id);

-- Recalculate an invoice's balance + status from its payments.
CREATE OR REPLACE FUNCTION recalc_invoice_balance(p_invoice UUID) RETURNS void AS $$
DECLARE
  v_total   NUMERIC(12,2);
  v_paid    NUMERIC(12,2);
  v_due     DATE;
BEGIN
  IF p_invoice IS NULL THEN RETURN; END IF;
  SELECT total, due_date INTO v_total, v_due FROM invoices WHERE id = p_invoice;
  SELECT COALESCE(SUM(CASE WHEN type = 'refund' THEN -amount ELSE amount END), 0)
    INTO v_paid FROM payments WHERE invoice_id = p_invoice;

  UPDATE invoices
     SET balance = v_total - v_paid,
         status  = CASE
                     WHEN v_total - v_paid <= 0 THEN 'paid'::invoice_status
                     WHEN v_paid > 0            THEN 'partial'::invoice_status
                     WHEN v_due IS NOT NULL AND v_due < current_date THEN 'overdue'::invoice_status
                     ELSE status
                   END
   WHERE id = p_invoice;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_payment_recalc() RETURNS trigger AS $$
BEGIN
  PERFORM recalc_invoice_balance(COALESCE(NEW.invoice_id, OLD.invoice_id));
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_payments_after
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION trg_payment_recalc();

-- Initialise balance = total when an invoice is created/updated.
CREATE OR REPLACE FUNCTION trg_invoice_init_balance() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN NEW.balance := NEW.total; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_invoices_init
  BEFORE INSERT ON invoices
  FOR EACH ROW EXECUTE FUNCTION trg_invoice_init_balance();
