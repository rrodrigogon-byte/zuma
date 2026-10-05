// ============================================================================
// RETOMADA AUTÔNOMA DE CONVERSA PARADA
//
// O atendente prepara o agendamento/pedido, mostra o resumo e o cliente some
// (foi atender alguém, esqueceu). Antes, a ação expirava em 30 min (hoje WHATSAPP_AI_ACTION_TTL_MIN, padrão 120) e o horário
// se perdia. Agora o atendente dá UM toque educado, dentro da própria conversa
// (atendimento, não marketing), ainda dentro da validade da ação:
//
//   "Oi, Rafael! Ficou faltando só sua confirmação: Corte com Bruno amanhã às 15h.
//    Responda SIM para confirmar ou NÃO para desistir. Se preferir outro horário,
//    é só me dizer."
//
// Travas: no máximo 1 toque por ação; nunca em conversa com a equipe (humano);
// nunca no horário silencioso (21h–8h Cuiabá); só se o cliente já viu o resumo;
// só enquanto a ação ainda pode ser confirmada; desligável por
// WHATSAPP_AI_FOLLOWUP=off. A mensagem entra no histórico da conversa.
// ============================================================================

import { db } from './database.js';
import { enviarMensagem } from './whatsapp.js';
import { quietHours } from './ai-automations.js';
import { CONFIRMATION_HINT, actionTtlMinutes, formatActionSummary, isGenericCustomerName } from './whatsapp-ai-intents.js';

const clean = (value, max = 600) => String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);

export function followUpEnabled() {
  return !['off', 'false', '0'].includes(clean(process.env.WHATSAPP_AI_FOLLOWUP, 10).toLowerCase());
}

export function followUpAfterMinutes() {
  const value = Number.parseInt(process.env.WHATSAPP_AI_FOLLOWUP_AFTER_MIN || '12', 10);
  return Math.min(actionTtlMinutes() - 5, Math.max(5, Number.isFinite(value) ? value : 12));
}

