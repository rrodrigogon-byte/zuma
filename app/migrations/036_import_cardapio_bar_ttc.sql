-- Importação idempotente do cardápio Bar TTC.
-- Os dados do PDF não informam estoque inicial; por isso os níveis entram em zero.
-- O mesmo catálogo é disponibilizado para cada empresa ativa e seus storefronts,
-- preservando isolamento por empresa e sem reutilizar IDs entre tenants.
DO $$
DECLARE
  company RECORD;
  storefront RECORD;
  item JSONB;
  v_category_id UUID;
  v_product_id UUID;
  v_variant_id UUID;
  v_price_list_id UUID;
  v_legacy_category_id UUID;
  v_legacy_product_id UUID;
  v_location_id UUID;
  v_existing_price_id UUID;
  v_asset_url TEXT;
  v_asset_key TEXT;
  source_tag CONSTANT TEXT := 'cardapio-bar-ttc';
  items JSONB := $json$[
    {"slug":"agua-mineral","sku":"BAR-TTC-AGUA-MINERAL","nome":"Água Mineral","categoria":"Bebidas não alcoólicas","preco":5.00,"unidade":"UN","pagina":1},
    {"slug":"agua-com-gas","sku":"BAR-TTC-AGUA-COM-GAS","nome":"Água com Gás","categoria":"Bebidas não alcoólicas","preco":6.00,"unidade":"UN","pagina":1},
    {"slug":"refrigerante","sku":"BAR-TTC-REFRIGERANTE","nome":"Refrigerante","categoria":"Bebidas não alcoólicas","preco":8.00,"unidade":"UN","pagina":1},
    {"slug":"suco","sku":"BAR-TTC-SUCO","nome":"Suco","categoria":"Bebidas não alcoólicas","preco":10.00,"unidade":"UN","pagina":1},
    {"slug":"gatorade","sku":"BAR-TTC-GATORADE","nome":"Gatorade","categoria":"Bebidas não alcoólicas","preco":12.00,"unidade":"UN","pagina":1},
    {"slug":"red-bull","sku":"BAR-TTC-RED-BULL","nome":"Red Bull","categoria":"Bebidas não alcoólicas","preco":15.00,"unidade":"UN","pagina":1},
    {"slug":"stella-artois-long-neck","sku":"BAR-TTC-STELLA-ARTOIS-LN","nome":"Stella Artois Long Neck","categoria":"Cervejas Long Neck","preco":12.90,"unidade":"UN","tamanho":"Long Neck","pagina":1},
    {"slug":"corona-long-neck","sku":"BAR-TTC-CORONA-LN","nome":"Corona Long Neck","categoria":"Cervejas Long Neck","preco":12.90,"unidade":"UN","tamanho":"Long Neck","pagina":1},
    {"slug":"budweiser-long-neck","sku":"BAR-TTC-BUDWEISER-LN","nome":"Budweiser Long Neck","categoria":"Cervejas Long Neck","preco":12.90,"unidade":"UN","tamanho":"Long Neck","pagina":1},
    {"slug":"heineken-long-neck","sku":"BAR-TTC-HEINEKEN-LN","nome":"Heineken Long Neck","categoria":"Cervejas Long Neck","preco":12.90,"unidade":"UN","tamanho":"Long Neck","pagina":1},
    {"slug":"original-600ml","sku":"BAR-TTC-ORIGINAL-600ML","nome":"Original 600ml","categoria":"Cervejas 600ml","preco":16.90,"unidade":"UN","volumeMl":600,"pagina":1},
    {"slug":"stella-600ml","sku":"BAR-TTC-STELLA-600ML","nome":"Stella 600ml","categoria":"Cervejas 600ml","preco":18.90,"unidade":"UN","volumeMl":600,"pagina":1},
    {"slug":"corona-600ml","sku":"BAR-TTC-CORONA-600ML","nome":"Corona 600ml","categoria":"Cervejas 600ml","preco":19.90,"unidade":"UN","volumeMl":600,"pagina":1},
    {"slug":"heineken-600ml","sku":"BAR-TTC-HEINEKEN-600ML","nome":"Heineken 600ml","categoria":"Cervejas 600ml","preco":19.90,"unidade":"UN","volumeMl":600,"pagina":1},
    {"slug":"ice","sku":"BAR-TTC-ICE","nome":"Ice","categoria":"Outras bebidas","preco":15.00,"unidade":"UN","pagina":1},
    {"slug":"campari","sku":"BAR-TTC-CAMPARI","nome":"Campari","categoria":"Outras bebidas","preco":18.00,"unidade":"UN","pagina":1},
    {"slug":"batata-frita","sku":"BAR-TTC-BATATA-FRITA","nome":"Batata Frita","categoria":"Porções","preco":34.90,"unidade":"PORÇÃO","pagina":2},
    {"slug":"frango-a-passarinho","sku":"BAR-TTC-FRANGO-PASSARINHO","nome":"Frango à Passarinho","categoria":"Porções","preco":39.90,"unidade":"PORÇÃO","pagina":2},
    {"slug":"isca-de-tilapia","sku":"BAR-TTC-ISCA-TILAPIA","nome":"Isca de Tilápia","categoria":"Porções","preco":59.90,"unidade":"PORÇÃO","pagina":2},
    {"slug":"file-com-fritas","sku":"BAR-TTC-FILE-FRITAS","nome":"Filé com Fritas","categoria":"Porções","preco":69.90,"unidade":"PORÇÃO","pagina":2},
    {"slug":"espeto-simples-frango-bacon","sku":"BAR-TTC-ESP-S-FRANGO-BACON","nome":"Frango c/ Bacon","categoria":"Espetos simples","preco":29.00,"unidade":"UN","apresentacao":"Simples","pagina":2},
    {"slug":"espeto-simples-alcatra","sku":"BAR-TTC-ESP-S-ALCATRA","nome":"Alcatra","categoria":"Espetos simples","preco":29.90,"unidade":"UN","apresentacao":"Simples","pagina":2},
    {"slug":"espeto-simples-picanha","sku":"BAR-TTC-ESP-S-PICANHA","nome":"Picanha","categoria":"Espetos simples","preco":39.90,"unidade":"UN","apresentacao":"Simples","pagina":2},
    {"slug":"espeto-completo-alcatra","sku":"BAR-TTC-ESP-C-ALCATRA","nome":"Alcatra","categoria":"Espetos completos","preco":34.90,"unidade":"UN","apresentacao":"Completo","pagina":2},
    {"slug":"espeto-completo-frango-bacon","sku":"BAR-TTC-ESP-C-FRANGO-BACON","nome":"Frango c/ Bacon","categoria":"Espetos completos","preco":34.90,"unidade":"UN","apresentacao":"Completo","pagina":2},
    {"slug":"espeto-completo-picanha","sku":"BAR-TTC-ESP-C-PICANHA","nome":"Picanha","categoria":"Espetos completos","preco":44.90,"unidade":"UN","apresentacao":"Completo","pagina":2},
    {"slug":"jungle-burger","sku":"BAR-TTC-JUNGLE-BURGER","nome":"Jungle Burger","categoria":"Burgers gourmet","preco":34.90,"unidade":"UN","pagina":3,"descricao":"Pão de hambúrguer levemente tostado, molho especial, tomate, alface, picles, hambúrguer de costela 180g, queijo mussarela, bacon."},
    {"slug":"pantera-burger","sku":"BAR-TTC-PANTERA","nome":"Pantera","categoria":"Burgers gourmet","preco":39.90,"unidade":"UN","pagina":3,"descricao":"Pão australiano, molho especial, hambúrguer de costela 180g, queijo cheddar fatiado, cebola caramelizada, bacon."},
    {"slug":"rei-da-floresta-burger","sku":"BAR-TTC-REI-FLORESTA","nome":"Rei da Floresta","categoria":"Burgers gourmet","preco":39.90,"unidade":"UN","pagina":3,"descricao":"Pão brioche levemente tostado, molho especial, hambúrguer de costela 180g, alface, creme de cheddar, anéis de cebola, bacon."}
  ]$json$;
