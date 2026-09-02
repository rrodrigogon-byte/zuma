-- Consent-aware customer profile and conversational opportunity guardrails.
-- Additive and inert: it does not enable Gemini, Evolution, channels, webhooks,
-- personalization, opportunities or outbound messages.

ALTER TABLE whatsapp_ai_sessions
  ADD COLUMN IF NOT EXISTS personalization_prompted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS opportunity_offered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS opportunity_declined_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS opportunity_count SMALLINT NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_whatsapp_ai_opportunity_count'
  ) THEN
    ALTER TABLE whatsapp_ai_sessions
      ADD CONSTRAINT chk_whatsapp_ai_opportunity_count
      CHECK (opportunity_count BETWEEN 0 AND 10);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS whatsapp_ai_policy_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  canal_id UUID NOT NULL REFERENCES canais_integracao(id) ON DELETE CASCADE,
  sessao_id UUID REFERENCES whatsapp_ai_sessions(id) ON DELETE SET NULL,
  event_key VARCHAR(180),
  tipo VARCHAR(50) NOT NULL,
  reason_code VARCHAR(80),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_whatsapp_ai_policy_event_type CHECK (tipo IN (
    'profile_resolved',
    'profile_ambiguous',
    'personalization_prompted',
    'personalization_granted',
    'personalization_revoked',
    'opportunity_allowed',
    'opportunity_blocked',
    'opportunity_offered',
    'opportunity_declined',
    'output_blocked',
    'injection_suspected',
    'sensitive_input_blocked'
  ))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_whatsapp_ai_policy_event_key
  ON whatsapp_ai_policy_events (empresa_id, event_key)
  WHERE event_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_whatsapp_ai_policy_events_scope
  ON whatsapp_ai_policy_events (empresa_id, loja_id, tipo, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_ai_policy_events_session
  ON whatsapp_ai_policy_events (sessao_id, criado_em DESC)
  WHERE sessao_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_eventos_integracao_channel_received
  ON eventos_integracao_canais (canal_id, recebido_em DESC);
