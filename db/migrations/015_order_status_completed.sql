-- 015_order_status_completed.sql
-- Completed = collected by the customer.

ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'completed';
