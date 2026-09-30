-- Identidade transacional canônica do comprador Commerce.
-- Migration estritamente aditiva: não mescla nem remove clientes existentes.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE commerce_customers
  ADD COLUMN IF NOT EXISTS email_normalizado VARCHAR(320)
  GENERATED ALWAYS AS (NULLIF(lower(btrim(email)), '')) STORED;

ALTER TABLE commerce_customers
  ADD COLUMN IF NOT EXISTS telefone_normalizado VARCHAR(13)
  GENERATED ALWAYS AS (
    CASE
      WHEN regexp_replace(COALESCE(telefone, ''), '[^0-9]+', '', 'g') ~ '^[1-9][0-9]{9,10}$'
        THEN '55' || regexp_replace(telefone, '[^0-9]+', '', 'g')
      WHEN regexp_replace(COALESCE(telefone, ''), '[^0-9]+', '', 'g') ~ '^55[1-9][0-9]{9,10}$'
        THEN regexp_replace(telefone, '[^0-9]+', '', 'g')
      ELSE NULL
    END
  ) STORED;

-- Dados antigos podem ter clientes com o mesmo e-mail ou telefone normalizado. A migration
-- não mescla nem apaga clientes: registra os grupos em conflito para revisão manual e só cria
-- o índice único correspondente quando não há conflito (a resolução de identidade no app já
-- serializa por advisory lock). Antes, o conflito abortava o deploy inteiro.
CREATE TABLE IF NOT EXISTS commerce_customer_identity_review (
  id BIGSERIAL PRIMARY KEY,
  empresa_id UUID NOT NULL,
  tipo VARCHAR(40) NOT NULL,
  chave TEXT NOT NULL,
  registros UUID[] NOT NULL,
  detectado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolvido_em TIMESTAMPTZ,
  CONSTRAINT uq_commerce_customer_identity_review UNIQUE (empresa_id, tipo, chave)
);

DO $$
DECLARE
  email_conflicts INTEGER;
  phone_conflicts INTEGER;
BEGIN
  INSERT INTO commerce_customer_identity_review (empresa_id, tipo, chave, registros)
  SELECT empresa_id, 'email', email_normalizado, array_agg(id ORDER BY criado_em, id)
    FROM commerce_customers
   WHERE email_normalizado IS NOT NULL
   GROUP BY empresa_id, email_normalizado HAVING COUNT(*) > 1
  ON CONFLICT (empresa_id, tipo, chave) DO UPDATE SET registros = EXCLUDED.registros, resolvido_em = NULL;
  GET DIAGNOSTICS email_conflicts = ROW_COUNT;

  INSERT INTO commerce_customer_identity_review (empresa_id, tipo, chave, registros)
  SELECT empresa_id, 'telefone', telefone_normalizado, array_agg(id ORDER BY criado_em, id)
    FROM commerce_customers
   WHERE telefone_normalizado IS NOT NULL
   GROUP BY empresa_id, telefone_normalizado HAVING COUNT(*) > 1
  ON CONFLICT (empresa_id, tipo, chave) DO UPDATE SET registros = EXCLUDED.registros, resolvido_em = NULL;
  GET DIAGNOSTICS phone_conflicts = ROW_COUNT;

  IF email_conflicts > 0 THEN
    RAISE NOTICE 'CUSTOMER_IDENTITY_PREFLIGHT_EMAIL_CONFLICT: % grupo(s) de e-mail duplicado registrados em commerce_customer_identity_review (duplicate normalized customer emails require manual review); índice único de e-mail não criado', email_conflicts;
  ELSE
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_customer_email_normalizado
      ON commerce_customers (empresa_id, email_normalizado)
      WHERE email_normalizado IS NOT NULL';
  END IF;

  IF phone_conflicts > 0 THEN
    RAISE NOTICE 'CUSTOMER_IDENTITY_PREFLIGHT_PHONE_CONFLICT: % grupo(s) de telefone duplicado registrados em commerce_customer_identity_review (duplicate normalized customer phones require manual review); índice único de telefone não criado', phone_conflicts;
  ELSE
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_customer_telefone_normalizado
      ON commerce_customers (empresa_id, telefone_normalizado)
      WHERE telefone_normalizado IS NOT NULL';
  END IF;
