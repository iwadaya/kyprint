-- 002_users_permissions.sql
-- Staff users and the per-user 16-permission toggle matrix.
-- Owners implicitly hold every permission (enforced in code AND granted in seed).

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name      TEXT        NOT NULL,
  surname         TEXT        NOT NULL,
  email           CITEXT      NOT NULL UNIQUE,
  password_hash   TEXT        NOT NULL,
  role_label      TEXT        NOT NULL DEFAULT 'Staff',   -- e.g. "Owner · Admin", "Front-of-house"
  is_owner        BOOLEAN     NOT NULL DEFAULT FALSE,
  avatar_initials TEXT        GENERATED ALWAYS AS
                    (upper(left(first_name,1) || left(surname,1))) STORED,
  active          BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_email_format CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

-- Catalogue of the 16 permissions, grouped for the Access Control matrix UI.
CREATE TABLE permissions (
  key        TEXT PRIMARY KEY,
  label      TEXT NOT NULL,
  category   TEXT NOT NULL,         -- Operations | Finance | CRM & Admin
  sort_order INT  NOT NULL
);

-- Per-user grant. A missing row = not granted.
CREATE TABLE user_permissions (
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
  granted        BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (user_id, permission_key)
);

CREATE INDEX idx_user_permissions_user ON user_permissions(user_id);

-- The canonical 16 permission keys.
INSERT INTO permissions (key, label, category, sort_order) VALUES
  ('dashboard.view',     'View Dashboard',    'Operations',   1),
  ('orders.create',      'Create Orders',     'Operations',   2),
  ('orders.edit',        'Edit Orders',       'Operations',   3),
  ('orders.delete',      'Delete Orders',     'Operations',   4),
  ('proofing.manage',    'Manage Proofing',   'Operations',   5),
  ('stock.manage',       'Manage Stock',      'Operations',   6),
  ('deliveries.manage',  'Manage Deliveries', 'Operations',   7),
  ('finance.view',       'View Financials',   'Finance',      8),
  ('quotes.create',      'Create Quotes',     'Finance',      9),
  ('quotes.approve',     'Approve Quotes',    'Finance',     10),
  ('invoices.create',    'Create Invoices',   'Finance',     11),
  ('payments.record',    'Record Payments',   'Finance',     12),
  ('payments.refund',    'Issue Refunds',     'Finance',     13),
  ('customers.manage',   'Manage Customers',  'CRM & Admin', 14),
  ('whatsapp.send',      'Send WhatsApp',     'CRM & Admin', 15),
  ('users.manage',       'Manage Users',      'CRM & Admin', 16);
