-- 016_quote_share_token.sql
-- Public share token so quote PDFs can be linked in email / WhatsApp.

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS share_token UUID NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_quotes_share_token ON quotes (share_token);
