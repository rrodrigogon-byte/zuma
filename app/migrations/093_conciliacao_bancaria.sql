-- 093 — Conciliação bancária sobre o razão (onda 4).
--
-- Contas bancárias da empresa, extratos importados (OFX), linhas do extrato e o vínculo de cada
-- linha com o lançamento do razão. A importação é idempotente pelo FITID do banco (a mesma linha
-- importada de novo não duplica); conciliar uma linha com uma conta a receber pendente dá a baixa
-- (Pix recebido = conta quitada, sem digitar nada).

CREATE TABLE IF NOT EXISTS fin_contas_bancarias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID,
  nome VARCHAR(120) NOT NULL,
  banco VARCHAR(10),
  agencia VARCHAR(20),
  conta VARCHAR(30),
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (empresa_id, id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_fin_conta_banco ON fin_contas_bancarias (empresa_id, COALESCE(banco, ''), COALESCE(agencia, ''), COALESCE(conta, '')) WHERE conta IS NOT NULL;

CREATE TABLE IF NOT EXISTS fin_extratos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  conta_id UUID NOT NULL,
  arquivo VARCHAR(200),
  sha256 CHAR(64) NOT NULL,
  inicio DATE,
  fim DATE,
  saldo_final NUMERIC(14,2),
  linhas INTEGER NOT NULL DEFAULT 0,
  novas INTEGER NOT NULL DEFAULT 0,
  importado_por VARCHAR(180),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (empresa_id, id),
  CONSTRAINT fk_fin_extrato_conta FOREIGN KEY (empresa_id, conta_id) REFERENCES fin_contas_bancarias (empresa_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS fin_extrato_linhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  conta_id UUID NOT NULL,
  extrato_id UUID,
  fitid VARCHAR(120) NOT NULL,
  data DATE NOT NULL,
  valor NUMERIC(14,2) NOT NULL,
  tipo VARCHAR(20),
  descricao VARCHAR(300) NOT NULL DEFAULT '',
  documento VARCHAR(60),
  status VARCHAR(20) NOT NULL DEFAULT 'pendente',
  lancamento_id UUID,
  regra VARCHAR(40),
  conciliado_por VARCHAR(180),
  conciliado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (empresa_id, id),
  CONSTRAINT uq_fin_linha_fitid UNIQUE (empresa_id, conta_id, fitid),
  CONSTRAINT fk_fin_linha_conta FOREIGN KEY (empresa_id, conta_id) REFERENCES fin_contas_bancarias (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT chk_fin_linha_status CHECK (status IN ('pendente', 'conciliado', 'ignorado')),
  CONSTRAINT chk_fin_linha_valor CHECK (valor <> 0),
  CONSTRAINT chk_fin_linha_vinculo CHECK ((status = 'conciliado') = (lancamento_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_fin_linha_pendente ON fin_extrato_linhas (empresa_id, status, data);
-- um lançamento do razão casa com uma linha só
CREATE UNIQUE INDEX IF NOT EXISTS uq_fin_linha_lancamento ON fin_extrato_linhas (empresa_id, lancamento_id) WHERE lancamento_id IS NOT NULL;

ALTER TABLE fin_lancamentos ADD COLUMN IF NOT EXISTS conta_bancaria_id UUID;
