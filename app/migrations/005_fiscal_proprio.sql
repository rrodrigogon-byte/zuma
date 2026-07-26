-- =============================================================================
-- Migration 005: Motor Fiscal Próprio
-- SetPoint Ultra v3.0.0
-- =============================================================================

ALTER TABLE fiscal_configuracoes ADD COLUMN IF NOT EXISTS certificado_senha VARCHAR(100);
ALTER TABLE fiscal_configuracoes ADD COLUMN IF NOT EXISTS certificado_valido BOOLEAN DEFAULT FALSE;

-- Remover token_provedor já que não usamos mais o Focus NFe
-- ALTER TABLE fiscal_configuracoes DROP COLUMN IF EXISTS token_provedor;
-- ALTER TABLE fiscal_configuracoes DROP COLUMN IF EXISTS provedor;

COMMENT ON COLUMN fiscal_configuracoes.certificado_senha IS 'Senha do certificado A1 (.pfx) armazenado no disco local criptografado';
