-- Category is no longer collected. SKU is optional; several items may have no SKU.
ALTER TABLE stock_items ALTER COLUMN category DROP NOT NULL;
ALTER TABLE stock_items ALTER COLUMN sku DROP NOT NULL;
