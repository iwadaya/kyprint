-- 004_sales.sql
-- Quotes and Orders (production jobs), each with line items.
-- A quote can convert into an order (orders.quote_id).

-- ---------- QUOTES ----------
CREATE TABLE quotes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number TEXT NOT NULL UNIQUE,          -- e.g. QUO-0451
  customer_id  UUID NOT NULL REFERENCES customers(id),
  description  TEXT NOT NULL,
  status       quote_status NOT NULL DEFAULT 'draft',
  subtotal     NUMERIC(12,2) NOT NULL DEFAULT 0,
  vat_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
  total        NUMERIC(12,2) NOT NULL DEFAULT 0,
  valid_until  DATE,
  created_by   UUID REFERENCES users(id),      -- "Captured by"
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE quote_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id    UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity    NUMERIC(12,2) NOT NULL DEFAULT 1,
  unit_price  NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_total  NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED
);

-- ---------- ORDERS ----------
CREATE TABLE orders (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,          -- e.g. ORD-2087
  customer_id  UUID NOT NULL REFERENCES customers(id),
  quote_id     UUID REFERENCES quotes(id),    -- set when converted from a quote
  description  TEXT NOT NULL,
  status       order_status NOT NULL DEFAULT 'in_production',
  subtotal       NUMERIC(12,2) NOT NULL DEFAULT 0,
  vat_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  total          NUMERIC(12,2) NOT NULL DEFAULT 0,
  deposit_amount NUMERIC(12,2) NOT NULL DEFAULT 0,   -- purple-coded deposit
  order_date   DATE NOT NULL DEFAULT current_date,
  due_date     DATE,
  created_by   UUID REFERENCES users(id),     -- "Captured by"
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity    NUMERIC(12,2) NOT NULL DEFAULT 1,
  unit_price  NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_total  NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED
);

CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status   ON orders(status);
CREATE INDEX idx_quotes_customer ON quotes(customer_id);
