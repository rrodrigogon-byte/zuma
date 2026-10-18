-- Migration 074: Kytto Clube & Academia — Item 3 (contrato digital com aceite eletrônico).
-- Estritamente aditiva (tabelas com prefixo clube_ para não colidir com nada existente).
-- Evidências em cadeia de hash, tabela só de inserção e contrato aceito imutável, garantidos no banco.
-- Corpos plpgsql em uma linha: o runner remove BEGIN/COMMIT de topo e não pode confundir com o BEGIN da função.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Modelos versionados: editar cria nova versão; contratos emitidos guardam o texto final.
CREATE TABLE IF NOT EXISTS clube_contrato_modelos (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id         UUID NOT NULL,
  codigo             VARCHAR(60) NOT NULL,
  versao             INTEGER NOT NULL,
  titulo             VARCHAR(160) NOT NULL,
  corpo              TEXT NOT NULL,
  clausulas_destaque JSONB NOT NULL DEFAULT '[]'::jsonb,
  prazo_aceite_dias  INTEGER NOT NULL DEFAULT 7,
  ativo              BOOLEAN NOT NULL DEFAULT true,
  criado_por         VARCHAR(80),
  criado_em          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_clube_contrato_modelo_versao UNIQUE (empresa_id, codigo, versao),
  CONSTRAINT uq_clube_contrato_modelo_empresa_id UNIQUE (empresa_id, id),
  CONSTRAINT chk_clube_contrato_modelo_prazo CHECK (prazo_aceite_dias BETWEEN 1 AND 60),
  CONSTRAINT chk_clube_contrato_modelo_destaques CHECK (jsonb_typeof(clausulas_destaque) = 'array')
);
CREATE INDEX IF NOT EXISTS idx_clube_contrato_modelos_ativos
  ON clube_contrato_modelos (empresa_id, codigo, versao DESC) WHERE ativo;

