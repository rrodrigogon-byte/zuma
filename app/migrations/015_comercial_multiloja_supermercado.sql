-- ============================================================================
-- KYTTO ERP v4.0 — COMERCIAL MULTILOJA, SUPERMERCADO E TRANSFERÊNCIAS
-- Migração 015
--
-- Objetivo: completar a operação varejista no schema principal, mantendo o
-- catálogo corporativo e isolando estoque, preço, promoções e transferências
-- por loja. Esta migração não depende dos módulos legados `super_*`.
-- ============================================================================

-- -----------------------------------------------------------------------------
-- 1. CLASSIFICAÇÃO COMERCIAL DO CATÁLOGO CORPORATIVO
-- -----------------------------------------------------------------------------
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS plu VARCHAR(12);
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS codigo_balanca VARCHAR(8);
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS pesavel BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS controla_lote BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS permite_fracionamento BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS departamento VARCHAR(100);

CREATE UNIQUE INDEX IF NOT EXISTS uq_produtos_empresa_plu
  ON produtos (empresa_id, plu)
  WHERE plu IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_produtos_empresa_codigo_balanca
  ON produtos (empresa_id, codigo_balanca)
  WHERE codigo_balanca IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_produtos_empresa_departamento
  ON produtos (empresa_id, departamento)
  WHERE ativo = true;

-- -----------------------------------------------------------------------------
-- 2. PREÇO, SORTIMENTO E REPOSIÇÃO POR LOJA
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS precos_produto_loja (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  preco_venda DECIMAL(12,2) NOT NULL CHECK (preco_venda >= 0),
  preco_promocional DECIMAL(12,2) CHECK (preco_promocional IS NULL OR preco_promocional >= 0),
  custo_reposicao DECIMAL(12,2) CHECK (custo_reposicao IS NULL OR custo_reposicao >= 0),
  estoque_minimo DECIMAL(14,3) CHECK (estoque_minimo IS NULL OR estoque_minimo >= 0),
  estoque_maximo DECIMAL(14,3) CHECK (estoque_maximo IS NULL OR estoque_maximo >= 0),
  ponto_reposicao DECIMAL(14,3) CHECK (ponto_reposicao IS NULL OR ponto_reposicao >= 0),
  ativo BOOLEAN NOT NULL DEFAULT true,
  data_inicio TIMESTAMPTZ,
  data_fim TIMESTAMPTZ,
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_precos_produto_loja UNIQUE (loja_id, produto_id),
  CONSTRAINT chk_preco_promocional_menor CHECK (
    preco_promocional IS NULL OR preco_promocional <= preco_venda
  ),
  CONSTRAINT chk_periodo_preco_loja CHECK (
    data_fim IS NULL OR data_inicio IS NULL OR data_fim >= data_inicio
  )
);
CREATE INDEX IF NOT EXISTS idx_precos_produto_loja_sortimento
  ON precos_produto_loja (empresa_id, loja_id, ativo, produto_id);

-- -----------------------------------------------------------------------------
-- 3. PROMOÇÕES PROGRAMÁVEIS E REGRAS DE GÔNDOLA
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS promocoes_comerciais (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID REFERENCES lojas(id) ON DELETE CASCADE,
  codigo VARCHAR(40) NOT NULL,
  nome VARCHAR(180) NOT NULL,
  descricao TEXT,
  tipo VARCHAR(30) NOT NULL CHECK (tipo IN (
    'percentual', 'valor_fixo', 'preco_fixo', 'leve_pague', 'combo'
  )),
  status VARCHAR(20) NOT NULL DEFAULT 'rascunho' CHECK (status IN (
    'rascunho', 'agendada', 'ativa', 'pausada', 'encerrada', 'cancelada'
  )),
  data_inicio TIMESTAMPTZ NOT NULL,
  data_fim TIMESTAMPTZ NOT NULL,
  percentual_desconto DECIMAL(7,4),
  valor_desconto DECIMAL(12,2),
  preco_fixo DECIMAL(12,2),
  quantidade_minima DECIMAL(14,3),
  quantidade_leve DECIMAL(14,3),
  quantidade_pague DECIMAL(14,3),
  permite_acumulo BOOLEAN NOT NULL DEFAULT false,
  limite_por_cliente DECIMAL(14,3),
  criado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_promocoes_comerciais_codigo UNIQUE (empresa_id, loja_id, codigo),
  CONSTRAINT chk_promocao_periodo CHECK (data_fim > data_inicio),
  CONSTRAINT chk_promocao_percentual CHECK (
    percentual_desconto IS NULL OR (percentual_desconto > 0 AND percentual_desconto <= 100)
  ),
  CONSTRAINT chk_promocao_valor CHECK (
    valor_desconto IS NULL OR valor_desconto > 0
  ),
  CONSTRAINT chk_promocao_preco_fixo CHECK (
    preco_fixo IS NULL OR preco_fixo >= 0
  ),
  CONSTRAINT chk_promocao_leve_pague CHECK (
    (tipo <> 'leve_pague') OR (
      quantidade_leve > 0 AND quantidade_pague > 0 AND quantidade_leve > quantidade_pague
    )
  )
);
CREATE INDEX IF NOT EXISTS idx_promocoes_comerciais_ativas
  ON promocoes_comerciais (empresa_id, loja_id, status, data_inicio, data_fim);

