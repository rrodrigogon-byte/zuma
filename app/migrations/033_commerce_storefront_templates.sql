/*
 * Migration 033 — Storefront management and promotion templates.
 * Incremental only: migrations 001–032 remain immutable.
 */

CREATE TABLE IF NOT EXISTS commerce_promotion_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
  codigo VARCHAR(80) NOT NULL,
  nome VARCHAR(160) NOT NULL,
  descricao VARCHAR(500),
  tipo VARCHAR(30) NOT NULL,
  valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  regras JSONB NOT NULL DEFAULT '{}'::jsonb,
  ativo BOOLEAN NOT NULL DEFAULT true,
  sistema BOOLEAN NOT NULL DEFAULT false,
  criado_por UUID,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_commerce_promotion_template_type CHECK (tipo IN ('percentage','fixed')),
  CONSTRAINT chk_commerce_promotion_template_value CHECK (valor > 0),
  CONSTRAINT fk_commerce_promotion_template_creator FOREIGN KEY (criado_por)
    REFERENCES usuarios (id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_promotion_template_global_code
  ON commerce_promotion_templates (codigo) WHERE empresa_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_promotion_template_tenant_code
  ON commerce_promotion_templates (empresa_id, codigo) WHERE empresa_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commerce_promotion_template_scope
  ON commerce_promotion_templates (empresa_id, ativo, nome);

INSERT INTO commerce_promotion_templates (empresa_id, codigo, nome, descricao, tipo, valor, regras, ativo, sistema)
VALUES
  (NULL, 'boas-vindas-10', 'Boas-vindas 10%', 'Incentivo para a primeira compra do cliente.', 'percentage', 10, '{"audiencia":"first_purchase"}'::jsonb, true, true),
  (NULL, 'desconto-fixo-20', 'Desconto fixo R$ 20', 'Abatimento fixo para campanhas de aquisição.', 'fixed', 20, '{"minSubtotal":100}'::jsonb, true, true),
  (NULL, 'fim-de-semana-15', 'Fim de semana 15%', 'Campanha de curta duração para aumentar conversão.', 'percentage', 15, '{"dias":["saturday","sunday"]}'::jsonb, true, true),
  (NULL, 'liquidacao-30', 'Liquidação 30%', 'Modelo para queima de estoque com desconto controlado.', 'percentage', 30, '{"estoqueMax":10}'::jsonb, true, true)
ON CONFLICT DO NOTHING;

ALTER TABLE commerce_promotions
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES commerce_promotion_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_commerce_promotion_template_id
  ON commerce_promotions (empresa_id, template_id);
