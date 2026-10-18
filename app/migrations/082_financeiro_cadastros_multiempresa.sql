-- A2 — financeiro, contas a receber, fechamento diário e cadastros mestres por empresa.
-- Somente estruturas aditivas; clientes continuam usando a identidade canônica Commerce.
ALTER TABLE commerce_customers
  ADD COLUMN IF NOT EXISTS tipo VARCHAR(4) NOT NULL DEFAULT 'pf',
  ADD COLUMN IF NOT EXISTS endereco TEXT,
  ADD COLUMN IF NOT EXISTS limite_credito_mensal NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dias_vencimento INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS observacao TEXT;

CREATE TABLE IF NOT EXISTS a2_contas_receber (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL,
  mesa_numero INTEGER NOT NULL DEFAULT 0,
  descricao VARCHAR(240) NOT NULL,
  valor NUMERIC(14,2) NOT NULL CHECK (valor > 0),
  data_vencimento DATE NOT NULL,
  data_pagamento TIMESTAMPTZ,
  observacao TEXT,
  criado_por UUID,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_a2_conta_cliente FOREIGN KEY (empresa_id, cliente_id)
    REFERENCES commerce_customers (empresa_id, id) ON DELETE RESTRICT,
  CONSTRAINT uq_a2_conta_empresa_id UNIQUE (empresa_id, id)
);
CREATE INDEX IF NOT EXISTS idx_a2_contas_status
  ON a2_contas_receber (empresa_id, data_pagamento, data_vencimento);

CREATE TABLE IF NOT EXISTS a2_fechamentos_diarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  data_fechamento DATE NOT NULL,
  total_receber NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_recebido NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_pendente NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_atrasado NUMERIC(14,2) NOT NULL DEFAULT 0,
  alertas INTEGER NOT NULL DEFAULT 0,
  responsavel VARCHAR(240) NOT NULL,
  observacao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_a2_fechamento_empresa_id UNIQUE (empresa_id, id)
);
CREATE INDEX IF NOT EXISTS idx_a2_fechamento_data
  ON a2_fechamentos_diarios (empresa_id, data_fechamento DESC, criado_em DESC);

CREATE TABLE IF NOT EXISTS a2_funcionarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome VARCHAR(240) NOT NULL,
  cpf VARCHAR(20),
  email VARCHAR(320),
  telefone VARCHAR(30),
  cargo VARCHAR(120),
  departamento VARCHAR(120),
  data_admissao DATE,
  salario NUMERIC(14,2),
  status VARCHAR(20) NOT NULL DEFAULT 'ativo',
  observacao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_a2_funcionario_empresa_id UNIQUE (empresa_id, id)
);
CREATE INDEX IF NOT EXISTS idx_a2_funcionario_empresa_nome ON a2_funcionarios (empresa_id, lower(nome));

CREATE TABLE IF NOT EXISTS a2_fornecedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome VARCHAR(240) NOT NULL,
  cnpj VARCHAR(20),
  inscricao_estadual VARCHAR(40),
  email VARCHAR(320),
  telefone VARCHAR(30),
  endereco TEXT,
  condicao_pagamento VARCHAR(120),
  status VARCHAR(20) NOT NULL DEFAULT 'ativo',
  observacao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_a2_fornecedor_empresa_id UNIQUE (empresa_id, id)
);
CREATE INDEX IF NOT EXISTS idx_a2_fornecedor_empresa_nome ON a2_fornecedores (empresa_id, lower(nome));

CREATE TABLE IF NOT EXISTS a2_usuarios_mestres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome VARCHAR(240) NOT NULL,
  email VARCHAR(320),
  telefone VARCHAR(30),
  tipo_usuario VARCHAR(40) NOT NULL DEFAULT 'operador_pdv',
  perfis JSONB NOT NULL DEFAULT '[]'::jsonb,
  senha_inicial_configurada BOOLEAN NOT NULL DEFAULT false,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_a2_usuario_mestre_empresa_id UNIQUE (empresa_id, id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_a2_usuario_mestre_email
  ON a2_usuarios_mestres (empresa_id, lower(email)) WHERE email IS NOT NULL;
