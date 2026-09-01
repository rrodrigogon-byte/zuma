import crypto from 'node:crypto';
import { db } from '../core/database.js';
import { processWhatsappConversationTask, whatsappAiReady, whatsappMessagingReady } from '../core/whatsapp-ai.js';
import { processCampaignDeliveryTask } from '../core/commerce-campaigns.js';

const MAX_ATTEMPTS = Math.max(1, Number.parseInt(process.env.WHATSAPP_AI_MAX_ATTEMPTS || '6', 10));
const BATCH_SIZE = Math.min(20, Math.max(1, Number.parseInt(process.env.WHATSAPP_AI_WORKER_BATCH || '5', 10)));
const INTERVAL_MS = Math.min(60000, Math.max(2000, Number.parseInt(process.env.WHATSAPP_AI_WORKER_INTERVAL_MS || '5000', 10)));
const RETENTION_DAYS = Math.min(365, Math.max(7, Number.parseInt(process.env.WHATSAPP_AI_RETENTION_DAYS || '30', 10)));

function safeError(error) {
  return String(error?.message || error || 'erro não identificado').replace(/[\r\n]+/g, ' ').slice(0, 1000);
}

function retryDelay(attempt) {
  return Math.min(1800, 10 * (2 ** Math.max(0, Number(attempt) - 1))) + Math.min(20, Number(attempt) * 2);
}

export async function claimWhatsappAiTasks(limit = BATCH_SIZE) {
  return db.transaction(async trx => {
    const result = await trx.query(
      `WITH candidates AS (
         SELECT id
           FROM tarefas_integracao_canais
          WHERE ((tipo = 'processar_conversa' AND $3::boolean) OR (tipo = 'enviar_campanha' AND $4::boolean))
            AND status IN ('pendente', 'falha')
            AND tentativas < $1
            AND (proxima_tentativa_em IS NULL OR proxima_tentativa_em <= CURRENT_TIMESTAMP)
          ORDER BY criado_em ASC
          FOR UPDATE SKIP LOCKED
          LIMIT $2
       )
       UPDATE tarefas_integracao_canais t
          SET status = 'processando', tentativas = t.tentativas + 1,
              erro = NULL, data_atualizacao = CURRENT_TIMESTAMP
         FROM candidates c
        WHERE t.id = c.id
       RETURNING t.*`,
      [MAX_ATTEMPTS, Math.min(BATCH_SIZE, Math.max(1, Number(limit) || BATCH_SIZE)), whatsappAiReady(), whatsappMessagingReady()],
    );
    return result.rows;
  });
}

async function completeTask(task, response) {
  await db.query(
    `UPDATE tarefas_integracao_canais
        SET status = 'concluida', resposta = $2::jsonb, erro = NULL,
            proxima_tentativa_em = NULL, concluido_em = CURRENT_TIMESTAMP,
            data_atualizacao = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'processando'`,
    [task.id, JSON.stringify(response || {})],
  );
}

async function failTask(task, error) {
  const exhausted = task.tipo === 'enviar_campanha' || Number(task.tentativas) >= MAX_ATTEMPTS;
  const delay = retryDelay(task.tentativas);
  const message = safeError(error);
  await db.query(
    `UPDATE tarefas_integracao_canais
        SET status = CASE WHEN $3 THEN 'cancelada' ELSE 'falha' END, erro = $2, resposta = NULL,
            proxima_tentativa_em = CASE WHEN $3 THEN NULL ELSE CURRENT_TIMESTAMP + ($4::text || ' seconds')::interval END,
            data_atualizacao = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'processando'`,
    [task.id, message, exhausted, delay],
  );
  await db.query(
    `UPDATE eventos_integracao_canais
        SET status_processamento = 'falha', erro_processamento = $2
      WHERE id = $1`,
    [task.evento_integracao_id, message],
  ).catch(() => null);
  await db.query(
    `UPDATE canais_integracao SET ultimo_erro = $2, data_atualizacao = CURRENT_TIMESTAMP WHERE id = $1`,
    [task.canal_id, message],
  ).catch(() => null);
}

export async function cleanupWhatsappAiRetention(days = RETENTION_DAYS) {
  const result = await db.query(
    `DELETE FROM whatsapp_ai_sessions
      WHERE atualizado_em < CURRENT_TIMESTAMP - ($1::text || ' days')::interval
        AND status <> 'humano'`,
    [Math.min(365, Math.max(7, Number(days) || RETENTION_DAYS))],
  );
  return Number(result.rowCount || 0);
}

export async function runWhatsappAiBatch({ limit = BATCH_SIZE } = {}) {
  if (!whatsappAiReady() && !whatsappMessagingReady()) return { skipped: true, reason: 'whatsapp_not_ready', claimed: 0, completed: 0, failed: 0 };
  const removed = await cleanupWhatsappAiRetention();
  const tasks = await claimWhatsappAiTasks(limit);
  const summary = { worker: 'whatsapp-ai', runId: crypto.randomUUID(), retentionRemoved: removed, claimed: tasks.length, completed: 0, failed: 0 };
  for (const task of tasks) {
    try {
      const response = task.tipo === 'enviar_campanha'
        ? await processCampaignDeliveryTask(task)
        : await processWhatsappConversationTask(task);
      await completeTask(task, response);
      summary.completed += 1;
    } catch (error) {
      await failTask(task, error);
      summary.failed += 1;
    }
  }
  return summary;
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
