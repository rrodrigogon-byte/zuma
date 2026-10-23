-- 092 — Fiscal por empresa e unidade (NFC-e 65, NF-e 55 e NFS-e Nacional).
--
-- Nesta etapa a emissão é SÓ EM HOMOLOGAÇÃO (SEFAZ tpAmb=2 / Sefin "produção restrita"): a
-- coluna `ambiente` aceita apenas 'homologacao'. Liberar produção exige uma migração nova e
-- decisão explícita, depois do ciclo emitir + cancelar em homologação por empresa.
--
-- Certificado A1: o PFX e a senha ficam cifrados (AES-256-GCM, chave mestra fora do banco, em
-- FISCAL_CERT_MASTER_KEY). O banco nunca guarda segredo em claro; a API nunca os devolve.

CREATE TABLE IF NOT EXISTS fis_certificados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  titular VARCHAR(240) NOT NULL,
  cnpj VARCHAR(14),
  valido_de TIMESTAMPTZ,
  valido_ate TIMESTAMPTZ NOT NULL,
  impressao_digital CHAR(64) NOT NULL,
  pfx_cifrado TEXT NOT NULL,
  senha_cifrada TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT false,
  enviado_por VARCHAR(180),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (empresa_id, id),
  UNIQUE (empresa_id, impressao_digital)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_fis_cert_ativo ON fis_certificados (empresa_id) WHERE ativo = true;

