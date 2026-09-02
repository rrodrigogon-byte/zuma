-- Operational hardening for WhatsApp AI.
-- Additive and inert: it does not enable feature flags, channels, webhooks or messages.

ALTER TABLE tarefas_integracao_canais
  ADD COLUMN IF NOT EXISTS lease_token UUID,
  ADD COLUMN IF NOT EXISTS lease_expira_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS erro_codigo VARCHAR(80),
  ADD COLUMN IF NOT EXISTS dead_letter_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provider_message_id VARCHAR(200);

CREATE INDEX IF NOT EXISTS idx_tarefas_integracao_lease
  ON tarefas_integracao_canais (status, lease_expira_em)
  WHERE status = 'processando';
CREATE INDEX IF NOT EXISTS idx_tarefas_integracao_dead_letter
  ON tarefas_integracao_canais (empresa_id, loja_id, dead_letter_em DESC)
  WHERE dead_letter_em IS NOT NULL;

ALTER TABLE envios_campanha DROP CONSTRAINT IF EXISTS envios_campanha_status_check;
ALTER TABLE envios_campanha ADD CONSTRAINT envios_campanha_status_check
  CHECK (status IN ('pendente','processando','enviado','entregue','lido','respondido','convertido','falha','incerto','bloqueado','cancelado'));

ALTER TABLE whatsapp_ai_messages
  ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(20),
  ADD COLUMN IF NOT EXISTS delivery_attempts SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS provider_message_id VARCHAR(200),
  ADD COLUMN IF NOT EXISTS sending_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_delivery_error TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_whatsapp_ai_delivery_status'
  ) THEN
    ALTER TABLE whatsapp_ai_messages
      ADD CONSTRAINT chk_whatsapp_ai_delivery_status
      CHECK (delivery_status IS NULL OR delivery_status IN ('prepared', 'sending', 'sent', 'unknown', 'failed', 'skipped'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_whatsapp_ai_delivery_state
  ON whatsapp_ai_messages (empresa_id, loja_id, delivery_status, criado_em)
  WHERE direcao = 'saida';

ALTER TABLE whatsapp_ai_sessions
  ADD COLUMN IF NOT EXISTS handoff_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS handoff_reason VARCHAR(500),
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS priority SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS privacy_notice_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_whatsapp_ai_session_priority'
  ) THEN
    ALTER TABLE whatsapp_ai_sessions
      ADD CONSTRAINT chk_whatsapp_ai_session_priority CHECK (priority BETWEEN 0 AND 5);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_whatsapp_ai_handoff_queue
  ON whatsapp_ai_sessions (empresa_id, loja_id, priority DESC, handoff_requested_at ASC)
  WHERE status = 'humano';

ALTER TABLE canais_integracao
  ADD COLUMN IF NOT EXISTS ai_circuit_open_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_consecutive_failures SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_last_error_code VARCHAR(80);

CREATE TABLE IF NOT EXISTS whatsapp_ai_provider_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  canal_id UUID NOT NULL REFERENCES canais_integracao(id) ON DELETE CASCADE,
  sessao_id UUID REFERENCES whatsapp_ai_sessions(id) ON DELETE SET NULL,
  evento_externo_id VARCHAR(200),
  provider VARCHAR(30) NOT NULL,
  model VARCHAR(120),
  status VARCHAR(20) NOT NULL,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  input_chars INTEGER NOT NULL DEFAULT 0,
  output_chars INTEGER NOT NULL DEFAULT 0,
  tool_calls SMALLINT NOT NULL DEFAULT 0,
  error_code VARCHAR(80),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_whatsapp_ai_provider_run_status CHECK (status IN ('success', 'failed', 'blocked', 'skipped')),
  CONSTRAINT chk_whatsapp_ai_provider_run_nonnegative CHECK (
    latency_ms >= 0 AND input_chars >= 0 AND output_chars >= 0 AND tool_calls >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_ai_provider_runs_scope
  ON whatsapp_ai_provider_runs (empresa_id, loja_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_ai_provider_runs_channel_status
  ON whatsapp_ai_provider_runs (canal_id, status, criado_em DESC);