CREATE TABLE IF NOT EXISTS promocoes_comerciais_itens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  promocao_id UUID NOT NULL REFERENCES promocoes_comerciais(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
  quantidade_minima DECIMAL(14,3),
  ordem_combo SMALLINT,
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_promocao_comercial_produto UNIQUE (promocao_id, produto_id),
  CONSTRAINT chk_item_promocao_quantidade CHECK (
    quantidade_minima IS NULL OR quantidade_minima > 0
  )
);
CREATE INDEX IF NOT EXISTS idx_promocoes_comerciais_itens_produto
  ON promocoes_comerciais_itens (produto_id, promocao_id);

-- -----------------------------------------------------------------------------
-- 4. ETIQUETAS DE GÔNDOLA E RASTREABILIDADE DE IMPRESSÃO
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS etiquetas_gondola (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
  promocao_id UUID REFERENCES promocoes_comerciais(id) ON DELETE SET NULL,
  terminal_id UUID REFERENCES terminais_pdv(id) ON DELETE SET NULL,
  dispositivo_id UUID REFERENCES dispositivos_perifericos(id) ON DELETE SET NULL,
  formato VARCHAR(30) NOT NULL DEFAULT 'gondola_100x40' CHECK (formato IN (
    'gondola_100x40', 'gondola_60x40', 'prateleira_90x30', 'balanca_40x30', 'outro'
  )),
  quantidade INTEGER NOT NULL DEFAULT 1 CHECK (quantidade BETWEEN 1 AND 1000),
  preco_exibido DECIMAL(12,2) NOT NULL CHECK (preco_exibido >= 0),
  conteudo JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK (status IN (
    'pendente', 'enfileirada', 'impressa', 'falha', 'cancelada'
  )),
  fila_impressao_id UUID REFERENCES fila_impressao_local(id) ON DELETE SET NULL,
  solicitado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  impresso_em TIMESTAMPTZ,
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_etiquetas_gondola_operacao
  ON etiquetas_gondola (empresa_id, loja_id, status, data_criacao DESC);

-- -----------------------------------------------------------------------------
-- 5. TRANSFERÊNCIAS ENTRE LOJAS COM CONFERÊNCIA DE RECEBIMENTO
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transferencias_estoque (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  numero VARCHAR(50) NOT NULL,
  loja_origem_id UUID NOT NULL REFERENCES lojas(id) ON DELETE RESTRICT,
  loja_destino_id UUID NOT NULL REFERENCES lojas(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'rascunho' CHECK (status IN (
    'rascunho', 'em_transito', 'recebida_parcial', 'recebida', 'cancelada'
  )),
  observacoes TEXT,
  solicitado_por UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  separado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  recebido_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  data_solicitacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_envio TIMESTAMPTZ,
  data_recebimento TIMESTAMPTZ,
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_transferencias_empresa_numero UNIQUE (empresa_id, numero),
  CONSTRAINT chk_transferencias_lojas_distintas CHECK (loja_origem_id <> loja_destino_id),
  CONSTRAINT chk_transferencias_datas CHECK (
    (data_envio IS NULL OR data_envio >= data_solicitacao)
    AND (data_recebimento IS NULL OR data_envio IS NULL OR data_recebimento >= data_envio)
  )
);
CREATE INDEX IF NOT EXISTS idx_transferencias_estoque_origem_status
  ON transferencias_estoque (empresa_id, loja_origem_id, status, data_criacao DESC);
CREATE INDEX IF NOT EXISTS idx_transferencias_estoque_destino_status
  ON transferencias_estoque (empresa_id, loja_destino_id, status, data_criacao DESC);

CREATE TABLE IF NOT EXISTS itens_transferencia (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transferencia_id UUID NOT NULL REFERENCES transferencias_estoque(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
  lote VARCHAR(50),
  validade DATE,
  quantidade_solicitada DECIMAL(14,3) NOT NULL CHECK (quantidade_solicitada > 0),
  quantidade_enviada DECIMAL(14,3) NOT NULL DEFAULT 0 CHECK (quantidade_enviada >= 0),
  quantidade_recebida DECIMAL(14,3) NOT NULL DEFAULT 0 CHECK (quantidade_recebida >= 0),
  custo_unitario DECIMAL(12,4) NOT NULL DEFAULT 0 CHECK (custo_unitario >= 0),
  observacoes TEXT,
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_itens_transferencia_quantidades CHECK (
    quantidade_enviada <= quantidade_solicitada
    AND quantidade_recebida <= quantidade_enviada
  )
);
CREATE INDEX IF NOT EXISTS idx_itens_transferencia_produto
  ON itens_transferencia (transferencia_id, produto_id);

-- -----------------------------------------------------------------------------
-- 6. ATUALIZAÇÃO DE TIMESTAMPS
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  tabela TEXT;
  gatilho TEXT;
BEGIN
  FOREACH tabela IN ARRAY ARRAY[
    'precos_produto_loja',
    'promocoes_comerciais',
    'transferencias_estoque'
  ]
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

-- ============================================================================
-- FIM DA MIGRAÇÃO 015
-- ============================================================================
