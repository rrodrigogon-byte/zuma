-- Migration 076: Kytto Clube & Academia — Item 4 (régua de retenção pela IA no WhatsApp).
-- Estritamente aditiva: só tabelas novas do Clube e colunas novas em tabelas do próprio Clube (073).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Dados comerciais do plano (valor para receita em risco/recuperada, fidelidade, regra de congelamento).
ALTER TABLE acesso_planos ADD COLUMN IF NOT EXISTS valor_mensal NUMERIC(10, 2);
ALTER TABLE acesso_planos ADD COLUMN IF NOT EXISTS fidelidade_meses INTEGER;
ALTER TABLE acesso_planos ADD COLUMN IF NOT EXISTS congelamento_max_dias_ano INTEGER NOT NULL DEFAULT 30;
ALTER TABLE acesso_planos ADD COLUMN IF NOT EXISTS congelamento_min_dias INTEGER NOT NULL DEFAULT 7;
-- NOT VALID + VALIDATE: a checagem das linhas existentes não segura trava exclusiva na tabela
ALTER TABLE acesso_planos DROP CONSTRAINT IF EXISTS chk_acesso_plano_comercial;
ALTER TABLE acesso_planos ADD CONSTRAINT chk_acesso_plano_comercial CHECK (
  (valor_mensal IS NULL OR valor_mensal >= 0) AND (fidelidade_meses IS NULL OR fidelidade_meses BETWEEN 1 AND 60)
  AND congelamento_max_dias_ano BETWEEN 0 AND 180 AND congelamento_min_dias BETWEEN 1 AND 90
) NOT VALID;
ALTER TABLE acesso_planos VALIDATE CONSTRAINT chk_acesso_plano_comercial;

-- Datas da matrícula que a régua usa (início, fim da fidelidade, saída, congelamento).
-- início: matrículas antigas herdam a data em que foram criadas (nunca a data do deploy, que faria
-- a régua tratar alunos antigos como novos ou sumidos)
ALTER TABLE acesso_matriculas ADD COLUMN IF NOT EXISTS inicio DATE;
UPDATE acesso_matriculas SET inicio = (criado_em AT TIME ZONE 'America/Cuiaba')::date WHERE inicio IS NULL;
ALTER TABLE acesso_matriculas ALTER COLUMN inicio SET DEFAULT CURRENT_DATE;
ALTER TABLE acesso_matriculas ALTER COLUMN inicio SET NOT NULL;
ALTER TABLE acesso_matriculas ADD COLUMN IF NOT EXISTS fim_fidelidade DATE;
ALTER TABLE acesso_matriculas ADD COLUMN IF NOT EXISTS cancelada_em TIMESTAMPTZ;
ALTER TABLE acesso_matriculas ADD COLUMN IF NOT EXISTS congelada_ate DATE;

-- Atributos do aluno que o Commerce não tem (o cadastro principal continua em commerce_customers).
CREATE TABLE IF NOT EXISTS clube_pessoas (
  empresa_id      UUID NOT NULL,
  customer_id     UUID NOT NULL,
  data_nascimento DATE,
  objetivo        VARCHAR(200),
  observacoes     VARCHAR(500),        -- lesão, restrição: aparece para o professor
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (empresa_id, customer_id)
);

