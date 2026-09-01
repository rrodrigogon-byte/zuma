-- Alias público de storefront para publicar tenants no domínio compartilhado sem
-- confiar em empresa_id enviado pelo navegador. A migration é somente aditiva:
-- não cria empresas, usuários, produtos, pedidos, pagamentos ou credenciais.

CREATE TABLE IF NOT EXISTS commerce_storefront_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  storefront_id UUID NOT NULL,
  alias VARCHAR(80) NOT NULL,
  brand_key VARCHAR(80) NOT NULL DEFAULT 'default',
  public_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_commerce_storefront_alias
    FOREIGN KEY (empresa_id, storefront_id)
    REFERENCES commerce_storefronts (empresa_id, id)
    ON DELETE CASCADE,
  CONSTRAINT chk_commerce_storefront_alias
    CHECK (alias ~ '^[a-z0-9][a-z0-9_-]{1,79}$'),
  CONSTRAINT chk_commerce_storefront_brand_key
    CHECK (brand_key ~ '^[a-z0-9][a-z0-9_-]{1,79}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_storefront_alias_lower
  ON commerce_storefront_aliases (lower(alias));

CREATE INDEX IF NOT EXISTS idx_commerce_storefront_alias_owner
  ON commerce_storefront_aliases (empresa_id, storefront_id, ativo);
