-- 097 — O razão acha a unidade da venda do PDV offline pela comanda (unidade do terminal).
CREATE INDEX IF NOT EXISTS idx_pdv_eventos_comanda ON pdv_eventos (empresa_id, comanda_id) WHERE comanda_id IS NOT NULL;
