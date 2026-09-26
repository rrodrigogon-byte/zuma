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

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM commerce_customers
     WHERE email_normalizado IS NOT NULL
     GROUP BY empresa_id, email_normalizado HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'CUSTOMER_IDENTITY_PREFLIGHT_EMAIL_CONFLICT: duplicate normalized customer emails require manual review'
      USING ERRCODE = '23505';
  END IF;
  IF EXISTS (
    SELECT 1 FROM commerce_customers
     WHERE telefone_normalizado IS NOT NULL
     GROUP BY empresa_id, telefone_normalizado HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'CUSTOMER_IDENTITY_PREFLIGHT_PHONE_CONFLICT: duplicate normalized customer phones require manual review'
      USING ERRCODE = '23505';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_customer_email_normalizado
  ON commerce_customers (empresa_id, email_normalizado)
  WHERE email_normalizado IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_customer_telefone_normalizado
  ON commerce_customers (empresa_id, telefone_normalizado)
  WHERE telefone_normalizado IS NOT NULL;

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
BEGIN
  IF EXISTS (
    SELECT 1 FROM commerce_customer_addresses
     GROUP BY empresa_id, customer_id, endereco_fingerprint HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'CUSTOMER_IDENTITY_PREFLIGHT_ADDRESS_CONFLICT: duplicate customer address fingerprints require manual review'
      USING ERRCODE = '23505';
  END IF;
  IF EXISTS (
    SELECT 1 FROM commerce_customer_addresses
     WHERE padrao = true
     GROUP BY empresa_id, customer_id HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'CUSTOMER_IDENTITY_PREFLIGHT_DEFAULT_ADDRESS_CONFLICT: multiple default customer addresses require manual review'
      USING ERRCODE = '23505';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_customer_address_fingerprint
  ON commerce_customer_addresses (empresa_id, customer_id, endereco_fingerprint);

CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_customer_default_address
  ON commerce_customer_addresses (empresa_id, customer_id)
  WHERE padrao = true;

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
