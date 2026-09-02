-- ============================================================================
-- KYTTO ERP — FIDELIDADE AVANÇADA
-- Migração 044
-- Níveis por loja, catálogo de recompensas e resgate idempotente.
-- Não cria níveis, recompensas, clientes, saldos ou resgates em produção.
-- ============================================================================

CREATE TABLE IF NOT EXISTS fidelidade_niveis_loja (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  codigo VARCHAR(50) NOT NULL,
  nome VARCHAR(80) NOT NULL,
  ordem SMALLINT NOT NULL CHECK (ordem BETWEEN 1 AND 20),
  pontos_minimos INTEGER NOT NULL CHECK (pontos_minimos >= 0),
  beneficios JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(beneficios) = 'array'),
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_fidelidade_nivel_codigo UNIQUE (empresa_id, loja_id, codigo),
  CONSTRAINT uq_fidelidade_nivel_ordem UNIQUE (empresa_id, loja_id, ordem),
  CONSTRAINT uq_fidelidade_nivel_pontos UNIQUE (empresa_id, loja_id, pontos_minimos)
);
CREATE INDEX IF NOT EXISTS idx_fidelidade_niveis_consulta
  ON fidelidade_niveis_loja (empresa_id, loja_id, ativo, pontos_minimos DESC);

CREATE TABLE IF NOT EXISTS fidelidade_recompensas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
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
  criado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_fidelidade_recompensa_codigo UNIQUE (empresa_id, loja_id, codigo),
  CONSTRAINT chk_fidelidade_recompensa_periodo CHECK (fim_em IS NULL OR inicio_em IS NULL OR fim_em > inicio_em),
  CONSTRAINT chk_fidelidade_recompensa_estoque CHECK (estoque_total IS NULL OR quantidade_resgatada <= estoque_total)
);
CREATE INDEX IF NOT EXISTS idx_fidelidade_recompensas_catalogo
  ON fidelidade_recompensas (empresa_id, loja_id, status, custo_pontos, data_criacao DESC);

CREATE TABLE IF NOT EXISTS fidelidade_resgates_recompensa (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  recompensa_id UUID NOT NULL REFERENCES fidelidade_recompensas(id) ON DELETE RESTRICT,
  extrato_debito_id UUID NOT NULL REFERENCES extrato_pontos(id) ON DELETE RESTRICT,
  pontos_resgatados INTEGER NOT NULL CHECK (pontos_resgatados > 0),
  quantidade INTEGER NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'confirmado' CHECK (status IN ('confirmado', 'entregue', 'cancelado')),
  idempotency_key VARCHAR(120) NOT NULL,
  observacao VARCHAR(500),
  criado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  entregue_em TIMESTAMPTZ,
  cancelado_em TIMESTAMPTZ,
  CONSTRAINT uq_fidelidade_resgate_idempotencia UNIQUE (empresa_id, idempotency_key),
  CONSTRAINT uq_fidelidade_resgate_extrato UNIQUE (extrato_debito_id)
);
CREATE INDEX IF NOT EXISTS idx_fidelidade_resgates_operacao
  ON fidelidade_resgates_recompensa (empresa_id, loja_id, status, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_fidelidade_resgates_cliente
  ON fidelidade_resgates_recompensa (empresa_id, loja_id, cliente_id, criado_em DESC);

DO $$
DECLARE
  tabela TEXT;
  gatilho TEXT;
BEGIN
  FOREACH tabela IN ARRAY ARRAY['fidelidade_niveis_loja', 'fidelidade_recompensas']
  LOOP
    gatilho := 'trg_' || tabela || '_atualizacao';
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = gatilho) THEN
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION atualizar_data_atualizacao()',
        gatilho,
        tabela
      );
    END IF;
  END LOOP;
END;
$$;
