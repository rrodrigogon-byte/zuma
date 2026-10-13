import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeWhatsappAiOperationalStatus, sumCounts } from './whatsapp-ai-operational.js'

const NOW = Date.parse('2026-10-13T15:00:00Z')

function valid(overrides = {}) {
  return {
    featureEnabled: true,
    gemini: { configured: true, model: 'do-not-render' },
    channel: { status: 'ativo', nome: 'CANARY_NAME', lastEventAt: '2026-10-13T14:59:00Z', lastSyncAt: '2026-10-13T14:58:00Z', lastError: 'CANARY_ERROR', id: 'CANARY_ID', aiCircuitOpen: false, aiConsecutiveFailures: 0 },
    sessions: { ativo: 2, humano: 1 },
    humanQueue: { unassigned: 1 },
    tasks: { pendente: 2, falha: 1, deadLetter: 1 },
    deliveries: { sent: 3, unknown: 1 },
    provider24h: { total: 4, success: 3, failed: 1, avgLatencyMs: 820, toolCalls: 2 },
    worker: { active: true, leaseExpiresAt: '2026-10-13T15:10:00Z', lastHeartbeatAt: '2026-10-13T14:59:30Z', titular: 'CANARY_HOST' },
    ...overrides,
  }
}

test('normaliza payload válido ativo e preserva somente allowlist agregada', () => {
  const result = normalizeWhatsappAiOperationalStatus(valid(), { now: NOW })
  assert.equal(result.kind, 'valid')
  assert.equal(result.channel.status, 'ativo')
  assert.equal(result.provider24h.avgLatencyMs, 820)
  assert.equal(result.worker.scope, 'global')
  assert.equal(result.worker.active, true)
  assert.equal(result.channel.aiCircuitOpen, false)
  assert.equal(result.channel.aiConsecutiveFailures, 0)
  assert.equal(result.humanQueue.unassigned, 1)
  assert.equal(result.tasks.counts.deadLetter, 1)
  assert.equal(result.channel.nome, undefined)
  assert.equal(result.channel.lastError, undefined)
  assert.doesNotMatch(JSON.stringify(result), /CANARY_NAME|CANARY_ERROR|CANARY_ID|CANARY_HOST|do-not-render/)
})

test('feature false, canal rascunho, pausado e null continuam válidos sem inferir saúde', () => {
  for (const channel of [
    { status: 'rascunho', lastEventAt: null, lastSyncAt: null },
    { status: 'pausado', lastEventAt: null, lastSyncAt: null },
    null,
  ]) {
    const result = normalizeWhatsappAiOperationalStatus(valid({ featureEnabled: false, channel }), { now: NOW })
    assert.equal(result.kind, 'valid')
    assert.equal(result.featureEnabled, false)
    assert.equal(result.channel.configured, channel !== null)
  }
})

test('campos ausentes, payloads falhos e tipos fora da allowlist são não verificáveis', () => {
  assert.equal(normalizeWhatsappAiOperationalStatus(null, { now: NOW }).kind, 'unverifiable')
  assert.equal(normalizeWhatsappAiOperationalStatus({ ...valid(), tasks: undefined }, { now: NOW }).kind, 'unverifiable')
  assert.equal(normalizeWhatsappAiOperationalStatus({ ...valid(), provider24h: { ...valid().provider24h, total: '4' } }, { now: NOW }).kind, 'unverifiable')
  assert.equal(normalizeWhatsappAiOperationalStatus({ ...valid(), worker: { ...valid().worker, active: 'true' } }, { now: NOW }).kind, 'unverifiable')
  assert.equal(normalizeWhatsappAiOperationalStatus({ ...valid(), channel: { status: 'ativo', lastEventAt: null } }, { now: NOW }).kind, 'unverifiable')
})

