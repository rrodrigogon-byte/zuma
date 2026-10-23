import test from 'node:test'
import assert from 'node:assert/strict'
import { itemVisivelNoPerfil } from './perfis-menu.js'

test('operador não vê a gestão no menu; admin vê tudo', () => {
  const gestao = ['/admin', '/admin/bi', '/admin/auditoria', '/admin/barbearia-erp?area=gestao&tab=Comiss%C3%B5es', '/admin/barbearia-erp?area=operacao&tab=Vis%C3%A3o+geral', '/admin/ecommerce?tab=users']
  for (const to of gestao) {
    assert.equal(itemVisivelNoPerfil(to, 'operador'), false, to)
    assert.equal(itemVisivelNoPerfil(to, 'admin'), true, to)
  }
  for (const to of ['/admin/barbearia-erp?area=operacao&tab=Agenda', '/admin/barbearia-erp?area=operacao&tab=Caixa+e+fechamento', '/admin/clientes-360', '/admin/financeiro', '/pdv']) {
    assert.equal(itemVisivelNoPerfil(to, 'operador'), true, to)
  }
})
