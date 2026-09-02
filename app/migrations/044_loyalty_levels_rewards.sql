-- ============================================================================
-- KYTTO COMMERCE — FIDELIDADE AVANÇADA
-- Migração 044
-- Configuração, saldo, ledger imutável, níveis, recompensas e resgates por loja.
-- Não cria configurações ativas, níveis, recompensas, clientes, pontos ou resgates.
-- Pré-requisitos: Commerce Core 019 e clientes Commerce.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF to_regclass('public.empresas') IS NULL
     OR to_regclass('public.lojas') IS NULL
     OR to_regclass('public.usuarios') IS NULL
     OR to_regclass('public.commerce_customers') IS NULL THEN
    RAISE EXCEPTION 'Fidelidade avançada requer o Commerce Core e commerce_customers';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS commerce_loyalty_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT false,
  pontos_por_real NUMERIC(10,4) NOT NULL DEFAULT 1 CHECK (pontos_por_real >= 0 AND pontos_por_real <= 1000),
  valor_minimo_compra NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (valor_minimo_compra >= 0),
  validade_dias INTEGER CHECK (validade_dias IS NULL OR validade_dias BETWEEN 1 AND 3650),
  criado_por UUID,
  atualizado_por UUID,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_commerce_loyalty_settings UNIQUE (empresa_id, loja_id),
  CONSTRAINT fk_commerce_loyalty_settings_store FOREIGN KEY (empresa_id, loja_id)
    REFERENCES lojas (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_commerce_loyalty_settings_creator FOREIGN KEY (empresa_id, criado_por)
    REFERENCES usuarios (empresa_id, id) ON DELETE SET NULL,
  CONSTRAINT fk_commerce_loyalty_settings_updater FOREIGN KEY (empresa_id, atualizado_por)
    REFERENCES usuarios (empresa_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS commerce_loyalty_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  saldo_pontos INTEGER NOT NULL DEFAULT 0 CHECK (saldo_pontos >= 0),
  pontos_acumulados INTEGER NOT NULL DEFAULT 0 CHECK (pontos_acumulados >= 0),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_commerce_loyalty_account UNIQUE (empresa_id, loja_id, customer_id),
  CONSTRAINT uq_commerce_loyalty_account_company_id UNIQUE (empresa_id, id),
  CONSTRAINT fk_commerce_loyalty_account_store FOREIGN KEY (empresa_id, loja_id)
    REFERENCES lojas (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_commerce_loyalty_account_customer FOREIGN KEY (empresa_id, customer_id)
    REFERENCES commerce_customers (empresa_id, id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_commerce_loyalty_accounts_ranking
  ON commerce_loyalty_accounts (empresa_id, loja_id, pontos_acumulados DESC, saldo_pontos DESC);

CREATE TABLE IF NOT EXISTS commerce_loyalty_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL,
  account_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('credito', 'resgate', 'estorno', 'expiracao')),
  pontos INTEGER NOT NULL CHECK (pontos <> 0),
  saldo_anterior INTEGER NOT NULL CHECK (saldo_anterior >= 0),
  saldo_posterior INTEGER NOT NULL CHECK (saldo_posterior >= 0),
  descricao VARCHAR(240),
  referencia_tipo VARCHAR(40) NOT NULL,
  referencia_id UUID NOT NULL,
  expira_em TIMESTAMPTZ,
  criado_por UUID,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_commerce_loyalty_ledger_company_id UNIQUE (empresa_id, id),
  CONSTRAINT uq_commerce_loyalty_ledger_reference UNIQUE
    (empresa_id, loja_id, referencia_tipo, referencia_id, tipo),
  CONSTRAINT fk_commerce_loyalty_ledger_store FOREIGN KEY (empresa_id, loja_id)
    REFERENCES lojas (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_commerce_loyalty_ledger_account FOREIGN KEY (empresa_id, account_id)
    REFERENCES commerce_loyalty_accounts (empresa_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_commerce_loyalty_ledger_customer FOREIGN KEY (empresa_id, customer_id)
    REFERENCES commerce_customers (empresa_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_commerce_loyalty_ledger_user FOREIGN KEY (empresa_id, criado_por)
    REFERENCES usuarios (empresa_id, id) ON DELETE SET NULL,
  CONSTRAINT chk_commerce_loyalty_ledger_sign CHECK (
    (tipo IN ('credito', 'estorno') AND pontos > 0)
    OR (tipo IN ('resgate', 'expiracao') AND pontos < 0)
  ),
  CONSTRAINT chk_commerce_loyalty_ledger_balance CHECK (saldo_posterior = saldo_anterior + pontos)
);
CREATE INDEX IF NOT EXISTS idx_commerce_loyalty_ledger_customer
  ON commerce_loyalty_ledger (empresa_id, loja_id, customer_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_commerce_loyalty_ledger_expiration
  ON commerce_loyalty_ledger (empresa_id, loja_id, expira_em)
  WHERE expira_em IS NOT NULL AND pontos > 0;

CREATE TABLE IF NOT EXISTS fidelidade_niveis_loja (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL,
  codigo VARCHAR(50) NOT NULL,
  nome VARCHAR(80) NOT NULL,
  ordem SMALLINT NOT NULL CHECK (ordem BETWEEN 1 AND 20),
  pontos_minimos INTEGER NOT NULL CHECK (pontos_minimos >= 0),
  beneficios JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(beneficios) = 'array'),
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_por UUID,
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_fidelidade_nivel_codigo UNIQUE (empresa_id, loja_id, codigo),
  CONSTRAINT uq_fidelidade_nivel_ordem UNIQUE (empresa_id, loja_id, ordem),
  CONSTRAINT uq_fidelidade_nivel_pontos UNIQUE (empresa_id, loja_id, pontos_minimos),
  CONSTRAINT fk_fidelidade_nivel_store FOREIGN KEY (empresa_id, loja_id)
    REFERENCES lojas (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_fidelidade_nivel_user FOREIGN KEY (empresa_id, criado_por)
    REFERENCES usuarios (empresa_id, id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_fidelidade_niveis_consulta
  ON fidelidade_niveis_loja (empresa_id, loja_id, ativo, pontos_minimos DESC);

CREATE TABLE IF NOT EXISTS fidelidade_recompensas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL,
  codigo VARCHAR(60) NOT NULL,
  nome VARCHAR(140) NOT NULL,
  descricao VARCHAR(500),
  custo_pontos INTEGER NOT NULL CHECK (custo_pontos > 0),
  estoque_total INTEGER CHECK (estoque_total IS NULL OR estoque_total >= 0),
  quantidade_resgatada INTEGER NOT NULL DEFAULT 0 CHECK (quantidade_resgatada >= 0),
  limite_por_cliente INTEGER CHECK (limite_por_cliente IS NULL OR limite_por_cliente > 0),
  inicio_em TIMESTAMPTZ,
  fim_em TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'ativa', 'pausada', 'encerrada')),
  criado_por UUID,
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_fidelidade_recompensa_codigo UNIQUE (empresa_id, loja_id, codigo),
  CONSTRAINT chk_fidelidade_recompensa_periodo CHECK (fim_em IS NULL OR inicio_em IS NULL OR fim_em > inicio_em),
  CONSTRAINT chk_fidelidade_recompensa_estoque CHECK (estoque_total IS NULL OR quantidade_resgatada <= estoque_total),
  CONSTRAINT fk_fidelidade_recompensa_store FOREIGN KEY (empresa_id, loja_id)
    REFERENCES lojas (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_fidelidade_recompensa_user FOREIGN KEY (empresa_id, criado_por)
    REFERENCES usuarios (empresa_id, id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_fidelidade_recompensas_catalogo
  ON fidelidade_recompensas (empresa_id, loja_id, status, custo_pontos, data_criacao DESC);

CREATE TABLE IF NOT EXISTS fidelidade_resgates_recompensa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL,
  cliente_id UUID NOT NULL,
  recompensa_id UUID NOT NULL REFERENCES fidelidade_recompensas(id) ON DELETE RESTRICT,
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
  CONSTRAINT uq_fidelidade_resgate_idempotencia UNIQUE (empresa_id, idempotency_key),
  CONSTRAINT uq_fidelidade_resgate_ledger UNIQUE (ledger_debito_id),
  CONSTRAINT fk_fidelidade_resgate_store FOREIGN KEY (empresa_id, loja_id)
    REFERENCES lojas (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_fidelidade_resgate_customer FOREIGN KEY (empresa_id, cliente_id)
    REFERENCES commerce_customers (empresa_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_fidelidade_resgate_ledger FOREIGN KEY (empresa_id, ledger_debito_id)
    REFERENCES commerce_loyalty_ledger (empresa_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_fidelidade_resgate_user FOREIGN KEY (empresa_id, criado_por)
    REFERENCES usuarios (empresa_id, id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_fidelidade_resgates_operacao
  ON fidelidade_resgates_recompensa (empresa_id, loja_id, status, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_fidelidade_resgates_cliente
  ON fidelidade_resgates_recompensa (empresa_id, loja_id, cliente_id, criado_em DESC);

CREATE OR REPLACE FUNCTION kytto_atualizar_loyalty_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION kytto_atualizar_loyalty_data_atualizacao()
RETURNS TRIGGER AS $$
BEGIN
  NEW.data_atualizacao = CURRENT_TIMESTAMP;
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

DROP TRIGGER IF EXISTS trg_fidelidade_niveis_loja_updated ON fidelidade_niveis_loja;
CREATE TRIGGER trg_fidelidade_niveis_loja_updated
BEFORE UPDATE ON fidelidade_niveis_loja
FOR EACH ROW EXECUTE FUNCTION kytto_atualizar_loyalty_data_atualizacao();

DROP TRIGGER IF EXISTS trg_fidelidade_recompensas_updated ON fidelidade_recompensas;
CREATE TRIGGER trg_fidelidade_recompensas_updated
BEFORE UPDATE ON fidelidade_recompensas
FOR EACH ROW EXECUTE FUNCTION kytto_atualizar_loyalty_data_atualizacao();

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
