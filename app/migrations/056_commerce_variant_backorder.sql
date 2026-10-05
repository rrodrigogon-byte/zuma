-- Permite publicar uma variante sem saldo para venda sob encomenda.
-- A reserva de estoque continua sendo criada apenas quando houver saldo disponível.
ALTER TABLE commerce_product_variants
  ADD COLUMN IF NOT EXISTS permite_compra_sem_estoque BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN commerce_product_variants.permite_compra_sem_estoque IS
  'Permite checkout quando o saldo disponível está em zero; o prazo de entrega recebe 10 dias úteis adicionais.';
