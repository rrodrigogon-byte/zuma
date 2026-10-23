import { onWhatsappAiWake } from '../core/whatsapp-ai-wake.js';
import crypto from 'node:crypto';
import { db } from '../core/database.js';
import { processWhatsappConversationTask, whatsappAiReady, whatsappMessagingReady } from '../core/whatsapp-ai.js';
import { markCampaignDeliveryBlocked, processCampaignDeliveryTask } from '../core/commerce-campaigns.js';
import { enqueueDueCartRecoveries, markCartRecoveryTaskBlocked, processCartRecoveryTask } from '../core/commerce-abandoned-carts.js';
import { enqueueDueAppointmentReminders, processAppointmentNotificationTask } from '../core/barbershop-appointment-notifications.js';
import { markAutomationTaskBlocked, processAutomationTask } from '../core/ai-automations.js';

const MAX_ATTEMPTS = Math.max(1, Number.parseInt(process.env.WHATSAPP_AI_MAX_ATTEMPTS || '6', 10));
const BATCH_SIZE = Math.min(20, Math.max(1, Number.parseInt(process.env.WHATSAPP_AI_WORKER_BATCH || '5', 10)));
const INTERVAL_MS = Math.min(60000, Math.max(2000, Number.parseInt(process.env.WHATSAPP_AI_WORKER_INTERVAL_MS || '5000', 10)));
const RETENTION_DAYS = Math.min(365, Math.max(7, Number.parseInt(process.env.WHATSAPP_AI_RETENTION_DAYS || '30', 10)));
const HANDOFF_RETENTION_DAYS = Math.min(730, Math.max(30, Number.parseInt(process.env.WHATSAPP_AI_HANDOFF_RETENTION_DAYS || '90', 10)));
const PROVIDER_RETENTION_DAYS = Math.min(730, Math.max(30, Number.parseInt(process.env.WHATSAPP_AI_PROVIDER_RETENTION_DAYS || '90', 10)));
const POLICY_RETENTION_DAYS = Math.min(730, Math.max(90, Number.parseInt(process.env.WHATSAPP_AI_POLICY_RETENTION_DAYS || '180', 10)));
const RETENTION_INTERVAL_SECONDS = Math.min(86400, Math.max(900, Number.parseInt(process.env.WHATSAPP_AI_RETENTION_INTERVAL_SECONDS || '3600', 10)));
const MAINTENANCE_INTERVAL_MS = Math.min(86400000, Math.max(3600000, Number.parseInt(process.env.WHATSAPP_AI_MAINTENANCE_INTERVAL_MS || '21600000', 10)));
const LEASE_SECONDS = Math.min(900, Math.max(30, Number.parseInt(process.env.WHATSAPP_AI_TASK_LEASE_SECONDS || '120', 10)));
const WORKER_ID = cleanWorkerId(process.env.RENDER_INSTANCE_ID || process.env.HOSTNAME || crypto.randomUUID());

function cleanWorkerId(value) {
  return String(value || 'worker').replace(/[^a-zA-Z0-9_.:-]/g, '').slice(0, 120) || 'worker';
}

function safeError(error) {
  return String(error?.message || error || 'erro não identificado').replace(/[\r\n]+/g, ' ').slice(0, 1000);
}

function safeErrorCode(error) {
  const source = String(error?.code || error?.name || 'TASK_ERROR').toUpperCase().replace(/[^A-Z0-9_:-]/g, '_');
  return source.slice(0, 80) || 'TASK_ERROR';
}

export function isTransientWhatsappTaskError(error) {
  if (error?.retryable === false) return false;
  if (error?.retryable === true) return true;
  const status = Number(error?.status || error?.statusCode || 0);
  if (status === 408 || status === 409 || status === 425 || status === 429 || status >= 500) return true;
  const code = safeErrorCode(error);
  if (/NETWORK|TIMEOUT|ABORT|ECONN|EAI_AGAIN|RATE_LIMIT|TEMPORAR|CIRCUIT_OPEN/.test(code)) return true;
  if (/INVALID|REQUIRED|NOT_CONFIGURED|NOT_READY|NOT_FOUND|FORBIDDEN|UNAUTHORIZED|CONSENT|OPT_OUT|CONFLICT|EXPIRED/.test(code)) return false;
  return true;
}

function retryDelay(attempt) {
  return Math.min(1800, 10 * (2 ** Math.max(0, Number(attempt) - 1))) + Math.min(20, Number(attempt) * 2);
}

