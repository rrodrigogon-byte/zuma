import React, { createElement } from 'react'
import { create, act } from 'react-test-renderer'
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
vi.mock('../../../lib/offline-queue', () => ({ prepararOperacao: (_path, opts) => opts, deveEnfileirarOffline: () => false, enfileirarOperacao: vi.fn(), sincronizarFila: vi.fn() }))
const auth = vi.hoisted(() => ({ useAuth: vi.fn() }))
vi.mock('../../../lib/auth', () => auth)
vi.mock('../../../hooks/useToast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('../customer360/shared', () => ({ Dialog: ({ children }) => createElement('div', null, children) }))
vi.mock('react-router-dom', () => ({ Link: ({ children, ...props }) => createElement('a', props, children), useLocation: () => ({ pathname: globalThis.window?.location?.pathname || '/admin/whatsapp' }) }))
import WhatsappConexao from './WhatsappConexao'
let renderer, requests
const tick = () => new Promise(resolve => setTimeout(resolve, 0))
const operational = { featureEnabled: true, gemini: { configured: false }, channel: null, sessions: {}, humanQueue: { unassigned: 0 }, tasks: {}, deliveries: {}, provider24h: { total: 0, success: 0, failed: 0, avgLatencyMs: 0, toolCalls: 0 }, worker: { active: false, leaseExpiresAt: null, lastHeartbeatAt: null } }
function install(profile, empresaId = 'tenant-a', lojaId = 'unit-a') {
 const storage = new Map([['sp_token', 'SYNTHETIC_CHANNEL_TRANSPORT'], ['sp_empresa_ativa', JSON.stringify({ id: 'stale-tenant' })], ['sp_loja_ativa', JSON.stringify({ id: 'stale-unit' })]])
 auth.useAuth.mockReturnValue({ empresaAtiva: { id: empresaId, nome: 'Fixture' }, lojaAtiva: { id: lojaId }, user: {} })
 vi.stubGlobal('localStorage', { getItem: key => storage.get(key) || null, removeItem: key => storage.delete(key) })
 vi.stubGlobal('navigator', { onLine: true })
 vi.stubGlobal('window', { location: { origin: 'https://fixture.invalid', pathname: profile === 'cliente' ? '/admin/whatsapp' : `/admin/whatsapp-${profile}` }, addEventListener: vi.fn(), confirm: vi.fn(() => true) })
 vi.stubGlobal('document', { visibilityState: 'visible', addEventListener: vi.fn(), removeEventListener: vi.fn() })
 vi.stubGlobal('fetch', vi.fn(async (path, opts) => {
  const headers = new Headers(opts.headers)
  const context = { path, method: opts.method, empresaId: headers.get('x-empresa-id'), lojaId: headers.get('x-loja-id') }
  requests.push(context)
  const valid = context.empresaId === empresaId && context.lojaId === lojaId
  const body = path.endsWith('/diagnostico') ? { conclusoes: [] } : path.includes('whatsapp-conexao') ? { conexao: { state: 'close', provider: profile === 'cliente' ? 'chatbot_backend' : 'waha', providerConfigured: false, instance: '', history: [], autoReconnect: false }, podeGerenciar: true } : operational
  return new Response(JSON.stringify(valid ? body : { error: 'STORE_SCOPE_MISMATCH' }), { status: valid ? 200 : 403, headers: { 'Content-Type': 'application/json' } })
 }))
}
beforeEach(() => { requests = []; globalThis.IS_REACT_ACT_ENVIRONMENT = true })
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = null; vi.unstubAllGlobals(); vi.clearAllMocks() })
describe('WhatsApp: transporte real e perfil', () => {
 for (const profile of ['cliente', 'gestao', 'lancamentos']) it(`${profile}: conexão, IA e diagnóstico usam um único cabeçalho por contexto`, async () => {
  install(profile)
  await act(async () => { renderer = create(<WhatsappConexao />); await tick(); await tick() })
  expect(requests).toHaveLength(3)
  expect(requests.every(r => r.method === 'GET' && r.empresaId === 'tenant-a' && r.lojaId === 'unit-a')).toBe(true)
  expect(requests.some(r => r.path.includes('diagnostico'))).toBe(true)
  if (profile !== 'cliente') expect(requests.every(r => r.path.includes(profile))).toBe(true)
  expect(JSON.stringify(renderer.toJSON())).not.toContain('STORE_SCOPE_MISMATCH')
 })
 it('troca de perfil e unidade não mantém transporte nem diagnóstico do perfil anterior', async () => {
  install('gestao')
  await act(async () => { renderer = create(<WhatsappConexao />); await tick(); await tick() })
  install('lancamentos', 'tenant-a', 'unit-b')
  await act(async () => { renderer.update(<WhatsappConexao />); await tick(); await tick() })
  expect(requests.slice(3)).toHaveLength(3)
  expect(requests.slice(3).every(r => r.path.includes('lancamentos') && r.lojaId === 'unit-b' && !r.empresaId.includes(','))).toBe(true)
 })
})
