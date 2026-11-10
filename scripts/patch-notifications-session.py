with open('app/core/barbershop-appointment-notifications.js', 'r', encoding='utf8') as f:
    c = f.read()

# 1. Importar phoneMatchKeySql
target_imp = "import { isWhatsappOptOutText, phoneMatchKey } from './whatsapp-phone.js';"
replacement_imp = "import { isWhatsappOptOutText, phoneMatchKey, phoneMatchKeySql } from './whatsapp-phone.js';"

assert target_imp in c, "target_imp não encontrado!"
c = c.replace(target_imp, replacement_imp, 1)

# 2. Registrar envio da notificação em whatsapp_ai_messages e whatsapp_ai_sessions
target_send = """  const resultado = await enviarMensagem({
    whatsapp_api_url: process.env.EVOLUTION_API_URL || canal.api_base_url,
    whatsapp_api_key: process.env.EVOLUTION_API_KEY,
    whatsapp_instance: canal.configuracao?.instance || process.env.EVOLUTION_INSTANCE,
    empresa_id: task.empresa_id, loja_id: task.loja_id, canal_id: task.canal_id,
  }, elegibilidade.telefone, mensagem(snapshot, agendamento, elegibilidade.cliente, evento, resolvePersona(canal.configuracao, process.env, task.empresa_id)));
  if (!resultado?.ok) {
    const unknown = resultado?.uncertain === true;
    if (!unknown) await db.query(`UPDATE tarefas_integracao_canais SET delivery_started_at = NULL WHERE id = $1`, [task.id]);
    throw appointmentDeliveryError(unknown ? 'resultado da notificação incerto' : 'Evolution recusou a notificação de agenda', unknown ? 'APPOINTMENT_DELIVERY_UNKNOWN' : 'APPOINTMENT_SEND_FAILED', !unknown && resultado?.retryable === true);
  }
  const providerMessageId = limpo(resultado?.data?.key?.id || resultado?.data?.id, 200) || null;
  await db.query(`UPDATE tarefas_integracao_canais SET provider_message_id = $2 WHERE id = $1`, [task.id, providerMessageId]);"""

replacement_send = """  const textoMsg = mensagem(snapshot, agendamento, elegibilidade.cliente, evento, resolvePersona(canal.configuracao, process.env, task.empresa_id));
  const resultado = await enviarMensagem({
    whatsapp_api_url: process.env.EVOLUTION_API_URL || canal.api_base_url,
    whatsapp_api_key: process.env.EVOLUTION_API_KEY,
    whatsapp_instance: canal.configuracao?.instance || process.env.EVOLUTION_INSTANCE,
    empresa_id: task.empresa_id, loja_id: task.loja_id, canal_id: task.canal_id,
  }, elegibilidade.telefone, textoMsg);
  if (!resultado?.ok) {
    const unknown = resultado?.uncertain === true;
    if (!unknown) await db.query(`UPDATE tarefas_integracao_canais SET delivery_started_at = NULL WHERE id = $1`, [task.id]);
    throw appointmentDeliveryError(unknown ? 'resultado da notificação incerto' : 'Evolution recusou a notificação de agenda', unknown ? 'APPOINTMENT_DELIVERY_UNKNOWN' : 'APPOINTMENT_SEND_FAILED', !unknown && resultado?.retryable === true);
  }
  const providerMessageId = limpo(resultado?.data?.key?.id || resultado?.data?.id, 200) || null;
  await db.query(`UPDATE tarefas_integracao_canais SET provider_message_id = $2 WHERE id = $1`, [task.id, providerMessageId]);

  // Registra no histórico de conversa da sessão para que o T-Rex saiba que o último envio foi um lembrete/confirmação
  try {
    const sessaoRes = await db.query(
      `SELECT id FROM whatsapp_ai_sessions WHERE canal_id = $1 AND ${phoneMatchKeySql('telefone')} = ${phoneMatchKeySql('$2')} LIMIT 1`,
      [task.canal_id, elegibilidade.telefone]
    );
    const sessaoId = sessaoRes.rows[0]?.id;
    if (sessaoId) {
      await db.query(
        `INSERT INTO whatsapp_ai_messages
          (empresa_id, loja_id, canal_id, sessao_id, direcao, papel, evento_externo_id, conteudo, metadados, delivery_status, delivered_at)
         VALUES ($1, $2, $3, $4, 'saida', 'assistant', $5, $6, $7::jsonb, 'sent', CURRENT_TIMESTAMP)
         ON CONFLICT (canal_id, evento_externo_id) WHERE evento_externo_id IS NOT NULL DO NOTHING`,
        [task.empresa_id, task.loja_id, task.canal_id, sessaoId, `notif:${appointmentId}:${evento}:${Date.now()}`, textoMsg, JSON.stringify({ kind: 'reminder', tipo: evento, appointmentId })]
      );
      await db.query(
        `UPDATE whatsapp_ai_sessions
            SET estado = estado || $1::jsonb, atualizado_em = CURRENT_TIMESTAMP
          WHERE id = $2`,
        [JSON.stringify({ ultimoLembreteEnviadoEm: new Date().toISOString(), ultimoAgendamentoLembradoId: appointmentId }), sessaoId]
      );
    }
  } catch (errGravar) {
    // Gravação da mensagem não interrompe a tarefa concluída com sucesso
  }"""

assert target_send in c, "target_send não encontrado!"
c = c.replace(target_send, replacement_send, 1)

with open('app/core/barbershop-appointment-notifications.js', 'w', encoding='utf8') as f:
    f.write(c)

print("barbershop-appointment-notifications.js atualizado com sucesso!")
