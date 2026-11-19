-- Migration 128: Zuma Cozinha Oriental Completo
-- Cadastro de Empresa Restaurante Oriental, Loja Matriz, Storefront E-commerce,
-- 25 Mesas, 23 Categorias, 211 Produtos Oficiais, Clientes CRM, AI Facts e Atendimento Ágil WhatsApp (KyttoIA).

-- Expandir setores permitidos em bar_produtos para suportar sushi_bar e balcao
ALTER TABLE bar_produtos DROP CONSTRAINT IF EXISTS chk_bar_produto_setor;
ALTER TABLE bar_produtos ADD CONSTRAINT chk_bar_produto_setor CHECK (setor IN ('bar', 'cozinha', 'chapa', 'sushi_bar', 'balcao'));

DO $$
BEGIN
  -- 1. EMPRESA ZUMA COZINHA ORIENTAL
  INSERT INTO empresas (
    id, nome, cnpj, razao_social, inscricao_estadual, inscricao_municipal,
    tipo_negocio, grupo_id, endereco_logradouro, endereco_numero, endereco_bairro,
    endereco_cidade, endereco_estado, endereco_cep, telefone, email, website, ativa,
    data_criacao, data_atualizacao
  ) VALUES (
    'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
    'Zuma Cozinha Oriental',
    '36296848000157',
    'Zuma Cozinha Oriental LTDA',
    '13.882.109-8',
    '94820',
    'restaurante',
    NULL,
    'Av. Brasil',
    '1605',
    'Jardim Cidade Alta',
    'Tangará da Serra',
    'MT',
    '78300000',
    '(65) 99800-1447',
    'contato@zumacozinhaoriental.com.br',
    'https://zuma.kytto.com.br',
    true,
    NOW(),
    NOW()
  ) ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    razao_social = EXCLUDED.razao_social,
    cnpj = EXCLUDED.cnpj,
    tipo_negocio = 'restaurante',
    grupo_id = EXCLUDED.grupo_id,
    endereco_cidade = EXCLUDED.endereco_cidade,
    endereco_estado = EXCLUDED.endereco_estado,
    telefone = EXCLUDED.telefone,
    email = EXCLUDED.email,
    website = EXCLUDED.website,
    ativa = true,
    data_atualizacao = NOW();

  -- 2. LOJA MATRIZ ZUMA
  INSERT INTO lojas (
    id, empresa_id, codigo, nome, timezone, ativa, configuracoes, data_criacao, data_atualizacao
  ) VALUES (
    'c3c3ac01-8e50-4b61-8c79-de4aaa916da0',
    'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
    'ZUMA-MATRIZ',
    'Zuma Cozinha Oriental - Principal',
    'America/Cuiaba',
    true,
    '{}'::jsonb,
    NOW(),
    NOW()
  ) ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    codigo = EXCLUDED.codigo,
    ativa = true,
    data_atualizacao = NOW();

  -- 3. STOREFRONT & DOMÍNIO E-COMMERCE
  INSERT INTO commerce_storefronts (
    id, empresa_id, loja_id, codigo, nome, canal, status, moeda, timezone, configuracoes, criado_em, atualizado_em
  ) VALUES (
    'b8b8ac01-8e50-4b61-8c79-de4aaa916da0',
    'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
    'c3c3ac01-8e50-4b61-8c79-de4aaa916da0',
    'zuma-web',
    'Zuma Cozinha Oriental · Loja & Delivery',
    'web',
    'active',
    'BRL',
    'America/Cuiaba',
    '{}'::jsonb,
    NOW(),
    NOW()
  ) ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    status = 'active',
    atualizado_em = NOW();

  DELETE FROM commerce_store_domains WHERE dominio = 'zuma.kytto.com.br';
  INSERT INTO commerce_store_domains (
    id, empresa_id, storefront_id, dominio, principal, criado_em
  ) VALUES (
    gen_random_uuid(),
    'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
    'b8b8ac01-8e50-4b61-8c79-de4aaa916da0',
    'zuma.kytto.com.br',
    true,
    NOW()
  );

  DELETE FROM commerce_storefront_aliases WHERE alias = 'zuma';
  INSERT INTO commerce_storefront_aliases (
    id, empresa_id, storefront_id, alias, brand_key, ativo, public_config, criado_em, atualizado_em
  ) VALUES (
    gen_random_uuid(),
    'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
    'b8b8ac01-8e50-4b61-8c79-de4aaa916da0',
    'zuma',
    'zuma',
    true,
    $CONFIG${"id": 4212, "nome_fantasia": "ZUMA COZINHA ORIENTAL", "logo": "https://cdnimages.ligafiles.com.br/preset=logo_square_400/empresa_images/4304/6abafc96a35a9e82qq.webp", "cnpj": "36.296.848/0001-57", "slug": "loja", "ocultar_endereco_delivery": true, "redirect_to_delivery": true, "endereco": {"logradouro": "Av Brasil", "numero": "1605", "complemento": "S", "bairro": "Jardim Cidade Alta", "cidade": "Tangará da Serra", "uf": "MT", "cep": "78300-000", "coordenadas": {"latitude": -14.6288865, "longitude": -57.4991921}}, "descricao": null, "cores": {"primary": "#000000", "default-color": "#1fb76c", "primary-header": "#484848", "secondary-header": "#ffffff", "primary-button": "#484848", "secondary-button": "#ffffff", "primary-transparent": "#1fb76c0f"}, "whatsapp": "(65) 99800-1447", "instagram": "zuma_orientaltga/", "facebook": "Zuma_orientaltga-100986834647665", "telefone": null, "utc_diff": -4}$CONFIG$::jsonb,
    NOW(),
    NOW()
  );

  -- 4. MESAS (SALÃO, DECK, BISTRÔ, SUSHI BAR E DELIVERY)
  INSERT INTO bar_mesas (empresa_id, numero, nome, tipo, ativa, criado_em, atualizado_em)
  VALUES ('c3c3ac01-8e50-4b61-8c79-de4aaa916da3', 1, 'Mesa 01 · Salão Principal (4 Lugares)', 'fisica', true, NOW(), NOW())
  ON CONFLICT (empresa_id, numero) DO UPDATE SET nome = EXCLUDED.nome, tipo = EXCLUDED.tipo, ativa = true, atualizado_em = NOW();
  INSERT INTO bar_mesas (empresa_id, numero, nome, tipo, ativa, criado_em, atualizado_em)
  VALUES ('c3c3ac01-8e50-4b61-8c79-de4aaa916da3', 2, 'Mesa 02 · Salão Principal (4 Lugares)', 'fisica', true, NOW(), NOW())
  ON CONFLICT (empresa_id, numero) DO UPDATE SET nome = EXCLUDED.nome, tipo = EXCLUDED.tipo, ativa = true, atualizado_em = NOW();
  INSERT INTO bar_mesas (empresa_id, numero, nome, tipo, ativa, criado_em, atualizado_em)
  VALUES ('c3c3ac01-8e50-4b61-8c79-de4aaa916da3', 3, 'Mesa 03 · Salão Principal (4 Lugares)', 'fisica', true, NOW(), NOW())
  ON CONFLICT (empresa_id, numero) DO UPDATE SET nome = EXCLUDED.nome, tipo = EXCLUDED.tipo, ativa = true, atualizado_em = NOW();
  INSERT INTO bar_mesas (empresa_id, numero, nome, tipo, ativa, criado_em, atualizado_em)
  VALUES ('c3c3ac01-8e50-4b61-8c79-de4aaa916da3', 4, 'Mesa 04 · Salão Principal (6 Lugares Família)', 'fisica', true, NOW(), NOW())
  ON CONFLICT (empresa_id, numero) DO UPDATE SET nome = EXCLUDED.nome, tipo = EXCLUDED.tipo, ativa = true, atualizado_em = NOW();
  INSERT INTO bar_mesas (empresa_id, numero, nome, tipo, ativa, criado_em, atualizado_em)
  VALUES ('c3c3ac01-8e50-4b61-8c79-de4aaa916da3', 5, 'Mesa 05 · Salão Principal (4 Lugares)', 'fisica', true, NOW(), NOW())
  ON CONFLICT (empresa_id, numero) DO UPDATE SET nome = EXCLUDED.nome, tipo = EXCLUDED.tipo, ativa = true, atualizado_em = NOW();
  INSERT INTO bar_mesas (empresa_id, numero, nome, tipo, ativa, criado_em, atualizado_em)
  VALUES ('c3c3ac01-8e50-4b61-8c79-de4aaa916da3', 6, 'Mesa 06 · Salão Principal (4 Lugares)', 'fisica', true, NOW(), NOW())
  ON CONFLICT (empresa_id, numero) DO UPDATE SET nome = EXCLUDED.nome, tipo = EXCLUDED.tipo, ativa = true, atualizado_em = NOW();
  INSERT INTO bar_mesas (empresa_id, numero, nome, tipo, ativa, criado_em, atualizado_em)
  VALUES ('c3c3ac01-8e50-4b61-8c79-de4aaa916da3', 7, 'Mesa 07 · Salão Principal (6 Lugares Família)', 'fisica', true, NOW(), NOW())
  ON CONFLICT (empresa_id, numero) DO UPDATE SET nome = EXCLUDED.nome, tipo = EXCLUDED.tipo, ativa = true, atualizado_em = NOW();
  INSERT INTO bar_mesas (empresa_id, numero, nome, tipo, ativa, criado_em, atualizado_em)
  VALUES ('c3c3ac01-8e50-4b61-8c79-de4aaa916da3', 8, 'Mesa 08 · Salão Principal (4 Lugares)', 'fisica', true, NOW(), NOW())
  ON CONFLICT (empresa_id, numero) DO UPDATE SET nome = EXCLUDED.nome, tipo = EXCLUDED.tipo, ativa = true, atualizado_em = NOW();
  INSERT INTO bar_mesas (empresa_id, numero, nome, tipo, ativa, criado_em, atualizado_em)
  VALUES ('c3c3ac01-8e50-4b61-8c79-de4aaa916da3', 9, 'Mesa 09 · Salão Principal (4 Lugares)', 'fisica', true, NOW(), NOW())
  ON CONFLICT (empresa_id, numero) DO UPDATE SET nome = EXCLUDED.nome, tipo = EXCLUDED.tipo, ativa = true, atualizado_em = NOW();
  INSERT INTO bar_mesas (empresa_id, numero, nome, tipo, ativa, criado_em, atualizado_em)
  VALUES ('c3c3ac01-8e50-4b61-8c79-de4aaa916da3', 10, 'Mesa 10 · Salão Principal (6 Lugares Família)', 'fisica', true, NOW(), NOW())
  ON CONFLICT (empresa_id, numero) DO UPDATE SET nome = EXCLUDED.nome, tipo = EXCLUDED.tipo, ativa = true, atualizado_em = NOW();
  INSERT INTO bar_mesas (empresa_id, numero, nome, tipo, ativa, criado_em, atualizado_em)
  VALUES ('c3c3ac01-8e50-4b61-8c79-de4aaa916da3', 11, 'Mesa 11 · Salão Principal (4 Lugares)', 'fisica', true, NOW(), NOW())
  ON CONFLICT (empresa_id, numero) DO UPDATE SET nome = EXCLUDED.nome, tipo = EXCLUDED.tipo, ativa = true, atualizado_em = NOW();
  INSERT INTO bar_mesas (empresa_id, numero, nome, tipo, ativa, criado_em, atualizado_em)
  VALUES ('c3c3ac01-8e50-4b61-8c79-de4aaa916da3', 12, 'Mesa 12 · Salão Principal (4 Lugares)', 'fisica', true, NOW(), NOW())
  ON CONFLICT (empresa_id, numero) DO UPDATE SET nome = EXCLUDED.nome, tipo = EXCLUDED.tipo, ativa = true, atualizado_em = NOW();
  INSERT INTO bar_mesas (empresa_id, numero, nome, tipo, ativa, criado_em, atualizado_em)
  VALUES ('c3c3ac01-8e50-4b61-8c79-de4aaa916da3', 13, 'Mesa 13 · Deck Externo Jardim (4 Lugares)', 'fisica', true, NOW(), NOW())
  ON CONFLICT (empresa_id, numero) DO UPDATE SET nome = EXCLUDED.nome, tipo = EXCLUDED.tipo, ativa = true, atualizado_em = NOW();
  INSERT INTO bar_mesas (empresa_id, numero, nome, tipo, ativa, criado_em, atualizado_em)
  VALUES ('c3c3ac01-8e50-4b61-8c79-de4aaa916da3', 14, 'Mesa 14 · Deck Externo Jardim (4 Lugares)', 'fisica', true, NOW(), NOW())
  ON CONFLICT (empresa_id, numero) DO UPDATE SET nome = EXCLUDED.nome, tipo = EXCLUDED.tipo, ativa = true, atualizado_em = NOW();
  INSERT INTO bar_mesas (empresa_id, numero, nome, tipo, ativa, criado_em, atualizado_em)
  VALUES ('c3c3ac01-8e50-4b61-8c79-de4aaa916da3', 15, 'Mesa 15 · Deck Externo Jardim (4 Lugares)', 'fisica', true, NOW(), NOW())
  ON CONFLICT (empresa_id, numero) DO UPDATE SET nome = EXCLUDED.nome, tipo = EXCLUDED.tipo, ativa = true, atualizado_em = NOW();
  INSERT INTO bar_mesas (empresa_id, numero, nome, tipo, ativa, criado_em, atualizado_em)
  VALUES ('c3c3ac01-8e50-4b61-8c79-de4aaa916da3', 16, 'Mesa 16 · Deck Externo Jardim (4 Lugares)', 'fisica', true, NOW(), NOW())
  ON CONFLICT (empresa_id, numero) DO UPDATE SET nome = EXCLUDED.nome, tipo = EXCLUDED.tipo, ativa = true, atualizado_em = NOW();
  INSERT INTO bar_mesas (empresa_id, numero, nome, tipo, ativa, criado_em, atualizado_em)
  VALUES ('c3c3ac01-8e50-4b61-8c79-de4aaa916da3', 17, 'Mesa 17 · Deck Externo Jardim (6 Lugares)', 'fisica', true, NOW(), NOW())
  ON CONFLICT (empresa_id, numero) DO UPDATE SET nome = EXCLUDED.nome, tipo = EXCLUDED.tipo, ativa = true, atualizado_em = NOW();
  INSERT INTO bar_mesas (empresa_id, numero, nome, tipo, ativa, criado_em, atualizado_em)
  VALUES ('c3c3ac01-8e50-4b61-8c79-de4aaa916da3', 18, 'Mesa 18 · Deck Externo Jardim (6 Lugares)', 'fisica', true, NOW(), NOW())
  ON CONFLICT (empresa_id, numero) DO UPDATE SET nome = EXCLUDED.nome, tipo = EXCLUDED.tipo, ativa = true, atualizado_em = NOW();
  INSERT INTO bar_mesas (empresa_id, numero, nome, tipo, ativa, criado_em, atualizado_em)
  VALUES ('c3c3ac01-8e50-4b61-8c79-de4aaa916da3', 19, 'Mesa 19 · Bistrô Casal Romântico (2 Lugares)', 'fisica', true, NOW(), NOW())
  ON CONFLICT (empresa_id, numero) DO UPDATE SET nome = EXCLUDED.nome, tipo = EXCLUDED.tipo, ativa = true, atualizado_em = NOW();
  INSERT INTO bar_mesas (empresa_id, numero, nome, tipo, ativa, criado_em, atualizado_em)
  VALUES ('c3c3ac01-8e50-4b61-8c79-de4aaa916da3', 20, 'Mesa 20 · Bistrô Casal Romântico (2 Lugares)', 'fisica', true, NOW(), NOW())
  ON CONFLICT (empresa_id, numero) DO UPDATE SET nome = EXCLUDED.nome, tipo = EXCLUDED.tipo, ativa = true, atualizado_em = NOW();
  INSERT INTO bar_mesas (empresa_id, numero, nome, tipo, ativa, criado_em, atualizado_em)
  VALUES ('c3c3ac01-8e50-4b61-8c79-de4aaa916da3', 21, 'Mesa 21 · Bistrô Casal Romântico (2 Lugares)', 'fisica', true, NOW(), NOW())
  ON CONFLICT (empresa_id, numero) DO UPDATE SET nome = EXCLUDED.nome, tipo = EXCLUDED.tipo, ativa = true, atualizado_em = NOW();
  INSERT INTO bar_mesas (empresa_id, numero, nome, tipo, ativa, criado_em, atualizado_em)
  VALUES ('c3c3ac01-8e50-4b61-8c79-de4aaa916da3', 22, 'Mesa 22 · Bistrô Casal Romântico (2 Lugares)', 'fisica', true, NOW(), NOW())
  ON CONFLICT (empresa_id, numero) DO UPDATE SET nome = EXCLUDED.nome, tipo = EXCLUDED.tipo, ativa = true, atualizado_em = NOW();
  INSERT INTO bar_mesas (empresa_id, numero, nome, tipo, ativa, criado_em, atualizado_em)
  VALUES ('c3c3ac01-8e50-4b61-8c79-de4aaa916da3', 23, 'Mesa 23 · Sushi Bar Frente Sushiman (2 Lugares)', 'fisica', true, NOW(), NOW())
  ON CONFLICT (empresa_id, numero) DO UPDATE SET nome = EXCLUDED.nome, tipo = EXCLUDED.tipo, ativa = true, atualizado_em = NOW();
  INSERT INTO bar_mesas (empresa_id, numero, nome, tipo, ativa, criado_em, atualizado_em)
  VALUES ('c3c3ac01-8e50-4b61-8c79-de4aaa916da3', 24, 'Mesa 24 · Sushi Bar Frente Sushiman (2 Lugares)', 'fisica', true, NOW(), NOW())
  ON CONFLICT (empresa_id, numero) DO UPDATE SET nome = EXCLUDED.nome, tipo = EXCLUDED.tipo, ativa = true, atualizado_em = NOW();
  INSERT INTO bar_mesas (empresa_id, numero, nome, tipo, ativa, criado_em, atualizado_em)
  VALUES ('c3c3ac01-8e50-4b61-8c79-de4aaa916da3', 25, 'Mesa 25 · Sushi Bar Frente Sushiman (2 Lugares)', 'fisica', true, NOW(), NOW())
  ON CONFLICT (empresa_id, numero) DO UPDATE SET nome = EXCLUDED.nome, tipo = EXCLUDED.tipo, ativa = true, atualizado_em = NOW();
  INSERT INTO bar_mesas (empresa_id, numero, nome, tipo, ativa, criado_em, atualizado_em)
  VALUES ('c3c3ac01-8e50-4b61-8c79-de4aaa916da3', 90, 'Mesa 90 · Retirada Balcão (Takeaway)', 'virtual', true, NOW(), NOW())
  ON CONFLICT (empresa_id, numero) DO UPDATE SET nome = EXCLUDED.nome, tipo = EXCLUDED.tipo, ativa = true, atualizado_em = NOW();
  INSERT INTO bar_mesas (empresa_id, numero, nome, tipo, ativa, criado_em, atualizado_em)
  VALUES ('c3c3ac01-8e50-4b61-8c79-de4aaa916da3', 99, 'Mesa 99 · Delivery WhatsApp & E-commerce', 'virtual', true, NOW(), NOW())
  ON CONFLICT (empresa_id, numero) DO UPDATE SET nome = EXCLUDED.nome, tipo = EXCLUDED.tipo, ativa = true, atualizado_em = NOW();
  -- 5. CANAL WHATSAPP ATENDIMENTO ÁGIL COM MOTOR KYTTOIA 2.5 FLASH
  DELETE FROM canais_integracao WHERE empresa_id = 'c3c3ac01-8e50-4b61-8c79-de4aaa916da3' AND provedor = 'whatsapp';
  INSERT INTO canais_integracao (
    id, empresa_id, loja_id, provedor, nome, status, tipo_canal, configuracao, data_criacao, data_atualizacao
  ) VALUES (
    gen_random_uuid(),
    'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
    'c3c3ac01-8e50-4b61-8c79-de4aaa916da0',
    'whatsapp',
    'Atendimento Ágil Zuma Cozinha Oriental',
    'ativo',
    'cliente',
    $WHATS${"display_name": "Zuma Cozinha Oriental", "provedor": "whatsapp", "tipo_canal": "cliente", "persona": {"id": "akira", "nome": "Akira", "ativo": true, "mensagensCurtas": true, "figurinhas": true, "revelarIa": "quando_perguntado", "motorIa": "KyttoIA 2.5 Flash", "tom": "Ágil, caloroso, altamente cortês e especialista em culinária japonesa", "saudacao": "Konbanwa! Bem-vindo ao Zuma Cozinha Oriental. Sou o Akira, seu atendente inteligente. Em que posso te ajudar hoje?"}, "capabilities": {"captureLeads": true, "humanized": true, "operateStore": true, "humanHandoff": true, "reminders": true, "sendPromotions": false, "financialOperations": true, "manageAppointments": false, "tableReservations": true}, "ai_policy": {"personalization_enabled": true, "opportunities_enabled": true, "cooldown_days": 30, "privacy_notice": "O Zuma Cozinha Oriental utiliza seus dados e preferências exclusivamente para agilizar seus pedidos e personalizar sua experiência gastronômica."}, "handoff": {"attendant_phone": "5565998001447", "sales_phone": "5565998001447", "notify_email": "contato@zumacozinhaoriental.com.br"}, "regras_operacionais": {"tempo_estimado_entrega_min": 35, "tempo_estimado_entrega_max": 50, "tempo_retirada_min": 20, "taxa_entrega_padrao": 12.0, "kit_padrao": "1 kit por pedido (2 hashis, sachê de tarê, sachê de shoyu tradicional e shoyu light)", "politica_alteracoes": "Para preservar o equilíbrio e padrão do sushiman, os combinados e pratos não sofrem alterações de peças."}}$WHATS$::jsonb,
    NOW(),
    NOW()
  );

  -- 6. USUÁRIOS E EQUIPE DO ZUMA
  IF NOT EXISTS (SELECT 1 FROM usuarios WHERE lower(email) = 'leandro@zumacozinhaoriental.com.br') THEN
    INSERT INTO usuarios (id, email, senha_hash, nome_completo, role, empresa_id, ativo, data_criacao, data_atualizacao)
    VALUES (gen_random_uuid(), 'leandro@zumacozinhaoriental.com.br', '$2a$10$GhTXS1zakV8wRo77OFp2JOvCJj9ezTUPg75ZbBupWek/RBR/.SHcq', 'Leandro (Proprietário Zuma)', 'gerente', 'c3c3ac01-8e50-4b61-8c79-de4aaa916da3', true, NOW(), NOW());
  ELSE
    UPDATE usuarios SET empresa_id = 'c3c3ac01-8e50-4b61-8c79-de4aaa916da3', role = 'gerente', ativo = true, data_atualizacao = NOW()
    WHERE lower(email) = 'leandro@zumacozinhaoriental.com.br';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM usuarios WHERE lower(email) = 'jessica@zumacozinhaoriental.com.br') THEN
    INSERT INTO usuarios (id, email, senha_hash, nome_completo, role, empresa_id, ativo, data_criacao, data_atualizacao)
    VALUES (gen_random_uuid(), 'jessica@zumacozinhaoriental.com.br', '$2a$10$GhTXS1zakV8wRo77OFp2JOvCJj9ezTUPg75ZbBupWek/RBR/.SHcq', 'Jessica (Proprietária Zuma)', 'gerente', 'c3c3ac01-8e50-4b61-8c79-de4aaa916da3', true, NOW(), NOW());
  ELSE
    UPDATE usuarios SET empresa_id = 'c3c3ac01-8e50-4b61-8c79-de4aaa916da3', role = 'gerente', ativo = true, data_atualizacao = NOW()
    WHERE lower(email) = 'jessica@zumacozinhaoriental.com.br';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM usuarios WHERE lower(email) = 'chef@zumacozinhaoriental.com.br') THEN
    INSERT INTO usuarios (id, email, senha_hash, nome_completo, role, empresa_id, ativo, data_criacao, data_atualizacao)
    VALUES (gen_random_uuid(), 'chef@zumacozinhaoriental.com.br', '$2a$10$GhTXS1zakV8wRo77OFp2JOvCJj9ezTUPg75ZbBupWek/RBR/.SHcq', 'Chef Sushiman Zuma', 'operador', 'c3c3ac01-8e50-4b61-8c79-de4aaa916da3', true, NOW(), NOW());
  ELSE
    UPDATE usuarios SET empresa_id = 'c3c3ac01-8e50-4b61-8c79-de4aaa916da3', role = 'operador', ativo = true, data_atualizacao = NOW()
    WHERE lower(email) = 'chef@zumacozinhaoriental.com.br';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM usuarios WHERE lower(email) = 'atendimento@zumacozinhaoriental.com.br') THEN
    INSERT INTO usuarios (id, email, senha_hash, nome_completo, role, empresa_id, ativo, data_criacao, data_atualizacao)
    VALUES (gen_random_uuid(), 'atendimento@zumacozinhaoriental.com.br', '$2a$10$GhTXS1zakV8wRo77OFp2JOvCJj9ezTUPg75ZbBupWek/RBR/.SHcq', 'Atendimento & Delivery Zuma', 'operador', 'c3c3ac01-8e50-4b61-8c79-de4aaa916da3', true, NOW(), NOW());
  ELSE
    UPDATE usuarios SET empresa_id = 'c3c3ac01-8e50-4b61-8c79-de4aaa916da3', role = 'operador', ativo = true, data_atualizacao = NOW()
    WHERE lower(email) = 'atendimento@zumacozinhaoriental.com.br';
  END IF;

  PERFORM 1;
