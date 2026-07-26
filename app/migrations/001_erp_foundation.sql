-- ============================================================================
-- ERP MODULAR BRASILEIRO - SCHEMA FOUNDATION
-- ============================================================================
-- Versão: 1.0
-- Data: 2026-07-26
-- Descrição: Schema transacional completo para multiempresa, fiscal, pagamentos,
--            estoque, PDV e verticais (bar, restaurante, loja, barbearia, clube)
-- ============================================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- ============================================================================
-- 1. FOUNDATION: MULTIEMPRESA, USUÁRIOS, AUDITORIA
-- ============================================================================

CREATE TABLE IF NOT EXISTS empresas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(255) NOT NULL,
  cnpj VARCHAR(14) UNIQUE NOT NULL,
  razao_social VARCHAR(255) NOT NULL,
  inscricao_estadual VARCHAR(20),
  inscricao_municipal VARCHAR(20),
  csc_nfce VARCHAR(64), -- Código de Segurança do Contribuinte (SEFAZ)
  certificado_a1_path VARCHAR(255), -- Caminho do certificado digital
  endereco_logradouro VARCHAR(255),
  endereco_numero VARCHAR(20),
  endereco_complemento VARCHAR(255),
  endereco_bairro VARCHAR(100),
  endereco_cidade VARCHAR(100),
  endereco_estado VARCHAR(2),
  endereco_cep VARCHAR(8),
  telefone VARCHAR(20),
  email VARCHAR(255),
  website VARCHAR(255),
  ativa BOOLEAN DEFAULT true,
  tipo_negocio VARCHAR(50), -- 'bar', 'restaurante', 'loja', 'barbearia', 'clube', 'supermercado'
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_tipo_negocio CHECK (tipo_negocio IN ('bar', 'restaurante', 'loja', 'barbearia', 'clube', 'supermercado', 'outro'))
);

CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  senha_hash VARCHAR(255) NOT NULL,
  nome_completo VARCHAR(255) NOT NULL,
  cpf VARCHAR(11) UNIQUE,
  telefone VARCHAR(20),
  ativo BOOLEAN DEFAULT true,
  role VARCHAR(50) NOT NULL, -- 'admin', 'gerente', 'vendedor', 'garcom', 'barbeiro', 'caixa', 'cliente'
  permissoes JSONB DEFAULT '{}', -- Permissões granulares
  ultimo_acesso TIMESTAMP,
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(empresa_id, email),
  CONSTRAINT chk_role CHECK (role IN ('admin', 'gerente', 'vendedor', 'garcom', 'barbeiro', 'caixa', 'cliente', 'operador'))
);

CREATE TABLE IF NOT EXISTS auditoria (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  tabela VARCHAR(100) NOT NULL,
  operacao VARCHAR(20) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
  registro_id VARCHAR(255) NOT NULL,
  dados_anterior JSONB,
  dados_novo JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  data_operacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_operacao CHECK (operacao IN ('INSERT', 'UPDATE', 'DELETE', 'EXPORT', 'IMPORT'))
);

CREATE INDEX idx_auditoria_empresa_data ON auditoria(empresa_id, data_operacao DESC);
CREATE INDEX idx_auditoria_usuario ON auditoria(usuario_id);
CREATE INDEX idx_auditoria_tabela ON auditoria(tabela);

-- ============================================================================
-- 2. CATÁLOGO: PRODUTOS, CATEGORIAS, FICHAS TÉCNICAS
-- ============================================================================

CREATE TABLE IF NOT EXISTS categorias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  ativa BOOLEAN DEFAULT true,
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(empresa_id, nome)
);

CREATE TABLE IF NOT EXISTS produtos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  categoria_id UUID NOT NULL REFERENCES categorias(id) ON DELETE SET NULL,
  codigo_interno VARCHAR(50) NOT NULL,
  codigo_barras VARCHAR(50),
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  preco_custo DECIMAL(10, 2) NOT NULL,
  preco_venda DECIMAL(10, 2) NOT NULL,
  preco_promocao DECIMAL(10, 2),
  unidade_medida VARCHAR(10), -- 'un', 'kg', 'l', 'ml', 'dose', etc
  estoque_minimo DECIMAL(12, 3),
  estoque_maximo DECIMAL(12, 3),
  ativo BOOLEAN DEFAULT true,
  imagem_url VARCHAR(500),
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(empresa_id, codigo_interno),
  CONSTRAINT chk_preco CHECK (preco_venda >= 0 AND preco_custo >= 0)
);

