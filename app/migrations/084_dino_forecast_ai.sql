-- Histórico auditável da interpretação de projeção por IA.
-- Os valores numéricos continuam no snapshot determinístico; o modelo só produz
-- explicação, classificação de risco e recomendações não executáveis.
CREATE TABLE IF NOT EXISTS dino_forecast_ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL,
  competencia DATE NOT NULL,
  fingerprint CHAR(64) NOT NULL,
  prompt_version VARCHAR(40) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'pending',
  source VARCHAR(24) NOT NULL DEFAULT 'deterministic',
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC(5,4),
  provider VARCHAR(40),
  model VARCHAR(120),
  erro_codigo VARCHAR(80),
  erro TEXT,
  gerado_em TIMESTAMPTZ,
  expira_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_dino_forecast_ai_insight_store FOREIGN KEY (empresa_id, loja_id)
    REFERENCES lojas (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT uq_dino_forecast_ai_snapshot UNIQUE (empresa_id, loja_id, competencia, fingerprint),
  CONSTRAINT chk_dino_forecast_ai_status CHECK (status IN ('pending', 'ready', 'fallback', 'failed')),
  CONSTRAINT chk_dino_forecast_ai_source CHECK (source IN ('ai', 'deterministic')),
  CONSTRAINT chk_dino_forecast_ai_snapshot_object CHECK (jsonb_typeof(snapshot) = 'object'),
  CONSTRAINT chk_dino_forecast_ai_analysis_object CHECK (jsonb_typeof(analysis) = 'object'),
  CONSTRAINT chk_dino_forecast_ai_confidence CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  CONSTRAINT chk_dino_forecast_ai_fingerprint CHECK (btrim(fingerprint) ~ '^[0-9a-fA-F]{64}$')
);

CREATE INDEX IF NOT EXISTS idx_dino_forecast_ai_latest
  ON dino_forecast_ai_insights (empresa_id, loja_id, competencia DESC, atualizado_em DESC);
CREATE INDEX IF NOT EXISTS idx_dino_forecast_ai_status
  ON dino_forecast_ai_insights (status, expira_em);

CREATE TABLE IF NOT EXISTS dino_forecast_ai_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL,
  competencia DATE NOT NULL,
  insight_id UUID REFERENCES dino_forecast_ai_insights(id) ON DELETE SET NULL,
  alert_key VARCHAR(120) NOT NULL,
  tipo VARCHAR(32) NOT NULL,
  severidade VARCHAR(16) NOT NULL DEFAULT 'normal',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  titulo VARCHAR(240) NOT NULL,
  mensagem TEXT NOT NULL,
  metricas JSONB NOT NULL DEFAULT '{}'::jsonb,
  primeiro_sinal_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimo_sinal_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reconhecido_em TIMESTAMPTZ,
  reconhecido_por UUID,
  resolvido_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_dino_forecast_ai_alert_store FOREIGN KEY (empresa_id, loja_id)
    REFERENCES lojas (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT uq_dino_forecast_ai_alert UNIQUE (empresa_id, loja_id, competencia, alert_key),
  CONSTRAINT chk_dino_forecast_ai_alert_type CHECK (tipo IN ('risco', 'oportunidade', 'agenda', 'revenda', 'capacidade', 'profissional', 'meta')),
  CONSTRAINT chk_dino_forecast_ai_alert_severity CHECK (severidade IN ('info', 'normal', 'alta', 'critica')),
  CONSTRAINT chk_dino_forecast_ai_alert_status CHECK (status IN ('active', 'acknowledged', 'resolved')),
  CONSTRAINT chk_dino_forecast_ai_alert_metrics_object CHECK (jsonb_typeof(metricas) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_dino_forecast_ai_alerts_active
  ON dino_forecast_ai_alerts (empresa_id, loja_id, status, severidade, ultimo_sinal_em DESC);
