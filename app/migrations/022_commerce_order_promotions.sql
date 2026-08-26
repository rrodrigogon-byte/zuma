/* MIGRAÇÃO 022: vínculo de promoções aplicadas em pedidos */
CREATE TABLE IF NOT EXISTS commerce_order_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  order_id UUID NOT NULL,
  promotion_id UUID NOT NULL,
  promotion_code_id UUID,
  codigo VARCHAR(80) NOT NULL,
  tipo VARCHAR(30) NOT NULL,
  valor_base NUMERIC(14,2) NOT NULL,
  desconto NUMERIC(14,2) NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_commerce_order_promotion UNIQUE (empresa_id, order_id),
  CONSTRAINT fk_commerce_order_promotion_order FOREIGN KEY (empresa_id, order_id)
    REFERENCES commerce_orders (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_commerce_order_promotion_promotion FOREIGN KEY (empresa_id, promotion_id)
    REFERENCES commerce_promotions (empresa_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_commerce_order_promotion_code FOREIGN KEY (empresa_id, promotion_code_id)
    REFERENCES commerce_promotion_codes (empresa_id, id) ON DELETE RESTRICT,
  CONSTRAINT chk_commerce_order_promotion_values CHECK (valor_base >= 0 AND desconto >= 0 AND desconto <= valor_base)
);
CREATE INDEX IF NOT EXISTS idx_commerce_order_promotion_promotion
  ON commerce_order_promotions (empresa_id, promotion_id, criado_em DESC);