END $$;

ALTER TABLE commerce_customer_addresses
  ADD COLUMN IF NOT EXISTS endereco_fingerprint CHAR(64)
  GENERATED ALWAYS AS (
    encode(
      digest(
        lower(regexp_replace(btrim(COALESCE(cep, '')), '[^0-9]+', '', 'g')) || '|' ||
        lower(regexp_replace(btrim(COALESCE(logradouro, '')), '[[:space:]]+', ' ', 'g')) || '|' ||
        lower(regexp_replace(btrim(COALESCE(numero, '')), '[[:space:]]+', ' ', 'g')) || '|' ||
        lower(regexp_replace(btrim(COALESCE(complemento, '')), '[[:space:]]+', ' ', 'g')) || '|' ||
        lower(regexp_replace(btrim(COALESCE(bairro, '')), '[[:space:]]+', ' ', 'g')) || '|' ||
        lower(regexp_replace(btrim(COALESCE(cidade, '')), '[[:space:]]+', ' ', 'g')) || '|' ||
        lower(btrim(COALESCE(estado, ''))),
        'sha256'
      ),
      'hex'
    )
  ) STORED;

DO $$
DECLARE
  address_conflicts INTEGER;
  default_conflicts INTEGER;
BEGIN
  INSERT INTO commerce_customer_identity_review (empresa_id, tipo, chave, registros)
  SELECT empresa_id, 'endereco', customer_id::text || ':' || endereco_fingerprint, array_agg(id ORDER BY id)
    FROM commerce_customer_addresses
   GROUP BY empresa_id, customer_id, endereco_fingerprint HAVING COUNT(*) > 1
  ON CONFLICT (empresa_id, tipo, chave) DO UPDATE SET registros = EXCLUDED.registros, resolvido_em = NULL;
  GET DIAGNOSTICS address_conflicts = ROW_COUNT;

  INSERT INTO commerce_customer_identity_review (empresa_id, tipo, chave, registros)
  SELECT empresa_id, 'endereco_padrao', customer_id::text, array_agg(id ORDER BY id)
    FROM commerce_customer_addresses
   WHERE padrao = true
   GROUP BY empresa_id, customer_id HAVING COUNT(*) > 1
  ON CONFLICT (empresa_id, tipo, chave) DO UPDATE SET registros = EXCLUDED.registros, resolvido_em = NULL;
  GET DIAGNOSTICS default_conflicts = ROW_COUNT;

  IF address_conflicts > 0 THEN
    RAISE NOTICE 'CUSTOMER_IDENTITY_PREFLIGHT_ADDRESS_CONFLICT: % grupo(s) de endereço duplicado para revisão; índice único não criado', address_conflicts;
  ELSE
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_customer_address_fingerprint
      ON commerce_customer_addresses (empresa_id, customer_id, endereco_fingerprint)';
  END IF;

  IF default_conflicts > 0 THEN
    RAISE NOTICE 'CUSTOMER_IDENTITY_PREFLIGHT_DEFAULT_ADDRESS_CONFLICT: % cliente(s) com mais de um endereço padrão para revisão; índice único não criado', default_conflicts;
  ELSE
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_customer_default_address
      ON commerce_customer_addresses (empresa_id, customer_id)
      WHERE padrao = true';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_commerce_customer_email_normalizado
  ON commerce_customers (email_normalizado)
  WHERE email_normalizado IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_commerce_customer_telefone_normalizado
  ON commerce_customers (telefone_normalizado)
  WHERE telefone_normalizado IS NOT NULL;

COMMENT ON COLUMN commerce_customers.email_normalizado IS
  'E-mail canônico gerado do campo original; identidade é única somente dentro do tenant.';
COMMENT ON COLUMN commerce_customers.telefone_normalizado IS
  'Telefone brasileiro canônico em E.164 sem sinal +; identidade é única somente dentro do tenant.';
COMMENT ON COLUMN commerce_customer_addresses.endereco_fingerprint IS
  'SHA-256 gerado somente dos componentes postais normalizados para deduplicação por cliente/tenant.';