CREATE TABLE IF NOT EXISTS fichas_tecnicas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  modo_preparo TEXT,
  ingredientes JSONB, -- [{"produto_id": "...", "quantidade": 2, "unidade": "un"}]
  custo_total DECIMAL(10, 2),
  rendimento DECIMAL(12, 3), -- Quantas unidades saem da receita
  unidade_rendimento VARCHAR(10),
  tempo_preparo_minutos INT,
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(empresa_id, nome)
);

-- ============================================================================
-- 3. ESTOQUE: MOVIMENTAÇÕES, INVENTÁRIO, RASTREABILIDADE
-- ============================================================================

CREATE TABLE IF NOT EXISTS estoque (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  quantidade DECIMAL(12, 3) NOT NULL,
  lote VARCHAR(50),
  validade DATE,
  localizacao VARCHAR(100), -- Prateleira, local físico
  data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(empresa_id, produto_id, lote, validade)
);

CREATE TABLE IF NOT EXISTS movimentacoes_estoque (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  tipo VARCHAR(20) NOT NULL, -- 'entrada', 'saida', 'ajuste', 'devolucao'
  quantidade DECIMAL(12, 3) NOT NULL,
  lote VARCHAR(50),
  validade DATE,
  documento_tipo VARCHAR(20), -- 'nf', 'nfce', 'manual', 'venda'
  documento_numero VARCHAR(50),
  documento_serie VARCHAR(10),
  fornecedor_id UUID REFERENCES fornecedores(id) ON DELETE SET NULL,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  motivo VARCHAR(255), -- Para ajustes
  custo_unitario DECIMAL(10, 2),
  data_operacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_tipo_mov CHECK (tipo IN ('entrada', 'saida', 'ajuste', 'devolucao', 'transferencia'))
);

CREATE INDEX idx_movimentacoes_empresa_data ON movimentacoes_estoque(empresa_id, data_operacao DESC);
CREATE INDEX idx_movimentacoes_produto ON movimentacoes_estoque(produto_id);

CREATE TABLE IF NOT EXISTS inventarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  numero_inventario VARCHAR(50) NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE,
  status VARCHAR(20) DEFAULT 'em_andamento', -- 'em_andamento', 'finalizado', 'cancelado'
  usuario_responsavel_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  observacoes TEXT,
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(empresa_id, numero_inventario),
  CONSTRAINT chk_status_inv CHECK (status IN ('em_andamento', 'finalizado', 'cancelado'))
);

CREATE TABLE IF NOT EXISTS itens_inventario (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventario_id UUID NOT NULL REFERENCES inventarios(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
  lote VARCHAR(50),
  validade DATE,
  quantidade_sistema DECIMAL(12, 3),
  quantidade_contada DECIMAL(12, 3),
  divergencia DECIMAL(12, 3),
  usuario_contagem_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  data_contagem TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  observacoes TEXT
);

-- ============================================================================
-- 4. FORNECEDORES E COMPRAS
-- ============================================================================

CREATE TABLE IF NOT EXISTS fornecedores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome VARCHAR(255) NOT NULL,
  cnpj VARCHAR(14),
  cpf VARCHAR(11),
  email VARCHAR(255),
  telefone VARCHAR(20),
  endereco_logradouro VARCHAR(255),
  endereco_numero VARCHAR(20),
  endereco_bairro VARCHAR(100),
  endereco_cidade VARCHAR(100),
  endereco_estado VARCHAR(2),
  endereco_cep VARCHAR(8),
  ativo BOOLEAN DEFAULT true,
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(empresa_id, cnpj, cpf)
);

