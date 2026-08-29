-- Compatibilidade incremental para bases Commerce criadas antes do read model completo.
-- Esta migration só adiciona colunas ausentes com valores neutros; não remove,
-- reescreve, cancela ou exclui pagamentos, pedidos ou estoque.

ALTER TABLE commerce_payments
  ADD COLUMN IF NOT EXISTS order_id UUID,
  ADD COLUMN IF NOT EXISTS payment_account_id UUID,
  ADD COLUMN IF NOT EXISTS provider VARCHAR(60),
  ADD COLUMN IF NOT EXISTS method VARCHAR(30),
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(180),
  ADD COLUMN IF NOT EXISTS amount NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS provider_payment_id VARCHAR(180),
  ADD COLUMN IF NOT EXISTS authorization_code VARCHAR(120),
  ADD COLUMN IF NOT EXISTS fee NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS authorized_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_commerce_payment_provider_status
  ON commerce_payments (empresa_id, provider, status, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_commerce_payment_idempotency
  ON commerce_payments (empresa_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_commerce_payment_provider_id
  ON commerce_payments (empresa_id, provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;
