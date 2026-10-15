-- WhatsApp: separa o atendimento de clientes do canal interno de gestão.
-- A coluna é aditiva e mantém todos os canais existentes como cliente.
ALTER TABLE canais_integracao
  ADD COLUMN IF NOT EXISTS tipo_canal VARCHAR(20) NOT NULL DEFAULT 'cliente';

UPDATE canais_integracao
   SET tipo_canal = 'cliente'
 WHERE tipo_canal IS NULL OR tipo_canal NOT IN ('cliente', 'gestao');

ALTER TABLE canais_integracao
  DROP CONSTRAINT IF EXISTS uq_canais_integracao_loja_provedor;

ALTER TABLE canais_integracao
  DROP CONSTRAINT IF EXISTS chk_canais_integracao_tipo_canal;

ALTER TABLE canais_integracao
  ADD CONSTRAINT chk_canais_integracao_tipo_canal
  CHECK (tipo_canal IN ('cliente', 'gestao'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_canais_integracao_loja_provedor_tipo
  ON canais_integracao (empresa_id, loja_id, provedor, tipo_canal);

CREATE UNIQUE INDEX IF NOT EXISTS uq_canais_integracao_whatsapp_instance_ativa
  ON canais_integracao (provedor, lower(btrim(configuracao->>'instance')))
 WHERE provedor = 'whatsapp'
   AND status <> 'desativado'
   AND COALESCE(btrim(configuracao->>'instance'), '') <> '';

CREATE INDEX IF NOT EXISTS idx_canais_integracao_empresa_tipo
  ON canais_integracao (empresa_id, loja_id, provedor, tipo_canal, status);
