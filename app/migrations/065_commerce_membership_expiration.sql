-- Migration 065: validade server-side de memberships Commerce.
-- Dependência de integração: a migration 064 deve existir/aplicar antes desta no
-- runner final. Este arquivo é idempotente e não cria contas nem credenciais.
ALTER TABLE commerce_memberships
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_commerce_membership_expiration
  ON commerce_memberships (empresa_id, usuario_id, ativo, expires_at);
