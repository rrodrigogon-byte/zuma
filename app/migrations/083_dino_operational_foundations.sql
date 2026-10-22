-- Migration 083 — fundação operacional do Dino.
--
-- Somente estruturas novas: nenhum legado é backfillado e nenhuma tabela
-- histórica recebe loja_id. Os identificadores de empresa/loja permanecem
-- independentes de propósito: a base pode não expor uma tabela/coluna de
-- referência compatível em todos os ambientes de migração. O domínio deve
-- validar a existência e o escopo antes de gravar ou consumir cada registro.
-- As tabelas de ações, links e eventos são append-only por contrato de
-- aplicação; não há UPDATE automático nem trigger que reescreva evidência.

CREATE TABLE IF NOT EXISTS dino_effect_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  loja_id UUID NOT NULL,
  efeito VARCHAR(120) NOT NULL,
  idempotency_key VARCHAR(255) NOT NULL,
  fingerprint CHAR(64) NOT NULL,
  payload_sanitizado JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(24) NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  lease_token UUID,
  lease_until TIMESTAMPTZ,
  dead_letter BOOLEAN NOT NULL DEFAULT false,
  manual_required BOOLEAN NOT NULL DEFAULT false,
  erro TEXT,
  correlation_id VARCHAR(180),
  action_id UUID,
  financial_entry_id UUID,
  provider VARCHAR(80),
  provider_account_id VARCHAR(180),
  provider_event_id VARCHAR(180),
  provider_invoice_slug VARCHAR(180),
  provider_payment_id VARCHAR(180),
  provider_transaction_id VARCHAR(180),
  provider_nsu VARCHAR(180),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_dino_effect_outbox_idempotency
    UNIQUE (empresa_id, loja_id, idempotency_key),
  CONSTRAINT chk_dino_effect_outbox_payload_object
    CHECK (jsonb_typeof(payload_sanitizado) = 'object'),
  CONSTRAINT chk_dino_effect_outbox_status
    CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'cancelled')),
  CONSTRAINT chk_dino_effect_outbox_attempts
    CHECK (attempts >= 0),
  CONSTRAINT chk_dino_effect_outbox_fingerprint
    CHECK (length(btrim(fingerprint)) = 64 AND btrim(fingerprint) ~ '^[0-9a-fA-F]+$'),
  CONSTRAINT chk_dino_effect_outbox_lease_pair
    CHECK ((lease_token IS NULL AND lease_until IS NULL)
      OR (lease_token IS NOT NULL AND lease_until IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_dino_effect_outbox_dispatch
  ON dino_effect_outbox (empresa_id, loja_id, status, next_retry_at, criado_em);
CREATE INDEX IF NOT EXISTS idx_dino_effect_outbox_lease
  ON dino_effect_outbox (lease_until)
  WHERE lease_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dino_effect_outbox_correlation
  ON dino_effect_outbox (empresa_id, loja_id, correlation_id)
  WHERE correlation_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS dino_reversal_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  loja_id UUID NOT NULL,
  action_type VARCHAR(80) NOT NULL,
  idempotency_key VARCHAR(255) NOT NULL,
  fingerprint CHAR(64) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'requested',
  motivo TEXT NOT NULL,
  source_type VARCHAR(80),
  source_id VARCHAR(180),
  correlation_id VARCHAR(180),
  requested_by UUID,
  approved_by UUID,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_dino_reversal_action_idempotency
    UNIQUE (empresa_id, loja_id, idempotency_key),
  CONSTRAINT uq_dino_reversal_action_scope_id
    UNIQUE (empresa_id, loja_id, id),
  CONSTRAINT chk_dino_reversal_action_status
    CHECK (status IN ('requested', 'approved', 'executing', 'completed', 'failed', 'cancelled')),
  CONSTRAINT chk_dino_reversal_action_fingerprint
    CHECK (length(btrim(fingerprint)) = 64 AND btrim(fingerprint) ~ '^[0-9a-fA-F]+$')
);
CREATE INDEX IF NOT EXISTS idx_dino_reversal_actions_scope_status
  ON dino_reversal_actions (empresa_id, loja_id, status, criado_em DESC);

CREATE TABLE IF NOT EXISTS dino_reversal_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  loja_id UUID NOT NULL,
  action_id UUID NOT NULL,
  link_type VARCHAR(80) NOT NULL,
  subject_type VARCHAR(80) NOT NULL,
  subject_id VARCHAR(180) NOT NULL,
  amount NUMERIC(14,2),
  provider VARCHAR(80),
  provider_identifier VARCHAR(180),
  payload_sanitizado JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_dino_reversal_link_identity
    UNIQUE (empresa_id, loja_id, action_id, link_type, subject_type, subject_id),
  CONSTRAINT fk_dino_reversal_link_action
    FOREIGN KEY (empresa_id, loja_id, action_id)
    REFERENCES dino_reversal_actions (empresa_id, loja_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT chk_dino_reversal_link_amount
    CHECK (amount IS NULL OR amount >= 0),
  CONSTRAINT chk_dino_reversal_link_payload_object
    CHECK (jsonb_typeof(payload_sanitizado) = 'object')
);
CREATE INDEX IF NOT EXISTS idx_dino_reversal_links_action
  ON dino_reversal_links (empresa_id, loja_id, action_id, criado_em);

CREATE TABLE IF NOT EXISTS dino_inventory_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  loja_id UUID NOT NULL,
  reservation_key VARCHAR(255) NOT NULL,
  item_ref VARCHAR(180) NOT NULL,
  quantity NUMERIC(14,4) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'held',
  fingerprint CHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  correlation_id VARCHAR(180),
  payload_sanitizado JSONB NOT NULL DEFAULT '{}'::jsonb,
  confirmado_em TIMESTAMPTZ,
  liberado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_dino_inventory_reservation_key
    UNIQUE (empresa_id, loja_id, reservation_key),
  CONSTRAINT uq_dino_inventory_reservation_scope_id
    UNIQUE (empresa_id, loja_id, id),
  CONSTRAINT chk_dino_inventory_reservation_quantity
    CHECK (quantity > 0),
  CONSTRAINT chk_dino_inventory_reservation_status
    CHECK (status IN ('held', 'confirmed', 'consumed', 'released', 'expired', 'cancelled')),
  CONSTRAINT chk_dino_inventory_reservation_fingerprint
    CHECK (length(btrim(fingerprint)) = 64 AND btrim(fingerprint) ~ '^[0-9a-fA-F]+$'),
  CONSTRAINT chk_dino_inventory_reservation_payload_object
    CHECK (jsonb_typeof(payload_sanitizado) = 'object')
);
CREATE INDEX IF NOT EXISTS idx_dino_inventory_reservations_expiry
  ON dino_inventory_reservations (empresa_id, loja_id, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_dino_inventory_reservations_item
  ON dino_inventory_reservations (empresa_id, loja_id, item_ref, status);

CREATE TABLE IF NOT EXISTS dino_inventory_reservation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  loja_id UUID NOT NULL,
  reservation_id UUID NOT NULL,
  event_type VARCHAR(40) NOT NULL,
  status VARCHAR(24) NOT NULL,
  fingerprint CHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ,
  payload_sanitizado JSONB NOT NULL DEFAULT '{}'::jsonb,
  ocorrido_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_dino_inventory_reservation_event_fingerprint
    UNIQUE (empresa_id, loja_id, reservation_id, fingerprint),
  CONSTRAINT fk_dino_inventory_reservation_event_reservation
    FOREIGN KEY (empresa_id, loja_id, reservation_id)
    REFERENCES dino_inventory_reservations (empresa_id, loja_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT chk_dino_inventory_reservation_event_status
    CHECK (status IN ('held', 'confirmed', 'consumed', 'released', 'expired', 'cancelled')),
  CONSTRAINT chk_dino_inventory_reservation_event_fingerprint
    CHECK (length(btrim(fingerprint)) = 64 AND btrim(fingerprint) ~ '^[0-9a-fA-F]+$'),
  CONSTRAINT chk_dino_inventory_reservation_event_payload_object
    CHECK (jsonb_typeof(payload_sanitizado) = 'object')
);
CREATE INDEX IF NOT EXISTS idx_dino_inventory_reservation_events_ttl
  ON dino_inventory_reservation_events (empresa_id, loja_id, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_dino_inventory_reservation_events_reservation
  ON dino_inventory_reservation_events (empresa_id, loja_id, reservation_id, ocorrido_em);

CREATE TABLE IF NOT EXISTS dino_waitlist_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  loja_id UUID NOT NULL,
  waitlist_entry_id UUID NOT NULL,
  customer_id UUID,
  service_id UUID,
  professional_id UUID,
  slot_fingerprint CHAR(64) NOT NULL,
  idempotency_key VARCHAR(255) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'offered',
  hold_token UUID,
  expires_at TIMESTAMPTZ NOT NULL,
  correlation_id VARCHAR(180),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_dino_waitlist_offer_idempotency
    UNIQUE (empresa_id, loja_id, idempotency_key),
  CONSTRAINT uq_dino_waitlist_offer_scope_id
    UNIQUE (empresa_id, loja_id, id),
  CONSTRAINT chk_dino_waitlist_offer_status
    CHECK (status IN ('offered', 'held', 'accepted', 'expired', 'declined', 'cancelled')),
  CONSTRAINT chk_dino_waitlist_offer_slot_fingerprint
    CHECK (length(btrim(slot_fingerprint)) = 64 AND btrim(slot_fingerprint) ~ '^[0-9a-fA-F]+$'),
  CONSTRAINT chk_dino_waitlist_offer_hold_token
    CHECK (hold_token IS NULL OR status IN ('offered', 'held', 'accepted'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_dino_waitlist_offer_active_hold
  ON dino_waitlist_offers (empresa_id, loja_id, slot_fingerprint)
  WHERE status IN ('offered', 'held');
CREATE UNIQUE INDEX IF NOT EXISTS uq_dino_waitlist_offer_hold_token
  ON dino_waitlist_offers (empresa_id, loja_id, hold_token)
  WHERE hold_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dino_waitlist_offers_ttl_status
  ON dino_waitlist_offers (empresa_id, loja_id, status, expires_at);

CREATE TABLE IF NOT EXISTS dino_nps_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  loja_id UUID NOT NULL,
  agendamento_id UUID NOT NULL,
  nota SMALLINT NOT NULL,
  comentario TEXT,
  fingerprint CHAR(64),
  correlation_id VARCHAR(180),
  respondido_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_dino_nps_response_appointment
    UNIQUE (empresa_id, loja_id, agendamento_id),
  CONSTRAINT chk_dino_nps_response_score
    CHECK (nota BETWEEN 0 AND 10),
  CONSTRAINT chk_dino_nps_response_fingerprint
    CHECK (fingerprint IS NULL OR (length(btrim(fingerprint)) = 64 AND btrim(fingerprint) ~ '^[0-9a-fA-F]+$'))
);
CREATE INDEX IF NOT EXISTS idx_dino_nps_responses_scope_date
  ON dino_nps_responses (empresa_id, loja_id, respondido_em DESC);

CREATE TABLE IF NOT EXISTS dino_scope_quarantine (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID,
  loja_id UUID,
  legado_tipo VARCHAR(80) NOT NULL,
  legado_id VARCHAR(180) NOT NULL,
  origem VARCHAR(120) NOT NULL,
  motivo VARCHAR(240) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'quarantined',
  payload_restrito JSONB NOT NULL DEFAULT '{}'::jsonb,
  correlation_id VARCHAR(180),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_dino_scope_quarantine_legacy
    UNIQUE (origem, legado_tipo, legado_id),
  CONSTRAINT chk_dino_scope_quarantine_without_store
    CHECK (loja_id IS NULL),
  CONSTRAINT chk_dino_scope_quarantine_status
    CHECK (status IN ('quarantined', 'reviewing', 'resolved', 'rejected')),
  CONSTRAINT chk_dino_scope_quarantine_payload_object
    CHECK (jsonb_typeof(payload_restrito) = 'object')
);
CREATE INDEX IF NOT EXISTS idx_dino_scope_quarantine_review
  ON dino_scope_quarantine (empresa_id, status, criado_em);

CREATE TABLE IF NOT EXISTS dino_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(80) NOT NULL,
  provider_account_id VARCHAR(180) NOT NULL,
  provider_event_id VARCHAR(180) NOT NULL,
  event_hash CHAR(64) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'received',
  request_payload_sanitizado JSONB NOT NULL DEFAULT '{}'::jsonb,
  request_headers_sanitizados JSONB NOT NULL DEFAULT '{}'::jsonb,
  correlation_id VARCHAR(180),
  empresa_id UUID,
  loja_id UUID,
  erro TEXT,
  recebido_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processado_em TIMESTAMPTZ,
  CONSTRAINT uq_dino_webhook_event_dedup
    UNIQUE (provider, provider_account_id, provider_event_id, event_hash),
  CONSTRAINT chk_dino_webhook_event_hash
    CHECK (length(btrim(event_hash)) = 64 AND btrim(event_hash) ~ '^[0-9a-fA-F]+$'),
  CONSTRAINT chk_dino_webhook_event_status
    CHECK (status IN ('received', 'processing', 'processed', 'ignored', 'failed', 'quarantined')),
  CONSTRAINT chk_dino_webhook_event_request_payload
    CHECK (jsonb_typeof(request_payload_sanitizado) = 'object'),
  CONSTRAINT chk_dino_webhook_event_request_headers
    CHECK (jsonb_typeof(request_headers_sanitizados) = 'object'),
  CONSTRAINT chk_dino_webhook_event_store_scope
    CHECK (loja_id IS NULL OR empresa_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_dino_webhook_events_scope_status
  ON dino_webhook_events (empresa_id, loja_id, status, recebido_em DESC);
CREATE INDEX IF NOT EXISTS idx_dino_webhook_rate_limit
  ON dino_webhook_events (provider, provider_account_id, recebido_em DESC);
CREATE INDEX IF NOT EXISTS idx_dino_webhook_events_correlation
  ON dino_webhook_events (correlation_id)
  WHERE correlation_id IS NOT NULL;
