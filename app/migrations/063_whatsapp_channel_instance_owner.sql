-- Canal WhatsApp: uma instância ativa pertence a uma única loja da empresa.
-- Preflight read-only de 04/10/2026: 0 grupos duplicados de instância ativa;
-- 0 canais com loja vinculada a outra empresa. Se o estado mudar, a migration
-- deve FALHAR sem corrigir, mesclar ou apagar registros automaticamente.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'canais_integracao'::regclass
       AND conname = 'fk_canais_integracao_loja_empresa'
  ) THEN
    ALTER TABLE canais_integracao
      ADD CONSTRAINT fk_canais_integracao_loja_empresa
      FOREIGN KEY (empresa_id, loja_id) REFERENCES lojas(empresa_id, id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_canais_whatsapp_instancia_ativa
  ON canais_integracao (LOWER(BTRIM(configuracao->>'instance')))
  WHERE provedor = 'whatsapp' AND status = 'ativo'
    AND NULLIF(BTRIM(configuracao->>'instance'), '') IS NOT NULL;
