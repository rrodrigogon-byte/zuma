import test from 'node:test'
import assert from 'node:assert/strict'
import { buildBusinessNetworkLayout, redactDisplayText } from './businessNetworkLayout.js'

const network = {
  nodes: [
    { id: 'business', type: 'business', area: 'geral', label: 'Nome que não deve substituir o contexto', status: 'ok' },
    { id: 'c-1', type: 'cliente', area: 'clientes', label: 'Nome privado', customerRef: 'ref-opaco', value: 4, status: 'limitado' },
    { id: 'stock', type: 'estoque', area: 'estoque', label: 'Produtos', value: 8, severity: 'medium', status: 'ok' },
    { id: 'ops', type: 'operacao', area: 'operacao', label: 'Agenda', value: 2, status: 'ok' },
  ],
  links: [
    { from: 'business', to: 'c-1', relation: 'COMPROU', weight: 2, status: 'ok' },
    { from: 'business', to: 'stock', relation: 'DEMANDA', weight: 3, status: 'ok' },
    { from: 'business', to: 'ops', relation: 'AGENDOU', weight: 1, status: 'ok' },
    { from: 'missing', to: 'stock', relation: 'INVALIDA', weight: 99 },
  ],
  summary: { totalNodes: 4, totalLinks: 3 },
}

test('layout da rede é finito, estável e só mantém arestas com nós visíveis', () => {
  const first = buildBusinessNetworkLayout(network, { unitLabel: 'Unidade ativa', maxNodes: 10, maxLinks: 10 })
  const second = buildBusinessNetworkLayout(network, { unitLabel: 'Unidade ativa', maxNodes: 10, maxLinks: 10 })
  assert.equal(first.width, 1040)
  assert.equal(first.height, 650)
  assert.deepEqual(first.nodes.map(({ id, x, y }) => ({ id, x, y })), second.nodes.map(({ id, x, y }) => ({ id, x, y })))
  assert.ok(first.nodes.length > 0)
  assert.ok(first.nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y)))
  const ids = new Set(first.nodes.map((node) => node.id))
  assert.ok(first.links.every((link) => ids.has(link.from) && ids.has(link.to)))
  assert.equal(first.links.length, 3)
  assert.equal(first.nodes.find((node) => node.id === 'c-1').label, 'Cliente 01')
  assert.equal(first.nodes.find((node) => node.id === 'business').label, 'Unidade ativa')
})

test('hub estrutural de clientes não é rotulado nem numerado como pessoa', () => {
  const result = buildBusinessNetworkLayout({
    nodes: [
      { id: 'business', type: 'business', area: 'geral', status: 'ok' },
      { id: 'hub:clientes', type: 'hub', area: 'clientes', label: 'Clientes', status: 'ok' },
      { id: 'customer-1', type: 'customer', area: 'clientes', label: 'Nome privado', status: 'ok' },
    ],
    links: [], summary: { totalNodes: 3, totalLinks: 0 },
  }, { maxNodes: 10, maxLinks: 10 })
  assert.equal(result.nodes.find((node) => node.id === 'hub:clientes').label, 'Clientes')
  assert.equal(result.nodes.find((node) => node.id === 'customer-1').label, 'Cliente 01')
})

test('redige e-mail e documento pessoal em texto livre', () => {
  const label = redactDisplayText('Produto alice@example.com CPF 123.456.789-00')
  assert.match(label, /e-mail oculto/)
  assert.match(label, /documento oculto/)
  assert.doesNotMatch(label, /alice@example\.com|123\.456\.789-00/)
})

