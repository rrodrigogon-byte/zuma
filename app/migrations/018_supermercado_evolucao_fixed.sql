/*
 * ============================================================================
 * MIGRAÇÃO 018: EVOLUÇÃO DE SUPERMERCADO (CORRIGIDA)
 * ============================================================================
 * Novas tabelas para lotes, fornecedores, margem e histórico de preço
 * mantendo isolamento por empresa_id e loja_id.
 *
 * Tabelas criadas:
 * - lotes_produto: Rastreamento de lotes com validade
 * - estoque_real_tempo: Saldo consolidado por loja
 * - fornecedores_produto: Cadastro de fornecedores
 * - produto_fornecedor: Mapeamento múltiplos fornecedores por produto
 * - historico_preco_produto: Histórico de variações de preço
 * - margem_produto: Análise de margem por item e loja
 * - itens_venda_detalhado: Detalhamento com lote e margem
 * ============================================================================
 */

-- Tabelas de suporte necessárias
CREATE TABLE IF NOT EXISTS vendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  data_venda TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome VARCHAR(300) NOT NULL,
  sku VARCHAR(50),
  preco_venda NUMERIC(12,2),
  preco_custo NUMERIC(12,2),
  ativo BOOLEAN DEFAULT TRUE
);

-- ============================================================================
-- 1. LOTES DE PRODUTO (RASTREAMENTO COM VALIDADE)
-- ============================================================================

CREATE TABLE IF NOT EXISTS lotes_produto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  numero_lote VARCHAR(50) NOT NULL,
  data_fabricacao DATE,
  data_validade DATE NOT NULL,
  quantidade_inicial INTEGER NOT NULL,
  quantidade_atual INTEGER NOT NULL,
  preco_custo_unitario NUMERIC(12,2),
  preco_venda_unitario NUMERIC(12,2),
  status VARCHAR(20) DEFAULT 'ativo', -- 'ativo', 'vencido', 'descontinuado'
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(empresa_id, loja_id, numero_lote),
  CONSTRAINT chk_lote_quantidade CHECK (quantidade_atual >= 0 AND quantidade_atual <= quantidade_inicial),
  CONSTRAINT chk_lote_validade CHECK (data_validade > CURRENT_DATE)
);

CREATE INDEX idx_lotes_empresa_loja ON lotes_produto(empresa_id, loja_id);
CREATE INDEX idx_lotes_produto ON lotes_produto(empresa_id, loja_id, produto_id);
CREATE INDEX idx_lotes_validade ON lotes_produto(empresa_id, loja_id, data_validade);
CREATE INDEX idx_lotes_status ON lotes_produto(empresa_id, loja_id, status);

-- ============================================================================
-- 2. ESTOQUE EM TEMPO REAL (CONSOLIDADO POR LOJA)
-- ============================================================================

CREATE TABLE IF NOT EXISTS estoque_real_tempo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  quantidade_disponivel INTEGER DEFAULT 0,
  quantidade_reservada INTEGER DEFAULT 0, -- Pedidos em aberto
  quantidade_total INTEGER GENERATED ALWAYS AS (quantidade_disponivel + quantidade_reservada) STORED,
  data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(empresa_id, loja_id, produto_id),
  CONSTRAINT chk_estoque_quantidade CHECK (quantidade_disponivel >= 0 AND quantidade_reservada >= 0)
);

CREATE INDEX idx_estoque_empresa_loja ON estoque_real_tempo(empresa_id, loja_id);
CREATE INDEX idx_estoque_produto ON estoque_real_tempo(empresa_id, loja_id, produto_id);

-- ============================================================================
-- 3. FORNECEDORES DE PRODUTO
-- ============================================================================

CREATE TABLE IF NOT EXISTS fornecedores_produto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome VARCHAR(300) NOT NULL,
  cnpj VARCHAR(14) UNIQUE,
  telefone VARCHAR(20),
  email VARCHAR(200),
  endereco TEXT,
  prazo_entrega_dias INTEGER DEFAULT 7,
  condicao_pagamento VARCHAR(100), -- '30 dias', '60 dias', 'à vista', etc
  ativo BOOLEAN DEFAULT TRUE,
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(empresa_id, cnpj)
);

CREATE INDEX idx_fornecedores_empresa ON fornecedores_produto(empresa_id);
CREATE INDEX idx_fornecedores_ativo ON fornecedores_produto(empresa_id, ativo);

-- ============================================================================
-- 4. MAPEAMENTO PRODUTO-FORNECEDOR (MÚLTIPLOS FORNECEDORES POR PRODUTO)
-- ============================================================================

CREATE TABLE IF NOT EXISTS produto_fornecedor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  fornecedor_id UUID NOT NULL REFERENCES fornecedores_produto(id) ON DELETE CASCADE,
  codigo_fornecedor VARCHAR(50),
  preco_custo_fornecedor NUMERIC(12,2),
  quantidade_minima_pedido INTEGER DEFAULT 1,
  ativo BOOLEAN DEFAULT TRUE,
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(empresa_id, produto_id, fornecedor_id)
);

CREATE INDEX idx_produto_fornecedor_empresa ON produto_fornecedor(empresa_id);
CREATE INDEX idx_produto_fornecedor_produto ON produto_fornecedor(empresa_id, produto_id);
CREATE INDEX idx_produto_fornecedor_fornecedor ON produto_fornecedor(empresa_id, fornecedor_id);

-- ============================================================================
-- 5. HISTÓRICO DE PREÇO DE PRODUTO
-- ============================================================================

