-- Escopo por unidade para limites e idempotência das automações.
-- Logs históricos não têm unidade recuperável e permanecem com loja_id NULL; não fazer backfill por telefone.
ALTER TABLE ai_automation_log
  ADD COLUMN IF NOT EXISTS loja_id UUID;

-- A PK `lojas(id)` não satisfaz uma FK composta; o índice é válido porque id já é globalmente único.
CREATE UNIQUE INDEX IF NOT EXISTS uq_lojas_empresa_id_id
  ON lojas (empresa_id, id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'fk_ai_automation_log_loja_empresa'
       AND conrelid = 'ai_automation_log'::regclass
  ) THEN
    ALTER TABLE ai_automation_log
      ADD CONSTRAINT fk_ai_automation_log_loja_empresa
      FOREIGN KEY (empresa_id, loja_id)
      REFERENCES lojas (empresa_id, id)
      ON DELETE CASCADE;
  END IF;
END
$$;

ALTER TABLE ai_automation_log
  DROP CONSTRAINT IF EXISTS uq_ai_automation_ref;

-- Novos eventos são idempotentes por empresa+loja; opt-outs/histórico NULL preservam chave antiga.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_automation_ref_scoped
  ON ai_automation_log (empresa_id, loja_id, automacao, telefone, referencia)
  WHERE loja_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_automation_ref_unassigned
  ON ai_automation_log (empresa_id, automacao, telefone, referencia)
  WHERE loja_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_ai_automation_store_client_time
  ON ai_automation_log (empresa_id, loja_id, telefone, criado_em DESC)
  WHERE loja_id IS NOT NULL;

COMMENT ON COLUMN ai_automation_log.loja_id IS
  'Unidade do evento de automação; NULL apenas para histórico antigo não atribuível e bloqueios globais de opt-out.';
