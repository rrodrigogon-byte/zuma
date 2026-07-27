-- ============================================================================
-- KYTTO ERP — FASE 2: PDV OFFLINE-FIRST E PERIFÉRICOS
-- Migração 004
-- ============================================================================
-- Esta migração não armazena segredos de agentes em texto puro. O token é
-- entregue somente no provisionamento e persiste no banco como SHA-256.

CREATE TABLE IF NOT EXISTS terminais_pdv (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE RESTRICT,
  codigo VARCHAR(60) NOT NULL,
  nome VARCHAR(120) NOT NULL,
  identificador_dispositivo VARCHAR(160),
  token_hash VARCHAR(64) NOT NULL,
  versao_agente VARCHAR(40),
  modo_offline_habilitado BOOLEAN NOT NULL DEFAULT true,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ultimo_heartbeat_em TIMESTAMPTZ,
  ultima_sincronizacao_em TIMESTAMPTZ,
  configuracoes JSONB NOT NULL DEFAULT '{}'::jsonb,
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uk_terminais_pdv_empresa_codigo UNIQUE (empresa_id, codigo),
  CONSTRAINT uk_terminais_pdv_empresa_identificador UNIQUE (empresa_id, identificador_dispositivo)
);
CREATE INDEX IF NOT EXISTS idx_terminais_pdv_loja ON terminais_pdv (loja_id, ativo);

CREATE TABLE IF NOT EXISTS dispositivos_perifericos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE RESTRICT,
  terminal_id UUID REFERENCES terminais_pdv(id) ON DELETE SET NULL,
  tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('impressora_termica', 'leitor_codigo_barras', 'balanca', 'gaveta', 'pinpad', 'display_cliente', 'outro')),
  nome VARCHAR(120) NOT NULL,
  fabricante VARCHAR(120),
  modelo VARCHAR(120),
  endereco_conexao VARCHAR(250),
  configuracoes JSONB NOT NULL DEFAULT '{}'::jsonb,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ultimo_status VARCHAR(20) NOT NULL DEFAULT 'desconhecido' CHECK (ultimo_status IN ('online', 'offline', 'erro', 'desconhecido')),
  ultimo_status_em TIMESTAMPTZ,
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_dispositivos_perifericos_terminal ON dispositivos_perifericos (terminal_id, ativo);
CREATE INDEX IF NOT EXISTS idx_dispositivos_perifericos_loja ON dispositivos_perifericos (loja_id, tipo, ativo);

CREATE TABLE IF NOT EXISTS fila_impressao_local (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE RESTRICT,
  terminal_id UUID REFERENCES terminais_pdv(id) ON DELETE SET NULL,
  dispositivo_id UUID REFERENCES dispositivos_perifericos(id) ON DELETE SET NULL,
  tipo_documento VARCHAR(30) NOT NULL CHECK (tipo_documento IN ('comanda', 'pedido_cozinha', 'recibo', 'fechamento_caixa', 'etiqueta', 'relatorio', 'outro')),
  conteudo JSONB NOT NULL,
  chave_idempotencia UUID NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_processamento', 'concluido', 'falha', 'cancelado')),
  prioridade SMALLINT NOT NULL DEFAULT 5 CHECK (prioridade BETWEEN 1 AND 10),
  tentativas INTEGER NOT NULL DEFAULT 0,
  max_tentativas INTEGER NOT NULL DEFAULT 5,
  erro_ultima_tentativa TEXT,
  processado_em TIMESTAMPTZ,
  concluido_em TIMESTAMPTZ,
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uk_fila_impressao_idempotencia UNIQUE (empresa_id, chave_idempotencia)
);
CREATE INDEX IF NOT EXISTS idx_fila_impressao_consumo ON fila_impressao_local (terminal_id, status, prioridade DESC, data_criacao);

