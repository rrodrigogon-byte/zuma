-- 099 — PDV offline: fila de impressão do agente local e registro dos eventos do agente.
-- O agente busca um trabalho por vez (GET /terminal/fila-impressao), imprime e devolve o
-- resultado; os eventos técnicos (falha de impressão, sincronização) ficam gravados por terminal.

CREATE TABLE IF NOT EXISTS pdv_impressoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL,
  terminal_id UUID,
  dispositivo_id UUID,
  tipo_documento VARCHAR(20) NOT NULL DEFAULT 'cupom',
  conteudo JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pendente',
  tentativas INTEGER NOT NULL DEFAULT 0,
  erro VARCHAR(300),
  entregue_em TIMESTAMPTZ,
  concluido_em TIMESTAMPTZ,
  criado_por VARCHAR(180),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_pdv_imp_status CHECK (status IN ('pendente', 'entregue', 'impresso', 'erro', 'cancelado')),
  CONSTRAINT chk_pdv_imp_tipo CHECK (tipo_documento IN ('cupom', 'comanda', 'teste', 'outro'))
);
CREATE INDEX IF NOT EXISTS idx_pdv_imp_fila ON pdv_impressoes (empresa_id, loja_id, status, criado_em);

CREATE TABLE IF NOT EXISTS pdv_eventos_agente (
  id BIGSERIAL PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  terminal_id UUID NOT NULL,
  tipo_evento VARCHAR(60) NOT NULL,
  severidade VARCHAR(10) NOT NULL DEFAULT 'info',
  dados JSONB NOT NULL DEFAULT '{}'::jsonb,
  ocorrido_em TIMESTAMPTZ,
  recebido_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pdv_ev_agente ON pdv_eventos_agente (empresa_id, terminal_id, recebido_em DESC);
