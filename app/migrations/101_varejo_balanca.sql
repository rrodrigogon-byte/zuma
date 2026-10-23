-- 101 — Supermercado: leitura da etiqueta da balança (EAN-13 de peso/preço) e exportação de PLU.
-- Cada empresa diz como a balança monta o código: prefixo, dígitos do PLU, dígitos do valor e
-- se o valor é o preço total (centavos) ou o peso (gramas).
CREATE TABLE IF NOT EXISTS var_balanca_config (
  empresa_id UUID PRIMARY KEY REFERENCES empresas(id) ON DELETE CASCADE,
  prefixo VARCHAR(2) NOT NULL DEFAULT '2',
  digitos_plu INTEGER NOT NULL DEFAULT 4,
  digitos_valor INTEGER NOT NULL DEFAULT 6,
  tipo_valor VARCHAR(10) NOT NULL DEFAULT 'preco',
  validade_dias INTEGER,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_var_bal_plu CHECK (digitos_plu BETWEEN 4 AND 6),
  CONSTRAINT chk_var_bal_valor CHECK (digitos_valor BETWEEN 4 AND 6),
  CONSTRAINT chk_var_bal_tipo CHECK (tipo_valor IN ('preco', 'peso')),
  CONSTRAINT chk_var_bal_prefixo CHECK (prefixo ~ '^2[0-9]?$'),
  CONSTRAINT chk_var_bal_tamanho CHECK (length(prefixo) + digitos_plu + digitos_valor <= 12)
);