test('formata moeda, taxa e zero com unidade correta no detalhe do nó', () => {
  const result = buildBusinessNetworkLayout({
    nodes: [
      { id: 'business', type: 'business', area: 'geral', status: 'ok' },
      { id: 'income', type: 'metric', area: 'financeiro', label: 'Receita', value: 1234.5, valueFormat: 'currency', status: 'ok' },
      { id: 'rate', type: 'metric', area: 'operacao', label: 'Comparecimento', value: 83.3, valueFormat: 'percent', status: 'ok' },
      { id: 'zero', type: 'metric', area: 'estoque', label: 'Produtos em falta', value: 0, status: 'ok' },
    ],
    links: [], summary: { totalNodes: 4, totalLinks: 0 },
  }, { maxNodes: 10, maxLinks: 10 })
  assert.match(result.nodes.find((node) => node.id === 'income').value, /R\$/)
  assert.match(result.nodes.find((node) => node.id === 'income').value, /1\.234,50/)
  assert.equal(result.nodes.find((node) => node.id === 'rate').value, '83,3%')
  assert.equal(result.nodes.find((node) => node.id === 'zero').value, '0')
})

test('limites informam truncamento sem transformar fonte ausente em zero', () => {
  const result = buildBusinessNetworkLayout(network, { maxNodes: 2, maxLinks: 1 })
  assert.equal(result.summary.visibleNodes, 2)
  assert.equal(result.summary.visibleLinks, 1)
  assert.equal(result.summary.truncated, true)
  assert.equal(result.summary.uiOmittedNodes, 2)
  assert.equal(result.summary.uiOmittedLinks, 2)
  assert.equal(result.summary.filteredNodes, 0)
  assert.equal(result.quality.limited, true)
  assert.equal(result.nodes.find((node) => node.id === 'stock').value, '8')
})

test('filtro de área conserva raiz, cluster e produto conectado e separa contexto de recorte', () => {
  const detailed = {
    nodes: [
      { id: 'business', type: 'business', area: 'geral', label: 'Tenant incorreto', status: 'ok' },
      { id: 'hub:estoque', type: 'hub', area: 'estoque', label: 'Estoque', status: 'ok' },
      { id: 'stock', type: 'inventory', area: 'estoque', label: 'Saldo da pomada', value: 2, status: 'ok', sources: ['graph'] },
      { id: 'product', type: 'product', area: 'commerce', label: 'Pomada', value: null, status: 'desconhecido', sources: [{ name: 'Venda 5565999990001', status: 'desconhecido' }], window: { kind: 'current_stock_snapshot', capturedAt: '2026-10-22T18:00:00Z', label: 'Snapshot atual' } },
      { id: 'customer', type: 'customer', area: 'clientes', label: 'Nome privado', status: 'ok', customerRef: 'ref-opaco' },
    ],
    links: [
      { from: 'business', to: 'hub:estoque', relation: 'AGRUPA', label: 'Área de negócio', structural: true, weight: null, status: 'ok' },
      { from: 'hub:estoque', to: 'stock', relation: 'AGRUPA', label: 'Agrupa entidade', structural: true, weight: null, status: 'ok' },
      { from: 'stock', to: 'product', relation: 'AGRUPA', label: 'Mesmo produto', structural: true, weight: null, status: 'desconhecido' },
      { from: 'customer', to: 'product', relation: 'COMPROU', label: 'comprou', weight: null, status: 'desconhecido', sources: ['graph'] },
    ],
    summary: {
      totalNodes: 5, totalLinks: 4,
      windows: {
        selectedPeriod: { kind: 'selected_period', from: '2026-09-22T18:00:00Z', to: '2026-10-22T18:00:00Z', label: 'Período selecionado' },
        relationshipHistory: { kind: 'relationship_history', from: '2026-10-01T00:00:00Z', to: '2026-10-10T00:00:00Z', label: 'Relações datadas nos últimos 365 dias' },
        stockSnapshot: { kind: 'current_stock_snapshot', capturedAt: '2026-10-22T18:00:00Z', label: 'Snapshot atual de estoque' },
      },
    },
  }
  const result = buildBusinessNetworkLayout(detailed, { area: 'estoque', unitLabel: 'Loja Centro', maxNodes: 20, maxLinks: 20 })
  const ids = new Set(result.nodes.map((node) => node.id))
  assert.ok(ids.has('business'))
  assert.ok(ids.has('hub:estoque'))
  assert.ok(ids.has('stock'))
  assert.ok(ids.has('product'))
  assert.equal(ids.has('customer'), false)
  assert.equal(result.nodes.find((node) => node.id === 'business').label, 'Loja Centro')
  assert.equal(result.nodes.find((node) => node.id === 'product').contextOnly, true)
  assert.equal(result.links.length, 3)
  assert.ok(result.links.every((link) => link.structural && link.weight === null))
  assert.equal(result.summary.contextNodes, 1)
  assert.equal(result.summary.filteredNodes, 1)
  assert.equal(result.summary.filteredLinks, 1)
  assert.equal(result.summary.truncated, false)
  assert.equal(result.nodes.find((node) => node.id === 'product').status, 'desconhecido')
  assert.equal(result.nodes.find((node) => node.id === 'product').sources[0].status, 'desconhecido')
  assert.equal(result.nodes.find((node) => node.id === 'product').sources[0].label, 'Venda contato oculto')
  assert.equal(result.nodes.find((node) => node.id === 'stock').sources[0].label, 'Grafo de relações')
  assert.equal(JSON.stringify(result).includes('5565999990001'), false)
  assert.equal(JSON.stringify(result).includes('Nome privado'), false)
  assert.match(result.windows.selectedPeriod, /22/)
  assert.match(result.windows.relationshipHistory, /365/)
  assert.match(result.nodes.find((node) => node.id === 'product').window, /Snapshot atual.*22/)
  assert.equal(result.quality.unknown, true)
  assert.equal(result.quality.limited, true)
  assert.equal(result.quality.unavailable, false)

  const search = buildBusinessNetworkLayout(detailed, { query: 'Pomada', unitLabel: 'Loja Centro' })
  const searchIds = new Set(search.nodes.map((node) => node.id))
  assert.ok(searchIds.has('business'))
  assert.ok(searchIds.has('product'))
  assert.ok(searchIds.has('customer'))
  assert.equal(search.nodes.find((node) => node.id === 'customer').contextOnly, true)
  assert.equal(search.nodes.find((node) => node.id === 'customer').label, 'Cliente 01')
  assert.ok(search.summary.matchedNodes > 0)
})

