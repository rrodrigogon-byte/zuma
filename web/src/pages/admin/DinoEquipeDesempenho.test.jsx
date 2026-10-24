import React from 'react'
import { act, create } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }))
vi.mock('../../lib/api', () => ({ api: { get: mocks.get, patch: mocks.patch }, fmtR: value => `VALOR ${value}` }))
import DinoEquipeDesempenho, { buildDrillTree, shiftEquipeDate, toCsv } from './DinoEquipeDesempenho'
const props = { empresaId: 'tenant-a', lojaId: 'unit-a', onOpenTab: vi.fn() }
const tick = () => new Promise(resolve => setTimeout(resolve, 0))
const text = node => typeof node === 'string' ? node : (node?.children || []).map(text).join(' ')
const ROWS = [
  { date: '2025-11-03', hour: null, type: 'servico', origin: 'historico_avec', name: 'Corte', client: 'Cliente Um', quantity: 1, revenue: 50 },
  { date: '2025-11-03', hour: 10, type: 'servico', origin: 'comanda', name: 'Barba', client: 'Cliente Dois', quantity: 1, revenue: 30 },
  { date: '2026-01-15', hour: 9, type: 'produto', origin: 'venda', name: 'Pomada', client: 'Cliente Um', quantity: 2, revenue: 40 },
]
function fixture(url, scope = { empresaId: 'tenant-a', lojaId: 'unit-a' }) {
  const query = new URL(url, 'https://fixture.invalid').searchParams
  const historico = query.get('historico') === '1'
  const detail = query.get('profissionalId')
  const employeeA = { id: 'employee-a', name: 'Profissional sintético A', active: true, revenue: 200, serviceRevenue: 180, productRevenue: 20, commission: 80, serviceCommission: 72, productCommission: 8, services: 4, products: 1, paidTransfers: null, completed: 4, appointments: 5, canceled: 1, noShow: 0, attendanceRate: 100, ticketAverage: 45, revenueTrendPct: null, hasActivity: true, lastActivity: '2026-01-15' }
  const employeeA2 = { id: 'employee-ex', name: 'Ex Profissional Avec', active: true, registeredActive: false, activeByMovement: true, revenue: 90, services: 2, products: 0, commission: 0, hasActivity: true, historicalServices: 2 }
  const employeeB = { id: 'employee-b', name: 'Profissional sintético B', revenue: 0, services: 0, products: 0, commission: 0, paidTransfers: null, hasActivity: false }
  const full = { ...employeeA, topServices: [{ id: 'svc', name: 'Serviço sintético', quantity: 4, revenue: 180 }], heatmap: [{ day: 1, hour: 9, quantity: 4, revenue: 180 }], daily: [{ date: '2026-01', revenue: 200, services: 4 }], strengths: [{ code: 'REC', text: 'Resultado registrado no período.' }], attention: [], suggestions: [{ code: 'ACT', text: 'Revisar o fluxo com a equipe.', evidence: 'Base: 4 serviços.' }], rows: ROWS }
  return { readOnly: true, writePerformed: false, scope, teamSeries: historico ? [{ date: '2025-11', revenue: 80, services: 2 }, { date: '2026-01', revenue: 40, services: 0 }] : [], seriesGranularity: historico ? 'month' : 'day', period: { inicio: historico ? '2024-05-10' : query.get('inicio'), fim: query.get('fim'), historico, days: 900, previousInicio: '2026-08-01', previousFim: '2026-08-30' }, summary: { revenue: 200, commission: 80, services: 4, products: 1, paidTransfers: null, withValues: 2, activeByMovement: 1, unattributedHistoricalRevenue: 30 }, employees: detail ? [full] : [employeeA, employeeA2, employeeB], quality: { transfersAvailable: false, unscopedExcluded: 2, unattributedEvents: 1 }, definitions: ['Comissão não é pagamento.'] }
}
let renderer
beforeEach(() => { mocks.get.mockReset(); mocks.patch.mockReset(); props.onOpenTab.mockClear(); mocks.get.mockImplementation(url => Promise.resolve(fixture(url))); mocks.patch.mockResolvedValue({ ok: true }); globalThis.IS_REACT_ACT_ENVIRONMENT = true })
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = null })
async function mount(p = props) { await act(async () => { renderer = create(<DinoEquipeDesempenho {...p} />); await tick() }) }
const button = label => renderer.root.findAllByType('button').find(item => text({ children: item.props.children instanceof Array ? item.props.children : [item.props.children] }) === label)
const byAria = label => renderer.root.findAllByType('button').find(item => item.props['aria-label'] === label)
const content = () => text(renderer.toJSON())
describe('desempenho da equipe', () => {
  it('abre no histórico completo, somente GET com cabeçalhos de empresa/unidade', async () => {
    await mount(); expect(mocks.get).toHaveBeenCalledTimes(1)
    expect(mocks.get.mock.calls[0][0]).toMatch(/^\/api\/admin\/barbearia\/equipe\/desempenho\?historico=1&fim=\d{4}-\d{2}-\d{2}$/)
    expect(mocks.get.mock.calls[0][1]).toEqual({ headers: { 'X-Empresa-Id': 'tenant-a', 'X-Loja-Id': 'unit-a' } })
    expect(content()).toContain('Histórico completo'); expect(content()).toContain('Indisponível')
    expect(mocks.patch).not.toHaveBeenCalled()
  })
  it('mostra por padrão só quem tem valores, com inativo-com-movimento como ativo', async () => {
    await mount()
    expect(content()).toContain('Ex Profissional Avec'); expect(content()).toContain('Ativo · com movimento')
    expect(content()).not.toContain('Profissional sintético B'); expect(content()).toContain('1 ocultos')
    const check = renderer.root.findAllByType('input').find(item => item.props.type === 'checkbox')
    await act(async () => check.props.onChange({ target: { checked: false } }))
    expect(content()).toContain('Profissional sintético B'); expect(content()).toContain('sem movimento')
  })
  it('clique na linha carrega o detalhe sob demanda e explode até o nível 5 (atendimento)', async () => {
    await mount()
    const row = renderer.root.findAll(node => node.type === 'tr' && String(node.props.className || '').includes('lvl-1'))[0]
    await act(async () => { row.props.onClick(); await tick() })
    expect(mocks.get).toHaveBeenCalledTimes(2); expect(mocks.get.mock.calls[1][0]).toContain('profissionalId=employee-a')
    expect(content()).toContain('2026'); expect(content()).toContain('2025')
    await act(async () => byAria('Expandir 2025').props.onClick({ stopPropagation() {} }))
    expect(content()).toContain('nov/2025')
    await act(async () => byAria('Expandir nov/2025').props.onClick({ stopPropagation() {} }))
    const day = renderer.root.findAllByType('button').find(item => String(item.props['aria-label'] || '').startsWith('Expandir 03/11/2025'))
    await act(async () => day.props.onClick({ stopPropagation() {} }))
    expect(content()).toContain('Nível 5'); expect(content()).toContain('Cliente Dois'); expect(content()).toContain('Histórico Avec')
    await act(async () => { row.props.onClick(); await tick() })
    expect(content()).not.toContain('Nível 5'); expect(mocks.get).toHaveBeenCalledTimes(2)
  })
  it('árvore agrupa por tempo, serviço ou cliente com totais', () => {
    const tempo = buildDrillTree(ROWS, 'tempo')
    expect(tempo.map(node => node.key)).toEqual(['2026', '2025'])
    expect(tempo[1].revenue).toBe(80); expect(tempo[1].children[0].children[0].rows).toHaveLength(2)
    const servico = buildDrillTree(ROWS, 'servico'); expect(servico[0].label).toBe('Corte'); expect(servico.find(node => node.label === 'Produto · Pomada').products).toBe(2)
    const cliente = buildDrillTree(ROWS, 'cliente'); expect(cliente[0].label).toBe('Cliente Um'); expect(cliente[0].revenue).toBe(90)
  })
  it('ativar no cadastro exige confirmação e só altera quem tem movimento', async () => {
    await mount(); expect(mocks.patch).not.toHaveBeenCalled()
    await act(async () => button('Ativar no cadastro').props.onClick())
    await act(async () => { button('Confirmar ativação').props.onClick(); await tick() })
    expect(mocks.patch).toHaveBeenCalledTimes(1); expect(mocks.patch).toHaveBeenCalledWith('/api/admin/barbearia/profissionais/employee-ex', { ativo: true })
    expect(mocks.get.mock.calls.at(-1)[0]).toContain('fresh=1')
  })
  it('aceita o retorno legado do escopo Commerce canônico da Dino', async () => {
    mocks.get.mockImplementation(url => Promise.resolve(fixture(url, { empresaId: 'emp-kytto-001', lojaId: 'dino-web-estoque' })))
    await mount({ ...props, empresaId: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6', lojaId: 'ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8' })
    expect(content()).toContain('Profissional sintético A'); expect(content()).not.toContain('Não foi possível carregar')
  })
  it('sem unidade ou empresa não consulta nem exibe dados', async () => { await mount({ ...props, lojaId: '' }); expect(mocks.get).not.toHaveBeenCalled(); expect(content()).toContain('Selecione a empresa'); expect(content()).not.toContain('Profissional sintético') })
  it('rejeita resultado de outra empresa ou unidade', async () => { mocks.get.mockImplementation(url => Promise.resolve(fixture(url, { empresaId: 'tenant-a', lojaId: 'unit-b' }))); await mount(); expect(content()).toContain('Não foi possível'); expect(content()).not.toContain('Profissional sintético A') })
  it('trocar contexto limpa dados e descarta resposta atrasada', async () => { let resolve; mocks.get.mockReturnValueOnce(new Promise(r => { resolve = r })); await mount(); const url = mocks.get.mock.calls[0][0]; mocks.get.mockImplementation(next => Promise.resolve(fixture(next, { empresaId: 'tenant-b', lojaId: 'unit-b' }))); await act(async () => { renderer.update(<DinoEquipeDesempenho {...props} empresaId="tenant-b" lojaId="unit-b" />); await tick() }); await act(async () => { resolve({ ...fixture(url), employees: [{ id: 'leak', name: 'OLD-SCOPE-CANARY', hasActivity: true }] }); await tick() }); expect(content()).not.toContain('OLD-SCOPE-CANARY') })
  it('resultado sem confirmação read-only ou de outro período é bloqueado', async () => {
    mocks.get.mockImplementation(url => Promise.resolve({ ...fixture(url), writePerformed: true })); await mount(); expect(content()).not.toContain('Profissional sintético A'); expect(content()).toContain('Não foi possível')
    mocks.get.mockImplementation(url => { const data = fixture(url); data.period.historico = false; return Promise.resolve(data) }); await act(async () => { button('Atualizar indicadores').props.onClick(); await tick() }); expect(content()).not.toContain('Profissional sintético A')
  })
  it('análise individual mostra comissão, serviços, horários e recomendações sem imputar culpa', async () => {
    await mount(); await act(async () => { byAria('Ver desempenho de Profissional sintético A').props.onClick({ stopPropagation() {} }); await tick() })
    const c = content(); expect(c).toContain('Dias e horários'); expect(c).toContain('Serviço sintético'); expect(c).toContain('Revisar o fluxo'); expect(c).toMatch(/Evolução\s+mensal/); expect(c).toContain('não avaliação disciplinar'); expect(c).toContain('não comprovam erro'); expect(c).toMatch(/0\s+h/); expect(c).toMatch(/23\s+h/)
  })
  it('erro não ecoa dados de cliente/servidor e permite tentar novamente', async () => { mocks.get.mockRejectedValue(new Error('PRIVATE-ERROR-CLIENT-CANARY')); await mount(); expect(content()).not.toContain('PRIVATE-ERROR'); expect(content()).toContain('Não foi possível'); mocks.get.mockImplementation(url => Promise.resolve(fixture(url))); await act(async () => { button('Atualizar indicadores').props.onClick(); await tick() }); expect(content()).toContain('Profissional sintético A') })
  it('busca filtra e os atalhos abrem os módulos existentes', async () => { await mount(); const search = renderer.root.findAllByType('input').find(item => item.props.type === 'search'); await act(async () => search.props.onChange({ target: { value: 'Ex Prof' } })); expect(content()).toContain('Ex Profissional Avec'); expect(content()).not.toContain('Profissional sintético A'); await act(async () => button('Conferir extratos e repasses').props.onClick()); expect(props.onOpenTab).toHaveBeenCalledWith('Extrato e repasses') })
  it('preset de 7 dias sai do histórico e busca um período fechado', async () => { await mount(); await act(async () => { button('7 dias').props.onClick(); await tick() }); expect(mocks.get).toHaveBeenCalledTimes(2); expect(mocks.get.mock.calls[1][0]).toMatch(/\?inicio=\d{4}-\d{2}-\d{2}&fim=/) })
  it('gráfico da equipe: clicar no mês abre aquele mês como período', async () => {
    await mount(); expect(content()).toContain('Evolução da equipe')
    await act(async () => { byAria('Abrir nov/2025: VALOR 80').props.onClick(); await tick() })
    expect(mocks.get.mock.calls.at(-1)[0]).toContain('inicio=2025-11-01&fim=2025-11-30')
  })
  it('CSV sai no formato do Excel pt-BR', () => {
    const csv = toCsv(['Nome', 'Valor'], [['Ana; "A"', 1234.5], ['Beto', null]])
    expect(csv.startsWith('﻿')).toBe(true); expect(csv).toContain('"Ana; ""A""";1234,5'); expect(csv).toContain('Beto;')
  })
  it('visão por serviços: ranking, top 10 e explosão até o atendimento', async () => {
    mocks.get.mockImplementation(url => {
      const query = new URL(url, 'https://fixture.invalid').searchParams
      if (!query.get('visao')) return Promise.resolve(fixture(url))
      const base = fixture(url)
      const groups = [{ key: 'servico:corte', label: 'Corte', type: 'servico', revenue: 50, services: 1, products: 0, ticket: 50, professionals: 1, clients: 1, topProfessional: { name: 'Profissional sintético A', revenue: 50 }, firstDate: '2025-11-03', lastDate: '2025-11-03' }, { key: 'produto:pomada', label: 'Pomada', type: 'produto', revenue: 40, services: 0, products: 2, ticket: 20, professionals: 1, clients: 1, firstDate: '2026-01-15', lastDate: '2026-01-15' }]
      const chave = query.get('chave')
      return Promise.resolve({ readOnly: true, writePerformed: false, scope: base.scope, period: base.period, view: query.get('visao'), summary: { revenue: 90, groups: 2, services: 1, products: 2, productShare: 44.4, clients: 1, ticket: 30 }, groups: chave ? groups.filter(item => item.key === chave) : groups, ...(chave ? { rows: [{ ...ROWS[0], professionalId: 'employee-a', professionalName: 'Profissional sintético A' }] } : {}) })
    })
    await mount()
    const tab = renderer.root.findAllByType('button').find(item => item.props.role === 'tab' && text({ children: [item.props.children] }) === 'Serviços e produtos')
    await act(async () => { tab.props.onClick(); await tick() })
    expect(mocks.get.mock.calls.at(-1)[0]).toContain('visao=servicos')
    expect(content()).toContain('Top 10 por receita'); expect(content()).toContain('Pomada'); expect(content()).toContain('quem mais vendeu')
    await act(async () => { byAria('Detalhar Corte').props.onClick({ stopPropagation() {} }); await tick() })
    expect(mocks.get.mock.calls.at(-1)[0]).toContain('chave=servico%3Acorte')
    await act(async () => byAria('Expandir Profissional sintético A').props.onClick({ stopPropagation() {} }))
    await act(async () => byAria('Expandir 2025').props.onClick({ stopPropagation() {} }))
    await act(async () => byAria('Expandir nov/2025').props.onClick({ stopPropagation() {} }))
    expect(content()).toContain('Nível 5'); expect(content()).toContain('Cliente Um')
  })
  it('deslocamento de dia respeita viradas e ano bissexto', () => { expect(shiftEquipeDate('2024-03-01', -1)).toBe('2024-02-29'); expect(shiftEquipeDate('2026-01-01', -1)).toBe('2025-12-31') })
  it('comandas ambíguas mostram apuração parcial e ressalva financeira', async () => {
    mocks.get.mockImplementation(url => { const data = fixture(url); data.quality.ambiguousCommandsExcluded = 2; data.quality.commissionWarnings = ['Vínculo financeiro ambíguo: revisão requerida.']; return Promise.resolve(data) })
    await mount(); expect(content()).toContain('APURAÇÃO PARCIAL'); expect(content()).toContain('comandas ambíguas excluídas'); expect(content()).toContain('Vínculo financeiro ambíguo')
  })
  it('evidência não textual inesperada é ignorada, sem quebrar ou ecoar o objeto', async () => {
    mocks.get.mockImplementation(url => { const data = fixture(url); if (data.employees[0].suggestions) data.employees[0].suggestions[0].evidence = { email: 'PRIVATE-CANARY' }; return Promise.resolve(data) })
    await mount(); await act(async () => { byAria('Ver desempenho de Profissional sintético A').props.onClick({ stopPropagation() {} }); await tick() })
    expect(content()).toContain('Revisar o fluxo'); expect(content()).not.toContain('PRIVATE-CANARY')
  })
})
