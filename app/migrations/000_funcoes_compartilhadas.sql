-- ============================================================================
-- KYTTO ERP — FUNÇÕES COMPARTILHADAS DE BANCO
-- Esta migração precisa executar antes das migrações que registram gatilhos de
-- atualização automática. É idempotente e segura para bancos já existentes.
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
