-- Reforma tributária (NT 2025.002): classificação do IBS/CBS por item (CST de 3 dígitos e cClassTrib de 6).
-- Sem valor = CST 000 / cClassTrib 000001 (tributação integral) no regime normal.
ALTER TABLE fis_classificacoes ADD COLUMN IF NOT EXISTS cst_ibscbs VARCHAR(3);
ALTER TABLE fis_classificacoes ADD COLUMN IF NOT EXISTS c_class_trib VARCHAR(6);
ALTER TABLE fis_classificacoes DROP CONSTRAINT IF EXISTS chk_fis_cls_ibscbs;
ALTER TABLE fis_classificacoes ADD CONSTRAINT chk_fis_cls_ibscbs CHECK (
  (cst_ibscbs IS NULL OR cst_ibscbs ~ '^[0-9]{3}$') AND (c_class_trib IS NULL OR c_class_trib ~ '^[0-9]{6}$')
  AND ((cst_ibscbs IS NULL) = (c_class_trib IS NULL))
);

-- SPED (EFD ICMS/IPI e EFD-Contribuições): dados do contador, perfil e códigos de receita por empresa
CREATE TABLE IF NOT EXISTS fis_sped_config (
  empresa_id UUID PRIMARY KEY,
  dados JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
