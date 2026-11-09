-- ══════════════════════════════════════════════════════════════════════════════════
-- MIGRATION 114: SUPERMERCADO ENTERPRISE FASE 6
-- PREVENÇÃO DE PERDAS EAS/RFID, RASTREABILIDADE BOVINA SIF/MAPA,
-- PLANOGRAMA VISUAL DE GÔNDOLA E KIOSK BUSCA-PREÇO MULTIMÍDIA
-- ══════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS var_ocorrencias_prevencao_perdas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  numero_boletim VARCHAR(30) NOT NULL,
  tipo_perda VARCHAR(40) NOT NULL,
  local_ocorrencia VARCHAR(50),
  codigo_barras VARCHAR(50),
  descricao_item VARCHAR(150) NOT NULL,
  quantidade NUMERIC(10,3) DEFAULT 1,
  custo_unitario NUMERIC(14,2) NOT NULL,
  custo_total_perda NUMERIC(14,2) NOT NULL,
  disparo_antena_eas BOOLEAN DEFAULT FALSE,
  fiscal_responsavel VARCHAR(80),
  status VARCHAR(30) DEFAULT 'REGISTRADO_LIVRO_QUEBRAS',
  data_ocorrencia TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS var_acougue_rastreabilidade_sif (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  lote_acougue VARCHAR(50) NOT NULL,
  frigorifico_nome VARCHAR(120) NOT NULL,
  sif_numero VARCHAR(30) NOT NULL,
  tipo_corte_carcaca VARCHAR(100) NOT NULL,
  data_abate DATE NOT NULL,
  data_recebimento DATE NOT NULL,
  data_validade DATE NOT NULL,
  peso_recebido_kg NUMERIC(10,3) NOT NULL,
  fazenda_origem VARCHAR(120),
  gta_numero VARCHAR(50),
  qr_code_rastreabilidade TEXT,
  status VARCHAR(30) DEFAULT 'DESOSSA_CONCLUIDA',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS var_planogramas_gondola (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  codigo_modulo VARCHAR(30) NOT NULL,
  categoria_nome VARCHAR(80) NOT NULL,
  corredor VARCHAR(30) NOT NULL,
  numero_prateleiras INT DEFAULT 4,
  metragem_linear_metros NUMERIC(6,2) DEFAULT 2.40,
  rentabilidade_metro_mes NUMERIC(14,2) DEFAULT 4850.00,
  produtos_alocados JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(30) DEFAULT 'VIGENTE',
  ultima_revisao DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS var_kiosk_consultas_preco (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  terminal_kiosk VARCHAR(30) NOT NULL,
  codigo_barras VARCHAR(50) NOT NULL,
  descricao_produto VARCHAR(150) NOT NULL,
  preco_varejo NUMERIC(14,2) NOT NULL,
  preco_atacarejo NUMERIC(14,2),
  preco_clube NUMERIC(14,2),
  tabela_nutricional JSONB DEFAULT '{}'::jsonb,
  alergicos_info VARCHAR(150),
  data_consulta TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_var_prevencao_perdas_empresa ON var_ocorrencias_prevencao_perdas(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_var_acougue_sif_empresa ON var_acougue_rastreabilidade_sif(empresa_id, lote_acougue);
CREATE INDEX IF NOT EXISTS idx_var_planogramas_empresa ON var_planogramas_gondola(empresa_id, codigo_modulo);
CREATE INDEX IF NOT EXISTS idx_var_kiosk_empresa ON var_kiosk_consultas_preco(empresa_id, terminal_kiosk);
