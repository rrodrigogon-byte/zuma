-- ══════════════════════════════════════════════════════════════════════════════════
-- MIGRATION 116: SUPERMERCADO ENTERPRISE FASE 7
-- AUDITORIA DE FRENTE DE CAIXA & FRAUDE PDV, CENTRAL DE TABLOIDES/ENCARTES DIGITAIS,
-- TRADE MARKETING (LOCAÇÃO DE PONTAS DE GÔNDOLA) E AUDITORIA NOTURNA DE PERDAS
-- ══════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS var_auditoria_fraude_pdv (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  terminal_id VARCHAR(50) NOT NULL,
  operador_id VARCHAR(80) NOT NULL,
  operador_nome VARCHAR(120) NOT NULL,
  tipo_evento VARCHAR(50) NOT NULL,
  numero_cupom VARCHAR(50),
  item_cancelado VARCHAR(150),
  valor_evento NUMERIC(14,2) DEFAULT 0,
  motivo_informado TEXT,
  score_risco INT DEFAULT 1,
  requer_autorizacao_fiscal BOOLEAN DEFAULT TRUE,
  fiscal_autorizador VARCHAR(120),
  status VARCHAR(30) DEFAULT 'EM_ANALISE',
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_var_fraude_pdv_empresa ON var_auditoria_fraude_pdv (empresa_id, status);

CREATE TABLE IF NOT EXISTS var_tabloides_encartes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  titulo VARCHAR(120) NOT NULL,
  tema VARCHAR(50) NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  status VARCHAR(30) DEFAULT 'ATIVO',
  total_itens INT DEFAULT 0,
  visualizacoes_digitais INT DEFAULT 0,
  disparos_whatsapp INT DEFAULT 0,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_var_tabloides_empresa ON var_tabloides_encartes (empresa_id, status);

CREATE TABLE IF NOT EXISTS var_tabloide_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tabloide_id UUID NOT NULL REFERENCES var_tabloides_encartes(id) ON DELETE CASCADE,
  produto_id UUID,
  descricao VARCHAR(150) NOT NULL,
  departamento VARCHAR(60),
  preco_de NUMERIC(14,2) NOT NULL,
  preco_por NUMERIC(14,2) NOT NULL,
  desconto_pct NUMERIC(5,2),
  limite_por_cliente INT DEFAULT 12,
  destaque_capa BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS var_trade_marketing_espacos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  codigo_espaco VARCHAR(30) NOT NULL,
  tipo_espaco VARCHAR(40) NOT NULL,
  setor_loja VARCHAR(60) NOT NULL,
  fornecedor_locatario VARCHAR(120) NOT NULL,
  marca_exibida VARCHAR(80) NOT NULL,
  valor_mensal_locacao NUMERIC(14,2) NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  status VARCHAR(30) DEFAULT 'ATIVO',
  conferido_auditoria BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_var_trade_empresa ON var_trade_marketing_espacos (empresa_id, status);

CREATE TABLE IF NOT EXISTS var_perdas_patrimoniais_auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  data_auditoria DATE NOT NULL DEFAULT CURRENT_DATE,
  turno VARCHAR(20) DEFAULT 'NOTURNO',
  auditor_responsavel VARCHAR(120) NOT NULL,
  corredor_vistoriado VARCHAR(60) NOT NULL,
  itens_vistoriados INT DEFAULT 0,
  itens_avariados INT DEFAULT 0,
  embalagens_violadas INT DEFAULT 0,
  perda_estimada_rs NUMERIC(14,2) DEFAULT 0,
  indice_perda_calculado NUMERIC(5,2) DEFAULT 0,
  relatorio_conclusao TEXT,
  status VARCHAR(30) DEFAULT 'CONCLUIDO',
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_var_auditoria_perdas_empresa ON var_perdas_patrimoniais_auditoria (empresa_id, data_auditoria);