export async function acquireWhatsappAiWorkerLease({ holder = WORKER_ID, seconds = LEASE_SECONDS } = {}) {
  const result = await db.query(
    `INSERT INTO whatsapp_ai_worker_leases (nome, titular, expira_em)
     VALUES ('whatsapp-ai', $1, CURRENT_TIMESTAMP + ($2::text || ' seconds')::interval)
     ON CONFLICT (nome) DO UPDATE SET
       titular = EXCLUDED.titular,
       expira_em = EXCLUDED.expira_em,
       atualizado_em = CURRENT_TIMESTAMP
     WHERE whatsapp_ai_worker_leases.expira_em <= CURRENT_TIMESTAMP
        OR whatsapp_ai_worker_leases.titular = EXCLUDED.titular
     RETURNING nome, titular, expira_em`,
    [cleanWorkerId(holder), Math.min(900, Math.max(30, Number(seconds) || LEASE_SECONDS))],
  );
  return result.rows[0] || null;
}

async function acquireWhatsappAiRetentionLease({ holder = WORKER_ID, seconds = RETENTION_INTERVAL_SECONDS } = {}) {
  const result = await db.query(
    `INSERT INTO whatsapp_ai_worker_leases (nome, titular, expira_em)
     VALUES ('whatsapp-ai-retention', $1, CURRENT_TIMESTAMP + ($2::text || ' seconds')::interval)
     ON CONFLICT (nome) DO UPDATE SET
       titular = EXCLUDED.titular,
       expira_em = EXCLUDED.expira_em,
       atualizado_em = CURRENT_TIMESTAMP
     WHERE whatsapp_ai_worker_leases.expira_em <= CURRENT_TIMESTAMP
     RETURNING nome, titular, expira_em`,
    [cleanWorkerId(holder), Math.min(86400, Math.max(900, Number(seconds) || RETENTION_INTERVAL_SECONDS))],
  );
  return result.rows[0] || null;
}

async function releaseWhatsappAiWorkerLease(holder = WORKER_ID) {
  await db.query(
    `UPDATE whatsapp_ai_worker_leases
        SET expira_em = CURRENT_TIMESTAMP, atualizado_em = CURRENT_TIMESTAMP
      WHERE nome = 'whatsapp-ai' AND titular = $1`,
    [cleanWorkerId(holder)],
  ).catch(() => null);
}

import { marketingGate, markMarketingSendBlocked, recordMarketingSend, reserveMarketingSend } from '../core/whatsapp-marketing-guard.js';

// Tarefa de marketing fora do horário ou acima do limite volta para a fila, sem contar tentativa.
async function deferTask(task, until, reason) {
  await db.query(
    `UPDATE tarefas_integracao_canais
        SET status = 'pendente', tentativas = GREATEST(0, tentativas - 1), proxima_tentativa_em = $2::timestamptz,
            erro_codigo = $3, lease_token = NULL, lease_expira_em = NULL, data_atualizacao = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'processando' AND lease_token = $4::uuid`,
    [task.id, until.toISOString(), String(reason).slice(0, 60), task.lease_token],
  );
}

export async function claimWhatsappAiTasks(limit = BATCH_SIZE) {
  return db.transaction(async trx => {
    const result = await trx.query(
      `WITH candidates AS (
         SELECT id
           FROM tarefas_integracao_canais
          WHERE ((tipo = 'processar_conversa' AND $3::boolean) OR (tipo IN ('enviar_campanha','recuperar_carrinho','notificar_agendamento','automacao_ia') AND $4::boolean))
            AND tentativas < $1
            AND (
              (status IN ('pendente', 'falha') AND (proxima_tentativa_em IS NULL OR proxima_tentativa_em <= CURRENT_TIMESTAMP))
              OR (status = 'processando' AND (
                    lease_expira_em <= CURRENT_TIMESTAMP
                    OR (lease_expira_em IS NULL AND data_atualizacao <= CURRENT_TIMESTAMP - ($5::text || ' seconds')::interval)
                  ))
            )
          -- Conversa de cliente passa na frente de campanha: um disparo grande não atrasa atendimento.
          ORDER BY (tipo = 'processar_conversa') DESC, criado_em ASC
          FOR UPDATE SKIP LOCKED
          LIMIT $2
       )
       UPDATE tarefas_integracao_canais t
          SET status = 'processando', tentativas = t.tentativas + 1,
              erro = NULL, erro_codigo = NULL, dead_letter_em = NULL,
              lease_token = uuid_generate_v4(),
              lease_expira_em = CURRENT_TIMESTAMP + ($5::text || ' seconds')::interval,
              data_atualizacao = CURRENT_TIMESTAMP
         FROM candidates c
        WHERE t.id = c.id
       RETURNING t.*`,
      [MAX_ATTEMPTS, Math.min(BATCH_SIZE, Math.max(1, Number(limit) || BATCH_SIZE)), whatsappAiReady(), whatsappMessagingReady(), LEASE_SECONDS],
    );
    return result.rows;
  });
}

