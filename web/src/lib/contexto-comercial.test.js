import assert from 'node:assert/strict'
import test from 'node:test'
import { empresaSemUnidade, mesclarLojasDoServidor, reiniciarSincronizacaoContexto, sincronizarContextoComercial } from './contexto-comercial.js'

test('detecta empresa ativa sem unidade vinculada no navegador', () => {
  assert.equal(empresaSemUnidade([{ id: 'l1', nome: 'Sem vínculo' }], 'emp'), true)
  assert.equal(empresaSemUnidade([{ id: 'l1', empresaId: 'emp' }], 'emp'), false)
  assert.equal(empresaSemUnidade([{ id: 'l1', commerceEmpresaId: 'emp' }], 'emp'), false)
  assert.equal(empresaSemUnidade([], ''), false)
})

test('servidor restaura o vínculo sem descartar lojas que só existem no navegador', () => {
  const lojas = mesclarLojasDoServidor(
    [{ id: 'l1', nome: 'Antiga' }, { id: 'vitrine', commerceEmpresaId: 'emp', nome: 'Vitrine' }],
    [{ id: 'l1', empresaId: 'emp', codigo: 'MATRIZ', nome: 'Matriz' }],
  )
  assert.deepEqual(lojas.find((loja) => loja.id === 'l1'), { id: 'l1', empresaId: 'emp', codigo: 'MATRIZ', nome: 'Matriz', commerceEmpresaId: undefined })
  assert.equal(lojas.find((loja) => loja.id === 'vitrine').commerceEmpresaId, 'emp')
})

test('sincronização consulta o servidor, atualiza o contexto e não repete chamadas simultâneas', async () => {
  reiniciarSincronizacaoContexto()
  let chamadas = 0
  const cliente = { get: async (path) => { chamadas += 1; assert.equal(path, '/api/admin/commerce-session'); return { empresas_acessiveis: [{ id: 'emp' }], lojas_acessiveis: [{ id: 'l1', empresaId: 'emp' }] } } }
  const atualizacoes = []
  const atualizarContextoLojas = (payload) => atualizacoes.push(payload)
  await Promise.all([
    sincronizarContextoComercial({ lojasAcessiveis: [{ id: 'l1' }], atualizarContextoLojas, cliente }),
    sincronizarContextoComercial({ lojasAcessiveis: [{ id: 'l1' }], atualizarContextoLojas, cliente }),
  ])
  assert.equal(chamadas, 1)
  assert.equal(atualizacoes.length, 1)
  assert.equal(atualizacoes[0].lojas_acessiveis[0].empresaId, 'emp')
  await sincronizarContextoComercial({ lojasAcessiveis: [], atualizarContextoLojas, cliente })
  assert.equal(chamadas, 1, 'respeita o intervalo mínimo sem forçar')
  await sincronizarContextoComercial({ lojasAcessiveis: [], atualizarContextoLojas, cliente, forcar: true })
  assert.equal(chamadas, 2)
})

test('resposta sem lojas ou falha de rede não apaga o contexto atual', async () => {
  reiniciarSincronizacaoContexto()
  const atualizacoes = []
  await sincronizarContextoComercial({ atualizarContextoLojas: (p) => atualizacoes.push(p), cliente: { get: async () => ({ lojas_acessiveis: [] }) }, forcar: true })
  await sincronizarContextoComercial({ atualizarContextoLojas: (p) => atualizacoes.push(p), cliente: { get: async () => { throw new Error('offline') } }, forcar: true })
  assert.equal(atualizacoes.length, 0)
})
