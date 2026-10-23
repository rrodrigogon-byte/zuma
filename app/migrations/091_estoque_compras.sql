-- Estoque por empresa e unidade, compras com recebimento e nota de entrada, perdas, inventário e
-- fichas técnicas (Kytto, onda 2).
--
-- est_itens são as mercadorias e insumos que a empresa compra e controla. Os produtos vendidos em
-- outros módulos (produto do bar, variante da loja online) se ligam a eles por est_vinculos, que
-- também é a ficha técnica: quanto de cada item uma venda consome.
-- Todo movimento tem chave única por empresa: reprocessar uma venda ou um recebimento não duplica.
-- Aditiva: só cria tabelas novas.

CREATE TABLE IF NOT EXISTS est_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  sku VARCHAR(60),
  ean VARCHAR(14),
  nome VARCHAR(180) NOT NULL,
  unidade VARCHAR(10) NOT NULL DEFAULT 'UN',
  tipo VARCHAR(20) NOT NULL DEFAULT 'mercadoria',
  categoria VARCHAR(80),
  ncm VARCHAR(8),
  custo_medio NUMERIC(14,4) NOT NULL DEFAULT 0,
  estoque_minimo NUMERIC(14,3) NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_est_item_empresa_id UNIQUE (empresa_id, id),
  CONSTRAINT chk_est_item_tipo CHECK (tipo IN ('mercadoria', 'insumo', 'embalagem', 'uso_consumo')),
  CONSTRAINT chk_est_item_custo CHECK (custo_medio >= 0),
  CONSTRAINT chk_est_item_minimo CHECK (estoque_minimo >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_est_item_sku ON est_itens (empresa_id, upper(sku)) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_est_item_ean ON est_itens (empresa_id, ean) WHERE ean IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_est_item_nome ON est_itens (empresa_id, lower(nome));

-- Saldo por unidade (loja_id NULL = estoque da empresa sem unidade definida).
CREATE TABLE IF NOT EXISTS est_saldos (
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID,
  item_id UUID NOT NULL,
  quantidade NUMERIC(14,3) NOT NULL DEFAULT 0,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_est_saldo_item FOREIGN KEY (empresa_id, item_id) REFERENCES est_itens (empresa_id, id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_est_saldo ON est_saldos (empresa_id, COALESCE(loja_id, '00000000-0000-0000-0000-000000000000'::uuid), item_id);

CREATE TABLE IF NOT EXISTS est_movimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID,
  item_id UUID NOT NULL,
  tipo VARCHAR(24) NOT NULL,
  -- positiva entra, negativa sai
  quantidade NUMERIC(14,3) NOT NULL,
  custo_unitario NUMERIC(14,4) NOT NULL DEFAULT 0,
  saldo_apos NUMERIC(14,3) NOT NULL,
  origem VARCHAR(40) NOT NULL DEFAULT 'manual',
  origem_id VARCHAR(160),
  chave VARCHAR(200) NOT NULL,
  motivo VARCHAR(240),
  usuario VARCHAR(180),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_est_mov_chave UNIQUE (empresa_id, chave),
  CONSTRAINT fk_est_mov_item FOREIGN KEY (empresa_id, item_id) REFERENCES est_itens (empresa_id, id),
  CONSTRAINT chk_est_mov_tipo CHECK (tipo IN ('entrada', 'saida', 'venda', 'ajuste', 'perda', 'inventario', 'transferencia_saida', 'transferencia_entrada')),
  CONSTRAINT chk_est_mov_qtd CHECK (quantidade <> 0)
);
CREATE INDEX IF NOT EXISTS idx_est_mov_item ON est_movimentos (empresa_id, item_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_est_mov_tipo ON est_movimentos (empresa_id, tipo, criado_em DESC);

-- Vínculo de um produto vendido em outro módulo com os itens do estoque (ficha técnica).
-- `fator`: quanto do item sai por unidade vendida. `espelho`: a entrada por compra também soma no
-- estoque operacional do módulo (hoje só o bar: bar_produtos.estoque_atual).
CREATE TABLE IF NOT EXISTS est_vinculos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  fonte VARCHAR(20) NOT NULL,
  fonte_id UUID NOT NULL,
  item_id UUID NOT NULL,
  fator NUMERIC(14,6) NOT NULL,
  espelho BOOLEAN NOT NULL DEFAULT false,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_est_vinculo UNIQUE (empresa_id, fonte, fonte_id, item_id),
  CONSTRAINT fk_est_vinculo_item FOREIGN KEY (empresa_id, item_id) REFERENCES est_itens (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT chk_est_vinculo_fonte CHECK (fonte IN ('bar_produto', 'loja_variante')),
  CONSTRAINT chk_est_vinculo_fator CHECK (fator > 0)
);

CREATE TABLE IF NOT EXISTS est_inventarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID,
  descricao VARCHAR(160) NOT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'aberto',
  criado_por VARCHAR(180),
  concluido_por VARCHAR(180),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  concluido_em TIMESTAMPTZ,
  CONSTRAINT uq_est_inv_empresa_id UNIQUE (empresa_id, id),
  CONSTRAINT chk_est_inv_status CHECK (status IN ('aberto', 'concluido', 'cancelado'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_est_inv_aberto ON est_inventarios (empresa_id, COALESCE(loja_id, '00000000-0000-0000-0000-000000000000'::uuid)) WHERE status = 'aberto';

CREATE TABLE IF NOT EXISTS est_inventario_itens (
  empresa_id UUID NOT NULL,
  inventario_id UUID NOT NULL,
  item_id UUID NOT NULL,
  saldo_sistema NUMERIC(14,3) NOT NULL,
  contado NUMERIC(14,3),
  contado_em TIMESTAMPTZ,
  PRIMARY KEY (empresa_id, inventario_id, item_id),
  CONSTRAINT fk_est_inv_item_inv FOREIGN KEY (empresa_id, inventario_id) REFERENCES est_inventarios (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_est_inv_item_item FOREIGN KEY (empresa_id, item_id) REFERENCES est_itens (empresa_id, id),
  CONSTRAINT chk_est_inv_contado CHECK (contado IS NULL OR contado >= 0)
);

CREATE TABLE IF NOT EXISTS cmp_pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID,
  numero INTEGER NOT NULL,
  fornecedor_id UUID,
  fornecedor_nome VARCHAR(240) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'rascunho',
  previsao DATE,
  condicao_pagamento VARCHAR(40) NOT NULL DEFAULT 'a_vista',
  observacao TEXT,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  criado_por VARCHAR(180),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_cmp_pedido_empresa_id UNIQUE (empresa_id, id),
  CONSTRAINT uq_cmp_pedido_numero UNIQUE (empresa_id, numero),
  CONSTRAINT fk_cmp_pedido_fornecedor FOREIGN KEY (empresa_id, fornecedor_id) REFERENCES a2_fornecedores (empresa_id, id),
  CONSTRAINT chk_cmp_pedido_status CHECK (status IN ('rascunho', 'enviado', 'parcial', 'recebido', 'cancelado'))
);

CREATE TABLE IF NOT EXISTS cmp_pedido_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  pedido_id UUID NOT NULL,
  item_id UUID NOT NULL,
  quantidade NUMERIC(14,3) NOT NULL,
  custo_unitario NUMERIC(14,4) NOT NULL,
  recebido NUMERIC(14,3) NOT NULL DEFAULT 0,
  CONSTRAINT fk_cmp_pi_pedido FOREIGN KEY (empresa_id, pedido_id) REFERENCES cmp_pedidos (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_cmp_pi_item FOREIGN KEY (empresa_id, item_id) REFERENCES est_itens (empresa_id, id),
  CONSTRAINT chk_cmp_pi_qtd CHECK (quantidade > 0 AND custo_unitario >= 0 AND recebido >= 0)
);

CREATE TABLE IF NOT EXISTS cmp_recebimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID,
  pedido_id UUID,
  fornecedor_id UUID,
  fornecedor_nome VARCHAR(240) NOT NULL,
  fornecedor_cnpj VARCHAR(14),
  nfe_chave CHAR(44),
  nfe_numero VARCHAR(20),
  nfe_serie VARCHAR(5),
  emissao DATE,
  valor_total NUMERIC(14,2) NOT NULL,
  parcelas JSONB NOT NULL DEFAULT '[]'::jsonb,
  recebido_por VARCHAR(180),
  observacao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_cmp_rec_empresa_id UNIQUE (empresa_id, id),
  CONSTRAINT fk_cmp_rec_pedido FOREIGN KEY (empresa_id, pedido_id) REFERENCES cmp_pedidos (empresa_id, id),
  CONSTRAINT chk_cmp_rec_valor CHECK (valor_total >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cmp_rec_nfe ON cmp_recebimentos (empresa_id, nfe_chave) WHERE nfe_chave IS NOT NULL;

CREATE TABLE IF NOT EXISTS cmp_recebimento_itens (
  empresa_id UUID NOT NULL,
  recebimento_id UUID NOT NULL,
  item_id UUID NOT NULL,
  quantidade NUMERIC(14,3) NOT NULL,
  custo_unitario NUMERIC(14,4) NOT NULL,
  codigo_fornecedor VARCHAR(60),
  CONSTRAINT fk_cmp_ri_rec FOREIGN KEY (empresa_id, recebimento_id) REFERENCES cmp_recebimentos (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_cmp_ri_item FOREIGN KEY (empresa_id, item_id) REFERENCES est_itens (empresa_id, id),
  CONSTRAINT chk_cmp_ri_qtd CHECK (quantidade > 0 AND custo_unitario >= 0)
);

-- O que a empresa aprendeu de cada fornecedor: código do produto na nota → item do estoque.
CREATE TABLE IF NOT EXISTS cmp_codigos_fornecedor (
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  fornecedor_cnpj VARCHAR(14) NOT NULL,
  codigo VARCHAR(60) NOT NULL,
  item_id UUID NOT NULL,
  fator NUMERIC(14,6) NOT NULL DEFAULT 1,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (empresa_id, fornecedor_cnpj, codigo),
  CONSTRAINT fk_cmp_cod_item FOREIGN KEY (empresa_id, item_id) REFERENCES est_itens (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT chk_cmp_cod_fator CHECK (fator > 0)
);
