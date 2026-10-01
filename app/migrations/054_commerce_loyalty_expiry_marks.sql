-- Créditos de pontos vencidos já avaliados pela rotina de expiração. O livro de pontos é
-- imutável e não aceita lançamento de zero pontos: sem esta marca, um crédito vencido cujos
-- pontos já tinham sido gastos voltava para a fila a cada ciclo e, acumulados, impediam os
-- créditos mais novos de vencer.
CREATE TABLE IF NOT EXISTS commerce_loyalty_expiry_marks (
  ledger_id UUID PRIMARY KEY REFERENCES commerce_loyalty_ledger(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  pontos_expirados INTEGER NOT NULL DEFAULT 0 CHECK (pontos_expirados >= 0),
  processado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_loyalty_expiry_marks_empresa ON commerce_loyalty_expiry_marks (empresa_id, processado_em DESC);
