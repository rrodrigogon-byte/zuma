-- 096 — Varejo/supermercado sobre o estoque único (091), por unidade (onda 5):
-- preço de venda por unidade, lotes e validade, promoções com período, etiquetas de gôndola e
-- transferências entre unidades com trânsito (sai na origem ao enviar, entra no destino ao receber).

ALTER TABLE est_itens ADD COLUMN IF NOT EXISTS preco_venda NUMERIC(14,2);
ALTER TABLE est_itens ADD COLUMN IF NOT EXISTS departamento VARCHAR(80);
ALTER TABLE est_itens ADD COLUMN IF NOT EXISTS plu VARCHAR(10);
ALTER TABLE est_itens ADD COLUMN IF NOT EXISTS pesavel BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE est_itens ADD COLUMN IF NOT EXISTS controla_lote BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS var_precos_unidade (
  empresa_id UUID NOT NULL,
  loja_id UUID NOT NULL,
  item_id UUID NOT NULL,
  preco_venda NUMERIC(14,2) NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (empresa_id, loja_id, item_id),
  CONSTRAINT fk_var_preco_item FOREIGN KEY (empresa_id, item_id) REFERENCES est_itens (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT chk_var_preco CHECK (preco_venda >= 0)
);

CREATE TABLE IF NOT EXISTS est_lotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  loja_id UUID,
  item_id UUID NOT NULL,
  lote VARCHAR(60) NOT NULL,
  validade DATE,
  quantidade NUMERIC(14,3) NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (empresa_id, id),
  CONSTRAINT fk_est_lote_item FOREIGN KEY (empresa_id, item_id) REFERENCES est_itens (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT chk_est_lote_qtd CHECK (quantidade >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_est_lote ON est_lotes (empresa_id, COALESCE(loja_id, '00000000-0000-0000-0000-000000000000'::uuid), item_id, lote);
CREATE INDEX IF NOT EXISTS idx_est_lote_validade ON est_lotes (empresa_id, validade) WHERE quantidade > 0;

CREATE TABLE IF NOT EXISTS var_promocoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID,
  nome VARCHAR(120) NOT NULL,
  tipo VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'rascunho',
  percentual NUMERIC(5,2),
  valor_desconto NUMERIC(14,2),
  preco_fixo NUMERIC(14,2),
  leve INTEGER,
  pague INTEGER,
  inicio TIMESTAMPTZ NOT NULL,
  fim TIMESTAMPTZ NOT NULL,
  criado_por VARCHAR(180),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (empresa_id, id),
  CONSTRAINT chk_var_promo_tipo CHECK (tipo IN ('percentual', 'valor_fixo', 'preco_fixo', 'leve_pague')),
  CONSTRAINT chk_var_promo_status CHECK (status IN ('rascunho', 'ativa', 'pausada', 'encerrada')),
  CONSTRAINT chk_var_promo_periodo CHECK (fim > inicio),
  CONSTRAINT chk_var_promo_valores CHECK (
    (tipo = 'percentual' AND percentual > 0 AND percentual < 100) OR
    (tipo = 'valor_fixo' AND valor_desconto > 0) OR
    (tipo = 'preco_fixo' AND preco_fixo >= 0) OR
    (tipo = 'leve_pague' AND leve > pague AND pague >= 1))
);
CREATE TABLE IF NOT EXISTS var_promocao_itens (
  empresa_id UUID NOT NULL,
  promocao_id UUID NOT NULL,
  item_id UUID NOT NULL,
  PRIMARY KEY (empresa_id, promocao_id, item_id),
  CONSTRAINT fk_var_pi_promo FOREIGN KEY (empresa_id, promocao_id) REFERENCES var_promocoes (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_var_pi_item FOREIGN KEY (empresa_id, item_id) REFERENCES est_itens (empresa_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS var_etiquetas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  loja_id UUID,
  item_id UUID NOT NULL,
  quantidade INTEGER NOT NULL,
  formato VARCHAR(30) NOT NULL,
  preco_exibido NUMERIC(14,2) NOT NULL,
  texto_promocao VARCHAR(120),
  status VARCHAR(20) NOT NULL DEFAULT 'gerada',
  criado_por VARCHAR(180),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_var_etq_item FOREIGN KEY (empresa_id, item_id) REFERENCES est_itens (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT chk_var_etq_qtd CHECK (quantidade BETWEEN 1 AND 500),
  CONSTRAINT chk_var_etq_status CHECK (status IN ('gerada', 'impressa', 'descartada'))
);

CREATE TABLE IF NOT EXISTS var_transferencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  loja_origem_id UUID NOT NULL,
  loja_destino_id UUID NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'rascunho',
  observacao VARCHAR(500),
  criado_por VARCHAR(180),
  enviado_em TIMESTAMPTZ,
  recebido_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (empresa_id, id),
  CONSTRAINT uq_var_transf_numero UNIQUE (empresa_id, numero),
  CONSTRAINT chk_var_transf_lojas CHECK (loja_origem_id <> loja_destino_id),
  CONSTRAINT chk_var_transf_status CHECK (status IN ('rascunho', 'em_transito', 'recebida', 'recebida_parcial', 'cancelada'))
);
CREATE TABLE IF NOT EXISTS var_transferencia_itens (
  empresa_id UUID NOT NULL,
  transferencia_id UUID NOT NULL,
  item_id UUID NOT NULL,
  quantidade NUMERIC(14,3) NOT NULL,
  recebido NUMERIC(14,3),
  PRIMARY KEY (empresa_id, transferencia_id, item_id),
  CONSTRAINT fk_var_ti_transf FOREIGN KEY (empresa_id, transferencia_id) REFERENCES var_transferencias (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_var_ti_item FOREIGN KEY (empresa_id, item_id) REFERENCES est_itens (empresa_id, id),
  CONSTRAINT chk_var_ti_qtd CHECK (quantidade > 0 AND (recebido IS NULL OR (recebido >= 0 AND recebido <= quantidade)))
);
