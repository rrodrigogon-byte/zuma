import crypto from 'node:crypto';
import {
  DinoOperationalError,
  claimDinoEffects,
  completeDinoEffect,
  failDinoEffect,
} from '../core/dino-operational-outbox.js';
import { db as defaultCommerceDb } from '../core/database.js';
import { createDinoForecastAiHandler } from '../dino-projecao-ia.js';

const DEFAULT_LIMIT = 10;
const DEFAULT_INTERVAL_MS = 5000;
const DEFAULT_MAX_ATTEMPTS = 6;
const DEFAULT_LEASE_SECONDS = 120;
const MAX_LIMIT = 100;
const MAX_INTERVAL_MS = 60000;
const MIN_INTERVAL_MS = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Handler interno do efeito NPS. Ele não dispara integração externa: só
 * confirma a existência da resposta no escopo reivindicado. Sem a flag não há
 * consulta; sem resposta comprovada a tarefa falha/dead-lettera, nunca sucede.
 */
export function createDinoNpsProcessHandler({ db = defaultCommerceDb, canonicalEnabled = () => process.env.DINO_NPS_CANONICAL_ENABLED === '1' } = {}) {
  return async task => {
    if (canonicalEnabled() !== true && canonicalEnabled() !== '1') {
      throw Object.assign(new Error('NPS canônico desabilitado.'), { code: 'DINO_NPS_CANONICAL_DISABLED', retryable: false });
    }
    const empresaId = String(task?.empresa_id || task?.empresaId || '').trim();
    const lojaId = String(task?.loja_id || task?.lojaId || '').trim();
    const payload = typeof task?.payload_sanitizado === 'string'
      ? JSON.parse(task.payload_sanitizado)
      : (task?.payload_sanitizado || task?.payloadSanitizado || {});
    const responseId = String(payload?.responseId || payload?.response_id || '').trim();
    if (!UUID.test(empresaId) || !UUID.test(lojaId) || !UUID.test(responseId)) {
      throw Object.assign(new Error('Escopo ou resposta NPS inválidos.'), { code: 'DINO_NPS_TASK_INVALID', retryable: false });
    }
    const result = await db.queryRead(
      `SELECT id
         FROM dino_nps_responses
        WHERE id = $1 AND empresa_id = $2 AND loja_id = $3
        LIMIT 1`,
      [responseId, empresaId, lojaId],
    );
    if (!result?.rows?.[0]) {
      throw Object.assign(new Error('Resposta NPS canônica não encontrada no escopo.'), { code: 'DINO_NPS_RESPONSE_NOT_FOUND', retryable: false });
    }
    return { verified: true, responseId };
  };
}

/** Handler idempotente da análise gerencial da projeção de faturamento. */
export function createDinoForecastAiProcessHandler({ db = defaultCommerceDb, fetchImpl = fetch } = {}) {
  return createDinoForecastAiHandler({ db, fetchImpl });
}

function cleanWorkerId(value) {
  const clean = String(value || '').replace(/[^a-zA-Z0-9_.:-]/g, '').slice(0, 120);
  return clean || `dino-operational-${crypto.randomUUID()}`;
}