function firstName(value) {
  const name = clean(value, 80).split(/\s+/)[0] || '';
  if (isGenericCustomerName(name)) return '';
  return /^[\p{L}'-]{2,30}$/u.test(name) ? name : '';
}

export function followUpText(session = {}) {
  // Nome do perfil do WhatsApp ou, sem ele, o nome que o cliente deu ao marcar.
  const nome = firstName(session.nome) || firstName(session.nome_na_acao);
  const resumo = formatActionSummary(clean(session.acao_pendente?.summary, 400));
  return `${nome ? `Oi, ${nome}!` : 'Oi!'} Ficou faltando só sua confirmação: ${resumo}.\n${CONFIRMATION_HINT} Se preferir outro horário ou produto, é só me dizer.`;
}

/**
 * Decide se a sessão merece o toque agora. Puro.
 * @returns {{ send: boolean, reason: string }}
 */
export function planPendingFollowUp(session = {}, { now = new Date(), afterMin = followUpAfterMinutes() } = {}) {
  const pending = session.acao_pendente;
  if (!pending?.actionId) return { send: false, reason: 'no_pending_action' };
  if (pending.mostrado !== true) return { send: false, reason: 'summary_not_shown' };
  if (session.status === 'humano' || session.status === 'encerrado') return { send: false, reason: 'not_automated' };
  if (session.estado?.followup?.actionId === pending.actionId) return { send: false, reason: 'already_followed_up' };
  if (quietHours(now)) return { send: false, reason: 'quiet_hours' };
  const preparedAt = new Date(pending.preparadoEm || session.atualizado_em || 0).valueOf();
  const lastCustomer = new Date(session.ultima_interacao_em || 0).valueOf();
  if (!Number.isFinite(preparedAt) || !preparedAt) return { send: false, reason: 'unknown_age' };
  const nowMs = now.valueOf();
  if (nowMs - preparedAt >= (actionTtlMinutes() - 3) * 60000) return { send: false, reason: 'action_expiring' };
  const idleSince = Math.max(preparedAt, Number.isFinite(lastCustomer) ? lastCustomer : 0);
  if (nowMs - idleSince < afterMin * 60000) return { send: false, reason: 'too_soon' };
  if (!clean(pending.summary)) return { send: false, reason: 'empty_summary' };
  return { send: true, reason: 'customer_idle_before_confirmation' };
}

async function candidateSessions(now) {
  const result = await db.queryRead(
    `SELECT s.*, c.api_base_url, c.configuracao, c.nome AS canal_nome,
            a.solicitacao->>'customerName' AS nome_na_acao
       FROM whatsapp_ai_sessions s
       JOIN canais_integracao c ON c.id = s.canal_id AND c.status = 'ativo' AND c.provedor = 'whatsapp'
       LEFT JOIN whatsapp_ai_actions a ON a.id::text = s.acao_pendente->>'actionId' AND a.empresa_id = s.empresa_id
      WHERE s.acao_pendente IS NOT NULL
        AND s.status = 'ativo'
        AND s.acao_pendente->>'mostrado' = 'true'
        AND s.atualizado_em > $1::timestamptz - make_interval(mins => $2::int)
      ORDER BY s.atualizado_em ASC
      LIMIT 50`,
    [now.toISOString(), actionTtlMinutes() + 10],
  );
  return result.rows;
}

/** Marca o toque antes de enviar: só um worker vence e a ação nunca recebe dois toques. */
async function claimFollowUp(session, now) {
  const result = await db.query(
    `UPDATE whatsapp_ai_sessions
        SET estado = jsonb_set(COALESCE(estado, '{}'::jsonb), '{followup}', $4::jsonb, true)
      WHERE id = $1 AND empresa_id = $2 AND loja_id = $3
        AND status = 'ativo'
        AND acao_pendente->>'actionId' = $5
        AND COALESCE(estado->'followup'->>'actionId', '') <> $5
        -- cliente já respondeu e a mensagem ainda está na fila: não cutucar
        AND NOT EXISTS (
          SELECT 1 FROM tarefas_integracao_canais t
           WHERE t.canal_id = whatsapp_ai_sessions.canal_id
             AND t.tipo = 'processar_conversa'
             AND t.referencia_externa = whatsapp_ai_sessions.remote_jid
             AND t.status IN ('pendente', 'processando', 'falha')
             AND t.criado_em > CURRENT_TIMESTAMP - INTERVAL '1 hour')
      RETURNING id`,
    [session.id, session.empresa_id, session.loja_id, JSON.stringify({ actionId: session.acao_pendente.actionId, at: now.toISOString() }), String(session.acao_pendente.actionId)],
  );
  return Boolean(result.rows[0]);
}

async function recordFollowUpMessage(session, text, delivered, providerResult) {
  await db.query(
    `INSERT INTO whatsapp_ai_messages
      (empresa_id, loja_id, canal_id, sessao_id, direcao, papel, evento_externo_id, conteudo, metadados, delivery_status)
     VALUES ($1, $2, $3, $4, 'saida', 'assistant', $5, $6, $7::jsonb, $8)
     ON CONFLICT (canal_id, evento_externo_id) WHERE evento_externo_id IS NOT NULL DO NOTHING`,
    [session.empresa_id, session.loja_id, session.canal_id, session.id, `followup:${session.acao_pendente.actionId}`.slice(0, 200), text,
      JSON.stringify({ kind: 'pending_followup', delivered, status: providerResult?.status || null }), delivered ? 'sent' : 'failed'],
  ).catch(() => null);
}

/**
 * Uma rodada: encontra conversas paradas antes da confirmação e manda o toque.
 * Dependências injetáveis para teste.
 */
export async function runPendingFollowUpRound({ now = new Date(), loadSessions = candidateSessions, claim = claimFollowUp, send = enviarMensagem, record = recordFollowUpMessage } = {}) {
  if (!followUpEnabled()) return { skipped: true, reason: 'disabled' };
  if (quietHours(now)) return { skipped: true, reason: 'quiet_hours' };
  const sessions = await loadSessions(now);
  const summary = { avaliadas: sessions.length, enviadas: 0, falhas: 0 };
  for (const session of sessions) {
    const plan = planPendingFollowUp(session, { now });
    if (!plan.send) continue;
    if (!await claim(session, now)) continue;
    const text = followUpText(session);
    const result = await send({
      nome: session.configuracao?.display_name || session.canal_nome || 'Atendimento da unidade',
      whatsapp_api_url: session.api_base_url || undefined,
      whatsapp_instance: session.configuracao?.instance || undefined,
      empresa_id: session.empresa_id, loja_id: session.loja_id, canal_id: session.canal_id,
    }, session.telefone, text).catch(() => ({ ok: false }));
    await record(session, text, Boolean(result?.ok), result);
    if (result?.ok) summary.enviadas += 1; else summary.falhas += 1;
  }
  return summary;
}

export function startPendingFollowUpWorker() {
  if (!followUpEnabled() || process.env.COMMERCE_CORE_ENABLED !== '1') return null;
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const summary = await runPendingFollowUpRound();
      if (summary?.enviadas || summary?.falhas) console.log(JSON.stringify({ worker: 'whatsapp-ai-followup', ...summary }));
    } catch (error) {
      console.warn('[WhatsApp AI] retomada de conversa:', String(error?.message || error).slice(0, 200));
    } finally {
      running = false;
    }
  }, 60 * 1000);
  timer.unref?.();
  return timer;
}
