-- Uma conta de login pode ter identidades operacionais LOCAIS em vários tenants.
-- Nenhum cadastro/vínculo existente é migrado ou combinado automaticamente.
CREATE TABLE IF NOT EXISTS commerce_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(320) NOT NULL UNIQUE,
  nome VARCHAR(255) NOT NULL,
  telefone VARCHAR(30),
  senha_hash TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  origem VARCHAR(20) NOT NULL DEFAULT 'new',
  origem_id VARCHAR(100),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_commerce_account_email CHECK (email = lower(btrim(email))),
  CONSTRAINT chk_commerce_account_origin CHECK (origem IN ('new','legacy','commerce')),
  CONSTRAINT uq_commerce_account_origin UNIQUE (origem, origem_id)
);

CREATE TABLE IF NOT EXISTS commerce_account_users (
  account_id UUID NOT NULL REFERENCES commerce_accounts(id) ON DELETE RESTRICT,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  usuario_id UUID NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (account_id, empresa_id),
  CONSTRAINT uq_commerce_account_local_user UNIQUE (usuario_id),
  CONSTRAINT fk_commerce_account_local_user FOREIGN KEY (empresa_id, usuario_id)
    REFERENCES usuarios (empresa_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS commerce_account_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES commerce_accounts(id) ON DELETE RESTRICT,
  actor_id VARCHAR(100) NOT NULL,
  acao VARCHAR(40) NOT NULL,
  empresa_id UUID REFERENCES empresas(id) ON DELETE RESTRICT,
  detalhes JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_commerce_account_audit_account
  ON commerce_account_audit (account_id, criado_em DESC);

-- Trilha append-only como as demais trilhas Commerce.
CREATE OR REPLACE FUNCTION commerce_account_audit_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'commerce_account_audit is append-only';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_commerce_account_audit_immutable ON commerce_account_audit;
CREATE TRIGGER trg_commerce_account_audit_immutable
  BEFORE UPDATE OR DELETE ON commerce_account_audit
  FOR EACH ROW EXECUTE FUNCTION commerce_account_audit_immutable();
