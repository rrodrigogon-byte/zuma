-- Migration 014 — CRM Avançado, RH/Comissões e Portal do Cliente
-- SetPoint Ultra · P5, P6, P9, P10

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- CRM — Funil de Vendas
-- ─────────────────────────────────────────────────────────────────────────────

-- Criar tabela clientes se não existir (alias de membros_clube para ERP)
CREATE TABLE IF NOT EXISTS clientes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome            VARCHAR(200) NOT NULL,
  cpf_cnpj        VARCHAR(20),
  telefone        VARCHAR(20),
  email           VARCHAR(200),
  cidade          VARCHAR(100),
  uf              VARCHAR(2),
  endereco_logradouro VARCHAR(200),
  endereco_numero VARCHAR(20),
  endereco_bairro VARCHAR(100),
  cep             VARCHAR(10),
  razao_social    VARCHAR(200),
  inscricao_estadual VARCHAR(30),
  tags            JSONB DEFAULT '[]',
  ativo           BOOLEAN DEFAULT true,
  criado_em       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS funis_venda (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome        VARCHAR(100) NOT NULL,
  descricao   TEXT,
  ativo       BOOLEAN DEFAULT true,
  criado_em   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS etapas_funil (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funil_id    UUID NOT NULL REFERENCES funis_venda(id) ON DELETE CASCADE,
  empresa_id  UUID NOT NULL,
  nome        VARCHAR(100) NOT NULL,
  ordem       INTEGER NOT NULL,
  cor         VARCHAR(20) DEFAULT '#6366f1',
  probabilidade INTEGER DEFAULT 50 CHECK (probabilidade BETWEEN 0 AND 100),
  criado_em   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oportunidades (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id              UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  cliente_id              UUID REFERENCES clientes(id),
  etapa_id                UUID NOT NULL REFERENCES etapas_funil(id),
  responsavel_id          UUID,
  titulo                  VARCHAR(200) NOT NULL,
  valor_estimado          NUMERIC(12,2),
  data_fechamento_prevista DATE,
  temperatura             VARCHAR(20) DEFAULT 'morno' CHECK (temperatura IN ('frio','morno','quente')),
  origem                  VARCHAR(50) DEFAULT 'manual',
  status                  VARCHAR(20) DEFAULT 'aberta' CHECK (status IN ('aberta','ganha','perdida','suspensa')),
  observacoes             TEXT,
  criado_em               TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS historico_oportunidade (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oportunidade_id     UUID NOT NULL REFERENCES oportunidades(id) ON DELETE CASCADE,
  etapa_anterior_id   UUID,
  etapa_nova_id       UUID,
  motivo              TEXT,
  criado_em           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tarefas_crm (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID NOT NULL,
  oportunidade_id UUID REFERENCES oportunidades(id) ON DELETE CASCADE,
  titulo          VARCHAR(200) NOT NULL,
  responsavel_id  UUID,
  prazo_dias      INTEGER DEFAULT 1,
  concluida       BOOLEAN DEFAULT false,
  criado_em       TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- CRM — Campanhas e Régua de Relacionamento
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS automacoes_crm (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  etapa_gatilho_id    UUID REFERENCES etapas_funil(id),
  tipo_acao           VARCHAR(30) NOT NULL CHECK (tipo_acao IN ('whatsapp','email','tarefa','notificacao')),
  mensagem_template   TEXT,
  tarefa_titulo       VARCHAR(200),
  tarefa_prazo_dias   INTEGER DEFAULT 1,
  ativa               BOOLEAN DEFAULT true,
  criado_em           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campanhas_crm (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id              UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome                    VARCHAR(200) NOT NULL,
  tipo                    VARCHAR(20) DEFAULT 'whatsapp' CHECK (tipo IN ('whatsapp','email','sms')),
  mensagem                TEXT NOT NULL,
  segmento_criterios      JSONB DEFAULT '{}',
  data_envio_programado   TIMESTAMPTZ,
  status                  VARCHAR(20) DEFAULT 'rascunho' CHECK (status IN ('rascunho','agendada','enviada','cancelada')),
  qtd_enviados            INTEGER DEFAULT 0,
  qtd_falhas              INTEGER DEFAULT 0,
  enviado_em              TIMESTAMPTZ,
  criado_em               TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS envios_campanha (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id UUID NOT NULL REFERENCES campanhas_crm(id) ON DELETE CASCADE,
  cliente_id  UUID NOT NULL REFERENCES clientes(id),
  status      VARCHAR(20) DEFAULT 'enviado',
  enviado_em  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS regua_relacionamento (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome                VARCHAR(200) NOT NULL,
  tipo_gatilho        VARCHAR(30) NOT NULL CHECK (tipo_gatilho IN ('sem_compra','aniversario','pos_compra','vencimento')),
  dias_gatilho        INTEGER NOT NULL DEFAULT 30,
  tipo_acao           VARCHAR(20) DEFAULT 'whatsapp',
  mensagem_template   TEXT NOT NULL,
  ativa               BOOLEAN DEFAULT true,
  criado_em           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS envios_regua (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID NOT NULL,
  regra_id    UUID NOT NULL REFERENCES regua_relacionamento(id) ON DELETE CASCADE,
  cliente_id  UUID NOT NULL REFERENCES clientes(id),
  enviado_em  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- RH — Colaboradores e Comissões
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS departamentos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome        VARCHAR(100) NOT NULL,
  criado_em   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS colaboradores (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome                VARCHAR(200) NOT NULL,
  cpf                 VARCHAR(14),
  rg                  VARCHAR(20),
  data_nascimento     DATE,
  data_admissao       DATE,
  data_demissao       DATE,
  cargo               VARCHAR(100),
  departamento_id     UUID REFERENCES departamentos(id),
  salario_base        NUMERIC(10,2) DEFAULT 0,
  tipo_comissao       VARCHAR(20) DEFAULT 'percentual' CHECK (tipo_comissao IN ('percentual','meta','fixo','nenhum')),
  percentual_comissao NUMERIC(5,2) DEFAULT 0,
  meta_mensal         NUMERIC(12,2) DEFAULT 0,
  email               VARCHAR(200),
  telefone            VARCHAR(20),
  ativo               BOOLEAN DEFAULT true,
  criado_em           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comissoes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  colaborador_id  UUID NOT NULL REFERENCES colaboradores(id),
  mes             INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano             INTEGER NOT NULL,
  total_vendas    NUMERIC(12,2) DEFAULT 0,
  valor_comissao  NUMERIC(10,2) DEFAULT 0,
  status          VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','pago')),
  pago_em         TIMESTAMPTZ,
  criado_em       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (empresa_id, colaborador_id, mes, ano)
);

CREATE TABLE IF NOT EXISTS metas_vendedor (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID NOT NULL,
  colaborador_id  UUID NOT NULL REFERENCES colaboradores(id),
  mes             INTEGER NOT NULL,
  ano             INTEGER NOT NULL,
  meta_valor      NUMERIC(12,2) DEFAULT 0,
  meta_qtd        INTEGER DEFAULT 0,
  criado_em       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (empresa_id, colaborador_id, mes, ano)
);

-- Adicionar coluna vendedor_id em vendas se não existir
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vendas' AND column_name='vendedor_id') THEN
    ALTER TABLE vendas ADD COLUMN vendedor_id UUID REFERENCES colaboradores(id);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Portal do Cliente — Tokens de acesso e pontos de fidelidade
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS portal_cliente_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  cliente_id  UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  token       VARCHAR(64) NOT NULL UNIQUE,
  expira_em   TIMESTAMPTZ NOT NULL,
  criado_em   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS programa_fidelidade (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  cliente_id      UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  pontos          INTEGER DEFAULT 0,
  nivel           VARCHAR(20) DEFAULT 'Bronze' CHECK (nivel IN ('Bronze','Prata','Ouro','Platina','Diamante')),
  total_gasto     NUMERIC(12,2) DEFAULT 0,
  criado_em       TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (empresa_id, cliente_id)
);

CREATE TABLE IF NOT EXISTS extrato_pontos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID NOT NULL,
  cliente_id  UUID NOT NULL REFERENCES clientes(id),
  tipo        VARCHAR(20) NOT NULL CHECK (tipo IN ('credito','debito','expiracao')),
  pontos      INTEGER NOT NULL,
  descricao   VARCHAR(200),
  referencia_id UUID,
  criado_em   TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Índices de performance
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_oportunidades_empresa ON oportunidades(empresa_id);
CREATE INDEX IF NOT EXISTS idx_oportunidades_etapa ON oportunidades(etapa_id);
CREATE INDEX IF NOT EXISTS idx_oportunidades_cliente ON oportunidades(cliente_id);
CREATE INDEX IF NOT EXISTS idx_campanhas_empresa ON campanhas_crm(empresa_id);
CREATE INDEX IF NOT EXISTS idx_colaboradores_empresa ON colaboradores(empresa_id);
CREATE INDEX IF NOT EXISTS idx_comissoes_colaborador ON comissoes(colaborador_id, mes, ano);
CREATE INDEX IF NOT EXISTS idx_programa_fidelidade ON programa_fidelidade(empresa_id, cliente_id);
CREATE INDEX IF NOT EXISTS idx_portal_tokens ON portal_cliente_tokens(token);

COMMIT;
