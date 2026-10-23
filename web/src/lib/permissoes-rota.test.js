import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PERMISSAO_DA_ROTA, permissaoQueFalta } from './permissoes-rota.js'
import { rotaVisivel } from './disponibilidade.js'

test('sem lista de permissões (plataforma, legado) nada é escondido', () => {
  assert.equal(permissaoQueFalta('/admin/compras', null), null)
  assert.equal(rotaVisivel('/admin/compras', {}), true)
})

test('perfil financeiro não vê estoque, reservas, PDV offline nem supermercado; vê notas', () => {
  const financeiro = ['payments.read', 'payments.write', 'reports.read']
  for (const rota of ['/admin/compras', '/admin/perdas-inventario', '/admin/reservas', '/admin/pdv-offline', '/admin/supermercado?aba=lotes', '/admin/fiscal/config']) {
    assert.ok(permissaoQueFalta(rota, financeiro), rota)
    assert.equal(rotaVisivel(rota, { permissoes: financeiro }), false, rota)
  }
  assert.equal(permissaoQueFalta('/admin/notas', financeiro), null)
  // tela fora do mapa não é filtrada
  assert.equal(rotaVisivel('/admin/financeiro', { permissoes: [] }), true)
})

test('as permissões do mapa são as que o servidor informa em /api/admin/minhas-permissoes', () => {
  const server = readFileSync(new URL('../../../app/server.js', import.meta.url), 'utf8')
  const lista = server.match(/const PERMISSOES_DO_MENU = \[([^\]]+)\]/)[1]
  for (const codigo of new Set(Object.values(PERMISSAO_DA_ROTA))) assert.ok(lista.includes(`'${codigo}'`), codigo)
})

test('enquanto as permissões carregam, só as telas do mapa esperam', async () => {
  const { aguardandoPermissoes } = await import('./permissoes-rota.js')
  assert.equal(aguardandoPermissoes('/admin/supermercado', undefined), true)
  assert.equal(aguardandoPermissoes('/admin/financeiro', undefined), false)
  assert.equal(aguardandoPermissoes('/admin/supermercado', null), false)
  assert.equal(aguardandoPermissoes('/admin/supermercado', ['catalog.read']), false)
})
