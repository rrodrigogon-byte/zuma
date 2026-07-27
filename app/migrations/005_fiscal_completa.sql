-- Migração 005: Camada Fiscal Completa
-- NF-e 55, SAT-CF-e, MFE, NFS-e com máquina de estados e contingência offline
-- ============================================================================

-- Tabela de documentos fiscais (envelope universal)
CREATE TABLE IF NOT EXISTS documentos_fiscais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  loja_id UUID NOT NULL,
  venda_id UUID NOT NULL,
  tipo_documento VARCHAR(20) NOT NULL, -- 'nfe', 'sat', 'mfe', 'nfse'
  numero_documento BIGINT NOT NULL,
  serie_documento SMALLINT NOT NULL DEFAULT 1,
  chave_acesso VARCHAR(44), -- NF-e: 44 dígitos
  assinatura_xml TEXT, -- XML assinado com certificado A1
  status_fiscal VARCHAR(50) NOT NULL DEFAULT 'rascunho', -- rascunho, autorizado, cancelado, denegado, contingencia
  motivo_status TEXT,
  data_emissao TIMESTAMP NOT NULL,
  data_autorizacao TIMESTAMP,
  data_cancelamento TIMESTAMP,
  protocolo_autorizacao VARCHAR(15),
  protocolo_cancelamento VARCHAR(15),
  numero_sat VARCHAR(6), -- SAT-CF-e: número sequencial
  natureza_operacao VARCHAR(120), -- Ex: 'Venda de Mercadoria'
  descricao_operacao TEXT,
  valor_operacao NUMERIC(15,2) NOT NULL,
  valor_desconto NUMERIC(15,2) DEFAULT 0,
  valor_acrescimo NUMERIC(15,2) DEFAULT 0,
  valor_total NUMERIC(15,2) NOT NULL,
  valor_icms NUMERIC(15,2) DEFAULT 0,
  valor_pis NUMERIC(15,2) DEFAULT 0,
  valor_cofins NUMERIC(15,2) DEFAULT 0,
  valor_ipi NUMERIC(15,2) DEFAULT 0,
  valor_substituto_tributario NUMERIC(15,2) DEFAULT 0,
  observacoes_complementares TEXT,
  usuario_id UUID NOT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE RESTRICT,
  FOREIGN KEY (loja_id) REFERENCES lojas(id) ON DELETE RESTRICT,
  FOREIGN KEY (venda_id) REFERENCES vendas(id) ON DELETE RESTRICT,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
  UNIQUE (empresa_id, loja_id, tipo_documento, numero_documento, serie_documento)
);

CREATE INDEX idx_documentos_fiscais_empresa_loja ON documentos_fiscais(empresa_id, loja_id);
CREATE INDEX idx_documentos_fiscais_venda ON documentos_fiscais(venda_id);
CREATE INDEX idx_documentos_fiscais_chave ON documentos_fiscais(chave_acesso);
CREATE INDEX idx_documentos_fiscais_status ON documentos_fiscais(status_fiscal);
CREATE INDEX idx_documentos_fiscais_data_emissao ON documentos_fiscais(data_emissao);

-- Tabela de itens do documento fiscal
CREATE TABLE IF NOT EXISTS documentos_fiscais_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_fiscal_id UUID NOT NULL,
  numero_item SMALLINT NOT NULL,
  produto_id UUID NOT NULL,
  descricao_produto VARCHAR(500) NOT NULL,
  ncm VARCHAR(8),
  cest VARCHAR(7),
  cfop VARCHAR(4),
  unidade_medida VARCHAR(6) NOT NULL DEFAULT 'UN',
  quantidade NUMERIC(15,4) NOT NULL,
  valor_unitario NUMERIC(15,2) NOT NULL,
  valor_desconto NUMERIC(15,2) DEFAULT 0,
  valor_acrescimo NUMERIC(15,2) DEFAULT 0,
  valor_total NUMERIC(15,2) NOT NULL,
  aliquota_icms NUMERIC(5,2) DEFAULT 0,
  aliquota_pis NUMERIC(5,2) DEFAULT 0,
  aliquota_cofins NUMERIC(5,2) DEFAULT 0,
  aliquota_ipi NUMERIC(5,2) DEFAULT 0,
  cst_icms VARCHAR(3),
  csosn_icms VARCHAR(3),
  cst_pis VARCHAR(2),
  cst_cofins VARCHAR(2),
  valor_icms NUMERIC(15,2) DEFAULT 0,
  valor_pis NUMERIC(15,2) DEFAULT 0,
  valor_cofins NUMERIC(15,2) DEFAULT 0,
  valor_ipi NUMERIC(15,2) DEFAULT 0,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (documento_fiscal_id) REFERENCES documentos_fiscais(id) ON DELETE CASCADE,
  FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE RESTRICT
);

CREATE INDEX idx_documentos_fiscais_itens_documento ON documentos_fiscais_itens(documento_fiscal_id);

