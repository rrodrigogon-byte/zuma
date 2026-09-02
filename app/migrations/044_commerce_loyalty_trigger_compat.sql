-- ============================================================================
-- KYTTO COMMERCE CORE — função compartilhada para triggers de fidelidade
-- Executada antes de 044_loyalty_levels_rewards.sql.
--
-- O executor Commerce não inclui a migration legada 000, mas a migration 044
-- registra triggers que dependem desta função. CREATE OR REPLACE é idempotente
-- e preserva a função caso ela já exista em um ambiente legado.
-- ============================================================================

CREATE OR REPLACE FUNCTION atualizar_data_atualizacao()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.data_atualizacao = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;
