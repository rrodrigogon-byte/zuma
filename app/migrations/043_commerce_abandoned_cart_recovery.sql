-- Recuperação governada de carrinhos Commerce.
-- Não cria consentimentos automaticamente e não ativa envios pelo deploy.

ALTER TABLE commerce_carts ADD COLUMN IF NOT EXISTS recovery_consent_at TIMESTAMPTZ;
ALTER TABLE commerce_carts ADD COLUMN IF NOT EXISTS recovery_revoked_at TIMESTAMPTZ;
ALTER TABLE commerce_carts ADD COLUMN IF NOT EXISTS recovery_due_at TIMESTAMPTZ;
ALTER TABLE commerce_carts ADD COLUMN IF NOT EXISTS recovery_reminded_at TIMESTAMPTZ;
ALTER TABLE commerce_carts ADD COLUMN IF NOT EXISTS recovery_provider_id VARCHAR(200);
ALTER TABLE commerce_carts ADD COLUMN IF NOT EXISTS recovery_status VARCHAR(24) NOT NULL DEFAULT 'not_requested';
ALTER TABLE commerce_carts ADD COLUMN IF NOT EXISTS recovery_evidence JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE commerce_carts ADD COLUMN IF NOT EXISTS recovery_source VARCHAR(40);
ALTER TABLE commerce_carts ADD COLUMN IF NOT EXISTS converted_order_id UUID;
ALTER TABLE commerce_carts ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE commerce_carts DROP CONSTRAINT IF EXISTS chk_commerce_cart_recovery_status;
ALTER TABLE commerce_carts
  ADD CONSTRAINT chk_commerce_cart_recovery_status
  CHECK (recovery_status IN ('not_requested','consented','queued','sent','revoked','converted','expired','failed'));

DO $$ BEGIN
  ALTER TABLE commerce_carts
    ADD CONSTRAINT fk_commerce_cart_converted_order
    FOREIGN KEY (empresa_id, converted_order_id)
    REFERENCES commerce_orders (empresa_id, id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_commerce_carts_recovery_due
  ON commerce_carts (empresa_id, storefront_id, recovery_due_at)
  WHERE status IN ('open','abandoned') AND recovery_status IN ('consented','queued');
CREATE INDEX IF NOT EXISTS idx_commerce_carts_customer_activity
  ON commerce_carts (empresa_id, customer_id, last_activity_at DESC);

ALTER TABLE tarefas_integracao_canais DROP CONSTRAINT IF EXISTS tarefas_integracao_canais_tipo_check;
ALTER TABLE tarefas_integracao_canais DROP CONSTRAINT IF EXISTS chk_tarefas_integracao_tipo;
ALTER TABLE tarefas_integracao_canais
  ADD CONSTRAINT chk_tarefas_integracao_tipo
  CHECK (tipo IN ('buscar_pedido', 'reconciliar', 'sincronizar_catalogo', 'processar_conversa', 'enviar_campanha', 'recuperar_carrinho'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_tarefas_recuperar_carrinho
  ON tarefas_integracao_canais (empresa_id, tipo, referencia_externa)
  WHERE tipo = 'recuperar_carrinho';

CREATE TABLE IF NOT EXISTS commerce_cart_recovery_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID REFERENCES lojas(id) ON DELETE SET NULL,
  cart_id UUID NOT NULL,
  customer_id UUID,
  tipo VARCHAR(32) NOT NULL,
  metadados JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cart_recovery_event_cart FOREIGN KEY (empresa_id, cart_id)
    REFERENCES commerce_carts (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_cart_recovery_event_customer FOREIGN KEY (empresa_id, customer_id)
    REFERENCES commerce_customers (empresa_id, id) ON DELETE SET NULL,
  CONSTRAINT chk_cart_recovery_event_type CHECK (tipo IN ('consented','updated','queued','sent','failed','revoked','converted','expired'))
);
CREATE INDEX IF NOT EXISTS idx_cart_recovery_events_cart
  ON commerce_cart_recovery_events (empresa_id, cart_id, criado_em DESC);
