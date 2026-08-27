-- Commerce Core: contas logísticas, cotação por CEP e vínculo de fulfillment
CREATE TABLE IF NOT EXISTS commerce_shipping_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  storefront_id UUID NOT NULL,
  provider VARCHAR(60) NOT NULL,
  ambiente VARCHAR(20) NOT NULL DEFAULT 'sandbox',
  nome VARCHAR(120) NOT NULL,
  secret_ref VARCHAR(240) NOT NULL,
  public_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  ativo BOOLEAN NOT NULL DEFAULT false,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_commerce_shipping_account_name UNIQUE (empresa_id, storefront_id, provider, ambiente, nome),
  CONSTRAINT fk_commerce_shipping_account_storefront FOREIGN KEY (empresa_id, storefront_id)
    REFERENCES commerce_storefronts (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT chk_commerce_shipping_account_environment CHECK (ambiente IN ('sandbox','production'))
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_commerce_shipping_account_empresa_id') THEN
    ALTER TABLE commerce_shipping_accounts
      ADD CONSTRAINT uq_commerce_shipping_account_empresa_id UNIQUE (empresa_id, id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_commerce_shipping_account_active
  ON commerce_shipping_accounts (empresa_id, storefront_id, ativo);

CREATE TABLE IF NOT EXISTS commerce_shipping_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  storefront_id UUID NOT NULL,
  shipping_method_id UUID NOT NULL,
  shipping_account_id UUID NOT NULL,
  order_id UUID,
  provider VARCHAR(60) NOT NULL,
  ambiente VARCHAR(20) NOT NULL,
  origem_cep VARCHAR(8) NOT NULL,
  destino_cep VARCHAR(8) NOT NULL,
  request_hash VARCHAR(128) NOT NULL,
  request_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  selected_option_id VARCHAR(180),
  selected_amount NUMERIC(14,2),
  status VARCHAR(20) NOT NULL DEFAULT 'quoted',
  expires_at TIMESTAMPTZ NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_commerce_shipping_quote_storefront FOREIGN KEY (empresa_id, storefront_id)
    REFERENCES commerce_storefronts (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_commerce_shipping_quote_method FOREIGN KEY (empresa_id, shipping_method_id)
    REFERENCES commerce_shipping_methods (empresa_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_commerce_shipping_quote_account FOREIGN KEY (empresa_id, shipping_account_id)
    REFERENCES commerce_shipping_accounts (empresa_id, id) ON DELETE RESTRICT,
  CONSTRAINT chk_commerce_shipping_quote_status CHECK (status IN ('quoted','selected','used','expired','failed')),
  CONSTRAINT chk_commerce_shipping_quote_values CHECK (selected_amount IS NULL OR selected_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_commerce_shipping_quote_checkout
  ON commerce_shipping_quotes (empresa_id, storefront_id, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_commerce_shipping_quote_order
  ON commerce_shipping_quotes (empresa_id, order_id);

CREATE TABLE IF NOT EXISTS commerce_shipping_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  provider VARCHAR(60) NOT NULL,
  provider_event_id VARCHAR(180) NOT NULL,
  provider_shipment_id VARCHAR(180),
  event_type VARCHAR(100) NOT NULL,
  signature_valid BOOLEAN NOT NULL DEFAULT false,
  status VARCHAR(20) NOT NULL DEFAULT 'received',
  payload_hash VARCHAR(128) NOT NULL,
  payload_resumido JSONB NOT NULL DEFAULT '{}'::jsonb,
  processado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_commerce_shipping_webhook UNIQUE (empresa_id, provider, provider_event_id),
  CONSTRAINT chk_commerce_shipping_webhook_status CHECK (status IN ('received','processed','ignored','failed'))
);

CREATE INDEX IF NOT EXISTS idx_commerce_shipping_webhook_status
  ON commerce_shipping_webhooks (provider, status, criado_em);

ALTER TABLE commerce_orders
  ADD COLUMN IF NOT EXISTS shipping_quote_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_commerce_order_shipping_quote') THEN
    ALTER TABLE commerce_orders
      ADD CONSTRAINT fk_commerce_order_shipping_quote
      FOREIGN KEY (shipping_quote_id) REFERENCES commerce_shipping_quotes (id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_commerce_order_shipping_quote
  ON commerce_orders (empresa_id, shipping_quote_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_commerce_shipping_quote_order') THEN
    ALTER TABLE commerce_shipping_quotes
      ADD CONSTRAINT fk_commerce_shipping_quote_order
      FOREIGN KEY (empresa_id, order_id) REFERENCES commerce_orders (empresa_id, id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE commerce_fulfillments
  ADD COLUMN IF NOT EXISTS shipping_quote_id UUID,
  ADD COLUMN IF NOT EXISTS shipping_account_id UUID,
  ADD COLUMN IF NOT EXISTS provider_shipment_id VARCHAR(180),
  ADD COLUMN IF NOT EXISTS tracking_url VARCHAR(600),
  ADD COLUMN IF NOT EXISTS label_url VARCHAR(600),
  ADD COLUMN IF NOT EXISTS shipping_operation_status VARCHAR(20) NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS shipping_operation_key VARCHAR(180),
  ADD COLUMN IF NOT EXISTS shipping_operation_started_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_commerce_fulfillment_shipping_quote') THEN
    ALTER TABLE commerce_fulfillments
      ADD CONSTRAINT fk_commerce_fulfillment_shipping_quote
      FOREIGN KEY (shipping_quote_id) REFERENCES commerce_shipping_quotes (id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_commerce_fulfillment_shipping_account') THEN
    ALTER TABLE commerce_fulfillments
      ADD CONSTRAINT fk_commerce_fulfillment_shipping_account
      FOREIGN KEY (shipping_account_id) REFERENCES commerce_shipping_accounts (id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_commerce_fulfillment_shipping_operation_status') THEN
    ALTER TABLE commerce_fulfillments
      ADD CONSTRAINT chk_commerce_fulfillment_shipping_operation_status
      CHECK (shipping_operation_status IN ('idle','processing','succeeded','failed'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_fulfillment_provider_shipment
  ON commerce_fulfillments (empresa_id, provider_shipment_id)
  WHERE provider_shipment_id IS NOT NULL;
