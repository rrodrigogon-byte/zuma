-- WhatsApp interno Kytto: transporte WAHA privado, sessão e grupo Admin isolados.
-- O atendimento Cliente permanece no transporte legado.

UPDATE canais_integracao
   SET configuracao = COALESCE(configuracao, '{}'::jsonb)
     || jsonb_build_object(
          'transporte', 'waha',
          'provider', 'waha',
          'waha_session', CASE
            WHEN COALESCE(configuracao->>'transporte', '') = 'waha'
              THEN COALESCE(configuracao->>'waha_session', '')
            ELSE ''
          END
        ),
       data_atualizacao = CURRENT_TIMESTAMP
 WHERE provedor = 'whatsapp'
   AND tipo_canal IN ('gestao', 'lancamentos')
   AND COALESCE(configuracao->>'transporte', '') <> 'waha';

-- Nenhum canal interno previamente legado é promovido automaticamente para ativo.
-- A ativação exige a nova seleção explícita do grupo Admin.
UPDATE canais_integracao
   SET status = 'rascunho', data_atualizacao = CURRENT_TIMESTAMP
 WHERE provedor = 'whatsapp'
   AND tipo_canal IN ('gestao', 'lancamentos')
   AND status = 'ativo'
   AND (
     COALESCE(configuracao->>'transporte', '') <> 'waha'
     OR COALESCE(configuracao->>'waha_group_id', '') !~ '^[0-9]{5,30}@g[.]us$'
   );

ALTER TABLE canais_integracao
  DROP CONSTRAINT IF EXISTS chk_whatsapp_internal_waha;

ALTER TABLE canais_integracao
  ADD CONSTRAINT chk_whatsapp_internal_waha
  CHECK (
    provedor <> 'whatsapp'
    OR tipo_canal = 'cliente'
    OR (
      COALESCE(configuracao->>'transporte', '') = 'waha'
      AND status <> 'ativo'
    )
    OR (
      COALESCE(configuracao->>'transporte', '') = 'waha'
      AND COALESCE(configuracao->>'waha_group_id', '') ~ '^[0-9]{5,30}@g[.]us$'
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_canais_integracao_waha_group_ativo
  ON canais_integracao (lower(btrim(configuracao->>'waha_group_id')))
 WHERE provedor = 'whatsapp'
   AND tipo_canal IN ('gestao', 'lancamentos')
   AND status <> 'desativado'
   AND COALESCE(btrim(configuracao->>'waha_group_id'), '') <> '';

CREATE INDEX IF NOT EXISTS idx_canais_integracao_waha_session
  ON canais_integracao (lower(btrim(configuracao->>'waha_session')))
 WHERE provedor = 'whatsapp'
   AND tipo_canal IN ('gestao', 'lancamentos');
