-- Migration 029: compatibilidade do schema de pedidos do Commerce Core.
--
-- Algumas bases podem ter sido criadas por uma versão anterior de 019_commerce_core.sql.
-- O executor de migrations não reaplica arquivos já registrados; por isso esta migration
-- adiciona apenas colunas ausentes, sem apagar, reescrever ou migrar registros.

ALTER TABLE commerce_orders
  ADD COLUMN IF NOT EXISTS moeda CHAR(3) DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS origem VARCHAR(30) DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconto NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS frete NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS impostos NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS endereco_entrega JSONB,
  ADD COLUMN IF NOT EXISTS endereco_cobranca JSONB,
  ADD COLUMN IF NOT EXISTS observacao VARCHAR(1000),
  ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS shipping_method_id UUID,
  ADD COLUMN IF NOT EXISTS shipping_quote_id UUID;

CREATE INDEX IF NOT EXISTS idx_commerce_orders_tenant_created
  ON commerce_orders (empresa_id, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_commerce_orders_tenant_storefront_created
  ON commerce_orders (empresa_id, storefront_id, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_commerce_order_shipping_method
  ON commerce_orders (empresa_id, storefront_id, shipping_method_id);

CREATE INDEX IF NOT EXISTS idx_commerce_order_shipping_quote
  ON commerce_orders (empresa_id, shipping_quote_id);
