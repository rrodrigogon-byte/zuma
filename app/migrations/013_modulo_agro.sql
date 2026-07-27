-- =============================================================================
-- MIGRATION 013 — Módulo Agro: Balança Rodoviária, Romaneio, Silos, Safras
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS safras (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id      UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome            VARCHAR(100) NOT NULL,
  cultura         VARCHAR(50),
  ano_inicio      INTEGER,
  ano_fim         INTEGER,
  area_ha         DECIMAL(10,2),
  status          VARCHAR(20) DEFAULT 'ativa',
  observacoes     TEXT,
  criado_em       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS talhoes (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id              UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  safra_id                UUID REFERENCES safras(id),
  nome                    VARCHAR(100) NOT NULL,
  cultura                 VARCHAR(50),
  area_ha                 DECIMAL(10,2),
  variedade               VARCHAR(100),
  data_plantio            DATE,
  data_colheita_prevista  DATE,
  data_colheita_real      DATE,
  status                  VARCHAR(20) DEFAULT 'plantado',
  coordenadas_geojson     JSONB,
  criado_em               TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS colheitas (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id            UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  talhao_id             UUID REFERENCES talhoes(id),
  data_colheita         DATE NOT NULL,
  peso_bruto_kg         DECIMAL(12,3),
  umidade_percentual    DECIMAL(5,2) DEFAULT 0,
  impureza_percentual   DECIMAL(5,2) DEFAULT 0,
  peso_liquido_kg       DECIMAL(12,3),
  produtividade_sc_ha   DECIMAL(8,2),
  silo_destino          VARCHAR(100),
  observacoes           TEXT,
  criado_em             TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tickets_balanca (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id            UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  numero_ticket         INTEGER NOT NULL,
  placa_veiculo         VARCHAR(10),
  motorista             VARCHAR(100),
  transportadora_id     UUID REFERENCES fornecedores(id),
  fornecedor_id         UUID REFERENCES fornecedores(id),
  produto_id            UUID REFERENCES produtos(id),
  safra_id              UUID REFERENCES safras(id),
  talhao_id             UUID REFERENCES talhoes(id),
  tipo_operacao         VARCHAR(20) DEFAULT 'entrada',
  peso_entrada_kg       DECIMAL(12,3),
  peso_saida_kg         DECIMAL(12,3),
  peso_liquido_kg       DECIMAL(12,3),
  peso_descontado_kg    DECIMAL(12,3),
  umidade_percentual    DECIMAL(5,2) DEFAULT 0,
  impureza_percentual   DECIMAL(5,2) DEFAULT 0,
  sacas                 DECIMAL(10,3),
  data_entrada          TIMESTAMPTZ DEFAULT NOW(),
  data_saida            TIMESTAMPTZ,
  status                VARCHAR(20) DEFAULT 'aguardando_saida',
  UNIQUE(empresa_id, numero_ticket)
);

CREATE TABLE IF NOT EXISTS romaneios (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id            UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  numero                VARCHAR(20) NOT NULL,
  tipo                  VARCHAR(20) DEFAULT 'compra',
  data_emissao          TIMESTAMPTZ DEFAULT NOW(),
  fornecedor_id         UUID REFERENCES fornecedores(id),
  transportadora_id     UUID REFERENCES fornecedores(id),
  placa_veiculo         VARCHAR(10),
  motorista             VARCHAR(100),
  produto_id            UUID REFERENCES produtos(id),
  safra_id              UUID REFERENCES safras(id),
  peso_bruto_kg         DECIMAL(12,3),
  peso_tara_kg          DECIMAL(12,3),
  peso_liquido_kg       DECIMAL(12,3),
  umidade_percentual    DECIMAL(5,2) DEFAULT 0,
  impureza_percentual   DECIMAL(5,2) DEFAULT 0,
  sacas                 DECIMAL(10,3),
  valor_unitario        DECIMAL(10,4),
  valor_total           DECIMAL(12,2),
  status                VARCHAR(20) DEFAULT 'emitido',
  observacoes           TEXT,
  UNIQUE(empresa_id, numero)
);

CREATE TABLE IF NOT EXISTS notas_produtor (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id            UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  numero                INTEGER NOT NULL,
  serie                 INTEGER DEFAULT 1,
  data_emissao          TIMESTAMPTZ DEFAULT NOW(),
  produtor_id           UUID REFERENCES fornecedores(id),
  produto_id            UUID REFERENCES produtos(id),
  safra_id              UUID REFERENCES safras(id),
  quantidade_kg         DECIMAL(12,3),
  sacas                 DECIMAL(10,3),
  valor_unitario        DECIMAL(10,4),
  valor_total           DECIMAL(12,2),
  base_calculo_funrural DECIMAL(12,2),
  aliquota_funrural     DECIMAL(5,2) DEFAULT 1.5,
  valor_funrural        DECIMAL(10,2),
  base_calculo_senar    DECIMAL(12,2),
  aliquota_senar        DECIMAL(5,2) DEFAULT 0.2,
  valor_senar           DECIMAL(10,2),
  valor_liquido         DECIMAL(12,2),
  status                VARCHAR(20) DEFAULT 'emitida',
  observacoes           TEXT,
  UNIQUE(empresa_id, numero, serie)
);

CREATE TABLE IF NOT EXISTS silos (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id      UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome            VARCHAR(100) NOT NULL,
  capacidade_kg   DECIMAL(12,3),
  tipo            VARCHAR(50),
  localizacao     VARCHAR(200),
  ativo           BOOLEAN DEFAULT TRUE,
  criado_em       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS estoque_silo (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id      UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  silo_id         UUID NOT NULL REFERENCES silos(id),
  produto_id      UUID REFERENCES produtos(id),
  quantidade_kg   DECIMAL(12,3) DEFAULT 0,
  UNIQUE(empresa_id, silo_id, produto_id)
);

CREATE TABLE IF NOT EXISTS movimentacoes_silo (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id      UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  silo_id         UUID NOT NULL REFERENCES silos(id),
  produto_id      UUID REFERENCES produtos(id),
  tipo            VARCHAR(20),
  quantidade_kg   DECIMAL(12,3),
  observacoes     TEXT,
  criado_em       TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_talhoes_safra ON talhoes(safra_id);
CREATE INDEX IF NOT EXISTS idx_tickets_empresa_data ON tickets_balanca(empresa_id, data_entrada DESC);
CREATE INDEX IF NOT EXISTS idx_romaneios_empresa_data ON romaneios(empresa_id, data_emissao DESC);
CREATE INDEX IF NOT EXISTS idx_notas_produtor_empresa ON notas_produtor(empresa_id, data_emissao DESC);

COMMIT;
