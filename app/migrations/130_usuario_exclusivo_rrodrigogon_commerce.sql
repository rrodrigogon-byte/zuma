-- Migration 130: Ajuste de conta exclusiva de producao para rrodrigogon@gmail.com
-- Garantir origem 'commerce', hash de senha '#080581verdao' e grant de plataforma ativo

UPDATE commerce_accounts
SET origem = 'commerce',
    origem_id = NULL,
    senha_hash = '$2a$10$rrlty1ZSku/ISq/2wI7qBuYhZMWL.PspcgaiMa39NwXcHCYvrRkGS',
    ativo = true,
    atualizado_em = NOW()
WHERE email = 'rrodrigogon@gmail.com';

-- Desativar todas as outras contas em commerce_accounts
UPDATE commerce_accounts
SET ativo = false,
    atualizado_em = NOW()
WHERE email <> 'rrodrigogon@gmail.com';

-- Desativar todos os outros usuarios na tabela usuarios
UPDATE usuarios
SET ativo = false,
    atualizado_em = NOW()
WHERE email <> 'rrodrigogon@gmail.com';

-- Garantir concessao de plataforma ativa para a conta exclusiva
INSERT INTO commerce_platform_grants (
  account_id,
  ativo,
  granted_by,
  criado_em,
  atualizado_em
)
SELECT
  id,
  true,
  'system_migration_130',
  NOW(),
  NOW()
FROM commerce_accounts
WHERE email = 'rrodrigogon@gmail.com'
ON CONFLICT (account_id) DO UPDATE SET
  ativo = true,
  granted_by = 'system_migration_130',
  atualizado_em = NOW();
