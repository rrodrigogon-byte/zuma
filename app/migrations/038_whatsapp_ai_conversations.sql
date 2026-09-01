-- WhatsApp AI conversations and canonical Commerce-scoped scheduling.
-- Additive and opt-in: no channel is activated and no external call is made by this migration.

CREATE TABLE IF NOT EXISTS canais_integracao (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  codigo_publico UUID NOT NULL DEFAULT uuid_generate_v4(),
  provedor VARCHAR(30) NOT NULL,
  nome VARCHAR(120) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'rascunho',
  modo_operacao VARCHAR(20) NOT NULL DEFAULT 'webhook',
  cabecalho_assinatura VARCHAR(100),
  algoritmo_assinatura VARCHAR(30) NOT NULL DEFAULT 'hmac_sha256',
  credencial_referencia VARCHAR(250),
  api_base_url TEXT,
  configuracao JSONB NOT NULL DEFAULT '{}'::jsonb,
  ultimo_evento_em TIMESTAMPTZ,
  ultima_sincronizacao_em TIMESTAMPTZ,
  ultimo_erro TEXT,
  criado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_canais_integracao_codigo_publico UNIQUE (codigo_publico),
  CONSTRAINT uq_canais_integracao_loja_provedor UNIQUE (empresa_id, loja_id, provedor),
  CONSTRAINT chk_canais_integracao_provedor CHECK (provedor IN ('ifood', 'uber_eats', 'whatsapp', 'web', 'app', 'telefone', 'manual', 'outro')),
  CONSTRAINT chk_canais_integracao_status CHECK (status IN ('rascunho', 'ativo', 'pausado', 'erro', 'desativado')),
  CONSTRAINT chk_canais_integracao_modo CHECK (modo_operacao IN ('webhook', 'polling', 'manual', 'misto')),
  CONSTRAINT chk_canais_integracao_algoritmo CHECK (algoritmo_assinatura IN ('hmac_sha256', 'token_estatico', 'nenhum'))
);

CREATE TABLE IF NOT EXISTS eventos_integracao_canais (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  canal_id UUID NOT NULL REFERENCES canais_integracao(id) ON DELETE CASCADE,
  evento_externo_id VARCHAR(200) NOT NULL,
  tipo_evento VARCHAR(100) NOT NULL,
  assinatura_valida BOOLEAN NOT NULL DEFAULT false,
  hash_corpo CHAR(64) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status_processamento VARCHAR(20) NOT NULL DEFAULT 'recebido',
  erro_processamento TEXT,
  recebido_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processado_em TIMESTAMPTZ,
  CONSTRAINT uq_eventos_integracao_idempotencia UNIQUE (canal_id, evento_externo_id),
  CONSTRAINT chk_eventos_integracao_status CHECK (status_processamento IN ('recebido', 'processado', 'ignorado', 'falha'))
);

CREATE TABLE IF NOT EXISTS tarefas_integracao_canais (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  canal_id UUID NOT NULL REFERENCES canais_integracao(id) ON DELETE CASCADE,
  evento_integracao_id UUID REFERENCES eventos_integracao_canais(id) ON DELETE SET NULL,
  tipo VARCHAR(30) NOT NULL,
  referencia_externa VARCHAR(200),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'pendente',
  tentativas SMALLINT NOT NULL DEFAULT 0,
  proxima_tentativa_em TIMESTAMPTZ,
  resposta JSONB,
  erro TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  concluido_em TIMESTAMPTZ,
  CONSTRAINT chk_tarefas_integracao_status CHECK (status IN ('pendente', 'processando', 'concluida', 'falha', 'cancelada')),
  CONSTRAINT chk_tarefas_integracao_tentativas CHECK (tentativas >= 0)
);

ALTER TABLE tarefas_integracao_canais DROP CONSTRAINT IF EXISTS tarefas_integracao_canais_tipo_check;
ALTER TABLE tarefas_integracao_canais DROP CONSTRAINT IF EXISTS chk_tarefas_integracao_tipo;
ALTER TABLE tarefas_integracao_canais
  ADD CONSTRAINT chk_tarefas_integracao_tipo
  CHECK (tipo IN ('buscar_pedido', 'reconciliar', 'sincronizar_catalogo', 'processar_conversa'));

CREATE INDEX IF NOT EXISTS idx_tarefas_integracao_canais_fila
  ON tarefas_integracao_canais (canal_id, status, proxima_tentativa_em, criado_em);
