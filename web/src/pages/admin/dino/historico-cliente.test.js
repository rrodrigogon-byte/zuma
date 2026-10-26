import test from 'node:test'
import assert from 'node:assert/strict'
import { abrirHistoricoEmNovaGuia, refHistoricoCliente, urlHistoricoCliente } from './historico-cliente.js'

test('referência da ficha: cadastro primeiro, depois telefone; sem nada, vazio', () => {
  assert.equal(refHistoricoCliente({ clienteId: 'cli-1', clienteTelefone: '65999990001' }), 'dino:cli-1')
  assert.equal(refHistoricoCliente({ id: 'cli-2', telefone: '65999990002' }), 'dino:cli-2')
  assert.equal(refHistoricoCliente({ canonicalRef: 'loja:11111111-2222-3333-4444-555555555555' }), 'loja:11111111-2222-3333-4444-555555555555')
  assert.equal(refHistoricoCliente({ ref: 'dino:cli-3' }), 'dino:cli-3')
  assert.equal(refHistoricoCliente({ clienteTelefone: '(65) 99999-0001' }), 'tel:65999990001')
  assert.equal(refHistoricoCliente({ clienteTelefone: '9999-0001' }), '', 'sem DDD não identifica')
  assert.equal(refHistoricoCliente({ clienteNome: 'Fulano' }), '')
  assert.equal(urlHistoricoCliente('dino:cli 1'), '/admin/clientes-360/dino%3Acli%201')
})

test('abre em nova guia só quando identifica o cliente', () => {
  const abertas = []
  assert.equal(abrirHistoricoEmNovaGuia({ clienteId: 'c9' }, (url) => abertas.push(url)), true)
  assert.equal(abrirHistoricoEmNovaGuia({ id: 'c10' }, (url) => abertas.push(url)), true)
  assert.equal(abrirHistoricoEmNovaGuia({ clienteNome: 'Sem cadastro' }, (url) => abertas.push(url)), false)
  assert.deepEqual(abertas, ['/admin/clientes-360/dino%3Ac9', '/admin/clientes-360/dino%3Ac10'])
})
