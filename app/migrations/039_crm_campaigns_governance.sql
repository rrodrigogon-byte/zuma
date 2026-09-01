-- Campanhas CRM governadas: consentimento LGPD, preview, idempotência e métricas.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome VARCHAR(200) NOT NULL,
  cpf_cnpj VARCHAR(20),
  telefone VARCHAR(30),
  email VARCHAR(320),
  cidade VARCHAR(100),
  uf VARCHAR(2),
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_clientes_empresa_ativos ON clientes (empresa_id, ativo, criado_em DESC);

CREATE TABLE IF NOT EXISTS consentimentos_cliente (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  canal VARCHAR(20) NOT NULL,
  finalidade VARCHAR(30) NOT NULL,
  concedido BOOLEAN NOT NULL,
  origem VARCHAR(50) NOT NULL DEFAULT 'operador',
  evidencia JSONB NOT NULL DEFAULT '{}'::jsonb,
  atualizado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_consentimento_cliente UNIQUE (empresa_id, cliente_id, canal, finalidade)
);
CREATE INDEX IF NOT EXISTS idx_consentimentos_cliente_marketing
  ON consentimentos_cliente (empresa_id, canal, finalidade, concedido, cliente_id);

CREATE TABLE IF NOT EXISTS campanhas_crm (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID REFERENCES lojas(id) ON DELETE RESTRICT,
  canal_id UUID REFERENCES canais_integracao(id) ON DELETE SET NULL,
  nome VARCHAR(200) NOT NULL,
  tipo VARCHAR(20) NOT NULL DEFAULT 'whatsapp',
  mensagem TEXT NOT NULL,
  segmento_criterios JSONB NOT NULL DEFAULT '{}'::jsonb,
  data_envio_programado TIMESTAMPTZ,
  status VARCHAR(24) NOT NULL DEFAULT 'rascunho',
  qtd_enviados INTEGER NOT NULL DEFAULT 0,
  qtd_falhas INTEGER NOT NULL DEFAULT 0,
  qtd_elegiveis INTEGER NOT NULL DEFAULT 0,
  qtd_bloqueados INTEGER NOT NULL DEFAULT 0,
  qtd_entregues INTEGER NOT NULL DEFAULT 0,
  qtd_lidos INTEGER NOT NULL DEFAULT 0,
  qtd_respostas INTEGER NOT NULL DEFAULT 0,
  qtd_conversoes INTEGER NOT NULL DEFAULT 0,
  receita_atribuida NUMERIC(14,2) NOT NULL DEFAULT 0,
  preview_hash CHAR(64),
  confirmado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  confirmado_em TIMESTAMPTZ,
  enviado_em TIMESTAMPTZ,
  cancelado_em TIMESTAMPTZ,
  criado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE campanhas_crm ADD COLUMN IF NOT EXISTS loja_id UUID REFERENCES lojas(id) ON DELETE RESTRICT;
ALTER TABLE campanhas_crm ADD COLUMN IF NOT EXISTS canal_id UUID REFERENCES canais_integracao(id) ON DELETE SET NULL;
ALTER TABLE campanhas_crm ADD COLUMN IF NOT EXISTS qtd_elegiveis INTEGER NOT NULL DEFAULT 0;
ALTER TABLE campanhas_crm ADD COLUMN IF NOT EXISTS qtd_bloqueados INTEGER NOT NULL DEFAULT 0;
ALTER TABLE campanhas_crm ADD COLUMN IF NOT EXISTS qtd_entregues INTEGER NOT NULL DEFAULT 0;
ALTER TABLE campanhas_crm ADD COLUMN IF NOT EXISTS qtd_lidos INTEGER NOT NULL DEFAULT 0;
ALTER TABLE campanhas_crm ADD COLUMN IF NOT EXISTS qtd_respostas INTEGER NOT NULL DEFAULT 0;
ALTER TABLE campanhas_crm ADD COLUMN IF NOT EXISTS qtd_conversoes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE campanhas_crm ADD COLUMN IF NOT EXISTS receita_atribuida NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE campanhas_crm ADD COLUMN IF NOT EXISTS preview_hash CHAR(64);
ALTER TABLE campanhas_crm ADD COLUMN IF NOT EXISTS confirmado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL;
ALTER TABLE campanhas_crm ADD COLUMN IF NOT EXISTS confirmado_em TIMESTAMPTZ;
ALTER TABLE campanhas_crm ADD COLUMN IF NOT EXISTS cancelado_em TIMESTAMPTZ;
ALTER TABLE campanhas_crm ADD COLUMN IF NOT EXISTS criado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL;
ALTER TABLE campanhas_crm ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE campanhas_crm DROP CONSTRAINT IF EXISTS campanhas_crm_status_check;
ALTER TABLE campanhas_crm ADD CONSTRAINT campanhas_crm_status_check
  CHECK (status IN ('rascunho','confirmada','agendada','enviando','enviada','parcial','cancelada'));
ALTER TABLE campanhas_crm DROP CONSTRAINT IF EXISTS campanhas_crm_tipo_check;
ALTER TABLE campanhas_crm ADD CONSTRAINT campanhas_crm_tipo_check CHECK (tipo IN ('whatsapp','email','sms'));
CREATE INDEX IF NOT EXISTS idx_campanhas_crm_operacao
  ON campanhas_crm (empresa_id, loja_id, status, criado_em DESC);

CREATE TABLE IF NOT EXISTS envios_campanha (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campanha_id UUID NOT NULL REFERENCES campanhas_crm(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID REFERENCES lojas(id) ON DELETE RESTRICT,
  canal_id UUID REFERENCES canais_integracao(id) ON DELETE SET NULL,
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  canal VARCHAR(20) NOT NULL DEFAULT 'whatsapp',
  status VARCHAR(24) NOT NULL DEFAULT 'pendente',
  telefone_normalizado VARCHAR(20),
  mensagem_hash CHAR(64),
  idempotency_key VARCHAR(160),
  evento_externo_id VARCHAR(200),
  tentativas SMALLINT NOT NULL DEFAULT 0,
  erro TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  enviado_em TIMESTAMPTZ,
  entregue_em TIMESTAMPTZ,
  lido_em TIMESTAMPTZ,
  respondido_em TIMESTAMPTZ,
  convertido_em TIMESTAMPTZ,
  pedido_id UUID,
  receita_atribuida NUMERIC(14,2) NOT NULL DEFAULT 0,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE envios_campanha ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE;
ALTER TABLE envios_campanha ADD COLUMN IF NOT EXISTS loja_id UUID REFERENCES lojas(id) ON DELETE RESTRICT;
ALTER TABLE envios_campanha ADD COLUMN IF NOT EXISTS canal_id UUID REFERENCES canais_integracao(id) ON DELETE SET NULL;
ALTER TABLE envios_campanha ADD COLUMN IF NOT EXISTS canal VARCHAR(20) NOT NULL DEFAULT 'whatsapp';
ALTER TABLE envios_campanha ALTER COLUMN canal SET DEFAULT 'whatsapp';
ALTER TABLE envios_campanha ADD COLUMN IF NOT EXISTS telefone_normalizado VARCHAR(20);
ALTER TABLE envios_campanha ADD COLUMN IF NOT EXISTS mensagem_hash CHAR(64);
ALTER TABLE envios_campanha ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(160);
ALTER TABLE envios_campanha ADD COLUMN IF NOT EXISTS evento_externo_id VARCHAR(200);
ALTER TABLE envios_campanha ADD COLUMN IF NOT EXISTS tentativas SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE envios_campanha ADD COLUMN IF NOT EXISTS erro TEXT;
ALTER TABLE envios_campanha ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE envios_campanha ADD COLUMN IF NOT EXISTS entregue_em TIMESTAMPTZ;
ALTER TABLE envios_campanha ADD COLUMN IF NOT EXISTS lido_em TIMESTAMPTZ;
ALTER TABLE envios_campanha ADD COLUMN IF NOT EXISTS respondido_em TIMESTAMPTZ;
ALTER TABLE envios_campanha ADD COLUMN IF NOT EXISTS convertido_em TIMESTAMPTZ;
ALTER TABLE envios_campanha ADD COLUMN IF NOT EXISTS pedido_id UUID;
ALTER TABLE envios_campanha ADD COLUMN IF NOT EXISTS receita_atribuida NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE envios_campanha ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE envios_campanha ec
   SET empresa_id = c.empresa_id,
       loja_id = c.loja_id,
       canal_id = c.canal_id
  FROM campanhas_crm c
 WHERE ec.campanha_id = c.id
   AND (ec.empresa_id IS NULL OR ec.loja_id IS NULL OR ec.canal_id IS NULL);
ALTER TABLE envios_campanha DROP CONSTRAINT IF EXISTS envios_campanha_status_check;
ALTER TABLE envios_campanha ADD CONSTRAINT envios_campanha_status_check
  CHECK (status IN ('pendente','processando','enviado','entregue','lido','respondido','convertido','falha','bloqueado','cancelado'));
CREATE UNIQUE INDEX IF NOT EXISTS uq_envios_campanha_idempotency
  ON envios_campanha (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_envios_campanha_evento_externo
  ON envios_campanha (canal_id, evento_externo_id) WHERE evento_externo_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_envios_campanha_metricas
  ON envios_campanha (empresa_id, loja_id, campanha_id, status, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_envios_campanha_telefone
  ON envios_campanha (empresa_id, canal_id, telefone_normalizado, enviado_em DESC);

CREATE TABLE IF NOT EXISTS campanhas_crm_eventos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID REFERENCES lojas(id) ON DELETE SET NULL,
  campanha_id UUID NOT NULL REFERENCES campanhas_crm(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  tipo VARCHAR(40) NOT NULL,
  metadados JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_campanhas_crm_eventos
  ON campanhas_crm_eventos (empresa_id, campanha_id, criado_em DESC);

ALTER TABLE tarefas_integracao_canais DROP CONSTRAINT IF EXISTS tarefas_integracao_canais_tipo_check;
ALTER TABLE tarefas_integracao_canais DROP CONSTRAINT IF EXISTS chk_tarefas_integracao_tipo;
ALTER TABLE tarefas_integracao_canais
  ADD CONSTRAINT chk_tarefas_integracao_tipo
  CHECK (tipo IN ('buscar_pedido', 'reconciliar', 'sincronizar_catalogo', 'processar_conversa', 'enviar_campanha'));
CREATE UNIQUE INDEX IF NOT EXISTS uq_tarefas_envio_campanha
  ON tarefas_integracao_canais (tipo, referencia_externa)
  WHERE tipo = 'enviar_campanha';
