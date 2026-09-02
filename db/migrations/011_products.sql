-- 011_products.sql
-- Sellable products and the stock bill-of-materials each product consumes.

CREATE TABLE products (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  price      NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE product_materials (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  stock_item_id UUID NOT NULL REFERENCES stock_items(id),
  quantity      NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  UNIQUE (product_id, stock_item_id)
);

CREATE INDEX idx_product_materials_product ON product_materials(product_id);
CREATE INDEX idx_product_materials_stock   ON product_materials(stock_item_id);

CREATE TRIGGER trg_products_touch
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Materials used by the A3 canvas example (safe to re-run via ON CONFLICT).
INSERT INTO stock_items (name, category, sku, on_hand, reorder_at, unit_cost) VALUES
  ('A3 Wooden Frame', 'HARDWARE', 'SUP-FRMA3', 48, 10, 45.00),
  ('Canvas Sheet', 'FILM', 'SUP-CNV01', 250, 40, 18.50)
ON CONFLICT (sku) DO NOTHING;
