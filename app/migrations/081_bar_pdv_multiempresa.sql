-- Migration 081: Bar, PDV, comandas, mesas, estoque fracionado e caixa por empresa.
-- Estritamente aditiva. Todas as relações operacionais carregam empresa_id e usam
-- chaves compostas para impedir referências cruzadas entre empresas.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS bar_produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  nome VARCHAR(180) NOT NULL,
  categoria VARCHAR(80) NOT NULL DEFAULT 'Geral',
  setor VARCHAR(20) NOT NULL DEFAULT 'bar',
  preco NUMERIC(12,2) NOT NULL DEFAULT 0,
  unidade VARCHAR(20) NOT NULL DEFAULT 'un',
  -- quantidade da unidade de estoque consumida por uma venda de uma unidade.
  -- Ex.: uma dose de 50 ml de uma garrafa de 1 l usa 0,05.
  fator_estoque NUMERIC(12,6) NOT NULL DEFAULT 1,
  estoque_atual NUMERIC(14,6) NOT NULL DEFAULT 0,
  estoque_minimo NUMERIC(14,6) NOT NULL DEFAULT 0,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_bar_produto_nome UNIQUE (empresa_id, nome),
  CONSTRAINT uq_bar_produto_empresa_id UNIQUE (empresa_id, id),
  CONSTRAINT chk_bar_produto_setor CHECK (setor IN ('bar', 'cozinha', 'chapa')),
  CONSTRAINT chk_bar_produto_preco CHECK (preco >= 0),
  CONSTRAINT chk_bar_produto_fator CHECK (fator_estoque > 0),
  CONSTRAINT chk_bar_produto_estoque CHECK (estoque_atual >= 0 AND estoque_minimo >= 0)
);
CREATE INDEX IF NOT EXISTS idx_bar_produtos_empresa_ativos ON bar_produtos (empresa_id, categoria, ordem) WHERE ativo;

CREATE TABLE IF NOT EXISTS bar_mesas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  numero INTEGER NOT NULL,
  nome VARCHAR(120),
  tipo VARCHAR(20) NOT NULL DEFAULT 'fisica',
  ativa BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_bar_mesa_numero UNIQUE (empresa_id, numero),
  CONSTRAINT uq_bar_mesa_empresa_id UNIQUE (empresa_id, id),
  CONSTRAINT chk_bar_mesa_tipo CHECK (tipo IN ('fisica', 'virtual'))
);
CREATE INDEX IF NOT EXISTS idx_bar_mesas_empresa_ativas ON bar_mesas (empresa_id, tipo, numero) WHERE ativa;

CREATE TABLE IF NOT EXISTS bar_comandas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  mesa_id UUID,
  nome VARCHAR(120),
  status VARCHAR(20) NOT NULL DEFAULT 'aberta',
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  aberta_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fechada_em TIMESTAMPTZ,
  operador_id VARCHAR(180),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_bar_comanda_empresa_id UNIQUE (empresa_id, id),
  CONSTRAINT fk_bar_comanda_mesa FOREIGN KEY (empresa_id, mesa_id) REFERENCES bar_mesas (empresa_id, id),
  CONSTRAINT chk_bar_comanda_status CHECK (status IN ('aberta', 'conta', 'paga', 'cancelada'))
);
CREATE INDEX IF NOT EXISTS idx_bar_comandas_empresa_status ON bar_comandas (empresa_id, status, aberta_em);
CREATE UNIQUE INDEX IF NOT EXISTS uq_bar_comanda_mesa_aberta ON bar_comandas (empresa_id, mesa_id) WHERE mesa_id IS NOT NULL AND status IN ('aberta', 'conta');

-- Dados de fechamento do PDV. O total original permanece em `total`; `valor_final`
-- registra o valor efetivamente pago depois de desconto e serviço.
ALTER TABLE bar_comandas
  ADD COLUMN IF NOT EXISTS cliente_id UUID,
  ADD COLUMN IF NOT EXISTS meio_pagamento VARCHAR(30),
  ADD COLUMN IF NOT EXISTS desconto_percentual NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS incluir_servico BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS valor_final NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS dividido_em INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS cpf_nota VARCHAR(14),
  ADD COLUMN IF NOT EXISTS tef_referencia VARCHAR(180),
  ADD COLUMN IF NOT EXISTS pagamentos JSONB NOT NULL DEFAULT '[]'::jsonb;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_bar_comanda_cliente') THEN
    ALTER TABLE bar_comandas
      ADD CONSTRAINT fk_bar_comanda_cliente FOREIGN KEY (empresa_id, cliente_id)
      REFERENCES commerce_customers (empresa_id, id) ON DELETE RESTRICT;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_bar_comandas_cliente ON bar_comandas (empresa_id, cliente_id) WHERE cliente_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS bar_comanda_pagamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  comanda_id UUID NOT NULL,
  meio VARCHAR(30) NOT NULL,
  valor NUMERIC(12,2) NOT NULL CHECK (valor > 0),
  referencia VARCHAR(180),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_bar_pagamento_empresa_id UNIQUE (empresa_id, id),
  CONSTRAINT fk_bar_pagamento_comanda FOREIGN KEY (empresa_id, comanda_id)
    REFERENCES bar_comandas (empresa_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_bar_pagamentos_comanda ON bar_comanda_pagamentos (empresa_id, comanda_id, criado_em);

CREATE TABLE IF NOT EXISTS bar_comanda_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  comanda_id UUID NOT NULL,
  produto_id UUID NOT NULL,
  quantidade NUMERIC(12,3) NOT NULL,
  valor_unitario NUMERIC(12,2) NOT NULL,
  consumo_estoque NUMERIC(14,6) NOT NULL,
  observacoes VARCHAR(300),
  status VARCHAR(20) NOT NULL DEFAULT 'pendente',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_bar_item_empresa_id UNIQUE (empresa_id, id),
  CONSTRAINT fk_bar_item_comanda FOREIGN KEY (empresa_id, comanda_id) REFERENCES bar_comandas (empresa_id, id),
  CONSTRAINT fk_bar_item_produto FOREIGN KEY (empresa_id, produto_id) REFERENCES bar_produtos (empresa_id, id),
  CONSTRAINT chk_bar_item_quantidade CHECK (quantidade > 0),
  CONSTRAINT chk_bar_item_consumo CHECK (consumo_estoque > 0),
  CONSTRAINT chk_bar_item_status CHECK (status IN ('pendente', 'preparando', 'pronto', 'servido', 'cancelado'))
);
CREATE INDEX IF NOT EXISTS idx_bar_itens_empresa_status ON bar_comanda_itens (empresa_id, status, criado_em) WHERE status <> 'cancelado';
CREATE INDEX IF NOT EXISTS idx_bar_itens_comanda ON bar_comanda_itens (empresa_id, comanda_id, criado_em);

