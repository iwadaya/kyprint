-- 001_extensions_and_enums.sql
-- PrintShop Pro — base extensions and enumerated types
-- All monetary values are NUMERIC(12,2) in South African Rand (ZAR).

CREATE EXTENSION IF NOT EXISTS pgcrypto;        -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;          -- case-insensitive email

-- Customer classification
CREATE TYPE customer_type AS ENUM ('individual', 'company');

-- Order lifecycle
CREATE TYPE order_status AS ENUM
  ('in_production', 'proofing', 'ready', 'delivered', 'cancelled');

-- Quote lifecycle
CREATE TYPE quote_status AS ENUM
  ('draft', 'sent', 'accepted', 'expired', 'declined');

-- Invoice lifecycle
CREATE TYPE invoice_status AS ENUM
  ('draft', 'sent', 'partial', 'paid', 'overdue');

-- Payment classification & method
CREATE TYPE payment_type   AS ENUM ('payment', 'deposit', 'refund');
CREATE TYPE payment_method AS ENUM ('eft', 'card', 'cash', 'snapscan', 'payfast');

-- Proof review state
CREATE TYPE proof_status AS ENUM ('awaiting', 'approved', 'changes_requested');

-- Delivery state
CREATE TYPE delivery_status AS ENUM ('awaiting', 'in_transit', 'delivered', 'failed');

-- WhatsApp message state
CREATE TYPE wa_status AS ENUM ('queued', 'sent', 'delivered', 'read', 'failed');

-- Reminder channel
CREATE TYPE reminder_channel AS ENUM ('whatsapp', 'email', 'sms');
