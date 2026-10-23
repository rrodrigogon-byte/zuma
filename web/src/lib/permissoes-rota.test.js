import test from 'node:test'
import assert from 'node:assert/strict'
import { PERMISSAO_DA_ROTA, permissaoQueFalta } from './permissoes-rota.js'
import { rotaVisivel } from './disponibilidade.js'

test('sem lista de permissões (plataforma, legado) nada é escondido', () => {
  assert.equal(permissaoQueFalta('/admin/compras', null), null)
  assert.equal(rotaVisivel('/admin/compras', {}), true)
})

test('perfil financeiro não vê estoque, reservas nem supermercado; vê notas e PDV offline', () => {
  const financeiro = ['payments.read', 'payments.write', 'reports.read']
  for (const rota of ['/admin/compras', '/admin/perdas-inventario', '/admin/reservas', '/admin/supermercado?aba=lotes', '/admin/fiscal/config']) {
    assert.ok(permissaoQueFalta(rota, financeiro), rota)
    assert.equal(rotaVisivel(rota, { permissoes: financeiro }), false, rota)
  }
  assert.equal(permissaoQueFalta('/admin/notas', financeiro), null)
  assert.equal(permissaoQueFalta('/admin/pdv-offline', financeiro), null)
  // tela fora do mapa não é filtrada
  assert.equal(rotaVisivel('/admin/financeiro', { permissoes: [] }), true)
})

test('PDV offline abre com configuração ou com o financeiro (conflitos de venda)', () => {
  assert.equal(permissaoQueFalta('/admin/pdv-offline', ['payments.read']), null)
  assert.equal(permissaoQueFalta('/admin/pdv-offline', ['settings.write']), null)
  assert.equal(permissaoQueFalta('/admin/pdv-offline', ['customers.read']), 'settings.write')
})

test('enquanto as permissões carregam, só as telas do mapa esperam', async () => {
  const { aguardandoPermissoes } = await import('./permissoes-rota.js')
  assert.equal(aguardandoPermissoes('/admin/supermercado', undefined), true)
  assert.equal(aguardandoPermissoes('/admin/financeiro', undefined), false)
  assert.equal(aguardandoPermissoes('/admin/supermercado', null), false)
  assert.equal(aguardandoPermissoes('/admin/supermercado', ['catalog.read']), false)
})