CREATE TABLE IF NOT EXISTS eventos_hardware (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE RESTRICT,
  terminal_id UUID REFERENCES terminais_pdv(id) ON DELETE SET NULL,
  dispositivo_id UUID REFERENCES dispositivos_perifericos(id) ON DELETE SET NULL,
  tipo_evento VARCHAR(60) NOT NULL,
  severidade VARCHAR(12) NOT NULL DEFAULT 'info' CHECK (severidade IN ('debug', 'info', 'aviso', 'erro', 'critico')),
  dados JSONB NOT NULL DEFAULT '{}'::jsonb,
  ocorrido_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  recebido_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_eventos_hardware_loja_data ON eventos_hardware (loja_id, ocorrido_em DESC);

CREATE TABLE IF NOT EXISTS lotes_sincronizacao_pdv (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE RESTRICT,
  terminal_id UUID NOT NULL REFERENCES terminais_pdv(id) ON DELETE RESTRICT,
  lote_cliente_id UUID NOT NULL,
  versao_cliente VARCHAR(40),
  status VARCHAR(20) NOT NULL DEFAULT 'recebido' CHECK (status IN ('recebido', 'processando', 'processado', 'parcial', 'falha')),
  total_eventos INTEGER NOT NULL DEFAULT 0,
  eventos_processados INTEGER NOT NULL DEFAULT 0,
  eventos_com_conflito INTEGER NOT NULL DEFAULT 0,
  recebido_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processado_em TIMESTAMPTZ,
  CONSTRAINT uk_lotes_sincronizacao_terminal_cliente UNIQUE (terminal_id, lote_cliente_id)
);
CREATE INDEX IF NOT EXISTS idx_lotes_sincronizacao_terminal ON lotes_sincronizacao_pdv (terminal_id, recebido_em DESC);

CREATE TABLE IF NOT EXISTS eventos_sincronizacao_pdv (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id UUID NOT NULL REFERENCES lotes_sincronizacao_pdv(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE RESTRICT,
  terminal_id UUID NOT NULL REFERENCES terminais_pdv(id) ON DELETE RESTRICT,
  evento_cliente_id UUID NOT NULL,
  sequencia_cliente BIGINT NOT NULL,
  tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('venda_offline', 'movimento_caixa', 'impressao', 'atualizacao_catalogo', 'outro')),
  payload JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'recebido' CHECK (status IN ('recebido', 'processado', 'conflito', 'falha')),
  resultado JSONB,
  criado_no_cliente_em TIMESTAMPTZ,
  processado_em TIMESTAMPTZ,
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uk_eventos_sinc_terminal_cliente UNIQUE (terminal_id, evento_cliente_id),
  CONSTRAINT uk_eventos_sinc_terminal_sequencia UNIQUE (terminal_id, sequencia_cliente)
);
CREATE INDEX IF NOT EXISTS idx_eventos_sinc_lote ON eventos_sincronizacao_pdv (lote_id, sequencia_cliente);

CREATE TABLE IF NOT EXISTS conflitos_sincronizacao_pdv (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE RESTRICT,
  terminal_id UUID NOT NULL REFERENCES terminais_pdv(id) ON DELETE RESTRICT,
  evento_id UUID REFERENCES eventos_sincronizacao_pdv(id) ON DELETE SET NULL,
  tipo_conflito VARCHAR(60) NOT NULL,
  dados_cliente JSONB NOT NULL DEFAULT '{}'::jsonb,
  dados_servidor JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolucao VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK (resolucao IN ('pendente', 'aceito_cliente', 'aceito_servidor', 'mesclado', 'descartado')),
  resolvido_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  resolvido_em TIMESTAMPTZ,
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_conflitos_sinc_abertos ON conflitos_sincronizacao_pdv (loja_id, resolucao, data_criacao DESC);

-- Rastreabilidade da origem offline sem interferir nas vendas online já existentes.
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS terminal_id UUID REFERENCES terminais_pdv(id) ON DELETE SET NULL;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS id_externo UUID;
CREATE UNIQUE INDEX IF NOT EXISTS uk_vendas_terminal_id_externo
  ON vendas (terminal_id, id_externo)
  WHERE terminal_id IS NOT NULL AND id_externo IS NOT NULL;

-- Atualização de timestamp das entidades de configuração operacional.
DO $$
DECLARE
  tabela TEXT;
  gatilho TEXT;
BEGIN
  FOREACH tabela IN ARRAY ARRAY['terminais_pdv', 'dispositivos_perifericos']
  LOOP
    gatilho := 'trg_' || tabela || '_atualizacao';
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = gatilho) THEN
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION atualizar_data_atualizacao()',
        gatilho, tabela
      );
    END IF;
  END LOOP;
END $$;
