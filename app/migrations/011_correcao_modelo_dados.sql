-- =============================================================================
-- MIGRATION 011 — Correção do Modelo de Dados (P11 do KYTTO ERP)
-- Prioridade MÁXIMA: todos os demais pacotes dependem desta migration
-- Autor: SetPoint Ultra · Data: 2026-07-26
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. QUANTIDADE FRACIONÁRIA — DECIMAL(14,3) em todos os campos de quantidade
-- ─────────────────────────────────────────────────────────────────────────────

-- produtos: estoque_atual pode não existir como coluna (calculado via tabela estoque)
ALTER TABLE produtos
  ALTER COLUMN estoque_minimo TYPE DECIMAL(14,3) USING estoque_minimo::DECIMAL(14,3);

-- Adicionar estoque_atual como coluna calculada se não existir
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS estoque_atual DECIMAL(14,3) DEFAULT 0;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS peso_liquido DECIMAL(10,3);
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS peso_bruto DECIMAL(10,3);

-- movimentacoes_estoque (se existir) — garantir DECIMAL
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='movimentacoes_estoque') THEN
    EXECUTE 'ALTER TABLE movimentacoes_estoque ALTER COLUMN quantidade TYPE DECIMAL(14,3) USING quantidade::DECIMAL(14,3)';
  END IF;
END $$;

-- itens_venda: já é DECIMAL(12,3), ampliar para DECIMAL(14,3)
ALTER TABLE itens_venda
  ALTER COLUMN quantidade TYPE DECIMAL(14,3) USING quantidade::DECIMAL(14,3);

-- itens_comanda: já é DECIMAL(12,3), ampliar para DECIMAL(14,3)
ALTER TABLE itens_comanda
  ALTER COLUMN quantidade TYPE DECIMAL(14,3) USING quantidade::DECIMAL(14,3);

-- itens_compra
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='itens_compra' AND column_name='quantidade') THEN
    EXECUTE 'ALTER TABLE itens_compra ALTER COLUMN quantidade TYPE DECIMAL(14,3) USING quantidade::DECIMAL(14,3)';
  END IF;
END $$;

-- itens_inventario
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='itens_inventario' AND column_name='quantidade') THEN
    EXECUTE 'ALTER TABLE itens_inventario ALTER COLUMN quantidade TYPE DECIMAL(14,3) USING quantidade::DECIMAL(14,3)';
  END IF;
END $$;

