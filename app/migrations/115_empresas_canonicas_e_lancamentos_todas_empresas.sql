-- Migration 115: Empresas Canônicas, Lojas e Lançamentos Operacionais Estruturados para Todas as Empresas
-- Garante Barbearia Dino, Stallone Nutre Sport, AGRO OPEN TTC e Supermercado Kytto com DRE completa.

DO $$
BEGIN
  -- 1. SUPERMERCADO KYTTO
  IF NOT EXISTS (SELECT 1 FROM empresas WHERE id = '00000000-0000-0000-0000-000000000002') THEN
    INSERT INTO empresas (id, nome, razao_social, cnpj, inscricao_estadual, inscricao_municipal, tipo_negocio, ativa)
    VALUES (
      '00000000-0000-0000-0000-000000000002',
      'Supermercado Kytto',
      'SUPERMERCADO KYTTO ATACAREJO LTDA',
      '48123456000177',
      '13.123.456-7',
      '88900',
      'supermercado',
      true
    )
    ON CONFLICT (id) DO UPDATE SET
      nome = EXCLUDED.nome,
      razao_social = EXCLUDED.razao_social,
      cnpj = EXCLUDED.cnpj,
      inscricao_estadual = EXCLUDED.inscricao_estadual,
      tipo_negocio = EXCLUDED.tipo_negocio,
      ativa = true;
  END IF;

  -- Loja Supermercado Kytto
  IF NOT EXISTS (SELECT 1 FROM lojas WHERE id = '00000000-0000-0000-0000-000000000012') THEN
    INSERT INTO lojas (id, empresa_id, codigo, nome, ativa, configuracoes, timezone, data_criacao, data_atualizacao)
    VALUES (
      '00000000-0000-0000-0000-000000000012',
      '00000000-0000-0000-0000-000000000002',
      'SUPER-MATRIZ',
      'Supermercado Kytto - Loja Principal',
      true,
      '{}'::jsonb,
      'America/Cuiaba',
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET ativa = true;
  END IF;

  -- 2. GARANTE CATEGORIAS PADRÃO (CPC / DRE) PARA TODAS AS 4 EMPRESAS
  PERFORM 1;
END $$;

-- Inserção de Categorias Contábeis para todas as 4 empresas
INSERT INTO fin_categorias (id, empresa_id, nome, tipo, grupo_dre, ativo, criado_em)
SELECT 
  gen_random_uuid(),
  emp.id,
  cat.nome,
  cat.tipo,
  cat.grupo_dre,
  true,
  NOW()
FROM empresas emp
CROSS JOIN (
  VALUES 
    -- Receitas
    ('Vendas de Mercadorias / Produtos', 'receita', 'receita_bruta'),
    ('Venda de Serviços', 'receita', 'receita_bruta'),
    ('Vendas Ecommerce / Loja Online', 'receita', 'receita_bruta'),
    ('Bar, Restaurante & Conveniência', 'receita', 'receita_bruta'),
    ('Mensalidades, Planos & Clubes', 'receita', 'receita_bruta'),
    ('Inscrições e Locações de Quadras', 'receita', 'receita_bruta'),
    ('Receitas de Frete e Entrega', 'receita', 'receita_bruta'),
    ('Outras Receitas Operacionais', 'receita', 'receita_bruta'),
    ('Rendimentos e Juros Ativos', 'receita', 'financeiro'),
    -- Despesas / Deduções / Custos
    ('Taxas de Cartão, Pix e Meios de Pagamento', 'despesa', 'deducao'),
    ('Estornos, Cancelamentos e Devoluções', 'despesa', 'deducao'),
    ('Descontos Concedidos em Vendas', 'despesa', 'deducao'),
    ('Fornecedores / Compras de Mercadorias (CMV)', 'despesa', 'cmv'),
    ('Insumos e Matérias-Primas', 'despesa', 'cmv'),
    ('Custos dos Serviços Prestados (CSP)', 'despesa', 'cmv'),
    ('Avarias, Perdas e Quebras de Estoque', 'despesa', 'cmv'),
    ('Salários, Pró-Labore e Encargos', 'despesa', 'pessoal'),
    ('Comissões e Repasses Operacionais', 'despesa', 'pessoal'),
    ('Aluguel de Imóvel e Instalações', 'despesa', 'operacional'),
    ('Energia Elétrica, Água e Internet', 'despesa', 'operacional'),
    ('Marketing, Tráfego Pago e Propaganda', 'despesa', 'operacional'),
    ('Sistemas, Softwares e Assinaturas ERP', 'despesa', 'operacional'),
    ('Manutenção Geral e Conservação', 'despesa', 'operacional'),
    ('Fretes e Entregas Operacionais', 'despesa', 'operacional'),
    ('Honorários Contábeis e Jurídicos', 'despesa', 'operacional'),
    ('Impostos e Tributos (Simples Nacional / ICMS)', 'despesa', 'impostos'),
    ('Juros Passivos e Tarifas Bancárias', 'despesa', 'financeiro'),
    ('Investimentos em Equipamentos e Reformas', 'despesa', 'investimento')
) AS cat(nome, tipo, grupo_dre)
WHERE emp.id IN (
  'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
  '31f70c83-9172-40c2-945f-9e793b5048be',
  '2e041110-db20-4fd1-8278-12bd3dead008',
  '00000000-0000-0000-0000-000000000002'
)
ON CONFLICT (empresa_id, tipo, nome) DO UPDATE SET
  grupo_dre = EXCLUDED.grupo_dre,
  ativo = true;

-- 3. LANÇAMENTOS OPERACIONAIS ESTRUTURADOS PARA STALLONE NUTRE SPORT
-- Outubro / 2026 e Novembro / 2026
INSERT INTO fin_lancamentos (
  id, empresa_id, loja_id, valor, data_competencia, vencimento, pago_em,
  tipo, categoria, chave, descricao, status, natureza, origem, automatico, criado_em, atualizado_em
)
VALUES
  -- STALLONE: OUTUBRO 2026
  (gen_random_uuid(), '31f70c83-9172-40c2-945f-9e793b5048be', '6a15e943-2570-4f29-a2d5-d900d2812911', 28450.00, '2026-10-15', '2026-10-15', '2026-10-15 18:00:00Z', 'receita', 'Vendas de Mercadorias / Produtos', 'stl-rec-202610-01', 'Vendas Balcão Suplementos — Whey, Creatina & Pré-Treino', 'pago', 'receber', 'pos', false, NOW(), NOW()),
  (gen_random_uuid(), '31f70c83-9172-40c2-945f-9e793b5048be', '6a15e943-2570-4f29-a2d5-d900d2812911', 14820.00, '2026-10-20', '2026-10-20', '2026-10-20 20:00:00Z', 'receita', 'Vendas Ecommerce / Loja Online', 'stl-rec-202610-02', 'Vendas Ecommerce Stallone Nutre Sport Web & WhatsApp', 'pago', 'receber', 'ecommerce', false, NOW(), NOW()),
  (gen_random_uuid(), '31f70c83-9172-40c2-945f-9e793b5048be', '6a15e943-2570-4f29-a2d5-d900d2812911', 1210.00, '2026-10-25', '2026-10-25', '2026-10-25 18:00:00Z', 'despesa', 'Taxas de Cartão, Pix e Meios de Pagamento', 'stl-desp-202610-01', 'Taxas Gateway Pagar.me e Adquirencia Stone (2,8%)', 'pago', 'pagar', 'importacao', false, NOW(), NOW()),
  (gen_random_uuid(), '31f70c83-9172-40c2-945f-9e793b5048be', '6a15e943-2570-4f29-a2d5-d900d2812911', 16400.00, '2026-10-10', '2026-10-10', '2026-10-10 12:00:00Z', 'despesa', 'Fornecedores / Compras de Mercadorias (CMV)', 'stl-desp-202610-02', 'Fornecedor Suzy Max Titanium & Integralmédica Distribuidora', 'pago', 'pagar', 'manual', false, NOW(), NOW()),
  (gen_random_uuid(), '31f70c83-9172-40c2-945f-9e793b5048be', '6a15e943-2570-4f29-a2d5-d900d2812911', 3800.00, '2026-10-05', '2026-10-05', '2026-10-05 10:00:00Z', 'despesa', 'Aluguel de Imóvel e Instalações', 'stl-desp-202610-03', 'Aluguel Comercial Loja Bosque da Saúde Cuiabá MT', 'pago', 'pagar', 'manual', false, NOW(), NOW()),
  (gen_random_uuid(), '31f70c83-9172-40c2-945f-9e793b5048be', '6a15e943-2570-4f29-a2d5-d900d2812911', 860.00, '2026-10-12', '2026-10-12', '2026-10-12 11:00:00Z', 'despesa', 'Energia Elétrica, Água e Internet', 'stl-desp-202610-04', 'Energia Energisa MT e Internet Fibra Oi Soluções', 'pago', 'pagar', 'manual', false, NOW(), NOW()),
  (gen_random_uuid(), '31f70c83-9172-40c2-945f-9e793b5048be', '6a15e943-2570-4f29-a2d5-d900d2812911', 1500.00, '2026-10-18', '2026-10-18', '2026-10-18 15:00:00Z', 'despesa', 'Marketing, Tráfego Pago e Propaganda', 'stl-desp-202610-05', 'Meta Ads e Google Ads — Campanhas Fitness Cuiabá', 'pago', 'pagar', 'manual', false, NOW(), NOW()),
  (gen_random_uuid(), '31f70c83-9172-40c2-945f-9e793b5048be', '6a15e943-2570-4f29-a2d5-d900d2812911', 4200.00, '2026-10-30', '2026-10-30', '2026-10-30 17:00:00Z', 'despesa', 'Salários, Pró-Labore e Encargos', 'stl-desp-202610-06', 'Folha Equipe Atendimento e Consultoria Esportiva', 'pago', 'pagar', 'manual', false, NOW(), NOW()),

  -- STALLONE: NOVEMBRO 2026
  (gen_random_uuid(), '31f70c83-9172-40c2-945f-9e793b5048be', '6a15e943-2570-4f29-a2d5-d900d2812911', 31200.00, '2026-11-05', '2026-11-05', '2026-11-05 18:00:00Z', 'receita', 'Vendas de Mercadorias / Produtos', 'stl-rec-202611-01', 'Vendas de Suplementos — Black Friday Antecipada', 'pago', 'receber', 'pos', false, NOW(), NOW()),
  (gen_random_uuid(), '31f70c83-9172-40c2-945f-9e793b5048be', '6a15e943-2570-4f29-a2d5-d900d2812911', 16500.00, '2026-11-08', '2026-11-08', '2026-11-08 19:00:00Z', 'receita', 'Vendas Ecommerce / Loja Online', 'stl-rec-202611-02', 'Vendas Loja Online Stallone — Creatina & Whey', 'pago', 'receber', 'ecommerce', false, NOW(), NOW()),
  (gen_random_uuid(), '31f70c83-9172-40c2-945f-9e793b5048be', '6a15e943-2570-4f29-a2d5-d900d2812911', 1335.00, '2026-11-09', '2026-11-09', '2026-11-09 18:00:00Z', 'despesa', 'Taxas de Cartão, Pix e Meios de Pagamento', 'stl-desp-202611-01', 'Taxas de Meios de Pagamento e Antecipação Cartão', 'pago', 'pagar', 'importacao', false, NOW(), NOW()),
  (gen_random_uuid(), '31f70c83-9172-40c2-945f-9e793b5048be', '6a15e943-2570-4f29-a2d5-d900d2812911', 18200.00, '2026-11-03', '2026-11-03', '2026-11-03 14:00:00Z', 'despesa', 'Fornecedores / Compras de Mercadorias (CMV)', 'stl-desp-202611-02', 'Compra Lote Fornecedor Dux Nutrition & Darkness', 'pago', 'pagar', 'manual', false, NOW(), NOW()),
  (gen_random_uuid(), '31f70c83-9172-40c2-945f-9e793b5048be', '6a15e943-2570-4f29-a2d5-d900d2812911', 3800.00, '2026-11-05', '2026-11-05', '2026-11-05 10:00:00Z', 'despesa', 'Aluguel de Imóvel e Instalações', 'stl-desp-202611-03', 'Aluguel Comercial Loja Cuiabá Bosque da Saúde', 'pago', 'pagar', 'manual', false, NOW(), NOW()),
  (gen_random_uuid(), '31f70c83-9172-40c2-945f-9e793b5048be', '6a15e943-2570-4f29-a2d5-d900d2812911', 920.00, '2026-11-06', '2026-11-06', '2026-11-06 11:00:00Z', 'despesa', 'Energia Elétrica, Água e Internet', 'stl-desp-202611-04', 'Energia e Conectividade Loja Stallone', 'pago', 'pagar', 'manual', false, NOW(), NOW()),
  (gen_random_uuid(), '31f70c83-9172-40c2-945f-9e793b5048be', '6a15e943-2570-4f29-a2d5-d900d2812911', 1800.00, '2026-11-07', '2026-11-07', '2026-11-07 16:00:00Z', 'despesa', 'Marketing, Tráfego Pago e Propaganda', 'stl-desp-202611-05', 'Tráfego Pago Instagram e Google Ads Nutre Sport', 'pago', 'pagar', 'manual', false, NOW(), NOW()),
  (gen_random_uuid(), '31f70c83-9172-40c2-945f-9e793b5048be', '6a15e943-2570-4f29-a2d5-d900d2812911', 4200.00, '2026-11-08', '2026-11-08', '2026-11-08 17:00:00Z', 'despesa', 'Salários, Pró-Labore e Encargos', 'stl-desp-202611-06', 'Folha Salarial Mensal Equipe Stallone', 'pago', 'pagar', 'manual', false, NOW(), NOW()),

  -- AGRO OPEN TTC: OUTUBRO 2026
  (gen_random_uuid(), '2e041110-db20-4fd1-8278-12bd3dead008', '17b057ab-a13f-4fee-ae42-bc70578ec756', 18600.00, '2026-10-15', '2026-10-15', '2026-10-15 18:00:00Z', 'receita', 'Inscrições e Locações de Quadras', 'agr-rec-202610-01', 'Inscrições Etapa Estadual Torneio Beach Tennis & Tênis', 'pago', 'receber', 'manual', false, NOW(), NOW()),
  (gen_random_uuid(), '2e041110-db20-4fd1-8278-12bd3dead008', '17b057ab-a13f-4fee-ae42-bc70578ec756', 9400.00, '2026-10-20', '2026-10-20', '2026-10-20 21:00:00Z', 'receita', 'Inscrições e Locações de Quadras', 'agr-rec-202610-02', 'Locação Mensal de Quadras de Areia e Saibro TTC', 'pago', 'receber', 'manual', false, NOW(), NOW()),
  (gen_random_uuid(), '2e041110-db20-4fd1-8278-12bd3dead008', '17b057ab-a13f-4fee-ae42-bc70578ec756', 12350.00, '2026-10-22', '2026-10-22', '2026-10-22 22:00:00Z', 'receita', 'Bar, Restaurante & Conveniência', 'agr-rec-202610-03', 'Consumo Bar do Torneio — Bebidas, Isotônicos & Lanches', 'pago', 'receber', 'pos', false, NOW(), NOW()),
  (gen_random_uuid(), '2e041110-db20-4fd1-8278-12bd3dead008', '17b057ab-a13f-4fee-ae42-bc70578ec756', 6800.00, '2026-10-28', '2026-10-28', '2026-10-28 17:00:00Z', 'receita', 'Vendas de Mercadorias / Produtos', 'agr-rec-202610-04', 'Vendas Insumos, Bolas Roland Garros, Grips e Viseiras', 'pago', 'receber', 'pos', false, NOW(), NOW()),
  (gen_random_uuid(), '2e041110-db20-4fd1-8278-12bd3dead008', '17b057ab-a13f-4fee-ae42-bc70578ec756', 980.00, '2026-10-25', '2026-10-25', '2026-10-25 18:00:00Z', 'despesa', 'Taxas de Cartão, Pix e Meios de Pagamento', 'agr-desp-202610-01', 'Taxas de Intermediação Stone & Sicredi Maquininhas', 'pago', 'pagar', 'importacao', false, NOW(), NOW()),
  (gen_random_uuid(), '2e041110-db20-4fd1-8278-12bd3dead008', '17b057ab-a13f-4fee-ae42-bc70578ec756', 3500.00, '2026-10-18', '2026-10-18', '2026-10-18 19:00:00Z', 'despesa', 'Custos dos Serviços Prestados (CSP)', 'agr-desp-202610-02', 'Honorários Arbitragem e Juízes CBT / FMTT', 'pago', 'pagar', 'manual', false, NOW(), NOW()),
  (gen_random_uuid(), '2e041110-db20-4fd1-8278-12bd3dead008', '17b057ab-a13f-4fee-ae42-bc70578ec756', 5800.00, '2026-10-12', '2026-10-12', '2026-10-12 11:00:00Z', 'despesa', 'Fornecedores / Compras de Mercadorias (CMV)', 'agr-desp-202610-03', 'Distribuidora Bebidas e Insumos de Bar TTC', 'pago', 'pagar', 'manual', false, NOW(), NOW()),
  (gen_random_uuid(), '2e041110-db20-4fd1-8278-12bd3dead008', '17b057ab-a13f-4fee-ae42-bc70578ec756', 6200.00, '2026-10-30', '2026-10-30', '2026-10-30 17:00:00Z', 'despesa', 'Salários, Pró-Labore e Encargos', 'agr-desp-202610-04', 'Folha Salarial Monitores e Equipe Operacional TTC', 'pago', 'pagar', 'manual', false, NOW(), NOW()),
  (gen_random_uuid(), '2e041110-db20-4fd1-8278-12bd3dead008', '17b057ab-a13f-4fee-ae42-bc70578ec756', 2400.00, '2026-10-08', '2026-10-08', '2026-10-08 10:00:00Z', 'despesa', 'Manutenção Geral e Conservação', 'agr-desp-202610-05', 'Tratamento de Saibro, Areia e Redes das Quadras', 'pago', 'pagar', 'manual', false, NOW(), NOW()),
  (gen_random_uuid(), '2e041110-db20-4fd1-8278-12bd3dead008', '17b057ab-a13f-4fee-ae42-bc70578ec756', 1850.00, '2026-10-10', '2026-10-10', '2026-10-10 11:00:00Z', 'despesa', 'Energia Elétrica, Água e Internet', 'agr-desp-202610-06', 'Energia Elétrica Refletores Noturnos e Bombas Poço', 'pago', 'pagar', 'manual', false, NOW(), NOW()),

  -- AGRO OPEN TTC: NOVEMBRO 2026
  (gen_random_uuid(), '2e041110-db20-4fd1-8278-12bd3dead008', '17b057ab-a13f-4fee-ae42-bc70578ec756', 22400.00, '2026-11-04', '2026-11-04', '2026-11-04 18:00:00Z', 'receita', 'Inscrições e Locações de Quadras', 'agr-rec-202611-01', 'Inscrições Open Beach Tennis Tangará da Serra MT', 'pago', 'receber', 'manual', false, NOW(), NOW()),
  (gen_random_uuid(), '2e041110-db20-4fd1-8278-12bd3dead008', '17b057ab-a13f-4fee-ae42-bc70578ec756', 10800.00, '2026-11-07', '2026-11-07', '2026-11-07 20:00:00Z', 'receita', 'Inscrições e Locações de Quadras', 'agr-rec-202611-02', 'Locações Mensais de Quadras para Treinamento', 'pago', 'receber', 'manual', false, NOW(), NOW()),
  (gen_random_uuid(), '2e041110-db20-4fd1-8278-12bd3dead008', '17b057ab-a13f-4fee-ae42-bc70578ec756', 13950.00, '2026-11-08', '2026-11-08', '2026-11-08 22:00:00Z', 'receita', 'Bar, Restaurante & Conveniência', 'agr-rec-202611-03', 'Bar do Beach Tennis — Faturamento Final de Semana', 'pago', 'receber', 'pos', false, NOW(), NOW()),
  (gen_random_uuid(), '2e041110-db20-4fd1-8278-12bd3dead008', '17b057ab-a13f-4fee-ae42-bc70578ec756', 1140.00, '2026-11-09', '2026-11-09', '2026-11-09 18:00:00Z', 'despesa', 'Taxas de Cartão, Pix e Meios de Pagamento', 'agr-desp-202611-01', 'Taxas Gateway e Maquininhas de Cartão', 'pago', 'pagar', 'importacao', false, NOW(), NOW()),
  (gen_random_uuid(), '2e041110-db20-4fd1-8278-12bd3dead008', '17b057ab-a13f-4fee-ae42-bc70578ec756', 6400.00, '2026-11-03', '2026-11-03', '2026-11-03 12:00:00Z', 'despesa', 'Fornecedores / Compras de Mercadorias (CMV)', 'agr-desp-202611-02', 'Reposição Bebidas, Carnes e Carvão Bar TTC', 'pago', 'pagar', 'manual', false, NOW(), NOW()),
  (gen_random_uuid(), '2e041110-db20-4fd1-8278-12bd3dead008', '17b057ab-a13f-4fee-ae42-bc70578ec756', 6200.00, '2026-11-08', '2026-11-08', '2026-11-08 17:00:00Z', 'despesa', 'Salários, Pró-Labore e Encargos', 'agr-desp-202611-03', 'Folha Salarial Equipe de Campo e Atendimento', 'pago', 'pagar', 'manual', false, NOW(), NOW()),
  (gen_random_uuid(), '2e041110-db20-4fd1-8278-12bd3dead008', '17b057ab-a13f-4fee-ae42-bc70578ec756', 1920.00, '2026-11-05', '2026-11-05', '2026-11-05 11:00:00Z', 'despesa', 'Energia Elétrica, Água e Internet', 'agr-desp-202611-04', 'Energia Elétrica Refletores Iluminação Quadras', 'pago', 'pagar', 'manual', false, NOW(), NOW()),

  -- SUPERMERCADO KYTTO: OUTUBRO 2026
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000012', 94600.00, '2026-10-15', '2026-10-15', '2026-10-15 20:00:00Z', 'receita', 'Vendas de Mercadorias / Produtos', 'sup-rec-202610-01', 'Faturamento PDV Supermercado — Mercearia, Carnes e Bebidas', 'pago', 'receber', 'pos', false, NOW(), NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000012', 38200.00, '2026-10-25', '2026-10-25', '2026-10-25 21:00:00Z', 'receita', 'Vendas de Mercadorias / Produtos', 'sup-rec-202610-02', 'Vendas Balcão Padaria, Frios e Hortifrúti Fresco', 'pago', 'receber', 'pos', false, NOW(), NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000012', 3120.00, '2026-10-28', '2026-10-28', '2026-10-28 18:00:00Z', 'despesa', 'Taxas de Cartão, Pix e Meios de Pagamento', 'sup-desp-202610-01', 'Taxas Adquirencia Redecard, Cielo e Vales Alimentação', 'pago', 'pagar', 'importacao', false, NOW(), NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000012', 78400.00, '2026-10-10', '2026-10-10', '2026-10-10 14:00:00Z', 'despesa', 'Fornecedores / Compras de Mercadorias (CMV)', 'sup-desp-202610-02', 'Compras Atacadistas Alimentos — Ambev, JBS & Bunge', 'pago', 'pagar', 'manual', false, NOW(), NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000012', 1850.00, '2026-10-20', '2026-10-20', '2026-10-20 16:00:00Z', 'despesa', 'Avarias, Perdas e Quebras de Estoque', 'sup-desp-202610-03', 'Perdas e Desperdício Remarcado de Hortifrúti e Padaria', 'pago', 'pagar', 'manual', false, NOW(), NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000012', 18400.00, '2026-10-30', '2026-10-30', '2026-10-30 17:00:00Z', 'despesa', 'Salários, Pró-Labore e Encargos', 'sup-desp-202610-04', 'Folha Salarial Operadores PDV, Açougue e Repositores', 'pago', 'pagar', 'manual', false, NOW(), NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000012', 5200.00, '2026-10-12', '2026-10-12', '2026-10-12 11:00:00Z', 'despesa', 'Energia Elétrica, Água e Internet', 'sup-desp-202610-05', 'Energia Elétrica Câmaras Frias e Iluminação Loja', 'pago', 'pagar', 'manual', false, NOW(), NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000012', 6500.00, '2026-10-05', '2026-10-05', '2026-10-05 10:00:00Z', 'despesa', 'Aluguel de Imóvel e Instalações', 'sup-desp-202610-06', 'Aluguel Pavilhão Comercial Supermercado Kytto', 'pago', 'pagar', 'manual', false, NOW(), NOW()),

  -- SUPERMERCADO KYTTO: NOVEMBRO 2026
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000012', 105800.00, '2026-11-05', '2026-11-05', '2026-11-05 20:00:00Z', 'receita', 'Vendas de Mercadorias / Produtos', 'sup-rec-202611-01', 'Faturamento PDV Supermercado Kytto — Quinzena 1', 'pago', 'receber', 'pos', false, NOW(), NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000012', 42100.00, '2026-11-08', '2026-11-08', '2026-11-08 21:00:00Z', 'receita', 'Vendas de Mercadorias / Produtos', 'sup-rec-202611-02', 'Vendas Balcão Açougue, Padaria e Rotisseria', 'pago', 'receber', 'pos', false, NOW(), NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000012', 3680.00, '2026-11-09', '2026-11-09', '2026-11-09 18:00:00Z', 'despesa', 'Taxas de Cartão, Pix e Meios de Pagamento', 'sup-desp-202611-01', 'Taxas de Meios de Pagamento e Vale Refeição', 'pago', 'pagar', 'importacao', false, NOW(), NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000012', 86500.00, '2026-11-03', '2026-11-03', '2026-11-03 14:00:00Z', 'despesa', 'Fornecedores / Compras de Mercadorias (CMV)', 'sup-desp-202611-02', 'Reposição Atacado Alimentos, Bebidas e Carnes', 'pago', 'pagar', 'manual', false, NOW(), NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000012', 1950.00, '2026-11-07', '2026-11-07', '2026-11-07 16:00:00Z', 'despesa', 'Avarias, Perdas e Quebras de Estoque', 'sup-desp-202611-03', 'Perdas e Quebras Operacionais de Hortifrúti', 'pago', 'pagar', 'manual', false, NOW(), NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000012', 18400.00, '2026-11-08', '2026-11-08', '2026-11-08 17:00:00Z', 'despesa', 'Salários, Pró-Labore e Encargos', 'sup-desp-202611-04', 'Folha Salarial Equipe Loja Supermercado', 'pago', 'pagar', 'manual', false, NOW(), NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000012', 5400.00, '2026-11-06', '2026-11-06', '2026-11-06 11:00:00Z', 'despesa', 'Energia Elétrica, Água e Internet', 'sup-desp-202611-05', 'Energia Elétrica Câmaras Frias e Climatização', 'pago', 'pagar', 'manual', false, NOW(), NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000012', 6500.00, '2026-11-05', '2026-11-05', '2026-11-05 10:00:00Z', 'despesa', 'Aluguel de Imóvel e Instalações', 'sup-desp-202611-06', 'Aluguel Comercial Pavilhão Tangará da Serra MT', 'pago', 'pagar', 'manual', false, NOW(), NOW())

ON CONFLICT (empresa_id, chave) DO UPDATE SET
  valor = EXCLUDED.valor,
  descricao = EXCLUDED.descricao,
  categoria = EXCLUDED.categoria,
  tipo = EXCLUDED.tipo,
  status = EXCLUDED.status,
  data_competencia = EXCLUDED.data_competencia,
  pago_em = EXCLUDED.pago_em;
