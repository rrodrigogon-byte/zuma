-- Cache permanente de CEPs confirmados (dado público, compartilhado por todas as empresas).
-- Todo CEP validado por alguma fonte externa fica guardado aqui e continua respondendo
-- quando ViaCEP, OpenCEP, BrasilAPI ou AwesomeAPI estiverem fora do ar.
CREATE TABLE IF NOT EXISTS commerce_postal_codes (
  cep CHAR(8) PRIMARY KEY,
  logradouro VARCHAR(240),
  complemento VARCHAR(120),
  bairro VARCHAR(120),
  cidade VARCHAR(120) NOT NULL,
  estado CHAR(2) NOT NULL,
  ibge VARCHAR(20),
  fonte VARCHAR(40) NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_commerce_postal_code_cep CHECK (cep ~ '^[0-9]{8}$'),
  CONSTRAINT chk_commerce_postal_code_estado CHECK (estado ~ '^[A-Z]{2}$')
);

CREATE INDEX IF NOT EXISTS idx_commerce_postal_codes_cidade
  ON commerce_postal_codes (estado, cidade);
