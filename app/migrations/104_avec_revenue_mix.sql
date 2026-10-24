-- Snapshot analítico apenas: não gera recebimentos, comandas ou estoque.
CREATE TABLE IF NOT EXISTS kytto_avec_revenue_mix_versions (
  empresa_id text NOT NULL,
  loja_id text NOT NULL,
  report_hash text NOT NULL CHECK (report_hash ~ '^[a-f0-9]{64}$'),
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (empresa_id, loja_id, report_hash),
  CHECK (payload->>'reportHash' = report_hash)
);
CREATE TABLE IF NOT EXISTS kytto_avec_revenue_mix (
  empresa_id text NOT NULL,
  loja_id text NOT NULL,
  report_hash text NOT NULL,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (empresa_id, loja_id),
  FOREIGN KEY (empresa_id, loja_id, report_hash) REFERENCES kytto_avec_revenue_mix_versions (empresa_id, loja_id, report_hash),
  CHECK (payload->>'reportHash' = report_hash)
);
