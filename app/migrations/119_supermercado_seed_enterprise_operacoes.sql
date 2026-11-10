-- ============================================================================
-- Migration 119: Kytto Cloud ERP - Supermercado & Atacarejo Enterprise Seeding
-- Alinhado à Proposta Executiva @Rodrigo Gonçalves (Ondas 1, 2, 3 e 4)
-- ============================================================================

DO $$
DECLARE
  v_empresa_id UUID := '00000000-0000-0000-0000-000000000002'::uuid; -- Supermercado Kytto Matriz
  v_arroz_id UUID;
  v_oleo_id UUID;
  v_cerveja_id UUID;
  v_leite_id UUID;
  v_picanha_id UUID;
  v_alcatra_id UUID;
  v_frango_id UUID;
  v_banana_id UUID;
  v_maca_id UUID;
  v_tomate_id UUID;
  v_pao_id UUID;
  v_queijo_id UUID;
BEGIN
  -- 1. Inserir ou atualizar Itens Oficiais da Cesta Supermercadista Kytto em est_itens

  -- Açougue
  INSERT INTO est_itens (id, empresa_id, sku, ean, nome, unidade, preco_venda, custo_medio, estoque_minimo, departamento, plu, pesavel, controla_lote, ncm, ativo)
  VALUES (gen_random_uuid(), v_empresa_id, 'CAR-001', '2001001000002', 'Picanha Bovina Resfriada Fatiada a Vácuo', 'KG', 79.90, 52.00, 10.0, 'Açougue e Carnes', '1001', true, true, '02013000', true)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_picanha_id FROM est_itens WHERE empresa_id = v_empresa_id AND sku = 'CAR-001' LIMIT 1;

  INSERT INTO est_itens (id, empresa_id, sku, ean, nome, unidade, preco_venda, custo_medio, estoque_minimo, departamento, plu, pesavel, controla_lote, ncm, ativo)
  VALUES (gen_random_uuid(), v_empresa_id, 'CAR-002', '2001002000009', 'Alcatra Bovina com Maminha Resfriada', 'KG', 49.90, 34.00, 15.0, 'Açougue e Carnes', '1002', true, true, '02013000', true)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_alcatra_id FROM est_itens WHERE empresa_id = v_empresa_id AND sku = 'CAR-002' LIMIT 1;

  INSERT INTO est_itens (id, empresa_id, sku, ean, nome, unidade, preco_venda, custo_medio, estoque_minimo, departamento, plu, pesavel, controla_lote, ncm, ativo)
  VALUES (gen_random_uuid(), v_empresa_id, 'CAR-003', '7891234000010', 'Frango Inteiro Congelado 2kg', 'UN', 23.80, 15.50, 20.0, 'Açougue e Carnes', '1003', false, false, '02071200', true)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_frango_id FROM est_itens WHERE empresa_id = v_empresa_id AND sku = 'CAR-003' LIMIT 1;

  -- Hortifrúti (FLV)
  INSERT INTO est_itens (id, empresa_id, sku, ean, nome, unidade, preco_venda, custo_medio, estoque_minimo, departamento, plu, pesavel, controla_lote, ncm, ativo)
  VALUES (gen_random_uuid(), v_empresa_id, 'FLV-001', '2002001000001', 'Banana Prata Nacional Selecionada', 'KG', 6.99, 3.80, 15.0, 'Hortifrúti e Verduras', '2001', true, false, '08039000', true)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_banana_id FROM est_itens WHERE empresa_id = v_empresa_id AND sku = 'FLV-001' LIMIT 1;

  INSERT INTO est_itens (id, empresa_id, sku, ean, nome, unidade, preco_venda, custo_medio, estoque_minimo, departamento, plu, pesavel, controla_lote, ncm, ativo)
  VALUES (gen_random_uuid(), v_empresa_id, 'FLV-002', '2002002000008', 'Maçã Gala Nacional Cat-1', 'KG', 8.99, 4.90, 12.0, 'Hortifrúti e Verduras', '2002', true, false, '08081000', true)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_maca_id FROM est_itens WHERE empresa_id = v_empresa_id AND sku = 'FLV-002' LIMIT 1;

  INSERT INTO est_itens (id, empresa_id, sku, ean, nome, unidade, preco_venda, custo_medio, estoque_minimo, departamento, plu, pesavel, controla_lote, ncm, ativo)
  VALUES (gen_random_uuid(), v_empresa_id, 'FLV-003', '2002003000005', 'Tomate Italiano Especial', 'KG', 7.49, 4.10, 10.0, 'Hortifrúti e Verduras', '2003', true, false, '07020000', true)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_tomate_id FROM est_itens WHERE empresa_id = v_empresa_id AND sku = 'FLV-003' LIMIT 1;

  -- Padaria
  INSERT INTO est_itens (id, empresa_id, sku, ean, nome, unidade, preco_venda, custo_medio, estoque_minimo, departamento, plu, pesavel, controla_lote, ncm, ativo)
  VALUES (gen_random_uuid(), v_empresa_id, 'PAD-001', '2003001000000', 'Pão Francês Tradicional Quentinho', 'KG', 16.90, 7.50, 8.0, 'Padaria e Confeitaria', '3001', true, false, '19059090', true)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_pao_id FROM est_itens WHERE empresa_id = v_empresa_id AND sku = 'PAD-001' LIMIT 1;

  -- Frios e Laticínios
  INSERT INTO est_itens (id, empresa_id, sku, ean, nome, unidade, preco_venda, custo_medio, estoque_minimo, departamento, plu, pesavel, controla_lote, ncm, ativo)
  VALUES (gen_random_uuid(), v_empresa_id, 'FRI-001', '2004001000009', 'Queijo Mussarela Fatiado Interfolhado', 'KG', 42.90, 28.50, 10.0, 'Frios e Laticínios', '4001', true, false, '04061010', true)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_queijo_id FROM est_itens WHERE empresa_id = v_empresa_id AND sku = 'FRI-001' LIMIT 1;

  INSERT INTO est_itens (id, empresa_id, sku, ean, nome, unidade, preco_venda, custo_medio, estoque_minimo, departamento, plu, pesavel, controla_lote, ncm, ativo)
  VALUES (gen_random_uuid(), v_empresa_id, 'FRI-003', '7891000100010', 'Leite Longa Vida UHT Integral 1L', 'UN', 4.99, 3.45, 30.0, 'Frios e Laticínios', '4003', false, false, '04012010', true)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_leite_id FROM est_itens WHERE empresa_id = v_empresa_id AND sku = 'FRI-003' LIMIT 1;

  -- Mercearia (com Atacarejo)
  INSERT INTO est_itens (id, empresa_id, sku, ean, nome, unidade, preco_venda, custo_medio, estoque_minimo, departamento, plu, pesavel, controla_lote, ncm, ativo)
  VALUES (gen_random_uuid(), v_empresa_id, 'MER-001', '7891000200017', 'Arroz Branco Nobre Tipo 1 5kg', 'PCT', 26.90, 19.80, 20.0, 'Mercearia e Grãos', '5001', false, false, '10063021', true)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_arroz_id FROM est_itens WHERE empresa_id = v_empresa_id AND sku = 'MER-001' LIMIT 1;

  INSERT INTO est_itens (id, empresa_id, sku, ean, nome, unidade, preco_venda, custo_medio, estoque_minimo, departamento, plu, pesavel, controla_lote, ncm, ativo)
  VALUES (gen_random_uuid(), v_empresa_id, 'MER-005', '7891000200055', 'Óleo de Soja Refinado 900ml', 'UN', 6.89, 4.90, 24.0, 'Mercearia e Grãos', '5005', false, false, '15079011', true)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_oleo_id FROM est_itens WHERE empresa_id = v_empresa_id AND sku = 'MER-005' LIMIT 1;

  -- Bebidas (com Atacarejo)
  INSERT INTO est_itens (id, empresa_id, sku, ean, nome, unidade, preco_venda, custo_medio, estoque_minimo, departamento, plu, pesavel, controla_lote, ncm, ativo)
  VALUES (gen_random_uuid(), v_empresa_id, 'BEB-001', '7891000300014', 'Cerveja Pilsen Lata 350ml Puro Malte', 'UN', 3.49, 2.20, 48.0, 'Bebidas e Cervejas', '6001', false, false, '22030000', true)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_cerveja_id FROM est_itens WHERE empresa_id = v_empresa_id AND sku = 'BEB-001' LIMIT 1;

  -- 2. Inserir faixas de Atacarejo (Cash & Carry) em var_atacarejo_faixas
  IF v_arroz_id IS NOT NULL THEN
    INSERT INTO var_atacarejo_faixas (empresa_id, item_id, quantidade_minima, preco_unitario, desconto_percentual, ativo)
    VALUES (v_empresa_id, v_arroz_id, 6, 23.50, 12.64, true)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_oleo_id IS NOT NULL THEN
    INSERT INTO var_atacarejo_faixas (empresa_id, item_id, quantidade_minima, preco_unitario, desconto_percentual, ativo)
    VALUES (v_empresa_id, v_oleo_id, 12, 5.99, 13.06, true)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_cerveja_id IS NOT NULL THEN
    INSERT INTO var_atacarejo_faixas (empresa_id, item_id, quantidade_minima, preco_unitario, desconto_percentual, ativo)
    VALUES (v_empresa_id, v_cerveja_id, 12, 2.99, 14.33, true)
    ON CONFLICT DO NOTHING;
    INSERT INTO var_atacarejo_faixas (empresa_id, item_id, quantidade_minima, preco_unitario, desconto_percentual, ativo)
    VALUES (v_empresa_id, v_cerveja_id, 24, 2.79, 20.06, true)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_leite_id IS NOT NULL THEN
    INSERT INTO var_atacarejo_faixas (empresa_id, item_id, quantidade_minima, preco_unitario, desconto_percentual, ativo)
    VALUES (v_empresa_id, v_leite_id, 12, 4.39, 12.02, true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- 3. Inserir Lote Rastreável SIF no Açougue
  INSERT INTO var_acougue_rastreabilidade_sif (
    empresa_id, lote_acougue, frigorifico_nome, sif_numero, tipo_corte_carcaca,
    data_abate, data_recebimento, data_validade, peso_recebido_kg, fazenda_origem,
    gta_numero, qr_code_rastreabilidade, status
  ) VALUES (
    v_empresa_id, 'LOT-SIF-2026-1102', 'Frigorífico Tangará S/A', '1254/MT', 'Traseiro Bovino com Alcatra e Picanha',
    CURRENT_DATE - INTERVAL '3 days', CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE + INTERVAL '25 days',
    248.50, 'Fazenda Vale do Sol (Tangará da Serra/MT)', '948210-A',
    'https://setpoint.kytto.com.br/rastreabilidade/LOT-SIF-2026-1102', 'DESOSSA_CONCLUIDA'
  ) ON CONFLICT DO NOTHING;

  -- 4. Inserir Pedidos na Rotisseria KDS
  INSERT INTO var_rotisseria_pedidos (
    empresa_id, numero_comanda, tipo, descricao_item, peso_kg, valor_total, status, tempo_estimado_min, operador
  ) VALUES
  (v_empresa_id, 'ROT-201', 'ROTISSERIA_QUENTE', 'Frango Inteiro Assado com Batatas Coradas', 1.80, 48.00, 'PRONTO_ENTREGA', 0, 'Chef Geraldo'),
  (v_empresa_id, 'ROT-202', 'ROTISSERIA_QUENTE', 'Costela Bovina Recheada no Bafo', 1.20, 68.90, 'EM_PREPARO', 18, 'Chef Geraldo'),
  (v_empresa_id, 'ROT-203', 'ROTISSERIA_PRONTOS', 'Lasanha Bolonhesa Especial 1kg', 1.00, 36.90, 'RECEBIDO', 35, 'Cozinha Central')
  ON CONFLICT DO NOTHING;

  -- 5. Inserir Campanha de Fidelidade e Selinhos
  INSERT INTO var_campanhas_selinhos (
    empresa_id, nome_campanha, valor_por_selo, selos_necessarios, premio_destaque, data_inicio, data_fim, ativo
  ) VALUES (
    v_empresa_id, 'Coleção Facas Chef Kytto Gourmet 2026', 30.00, 30, 'Conjunto 3 Facas Inox Profissionais com Cepo de Madeira',
    CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE + INTERVAL '50 days', true
  ) ON CONFLICT DO NOTHING;

  -- 6. Inserir Endereçamento WMS (Gôndola x Pulmão)
  IF v_arroz_id IS NOT NULL THEN
    INSERT INTO var_enderecamento_wms (
      empresa_id, item_id, codigo_endereco, rua, predio, andar, tipo_localizacao, capacidade_maxima, ponto_reposicao, saldo_atual, ativo
    ) VALUES
    (v_empresa_id, v_arroz_id, 'RUA-A-01-N1', 'A', '01', '1', 'GONDOLA_PICKING', 120, 30, 45, true),
    (v_empresa_id, v_arroz_id, 'RUA-A-01-N3', 'A', '01', '3', 'PULMAO_AEREO', 240, 50, 180, true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- 7. Inserir Tabloide Ativo
  INSERT INTO var_tabloides_encartes (
    empresa_id, titulo, tema, data_inicio, data_fim, status, total_itens
  ) VALUES (
    v_empresa_id, 'Festival de Carnes & Hortifrúti de Primavera', 'Açougue e Feirão FLV',
    CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE + INTERVAL '6 days', 'ATIVO', 18
  ) ON CONFLICT DO NOTHING;

  -- 8. Inserir Evento de Auditoria de PDV para Julgamento Fiscal
  INSERT INTO var_auditoria_fraude_pdv (
    empresa_id, tipo_evento, terminal_id, operador_id, operador_nome, valor_evento, motivo_informado, status, score_risco, requer_autorizacao_fiscal
  ) VALUES (
    v_empresa_id, 'CANCELAMENTO_CUPOM_TOTAL', 'PDV-02', 'OP-418', 'Carlos Silveira', 214.50,
    'Cliente desistiu no momento de passar o cartão de crédito (fila de checkout)',
    'PENDENTE', 75, true
  ) ON CONFLICT DO NOTHING;

END $$;
