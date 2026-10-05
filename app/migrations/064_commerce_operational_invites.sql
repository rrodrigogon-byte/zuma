-- 064 · Convites nominais de store_admin para um único tenant.
-- O token em claro nunca é persistido: somente SHA-256 em hexadecimal é armazenado.
CREATE TABLE IF NOT EXISTS commerce_operational_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  email_norm VARCHAR(320) NOT NULL,
  nome VARCHAR(255) NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending_email',
  expira_em TIMESTAMPTZ NOT NULL,
  enviado_em TIMESTAMPTZ,
  usado_em TIMESTAMPTZ,
  revogado_em TIMESTAMPTZ,
  usuario_id UUID,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_commerce_owner_invite_email_norm
    CHECK (email_norm = lower(btrim(email_norm))),
  CONSTRAINT chk_commerce_owner_invite_status
    CHECK (status IN ('pending_email', 'sent', 'used', 'revoked'))
);

-- Uma mesma caixa postal não pode ter dois convites em voo, mesmo para tenants
-- diferentes. O advisory lock no módulo fecha também a janela entre consultas e
-- INSERTs concorrentes; este índice é a garantia final no banco.
CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_owner_invite_email_reserved
  ON commerce_operational_invites (email_norm)
  WHERE status IN ('pending_email', 'sent');

-- Um convite consumido reserva o e-mail globalmente, inclusive se a linha de
-- usuarios correspondente for removida em uma operação administrativa.
CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_owner_invite_email_used
  ON commerce_operational_invites (email_norm)
  WHERE status = 'used';

CREATE INDEX IF NOT EXISTS idx_commerce_operational_invites_empresa_status
  ON commerce_operational_invites (empresa_id, status, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_commerce_operational_invites_expira
  ON commerce_operational_invites (status, expira_em);
CREATE INDEX IF NOT EXISTS idx_commerce_operational_invites_usuario
  ON commerce_operational_invites (empresa_id, usuario_id)
  WHERE usuario_id IS NOT NULL;
