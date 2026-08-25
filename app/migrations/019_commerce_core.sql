/*
 * ============================================================================
 * MIGRAÇÃO 019: KYTTO COMMERCE CORE
 * ============================================================================
 * Fonte de verdade transacional para comércio multempresa/multiloja.
 *
 * Pré-requisitos: migrations 001/003, com empresas, lojas e usuarios criadas.
 * O servidor legado em app/server.js não passa a usar estas tabelas sozinho:
 * a ativação exige rollout explícito, DATABASE_URL e migração/dupla leitura.
 *
 * Regras importantes:
 * - todo registro comercial possui empresa_id;
 * - escopos de loja são validados por FK composta quando aplicável;
 * - estoque reservado/comprometido é separado de disponível;
 * - pagamento e webhook não armazenam cartão nem segredo;
 * - estado do pedido e auditoria são append-only por eventos.
 * ============================================================================
 */

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF to_regclass('public.empresas') IS NULL
     OR to_regclass('public.lojas') IS NULL
     OR to_regclass('public.usuarios') IS NULL THEN
    RAISE EXCEPTION 'Commerce Core requer as tabelas empresas, lojas e usuarios das migrations de fundação';
  END IF;
END $$;

/* A FK composta garante que loja e empresa não sejam misturadas. */
CREATE UNIQUE INDEX IF NOT EXISTS uq_lojas_empresa_id
  ON lojas (empresa_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_empresa_id
  ON usuarios (empresa_id, id);

-- ---------------------------------------------------------------------------
-- CONTEXTO DE LOJA, DOMÍNIOS E GOVERNANÇA
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commerce_storefronts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID,
  codigo VARCHAR(80) NOT NULL,
  nome VARCHAR(200) NOT NULL,
  canal VARCHAR(40) NOT NULL DEFAULT 'web',
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  moeda CHAR(3) NOT NULL DEFAULT 'BRL',
  timezone VARCHAR(64) NOT NULL DEFAULT 'America/Sao_Paulo',
  configuracoes JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_commerce_storefront_empresa_codigo UNIQUE (empresa_id, codigo),
  CONSTRAINT uq_commerce_storefront_empresa_id UNIQUE (empresa_id, id),
  CONSTRAINT fk_commerce_storefront_loja_empresa FOREIGN KEY (empresa_id, loja_id)
    REFERENCES lojas (empresa_id, id) ON DELETE RESTRICT,
  CONSTRAINT chk_commerce_storefront_canal CHECK (canal IN ('web','pos','marketplace','api','evento')),
  CONSTRAINT chk_commerce_storefront_status CHECK (status IN ('draft','active','paused','archived'))
);

CREATE INDEX IF NOT EXISTS idx_commerce_storefront_empresa_status
  ON commerce_storefronts (empresa_id, status);

CREATE TABLE IF NOT EXISTS commerce_store_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  storefront_id UUID NOT NULL,
  dominio VARCHAR(255) NOT NULL,
  principal BOOLEAN NOT NULL DEFAULT false,
  verificado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_commerce_domain UNIQUE (dominio),
  CONSTRAINT fk_commerce_domain_storefront FOREIGN KEY (empresa_id, storefront_id)
    REFERENCES commerce_storefronts (empresa_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_commerce_domain_storefront
  ON commerce_store_domains (empresa_id, storefront_id);

CREATE TABLE IF NOT EXISTS commerce_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(100) NOT NULL UNIQUE,
  descricao VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS commerce_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
  codigo VARCHAR(80) NOT NULL,
  nome VARCHAR(120) NOT NULL,
  sistema BOOLEAN NOT NULL DEFAULT false,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_commerce_role_empresa_codigo UNIQUE (empresa_id, codigo)
);