function numberOption(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function effectOf(task) {
  return task?.effect ?? task?.efeito;
}

function handlerFor(handlers, effect) {
  if (handlers instanceof Map) return handlers.get(effect);
  if (handlers && typeof handlers === 'object') return handlers[effect];
  return undefined;
}

function missingHandlerError(effect) {
  return new DinoOperationalError(`handler ausente para efeito ${String(effect || 'desconhecido').slice(0, 120)}`, {
    code: 'DINO_HANDLER_MISSING',
    status: 500,
    retryable: false,
  });
}

function isLeaseLost(error) {
  return error?.code === 'DINO_OUTBOX_LEASE_LOST';
}

function safeLogError(prefix, error) {
  const code = String(error?.code || error?.name || 'ERROR').slice(0, 80);
  const message = String(error?.message || error || 'erro não identificado').replace(/[\r\n]+/g, ' ').slice(0, 500);
  console.error(`${prefix} ${code}: ${message}`);
}

/**
 * Processa uma leva já reivindicada. Nenhuma integração é criada aqui: todos
 * os efeitos externos precisam ser handlers fornecidos pelo processo chamador.
 */
export async function runDinoOperationalBatch({
  workerId,
  limit = DEFAULT_LIMIT,
  handlers = {},
  now = new Date(),
} = {}) {
  const normalizedWorkerId = cleanWorkerId(workerId || process.env.RENDER_INSTANCE_ID || process.env.HOSTNAME);
  const normalizedLimit = numberOption(limit, DEFAULT_LIMIT, 1, MAX_LIMIT);
  const tasks = await claimDinoEffects({
    workerId: normalizedWorkerId,
    limit: normalizedLimit,
    leaseSeconds: numberOption(process.env.DINO_OPERATIONAL_LEASE_SECONDS, DEFAULT_LEASE_SECONDS, 1, 3600),
    maxAttempts: numberOption(process.env.DINO_OPERATIONAL_MAX_ATTEMPTS, DEFAULT_MAX_ATTEMPTS, 1, 1000),
  });
  const summary = {
    worker: 'dino-operational',
    workerId: normalizedWorkerId,
    runAt: now instanceof Date ? now.toISOString() : new Date(now).toISOString(),
    claimed: tasks.length,
    completed: 0,
    failed: 0,
    retried: 0,
    deadLettered: 0,
    leaseLost: 0,
  };

  for (const task of tasks) {
    const effect = effectOf(task);
    try {
      const handler = handlerFor(handlers, effect);
      if (typeof handler !== 'function') throw missingHandlerError(effect);
      // O handler recebe exatamente a tarefa reivindicada, inclusive o token;
      // cabe ao handler usar suas próprias operações idempotentes.
      const handlerResult = await handler(task);
      await completeDinoEffect(task, handlerResult);
      summary.completed += 1;
    } catch (error) {
      if (isLeaseLost(error)) {
        summary.leaseLost += 1;
        safeLogError(`[Dino operational] lease perdido para ${String(task?.id || 'tarefa')}`, error);
        continue;
      }
      summary.failed += 1;
      try {
        const failure = await failDinoEffect(task, error, {
          maxAttempts: numberOption(process.env.DINO_OPERATIONAL_MAX_ATTEMPTS, DEFAULT_MAX_ATTEMPTS, 1, 1000),
        });
        if (failure.deadLettered || failure.exhausted) summary.deadLettered += 1;
        else summary.retried += 1;
      } catch (failureError) {
        if (isLeaseLost(failureError)) {
          summary.leaseLost += 1;
          safeLogError(`[Dino operational] lease perdido ao registrar falha de ${String(task?.id || 'tarefa')}`, failureError);
        } else {
          safeLogError(`[Dino operational] falha ao registrar efeito ${String(task?.id || 'tarefa')}`, failureError);
        }
      }
    }
  }
  return summary;
}

/**
 * Inicia um loop cooperativo. Com a flag desligada nenhum timer nem acesso ao
 * banco é criado. O retorno sempre oferece stop(), inclusive no modo inativo.
 */
export function startDinoOperationalWorker({ handlers = {}, intervalMs = DEFAULT_INTERVAL_MS } = {}) {
  if (process.env.DINO_OPERATIONAL_WORKER_ENABLED !== '1') {
    return { started: false, reason: 'disabled', stop() {} };
  }
  const effectiveInterval = numberOption(intervalMs, DEFAULT_INTERVAL_MS, MIN_INTERVAL_MS, MAX_INTERVAL_MS);
  const workerId = cleanWorkerId(process.env.RENDER_INSTANCE_ID || process.env.HOSTNAME);
  let running = false;
  let stopped = false;
  let again = false;

  const tick = async () => {
    if (stopped) return;
    if (running) {
      again = true;
      return;
    }
    running = true;
    try {
      const summary = await runDinoOperationalBatch({ workerId, handlers });
      if (summary.claimed || summary.failed || summary.leaseLost) console.log(JSON.stringify(summary));
    } catch (error) {
      safeLogError('[Dino operational] falha no ciclo', error);
    } finally {
      running = false;
      if (again && !stopped) {
        again = false;
        const next = setTimeout(tick, 0);
        next.unref?.();
      }
    }
  };

  const timer = setInterval(tick, effectiveInterval);
  timer.unref?.();
  const first = setTimeout(tick, 0);
  first.unref?.();
  return {
    started: true,
    workerId,
    intervalMs: effectiveInterval,
    stop() {
      stopped = true;
      clearInterval(timer);
      clearTimeout(first);
    },
  };
}

export default { runDinoOperationalBatch, startDinoOperationalWorker, createDinoNpsProcessHandler, createDinoForecastAiProcessHandler };
