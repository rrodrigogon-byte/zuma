-- MIGRATION 042: ativação inicial da entrega própria no storefront Dino
-- Os valores são parâmetros iniciais editáveis no Admin > E-commerce > Entrega.
-- A identificação do storefront é a registrada na homologação do fluxo Dino.

WITH target AS (
  SELECT id, empresa_id
    FROM commerce_storefronts
   WHERE id = '94ce95de-f36d-4ced-ad92-40f4208a7e06'::uuid
)
INSERT INTO commerce_shipping_methods (empresa_id, storefront_id, codigo, nome, tipo, ativo, configuracao)
SELECT empresa_id, id, 'dino-motoboy', 'Motoboy / entrega local', 'delivery', true,
       '{"provider":"manual","deliveryType":"motoboy","baseFee":10,"pricePerKm":1,"maxRadiusKm":150,"deliveryDays":2,"rules":[{"id":"tangara-da-serra","label":"Tangará da Serra","uf":"MT","cities":["Tangará da Serra"],"distanceKm":5,"deliveryDays":1},{"id":"regiao-150km","label":"Região até 150 km de Tangará da Serra","uf":"MT","cities":["Nova Olímpia","Barra do Bugres","Denise","Porto Estrela"],"distanceKm":60,"deliveryDays":2}]}'::jsonb
  FROM target
ON CONFLICT (empresa_id, storefront_id, codigo) DO UPDATE
  SET nome = EXCLUDED.nome, tipo = EXCLUDED.tipo, ativo = true;

WITH target AS (
  SELECT id, empresa_id
    FROM commerce_storefronts
   WHERE id = '94ce95de-f36d-4ced-ad92-40f4208a7e06'::uuid
)
INSERT INTO commerce_shipping_methods (empresa_id, storefront_id, codigo, nome, tipo, ativo, configuracao)
SELECT empresa_id, id, 'dino-regional', 'Tabela regional fixa', 'delivery', true,
       '{"provider":"manual","deliveryType":"regional_table","deliveryDays":3,"rules":[{"id":"tangara-da-serra","label":"Tangará da Serra","uf":"MT","cities":["Tangará da Serra"],"amount":25,"deliveryDays":1,"priority":100},{"id":"regiao-150km","label":"Região até 150 km de Tangará da Serra","uf":"MT","cities":["Nova Olímpia","Barra do Bugres","Denise","Porto Estrela"],"amount":20,"deliveryDays":2,"priority":80},{"id":"fallback-regional","label":"Demais localidades","amount":30,"deliveryDays":10,"priority":-100,"fallback":true}]}'::jsonb
  FROM target
ON CONFLICT (empresa_id, storefront_id, codigo) DO UPDATE
  SET nome = EXCLUDED.nome, tipo = EXCLUDED.tipo, ativo = true;

WITH target AS (
  SELECT id, empresa_id
    FROM commerce_storefronts
   WHERE id = '94ce95de-f36d-4ced-ad92-40f4208a7e06'::uuid
)
INSERT INTO commerce_shipping_methods (empresa_id, storefront_id, codigo, nome, tipo, ativo, configuracao)
SELECT empresa_id, id, 'dino-express', 'Entrega expressa', 'delivery', true,
       '{"provider":"manual","deliveryType":"express","fixedFee":35,"deliveryDays":1}'::jsonb
  FROM target
ON CONFLICT (empresa_id, storefront_id, codigo) DO UPDATE
  SET nome = EXCLUDED.nome, tipo = EXCLUDED.tipo, ativo = true;

WITH target AS (
  SELECT id, empresa_id
    FROM commerce_storefronts
   WHERE id = '94ce95de-f36d-4ced-ad92-40f4208a7e06'::uuid
)
INSERT INTO commerce_shipping_methods (empresa_id, storefront_id, codigo, nome, tipo, ativo, configuracao)
SELECT empresa_id, id, 'dino-frete-gratis', 'Frete grátis acima de R$ 199', 'delivery', true,
       '{"provider":"manual","deliveryType":"free_shipping","freeShippingAbove":199,"deliveryDays":5}'::jsonb
  FROM target
ON CONFLICT (empresa_id, storefront_id, codigo) DO UPDATE
  SET nome = EXCLUDED.nome, tipo = EXCLUDED.tipo, ativo = true;
