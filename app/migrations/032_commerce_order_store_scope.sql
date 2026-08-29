-- Corrige bases Commerce antigas que não possuíam o escopo de loja em pedidos.
-- Deriva o valor a partir do storefront já associado, sem remover ou reescrever
-- pedidos, pagamentos, clientes, produtos ou estoque.

ALTER TABLE commerce_orders
  ADD COLUMN IF NOT EXISTS loja_id UUID;

UPDATE commerce_orders o
   SET loja_id = s.loja_id
  FROM commerce_storefronts s
 WHERE s.empresa_id = o.empresa_id
   AND s.id = o.storefront_id
   AND o.loja_id IS NULL
   AND s.loja_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_commerce_orders_tenant_store_created
  ON commerce_orders (empresa_id, loja_id, criado_em DESC);
