-- ============================================================================
-- Migration 121: Saneamento de Tabelas de Varejo e Remoção de Sementes Fictícias
-- Garante que var_vendas / var_venda_itens possuam todas as colunas necessárias
-- e expurga registros de demonstração que eram auto-inseridos nas funções listar*.
-- ============================================================================

CREATE TABLE IF NOT EXISTS var_vendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  loja_id UUID,
  numero VARCHAR(60) NOT NULL,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  desconto NUMERIC(14,2) NOT NULL DEFAULT 0,
  troco NUMERIC(14,2) NOT NULL DEFAULT 0,
  forma_pagamento VARCHAR(40),
  nfce_chave VARCHAR(60),
  nfce_protocolo VARCHAR(40),
  status VARCHAR(30) DEFAULT 'paga',
  criado_por VARCHAR(180),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelada_em TIMESTAMPTZ,
  cancelada_por VARCHAR(180)
);

CREATE TABLE IF NOT EXISTS var_venda_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  venda_id UUID NOT NULL REFERENCES var_vendas(id) ON DELETE CASCADE,
  item_id UUID,
  quantidade NUMERIC(14,3) NOT NULL DEFAULT 1,
  preco_unitario NUMERIC(14,2) NOT NULL DEFAULT 0,
  preco_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  desconto NUMERIC(14,2) NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE var_vendas ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'paga';
ALTER TABLE var_vendas ADD COLUMN IF NOT EXISTS cancelada_em TIMESTAMPTZ;
ALTER TABLE var_vendas ADD COLUMN IF NOT EXISTS cancelada_por VARCHAR(180);
ALTER TABLE var_venda_itens ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Expurgar registros de demonstração auto-inseridos anteriormente
DELETE FROM var_tesouraria_malotes WHERE numero_malote IN ('MAL-78401', 'MAL-78402', 'MAL-78403');
DELETE FROM var_vales_compra WHERE codigo_vale = 'VALE-892101';
DELETE FROM var_etiquetas_eletronicas_esl WHERE codigo_esl IN ('ESL-G01-01', 'ESL-G01-02', 'ESL-G02-01', 'ESL-G03-01', 'ESL-G04-01');
DELETE FROM var_rotisseria_pedidos WHERE numero_comanda IN ('ROT-101', 'ROT-102', 'ROT-103', 'ROT-104', 'ROT-201', 'ROT-202', 'ROT-203');
DELETE FROM var_picking_itens WHERE pedido_id IN (SELECT id FROM var_picking_pedidos WHERE numero_pedido IN ('PED-ECOMM-9102', 'PED-RETIRE-8841', 'PED-IFOOD-7730'));
DELETE FROM var_picking_pedidos WHERE numero_pedido IN ('PED-ECOMM-9102', 'PED-RETIRE-8841', 'PED-IFOOD-7730');
DELETE FROM var_remarcacao_validade_desperdicio WHERE lote_codigo IN ('LT-8812', 'LT-9021', 'LT-7740', 'LT-9110');
DELETE FROM var_conciliacao_cartoes WHERE valor_bruto_pdv IN (14500.00, 9200.00, 6800.00, 12400.00, 18950.00) AND data_venda IN ('2026-11-08', '2026-11-09');
DELETE FROM var_acordos_fornecedores_verbas WHERE fornecedor_cnpj IN ('07.526.557/0001-00', '45.997.418/0001-53', '60.409.075/0001-52', '02.916.265/0001-00');
DELETE FROM var_ocorrencias_prevencao_perdas WHERE numero_boletim IN ('BOP-2026-1042', 'BOP-2026-1043', 'BOP-2026-1044', 'BOP-2026-1045');
DELETE FROM var_acougue_rastreabilidade_sif WHERE lote_acougue IN ('BOV-SIF-2026-881', 'BOV-SIF-2026-882', 'SUI-SIF-2026-504', 'LOT-SIF-2026-1102');
DELETE FROM var_planogramas_gondola WHERE codigo_modulo IN ('MOD-GON-01', 'MOD-GON-02');
DELETE FROM var_pedidos_compra WHERE numero_pedido IN ('PC-849102', 'PC-849105', 'PC-849110', 'PC-849118', 'PC-849122');
DELETE FROM var_campanhas_selinhos WHERE nome_campanha IN ('Coleção Facas Chef Master Inox', 'Coleção Facas Chef Kytto Gourmet 2026');
DELETE FROM var_auditoria_fraude_pdv WHERE operador_id = 'OP-418' AND valor_evento = 214.50;
DELETE FROM var_tabloides_encartes WHERE titulo = 'Festival de Carnes & Hortifrúti de Primavera';
DELETE FROM var_alertas_ruptura WHERE horas_sem_venda = 4.0;
