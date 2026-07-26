-- ============================================================================
-- Migração 001: Schema Inicial para SetPoint Ultra
-- Data: 2026-07-26
-- Descrição: Estrutura completa de banco de dados multi-tenant
-- ============================================================================

-- ============================================================================
-- 1. EXTENSÕES
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- 2. TIPOS CUSTOMIZADOS
-- ============================================================================

CREATE TYPE status_comanda AS ENUM ('aberta', 'fechada', 'cancelada');
CREATE TYPE status_item_comanda AS ENUM ('pendente', 'preparando', 'pronto', 'servido', 'cancelado');
CREATE TYPE status_pagamento AS ENUM ('pendente', 'processando', 'aprovado', 'recusado', 'cancelado');
CREATE TYPE tipo_pagamento AS ENUM ('dinheiro', 'cartao_credito', 'cartao_debito', 'pix', 'cheque');
CREATE TYPE status_nfce AS ENUM ('pendente', 'enviada', 'autorizada', 'cancelada', 'contingencia');
CREATE TYPE tipo_movimentacao_estoque AS ENUM ('entrada', 'saida', 'ajuste', 'devolucao');

-- ============================================================================
-- 3. TABELAS DE CONFIGURAÇÃO E ESTABELECIMENTO
-- ============================================================================

