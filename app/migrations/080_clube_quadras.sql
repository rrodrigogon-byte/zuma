-- Migration 080: Kytto Clube & Academia — quadras e reservas por empresa (tênis, beach tennis, padel…).
-- Estritamente aditiva. Cada clube tem as próprias quadras, horário de funcionamento e regras.
-- Choque de horário é impedido pelo serviço com trava por quadra (pg_advisory_xact_lock) na transação.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Regras da empresa. Sem linha aqui, valem os padrões do serviço (06:00–22:00, 60 min).
CREATE TABLE IF NOT EXISTS clube_quadras_config (
  empresa_id              UUID PRIMARY KEY,
  fuso                    VARCHAR(60) NOT NULL DEFAULT 'America/Cuiaba',
  -- {"0":[{"abre":"05:00","fecha":"23:00"}], ..., "6":[...]}; dia sem faixa = fechado (0 = domingo)
  funcionamento           JSONB NOT NULL,
  duracao_min             INTEGER NOT NULL DEFAULT 60,   -- duração padrão de uma reserva
  intervalo_min           INTEGER NOT NULL DEFAULT 60,   -- passo dos horários oferecidos (60 = 05:00, 06:00…)
  abertura_dias           INTEGER NOT NULL DEFAULT 7,    -- sócio reserva até N dias à frente
  limite_reservas_futuras INTEGER NOT NULL DEFAULT 2,    -- por sócio (a recepção pode passar do limite)
  cancelamento_min_antes  INTEGER NOT NULL DEFAULT 120,  -- depois disso o cancelamento fica marcado como tardio
  exige_socio_em_dia      BOOLEAN NOT NULL DEFAULT true, -- reserva de sócio pede matrícula ativa e em dia
  atualizado_em           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_clube_quadras_config CHECK (
    duracao_min BETWEEN 15 AND 480 AND intervalo_min BETWEEN 15 AND 240
    AND duracao_min % 15 = 0 AND intervalo_min % 15 = 0
    AND abertura_dias BETWEEN 0 AND 90 AND limite_reservas_futuras BETWEEN 1 AND 50
    AND cancelamento_min_antes BETWEEN 0 AND 2880
  )
);

CREATE TABLE IF NOT EXISTS clube_quadras (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        UUID NOT NULL,
  nome              VARCHAR(80) NOT NULL,
  modalidade        VARCHAR(30) NOT NULL DEFAULT 'tenis',
  piso              VARCHAR(30),
  coberta           BOOLEAN NOT NULL DEFAULT false,
  iluminacao        BOOLEAN NOT NULL DEFAULT true,
  valor_hora_avulso NUMERIC(10,2),                        -- referência para quem não é sócio
  ordem             INTEGER NOT NULL DEFAULT 0,
  ativa             BOOLEAN NOT NULL DEFAULT true,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_clube_quadra_nome UNIQUE (empresa_id, nome),
  CONSTRAINT uq_clube_quadra_empresa_id UNIQUE (empresa_id, id),
  CONSTRAINT chk_clube_quadra CHECK (
    modalidade IN ('tenis', 'beach_tennis', 'padel', 'pickleball', 'squash', 'futevolei', 'volei_praia', 'futsal', 'society', 'outro')
    AND (piso IS NULL OR piso IN ('saibro', 'rapida', 'areia', 'grama_sintetica', 'grama', 'madeira', 'outro'))
    AND (valor_hora_avulso IS NULL OR valor_hora_avulso BETWEEN 0 AND 100000)
  )
);
CREATE INDEX IF NOT EXISTS idx_clube_quadras_empresa ON clube_quadras (empresa_id, ordem) WHERE ativa;

-- Reserva (sócio, avulso) ou bloqueio (aula, torneio, manutenção, evento) de uma quadra.
CREATE TABLE IF NOT EXISTS clube_quadra_reservas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          UUID NOT NULL,
  quadra_id           UUID NOT NULL,
  customer_id         UUID,
  tipo                VARCHAR(20) NOT NULL DEFAULT 'socio',
  inicio              TIMESTAMPTZ NOT NULL,
  fim                 TIMESTAMPTZ NOT NULL,
  status              VARCHAR(20) NOT NULL DEFAULT 'confirmada',
  origem              VARCHAR(20) NOT NULL DEFAULT 'recepcao',
  titulo              VARCHAR(120),
  observacao          VARCHAR(300),
  criado_por          VARCHAR(120),
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelado_em        TIMESTAMPTZ,
  cancelado_por       VARCHAR(120),
  cancelamento_tardio BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT fk_clube_quadra_reserva_quadra FOREIGN KEY (empresa_id, quadra_id) REFERENCES clube_quadras (empresa_id, id),
  CONSTRAINT chk_clube_quadra_reserva CHECK (
    fim > inicio AND fim <= inicio + interval '24 hours'
    AND tipo IN ('socio', 'avulso', 'aula', 'torneio', 'manutencao', 'evento')
    AND status IN ('confirmada', 'cancelada')
    AND origem IN ('recepcao', 'whatsapp', 'app')
    AND (tipo <> 'socio' OR customer_id IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_clube_quadra_reservas_quadra ON clube_quadra_reservas (empresa_id, quadra_id, inicio) WHERE status = 'confirmada';
CREATE INDEX IF NOT EXISTS idx_clube_quadra_reservas_cliente ON clube_quadra_reservas (empresa_id, customer_id, inicio) WHERE status = 'confirmada';
