-- Pré-requisito estrutural da governança multi-negócio (118).
-- Cria o esquema de vendas e preserva todos os lançamentos existentes.

CREATE TABLE IF NOT EXISTS var_vendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  loja_id UUID,
  numero VARCHAR(60) NOT NULL,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  desconto NUMERIC(14,2) NOT NULL DEFAULT 0,
  troco NUMERIC(14,2) NOT NULL DEFAULT 0,
  forma_pagamento VARCHAR(40),
  nfce_chave VARCHAR(60),
  nfce_protocolo VARCHAR(40),
  status VARCHAR(30) DEFAULT 'paga',
  criado_por VARCHAR(180),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelada_em TIMESTAMPTZ,
  cancelada_por VARCHAR(180)
);

CREATE TABLE IF NOT EXISTS var_venda_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  venda_id UUID NOT NULL REFERENCES var_vendas(id) ON DELETE CASCADE,
  item_id UUID,
  quantidade NUMERIC(14,3) NOT NULL DEFAULT 1,
  preco_unitario NUMERIC(14,2) NOT NULL DEFAULT 0,
  preco_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  desconto NUMERIC(14,2) NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE var_vendas ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'paga';
ALTER TABLE var_vendas ADD COLUMN IF NOT EXISTS cancelada_em TIMESTAMPTZ;
ALTER TABLE var_vendas ADD COLUMN IF NOT EXISTS cancelada_por VARCHAR(180);
ALTER TABLE var_venda_itens ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_var_vendas_empresa_unidade_em
  ON var_vendas (empresa_id, loja_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_var_venda_itens_empresa_venda
  ON var_venda_itens (empresa_id, venda_id);