async function completeTask(task, response) {
  const result = await db.query(
    `UPDATE tarefas_integracao_canais
        SET status = 'concluida', resposta = $2::jsonb, erro = NULL, erro_codigo = NULL,
            proxima_tentativa_em = NULL, concluido_em = CURRENT_TIMESTAMP,
            lease_token = NULL, lease_expira_em = NULL,
            data_atualizacao = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'processando' AND lease_token = $3::uuid`,
    [task.id, JSON.stringify(response || {}), task.lease_token],
  );
  if (!result.rowCount) {
    const error = new Error('lease da tarefa expirou antes da conclusão');
    error.code = 'TASK_LEASE_LOST';
    error.retryable = true;
    throw error;
  }
}

async function failTask(task, error) {
  const transient = isTransientWhatsappTaskError(error);
  const exhausted = !transient || Number(task.tentativas) >= MAX_ATTEMPTS;
  const delay = retryDelay(task.tentativas);
  const message = safeError(error);
  const code = safeErrorCode(error);
  await db.query(
    `UPDATE tarefas_integracao_canais
        SET status = CASE WHEN $4 THEN 'cancelada' ELSE 'falha' END,
            erro = $2, erro_codigo = $3, resposta = NULL,
            dead_letter_em = CASE WHEN $4 THEN CURRENT_TIMESTAMP ELSE NULL END,
            proxima_tentativa_em = CASE WHEN $4 THEN NULL ELSE CURRENT_TIMESTAMP + ($5::text || ' seconds')::interval END,
            lease_token = NULL, lease_expira_em = NULL,
            data_atualizacao = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'processando' AND lease_token = $6::uuid`,
    [task.id, message, code, exhausted, delay, task.lease_token],
  );
  await db.query(
    `UPDATE eventos_integracao_canais
        SET status_processamento = 'falha', erro_processamento = $2
      WHERE id = $1`,
    [task.evento_integracao_id, `${code}: ${message}`.slice(0, 1000)],
  ).catch(() => null);
  await db.query(
    `UPDATE canais_integracao SET ultimo_erro = $2, data_atualizacao = CURRENT_TIMESTAMP WHERE id = $1`,
    [task.canal_id, `${code}: ${message}`.slice(0, 1000)],
  ).catch(() => null);
  if (task.tipo === 'recuperar_carrinho') {
    await db.query(
      `UPDATE commerce_carts
          SET recovery_status = CASE WHEN $3 THEN 'failed' ELSE 'queued' END,
              atualizado_em = CURRENT_TIMESTAMP
        WHERE empresa_id = $1 AND id = $2::uuid AND recovery_reminded_at IS NULL
          AND recovery_status IN ('consented','queued','failed')`,
      [task.empresa_id, task.referencia_externa, exhausted],
    ).catch(() => null);
  }
  return { transient, exhausted, code };
}

