import assert from 'node:assert/strict'
import test from 'node:test'
import { lojasDaEmpresa, mesclarLojas, normalizarLojas, selecionarLojaAutomatica, substituirLojas } from './context-selection.js'

const lojas = [
  { id: 'dino-matriz', empresaId: 'dino', nome: 'DINO-MATRIZ' },
  { id: 'agro-matriz', empresaId: 'agro', nome: 'AGRO OPEN TTC' },
  { id: 'agro-filial', empresaId: 'agro', nome: 'Filial Agro' },
  { id: 'inativa', empresaId: 'dino', nome: 'Inativa', ativa: false },
]

test('seleciona automaticamente a única unidade ativa da empresa', () => {
  assert.deepEqual(selecionarLojaAutomatica(lojas, 'dino'), lojas[0])
})

test('não escolhe automaticamente quando a empresa possui várias unidades', () => {
  assert.equal(selecionarLojaAutomatica(lojas, 'agro'), null)
})

test('preserva a unidade atual válida mesmo quando há várias unidades', () => {
  assert.deepEqual(selecionarLojaAutomatica(lojas, 'agro', lojas[2]), lojas[2])
})

test('ignora unidades inativas e nunca mistura empresas', () => {
  assert.deepEqual(lojasDaEmpresa(lojas, 'dino'), [lojas[0]])
  assert.equal(selecionarLojaAutomatica(lojas, 'ausente'), null)
})

test('aceita o alias Commerce da empresa sem misturar outras lojas', () => {
  const loja = { id: 'dino-commerce', empresaId: 'emp-kytto-001', commerceEmpresaId: 'dino-commerce-id', nome: 'DINO-MATRIZ' }
  assert.deepEqual(lojasDaEmpresa([loja], 'dino-commerce-id'), [loja])
  assert.equal(lojasDaEmpresa([loja], 'outra-empresa').length, 0)
})

test('lojas do Commerce sem empresa não apagam o vínculo já conhecido e herdam a empresa ativa', async () => {
  const { mesclarLojasComerciais } = await import('./context-selection.js')
  const existentes = [{ id: 'dino-matriz', empresaId: 'dino', nome: 'DINO-MATRIZ' }]
  const novas = [{ id: 'dino-matriz', codigo: 'DINO-MATRIZ', nome: 'Barbearia Dino', ativa: true }, { id: 'loja-nova', nome: 'Nova', ativa: true }]
  const mescladas = mesclarLojasComerciais(existentes, novas, 'dino-commerce')
  assert.equal(mescladas.find((loja) => loja.id === 'dino-matriz').empresaId, 'dino')
  assert.equal(mescladas.find((loja) => loja.id === 'loja-nova').commerceEmpresaId, 'dino-commerce')
  assert.deepEqual(selecionarLojaAutomatica(mescladas, 'dino').id, 'dino-matriz')
})

test('repara entrada gravada sem vínculo usando a referência conhecida', async () => {
  const { repararLojasSemEmpresa } = await import('./context-selection.js')
  const reparadas = repararLojasSemEmpresa([{ id: 'dino-matriz', nome: 'Barbearia Dino' }, { id: 'x', nome: 'X' }], [{ id: 'dino-matriz', empresaId: 'emp', commerceEmpresaId: 'dino-commerce' }])
  assert.equal(reparadas[0].commerceEmpresaId, 'dino-commerce')
  assert.equal(reparadas[1].empresaId, undefined)
  assert.equal(selecionarLojaAutomatica(reparadas, 'dino-commerce').id, 'dino-matriz')
})

test('aceita empresa_id vindo do servidor e normaliza para empresaId', () => {
  const [loja] = normalizarLojas([{ id: 'l1', empresa_id: 'e1', nome: 'Matriz' }])
  assert.equal(loja.empresaId, 'e1')
  assert.deepEqual(selecionarLojaAutomatica([{ id: 'l1', empresa_id: 'e1', nome: 'Matriz' }], 'e1').id, 'l1')
})

test('mesclar não apaga o empresaId quando a lista nova vem sem ele (vitrine do e-commerce)', () => {
  const atuais = [{ id: 'l1', empresaId: 'e1', nome: 'Matriz', codigo: 'MTZ' }]
  const novas = [{ id: 'l1', nome: 'Matriz Centro', codigo: undefined }, { id: 'l2', empresaId: 'e2', nome: 'Outra' }]
  const resultado = mesclarLojas(atuais, novas)
  assert.deepEqual(resultado.find((loja) => loja.id === 'l1'), { id: 'l1', empresaId: 'e1', nome: 'Matriz Centro', codigo: 'MTZ' })
  assert.equal(resultado.length, 2)
  assert.equal(selecionarLojaAutomatica(resultado, 'e1').id, 'l1')
})

test('mesclar não troca o empresaId que já veio do servidor', () => {
  const r = mesclarLojas([{ id: 'l1', empresaId: 'e1' }], [{ id: 'l1', empresaId: 'e2', nome: 'X' }])
  assert.equal(r[0].empresaId, 'e1')
})

test('lista completa substitui: unidade desativada ou sem acesso sai do seletor', () => {
  const atuais = [{ id: 'l1', empresaId: 'e1', nome: 'Matriz' }, { id: 'l2', empresaId: 'e1', nome: 'Filial' }, { id: 'x1', empresaId: 'e2', nome: 'Outra empresa' }]
  const daEmpresa = substituirLojas(atuais, [{ id: 'l1', nome: 'Matriz' }, { id: 'l2', nome: 'Filial', ativa: false }], { empresaId: 'e1' })
  assert.deepEqual(lojasDaEmpresa(daEmpresa, 'e1').map((l) => l.id), ['l1'])
  assert.deepEqual(lojasDaEmpresa(daEmpresa, 'e2').map((l) => l.id), ['x1'])
  assert.equal(selecionarLojaAutomatica(daEmpresa, 'e1', { id: 'l2' }).id, 'l1')
  const sessao = substituirLojas(atuais, [{ id: 'l1', empresa_id: 'e1' }])
  assert.deepEqual(sessao.map((l) => l.id), ['l1'])
})
