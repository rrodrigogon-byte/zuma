-- ============================================================================
-- KYTTO COMMERCE CORE — compatibilidade da fidelidade legada
-- Executada antes de 044_loyalty_levels_rewards.sql.
--
-- Alguns ambientes possuem o Commerce Core (019+) mas não executaram as
-- migrations legadas 014/016 que criavam as tabelas de fidelidade. Esta
-- migration cria somente os contratos necessários ao módulo avançado, sem
-- inserir clientes, saldos, pontos ou recompensas.
-- Os vínculos com pedidos/vendas ficam como UUIDs opcionais porque esses
-- módulos legados podem não existir em todas as instalações do Commerce Core.
-- ============================================================================

CREATE TABLE IF NOT EXISTS programa_fidelidade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  pontos INTEGER NOT NULL DEFAULT 0,
  nivel VARCHAR(20) NOT NULL DEFAULT 'Bronze' CHECK (nivel IN ('Bronze', 'Prata', 'Ouro', 'Platina', 'Diamante')),
  total_gasto NUMERIC(12,2) NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_programa_fidelidade_empresa_cliente UNIQUE (empresa_id, cliente_id)
);

CREATE TABLE IF NOT EXISTS extrato_pontos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('credito', 'debito', 'expiracao')),
  pontos INTEGER NOT NULL,
  descricao VARCHAR(200),
  referencia_id UUID,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE extrato_pontos
  ADD COLUMN IF NOT EXISTS loja_id UUID;
ALTER TABLE extrato_pontos
  ADD COLUMN IF NOT EXISTS pedido_id UUID;
ALTER TABLE extrato_pontos
  ADD COLUMN IF NOT EXISTS venda_id UUID;
ALTER TABLE extrato_pontos
  ADD COLUMN IF NOT EXISTS expira_em TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_programa_fidelidade_empresa_cliente
  ON programa_fidelidade (empresa_id, cliente_id);
CREATE INDEX IF NOT EXISTS idx_extrato_pontos_empresa_cliente_criado
  ON extrato_pontos (empresa_id, cliente_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_extrato_pontos_expiracao
  ON extrato_pontos (empresa_id, cliente_id, expira_em)
  WHERE expira_em IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_extrato_pontos_credito_pedido
  ON extrato_pontos (pedido_id)
  WHERE pedido_id IS NOT NULL AND tipo = 'credito';

CREATE TABLE IF NOT EXISTS configuracoes_fidelidade_loja (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  pontos_por_real NUMERIC(10,4) NOT NULL DEFAULT 1 CHECK (pontos_por_real >= 0),
  valor_minimo_compra NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (valor_minimo_compra >= 0),
  pontos_por_real_resgate NUMERIC(10,4) NOT NULL DEFAULT 100 CHECK (pontos_por_real_resgate > 0),
  valor_por_bloco_resgate NUMERIC(12,2) NOT NULL DEFAULT 1 CHECK (valor_por_bloco_resgate > 0),
  percentual_maximo_desconto NUMERIC(5,2) NOT NULL DEFAULT 30 CHECK (percentual_maximo_desconto BETWEEN 0 AND 100),
  validade_dias INTEGER CHECK (validade_dias IS NULL OR validade_dias > 0),
  criado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_configuracoes_fidelidade_loja UNIQUE (empresa_id, loja_id)
);

CREATE INDEX IF NOT EXISTS idx_configuracoes_fidelidade_loja_operacao
  ON configuracoes_fidelidade_loja (empresa_id, loja_id, ativo);
