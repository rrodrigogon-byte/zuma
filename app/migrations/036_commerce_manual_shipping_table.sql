-- Tabela manual Kytto enquanto a conta contratada dos Correios não está liberada.
-- Não altera contas, pedidos, estoque ou pagamentos existentes.
ALTER TABLE commerce_shipping_quotes
  ALTER COLUMN shipping_account_id DROP NOT NULL;

INSERT INTO commerce_shipping_methods (empresa_id, storefront_id, codigo, nome, tipo, ativo, configuracao)
SELECT d.empresa_id,
       d.storefront_id,
       'kytto-regional',
       'Entrega regional Kytto',
       'delivery',
       true,
       $json$
       {
         "provider": "manual",
         "origemCep": "78300000",
         "rules": [
           {"id":"tangara-da-serra","label":"Tangará da Serra","uf":"MT","cities":["Tangará da Serra"],"amount":25,"deliveryDays":1,"priority":100},
           {"id":"regional-150km","label":"Região até 150 km de Tangará da Serra","uf":"MT","cities":["Nova Olímpia","Barra do Bugres","Denise","Porto Estrela"],"amount":20,"deliveryDays":1,"priority":80},
           {"id":"grande-cuiaba","label":"Grande Cuiabá","uf":"MT","cities":["Cuiabá","Várzea Grande","Acorizal","Chapada dos Guimarães","Nossa Senhora do Livramento","Santo Antônio do Leverger","Campo Verde"],"amount":25,"deliveryDays":1,"priority":70},
           {"id":"fallback-nacional","label":"Demais localidades","amount":30,"deliveryDays":10,"priority":-100,"fallback":true}
         ]
       }
       $json$::jsonb
  FROM commerce_store_domains d
 WHERE lower(d.dominio) = 'loja.kytto.com.br'
ON CONFLICT (empresa_id, storefront_id, codigo) DO UPDATE
  SET nome = EXCLUDED.nome,
      tipo = EXCLUDED.tipo,
      ativo = true,
      configuracao = CASE
        WHEN COALESCE(commerce_shipping_methods.configuracao->>'provider', '') IN ('', 'manual')
          THEN EXCLUDED.configuracao
        ELSE commerce_shipping_methods.configuracao
      END;
