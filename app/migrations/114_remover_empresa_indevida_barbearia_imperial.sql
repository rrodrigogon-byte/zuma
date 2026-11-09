-- ============================================================================
-- Migration 114: Remover empresas indevidas/de testes do cadastro oficial
-- A única barbearia do ecossistema é a BARBEARIA DINO (CNPJ 50.073.355/0001-89, Tangará da Serra MT).
-- A 'Barbearia Imperial 1521' criada por scripts de teste deve ser removida permanentemente.
-- ============================================================================

DELETE FROM lojas WHERE empresa_id IN (
  SELECT id FROM empresas WHERE nome ILIKE '%imperial%' OR cnpj = '98765432000199' OR nome ILIKE '%homologação alterada%'
);

DELETE FROM empresas WHERE nome ILIKE '%imperial%' OR cnpj = '98765432000199' OR nome ILIKE '%homologação alterada%';
