-- Migration 075: Kytto Clube & Academia — Item 5 (agenda de aulas com vagas e lista de espera).
-- Estritamente aditiva. Lotação garantida no banco por trava de linha na ocorrência.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS aulas_modalidades (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id              UUID NOT NULL,
  nome                    VARCHAR(80) NOT NULL,
  abertura_dias           INTEGER NOT NULL DEFAULT 7,     -- reserva abre N dias antes
  limite_reservas_futuras INTEGER NOT NULL DEFAULT 3,
  cancelamento_min_antes  INTEGER NOT NULL DEFAULT 120,   -- sem penalidade até N min antes
  tolerancia_atraso_min   INTEGER NOT NULL DEFAULT 10,
  noshow_limite_mes       INTEGER NOT NULL DEFAULT 3,     -- faltas no mês que geram bloqueio
  noshow_bloqueio_dias    INTEGER NOT NULL DEFAULT 7,
  fila_resposta_min       INTEGER NOT NULL DEFAULT 15,    -- tempo para aceitar a vaga da fila
  planos                  UUID[],                         -- planos que dão direito (NULL = todos)
  ativo                   BOOLEAN NOT NULL DEFAULT true,
  criado_em               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_aulas_modalidade_nome UNIQUE (empresa_id, nome),
  CONSTRAINT chk_aulas_modalidade_regras CHECK (
    abertura_dias BETWEEN 0 AND 60 AND limite_reservas_futuras BETWEEN 1 AND 50
    AND cancelamento_min_antes BETWEEN 0 AND 2880 AND tolerancia_atraso_min BETWEEN 0 AND 60
    AND noshow_limite_mes BETWEEN 1 AND 31 AND noshow_bloqueio_dias BETWEEN 0 AND 60
    AND fila_resposta_min BETWEEN 5 AND 120
  )
);

-- Turma recorrente: dias da semana + horário local + capacidade.
CREATE TABLE IF NOT EXISTS aulas_turmas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID NOT NULL,
  modalidade_id   UUID NOT NULL REFERENCES aulas_modalidades(id),
  nome            VARCHAR(120) NOT NULL,
  professor       VARCHAR(120),
  sala            VARCHAR(80),
  dias_semana     SMALLINT[] NOT NULL,               -- 0=domingo ... 6=sábado
  hora_inicio     TIME NOT NULL,
  duracao_min     INTEGER NOT NULL,
  capacidade      INTEGER NOT NULL,
  vagas_parceiros INTEGER NOT NULL DEFAULT 0,        -- reservadas para Wellhub/TotalPass
  fuso            VARCHAR(60) NOT NULL DEFAULT 'America/Cuiaba',
  vigencia_inicio DATE NOT NULL,
  vigencia_fim    DATE,
  ativa           BOOLEAN NOT NULL DEFAULT true,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_aulas_turma CHECK (
    duracao_min BETWEEN 10 AND 480 AND capacidade BETWEEN 1 AND 500
    AND vagas_parceiros BETWEEN 0 AND capacidade
    AND cardinality(dias_semana) >= 1 AND dias_semana <@ ARRAY[0,1,2,3,4,5,6]::SMALLINT[]
    AND (vigencia_fim IS NULL OR vigencia_fim >= vigencia_inicio)
  )
);
CREATE INDEX IF NOT EXISTS idx_aulas_turmas_empresa ON aulas_turmas (empresa_id) WHERE ativa;

-- Cada aula concreta gerada da turma (pode ter substituto ou ser cancelada sem mexer na turma).
CREATE TABLE IF NOT EXISTS aulas_ocorrencias (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID NOT NULL,
  turma_id    UUID NOT NULL REFERENCES aulas_turmas(id),
  inicio      TIMESTAMPTZ NOT NULL,
  fim         TIMESTAMPTZ NOT NULL,
  capacidade  INTEGER NOT NULL,
  professor   VARCHAR(120),
  status      VARCHAR(12) NOT NULL DEFAULT 'ativa',
  motivo_cancelamento VARCHAR(240),
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_aulas_ocorrencia UNIQUE (turma_id, inicio),
  CONSTRAINT chk_aulas_ocorrencia CHECK (status IN ('ativa', 'cancelada') AND fim > inicio AND capacidade >= 1)
);
CREATE INDEX IF NOT EXISTS idx_aulas_ocorrencias_periodo ON aulas_ocorrencias (empresa_id, inicio);

CREATE TABLE IF NOT EXISTS aulas_reservas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID NOT NULL,
  ocorrencia_id   UUID NOT NULL REFERENCES aulas_ocorrencias(id),
  customer_id     UUID NOT NULL,
  origem          VARCHAR(12) NOT NULL DEFAULT 'whatsapp',
  status          VARCHAR(12) NOT NULL DEFAULT 'reservada',
  cancelamento_tardio BOOLEAN NOT NULL DEFAULT false,
  lembrete_enviado_em TIMESTAMPTZ,
  presenca_em     TIMESTAMPTZ,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelado_em    TIMESTAMPTZ,
  CONSTRAINT chk_aulas_reserva_origem CHECK (origem IN ('whatsapp', 'app', 'recepcao', 'wellhub', 'totalpass', 'fila')),
  CONSTRAINT chk_aulas_reserva_status CHECK (status IN ('reservada', 'cancelada', 'presente', 'falta'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_aulas_reserva_ativa
  ON aulas_reservas (ocorrencia_id, customer_id) WHERE status IN ('reservada', 'presente');
CREATE INDEX IF NOT EXISTS idx_aulas_reservas_customer ON aulas_reservas (empresa_id, customer_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_aulas_reservas_ocorrencia ON aulas_reservas (ocorrencia_id, status);

CREATE TABLE IF NOT EXISTS aulas_fila (
  id            BIGSERIAL PRIMARY KEY,
  empresa_id    UUID NOT NULL,
  ocorrencia_id UUID NOT NULL REFERENCES aulas_ocorrencias(id),
  customer_id   UUID NOT NULL,
  status        VARCHAR(12) NOT NULL DEFAULT 'aguardando',
  chamado_em    TIMESTAMPTZ,
  expira_em     TIMESTAMPTZ,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_aulas_fila_status CHECK (status IN ('aguardando', 'chamado', 'aceito', 'expirado', 'desistiu'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_aulas_fila_ativa
  ON aulas_fila (ocorrencia_id, customer_id) WHERE status IN ('aguardando', 'chamado');
CREATE INDEX IF NOT EXISTS idx_aulas_fila_ordem ON aulas_fila (ocorrencia_id, id) WHERE status IN ('aguardando', 'chamado');
