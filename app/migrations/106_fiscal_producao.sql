-- 106 — Fiscal: ambiente de PRODUÇÃO por emitente.
-- Troca o CHECK "ambiente = 'homologacao'" por "homologacao ou producao" no emitente, nos
-- documentos e nas inutilizações; separa a numeração e as faixas por ambiente (cada ambiente da
-- SEFAZ tem a sua sequência) e guarda o % de redução da base do ICMS (CST 20) na classificação.
-- Emitir em produção ainda exige a empresa em FISCAL_PRODUCAO_EMPRESAS no servidor.
-- Aditiva e reexecutável. Os dados existentes são todos de homologação e continuam iguais.

-- tabelas em uso: se o lock não sair em 3 s, a migração falha e o deploy para.
SET LOCAL lock_timeout = '3s';

ALTER TABLE fis_emitentes DROP CONSTRAINT IF EXISTS chk_fis_emit_ambiente;
ALTER TABLE fis_emitentes ADD CONSTRAINT chk_fis_emit_ambiente CHECK (ambiente IN ('homologacao', 'producao'));

ALTER TABLE fis_documentos DROP CONSTRAINT IF EXISTS chk_fis_doc_ambiente;
ALTER TABLE fis_documentos ADD CONSTRAINT chk_fis_doc_ambiente CHECK (ambiente IN ('homologacao', 'producao'));

ALTER TABLE fis_inutilizacoes DROP CONSTRAINT IF EXISTS chk_fis_inut_ambiente;
ALTER TABLE fis_inutilizacoes ADD CONSTRAINT chk_fis_inut_ambiente CHECK (ambiente IN ('homologacao', 'producao'));

-- tipo de emissão: 1 normal, 9 contingência offline (só NFC-e), 6/7 SVC-AN/SVC-RS (só NF-e)
ALTER TABLE fis_documentos DROP CONSTRAINT IF EXISTS chk_fis_doc_tp_emis;
ALTER TABLE fis_documentos ADD CONSTRAINT chk_fis_doc_tp_emis CHECK (tp_emis IN ('1', '6', '7', '9') AND (tp_emis <> '9' OR modelo = '65') AND (tp_emis NOT IN ('6', '7') OR modelo = '55'));

-- numeração por ambiente
ALTER TABLE fis_numeracao ADD COLUMN IF NOT EXISTS ambiente VARCHAR(20) NOT NULL DEFAULT 'homologacao';
ALTER TABLE fis_numeracao DROP CONSTRAINT IF EXISTS chk_fis_num_ambiente;
ALTER TABLE fis_numeracao ADD CONSTRAINT chk_fis_num_ambiente CHECK (ambiente IN ('homologacao', 'producao'));
ALTER TABLE fis_numeracao DROP CONSTRAINT IF EXISTS fis_numeracao_pkey;
ALTER TABLE fis_numeracao ADD CONSTRAINT fis_numeracao_pkey PRIMARY KEY (empresa_id, emitente_id, ambiente, modelo, serie);
-- série padrão de cada emitente/modelo/ambiente (configurada na tela; sem padrão = série 1)
ALTER TABLE fis_numeracao ADD COLUMN IF NOT EXISTS padrao BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE fis_numeracao ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE fis_numeracao ADD COLUMN IF NOT EXISTS atualizado_por VARCHAR(180);
CREATE UNIQUE INDEX IF NOT EXISTS uq_fis_num_padrao ON fis_numeracao (empresa_id, emitente_id, ambiente, modelo) WHERE padrao;

-- o mesmo número pode existir uma vez em cada ambiente
ALTER TABLE fis_documentos DROP CONSTRAINT IF EXISTS uq_fis_doc_numero;
ALTER TABLE fis_documentos ADD CONSTRAINT uq_fis_doc_numero UNIQUE (empresa_id, emitente_id, ambiente, modelo, serie, numero);

-- a nota de homologação de uma venda não impede a nota de produção da mesma venda
DROP INDEX IF EXISTS uq_fis_doc_origem_viva;
CREATE UNIQUE INDEX IF NOT EXISTS uq_fis_doc_origem_viva ON fis_documentos (empresa_id, origem, origem_id, modelo, ambiente)
  WHERE origem_id IS NOT NULL AND status IN ('rascunho', 'enviando', 'falha_comunicacao', 'autorizado', 'validado_localmente', 'contingencia');

DROP INDEX IF EXISTS uq_fis_inut_faixa_viva;
CREATE UNIQUE INDEX IF NOT EXISTS uq_fis_inut_faixa_viva ON fis_inutilizacoes (empresa_id, emitente_id, ambiente, modelo, serie, numero_inicial, numero_final)
  WHERE status <> 'rejeitada';

-- CST 20: percentual de redução da base de cálculo do ICMS
ALTER TABLE fis_classificacoes ADD COLUMN IF NOT EXISTS p_red_bc NUMERIC(7,4);
ALTER TABLE fis_classificacoes DROP CONSTRAINT IF EXISTS chk_fis_cls_p_red_bc;
ALTER TABLE fis_classificacoes ADD CONSTRAINT chk_fis_cls_p_red_bc CHECK (p_red_bc IS NULL OR (p_red_bc > 0 AND p_red_bc < 100));
