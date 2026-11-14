-- ============================================================================
-- Migration 124: DF-e Inbound Stallone Nutre Sport & Central de Aceite Fiscal
-- Empresa: Stallone Nutre Sport (CNPJ 56.099.531/0001-38)
-- ============================================================================

-- 1. Sincronização de categorias e catálogo de produtos no ERP físico
INSERT INTO categorias (id, empresa_id, nome, ativa, data_criacao)
SELECT id, empresa_id, nome, true, criado_em
FROM commerce_categories
WHERE empresa_id = '31f70c83-9172-40c2-945f-9e793b5048be'
ON CONFLICT (id) DO NOTHING;

INSERT INTO produtos (id, empresa_id, categoria_id, nome, descricao, preco_custo, preco_venda, codigo_interno, ativo, data_criacao, data_atualizacao)
SELECT 
  cp.id, 
  cp.empresa_id, 
  cp.category_id, 
  cp.nome, 
  cp.descricao_curta,
  COALESCE((SELECT preco_padrao * 0.65 FROM commerce_product_variants WHERE product_id = cp.id LIMIT 1), 50.00) AS preco_custo,
  COALESCE((SELECT preco_padrao FROM commerce_product_variants WHERE product_id = cp.id LIMIT 1), 89.90) AS preco_venda,
  COALESCE(cp.slug, 'STAL-' || substring(cp.id::text, 1, 8)) AS codigo_interno,
  (cp.status = 'active') AS ativo,
  cp.criado_em,
  cp.atualizado_em
FROM commerce_products cp
WHERE cp.empresa_id = '31f70c83-9172-40c2-945f-9e793b5048be'
ON CONFLICT (id) DO NOTHING;

