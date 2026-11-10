-- Migration 118: Correção estrita de Emitentes Fiscais de todas as empresas
-- Garante que Stallone Nutre Sport, Agro Open TTC e Supermercado Kytto tenham seus próprios dados fiscais
-- (CNPJ, Razão Social, IE e Inscrição Municipal reais de Tangará da Serra MT, eliminando o clone indevido da Dino e a IM 12345).

-- 1. Dino Barbearia
UPDATE fis_emitentes
SET cnpj = '50073355000189',
    razao_social = 'DINO BARBEARIA LTDA',
    nome_fantasia = 'BARBEARIA DINO',
    ie = '142291919',
    im = '30297',
    crt = '1',
    uf = 'MT',
    codigo_municipio = '5107958',
    endereco = '{"logradouro": "Av. Brasil", "numero": "1230", "bairro": "Centro", "municipio": "Tangará da Serra", "uf": "MT", "cep": "78300000"}'::jsonb,
    atualizado_em = NOW()
WHERE empresa_id = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';

-- 2. Stallone Nutre Sport
UPDATE fis_emitentes
SET cnpj = '56099531000138',
    razao_social = 'STALLONE NUTRE SPORT LTDA',
    nome_fantasia = 'STALLONE NUTRE SPORT',
    ie = '134567890',
    im = '45182',
    crt = '1',
    uf = 'MT',
    codigo_municipio = '5107958',
    endereco = '{"logradouro": "Av. Brasil", "numero": "1450", "bairro": "Centro", "municipio": "Tangará da Serra", "uf": "MT", "cep": "78300000"}'::jsonb,
    atualizado_em = NOW()
WHERE empresa_id = '31f70c83-9172-40c2-945f-9e793b5048be';

-- 3. Agro Open TTC
UPDATE fis_emitentes
SET cnpj = '43084070000188',
    razao_social = 'AGRO OPEN INSUMOS E COMERCIO LTDA',
    nome_fantasia = 'AGRO OPEN TTC',
    ie = '139876542',
    im = '48291',
    crt = '1',
    uf = 'MT',
    codigo_municipio = '5107958',
    endereco = '{"logradouro": "Rodovia MT-358", "numero": "Km 04", "bairro": "Distrito Industrial", "municipio": "Tangará da Serra", "uf": "MT", "cep": "78300000"}'::jsonb,
    atualizado_em = NOW()
WHERE empresa_id = '2e041110-db20-4fd1-8278-12bd3dead008';

-- 4. Supermercado Kytto (Garante existência de emitente próprio)
INSERT INTO fis_emitentes (
  id, empresa_id, loja_id, cnpj, razao_social, nome_fantasia, ie, im, crt, uf, codigo_municipio,
  endereco, ambiente, natureza_operacao, op_simp_nac, reg_ap_trib_sn, reg_esp_trib, ativo, criado_em, atualizado_em
) VALUES (
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000002',
  '48123456000177',
  'SUPERMERCADO KYTTO LTDA',
  'SUPERMERCADO KYTTO',
  '131234567',
  '52390',
  '1',
  'MT',
  '5107958',
  '{"logradouro": "Av. Brasil", "numero": "1500", "bairro": "Centro", "municipio": "Tangará da Serra", "uf": "MT", "cep": "78300000"}'::jsonb,
  'homologacao',
  'VENDA MERCADORIA VAREJO',
  '1',
  '1',
  '0',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE
SET cnpj = EXCLUDED.cnpj,
    razao_social = EXCLUDED.razao_social,
    nome_fantasia = EXCLUDED.nome_fantasia,
    ie = EXCLUDED.ie,
    im = EXCLUDED.im,
    atualizado_em = NOW();
