-- Vínculo auditável entre a tentativa de pagamento e a conta do gateway usada.
-- A coluna é nullable para preservar pagamentos históricos importados antes desta migration.
ALTER TABLE commerce_payments
  ADD COLUMN IF NOT EXISTS payment_account_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'fk_commerce_payment_account'
       AND conrelid = 'commerce_payments'::regclass
  ) THEN
    ALTER TABLE commerce_payments
      ADD CONSTRAINT fk_commerce_payment_account
      FOREIGN KEY (payment_account_id)
      REFERENCES commerce_payment_accounts (id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_commerce_payment_account
  ON commerce_payments (empresa_id, payment_account_id, criado_em DESC);
