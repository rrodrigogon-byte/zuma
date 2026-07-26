-- ============================================================================
-- MIGRAÇÃO 002: CATÁLOGO FISCAL E PIPAS/BARRIS
-- ============================================================================
-- Versão: 2.0
-- Data: 2026-07-26
-- Descrição: Adiciona campos fiscais aos produtos e cria tabelas de pipas/barris
--            com suporte a leitura manual e dispositivos físicos
-- ============================================================================

-- ============================================================================
-- 1. ADICIONAR CAMPOS FISCAIS À TABELA PRODUTOS
-- ============================================================================

ALTER TABLE produtos ADD COLUMN IF NOT EXISTS ncm VARCHAR(8);
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS cest VARCHAR(7);
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS cfop VARCHAR(4);
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS cst_icms VARCHAR(2);
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS aliquota_icms DECIMAL(5, 2);
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS cst_pis VARCHAR(2);
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS aliquota_pis DECIMAL(5, 2);
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS cst_cofins VARCHAR(2);
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS aliquota_cofins DECIMAL(5, 2);
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS csosn VARCHAR(3);
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS marca VARCHAR(100);
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS fornecedor_id UUID REFERENCES fornecedores(id) ON DELETE SET NULL;

-- Criar índices para busca rápida de NCM
CREATE INDEX IF NOT EXISTS idx_produtos_ncm ON produtos(ncm);
CREATE INDEX IF NOT EXISTS idx_produtos_codigo_barras ON produtos(codigo_barras);
CREATE INDEX IF NOT EXISTS idx_produtos_nome ON produtos(nome);

-- ============================================================================
-- 2. TABELA DE PIPAS/BARRIS
-- ============================================================================

CREATE TABLE IF NOT EXISTS pipas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  numero_pipa VARCHAR(50) NOT NULL,
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
  capacidade_litros DECIMAL(12, 3) NOT NULL,
  fornecedor_id UUID REFERENCES fornecedores(id) ON DELETE SET NULL,
  data_entrada DATE,
  status VARCHAR(20) DEFAULT 'ativa', -- 'ativa', 'inativa', 'descartada'
  observacoes TEXT,
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(empresa_id, numero_pipa),
  CONSTRAINT chk_status_pipa CHECK (status IN ('ativa', 'inativa', 'descartada')),
  CONSTRAINT chk_capacidade CHECK (capacidade_litros > 0)
);

