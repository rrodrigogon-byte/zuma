/* MIGRAÇÃO 021: permissões explícitas para promoções e cupons */
INSERT INTO commerce_permissions (codigo, descricao) VALUES
  ('promotions.read', 'Visualizar promoções e cupons'),
  ('promotions.write', 'Criar, editar e ativar promoções e cupons')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO commerce_role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM commerce_roles r
  CROSS JOIN commerce_permissions p
 WHERE r.empresa_id IS NULL
   AND p.codigo IN ('promotions.read', 'promotions.write')
   AND r.codigo IN ('platform_owner', 'tenant_owner', 'store_admin')
ON CONFLICT DO NOTHING;
