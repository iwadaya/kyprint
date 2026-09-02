-- 010_orders_due_datetime.sql
-- Store order due dates with a time component (collection / deadline).

ALTER TABLE orders
  ALTER COLUMN due_date TYPE TIMESTAMPTZ
  USING CASE
    WHEN due_date IS NULL THEN NULL
    ELSE due_date::timestamp AT TIME ZONE 'Africa/Johannesburg'
  END;
