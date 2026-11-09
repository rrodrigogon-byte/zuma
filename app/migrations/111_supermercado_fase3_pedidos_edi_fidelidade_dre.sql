-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 111: SUPERMERCADO FASE 3 - PEDIDOS EDI, SELINHOS, DRE & SPED
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Pedidos de Compra para Fornecedores & Espelho EDI
CREATE TABLE IF NOT EXISTS var_pedidos_compra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  loja_id UUID,
  fornecedor_id UUID,
  nome_fornecedor VARCHAR(200) NOT NULL,
  numero_pedido VARCHAR(40) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'ENVIADO', -- RASCUNHO, ENVIADO, CONFIRMADO, ENTREGUE_PARCIAL, CONCLUIDO, CANCELADO
  valor_total NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  condicao_pagamento VARCHAR(60) NOT NULL DEFAULT 'Boleto 28/35/42 ddl',
  prazo_dias INT NOT NULL DEFAULT 28,
  data_emissao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_previsao_entrega DATE,
  divergencia_doca BOOLEAN NOT NULL DEFAULT false,
  observacao TEXT,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_var_ped_empresa ON var_pedidos_compra(empresa_id, status);

CREATE TABLE IF NOT EXISTS var_pedido_compra_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES var_pedidos_compra(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL,
  item_id UUID,
  sku VARCHAR(60),
  descricao VARCHAR(255) NOT NULL,
  unidade VARCHAR(10) NOT NULL DEFAULT 'CX',
  fator_conversao INT NOT NULL DEFAULT 12, -- Ex: Caixa com 12 un
  quantidade_pedida NUMERIC(14, 3) NOT NULL,
  quantidade_entregue NUMERIC(14, 3) NOT NULL DEFAULT 0,
  preco_unitario_negociado NUMERIC(14, 2) NOT NULL,
  valor_total NUMERIC(14, 2) NOT NULL,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_var_ped_itens ON var_pedido_compra_itens(pedido_id);

-- 2. Campanhas de Selinhos & Colecionáveis (Fidelidade Supermercado)
CREATE TABLE IF NOT EXISTS var_campanhas_selinhos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  loja_id UUID,
  nome_campanha VARCHAR(200) NOT NULL,
  valor_por_selo NUMERIC(10, 2) NOT NULL DEFAULT 30.00, -- A cada R$ 30 ganha 1 selo
  premio_destaque VARCHAR(200) NOT NULL, -- Ex: Faca Chef Profissional Inox
  selos_necessarios INT NOT NULL DEFAULT 30,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS var_campanha_selos_clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  campanha_id UUID NOT NULL REFERENCES var_campanhas_selinhos(id) ON DELETE CASCADE,
  cliente_id UUID,
  cpf_cliente VARCHAR(20) NOT NULL,
  nome_cliente VARCHAR(150),
  saldo_selos INT NOT NULL DEFAULT 0,
  selos_resgatados INT NOT NULL DEFAULT 0,
  atualizado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_var_selos_cliente ON var_campanha_selos_clientes(empresa_id, cpf_cliente);

-- 3. DRE do Supermercado (Demonstrativo de Resultado do Exercício de Loja)
CREATE TABLE IF NOT EXISTS var_dre_supermercado (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  loja_id UUID,
  mes_ano VARCHAR(7) NOT NULL, -- YYYY-MM
  faturamento_bruto NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  impostos_vendas NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  receita_liquida NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  cmv_custo_mercadorias NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  lucro_bruto NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  despesas_pessoal NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  despesas_energia_refrigeracao NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  custo_quebras_perdas NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  outras_despesas_loja NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  ebitda_operacional NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  margem_ebitda_pct NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_var_dre_mes ON var_dre_supermercado(empresa_id, mes_ano);

-- 4. SPED Fiscal Bloco K (Livro de Registro de Controle da Produção e Estoque)
CREATE TABLE IF NOT EXISTS var_sped_bloco_k (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  loja_id UUID,
  data_movimento DATE NOT NULL,
  tipo_registro VARCHAR(10) NOT NULL, -- K200, K230, K235
  departamento VARCHAR(50) NOT NULL DEFAULT 'ACOUGUE', -- ACOUGUE, PADARIA, ROTISSERIA
  item_id UUID,
  descricao_item VARCHAR(255) NOT NULL,
  unidade VARCHAR(10) NOT NULL DEFAULT 'KG',
  quantidade NUMERIC(14, 3) NOT NULL,
  lote VARCHAR(80),
  observacao TEXT,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_var_sped_data ON var_sped_bloco_k(empresa_id, data_movimento);
