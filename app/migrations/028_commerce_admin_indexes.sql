-- Índices de leitura do backoffice e das filas operacionais.
-- Cada índice começa por empresa_id para preservar o isolamento multiempresa.
CREATE INDEX IF NOT EXISTS idx_commerce_products_tenant_updated
  ON commerce_products (empresa_id, atualizado_em DESC);

CREATE INDEX IF NOT EXISTS idx_commerce_orders_tenant_created
  ON commerce_orders (empresa_id, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_commerce_orders_tenant_storefront_created
  ON commerce_orders (empresa_id, storefront_id, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_commerce_customers_tenant_updated
  ON commerce_customers (empresa_id, atualizado_em DESC);

CREATE INDEX IF NOT EXISTS idx_commerce_order_items_tenant_order_id
  ON commerce_order_items (empresa_id, order_id, id ASC);

CREATE INDEX IF NOT EXISTS idx_commerce_product_media_tenant_product_order
  ON commerce_product_media (empresa_id, product_id, ordem ASC, criado_em ASC);
