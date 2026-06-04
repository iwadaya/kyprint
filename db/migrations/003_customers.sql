-- 003_customers.sql
-- Customer directory. Models the refined spec:
--   first name + surname are ALWAYS present (the person / contact).
--   company_name is required only when type = 'company'.
--   VAT number optional; SA VAT numbers are 10 digits beginning with 4.

CREATE TABLE customers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type         customer_type NOT NULL DEFAULT 'individual',
  first_name   TEXT   NOT NULL,
  surname      TEXT   NOT NULL,
  company_name TEXT,                       -- required iff type = 'company'
  email        CITEXT NOT NULL,
  phone        TEXT   NOT NULL,            -- stored E.164-ish, e.g. +27824410192
  address_line1 TEXT,
  suburb        TEXT,
  city          TEXT,
  postal_code   TEXT,
  vat_number    TEXT,                      -- nullable; validated when present
  portal_token  UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,  -- shareable portal link
  created_by    UUID REFERENCES users(id),                       -- "Captured by"
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT customers_company_name_required
    CHECK (type <> 'company' OR (company_name IS NOT NULL AND length(trim(company_name)) > 0)),
  CONSTRAINT customers_email_format
    CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  CONSTRAINT customers_vat_format
    CHECK (vat_number IS NULL OR vat_number ~ '^4\d{9}$')
);

CREATE INDEX idx_customers_company ON customers(company_name);
CREATE INDEX idx_customers_surname ON customers(surname);

-- Display-name helper used widely by the API and reports.
CREATE OR REPLACE FUNCTION customer_display_name(c customers) RETURNS TEXT AS $$
  SELECT CASE
           WHEN c.type = 'company' THEN c.company_name
           ELSE c.first_name || ' ' || c.surname
         END;
$$ LANGUAGE sql IMMUTABLE;

-- keep updated_at fresh
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_customers_touch
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
