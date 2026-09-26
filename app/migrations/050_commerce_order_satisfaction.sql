CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_orders_empresa_storefront_id
  ON commerce_orders (empresa_id, storefront_id, id);

CREATE TABLE IF NOT EXISTS commerce_order_satisfaction (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  storefront_id UUID NOT NULL,
  order_id UUID NOT NULL,
  nota SMALLINT NOT NULL CHECK (nota BETWEEN 1 AND 5),
  recomendaria BOOLEAN NOT NULL,
  idempotency_key VARCHAR(160) NOT NULL,
  payload_hash CHAR(64) NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  retencao_ate TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '365 days'),
  CONSTRAINT uq_commerce_order_satisfaction_order UNIQUE (empresa_id, order_id),
  CONSTRAINT uq_commerce_order_satisfaction_idempotency UNIQUE (empresa_id, idempotency_key),
  CONSTRAINT fk_commerce_order_satisfaction_storefront FOREIGN KEY (empresa_id, storefront_id)
    REFERENCES commerce_storefronts (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_commerce_order_satisfaction_order_storefront FOREIGN KEY (empresa_id, storefront_id, order_id)
    REFERENCES commerce_orders (empresa_id, storefront_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_commerce_order_satisfaction_storefront_date
  ON commerce_order_satisfaction (empresa_id, storefront_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_commerce_order_satisfaction_tenant_date
  ON commerce_order_satisfaction (empresa_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_commerce_order_satisfaction_retention
  ON commerce_order_satisfaction (retencao_ate);

CREATE TABLE IF NOT EXISTS commerce_public_rate_limits (
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  storefront_id UUID NOT NULL,
  scope VARCHAR(60) NOT NULL,
  bucket_key CHAR(64) NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  request_count INTEGER NOT NULL DEFAULT 1 CHECK (request_count > 0),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '1 day'),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (empresa_id, storefront_id, scope, bucket_key),
  CONSTRAINT fk_commerce_public_rate_limit_storefront FOREIGN KEY (empresa_id, storefront_id)
    REFERENCES commerce_storefronts (empresa_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_commerce_public_rate_limits_expiry
  ON commerce_public_rate_limits (expires_at);

COMMENT ON TABLE commerce_order_satisfaction IS
  'Pesquisa pós-compra minimizada, sem texto livre, tenant-scoped e disponível somente após entrega, retirada ou conclusão.';
COMMENT ON COLUMN commerce_order_satisfaction.retencao_ate IS
  'Prazo de retenção operacional; registros expirados são removidos no boot e a cada seis horas pelo processo da aplicação.';
COMMENT ON TABLE commerce_public_rate_limits IS
  'Contadores compartilhados entre réplicas para proteger leituras e mutações públicas do Commerce.';
