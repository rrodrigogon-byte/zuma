import React from 'react'
import { create, act } from 'react-test-renderer'
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
vi.mock('../../lib/offline-queue', () => ({ prepararOperacao: (_path, opts) => opts, deveEnfileirarOffline: () => false, enfileirarOperacao: vi.fn(), sincronizarFila: vi.fn() }))
import DinoEquipeDesempenho from './DinoEquipeDesempenho'
const tick = () => new Promise(resolve => setTimeout(resolve, 0))
let renderer, requests
function installTransport(empresaId, lojaId) {
  const storage = new Map([['sp_token', 'SYNTHETIC_TRANSPORT_TOKEN'], ['sp_empresa_ativa', JSON.stringify({ id: 'old-company' })], ['sp_loja_ativa', JSON.stringify({ id: 'old-unit' })]])
  vi.stubGlobal('localStorage', { getItem: key => storage.get(key) || null, removeItem: key => storage.delete(key) })
  vi.stubGlobal('navigator', { onLine: true })
  vi.stubGlobal('fetch', vi.fn(async (path, opts) => {
    const headers = new Headers(opts.headers)
    requests.push({ path, method: opts.method, empresaId: headers.get('x-empresa-id'), lojaId: headers.get('x-loja-id') })
    const valid = headers.get('x-empresa-id') === empresaId && headers.get('x-loja-id') === lojaId
    const query = new URL(path, 'https://fixture.invalid').searchParams
    return new Response(JSON.stringify(valid ? { readOnly: true, writePerformed: false, scope: { empresaId, lojaId }, period: { inicio: query.get('inicio') || '2024-01-01', fim: query.get('fim'), historico: query.get('historico') === '1' }, summary: { revenue: 0, commission: 0, services: 0, products: 0, paidTransfers: null }, employees: [], quality: {}, definitions: [] } : { code: 'STORE_SCOPE_MISMATCH' }), { status: valid ? 200 : 403, headers: { 'Content-Type': 'application/json' } })
  }))
}
beforeEach(() => { requests = []; globalThis.IS_REACT_ACT_ENVIRONMENT = true })
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = null; vi.unstubAllGlobals() })
describe('desempenho com transporte real da API', () => {
  it('envia um único valor por cabeçalho e substitui contexto local antigo sem concatenação', async () => {
    installTransport('tenant-a', 'unit-a')
    await act(async () => { renderer = create(<DinoEquipeDesempenho empresaId="tenant-a" lojaId="unit-a" />); await tick() })
    expect(requests).toHaveLength(1)
    expect(requests[0]).toMatchObject({ method: 'GET', empresaId: 'tenant-a', lojaId: 'unit-a' })
    expect(JSON.stringify(renderer.toJSON())).not.toContain('Não foi possível carregar')
    expect(JSON.stringify(renderer.toJSON())).toContain('Todos os profissionais')
  })
  it('identidade e unidade permanecem completas e únicas após a troca de contexto', async () => {
    installTransport('tenant-a', 'unit-a')
    await act(async () => { renderer = create(<DinoEquipeDesempenho empresaId="tenant-a" lojaId="unit-a" />); await tick() })
    installTransport('tenant-b', 'unit-b')
    await act(async () => { renderer.update(<DinoEquipeDesempenho empresaId="tenant-b" lojaId="unit-b" />); await tick() })
    expect(requests[1]).toMatchObject({ method: 'GET', empresaId: 'tenant-b', lojaId: 'unit-b' })
    expect(requests.every(request => !request.empresaId.includes(',') && !request.lojaId.includes(','))).toBe(true)
  })
})