CREATE TABLE IF NOT EXISTS historico_preco_produto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  preco_anterior NUMERIC(12,2),
  preco_novo NUMERIC(12,2) NOT NULL,
  percentual_mudanca NUMERIC(5,2), -- Calculado: ((novo - anterior) / anterior) * 100
  motivo VARCHAR(200), -- 'promoção', 'reajuste', 'sazonalidade', etc
  data_vigencia DATE NOT NULL,
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_historico_preco_empresa_loja ON historico_preco_produto(empresa_id, loja_id);
CREATE INDEX idx_historico_preco_produto ON historico_preco_produto(empresa_id, loja_id, produto_id);
CREATE INDEX idx_historico_preco_data ON historico_preco_produto(empresa_id, loja_id, data_vigencia);

-- ============================================================================
-- 6. MARGEM DE PRODUTO (ANÁLISE POR ITEM E LOJA)
-- ============================================================================

CREATE TABLE IF NOT EXISTS margem_produto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  preco_custo NUMERIC(12,2) NOT NULL,
  preco_venda NUMERIC(12,2) NOT NULL,
  margem_unitaria NUMERIC(12,2), -- preco_venda - preco_custo
  margem_percentual NUMERIC(5,2), -- ((preco_venda - preco_custo) / preco_custo) * 100
  faturamento_mensal NUMERIC(15,2) DEFAULT 0.00,
  lucro_acumulado NUMERIC(15,2) DEFAULT 0.00,
  quantidade_vendida_mes INTEGER DEFAULT 0,
  data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(empresa_id, loja_id, produto_id)
);

CREATE INDEX idx_margem_empresa_loja ON margem_produto(empresa_id, loja_id);
CREATE INDEX idx_margem_produto ON margem_produto(empresa_id, loja_id, produto_id);
CREATE INDEX idx_margem_percentual ON margem_produto(empresa_id, loja_id, margem_percentual DESC);

-- ============================================================================
-- 7. ITENS DE VENDA DETALHADO (RASTREAMENTO COM LOTE E MARGEM)
-- ============================================================================

CREATE TABLE IF NOT EXISTS itens_venda_detalhado (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  venda_id UUID NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  lote_id UUID REFERENCES lotes_produto(id) ON DELETE SET NULL,
  quantidade INTEGER NOT NULL,
  preco_unitario NUMERIC(12,2) NOT NULL,
  preco_custo_unitario NUMERIC(12,2),
  margem_unitaria NUMERIC(12,2), -- preco_unitario - preco_custo_unitario
  margem_percentual NUMERIC(5,2),
  desconto_aplicado NUMERIC(12,2) DEFAULT 0.00,
  valor_total NUMERIC(12,2), -- (quantidade * preco_unitario) - desconto_aplicado
  lucro_item NUMERIC(12,2), -- (quantidade * margem_unitaria) - desconto_aplicado
  data_venda TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_item_quantidade CHECK (quantidade > 0),
  CONSTRAINT chk_item_preco CHECK (preco_unitario >= 0)
);

CREATE INDEX idx_itens_venda_empresa_loja ON itens_venda_detalhado(empresa_id, loja_id);
CREATE INDEX idx_itens_venda_venda ON itens_venda_detalhado(empresa_id, loja_id, venda_id);
CREATE INDEX idx_itens_venda_produto ON itens_venda_detalhado(empresa_id, loja_id, produto_id);
CREATE INDEX idx_itens_venda_lote ON itens_venda_detalhado(empresa_id, loja_id, lote_id);

-- ============================================================================
-- 8. TRIGGERS DE AUDITORIA
-- ============================================================================

CREATE TRIGGER audit_lotes_produto_insert AFTER INSERT ON lotes_produto
FOR EACH ROW EXECUTE FUNCTION audit_log();

CREATE TRIGGER audit_lotes_produto_update AFTER UPDATE ON lotes_produto
FOR EACH ROW EXECUTE FUNCTION audit_log();

CREATE TRIGGER audit_estoque_real_tempo_insert AFTER INSERT ON estoque_real_tempo
FOR EACH ROW EXECUTE FUNCTION audit_log();

CREATE TRIGGER audit_estoque_real_tempo_update AFTER UPDATE ON estoque_real_tempo
FOR EACH ROW EXECUTE FUNCTION audit_log();

CREATE TRIGGER audit_margem_produto_insert AFTER INSERT ON margem_produto
FOR EACH ROW EXECUTE FUNCTION audit_log();

CREATE TRIGGER audit_margem_produto_update AFTER UPDATE ON margem_produto
FOR EACH ROW EXECUTE FUNCTION audit_log();

CREATE TRIGGER audit_itens_venda_detalhado_insert AFTER INSERT ON itens_venda_detalhado
FOR EACH ROW EXECUTE FUNCTION audit_log();

-- ============================================================================
-- 9. COMENTÁRIOS DE DOCUMENTAÇÃO
-- ============================================================================

COMMENT ON TABLE lotes_produto IS 'Rastreamento de lotes com validade, quantidade e preço de custo/venda por loja';
COMMENT ON TABLE estoque_real_tempo IS 'Saldo consolidado por loja, incluindo quantidade reservada em pedidos abertos';
COMMENT ON TABLE fornecedores_produto IS 'Cadastro de fornecedores com prazos e condições de pagamento';
COMMENT ON TABLE produto_fornecedor IS 'Mapeamento de múltiplos fornecedores por produto com preço e quantidade mínima';
COMMENT ON TABLE historico_preco_produto IS 'Histórico de variações de preço com motivo e data de vigência';
COMMENT ON TABLE margem_produto IS 'Análise de margem por item e loja com faturamento e lucro acumulado';
COMMENT ON TABLE itens_venda_detalhado IS 'Detalhamento de itens de venda com rastreamento de lote e margem';
