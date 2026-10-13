import test from 'node:test'
import assert from 'node:assert/strict'
import { mapWhatsappAiProviderLatency24h, WHATSAPP_AI_PROVIDER_RUNS_24H_SQL } from './whatsapp-ai-provider-metrics.js'

test('percentis backend: payload antigo mantém a métrica nova indisponível', () => {
  assert.equal(mapWhatsappAiProviderLatency24h(null, 0), null)
  assert.equal(mapWhatsappAiProviderLatency24h({ avg_latency_ms: 0 }, 4), null)
})

test('percentis backend: interpolação decimal positiva preservada com denominador real', () => {
  assert.deepEqual(mapWhatsappAiProviderLatency24h({ latency_sample_size: 3, p50_latency_ms: 12.5, p95_latency_ms: 75.25 }, 4), {
    window: '24h', scope: 'unit', sampleSize: 3, p50Ms: 12.5, p95Ms: 75.25,
  })
})

test('percentis backend: total positivo sem duração válida não vira latência zero', () => {
  assert.deepEqual(mapWhatsappAiProviderLatency24h({ latency_sample_size: 0, p50_latency_ms: null, p95_latency_ms: null }, 4), {
    window: '24h', scope: 'unit', sampleSize: 0, p50Ms: null, p95Ms: null,
  })
})

test('percentis backend: denominador inválido não é exposto como amostra conhecida', () => {
  for (const [sample, total] of [[5, 4], [-1, 4], ['3', 4], [1, null], [Infinity, 4]]) {
    const result = mapWhatsappAiProviderLatency24h({ latency_sample_size: sample, p50_latency_ms: 12, p95_latency_ms: 75 }, total)
    assert.equal(result.sampleSize, null)
    assert.equal(result.p50Ms, null)
    assert.equal(result.p95Ms, null)
  }
})

test('percentis backend: zero placeholder, duração negativa, tipo cru e ordem invertida ficam indisponíveis', () => {
  for (const [p50, p95] of [[0, 75], [-1, 75], ['12', 75], [12, Infinity], [75, 12]]) {
    const result = mapWhatsappAiProviderLatency24h({ latency_sample_size: 2, p50_latency_ms: p50, p95_latency_ms: p95 }, 4)
    assert.equal(result.p50Ms, null)
    assert.equal(result.p95Ms, null)
  }
})

test('percentis backend: uma consulta SELECT escopada, janela limitada, zero/default excluído, média legada intacta', () => {
  assert.match(WHATSAPP_AI_PROVIDER_RUNS_24H_SQL, /^SELECT\b/)
  assert.doesNotMatch(WHATSAPP_AI_PROVIDER_RUNS_24H_SQL, /\b(?:INSERT|UPDATE|DELETE|MERGE|CREATE|ALTER|DROP)\b/i)
  assert.match(WHATSAPP_AI_PROVIDER_RUNS_24H_SQL, /empresa_id = \$1 AND loja_id = \$2/)
  assert.match(WHATSAPP_AI_PROVIDER_RUNS_24H_SQL, /criado_em <= CURRENT_TIMESTAMP/)
  assert.match(WHATSAPP_AI_PROVIDER_RUNS_24H_SQL, /latency_ms IS NOT NULL AND latency_ms > 0/)
  assert.match(WHATSAPP_AI_PROVIDER_RUNS_24H_SQL, /COALESCE\(ROUND\(AVG\(latency_ms\)\), 0\)::int AS avg_latency_ms/)
})
