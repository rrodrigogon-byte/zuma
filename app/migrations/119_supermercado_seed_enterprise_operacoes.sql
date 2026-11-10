-- ============================================================================
-- Migration 119: Kytto Cloud ERP - Supermercado & Atacarejo Enterprise Seeding
-- Alinhado à Proposta Executiva @Rodrigo Gonçalves (Ondas 1, 2, 3 e 4)
-- ============================================================================

DO $$
DECLARE
  v_empresa_id UUID := '00000000-0000-0000-0000-000000000002'::uuid; -- Supermercado Kytto Matriz
  v_item_id UUID;
  v_arroz_id UUID;
  v_oleo_id UUID;
  v_cerveja_id UUID;
  v_leite_id UUID;
  v_picanha_id UUID;
  v_banana_id UUID;
  v_pao_id UUID;
BEGIN
  -- 1. Inserir ou atualizar os 25 Itens Oficiais da Cesta Supermercadista Kytto
  
  -- Açougue
  INSERT INTO est_itens (id, empresa_id, nome, sku, unidade, preco_venda, preco_custo, saldo_estoque, estoque_minimo, ativo)
  VALUES (gen_random_uuid(), v_empresa_id, 'Picanha Bovina Resfriada Fatiada a Vácuo', 'CAR-001', 'KG', 79.90, 52.00, 35.5, 10.0, true)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_picanha_id FROM est_itens WHERE empresa_id = v_empresa_id AND sku = 'CAR-001' LIMIT 1;
  IF v_picanha_id IS NOT NULL THEN
    INSERT INTO var_itens_config (empresa_id, item_id, pesavel, plu, departamento, categoria, tributacao_icms, ncm, cest)
    VALUES (v_empresa_id, v_picanha_id, true, '1001', 'Açougue e Carnes', 'Bovinos', '00', '02013000', '1708700')
    ON CONFLICT (empresa_id, item_id) DO UPDATE SET pesavel = true, plu = '1001', departamento = 'Açougue e Carnes';
  END IF;

  INSERT INTO est_itens (id, empresa_id, nome, sku, unidade, preco_venda, preco_custo, saldo_estoque, estoque_minimo, ativo)
  VALUES (gen_random_uuid(), v_empresa_id, 'Alcatra Bovina com Maminha Resfriada', 'CAR-002', 'KG', 49.90, 34.00, 48.0, 15.0, true)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_item_id FROM est_itens WHERE empresa_id = v_empresa_id AND sku = 'CAR-002' LIMIT 1;
  IF v_item_id IS NOT NULL THEN
    INSERT INTO var_itens_config (empresa_id, item_id, pesavel, plu, departamento, categoria, tributacao_icms, ncm, cest)
    VALUES (v_empresa_id, v_item_id, true, '1002', 'Açougue e Carnes', 'Bovinos', '00', '02013000', '1708700')
    ON CONFLICT (empresa_id, item_id) DO UPDATE SET pesavel = true, plu = '1002', departamento = 'Açougue e Carnes';
  END IF;

  INSERT INTO est_itens (id, empresa_id, nome, sku, unidade, preco_venda, preco_custo, saldo_estoque, estoque_minimo, ativo)
  VALUES (gen_random_uuid(), v_empresa_id, 'Frango Inteiro Congelado 2kg', 'CAR-003', 'UN', 23.80, 15.50, 60.0, 20.0, true)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_item_id FROM est_itens WHERE empresa_id = v_empresa_id AND sku = 'CAR-003' LIMIT 1;
  IF v_item_id IS NOT NULL THEN
    INSERT INTO var_itens_config (empresa_id, item_id, pesavel, plu, departamento, categoria, tributacao_icms, ncm, cest)
    VALUES (v_empresa_id, v_item_id, false, '1003', 'Açougue e Carnes', 'Aves', '00', '02071200', '1708800')
    ON CONFLICT (empresa_id, item_id) DO UPDATE SET pesavel = false, departamento = 'Açougue e Carnes';
  END IF;

  -- Hortifrúti (FLV)
  INSERT INTO est_itens (id, empresa_id, nome, sku, unidade, preco_venda, preco_custo, saldo_estoque, estoque_minimo, ativo)
  VALUES (gen_random_uuid(), v_empresa_id, 'Banana Prata Nacional Selecionada', 'FLV-001', 'KG', 6.99, 3.80, 55.0, 15.0, true)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_banana_id FROM est_itens WHERE empresa_id = v_empresa_id AND sku = 'FLV-001' LIMIT 1;
  IF v_banana_id IS NOT NULL THEN
    INSERT INTO var_itens_config (empresa_id, item_id, pesavel, plu, departamento, categoria, tributacao_icms, ncm)
    VALUES (v_empresa_id, v_banana_id, true, '2001', 'Hortifrúti e Verduras', 'Frutas', '40', '08039000')
    ON CONFLICT (empresa_id, item_id) DO UPDATE SET pesavel = true, plu = '2001', departamento = 'Hortifrúti e Verduras';
  END IF;

  INSERT INTO est_itens (id, empresa_id, nome, sku, unidade, preco_venda, preco_custo, saldo_estoque, estoque_minimo, ativo)
  VALUES (gen_random_uuid(), v_empresa_id, 'Maçã Gala Nacional Cat-1', 'FLV-002', 'KG', 8.99, 4.90, 42.0, 12.0, true)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_item_id FROM est_itens WHERE empresa_id = v_empresa_id AND sku = 'FLV-002' LIMIT 1;
  IF v_item_id IS NOT NULL THEN
    INSERT INTO var_itens_config (empresa_id, item_id, pesavel, plu, departamento, categoria, tributacao_icms, ncm)
    VALUES (v_empresa_id, v_item_id, true, '2002', 'Hortifrúti e Verduras', 'Frutas', '40', '08081000')
    ON CONFLICT (empresa_id, item_id) DO UPDATE SET pesavel = true, plu = '2002', departamento = 'Hortifrúti e Verduras';
  END IF;

  INSERT INTO est_itens (id, empresa_id, nome, sku, unidade, preco_venda, preco_custo, saldo_estoque, estoque_minimo, ativo)
  VALUES (gen_random_uuid(), v_empresa_id, 'Tomate Italiano Especial', 'FLV-003', 'KG', 7.49, 4.10, 38.0, 10.0, true)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_item_id FROM est_itens WHERE empresa_id = v_empresa_id AND sku = 'FLV-003' LIMIT 1;
  IF v_item_id IS NOT NULL THEN
    INSERT INTO var_itens_config (empresa_id, item_id, pesavel, plu, departamento, categoria, tributacao_icms, ncm)
    VALUES (v_empresa_id, v_item_id, true, '2003', 'Hortifrúti e Verduras', 'Legumes', '40', '07020000')
    ON CONFLICT (empresa_id, item_id) DO UPDATE SET pesavel = true, plu = '2003', departamento = 'Hortifrúti e Verduras';
  END IF;

  -- Padaria
  INSERT INTO est_itens (id, empresa_id, nome, sku, unidade, preco_venda, preco_custo, saldo_estoque, estoque_minimo, ativo)
  VALUES (gen_random_uuid(), v_empresa_id, 'Pão Francês Tradicional Quentinho', 'PAD-001', 'KG', 16.90, 7.50, 25.0, 8.0, true)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_pao_id FROM est_itens WHERE empresa_id = v_empresa_id AND sku = 'PAD-001' LIMIT 1;
  IF v_pao_id IS NOT NULL THEN
    INSERT INTO var_itens_config (empresa_id, item_id, pesavel, plu, departamento, categoria, tributacao_icms, ncm)
    VALUES (v_empresa_id, v_pao_id, true, '3001', 'Padaria e Confeitaria', 'Pães', '00', '19059090')
    ON CONFLICT (empresa_id, item_id) DO UPDATE SET pesavel = true, plu = '3001', departamento = 'Padaria e Confeitaria';
  END IF;

  -- Frios e Laticínios
  INSERT INTO est_itens (id, empresa_id, nome, sku, unidade, preco_venda, preco_custo, saldo_estoque, estoque_minimo, ativo)
  VALUES (gen_random_uuid(), v_empresa_id, 'Queijo Mussarela Fatiado Interfolhado', 'FRI-001', 'KG', 42.90, 28.50, 30.0, 10.0, true)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_item_id FROM est_itens WHERE empresa_id = v_empresa_id AND sku = 'FRI-001' LIMIT 1;
  IF v_item_id IS NOT NULL THEN
    INSERT INTO var_itens_config (empresa_id, item_id, pesavel, plu, departamento, categoria, tributacao_icms, ncm)
    VALUES (v_empresa_id, v_item_id, true, '4001', 'Frios e Laticínios', 'Queijos', '00', '04061010')
    ON CONFLICT (empresa_id, item_id) DO UPDATE SET pesavel = true, plu = '4001', departamento = 'Frios e Laticínios';
  END IF;

  INSERT INTO est_itens (id, empresa_id, nome, sku, unidade, preco_venda, preco_custo, saldo_estoque, estoque_minimo, ativo)
  VALUES (gen_random_uuid(), v_empresa_id, 'Leite Longa Vida UHT Integral 1L', 'FRI-003', 'UN', 4.99, 3.45, 150.0, 30.0, true)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_leite_id FROM est_itens WHERE empresa_id = v_empresa_id AND sku = 'FRI-003' LIMIT 1;
  IF v_leite_id IS NOT NULL THEN
    INSERT INTO var_itens_config (empresa_id, item_id, pesavel, plu, departamento, categoria, tributacao_icms, ncm)
    VALUES (v_empresa_id, v_leite_id, false, '4003', 'Frios e Laticínios', 'Leites', '00', '04012010')
    ON CONFLICT (empresa_id, item_id) DO UPDATE SET pesavel = false, departamento = 'Frios e Laticínios';
  END IF;

  -- Mercearia (com Atacarejo)
  INSERT INTO est_itens (id, empresa_id, nome, sku, unidade, preco_venda, preco_custo, saldo_estoque, estoque_minimo, ativo)
  VALUES (gen_random_uuid(), v_empresa_id, 'Arroz Branco Nobre Tipo 1 5kg', 'MER-001', 'PCT', 26.90, 19.80, 95.0, 20.0, true)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_arroz_id FROM est_itens WHERE empresa_id = v_empresa_id AND sku = 'MER-001' LIMIT 1;
  IF v_arroz_id IS NOT NULL THEN
    INSERT INTO var_itens_config (empresa_id, item_id, pesavel, plu, departamento, categoria, tributacao_icms, ncm)
    VALUES (v_empresa_id, v_arroz_id, false, '5001', 'Mercearia e Grãos', 'Arroz e Grãos', '00', '10063021')
    ON CONFLICT (empresa_id, item_id) DO UPDATE SET pesavel = false, departamento = 'Mercearia e Grãos';
  END IF;

  INSERT INTO est_itens (id, empresa_id, nome, sku, unidade, preco_venda, preco_custo, saldo_estoque, estoque_minimo, ativo)
  VALUES (gen_random_uuid(), v_empresa_id, 'Óleo de Soja Refinado 900ml', 'MER-005', 'UN', 6.89, 4.90, 120.0, 24.0, true)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_oleo_id FROM est_itens WHERE empresa_id = v_empresa_id AND sku = 'MER-005' LIMIT 1;
  IF v_oleo_id IS NOT NULL THEN
    INSERT INTO var_itens_config (empresa_id, item_id, pesavel, plu, departamento, categoria, tributacao_icms, ncm)
    VALUES (v_empresa_id, v_oleo_id, false, '5005', 'Mercearia e Grãos', 'Óleos', '00', '15079011')
    ON CONFLICT (empresa_id, item_id) DO UPDATE SET pesavel = false, departamento = 'Mercearia e Grãos';
  END IF;

  -- Bebidas (com Atacarejo)
  INSERT INTO est_itens (id, empresa_id, nome, sku, unidade, preco_venda, preco_custo, saldo_estoque, estoque_minimo, ativo)
  VALUES (gen_random_uuid(), v_empresa_id, 'Cerveja Pilsen Lata 350ml Puro Malte', 'BEB-001', 'UN', 3.49, 2.20, 240.0, 48.0, true)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_cerveja_id FROM est_itens WHERE empresa_id = v_empresa_id AND sku = 'BEB-001' LIMIT 1;
  IF v_cerveja_id IS NOT NULL THEN
    INSERT INTO var_itens_config (empresa_id, item_id, pesavel, plu, departamento, categoria, tributacao_icms, ncm)
    VALUES (v_empresa_id, v_cerveja_id, false, '6001', 'Bebidas e Cervejas', 'Cervejas', '10', '22030000')
    ON CONFLICT (empresa_id, item_id) DO UPDATE SET pesavel = false, departamento = 'Bebidas e Cervejas';
  END IF;

  -- 2. Inserir faixas de Atacarejo (Cash & Carry)
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
  INSERT INTO var_fidelidade_campanhas (
    empresa_id, nome, valor_para_selo, total_selos_cartela, premio_descricao, data_inicio, data_fim, ativa
  ) VALUES (
    v_empresa_id, 'Coleção Facas Chef Kytto Gourmet 2026', 30.00, 30, 'Conjunto 3 Facas Inox Profissionais com Cepo de Madeira',
    CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE + INTERVAL '50 days', true
  ) ON CONFLICT DO NOTHING;

  -- 6. Inserir Endereçamento WMS (Gôndola x Pulmão)
  INSERT INTO var_wms_enderecos (empresa_id, codigo_endereco, rua, modulo, nivel, tipo_posicao, capacidade_paletes, status)
  VALUES
  (v_empresa_id, 'RUA-A-01-N1', 'A', '01', 1, 'GONDOLA_PICKING', 1, 'OCUPADO'),
  (v_empresa_id, 'RUA-A-01-N3', 'A', '01', 3, 'PULMAO_AEREO', 2, 'OCUPADO'),
  (v_empresa_id, 'RUA-B-02-N1', 'B', '02', 1, 'GONDOLA_PICKING', 1, 'OCUPADO'),
  (v_empresa_id, 'RUA-B-02-N4', 'B', '02', 4, 'PULMAO_AEREO', 3, 'LIVRE')
  ON CONFLICT DO NOTHING;

  -- 7. Inserir Tabloide Ativo
  INSERT INTO var_tabloides_encartes (
    empresa_id, titulo, tema, data_inicio, data_fim, status, total_ofertas
  ) VALUES (
    v_empresa_id, 'Festival de Carnes & Hortifrúti de Primavera', 'Açougue e Feirão FLV',
    CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE + INTERVAL '6 days', 'ATIVO', 18
  ) ON CONFLICT DO NOTHING;

  -- 8. Inserir Evento de Auditoria de PDV para Julgamento Fiscal
  INSERT INTO var_auditoria_fraude_pdv (
    empresa_id, tipo_evento, pdv_numero, operador_matricula, valor_operacao, motivo, status, supervisor_parecer
  ) VALUES (
    v_empresa_id, 'CANCELAMENTO_CUPOM_TOTAL', 'PDV-02', 'OP-418', 214.50,
    'Cliente desistiu no momento de passar o cartão de crédito (fila de checkout)',
    'PENDENTE', 'Aguardando conferência de itens devolvidos ao estoque'
  ) ON CONFLICT DO NOTHING;

END $$;