CREATE TABLE IF NOT EXISTS compras (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  fornecedor_id UUID NOT NULL REFERENCES fornecedores(id) ON DELETE RESTRICT,
  numero_nf VARCHAR(50) NOT NULL,
  serie_nf VARCHAR(10),
  data_emissao DATE NOT NULL,
  data_chegada DATE,
  valor_total DECIMAL(12, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pendente', -- 'pendente', 'recebida', 'cancelada'
  observacoes TEXT,
  usuario_criacao_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(empresa_id, numero_nf, serie_nf),
  CONSTRAINT chk_status_compra CHECK (status IN ('pendente', 'recebida', 'cancelada', 'parcial'))
);

CREATE TABLE IF NOT EXISTS itens_compra (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  compra_id UUID NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
  quantidade DECIMAL(12, 3) NOT NULL,
  valor_unitario DECIMAL(10, 2) NOT NULL,
  lote VARCHAR(50),
  validade DATE
);

-- ============================================================================
-- 5. VENDAS, PDV, COMANDA
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  numero_venda VARCHAR(50) NOT NULL,
  data_venda TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  usuario_vendedor_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  tipo_venda VARCHAR(20) NOT NULL, -- 'pdv', 'comanda', 'delivery', 'online'
  status VARCHAR(20) DEFAULT 'aberta', -- 'aberta', 'fechada', 'cancelada'
  valor_bruto DECIMAL(12, 2),
  valor_desconto DECIMAL(12, 2) DEFAULT 0,
  valor_acrescimo DECIMAL(12, 2) DEFAULT 0,
  valor_liquido DECIMAL(12, 2),
  observacoes TEXT,
  UNIQUE(empresa_id, numero_venda),
  CONSTRAINT chk_status_venda CHECK (status IN ('aberta', 'fechada', 'cancelada', 'devolvida'))
);

CREATE INDEX idx_vendas_empresa_data ON vendas(empresa_id, data_venda DESC);
CREATE INDEX idx_vendas_usuario ON vendas(usuario_vendedor_id);

CREATE TABLE IF NOT EXISTS itens_venda (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venda_id UUID NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
  quantidade DECIMAL(12, 3) NOT NULL,
  valor_unitario DECIMAL(10, 2) NOT NULL,
  valor_total DECIMAL(12, 2),
  desconto_item DECIMAL(12, 2) DEFAULT 0,
  lote VARCHAR(50),
  observacoes TEXT
);

CREATE TABLE IF NOT EXISTS comandas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  numero_comanda INT NOT NULL,
  mesa_numero INT,
  data_abertura TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_fechamento TIMESTAMP,
  usuario_garcom_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  status VARCHAR(20) DEFAULT 'aberta', -- 'aberta', 'fechada', 'cancelada'
  valor_total DECIMAL(12, 2),
  observacoes TEXT,
  UNIQUE(empresa_id, numero_comanda),
  CONSTRAINT chk_status_comanda CHECK (status IN ('aberta', 'fechada', 'cancelada'))
);

CREATE INDEX idx_comandas_empresa_status ON comandas(empresa_id, status);

