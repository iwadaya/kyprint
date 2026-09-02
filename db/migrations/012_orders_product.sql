-- 012_orders_product.sql
-- Link orders to a catalog product so "times ordered" can be counted.

ALTER TABLE orders
  ADD COLUMN product_id UUID REFERENCES products(id);

CREATE INDEX idx_orders_product ON orders(product_id);