-- Tabela de máquina de estados fiscal
CREATE TABLE IF NOT EXISTS maquina_estados_fiscal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  loja_id UUID NOT NULL,
  documento_fiscal_id UUID NOT NULL,
  estado_anterior VARCHAR(50),
  estado_novo VARCHAR(50) NOT NULL,
  motivo_transicao VARCHAR(255),
  dados_transicao JSONB,
  usuario_id UUID,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE RESTRICT,
  FOREIGN KEY (loja_id) REFERENCES lojas(id) ON DELETE RESTRICT,
  FOREIGN KEY (documento_fiscal_id) REFERENCES documentos_fiscais(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE INDEX idx_maquina_estados_fiscal_documento ON maquina_estados_fiscal(documento_fiscal_id);
CREATE INDEX idx_maquina_estados_fiscal_empresa_loja ON maquina_estados_fiscal(empresa_id, loja_id);

-- Tabela de contingência fiscal (offline)
CREATE TABLE IF NOT EXISTS contingencia_fiscal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  loja_id UUID NOT NULL,
  tipo_documento VARCHAR(20) NOT NULL,
  motivo_contingencia VARCHAR(255) NOT NULL,
  data_inicio TIMESTAMP NOT NULL,
  data_fim TIMESTAMP,
  status VARCHAR(50) NOT NULL DEFAULT 'ativa', -- ativa, encerrada, reprocessada
  documentos_emitidos BIGINT DEFAULT 0,
  documentos_reprocessados BIGINT DEFAULT 0,
  observacoes TEXT,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE RESTRICT,
  FOREIGN KEY (loja_id) REFERENCES lojas(id) ON DELETE RESTRICT
);

CREATE INDEX idx_contingencia_fiscal_empresa_loja ON contingencia_fiscal(empresa_id, loja_id);
CREATE INDEX idx_contingencia_fiscal_status ON contingencia_fiscal(status);

-- Tabela de certificados A1 (para assinatura digital)
CREATE TABLE IF NOT EXISTS certificados_a1 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  cnpj_certificado VARCHAR(14) NOT NULL,
  razao_social_certificado VARCHAR(255),
  certificado_pfx BYTEA NOT NULL, -- Arquivo PFX criptografado
  senha_certificado_hash VARCHAR(255), -- Hash da senha (nunca armazenar em texto plano)
  data_validade_inicio DATE NOT NULL,
  data_validade_fim DATE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'ativo', -- ativo, expirado, revogado
  tipo_certificado VARCHAR(50), -- e-CNPJ, e-CPF
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE RESTRICT,
  UNIQUE (empresa_id, cnpj_certificado)
);

CREATE INDEX idx_certificados_a1_empresa ON certificados_a1(empresa_id);
CREATE INDEX idx_certificados_a1_status ON certificados_a1(status);

-- Tabela de manifestação do destinatário (NF-e)
CREATE TABLE IF NOT EXISTS manifestacoes_destinatario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  documento_fiscal_id UUID NOT NULL,
  tipo_manifestacao VARCHAR(50) NOT NULL, -- 'ciencia', 'desconhecimento', 'nao_realizada', 'operacao_realizada'
  justificativa TEXT,
  sequencia_evento BIGINT NOT NULL,
  data_manifestacao TIMESTAMP NOT NULL,
  usuario_id UUID,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE RESTRICT,
  FOREIGN KEY (documento_fiscal_id) REFERENCES documentos_fiscais(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE INDEX idx_manifestacoes_destinatario_documento ON manifestacoes_destinatario(documento_fiscal_id);
CREATE INDEX idx_manifestacoes_destinatario_empresa ON manifestacoes_destinatario(empresa_id);

-- Tabela de configuração fiscal por loja
CREATE TABLE IF NOT EXISTS configuracao_fiscal_loja (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  loja_id UUID NOT NULL,
  tipo_documento_padrao VARCHAR(20) NOT NULL DEFAULT 'nfe', -- nfe, sat, mfe, nfse
  regime_tributario VARCHAR(50) NOT NULL, -- 'simples_nacional', 'lucro_presumido', 'lucro_real'
  serie_nfe SMALLINT DEFAULT 1,
  proxima_numero_nfe BIGINT DEFAULT 1,
  serie_sat SMALLINT DEFAULT 1,
  proxima_numero_sat BIGINT DEFAULT 1,
  cnpj_loja VARCHAR(14) NOT NULL,
  inscricao_estadual VARCHAR(20),
  inscricao_municipal VARCHAR(20),
  endereco_loja VARCHAR(500),
  telefone_loja VARCHAR(20),
  email_loja VARCHAR(255),
  ambiente_nfe VARCHAR(20) NOT NULL DEFAULT 'producao', -- producao, homologacao
  certificado_a1_id UUID,
  contingencia_ativa BOOLEAN DEFAULT FALSE,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE RESTRICT,
  FOREIGN KEY (loja_id) REFERENCES lojas(id) ON DELETE RESTRICT,
  FOREIGN KEY (certificado_a1_id) REFERENCES certificados_a1(id) ON DELETE SET NULL,
  UNIQUE (empresa_id, loja_id)
);

CREATE INDEX idx_configuracao_fiscal_loja_empresa ON configuracao_fiscal_loja(empresa_id, loja_id);

-- Tabela de log de integração fiscal (para auditoria e troubleshooting)
CREATE TABLE IF NOT EXISTS log_integracao_fiscal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  loja_id UUID NOT NULL,
  documento_fiscal_id UUID,
  tipo_operacao VARCHAR(50) NOT NULL, -- 'autorizacao', 'cancelamento', 'consulta', 'manifestacao'
  status_resposta VARCHAR(50) NOT NULL,
  codigo_resposta VARCHAR(10),
  mensagem_resposta TEXT,
  xml_enviado TEXT,
  xml_resposta TEXT,
  tempo_resposta_ms BIGINT,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE RESTRICT,
  FOREIGN KEY (loja_id) REFERENCES lojas(id) ON DELETE RESTRICT,
  FOREIGN KEY (documento_fiscal_id) REFERENCES documentos_fiscais(id) ON DELETE SET NULL
);