-- Configuração geral da régua por academia.
CREATE TABLE IF NOT EXISTS clube_retencao_config (
  empresa_id         UUID PRIMARY KEY,
  ativo              BOOLEAN NOT NULL DEFAULT false,      -- começa desligada: a academia liga no painel
  tom                VARCHAR(12) NOT NULL DEFAULT 'proximo',
  intervalo_dias     INTEGER NOT NULL DEFAULT 3,          -- no máximo 1 mensagem por aluno a cada N dias
  hora_inicio        INTEGER NOT NULL DEFAULT 8,
  hora_fim           INTEGER NOT NULL DEFAULT 20,
  envia_domingo      BOOLEAN NOT NULL DEFAULT false,
  limite_diario      INTEGER NOT NULL DEFAULT 80,         -- mensagens proativas por dia (número conectado por QR)
  pausa_resposta_dias INTEGER NOT NULL DEFAULT 3,         -- aluno respondeu: régua pausa N dias
  fuso               VARCHAR(60) NOT NULL DEFAULT 'America/Cuiaba',
  telefone_gestor    VARCHAR(30),                         -- recebe as ocorrências (humano)
  multa_percentual   NUMERIC(5, 2) NOT NULL DEFAULT 2,    -- CDC art. 52 §1º: até 2%
  juros_mes_percentual NUMERIC(5, 2) NOT NULL DEFAULT 1,
  acordo_max_parcelas INTEGER NOT NULL DEFAULT 3,
  acordo_max_dias_promessa INTEGER NOT NULL DEFAULT 10,
  mimo_aniversario   VARCHAR(160),
  oferta_volta       VARCHAR(160),
  oferta_renovacao   VARCHAR(160),
  ativada_em         TIMESTAMPTZ,
  -- base legal das mensagens de marketing (LGPD art. 7º): 'consentimento' (padrão, só para quem
  -- autorizou) ou 'legitimo_interesse' (alunos ativos, com opção de sair; decisão do controlador)
  base_legal_marketing VARCHAR(20) NOT NULL DEFAULT 'consentimento',                         -- 1ª vez que a régua foi ligada (pesquisa da 1ª semana só para quem entrou depois)
  atualizado_em      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_clube_ret_config CHECK (
    tom IN ('formal', 'proximo', 'divertido') AND intervalo_dias BETWEEN 1 AND 30
    AND hora_inicio BETWEEN 0 AND 23 AND hora_fim BETWEEN 1 AND 24 AND hora_fim > hora_inicio
    AND limite_diario BETWEEN 0 AND 5000 AND pausa_resposta_dias BETWEEN 0 AND 30
    AND multa_percentual BETWEEN 0 AND 2 AND juros_mes_percentual BETWEEN 0 AND 1
    AND acordo_max_parcelas BETWEEN 1 AND 12 AND acordo_max_dias_promessa BETWEEN 0 AND 30
    AND base_legal_marketing IN ('consentimento', 'legitimo_interesse')
  )
);

-- Cada gatilho pode ser ligado/desligado e ter parâmetros e textos próprios.
CREATE TABLE IF NOT EXISTS clube_retencao_reguas (
  empresa_id  UUID NOT NULL,
  gatilho     VARCHAR(30) NOT NULL,
  ativo       BOOLEAN NOT NULL DEFAULT true,
  parametros  JSONB NOT NULL DEFAULT '{}'::jsonb,
  textos      JSONB,                                      -- substitui os textos base (lista de variações)
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (empresa_id, gatilho)
);

-- Cada mensagem proativa enviada (ou barrada) e o que aconteceu depois.
CREATE TABLE IF NOT EXISTS clube_retencao_disparos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID NOT NULL,
  customer_id     UUID NOT NULL,
  gatilho         VARCHAR(30) NOT NULL,
  chave           VARCHAR(120) NOT NULL,                  -- episódio do gatilho (nunca dispara 2x o mesmo)
  texto           TEXT NOT NULL,
  status          VARCHAR(12) NOT NULL DEFAULT 'enviado',
  resultado       VARCHAR(12),
  valor_risco     NUMERIC(10, 2),                         -- quanto estava em jogo (mensalidade/valor devido)
  valor_recuperado NUMERIC(10, 2),
  enviado_em      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  respondido_em   TIMESTAMPTZ,
  resolvido_em    TIMESTAMPTZ,
  erro            VARCHAR(240),
  tentativas      INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT uq_clube_ret_disparo UNIQUE (empresa_id, customer_id, chave),
  CONSTRAINT chk_clube_ret_disparo_status CHECK (status IN ('enviado', 'respondeu', 'resolvido', 'falhou', 'optout')),
  CONSTRAINT chk_clube_ret_disparo_resultado CHECK (resultado IS NULL OR resultado IN ('pagou', 'voltou', 'renovou', 'reservou', 'matriculou', 'congelou', 'acordo', 'avaliou'))
);
CREATE INDEX IF NOT EXISTS idx_clube_ret_disparos_cliente ON clube_retencao_disparos (empresa_id, customer_id, enviado_em DESC);
CREATE INDEX IF NOT EXISTS idx_clube_ret_disparos_periodo ON clube_retencao_disparos (empresa_id, enviado_em);

