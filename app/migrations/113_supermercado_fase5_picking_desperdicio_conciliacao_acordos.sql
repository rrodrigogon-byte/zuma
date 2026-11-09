-- ══════════════════════════════════════════════════════════════════════════════════
-- MIGRATION 113: SUPERMERCADO ENTERPRISE FASE 5
-- PICKING E-COMMERCE / CLIQUE & RETIRE, GESTÃO DE PERDAS & FOOD WASTE,
-- CONCILIAÇÃO AUTOMATIZADA DE ADQUIRENTES TEF/PIX E ACORDOS COMERCIAIS / VERBAS
-- ══════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS var_picking_pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  numero_pedido VARCHAR(30) NOT NULL,
  canal VARCHAR(30) DEFAULT 'ECOMMERCE',
  cliente_nome VARCHAR(120) NOT NULL,
  cliente_telefone VARCHAR(30),
  status VARCHAR(30) DEFAULT 'AGUARDANDO_PICKING',
  operador_picking VARCHAR(80),
  itens_total INT DEFAULT 0,
  itens_separados INT DEFAULT 0,
  valor_total NUMERIC(14,2) DEFAULT 0,
  substituicoes_autorizadas BOOLEAN DEFAULT TRUE,
  data_pedido TIMESTAMPTZ DEFAULT NOW(),
  data_conclusao TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS var_picking_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES var_picking_pedidos(id) ON DELETE CASCADE,
  item_id UUID,
  codigo_barras VARCHAR(50),
  descricao VARCHAR(150) NOT NULL,
  corredor_endereco VARCHAR(30),
  quantidade_solicitada NUMERIC(10,3) DEFAULT 1,
  quantidade_separada NUMERIC(10,3) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'PENDENTE',
  item_substituto_descricao VARCHAR(150),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS var_remarcacao_validade_desperdicio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  item_id UUID,
  codigo_barras VARCHAR(50),
  descricao VARCHAR(150) NOT NULL,
  lote_codigo VARCHAR(50),
  data_vencimento DATE NOT NULL,
  dias_para_vencer INT NOT NULL,
  preco_original NUMERIC(14,2) NOT NULL,
  percentual_desconto NUMERIC(5,2) NOT NULL,
  preco_remarcado NUMERIC(14,2) NOT NULL,
  quantidade_lote NUMERIC(10,3) DEFAULT 1,
  status VARCHAR(30) DEFAULT 'REMARCADO_GONDOLA',
  data_remarcacao TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS var_conciliacao_cartoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  adquirente VARCHAR(40) NOT NULL,
  bandeira VARCHAR(40) NOT NULL,
  data_venda DATE NOT NULL,
  data_previsao_repasse DATE NOT NULL,
  valor_bruto_pdv NUMERIC(14,2) NOT NULL,
  taxa_mdr_contratada_pct NUMERIC(5,2) NOT NULL,
  taxa_mdr_cobrada_pct NUMERIC(5,2) NOT NULL,
  valor_liquido_esperado NUMERIC(14,2) NOT NULL,
  valor_liquido_pago NUMERIC(14,2) NOT NULL,
  divergencia_nominal NUMERIC(14,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'CONCILIADO_OK',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS var_acordos_fornecedores_verbas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  fornecedor_nome VARCHAR(120) NOT NULL,
  fornecedor_cnpj VARCHAR(20),
  tipo_acordo VARCHAR(50) NOT NULL,
  valor_acordado NUMERIC(14,2) NOT NULL,
  periodo_vigencia VARCHAR(30),
  forma_liquidacao VARCHAR(40) DEFAULT 'DESCONTO_DUPLICATA',
  status VARCHAR(30) DEFAULT 'ATIVO_A_FATURAR',
  data_acordo TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_var_picking_pedidos_empresa ON var_picking_pedidos(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_var_remarcacao_empresa ON var_remarcacao_validade_desperdicio(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_var_conciliacao_empresa ON var_conciliacao_cartoes(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_var_acordos_empresa ON var_acordos_fornecedores_verbas(empresa_id, status);