CREATE TABLE IF NOT EXISTS itens_comanda (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comanda_id UUID NOT NULL REFERENCES comandas(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
  quantidade DECIMAL(12, 3) NOT NULL,
  valor_unitario DECIMAL(10, 2) NOT NULL,
  valor_total DECIMAL(12, 2),
  status VARCHAR(20) DEFAULT 'pendente', -- 'pendente', 'preparando', 'pronto', 'servido', 'cancelado'
  data_adicao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  observacoes TEXT,
  CONSTRAINT chk_status_item CHECK (status IN ('pendente', 'preparando', 'pronto', 'servido', 'cancelado'))
);

CREATE TABLE IF NOT EXISTS divisoes_comanda (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comanda_id UUID NOT NULL REFERENCES comandas(id) ON DELETE CASCADE,
  numero_divisao INT NOT NULL,
  cliente_nome VARCHAR(100),
  valor_total DECIMAL(12, 2),
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(comanda_id, numero_divisao)
);

CREATE TABLE IF NOT EXISTS itens_divisao (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  divisao_id UUID NOT NULL REFERENCES divisoes_comanda(id) ON DELETE CASCADE,
  item_comanda_id UUID NOT NULL REFERENCES itens_comanda(id) ON DELETE RESTRICT,
  quantidade DECIMAL(12, 3) NOT NULL
);

-- ============================================================================
-- 6. PAGAMENTOS E RECEBIMENTOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS formas_pagamento (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome VARCHAR(50) NOT NULL,
  tipo VARCHAR(30) NOT NULL, -- 'dinheiro', 'cartao_credito', 'cartao_debito', 'pix', 'cheque', 'vale'
  ativa BOOLEAN DEFAULT true,
  UNIQUE(empresa_id, nome),
  CONSTRAINT chk_tipo_pagamento CHECK (tipo IN ('dinheiro', 'cartao_credito', 'cartao_debito', 'pix', 'cheque', 'vale', 'boleto'))
);

CREATE TABLE IF NOT EXISTS pagamentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  venda_id UUID REFERENCES vendas(id) ON DELETE SET NULL,
  comanda_id UUID REFERENCES comandas(id) ON DELETE SET NULL,
  forma_pagamento_id UUID NOT NULL REFERENCES formas_pagamento(id) ON DELETE RESTRICT,
  valor DECIMAL(12, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pendente', -- 'pendente', 'aprovado', 'recusado', 'cancelado'
  referencia_externa VARCHAR(100), -- NSU, ID da transação
  data_pagamento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  observacoes TEXT,
  CONSTRAINT chk_status_pagto CHECK (status IN ('pendente', 'aprovado', 'recusado', 'cancelado', 'reembolsado'))
);

CREATE INDEX idx_pagamentos_empresa_data ON pagamentos(empresa_id, data_pagamento DESC);
CREATE INDEX idx_pagamentos_status ON pagamentos(status);

CREATE TABLE IF NOT EXISTS transacoes_cartao (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  pagamento_id UUID NOT NULL REFERENCES pagamentos(id) ON DELETE CASCADE,
  adquirente VARCHAR(50) NOT NULL, -- 'stone', 'cielo', 'pagbank', 'mercadopago'
  tipo_cartao VARCHAR(20) NOT NULL, -- 'credito', 'debito'
  ultimos_digitos VARCHAR(4),
  bandeira VARCHAR(20), -- 'visa', 'mastercard', 'elo', etc
  nsu VARCHAR(20),
  autorizacao VARCHAR(20),
  parcelas INT DEFAULT 1,
  taxa_percentual DECIMAL(5, 2),
  data_transacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_adquirente CHECK (adquirente IN ('stone', 'cielo', 'pagbank', 'mercadopago', 'manual'))
);

CREATE TABLE IF NOT EXISTS transacoes_pix (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  pagamento_id UUID NOT NULL REFERENCES pagamentos(id) ON DELETE CASCADE,
  chave_pix VARCHAR(255),
  qr_code TEXT, -- QR Code em base64
  txid VARCHAR(35) UNIQUE,
  status_pix VARCHAR(20) DEFAULT 'criado', -- 'criado', 'confirmado', 'devolvido'
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_confirmacao TIMESTAMP,
  CONSTRAINT chk_status_pix CHECK (status_pix IN ('criado', 'confirmado', 'devolvido', 'expirado'))
);

-- ============================================================================
-- 7. FISCAL: NFC-e, NF-e, CONTINGÊNCIA
-- ============================================================================

CREATE TABLE IF NOT EXISTS nfce_emitidas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  venda_id UUID REFERENCES vendas(id) ON DELETE SET NULL,
  numero_nfce VARCHAR(50) NOT NULL,
  serie VARCHAR(10),
  chave_acesso VARCHAR(44) UNIQUE,
  data_emissao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) DEFAULT 'emitida', -- 'emitida', 'cancelada', 'contingencia'
  xml_nfce TEXT,
  protocolo_sefaz VARCHAR(20),
  contingencia BOOLEAN DEFAULT false,
  data_contingencia TIMESTAMP,
  data_reprocessamento TIMESTAMP,
  observacoes TEXT,
  UNIQUE(empresa_id, numero_nfce, serie),
  CONSTRAINT chk_status_nfce CHECK (status IN ('emitida', 'cancelada', 'contingencia', 'reprocessada', 'erro'))
);

