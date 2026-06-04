-- 006_production.sql
-- Proofing, stock/materials, and deliveries.

-- ---------- PROOFS ----------
CREATE TABLE proofs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  filename   TEXT NOT NULL,
  version    INT  NOT NULL DEFAULT 1,
  status     proof_status NOT NULL DEFAULT 'awaiting',
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),       -- "Captured by"
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_proofs_order ON proofs(order_id);

-- ---------- STOCK ----------
CREATE TABLE stock_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  category   TEXT NOT NULL,                    -- PAPER | VINYL | INK | HARDWARE | FILM ...
  sku        TEXT NOT NULL UNIQUE,
  on_hand    INT  NOT NULL DEFAULT 0,
  reorder_at INT  NOT NULL DEFAULT 0,
  unit_cost  NUMERIC(12,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Derived stock state for the UI badge.
CREATE OR REPLACE FUNCTION stock_state(p_on_hand INT, p_reorder INT) RETURNS TEXT AS $$
  SELECT CASE
           WHEN p_on_hand <= 0          THEN 'out'
           WHEN p_on_hand <= p_reorder  THEN 'low'
           ELSE 'in_stock'
         END;
$$ LANGUAGE sql IMMUTABLE;

CREATE TRIGGER trg_stock_touch
  BEFORE UPDATE ON stock_items
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ---------- DELIVERIES ----------
CREATE TABLE deliveries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference     TEXT NOT NULL UNIQUE,          -- e.g. DLV-088
  order_id      UUID NOT NULL REFERENCES orders(id),
  carrier       TEXT NOT NULL,                 -- The Courier Guy | Pargo | Own Driver ...
  tracking_ref  TEXT,
  status        delivery_status NOT NULL DEFAULT 'awaiting',
  scheduled_for DATE,
  created_by    UUID REFERENCES users(id),     -- "Captured by"
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_deliveries_order ON deliveries(order_id);
