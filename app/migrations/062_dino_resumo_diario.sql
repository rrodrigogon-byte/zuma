-- 062 · Controle de envio do resumo diário do Dino no WhatsApp.
-- Uma linha por (empresa, dia): impede envio duplicado em reinício/dois processos
-- e permite nova tentativa (até 3) quando o envio falha.
CREATE TABLE IF NOT EXISTS dino_resumo_diario_envios (
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  dia DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'enviando',
  tentativas SMALLINT NOT NULL DEFAULT 1,
  resumo JSONB,
  enviado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_dino_resumo_diario_envios PRIMARY KEY (empresa_id, dia),
  CONSTRAINT chk_dino_resumo_status CHECK (status IN ('enviando', 'enviado', 'falha'))
);
