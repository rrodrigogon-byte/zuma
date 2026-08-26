/*
 * MIGRAÇÃO 020: CONTROLE DE IMPORTAÇÃO DO LEGADO
 *
 * Não cria dados de demonstração. Registra somente correspondências entre
 * identificadores do JSON legado e entidades efetivamente importadas para o
 * Commerce Core, permitindo dry-run, retry e auditoria sem duplicação.
 */
CREATE TABLE IF NOT EXISTS commerce_legacy_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID,
  source VARCHAR(80) NOT NULL,
  entity VARCHAR(80) NOT NULL,
  legacy_key VARCHAR(180) NOT NULL,
  target_id UUID NOT NULL,
  payload_hash VARCHAR(128) NOT NULL,
  imported_by UUID,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT uq_commerce_legacy_import UNIQUE (empresa_id, source, entity, legacy_key),
  CONSTRAINT fk_commerce_legacy_import_loja FOREIGN KEY (empresa_id, loja_id)
    REFERENCES lojas (empresa_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_commerce_legacy_import_usuario FOREIGN KEY (empresa_id, imported_by)
    REFERENCES usuarios (empresa_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_commerce_legacy_import_target
  ON commerce_legacy_imports (empresa_id, entity, target_id);
CREATE INDEX IF NOT EXISTS idx_commerce_legacy_import_source
  ON commerce_legacy_imports (empresa_id, source, imported_at DESC);
