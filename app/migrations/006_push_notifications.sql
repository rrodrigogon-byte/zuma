-- Migration 006: Push Notifications & Alertas Internos
-- SetPoint Ultra

-- Tabela de tokens de push (Expo)
CREATE TABLE IF NOT EXISTS push_tokens (
  id SERIAL PRIMARY KEY,
  tenant_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  plataforma VARCHAR(10) DEFAULT 'expo', -- expo, fcm, apns
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(usuario_id, token)
);

-- Tabela de alertas internos (painel web + mobile)
CREATE TABLE IF NOT EXISTS alertas_internos (
  id SERIAL PRIMARY KEY,
  tenant_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  tipo VARCHAR(30) NOT NULL, -- estoque, vencimento, crediario, agendamento, sistema, os, pagamento
  titulo VARCHAR(200) NOT NULL,
  mensagem TEXT NOT NULL,
  link VARCHAR(500),
  prioridade VARCHAR(10) DEFAULT 'normal', -- baixa, normal, alta, critica
  lida BOOLEAN DEFAULT false,
  lida_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de cobranças SaaS (billing)
CREATE TABLE IF NOT EXISTS cobrancas_saas (
  id SERIAL PRIMARY KEY,
  tenant_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
  plano_id VARCHAR(30) NOT NULL,
  valor NUMERIC(10,2) NOT NULL,
  vencimento DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'pendente', -- pendente, pago, vencido, cancelado
  forma_pagamento VARCHAR(30),
  valor_pago NUMERIC(10,2),
  pago_em TIMESTAMPTZ,
  comprovante TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar colunas de billing na tabela empresas (se não existirem)
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS plano_id VARCHAR(30) DEFAULT 'profissional';
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS segmento VARCHAR(30) DEFAULT 'varejo';
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS trial_ate TIMESTAMPTZ;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS cancelado_em TIMESTAMPTZ;

-- Tabela de lotes de produtos (supermercado)
CREATE TABLE IF NOT EXISTS lotes_produtos (
  id SERIAL PRIMARY KEY,
  tenant_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES produtos(id) ON DELETE CASCADE,
  codigo VARCHAR(50),
  validade DATE,
  quantidade NUMERIC(12,3) DEFAULT 0,
  custo_unitario NUMERIC(10,4),
  fornecedor_id INTEGER,
  nota_entrada VARCHAR(50),
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de parcelas de crediário
CREATE TABLE IF NOT EXISTS parcelas_crediario (
  id SERIAL PRIMARY KEY,
  conta_id INTEGER,
  tenant_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  vencimento DATE NOT NULL,
  valor NUMERIC(10,2) NOT NULL,
  valor_pago NUMERIC(10,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'aberta', -- aberta, paga, vencida, renegociada
  pago_em TIMESTAMPTZ,
  forma_pagamento VARCHAR(30),
  juros NUMERIC(10,2) DEFAULT 0,
  multa NUMERIC(10,2) DEFAULT 0,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de contas de crediário
CREATE TABLE IF NOT EXISTS contas_crediario (
  id SERIAL PRIMARY KEY,
  tenant_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
  cliente_id UUID,
  descricao VARCHAR(200),
  valor_total NUMERIC(10,2) NOT NULL,
  valor_entrada NUMERIC(10,2) DEFAULT 0,
  total_parcelas INTEGER NOT NULL,
  parcelas_pagas INTEGER DEFAULT 0,
  saldo_devedor NUMERIC(10,2),
  dia_vencimento INTEGER DEFAULT 10,
  taxa_juros NUMERIC(5,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'aberta', -- aberta, quitada, cancelada
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_alertas_tenant ON alertas_internos(tenant_id, lida, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_push_tokens_usuario ON push_tokens(usuario_id, ativo);
CREATE INDEX IF NOT EXISTS idx_lotes_validade ON lotes_produtos(tenant_id, validade);
CREATE INDEX IF NOT EXISTS idx_parcelas_vencimento ON parcelas_crediario(tenant_id, status, vencimento);
CREATE INDEX IF NOT EXISTS idx_cobrancas_status ON cobrancas_saas(tenant_id, status, vencimento);

COMMENT ON TABLE push_tokens IS 'Tokens Expo Push Notifications por dispositivo/usuário';
COMMENT ON TABLE alertas_internos IS 'Central de alertas internos — estoque, vencimentos, pagamentos, agendamentos';
COMMENT ON TABLE cobrancas_saas IS 'Cobranças mensais do SaaS por tenant';
