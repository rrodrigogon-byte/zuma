-- Migration 118: Criação da Tabela de Negócios e Governança Multi-Negócio (Onda 1)
-- Conforme especificação executiva @Rodrigo Gonçalves (Nov/2026)

DO $$
BEGIN
  -- 1. Garante tabela de negócios
  CREATE TABLE IF NOT EXISTS negocios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL, -- 'supermercado', 'barbearia', 'loja', 'bar', 'clube', 'outro'
    nome VARCHAR(150) NOT NULL,
    situacao VARCHAR(30) DEFAULT 'ativo',
    modulos_ligados JSONB DEFAULT '[]'::jsonb,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
  );

  -- 2. Adiciona negócio_id nas tabelas operacionais se não existir
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lojas' AND column_name = 'negocio_id') THEN
    ALTER TABLE lojas ADD COLUMN negocio_id UUID REFERENCES negocios(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'var_vendas' AND column_name = 'negocio_id') THEN
    ALTER TABLE var_vendas ADD COLUMN negocio_id UUID REFERENCES negocios(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'est_movimentos' AND column_name = 'negocio_id') THEN
    ALTER TABLE est_movimentos ADD COLUMN negocio_id UUID REFERENCES negocios(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fin_lancamentos' AND column_name = 'negocio_id') THEN
    ALTER TABLE fin_lancamentos ADD COLUMN negocio_id UUID REFERENCES negocios(id) ON DELETE SET NULL;
  END IF;

  -- 3. Atualiza grupo_id das 4 empresas canônicas no Silvester Holding
  UPDATE empresas 
     SET grupo_id = '1bf95920-76a8-4241-961e-c7a45c8c38ae'
   WHERE id IN (
     '00000000-0000-0000-0000-000000000002', -- Supermercado Kytto
     'd0d0ac01-8e50-4b61-8c79-de4aaa916da6', -- Barbearia Dino
     '31f70c83-9172-40c2-945f-9e793b5048be', -- Stallone Nutre Sport
     '2e041110-db20-4fd1-8278-12bd3dead008'  -- AGRO OPEN TTC
   );

  -- 4. Cria registros canônicos de Negócios para cada empresa ativa
  -- 4.1 Supermercado Kytto
  IF NOT EXISTS (SELECT 1 FROM negocios WHERE empresa_id = '00000000-0000-0000-0000-000000000002') THEN
    INSERT INTO negocios (id, empresa_id, tipo, nome, situacao, modulos_ligados)
    VALUES (
      '00000000-0000-0000-0000-000000000102',
      '00000000-0000-0000-0000-000000000002',
      'supermercado',
      'Supermercado & Atacarejo Matriz',
      'ativo',
      '["painel", "vendas_caixa", "produtos_precos", "pereciveis_producao", "suprimentos_estoque", "clientes_prevencao", "erp_comum"]'::jsonb
    );
  END IF;

  -- 4.2 Barbearia Dino
  IF NOT EXISTS (SELECT 1 FROM negocios WHERE empresa_id = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6') THEN
    INSERT INTO negocios (id, empresa_id, tipo, nome, situacao, modulos_ligados)
    VALUES (
      'd0d0ac01-8e50-4b61-8c79-de4aaa916da7',
      'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
      'barbearia',
      'Barbearia Dino - Salão & Estética',
      'ativo',
      '["agenda", "profissionais", "comissao", "comandas", "crm_whatsapp", "relatorios_dino"]'::jsonb
    );
  END IF;

  -- 4.3 Stallone Nutre Sport
  IF NOT EXISTS (SELECT 1 FROM negocios WHERE empresa_id = '31f70c83-9172-40c2-945f-9e793b5048be') THEN
    INSERT INTO negocios (id, empresa_id, tipo, nome, situacao, modulos_ligados)
    VALUES (
      '31f70c83-9172-40c2-945f-9e793b5048bf',
      '31f70c83-9172-40c2-945f-9e793b5048be',
      'loja',
      'Stallone Nutre Sport - Suplementos & Moda',
      'ativo',
      '["pdv_balcao", "catalogo_sku", "estoque_lotes", "compras", "curva_abc"]'::jsonb
    );
  END IF;

  -- 4.4 AGRO OPEN TTC
  IF NOT EXISTS (SELECT 1 FROM negocios WHERE empresa_id = '2e041110-db20-4fd1-8278-12bd3dead008') THEN
    INSERT INTO negocios (id, empresa_id, tipo, nome, situacao, modulos_ligados)
    VALUES (
      '2e041110-db20-4fd1-8278-12bd3dead009',
      '2e041110-db20-4fd1-8278-12bd3dead008',
      'clube',
      'AGRO OPEN - Clube, Quadras & Eventos',
      'ativo',
      '["quadras", "aulas", "socios", "torneios", "catracas", "financeiro"]'::jsonb
    );
  END IF;

  -- 5. Vincula lojas aos seus negócios correspondentes
  UPDATE lojas l
     SET negocio_id = n.id
    FROM negocios n
   WHERE l.empresa_id = n.empresa_id
     AND l.negocio_id IS NULL;

END $$;
