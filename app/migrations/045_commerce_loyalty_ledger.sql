-- ============================================================================
-- KYTTO COMMERCE CORE — Fidelidade Commerce autocontida
-- Migration: 045
--
-- Incremento estritamente aditivo. Mantém a migration 044 imutável e cria o
-- ledger operacional sobre commerce_customers, disponível em todos os tenants
-- do Commerce Core. Não cria configuração ativa, saldos ou recompensas.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS commerce_loyalty_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT false,
  pontos_por_real NUMERIC(10,4) NOT NULL DEFAULT 1 CHECK (pontos_por_real >= 0),
  valor_minimo_compra NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (valor_minimo_compra >= 0),
  validade_dias INTEGER CHECK (validade_dias IS NULL OR validade_dias > 0),
  criado_por UUID,
  atualizado_por UUID,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_commerce_loyalty_settings_store UNIQUE (empresa_id, loja_id),
  CONSTRAINT fk_commerce_loyalty_settings_store FOREIGN KEY (empresa_id, loja_id)
    REFERENCES lojas (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_commerce_loyalty_settings_created_by FOREIGN KEY (empresa_id, criado_por)
    REFERENCES usuarios (empresa_id, id) ON DELETE SET NULL,
  CONSTRAINT fk_commerce_loyalty_settings_updated_by FOREIGN KEY (empresa_id, atualizado_por)
    REFERENCES usuarios (empresa_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS commerce_loyalty_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  saldo_pontos INTEGER NOT NULL DEFAULT 0 CHECK (saldo_pontos >= 0),
  pontos_acumulados INTEGER NOT NULL DEFAULT 0 CHECK (pontos_acumulados >= 0),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_commerce_loyalty_account UNIQUE (empresa_id, loja_id, customer_id),
  CONSTRAINT uq_commerce_loyalty_account_empresa_id UNIQUE (empresa_id, id),
  CONSTRAINT fk_commerce_loyalty_account_store FOREIGN KEY (empresa_id, loja_id)
    REFERENCES lojas (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_commerce_loyalty_account_customer FOREIGN KEY (empresa_id, customer_id)
    REFERENCES commerce_customers (empresa_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS commerce_loyalty_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL,
  account_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('credito', 'resgate', 'estorno', 'expiracao', 'ajuste')),
  pontos INTEGER NOT NULL CHECK (pontos <> 0),
  saldo_anterior INTEGER NOT NULL CHECK (saldo_anterior >= 0),
  saldo_posterior INTEGER NOT NULL CHECK (saldo_posterior >= 0),
  descricao VARCHAR(240) NOT NULL,
  referencia_tipo VARCHAR(40) NOT NULL,
  referencia_id UUID NOT NULL,
  expira_em TIMESTAMPTZ,
  criado_por UUID,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_commerce_loyalty_ledger_empresa_id UNIQUE (empresa_id, id),
  CONSTRAINT uq_commerce_loyalty_ledger_reference UNIQUE
    (empresa_id, loja_id, referencia_tipo, referencia_id, tipo),
  CONSTRAINT chk_commerce_loyalty_ledger_balance
    CHECK (saldo_posterior = saldo_anterior + pontos),
  CONSTRAINT fk_commerce_loyalty_ledger_store FOREIGN KEY (empresa_id, loja_id)
    REFERENCES lojas (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_commerce_loyalty_ledger_account FOREIGN KEY (empresa_id, account_id)
    REFERENCES commerce_loyalty_accounts (empresa_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_commerce_loyalty_ledger_customer FOREIGN KEY (empresa_id, customer_id)
    REFERENCES commerce_customers (empresa_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_commerce_loyalty_ledger_created_by FOREIGN KEY (empresa_id, criado_por)
    REFERENCES usuarios (empresa_id, id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_fidelidade_recompensas_empresa_id
  ON fidelidade_recompensas (empresa_id, id);

CREATE TABLE IF NOT EXISTS commerce_loyalty_reward_redemptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL,
  cliente_id UUID NOT NULL,
  recompensa_id UUID NOT NULL,
  ledger_debito_id UUID NOT NULL,
  pontos_resgatados INTEGER NOT NULL CHECK (pontos_resgatados > 0),
  quantidade INTEGER NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'confirmado' CHECK (status IN ('confirmado', 'entregue', 'cancelado')),
  idempotency_key VARCHAR(120) NOT NULL,
  observacao VARCHAR(500),
  criado_por UUID,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  entregue_em TIMESTAMPTZ,
  cancelado_em TIMESTAMPTZ,
  CONSTRAINT uq_commerce_loyalty_reward_redemption_key UNIQUE (empresa_id, idempotency_key),
  CONSTRAINT uq_commerce_loyalty_reward_redemption_ledger UNIQUE (empresa_id, ledger_debito_id),
  CONSTRAINT fk_commerce_loyalty_reward_redemption_store FOREIGN KEY (empresa_id, loja_id)
    REFERENCES lojas (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_commerce_loyalty_reward_redemption_customer FOREIGN KEY (empresa_id, cliente_id)
    REFERENCES commerce_customers (empresa_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_commerce_loyalty_reward_redemption_reward FOREIGN KEY (empresa_id, recompensa_id)
    REFERENCES fidelidade_recompensas (empresa_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_commerce_loyalty_reward_redemption_ledger FOREIGN KEY (empresa_id, ledger_debito_id)
    REFERENCES commerce_loyalty_ledger (empresa_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_commerce_loyalty_reward_redemption_created_by FOREIGN KEY (empresa_id, criado_por)
    REFERENCES usuarios (empresa_id, id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_commerce_loyalty_accounts_ranking
  ON commerce_loyalty_accounts (empresa_id, loja_id, pontos_acumulados DESC, saldo_pontos DESC);
CREATE INDEX IF NOT EXISTS idx_commerce_loyalty_ledger_customer
  ON commerce_loyalty_ledger (empresa_id, loja_id, customer_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_commerce_loyalty_ledger_expiration
  ON commerce_loyalty_ledger (empresa_id, loja_id, expira_em)
  WHERE expira_em IS NOT NULL AND tipo = 'credito';
CREATE INDEX IF NOT EXISTS idx_commerce_loyalty_reward_redemptions_operation
  ON commerce_loyalty_reward_redemptions (empresa_id, loja_id, status, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_commerce_loyalty_reward_redemptions_customer
  ON commerce_loyalty_reward_redemptions (empresa_id, loja_id, cliente_id, criado_em DESC);

CREATE OR REPLACE FUNCTION kytto_atualizar_loyalty_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_commerce_loyalty_settings_updated ON commerce_loyalty_settings;
CREATE TRIGGER trg_commerce_loyalty_settings_updated
BEFORE UPDATE ON commerce_loyalty_settings
FOR EACH ROW EXECUTE FUNCTION kytto_atualizar_loyalty_atualizado_em();

DROP TRIGGER IF EXISTS trg_commerce_loyalty_accounts_updated ON commerce_loyalty_accounts;
CREATE TRIGGER trg_commerce_loyalty_accounts_updated
BEFORE UPDATE ON commerce_loyalty_accounts
FOR EACH ROW EXECUTE FUNCTION kytto_atualizar_loyalty_atualizado_em();

CREATE OR REPLACE FUNCTION kytto_proteger_loyalty_ledger()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'O ledger de fidelidade é imutável e não pode ser %', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_commerce_loyalty_ledger_immutable ON commerce_loyalty_ledger;
CREATE TRIGGER trg_commerce_loyalty_ledger_immutable
BEFORE UPDATE OR DELETE ON commerce_loyalty_ledger
FOR EACH ROW EXECUTE FUNCTION kytto_proteger_loyalty_ledger();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'setpoint_app') THEN
    GRANT SELECT, INSERT, UPDATE ON commerce_loyalty_settings TO setpoint_app;
    GRANT SELECT, INSERT, UPDATE ON commerce_loyalty_accounts TO setpoint_app;
    GRANT SELECT, INSERT ON commerce_loyalty_ledger TO setpoint_app;
    GRANT SELECT, INSERT, UPDATE ON commerce_loyalty_reward_redemptions TO setpoint_app;
  END IF;
END;
$$;
