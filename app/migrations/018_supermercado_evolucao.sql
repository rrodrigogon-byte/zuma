/**
 * ============================================================================
 * MIGRAÇÃO 018: EVOLUÇÃO DE SUPERMERCADO
 * ============================================================================
 * Novas tabelas para gestão de lotes, fornecedores, margem por item e
 * histórico de preços — mantendo isolamento por empresa_id e loja_id.
 *
 * Tabelas criadas:
 * - lotes_produto: Rastreamento de lotes com validade
 * - estoque_real_tempo: Saldo em tempo real por loja
 * - fornecedores_produto: Mapeamento produto-fornecedor
 * - historico_preco_produto: Histórico de preços por período
 * - margem_produto: Margem por item e por loja
 * - itens_venda_detalhado: Detalhamento de itens com lote e margem
 * ============================================================================
 */

-- ============================================================================
-- 1. LOTES DE PRODUTO (RASTREAMENTO COM VALIDADE)
-- ============================================================================

CREATE TABLE IF NOT EXISTS lotes_produto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  numero_lote VARCHAR(100) NOT NULL,
  data_fabricacao DATE,
  data_validade DATE NOT NULL,
  quantidade_inicial INTEGER NOT NULL,
  quantidade_atual INTEGER NOT NULL DEFAULT 0,
  quantidade_vendida INTEGER DEFAULT 0,
  quantidade_devolvida INTEGER DEFAULT 0,
  preco_custo NUMERIC(12,2),
  preco_venda NUMERIC(12,2),
  fornecedor_id UUID REFERENCES fornecedores_produto(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'ativo', -- 'ativo', 'vencido', 'descartado', 'finalizado'
  observacoes TEXT,
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(empresa_id, loja_id, produto_id, numero_lote),
  CONSTRAINT chk_lote_quantidade CHECK (quantidade_atual >= 0),
  CONSTRAINT chk_lote_status CHECK (status IN ('ativo', 'vencido', 'descartado', 'finalizado'))
);

CREATE INDEX idx_lotes_empresa_loja ON lotes_produto(empresa_id, loja_id);
CREATE INDEX idx_lotes_produto ON lotes_produto(empresa_id, loja_id, produto_id);
CREATE INDEX idx_lotes_validade ON lotes_produto(empresa_id, loja_id, data_validade);
CREATE INDEX idx_lotes_status ON lotes_produto(empresa_id, loja_id, status);

-- ============================================================================
-- 2. ESTOQUE EM TEMPO REAL (SALDO CONSOLIDADO POR LOJA)
-- ============================================================================

CREATE TABLE IF NOT EXISTS estoque_real_tempo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  quantidade_total INTEGER DEFAULT 0,
  quantidade_reservada INTEGER DEFAULT 0, -- Pedidos em aberto
  quantidade_disponivel INTEGER GENERATED ALWAYS AS (quantidade_total - quantidade_reservada) STORED,
  valor_total NUMERIC(12,2) DEFAULT 0.00, -- quantidade_total * preco_custo
  data_ultima_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(empresa_id, loja_id, produto_id),
  CONSTRAINT chk_estoque_quantidade CHECK (quantidade_total >= 0 AND quantidade_reservada >= 0)
);

CREATE INDEX idx_estoque_empresa_loja ON estoque_real_tempo(empresa_id, loja_id);
CREATE INDEX idx_estoque_produto ON estoque_real_tempo(empresa_id, loja_id, produto_id);
CREATE INDEX idx_estoque_disponivel ON estoque_real_tempo(empresa_id, loja_id) WHERE quantidade_disponivel < 10;

-- ============================================================================
-- 3. FORNECEDORES DE PRODUTO (MAPEAMENTO PRODUTO-FORNECEDOR)
-- ============================================================================

CREATE TABLE IF NOT EXISTS fornecedores_produto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome VARCHAR(200) NOT NULL,
  cnpj VARCHAR(18),
  email VARCHAR(200),
  telefone VARCHAR(20),
  contato_nome VARCHAR(100),
  contato_telefone VARCHAR(20),
  endereco TEXT,
  cidade VARCHAR(100),
  estado VARCHAR(2),
  cep VARCHAR(10),
  prazo_entrega_dias INTEGER DEFAULT 7,
  condicao_pagamento VARCHAR(50), -- '30 dias', '60 dias', 'à vista', etc
  ativo BOOLEAN DEFAULT TRUE,
  data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(empresa_id, cnpj)
);