CREATE INDEX IF NOT EXISTS idx_eventos_integracao_processamento
  ON eventos_integracao_canais (empresa_id, loja_id, status_processamento, recebido_em ASC);

CREATE TABLE IF NOT EXISTS whatsapp_ai_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  canal_id UUID NOT NULL REFERENCES canais_integracao(id) ON DELETE CASCADE,
  remote_jid VARCHAR(200) NOT NULL,
  telefone VARCHAR(20) NOT NULL,
  nome VARCHAR(160),
  status VARCHAR(20) NOT NULL DEFAULT 'ativo',
  estado JSONB NOT NULL DEFAULT '{}'::jsonb,
  acao_pendente JSONB,
  ultimo_evento_externo_id VARCHAR(200),
  ultima_interacao_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expira_em TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_whatsapp_ai_session UNIQUE (canal_id, remote_jid),
  CONSTRAINT chk_whatsapp_ai_session_status CHECK (status IN ('ativo', 'humano', 'encerrado'))
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_ai_sessions_scope
  ON whatsapp_ai_sessions (empresa_id, loja_id, status, ultima_interacao_em DESC);

CREATE TABLE IF NOT EXISTS whatsapp_ai_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  canal_id UUID NOT NULL REFERENCES canais_integracao(id) ON DELETE CASCADE,
  sessao_id UUID NOT NULL REFERENCES whatsapp_ai_sessions(id) ON DELETE CASCADE,
  direcao VARCHAR(10) NOT NULL,
  papel VARCHAR(20) NOT NULL,
  evento_externo_id VARCHAR(200),
  conteudo TEXT,
  ferramenta VARCHAR(80),
  metadados JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_whatsapp_ai_message_direction CHECK (direcao IN ('entrada', 'saida', 'interna')),
  CONSTRAINT chk_whatsapp_ai_message_role CHECK (papel IN ('user', 'assistant', 'tool', 'system'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_whatsapp_ai_message_external
  ON whatsapp_ai_messages (canal_id, evento_externo_id)
  WHERE evento_externo_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_whatsapp_ai_messages_history
  ON whatsapp_ai_messages (empresa_id, loja_id, sessao_id, criado_em DESC);

CREATE TABLE IF NOT EXISTS whatsapp_ai_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  sessao_id UUID NOT NULL REFERENCES whatsapp_ai_sessions(id) ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL,
  chave_idempotencia VARCHAR(180) NOT NULL,
  solicitacao JSONB NOT NULL DEFAULT '{}'::jsonb,
  resposta JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'preparada',
  confirmado_em TIMESTAMPTZ,
  concluido_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_whatsapp_ai_action_idempotency UNIQUE (empresa_id, chave_idempotencia),
  CONSTRAINT chk_whatsapp_ai_action_status CHECK (status IN ('preparada', 'confirmada', 'concluida', 'falha', 'cancelada'))
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_ai_actions_session
  ON whatsapp_ai_actions (empresa_id, loja_id, sessao_id, criado_em DESC);

-- The ERP foundation version of `agendamentos` predates multi-store scheduling.
-- Add only compatible columns; existing rows and legacy routes remain untouched.
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS loja_id UUID REFERENCES lojas(id) ON DELETE SET NULL;
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS duracao_minutos INTEGER DEFAULT 30;
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS valor NUMERIC(12,2);
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS tipo_agendamento VARCHAR(50) DEFAULT 'barbearia';
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_agendamentos_empresa_loja_data
  ON agendamentos (empresa_id, loja_id, data_agendamento);

CREATE TABLE IF NOT EXISTS agendamentos_bloqueios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID REFERENCES lojas(id) ON DELETE CASCADE,
  usuario_profissional_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  data_inicio TIMESTAMP NOT NULL,
  data_fim TIMESTAMP NOT NULL,
  motivo VARCHAR(100) NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  data_criacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_agendamentos_bloqueios_datas CHECK (data_fim > data_inicio)
);
CREATE INDEX IF NOT EXISTS idx_agendamentos_bloqueios_scope
  ON agendamentos_bloqueios (empresa_id, loja_id, usuario_profissional_id, data_inicio, data_fim)
  WHERE ativo = true;

CREATE TABLE IF NOT EXISTS whatsapp_ai_worker_leases (
  nome VARCHAR(80) PRIMARY KEY,
  titular VARCHAR(120) NOT NULL,
  expira_em TIMESTAMPTZ NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