-- Emitente: a empresa (loja_id NULL) ou uma unidade com CNPJ próprio.
CREATE TABLE IF NOT EXISTS fis_emitentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID,
  cnpj VARCHAR(14) NOT NULL,
  razao_social VARCHAR(240) NOT NULL,
  nome_fantasia VARCHAR(240),
  ie VARCHAR(20),
  im VARCHAR(20),
  crt CHAR(1) NOT NULL DEFAULT '1',
  uf CHAR(2) NOT NULL,
  codigo_municipio CHAR(7) NOT NULL,
  endereco JSONB NOT NULL DEFAULT '{}'::jsonb,
  ambiente VARCHAR(20) NOT NULL DEFAULT 'homologacao',
  csc_id VARCHAR(10),
  csc_cifrado TEXT,
  natureza_operacao VARCHAR(60) NOT NULL DEFAULT 'VENDA DE MERCADORIA',
  -- NFS-e Nacional
  op_simp_nac CHAR(1) NOT NULL DEFAULT '3',
  reg_ap_trib_sn CHAR(1) NOT NULL DEFAULT '1',
  reg_esp_trib CHAR(1) NOT NULL DEFAULT '0',
  p_tot_trib_sn NUMERIC(5,2),
  c_trib_nac_padrao CHAR(6),
  ativo BOOLEAN NOT NULL DEFAULT true,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (empresa_id, id),
  CONSTRAINT chk_fis_emit_ambiente CHECK (ambiente = 'homologacao'),
  CONSTRAINT chk_fis_emit_crt CHECK (crt IN ('1', '2', '3', '4')),
  CONSTRAINT chk_fis_emit_cnpj CHECK (cnpj ~ '^[0-9]{14}$'),
  CONSTRAINT chk_fis_emit_mun CHECK (codigo_municipio ~ '^[0-9]{7}$')
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_fis_emitente_unidade ON fis_emitentes (empresa_id, COALESCE(loja_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Numeração por emitente, modelo e série (trava de linha ao reservar: nunca dois com o mesmo número).
CREATE TABLE IF NOT EXISTS fis_numeracao (
  empresa_id UUID NOT NULL,
  emitente_id UUID NOT NULL,
  modelo VARCHAR(5) NOT NULL,
  serie INTEGER NOT NULL,
  proximo BIGINT NOT NULL DEFAULT 1,
  PRIMARY KEY (empresa_id, emitente_id, modelo, serie),
  CONSTRAINT fk_fis_num_emit FOREIGN KEY (empresa_id, emitente_id) REFERENCES fis_emitentes (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT chk_fis_num_modelo CHECK (modelo IN ('55', '65', 'nfse')),
  CONSTRAINT chk_fis_num_serie CHECK (serie BETWEEN 0 AND 999 AND proximo >= 1)
);

-- Classificação fiscal do que é vendido (produto do bar, variante da loja, item do estoque, serviço).
CREATE TABLE IF NOT EXISTS fis_classificacoes (
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  fonte VARCHAR(20) NOT NULL,
  fonte_id VARCHAR(80) NOT NULL,
  tipo VARCHAR(10) NOT NULL DEFAULT 'produto',
  ncm CHAR(8),
  cest CHAR(7),
  cfop CHAR(4),
  origem CHAR(1) NOT NULL DEFAULT '0',
  csosn CHAR(3),
  cst_icms CHAR(2),
  aliquota_icms NUMERIC(6,2) NOT NULL DEFAULT 0,
  cst_pis CHAR(2) NOT NULL DEFAULT '49',
  cst_cofins CHAR(2) NOT NULL DEFAULT '49',
  aliquota_pis NUMERIC(7,4) NOT NULL DEFAULT 0,
  aliquota_cofins NUMERIC(7,4) NOT NULL DEFAULT 0,
  unidade_tributavel VARCHAR(6),
  c_trib_nac CHAR(6),
  aliquota_iss NUMERIC(5,2),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (empresa_id, fonte, fonte_id),
  CONSTRAINT chk_fis_cls_fonte CHECK (fonte IN ('bar_produto', 'loja_variante', 'est_item', 'servico', 'categoria')),
  CONSTRAINT chk_fis_cls_tipo CHECK (tipo IN ('produto', 'servico')),
  CONSTRAINT chk_fis_cls_ncm CHECK (ncm IS NULL OR ncm ~ '^[0-9]{8}$'),
  CONSTRAINT chk_fis_cls_cfop CHECK (cfop IS NULL OR cfop ~ '^[1-7][0-9]{3}$'),
  CONSTRAINT chk_fis_cls_ctrib CHECK (c_trib_nac IS NULL OR c_trib_nac ~ '^[0-9]{6}$')
);

CREATE TABLE IF NOT EXISTS fis_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  emitente_id UUID NOT NULL,
  loja_id UUID,
  modelo VARCHAR(5) NOT NULL,
  serie INTEGER NOT NULL,
  numero BIGINT NOT NULL,
  ambiente VARCHAR(20) NOT NULL DEFAULT 'homologacao',
  status VARCHAR(30) NOT NULL DEFAULT 'rascunho',
  chave VARCHAR(50),
  protocolo VARCHAR(60),
  id_dps VARCHAR(45),
  origem VARCHAR(30) NOT NULL,
  origem_id VARCHAR(80),
  idempotencia VARCHAR(120) NOT NULL,
  valor_total NUMERIC(14,2) NOT NULL,
  dados JSONB NOT NULL DEFAULT '{}'::jsonb,
  xml_assinado TEXT,
  xml_autorizado TEXT,
  mensagens JSONB NOT NULL DEFAULT '[]'::jsonb,
  emitido_por VARCHAR(180),
  autorizado_em TIMESTAMPTZ,
  cancelado_em TIMESTAMPTZ,
  motivo_cancelamento VARCHAR(255),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (empresa_id, id),
  UNIQUE (empresa_id, idempotencia),
  CONSTRAINT uq_fis_doc_numero UNIQUE (empresa_id, emitente_id, modelo, serie, numero),
  CONSTRAINT fk_fis_doc_emit FOREIGN KEY (empresa_id, emitente_id) REFERENCES fis_emitentes (empresa_id, id),
  CONSTRAINT chk_fis_doc_modelo CHECK (modelo IN ('55', '65', 'nfse')),
  CONSTRAINT chk_fis_doc_ambiente CHECK (ambiente = 'homologacao'),
  CONSTRAINT chk_fis_doc_status CHECK (status IN ('rascunho', 'enviando', 'autorizado', 'rejeitado', 'falha_comunicacao', 'validado_localmente', 'cancelado')),
  CONSTRAINT chk_fis_doc_valor CHECK (valor_total >= 0)
);
CREATE INDEX IF NOT EXISTS idx_fis_doc_origem ON fis_documentos (empresa_id, origem, origem_id);
-- uma venda tem no máximo um documento vivo por modelo (rejeitado e cancelado não contam)
CREATE UNIQUE INDEX IF NOT EXISTS uq_fis_doc_origem_viva ON fis_documentos (empresa_id, origem, origem_id, modelo)
  WHERE origem_id IS NOT NULL AND status IN ('rascunho', 'enviando', 'falha_comunicacao', 'autorizado', 'validado_localmente');
CREATE INDEX IF NOT EXISTS idx_fis_doc_lista ON fis_documentos (empresa_id, criado_em DESC);

CREATE TABLE IF NOT EXISTS fis_eventos (
  id BIGSERIAL PRIMARY KEY,
  empresa_id UUID NOT NULL,
  documento_id UUID NOT NULL,
  tipo VARCHAR(40) NOT NULL,
  detalhe JSONB NOT NULL DEFAULT '{}'::jsonb,
  usuario VARCHAR(180),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_fis_evt_doc FOREIGN KEY (empresa_id, documento_id) REFERENCES fis_documentos (empresa_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_fis_evt_doc ON fis_eventos (empresa_id, documento_id, criado_em);
