/*
 * ============================================================================
 * MIGRAÇÃO 001: SCHEMA BASE DO KYTTO ERP
 * ============================================================================
 * Tabelas base para suporte de todas as outras migrações
 * ============================================================================
 */

-- Criar extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABELA DE EMPRESAS (MULTIEMPRESA)
-- ============================================================================

CREATE TABLE IF NOT EXISTS empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(200) NOT NULL UNIQUE,
  cnpj VARCHAR(14) UNIQUE,
  razao_social VARCHAR(300),
  ativo BOOLEAN DEFAULT TRUE,
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_empresas_cnpj ON empresas(cnpj);
CREATE INDEX idx_empresas_ativo ON empresas(ativo);

-- ============================================================================
-- TABELA DE LOJAS (MULTILOJA)
-- ============================================================================

CREATE TABLE IF NOT EXISTS lojas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome VARCHAR(200) NOT NULL,
  cnpj VARCHAR(14),
  endereco VARCHAR(500),
  telefone VARCHAR(20),
  email VARCHAR(200),
  ativo BOOLEAN DEFAULT TRUE,
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(empresa_id, nome),
  UNIQUE(empresa_id, cnpj)
);

CREATE INDEX idx_lojas_empresa ON lojas(empresa_id);
CREATE INDEX idx_lojas_ativo ON lojas(ativo);

-- ============================================================================
-- TABELA DE USUÁRIOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID REFERENCES lojas(id) ON DELETE CASCADE,
  nome VARCHAR(200) NOT NULL,
  email VARCHAR(200) NOT NULL,
  senha_hash VARCHAR(255),
  role VARCHAR(50) DEFAULT 'vendedor', -- admin, gerente, vendedor, barbeiro, caixa, etc
  ativo BOOLEAN DEFAULT TRUE,
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(empresa_id, email)
);

CREATE INDEX idx_usuarios_empresa ON usuarios(empresa_id);
CREATE INDEX idx_usuarios_loja ON usuarios(loja_id);
CREATE INDEX idx_usuarios_email ON usuarios(email);

-- ============================================================================
-- TABELA DE AUDITORIA (IMUTÁVEL)
-- ============================================================================

CREATE TABLE IF NOT EXISTS auditoria_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  tabela VARCHAR(100) NOT NULL,
  operacao VARCHAR(10) NOT NULL CHECK (operacao IN ('INSERT', 'UPDATE', 'DELETE')),
  dados_anterior JSONB,
  dados_novo JSONB,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_auditoria_empresa ON auditoria_log(empresa_id);
CREATE INDEX idx_auditoria_usuario ON auditoria_log(usuario_id);
CREATE INDEX idx_auditoria_tabela ON auditoria_log(tabela);
CREATE INDEX idx_auditoria_timestamp ON auditoria_log(timestamp);

-- ============================================================================
-- FUNÇÃO DE AUDITORIA
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_log()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO auditoria_log (empresa_id, usuario_id, tabela, operacao, dados_anterior, dados_novo)
  VALUES (
    COALESCE(NEW.empresa_id, OLD.empresa_id),
    NULL,
    TG_TABLE_NAME,
    TG_OP,
    CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- DADOS INICIAIS
-- ============================================================================

-- Inserir empresa padrão
INSERT INTO empresas (nome, cnpj, razao_social) 
VALUES ('UISA Sistemas', '00000000000001', 'UISA Sistemas Ltda')
ON CONFLICT (nome) DO NOTHING;

-- Inserir loja padrão
INSERT INTO lojas (empresa_id, nome, cnpj, endereco)
SELECT id, 'Loja Padrão', '00000000000001', 'Matriz'
FROM empresas WHERE nome = 'UISA Sistemas'
ON CONFLICT (empresa_id, nome) DO NOTHING;