CREATE TABLE IF NOT EXISTS clube_contratos (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id             UUID NOT NULL,
  customer_id            UUID NOT NULL,          -- aluno
  signatario_customer_id UUID NOT NULL,          -- quem aceita (o próprio aluno ou o responsável legal)
  modelo_id              UUID NOT NULL,
  matricula_id           UUID,
  tipo                   VARCHAR(20) NOT NULL DEFAULT 'matricula',
  titulo                 VARCHAR(160) NOT NULL,
  conteudo               TEXT NOT NULL,          -- texto final renderizado
  clausulas_destaque     JSONB NOT NULL,         -- cópia congelada das cláusulas de destaque
  hash_conteudo          CHAR(64) NOT NULL,      -- SHA-256 de conteúdo + destaques (JSON canônico)
  token_hash             CHAR(64) NOT NULL,      -- hash do token do link de aceite
  status                 VARCHAR(20) NOT NULL DEFAULT 'enviado',
  prazo_aceite_em        TIMESTAMPTZ NOT NULL,
  codigo_hash            CHAR(64),               -- HMAC com segredo do servidor (nunca exposto)
  codigo_expira_em       TIMESTAMPTZ,
  codigo_tentativas      INTEGER NOT NULL DEFAULT 0,
  codigos_emitidos       INTEGER NOT NULL DEFAULT 0,
  erros_codigo_total     INTEGER NOT NULL DEFAULT 0,
  link_renovado_em       TIMESTAMPTZ,
  lembretes_enviados     INTEGER NOT NULL DEFAULT 0,
  ultimo_lembrete_em     TIMESTAMPTZ,
  hash_evidencias        CHAR(64),               -- SHA-256 do comprovante (conteúdo + evidências + último elo da cadeia)
  enviado_em             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  aceito_em              TIMESTAMPTZ,
  cancelado_em           TIMESTAMPTZ,
  CONSTRAINT fk_clube_contrato_modelo FOREIGN KEY (empresa_id, modelo_id) REFERENCES clube_contrato_modelos (empresa_id, id),
  CONSTRAINT uq_clube_contrato_empresa_id UNIQUE (empresa_id, id),
  CONSTRAINT chk_clube_contrato_status CHECK (status IN ('enviado', 'aceito', 'cancelado')),
  CONSTRAINT chk_clube_contrato_tipo CHECK (tipo IN ('matricula', 'aditivo', 'cancelamento')),
  CONSTRAINT chk_clube_contrato_aceito CHECK (status <> 'aceito' OR (aceito_em IS NOT NULL AND hash_evidencias IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_clube_contrato_token ON clube_contratos (token_hash);
CREATE INDEX IF NOT EXISTS idx_clube_contratos_customer ON clube_contratos (empresa_id, customer_id, enviado_em DESC);
CREATE INDEX IF NOT EXISTS idx_clube_contratos_pendentes ON clube_contratos (empresa_id, prazo_aceite_em) WHERE status = 'enviado';
CREATE INDEX IF NOT EXISTS idx_clube_contratos_hash ON clube_contratos (hash_evidencias) WHERE hash_evidencias IS NOT NULL;

-- Trilha de evidências: só inserção, cada registro encadeado ao anterior do mesmo contrato.
-- Os índices únicos impedem bifurcação da cadeia (dois eventos apontando para o mesmo anterior).
CREATE TABLE IF NOT EXISTS clube_contrato_eventos (
  id            BIGSERIAL PRIMARY KEY,
  empresa_id    UUID NOT NULL,
  contrato_id   UUID NOT NULL,
  tipo          VARCHAR(30) NOT NULL,
  dados         JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip            VARCHAR(64),
  user_agent    VARCHAR(300),
  ocorrido_em   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  hash_anterior CHAR(64),
  hash          CHAR(64) NOT NULL,
  CONSTRAINT fk_clube_contrato_evento FOREIGN KEY (empresa_id, contrato_id) REFERENCES clube_contratos (empresa_id, id),
  CONSTRAINT chk_clube_contrato_evento_tipo CHECK (tipo IN (
    'gerado', 'enviado', 'aberto', 'codigo_enviado', 'codigo_invalido', 'clausula_marcada',
    'aceito', 'lembrete', 'cancelado', 'bloqueado'
  ))
);
CREATE INDEX IF NOT EXISTS idx_clube_contrato_eventos_contrato ON clube_contrato_eventos (contrato_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_clube_contrato_eventos_elo
  ON clube_contrato_eventos (contrato_id, hash_anterior) WHERE hash_anterior IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_clube_contrato_eventos_primeiro
  ON clube_contrato_eventos (contrato_id) WHERE hash_anterior IS NULL;

CREATE OR REPLACE FUNCTION clube_contrato_eventos_imutavel() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'clube_contrato_eventos é somente inserção (evidência jurídica)'; END; $$;

DROP TRIGGER IF EXISTS trg_clube_contrato_eventos_imutavel ON clube_contrato_eventos;
CREATE TRIGGER trg_clube_contrato_eventos_imutavel
  BEFORE UPDATE OR DELETE ON clube_contrato_eventos
  FOR EACH ROW EXECUTE FUNCTION clube_contrato_eventos_imutavel();

DROP TRIGGER IF EXISTS trg_clube_contrato_eventos_sem_truncate ON clube_contrato_eventos;
CREATE TRIGGER trg_clube_contrato_eventos_sem_truncate
  BEFORE TRUNCATE ON clube_contrato_eventos
  FOR EACH STATEMENT EXECUTE FUNCTION clube_contrato_eventos_imutavel();

-- Conteúdo nunca muda depois de emitido. Contrato aceito: nada que prove o aceite muda, inclusive o status.
CREATE OR REPLACE FUNCTION clube_contratos_protege_aceito() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF TG_OP = 'DELETE' THEN IF OLD.status = 'aceito' THEN RAISE EXCEPTION 'contrato aceito é imutável'; END IF; RETURN OLD; END IF; IF OLD.status = 'aceito' AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.conteudo IS DISTINCT FROM OLD.conteudo OR NEW.hash_conteudo IS DISTINCT FROM OLD.hash_conteudo OR NEW.hash_evidencias IS DISTINCT FROM OLD.hash_evidencias OR NEW.clausulas_destaque IS DISTINCT FROM OLD.clausulas_destaque OR NEW.aceito_em IS DISTINCT FROM OLD.aceito_em OR NEW.titulo IS DISTINCT FROM OLD.titulo OR NEW.customer_id IS DISTINCT FROM OLD.customer_id OR NEW.signatario_customer_id IS DISTINCT FROM OLD.signatario_customer_id OR NEW.empresa_id IS DISTINCT FROM OLD.empresa_id) THEN RAISE EXCEPTION 'contrato aceito é imutável'; END IF; IF NEW.conteudo IS DISTINCT FROM OLD.conteudo OR NEW.hash_conteudo IS DISTINCT FROM OLD.hash_conteudo OR NEW.clausulas_destaque IS DISTINCT FROM OLD.clausulas_destaque THEN RAISE EXCEPTION 'conteúdo do contrato é imutável depois de emitido'; END IF; RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_clube_contratos_protege_aceito ON clube_contratos;
CREATE TRIGGER trg_clube_contratos_protege_aceito
  BEFORE UPDATE OR DELETE ON clube_contratos
  FOR EACH ROW EXECUTE FUNCTION clube_contratos_protege_aceito();

CREATE OR REPLACE FUNCTION clube_contratos_sem_truncate() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'clube_contratos não pode ser truncada'; END; $$;

DROP TRIGGER IF EXISTS trg_clube_contratos_sem_truncate ON clube_contratos;
CREATE TRIGGER trg_clube_contratos_sem_truncate
  BEFORE TRUNCATE ON clube_contratos
  FOR EACH STATEMENT EXECUTE FUNCTION clube_contratos_sem_truncate();
