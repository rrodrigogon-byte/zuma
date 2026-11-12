-- ============================================================================
-- Migration 122: Módulo Oficial de Sorteios & Campanhas Premiadas Kytto
-- Suporta sorteios para clientes da Barbearia Dino, Loja Dino / Perfumaria / Commerce
-- e outras empresas do Grupo Silvester Holding e plataforma Kytto.
-- ============================================================================

CREATE TABLE IF NOT EXISTS srt_campanhas (
  id VARCHAR(80) PRIMARY KEY,
  empresa_id VARCHAR(80) NOT NULL,
  grupo_id VARCHAR(80) DEFAULT 'grupo-silvester-holding',
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT,
  regulamento TEXT,
  premio_principal VARCHAR(255) NOT NULL,
  premios JSONB NOT NULL DEFAULT '[]'::jsonb,
  banner_url TEXT,
  data_inicio TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_fim TIMESTAMPTZ NOT NULL,
  data_sorteio TIMESTAMPTZ,
  status VARCHAR(30) NOT NULL DEFAULT 'ativa',
  canais_elegiveis JSONB NOT NULL DEFAULT '["barbearia", "ecommerce", "perfumaria", "pdv", "todos"]'::jsonb,
  regras JSONB NOT NULL DEFAULT '{"valorMinimoBilhete": 50, "multiplicadorPerfumaria": 2, "bonusClube": 3, "permitirManual": true}'::jsonb,
  total_bilhetes INTEGER NOT NULL DEFAULT 0,
  total_participantes INTEGER NOT NULL DEFAULT 0,
  ganhador_bilhete_id VARCHAR(80),
  ganhador_cliente_id VARCHAR(180),
  ganhador_nome VARCHAR(220),
  ganhador_telefone VARCHAR(60),
  sorteado_em TIMESTAMPTZ,
  sorteado_por VARCHAR(180),
  hash_auditoria VARCHAR(120),
  semente_sorteio TEXT,
  criado_por VARCHAR(180) DEFAULT 'Sistema',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS srt_bilhetes (
  id VARCHAR(80) PRIMARY KEY,
  campanha_id VARCHAR(80) NOT NULL,
  empresa_id VARCHAR(80) NOT NULL,
  numero_sorte VARCHAR(60) NOT NULL,
  numero_sequencial INTEGER NOT NULL DEFAULT 1,
  cliente_id VARCHAR(180),
  cliente_nome VARCHAR(220) NOT NULL,
  cliente_telefone VARCHAR(60),
  cliente_cpf VARCHAR(20),
  origem VARCHAR(60) NOT NULL DEFAULT 'barbearia_comanda',
  documento_origem_id VARCHAR(120),
  valor_compra NUMERIC(14,2) DEFAULT 0,
  motivo VARCHAR(220),
  emitido_por VARCHAR(180),
  gerado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  hash_autenticidade VARCHAR(120) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'ativo',
  premiado BOOLEAN NOT NULL DEFAULT FALSE,
  premio_nome VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS srt_auditorias (
  id VARCHAR(80) PRIMARY KEY,
  campanha_id VARCHAR(80) NOT NULL,
  campanha_titulo VARCHAR(255) NOT NULL,
  ganhador_bilhete VARCHAR(60) NOT NULL,
  ganhador_nome VARCHAR(220) NOT NULL,
  ganhador_telefone VARCHAR(60),
  premio VARCHAR(255) NOT NULL,
  total_bilhetes_concorrentes INTEGER NOT NULL DEFAULT 0,
  hash_auditoria VARCHAR(120) NOT NULL,
  semente_sorteio TEXT NOT NULL,
  realizado_por VARCHAR(180) NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_srt_campanhas_empresa ON srt_campanhas(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_srt_bilhetes_campanha ON srt_bilhetes(campanha_id, numero_sorte);
CREATE INDEX IF NOT EXISTS idx_srt_bilhetes_telefone ON srt_bilhetes(cliente_telefone);
CREATE INDEX IF NOT EXISTS idx_srt_bilhetes_cliente ON srt_bilhetes(cliente_id);