export async function cleanupWhatsappAiRetention(days = RETENTION_DAYS, handoffDays = HANDOFF_RETENTION_DAYS) {
  const normalized = Math.min(365, Math.max(7, Number(days) || RETENTION_DAYS));
  const normalizedHandoff = Math.min(730, Math.max(30, Number(handoffDays) || HANDOFF_RETENTION_DAYS));
  return db.transaction(async trx => {
    const regular = await trx.query(
      `DELETE FROM whatsapp_ai_sessions
        WHERE atualizado_em < CURRENT_TIMESTAMP - ($1::text || ' days')::interval
          AND status <> 'humano'`,
      [normalized],
    );
    const handoff = await trx.query(
      `DELETE FROM whatsapp_ai_sessions
        WHERE atualizado_em < CURRENT_TIMESTAMP - ($1::text || ' days')::interval
          AND status = 'humano'`,
      [normalizedHandoff],
    );
    const redactedEvents = await trx.query(
      `UPDATE eventos_integracao_canais e
          SET payload = '{"redacted":true}'::jsonb,
              erro_processamento = CASE WHEN e.erro_processamento IS NULL THEN NULL ELSE split_part(e.erro_processamento, ':', 1) END
        WHERE e.recebido_em < CURRENT_TIMESTAMP - ($1::text || ' days')::interval
          AND e.payload <> '{"redacted":true}'::jsonb
          AND EXISTS (
            SELECT 1 FROM canais_integracao c
             WHERE c.id = e.canal_id AND c.empresa_id = e.empresa_id AND c.provedor = 'whatsapp'
          )`,
      [normalized],
    );
    const scrubbedTasks = await trx.query(
      `UPDATE tarefas_integracao_canais
          SET referencia_externa = NULL, payload = '{}'::jsonb, resposta = NULL,
              erro = CASE WHEN erro_codigo IS NULL THEN NULL ELSE erro_codigo END
        WHERE data_atualizacao < CURRENT_TIMESTAMP - ($1::text || ' days')::interval
          AND tipo IN ('processar_conversa','enviar_campanha','recuperar_carrinho','notificar_agendamento','automacao_ia')
          AND status IN ('concluida','cancelada')
          AND (referencia_externa IS NOT NULL OR payload <> '{}'::jsonb OR resposta IS NOT NULL OR erro IS DISTINCT FROM erro_codigo)`,
      [normalized],
    );
    const deletedEvents = await trx.query(
      `DELETE FROM eventos_integracao_canais e
        WHERE e.recebido_em < CURRENT_TIMESTAMP - ($1::text || ' days')::interval
          AND EXISTS (
            SELECT 1 FROM canais_integracao c
             WHERE c.id = e.canal_id AND c.empresa_id = e.empresa_id AND c.provedor = 'whatsapp'
          )`,
      [normalizedHandoff],
    );
    const deletedProviderRuns = await trx.query(
      `DELETE FROM whatsapp_ai_provider_runs
        WHERE criado_em < CURRENT_TIMESTAMP - ($1::text || ' days')::interval`,
      [PROVIDER_RETENTION_DAYS],
    );
    const deletedPolicyEvents = await trx.query(
      `DELETE FROM whatsapp_ai_policy_events
        WHERE criado_em < CURRENT_TIMESTAMP - ($1::text || ' days')::interval`,
      [POLICY_RETENTION_DAYS],
    );
    return [regular, handoff, redactedEvents, scrubbedTasks, deletedEvents, deletedProviderRuns, deletedPolicyEvents]
      .reduce((total, result) => total + Number(result.rowCount || 0), 0);
  });
}

async function cleanupWhatsappAiRetentionIfDue() {
  const lease = await acquireWhatsappAiRetentionLease();
  return lease ? cleanupWhatsappAiRetention() : 0;
}

