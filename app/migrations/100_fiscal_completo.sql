-- 100 — Fiscal completo (continua SÓ HOMOLOGAÇÃO): inutilização de numeração, contingência
-- offline da NFC-e (tpEmis=9) e tabela IBPT (Lei 12.741/2012, tributos aproximados).
-- Aditiva: tabelas novas, colunas novas e o CHECK de status de fis_documentos ampliado com
-- 'contingencia'. O CHECK de ambiente (= 'homologacao') continua valendo em tudo.

-- ── contingência offline da NFC-e ────────────────────────────────────────────
ALTER TABLE fis_documentos ADD COLUMN IF NOT EXISTS tp_emis CHAR(1) NOT NULL DEFAULT '1';
ALTER TABLE fis_documentos ADD COLUMN IF NOT EXISTS contingencia_em TIMESTAMPTZ;
ALTER TABLE fis_documentos ADD COLUMN IF NOT EXISTS contingencia_justificativa VARCHAR(256);
ALTER TABLE fis_documentos ADD COLUMN IF NOT EXISTS contingencia_atrasada BOOLEAN NOT NULL DEFAULT false;
-- XML da tentativa normal (tpEmis=1) substituído pelo de contingência: se a SEFAZ disser depois
-- que a original já tinha sido autorizada (cStat 539), é ela que vale.
ALTER TABLE fis_documentos ADD COLUMN IF NOT EXISTS xml_substituido TEXT;
ALTER TABLE fis_documentos ADD COLUMN IF NOT EXISTS chave_substituida VARCHAR(50);

ALTER TABLE fis_documentos DROP CONSTRAINT IF EXISTS chk_fis_doc_status;
ALTER TABLE fis_documentos ADD CONSTRAINT chk_fis_doc_status CHECK (status IN ('rascunho', 'enviando', 'autorizado', 'rejeitado', 'falha_comunicacao', 'validado_localmente', 'cancelado', 'contingencia'));
ALTER TABLE fis_documentos DROP CONSTRAINT IF EXISTS chk_fis_doc_tp_emis;
ALTER TABLE fis_documentos ADD CONSTRAINT chk_fis_doc_tp_emis CHECK (tp_emis IN ('1', '9') AND (tp_emis = '1' OR modelo = '65'));

-- a NFC-e em contingência é documento vivo da venda (não pode haver outra nota da mesma venda)
DROP INDEX IF EXISTS uq_fis_doc_origem_viva;
CREATE UNIQUE INDEX IF NOT EXISTS uq_fis_doc_origem_viva ON fis_documentos (empresa_id, origem, origem_id, modelo)
  WHERE origem_id IS NOT NULL AND status IN ('rascunho', 'enviando', 'falha_comunicacao', 'autorizado', 'validado_localmente', 'contingencia');
CREATE INDEX IF NOT EXISTS idx_fis_doc_contingencia ON fis_documentos (empresa_id, contingencia_em) WHERE status = 'contingencia';

-- ── inutilização de numeração (NF-e 55 e NFC-e 65) ───────────────────────────
CREATE TABLE IF NOT EXISTS fis_inutilizacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  emitente_id UUID NOT NULL,
  loja_id UUID,
  modelo VARCHAR(5) NOT NULL,
  serie INTEGER NOT NULL,
  numero_inicial BIGINT NOT NULL,
  numero_final BIGINT NOT NULL,
  ano CHAR(2) NOT NULL,
  justificativa VARCHAR(255) NOT NULL,
  ambiente VARCHAR(20) NOT NULL DEFAULT 'homologacao',
  status VARCHAR(30) NOT NULL DEFAULT 'validado_localmente',
  id_inut VARCHAR(50),
  xml_assinado TEXT,
  xml_retorno TEXT,
  protocolo VARCHAR(60),
  mensagens JSONB NOT NULL DEFAULT '[]'::jsonb,
  criado_por VARCHAR(180),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (empresa_id, id),
  CONSTRAINT fk_fis_inut_emit FOREIGN KEY (empresa_id, emitente_id) REFERENCES fis_emitentes (empresa_id, id),
  CONSTRAINT chk_fis_inut_modelo CHECK (modelo IN ('55', '65')),
  CONSTRAINT chk_fis_inut_ambiente CHECK (ambiente = 'homologacao'),
  CONSTRAINT chk_fis_inut_faixa CHECK (serie BETWEEN 0 AND 999 AND numero_inicial >= 1 AND numero_final >= numero_inicial AND numero_final <= 999999999),
  CONSTRAINT chk_fis_inut_just CHECK (char_length(justificativa) BETWEEN 15 AND 255),
  CONSTRAINT chk_fis_inut_status CHECK (status IN ('validado_localmente', 'enviando', 'homologada', 'rejeitada', 'falha_comunicacao'))
);
CREATE INDEX IF NOT EXISTS idx_fis_inut_faixa ON fis_inutilizacoes (empresa_id, emitente_id, modelo, serie, numero_inicial, numero_final);
-- a mesma faixa só tem um pedido vivo (rejeitada pode ser pedida de novo)
CREATE UNIQUE INDEX IF NOT EXISTS uq_fis_inut_faixa_viva ON fis_inutilizacoes (empresa_id, emitente_id, modelo, serie, numero_inicial, numero_final)
  WHERE status <> 'rejeitada';

-- ── IBPT (tributos aproximados, Lei 12.741/2012) ─────────────────────────────
-- Uma tabela por empresa e UF, importada do CSV oficial do IBPT ("De Olho no Imposto").
-- tipo: 0 = NCM (produto), 1 = NBS (serviço), 2 = LC 116 (serviço).
CREATE TABLE IF NOT EXISTS fis_ibpt (
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  uf CHAR(2) NOT NULL,
  tipo CHAR(1) NOT NULL DEFAULT '0',
  codigo VARCHAR(12) NOT NULL,
  ex VARCHAR(3) NOT NULL DEFAULT '',
  descricao VARCHAR(500),
  nacional_federal NUMERIC(7,2) NOT NULL DEFAULT 0,
  importados_federal NUMERIC(7,2) NOT NULL DEFAULT 0,
  estadual NUMERIC(7,2) NOT NULL DEFAULT 0,
  municipal NUMERIC(7,2) NOT NULL DEFAULT 0,
  vigencia_inicio DATE,
  vigencia_fim DATE,
  chave VARCHAR(20),
  versao VARCHAR(20),
  fonte VARCHAR(80),
  importado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (empresa_id, uf, tipo, codigo, ex),
  CONSTRAINT chk_fis_ibpt_tipo CHECK (tipo IN ('0', '1', '2')),
  CONSTRAINT chk_fis_ibpt_uf CHECK (uf ~ '^[A-Z]{2}$'),
  CONSTRAINT chk_fis_ibpt_aliquotas CHECK (nacional_federal BETWEEN 0 AND 100 AND importados_federal BETWEEN 0 AND 100 AND estadual BETWEEN 0 AND 100 AND municipal BETWEEN 0 AND 100)
);
