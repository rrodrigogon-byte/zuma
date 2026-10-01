-- Migration 052 — Cérebro do atendente: várias IAs, memória individual por cliente,
-- ciclo de aprendizado com aprovação humana e automações governadas.
-- Somente cria tabelas/índices novos e amplia a lista de tipos da fila. Não apaga,
-- não altera dados existentes e não liga nada: tudo nasce desativado.

BEGIN;

-- Configuração por empresa (botão de desligar, autonomia, teto de gasto, automações)
CREATE TABLE IF NOT EXISTS ai_brain_settings (
  empresa_id UUID PRIMARY KEY REFERENCES empresas(id) ON DELETE CASCADE,
  ativo BOOLEAN NOT NULL DEFAULT false,
  autonomia SMALLINT NOT NULL DEFAULT 1,
  teto_diario_centavos INTEGER NOT NULL DEFAULT 2000,
  automacoes JSONB NOT NULL DEFAULT '{}'::jsonb,
  atualizado_por VARCHAR(160),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_ai_brain_autonomia CHECK (autonomia BETWEEN 0 AND 3),
  CONSTRAINT chk_ai_brain_teto CHECK (teto_diario_centavos BETWEEN 0 AND 1000000)
);

-- Cada chamada a uma IA: qual provedor, modelo, custo estimado e se caiu para a reserva
CREATE TABLE IF NOT EXISTS ai_router_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  tarefa VARCHAR(40) NOT NULL,
  provedor VARCHAR(20) NOT NULL,
  modelo VARCHAR(120),
  status VARCHAR(20) NOT NULL,
  fallback BOOLEAN NOT NULL DEFAULT false,
  latencia_ms INTEGER NOT NULL DEFAULT 0,
  input_chars INTEGER NOT NULL DEFAULT 0,
  output_chars INTEGER NOT NULL DEFAULT 0,
  custo_centavos NUMERIC(12,4) NOT NULL DEFAULT 0,
  erro_codigo VARCHAR(80),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_ai_router_runs_status CHECK (status IN ('success', 'failed', 'skipped'))
);
CREATE INDEX IF NOT EXISTS idx_ai_router_runs_empresa_dia ON ai_router_runs (empresa_id, criado_em DESC);

-- Resumo de cada conversa por cliente e dia. Sobrevive à retenção das mensagens brutas.
CREATE TABLE IF NOT EXISTS ai_conversation_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID REFERENCES lojas(id) ON DELETE SET NULL,
  sessao_id UUID REFERENCES whatsapp_ai_sessions(id) ON DELETE SET NULL,
  telefone VARCHAR(20) NOT NULL,
  dia DATE NOT NULL,
  resumo TEXT NOT NULL,
  resultado VARCHAR(30) NOT NULL DEFAULT 'duvida',
  sentimento VARCHAR(20) NOT NULL DEFAULT 'neutro',
  mensagens INTEGER NOT NULL DEFAULT 0,
  modelo VARCHAR(120),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_ai_conversation_summary UNIQUE (empresa_id, telefone, dia),
  CONSTRAINT chk_ai_summary_resultado CHECK (resultado IN ('agendou', 'comprou', 'duvida', 'reclamacao', 'sem_resposta', 'humano')),
  CONSTRAINT chk_ai_summary_sentimento CHECK (sentimento IN ('positivo', 'neutro', 'negativo'))
);
CREATE INDEX IF NOT EXISTS idx_ai_summaries_cliente ON ai_conversation_summaries (empresa_id, telefone, dia DESC);
CREATE INDEX IF NOT EXISTS idx_ai_summaries_busca ON ai_conversation_summaries
  USING GIN (to_tsvector('portuguese', resumo));

-- Fatos sobre cada cliente, sempre com fonte e confiança
CREATE TABLE IF NOT EXISTS ai_customer_facts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  telefone VARCHAR(20) NOT NULL,
  chave VARCHAR(60) NOT NULL,
  valor VARCHAR(300) NOT NULL,
  categoria VARCHAR(30) NOT NULL,
  confianca NUMERIC(3,2) NOT NULL DEFAULT 0.5,
  status VARCHAR(20) NOT NULL DEFAULT 'proposto',
  fonte_resumo_id UUID REFERENCES ai_conversation_summaries(id) ON DELETE SET NULL,
  fonte_trecho VARCHAR(300),
  extraido_por VARCHAR(120),
  valido_ate DATE,
  alterado_por VARCHAR(160),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_ai_customer_fact UNIQUE (empresa_id, telefone, chave),
  CONSTRAINT chk_ai_fact_status CHECK (status IN ('proposto', 'ativo', 'contestado', 'expirado')),
  CONSTRAINT chk_ai_fact_confianca CHECK (confianca BETWEEN 0 AND 1)
);
CREATE INDEX IF NOT EXISTS idx_ai_facts_cliente ON ai_customer_facts (empresa_id, telefone, status);
CREATE INDEX IF NOT EXISTS idx_ai_facts_categoria ON ai_customer_facts (empresa_id, categoria, status);