export async function runWhatsappAiBatch({ limit = BATCH_SIZE } = {}) {
  const retentionRemoved = await cleanupWhatsappAiRetentionIfDue();
  if (!whatsappAiReady() && !whatsappMessagingReady()) return { skipped: true, reason: 'whatsapp_not_ready', retentionRemoved, claimed: 0, completed: 0, failed: 0 };
  const lease = await acquireWhatsappAiWorkerLease();
  if (!lease) return { skipped: true, reason: 'worker_lease_held', claimed: 0, completed: 0, failed: 0 };
  try {
    const recoveriesQueued = whatsappMessagingReady() ? await enqueueDueCartRecoveries() : 0;
    const appointmentRemindersQueued = whatsappMessagingReady() ? await enqueueDueAppointmentReminders() : 0;
    const tasks = await claimWhatsappAiTasks(limit);
    const summary = { worker: 'whatsapp-ai', runId: crypto.randomUUID(), retentionRemoved, recoveriesQueued, appointmentRemindersQueued, claimed: tasks.length, completed: 0, failed: 0, deadLettered: 0 };
    for (const task of tasks) {
      let gate = null;
      try {
        // Uma conversa pode levar mais que o lease (várias chamadas de IA). Renova o lease do
        // worker e o da tarefa antes de começar cada uma; se a tarefa já foi para outro
        // processo, não é executada de novo aqui.
        await acquireWhatsappAiWorkerLease();
        const renewed = await db.query(
          `UPDATE tarefas_integracao_canais SET lease_expira_em = CURRENT_TIMESTAMP + ($3::text || ' seconds')::interval
            WHERE id = $1 AND status = 'processando' AND lease_token = $2::uuid`,
          [task.id, task.lease_token, LEASE_SECONDS],
        );
        if (!renewed.rowCount) { summary.leaseLost = (summary.leaseLost || 0) + 1; continue; }
        gate = await marketingGate(task);
        if (gate.action === 'defer') { await deferTask(task, gate.until, gate.reason); summary.deferred = (summary.deferred || 0) + 1; continue; }
        if (gate.action === 'skip' && !task.delivery_started_at) {
          if (task.tipo === 'enviar_campanha') await markCampaignDeliveryBlocked(task, gate.reason);
          else if (task.tipo === 'recuperar_carrinho') await markCartRecoveryTaskBlocked(task, gate.reason);
          else if (task.tipo === 'automacao_ia') await markAutomationTaskBlocked(task, gate.reason);
          await markMarketingSendBlocked(task, gate.phone, gate.reason);
          await completeTask(task, { skipped: true, reason: gate.reason });
          summary.completed += 1;
          continue;
        }
        // Uma tarefa com delivery_started_at precisa reconciliar o resultado anterior; o gate
        // não pode transformar um envio possivelmente concluído em skip silencioso.
        if (gate.phone && !task.delivery_started_at) await reserveMarketingSend(task, gate.phone);
        const response = task.tipo === 'enviar_campanha'
          ? await processCampaignDeliveryTask(task)
          : task.tipo === 'recuperar_carrinho'
            ? await processCartRecoveryTask(task)
            : task.tipo === 'notificar_agendamento'
              ? await processAppointmentNotificationTask(task)
              : task.tipo === 'automacao_ia'
                ? await processAutomationTask(task)
                : await processWhatsappConversationTask(task);
        if (gate.phone && response && !response.skipped && !response.blocked && !response.cancelled) await recordMarketingSend(task, gate.phone);
        else if (gate.phone && response && !task.delivery_started_at) await markMarketingSendBlocked(task, gate.phone, response.reason || 'provider_did_not_send');
        await completeTask(task, response);
        summary.completed += 1;
      } catch (error) {
        const failure = await failTask(task, error);
        summary.failed += 1;
        if (failure.exhausted) summary.deadLettered += 1;
      }
    }
    return summary;
  } finally {
    await releaseWhatsappAiWorkerLease();
  }
}

export function startWhatsappAiWorker({ intervalMs = INTERVAL_MS } = {}) {
  const providersReady = whatsappAiReady() || whatsappMessagingReady();
  const effectiveInterval = providersReady
    ? Math.min(60000, Math.max(2000, Number(intervalMs) || INTERVAL_MS))
    : MAINTENANCE_INTERVAL_MS;
  if (!providersReady) console.log('[WhatsApp] provedores inativos; apenas retenção LGPD periódica será executada');
  let running = false;
  let again = false;
  const tick = async () => {
    // Pedido de acordar no meio de um ciclo: roda de novo logo que este terminar.
    if (running) { again = true; return; }
    running = true;
    try {
      const summary = await runWhatsappAiBatch();
      if (summary.claimed || summary.failed) console.log(JSON.stringify(summary));
    } catch (error) {
      console.error('[WhatsApp AI] falha no ciclo:', safeError(error));
    } finally {
      running = false;
      if (again) { again = false; setTimeout(tick, 0).unref?.(); }
    }
  };
  const timer = setInterval(tick, effectiveInterval);
  timer.unref?.();
  // Mensagem nova chegou: responde já, sem esperar o próximo ciclo.
  const stopWake = providersReady ? onWhatsappAiWake(() => { setTimeout(tick, 0).unref?.(); }) : () => {};
  setTimeout(tick, 1000).unref?.();
  console.log(`[WhatsApp] worker ${providersReady ? 'ativo' : 'em modo manutenção'} a cada ${effectiveInterval}ms`);
  return { started: true, stop() { clearInterval(timer); stopWake(); } };
}

async function main() {
  const summary = await runWhatsappAiBatch();
  console.log(JSON.stringify(summary));
  process.exitCode = summary.failed > 0 ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(JSON.stringify({ worker: 'whatsapp-ai', error: safeError(error) }));
    process.exitCode = 1;
  });
}
