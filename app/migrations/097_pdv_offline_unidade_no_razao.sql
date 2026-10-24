-- 097 — O razão acha a unidade da venda do PDV offline pela comanda (unidade do terminal).
CREATE INDEX IF NOT EXISTS idx_pdv_eventos_comanda ON pdv_eventos (empresa_id, comanda_id) WHERE comanda_id IS NOT NULL;

-- Vendas offline já lidas pelo razão antes desta versão ficaram sem unidade: passam a levar a do
-- terminal, exceto em dia que já tem fechamento (da empresa ou de qualquer unidade), para não
-- mexer em totais já conferidos; esses ficam como estão e podem ser ajustados à mão.
UPDATE fin_lancamentos l
   SET loja_id = t.loja_id
  FROM pdv_eventos e
  JOIN pdv_terminais t ON t.empresa_id = e.empresa_id AND t.id = e.terminal_id
 WHERE l.origem = 'bar_comanda' AND l.loja_id IS NULL
   AND e.empresa_id = l.empresa_id AND e.comanda_id IS NOT NULL AND l.origem_id = e.comanda_id::text
   AND NOT EXISTS (SELECT 1 FROM fin_fechamentos f WHERE f.empresa_id = l.empresa_id AND f.data = l.data_competencia);
