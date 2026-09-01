-- MIGRATION 040: entrega própria sem dependência de origem logística externa
-- A cotação manual pode usar cidade, UF, faixa de CEP ou distância configurada
-- pelo tenant; por isso origem_cep não é obrigatória para o provider manual.

ALTER TABLE commerce_shipping_quotes
  ALTER COLUMN origem_cep DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_commerce_shipping_method_manual_type
  ON commerce_shipping_methods (empresa_id, storefront_id, tipo, ativo);