-- Estado de contato do aluno com a régua (pausa por resposta e opt-out de marketing).
CREATE TABLE IF NOT EXISTS clube_retencao_contatos (
  empresa_id        UUID NOT NULL,
  customer_id       UUID NOT NULL,
  ultima_resposta_em TIMESTAMPTZ,
  optout_em         TIMESTAMPTZ,                         -- só marketing; cobrança informativa continua
  optout_texto      VARCHAR(200),
  promessa_ate      DATE,                                -- promessa de pagamento: pausa a cobrança até a data
  marketing_consentido_em TIMESTAMPTZ,                  -- autorização para mensagens de marketing no WhatsApp
  marketing_evidencia JSONB,                             -- como foi dada (contrato, recepção, conversa), por quem, quando
  link_pagamento    VARCHAR(500),                        -- link aberto reaproveitado (evita várias cobranças da mesma dívida)
  link_valor        NUMERIC(10, 2),
  link_criado_em    TIMESTAMPTZ,
  PRIMARY KEY (empresa_id, customer_id)
);

-- Risco de saída calculado 1x por dia por matrícula ativa.
CREATE TABLE IF NOT EXISTS clube_retencao_score (
  empresa_id  UUID NOT NULL,
  customer_id UUID NOT NULL,
  dia         DATE NOT NULL,
  risco       INTEGER NOT NULL,
  fatores     JSONB NOT NULL,
  PRIMARY KEY (empresa_id, customer_id, dia),
  CONSTRAINT chk_clube_ret_score CHECK (risco BETWEEN 0 AND 100)
);
CREATE INDEX IF NOT EXISTS idx_clube_ret_score_dia ON clube_retencao_score (empresa_id, dia, risco DESC);

-- Motivos de saída (relatório de churn) e notas da pesquisa pós-aula.
CREATE TABLE IF NOT EXISTS clube_retencao_motivos (
  id          BIGSERIAL PRIMARY KEY,
  empresa_id  UUID NOT NULL,
  customer_id UUID NOT NULL,
  categoria   VARCHAR(20) NOT NULL,
  detalhe     VARCHAR(300),
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_clube_ret_motivo CHECK (categoria IN ('preco', 'horario', 'mudanca', 'saude', 'resultado', 'atendimento', 'estrutura', 'tempo', 'outro'))
);
CREATE INDEX IF NOT EXISTS idx_clube_ret_motivos ON clube_retencao_motivos (empresa_id, criado_em);

CREATE TABLE IF NOT EXISTS clube_retencao_notas (
  id          BIGSERIAL PRIMARY KEY,
  empresa_id  UUID NOT NULL,
  customer_id UUID NOT NULL,
  nota        INTEGER NOT NULL,
  comentario  VARCHAR(500),
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_clube_ret_nota CHECK (nota BETWEEN 0 AND 10)
);

-- Ocorrências para humano: reclamação, cancelamento com conflito, saúde, nota baixa, acordo fora da regra.
CREATE TABLE IF NOT EXISTS clube_retencao_ocorrencias (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   UUID NOT NULL,
  customer_id  UUID NOT NULL,
  tipo         VARCHAR(20) NOT NULL,
  descricao    VARCHAR(500) NOT NULL,
  status       VARCHAR(12) NOT NULL DEFAULT 'aberta',
  responsavel  VARCHAR(120),
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolvido_em TIMESTAMPTZ,
  solucao      VARCHAR(500),
  CONSTRAINT chk_clube_ret_ocorr_tipo CHECK (tipo IN ('cancelamento', 'reclamacao', 'saude', 'nota_baixa', 'acordo', 'outro')),
  CONSTRAINT chk_clube_ret_ocorr_status CHECK (status IN ('aberta', 'em_andamento', 'resolvida'))
);
CREATE INDEX IF NOT EXISTS idx_clube_ret_ocorr_abertas ON clube_retencao_ocorrencias (empresa_id, criado_em DESC) WHERE status <> 'resolvida';