test('limite visual prioriza uma relação observada antes dos links estruturais', () => {
  const result = buildBusinessNetworkLayout({
    nodes: [
      { id: 'business', type: 'business', area: 'geral', status: 'ok' },
      { id: 'hub', type: 'hub', area: 'commerce', status: 'ok' },
      { id: 'customer', type: 'customer', area: 'clientes', customerRef: 'ref-opaco', status: 'ok' },
      { id: 'product', type: 'product', area: 'commerce', status: 'ok' },
      { id: 'customer-2', type: 'customer', area: 'clientes', customerRef: 'ref-opaco-2', status: 'ok' },
      { id: 'product-2', type: 'product', area: 'commerce', status: 'ok' },
    ],
    links: [
      { from: 'business', to: 'hub', relation: 'AGRUPA', structural: true, weight: null, status: 'ok' },
      { from: 'hub', to: 'product', relation: 'AGRUPA', structural: true, weight: null, status: 'ok' },
      { from: 'hub', to: 'product-2', relation: 'AGRUPA', structural: true, weight: null, status: 'ok' },
      { from: 'customer', to: 'product', relation: 'COMPROU', structural: false, weight: 2, status: 'ok' },
      { from: 'customer-2', to: 'product-2', relation: 'COMPROU', structural: false, weight: 1, status: 'ok' },
    ],
    summary: { totalNodes: 6, totalLinks: 5 },
  }, { maxNodes: 4, maxLinks: 10 })
  assert.ok(result.links.some((link) => link.from === 'customer' && link.to === 'product' && !link.structural))
  const visibleIds = new Set(result.nodes.map((node) => node.id))
  const preservedEvent = result.links.find((link) => !link.structural)
  assert.ok(visibleIds.has(preservedEvent.from) && visibleIds.has(preservedEvent.to))
  assert.equal(result.summary.uiOmittedObservedLinks, 1)
  assert.equal(result.summary.uiOmittedStructuralLinks, 1)
})
