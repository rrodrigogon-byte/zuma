-- Commerce Core: permissões explícitas para entrega e fulfillment.
-- A migration é idempotente e não concede acesso a usuários diretamente.

INSERT INTO commerce_permissions (codigo, descricao) VALUES
  ('fulfillment.read', 'Visualizar métodos e fulfillments'),
  ('fulfillment.write', 'Configurar entrega e operar fulfillments')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO commerce_role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM commerce_roles r
  JOIN commerce_permissions p
    ON p.codigo IN ('fulfillment.read', 'fulfillment.write')
 WHERE r.empresa_id IS NULL
   AND r.codigo IN ('platform_owner', 'tenant_owner', 'store_admin', 'order_operator')
ON CONFLICT DO NOTHING;