-- Acordos de pagamento feitos pela IA (parcelamento ou promessa), sempre dentro da regra da academia.
CREATE TABLE IF NOT EXISTS clube_retencao_acordos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   UUID NOT NULL,
  customer_id  UUID NOT NULL,
  tipo         VARCHAR(12) NOT NULL,
  valor_total  NUMERIC(10, 2) NOT NULL,
  parcelas     INTEGER NOT NULL DEFAULT 1,
  promessa_ate DATE,
  link         VARCHAR(500),
  valor_pago   NUMERIC(10, 2) NOT NULL DEFAULT 0,
  status       VARCHAR(12) NOT NULL DEFAULT 'aberto',
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_clube_ret_acordo CHECK (tipo IN ('parcelamento', 'promessa') AND parcelas BETWEEN 1 AND 12 AND status IN ('aberto', 'cumprido', 'quebrado'))
);

-- Interessados que não fecharam (visita, pedido de preço, aula experimental).
CREATE TABLE IF NOT EXISTS clube_prospects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    UUID NOT NULL,
  customer_id   UUID NOT NULL,
  origem        VARCHAR(20) NOT NULL,
  interesse     VARCHAR(200),
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  convertido_em TIMESTAMPTZ,
  perdido_em    TIMESTAMPTZ,
  CONSTRAINT chk_clube_prospect_origem CHECK (origem IN ('visita', 'preco', 'experimental', 'indicacao', 'parceiro', 'outro'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_clube_prospect_aberto ON clube_prospects (empresa_id, customer_id) WHERE convertido_em IS NULL AND perdido_em IS NULL;

-- Congelamentos (pausa do plano): estendem o "pago até" pelos dias congelados.
CREATE TABLE IF NOT EXISTS clube_congelamentos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   UUID NOT NULL,
  matricula_id UUID NOT NULL REFERENCES acesso_matriculas(id),
  customer_id  UUID NOT NULL,
  inicio       DATE NOT NULL,
  fim          DATE NOT NULL,
  dias         INTEGER NOT NULL,
  origem       VARCHAR(12) NOT NULL DEFAULT 'whatsapp',
  contrato_id  UUID,                                     -- termo aditivo (item 3), quando a academia tem modelo
  status       VARCHAR(12) NOT NULL DEFAULT 'ativo',
  iniciado_em  TIMESTAMPTZ,                             -- a rotina só começa congelamentos ainda não iniciados
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_clube_congelamento CHECK (fim >= inicio AND dias BETWEEN 1 AND 180 AND status IN ('ativo', 'encerrado', 'cancelado'))
);
CREATE INDEX IF NOT EXISTS idx_clube_congelamentos ON clube_congelamentos (empresa_id, customer_id, inicio);

-- Pagamentos recebidos de fora do painel (Pix da academia, crediário, gateway): idempotência por id.
-- Reentrega não estende o acesso nem soma receita duas vezes. `nova_data` guarda o "pago até"
-- calculado ANTES de aplicar: uma baixa que falhou no meio é retomada com a mesma data.
CREATE TABLE IF NOT EXISTS clube_pagamentos_recebidos (
  empresa_id   UUID NOT NULL,
  pagamento_id VARCHAR(120) NOT NULL,
  customer_id  UUID NOT NULL,
  valor        NUMERIC(10, 2),
  nova_data    DATE,
  resultado    JSONB,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (empresa_id, pagamento_id)
);