-- estoque
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='estoque' AND column_name='quantidade') THEN
    EXECUTE 'ALTER TABLE estoque ALTER COLUMN quantidade TYPE DECIMAL(14,3) USING quantidade::DECIMAL(14,3)';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. CAMADA FISCAL DO PRODUTO — tabela produto_fiscal
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS produto_fiscal (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id     UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  produto_id     UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  -- Unidade de medida
  unidade_medida VARCHAR(6)  NOT NULL DEFAULT 'UN', -- UN, KG, LT, MT, CX, PC, DZ...
  unidade_tributavel VARCHAR(6),
  fator_conversao DECIMAL(10,4) DEFAULT 1,
  -- Classificação fiscal
  ncm            VARCHAR(8),
  cest           VARCHAR(7),
  origem         SMALLINT DEFAULT 0, -- 0=Nacional, 1=Estrangeira importação direta...8
  -- ICMS
  cfop_padrao_interno       VARCHAR(4),
  cfop_padrao_interestadual VARCHAR(4),
  cst_icms       VARCHAR(3),
  csosn          VARCHAR(3),
  aliquota_icms  DECIMAL(5,2) DEFAULT 0,
  reducao_base   DECIMAL(5,2) DEFAULT 0,
  mva_st         DECIMAL(5,2) DEFAULT 0,
  aliquota_st    DECIMAL(5,2) DEFAULT 0,
  -- PIS / COFINS
  cst_pis        VARCHAR(2),
  aliquota_pis   DECIMAL(5,4) DEFAULT 0,
  cst_cofins     VARCHAR(2),
  aliquota_cofins DECIMAL(5,4) DEFAULT 0,
  -- IPI
  cst_ipi        VARCHAR(2),
  aliquota_ipi   DECIMAL(5,2) DEFAULT 0,
  -- Pesos para NF-e 55
  peso_liquido   DECIMAL(10,3),
  peso_bruto     DECIMAL(10,3),
  -- Tributação por UF (DIFAL e ST)
  tributacao_uf  JSONB DEFAULT '{}',
  -- Controle
  criado_em      TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(empresa_id, produto_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. CÓDIGO DE BARRAS — tabela produto_codigo_barras
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS produto_codigo_barras (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id  UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  produto_id  UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  codigo      VARCHAR(50) NOT NULL,
  tipo        VARCHAR(10) NOT NULL DEFAULT 'EAN13', -- EAN13, EAN8, DUN14, CODE128, INTERNO, BALANCA
  principal   BOOLEAN DEFAULT false,
  -- Para código de balança: indica se o peso ou preço está embutido
  balanca_tipo VARCHAR(10), -- PESO, PRECO
  criado_em   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(empresa_id, codigo)
);

-- Migrar código de barras existente da tabela produtos
INSERT INTO produto_codigo_barras (empresa_id, produto_id, codigo, tipo, principal)
SELECT p.empresa_id, p.id, p.codigo_barras, 'EAN13', true
FROM produtos p
WHERE p.codigo_barras IS NOT NULL AND p.codigo_barras != ''
ON CONFLICT (empresa_id, codigo) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. SEGURANÇA DE SEGREDO — criptografia em repouso para certificado A1 e CSC
-- ─────────────────────────────────────────────────────────────────────────────

-- Renomear/adicionar colunas de certificado com nomenclatura segura
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS certificado_a1_encrypted  TEXT;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS certificado_a1_senha_enc  TEXT;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS certificado_a1_validade   DATE;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS csc_encrypted             TEXT;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS csc_id                    VARCHAR(10);

-- Migrar dados existentes (se houver)
UPDATE empresas SET certificado_a1_encrypted = certificado_a1_path WHERE certificado_a1_path IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. UNICIDADE POR TENANT — corrigir constraints UNIQUE globais
-- ─────────────────────────────────────────────────────────────────────────────

-- membros_clube.cpf: era UNIQUE global, deve ser UNIQUE por empresa
ALTER TABLE membros_clube DROP CONSTRAINT IF EXISTS membros_clube_cpf_key;
ALTER TABLE membros_clube ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_membros_clube_empresa_cpf ON membros_clube(empresa_id, cpf);

-- usuarios.cpf: era UNIQUE global
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_cpf_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_empresa_cpf ON usuarios(empresa_id, cpf) WHERE cpf IS NOT NULL;

-- transacoes_pix.txid: pode ser global (txid é único por natureza do PIX)
-- Mantido como está

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. TABELA DE LOJAS (MULTI-LOJA)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lojas (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id      UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome            VARCHAR(100) NOT NULL,
  cnpj            VARCHAR(14),
  razao_social    VARCHAR(200),
  inscricao_estadual VARCHAR(20),
  inscricao_municipal VARCHAR(20),
  endereco_logradouro VARCHAR(200),
  endereco_numero VARCHAR(20),
  endereco_bairro VARCHAR(100),
  endereco_cidade VARCHAR(100),
  endereco_estado CHAR(2),
  endereco_cep    VARCHAR(8),
  telefone        VARCHAR(20),
  -- Séries fiscais por loja
  serie_nfce      SMALLINT DEFAULT 1,
  serie_nfe       SMALLINT DEFAULT 1,
  serie_nfse      SMALLINT DEFAULT 1,
  -- Configurações
  ativa           BOOLEAN DEFAULT true,
  loja_padrao     BOOLEAN DEFAULT false,
  criado_em       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(empresa_id, nome)
);

-- Criar loja padrão para cada empresa existente
INSERT INTO lojas (empresa_id, nome, cnpj, loja_padrao)
SELECT id, 'Loja Principal', cnpj, true
FROM empresas
ON CONFLICT DO NOTHING;

-- Adicionar loja_id nas tabelas operacionais
ALTER TABLE vendas         ADD COLUMN IF NOT EXISTS loja_id UUID REFERENCES lojas(id);
ALTER TABLE pagamentos     ADD COLUMN IF NOT EXISTS loja_id UUID REFERENCES lojas(id);
ALTER TABLE caixas         ADD COLUMN IF NOT EXISTS loja_id UUID REFERENCES lojas(id);
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='estoque') THEN EXECUTE 'ALTER TABLE estoque ADD COLUMN IF NOT EXISTS loja_id UUID REFERENCES lojas(id)'; END IF; END $$;
ALTER TABLE compras        ADD COLUMN IF NOT EXISTS loja_id UUID REFERENCES lojas(id);
ALTER TABLE nfce_emitidas  ADD COLUMN IF NOT EXISTS loja_id UUID REFERENCES lojas(id);

-- Preencher loja_id com a loja padrão de cada empresa (migration de compatibilidade)
UPDATE vendas v SET loja_id = (SELECT id FROM lojas WHERE empresa_id = v.empresa_id AND loja_padrao = true LIMIT 1) WHERE loja_id IS NULL;
UPDATE pagamentos p SET loja_id = (SELECT id FROM lojas WHERE empresa_id = p.empresa_id AND loja_padrao = true LIMIT 1) WHERE loja_id IS NULL;
UPDATE caixas c SET loja_id = (SELECT id FROM lojas WHERE empresa_id = c.empresa_id AND loja_padrao = true LIMIT 1) WHERE loja_id IS NULL;
UPDATE estoque e SET loja_id = (SELECT id FROM lojas WHERE empresa_id = e.empresa_id AND loja_padrao = true LIMIT 1) WHERE loja_id IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. TABELA DE PREÇO
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tabela_preco (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id      UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome            VARCHAR(100) NOT NULL,
  tipo            VARCHAR(20) DEFAULT 'padrao', -- padrao, cliente, loja, atacado
  vigencia_inicio DATE,
  vigencia_fim    DATE,
  ativa           BOOLEAN DEFAULT true,
  criado_em       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(empresa_id, nome)
);

CREATE TABLE IF NOT EXISTS tabela_preco_item (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tabela_id         UUID NOT NULL REFERENCES tabela_preco(id) ON DELETE CASCADE,
  produto_id        UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  loja_id           UUID REFERENCES lojas(id),
  preco             DECIMAL(10,2) NOT NULL,
  preco_promocional DECIMAL(10,2),
  promocao_inicio   DATE,
  promocao_fim      DATE,
  criado_em         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tabela_id, produto_id, loja_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. DOCUMENTO FISCAL GENÉRICO — substituir nfce_emitidas
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS documento_fiscal (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id      UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id         UUID REFERENCES lojas(id),
  modelo          VARCHAR(5) NOT NULL, -- 55=NF-e, 65=NFC-e, 59=SAT, NFSe, CTe, MDFe
  serie           SMALLINT NOT NULL DEFAULT 1,
  numero          INTEGER NOT NULL,
  chave_acesso    VARCHAR(44) UNIQUE,
  -- Máquina de estados
  status          VARCHAR(20) NOT NULL DEFAULT 'rascunho',
  -- rascunho → assinado → transmitido → autorizado → cancelado / rejeitado / denegado / inutilizado
  -- Dados do documento
  natureza_operacao VARCHAR(100),
  cfop            VARCHAR(4),
  tipo_operacao   CHAR(1) DEFAULT '1', -- 0=entrada, 1=saída
  destinatario_nome VARCHAR(200),
  destinatario_cpf_cnpj VARCHAR(14),
  valor_total     DECIMAL(10,2),
  valor_icms      DECIMAL(10,2) DEFAULT 0,
  valor_pis       DECIMAL(10,2) DEFAULT 0,
  valor_cofins    DECIMAL(10,2) DEFAULT 0,
  valor_ipi       DECIMAL(10,2) DEFAULT 0,
  -- XML e protocolo
  xml_assinado    TEXT,
  xml_autorizado  TEXT,
  protocolo       VARCHAR(30),
  data_autorizacao TIMESTAMPTZ,
  motivo_rejeicao TEXT,
  -- Contingência
  em_contingencia BOOLEAN DEFAULT false,
  contingencia_motivo VARCHAR(200),
  contingencia_dt TIMESTAMPTZ,
  -- Cancelamento
  cancelado_em    TIMESTAMPTZ,
  cancelamento_protocolo VARCHAR(30),
  cancelamento_motivo TEXT,
  -- Carta de correção
  cce_numero      SMALLINT DEFAULT 0,
  -- Referências
  venda_id        UUID REFERENCES vendas(id),
  -- Controle
  criado_em       TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ DEFAULT NOW(),
  -- Numeração sequencial por (empresa, loja, modelo, serie) — sem buraco
  UNIQUE(empresa_id, loja_id, modelo, serie, numero)
);

-- Migrar NFC-e existentes para documento_fiscal
INSERT INTO documento_fiscal (
  empresa_id, modelo, serie, numero, chave_acesso, status,
  xml_autorizado, protocolo, data_autorizacao, criado_em, venda_id
)
SELECT
  empresa_id, '65',
  COALESCE(NULLIF(serie,''),'1')::SMALLINT,
  REGEXP_REPLACE(numero_nfce, '[^0-9]', '', 'g')::INTEGER,
  chave_acesso,
  CASE status WHEN 'emitida' THEN 'autorizado' WHEN 'cancelada' THEN 'cancelado' ELSE 'rascunho' END,
  xml_nfce, protocolo_sefaz, data_emissao, data_emissao, venda_id
FROM nfce_emitidas
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. RASTREABILIDADE DA VENDA
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE vendas ADD COLUMN IF NOT EXISTS usuario_id  UUID REFERENCES usuarios(id);
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS terminal_id VARCHAR(50);
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS turno_id    UUID;

-- pagamentos.usuario_id já existe, apenas adicionar terminal_id
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS terminal_id VARCHAR(50);

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. CONCILIAÇÃO DE RECEBÍVEL
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS parcelas           SMALLINT DEFAULT 1;
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS parcela_numero     SMALLINT DEFAULT 1;
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS taxa_percentual    DECIMAL(5,4) DEFAULT 0;
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS taxa_valor         DECIMAL(10,2) DEFAULT 0;
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS valor_liquido      DECIMAL(10,2);
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS previsao_recebimento DATE;
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS data_recebimento   DATE;
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS conciliado         BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS recebiveis (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id          UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  pagamento_id        UUID REFERENCES pagamentos(id),
  adquirente          VARCHAR(30),
  nsu                 VARCHAR(30),
  autorizacao         VARCHAR(20),
  bandeira            VARCHAR(20),
  parcela             SMALLINT DEFAULT 1,
  total_parcelas      SMALLINT DEFAULT 1,
  valor_bruto         DECIMAL(10,2) NOT NULL,
  taxa_percentual     DECIMAL(5,4) DEFAULT 0,
  taxa_valor          DECIMAL(10,2) DEFAULT 0,
  valor_liquido       DECIMAL(10,2) NOT NULL,
  previsao_recebimento DATE NOT NULL,
  data_recebimento    DATE,
  conciliado          BOOLEAN DEFAULT false,
  criado_em           TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. IMUTABILIDADE E ÍNDICES DE PERFORMANCE
-- ─────────────────────────────────────────────────────────────────────────────

-- Exclusão lógica nas tabelas principais
ALTER TABLE produtos    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='clientes') THEN EXECUTE 'ALTER TABLE clientes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ'; END IF; END $$;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE usuarios    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Trilha de auditoria imutável (5 anos de retenção)
CREATE TABLE IF NOT EXISTS auditoria_fiscal (
  id          BIGSERIAL PRIMARY KEY,
  empresa_id  UUID NOT NULL,
  loja_id     UUID,
  tabela      VARCHAR(50) NOT NULL,
  registro_id UUID NOT NULL,
  operacao    VARCHAR(10) NOT NULL, -- INSERT, UPDATE, DELETE
  usuario_id  UUID,
  ip_origem   INET,
  dados_antes JSONB,
  dados_depois JSONB,
  criado_em   TIMESTAMPTZ DEFAULT NOW()
);

-- Índices de performance críticos
CREATE INDEX IF NOT EXISTS idx_doc_fiscal_empresa_loja_data ON documento_fiscal(empresa_id, loja_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_doc_fiscal_status ON documento_fiscal(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_doc_fiscal_chave ON documento_fiscal(chave_acesso) WHERE chave_acesso IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_produto_fiscal_empresa ON produto_fiscal(empresa_id);
CREATE INDEX IF NOT EXISTS idx_produto_codbar_empresa ON produto_codigo_barras(empresa_id, codigo);
CREATE INDEX IF NOT EXISTS idx_tabela_preco_empresa ON tabela_preco(empresa_id, ativa);
CREATE INDEX IF NOT EXISTS idx_recebiveis_empresa_data ON recebiveis(empresa_id, previsao_recebimento);
CREATE INDEX IF NOT EXISTS idx_recebiveis_conciliado ON recebiveis(empresa_id, conciliado, previsao_recebimento);
CREATE INDEX IF NOT EXISTS idx_auditoria_fiscal_empresa ON auditoria_fiscal(empresa_id, tabela, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_lojas_empresa ON lojas(empresa_id, ativa);
CREATE INDEX IF NOT EXISTS idx_vendas_loja_data ON vendas(empresa_id, loja_id, data_venda DESC);
CREATE INDEX IF NOT EXISTS idx_vendas_cliente ON vendas(empresa_id) WHERE loja_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_produtos_deleted ON produtos(empresa_id) WHERE deleted_at IS NULL;

-- Comentários de documentação
COMMENT ON TABLE produto_fiscal IS 'Dados fiscais por produto: NCM, CFOP, CST, alíquotas ICMS/PIS/COFINS/IPI';
COMMENT ON TABLE produto_codigo_barras IS 'Múltiplos códigos de barras por produto (embalagem, fardo, unidade, balança)';
COMMENT ON TABLE lojas IS 'Unidades/filiais por empresa — suporte multi-loja';
COMMENT ON TABLE tabela_preco IS 'Tabelas de preço por empresa: base, cliente, loja, atacado';
COMMENT ON TABLE documento_fiscal IS 'Documento fiscal unificado: NF-e 55, NFC-e 65, SAT 59, NFS-e, CT-e, MDF-e';
COMMENT ON TABLE recebiveis IS 'Agenda de recebíveis de cartão para conciliação automática';
COMMENT ON TABLE auditoria_fiscal IS 'Trilha de auditoria imutável — retenção mínima 5 anos (obrigação fiscal)';

COMMIT;
