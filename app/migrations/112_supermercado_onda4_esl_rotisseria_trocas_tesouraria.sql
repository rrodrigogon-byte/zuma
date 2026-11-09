-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 112: SUPERMERCADO ONDA 4 - ETIQUETAS ELETRÔNICAS (ESL),
-- ROTISSERIA KDS, VALE-COMPRAS / TROCAS E TESOURARIA / CARRO-FORTE
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Etiquetas Eletrônicas de Gôndola (ESL - Electronic Shelf Labels)
CREATE TABLE IF NOT EXISTS var_etiquetas_eletronicas_esl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  loja_id UUID,
  codigo_esl VARCHAR(50) NOT NULL, -- ID do display e-paper
  item_id UUID,
  sku VARCHAR(60),
  descricao VARCHAR(255) NOT NULL,
  preco_regular NUMERIC(10, 2) NOT NULL,
  preco_clube NUMERIC(10, 2),
  preco_atacarejo NUMERIC(10, 2),
  gondola_endereco VARCHAR(50),
  bateria_pct INT NOT NULL DEFAULT 100,
  status_sincronizacao VARCHAR(30) NOT NULL DEFAULT 'SINCRONIZADO', -- SINCRONIZADO, PENDENTE_ATUALIZACAO, ERRO_SINAL
  ultima_transmissao TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_var_esl_emp ON var_etiquetas_eletronicas_esl(empresa_id, codigo_esl);

-- 2. Rotisseria, Buffet & KDS (Kitchen Display System do Supermercado)
CREATE TABLE IF NOT EXISTS var_rotisseria_pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  loja_id UUID,
  numero_comanda VARCHAR(40) NOT NULL,
  tipo VARCHAR(30) NOT NULL DEFAULT 'ROTISSERIA_QUENTE', -- BUFFET_PESO, ROTISSERIA_QUENTE, PIZZA_SUSHI
  descricao_item VARCHAR(255) NOT NULL,
  peso_kg NUMERIC(8, 3),
  valor_total NUMERIC(10, 2) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'EM_PREPARO', -- EM_PREPARO, PRONTO_RETIRADA, ENTREGUE_PDV
  tempo_estimado_min INT DEFAULT 15,
  operador VARCHAR(150),
  observacoes TEXT,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_var_roti_status ON var_rotisseria_pedidos(empresa_id, status);

-- 3. Vales-Compras & Devolução com Troca Fácil
CREATE TABLE IF NOT EXISTS var_vales_compra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  loja_id UUID,
  codigo_vale VARCHAR(40) NOT NULL UNIQUE,
  cpf_cliente VARCHAR(20) NOT NULL,
  nome_cliente VARCHAR(150),
  valor_original NUMERIC(10, 2) NOT NULL,
  saldo_restante NUMERIC(10, 2) NOT NULL,
  motivo_devolucao VARCHAR(120) NOT NULL,
  numero_cupom_origem VARCHAR(60),
  data_validade DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ATIVO', -- ATIVO, UTILIZADO_PARCIAL, UTILIZADO_TOTAL, CANCELADO
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_var_vales_cpf ON var_vales_compra(empresa_id, cpf_cliente);

-- 4. Tesouraria Central, Sangrias & Carro-Forte
CREATE TABLE IF NOT EXISTS var_tesouraria_malotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  loja_id UUID,
  numero_malote VARCHAR(40) NOT NULL,
  numero_lacre VARCHAR(40) NOT NULL,
  empresa_transporte VARCHAR(80) NOT NULL DEFAULT 'BRINKS', -- BRINKS, PROSEGUR, PROTEGE
  valor_cedulas NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  valor_moedas NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  valor_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  responsavel_tesouraria VARCHAR(150) NOT NULL,
  data_recolhimento TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(30) NOT NULL DEFAULT 'AGUARDANDO_COLETA', -- AGUARDANDO_COLETA, COLETADO_CARRO_FORTE, DEPOSITADO_CONCILIADO
  observacoes TEXT
);

CREATE INDEX IF NOT EXISTS idx_var_tesouraria_emp ON var_tesouraria_malotes(empresa_id, status);
