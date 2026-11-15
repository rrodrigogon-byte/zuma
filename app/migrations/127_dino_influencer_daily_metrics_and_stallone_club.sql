-- ============================================================================
-- KYTTO COMMERCE CORE · MIGRATION 127
-- TABELAS OPERACIONAIS: DINO INFLUENCER DAILY METRICS & STALLONE CLUB ASSINATURAS
-- ============================================================================

-- 1. Tabela de métricas diárias e auditoria de crescimento do Instagram (@odinovisagista)
CREATE TABLE IF NOT EXISTS dino_influencer_daily_metrics (
  id SERIAL PRIMARY KEY,
  data_referencia DATE NOT NULL,
  instagram_handle VARCHAR(80) NOT NULL DEFAULT '@odinovisagista',
  seguidores_total INT NOT NULL,
  seguidores_ganhos INT NOT NULL DEFAULT 0,
  seguidores_perdidos INT NOT NULL DEFAULT 0,
  seguidores_saldo INT NOT NULL DEFAULT 0,
  contas_seguidas INT NOT NULL DEFAULT 8234,
  unfollows_dia INT NOT NULL DEFAULT 0,
  reels_publicados INT NOT NULL DEFAULT 0,
  directs_recebidos INT NOT NULL DEFAULT 0,
  borrifadas_realizadas INT NOT NULL DEFAULT 0,
  vendas_perfumes_qtd INT NOT NULL DEFAULT 0,
  vendas_perfumes_valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  assinantes_clube_novos INT NOT NULL DEFAULT 0,
  agendamentos_buracos INT NOT NULL DEFAULT 0,
  receita_total_dia NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_dino_metrics_data_handle UNIQUE(data_referencia, instagram_handle)
);

CREATE INDEX IF NOT EXISTS idx_dino_metrics_data ON dino_influencer_daily_metrics (data_referencia DESC);
CREATE INDEX IF NOT EXISTS idx_dino_metrics_handle ON dino_influencer_daily_metrics (instagram_handle);

-- Carga inicial de métricas históricas de novembro/2026 para o Cockpit Dino Influencer 360°
INSERT INTO dino_influencer_daily_metrics (
  data_referencia, instagram_handle, seguidores_total, seguidores_ganhos, seguidores_perdidos,
  seguidores_saldo, contas_seguidas, unfollows_dia, reels_publicados, directs_recebidos,
  borrifadas_realizadas, vendas_perfumes_qtd, vendas_perfumes_valor, assinantes_clube_novos,
  agendamentos_buracos, receita_total_dia
) VALUES
  ('2026-11-01', '@odinovisagista', 17076, 5, 10, -5, 8240, 0, 0, 2, 0, 0, 0, 0, 0, 0),
  ('2026-11-02', '@odinovisagista', 17072, 4, 8, -4, 8242, 0, 0, 1, 0, 0, 0, 0, 0, 0),
  ('2026-11-03', '@odinovisagista', 17068, 6, 10, -4, 8240, 0, 0, 3, 0, 0, 0, 0, 0, 0),
  ('2026-11-04', '@odinovisagista', 17065, 3, 6, -3, 8241, 0, 0, 2, 0, 0, 0, 0, 0, 0),
  ('2026-11-05', '@odinovisagista', 17059, 7, 13, -6, 8239, 0, 0, 4, 0, 0, 0, 0, 0, 0),
  ('2026-11-06', '@odinovisagista', 17055, 5, 9, -4, 8238, 0, 0, 2, 0, 0, 0, 0, 0, 0),
  ('2026-11-07', '@odinovisagista', 17052, 4, 7, -3, 8236, 0, 0, 3, 0, 0, 0, 0, 0, 0),
  ('2026-11-08', '@odinovisagista', 17048, 8, 12, -4, 8234, 0, 0, 5, 0, 0, 0, 0, 0, 0),
  ('2026-11-09', '@odinovisagista', 17045, 6, 9, -3, 8230, 4, 0, 3, 0, 0, 0, 0, 0, 0),
  ('2026-11-10', '@odinovisagista', 17041, 5, 9, -4, 8225, 5, 0, 4, 0, 0, 0, 0, 0, 0),
  ('2026-11-11', '@odinovisagista', 17036, 7, 12, -5, 8215, 10, 0, 6, 12, 1, 350.00, 0, 1, 350.00),
  ('2026-11-12', '@odinovisagista', 17032, 8, 12, -4, 8200, 15, 1, 9, 25, 2, 700.00, 1, 2, 949.00),
  ('2026-11-13', '@odinovisagista', 17029, 14, 17, -3, 8185, 15, 1, 14, 38, 4, 1400.00, 2, 4, 1898.00),
  ('2026-11-14', '@odinovisagista', 17041, 28, 16, 12, 8125, 60, 2, 18, 42, 6, 2100.00, 2, 5, 3020.00)
