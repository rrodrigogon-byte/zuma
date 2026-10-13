import assert from 'node:assert/strict'
import test from 'node:test'
import { dirname, join } from 'node:path'
import { readFileSync, realpathSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { mapWhatsappAiProviderLatency24h, WHATSAPP_AI_PROVIDER_RUNS_24H_SQL } from './whatsapp-ai-provider-metrics.js'

const enabled = Boolean(process.env.DINO_WHATSAPP_PROVIDER_FIXTURE && process.env.DINO_WHATSAPP_PROVIDER_FIXTURE_MARKER)
const BIN = '/usr/lib/postgresql/16/bin'
const A = '11111111-1111-4111-8111-111111111111'
const A1 = '33333333-3333-4333-8333-333333333333'
const A2 = '44444444-4444-4444-8444-444444444444'
const B = '55555555-5555-4555-8555-555555555555'
const B1 = '66666666-6666-4666-8666-666666666666'

function fixtureContext() {
  const manifestPath = realpathSync(process.env.DINO_WHATSAPP_PROVIDER_FIXTURE)
  const fixtureDir = dirname(manifestPath)
  const fixture = JSON.parse(readFileSync(manifestPath, 'utf8'))
  assert.equal(fixture.marker, process.env.DINO_WHATSAPP_PROVIDER_FIXTURE_MARKER)
  assert.ok(fixtureDir.startsWith(join(realpathSync(tmpdir()), 'dino-whatsapp-provider-pg-')))
  assert.equal(realpathSync(fixture.socket), join(fixtureDir, 'socket'))
  assert.equal(fixture.database, 'dino_whatsapp_provider_test')
  assert.equal(fixture.owner, 'dino_whatsapp_provider_fixture_owner')
  assert.equal(fixture.reader, 'dino_whatsapp_provider_readonly')
  assert.equal(fixture.port, 55434)
  return fixture
}

function psql(fixture, role, sql) {
  const args = ['-h', fixture.socket, '-p', String(fixture.port), '-U', role, '-d', fixture.database, '-v', 'ON_ERROR_STOP=1', '-At', '-c', sql]
  const result = spawnSync('/usr/bin/psql', args, {
    encoding: 'utf8',
    env: { PATH: process.env.PATH, HOME: process.env.HOME, LANG: process.env.LANG, TZ: process.env.TZ },
  })
  if (result.status !== 0) throw new Error(`psql falhou (${role}): ${result.stderr || result.stdout}`)
  return result.stdout.trim()
}

function queryRead(fixture, sql, values = []) {
  assert.match(sql, /^\s*SELECT\b/i)
  assert.doesNotMatch(sql, /\b(INSERT|UPDATE|DELETE|MERGE|ALTER|DROP|TRUNCATE|CREATE|GRANT|REVOKE)\b/i)
  const substituted = sql.replace(/\$(\d+)/g, (_, n) => {
    const index = Number(n) - 1
    if (index < 0 || index >= values.length) throw new Error(`parâmetro ausente para $${n}`)
    return `'${String(values[index]).replaceAll("'", "''")}'`
  })
  const wrapped = `SELECT COALESCE(json_agg(q), '[]'::json) FROM (${substituted}) AS q;`
  const output = psql(fixture, fixture.reader, wrapped)
  return { rows: JSON.parse(output || '[]') }
}

test('PostgreSQL real: percentis são interpolados, filtrados e tenant/store/window scoped em SELECT-only', { skip: enabled ? false : 'Execute npm run test:whatsapp-ai-provider-metrics-pg; somente cluster PostgreSQL 16 efêmero por socket é permitido' }, () => {
  const fixture = fixtureContext()
  const calls = []
  const read = (values) => {
    calls.push(values)
    return queryRead(fixture, WHATSAPP_AI_PROVIDER_RUNS_24H_SQL, values)
  }

  const a1 = read([A, A1]).rows[0]
  assert.equal(a1.total, 7)
  assert.equal(a1.success, 4)
  assert.equal(a1.failed, 2)
  assert.equal(a1.latency_sample_size, 5)
  assert.equal(a1.avg_latency_ms, 149)
  assert.equal(a1.p50_latency_ms, 200)
  assert.equal(a1.p95_latency_ms, 380)
  assert.deepEqual(mapWhatsappAiProviderLatency24h(a1, a1.total), {
    window: '24h', scope: 'unit', sampleSize: 5, p50Ms: 200, p95Ms: 380,
  })

  const a2 = read([A, A2]).rows[0]
  assert.equal(a2.total, 1)
  assert.equal(a2.latency_sample_size, 1)
  assert.equal(a2.p50_latency_ms, 50)
  assert.equal(a2.p95_latency_ms, 50)

  const b1 = read([B, B1]).rows[0]
  assert.equal(b1.total, 1)
  assert.equal(b1.latency_sample_size, 1)
  assert.equal(b1.p50_latency_ms, 777)
  assert.equal(b1.p95_latency_ms, 777)
  assert.deepEqual(calls, [[A, A1], [A, A2], [B, B1]])

  for (const store of ['77777777-7777-4777-8777-777777777777', '88888888-8888-4888-8888-888888888888', '99999999-9999-4999-8999-999999999999']) {
    const row = queryRead(fixture, WHATSAPP_AI_PROVIDER_RUNS_24H_SQL, [A, store]).rows[0]
    assert.equal(row.latency_sample_size, 0)
    assert.equal(row.p50_latency_ms, null)
    assert.equal(row.p95_latency_ms, null)
    assert.deepEqual(mapWhatsappAiProviderLatency24h(row, row.total), { window: '24h', scope: 'unit', sampleSize: 0, p50Ms: null, p95Ms: null })
  }
  const fixtureCounts = JSON.parse(psql(fixture, fixture.owner, "SELECT json_build_object('rows', (SELECT count(*) FROM whatsapp_ai_provider_runs));"))
  assert.deepEqual(fixtureCounts, { rows: 13 })
})
