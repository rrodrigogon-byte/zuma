-- Recuperação de credenciais sem alterar identidades, memberships ou permissões.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;
ALTER TABLE commerce_accounts ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS auth_password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type VARCHAR(16) NOT NULL CHECK (subject_type IN ('account','operational','legacy')),
  subject_id VARCHAR(100) NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  credential_hash CHAR(64) NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL,
  delivered BOOLEAN NOT NULL DEFAULT false,
  used_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_auth_reset_subject ON auth_password_resets(subject_type,subject_id,criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_auth_reset_expiry ON auth_password_resets(expires_at) WHERE used_at IS NULL;