BEGIN
  FOR company IN SELECT id FROM empresas WHERE ativa = true LOOP
    INSERT INTO commerce_price_lists (empresa_id, codigo, nome, canal, moeda, ativo)
    VALUES (company.id, 'web-default', 'Tabela web padrão', 'web', 'BRL', true)
    ON CONFLICT (empresa_id, codigo) DO UPDATE SET ativo = true
    RETURNING id INTO v_price_list_id;

    IF v_price_list_id IS NULL THEN
      SELECT id INTO v_price_list_id FROM commerce_price_lists WHERE empresa_id = company.id AND codigo = 'web-default' LIMIT 1;
    END IF;

    FOR item IN SELECT value FROM jsonb_array_elements(items) LOOP
      SELECT id INTO v_category_id
        FROM commerce_categories
       WHERE empresa_id = company.id AND slug = lower(regexp_replace(unaccent(item->>'categoria'), '[^a-zA-Z0-9]+', '-', 'g'))
       LIMIT 1;

      IF v_category_id IS NULL THEN
        INSERT INTO commerce_categories (empresa_id, slug, nome, descricao, ativo, ordem)
        VALUES (
          company.id,
          lower(regexp_replace(unaccent(item->>'categoria'), '[^a-zA-Z0-9]+', '-', 'g')),
          item->>'categoria',
          'Categoria importada do cardápio Bar TTC.',
          true,
          0
        ) RETURNING id INTO v_category_id;
      END IF;

      SELECT id INTO v_product_id
        FROM commerce_products
       WHERE empresa_id = company.id AND slug = item->>'slug'
       LIMIT 1;

      IF v_product_id IS NULL THEN
        INSERT INTO commerce_products (empresa_id, category_id, slug, nome, tipo, status, descricao, descricao_curta, dados_fiscais, seo)
        VALUES (
          company.id,
          v_category_id,
          item->>'slug',
          item->>'nome',
          'physical',
          'active',
          NULLIF(item->>'descricao', ''),
          concat_ws(' · ', NULLIF(item->>'apresentacao', ''), NULLIF(item->>'tamanho', ''), CASE WHEN item ? 'volumeMl' THEN concat(item->>'volumeMl', 'ml') END),
          jsonb_build_object('origem', source_tag, 'unidade_medida', item->>'unidade', 'categoria_cardapio', item->>'categoria'),
          jsonb_build_object('origem', source_tag)
        ) RETURNING id INTO v_product_id;
      ELSE
        UPDATE commerce_products
           SET category_id = v_category_id,
               status = CASE WHEN dados_fiscais->>'origem' = source_tag THEN 'active' ELSE status END,
               descricao = CASE WHEN dados_fiscais->>'origem' = source_tag THEN NULLIF(item->>'descricao', '') ELSE COALESCE(descricao, NULLIF(item->>'descricao', '')) END,
               descricao_curta = CASE WHEN dados_fiscais->>'origem' = source_tag THEN concat_ws(' · ', NULLIF(item->>'apresentacao', ''), NULLIF(item->>'tamanho', ''), CASE WHEN item ? 'volumeMl' THEN concat(item->>'volumeMl', 'ml') END) ELSE descricao_curta END,
               dados_fiscais = CASE WHEN dados_fiscais->>'origem' = source_tag THEN dados_fiscais || jsonb_build_object('unidade_medida', item->>'unidade', 'categoria_cardapio', item->>'categoria') ELSE dados_fiscais END,
               atualizado_em = CURRENT_TIMESTAMP
         WHERE empresa_id = company.id AND id = v_product_id;
      END IF;

      SELECT id INTO v_variant_id FROM commerce_product_variants WHERE empresa_id = company.id AND sku = item->>'sku' LIMIT 1;
      IF v_variant_id IS NULL THEN
        INSERT INTO commerce_product_variants (empresa_id, product_id, sku, nome, atributos, ativo)
        VALUES (
          company.id,
          v_product_id,
          item->>'sku',
          item->>'nome',
          jsonb_strip_nulls(jsonb_build_object('unidade_medida', item->>'unidade', 'apresentacao', item->>'apresentacao', 'tamanho', item->>'tamanho', 'volumeMl', item->'volumeMl', 'origem', source_tag)),
          true
        ) RETURNING id INTO v_variant_id;
      ELSE
        UPDATE commerce_product_variants
           SET product_id = v_product_id,
               nome = item->>'nome',
               atributos = jsonb_strip_nulls(jsonb_build_object('unidade_medida', item->>'unidade', 'apresentacao', item->>'apresentacao', 'tamanho', item->>'tamanho', 'volumeMl', item->'volumeMl', 'origem', source_tag)),
               ativo = true,
               atualizado_em = CURRENT_TIMESTAMP
         WHERE empresa_id = company.id AND id = v_variant_id;
      END IF;

      SELECT id INTO v_existing_price_id
        FROM commerce_variant_prices
       WHERE empresa_id = company.id AND price_list_id = v_price_list_id AND variant_id = v_variant_id AND vigencia_fim IS NULL
       ORDER BY vigencia_inicio DESC
       LIMIT 1;
      IF v_existing_price_id IS NULL THEN
        INSERT INTO commerce_variant_prices (empresa_id, price_list_id, variant_id, preco, custo)
        VALUES (company.id, v_price_list_id, v_variant_id, (item->>'preco')::numeric, 0);
      ELSE
        UPDATE commerce_variant_prices
           SET preco = (item->>'preco')::numeric
         WHERE id = v_existing_price_id AND EXISTS (
           SELECT 1 FROM commerce_products p WHERE p.empresa_id = company.id AND p.id = v_product_id AND p.dados_fiscais->>'origem' = source_tag
         );
      END IF;

      v_asset_key := CASE (item->>'pagina')::int
        WHEN 1 THEN 'assets/cardapio-bar-ttc/page-1-bebidas.png'
        WHEN 2 THEN 'assets/cardapio-bar-ttc/page-2-comidas.png'
        ELSE 'assets/cardapio-bar-ttc/page-3-burgers.png'
      END;
      v_asset_url := '/' || v_asset_key;
      IF NOT EXISTS (SELECT 1 FROM commerce_product_media WHERE empresa_id = company.id AND product_id = v_product_id AND storage_key = v_asset_key) THEN
        INSERT INTO commerce_product_media (empresa_id, product_id, variant_id, storage_key, public_url, mime_type, alt_text, ordem)
        VALUES (company.id, v_product_id, v_variant_id, v_asset_key, v_asset_url, 'image/png', concat(item->>'nome', ' — Cardápio Bar TTC'), 0);
      END IF;

      INSERT INTO commerce_product_channels (empresa_id, storefront_id, product_id, price_list_id, publicado)
      SELECT company.id, s.id, v_product_id, v_price_list_id, true
        FROM commerce_storefronts s
       WHERE s.empresa_id = company.id AND s.status IN ('active','draft')
      ON CONFLICT (empresa_id, storefront_id, product_id) DO UPDATE
        SET price_list_id = EXCLUDED.price_list_id, publicado = true, atualizado_em = CURRENT_TIMESTAMP;

      SELECT id INTO v_legacy_category_id FROM categorias WHERE empresa_id = company.id AND nome = item->>'categoria' LIMIT 1;
      IF v_legacy_category_id IS NULL THEN
        INSERT INTO categorias (empresa_id, nome, descricao, ativa)
        VALUES (company.id,           item->>'categoria', 'Categoria importada do cardápio Bar TTC.', true)
        RETURNING id INTO v_legacy_category_id;
      END IF;

      INSERT INTO produtos (empresa_id, categoria_id, codigo_interno, nome, descricao, preco_custo, preco_venda, unidade_medida, ativo, imagem_url)
      VALUES (company.id, v_legacy_category_id, item->>'sku', item->>'nome', NULLIF(item->>'descricao', ''), 0, (item->>'preco')::numeric, item->>'unidade', true, v_asset_url)
      ON CONFLICT (empresa_id, codigo_interno) DO UPDATE
        SET categoria_id = EXCLUDED.categoria_id,
            descricao = COALESCE(produtos.descricao, EXCLUDED.descricao),
            preco_venda = EXCLUDED.preco_venda,
            unidade_medida = EXCLUDED.unidade_medida,
            ativo = true,
            imagem_url = COALESCE(produtos.imagem_url, EXCLUDED.imagem_url),
            data_atualizacao = CURRENT_TIMESTAMP;

      SELECT id INTO v_legacy_product_id FROM produtos WHERE empresa_id = company.id AND codigo_interno = item->>'sku' LIMIT 1;
      IF v_legacy_product_id IS NOT NULL THEN
        INSERT INTO estoque (empresa_id, produto_id, quantidade, localizacao)
        SELECT company.id, v_legacy_product_id, 0, 'Cardápio Bar TTC'
        WHERE NOT EXISTS (SELECT 1 FROM estoque e WHERE e.empresa_id = company.id AND e.produto_id = v_legacy_product_id AND e.localizacao = 'Cardápio Bar TTC');
      END IF;
    END LOOP;

    FOR storefront IN SELECT id, loja_id FROM commerce_storefronts WHERE empresa_id = company.id AND status IN ('active','draft') LOOP
      SELECT id INTO v_location_id
        FROM commerce_inventory_locations
       WHERE empresa_id = company.id AND ativo = true AND (loja_id = storefront.loja_id OR (loja_id IS NULL AND storefront.loja_id IS NULL))
       ORDER BY criado_em ASC
       LIMIT 1;

      IF v_location_id IS NULL THEN
        INSERT INTO commerce_inventory_locations (empresa_id, loja_id, codigo, nome, tipo, ativo)
        VALUES (company.id, storefront.loja_id, concat('cardapio-', left(replace(storefront.id::text, '-', ''), 16)), 'Estoque — Cardápio Bar TTC', 'virtual', true)
        ON CONFLICT (empresa_id, codigo) DO UPDATE SET ativo = true
        RETURNING id INTO v_location_id;
      END IF;

      INSERT INTO commerce_inventory_levels (empresa_id, location_id, variant_id, disponivel, reservado, comprometido, minimo)
      SELECT company.id, v_location_id, v.id, 0, 0, 0, 0
        FROM commerce_product_variants v
       WHERE v.empresa_id = company.id AND v.sku LIKE 'BAR-TTC-%'
      ON CONFLICT (empresa_id, location_id, variant_id) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;
