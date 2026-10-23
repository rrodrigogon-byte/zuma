-- 098 — Ajustes do Financeiro apontados na auditoria de cobertura do plano.
--
-- 1. Configuração por empresa:
--    - unidade padrão das receitas que chegam sem unidade (bar, clube, contas do A2), para o
--      Financeiro e o fechamento por unidade não perderem receita;
--    - liberação da leitura do financeiro antigo (JSON): só depois do ensaio conferido;
-- 2. Rateio de um lançamento entre centros de custo (percentuais que somam 100).

CREATE TABLE IF NOT EXISTS fin_config (
  empresa_id UUID PRIMARY KEY REFERENCES empresas(id) ON DELETE CASCADE,
  loja_padrao UUID,
  json_liberado_em TIMESTAMPTZ,
  json_liberado_por VARCHAR(180),
  json_incluir_quarentena BOOLEAN NOT NULL DEFAULT false,
  -- primeira leitura das fontes com o Financeiro novo ligado: venda fiada do bar de antes desse
  -- dia entra como receita já recebida (a baixa aconteceu fora do sistema), não como conta vencida
  razao_desde TIMESTAMPTZ,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fin_rateios (
  empresa_id UUID NOT NULL,
  lancamento_id UUID NOT NULL,
  centro_custo_id UUID NOT NULL,
  percentual NUMERIC(7,4) NOT NULL,
  PRIMARY KEY (empresa_id, lancamento_id, centro_custo_id),
  CONSTRAINT fk_fin_rateio_lanc FOREIGN KEY (empresa_id, lancamento_id) REFERENCES fin_lancamentos (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_fin_rateio_centro FOREIGN KEY (empresa_id, centro_custo_id) REFERENCES fin_centros_custo (empresa_id, id),
  CONSTRAINT chk_fin_rateio_pct CHECK (percentual > 0 AND percentual <= 100)
);
CREATE INDEX IF NOT EXISTS idx_fin_rateio_centro ON fin_rateios (empresa_id, centro_custo_id);

-- Empresa com uma unidade só: as receitas automáticas que entraram sem unidade passam a ser
-- dela (fora de dia já fechado, para não mexer em totais conferidos).
UPDATE fin_lancamentos l
   SET loja_id = u.loja_id, atualizado_em = CURRENT_TIMESTAMP
  FROM (SELECT empresa_id, (array_agg(id))[1] AS loja_id
          FROM lojas lj WHERE COALESCE((to_jsonb(lj)->>'ativa')::boolean, true) GROUP BY empresa_id HAVING count(*) = 1) u
 WHERE l.empresa_id = u.empresa_id AND l.loja_id IS NULL AND l.automatico
   AND l.origem IN ('bar_comanda', 'clube_pagamento', 'a2_conta', 'loja_online')
   AND NOT EXISTS (SELECT 1 FROM fin_fechamentos f WHERE f.empresa_id = l.empresa_id AND f.data = l.data_competencia);

-- 3. Rotina periódica do backoffice (leitura das fontes e baixa de estoque): uma vez por vez,
--    mesmo com mais de uma instância (quem pega a vez segura até `travada_ate`).
CREATE TABLE IF NOT EXISTS sys_rotinas (
  nome VARCHAR(60) PRIMARY KEY,
  travada_ate TIMESTAMPTZ NOT NULL DEFAULT '-infinity',
  ultima_execucao TIMESTAMPTZ,
  ultimo_resultado JSONB
);
