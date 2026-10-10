-- 068 · Administradores globais Commerce, com reversão explícita por tenant.
-- A concessão nunca cria uma segunda conta/login para a identidade de origem.
CREATE TABLE IF NOT EXISTS commerce_platform_grants (
  account_id UUID PRIMARY KEY REFERENCES commerce_accounts(id) ON DELETE RESTRICT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  granted_by VARCHAR(100) NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_commerce_platform_grants_active_expiry
  ON commerce_platform_grants (ativo, expires_at, account_id);

CREATE TABLE IF NOT EXISTS commerce_platform_grant_memberships (
  account_id UUID NOT NULL REFERENCES commerce_accounts(id) ON DELETE RESTRICT,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  usuario_id UUID NOT NULL,
  membership_id UUID NOT NULL REFERENCES commerce_memberships(id) ON DELETE RESTRICT,
  previous_role_id UUID REFERENCES commerce_roles(id) ON DELETE RESTRICT,
  previous_active BOOLEAN,
  previous_expires_at TIMESTAMPTZ,
  created_local BOOLEAN NOT NULL DEFAULT false,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (account_id, empresa_id),
  CONSTRAINT fk_commerce_platform_grant_membership_user
    FOREIGN KEY (empresa_id, usuario_id)
    REFERENCES usuarios (empresa_id, id) ON DELETE RESTRICT,
  CONSTRAINT chk_commerce_platform_grant_snapshot
    CHECK (
      (previous_role_id IS NULL AND previous_active IS NULL AND previous_expires_at IS NULL)
      OR previous_role_id IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_commerce_platform_grant_memberships_membership
  ON commerce_platform_grant_memberships (membership_id);
CREATE INDEX IF NOT EXISTS idx_commerce_platform_grant_memberships_user
  ON commerce_platform_grant_memberships (empresa_id, usuario_id);

DROP TRIGGER IF EXISTS trg_commerce_platform_grants_updated_at ON commerce_platform_grants;
CREATE TRIGGER trg_commerce_platform_grants_updated_at
  BEFORE UPDATE ON commerce_platform_grants
  FOR EACH ROW EXECUTE FUNCTION commerce_touch_updated_at();
