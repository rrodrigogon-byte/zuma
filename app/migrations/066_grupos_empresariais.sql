-- ============================================================================
-- MIGRAÇÃO 066: GRUPOS EMPRESARIAIS (HOLDINGS)
-- ============================================================================
-- Uma holding agrupa empresas (tenants) independentes. O grupo é só organização
-- e visão consolidada: catálogo, estoque, pedidos, pagamentos e clientes de cada
-- empresa continuam isolados por empresa_id. Nenhuma permissão é herdada do grupo.
--
-- CNPJ da holding é opcional (pode ser cadastrado depois). Empresas sem grupo
-- seguem funcionando exatamente como antes.
--
-- Semente: Silvester Holding, dona da Stallone Nutre Sport (CNPJ 56.099.531/0001-38).
-- A vinculação é idempotente e não altera empresas que já estejam em outro grupo.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS grupos_empresariais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  slug VARCHAR(80) NOT NULL,
  cnpj VARCHAR(14),
  razao_social VARCHAR(255),
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_grupos_empresariais_slug UNIQUE (slug),
  CONSTRAINT chk_grupos_empresariais_slug CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  CONSTRAINT chk_grupos_empresariais_cnpj CHECK (cnpj IS NULL OR cnpj ~ '^[0-9]{14}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_grupos_empresariais_cnpj
  ON grupos_empresariais (cnpj) WHERE cnpj IS NOT NULL;

ALTER TABLE empresas ADD COLUMN IF NOT EXISTS grupo_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'empresas'::regclass AND conname = 'fk_empresas_grupo_empresarial'
  ) THEN
    ALTER TABLE empresas
      ADD CONSTRAINT fk_empresas_grupo_empresarial
      FOREIGN KEY (grupo_id) REFERENCES grupos_empresariais(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_empresas_grupo_id ON empresas (grupo_id) WHERE grupo_id IS NOT NULL;

INSERT INTO grupos_empresariais (nome, slug)
VALUES ('Silvester Holding', 'silvester-holding')
ON CONFLICT (slug) DO NOTHING;

UPDATE empresas
   SET grupo_id = (SELECT id FROM grupos_empresariais WHERE slug = 'silvester-holding')
 WHERE cnpj = '56099531000138'
   AND grupo_id IS NULL;
