-- ============================================================================
-- Migration 114: Desativar empresas indevidas/de testes do cadastro oficial
-- Devido ao trigger de auditoria imutável, desativamos permanentemente com ativa = false.
-- A única barbearia do ecossistema é a BARBEARIA DINO (CNPJ 50.073.355/0001-89, Tangará da Serra MT).
-- ============================================================================

UPDATE empresas 
   SET ativa = false, 
       nome = '[DESATIVADA] Barbearia Imperial 1521' 
 WHERE nome ILIKE '%imperial%' OR cnpj = '98765432000199';

UPDATE lojas 
   SET ativa = false, 
       nome = '[DESATIVADA] Loja Imperial' 
 WHERE empresa_id IN (
   SELECT id FROM empresas WHERE nome ILIKE '%imperial%' OR cnpj = '98765432000199'
 );

UPDATE empresas 
   SET ativa = false 
 WHERE nome ILIKE '%homologação alterada%' OR cnpj = '11222333000181';
