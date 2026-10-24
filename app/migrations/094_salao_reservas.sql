-- 094 — Reservas de mesa e lista de espera por empresa (onda 5), ligadas às mesas do bar (081).
-- Sem extensão: a sobreposição de horário da mesma mesa é barrada no serviço, com trava por mesa.
-- As FKs para bar_mesas pedem trava na tabela: se ela estiver presa mais de 3 s, o deploy para
-- (a versão atual continua no ar) em vez de enfileirar as vendas do bar.
SET LOCAL lock_timeout = '3s';

CREATE TABLE IF NOT EXISTS sal_reservas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID,
  mesa_id UUID,
  cliente_nome VARCHAR(160) NOT NULL,
  telefone VARCHAR(20),
  customer_id UUID,
  pessoas INTEGER NOT NULL,
  inicio_em TIMESTAMPTZ NOT NULL,
  fim_em TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'confirmada',
  observacao VARCHAR(500),
  comanda_id UUID,
  idempotencia VARCHAR(100),
  criado_por VARCHAR(180),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (empresa_id, id),
  CONSTRAINT fk_sal_res_mesa FOREIGN KEY (empresa_id, mesa_id) REFERENCES bar_mesas (empresa_id, id),
  CONSTRAINT chk_sal_res_status CHECK (status IN ('confirmada', 'chegou', 'em_atendimento', 'cumprida', 'no_show', 'cancelada')),
  CONSTRAINT chk_sal_res_pessoas CHECK (pessoas BETWEEN 1 AND 200),
  CONSTRAINT chk_sal_res_periodo CHECK (fim_em > inicio_em AND fim_em <= inicio_em + INTERVAL '12 hours')
);
CREATE INDEX IF NOT EXISTS idx_sal_res_dia ON sal_reservas (empresa_id, inicio_em);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sal_res_idem ON sal_reservas (empresa_id, idempotencia) WHERE idempotencia IS NOT NULL;

CREATE TABLE IF NOT EXISTS sal_fila (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID,
  dia DATE NOT NULL,
  senha INTEGER NOT NULL,
  cliente_nome VARCHAR(160) NOT NULL,
  telefone VARCHAR(20),
  pessoas INTEGER NOT NULL,
  previsao_minutos INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'aguardando',
  mesa_id UUID,
  chamado_em TIMESTAMPTZ,
  finalizado_em TIMESTAMPTZ,
  mensagem VARCHAR(300),
  observacao VARCHAR(500),
  comanda_id UUID,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (empresa_id, id),
  CONSTRAINT uq_sal_fila_senha UNIQUE (empresa_id, dia, senha),
  CONSTRAINT fk_sal_fila_mesa FOREIGN KEY (empresa_id, mesa_id) REFERENCES bar_mesas (empresa_id, id),
  CONSTRAINT chk_sal_fila_status CHECK (status IN ('aguardando', 'chamado', 'atendido', 'cancelado', 'ausente')),
  CONSTRAINT chk_sal_fila_pessoas CHECK (pessoas BETWEEN 1 AND 200)
);
CREATE INDEX IF NOT EXISTS idx_sal_fila_ativa ON sal_fila (empresa_id, dia, status);
