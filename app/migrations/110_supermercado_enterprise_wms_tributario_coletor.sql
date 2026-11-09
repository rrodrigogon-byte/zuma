-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 110: SUPERMERCADO ENTERPRISE - WMS, TRIBUTÁRIO, COLETOR & PERDAS
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Coletor de Dados Mobile & Auditoria de Gôndola
CREATE TABLE IF NOT EXISTS var_coletor_leituras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  loja_id UUID,
  operador VARCHAR(120) NOT NULL DEFAULT 'Operador de Loja',
  tipo_operacao VARCHAR(50) NOT NULL DEFAULT 'AUDITORIA_PRECO', -- AUDITORIA_PRECO, CONFERENCIA_DOCA, INVENTARIO_CICLICO, VALIDADE_FEFO
  codigo_barras VARCHAR(60) NOT NULL,
  item_id UUID,
  descricao VARCHAR(255),
  quantidade NUMERIC(14, 3) NOT NULL DEFAULT 1,
  preco_gondola NUMERIC(14, 2),
  preco_sistema NUMERIC(14, 2),
  divergencia_encontrada BOOLEAN NOT NULL DEFAULT false,
  lote VARCHAR(80),
  data_validade DATE,
  observacao TEXT,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_var_coletor_empresa ON var_coletor_leituras(empresa_id, tipo_operacao, criado_em);

-- 2. Matriz Tributária Supermercadista (NCM / CEST / PIS Monofásico / ICMS-ST)
CREATE TABLE IF NOT EXISTS var_matriz_tributaria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  ncm VARCHAR(10) NOT NULL,
  cest VARCHAR(10),
  descricao_grupo VARCHAR(200) NOT NULL,
  regime_tributario VARCHAR(50) NOT NULL DEFAULT 'LUCRO_REAL', -- SIMPLES, LUCRO_PRESUMIDO, LUCRO_REAL
  cst_icms VARCHAR(5) NOT NULL DEFAULT '00',
  aliquota_icms NUMERIC(6, 2) NOT NULL DEFAULT 18.00,
  reducao_bc_icms NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
  aliquota_mva_st NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
  cst_pis_cofins VARCHAR(5) NOT NULL DEFAULT '01',
  aliquota_pis NUMERIC(6, 2) NOT NULL DEFAULT 1.65,
  aliquota_cofins NUMERIC(6, 2) NOT NULL DEFAULT 7.60,
  tipo_regra VARCHAR(60) NOT NULL DEFAULT 'TRIBUTADO_INTEGRAL', -- TRIBUTADO_INTEGRAL, MONOFASICO, SUBSTITUICAO_TRIBUTARIA, CESTA_BASICA, ISENTO_ALIMENTAR
  ibpt_federal NUMERIC(6, 2) NOT NULL DEFAULT 4.20,
  ibpt_estadual NUMERIC(6, 2) NOT NULL DEFAULT 17.00,
  ativo BOOLEAN NOT NULL DEFAULT true,
  atualizado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_var_tributaria_ncm ON var_matriz_tributaria(empresa_id, ncm);

-- 3. WMS de Loja & Endereçamento Logístico (Gôndola vs Pulmão)
CREATE TABLE IF NOT EXISTS var_enderecamento_wms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  loja_id UUID,
  item_id UUID,
  codigo_endereco VARCHAR(40) NOT NULL, -- Ex: R01-P02-A03-V04 (Rua 1, Prédio 2, Andar 3, Vão 4)
  rua VARCHAR(20) NOT NULL,
  predio VARCHAR(20) NOT NULL,
  andar VARCHAR(20) NOT NULL,
  vao VARCHAR(20) NOT NULL,
  tipo_localizacao VARCHAR(30) NOT NULL DEFAULT 'AREA_VENDA', -- AREA_VENDA (Gôndola), PULMAO_DEPOSITO (Aéreo), CAMARA_FRIA, DOCA
  capacidade_maxima NUMERIC(12, 2) NOT NULL DEFAULT 50,
  ponto_reposicao NUMERIC(12, 2) NOT NULL DEFAULT 10,
  saldo_atual NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  atualizado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_var_wms_item ON var_enderecamento_wms(empresa_id, item_id);

-- 4. Gestão de Quebras, Avarias & Food Waste (Perdas com Estorno Fiscal)
CREATE TABLE IF NOT EXISTS var_avarias_perdas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  loja_id UUID,
  item_id UUID,
  descricao_item VARCHAR(255) NOT NULL,
  quantidade NUMERIC(14, 3) NOT NULL,
  unidade VARCHAR(10) NOT NULL DEFAULT 'UN',
  custo_unitario NUMERIC(14, 2) NOT NULL DEFAULT 0,
  custo_total NUMERIC(14, 2) NOT NULL DEFAULT 0,
  motivo VARCHAR(60) NOT NULL DEFAULT 'VENCIMENTO_FEFO', -- VENCIMENTO_FEFO, AVARIA_TRANSPORTE, QUEBRA_DESOSSA, DETERIORACAO_FLV, FURTO_IDENTIFICADO, CONSUMO_INTERNO
  departamento VARCHAR(60) NOT NULL DEFAULT 'MERCEARIA',
  estorno_credito_fiscal BOOLEAN NOT NULL DEFAULT true,
  observacao TEXT,
  responsavel VARCHAR(120) NOT NULL DEFAULT 'Gerente de Loja',
  status VARCHAR(30) NOT NULL DEFAULT 'APROVADO', -- PENDENTE, APROVADO, REJEITADO
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_var_perdas_empresa ON var_avarias_perdas(empresa_id, criado_em);

-- 5. Parâmetros e Metas do Cockpit Supermercadista
CREATE TABLE IF NOT EXISTS var_metas_supermercado (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  loja_id UUID,
  area_vendas_m2 NUMERIC(10, 2) NOT NULL DEFAULT 850.00,
  meta_venda_m2 NUMERIC(12, 2) NOT NULL DEFAULT 2500.00,
  meta_ticket_medio NUMERIC(10, 2) NOT NULL DEFAULT 75.00,
  meta_margem_bruta_pct NUMERIC(6, 2) NOT NULL DEFAULT 28.50,
  meta_quebra_max_pct NUMERIC(6, 2) NOT NULL DEFAULT 1.50,
  meta_ruptura_max_pct NUMERIC(6, 2) NOT NULL DEFAULT 2.00,
  atualizado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