CREATE TABLE IF NOT EXISTS bar_estoque_movimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  produto_id UUID NOT NULL,
  tipo VARCHAR(20) NOT NULL,
  quantidade NUMERIC(14,6) NOT NULL,
  saldo_apos NUMERIC(14,6) NOT NULL,
  origem VARCHAR(80) NOT NULL DEFAULT 'manual',
  referencia_id UUID,
  observacao VARCHAR(300),
  criado_por VARCHAR(180),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_bar_mov_produto FOREIGN KEY (empresa_id, produto_id) REFERENCES bar_produtos (empresa_id, id),
  CONSTRAINT chk_bar_mov_tipo CHECK (tipo IN ('entrada', 'saida', 'ajuste')),
  CONSTRAINT chk_bar_mov_quantidade CHECK (quantidade > 0),
  CONSTRAINT chk_bar_mov_saldo CHECK (saldo_apos >= 0)
);
CREATE INDEX IF NOT EXISTS idx_bar_mov_empresa_produto ON bar_estoque_movimentos (empresa_id, produto_id, criado_em DESC);

CREATE TABLE IF NOT EXISTS bar_caixas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'aberto',
  saldo_inicial NUMERIC(12,2) NOT NULL DEFAULT 0,
  saldo_atual NUMERIC(12,2) NOT NULL DEFAULT 0,
  aberto_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fechado_em TIMESTAMPTZ,
  operador_id VARCHAR(180),
  CONSTRAINT uq_bar_caixa_empresa_id UNIQUE (empresa_id, id),
  CONSTRAINT chk_bar_caixa_status CHECK (status IN ('aberto', 'fechado')),
  CONSTRAINT chk_bar_caixa_saldos CHECK (saldo_inicial >= 0 AND saldo_atual >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_bar_caixa_aberto ON bar_caixas (empresa_id) WHERE status = 'aberto';

CREATE TABLE IF NOT EXISTS bar_caixa_movimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  caixa_id UUID NOT NULL,
  tipo VARCHAR(20) NOT NULL,
  valor NUMERIC(12,2) NOT NULL,
  motivo VARCHAR(300),
  criado_por VARCHAR(180),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_bar_caixa_mov_caixa FOREIGN KEY (empresa_id, caixa_id) REFERENCES bar_caixas (empresa_id, id),
  CONSTRAINT chk_bar_caixa_mov_tipo CHECK (tipo IN ('sangria', 'suprimento')),
  CONSTRAINT chk_bar_caixa_mov_valor CHECK (valor > 0)
);
CREATE INDEX IF NOT EXISTS idx_bar_caixa_mov_empresa ON bar_caixa_movimentos (empresa_id, criado_em DESC);

CREATE TABLE IF NOT EXISTS bar_fila_impressao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  item_id UUID NOT NULL,
  setor VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pendente',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processado_em TIMESTAMPTZ,
  CONSTRAINT fk_bar_fila_item FOREIGN KEY (empresa_id, item_id) REFERENCES bar_comanda_itens (empresa_id, id),
  CONSTRAINT chk_bar_fila_status CHECK (status IN ('pendente', 'impresso', 'falhou'))
);
CREATE INDEX IF NOT EXISTS idx_bar_fila_empresa_status ON bar_fila_impressao (empresa_id, status, criado_em);

CREATE TABLE IF NOT EXISTS bar_importacoes_legado (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  origem VARCHAR(80) NOT NULL,
  origem_tipo VARCHAR(40) NOT NULL,
  origem_id VARCHAR(180) NOT NULL,
  destino_id UUID,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_bar_importacao UNIQUE (empresa_id, origem, origem_tipo, origem_id)
);
