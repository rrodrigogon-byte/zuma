// ============================================================================
// EQUIPE ASSUMIU PELO CELULAR → A IA SAI DA FRENTE
//
// O backend do WhatsApp (mesmo do NossaGente) roda como "aparelho conectado" no
// número da Dino: a recepção continua respondendo pelo celular. Sem esta regra,
// a IA e a recepção responderiam o mesmo cliente ao mesmo tempo.
//
// Contrato do backend: cada mensagem que SAI do número vem com role=assistant e
// interactionType = "bot" (enviada pela API: IA, lembrete, campanha) ou
// "organic" (digitada por uma pessoa no celular/WhatsApp Web). Só "organic"
// pausa. Mensagem sem interactionType NÃO pausa (fail-safe: na dúvida, a IA
// segue; nunca fica muda por um campo ausente).
//
// Pausa: a conversa vai para a equipe (status 'humano', motivo
// 'equipe_no_celular') até `WHATSAPP_AI_STAFF_PAUSE_MIN` depois da ÚLTIMA
// mensagem da equipe (padrão 120 min; 15–720). Cada nova mensagem da equipe
// estende a pausa. Ao vencer, a IA volta sozinha na próxima mensagem do cliente
// (ou na próxima consulta). A equipe também pode liberar antes pelo painel.
//
// Idempotente: guarda `estado.staffLastAt`; a mesma mensagem lida de novo a
// cada 5 s não reabre uma pausa que a equipe já liberou no painel.
//
// Desligar: WHATSAPP_AI_STAFF_TAKEOVER=off.
// ============================================================================

import { db } from './database.js';
import { isaChatId } from './whatsapp-provider.js';

export const STAFF_REASON = 'equipe_no_celular';

export function staffTakeoverEnabled() {
  return String(process.env.WHATSAPP_AI_STAFF_TAKEOVER || 'on').trim().toLowerCase() !== 'off';
}

export function staffPauseMinutes() {
  const minutos = Number.parseInt(process.env.WHATSAPP_AI_STAFF_PAUSE_MIN || '120', 10);
  return Math.min(720, Math.max(15, Number.isFinite(minutos) ? minutos : 120));
}

/** Mensagem de saída digitada por uma pessoa (não pela API)? */
export function isStaffTyped(item = {}) {
  if (String(item.role || '').toLowerCase() !== 'assistant') return false;
  return String(item.interactionType || '').trim().toLowerCase() === 'organic';
}

/**
 * Da lista de saídas do backend, a última mensagem da equipe por contato.
 * Devolve [{ phone, at: Date }] (sem grupos, sem horário inválido).
 */
export function latestStaffMessages(items = []) {
  const porContato = new Map();
  for (const item of items) {
    if (!isStaffTyped(item)) continue;
    const phone = isaChatId(item.chatId);
    const at = new Date(item.timestamp);
    if (!phone || !Number.isFinite(at.valueOf())) continue;
    const atual = porContato.get(phone);
    if (!atual || at > atual) porContato.set(phone, at);
  }
  return [...porContato].map(([phone, at]) => ({ phone, at }));
}

/**
 * Coloca a conversa com a equipe (ou estende a pausa). Não troca o motivo de
 * uma conversa que já está com a equipe por outro motivo (reclamação, segurança…):
 * só registra a mensagem da equipe.
 */
export async function pauseForStaff(canal, { phone, at }, { pauseMin = staffPauseMinutes() } = {}) {
  if (!canal?.id || !phone || !(at instanceof Date)) return { paused: false, reason: 'invalid' };
  const ate = new Date(at.valueOf() + pauseMin * 60 * 1000);
  if (ate <= new Date()) return { paused: false, reason: 'already_expired' };
  const remoteJid = `${phone}@s.whatsapp.net`;
  return db.transaction(async (trx) => {
    const sessao = await trx.query(
      `INSERT INTO whatsapp_ai_sessions (empresa_id, loja_id, canal_id, remote_jid, telefone, status, estado)
       VALUES ($1, $2, $3, $4, $5, 'ativo', '{}'::jsonb)
       ON CONFLICT (canal_id, remote_jid) DO UPDATE SET telefone = EXCLUDED.telefone
       RETURNING id, status, handoff_reason, estado, acao_pendente`,
      [canal.empresa_id, canal.loja_id, canal.id, remoteJid, phone],
    );
    const s = sessao.rows[0];
    const ultima = Date.parse(s.estado?.staffLastAt || '');
    if (Number.isFinite(ultima) && at.valueOf() <= ultima) return { paused: false, reason: 'already_seen', sessionId: s.id };

    // Já com a equipe por OUTRO motivo: só anota a mensagem da equipe.
    if (s.status === 'humano' && s.handoff_reason && s.handoff_reason !== STAFF_REASON) {
      await trx.query(
        `UPDATE whatsapp_ai_sessions
            SET estado = COALESCE(estado, '{}'::jsonb) || jsonb_build_object('staffLastAt', $2::text), atualizado_em = CURRENT_TIMESTAMP
          WHERE id = $1`,
        [s.id, at.toISOString()],
      );
      return { paused: false, reason: 'already_with_staff', sessionId: s.id };
    }

    // Ação preparada pela IA não sobrevive: a equipe decide do zero.
    await trx.query(
      `UPDATE whatsapp_ai_actions SET status = 'cancelada'
        WHERE empresa_id = $2 AND status = 'preparada'
          AND id::text = (SELECT acao_pendente->>'actionId' FROM whatsapp_ai_sessions WHERE id = $1)`,
      [s.id, canal.empresa_id],
    ).catch(() => null);
    await trx.query(
      `UPDATE whatsapp_ai_sessions
          SET status = 'humano',
              handoff_requested_at = COALESCE(handoff_requested_at, CURRENT_TIMESTAMP),
              handoff_reason = $2::text,
              priority = GREATEST(priority, 1::smallint),
              acao_pendente = NULL,
              closed_at = NULL,
              estado = COALESCE(estado, '{}'::jsonb) || jsonb_build_object('handoffReason', $2::text, 'staffLastAt', $3::text, 'staffPauseUntil', $4::text),
              atualizado_em = CURRENT_TIMESTAMP
        WHERE id = $1`,
      [s.id, STAFF_REASON, at.toISOString(), ate.toISOString()],
    );
    return { paused: true, sessionId: s.id, until: ate };
  });
}

/**
 * Devolve à IA as conversas cuja pausa por mensagem da equipe venceu.
 * `filtro` opcional limita a um canal/contato (usado ao receber mensagem).
 */
export async function releaseExpiredStaffPauses(executor = db, { canalId = null, remoteJid = null } = {}) {
  const resultado = await executor.query(
    `UPDATE whatsapp_ai_sessions
        SET status = 'ativo', handoff_requested_at = NULL, handoff_reason = NULL,
            assigned_to = NULL, assigned_at = NULL, priority = 0,
            estado = (estado - 'handoffReason') - 'staffPauseUntil',
            atualizado_em = CURRENT_TIMESTAMP
      WHERE status = 'humano' AND handoff_reason = $1
        
        AND ((estado->>'staffPauseUntil')::timestamptz <= CURRENT_TIMESTAMP OR (estado->>'staffPauseUntil') IS NULL)
        AND ($2::uuid IS NULL OR canal_id = $2::uuid)
        AND ($3::text IS NULL OR remote_jid = $3::text)
      RETURNING id`,
    [STAFF_REASON, canalId, remoteJid],
  );
  return resultado.rows.length;
}
