-- 017_invoice_quote_share.sql
-- Link invoices to accepted quotes and allow public PDF / payment links.

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS quote_id UUID REFERENCES quotes(id),
  ADD COLUMN IF NOT EXISTS share_token UUID NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_quote_id ON invoices (quote_id)
  WHERE quote_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_share_token ON invoices (share_token);
