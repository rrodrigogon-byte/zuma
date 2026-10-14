import React from 'react'
import { act, create } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ post: vi.fn() }))
vi.mock('../../lib/api', () => ({ api: { post: mock.post } }))
import AvecImportGovernancePreview, { validGovernanceResponse } from './AvecImportGovernancePreview'
const scope = { empresaId: 'company-a', lojaId: 'unit-a', storefrontId: 'sf-a', locationId: 'loc-a' }
const props = { empresaId: scope.empresaId, unitId: scope.lojaId, storefrontId: scope.storefrontId, locationId: scope.locationId }
const input = size => ({ source: 'avec', contractVersion: 'avec-dino-governance-v1', category: 'products', ...scope, rows: Array.from({ length: size }, () => ({ sourceId: 'PRIVATE-SOURCE-ONLY' })) })
const response = (size = 1) => ({ mode: 'read-only-avec-import-governance', contractVersion: 'avec-dino-governance-v1', category: 'products', scope, previewHash: 'a'.repeat(64), summary: { total: size, readyForMapping: size, blocked: 0, ignored: 0, readyToApply: 0 }, rows: Array.from({ length: size }, (_, i) => ({ line: i + 1, status: 'ready_for_mapping', reasons: [] })), write: { performed: false, enabled: false, endpoint: null }, policy: { agendaWindowDays: 60 }, blockers: ['SOURCE_ESTABLISHMENT_BINDING_REQUIRED', 'DESTINATION_BASELINE_AND_MAPPING_REQUIRED', 'FINAL_LOT_APPROVAL_REQUIRED', 'OFFICIAL_WRITER_NOT_ENABLED'] })
const text = node => typeof node === 'string' ? node : Array.isArray(node) ? node.map(text).join(' ') : text(node?.props?.children || node?.children || '')
const tick = () => new Promise(resolve => setTimeout(resolve, 0))
let ui
const button = () => ui.root.findAllByType('button').find(node => text(node.props.children).includes('Conferir estrutura'))
async function mount(p = props) { await act(async () => { ui = create(<AvecImportGovernancePreview {...p} />); await tick() }) }
async function select(content = JSON.stringify(input(1))) { await act(async () => { await ui.root.findByType('input').props.onChange({ target: { files: [{ size: content.length, text: async () => content }], value: '' } }); await tick() }) }
async function run() { await act(async () => { button().props.onClick(); await tick() }) }
beforeEach(() => { mock.post.mockReset(); globalThis.IS_REACT_ACT_ENVIRONMENT = true })
afterEach(async () => { if (ui) await act(async () => ui.unmount()); ui = null })
describe('preparação AVEC no mesmo fluxo, sem writer', () => {
  it('abre sem requisição e não possui botão de aplicar', async () => {
    await mount(); expect(mock.post).not.toHaveBeenCalled(); expect(button().props.disabled).toBe(true)
    expect(text(ui.toJSON())).toContain('60 dias'); expect(text(ui.toJSON())).not.toContain('Executar importação')
  })
  it('aceita só agregados estruturais e nunca imprime conteúdo privado do arquivo', async () => {
    await mount(); await select(); mock.post.mockResolvedValue(response()); await run()
    expect(mock.post.mock.calls[0][0]).toBe('/api/admin/commerce/catalog/avec/governance/preview')
    expect(text(ui.toJSON())).toContain('aptas para gravar'); expect(text(ui.toJSON())).not.toContain('PRIVATE-SOURCE-ONLY')
  })
  it('arquivo malformado não exibe o texto sensível do erro de JSON', async () => {
    await mount(); await select('{"SECRET-SYNTHETIC": ')
    expect(text(ui.toJSON())).toContain('Arquivo JSON inválido'); expect(text(ui.toJSON())).not.toContain('SECRET-SYNTHETIC'); expect(mock.post).not.toHaveBeenCalled()
  })
  it('contexto incompleto ou arquivo fora do escopo não consulta', async () => {
    await mount({ ...props, unitId: '' }); await select(); await run(); expect(mock.post).not.toHaveBeenCalled()
    expect(text(ui.toJSON())).toContain('fora do contrato/escopo')
  })
  it('trocar unidade aborta e descarta resposta tardia e arquivo', async () => {
    let resolve; mock.post.mockReturnValue(new Promise(r => { resolve = r }))
    await mount(); await select(); await run(); const signal = mock.post.mock.calls[0][2].signal
    await act(async () => { ui.update(<AvecImportGovernancePreview {...props} unitId="unit-b" />); await tick(); resolve(response()); await tick() })
    expect(signal.aborted).toBe(true); expect(button().props.disabled).toBe(true); expect(text(ui.toJSON())).not.toContain('Estrutura válida — falta mapear')
  })
  it('nova categoria invalida arquivo e resposta antiga', async () => {
    let resolve; mock.post.mockReturnValue(new Promise(r => { resolve = r }))
    await mount(); await select(); await run()
    await act(async () => { ui.root.findByType('select').props.onChange({ target: { value: 'agenda' } }); await tick(); resolve(response()); await tick() })
    expect(button().props.disabled).toBe(true); expect(text(ui.toJSON())).not.toContain('Estrutura válida — falta mapear')
  })
  it('resposta que habilita writer é rejeitada e erro remoto não é ecoado', async () => {
    await mount(); await select(); mock.post.mockResolvedValue({ ...response(), write: { performed: true, enabled: true, endpoint: '/execute' } }); await run()
    expect(text(ui.toJSON())).toContain('prévia foi descartada'); mock.post.mockRejectedValue(new Error('REMOTE-PRIVATE-VALUE')); await run()
    expect(text(ui.toJSON())).not.toContain('REMOTE-PRIVATE-VALUE')
  })
  it('paginação considera o lote inteiro sem nova consulta', async () => {
    await mount(); await select(JSON.stringify(input(26))); mock.post.mockResolvedValue(response(26)); await run()
    expect(text(ui.toJSON()).replace(/\s+/g, ' ')).toContain('Página 1 de 2')
    const next = ui.root.findAllByType('button').find(node => text(node.props.children) === 'Próxima')
    await act(async () => { next.props.onClick(); await tick() })
    expect(text(ui.toJSON()).replace(/\s+/g, ' ')).toContain('Página 2 de 2'); expect(mock.post).toHaveBeenCalledTimes(1)
  })
})
it('schema de resposta verifica empresa, unidade, tamanho, contagens e bloqueios', () => {
  expect(validGovernanceResponse(response(), scope, 'products', 1)).toBe(true)
  for (const patch of [{ scope: { ...scope, empresaId: 'company-b' } }, { scope: { ...scope, locationId: 'loc-b' } }, { rows: [] }, { blockers: [] }, { summary: { ...response().summary, readyToApply: 1 } }, { summary: { ...response().summary, blocked: 1 } }]) expect(validGovernanceResponse({ ...response(), ...patch }, scope, 'products', 1)).toBe(false)
})
it('rejeita aliases sensíveis antes do envio, sem repetir conteúdo', async () => {
  await mount(); const content = input(1); content.rows[0].evidence = { access_token: 'PRIVATE-LOCAL-NO-SEND' }
  await select(JSON.stringify(content)); await run(); expect(mock.post).not.toHaveBeenCalled(); expect(text(ui.toJSON())).toContain('campos sensíveis proibidos'); expect(text(ui.toJSON())).not.toContain('PRIVATE-LOCAL-NO-SEND')
})
it('modelos incluem campos mínimos fiscais e deixam verificação de agenda pendente', async () => {
  const { governanceTemplate } = await import('./AvecImportGovernancePreview')
  const fiscal = governanceTemplate('fiscal', scope).rows[0]
  expect(fiscal.reviewScope).toEqual({ empresaId: scope.empresaId, lojaId: scope.lojaId }); expect(fiscal.dataFormat).toBe(''); expect(fiscal.fiscalReviewConfirmed).toBe(false); expect(fiscal.cnpj).toBe('')
  const agenda = governanceTemplate('agenda', scope).rows[0]
  expect(agenda.originalIdsVerified).toBe(false); expect(agenda.individualEventVerified).toBe(false); expect(agenda.durationMinutes).toBeNull()
})
it('datas e fatos de origem ficam vazios nos cinco modelos', async () => {
  const { governanceTemplate } = await import('./AvecImportGovernancePreview')
  for (const category of ['products', 'fees', 'materials', 'fiscal', 'agenda']) {
    const model = governanceTemplate(category, scope); expect(model.extractedAt).toBe(''); expect(model.cutoff).toBe(''); expect(model.sourceEstablishmentId).toBe('')
  }
  expect(governanceTemplate('products', scope).rows[0].custoNature).toBe(''); expect(governanceTemplate('fiscal', scope).rows[0].inscricaoEstadual.state).toBe('')
})
it('bloqueia aliases de credenciais e tamanho acima de 512 KiB antes de ler/enviar', async () => {
  await mount()
  for (const key of ['apiKey', 'client_secret', 'secretValue', 'unfamiliar']) {
    const content = input(1); content.rows[0][key] = 'PRIVATE-NOT-SENT'; await select(JSON.stringify(content)); await run(); expect(mock.post).not.toHaveBeenCalled()
  }
  const read = vi.fn()
  await act(async () => { await ui.root.findByType('input').props.onChange({ target: { files: [{ size: 512 * 1024 + 1, text: read }], value: '' } }); await tick() })
  expect(read).not.toHaveBeenCalled(); expect(mock.post).not.toHaveBeenCalled(); expect(text(ui.toJSON())).toContain('512 KiB')
})