END $$;

-- 7. INSERÇÃO DOS 211 PRODUTOS NO BAR_PRODUTOS (COMANDAS, SALÃO E KDS)
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Promo Combo Grelhado',
  'PROMOÇÕES',
  'cozinha',
  82.0,
  'un',
  1,
  50,
  5,
  1,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Promo Risoto de Salmão',
  'PROMOÇÕES',
  'cozinha',
  65.0,
  'un',
  1,
  50,
  5,
  2,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Tarê da casa',
  'ADICIONAIS',
  'balcao',
  4.0,
  'un',
  1,
  50,
  5,
  3,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Gengibre',
  'ADICIONAIS',
  'balcao',
  4.0,
  'un',
  1,
  50,
  5,
  4,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Wasabi',
  'ADICIONAIS',
  'balcao',
  4.0,
  'un',
  1,
  50,
  5,
  5,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Doritos',
  'ADICIONAIS',
  'balcao',
  4.0,
  'un',
  1,
  50,
  5,
  6,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Geleia',
  'ADICIONAIS',
  'balcao',
  4.0,
  'un',
  1,
  50,
  5,
  7,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Crispy',
  'ADICIONAIS',
  'balcao',
  3.0,
  'un',
  1,
  50,
  5,
  8,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Creme Cheese',
  'ADICIONAIS',
  'balcao',
  5.0,
  'un',
  1,
  50,
  5,
  9,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Limão',
  'ADICIONAIS',
  'balcao',
  2.0,
  'un',
  1,
  50,
  5,
  10,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Sache de Shoyu  Tradicional 8ml',
  'ADICIONAIS',
  'balcao',
  0.5,
  'un',
  1,
  50,
  5,
  11,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Sache de Shoyu Light 8ml',
  'ADICIONAIS',
  'balcao',
  0.5,
  'un',
  1,
  50,
  5,
  12,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Adaptador para hashi',
  'ADAPTADOR',
  'balcao',
  2.0,
  'un',
  1,
  50,
  5,
  13,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Camarão Alho e Azeite',
  'ENTRADAS',
  'cozinha',
  100.0,
  'un',
  1,
  50,
  5,
  14,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Carpaccio De Salmão',
  'ENTRADAS',
  'cozinha',
  47.0,
  'un',
  1,
  50,
  5,
  15,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Carpacio Maçaricado',
  'ENTRADAS',
  'cozinha',
  60.0,
  'un',
  1,
  50,
  5,
  16,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Ceviche Peruano ( 300g )',
  'ENTRADAS',
  'cozinha',
  54.9,
  'un',
  1,
  50,
  5,
  17,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Furai De Camarão ( 15 Unidades )',
  'ENTRADAS',
  'cozinha',
  120.0,
  'un',
  1,
  50,
  5,
  18,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Furai De Frango ( 300g )',
  'ENTRADAS',
  'cozinha',
  44.9,
  'un',
  1,
  50,
  5,
  19,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Furai De Mignon ( 300g )',
  'ENTRADAS',
  'cozinha',
  54.9,
  'un',
  1,
  50,
  5,
  20,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Furai De Salmão ( 300g )',
  'ENTRADAS',
  'cozinha',
  59.9,
  'un',
  1,
  50,
  5,
  21,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Furai De Tilápia ( 300g )',
  'ENTRADAS',
  'cozinha',
  60.0,
  'un',
  1,
  50,
  5,
  22,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Gohan Branco',
  'ENTRADAS',
  'cozinha',
  14.9,
  'un',
  1,
  50,
  5,
  23,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Lula Crocante (300g)',
  'ENTRADAS',
  'cozinha',
  49.9,
  'un',
  1,
  50,
  5,
  24,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Nuggets De Salmão ( 5 Unidades )',
  'ENTRADAS',
  'cozinha',
  50.0,
  'un',
  1,
  50,
  5,
  25,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Rolinho De Salmão Empanado ( 8 Unidades )',
  'ENTRADAS',
  'cozinha',
  70.0,
  'un',
  1,
  50,
  5,
  26,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Rolinho De Salmão Maçaricaco ( 8 Unidades )',
  'ENTRADAS',
  'cozinha',
  60.0,
  'un',
  1,
  50,
  5,
  27,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Rolinho De Salmão Skin Maçaricado ( 8 Unidades )',
  'ENTRADAS',
  'cozinha',
  65.0,
  'un',
  1,
  50,
  5,
  28,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Rolinho Ebi Empanado ( 8 Unidades )',
  'ENTRADAS',
  'cozinha',
  79.9,
  'un',
  1,
  50,
  5,
  29,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Rolinho Ebi Maçaricado ( 8 Unidades )',
  'ENTRADAS',
  'cozinha',
  69.9,
  'un',
  1,
  50,
  5,
  30,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Rolinho Primavera de Legumes  ( 2 Unidades )',
  'ENTRADAS',
  'cozinha',
  33.0,
  'un',
  1,
  50,
  5,
  31,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Rolinho Skin Empanado ( 8 Unidades )',
  'ENTRADAS',
  'cozinha',
  65.9,
  'un',
  1,
  50,
  5,
  32,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Sunomono',
  'ENTRADAS',
  'cozinha',
  16.0,
  'un',
  1,
  50,
  5,
  33,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Trouxinha De Camarão (6 Unidades)',
  'ENTRADAS',
  'cozinha',
  70.0,
  'un',
  1,
  50,
  5,
  34,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Usuzukuri De Salmão',
  'ENTRADAS',
  'cozinha',
  110.0,
  'un',
  1,
  50,
  5,
  35,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Ceviche Especial ( 300g )',
  'ENTRADAS',
  'cozinha',
  70.0,
  'un',
  1,
  50,
  5,
  36,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Rolinho Light ( 8 Unidades )',
  'ENTRADAS',
  'cozinha',
  75.0,
  'un',
  1,
  50,
  5,
  37,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Usuzukuri Trufado',
  'ENTRADAS',
  'cozinha',
  115.0,
  'un',
  1,
  50,
  5,
  38,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Trouxinha de Camarão ( 3 Unidades )',
  'ENTRADAS',
  'cozinha',
  45.0,
  'un',
  1,
  50,
  5,
  39,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Salada Italiana',
  'ENTRADAS',
  'cozinha',
  59.9,
  'un',
  1,
  50,
  5,
  40,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Camarão Zuma (serve 2 pessoas)',
  'ENTRADAS',
  'cozinha',
  180.0,
  'un',
  1,
  50,
  5,
  41,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Pipoca de Camarão Spyce',
  'ENTRADAS',
  'cozinha',
  100.0,
  'un',
  1,
  50,
  5,
  42,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Guioza Suína 6un',
  'ENTRADAS',
  'cozinha',
  35.0,
  'un',
  1,
  50,
  5,
  43,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Camarão Atlântico',
  'ENTRADAS',
  'cozinha',
  89.9,
  'un',
  1,
  50,
  5,
  44,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Rolinho Primavera  Frango com Legumes ( 2 Unidades )',
  'ENTRADAS',
  'cozinha',
  33.0,
  'un',
  1,
  50,
  5,
  45,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Rolinho De Salmão Empanado ( 4 Unidades )',
  'ENTRADAS',
  'cozinha',
  45.0,
  'un',
  1,
  50,
  5,
  46,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Tubo Hossomaki  Salmão',
  'SUSHI NO TUBO',
  'sushi_bar',
  52.9,
  'un',
  1,
  50,
  5,
  47,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Tubo Hossomaki  Filadélfia',
  'SUSHI NO TUBO',
  'sushi_bar',
  54.9,
  'un',
  1,
  50,
  5,
  48,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Tubo Hossomaki  Salmão Grelhado',
  'SUSHI NO TUBO',
  'sushi_bar',
  49.9,
  'un',
  1,
  50,
  5,
  49,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Tubo Hot Filadélfia',
  'SUSHI NO TUBO',
  'sushi_bar',
  53.9,
  'un',
  1,
  50,
  5,
  50,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Tubo Uramaki Filadélfia',
  'SUSHI NO TUBO',
  'sushi_bar',
  58.9,
  'un',
  1,
  50,
  5,
  51,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Tubo Uramaki Lemon',
  'SUSHI NO TUBO',
  'sushi_bar',
  59.9,
  'un',
  1,
  50,
  5,
  52,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Tubo Uramaki Salmão',
  'SUSHI NO TUBO',
  'sushi_bar',
  56.9,
  'un',
  1,
  50,
  5,
  53,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Tubo Uramaki Salmão Grelhado',
  'SUSHI NO TUBO',
  'sushi_bar',
  52.9,
  'un',
  1,
  50,
  5,
  54,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Combo 18 peças',
  'COMBINADOS',
  'sushi_bar',
  86.0,
  'un',
  1,
  50,
  5,
  55,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Combo 26 Peças',
  'COMBINADOS',
  'sushi_bar',
  99.9,
  'un',
  1,
  50,
  5,
  56,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Combo 56 Peças',
  'COMBINADOS',
  'sushi_bar',
  250.0,
  'un',
  1,
  50,
  5,
  57,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Combo Mix',
  'COMBINADOS',
  'sushi_bar',
  159.0,
  'un',
  1,
  50,
  5,
  58,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Especial 30 Peças',
  'COMBINADOS',
  'sushi_bar',
  160.0,
  'un',
  1,
  50,
  5,
  59,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Especial Zuma 68 Peças',
  'COMBINADOS',
  'sushi_bar',
  300.0,
  'un',
  1,
  50,
  5,
  60,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Especial da Casa 40 Peças',
  'COMBINADOS',
  'sushi_bar',
  140.0,
  'un',
  1,
  50,
  5,
  61,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Especial do Cheff 106 Peças',
  'COMBINADOS',
  'sushi_bar',
  440.0,
  'un',
  1,
  50,
  5,
  62,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Fit 22 Peças',
  'COMBINADOS',
  'sushi_bar',
  140.0,
  'un',
  1,
  50,
  5,
  63,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Oriental 21 Peças',
  'COMBINADOS',
  'sushi_bar',
  99.9,
  'un',
  1,
  50,
  5,
  64,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Combo 14 peças',
  'COMBINADOS',
  'sushi_bar',
  82.0,
  'un',
  1,
  50,
  5,
  65,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Combo 12 peças',
  'COMBINADOS',
  'sushi_bar',
  60.0,
  'un',
  1,
  50,
  5,
  66,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Combo Nakato',
  'COMBINADOS',
  'sushi_bar',
  275.0,
  'un',
  1,
  50,
  5,
  67,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Oriental 20 Peças',
  'COMBINADOS',
  'sushi_bar',
  88.0,
  'un',
  1,
  50,
  5,
  68,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Combo Gestante (100% grelhados e fritos)',
  'COMBINADOS',
  'sushi_bar',
  230.0,
  'un',
  1,
  50,
  5,
  69,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Uramaki Cheddar (8un)',
  'URAMAKI''S',
  'sushi_bar',
  40.0,
  'un',
  1,
  50,
  5,
  70,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Uramaki California Kani (8un)',
  'URAMAKI''S',
  'sushi_bar',
  34.0,
  'un',
  1,
  50,
  5,
  71,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Uramaki California Salmão (8un)',
  'URAMAKI''S',
  'sushi_bar',
  35.0,
  'un',
  1,
  50,
  5,
  72,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Uramaki Camarão Cozido (8un)',
  'URAMAKI''S',
  'sushi_bar',
  56.0,
  'un',
  1,
  50,
  5,
  73,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Uramaki Camarão Furai (8un)',
  'URAMAKI''S',
  'sushi_bar',
  58.0,
  'un',
  1,
  50,
  5,
  74,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Uramaki Damasco (8un)',
  'URAMAKI''S',
  'sushi_bar',
  50.0,
  'un',
  1,
  50,
  5,
  75,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Uramaki Do Cheff (8un)',
  'URAMAKI''S',
  'sushi_bar',
  47.0,
  'un',
  1,
  50,
  5,
  76,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Uramaki Ebi Tem (8un)',
  'URAMAKI''S',
  'sushi_bar',
  57.0,
  'un',
  1,
  50,
  5,
  77,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Uramaki Filadélfia (8un)',
  'URAMAKI''S',
  'sushi_bar',
  44.0,
  'un',
  1,
  50,
  5,
  78,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Uramaki Fry Special (8un)',
  'URAMAKI''S',
  'sushi_bar',
  54.0,
  'un',
  1,
  50,
  5,
  79,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Uramaki Futomaki (8un)',
  'URAMAKI''S',
  'sushi_bar',
  45.0,
  'un',
  1,
  50,
  5,
  80,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Uramaki Kani (8un)',
  'URAMAKI''S',
  'sushi_bar',
  28.0,
  'un',
  1,
  50,
  5,
  81,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Uramaki Kani Kama (8un)',
  'URAMAKI''S',
  'sushi_bar',
  29.0,
  'un',
  1,
  50,
  5,
  82,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Uramaki Kapa Maki (8un)',
  'URAMAKI''S',
  'sushi_bar',
  28.0,
  'un',
  1,
  50,
  5,
  83,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Uramaki Lemon (8un)',
  'URAMAKI''S',
  'sushi_bar',
  44.9,
  'un',
  1,
  50,
  5,
  84,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Uramaki Mexicano (8un)',
  'URAMAKI''S',
  'sushi_bar',
  45.0,
  'un',
  1,
  50,
  5,
  85,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Uramaki Salmão (8un)',
  'URAMAKI''S',
  'sushi_bar',
  42.0,
  'un',
  1,
  50,
  5,
  86,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Uramaki Salmão Avocado (8un)',
  'URAMAKI''S',
  'sushi_bar',
  45.0,
  'un',
  1,
  50,
  5,
  87,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Uramaki Salmão Especial (8un)',
  'URAMAKI''S',
  'sushi_bar',
  57.0,
  'un',
  1,
  50,
  5,
  88,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Uramaki Salmão Furai (8un)',
  'URAMAKI''S',
  'sushi_bar',
  40.0,
  'un',
  1,
  50,
  5,
  89,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Uramaki Salmão Grelhado (8un)',
  'URAMAKI''S',
  'sushi_bar',
  38.0,
  'un',
  1,
  50,
  5,
  90,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Uramaki Salmão Spicy (8un)',
  'URAMAKI''S',
  'sushi_bar',
  55.0,
  'un',
  1,
  50,
  5,
  91,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Uramaki Shake Fry (8un)',
  'URAMAKI''S',
  'sushi_bar',
  45.0,
  'un',
  1,
  50,
  5,
  92,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Uramaki Skin (8un)',
  'URAMAKI''S',
  'sushi_bar',
  30.0,
  'un',
  1,
  50,
  5,
  93,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Uramaki Skin Salmão (8un)',
  'URAMAKI''S',
  'sushi_bar',
  44.9,
  'un',
  1,
  50,
  5,
  94,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Uramaki Spicy Tuna (8un)',
  'URAMAKI''S',
  'sushi_bar',
  54.0,
  'un',
  1,
  50,
  5,
  95,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Uramaki Vegetariano (8un)',
  'URAMAKI''S',
  'sushi_bar',
  30.0,
  'un',
  1,
  50,
  5,
  96,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Uramaki Zuma Especial (8un)',
  'URAMAKI''S',
  'sushi_bar',
  60.0,
  'un',
  1,
  50,
  5,
  97,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Uramaki Lemon Camarão (8un)',
  'URAMAKI''S',
  'sushi_bar',
  65.0,
  'un',
  1,
  50,
  5,
  98,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Uramaki Filadélfia Laminado (8un)',
  'URAMAKI''S',
  'sushi_bar',
  58.0,
  'un',
  1,
  50,
  5,
  99,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Uramaki Skin Especial (8un)',
  'URAMAKI''S',
  'sushi_bar',
  60.0,
  'un',
  1,
  50,
  5,
  100,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Hossomaki California Kani 8 Un',
  'HOSSOMAKI''S',
  'sushi_bar',
  38.0,
  'un',
  1,
  50,
  5,
  101,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Hossomaki California Salmão 8 Un',
  'HOSSOMAKI''S',
  'sushi_bar',
  40.0,
  'un',
  1,
  50,
  5,
  102,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Hossomaki Camarão Furai 8 Un',
  'HOSSOMAKI''S',
  'sushi_bar',
  58.0,
  'un',
  1,
  50,
  5,
  103,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Hossomaki Especial ( sem arroz) 8 Un',
  'HOSSOMAKI''S',
  'sushi_bar',
  59.9,
  'un',
  1,
  50,
  5,
  104,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Hossomaki Especial Do Cheff 8 Un',
  'HOSSOMAKI''S',
  'sushi_bar',
  45.0,
  'un',
  1,
  50,
  5,
  105,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Hossomaki Filadélfia 8 Un',
  'HOSSOMAKI''S',
  'sushi_bar',
  39.0,
  'un',
  1,
  50,
  5,
  106,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Hossomaki Salmão 8 Un',
  'HOSSOMAKI''S',
  'sushi_bar',
  37.0,
  'un',
  1,
  50,
  5,
  107,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Hossomaki Salmão Cheddar 8 Un',
  'HOSSOMAKI''S',
  'sushi_bar',
  38.9,
  'un',
  1,
  50,
  5,
  108,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Hossomaki Salmão Grelhado 8 Un',
  'HOSSOMAKI''S',
  'sushi_bar',
  35.0,
  'un',
  1,
  50,
  5,
  109,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Hossomaki Skin 8 Un',
  'HOSSOMAKI''S',
  'sushi_bar',
  30.0,
  'un',
  1,
  50,
  5,
  110,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Hossomaki Vegetariano 8 Un',
  'HOSSOMAKI''S',
  'sushi_bar',
  30.0,
  'un',
  1,
  50,
  5,
  111,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Salmão Fresco  12 Fatias',
  'SASHIMI''S DE SALMÃO',
  'sushi_bar',
  59.9,
  'un',
  1,
  50,
  5,
  112,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Salmão Fresco  24 Fatias',
  'SASHIMI''S DE SALMÃO',
  'sushi_bar',
  110.0,
  'un',
  1,
  50,
  5,
  113,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Salmão Fresco  36 Fatias',
  'SASHIMI''S DE SALMÃO',
  'sushi_bar',
  165.9,
  'un',
  1,
  50,
  5,
  114,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Salmão Fresco  6 Fatias',
  'SASHIMI''S DE SALMÃO',
  'sushi_bar',
  37.9,
  'un',
  1,
  50,
  5,
  115,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Salmão Fresco  8 Fatias',
  'SASHIMI''S DE SALMÃO',
  'sushi_bar',
  54.9,
  'un',
  1,
  50,
  5,
  116,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Sashimi Sweet (8 fatias)',
  'SASHIMI''S DE SALMÃO',
  'sushi_bar',
  59.99,
  'un',
  1,
  50,
  5,
  117,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Salmão Tataki',
  'SALMÃO TATAKI',
  'sushi_bar',
  65.0,
  'un',
  1,
  50,
  5,
  118,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Gunkan Especial Ebi (2un)',
  'GUNKAN''S',
  'sushi_bar',
  31.0,
  'un',
  1,
  50,
  5,
  119,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Gunkan Batéra (2un)',
  'GUNKAN''S',
  'sushi_bar',
  19.9,
  'un',
  1,
  50,
  5,
  120,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Gunkan Pepino (2un)',
  'GUNKAN''S',
  'sushi_bar',
  19.9,
  'un',
  1,
  50,
  5,
  121,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Gunkan Salmão (2un)',
  'GUNKAN''S',
  'sushi_bar',
  24.0,
  'un',
  1,
  50,
  5,
  122,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Gunkan Zuma (2un)',
  'GUNKAN''S',
  'sushi_bar',
  27.0,
  'un',
  1,
  50,
  5,
  123,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Gunkan Especial do Cheff (6un)',
  'GUNKAN''S',
  'sushi_bar',
  69.9,
  'un',
  1,
  50,
  5,
  124,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Gunkan Camarão Furai (2un)',
  'GUNKAN''S',
  'sushi_bar',
  29.0,
  'un',
  1,
  50,
  5,
  125,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Gunkan Geleia (2un)',
  'GUNKAN''S',
  'sushi_bar',
  24.0,
  'un',
  1,
  50,
  5,
  126,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Niguiri Ebi Furai (2un)',
  'NIGIRISUSHI''S',
  'sushi_bar',
  26.9,
  'un',
  1,
  50,
  5,
  127,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Niguiri Kani Kama (2un)',
  'NIGIRISUSHI''S',
  'sushi_bar',
  19.9,
  'un',
  1,
  50,
  5,
  128,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Niguiri Salmão (2un)',
  'NIGIRISUSHI''S',
  'sushi_bar',
  20.0,
  'un',
  1,
  50,
  5,
  129,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Niguiri Salmão Flambado (2un)',
  'NIGIRISUSHI''S',
  'sushi_bar',
  25.0,
  'un',
  1,
  50,
  5,
  130,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Niguiri Salmão Furai',
  'NIGIRISUSHI''S',
  'sushi_bar',
  26.9,
  'un',
  1,
  50,
  5,
  131,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Niguiri Salmão Lemom (2un)',
  'NIGIRISUSHI''S',
  'sushi_bar',
  25.0,
  'un',
  1,
  50,
  5,
  132,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Niguiri Skin (2un)',
  'NIGIRISUSHI''S',
  'sushi_bar',
  21.9,
  'un',
  1,
  50,
  5,
  133,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Niguiri De Brie Com Mel Trufado (2 unidade)',
  'NIGIRISUSHI''S',
  'sushi_bar',
  27.0,
  'un',
  1,
  50,
  5,
  134,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Poke Clássico de Salmão',
  'POKE',
  'sushi_bar',
  58.0,
  'un',
  1,
  50,
  5,
  135,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Poke Havaiano',
  'POKE',
  'sushi_bar',
  57.0,
  'un',
  1,
  50,
  5,
  136,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Poke de Salmão',
  'POKE',
  'sushi_bar',
  55.0,
  'un',
  1,
  50,
  5,
  137,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Poke de Camarão',
  'POKE',
  'sushi_bar',
  75.0,
  'un',
  1,
  50,
  5,
  138,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Poke sem arroz',
  'POKE',
  'sushi_bar',
  72.0,
  'un',
  1,
  50,
  5,
  139,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Poke Vegetariano',
  'POKE',
  'sushi_bar',
  50.0,
  'un',
  1,
  50,
  5,
  140,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Temaki Damasco',
  'TEMAKI''S',
  'sushi_bar',
  44.0,
  'un',
  1,
  50,
  5,
  141,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Temaki Ebi',
  'TEMAKI''S',
  'sushi_bar',
  55.9,
  'un',
  1,
  50,
  5,
  142,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Temaki Futomaki',
  'TEMAKI''S',
  'sushi_bar',
  35.0,
  'un',
  1,
  50,
  5,
  143,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Temaki Mexicano',
  'TEMAKI''S',
  'sushi_bar',
  42.0,
  'un',
  1,
  50,
  5,
  144,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Temaki Salmão',
  'TEMAKI''S',
  'sushi_bar',
  39.9,
  'un',
  1,
  50,
  5,
  145,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Temaki Salmão Filadélfia',
  'TEMAKI''S',
  'sushi_bar',
  42.0,
  'un',
  1,
  50,
  5,
  146,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Temaki Salmão dinamite',
  'TEMAKI''S',
  'sushi_bar',
  45.0,
  'un',
  1,
  50,
  5,
  147,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Temaki Salmão grelhado',
  'TEMAKI''S',
  'sushi_bar',
  36.0,
  'un',
  1,
  50,
  5,
  148,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Temaki Salmão nuggets',
  'TEMAKI''S',
  'sushi_bar',
  45.9,
  'un',
  1,
  50,
  5,
  149,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Temaki Skin salmão',
  'TEMAKI''S',
  'sushi_bar',
  37.0,
  'un',
  1,
  50,
  5,
  150,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Temaki ceviche',
  'TEMAKI''S',
  'sushi_bar',
  50.0,
  'un',
  1,
  50,
  5,
  151,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Temaki hot',
  'TEMAKI''S',
  'sushi_bar',
  38.0,
  'un',
  1,
  50,
  5,
  152,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Temaki sem Arroz',
  'TEMAKI''S',
  'sushi_bar',
  52.9,
  'un',
  1,
  50,
  5,
  153,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Temaki skin',
  'TEMAKI''S',
  'sushi_bar',
  35.0,
  'un',
  1,
  50,
  5,
  154,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Temaki Avocado',
  'TEMAKI''S',
  'sushi_bar',
  42.0,
  'un',
  1,
  50,
  5,
  155,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Temaki Cheddar',
  'TEMAKI''S',
  'sushi_bar',
  40.0,
  'un',
  1,
  50,
  5,
  156,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Hotdog Mexicano',
  'HOTDOG SUSHI',
  'cozinha',
  48.0,
  'un',
  1,
  50,
  5,
  157,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Hotdog Filadélfia',
  'HOTDOG SUSHI',
  'cozinha',
  49.0,
  'un',
  1,
  50,
  5,
  158,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Hotdog Salmão Grelhado',
  'HOTDOG SUSHI',
  'cozinha',
  42.0,
  'un',
  1,
  50,
  5,
  159,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Hotdog Camarão Cozido',
  'HOTDOG SUSHI',
  'cozinha',
  55.0,
  'un',
  1,
  50,
  5,
  160,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Hotdog Camarão Furai',
  'HOTDOG SUSHI',
  'cozinha',
  60.0,
  'un',
  1,
  50,
  5,
  161,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Hotdog Salmão',
  'HOTDOG SUSHI',
  'cozinha',
  45.0,
  'un',
  1,
  50,
  5,
  162,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Hotdog Avocado',
  'HOTDOG SUSHI',
  'cozinha',
  50.0,
  'un',
  1,
  50,
  5,
  163,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Hot Camarão (8un)',
  'HOT ROLL''S',
  'cozinha',
  60.0,
  'un',
  1,
  50,
  5,
  164,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Hot Cheddar (8 un)',
  'HOT ROLL''S',
  'cozinha',
  40.0,
  'un',
  1,
  50,
  5,
  165,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Hot Filadélfia (12un)',
  'HOT ROLL''S',
  'cozinha',
  38.9,
  'un',
  1,
  50,
  5,
  166,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Hot Sakura (8 un)',
  'HOT ROLL''S',
  'cozinha',
  40.0,
  'un',
  1,
  50,
  5,
  167,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Hot Sem Arroz (8 un)',
  'HOT ROLL''S',
  'cozinha',
  55.0,
  'un',
  1,
  50,
  5,
  168,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Hot Zuma (8un)',
  'HOT ROLL''S',
  'cozinha',
  65.0,
  'un',
  1,
  50,
  5,
  169,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Hot do Cheff (12 un)',
  'HOT ROLL''S',
  'cozinha',
  42.0,
  'un',
  1,
  50,
  5,
  170,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Hot Nachos (8 unidades)',
  'HOT ROLL''S',
  'cozinha',
  59.0,
  'un',
  1,
  50,
  5,
  171,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Hot Holl Skin',
  'HOT ROLL''S',
  'cozinha',
  38.0,
  'un',
  1,
  50,
  5,
  172,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Sobá de Mignon',
  'SOBÁ',
  'cozinha',
  42.0,
  'un',
  1,
  50,
  5,
  173,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Sobá de Frango',
  'SOBÁ',
  'cozinha',
  35.0,
  'un',
  1,
  50,
  5,
  174,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Teppan de Peixe Branco',
  'TEPPAN''S',
  'cozinha',
  57.0,
  'un',
  1,
  50,
  5,
  175,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Teppan de Camarão',
  'TEPPAN''S',
  'cozinha',
  78.0,
  'un',
  1,
  50,
  5,
  176,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Teppan de Frango',
  'TEPPAN''S',
  'cozinha',
  45.0,
  'un',
  1,
  50,
  5,
  177,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Teppan de Mignon',
  'TEPPAN''S',
  'cozinha',
  55.0,
  'un',
  1,
  50,
  5,
  178,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Teppan de Salmão',
  'TEPPAN''S',
  'cozinha',
  62.0,
  'un',
  1,
  50,
  5,
  179,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Yakissoba Misto',
  'YAKISSOBA',
  'cozinha',
  44.0,
  'un',
  1,
  50,
  5,
  180,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Yakissoba Vegetariano',
  'YAKISSOBA',
  'cozinha',
  35.0,
  'un',
  1,
  50,
  5,
  181,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Yakissoba de Camarão',
  'YAKISSOBA',
  'cozinha',
  59.9,
  'un',
  1,
  50,
  5,
  182,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Yakissoba de Frango',
  'YAKISSOBA',
  'cozinha',
  36.9,
  'un',
  1,
  50,
  5,
  183,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Yakissoba de Mignon',
  'YAKISSOBA',
  'cozinha',
  48.9,
  'un',
  1,
  50,
  5,
  184,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Risoto de Camarão',
  'RISOTO',
  'cozinha',
  68.9,
  'un',
  1,
  50,
  5,
  185,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Risoto de Mignon',
  'RISOTO',
  'cozinha',
  57.9,
  'un',
  1,
  50,
  5,
  186,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Risoto de Camarão e Anéis de Lula',
  'RISOTO',
  'cozinha',
  66.0,
  'un',
  1,
  50,
  5,
  187,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Risoto de salmão com brócolis',
  'RISOTO',
  'cozinha',
  54.9,
  'un',
  1,
  50,
  5,
  188,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Risoto de File com tomate seco e rúcula',
  'RISOTO',
  'cozinha',
  55.0,
  'un',
  1,
  50,
  5,
  189,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Camarão Zuma (server 2 pessoas)',
  'RISOTO',
  'cozinha',
  180.0,
  'un',
  1,
  50,
  5,
  190,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Batata Frita (400g)',
  'PORÇÕES',
  'cozinha',
  27.0,
  'un',
  1,
  50,
  5,
  191,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Batata Frita (800g)',
  'PORÇÕES',
  'cozinha',
  45.0,
  'un',
  1,
  50,
  5,
  192,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Bolinho de Carne',
  'PORÇÕES',
  'cozinha',
  60.0,
  'un',
  1,
  50,
  5,
  193,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Frango Xadrez',
  'PORÇÕES',
  'cozinha',
  39.0,
  'un',
  1,
  50,
  5,
  194,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Batata especial 400 GR',
  'PORÇÕES',
  'cozinha',
  40.0,
  'un',
  1,
  50,
  5,
  195,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Croquete de Salmão (8un)',
  'PORÇÕES',
  'cozinha',
  49.0,
  'un',
  1,
  50,
  5,
  196,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Filé Acebolado com batata frita',
  'PORÇÕES',
  'cozinha',
  69.0,
  'un',
  1,
  50,
  5,
  197,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Kid''s Frango (100gr)',
  'PORÇÕES',
  'cozinha',
  37.0,
  'un',
  1,
  50,
  5,
  198,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Kid''s Filézinho (100gr)',
  'PORÇÕES',
  'cozinha',
  39.0,
  'un',
  1,
  50,
  5,
  199,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Hot Banana com Morango  (8 un)',
  'SOBREMESAS',
  'cozinha',
  36.0,
  'un',
  1,
  50,
  5,
  200,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Hot Nutella (8 un)',
  'SOBREMESAS',
  'cozinha',
  39.0,
  'un',
  1,
  50,
  5,
  201,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Hot Romeu e Julieta (8 un)',
  'SOBREMESAS',
  'cozinha',
  32.0,
  'un',
  1,
  50,
  5,
  202,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Hot Sonho de Valsa (8 un)',
  'SOBREMESAS',
  'cozinha',
  39.9,
  'un',
  1,
  50,
  5,
  203,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Rolinho Primavera de Queijo com Goiabada',
  'SOBREMESAS',
  'cozinha',
  33.0,
  'un',
  1,
  50,
  5,
  204,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Refrigerante Lata',
  'BEBIDAS',
  'bar',
  0.0,
  'un',
  1,
  50,
  5,
  205,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Sucos de Polpa',
  'BEBIDAS',
  'bar',
  14.0,
  'un',
  1,
  50,
  5,
  206,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Refrigerantes em PET',
  'BEBIDAS',
  'bar',
  0.0,
  'un',
  1,
  50,
  5,
  207,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Cerveja Long Neck',
  'BEBIDAS',
  'bar',
  0.0,
  'un',
  1,
  50,
  5,
  208,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Sucos Naturais',
  'BEBIDAS',
  'bar',
  14.0,
  'un',
  1,
  50,
  5,
  209,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Águas',
  'BEBIDAS',
  'bar',
  0.0,
  'un',
  1,
  50,
  5,
  210,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();