CREATE INDEX idx_log_integracao_fiscal_empresa_loja ON log_integracao_fiscal(empresa_id, loja_id);
CREATE INDEX idx_log_integracao_fiscal_documento ON log_integracao_fiscal(documento_fiscal_id);
CREATE INDEX idx_log_integracao_fiscal_tipo_operacao ON log_integracao_fiscal(tipo_operacao);

-- Trigger para auditoria de documentos fiscais
CREATE OR REPLACE FUNCTION audit_documentos_fiscais()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO auditoria_imutavel (
      empresa_id, loja_id, tabela, registro_id, operacao, usuario_id,
      dados_anterior, dados_novo, ocorreu_em
    ) VALUES (
      NEW.empresa_id, NEW.loja_id, 'documentos_fiscais', NEW.id, 'UPDATE',
      NEW.usuario_id, row_to_json(OLD), row_to_json(NEW), CURRENT_TIMESTAMP
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_audit_documentos_fiscais ON documentos_fiscais;
CREATE TRIGGER trigger_audit_documentos_fiscais
AFTER UPDATE ON documentos_fiscais
FOR EACH ROW EXECUTE FUNCTION audit_documentos_fiscais();

-- Trigger para atualizar timestamp de atualização
CREATE OR REPLACE FUNCTION atualizar_timestamp_fiscal()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_atualizar_timestamp_documentos_fiscais ON documentos_fiscais;
CREATE TRIGGER trigger_atualizar_timestamp_documentos_fiscais
BEFORE UPDATE ON documentos_fiscais
FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp_fiscal();

DROP TRIGGER IF EXISTS trigger_atualizar_timestamp_certificados_a1 ON certificados_a1;
CREATE TRIGGER trigger_atualizar_timestamp_certificados_a1
BEFORE UPDATE ON certificados_a1
FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp_fiscal();

DROP TRIGGER IF EXISTS trigger_atualizar_timestamp_configuracao_fiscal_loja ON configuracao_fiscal_loja;
CREATE TRIGGER trigger_atualizar_timestamp_configuracao_fiscal_loja
BEFORE UPDATE ON configuracao_fiscal_loja
FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp_fiscal();

-- View para relatório de documentos fiscais por período
CREATE OR REPLACE VIEW vw_documentos_fiscais_resumo AS
SELECT
  df.empresa_id,
  df.loja_id,
  df.tipo_documento,
  COUNT(*) as quantidade_documentos,
  SUM(df.valor_total) as valor_total,
  SUM(df.valor_icms) as valor_icms_total,
  SUM(df.valor_pis) as valor_pis_total,
  SUM(df.valor_cofins) as valor_cofins_total,
  DATE(df.data_emissao) as data_emissao
FROM documentos_fiscais df
WHERE df.status_fiscal IN ('autorizado', 'cancelado')
GROUP BY df.empresa_id, df.loja_id, df.tipo_documento, DATE(df.data_emissao);

-- View para documentos em contingência
CREATE OR REPLACE VIEW vw_contingencia_ativa AS
SELECT
  cf.empresa_id,
  cf.loja_id,
  cf.tipo_documento,
  cf.motivo_contingencia,
  cf.data_inicio,
  COUNT(df.id) as documentos_emitidos_contingencia
FROM contingencia_fiscal cf
LEFT JOIN documentos_fiscais df ON
  df.empresa_id = cf.empresa_id AND
  df.loja_id = cf.loja_id AND
  df.tipo_documento = cf.tipo_documento AND
  df.status_fiscal = 'contingencia' AND
  df.data_emissao >= cf.data_inicio AND
  (cf.data_fim IS NULL OR df.data_emissao <= cf.data_fim)
WHERE cf.status = 'ativa'
GROUP BY cf.empresa_id, cf.loja_id, cf.tipo_documento, cf.motivo_contingencia, cf.data_inicio;
