-- Migration 046 — notificações governadas da agenda da Barbearia
-- A fila reutiliza tarefas_integracao_canais; não envia nem ativa canais durante o deploy.

BEGIN;

ALTER TABLE tarefas_integracao_canais DROP CONSTRAINT IF EXISTS tarefas_integracao_canais_tipo_check;
ALTER TABLE tarefas_integracao_canais DROP CONSTRAINT IF EXISTS chk_tarefas_integracao_tipo;
ALTER TABLE tarefas_integracao_canais
  ADD CONSTRAINT chk_tarefas_integracao_tipo
  CHECK (tipo IN (
    'buscar_pedido',
    'reconciliar',
    'sincronizar_catalogo',
    'processar_conversa',
    'enviar_campanha',
    'recuperar_carrinho',
    'notificar_agendamento'
  ));

CREATE UNIQUE INDEX IF NOT EXISTS uq_tarefas_notificar_agendamento
  ON tarefas_integracao_canais (empresa_id, tipo, referencia_externa)
  WHERE tipo = 'notificar_agendamento';

CREATE INDEX IF NOT EXISTS idx_tarefas_notificar_agendamento_fila
  ON tarefas_integracao_canais (empresa_id, loja_id, status, proxima_tentativa_em, criado_em)
  WHERE tipo = 'notificar_agendamento';

COMMIT;
