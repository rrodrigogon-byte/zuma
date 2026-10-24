-- Cópia reconciliável do histórico legado. Não muda a fonte de leitura e não
-- cria lançamentos financeiros, comandas operacionais ou movimentos de estoque.
CREATE TABLE IF NOT EXISTS kytto_barbershop_history_archive (
  empresa_id text NOT NULL,
  loja_id text NOT NULL,
  collection text NOT NULL CHECK (collection IN ('historicoAtendimentos', 'historicoComandas')),
  source_id text NOT NULL,
  source_key text,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  document jsonb NOT NULL CHECK (jsonb_typeof(document) = 'object'),
  archived_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (empresa_id, loja_id, collection, source_id),
  CHECK (document ? 'id' AND document->>'id' = source_id),
  CHECK (document ? 'empresaId' AND document->>'empresaId' = empresa_id),
  CHECK (document ? 'lojaId' AND document->>'lojaId' = loja_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS kytto_history_archive_source_key_uq
  ON kytto_barbershop_history_archive (empresa_id, loja_id, collection, source_key)
  WHERE source_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS kytto_history_archive_customer_idx
  ON kytto_barbershop_history_archive (empresa_id, loja_id, collection, (document->>'clienteId'));
CREATE INDEX IF NOT EXISTS kytto_history_archive_day_idx
  ON kytto_barbershop_history_archive (empresa_id, loja_id, collection, (document->>'dataAgenda'));
