-- Clube & Academia: de-para de importações de sistemas legados (ex.: sócios do TTC no JSON).
-- Torna a importação idempotente por empresa: rodar de novo atualiza só o que mudou e nunca
-- duplica cadastro, plano ou matrícula. Serve para qualquer origem futura (outra academia, planilha).

CREATE TABLE IF NOT EXISTS clube_importacoes (
  empresa_id    UUID NOT NULL,
  origem        VARCHAR(40) NOT NULL,
  id_origem     VARCHAR(80) NOT NULL,
  customer_id   UUID,
  plano_id      UUID,
  matricula_id  UUID,
  detalhe       JSONB NOT NULL DEFAULT '{}'::jsonb,
  importado_em  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (empresa_id, origem, id_origem)
);

CREATE INDEX IF NOT EXISTS idx_clube_importacoes_customer ON clube_importacoes (empresa_id, customer_id);