INSERT INTO bar_produtos (
  empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo, criado_em, atualizado_em
) VALUES (
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Energéticos',
  'BEBIDAS',
  'bar',
  15.0,
  'un',
  1,
  50,
  5,
  211,
  true,
  NOW(),
  NOW()
) ON CONFLICT (empresa_id, nome) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  setor = EXCLUDED.setor,
  preco = EXCLUDED.preco,
  ordem = EXCLUDED.ordem,
  ativo = true,
  atualizado_em = NOW();

-- 8. CATEGORIAS DE E-COMMERCE
INSERT INTO commerce_categories (
  id, empresa_id, slug, nome, descricao, ativo, ordem, criado_em, atualizado_em
) VALUES (
  gen_random_uuid(),
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'promocoes',
  'PROMOÇÕES',
  'PROMOÇÕES',
  true,
  1,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;
INSERT INTO commerce_categories (
  id, empresa_id, slug, nome, descricao, ativo, ordem, criado_em, atualizado_em
) VALUES (
  gen_random_uuid(),
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'adicionais',
  'ADICIONAIS',
  'ADICIONAIS',
  true,
  2,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;
INSERT INTO commerce_categories (
  id, empresa_id, slug, nome, descricao, ativo, ordem, criado_em, atualizado_em
) VALUES (
  gen_random_uuid(),
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'adaptador',
  'ADAPTADOR',
  'ADAPTADOR',
  true,
  3,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;
INSERT INTO commerce_categories (
  id, empresa_id, slug, nome, descricao, ativo, ordem, criado_em, atualizado_em
) VALUES (
  gen_random_uuid(),
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'entradas',
  'ENTRADAS',
  'ENTRADAS',
  true,
  4,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;
INSERT INTO commerce_categories (
  id, empresa_id, slug, nome, descricao, ativo, ordem, criado_em, atualizado_em
) VALUES (
  gen_random_uuid(),
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'sushi-no-tubo',
  'SUSHI NO TUBO',
  'SUSHI NO TUBO',
  true,
  5,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;
INSERT INTO commerce_categories (
  id, empresa_id, slug, nome, descricao, ativo, ordem, criado_em, atualizado_em
) VALUES (
  gen_random_uuid(),
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'combinados',
  'COMBINADOS',
  'COMBINADOS',
  true,
  6,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;
INSERT INTO commerce_categories (
  id, empresa_id, slug, nome, descricao, ativo, ordem, criado_em, atualizado_em
) VALUES (
  gen_random_uuid(),
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'uramaki-s',
  'URAMAKI''S',
  'URAMAKI''S',
  true,
  7,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;
INSERT INTO commerce_categories (
  id, empresa_id, slug, nome, descricao, ativo, ordem, criado_em, atualizado_em
) VALUES (
  gen_random_uuid(),
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'hossomaki-s',
  'HOSSOMAKI''S',
  'HOSSOMAKI''S',
  true,
  8,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;
INSERT INTO commerce_categories (
  id, empresa_id, slug, nome, descricao, ativo, ordem, criado_em, atualizado_em
) VALUES (
  gen_random_uuid(),
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'sashimi-s-de-salmao',
  'SASHIMI''S DE SALMÃO',
  'SASHIMI''S DE SALMÃO',
  true,
  9,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;
INSERT INTO commerce_categories (
  id, empresa_id, slug, nome, descricao, ativo, ordem, criado_em, atualizado_em
) VALUES (
  gen_random_uuid(),
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'salmao-tataki',
  'SALMÃO TATAKI',
  'SALMÃO TATAKI',
  true,
  10,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;
INSERT INTO commerce_categories (
  id, empresa_id, slug, nome, descricao, ativo, ordem, criado_em, atualizado_em
) VALUES (
  gen_random_uuid(),
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'gunkan-s',
  'GUNKAN''S',
  'GUNKAN''S',
  true,
  11,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;
INSERT INTO commerce_categories (
  id, empresa_id, slug, nome, descricao, ativo, ordem, criado_em, atualizado_em
) VALUES (
  gen_random_uuid(),
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'nigirisushi-s',
  'NIGIRISUSHI''S',
  'NIGIRISUSHI''S',
  true,
  12,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;
INSERT INTO commerce_categories (
  id, empresa_id, slug, nome, descricao, ativo, ordem, criado_em, atualizado_em
) VALUES (
  gen_random_uuid(),
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'poke',
  'POKE',
  'POKE',
  true,
  13,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;
INSERT INTO commerce_categories (
  id, empresa_id, slug, nome, descricao, ativo, ordem, criado_em, atualizado_em
) VALUES (
  gen_random_uuid(),
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'temaki-s',
  'TEMAKI''S',
  'TEMAKI''S',
  true,
  14,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;
INSERT INTO commerce_categories (
  id, empresa_id, slug, nome, descricao, ativo, ordem, criado_em, atualizado_em
) VALUES (
  gen_random_uuid(),
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'hotdog-sushi',
  'HOTDOG SUSHI',
  'HOTDOG SUSHI',
  true,
  15,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;
INSERT INTO commerce_categories (
  id, empresa_id, slug, nome, descricao, ativo, ordem, criado_em, atualizado_em
) VALUES (
  gen_random_uuid(),
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'hot-roll-s',
  'HOT ROLL''S',
  'HOT ROLL''S',
  true,
  16,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;
INSERT INTO commerce_categories (
  id, empresa_id, slug, nome, descricao, ativo, ordem, criado_em, atualizado_em
) VALUES (
  gen_random_uuid(),
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'soba',
  'SOBÁ',
  'SOBÁ',
  true,
  17,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;
INSERT INTO commerce_categories (
  id, empresa_id, slug, nome, descricao, ativo, ordem, criado_em, atualizado_em
) VALUES (
  gen_random_uuid(),
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'teppan-s',
  'TEPPAN''S',
  'TEPPAN''S',
  true,
  18,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;
INSERT INTO commerce_categories (
  id, empresa_id, slug, nome, descricao, ativo, ordem, criado_em, atualizado_em
) VALUES (
  gen_random_uuid(),
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'yakissoba',
  'YAKISSOBA',
  'YAKISSOBA',
  true,
  19,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;
INSERT INTO commerce_categories (
  id, empresa_id, slug, nome, descricao, ativo, ordem, criado_em, atualizado_em
) VALUES (
  gen_random_uuid(),
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'risoto',
  'RISOTO',
  'RISOTO',
  true,
  20,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;
INSERT INTO commerce_categories (
  id, empresa_id, slug, nome, descricao, ativo, ordem, criado_em, atualizado_em
) VALUES (
  gen_random_uuid(),
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'porcoes',
  'PORÇÕES',
  'PORÇÕES',
  true,
  21,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;
INSERT INTO commerce_categories (
  id, empresa_id, slug, nome, descricao, ativo, ordem, criado_em, atualizado_em
) VALUES (
  gen_random_uuid(),
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'sobremesas',
  'SOBREMESAS',
  'SOBREMESAS',
  true,
  22,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;
INSERT INTO commerce_categories (
  id, empresa_id, slug, nome, descricao, ativo, ordem, criado_em, atualizado_em
) VALUES (
  gen_random_uuid(),
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'bebidas',
  'BEBIDAS',
  'BEBIDAS',
  true,
  23,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

-- 9. CLIENTES CRM E AI FACTS DO RESTAURANTE
INSERT INTO clientes (
  id, empresa_id, nome, email, telefone, cidade, uf, ativo, criado_em
) VALUES (
  gen_random_uuid(),
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Dr. Marcelo Takahashi',
  'marcelo.takahashi@hospitaltga.com.br',
  '(65) 99872-3311',
  'Tangará da Serra',
  'MT',
  true,
  NOW()
) ON CONFLICT DO NOTHING;
INSERT INTO clientes (
  id, empresa_id, nome, email, telefone, cidade, uf, ativo, criado_em
) VALUES (
  gen_random_uuid(),
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Dra. Camila Yoshimura',
  'camila@yoshimuraadv.com.br',
  '(65) 99912-8844',
  'Tangará da Serra',
  'MT',
  true,
  NOW()
) ON CONFLICT DO NOTHING;
INSERT INTO clientes (
  id, empresa_id, nome, email, telefone, cidade, uf, ativo, criado_em
) VALUES (
  gen_random_uuid(),
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Sr. Fábio Junqueira',
  'fabio.junqueira@agrovale.agr.br',
  '(65) 99655-4422',
  'Tangará da Serra',
  'MT',
  true,
  NOW()
) ON CONFLICT DO NOTHING;
INSERT INTO clientes (
  id, empresa_id, nome, email, telefone, cidade, uf, ativo, criado_em
) VALUES (
  gen_random_uuid(),
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Juliana Zanatta',
  'juliana@zanattadesign.com.br',
  '(65) 99801-7733',
  'Tangará da Serra',
  'MT',
  true,
  NOW()
) ON CONFLICT DO NOTHING;
INSERT INTO clientes (
  id, empresa_id, nome, email, telefone, cidade, uf, ativo, criado_em
) VALUES (
  gen_random_uuid(),
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Dra. Patrícia Alencar',
  'patricia.nutri@saude.med.br',
  '(65) 99933-2211',
  'Tangará da Serra',
  'MT',
  true,
  NOW()
) ON CONFLICT DO NOTHING;
INSERT INTO clientes (
  id, empresa_id, nome, email, telefone, cidade, uf, ativo, criado_em
) VALUES (
  gen_random_uuid(),
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Eng. Roberto Siqueira',
  'roberto.siqueira@agroconsult.com.br',
  '(65) 99611-9988',
  'Tangará da Serra',
  'MT',
  true,
  NOW()
) ON CONFLICT DO NOTHING;
INSERT INTO clientes (
  id, empresa_id, nome, email, telefone, cidade, uf, ativo, criado_em
) VALUES (
  gen_random_uuid(),
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  'Fernanda Guimarães',
  'fernanda.guimaraes@tgafitness.com.br',
  '(65) 99844-5566',
  'Tangará da Serra',
  'MT',
  true,
  NOW()
) ON CONFLICT DO NOTHING;
INSERT INTO ai_customer_facts (
  id, empresa_id, telefone, chave, valor, categoria, confianca, status, extraido_por, criado_em, atualizado_em
) VALUES (
  gen_random_uuid(),
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  '5565998723311',
  'prato_favorito',
  'Sashimi de Salmão Maçaricado Trufado',
  'preferencia_prato',
  0.95,
  'ativo',
  'KyttoIA 2.5 Flash',
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;
INSERT INTO ai_customer_facts (
  id, empresa_id, telefone, chave, valor, categoria, confianca, status, extraido_por, criado_em, atualizado_em
) VALUES (
  gen_random_uuid(),
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  '5565998723311',
  'restricao_molho',
  'Shoyu light e sem cream cheese',
  'restricao_alimentar',
  0.95,
  'ativo',
  'KyttoIA 2.5 Flash',
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;
INSERT INTO ai_customer_facts (
  id, empresa_id, telefone, chave, valor, categoria, confianca, status, extraido_por, criado_em, atualizado_em
) VALUES (
  gen_random_uuid(),
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  '5565999128844',
  'prato_favorito',
  'Poke Salmão Fresh e Gunkan Zuma',
  'preferencia_prato',
  0.95,
  'ativo',
  'KyttoIA 2.5 Flash',
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;
INSERT INTO ai_customer_facts (
  id, empresa_id, telefone, chave, valor, categoria, confianca, status, extraido_por, criado_em, atualizado_em
) VALUES (
  gen_random_uuid(),
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  '5565999128844',
  'bebida_favorita',
  'Soda Italiana Maçã Verde artesanal',
  'preferencia_bebida',
  0.95,
  'ativo',
  'KyttoIA 2.5 Flash',
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;
INSERT INTO ai_customer_facts (
  id, empresa_id, telefone, chave, valor, categoria, confianca, status, extraido_por, criado_em, atualizado_em
) VALUES (
  gen_random_uuid(),
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  '5565996554422',
  'combinado_preferido',
  'Combinado Salmão Supremo e Teppan',
  'preferencia_prato',
  0.95,
  'ativo',
  'KyttoIA 2.5 Flash',
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;
INSERT INTO ai_customer_facts (
  id, empresa_id, telefone, chave, valor, categoria, confianca, status, extraido_por, criado_em, atualizado_em
) VALUES (
  gen_random_uuid(),
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  '5565998017733',
  'prato_favorito',
  'Temaki Filadélfia e Hotdog Sushi Vulcão',
  'preferencia_prato',
  0.95,
  'ativo',
  'KyttoIA 2.5 Flash',
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;
INSERT INTO ai_customer_facts (
  id, empresa_id, telefone, chave, valor, categoria, confianca, status, extraido_por, criado_em, atualizado_em
) VALUES (
  gen_random_uuid(),
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  '5565999332211',
  'alergia_restricao',
  'Celíaca estrita - sem glúten / sem panko',
  'restricao_alimentar',
  0.95,
  'ativo',
  'KyttoIA 2.5 Flash',
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;
INSERT INTO ai_customer_facts (
  id, empresa_id, telefone, chave, valor, categoria, confianca, status, extraido_por, criado_em, atualizado_em
) VALUES (
  gen_random_uuid(),
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  '5565996119988',
  'prato_favorito',
  'Yakissoba de Camarão e Sobá Tangará',
  'preferencia_prato',
  0.95,
  'ativo',
  'KyttoIA 2.5 Flash',
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;
INSERT INTO ai_customer_facts (
  id, empresa_id, telefone, chave, valor, categoria, confianca, status, extraido_por, criado_em, atualizado_em
) VALUES (
  gen_random_uuid(),
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  '5565998445566',
  'combinado_familia',
  'Especial Zuma 68 Peças',
  'preferencia_prato',
  0.95,
  'ativo',
  'KyttoIA 2.5 Flash',
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;
INSERT INTO ai_customer_facts (
  id, empresa_id, telefone, chave, valor, categoria, confianca, status, extraido_por, criado_em, atualizado_em
) VALUES (
  gen_random_uuid(),
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  '5565998445566',
  'sobremesa_favorita',
  'Harumaki Romeu & Julieta e Hot Banana Nutella',
  'preferencia_prato',
  0.95,
  'ativo',
  'KyttoIA 2.5 Flash',
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

-- 10. PLANO DE CONTAS CONTÁBIL E DRE DO RESTAURANTE
INSERT INTO fin_categorias (id, empresa_id, nome, tipo, grupo_dre, ativo, criado_em)
SELECT 
  gen_random_uuid(),
  'c3c3ac01-8e50-4b61-8c79-de4aaa916da3',
  cat.nome,
  cat.tipo,
  cat.grupo_dre,
  true,
  NOW()
FROM (
  VALUES 
    ('Vendas Balcão & Salão Sushi', 'receita', 'receita_bruta'),
    ('Vendas Delivery & WhatsApp', 'receita', 'receita_bruta'),
    ('Bebidas, Vinhos & Sodas Italianas', 'receita', 'receita_bruta'),
    ('Taxas de Entrega / Frete', 'receita', 'receita_bruta'),
    ('Taxas de Cartão, Pix & Marketplaces', 'despesa', 'deducao'),
    ('Peixes Frescos & Salmão Certificado (CMV)', 'despesa', 'cmv'),
    ('Arroz Japonês Gohan, Algas Nori & Insumos', 'despesa', 'cmv'),
    ('Embalagens Delivery & Hashis descartáveis', 'despesa', 'cmv'),
    ('Equipe Sushiman, Cozinha & Salão', 'despesa', 'pessoal'),
    ('Aluguel, Energia & Manutenção', 'despesa', 'operacional')
) AS cat(nome, tipo, grupo_dre)
ON CONFLICT DO NOTHING;
