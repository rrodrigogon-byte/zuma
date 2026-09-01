-- MIGRATION 041: crediário vinculado ao cliente Commerce
-- Cada conta pertence a uma empresa, storefront e cliente; nenhuma conta é
-- compartilhada entre tenants ou canais por acidente.

ALTER TABLE commerce_payments
  DROP CONSTRAINT IF EXISTS chk_commerce_payment_method;

ALTER TABLE commerce_payments
  ADD CONSTRAINT chk_commerce_payment_method
  CHECK (method IN ('pix','credit_card','debit_card','boleto','cash','external','account'));

CREATE TABLE IF NOT EXISTS commerce_customer_credit_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  storefront_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  limite_credito NUMERIC(14,2) NOT NULL DEFAULT 0,
  saldo_devedor NUMERIC(14,2) NOT NULL DEFAULT 0,
  prazo_dias INTEGER NOT NULL DEFAULT 30,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  observacoes VARCHAR(1000),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_commerce_credit_account_empresa_id UNIQUE (empresa_id, id),
  CONSTRAINT uq_commerce_credit_account_customer UNIQUE (empresa_id, storefront_id, customer_id),
  CONSTRAINT fk_commerce_credit_account_storefront FOREIGN KEY (empresa_id, storefront_id)
    REFERENCES commerce_storefronts (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_commerce_credit_account_customer FOREIGN KEY (empresa_id, customer_id)
    REFERENCES commerce_customers (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT chk_commerce_credit_account_values CHECK (limite_credito >= 0 AND saldo_devedor >= 0 AND saldo_devedor <= limite_credito),
  CONSTRAINT chk_commerce_credit_account_due_days CHECK (prazo_dias BETWEEN 1 AND 365),
  CONSTRAINT chk_commerce_credit_account_status CHECK (status IN ('active','blocked','closed'))
);

CREATE INDEX IF NOT EXISTS idx_commerce_credit_account_scope
  ON commerce_customer_credit_accounts (empresa_id, storefront_id, status);

CREATE TABLE IF NOT EXISTS commerce_customer_credit_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  account_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  storefront_id UUID NOT NULL,
  order_id UUID,
  tipo VARCHAR(20) NOT NULL,
  valor NUMERIC(14,2) NOT NULL,
  vencimento_em DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  descricao VARCHAR(500),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_commerce_credit_entry_empresa_id UNIQUE (empresa_id, id),
  CONSTRAINT fk_commerce_credit_entry_account FOREIGN KEY (empresa_id, account_id)
    REFERENCES commerce_customer_credit_accounts (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_commerce_credit_entry_customer FOREIGN KEY (empresa_id, customer_id)
    REFERENCES commerce_customers (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_commerce_credit_entry_storefront FOREIGN KEY (empresa_id, storefront_id)
    REFERENCES commerce_storefronts (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_commerce_credit_entry_order FOREIGN KEY (empresa_id, order_id)
    REFERENCES commerce_orders (empresa_id, id) ON DELETE SET NULL,
  CONSTRAINT chk_commerce_credit_entry_type CHECK (tipo IN ('charge','payment','adjustment')),
  CONSTRAINT chk_commerce_credit_entry_status CHECK (status IN ('open','paid','cancelled')),
  CONSTRAINT chk_commerce_credit_entry_value CHECK (valor > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_credit_charge_order
  ON commerce_customer_credit_entries (empresa_id, order_id)
  WHERE tipo = 'charge' AND order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_commerce_credit_entry_account
  ON commerce_customer_credit_entries (empresa_id, account_id, status, vencimento_em);
