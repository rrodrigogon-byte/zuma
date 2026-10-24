-- Razão financeiro único por empresa e unidade (Kytto).
--
-- Todo dinheiro que entra ou sai de uma empresa vira um lançamento aqui: atendimento da barbearia,
-- comanda do bar, mensalidade do clube, pedido da loja online, conta a receber, compra, perda e
-- lançamento manual. Cada fonte entra com uma chave de idempotência (fin_lancamentos.chave), então
-- reprocessar uma fonte nunca duplica dinheiro.
--
-- Aditiva: só cria tabelas novas. Nada das tabelas existentes é alterado.

CREATE TABLE IF NOT EXISTS fin_centros_custo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  codigo VARCHAR(30) NOT NULL,
  nome VARCHAR(120) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_fin_centro_empresa_id UNIQUE (empresa_id, id),
  CONSTRAINT uq_fin_centro_codigo UNIQUE (empresa_id, codigo),
  CONSTRAINT chk_fin_centro_codigo CHECK (codigo ~ '^[A-Za-z0-9_.-]+$')
);

CREATE TABLE IF NOT EXISTS fin_categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  tipo VARCHAR(10) NOT NULL,
  nome VARCHAR(80) NOT NULL,
  grupo_dre VARCHAR(30) NOT NULL DEFAULT 'operacional',
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_fin_categoria UNIQUE (empresa_id, tipo, nome),
  CONSTRAINT chk_fin_categoria_tipo CHECK (tipo IN ('receita', 'despesa')),
  CONSTRAINT chk_fin_categoria_grupo CHECK (grupo_dre IN ('receita_bruta', 'deducao', 'cmv', 'operacional', 'pessoal', 'financeiro', 'impostos', 'investimento', 'outros'))
);

CREATE TABLE IF NOT EXISTS fin_lancamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  -- unidade da empresa; NULL = ainda sem unidade (aparece no consolidado da empresa)
  loja_id UUID,
  tipo VARCHAR(10) NOT NULL,
  categoria VARCHAR(80) NOT NULL DEFAULT 'Outros',
  centro_custo_id UUID,
  descricao VARCHAR(240) NOT NULL,
  valor NUMERIC(14,2) NOT NULL,
  -- competência: o dia a que o fato pertence (DRE); vencimento: quando deve ser pago/recebido
  data_competencia DATE NOT NULL,
  vencimento DATE NOT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'pendente',
  pago_em TIMESTAMPTZ,
  meio_pagamento VARCHAR(30),
  -- conta a pagar / a receber / avulso (já nasce pago)
  natureza VARCHAR(10) NOT NULL DEFAULT 'avulso',
  contraparte_tipo VARCHAR(20),
  contraparte_id UUID,
  contraparte_nome VARCHAR(240),
  origem VARCHAR(40) NOT NULL DEFAULT 'manual',
  origem_id VARCHAR(160),
  chave VARCHAR(200) NOT NULL,
  automatico BOOLEAN NOT NULL DEFAULT false,
  serie_id UUID,
  parcela SMALLINT,
  parcelas SMALLINT,
  documento VARCHAR(80),
  observacao TEXT,
  estorno_de UUID,
  criado_por VARCHAR(180),
  cancelado_em TIMESTAMPTZ,
  cancelado_por VARCHAR(180),
  motivo_cancelamento VARCHAR(240),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_fin_lanc_empresa_id UNIQUE (empresa_id, id),
  CONSTRAINT uq_fin_lanc_chave UNIQUE (empresa_id, chave),
  CONSTRAINT fk_fin_lanc_centro FOREIGN KEY (empresa_id, centro_custo_id) REFERENCES fin_centros_custo (empresa_id, id),
  CONSTRAINT chk_fin_lanc_tipo CHECK (tipo IN ('receita', 'despesa')),
  CONSTRAINT chk_fin_lanc_valor CHECK (valor > 0),
  CONSTRAINT chk_fin_lanc_status CHECK (status IN ('pendente', 'pago', 'cancelado')),
  CONSTRAINT chk_fin_lanc_natureza CHECK (natureza IN ('avulso', 'pagar', 'receber')),
  CONSTRAINT chk_fin_lanc_pago CHECK ((status = 'pago') = (pago_em IS NOT NULL)),
  CONSTRAINT chk_fin_lanc_contraparte CHECK (contraparte_tipo IS NULL OR contraparte_tipo IN ('cliente', 'fornecedor', 'funcionario', 'outro')),
  CONSTRAINT chk_fin_lanc_parcela CHECK (parcela IS NULL OR (parcela >= 1 AND parcelas >= parcela AND parcelas <= 120))
);
CREATE INDEX IF NOT EXISTS idx_fin_lanc_empresa_venc ON fin_lancamentos (empresa_id, vencimento);
CREATE INDEX IF NOT EXISTS idx_fin_lanc_empresa_loja ON fin_lancamentos (empresa_id, loja_id, vencimento);
CREATE INDEX IF NOT EXISTS idx_fin_lanc_pago ON fin_lancamentos (empresa_id, pago_em) WHERE status = 'pago';
CREATE INDEX IF NOT EXISTS idx_fin_lanc_pendente ON fin_lancamentos (empresa_id, vencimento) WHERE status = 'pendente';
CREATE INDEX IF NOT EXISTS idx_fin_lanc_origem ON fin_lancamentos (empresa_id, origem, origem_id);
CREATE INDEX IF NOT EXISTS idx_fin_lanc_serie ON fin_lancamentos (empresa_id, serie_id) WHERE serie_id IS NOT NULL;

-- Fechamento do dia por unidade (ou da empresa toda, loja_id NULL): fotografia dos totais.
CREATE TABLE IF NOT EXISTS fin_fechamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID,
  data DATE NOT NULL,
  totais JSONB NOT NULL,
  responsavel VARCHAR(180) NOT NULL,
  observacao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_fin_fechamento_dia ON fin_fechamentos (empresa_id, COALESCE(loja_id, '00000000-0000-0000-0000-000000000000'::uuid), data);

-- Até onde cada fonte já foi lida (a leitura é idempotente; isto só evita reler tudo sempre).
CREATE TABLE IF NOT EXISTS fin_fontes_sincronizadas (
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  fonte VARCHAR(40) NOT NULL,
  sincronizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lidos INTEGER NOT NULL DEFAULT 0,
  inseridos INTEGER NOT NULL DEFAULT 0,
  atualizados INTEGER NOT NULL DEFAULT 0,
  erro VARCHAR(240),
  PRIMARY KEY (empresa_id, fonte)
);