-- Aprendizados propostos pela IA; só entram no atendimento depois de aprovados
CREATE TABLE IF NOT EXISTS ai_learning_proposals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  tipo VARCHAR(20) NOT NULL,
  chave VARCHAR(160) NOT NULL,
  titulo VARCHAR(200) NOT NULL,
  proposta TEXT,
  evidencias JSONB NOT NULL DEFAULT '[]'::jsonb,
  ocorrencias INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'proposto',
  decidido_por VARCHAR(160),
  decidido_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_ai_learning_proposal UNIQUE (empresa_id, tipo, chave),
  CONSTRAINT chk_ai_learning_tipo CHECK (tipo IN ('faq', 'objecao')),
  CONSTRAINT chk_ai_learning_status CHECK (status IN ('proposto', 'aprovado', 'rejeitado'))
);
CREATE INDEX IF NOT EXISTS idx_ai_learning_status ON ai_learning_proposals (empresa_id, status, ocorrencias DESC);

-- Nota de uma IA juíza (diferente da que atendeu) para uma amostra de conversas
CREATE TABLE IF NOT EXISTS ai_judge_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  resumo_id UUID REFERENCES ai_conversation_summaries(id) ON DELETE CASCADE,
  telefone VARCHAR(20) NOT NULL,
  dia DATE NOT NULL,
  nota SMALLINT NOT NULL,
  criterios JSONB NOT NULL DEFAULT '{}'::jsonb,
  comentario VARCHAR(500),
  modelo VARCHAR(120),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_ai_judge_review UNIQUE (empresa_id, telefone, dia),
  CONSTRAINT chk_ai_judge_nota CHECK (nota BETWEEN 1 AND 5)
);

-- Execuções do ciclo noturno (idempotência por empresa e dia)
CREATE TABLE IF NOT EXISTS ai_learning_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  dia DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'executando',
  resumo JSONB NOT NULL DEFAULT '{}'::jsonb,
  iniciado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  concluido_em TIMESTAMPTZ,
  CONSTRAINT uq_ai_learning_run UNIQUE (empresa_id, dia),
  CONSTRAINT chk_ai_learning_run_status CHECK (status IN ('executando', 'concluido', 'falhou'))
);

-- Registro de cada automação por cliente (limite de frequência e auditoria)
CREATE TABLE IF NOT EXISTS ai_automation_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  telefone VARCHAR(20) NOT NULL,
  automacao VARCHAR(40) NOT NULL,
  referencia VARCHAR(160) NOT NULL,
  status VARCHAR(20) NOT NULL,
  motivo VARCHAR(80),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_ai_automation_ref UNIQUE (empresa_id, automacao, telefone, referencia),
  CONSTRAINT chk_ai_automation_status CHECK (status IN ('enfileirada', 'enviada', 'bloqueada', 'falhou'))
);
CREATE INDEX IF NOT EXISTS idx_ai_automation_cliente ON ai_automation_log (empresa_id, telefone, criado_em DESC);

-- A fila existente passa a aceitar o tipo das automações do cérebro
ALTER TABLE tarefas_integracao_canais DROP CONSTRAINT IF EXISTS chk_tarefas_integracao_tipo;
ALTER TABLE tarefas_integracao_canais
  ADD CONSTRAINT chk_tarefas_integracao_tipo
  CHECK (tipo IN (
    'buscar_pedido',
    'reconciliar',
    'sincronizar_catalogo',
    'processar_conversa',
    'enviar_campanha',
    'recuperar_carrinho',
    'notificar_agendamento',
    'automacao_ia'
  ));

CREATE UNIQUE INDEX IF NOT EXISTS uq_tarefas_automacao_ia
  ON tarefas_integracao_canais (empresa_id, tipo, referencia_externa)
  WHERE tipo = 'automacao_ia';

COMMIT;