CREATE INDEX IF NOT EXISTS idx_pipas_empresa_status ON pipas(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_pipas_produto ON pipas(produto_id);

-- ============================================================================
-- 3. TABELA DE LEITURAS DE PIPA
-- ============================================================================

CREATE TABLE IF NOT EXISTS leituras_pipa (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pipa_id UUID NOT NULL REFERENCES pipas(id) ON DELETE CASCADE,
  nivel_litros DECIMAL(12, 3) NOT NULL,
  metodo_leitura VARCHAR(50) NOT NULL, -- 'manual', 'balanca', 'sensor_ultrassonico', 'medidor_fluxo', 'dispositivo'
  dispositivo_id VARCHAR(100), -- ID único do dispositivo físico
  consumo_estimado DECIMAL(12, 3), -- Consumo desde a última leitura
  dados_brutos JSONB, -- Dados brutos do dispositivo (para debug)
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  data_leitura TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_metodo_leitura CHECK (
    metodo_leitura IN ('manual', 'balanca', 'sensor_ultrassonico', 'medidor_fluxo', 'dispositivo')
  )
);

CREATE INDEX IF NOT EXISTS idx_leituras_pipa_data ON leituras_pipa(pipa_id, data_leitura DESC);
CREATE INDEX IF NOT EXISTS idx_leituras_pipa_dispositivo ON leituras_pipa(dispositivo_id);

-- ============================================================================
-- 4. TABELA DE ALERTAS DE PIPAS
-- ============================================================================

CREATE TABLE IF NOT EXISTS alertas_pipa (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pipa_id UUID NOT NULL REFERENCES pipas(id) ON DELETE CASCADE,
  tipo VARCHAR(20) NOT NULL, -- 'CRITICO', 'AVISO', 'INFO'
  mensagem TEXT NOT NULL,
  percentual_ocupacao DECIMAL(5, 2),
  data_alerta TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_resolvido TIMESTAMP,
  CONSTRAINT chk_tipo_alerta CHECK (tipo IN ('CRITICO', 'AVISO', 'INFO'))
);

CREATE INDEX IF NOT EXISTS idx_alertas_pipa_data ON alertas_pipa(pipa_id, data_alerta DESC);

-- ============================================================================
-- 5. VIEWS ÚTEIS PARA RELATÓRIOS
-- ============================================================================

-- View: Status atual de todas as pipas
CREATE OR REPLACE VIEW v_pipas_status AS
SELECT 
  p.id,
  p.empresa_id,
  p.numero_pipa,
  prod.nome as produto_nome,
  p.capacidade_litros,
  (SELECT nivel_litros FROM leituras_pipa WHERE pipa_id = p.id ORDER BY data_leitura DESC LIMIT 1) as nivel_atual,
  (SELECT data_leitura FROM leituras_pipa WHERE pipa_id = p.id ORDER BY data_leitura DESC LIMIT 1) as ultima_leitura,
  CASE 
    WHEN (SELECT nivel_litros FROM leituras_pipa WHERE pipa_id = p.id ORDER BY data_leitura DESC LIMIT 1) IS NULL THEN 100
    ELSE ROUND(((SELECT nivel_litros FROM leituras_pipa WHERE pipa_id = p.id ORDER BY data_leitura DESC LIMIT 1) / p.capacidade_litros) * 100, 2)
  END as percentual_ocupacao,
  p.status,
  f.nome as fornecedor_nome
FROM pipas p
LEFT JOIN produtos prod ON p.produto_id = prod.id
LEFT JOIN fornecedores f ON p.fornecedor_id = f.id;

-- View: Consumo diário por pipa
CREATE OR REPLACE VIEW v_consumo_diario_pipas AS
SELECT 
  p.id,
  p.numero_pipa,
  prod.nome as produto_nome,
  DATE(lp.data_leitura) as data,
  SUM(lp.consumo_estimado) as consumo_total_litros,
  COUNT(lp.id) as total_leituras,
  MIN(lp.nivel_litros) as nivel_minimo,
  MAX(lp.nivel_litros) as nivel_maximo
FROM pipas p
LEFT JOIN leituras_pipa lp ON p.id = lp.pipa_id
LEFT JOIN produtos prod ON p.produto_id = prod.id
WHERE lp.data_leitura IS NOT NULL
GROUP BY p.id, p.numero_pipa, prod.nome, DATE(lp.data_leitura)
ORDER BY DATE(lp.data_leitura) DESC;

-- ============================================================================
-- 6. TRIGGERS PARA AUDITORIA AUTOMÁTICA
-- ============================================================================

-- Trigger: Registrar alertas automaticamente quando nível cai abaixo de 20%
CREATE OR REPLACE FUNCTION fn_alerta_pipa_baixo_nivel()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.nivel_litros / (SELECT capacidade_litros FROM pipas WHERE id = NEW.pipa_id)) < 0.20 THEN
    INSERT INTO alertas_pipa (pipa_id, tipo, mensagem, percentual_ocupacao)
    VALUES (
      NEW.pipa_id,
      'CRITICO',
      'Nível crítico de pipa: ' || ROUND((NEW.nivel_litros / (SELECT capacidade_litros FROM pipas WHERE id = NEW.pipa_id)) * 100, 2) || '%',
      ROUND((NEW.nivel_litros / (SELECT capacidade_litros FROM pipas WHERE id = NEW.pipa_id)) * 100, 2)
    );
  ELSIF (NEW.nivel_litros / (SELECT capacidade_litros FROM pipas WHERE id = NEW.pipa_id)) < 0.50 THEN
    INSERT INTO alertas_pipa (pipa_id, tipo, mensagem, percentual_ocupacao)
    VALUES (
      NEW.pipa_id,
      'AVISO',
      'Nível baixo de pipa: ' || ROUND((NEW.nivel_litros / (SELECT capacidade_litros FROM pipas WHERE id = NEW.pipa_id)) * 100, 2) || '%',
      ROUND((NEW.nivel_litros / (SELECT capacidade_litros FROM pipas WHERE id = NEW.pipa_id)) * 100, 2)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_alerta_pipa_nivel
AFTER INSERT ON leituras_pipa
FOR EACH ROW
EXECUTE FUNCTION fn_alerta_pipa_baixo_nivel();

-- ============================================================================
-- FIM DA MIGRAÇÃO 002
-- ============================================================================
