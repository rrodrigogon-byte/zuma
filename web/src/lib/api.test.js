import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSync } from 'esbuild'
import { createRequire } from 'node:module'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

function storage(values = {}) {
  return { getItem: key => values[key] || null, setItem: () => {}, removeItem: () => {} }
}

test('api.get força GET e aceita apenas headers, signal e cache', async () => {
  const oldLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  const oldFetch = globalThis.fetch
  const calls = []
  const dir = mkdtempSync(join(tmpdir(), 'dino-api-get-test-'))
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage() })
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } })
  globalThis.fetch = async (path, options) => {
    calls.push([path, options])
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ ok: true }) }
  }
  try {
    // Vite supports extensionless browser imports; bundle the actual module so
    // Node tests verify that same code without modifying production resolution.
    const compiled = buildSync({ entryPoints: [fileURLToPath(new URL('./api.js', import.meta.url))], bundle: true, platform: 'node', format: 'cjs', write: false })
    const target = join(dir, 'api.cjs')
    writeFileSync(target, compiled.outputFiles[0].text)
    const { api } = createRequire(import.meta.url)(target)
    const signal = { aborted: false }
    const result = await api.get('/api/admin/commerce/whatsapp-ai/status', {
      headers: { 'X-Empresa-Id': 'empresa-a', 'X-Loja-Id': 'loja-a' }, signal,
      cache: 'no-store', method: 'POST', body: JSON.stringify({ write: true }),
      credentials: 'include', next: { revalidate: 0 },
    })
    assert.deepEqual(result, { ok: true })
    assert.equal(calls.length, 1)
    assert.deepEqual(calls[0], ['/api/admin/commerce/whatsapp-ai/status', {
      method: 'GET', headers: { 'Content-Type': 'application/json', 'X-Empresa-Id': 'empresa-a', 'X-Loja-Id': 'loja-a' }, signal, cache: 'no-store',
    }])
  } finally {
    if (oldLocalStorage) Object.defineProperty(globalThis, 'localStorage', oldLocalStorage)
    else delete globalThis.localStorage
    if (oldNavigator) Object.defineProperty(globalThis, 'navigator', oldNavigator)
    else delete globalThis.navigator
    globalThis.fetch = oldFetch
    rmSync(dir, { recursive: true, force: true })
  }
})
