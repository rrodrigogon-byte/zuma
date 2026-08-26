ALTER TABLE commerce_orders
  ADD COLUMN IF NOT EXISTS shipping_method_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_commerce_order_shipping_method'
  ) THEN
    ALTER TABLE commerce_orders
      ADD CONSTRAINT fk_commerce_order_shipping_method
      FOREIGN KEY (empresa_id, shipping_method_id)
      REFERENCES commerce_shipping_methods (empresa_id, id)
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_commerce_order_shipping_method
  ON commerce_orders (empresa_id, storefront_id, shipping_method_id);