-- 2. Centro de custo e conta bancária padrão da Stallone
INSERT INTO fin_centros_custo (id, empresa_id, nome, codigo, ativo, criado_em, atualizado_em)
VALUES (
  'c1f70001-31f7-40c2-945f-9e793b5048be',
  '31f70c83-9172-40c2-945f-9e793b5048be',
  'Loja Física & E-commerce Suplementos',
  'CC-STAL-01',
  true,
  now(),
  now()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO fin_contas_bancarias (id, empresa_id, loja_id, nome, banco, agencia, conta, ativo, criado_em)
VALUES (
  'b1f70001-31f7-40c2-945f-9e793b5048be',
  '31f70c83-9172-40c2-945f-9e793b5048be',
  '6a15e943-2570-4f29-a2d5-d900d2812911',
  'Sicredi Tangará da Serra (Conta Movimento)',
  '748',
  '0810',
  '56099-1',
  true,
  now()
) ON CONFLICT (id) DO NOTHING;

-- 3. Fornecedores oficiais de suplementos cadastrados para Stallone
INSERT INTO fornecedores (id, empresa_id, nome, cnpj, email, telefone, endereco_cidade, endereco_estado, ativo, data_criacao)
VALUES 
  ('f0a10001-31f7-40c2-945f-9e793b5048be', '31f70c83-9172-40c2-945f-9e793b5048be', 'DUX NUTRITION LAB COMERCIO DE SUPLEMENTOS LTDA', '21657347000109', 'fiscal@duxnutrition.com', '1130901234', 'São Paulo', 'SP', true, now()),
  ('f0a10002-31f7-40c2-945f-9e793b5048be', '31f70c83-9172-40c2-945f-9e793b5048be', 'SUPLEY LABORATORIO (MAX TITANIUM / PROBIÓTICA)', '07591688000119', 'faturamento@supley.com.br', '1633839900', 'Matão', 'SP', true, now()),
  ('f0a10003-31f7-40c2-945f-9e793b5048be', '31f70c83-9172-40c2-945f-9e793b5048be', 'ALTHAIA S.A. INDUSTRIA FARMACEUTICA (EQUALIV)', '13347016000117', 'dfe@equaliv.com.br', '1140034455', 'São Paulo', 'SP', true, now()),
  ('f0a10004-31f7-40c2-945f-9e793b5048be', '31f70c83-9172-40c2-945f-9e793b5048be', 'CAFFEINE ARMY COMERCIO DE BEBIDAS E ALIMENTOS LTDA', '30564887000170', 'nfe@caffeinearmy.com.br', '7130258800', 'Salvador', 'BA', true, now()),
  ('f0a10005-31f7-40c2-945f-9e793b5048be', '31f70c83-9172-40c2-945f-9e793b5048be', 'INTEGRALMEDICA S/A AGRICULTURA E COMERCIO', '57235426000126', 'nfe.entrada@integralmedica.com.br', '1146687000', 'Embu-Guaçu', 'SP', true, now()),
  ('f0a10006-31f7-40c2-945f-9e793b5048be', '31f70c83-9172-40c2-945f-9e793b5048be', 'VITAFOR NUTRIENTES LTDA', '07458745000144', 'fiscal@vitafor.com.br', '1532819000', 'Araçoiaba da Serra', 'SP', true, now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO a2_fornecedores (id, empresa_id, nome, cnpj, status)
VALUES 
  ('f0a10001-31f7-40c2-945f-9e793b5048be', '31f70c83-9172-40c2-945f-9e793b5048be', 'DUX Nutrition Lab', '21.657.347/0001-09', 'ativo'),
  ('f0a10002-31f7-40c2-945f-9e793b5048be', '31f70c83-9172-40c2-945f-9e793b5048be', 'Max Titanium / Supley', '07.591.688/0001-19', 'ativo'),
  ('f0a10003-31f7-40c2-945f-9e793b5048be', '31f70c83-9172-40c2-945f-9e793b5048be', 'Equaliv / Althaia Farma', '13.347.016/0001-17', 'ativo'),
  ('f0a10004-31f7-40c2-945f-9e793b5048be', '31f70c83-9172-40c2-945f-9e793b5048be', 'Caffeine Army (SuperCoffee)', '30.564.887/0001-70', 'ativo'),
  ('f0a10005-31f7-40c2-945f-9e793b5048be', '31f70c83-9172-40c2-945f-9e793b5048be', 'Integralmédica Suplementos', '57.235.426/0001-26', 'ativo'),
  ('f0a10006-31f7-40c2-945f-9e793b5048be', '31f70c83-9172-40c2-945f-9e793b5048be', 'Vitafor Nutrientes', '07.458.745/0001-44', 'ativo')
ON CONFLICT (id) DO NOTHING;

-- 4. Documentos Fiscais DF-e Inbound emitidos contra Stallone Nutre Sport
INSERT INTO fis_documentos (
  id, empresa_id, emitente_id, loja_id, serie, numero, valor_total,
  modelo, tp_emis, ambiente, status, chave, origem, idempotencia,
  contingencia_atrasada, dados, mensagens, criado_em, atualizado_em
) VALUES (
  'e1f55001-31f7-40c2-945f-9e793b5048be',
  '31f70c83-9172-40c2-945f-9e793b5048be',
  '98f29dd0-9e65-4d89-a799-cd5f2a0a5484',
  '6a15e943-2570-4f29-a2d5-d900d2812911',
  1,
  48912,
  8218.0,
  '55',
  '1',
  'homologacao',
  'validado_localmente',
  '35261121657347000109550010000489121983471205',
  'dfe_inbound',
  'dfe:stallone:35261121657347000109550010000489121983471205',
  false,
  '{"chave": "35261121657347000109550010000489121983471205", "numero": 48912, "serie": 1, "emissao": "2026-11-05", "natureza_operacao": "VENDA DE MERCADORIA ADQ. DE TERCEIROS", "cfop_predominante": "2102", "emitente": {"razaoSocial": "DUX NUTRITION LAB COMERCIO DE SUPLEMENTOS LTDA", "fantasia": "DUX Nutrition Lab", "cnpj": "21.657.347/0001-09", "cnpjNumeros": "21657347000109", "ie": "140.825.914.110", "uf": "SP", "municipio": "São Paulo"}, "destinatario": {"razaoSocial": "E. P. DE SOUZA LTDA", "fantasia": "Stallone Nutre Sport", "cnpj": "56.099.531/0001-38", "ie": "ISENTO", "uf": "MT", "municipio": "Tangará da Serra"}, "itens": [{"codigo": "DUX-WHEY-CAP-900", "produtoId": "d46875f9-ad9a-47cb-b6db-f6dd254953b0", "descricao": "DUX Whey Concentrado Cappuccino 900g", "ncm": "21069030", "cfop": "2102", "quantidade": 24, "unidade": "UN", "valorUnitario": 98.5, "valorTotal": 2364.0, "lote": "LOTE-DUX-2611A", "validade": "2028-11-01"}, {"codigo": "DUX-CREA-300", "produtoId": "55428454-a9c7-438b-be0e-028ffd095f8a", "descricao": "DUX Creatina Monohidratada 300g", "ncm": "21069090", "cfop": "2102", "quantidade": 36, "unidade": "UN", "valorUnitario": 54.0, "valorTotal": 1944.0, "lote": "LOTE-DUX-2611B", "validade": "2028-11-01"}, {"codigo": "DUX-FRESH-CHOC-900", "produtoId": "e307c559-8434-4cdf-8cb3-fc882443f700", "descricao": "DUX Fresh Whey Sabor Chocolate e Avelã 900 G", "ncm": "21069030", "cfop": "2102", "quantidade": 18, "unidade": "UN", "valorUnitario": 115.0, "valorTotal": 2070.0, "lote": "LOTE-DUX-2611C", "validade": "2028-10-15"}, {"codigo": "DUX-GLUT-100", "produtoId": "5b16bba0-800e-42f7-b922-cd23170c4cfb", "descricao": "DUX Glutamina 100g", "ncm": "21069090", "cfop": "2102", "quantidade": 20, "unidade": "UN", "valorUnitario": 38.0, "valorTotal": 760.0, "lote": "LOTE-DUX-2611D", "validade": "2028-09-30"}, {"codigo": "DUX-EK-MEL-1K", "produtoId": "aa613506-809f-4565-a0fd-9eaa4d0212da", "descricao": "DUX Energy Kick Sabor Melancia 1k", "ncm": "21069090", "cfop": "2102", "quantidade": 15, "unidade": "UN", "valorUnitario": 72.0, "valorTotal": 1080.0, "lote": "LOTE-DUX-2611E", "validade": "2028-08-20"}], "cobranca": {"condicao": "30/60 dias", "parcelas": [{"numero": 1, "vencimento": "2026-12-05", "valor": 4109.0, "meio": "boleto"}, {"numero": 2, "vencimento": "2027-01-05", "valor": 4109.0, "meio": "boleto"}]}, "totais": {"vProd": 8218.0, "vFrete": 0.0, "vSeg": 0.0, "vDesc": 0.0, "vIPI": 0.0, "vICMS": 575.26, "vPIS": 135.6, "vCOFINS": 624.57, "vNF": 8218.0}, "status_manifestacao": "Aguardando Aceite", "status_entrada": "pendente", "protocolo": null, "tem_bonificacao": false, "valor_bonificacao": 0.0}'::jsonb,
  '[]'::jsonb,
  '2026-11-05 10:00:00'::timestamptz,
  now()
) ON CONFLICT (id) DO UPDATE SET
  dados = EXCLUDED.dados,
  status = EXCLUDED.status,
  atualizado_em = now();

INSERT INTO fis_documentos (
  id, empresa_id, emitente_id, loja_id, serie, numero, valor_total,
  modelo, tp_emis, ambiente, status, chave, origem, idempotencia,
  contingencia_atrasada, dados, mensagens, criado_em, atualizado_em
) VALUES (
  'e1f55002-31f7-40c2-945f-9e793b5048be',
  '31f70c83-9172-40c2-945f-9e793b5048be',
  '98f29dd0-9e65-4d89-a799-cd5f2a0a5484',
  '6a15e943-2570-4f29-a2d5-d900d2812911',
  2,
  105420,
  6147.0,
  '55',
  '1',
  'homologacao',
  'validado_localmente',
  '35261107591688000119550020001054201742918451',
  'dfe_inbound',
  'dfe:stallone:35261107591688000119550020001054201742918451',
  false,
  '{"chave": "35261107591688000119550020001054201742918451", "numero": 105420, "serie": 2, "emissao": "2026-11-08", "natureza_operacao": "VENDA DE MERCADORIA ADQ. DE TERCEIROS", "cfop_predominante": "2102", "emitente": {"razaoSocial": "SUPLEY LABORATORIO DE ALIMENTOS E SUPLEMENTOS NUTRICIONAIS LTDA", "fantasia": "Max Titanium / Probiótica (Grupo Supley)", "cnpj": "07.591.688/0001-19", "cnpjNumeros": "07591688000119", "ie": "441.072.189.112", "uf": "SP", "municipio": "Matão"}, "destinatario": {"razaoSocial": "E. P. DE SOUZA LTDA", "fantasia": "Stallone Nutre Sport", "cnpj": "56.099.531/0001-38", "ie": "ISENTO", "uf": "MT", "municipio": "Tangará da Serra"}, "itens": [{"codigo": "MAX-PRE-BLUE-150", "produtoId": "80467c50-5d0d-4370-8c28-31bc9064a05a", "descricao": "Max Titanium Pré Treino Sabor Blue Ice 150g", "ncm": "21069090", "cfop": "2102", "quantidade": 30, "unidade": "UN", "valorUnitario": 58.0, "valorTotal": 1740.0, "lote": "LOTE-MAX-420A", "validade": "2028-10-10"}, {"codigo": "EGIDE-DINO-ABAC-300", "produtoId": "54f3f4e8-443f-430c-be3e-06333a303f68", "descricao": "Égide Linha Dino Pote 300g Sabor Abacaxi com Hortelã", "ncm": "21069090", "cfop": "2102", "quantidade": 24, "unidade": "UN", "valorUnitario": 68.0, "valorTotal": 1632.0, "lote": "LOTE-MAX-420B", "validade": "2028-11-05"}, {"codigo": "HORUS-GEL-FRUTAS", "produtoId": "3d50ba45-d21c-4bb4-832a-af36d4ae9bb6", "descricao": "Hórus Gel Display 10 Sachês Frutas Vermelhas", "ncm": "21069090", "cfop": "2102", "quantidade": 20, "unidade": "CX", "valorUnitario": 45.0, "valorTotal": 900.0, "lote": "LOTE-MAX-420C", "validade": "2027-12-15"}, {"codigo": "CREA-CREAPURE-300", "produtoId": "023265e7-9838-406e-8584-090b455dab6c", "descricao": "Creatina Creapure 300g", "ncm": "21069090", "cfop": "2102", "quantidade": 25, "unidade": "UN", "valorUnitario": 75.0, "valorTotal": 1875.0, "lote": "LOTE-MAX-420D", "validade": "2028-09-01"}], "cobranca": {"condicao": "28/56 dias", "parcelas": [{"numero": 1, "vencimento": "2026-12-06", "valor": 3073.5, "meio": "boleto"}, {"numero": 2, "vencimento": "2027-01-03", "valor": 3073.5, "meio": "boleto"}]}, "totais": {"vProd": 6147.0, "vFrete": 0.0, "vSeg": 0.0, "vDesc": 0.0, "vIPI": 0.0, "vICMS": 430.29, "vPIS": 101.43, "vCOFINS": 467.17, "vNF": 6147.0}, "status_manifestacao": "Aguardando Aceite", "status_entrada": "pendente", "protocolo": null, "tem_bonificacao": false, "valor_bonificacao": 0.0}'::jsonb,
  '[]'::jsonb,
  '2026-11-08 10:00:00'::timestamptz,
  now()
) ON CONFLICT (id) DO UPDATE SET
  dados = EXCLUDED.dados,
  status = EXCLUDED.status,
  atualizado_em = now();

INSERT INTO fis_documentos (
  id, empresa_id, emitente_id, loja_id, serie, numero, valor_total,
  modelo, tp_emis, ambiente, status, chave, origem, idempotencia,
  contingencia_atrasada, dados, mensagens, criado_em, atualizado_em
) VALUES (
  'e1f55003-31f7-40c2-945f-9e793b5048be',
  '31f70c83-9172-40c2-945f-9e793b5048be',
  '98f29dd0-9e65-4d89-a799-cd5f2a0a5484',
  '6a15e943-2570-4f29-a2d5-d900d2812911',
  1,
  32810,
  7100.0,
  '55',
  '1',
  'homologacao',
  'autorizado',
  '35261113347016000117550010000328101452981763',
  'dfe_inbound',
  'dfe:stallone:35261113347016000117550010000328101452981763',
  false,
  '{"chave": "35261113347016000117550010000328101452981763", "numero": 32810, "serie": 1, "emissao": "2026-11-10", "natureza_operacao": "VENDA DE MERCADORIA ADQ. DE TERCEIROS", "cfop_predominante": "2102", "emitente": {"razaoSocial": "ALTHAIA S.A. INDUSTRIA FARMACEUTICA", "fantasia": "Equaliv Nutracêuticos / Althaia", "cnpj": "13.347.016/0001-17", "cnpjNumeros": "13347016000117", "ie": "148.910.223.118", "uf": "SP", "municipio": "São Paulo"}, "destinatario": {"razaoSocial": "E. P. DE SOUZA LTDA", "fantasia": "Stallone Nutre Sport", "cnpj": "56.099.531/0001-38", "ie": "ISENTO", "uf": "MT", "municipio": "Tangará da Serra"}, "itens": [{"codigo": "EQ-BODY-NEUTRO-450", "produtoId": "1492c857-8c78-426a-b750-630f74007020", "descricao": "Equaliv Body Protein Neutro 450g", "ncm": "21069030", "cfop": "2102", "quantidade": 20, "unidade": "UN", "valorUnitario": 88.0, "valorTotal": 1760.0, "lote": "LOTE-EQ-810A", "validade": "2028-10-01"}, {"codigo": "EQ-BODY-CACAU-600", "produtoId": "70af09f9-4749-41b2-bc7b-c813743dcbc3", "descricao": "Equaliv Body Protein Cacau 600g", "ncm": "21069030", "cfop": "2102", "quantidade": 20, "unidade": "UN", "valorUnitario": 108.0, "valorTotal": 2160.0, "lote": "LOTE-EQ-810B", "validade": "2028-10-01"}, {"codigo": "EQ-CREA-300", "produtoId": "023e1548-9cbb-4ccf-a2b1-45a35c1efae2", "descricao": "Equaliv Creatina 100% 300g", "ncm": "21069090", "cfop": "2102", "quantidade": 30, "unidade": "UN", "valorUnitario": 52.0, "valorTotal": 1560.0, "lote": "LOTE-EQ-810C", "validade": "2028-09-15"}, {"codigo": "EQ-COLAG-30S", "produtoId": "70accb9a-3a38-49f5-b864-a24a341e5980", "descricao": "Equaliv Colageno Hidrolisado Neutro 30 Saches", "ncm": "21069030", "cfop": "2102", "quantidade": 15, "unidade": "UN", "valorUnitario": 62.0, "valorTotal": 930.0, "lote": "LOTE-EQ-810D", "validade": "2028-08-20"}, {"codigo": "EQ-CARTLIV-60", "produtoId": "740c0e64-4abc-43e5-9115-10bad0ef052f", "descricao": "Equaliv Cartliv 60 caps", "ncm": "21069090", "cfop": "2102", "quantidade": 15, "unidade": "UN", "valorUnitario": 46.0, "valorTotal": 690.0, "lote": "LOTE-EQ-810E", "validade": "2028-07-30"}, {"codigo": "EQ-BONIF-SACHE-15G", "produtoId": "0522459b-d8ab-44ff-ac52-6371d20e57c7", "descricao": "Equaliv Body Protein Neutro Sache 15g (Bonificação Comercial Acordo Anual)", "ncm": "21069030", "cfop": "2910", "quantidade": 50, "unidade": "UN", "valorUnitario": 0.0, "valorTotal": 0.0, "valorComercialCredito": 250.0, "lote": "LOTE-EQ-BONIF-01", "validade": "2028-10-01"}], "cobranca": {"condicao": "30/60/90 dias", "parcelas": [{"numero": 1, "vencimento": "2026-12-10", "valor": 2366.67, "meio": "boleto"}, {"numero": 2, "vencimento": "2027-01-10", "valor": 2366.67, "meio": "boleto"}, {"numero": 3, "vencimento": "2027-02-10", "valor": 2366.66, "meio": "boleto"}]}, "totais": {"vProd": 7100.0, "vFrete": 0.0, "vSeg": 0.0, "vDesc": 0.0, "vIPI": 0.0, "vICMS": 497.0, "vPIS": 117.15, "vCOFINS": 539.6, "vNF": 7100.0}, "status_manifestacao": "Confirmação da Operação (210200)", "status_entrada": "confirmada_apta_para_estoque", "protocolo": "151260987654321", "tem_bonificacao": true, "valor_bonificacao": 250.0}'::jsonb,
  '[]'::jsonb,
  '2026-11-10 10:00:00'::timestamptz,
  now()
) ON CONFLICT (id) DO UPDATE SET
  dados = EXCLUDED.dados,
  status = EXCLUDED.status,
  atualizado_em = now();

INSERT INTO fis_documentos (
  id, empresa_id, emitente_id, loja_id, serie, numero, valor_total,
  modelo, tp_emis, ambiente, status, chave, origem, idempotencia,
  contingencia_atrasada, dados, mensagens, criado_em, atualizado_em
) VALUES (
  'e1f55004-31f7-40c2-945f-9e793b5048be',
  '31f70c83-9172-40c2-945f-9e793b5048be',
  '98f29dd0-9e65-4d89-a799-cd5f2a0a5484',
  '6a15e943-2570-4f29-a2d5-d900d2812911',
  1,
  19455,
  5100.0,
  '55',
  '1',
  'homologacao',
  'validado_localmente',
  '29261130564887000170550010000194551829374619',
  'dfe_inbound',
  'dfe:stallone:29261130564887000170550010000194551829374619',
  false,
  '{"chave": "29261130564887000170550010000194551829374619", "numero": 19455, "serie": 1, "emissao": "2026-11-12", "natureza_operacao": "VENDA DE MERCADORIA ADQ. DE TERCEIROS", "cfop_predominante": "2102", "emitente": {"razaoSocial": "CAFFEINE ARMY COMERCIO DE BEBIDAS E ALIMENTOS LTDA", "fantasia": "Caffeine Army (SuperCoffee)", "cnpj": "30.564.887/0001-70", "cnpjNumeros": "30564887000170", "ie": "152.889.340", "uf": "BA", "municipio": "Salvador"}, "destinatario": {"razaoSocial": "E. P. DE SOUZA LTDA", "fantasia": "Stallone Nutre Sport", "cnpj": "56.099.531/0001-38", "ie": "ISENTO", "uf": "MT", "municipio": "Tangará da Serra"}, "itens": [{"codigo": "SC-CHOC-220", "produtoId": "b1eeb213-5372-4cb3-a4eb-c406288935b4", "descricao": "Supercoffee 3.0 Choconilla 220g", "ncm": "21011200", "cfop": "2102", "quantidade": 24, "unidade": "UN", "valorUnitario": 84.0, "valorTotal": 2016.0, "lote": "LOTE-CA-455A", "validade": "2028-06-01"}, {"codigo": "SC-LGATO-380", "produtoId": "d047aba7-ef0d-45dd-b23b-7fc7353fcdf2", "descricao": "Supercoffee 3.0 Lingua de Gato 380g", "ncm": "21011200", "cfop": "2102", "quantidade": 18, "unidade": "UN", "valorUnitario": 118.0, "valorTotal": 2124.0, "lote": "LOTE-CA-455B", "validade": "2028-06-01"}, {"codigo": "SC-SACHE-ORIG", "produtoId": "7d3d2285-e709-4c32-bfa8-7a6a5fd340c3", "descricao": "Super Coffee Original Sachê", "ncm": "21011200", "cfop": "2102", "quantidade": 100, "unidade": "UN", "valorUnitario": 4.8, "valorTotal": 480.0, "lote": "LOTE-CA-455C", "validade": "2028-05-15"}, {"codigo": "SC-SACHE-VAN", "produtoId": "87f618fb-3152-4c66-a7df-98912561f584", "descricao": "Super Coffee Vanilla Sachê", "ncm": "21011200", "cfop": "2102", "quantidade": 100, "unidade": "UN", "valorUnitario": 4.8, "valorTotal": 480.0, "lote": "LOTE-CA-455D", "validade": "2028-05-15"}], "cobranca": {"condicao": "30 dias", "parcelas": [{"numero": 1, "vencimento": "2026-12-12", "valor": 5100.0, "meio": "boleto"}]}, "totais": {"vProd": 5100.0, "vFrete": 0.0, "vSeg": 0.0, "vDesc": 0.0, "vIPI": 0.0, "vICMS": 357.0, "vPIS": 84.15, "vCOFINS": 387.6, "vNF": 5100.0}, "status_manifestacao": "Aguardando Aceite", "status_entrada": "pendente", "protocolo": null, "tem_bonificacao": false, "valor_bonificacao": 0.0}'::jsonb,
  '[]'::jsonb,
  '2026-11-12 10:00:00'::timestamptz,
  now()
) ON CONFLICT (id) DO UPDATE SET
  dados = EXCLUDED.dados,
  status = EXCLUDED.status,
  atualizado_em = now();

INSERT INTO fis_documentos (
  id, empresa_id, emitente_id, loja_id, serie, numero, valor_total,
  modelo, tp_emis, ambiente, status, chave, origem, idempotencia,
  contingencia_atrasada, dados, mensagens, criado_em, atualizado_em
) VALUES (
  'e1f55005-31f7-40c2-945f-9e793b5048be',
  '31f70c83-9172-40c2-945f-9e793b5048be',
  '98f29dd0-9e65-4d89-a799-cd5f2a0a5484',
  '6a15e943-2570-4f29-a2d5-d900d2812911',
  1,
  76330,
  6992.0,
  '55',
  '1',
  'homologacao',
  'validado_localmente',
  '35261157235426000126550010000763301918273645',
  'dfe_inbound',
  'dfe:stallone:35261157235426000126550010000763301918273645',
  false,
  '{"chave": "35261157235426000126550010000763301918273645", "numero": 76330, "serie": 1, "emissao": "2026-11-13", "natureza_operacao": "VENDA DE MERCADORIA ADQ. DE TERCEIROS", "cfop_predominante": "2102", "emitente": {"razaoSocial": "INTEGRALMEDICA S/A AGRICULTURA E COMERCIO", "fantasia": "Integralmédica Suplementos / Darkness", "cnpj": "57.235.426/0001-26", "cnpjNumeros": "57235426000126", "ie": "298.056.789.110", "uf": "SP", "municipio": "Embu-Guaçu"}, "destinatario": {"razaoSocial": "E. P. DE SOUZA LTDA", "fantasia": "Stallone Nutre Sport", "cnpj": "56.099.531/0001-38", "ie": "ISENTO", "uf": "MT", "municipio": "Tangará da Serra"}, "itens": [{"codigo": "IM-WHEY-CHOC-907", "produtoId": "ef4aed62-3630-4d98-b3d9-3509964b4567", "descricao": "IM Whey 100% Pure Pouch Chocolate 907g", "ncm": "21069030", "cfop": "2102", "quantidade": 24, "unidade": "UN", "valorUnitario": 68.0, "valorTotal": 1632.0, "lote": "LOTE-IM-330A", "validade": "2028-11-01"}, {"codigo": "IM-NUTRI-MOR-907", "produtoId": "695b575d-6cc6-4212-90dc-9d702e51fdd1", "descricao": "IM Nutriwhey Morango Pouch 907g", "ncm": "21069030", "cfop": "2102", "quantidade": 20, "unidade": "UN", "valorUnitario": 52.0, "valorTotal": 1040.0, "lote": "LOTE-IM-330B", "validade": "2028-10-15"}, {"codigo": "IM-CREA-HARD-500", "produtoId": "e0ebac7c-5ed6-4523-b326-c3c6b4176c04", "descricao": "IM Creatina Hardcore 500g Pote", "ncm": "21069090", "cfop": "2102", "quantidade": 24, "unidade": "UN", "valorUnitario": 74.0, "valorTotal": 1776.0, "lote": "LOTE-IM-330C", "validade": "2028-11-10"}, {"codigo": "DK-EVORA-MVERDE-300", "produtoId": "f2c48dfd-bd27-45fc-a67a-eda31a050c75", "descricao": "Darkness Evorapw Maçã Verde 300g", "ncm": "21069090", "cfop": "2102", "quantidade": 16, "unidade": "UN", "valorUnitario": 79.0, "valorTotal": 1264.0, "lote": "LOTE-IM-330D", "validade": "2028-09-01"}, {"codigo": "CREA-DARK-300", "produtoId": "768ff307-7932-4718-b8d2-8c6308e6dba9", "descricao": "Creatina Darkness 300g", "ncm": "21069090", "cfop": "2102", "quantidade": 20, "unidade": "UN", "valorUnitario": 64.0, "valorTotal": 1280.0, "lote": "LOTE-IM-330E", "validade": "2028-09-20"}], "cobranca": {"condicao": "30/60 dias", "parcelas": [{"numero": 1, "vencimento": "2026-12-13", "valor": 3496.0, "meio": "boleto"}, {"numero": 2, "vencimento": "2027-01-13", "valor": 3496.0, "meio": "boleto"}]}, "totais": {"vProd": 6992.0, "vFrete": 0.0, "vSeg": 0.0, "vDesc": 0.0, "vIPI": 0.0, "vICMS": 489.44, "vPIS": 115.37, "vCOFINS": 531.39, "vNF": 6992.0}, "status_manifestacao": "Ciência da Emissão (210210)", "status_entrada": "ciencia_registrada", "protocolo": "151260123456789", "tem_bonificacao": false, "valor_bonificacao": 0.0}'::jsonb,
  '[]'::jsonb,
  '2026-11-13 10:00:00'::timestamptz,
  now()
) ON CONFLICT (id) DO UPDATE SET
  dados = EXCLUDED.dados,
  status = EXCLUDED.status,
  atualizado_em = now();

INSERT INTO fis_documentos (
  id, empresa_id, emitente_id, loja_id, serie, numero, valor_total,
  modelo, tp_emis, ambiente, status, chave, origem, idempotencia,
  contingencia_atrasada, dados, mensagens, criado_em, atualizado_em
) VALUES (
  'e1f55006-31f7-40c2-945f-9e793b5048be',
  '31f70c83-9172-40c2-945f-9e793b5048be',
  '98f29dd0-9e65-4d89-a799-cd5f2a0a5484',
  '6a15e943-2570-4f29-a2d5-d900d2812911',
  1,
  51109,
  5382.0,
  '55',
  '1',
  'homologacao',
  'validado_localmente',
  '35261107458745000144550010000511091637492810',
  'dfe_inbound',
  'dfe:stallone:35261107458745000144550010000511091637492810',
  false,
  '{"chave": "35261107458745000144550010000511091637492810", "numero": 51109, "serie": 1, "emissao": "2026-11-14", "natureza_operacao": "VENDA DE MERCADORIA ADQ. DE TERCEIROS", "cfop_predominante": "2102", "emitente": {"razaoSocial": "VITAFOR NUTRIENTES LTDA", "fantasia": "Vitafor Nutrientes & Suplementos", "cnpj": "07.458.745/0001-44", "cnpjNumeros": "07458745000144", "ie": "157.089.412.115", "uf": "SP", "municipio": "Araçoiaba da Serra"}, "destinatario": {"razaoSocial": "E. P. DE SOUZA LTDA", "fantasia": "Stallone Nutre Sport", "cnpj": "56.099.531/0001-38", "ie": "ISENTO", "uf": "MT", "municipio": "Tangará da Serra"}, "itens": [{"codigo": "VIT-GLUTA-300", "produtoId": "c40b7e9c-ab9b-421b-9371-21120974b873", "descricao": "Vitafor Glutamax 300g", "ncm": "21069090", "cfop": "2102", "quantidade": 20, "unidade": "UN", "valorUnitario": 59.0, "valorTotal": 1180.0, "lote": "LOTE-VIT-109A", "validade": "2028-10-30"}, {"codigo": "VIT-SIMFORT-30", "produtoId": "36fe6130-c7b1-4a17-aec9-465d393f3f97", "descricao": "Vitafor Simfort 30 Saches", "ncm": "21069090", "cfop": "2102", "quantidade": 18, "unidade": "UN", "valorUnitario": 64.0, "valorTotal": 1152.0, "lote": "LOTE-VIT-109B", "validade": "2028-09-10"}, {"codigo": "VIT-CREAFORT-30", "produtoId": "bb24837b-17b5-4b49-b022-25fcb9c69ec0", "descricao": "Vitafor Creafort 30 Saches", "ncm": "21069090", "cfop": "2102", "quantidade": 20, "unidade": "UN", "valorUnitario": 62.0, "valorTotal": 1240.0, "lote": "LOTE-VIT-109C", "validade": "2028-09-01"}, {"codigo": "VIT-OMEGA-FAM", "produtoId": "1763e332-6959-486b-a329-eab4fa2e179f", "descricao": "Vitafor Omegafor Family 60 caps - 500mg", "ncm": "15042000", "cfop": "2102", "quantidade": 25, "unidade": "UN", "valorUnitario": 42.0, "valorTotal": 1050.0, "lote": "LOTE-VIT-109D", "validade": "2028-08-15"}, {"codigo": "VIT-SIMCAPS-30", "produtoId": "3c17bccc-9b3f-4697-8580-3d669cb89742", "descricao": "Vitafor Simcaps 30 caps", "ncm": "21069090", "cfop": "2102", "quantidade": 20, "unidade": "UN", "valorUnitario": 38.0, "valorTotal": 760.0, "lote": "LOTE-VIT-109E", "validade": "2028-07-20"}], "cobranca": {"condicao": "30/60 dias", "parcelas": [{"numero": 1, "vencimento": "2026-12-14", "valor": 2691.0, "meio": "boleto"}, {"numero": 2, "vencimento": "2027-01-14", "valor": 2691.0, "meio": "boleto"}]}, "totais": {"vProd": 5382.0, "vFrete": 0.0, "vSeg": 0.0, "vDesc": 0.0, "vIPI": 0.0, "vICMS": 376.74, "vPIS": 88.8, "vCOFINS": 409.03, "vNF": 5382.0}, "status_manifestacao": "Aguardando Aceite", "status_entrada": "pendente", "protocolo": null, "tem_bonificacao": false, "valor_bonificacao": 0.0}'::jsonb,
  '[]'::jsonb,
  '2026-11-14 10:00:00'::timestamptz,
  now()
) ON CONFLICT (id) DO UPDATE SET
  dados = EXCLUDED.dados,
  status = EXCLUDED.status,
  atualizado_em = now();

-- 5. Demonstração de Aceite & Integração Real ERP da NF-e Equaliv 32810
-- Registro no Histórico de Compras
INSERT INTO compras (id, empresa_id, loja_id, fornecedor_id, usuario_criacao_id, numero_nf, serie_nf, valor_total, status, data_emissao, data_chegada, observacoes, data_criacao)
VALUES (
  'c0a10003-31f7-40c2-945f-9e793b5048be',
  '31f70c83-9172-40c2-945f-9e793b5048be',
  '6a15e943-2570-4f29-a2d5-d900d2812911',
  'f0a10003-31f7-40c2-945f-9e793b5048be',
  'ca0e852c-8bd7-47ba-9255-39f27af97937',
  '32810',
  '1',
  7100.0,
  'recebida',
  '2026-11-10',
  '2026-11-10',
  'Recebimento e Aceite Fiscal via MD-e Chave 35261113347016000117550010000328101452981763 - Althaia S.A.',
  now()
) ON CONFLICT (id) DO NOTHING;

-- Item 1: Equaliv Body Protein Neutro 450g
INSERT INTO itens_compra (id, compra_id, produto_id, quantidade, valor_unitario, lote, validade)
VALUES (
  'c0a10003-31f7-40c2-945f-9e793b504000',
  'c0a10003-31f7-40c2-945f-9e793b5048be',
  '1492c857-8c78-426a-b750-630f74007020',
  20,
  88.0,
  'LOTE-EQ-810A',
  '2028-10-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO movimentacoes_estoque (id, empresa_id, loja_id, produto_id, usuario_id, fornecedor_id, quantidade, tipo, motivo, custo_unitario, documento_numero, documento_serie, documento_tipo, lote, validade, data_operacao)
VALUES (
  'm0a10003-31f7-40c2-945f-9e793b504000',
  '31f70c83-9172-40c2-945f-9e793b5048be',
  '6a15e943-2570-4f29-a2d5-d900d2812911',
  '1492c857-8c78-426a-b750-630f74007020',
  'ca0e852c-8bd7-47ba-9255-39f27af97937',
  'f0a10003-31f7-40c2-945f-9e793b5048be',
  20,
  'entrada',
  'compra',
  88.0,
  '32810',
  '1',
  'nfe',
  'LOTE-EQ-810A',
  '2028-10-01',
  now()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO estoque (id, empresa_id, loja_id, produto_id, quantidade, lote, validade, localizacao, data_atualizacao)
VALUES (
  'e0a10003-31f7-40c2-945f-9e793b504000',
  '31f70c83-9172-40c2-945f-9e793b5048be',
  '6a15e943-2570-4f29-a2d5-d900d2812911',
  '1492c857-8c78-426a-b750-630f74007020',
  20,
  'LOTE-EQ-810A',
  '2028-10-01',
  'Gôndola A1 / Suplementos',
  now()
) ON CONFLICT (id) DO NOTHING;

-- Atualizar vitrine virtual do e-commerce
UPDATE commerce_inventory_levels
SET disponivel = disponivel + 20, atualizado_em = now()
WHERE empresa_id = '31f70c83-9172-40c2-945f-9e793b5048be' AND variant_id IN (
  SELECT id FROM commerce_product_variants WHERE product_id = '1492c857-8c78-426a-b750-630f74007020'
);

-- Item 2: Equaliv Body Protein Cacau 600g
INSERT INTO itens_compra (id, compra_id, produto_id, quantidade, valor_unitario, lote, validade)
VALUES (
  'c0a10003-31f7-40c2-945f-9e793b504001',
  'c0a10003-31f7-40c2-945f-9e793b5048be',
  '70af09f9-4749-41b2-bc7b-c813743dcbc3',
  20,
  108.0,
  'LOTE-EQ-810B',
  '2028-10-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO movimentacoes_estoque (id, empresa_id, loja_id, produto_id, usuario_id, fornecedor_id, quantidade, tipo, motivo, custo_unitario, documento_numero, documento_serie, documento_tipo, lote, validade, data_operacao)
VALUES (
  'm0a10003-31f7-40c2-945f-9e793b504001',
  '31f70c83-9172-40c2-945f-9e793b5048be',
  '6a15e943-2570-4f29-a2d5-d900d2812911',
  '70af09f9-4749-41b2-bc7b-c813743dcbc3',
  'ca0e852c-8bd7-47ba-9255-39f27af97937',
  'f0a10003-31f7-40c2-945f-9e793b5048be',
  20,
  'entrada',
  'compra',
  108.0,
  '32810',
  '1',
  'nfe',
  'LOTE-EQ-810B',
  '2028-10-01',
  now()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO estoque (id, empresa_id, loja_id, produto_id, quantidade, lote, validade, localizacao, data_atualizacao)
VALUES (
  'e0a10003-31f7-40c2-945f-9e793b504001',
  '31f70c83-9172-40c2-945f-9e793b5048be',
  '6a15e943-2570-4f29-a2d5-d900d2812911',
  '70af09f9-4749-41b2-bc7b-c813743dcbc3',
  20,
  'LOTE-EQ-810B',
  '2028-10-01',
  'Gôndola A1 / Suplementos',
  now()
) ON CONFLICT (id) DO NOTHING;

-- Atualizar vitrine virtual do e-commerce
UPDATE commerce_inventory_levels
SET disponivel = disponivel + 20, atualizado_em = now()
WHERE empresa_id = '31f70c83-9172-40c2-945f-9e793b5048be' AND variant_id IN (
  SELECT id FROM commerce_product_variants WHERE product_id = '70af09f9-4749-41b2-bc7b-c813743dcbc3'
);

-- Item 3: Equaliv Creatina 100% 300g
INSERT INTO itens_compra (id, compra_id, produto_id, quantidade, valor_unitario, lote, validade)
VALUES (
  'c0a10003-31f7-40c2-945f-9e793b504002',
  'c0a10003-31f7-40c2-945f-9e793b5048be',
  '023e1548-9cbb-4ccf-a2b1-45a35c1efae2',
  30,
  52.0,
  'LOTE-EQ-810C',
  '2028-09-15'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO movimentacoes_estoque (id, empresa_id, loja_id, produto_id, usuario_id, fornecedor_id, quantidade, tipo, motivo, custo_unitario, documento_numero, documento_serie, documento_tipo, lote, validade, data_operacao)
VALUES (
  'm0a10003-31f7-40c2-945f-9e793b504002',
  '31f70c83-9172-40c2-945f-9e793b5048be',
  '6a15e943-2570-4f29-a2d5-d900d2812911',
  '023e1548-9cbb-4ccf-a2b1-45a35c1efae2',
  'ca0e852c-8bd7-47ba-9255-39f27af97937',
  'f0a10003-31f7-40c2-945f-9e793b5048be',
  30,
  'entrada',
  'compra',
  52.0,
  '32810',
  '1',
  'nfe',
  'LOTE-EQ-810C',
  '2028-09-15',
  now()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO estoque (id, empresa_id, loja_id, produto_id, quantidade, lote, validade, localizacao, data_atualizacao)
VALUES (
  'e0a10003-31f7-40c2-945f-9e793b504002',
  '31f70c83-9172-40c2-945f-9e793b5048be',
  '6a15e943-2570-4f29-a2d5-d900d2812911',
  '023e1548-9cbb-4ccf-a2b1-45a35c1efae2',
  30,
  'LOTE-EQ-810C',
  '2028-09-15',
  'Gôndola A1 / Suplementos',
  now()
) ON CONFLICT (id) DO NOTHING;

-- Atualizar vitrine virtual do e-commerce
UPDATE commerce_inventory_levels
SET disponivel = disponivel + 30, atualizado_em = now()
WHERE empresa_id = '31f70c83-9172-40c2-945f-9e793b5048be' AND variant_id IN (
  SELECT id FROM commerce_product_variants WHERE product_id = '023e1548-9cbb-4ccf-a2b1-45a35c1efae2'
);

-- Item 4: Equaliv Colageno Hidrolisado Neutro 30 Saches
INSERT INTO itens_compra (id, compra_id, produto_id, quantidade, valor_unitario, lote, validade)
VALUES (
  'c0a10003-31f7-40c2-945f-9e793b504003',
  'c0a10003-31f7-40c2-945f-9e793b5048be',
  '70accb9a-3a38-49f5-b864-a24a341e5980',
  15,
  62.0,
  'LOTE-EQ-810D',
  '2028-08-20'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO movimentacoes_estoque (id, empresa_id, loja_id, produto_id, usuario_id, fornecedor_id, quantidade, tipo, motivo, custo_unitario, documento_numero, documento_serie, documento_tipo, lote, validade, data_operacao)
VALUES (
  'm0a10003-31f7-40c2-945f-9e793b504003',
  '31f70c83-9172-40c2-945f-9e793b5048be',
  '6a15e943-2570-4f29-a2d5-d900d2812911',
  '70accb9a-3a38-49f5-b864-a24a341e5980',
  'ca0e852c-8bd7-47ba-9255-39f27af97937',
  'f0a10003-31f7-40c2-945f-9e793b5048be',
  15,
  'entrada',
  'compra',
  62.0,
  '32810',
  '1',
  'nfe',
  'LOTE-EQ-810D',
  '2028-08-20',
  now()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO estoque (id, empresa_id, loja_id, produto_id, quantidade, lote, validade, localizacao, data_atualizacao)
VALUES (
  'e0a10003-31f7-40c2-945f-9e793b504003',
  '31f70c83-9172-40c2-945f-9e793b5048be',
  '6a15e943-2570-4f29-a2d5-d900d2812911',
  '70accb9a-3a38-49f5-b864-a24a341e5980',
  15,
  'LOTE-EQ-810D',
  '2028-08-20',
  'Gôndola A1 / Suplementos',
  now()
) ON CONFLICT (id) DO NOTHING;

-- Atualizar vitrine virtual do e-commerce
UPDATE commerce_inventory_levels
SET disponivel = disponivel + 15, atualizado_em = now()
WHERE empresa_id = '31f70c83-9172-40c2-945f-9e793b5048be' AND variant_id IN (
  SELECT id FROM commerce_product_variants WHERE product_id = '70accb9a-3a38-49f5-b864-a24a341e5980'
);

-- Item 5: Equaliv Cartliv 60 caps
INSERT INTO itens_compra (id, compra_id, produto_id, quantidade, valor_unitario, lote, validade)
VALUES (
  'c0a10003-31f7-40c2-945f-9e793b504004',
  'c0a10003-31f7-40c2-945f-9e793b5048be',
  '740c0e64-4abc-43e5-9115-10bad0ef052f',
  15,
  46.0,
  'LOTE-EQ-810E',
  '2028-07-30'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO movimentacoes_estoque (id, empresa_id, loja_id, produto_id, usuario_id, fornecedor_id, quantidade, tipo, motivo, custo_unitario, documento_numero, documento_serie, documento_tipo, lote, validade, data_operacao)
VALUES (
  'm0a10003-31f7-40c2-945f-9e793b504004',
  '31f70c83-9172-40c2-945f-9e793b5048be',
  '6a15e943-2570-4f29-a2d5-d900d2812911',
  '740c0e64-4abc-43e5-9115-10bad0ef052f',
  'ca0e852c-8bd7-47ba-9255-39f27af97937',
  'f0a10003-31f7-40c2-945f-9e793b5048be',
  15,
  'entrada',
  'compra',
  46.0,
  '32810',
  '1',
  'nfe',
  'LOTE-EQ-810E',
  '2028-07-30',
  now()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO estoque (id, empresa_id, loja_id, produto_id, quantidade, lote, validade, localizacao, data_atualizacao)
VALUES (
  'e0a10003-31f7-40c2-945f-9e793b504004',
  '31f70c83-9172-40c2-945f-9e793b5048be',
  '6a15e943-2570-4f29-a2d5-d900d2812911',
  '740c0e64-4abc-43e5-9115-10bad0ef052f',
  15,
  'LOTE-EQ-810E',
  '2028-07-30',
  'Gôndola A1 / Suplementos',
  now()
) ON CONFLICT (id) DO NOTHING;

-- Atualizar vitrine virtual do e-commerce
UPDATE commerce_inventory_levels
SET disponivel = disponivel + 15, atualizado_em = now()
WHERE empresa_id = '31f70c83-9172-40c2-945f-9e793b5048be' AND variant_id IN (
  SELECT id FROM commerce_product_variants WHERE product_id = '740c0e64-4abc-43e5-9115-10bad0ef052f'
);

-- Item 6: Equaliv Body Protein Neutro Sache 15g (Bonificação Comercial Acordo Anual)
INSERT INTO itens_compra (id, compra_id, produto_id, quantidade, valor_unitario, lote, validade)
VALUES (
  'c0a10003-31f7-40c2-945f-9e793b504005',
  'c0a10003-31f7-40c2-945f-9e793b5048be',
  '0522459b-d8ab-44ff-ac52-6371d20e57c7',
  50,
  0.0,
  'LOTE-EQ-BONIF-01',
  '2028-10-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO movimentacoes_estoque (id, empresa_id, loja_id, produto_id, usuario_id, fornecedor_id, quantidade, tipo, motivo, custo_unitario, documento_numero, documento_serie, documento_tipo, lote, validade, data_operacao)
VALUES (
  'm0a10003-31f7-40c2-945f-9e793b504005',
  '31f70c83-9172-40c2-945f-9e793b5048be',
  '6a15e943-2570-4f29-a2d5-d900d2812911',
  '0522459b-d8ab-44ff-ac52-6371d20e57c7',
  'ca0e852c-8bd7-47ba-9255-39f27af97937',
  'f0a10003-31f7-40c2-945f-9e793b5048be',
  50,
  'entrada',
  'compra',
  0.0,
  '32810',
  '1',
  'nfe',
  'LOTE-EQ-BONIF-01',
  '2028-10-01',
  now()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO estoque (id, empresa_id, loja_id, produto_id, quantidade, lote, validade, localizacao, data_atualizacao)
VALUES (
  'e0a10003-31f7-40c2-945f-9e793b504005',
  '31f70c83-9172-40c2-945f-9e793b5048be',
  '6a15e943-2570-4f29-a2d5-d900d2812911',
  '0522459b-d8ab-44ff-ac52-6371d20e57c7',
  50,
  'LOTE-EQ-BONIF-01',
  '2028-10-01',
  'Gôndola A1 / Suplementos',
  now()
) ON CONFLICT (id) DO NOTHING;

-- Atualizar vitrine virtual do e-commerce
UPDATE commerce_inventory_levels
SET disponivel = disponivel + 50, atualizado_em = now()
WHERE empresa_id = '31f70c83-9172-40c2-945f-9e793b5048be' AND variant_id IN (
  SELECT id FROM commerce_product_variants WHERE product_id = '0522459b-d8ab-44ff-ac52-6371d20e57c7'
);

INSERT INTO fin_lancamentos (
  id, empresa_id, loja_id, centro_custo_id, conta_bancaria_id,
  tipo, categoria, natureza, automatico, descricao, valor,
  data_competencia, vencimento, status, documento,
  contraparte_nome, contraparte_tipo, contraparte_id,
  parcela, parcelas, chave, origem, origem_id, meio_pagamento,
  criado_por, criado_em, atualizado_em
) VALUES (
  'p0a10003-31f7-40c2-945f-9e793b504001',
  '31f70c83-9172-40c2-945f-9e793b5048be',
  '6a15e943-2570-4f29-a2d5-d900d2812911',
  'c1f70001-31f7-40c2-945f-9e793b5048be',
  'b1f70001-31f7-40c2-945f-9e793b5048be',
  'despesa',
  'Compras de mercadoria',
  'pagar',
  true,
  'NF-e 32810 Parc 1/3 - Equaliv Nutracêuticos',
  2366.67,
  '2026-11-10',
  '2026-12-10',
  'pendente',
  'NF-e 32810/1',
  'ALTHAIA S.A. INDUSTRIA FARMACEUTICA',
  'fornecedor',
  'f0a10003-31f7-40c2-945f-9e793b5048be',
  1,
  3,
  'nfe:35261113347016000117550010000328101452981763:parc:1',
  'nfe_inbound',
  '35261113347016000117550010000328101452981763',
  'boleto',
  'Silvester Natal',
  now(),
  now()
) ON CONFLICT (empresa_id, chave) DO NOTHING;

INSERT INTO fin_lancamentos (
  id, empresa_id, loja_id, centro_custo_id, conta_bancaria_id,
  tipo, categoria, natureza, automatico, descricao, valor,
  data_competencia, vencimento, status, documento,
  contraparte_nome, contraparte_tipo, contraparte_id,
  parcela, parcelas, chave, origem, origem_id, meio_pagamento,
  criado_por, criado_em, atualizado_em
) VALUES (
  'p0a10003-31f7-40c2-945f-9e793b504002',
  '31f70c83-9172-40c2-945f-9e793b5048be',
  '6a15e943-2570-4f29-a2d5-d900d2812911',
  'c1f70001-31f7-40c2-945f-9e793b5048be',
  'b1f70001-31f7-40c2-945f-9e793b5048be',
  'despesa',
  'Compras de mercadoria',
  'pagar',
  true,
  'NF-e 32810 Parc 2/3 - Equaliv Nutracêuticos',
  2366.67,
  '2026-11-10',
  '2027-01-10',
  'pendente',
  'NF-e 32810/1',
  'ALTHAIA S.A. INDUSTRIA FARMACEUTICA',
  'fornecedor',
  'f0a10003-31f7-40c2-945f-9e793b5048be',
  2,
  3,
  'nfe:35261113347016000117550010000328101452981763:parc:2',
  'nfe_inbound',
  '35261113347016000117550010000328101452981763',
  'boleto',
  'Silvester Natal',
  now(),
  now()
) ON CONFLICT (empresa_id, chave) DO NOTHING;

INSERT INTO fin_lancamentos (
  id, empresa_id, loja_id, centro_custo_id, conta_bancaria_id,
  tipo, categoria, natureza, automatico, descricao, valor,
  data_competencia, vencimento, status, documento,
  contraparte_nome, contraparte_tipo, contraparte_id,
  parcela, parcelas, chave, origem, origem_id, meio_pagamento,
  criado_por, criado_em, atualizado_em
) VALUES (
  'p0a10003-31f7-40c2-945f-9e793b504003',
  '31f70c83-9172-40c2-945f-9e793b5048be',
  '6a15e943-2570-4f29-a2d5-d900d2812911',
  'c1f70001-31f7-40c2-945f-9e793b5048be',
  'b1f70001-31f7-40c2-945f-9e793b5048be',
  'despesa',
  'Compras de mercadoria',
  'pagar',
  true,
  'NF-e 32810 Parc 3/3 - Equaliv Nutracêuticos',
  2366.66,
  '2026-11-10',
  '2027-02-10',
  'pendente',
  'NF-e 32810/1',
  'ALTHAIA S.A. INDUSTRIA FARMACEUTICA',
  'fornecedor',
  'f0a10003-31f7-40c2-945f-9e793b5048be',
  3,
  3,
  'nfe:35261113347016000117550010000328101452981763:parc:3',
  'nfe_inbound',
  '35261113347016000117550010000328101452981763',
  'boleto',
  'Silvester Natal',
  now(),
  now()
) ON CONFLICT (empresa_id, chave) DO NOTHING;

INSERT INTO fin_lancamentos (
  id, empresa_id, loja_id, centro_custo_id, conta_bancaria_id,
  tipo, categoria, natureza, automatico, descricao, valor,
  data_competencia, vencimento, status, documento,
  contraparte_nome, contraparte_tipo, contraparte_id,
  chave, origem, origem_id, meio_pagamento,
  criado_por, criado_em, atualizado_em
) VALUES (
  'b0a10003-31f7-40c2-945f-9e793b504099',
  '31f70c83-9172-40c2-945f-9e793b5048be',
  '6a15e943-2570-4f29-a2d5-d900d2812911',
  'c1f70001-31f7-40c2-945f-9e793b5048be',
  'b1f70001-31f7-40c2-945f-9e793b5048be',
  'receita',
  'Vendas de produtos',
  'receber',
  true,
  'Crédito Bonificação Comercial NF-e 32810 (50 Sachês Body Protein) - Equaliv',
  250.00,
  '2026-11-10',
  '2026-11-10',
  'pendente',
  'Bonif NF-e 32810',
  'ALTHAIA S.A. INDUSTRIA FARMACEUTICA',
  'fornecedor',
  'f0a10003-31f7-40c2-945f-9e793b5048be',
  'nfe:35261113347016000117550010000328101452981763:bonif',
  'nfe_inbound_bonif',
  '35261113347016000117550010000328101452981763',
  'outro',
  'Silvester Natal',
  now(),
  now()
) ON CONFLICT (empresa_id, chave) DO NOTHING;

INSERT INTO fis_eventos (empresa_id, documento_id, tipo, detalhe, usuario, criado_em)
VALUES (
  '31f70c83-9172-40c2-945f-9e793b5048be',
  'e1f55003-31f7-40c2-945f-9e793b5048be',
  'manifestacao_confirmacao',
  '{"tipoEvento": "210200", "protocolo": "151260987654321", "descricao": "Confirmação da Operação", "data": "2026-11-10T14:30:00Z", "motivo": "Aceite da NF-e e integração completa ERP"}'::jsonb,
  'Silvester Natal (Stallone)',
  now()
);
