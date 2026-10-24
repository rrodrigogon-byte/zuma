-- 102 — Perfis de acesso de toda empresa do Kytto: operador e profissional.
--
-- - Operador: a operação do dia (agenda, comandas, clientes, vendas, caixa e fechamento, lançar
--   despesa). Sem relatórios (reports.read), sem configurações e sem usuários: comissões, metas e
--   indicadores em número da empresa ficam com a administração.
-- - Profissional (barbeiro, manicure…): só o app do profissional, com os próprios números. Não
--   recebe permissão do Commerce; o servidor libera só as rotas do app (core/perfis-acesso.js).
-- Quem já tem acesso continua com o papel de hoje: a administração muda o perfil de cada pessoa.

INSERT INTO commerce_roles (empresa_id, codigo, nome, sistema)
SELECT NULL, seed.codigo, seed.nome, true
  FROM (VALUES ('operator', 'Operador'), ('professional', 'Profissional')) AS seed(codigo, nome)
 WHERE NOT EXISTS (SELECT 1 FROM commerce_roles r WHERE r.empresa_id IS NULL AND r.codigo = seed.codigo);

INSERT INTO commerce_role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM commerce_roles r
  JOIN commerce_permissions p ON p.codigo IN ('catalog.read', 'inventory.read', 'orders.read', 'orders.write',
                                              'customers.read', 'customers.write', 'payments.read', 'payments.write')
 WHERE r.empresa_id IS NULL AND r.codigo = 'operator'
ON CONFLICT DO NOTHING;