CREATE INDEX idx_fornecedores_empresa ON fornecedores_produto(empresa_id);
CREATE INDEX idx_fornecedores_ativo ON fornecedores_produto(empresa_id, ativo);

-- ============================================================================
-- 4. RELACIONAMENTO PRODUTO-FORNECEDOR (MÚLTIPLOS FORNECEDORES POR PRODUTO)
-- ============================================================================

CREATE TABLE IF NOT EXISTS produto_fornecedor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  fornecedor_id UUID NOT NULL REFERENCES fornecedores_produto(id) ON DELETE CASCADE,
  codigo_fornecedor VARCHAR(50),
  preco_fornecedor NUMERIC(12,2) NOT NULL,
  quantidade_minima INTEGER DEFAULT 1,
  quantidade_maxima INTEGER,
  prazo_entrega_dias INTEGER,
  ativo BOOLEAN DEFAULT TRUE,
  data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(empresa_id, produto_id, fornecedor_id),
  CONSTRAINT chk_preco_fornecedor CHECK (preco_fornecedor > 0)
);

CREATE INDEX idx_produto_fornecedor_empresa ON produto_fornecedor(empresa_id);
CREATE INDEX idx_produto_fornecedor_produto ON produto_fornecedor(empresa_id, produto_id);
CREATE INDEX idx_produto_fornecedor_fornecedor ON produto_fornecedor(empresa_id, fornecedor_id);

-- ============================================================================
-- 5. HISTÓRICO DE PREÇO DE PRODUTO (RASTREAMENTO DE VARIAÇÕES)
-- ============================================================================

CREATE TABLE IF NOT EXISTS historico_preco_produto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID REFERENCES lojas(id) ON DELETE SET NULL,
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  preco_anterior NUMERIC(12,2),
  preco_novo NUMERIC(12,2) NOT NULL,
  tipo_mudanca VARCHAR(30), -- 'aumento', 'reducao', 'promocao', 'ajuste'
  motivo TEXT,
  percentual_mudanca NUMERIC(5,2), -- Calculado: ((novo - anterior) / anterior) * 100
  data_vigencia DATE NOT NULL,
  data_fim DATE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  data_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_preco_novo CHECK (preco_novo > 0)
);

CREATE INDEX idx_historico_preco_empresa ON historico_preco_produto(empresa_id);
CREATE INDEX idx_historico_preco_produto ON historico_preco_produto(empresa_id, produto_id);
CREATE INDEX idx_historico_preco_vigencia ON historico_preco_produto(empresa_id, data_vigencia);

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
  margem_absoluta NUMERIC(12,2) GENERATED ALWAYS AS (preco_venda - preco_custo) STORED,
  margem_percentual NUMERIC(5,2) GENERATED ALWAYS AS (((preco_venda - preco_custo) / preco_custo) * 100) STORED,
  quantidade_vendida_mes INTEGER DEFAULT 0,
  faturamento_mes NUMERIC(12,2) DEFAULT 0.00,
  lucro_mes NUMERIC(12,2) DEFAULT 0.00,
  data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(empresa_id, loja_id, produto_id),
  CONSTRAINT chk_margem_precos CHECK (preco_venda >= preco_custo)
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
  margem_unitaria NUMERIC(12,2) GENERATED ALWAYS AS (preco_unitario - COALESCE(preco_custo_unitario, 0)) STORED,
  margem_percentual NUMERIC(5,2),
  desconto_aplicado NUMERIC(12,2) DEFAULT 0.00,
  valor_total NUMERIC(12,2) GENERATED ALWAYS AS ((quantidade * preco_unitario) - COALESCE(desconto_aplicado, 0)) STORED,
  lucro_item NUMERIC(12,2) GENERATED ALWAYS AS ((quantidade * margem_unitaria) - COALESCE(desconto_aplicado, 0)) STORED,
  data_venda TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_item_quantidade CHECK (quantidade > 0),
  CONSTRAINT chk_item_preco CHECK (preco_unitario >= 0)
);

