-- 013_order_products_notes_stock.sql
-- Multi-product order lines, notes, and numeric stock for BOM deductions.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id);

CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

-- Allow fractional on-hand for materials like ink / sheet area.
ALTER TABLE stock_items
  ALTER COLUMN on_hand TYPE NUMERIC(12,3)
  USING on_hand::numeric;

-- Keep stock_state compatible with numeric on_hand.
CREATE OR REPLACE FUNCTION stock_state(p_on_hand NUMERIC, p_reorder INT) RETURNS TEXT AS $$
  SELECT CASE
           WHEN p_on_hand <= 0          THEN 'out'
           WHEN p_on_hand <= p_reorder  THEN 'low'
           ELSE 'in_stock'
         END;
$$ LANGUAGE sql IMMUTABLE;
