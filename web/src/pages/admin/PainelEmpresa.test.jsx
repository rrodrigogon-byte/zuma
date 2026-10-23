import { createElement } from 'react'
import { act, create } from 'react-test-renderer'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({ useAuth: vi.fn(), api: { get: vi.fn() } }))
vi.mock('../../lib/auth', () => ({ useAuth: mocks.useAuth }))
vi.mock('../../lib/api', () => ({ api: mocks.api }))
vi.mock('react-router-dom', () => ({ Link: ({ to, children }) => createElement('a', { href: to }, children) }))
vi.mock('./customer360.css', () => ({}))
vi.mock('./dino/dino-admin.css', () => ({}))
import PainelEmpresa from './PainelEmpresa'

const respostas = {
  '/api/admin/razao/estado': { ativo: true },
  '/api/admin/razao/resumo': { recMes: 833.5, resultadoMes: 633.5, aReceber: 0, aPagar: 4327.7, receberVencidos: 0, pagarVencidos: 1 },
  '/api/admin/suprimentos/itens': [{ id: 'i1', nome: 'Limão' }],
  '/api/admin/salao/reservas/visao': { ocupacao: { totalReservas: 2, pessoasPrevistas: 6 } },
  '/api/pdv-offline/conflitos': { conflitos: [{ id: 'c1' }] },
}
async function montar(permissoes) {
  mocks.useAuth.mockReturnValue({ empresaAtiva: { id: 'e1', nome: 'Bar Demo' }, lojaAtiva: null, permissoes })
  mocks.api.get.mockImplementation(async (url) => respostas[url.split('?')[0]])
  let tree
  await act(async () => { tree = create(createElement(PainelEmpresa)) })
  return JSON.stringify(tree.toJSON())
}

describe('Painel da empresa', () => {
  beforeEach(() => vi.clearAllMocks())
  it('mostra o dia da empresa a partir dos módulos por empresa', async () => {
    const t = await montar(null)
    expect(t).toContain('Recebido no mês')
    expect(t).toContain('Abaixo do mínimo')
    expect(t).toContain('Reservas hoje')
    expect(t).toContain('conflito(s) para decidir')
    expect(mocks.api.get).not.toHaveBeenCalledWith('/api/admin/dashboard')
  })
  it('sem a permissão, não consulta o módulo nem mostra o bloco', async () => {
    const t = await montar(['payments.read', 'reports.read'])
    expect(t).toContain('Recebido no mês')
    expect(t).not.toContain('Abaixo do mínimo')
    expect(mocks.api.get.mock.calls.map((c) => c[0].split('?')[0])).not.toContain('/api/admin/suprimentos/itens')
  })
  it('sem reports.read (perfil operador) não mostra os números do Financeiro', async () => {
    const t = await montar(['payments.read'])
    expect(t).not.toContain('Recebido no mês')
    expect(mocks.api.get.mock.calls.map((c) => c[0].split('?')[0])).not.toContain('/api/admin/razao/resumo')
  })
  it('espera as permissões antes de consultar', async () => {
    await montar(undefined)
    expect(mocks.api.get).not.toHaveBeenCalled()
  })
  it('módulo fora do ar não quebra o painel', async () => {
    mocks.useAuth.mockReturnValue({ empresaAtiva: { id: 'e1' }, lojaAtiva: null, permissoes: null })
    mocks.api.get.mockRejectedValue(new Error('503'))
    let tree
    await act(async () => { tree = create(createElement(PainelEmpresa)) })
    expect(JSON.stringify(tree.toJSON())).toContain('Ainda não há módulos com dados')
  })
})
