-- Migration 073: Kytto Clube & Academia — Item 1 (controle de acesso).
-- Estritamente aditiva: cria apenas tabelas novas com prefixo acesso_. Não altera nada existente.
-- Pessoa = commerce_customers (identidade canônica do tenant). Multi-tenant por empresa_id.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Equipamentos (catracas, portas, leitores). O aparelho se autentica pelo segredo na URL
-- configurada nele; só o hash fica no banco. device_id_externo é fixado no 1º contato.
CREATE TABLE IF NOT EXISTS acesso_dispositivos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        UUID NOT NULL,
  unidade_id        UUID,
  nome              VARCHAR(120) NOT NULL,
  fabricante        VARCHAR(20) NOT NULL DEFAULT 'controlid',
  modelo            VARCHAR(20) NOT NULL DEFAULT 'catraca',
  modo              VARCHAR(20) NOT NULL DEFAULT 'pro',
  sentido_entrada   VARCHAR(20) NOT NULL DEFAULT 'clockwise',
  fuso              VARCHAR(60) NOT NULL DEFAULT 'America/Cuiaba',
  segredo_hash      CHAR(64) NOT NULL,
  device_id_externo VARCHAR(40),
  status            VARCHAR(20) NOT NULL DEFAULT 'aguardando',
  ultimo_contato    TIMESTAMPTZ,
  firmware          VARCHAR(60),
  ativo             BOOLEAN NOT NULL DEFAULT true,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_acesso_disp_fabricante CHECK (fabricante IN ('controlid', 'henry', 'topdata', 'outro')),
  CONSTRAINT chk_acesso_disp_modelo CHECK (modelo IN ('catraca', 'porta', 'leitor')),
  CONSTRAINT chk_acesso_disp_modo CHECK (modo IN ('pro', 'standalone', 'agente')),
  CONSTRAINT chk_acesso_disp_sentido CHECK (sentido_entrada IN ('clockwise', 'anticlockwise', 'both')),
  CONSTRAINT chk_acesso_disp_status CHECK (status IN ('aguardando', 'online', 'contingencia', 'offline'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_acesso_disp_segredo ON acesso_dispositivos (segredo_hash);
CREATE INDEX IF NOT EXISTS idx_acesso_disp_empresa ON acesso_dispositivos (empresa_id, ativo);

-- Plano de acesso com as regras do motor (item 1.5 da especificação).
CREATE TABLE IF NOT EXISTS acesso_planos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        UUID NOT NULL,
  nome              VARCHAR(120) NOT NULL,
  horarios          JSONB,
  limite_por_dia    INTEGER,
  limite_por_semana INTEGER,
  unidades          UUID[],
  exige_reserva     BOOLEAN NOT NULL DEFAULT false,
  tolerancia_dias   INTEGER NOT NULL DEFAULT 5,
  ativo             BOOLEAN NOT NULL DEFAULT true,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_acesso_plano_nome UNIQUE (empresa_id, nome),
  CONSTRAINT chk_acesso_plano_limites CHECK (
    (limite_por_dia IS NULL OR limite_por_dia > 0)
    AND (limite_por_semana IS NULL OR limite_por_semana > 0)
    AND tolerancia_dias BETWEEN 0 AND 60
  )
);

-- Matrícula: vínculo da pessoa com um plano e até quando está paga.
CREATE TABLE IF NOT EXISTS acesso_matriculas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID NOT NULL,
  customer_id     UUID NOT NULL,
  plano_id        UUID NOT NULL REFERENCES acesso_planos(id),
  pago_ate        DATE NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'ativa',
  bloqueada       BOOLEAN NOT NULL DEFAULT false,
  motivo_bloqueio VARCHAR(240),
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_acesso_matricula_status CHECK (status IN ('ativa', 'congelada', 'cancelada'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_acesso_matricula_ativa
  ON acesso_matriculas (empresa_id, customer_id) WHERE status = 'ativa';

-- Número da pessoa dentro dos aparelhos (a Control iD usa id inteiro).
CREATE SEQUENCE IF NOT EXISTS acesso_user_id_seq START 1000;
CREATE TABLE IF NOT EXISTS acesso_pessoas_equipamento (
  empresa_id          UUID NOT NULL,
  customer_id         UUID NOT NULL,
  user_id_equipamento BIGINT NOT NULL DEFAULT nextval('acesso_user_id_seq'),
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (empresa_id, customer_id),
  CONSTRAINT uq_acesso_pessoa_user_id UNIQUE (empresa_id, user_id_equipamento)
);

-- Credenciais (face, digital, cartão, QR). Biometria exige consentimento (LGPD art. 11).
-- Template biométrico nunca é guardado aqui em claro.
CREATE TABLE IF NOT EXISTS acesso_credenciais (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       UUID NOT NULL,
  customer_id      UUID NOT NULL,
  tipo             VARCHAR(20) NOT NULL,
  referencia       VARCHAR(120),
  consentimento_id UUID,
  ativo            BOOLEAN NOT NULL DEFAULT true,
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  removido_em      TIMESTAMPTZ,
  CONSTRAINT chk_acesso_cred_tipo CHECK (tipo IN ('face', 'digital', 'cartao', 'qr', 'pin')),
  CONSTRAINT chk_acesso_cred_biometria_consentida CHECK (tipo NOT IN ('face', 'digital') OR consentimento_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_acesso_cred_customer ON acesso_credenciais (empresa_id, customer_id) WHERE ativo;

-- Toda decisão de acesso (auditoria e frequência).
CREATE TABLE IF NOT EXISTS acesso_eventos (
  id             BIGSERIAL PRIMARY KEY,
  empresa_id     UUID NOT NULL,
  dispositivo_id UUID,
  customer_id    UUID,
  ocorrido_em    TIMESTAMPTZ NOT NULL,
  decisao        VARCHAR(10) NOT NULL,
  codigo_regra   VARCHAR(40) NOT NULL,
  mensagem       VARCHAR(120),
  origem         VARCHAR(20) NOT NULL,
  operador_id    VARCHAR(80),
  motivo_manual  VARCHAR(240),
  uuid_externo   VARCHAR(80),
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_acesso_evento_decisao CHECK (decisao IN ('liberado', 'negado')),
  CONSTRAINT chk_acesso_evento_origem CHECK (origem IN ('online', 'contingencia', 'manual', 'parceiro', 'qr')),
  CONSTRAINT chk_acesso_evento_manual CHECK (origem <> 'manual' OR (operador_id IS NOT NULL AND motivo_manual IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_acesso_eventos_empresa ON acesso_eventos (empresa_id, ocorrido_em DESC);
CREATE INDEX IF NOT EXISTS idx_acesso_eventos_customer ON acesso_eventos (empresa_id, customer_id, ocorrido_em DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_acesso_eventos_uuid
  ON acesso_eventos (dispositivo_id, uuid_externo) WHERE uuid_externo IS NOT NULL;

-- Fila de comandos entregues ao aparelho pelo Push. Um comando novo com a mesma chave
-- substitui o pendente (ex.: duas renovações seguidas viram um só upsert).
CREATE TABLE IF NOT EXISTS acesso_fila_push (
  id             BIGSERIAL PRIMARY KEY,
  empresa_id     UUID NOT NULL,
  dispositivo_id UUID NOT NULL REFERENCES acesso_dispositivos(id) ON DELETE CASCADE,
  chave          VARCHAR(80) NOT NULL,
  comando        JSONB NOT NULL,
  status         VARCHAR(10) NOT NULL DEFAULT 'pendente',
  tentativas     INTEGER NOT NULL DEFAULT 0,
  push_uuid      VARCHAR(80),
  posicao        INTEGER,
  erro           TEXT,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  enviado_em     TIMESTAMPTZ,
  concluido_em   TIMESTAMPTZ,
  CONSTRAINT chk_acesso_fila_status CHECK (status IN ('pendente', 'enviado', 'ok', 'erro'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_acesso_fila_chave_pendente
  ON acesso_fila_push (dispositivo_id, chave) WHERE status = 'pendente';
CREATE INDEX IF NOT EXISTS idx_acesso_fila_pendentes
  ON acesso_fila_push (dispositivo_id, id) WHERE status IN ('pendente', 'enviado');