CREATE INDEX idx_nfce_empresa_data ON nfce_emitidas(empresa_id, data_emissao DESC);
CREATE INDEX idx_nfce_status ON nfce_emitidas(status);

CREATE TABLE IF NOT EXISTS buffer_contingencia (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  venda_id UUID NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
  dados_venda JSONB NOT NULL,
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_reprocessamento TIMESTAMP,
  tentativas INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pendente', -- 'pendente', 'processada', 'erro'
  mensagem_erro TEXT
);

CREATE TABLE IF NOT EXISTS cancelamentos_nfce (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nfce_id UUID NOT NULL REFERENCES nfce_emitidas(id) ON DELETE CASCADE,
  justificativa TEXT NOT NULL,
  data_cancelamento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  protocolo_cancelamento VARCHAR(20),
  status VARCHAR(20) DEFAULT 'solicitado' -- 'solicitado', 'cancelada', 'erro'
);

-- ============================================================================
-- 8. CAIXA E FECHAMENTO
-- ============================================================================

CREATE TABLE IF NOT EXISTS caixas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  numero_caixa INT NOT NULL,
  usuario_operador_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  data_abertura TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_fechamento TIMESTAMP,
  valor_abertura DECIMAL(12, 2) DEFAULT 0,
  valor_fechamento DECIMAL(12, 2),
  status VARCHAR(20) DEFAULT 'aberto', -- 'aberto', 'fechado', 'suspenso'
  observacoes TEXT,
  UNIQUE(empresa_id, numero_caixa, data_abertura),
  CONSTRAINT chk_status_caixa CHECK (status IN ('aberto', 'fechado', 'suspenso'))
);

CREATE TABLE IF NOT EXISTS movimentacoes_caixa (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  caixa_id UUID NOT NULL REFERENCES caixas(id) ON DELETE CASCADE,
  tipo VARCHAR(20) NOT NULL, -- 'sangria', 'suprimento', 'pagamento', 'recebimento'
  valor DECIMAL(12, 2) NOT NULL,
  descricao TEXT,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  data_operacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_tipo_mov_caixa CHECK (tipo IN ('sangria', 'suprimento', 'pagamento', 'recebimento', 'ajuste'))
);

CREATE TABLE IF NOT EXISTS fechamentos_caixa (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  caixa_id UUID NOT NULL REFERENCES caixas(id) ON DELETE CASCADE,
  valor_esperado DECIMAL(12, 2),
  valor_contado DECIMAL(12, 2),
  divergencia DECIMAL(12, 2),
  data_fechamento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  usuario_responsavel_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  observacoes TEXT
);

-- ============================================================================
-- 9. VERTICAIS: BARBEARIA (AGENDAMENTOS, SERVIÇOS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS servicos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  duracao_minutos INT,
  preco DECIMAL(10, 2) NOT NULL,
  ativo BOOLEAN DEFAULT true,
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(empresa_id, nome)
);

CREATE TABLE IF NOT EXISTS agendamentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  servico_id UUID NOT NULL REFERENCES servicos(id) ON DELETE RESTRICT,
  usuario_profissional_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  cliente_nome VARCHAR(100),
  cliente_telefone VARCHAR(20),
  data_agendamento TIMESTAMP NOT NULL,
  status VARCHAR(20) DEFAULT 'agendado', -- 'agendado', 'confirmado', 'cancelado', 'concluido'
  observacoes TEXT,
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_status_agend CHECK (status IN ('agendado', 'confirmado', 'cancelado', 'concluido', 'nao_compareceu'))
);

-- ============================================================================
-- 10. VERTICAIS: CLUBE (MEMBROS, MENSALIDADES)
-- ============================================================================

CREATE TABLE IF NOT EXISTS membros_clube (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome VARCHAR(255) NOT NULL,
  cpf VARCHAR(11) UNIQUE,
  email VARCHAR(255),
  telefone VARCHAR(20),
  data_filiacao DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'ativo', -- 'ativo', 'inativo', 'suspenso', 'cancelado'
  tipo_plano VARCHAR(50), -- 'basico', 'premium', 'vip'
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_status_membro CHECK (status IN ('ativo', 'inativo', 'suspenso', 'cancelado'))
);