CREATE TABLE IF NOT EXISTS commerce_role_permissions (
  role_id UUID NOT NULL REFERENCES commerce_roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES commerce_permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_role_system_code
  ON commerce_roles (codigo) WHERE empresa_id IS NULL;

INSERT INTO commerce_permissions (codigo, descricao) VALUES
  ('catalog.read', 'Visualizar catálogo'),
  ('catalog.write', 'Criar e editar catálogo'),
  ('catalog.publish', 'Publicar itens por canal'),
  ('inventory.read', 'Visualizar estoque'),
  ('inventory.write', 'Movimentar e ajustar estoque'),
  ('orders.read', 'Visualizar pedidos'),
  ('orders.write', 'Operar pedidos e fulfillment'),
  ('orders.refund', 'Solicitar ou executar estornos'),
  ('customers.read', 'Visualizar clientes'),
  ('customers.write', 'Criar e editar clientes'),
  ('payments.read', 'Visualizar pagamentos'),
  ('payments.write', 'Operar pagamentos e conciliação'),
  ('reports.read', 'Visualizar relatórios'),
  ('settings.write', 'Alterar configurações'),
  ('users.write', 'Administrar usuários e permissões'),
  ('audit.read', 'Visualizar auditoria')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO commerce_roles (empresa_id, codigo, nome, sistema)
SELECT NULL, seed.codigo, seed.nome, true
  FROM (VALUES
    ('platform_owner', 'Dono da plataforma'),
    ('tenant_owner', 'Dono da empresa'),
    ('store_admin', 'Administrador da loja'),
    ('catalog_manager', 'Gestor de catálogo'),
    ('inventory_manager', 'Gestor de estoque'),
    ('order_operator', 'Operador de pedidos'),
    ('finance', 'Financeiro'),
    ('support', 'Suporte'),
    ('customer', 'Cliente')
  ) AS seed(codigo, nome)
 WHERE NOT EXISTS (
   SELECT 1 FROM commerce_roles r WHERE r.empresa_id IS NULL AND r.codigo = seed.codigo
 );

INSERT INTO commerce_role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM commerce_roles r
  CROSS JOIN commerce_permissions p
 WHERE r.empresa_id IS NULL
   AND (
     r.codigo IN ('platform_owner', 'tenant_owner')
     OR (r.codigo = 'store_admin' AND p.codigo NOT IN ('users.write'))
     OR (r.codigo = 'catalog_manager' AND p.codigo IN ('catalog.read','catalog.write','catalog.publish'))
     OR (r.codigo = 'inventory_manager' AND p.codigo IN ('catalog.read','inventory.read','inventory.write'))
     OR (r.codigo = 'order_operator' AND p.codigo IN ('catalog.read','inventory.read','orders.read','orders.write','customers.read'))
     OR (r.codigo = 'finance' AND p.codigo IN ('orders.read','payments.read','payments.write','reports.read'))
     OR (r.codigo = 'support' AND p.codigo IN ('catalog.read','orders.read','customers.read'))
     OR (r.codigo = 'customer' AND p.codigo IN ('catalog.read'))
   )
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS commerce_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL,
  loja_id UUID,
  role_id UUID NOT NULL REFERENCES commerce_roles(id),
  ativo BOOLEAN NOT NULL DEFAULT true,
  mfa_obrigatorio BOOLEAN NOT NULL DEFAULT false,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_commerce_membership_scope UNIQUE (empresa_id, usuario_id, loja_id),
  CONSTRAINT fk_commerce_membership_usuario FOREIGN KEY (empresa_id, usuario_id)
    REFERENCES usuarios (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_commerce_membership_loja FOREIGN KEY (empresa_id, loja_id)
    REFERENCES lojas (empresa_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_commerce_membership_usuario
  ON commerce_memberships (empresa_id, usuario_id, ativo);
CREATE INDEX IF NOT EXISTS idx_commerce_membership_loja
  ON commerce_memberships (empresa_id, loja_id, ativo);
CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_membership_tenant_scope
  ON commerce_memberships (empresa_id, usuario_id)
  WHERE loja_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_membership_store_scope
  ON commerce_memberships (empresa_id, usuario_id, loja_id)
  WHERE loja_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- CATÁLOGO, VARIAÇÕES, MÍDIA E PREÇOS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commerce_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  parent_id UUID,
  slug VARCHAR(160) NOT NULL,
  nome VARCHAR(180) NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_commerce_category_empresa_slug UNIQUE (empresa_id, slug),
  CONSTRAINT uq_commerce_category_empresa_id UNIQUE (empresa_id, id),
  CONSTRAINT fk_commerce_category_parent FOREIGN KEY (empresa_id, parent_id)
    REFERENCES commerce_categories (empresa_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_commerce_category_empresa_ativo
  ON commerce_categories (empresa_id, ativo, ordem);

CREATE TABLE IF NOT EXISTS commerce_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  category_id UUID,
  slug VARCHAR(180) NOT NULL,
  nome VARCHAR(300) NOT NULL,
  tipo VARCHAR(30) NOT NULL DEFAULT 'physical',
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  descricao TEXT,
  descricao_curta VARCHAR(500),
  dados_fiscais JSONB NOT NULL DEFAULT '{}'::jsonb,
  seo JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_por UUID,
  publicado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_commerce_product_empresa_slug UNIQUE (empresa_id, slug),
  CONSTRAINT uq_commerce_product_empresa_id UNIQUE (empresa_id, id),
  CONSTRAINT fk_commerce_product_category FOREIGN KEY (empresa_id, category_id)
    REFERENCES commerce_categories (empresa_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_commerce_product_creator FOREIGN KEY (empresa_id, criado_por)
    REFERENCES usuarios (empresa_id, id) ON DELETE RESTRICT,
  CONSTRAINT chk_commerce_product_tipo CHECK (tipo IN ('physical','service','digital','ticket','combo')),
  CONSTRAINT chk_commerce_product_status CHECK (status IN ('draft','active','archived'))
);

CREATE INDEX IF NOT EXISTS idx_commerce_product_catalog
  ON commerce_products (empresa_id, status, category_id);

CREATE TABLE IF NOT EXISTS commerce_product_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  storefront_id UUID NOT NULL,
  product_id UUID NOT NULL,
  price_list_id UUID,
  publicado BOOLEAN NOT NULL DEFAULT false,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_commerce_product_channel UNIQUE (empresa_id, storefront_id, product_id),
  CONSTRAINT fk_commerce_product_channel_storefront FOREIGN KEY (empresa_id, storefront_id)
    REFERENCES commerce_storefronts (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_commerce_product_channel_product FOREIGN KEY (empresa_id, product_id)
    REFERENCES commerce_products (empresa_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_commerce_product_channel_publicado
  ON commerce_product_channels (empresa_id, storefront_id, publicado);

CREATE TABLE IF NOT EXISTS commerce_product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  sku VARCHAR(100) NOT NULL,
  barcode VARCHAR(80),
  nome VARCHAR(200),
  atributos JSONB NOT NULL DEFAULT '{}'::jsonb,
  peso_gramas INTEGER,
  largura_cm NUMERIC(10,2),
  altura_cm NUMERIC(10,2),
  comprimento_cm NUMERIC(10,2),
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_commerce_variant_empresa_sku UNIQUE (empresa_id, sku),
  CONSTRAINT uq_commerce_variant_empresa_id UNIQUE (empresa_id, id),
  CONSTRAINT fk_commerce_variant_product FOREIGN KEY (empresa_id, product_id)
    REFERENCES commerce_products (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT chk_commerce_variant_measurements CHECK (
    peso_gramas IS NULL OR peso_gramas >= 0
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_variant_barcode
  ON commerce_product_variants (empresa_id, barcode)
  WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commerce_variant_product
  ON commerce_product_variants (empresa_id, product_id, ativo);

CREATE TABLE IF NOT EXISTS commerce_product_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  variant_id UUID,
  storage_key VARCHAR(500) NOT NULL,
  public_url VARCHAR(1000),
  mime_type VARCHAR(120) NOT NULL,
  alt_text VARCHAR(255),
  ordem INTEGER NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_commerce_media_product FOREIGN KEY (empresa_id, product_id)
    REFERENCES commerce_products (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_commerce_media_variant FOREIGN KEY (empresa_id, variant_id)
    REFERENCES commerce_product_variants (empresa_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_commerce_media_product
  ON commerce_product_media (empresa_id, product_id, ordem);

CREATE TABLE IF NOT EXISTS commerce_price_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  codigo VARCHAR(80) NOT NULL,
  nome VARCHAR(160) NOT NULL,
  canal VARCHAR(40) NOT NULL DEFAULT 'web',
  moeda CHAR(3) NOT NULL DEFAULT 'BRL',
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_commerce_price_list_empresa_codigo UNIQUE (empresa_id, codigo)
);

CREATE TABLE IF NOT EXISTS commerce_variant_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  price_list_id UUID NOT NULL,
  variant_id UUID NOT NULL,
  preco NUMERIC(14,2) NOT NULL,
  preco_promocional NUMERIC(14,2),
  custo NUMERIC(14,2),
  vigencia_inicio TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  vigencia_fim TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_commerce_price_list FOREIGN KEY (empresa_id, price_list_id)
    REFERENCES commerce_price_lists (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_commerce_price_variant FOREIGN KEY (empresa_id, variant_id)
    REFERENCES commerce_product_variants (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT chk_commerce_price_values CHECK (
    preco >= 0 AND (preco_promocional IS NULL OR (preco_promocional >= 0 AND preco_promocional <= preco))
  )
);

CREATE INDEX IF NOT EXISTS idx_commerce_variant_price_active
  ON commerce_variant_prices (empresa_id, price_list_id, variant_id, vigencia_inicio, vigencia_fim);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_commerce_product_channel_price_list') THEN
    ALTER TABLE commerce_product_channels
      ADD CONSTRAINT fk_commerce_product_channel_price_list
      FOREIGN KEY (empresa_id, price_list_id)
      REFERENCES commerce_price_lists (empresa_id, id) ON DELETE RESTRICT;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- ESTOQUE, RESERVAS E MOVIMENTAÇÕES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commerce_inventory_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID,
  codigo VARCHAR(80) NOT NULL,
  nome VARCHAR(160) NOT NULL,
  tipo VARCHAR(30) NOT NULL DEFAULT 'store',
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_commerce_inventory_location_empresa_codigo UNIQUE (empresa_id, codigo),
  CONSTRAINT uq_commerce_inventory_location_empresa_id UNIQUE (empresa_id, id),
  CONSTRAINT fk_commerce_inventory_location_loja FOREIGN KEY (empresa_id, loja_id)
    REFERENCES lojas (empresa_id, id) ON DELETE RESTRICT,
  CONSTRAINT chk_commerce_inventory_location_tipo CHECK (tipo IN ('store','warehouse','kitchen','pickup','virtual'))
);

CREATE INDEX IF NOT EXISTS idx_commerce_inventory_location_empresa
  ON commerce_inventory_locations (empresa_id, ativo);

CREATE TABLE IF NOT EXISTS commerce_inventory_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  location_id UUID NOT NULL,
  variant_id UUID NOT NULL,
  disponivel INTEGER NOT NULL DEFAULT 0,
  reservado INTEGER NOT NULL DEFAULT 0,
  comprometido INTEGER NOT NULL DEFAULT 0,
  minimo INTEGER NOT NULL DEFAULT 0,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_commerce_inventory_level UNIQUE (empresa_id, location_id, variant_id),
  CONSTRAINT fk_commerce_inventory_level_location FOREIGN KEY (empresa_id, location_id)
    REFERENCES commerce_inventory_locations (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_commerce_inventory_level_variant FOREIGN KEY (empresa_id, variant_id)
    REFERENCES commerce_product_variants (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT chk_commerce_inventory_level_values CHECK (
    disponivel >= 0 AND reservado >= 0 AND comprometido >= 0 AND minimo >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_commerce_inventory_level_alert
  ON commerce_inventory_levels (empresa_id, location_id, disponivel, minimo);

CREATE TABLE IF NOT EXISTS commerce_inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  location_id UUID NOT NULL,
  variant_id UUID NOT NULL,
  tipo VARCHAR(30) NOT NULL,
  quantidade INTEGER NOT NULL,
  saldo_anterior INTEGER NOT NULL,
  saldo_posterior INTEGER NOT NULL,
  referencia_tipo VARCHAR(80),
  referencia_id UUID,
  idempotency_key VARCHAR(160),
  usuario_id UUID,
  observacao VARCHAR(500),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_commerce_movement_location FOREIGN KEY (empresa_id, location_id)
    REFERENCES commerce_inventory_locations (empresa_id, id),
  CONSTRAINT fk_commerce_movement_variant FOREIGN KEY (empresa_id, variant_id)
    REFERENCES commerce_product_variants (empresa_id, id),
  CONSTRAINT fk_commerce_movement_usuario FOREIGN KEY (empresa_id, usuario_id)
    REFERENCES usuarios (empresa_id, id) ON DELETE RESTRICT,
  CONSTRAINT chk_commerce_movement_tipo CHECK (tipo IN ('entrada','saida','reserva','liberacao','compromisso','ajuste','transferencia','devolucao')),
  CONSTRAINT chk_commerce_movement_quantity CHECK (quantidade > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_movement_idempotency
  ON commerce_inventory_movements (empresa_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commerce_movement_variant_date
  ON commerce_inventory_movements (empresa_id, variant_id, criado_em DESC);

CREATE TABLE IF NOT EXISTS commerce_inventory_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  order_id UUID,
  location_id UUID NOT NULL,
  variant_id UUID NOT NULL,
  quantidade INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  expira_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_commerce_reservation_location FOREIGN KEY (empresa_id, location_id)
    REFERENCES commerce_inventory_locations (empresa_id, id),
  CONSTRAINT fk_commerce_reservation_variant FOREIGN KEY (empresa_id, variant_id)
    REFERENCES commerce_product_variants (empresa_id, id),
  CONSTRAINT chk_commerce_reservation_status CHECK (status IN ('pending','confirmed','released','expired')),
  CONSTRAINT chk_commerce_reservation_quantity CHECK (quantidade > 0)
);

CREATE INDEX IF NOT EXISTS idx_commerce_reservation_expiration
  ON commerce_inventory_reservations (empresa_id, status, expira_em);

-- ---------------------------------------------------------------------------
-- CLIENTES, CARRINHOS, PEDIDOS E ESTADOS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commerce_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  usuario_id UUID,
  nome VARCHAR(240) NOT NULL,
  email VARCHAR(320),
  telefone VARCHAR(30),
  documento_mascarado VARCHAR(40),
  consentimentos JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadados JSONB NOT NULL DEFAULT '{}'::jsonb,
  bloqueado BOOLEAN NOT NULL DEFAULT false,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_commerce_customer_empresa_id UNIQUE (empresa_id, id),
  CONSTRAINT fk_commerce_customer_usuario FOREIGN KEY (empresa_id, usuario_id)
    REFERENCES usuarios (empresa_id, id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_customer_email
  ON commerce_customers (empresa_id, lower(email))
  WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commerce_customer_name
  ON commerce_customers (empresa_id, lower(nome));

CREATE TABLE IF NOT EXISTS commerce_customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL,
  rotulo VARCHAR(60) NOT NULL DEFAULT 'principal',
  destinatario VARCHAR(240) NOT NULL,
  cep VARCHAR(8),
  logradouro VARCHAR(240),
  numero VARCHAR(30),
  complemento VARCHAR(120),
  bairro VARCHAR(120),
  cidade VARCHAR(120),
  estado CHAR(2),
  referencia VARCHAR(240),
  padrao BOOLEAN NOT NULL DEFAULT false,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_commerce_address_customer FOREIGN KEY (empresa_id, customer_id)
    REFERENCES commerce_customers (empresa_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_commerce_address_customer
  ON commerce_customer_addresses (empresa_id, customer_id, padrao);

CREATE TABLE IF NOT EXISTS commerce_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  storefront_id UUID NOT NULL,
  customer_id UUID,
  session_key_hash VARCHAR(128),
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  moeda CHAR(3) NOT NULL DEFAULT 'BRL',
  expira_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_commerce_cart_empresa_id UNIQUE (empresa_id, id),
  CONSTRAINT fk_commerce_cart_storefront FOREIGN KEY (empresa_id, storefront_id)
    REFERENCES commerce_storefronts (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_commerce_cart_customer FOREIGN KEY (empresa_id, customer_id)
    REFERENCES commerce_customers (empresa_id, id) ON DELETE RESTRICT,
  CONSTRAINT chk_commerce_cart_status CHECK (status IN ('open','converted','abandoned','expired'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_cart_session_open
  ON commerce_carts (empresa_id, storefront_id, session_key_hash)
  WHERE status = 'open' AND session_key_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS commerce_cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  cart_id UUID NOT NULL,
  variant_id UUID NOT NULL,
  quantidade INTEGER NOT NULL,
  preco_unitario NUMERIC(14,2) NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_commerce_cart_item UNIQUE (empresa_id, cart_id, variant_id),
  CONSTRAINT fk_commerce_cart_item_cart FOREIGN KEY (empresa_id, cart_id)
    REFERENCES commerce_carts (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_commerce_cart_item_variant FOREIGN KEY (empresa_id, variant_id)
    REFERENCES commerce_product_variants (empresa_id, id),
  CONSTRAINT chk_commerce_cart_item_quantity CHECK (quantidade > 0),
  CONSTRAINT chk_commerce_cart_item_price CHECK (preco_unitario >= 0)
);

CREATE TABLE IF NOT EXISTS commerce_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  storefront_id UUID NOT NULL,
  customer_id UUID,
  public_code VARCHAR(40) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  origem VARCHAR(30) NOT NULL DEFAULT 'web',
  moeda CHAR(3) NOT NULL DEFAULT 'BRL',
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  desconto NUMERIC(14,2) NOT NULL DEFAULT 0,
  frete NUMERIC(14,2) NOT NULL DEFAULT 0,
  impostos NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  endereco_entrega JSONB,
  endereco_cobranca JSONB,
  observacao VARCHAR(1000),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_commerce_order_empresa_id UNIQUE (empresa_id, id),
  CONSTRAINT uq_commerce_order_public_code UNIQUE (empresa_id, public_code),
  CONSTRAINT fk_commerce_order_storefront FOREIGN KEY (empresa_id, storefront_id)
    REFERENCES commerce_storefronts (empresa_id, id),
  CONSTRAINT fk_commerce_order_customer FOREIGN KEY (empresa_id, customer_id)
    REFERENCES commerce_customers (empresa_id, id) ON DELETE RESTRICT,
  CONSTRAINT chk_commerce_order_status CHECK (status IN ('draft','pending_payment','payment_failed','paid','fraud_review','processing','ready','shipped','ready_for_pickup','delivered','picked_up','completed','cancelled','refunded','partially_refunded','returned')),
  CONSTRAINT chk_commerce_order_origin CHECK (origem IN ('web','pos','marketplace','api','event')),
  CONSTRAINT chk_commerce_order_totals CHECK (subtotal >= 0 AND desconto >= 0 AND frete >= 0 AND impostos >= 0 AND total >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_order_idempotency
  ON commerce_orders (empresa_id, public_code);
CREATE INDEX IF NOT EXISTS idx_commerce_order_queue
  ON commerce_orders (empresa_id, storefront_id, status, criado_em DESC);

CREATE TABLE IF NOT EXISTS commerce_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  order_id UUID NOT NULL,
  variant_id UUID,
  sku_snapshot VARCHAR(100),
  nome_snapshot VARCHAR(300) NOT NULL,
  atributos_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  quantidade INTEGER NOT NULL,
  preco_unitario NUMERIC(14,2) NOT NULL,
  desconto NUMERIC(14,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(14,2) NOT NULL,
  CONSTRAINT fk_commerce_order_item_order FOREIGN KEY (empresa_id, order_id)
    REFERENCES commerce_orders (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_commerce_order_item_variant FOREIGN KEY (empresa_id, variant_id)
    REFERENCES commerce_product_variants (empresa_id, id) ON DELETE RESTRICT,
  CONSTRAINT chk_commerce_order_item_quantity CHECK (quantidade > 0),
  CONSTRAINT chk_commerce_order_item_values CHECK (preco_unitario >= 0 AND desconto >= 0 AND subtotal >= 0)
);

CREATE INDEX IF NOT EXISTS idx_commerce_order_item_order
  ON commerce_order_items (empresa_id, order_id);

CREATE TABLE IF NOT EXISTS commerce_order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  order_id UUID NOT NULL,
  de_status VARCHAR(30),
  para_status VARCHAR(30) NOT NULL,
  origem VARCHAR(40) NOT NULL,
  usuario_id UUID,
  correlation_id VARCHAR(160),
  payload_resumido JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_commerce_order_event_order FOREIGN KEY (empresa_id, order_id)
    REFERENCES commerce_orders (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_commerce_order_event_usuario FOREIGN KEY (empresa_id, usuario_id)
    REFERENCES usuarios (empresa_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_commerce_order_event_order
  ON commerce_order_events (empresa_id, order_id, criado_em);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_commerce_reservation_order') THEN
    ALTER TABLE commerce_inventory_reservations
      ADD CONSTRAINT fk_commerce_reservation_order
      FOREIGN KEY (empresa_id, order_id)
      REFERENCES commerce_orders (empresa_id, id) ON DELETE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- PAGAMENTO, WEBHOOKS, ENTREGA, PROMOÇÕES E IDEMPOTÊNCIA
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commerce_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  order_id UUID NOT NULL,
  provider VARCHAR(60) NOT NULL,
  method VARCHAR(30) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  idempotency_key VARCHAR(180),
  amount NUMERIC(14,2) NOT NULL,
  provider_payment_id VARCHAR(180),
  authorization_code VARCHAR(120),
  fee NUMERIC(14,2),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  authorized_at TIMESTAMPTZ,
  captured_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_commerce_payment_order FOREIGN KEY (empresa_id, order_id)
    REFERENCES commerce_orders (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT chk_commerce_payment_method CHECK (method IN ('pix','credit_card','debit_card','boleto','cash','external')),
  CONSTRAINT chk_commerce_payment_status CHECK (status IN ('pending','authorized','captured','failed','cancelled','refunded','partially_refunded')),
  CONSTRAINT chk_commerce_payment_amount CHECK (amount >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_payment_provider_id
  ON commerce_payments (empresa_id, provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commerce_payment_order
  ON commerce_payments (empresa_id, order_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_payment_idempotency
  ON commerce_payments (empresa_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS commerce_payment_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  storefront_id UUID,
  provider VARCHAR(60) NOT NULL,
  ambiente VARCHAR(20) NOT NULL DEFAULT 'sandbox',
  nome VARCHAR(120) NOT NULL,
  secret_ref VARCHAR(240) NOT NULL,
  public_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  ativo BOOLEAN NOT NULL DEFAULT false,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_commerce_payment_account_name UNIQUE (empresa_id, provider, nome),
  CONSTRAINT fk_commerce_payment_account_storefront FOREIGN KEY (empresa_id, storefront_id)
    REFERENCES commerce_storefronts (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT chk_commerce_payment_account_environment CHECK (ambiente IN ('sandbox','production'))
);

CREATE INDEX IF NOT EXISTS idx_commerce_payment_account_active
  ON commerce_payment_accounts (empresa_id, storefront_id, ativo);

CREATE TABLE IF NOT EXISTS commerce_payment_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
  provider VARCHAR(60) NOT NULL,
  provider_event_id VARCHAR(180) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  signature_valid BOOLEAN NOT NULL DEFAULT false,
  status VARCHAR(20) NOT NULL DEFAULT 'received',
  payload_hash VARCHAR(128) NOT NULL,
  payload_resumido JSONB NOT NULL DEFAULT '{}'::jsonb,
  processado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_commerce_payment_webhook UNIQUE (provider, provider_event_id),
  CONSTRAINT chk_commerce_payment_webhook_status CHECK (status IN ('received','processed','ignored','failed'))
);

CREATE INDEX IF NOT EXISTS idx_commerce_payment_webhook_status
  ON commerce_payment_webhooks (provider, status, criado_em);

CREATE TABLE IF NOT EXISTS commerce_shipping_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  storefront_id UUID NOT NULL,
  codigo VARCHAR(80) NOT NULL,
  nome VARCHAR(160) NOT NULL,
  tipo VARCHAR(30) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  configuracao JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_commerce_shipping_method UNIQUE (empresa_id, storefront_id, codigo),
  CONSTRAINT fk_commerce_shipping_storefront FOREIGN KEY (empresa_id, storefront_id)
    REFERENCES commerce_storefronts (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT chk_commerce_shipping_type CHECK (tipo IN ('pickup','delivery','carrier','digital','service'))
);

CREATE TABLE IF NOT EXISTS commerce_fulfillments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  order_id UUID NOT NULL,
  shipping_method_id UUID,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  tracking_code VARCHAR(160),
  carrier VARCHAR(120),
  endereco_entrega JSONB,
  ocorrencias JSONB NOT NULL DEFAULT '[]'::jsonb,
  enviado_em TIMESTAMPTZ,
  entregue_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_commerce_fulfillment_order FOREIGN KEY (empresa_id, order_id)
    REFERENCES commerce_orders (empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_commerce_fulfillment_shipping FOREIGN KEY (empresa_id, shipping_method_id)
    REFERENCES commerce_shipping_methods (empresa_id, id) ON DELETE RESTRICT,
  CONSTRAINT chk_commerce_fulfillment_status CHECK (status IN ('pending','preparing','ready','shipped','out_for_delivery','delivered','picked_up','failed','cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_commerce_fulfillment_queue
  ON commerce_fulfillments (empresa_id, status, atualizado_em DESC);

CREATE TABLE IF NOT EXISTS commerce_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome VARCHAR(160) NOT NULL,
  tipo VARCHAR(30) NOT NULL,
  valor NUMERIC(14,2) NOT NULL,
  regras JSONB NOT NULL DEFAULT '{}'::jsonb,
  inicio TIMESTAMPTZ NOT NULL,
  fim TIMESTAMPTZ,
  limite_uso INTEGER,
  usos INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_commerce_promotion_type CHECK (tipo IN ('percentage','fixed','free_shipping','bundle')),
  CONSTRAINT chk_commerce_promotion_value CHECK (valor >= 0)
);

CREATE TABLE IF NOT EXISTS commerce_promotion_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  promotion_id UUID NOT NULL,
  codigo VARCHAR(80) NOT NULL,
  uso_maximo INTEGER,
  usos INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT uq_commerce_promotion_code UNIQUE (empresa_id, codigo),
  CONSTRAINT fk_commerce_promotion_code_promotion FOREIGN KEY (empresa_id, promotion_id)
    REFERENCES commerce_promotions (empresa_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS commerce_idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  scope VARCHAR(120) NOT NULL,
  key VARCHAR(180) NOT NULL,
  request_hash VARCHAR(128) NOT NULL,
  response_status INTEGER,
  response_body JSONB,
  expires_at TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_commerce_idempotency UNIQUE (empresa_id, scope, key)
);

CREATE INDEX IF NOT EXISTS idx_commerce_idempotency_expire
  ON commerce_idempotency_keys (expires_at);

CREATE TABLE IF NOT EXISTS commerce_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  loja_id UUID,
  usuario_id UUID,
  entidade VARCHAR(100) NOT NULL,
  entidade_id UUID,
  acao VARCHAR(30) NOT NULL,
  antes JSONB,
  depois JSONB,
  correlation_id VARCHAR(160),
  ip_address INET,
  user_agent TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_commerce_audit_loja FOREIGN KEY (empresa_id, loja_id)
    REFERENCES lojas (empresa_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_commerce_audit_usuario FOREIGN KEY (empresa_id, usuario_id)
    REFERENCES usuarios (empresa_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_commerce_audit_empresa_date
  ON commerce_audit_logs (empresa_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_commerce_audit_entity
  ON commerce_audit_logs (empresa_id, entidade, entidade_id, criado_em DESC);

-- Atualização automática de timestamps sem depender do frontend.
CREATE OR REPLACE FUNCTION commerce_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_commerce_storefront_updated_at ON commerce_storefronts;
CREATE TRIGGER trg_commerce_storefront_updated_at BEFORE UPDATE ON commerce_storefronts
FOR EACH ROW EXECUTE FUNCTION commerce_touch_updated_at();
DROP TRIGGER IF EXISTS trg_commerce_membership_updated_at ON commerce_memberships;
CREATE TRIGGER trg_commerce_membership_updated_at BEFORE UPDATE ON commerce_memberships
FOR EACH ROW EXECUTE FUNCTION commerce_touch_updated_at();
DROP TRIGGER IF EXISTS trg_commerce_category_updated_at ON commerce_categories;
CREATE TRIGGER trg_commerce_category_updated_at BEFORE UPDATE ON commerce_categories
FOR EACH ROW EXECUTE FUNCTION commerce_touch_updated_at();
DROP TRIGGER IF EXISTS trg_commerce_product_updated_at ON commerce_products;
CREATE TRIGGER trg_commerce_product_updated_at BEFORE UPDATE ON commerce_products
FOR EACH ROW EXECUTE FUNCTION commerce_touch_updated_at();
DROP TRIGGER IF EXISTS trg_commerce_product_channel_updated_at ON commerce_product_channels;
CREATE TRIGGER trg_commerce_product_channel_updated_at BEFORE UPDATE ON commerce_product_channels
FOR EACH ROW EXECUTE FUNCTION commerce_touch_updated_at();
DROP TRIGGER IF EXISTS trg_commerce_variant_updated_at ON commerce_product_variants;
CREATE TRIGGER trg_commerce_variant_updated_at BEFORE UPDATE ON commerce_product_variants
FOR EACH ROW EXECUTE FUNCTION commerce_touch_updated_at();
DROP TRIGGER IF EXISTS trg_commerce_inventory_reservation_updated_at ON commerce_inventory_reservations;
CREATE TRIGGER trg_commerce_inventory_reservation_updated_at BEFORE UPDATE ON commerce_inventory_reservations
FOR EACH ROW EXECUTE FUNCTION commerce_touch_updated_at();
DROP TRIGGER IF EXISTS trg_commerce_customer_updated_at ON commerce_customers;
CREATE TRIGGER trg_commerce_customer_updated_at BEFORE UPDATE ON commerce_customers
FOR EACH ROW EXECUTE FUNCTION commerce_touch_updated_at();
DROP TRIGGER IF EXISTS trg_commerce_address_updated_at ON commerce_customer_addresses;
CREATE TRIGGER trg_commerce_address_updated_at BEFORE UPDATE ON commerce_customer_addresses
FOR EACH ROW EXECUTE FUNCTION commerce_touch_updated_at();
DROP TRIGGER IF EXISTS trg_commerce_cart_updated_at ON commerce_carts;
CREATE TRIGGER trg_commerce_cart_updated_at BEFORE UPDATE ON commerce_carts
FOR EACH ROW EXECUTE FUNCTION commerce_touch_updated_at();
DROP TRIGGER IF EXISTS trg_commerce_cart_item_updated_at ON commerce_cart_items;
CREATE TRIGGER trg_commerce_cart_item_updated_at BEFORE UPDATE ON commerce_cart_items
FOR EACH ROW EXECUTE FUNCTION commerce_touch_updated_at();
DROP TRIGGER IF EXISTS trg_commerce_order_updated_at ON commerce_orders;
CREATE TRIGGER trg_commerce_order_updated_at BEFORE UPDATE ON commerce_orders
FOR EACH ROW EXECUTE FUNCTION commerce_touch_updated_at();
DROP TRIGGER IF EXISTS trg_commerce_payment_updated_at ON commerce_payments;
CREATE TRIGGER trg_commerce_payment_updated_at BEFORE UPDATE ON commerce_payments
FOR EACH ROW EXECUTE FUNCTION commerce_touch_updated_at();
DROP TRIGGER IF EXISTS trg_commerce_fulfillment_updated_at ON commerce_fulfillments;
CREATE TRIGGER trg_commerce_fulfillment_updated_at BEFORE UPDATE ON commerce_fulfillments
FOR EACH ROW EXECUTE FUNCTION commerce_touch_updated_at();
