-- 107 — Fiscal: configuração da emissão automática por empresa (F2).
-- Desligada por padrão. Ao ligar, só as vendas pagas a partir daquele momento entram na rotina.
-- Aditiva e reexecutável.
CREATE TABLE IF NOT EXISTS fis_config (
  empresa_id UUID PRIMARY KEY REFERENCES empresas(id) ON DELETE CASCADE,
  emissao_automatica BOOLEAN NOT NULL DEFAULT false,
  automatica_desde TIMESTAMPTZ,
  origens TEXT[] NOT NULL DEFAULT ARRAY['loja_pedido']::text[],
  ultima_rodada TIMESTAMPTZ,
  ultimo_resumo JSONB,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_fis_config_origens CHECK (origens <@ ARRAY['loja_pedido', 'bar_comanda', 'barbearia_comanda']::text[])
);
CREATE INDEX IF NOT EXISTS idx_fis_config_automatica ON fis_config (empresa_id) WHERE emissao_automatica;