CREATE TABLE IF NOT EXISTS mensalidades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  membro_id UUID NOT NULL REFERENCES membros_clube(id) ON DELETE CASCADE,
  mes_ano DATE NOT NULL,
  valor DECIMAL(10, 2) NOT NULL,
  data_vencimento DATE,
  data_pagamento DATE,
  status VARCHAR(20) DEFAULT 'pendente', -- 'pendente', 'paga', 'atrasada', 'cancelada'
  UNIQUE(membro_id, mes_ano),
  CONSTRAINT chk_status_mensalidade CHECK (status IN ('pendente', 'paga', 'atrasada', 'cancelada'))
);

-- ============================================================================
-- 11. RELATÓRIOS E ANALYTICS
-- ============================================================================

CREATE TABLE IF NOT EXISTS relatorios_vendas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  data_relatorio DATE NOT NULL,
  total_vendas DECIMAL(12, 2),
  quantidade_vendas INT,
  ticket_medio DECIMAL(10, 2),
  produto_mais_vendido_id UUID REFERENCES produtos(id) ON DELETE SET NULL,
  usuario_top_vendedor_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(empresa_id, data_relatorio)
);

-- ============================================================================
-- ÍNDICES ADICIONAIS PARA PERFORMANCE
-- ============================================================================

CREATE INDEX idx_usuarios_empresa ON usuarios(empresa_id);
CREATE INDEX idx_produtos_empresa ON produtos(empresa_id);
CREATE INDEX idx_estoque_empresa ON estoque(empresa_id);
CREATE INDEX idx_vendas_status ON vendas(status);
CREATE INDEX idx_pagamentos_venda ON pagamentos(venda_id);
CREATE INDEX idx_comandas_mesa ON comandas(mesa_numero);

-- ============================================================================
-- TRIGGERS PARA AUDITORIA AUTOMÁTICA
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO auditoria (empresa_id, tabela, operacao, registro_id, dados_anterior, dados_novo)
  VALUES (
    COALESCE(NEW.empresa_id, OLD.empresa_id),
    TG_TABLE_NAME,
    TG_OP,
    COALESCE(NEW.id::text, OLD.id::text),
    CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP != 'DELETE' THEN row_to_json(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Aplicar auditoria em tabelas críticas
CREATE TRIGGER audit_usuarios AFTER INSERT OR UPDATE OR DELETE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_vendas AFTER INSERT OR UPDATE OR DELETE ON vendas
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_pagamentos AFTER INSERT OR UPDATE OR DELETE ON pagamentos
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_nfce AFTER INSERT OR UPDATE OR DELETE ON nfce_emitidas
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ============================================================================
-- SEED: DADOS INICIAIS
-- ============================================================================

-- Criar empresa padrão (será substituída por dados reais)
INSERT INTO empresas (nome, cnpj, razao_social, tipo_negocio, ativa)
VALUES ('Empresa Teste', '00000000000191', 'Empresa Teste LTDA', 'bar', true)
ON CONFLICT (cnpj) DO NOTHING;

-- Criar categorias padrão
INSERT INTO categorias (empresa_id, nome)
SELECT id, 'Bebidas' FROM empresas WHERE cnpj = '00000000000191'
ON CONFLICT DO NOTHING;

INSERT INTO categorias (empresa_id, nome)
SELECT id, 'Comidas' FROM empresas WHERE cnpj = '00000000000191'
ON CONFLICT DO NOTHING;

-- Criar formas de pagamento padrão
INSERT INTO formas_pagamento (empresa_id, nome, tipo)
SELECT id, 'Dinheiro', 'dinheiro' FROM empresas WHERE cnpj = '00000000000191'
ON CONFLICT DO NOTHING;

INSERT INTO formas_pagamento (empresa_id, nome, tipo)
SELECT id, 'Cartão Crédito', 'cartao_credito' FROM empresas WHERE cnpj = '00000000000191'
ON CONFLICT DO NOTHING;

INSERT INTO formas_pagamento (empresa_id, nome, tipo)
SELECT id, 'Pix', 'pix' FROM empresas WHERE cnpj = '00000000000191'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- FIM DO SCHEMA
-- ============================================================================