ON CONFLICT (data_referencia, instagram_handle) DO UPDATE SET
  seguidores_total = EXCLUDED.seguidores_total,
  seguidores_ganhos = EXCLUDED.seguidores_ganhos,
  seguidores_perdidos = EXCLUDED.seguidores_perdidos,
  seguidores_saldo = EXCLUDED.seguidores_saldo,
  contas_seguidas = EXCLUDED.contas_seguidas,
  unfollows_dia = EXCLUDED.unfollows_dia,
  reels_publicados = EXCLUDED.reels_publicados,
  directs_recebidos = EXCLUDED.directs_recebidos,
  borrifadas_realizadas = EXCLUDED.borrifadas_realizadas,
  vendas_perfumes_qtd = EXCLUDED.vendas_perfumes_qtd,
  vendas_perfumes_valor = EXCLUDED.vendas_perfumes_valor,
  assinantes_clube_novos = EXCLUDED.assinantes_clube_novos,
  agendamentos_buracos = EXCLUDED.agendamentos_buracos,
  receita_total_dia = EXCLUDED.receita_total_dia;

-- 2. Tabela de assinaturas do Stallone VIP Club (Box Mensal de Suplementação Recorrente)
CREATE TABLE IF NOT EXISTS stallone_club_assinaturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL DEFAULT '31f70c83-9172-40c2-945f-9e793b5048be',
  loja_id UUID NOT NULL DEFAULT '6a15e943-2570-4f29-a2d5-d900d2812911',
  cliente_id VARCHAR(120),
  cliente_nome VARCHAR(255) NOT NULL,
  cliente_telefone VARCHAR(40),
  cliente_cpf VARCHAR(20),
  plano_codigo VARCHAR(60) NOT NULL,
  plano_nome VARCHAR(255) NOT NULL,
  valor_mensalidade NUMERIC(12,2) NOT NULL,
  cashback_percentual NUMERIC(5,2) NOT NULL DEFAULT 5.0,
  cashback_saldo NUMERIC(12,2) NOT NULL DEFAULT 0.0,
  status VARCHAR(40) NOT NULL DEFAULT 'ativa',
  dia_cobranca INT NOT NULL DEFAULT 10,
  ultimo_ciclo_pago VARCHAR(20),
  proximo_vencimento DATE,
  tef_transacao_id VARCHAR(120),
  adquirente_recorrente VARCHAR(60) DEFAULT 'SICREDI',
  observacoes TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stallone_club_empresa ON stallone_club_assinaturas (empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_stallone_club_cpf ON stallone_club_assinaturas (cliente_cpf);

-- Carga demonstrativa de assinantes fundadores da Stallone Nutre Sport
INSERT INTO stallone_club_assinaturas (
  id, empresa_id, loja_id, cliente_nome, cliente_telefone, cliente_cpf,
  plano_codigo, plano_nome, valor_mensalidade, cashback_percentual, cashback_saldo,
  status, dia_cobranca, ultimo_ciclo_pago, proximo_vencimento, tef_transacao_id,
  adquirente_recorrente, observacoes
) VALUES
  ('a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', '31f70c83-9172-40c2-945f-9e793b5048be', '6a15e943-2570-4f29-a2d5-d900d2812911',
   'Carlos Eduardo Silveira', '(65) 99981-4432', '784.921.341-00', 'performance',
   'Box Performance & Hipertrofia (Massa Magra & Força)', 279.00, 10.0, 27.90,
   'ativa', 10, '2026-11', '2026-12-10', 'TEF-REC-78912', 'SICREDI', 'Assinante com bioimpedância mensal inclusa no Caixa 02'),
  ('b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e', '31f70c83-9172-40c2-945f-9e793b5048be', '6a15e943-2570-4f29-a2d5-d900d2812911',
   'Mariana Bastos Ferreira', '(65) 99872-1190', '521.849.201-44', 'elite',
   'Box Pro Elite & Definição Extrema (Alta Performance)', 429.00, 15.0, 64.35,
   'ativa', 15, '2026-11', '2026-12-15', 'TEF-REC-99410', 'REDE', 'Atleta de fisiculturismo - consultoria KyttoIA WhatsApp ativa')
ON CONFLICT (id) DO NOTHING;
