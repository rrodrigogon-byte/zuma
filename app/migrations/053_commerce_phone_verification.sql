-- Confirmação de número de WhatsApp por código (crediário na vitrine e consentimento
-- do lembrete de carrinho). Guarda só o hash do código, com prazo e limite de tentativas.
CREATE TABLE IF NOT EXISTS commerce_phone_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  telefone_chave VARCHAR(20) NOT NULL,
  codigo_hash CHAR(64) NOT NULL,
  tentativas INTEGER NOT NULL DEFAULT 0,
  expira_em TIMESTAMPTZ NOT NULL,
  verificado_em TIMESTAMPTZ,
  ip_hash CHAR(64),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_phone_verification_attempts CHECK (tentativas >= 0 AND tentativas <= 10)
);
CREATE INDEX IF NOT EXISTS idx_phone_verification_lookup
  ON commerce_phone_verifications (empresa_id, telefone_chave, criado_em DESC);
