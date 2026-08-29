-- Migration 030: compatibilidade do read model de pedidos e pagamentos.
--
-- Algumas bases antigas podem possuir a tabela criada antes de todos os campos
-- de leitura terem sido introduzidos. Esta migration só adiciona colunas ausentes
-- com valores neutros; não remove, reescreve ou exclui dados.

ALTER TABLE commerce_order_items
  ADD COLUMN IF NOT EXISTS sku_snapshot VARCHAR(100),
  ADD COLUMN IF NOT EXISTS nome_snapshot VARCHAR(300),
  ADD COLUMN IF NOT EXISTS quantidade INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS preco_unitario NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconto NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE commerce_payments
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS provider VARCHAR(60),
  ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE commerce_customers
  ADD COLUMN IF NOT EXISTS nome VARCHAR(240),
  ADD COLUMN IF NOT EXISTS email VARCHAR(320);

CREATE INDEX IF NOT EXISTS idx_commerce_payment_order_created
  ON commerce_payments (empresa_id, order_id, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_commerce_order_item_order_created
  ON commerce_order_items (empresa_id, order_id, criado_em ASC);
