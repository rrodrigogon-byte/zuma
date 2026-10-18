-- Migration 077: Kytto Clube & Academia — Item 2 (Wellhub e TotalPass).
-- Estritamente aditiva: só tabelas novas do Clube.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Conta da academia em cada plataforma (uma por unidade). A credencial da unidade (place_api_key
-- do TotalPass) fica cifrada com CLUBE_PARCEIROS_SECRET (AES-256-GCM); o segredo da URL do webhook
-- fica só como hash.
CREATE TABLE IF NOT EXISTS clube_parceiro_contas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          UUID NOT NULL,
  unidade_id          UUID,
  plataforma          VARCHAR(12) NOT NULL,
  nome                VARCHAR(120) NOT NULL,
  id_externo          VARCHAR(80) NOT NULL,           -- Wellhub: gym_id; TotalPass: código da unidade (place code)
  credencial_cifrada  TEXT,                           -- TotalPass: place_api_key cifrada
  webhook_segredo_hash VARCHAR(64) NOT NULL,
  modo                VARCHAR(12) NOT NULL DEFAULT 'catraca',  -- catraca: valida na passagem; sem_catraca: valida ao receber
  ambiente            VARCHAR(10) NOT NULL DEFAULT 'sandbox',
  validade_min        INTEGER NOT NULL DEFAULT 20,    -- Wellhub: o check-in precisa ser validado em até 20 min
  ativo               BOOLEAN NOT NULL DEFAULT true,
  -- posse comprovada: só vira true quando chega o 1º webhook válido na URL com segredo desta conta
  -- (que só o dono consegue cadastrar no portal da plataforma). A URL única do Wellhub só roteia
  -- para contas verificadas, então cadastrar o Gym ID de outra academia não desvia nada.
  verificada          BOOLEAN NOT NULL DEFAULT false,
  verificada_em       TIMESTAMPTZ,
  ultimo_webhook_em   TIMESTAMPTZ,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_clube_parceiro_conta_empresa UNIQUE (empresa_id, plataforma, id_externo),
  CONSTRAINT chk_clube_parceiro_conta CHECK (
    plataforma IN ('wellhub', 'totalpass') AND modo IN ('catraca', 'sem_catraca')
    AND ambiente IN ('sandbox', 'producao') AND validade_min BETWEEN 5 AND 240
  )
);
CREATE INDEX IF NOT EXISTS idx_clube_parceiro_contas_empresa ON clube_parceiro_contas (empresa_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_clube_parceiro_conta_verificada ON clube_parceiro_contas (plataforma, id_externo) WHERE verificada;

-- Vínculo da pessoa com o id dela na plataforma (Wellhub ID / código TotalPass).
-- CPF nunca é guardado: só o HMAC dele, para reconhecer a pessoa de novo (LGPD, minimização).
CREATE TABLE IF NOT EXISTS clube_parceiro_pessoas (
  empresa_id   UUID NOT NULL,
  customer_id  UUID NOT NULL,
  plataforma   VARCHAR(12) NOT NULL,
  id_externo   VARCHAR(120) NOT NULL,
  documento_hmac VARCHAR(64),
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (empresa_id, plataforma, id_externo)
);
CREATE INDEX IF NOT EXISTS idx_clube_parceiro_pessoas_customer ON clube_parceiro_pessoas (empresa_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_clube_parceiro_pessoas_doc ON clube_parceiro_pessoas (empresa_id, documento_hmac) WHERE documento_hmac IS NOT NULL;

-- Cada check-in recebido e o ciclo dele até a validação na plataforma.
CREATE TABLE IF NOT EXISTS clube_parceiro_checkins (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          UUID NOT NULL,
  conta_id            UUID NOT NULL REFERENCES clube_parceiro_contas(id),
  plataforma          VARCHAR(12) NOT NULL,
  id_externo          VARCHAR(160) NOT NULL,          -- identificador do check-in na plataforma (dedupe)
  pessoa_externa      VARCHAR(120) NOT NULL,
  customer_id         UUID,
  produto             VARCHAR(80),
  recebido_em         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expira_em           TIMESTAMPTZ NOT NULL,
  passou_catraca_em   TIMESTAMPTZ,
  validado_em         TIMESTAMPTZ,
  status              VARCHAR(12) NOT NULL DEFAULT 'recebido',
  tentativas          INTEGER NOT NULL DEFAULT 0,
  proxima_tentativa_em TIMESTAMPTZ,
  validacao_cifrada   TEXT,                           -- TotalPass: URL de validação de uso único (cifrada)
  valor_esperado      NUMERIC(10, 2),
  resposta            JSONB,
  erro                VARCHAR(240),
  CONSTRAINT uq_clube_parceiro_checkin UNIQUE (conta_id, id_externo),
  CONSTRAINT chk_clube_parceiro_checkin CHECK (
    plataforma IN ('wellhub', 'totalpass')
    AND status IN ('recebido', 'validando', 'validado', 'expirado', 'falhou', 'retroativo', 'negado', 'sem_cadastro')
  )
);
CREATE INDEX IF NOT EXISTS idx_clube_parceiro_checkins_pessoa ON clube_parceiro_checkins (empresa_id, customer_id, recebido_em DESC);
CREATE INDEX IF NOT EXISTS idx_clube_parceiro_checkins_pendentes ON clube_parceiro_checkins (proxima_tentativa_em) WHERE status IN ('validando', 'falhou');
CREATE INDEX IF NOT EXISTS idx_clube_parceiro_checkins_mes ON clube_parceiro_checkins (empresa_id, plataforma, recebido_em);

-- Valor esperado por visita, por plataforma e produto/plano (para conciliação).
CREATE TABLE IF NOT EXISTS clube_parceiro_valores (
  empresa_id UUID NOT NULL,
  plataforma VARCHAR(12) NOT NULL,
  produto    VARCHAR(80) NOT NULL,              -- '*' = qualquer produto
  valor      NUMERIC(10, 2) NOT NULL,
  PRIMARY KEY (empresa_id, plataforma, produto),
  CONSTRAINT chk_clube_parceiro_valor CHECK (valor >= 0)
);

-- Relatório de repasse da plataforma, importado no fechamento do mês.
CREATE TABLE IF NOT EXISTS clube_parceiro_repasses (
  id          BIGSERIAL PRIMARY KEY,
  empresa_id  UUID NOT NULL,
  plataforma  VARCHAR(12) NOT NULL,
  mes         CHAR(7) NOT NULL,                 -- AAAA-MM
  id_externo  VARCHAR(160) NOT NULL,            -- check-in no relatório da plataforma
  data        DATE,
  valor_pago  NUMERIC(10, 2) NOT NULL,
  importado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_clube_parceiro_repasse UNIQUE (empresa_id, plataforma, mes, id_externo)
);

-- Passe de entrada por link (QR que muda a cada 30 s numa página): aluno de parceiro na 1ª visita,
-- ou qualquer aluno sem facial. O token do link fica só como hash.
CREATE TABLE IF NOT EXISTS clube_passes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID NOT NULL,
  customer_id UUID NOT NULL,
  token_hash  VARCHAR(64) NOT NULL UNIQUE,
  origem      VARCHAR(12) NOT NULL,
  expira_em   TIMESTAMPTZ NOT NULL,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_clube_passe_origem CHECK (origem IN ('wellhub', 'totalpass', 'aluno', 'diaria'))
);
CREATE INDEX IF NOT EXISTS idx_clube_passes_validos ON clube_passes (empresa_id, customer_id, expira_em DESC);
