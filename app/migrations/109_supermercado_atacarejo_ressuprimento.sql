-- ============================================================================
-- MIGRATION 109: SUPERMERCADO ENTERPRISE - ATACAREJO, PROMOÇÕES, COMPRAS & RUPTURA
-- Kytto Cloud ERP - Padrão Tier-1 Supermercadista Brasileiro
-- ============================================================================

-- 1. Faixas de Preço de Atacarejo (Cash & Carry / Multi-Volume)
CREATE TABLE IF NOT EXISTS var_atacarejo_faixas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID,
  item_id UUID NOT NULL,
  quantidade_minima NUMERIC(14,3) NOT NULL,
  preco_unitario NUMERIC(14,2) NOT NULL,
  desconto_percentual NUMERIC(5,2),
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_atacarejo_qtd CHECK (quantidade_minima > 1),
  CONSTRAINT chk_atacarejo_preco CHECK (preco_unitario > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_var_atacarejo ON var_atacarejo_faixas (
  empresa_id, 
  COALESCE(loja_id, '00000000-0000-0000-0000-000000000000'::uuid), 
  item_id, 
  quantidade_minima
);

-- 2. Promoções Avançadas de Encarte (Leve X Pague Y, Desconto 2ª Unidade, Combos)
CREATE TABLE IF NOT EXISTS var_promocoes_avancadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID,
  nome VARCHAR(150) NOT NULL,
  mecanica VARCHAR(40) NOT NULL, -- 'LEVE_X_PAGUE_Y', 'DESCONTO_SEGUNDA_UNIDADE', 'COMBO_VIRTUAL', 'DESCONTO_PROGRESSIVO'
  item_origem_id UUID,
  item_combo_id UUID,
  qtd_gatilho INTEGER NOT NULL DEFAULT 1,
  qtd_paga INTEGER,
  desconto_percentual NUMERIC(5,2),
  preco_fixo_combo NUMERIC(14,2),
  data_inicio TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_fim TIMESTAMPTZ NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_promo_avanc_mecanica CHECK (mecanica IN ('LEVE_X_PAGUE_Y', 'DESCONTO_SEGUNDA_UNIDADE', 'COMBO_VIRTUAL', 'DESCONTO_PROGRESSIVO'))
);

CREATE INDEX IF NOT EXISTS idx_var_promo_avanc_vigencia ON var_promocoes_avancadas (empresa_id, data_inicio, data_fim) WHERE ativo = true;

-- 3. Sugestão Inteligente de Compras & Ressuprimento (GMD / Ponto de Pedido)
CREATE TABLE IF NOT EXISTS var_sugestao_compras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID,
  item_id UUID NOT NULL,
  fornecedor_nome VARCHAR(180),
  giro_medio_diario NUMERIC(14,3) NOT NULL DEFAULT 0,
  lead_time_dias INTEGER NOT NULL DEFAULT 3,
  estoque_seguranca NUMERIC(14,3) NOT NULL DEFAULT 0,
  ponto_pedido NUMERIC(14,3) NOT NULL DEFAULT 0,
  estoque_atual NUMERIC(14,3) NOT NULL DEFAULT 0,
  pedidos_pendentes NUMERIC(14,3) NOT NULL DEFAULT 0,
  quantidade_sugerida NUMERIC(14,3) NOT NULL DEFAULT 0,
  custo_estimado_unitario NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_total_sugerido NUMERIC(14,2) NOT NULL DEFAULT 0,
  curva_abc VARCHAR(5) DEFAULT 'A',
  status VARCHAR(30) NOT NULL DEFAULT 'SUGERIDO', -- 'SUGERIDO', 'APROVADO', 'PEDIDO_GERADO', 'DESCARTADO'
  gerado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_var_sugestao_status ON var_sugestao_compras (empresa_id, status);

-- 4. Monitoramento e Alertas de Ruptura em Tempo Real
CREATE TABLE IF NOT EXISTS var_alertas_ruptura (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID,
  item_id UUID NOT NULL,
  curva_abc VARCHAR(5) NOT NULL DEFAULT 'A',
  estoque_virtual NUMERIC(14,3) NOT NULL DEFAULT 0,
  horas_sem_venda NUMERIC(5,1) NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDENTE_REPOSICAO', -- 'PENDENTE_REPOSICAO', 'REPOSTO', 'JUSTIFICADO'
  observacao VARCHAR(250),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reposto_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_var_ruptura_status ON var_alertas_ruptura (empresa_id, status);