CREATE INDEX idx_itens_venda_empresa_loja ON itens_venda_detalhado(empresa_id, loja_id);
CREATE INDEX idx_itens_venda_venda ON itens_venda_detalhado(empresa_id, loja_id, venda_id);
CREATE INDEX idx_itens_venda_produto ON itens_venda_detalhado(empresa_id, loja_id, produto_id);
CREATE INDEX idx_itens_venda_lote ON itens_venda_detalhado(empresa_id, loja_id, lote_id);

-- ============================================================================
-- 8. TRIGGERS DE AUDITORIA (COMPATÍVEL COM SISTEMA EXISTENTE)
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_auditoria_supermercado()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO auditoria (
    empresa_id, loja_id, usuario_id, tabela, operacao,
    registro_id, dados_anterior, dados_novo, ip_address, user_agent
  ) VALUES (
    NEW.empresa_id,
    COALESCE(NEW.loja_id, NULL),
    CURRENT_USER::uuid,
    TG_TABLE_NAME,
    TG_OP,
    NEW.id,
    CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END,
    row_to_json(NEW),
    NULL,
    NULL
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar triggers de auditoria
DROP TRIGGER IF EXISTS trg_audit_lotes_produto ON lotes_produto;
CREATE TRIGGER trg_audit_lotes_produto
AFTER INSERT OR UPDATE ON lotes_produto
FOR EACH ROW EXECUTE FUNCTION trigger_auditoria_supermercado();

DROP TRIGGER IF EXISTS trg_audit_estoque_real_tempo ON estoque_real_tempo;
CREATE TRIGGER trg_audit_estoque_real_tempo
AFTER INSERT OR UPDATE ON estoque_real_tempo
FOR EACH ROW EXECUTE FUNCTION trigger_auditoria_supermercado();

DROP TRIGGER IF EXISTS trg_audit_fornecedores_produto ON fornecedores_produto;
CREATE TRIGGER trg_audit_fornecedores_produto
AFTER INSERT OR UPDATE ON fornecedores_produto
FOR EACH ROW EXECUTE FUNCTION trigger_auditoria_supermercado();

DROP TRIGGER IF EXISTS trg_audit_margem_produto ON margem_produto;
CREATE TRIGGER trg_audit_margem_produto
AFTER INSERT OR UPDATE ON margem_produto
FOR EACH ROW EXECUTE FUNCTION trigger_auditoria_supermercado();

-- ============================================================================
-- 9. COMENTÁRIOS DE DOCUMENTAÇÃO
-- ============================================================================

COMMENT ON TABLE lotes_produto IS 'Rastreamento de lotes com validade, quantidade e preço';
COMMENT ON TABLE estoque_real_tempo IS 'Saldo consolidado em tempo real por loja, com quantidade reservada';
COMMENT ON TABLE fornecedores_produto IS 'Cadastro de fornecedores com contato e prazos';
COMMENT ON TABLE produto_fornecedor IS 'Mapeamento de múltiplos fornecedores por produto';
COMMENT ON TABLE historico_preco_produto IS 'Histórico de variações de preço com motivo e percentual';
COMMENT ON TABLE margem_produto IS 'Análise de margem por item e loja com faturamento mensal';
COMMENT ON TABLE itens_venda_detalhado IS 'Detalhamento de itens vendidos com lote, margem e lucro';

COMMENT ON COLUMN lotes_produto.status IS 'Status do lote: ativo, vencido, descartado, finalizado';
COMMENT ON COLUMN estoque_real_tempo.quantidade_disponivel IS 'Calculado: quantidade_total - quantidade_reservada';
COMMENT ON COLUMN margem_produto.margem_percentual IS 'Calculado: ((preco_venda - preco_custo) / preco_custo) * 100';
COMMENT ON COLUMN itens_venda_detalhado.lucro_item IS 'Lucro do item: (quantidade * margem_unitaria) - desconto';
