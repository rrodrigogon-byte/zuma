import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
let serial = 0
async function fixture() {
  const names = ['window', 'navigator', 'Notification', 'localStorage', 'fetch', '__pushPost']
  const previous = Object.fromEntries(names.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  const storage = new Map([['sp_token', 'fixture-session-a'], ['sp_empresa_ativa', JSON.stringify({ id: 'company-a' })], ['sp_loja_ativa', JSON.stringify({ id: 'unit-a' })], ['sp_user', JSON.stringify({ id: 'actor-a' })]])
  const calls = []; const stats = { permissions: 0, subscribes: 0, unsubscribes: 0 }
  let subscription = { endpoint: 'https://fcm.googleapis.com/fixture', toJSON() { return { endpoint: this.endpoint, keys: { p256dh: 'fixture', auth: 'fixture' } } }, async unsubscribe() { stats.unsubscribes++; subscription = null; return true } }
  const registration = { pushManager: { async getSubscription() { return subscription }, async subscribe() { stats.subscribes++; subscription = { endpoint: 'https://fcm.googleapis.com/fixture-new', toJSON() { return { endpoint: this.endpoint } }, async unsubscribe() { stats.unsubscribes++; subscription = null } }; return subscription } } }
  const values = { window: { PushManager: function() {} }, navigator: { serviceWorker: { ready: Promise.resolve(registration), getRegistration: async () => registration } }, Notification: { permission: 'granted', async requestPermission() { stats.permissions++; return 'granted' } }, localStorage: { getItem: key => storage.get(key) || null }, fetch: async () => ({ ok: true }), __pushPost: async (...args) => { calls.push(args); return { configurado: true, chavePublica: 'AQ', assinado: true } } }
  values.window.Notification = values.Notification
  for (const key of names) Object.defineProperty(globalThis, key, { value: values[key], writable: true, configurable: true })
  const compiled = await build({ entryPoints: [fileURLToPath(new URL('./push-equipe.js', import.meta.url))], bundle: true, write: false, format: 'esm', platform: 'node', plugins: [{ name: 'fixture-only', setup(b) { b.onResolve({ filter: /(?:^\.\/api$|InstalarApp$)/ }, args => ({ path: args.path, namespace: 'fixture' })); b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === './api' ? 'export const api = {post:(...args)=>globalThis.__pushPost(...args)}' : 'export const ehIos = () => false; export const rodandoComoApp = () => true;' })) } }] })
  const mod = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text + `\n// fixture-${serial++}`).toString('base64'))
  return { mod, storage, calls, stats, registration, cleanup() { for (const key of names) { if (previous[key]) Object.defineProperty(globalThis, key, previous[key]); else delete globalThis[key] } } }
}
const tick = () => new Promise(r => setTimeout(r, 0))
test('cliente real: status atrasado não consulta nem retorna dados do contexto anterior', async () => {
  const f = await fixture(); let resolve
  try { navigator.serviceWorker.ready = new Promise(r => { resolve = r }); const pending = f.mod.situacaoPush(); await tick(); f.storage.set('sp_loja_ativa', JSON.stringify({ id: 'unit-b' })); resolve(f.registration); await assert.rejects(pending, e => e.code === 'PUSH_CONTEXTO_ALTERADO'); assert.equal(f.calls.length, 0) } finally { f.cleanup() }
})
test('cliente real: permissão é pedida no gesto e troca de contexto impede assinatura', async () => {
  const f = await fixture(); let resolve
  try { Notification.requestPermission = () => { f.stats.permissions++; return new Promise(r => { resolve = r }) }; const pending = f.mod.ativarPush({ chavePublica: 'AQ' }); assert.equal(f.stats.permissions, 1); f.storage.set('sp_loja_ativa', JSON.stringify({ id: 'unit-b' })); resolve('granted'); await assert.rejects(pending, e => e.code === 'PUSH_CONTEXTO_ALTERADO'); assert.equal(f.calls.length, 0); assert.equal(f.stats.subscribes, 0) } finally { f.cleanup() }
})
test('cliente real: negativa de permissão não registra assinatura', async () => {
  const f = await fixture()
  try { Notification.requestPermission = async () => 'denied'; await assert.rejects(() => f.mod.ativarPush({ chavePublica: 'AQ' }), e => e.code === 'PUSH_BLOQUEADO'); assert.equal(f.calls.length, 0) } finally { f.cleanup() }
})
test('cliente real: cleanup usa a sessão antiga e termina antes da nova assinatura', async () => {
  const f = await fixture(); let finish; let headers
  try {
    globalThis.fetch = async (_, options) => { headers = options.headers; await new Promise(r => { finish = r }); return { ok: true } }
    const cleaning = f.mod.encerrarPushDoAparelho({ token: 'fixture-session-a', empresaId: 'company-a', lojaId: 'unit-a' }); await tick()
    f.storage.set('sp_token', 'fixture-session-b'); f.storage.set('sp_loja_ativa', JSON.stringify({ id: 'unit-b' }))
    const activation = f.mod.ativarPush({ chavePublica: 'AQ' }); await tick(); assert.equal(f.calls.length, 0)
    finish(); await cleaning; await activation
    assert.equal(headers['X-Loja-Id'], 'unit-a'); assert.equal(f.stats.unsubscribes, 1); assert.equal(f.stats.subscribes, 1)
    assert.equal(f.calls[0][2].headers['X-Loja-Id'], 'unit-b'); assert.equal(f.calls[0][2].headers.Authorization, 'Bearer fixture-session-b')
  } finally { f.cleanup() }
})
test('cliente real: tela desmontada não registra assinatura nem envia teste', async () => {
  const f = await fixture()
  try { await assert.rejects(() => f.mod.ativarPush({ chavePublica: 'AQ', ativo: () => false }), e => e.code === 'PUSH_CONTEXTO_ALTERADO'); assert.equal(f.stats.permissions, 0); await assert.rejects(() => f.mod.testarPush({ ativo: () => false }), e => e.code === 'PUSH_CONTEXTO_ALTERADO'); assert.equal(f.calls.length, 0) } finally { f.cleanup() }
})
test('cliente real: falha de rede na limpeza ainda cancela assinatura local', async () => {
  const f = await fixture()
  try { globalThis.fetch = async () => { throw new Error('fixture offline') }; await f.mod.encerrarPushDoAparelho({ token: 'fixture-session-a' }); assert.equal(f.stats.unsubscribes, 1) } finally { f.cleanup() }
})
