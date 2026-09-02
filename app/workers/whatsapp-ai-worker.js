import crypto from 'node:crypto';
import { db } from '../core/database.js';
import { processWhatsappConversationTask, whatsappAiReady, whatsappMessagingReady } from '../core/whatsapp-ai.js';
import { processCampaignDeliveryTask } from '../core/commerce-campaigns.js';
import { enqueueDueCartRecoveries, processCartRecoveryTask } from '../core/commerce-abandoned-carts.js';
import { enqueueDueAppointmentReminders, processAppointmentNotificationTask } from '../core/barbershop-appointment-notifications.js';

const MAX_ATTEMPTS = Math.max(1, Number.parseInt(process.env.WHATSAPP_AI_MAX_ATTEMPTS || '6', 10));
const BATCH_SIZE = Math.min(20, Math.max(1, Number.parseInt(process.env.WHATSAPP_AI_WORKER_BATCH || '5', 10)));
const INTERVAL_MS = Math.min(60000, Math.max(2000, Number.parseInt(process.env.WHATSAPP_AI_WORKER_INTERVAL_MS || '5000', 10)));
const RETENTION_DAYS = Math.min(365, Math.max(7, Number.parseInt(process.env.WHATSAPP_AI_RETENTION_DAYS || '30', 10)));
const HANDOFF_RETENTION_DAYS = Math.min(730, Math.max(30, Number.parseInt(process.env.WHATSAPP_AI_HANDOFF_RETENTION_DAYS || '90', 10)));
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

async function releaseWhatsappAiWorkerLease(holder = WORKER_ID) {
  await db.query(
    `UPDATE whatsapp_ai_worker_leases
        SET expira_em = CURRENT_TIMESTAMP, atualizado_em = CURRENT_TIMESTAMP
      WHERE nome = 'whatsapp-ai' AND titular = $1`,
    [cleanWorkerId(holder)],
  ).catch(() => null);
}

export async function claimWhatsappAiTasks(limit = BATCH_SIZE) {
  return db.transaction(async trx => {
    const result = await trx.query(
      `WITH candidates AS (
         SELECT id
           FROM tarefas_integracao_canais
          WHERE ((tipo = 'processar_conversa' AND $3::boolean) OR (tipo IN ('enviar_campanha','recuperar_carrinho','notificar_agendamento') AND $4::boolean))
            AND tentativas < $1
            AND (
              (status IN ('pendente', 'falha') AND (proxima_tentativa_em IS NULL OR proxima_tentativa_em <= CURRENT_TIMESTAMP))
              OR (status = 'processando' AND (
                    lease_expira_em <= CURRENT_TIMESTAMP
                    OR (lease_expira_em IS NULL AND data_atualizacao <= CURRENT_TIMESTAMP - ($5::text || ' seconds')::interval)
                  ))
            )
          ORDER BY criado_em ASC
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
    return Number(regular.rowCount || 0) + Number(handoff.rowCount || 0);
  });
}

export async function runWhatsappAiBatch({ limit = BATCH_SIZE } = {}) {
  if (!whatsappAiReady() && !whatsappMessagingReady()) return { skipped: true, reason: 'whatsapp_not_ready', claimed: 0, completed: 0, failed: 0 };
  const lease = await acquireWhatsappAiWorkerLease();
  if (!lease) return { skipped: true, reason: 'worker_lease_held', claimed: 0, completed: 0, failed: 0 };
  try {
    const removed = await cleanupWhatsappAiRetention();
    const recoveriesQueued = whatsappMessagingReady() ? await enqueueDueCartRecoveries() : 0;
    const appointmentRemindersQueued = whatsappMessagingReady() ? await enqueueDueAppointmentReminders() : 0;
    const tasks = await claimWhatsappAiTasks(limit);
    const summary = { worker: 'whatsapp-ai', runId: crypto.randomUUID(), retentionRemoved: removed, recoveriesQueued, appointmentRemindersQueued, claimed: tasks.length, completed: 0, failed: 0, deadLettered: 0 };
    for (const task of tasks) {
      try {
        const response = task.tipo === 'enviar_campanha'
          ? await processCampaignDeliveryTask(task)
          : task.tipo === 'recuperar_carrinho'
            ? await processCartRecoveryTask(task)
            : task.tipo === 'notificar_agendamento'
              ? await processAppointmentNotificationTask(task)
              : await processWhatsappConversationTask(task);
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
  if (!whatsappAiReady() && !whatsappMessagingReady()) {
    console.log('[WhatsApp] worker inativo: Evolution pendente');
    return { started: false, stop() {} };
  }
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const summary = await runWhatsappAiBatch();
      if (summary.claimed || summary.failed) console.log(JSON.stringify(summary));
    } catch (error) {
      console.error('[WhatsApp AI] falha no ciclo:', safeError(error));
    } finally {
      running = false;
    }
  };
  const timer = setInterval(tick, Math.min(60000, Math.max(2000, Number(intervalMs) || INTERVAL_MS)));
  timer.unref?.();
  setTimeout(tick, 1000).unref?.();
  console.log(`[WhatsApp] worker ativo a cada ${Math.min(60000, Math.max(2000, Number(intervalMs) || INTERVAL_MS))}ms`);
  return { started: true, stop() { clearInterval(timer); } };
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
