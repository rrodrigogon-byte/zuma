-- WhatsApp: adiciona um canal interno separado para lançamento de notas e despesas.
-- Cliente e Gestão permanecem válidos e cada perfil continua único por empresa/unidade.
ALTER TABLE canais_integracao
  DROP CONSTRAINT IF EXISTS chk_canais_integracao_tipo_canal;

ALTER TABLE canais_integracao
  ADD CONSTRAINT chk_canais_integracao_tipo_canal
  CHECK (tipo_canal IN ('cliente', 'gestao', 'lancamentos'));
