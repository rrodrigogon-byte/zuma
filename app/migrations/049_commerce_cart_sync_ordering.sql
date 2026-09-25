ALTER TABLE commerce_carts
  ADD COLUMN IF NOT EXISTS client_sync_version BIGINT NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'chk_commerce_cart_client_sync_version'
       AND conrelid = 'commerce_carts'::regclass
  ) THEN
    ALTER TABLE commerce_carts
      ADD CONSTRAINT chk_commerce_cart_client_sync_version
      CHECK (client_sync_version >= 0);
  END IF;
END $$;