CREATE TABLE estabelecimentos (
  id SERIAL PRIMARY KEY,
  cnpj VARCHAR(14) UNIQUE NOT NULL,
  razao_social VARCHAR(255) NOT NULL,
  nome_fantasia VARCHAR(255),
  inscricao_estadual VARCHAR(20),
  endereco_logradouro VARCHAR(255),
  endereco_numero VARCHAR(10),
  endereco_complemento VARCHAR(255),
  endereco_bairro VARCHAR(100),
  endereco_cidade VARCHAR(100),
  endereco_estado CHAR(2),
  endereco_cep VARCHAR(8),
  telefone VARCHAR(20),
  email VARCHAR(255),
  responsavel_nome VARCHAR(255),
  responsavel_email VARCHAR(255),
  responsavel_telefone VARCHAR(20),
  ativo BOOLEAN DEFAULT true,
  modulos_ativos TEXT[] DEFAULT ARRAY['core'],
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE configuracoes_nfce (
  id SERIAL PRIMARY KEY,
  estabelecimento_id INTEGER NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  certificado_a1_path VARCHAR(255),
  certificado_a1_senha VARCHAR(255),
  csc_id_token VARCHAR(6),
  csc_token VARCHAR(36),
  serie_nfce INTEGER DEFAULT 1,
  numero_nfce_atual INTEGER DEFAULT 0,
  ambiente VARCHAR(20) DEFAULT 'homologacao',
  sefaz_uf CHAR(2) NOT NULL,
  sefaz_url VARCHAR(255),
  contingencia_ativa BOOLEAN DEFAULT false,
  contingencia_desde TIMESTAMP,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(estabelecimento_id, sefaz_uf)
);

CREATE TABLE configuracoes_adquirentes (
  id SERIAL PRIMARY KEY,
  estabelecimento_id INTEGER NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  adquirente VARCHAR(50) NOT NULL,
  api_key VARCHAR(255),
  api_secret VARCHAR(255),
  merchant_id VARCHAR(100),
  terminal_id VARCHAR(20),
  ativo BOOLEAN DEFAULT true,
  prioridade INTEGER DEFAULT 1,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(estabelecimento_id, adquirente)
);

-- ============================================================================
-- 4. TABELAS DE USUÁRIOS E AUTENTICAÇÃO
-- ============================================================================

CREATE TABLE usuarios (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  tenant_id INTEGER NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  nome VARCHAR(255),
  roles TEXT[] DEFAULT ARRAY['cliente'],
  permissions TEXT[] DEFAULT ARRAY[],
  ativo BOOLEAN DEFAULT true,
  ultimo_acesso TIMESTAMP,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(email, tenant_id)
);

CREATE TABLE refresh_tokens (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 5. TABELAS DE COMANDA E MESA
-- ============================================================================

CREATE TABLE mesas (
  id SERIAL PRIMARY KEY,
  estabelecimento_id INTEGER NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  numero_mesa INTEGER NOT NULL,
  capacidade_pessoas INTEGER,
  localizacao VARCHAR(100),
  ativa BOOLEAN DEFAULT true,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(estabelecimento_id, numero_mesa)
);

CREATE TABLE comandas (
  id SERIAL PRIMARY KEY,
  estabelecimento_id INTEGER NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  mesa_id INTEGER REFERENCES mesas(id) ON DELETE SET NULL,
  numero_comanda INTEGER NOT NULL,
  status status_comanda DEFAULT 'aberta',
  data_abertura TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_fechamento TIMESTAMP,
  total_bruto DECIMAL(12, 2) DEFAULT 0,
  total_desconto DECIMAL(12, 2) DEFAULT 0,
  total_liquido DECIMAL(12, 2) DEFAULT 0,
  total_servico DECIMAL(12, 2) DEFAULT 0,
  observacoes TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(estabelecimento_id, numero_comanda)
);

CREATE TABLE categorias_produto (
  id SERIAL PRIMARY KEY,
  estabelecimento_id INTEGER NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  ativa BOOLEAN DEFAULT true,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(estabelecimento_id, nome)
);

CREATE TABLE produtos (
  id SERIAL PRIMARY KEY,
  estabelecimento_id INTEGER NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  categoria_id INTEGER REFERENCES categorias_produto(id) ON DELETE SET NULL,
  codigo_interno VARCHAR(50),
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  tipo_produto VARCHAR(50) DEFAULT 'bebida',
  unidade_medida VARCHAR(20) DEFAULT 'ml',
  valor_venda DECIMAL(12, 2) NOT NULL,
  valor_custo DECIMAL(12, 2),
  estoque_atual DECIMAL(10, 3) DEFAULT 0,
  estoque_minimo DECIMAL(10, 3) DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(estabelecimento_id, codigo_interno)
);

CREATE TABLE itens_comanda (
  id SERIAL PRIMARY KEY,
  comanda_id INTEGER NOT NULL REFERENCES comandas(id) ON DELETE CASCADE,
  produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
  quantidade DECIMAL(10, 3) NOT NULL,
  valor_unitario DECIMAL(12, 2) NOT NULL,
  valor_total DECIMAL(12, 2) NOT NULL,
  desconto_percentual DECIMAL(5, 2) DEFAULT 0,
  desconto_valor DECIMAL(12, 2) DEFAULT 0,
  observacoes VARCHAR(255),
  status status_item_comanda DEFAULT 'pendente',
  data_pedido TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_servido TIMESTAMP,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE divisoes_comanda (
  id SERIAL PRIMARY KEY,
  comanda_id INTEGER NOT NULL REFERENCES comandas(id) ON DELETE CASCADE,
  numero_divisao INTEGER NOT NULL,
  nome_cliente VARCHAR(100),
  total_bruto DECIMAL(12, 2) DEFAULT 0,
  total_desconto DECIMAL(12, 2) DEFAULT 0,
  total_liquido DECIMAL(12, 2) DEFAULT 0,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(comanda_id, numero_divisao)
);

CREATE TABLE itens_divisao (
  id SERIAL PRIMARY KEY,
  divisao_id INTEGER NOT NULL REFERENCES divisoes_comanda(id) ON DELETE CASCADE,
  item_comanda_id INTEGER NOT NULL REFERENCES itens_comanda(id) ON DELETE CASCADE,
  quantidade DECIMAL(10, 3) NOT NULL,
  valor_total DECIMAL(12, 2) NOT NULL
);

-- ============================================================================
-- 6. TABELAS DE PAGAMENTO
-- ============================================================================

CREATE TABLE pagamentos (
  id SERIAL PRIMARY KEY,
  estabelecimento_id INTEGER NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  comanda_id INTEGER REFERENCES comandas(id) ON DELETE SET NULL,
  divisao_id INTEGER REFERENCES divisoes_comanda(id) ON DELETE SET NULL,
  numero_pagamento INTEGER NOT NULL,
  tipo_pagamento tipo_pagamento NOT NULL,
  status status_pagamento DEFAULT 'pendente',
  valor_total DECIMAL(12, 2) NOT NULL,
  valor_acrescimo DECIMAL(12, 2) DEFAULT 0,
  valor_desconto DECIMAL(12, 2) DEFAULT 0,
  valor_liquido DECIMAL(12, 2) NOT NULL,
  adquirente VARCHAR(50),
  id_transacao_adquirente VARCHAR(255),
  id_autorizacao VARCHAR(50),
  nsu_adquirente VARCHAR(20),
  bandeira_cartao VARCHAR(50),
  ultimos_digitos_cartao VARCHAR(4),
  chave_pix VARCHAR(255),
  qr_code_pix TEXT,
  numero_cheque VARCHAR(20),
  banco_cheque VARCHAR(50),
  data_vencimento_cheque DATE,
  observacoes TEXT,
  data_pagamento TIMESTAMP,
  data_confirmacao TIMESTAMP,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(estabelecimento_id, numero_pagamento)
);

-- ============================================================================
-- 7. TABELAS DE NFC-E
-- ============================================================================

CREATE TABLE nfces (
  id SERIAL PRIMARY KEY,
  estabelecimento_id INTEGER NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  comanda_id INTEGER REFERENCES comandas(id) ON DELETE SET NULL,
  numero_nfce INTEGER NOT NULL,
  serie_nfce INTEGER NOT NULL,
  chave_nfce VARCHAR(44) UNIQUE,
  status status_nfce DEFAULT 'pendente',
  ambiente VARCHAR(20) DEFAULT 'homologacao',
  contingencia BOOLEAN DEFAULT false,
  data_emissao TIMESTAMP,
  data_autorizacao TIMESTAMP,
  data_cancelamento TIMESTAMP,
  protocolo_autorizacao VARCHAR(20),
  valor_total DECIMAL(12, 2) NOT NULL,
  valor_desconto DECIMAL(12, 2) DEFAULT 0,
  valor_acrescimo DECIMAL(12, 2) DEFAULT 0,
  valor_servico DECIMAL(12, 2) DEFAULT 0,
  valor_tributos DECIMAL(12, 2) DEFAULT 0,
  xml_nfce LONGTEXT,
  qrcode_nfce TEXT,
  url_consulta_nfce VARCHAR(255),
  motivo_cancelamento VARCHAR(255),
  tentativas_envio INTEGER DEFAULT 0,
  proxima_tentativa TIMESTAMP,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(estabelecimento_id, numero_nfce, serie_nfce)
);

CREATE TABLE itens_nfce (
  id SERIAL PRIMARY KEY,
  nfce_id INTEGER NOT NULL REFERENCES nfces(id) ON DELETE CASCADE,
  produto_id INTEGER REFERENCES produtos(id) ON DELETE SET NULL,
  descricao VARCHAR(255) NOT NULL,
  quantidade DECIMAL(10, 3) NOT NULL,
  unidade_medida VARCHAR(20),
  valor_unitario DECIMAL(12, 2) NOT NULL,
  valor_total DECIMAL(12, 2) NOT NULL,
  valor_desconto DECIMAL(12, 2) DEFAULT 0,
  percentual_icms DECIMAL(5, 2) DEFAULT 0,
  valor_icms DECIMAL(12, 2) DEFAULT 0
);

CREATE TABLE fila_nfce_contingencia (
  id SERIAL PRIMARY KEY,
  estabelecimento_id INTEGER NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  nfce_id INTEGER REFERENCES nfces(id) ON DELETE SET NULL,
  xml_nfce LONGTEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pendente',
  motivo_erro TEXT,
  tentativas INTEGER DEFAULT 0,
  proxima_tentativa TIMESTAMP,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 8. TABELAS DE ESTOQUE
-- ============================================================================

CREATE TABLE fichas_tecnicas (
  id SERIAL PRIMARY KEY,
  estabelecimento_id INTEGER NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  nome_receita VARCHAR(255) NOT NULL,
  modo_preparo TEXT,
  tempo_preparo_segundos INTEGER,
  rendimento_ml DECIMAL(10, 2),
  custo_receita DECIMAL(12, 2),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(estabelecimento_id, produto_id)
);

CREATE TABLE ingredientes_ficha (
  id SERIAL PRIMARY KEY,
  ficha_tecnica_id INTEGER NOT NULL REFERENCES fichas_tecnicas(id) ON DELETE CASCADE,
  produto_ingrediente_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
  quantidade DECIMAL(10, 3) NOT NULL,
  unidade_medida VARCHAR(20) NOT NULL,
  custo_unitario DECIMAL(12, 2)
);

CREATE TABLE movimentacoes_estoque (
  id SERIAL PRIMARY KEY,
  estabelecimento_id INTEGER NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
  tipo_movimentacao tipo_movimentacao_estoque NOT NULL,
  quantidade DECIMAL(10, 3) NOT NULL,
  valor_unitario DECIMAL(12, 2),
  motivo VARCHAR(255),
  referencia_id INTEGER,
  referencia_tipo VARCHAR(50),
  usuario_id INTEGER,
  data_movimentacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 9. TABELAS DE AUDITORIA E LOGS
-- ============================================================================

CREATE TABLE auditoria_operacoes (
  id SERIAL PRIMARY KEY,
  estabelecimento_id INTEGER NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  usuario_id INTEGER,
  tipo_operacao VARCHAR(100) NOT NULL,
  tabela_afetada VARCHAR(100),
  registro_id INTEGER,
  dados_antes JSONB,
  dados_depois JSONB,
  ip_usuario VARCHAR(45),
  user_agent TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE logs_sincronizacao (
  id SERIAL PRIMARY KEY,
  estabelecimento_id INTEGER NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  tipo_sincronizacao VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'pendente',
  dados_sincronizados INTEGER,
  motivo_erro TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 10. TABELAS DE FATURAMENTO E ASSINATURA
-- ============================================================================

CREATE TABLE planos_assinatura (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL UNIQUE,
  descricao TEXT,
  preco_mensal DECIMAL(12, 2) NOT NULL,
  preco_anual DECIMAL(12, 2),
  modulos_inclusos TEXT[] DEFAULT ARRAY['core'],
  limite_usuarios INTEGER,
  limite_transacoes INTEGER,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE assinaturas (
  id SERIAL PRIMARY KEY,
  estabelecimento_id INTEGER NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  plano_id INTEGER NOT NULL REFERENCES planos_assinatura(id),
  status VARCHAR(50) DEFAULT 'ativa',
  data_inicio DATE NOT NULL,
  data_vencimento DATE NOT NULL,
  data_renovacao DATE,
  valor_mensal DECIMAL(12, 2) NOT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE faturas (
  id SERIAL PRIMARY KEY,
  estabelecimento_id INTEGER NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  assinatura_id INTEGER REFERENCES assinaturas(id),
  numero_fatura VARCHAR(50) UNIQUE,
  data_emissao DATE NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  valor_total DECIMAL(12, 2) NOT NULL,
  valor_pago DECIMAL(12, 2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pendente',
  metodo_pagamento VARCHAR(50),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 11. ÍNDICES PARA PERFORMANCE
-- ============================================================================

CREATE INDEX idx_estabelecimentos_cnpj ON estabelecimentos(cnpj);
CREATE INDEX idx_estabelecimentos_ativo ON estabelecimentos(ativo);

CREATE INDEX idx_usuarios_email_tenant ON usuarios(email, tenant_id);
CREATE INDEX idx_usuarios_tenant ON usuarios(tenant_id);
CREATE INDEX idx_usuarios_ativo ON usuarios(ativo);

CREATE INDEX idx_comandas_estabelecimento ON comandas(estabelecimento_id);
CREATE INDEX idx_comandas_status ON comandas(status);
CREATE INDEX idx_comandas_data_abertura ON comandas(data_abertura);
CREATE INDEX idx_comandas_mesa ON comandas(mesa_id);

CREATE INDEX idx_itens_comanda_status ON itens_comanda(status);
CREATE INDEX idx_itens_comanda_comanda ON itens_comanda(comanda_id);

CREATE INDEX idx_pagamentos_estabelecimento ON pagamentos(estabelecimento_id);
CREATE INDEX idx_pagamentos_status ON pagamentos(status);
CREATE INDEX idx_pagamentos_adquirente ON pagamentos(adquirente);
CREATE INDEX idx_pagamentos_comanda ON pagamentos(comanda_id);

CREATE INDEX idx_nfces_estabelecimento ON nfces(estabelecimento_id);
CREATE INDEX idx_nfces_status ON nfces(status);
CREATE INDEX idx_nfces_chave ON nfces(chave_nfce);
CREATE INDEX idx_nfces_comanda ON nfces(comanda_id);

CREATE INDEX idx_produtos_estabelecimento ON produtos(estabelecimento_id);
CREATE INDEX idx_produtos_categoria ON produtos(categoria_id);
CREATE INDEX idx_produtos_ativo ON produtos(ativo);

CREATE INDEX idx_movimentacoes_produto ON movimentacoes_estoque(produto_id);
CREATE INDEX idx_movimentacoes_tipo ON movimentacoes_estoque(tipo_movimentacao);
CREATE INDEX idx_movimentacoes_estabelecimento ON movimentacoes_estoque(estabelecimento_id);

CREATE INDEX idx_auditoria_estabelecimento ON auditoria_operacoes(estabelecimento_id);
CREATE INDEX idx_auditoria_data ON auditoria_operacoes(criado_em);

CREATE INDEX idx_fila_contingencia_status ON fila_nfce_contingencia(status);

-- ============================================================================
-- 12. VIEWS ÚTEIS
-- ============================================================================

CREATE OR REPLACE VIEW v_comandas_abertas AS
SELECT 
  c.id,
  c.estabelecimento_id,
  c.numero_comanda,
  c.data_abertura,
  m.numero_mesa,
  COUNT(ic.id) as total_itens,
  SUM(ic.valor_total - COALESCE(ic.desconto_valor, 0)) as total_comanda
FROM comandas c
LEFT JOIN mesas m ON c.mesa_id = m.id
LEFT JOIN itens_comanda ic ON c.id = ic.comanda_id
WHERE c.status = 'aberta'
GROUP BY c.id, c.estabelecimento_id, c.numero_comanda, c.data_abertura, m.numero_mesa;

CREATE OR REPLACE VIEW v_estoque_critico AS
SELECT 
  p.id,
  p.estabelecimento_id,
  p.nome,
  p.estoque_atual,
  p.estoque_minimo,
  (p.estoque_minimo - p.estoque_atual) as falta_para_minimo
FROM produtos p
WHERE p.estoque_atual < p.estoque_minimo
  AND p.ativo = true;

CREATE OR REPLACE VIEW v_nfces_pendentes AS
SELECT 
  n.id,
  n.estabelecimento_id,
  n.numero_nfce,
  n.status,
  n.tentativas_envio,
  n.proxima_tentativa,
  n.criado_em
FROM nfces n
WHERE n.status IN ('pendente', 'contingencia')
  AND n.proxima_tentativa <= CURRENT_TIMESTAMP;

-- ============================================================================
-- 13. TRIGGERS PARA AUDITORIA
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_auditoria_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO auditoria_operacoes (
      estabelecimento_id, tipo_operacao, tabela_afetada, registro_id,
      dados_antes, dados_depois
    ) VALUES (
      COALESCE(NEW.estabelecimento_id, OLD.estabelecimento_id),
      TG_TABLE_NAME || '_' || TG_OP,
      TG_TABLE_NAME,
      NEW.id,
      row_to_json(OLD),
      row_to_json(NEW)
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO auditoria_operacoes (
      estabelecimento_id, tipo_operacao, tabela_afetada, registro_id,
      dados_antes
    ) VALUES (
      OLD.estabelecimento_id,
      TG_TABLE_NAME || '_' || TG_OP,
      TG_TABLE_NAME,
      OLD.id,
      row_to_json(OLD)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auditoria_comandas AFTER UPDATE OR DELETE ON comandas
  FOR EACH ROW EXECUTE FUNCTION fn_auditoria_trigger();

CREATE TRIGGER trg_auditoria_pagamentos AFTER UPDATE OR DELETE ON pagamentos
  FOR EACH ROW EXECUTE FUNCTION fn_auditoria_trigger();

CREATE TRIGGER trg_auditoria_nfces AFTER UPDATE OR DELETE ON nfces
  FOR EACH ROW EXECUTE FUNCTION fn_auditoria_trigger();
