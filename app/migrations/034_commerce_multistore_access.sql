/*
 * Migration 034 — sincroniza o acesso multiloja do Commerce Core.
 *
 * Usuários legados já possuem vínculos em usuarios_lojas, enquanto o Commerce
 * administra permissões em commerce_memberships. Esta migration preenche a
 * ponte de forma idempotente, sem copiar credenciais ou dados transacionais.
 */

-- Administradores/organizadores da empresa recebem escopo corporativo.
INSERT INTO commerce_memberships (empresa_id, usuario_id, loja_id, role_id, ativo)
SELECT u.empresa_id, u.id, NULL, r.id, true
  FROM usuarios u
  JOIN commerce_roles r
    ON r.empresa_id IS NULL AND r.codigo = 'tenant_owner'
 WHERE u.ativo = true
   AND lower(COALESCE(u.role, '')) IN ('admin', 'administrador', 'organizador')
ON CONFLICT (empresa_id, usuario_id) WHERE loja_id IS NULL
DO UPDATE SET role_id = EXCLUDED.role_id, ativo = true, atualizado_em = CURRENT_TIMESTAMP;

-- Vínculos operacionais legados passam a ser memberships de loja. O papel
-- operacional não concede users.write; a empresa continua sendo o limite máximo.
INSERT INTO commerce_memberships (empresa_id, usuario_id, loja_id, role_id, ativo)
SELECT u.empresa_id,
       u.id,
       ul.loja_id,
       r.id,
       true
  FROM usuarios_lojas ul
  JOIN usuarios u
    ON u.id = ul.usuario_id
  JOIN commerce_roles r
    ON r.empresa_id IS NULL
   AND r.codigo = CASE
     WHEN lower(COALESCE(u.role, ul.role_loja, '')) IN ('admin', 'administrador', 'organizador')
       THEN 'store_admin'
     WHEN lower(COALESCE(u.role, ul.role_loja, '')) IN ('staff', 'operador', 'vendedor', 'caixa')
       THEN 'order_operator'
     ELSE 'customer'
   END
 WHERE u.ativo = true
   AND ul.ativo = true
ON CONFLICT (empresa_id, usuario_id, loja_id)
DO UPDATE SET ativo = true, atualizado_em = CURRENT_TIMESTAMP;
