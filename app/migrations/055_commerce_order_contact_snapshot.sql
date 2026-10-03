-- Snapshot operacional do contato informado no checkout público.
-- Não substitui nem mescla commerce_customers: serve para pagamento, expedição e atendimento
-- quando e-mail e telefone apontam para cadastros diferentes.
ALTER TABLE commerce_orders
  ADD COLUMN IF NOT EXISTS customer_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN commerce_orders.customer_snapshot IS
  'Contato informado no checkout quando o pedido não pôde ser vinculado com segurança a um cliente existente; não concede identidade, crédito ou fidelidade.';