test('timestamps atuais, antigos, futuros e inválidos têm estados distintos', () => {
  const result = normalizeWhatsappAiOperationalStatus(valid({
    channel: { status: 'ativo', lastEventAt: '2026-10-12T14:59:00Z', lastSyncAt: '2026-10-13T16:00:00Z' },
    worker: { active: true, leaseExpiresAt: 'not-a-date', lastHeartbeatAt: '2026-10-13T14:59:30Z' },
  }), { now: NOW })
  assert.equal(result.channel.lastEventAt.state, 'stale')
  assert.equal(result.channel.lastSyncAt.state, 'future')
  assert.equal(result.worker.leaseExpiresAt.state, 'invalid')
  assert.equal(result.worker.lastHeartbeatAt.state, 'current')
})

test('worker lease é global, independentemente de empresa ou unidade', () => {
  const result = normalizeWhatsappAiOperationalStatus(valid({ worker: { active: true, leaseExpiresAt: null, lastHeartbeatAt: null } }), { now: NOW })
  assert.equal(result.worker.scope, 'global')
  assert.equal(result.worker.active, true)
  assert.match(JSON.stringify(result), /global/)
})

test('lease futuro legítimo não é inválido, mas heartbeat futuro ou antigo torna o worker não verificável', () => {
  const leaseFuture = normalizeWhatsappAiOperationalStatus(valid({
    worker: { active: true, leaseExpiresAt: '2026-10-13T16:00:00Z', lastHeartbeatAt: '2026-10-13T14:59:30Z' },
  }), { now: NOW })
  assert.equal(leaseFuture.worker.leaseExpiresAt.state, 'valid')
  assert.equal(leaseFuture.worker.verifiable, true)
  for (const lastHeartbeatAt of ['2026-10-13T15:03:01Z', '2026-10-13T14:54:00Z', 'not-a-date']) {
    const result = normalizeWhatsappAiOperationalStatus(valid({ worker: { active: true, leaseExpiresAt: '2026-10-13T16:00:00Z', lastHeartbeatAt } }), { now: NOW })
    assert.notEqual(result.worker.lastHeartbeatAt.state, 'current')
    assert.equal(result.worker.verifiable, false)
  }
})

test('mapas vazios representam zero e não uma falha de leitura', () => {
  const result = normalizeWhatsappAiOperationalStatus(valid({ sessions: {}, tasks: {}, deliveries: {}, provider24h: { total: 0, success: 0, failed: 0, avgLatencyMs: 0, toolCalls: 0 } }), { now: NOW })
  assert.equal(result.kind, 'valid')
  assert.equal(sumCounts(result.tasks, ['pendente', 'falha']), 0)
  assert.equal(result.provider24h.total, 0)
  assert.equal(result.provider24h.latencyLabel, 'sem execuções')
})

test('status de entrega desconhecido é contado sem aceitar códigos arbitrários', () => {
  const result = normalizeWhatsappAiOperationalStatus(valid({ deliveries: { unknown: 2, CANARY_DELIVERY: 99 } }), { now: NOW })
  assert.equal(result.kind, 'valid')
  assert.equal(result.deliveries.counts.unknown, 2)
  assert.equal(result.deliveries.counts.CANARY_DELIVERY, undefined)
  assert.equal(result.deliveries.unclassified, 99)
})

test('circuito, fila sem responsável e estados de entrega são allowlistados com inteiros', () => {
  const result = normalizeWhatsappAiOperationalStatus(valid({
    channel: { status: 'ativo', lastEventAt: null, lastSyncAt: null, aiCircuitOpen: true, aiConsecutiveFailures: 4 },
    humanQueue: { unassigned: 3 },
    deliveries: { failed: 2, skipped: 1, legacy: 4, started: 5 },
  }), { now: NOW })
  assert.equal(result.kind, 'valid')
  assert.equal(result.channel.aiCircuitOpen, true)
  assert.equal(result.channel.aiConsecutiveFailures, 4)
  assert.equal(result.humanQueue.unassigned, 3)
  assert.equal(result.deliveries.counts.failed, 2)
  assert.equal(result.deliveries.counts.started, 5)
  assert.equal(result.deliveries.unclassified, 0)
  assert.equal(normalizeWhatsappAiOperationalStatus(valid({ humanQueue: { unassigned: '3' } }), { now: NOW }).kind, 'unverifiable')
})
