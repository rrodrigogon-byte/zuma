-- =============================================================================
-- MIGRATION 012 — PDV Multi-Operador: Turnos de Caixa e Suporte Offline
-- =============================================================================

BEGIN;

-- Tabela de turnos de caixa (multi-operador)
CREATE TABLE IF NOT EXISTS turnos_caixa (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id            UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  caixa_id              UUID REFERENCES caixas(id),
  usuario_id            UUID NOT NULL REFERENCES usuarios(id),
  fundo_caixa           DECIMAL(10,2) DEFAULT 0,
  status                VARCHAR(10) DEFAULT 'aberto', -- aberto, fechado
  abertura_em           TIMESTAMPTZ DEFAULT NOW(),
  fechamento_em         TIMESTAMPTZ,
  total_vendas          DECIMAL(12,2) DEFAULT 0,
  qtd_vendas            INTEGER DEFAULT 0,
  saldo_esperado        DECIMAL(10,2),
  saldo_contado         DECIMAL(10,2),
  diferenca             DECIMAL(10,2),
  observacoes_fechamento TEXT
);

-- Campos para suporte offline na tabela vendas
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS uuid_offline    UUID UNIQUE;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS finalizada_em   TIMESTAMPTZ;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS cancelada_em    TIMESTAMPTZ;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS turno_id        UUID REFERENCES turnos_caixa(id);

-- Campos de permissões extras no usuário
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS perfil            VARCHAR(20) DEFAULT 'operador';
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS permissoes_extras TEXT[] DEFAULT '{}';

-- Campos de tabela de preço no cliente
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='clientes') THEN
    EXECUTE 'ALTER TABLE clientes ADD COLUMN IF NOT EXISTS tabela_preco_id UUID REFERENCES tabela_preco(id)';
  END IF;
END $$;

-- Índices
CREATE INDEX IF NOT EXISTS idx_turnos_empresa_caixa ON turnos_caixa(empresa_id, caixa_id, status);
CREATE INDEX IF NOT EXISTS idx_vendas_turno ON vendas(turno_id) WHERE turno_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vendas_uuid_offline ON vendas(uuid_offline) WHERE uuid_offline IS NOT NULL;

COMMIT;
