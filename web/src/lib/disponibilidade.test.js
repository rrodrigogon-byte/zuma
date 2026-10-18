import test from 'node:test'
import assert from 'node:assert/strict'
import { moduloEmImplantacao, rotaVisivel, EM_IMPLANTACAO, GLOBAIS_DO_EVENTO } from './disponibilidade.js'

test('telas sem backend em produção: aviso e fora do menu para todos', () => {
  assert.equal(moduloEmImplantacao('/admin/fiscal/config'), 'Configuração de NF-e e NFC-e')
  assert.equal(moduloEmImplantacao('/admin/supermercado?aba=lotes'), 'Supermercado')
  assert.equal(moduloEmImplantacao('/admin/clube/quadras'), null)
  assert.equal(moduloEmImplantacao('/admin/clientes'), null)
  assert.equal(moduloEmImplantacao('/admin/contas-receber'), null)
  assert.equal(moduloEmImplantacao('/admin/fechamento-diario'), null)
  assert.equal(moduloEmImplantacao('/admin/cadastros-mestres'), null)
  assert.equal(rotaVisivel('/admin/clientes', { usuarioDeEmpresa: true }), true)
  assert.equal(rotaVisivel('/admin/notas', { isPlatformAdmin: true }), false)
})

test('telas do banco global do evento: só administração da plataforma ou usuário legado', () => {
  assert.equal(rotaVisivel('/admin/torneios', { isPlatformAdmin: true, usuarioDeEmpresa: false }), true)
  assert.equal(rotaVisivel('/admin/torneios', { isPlatformAdmin: false, usuarioDeEmpresa: false }), true)
  assert.equal(rotaVisivel('/admin/torneios', { isPlatformAdmin: false, usuarioDeEmpresa: true }), false)
  assert.equal(rotaVisivel('/pdv', { usuarioDeEmpresa: true }), true)
  assert.equal(rotaVisivel('/admin/cardapio', { usuarioDeEmpresa: true }), true)
  assert.equal(rotaVisivel('/kds', { usuarioDeEmpresa: true }), true)
  assert.equal(rotaVisivel('/admin/ecommerce?tab=orders', { usuarioDeEmpresa: true }), true)
})

test('nenhuma rota está nas duas listas', () => {
  for (const rota of Object.keys(EM_IMPLANTACAO)) assert.equal(GLOBAIS_DO_EVENTO.includes(rota), false, rota)
})
