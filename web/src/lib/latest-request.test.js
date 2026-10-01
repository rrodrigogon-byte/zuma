import assert from 'node:assert/strict'
import test from 'node:test'
import { createLatestRequest } from './latest-request.js'

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

test('CEP antigo que termina depois não sobrescreve endereço novo', async () => {
  const request = createLatestRequest(), first = deferred(), second = deferred(), applied = []
  const old = request.run(() => first.promise, { success: value => applied.push(value) })
  const latest = request.run(() => second.promise, { success: value => applied.push(value) })
  second.resolve('novo'); await latest
  first.resolve('antigo'); await old
  assert.deepEqual(applied, ['novo'])
})

test('erro antigo não apresenta mensagem nem encerra indicador de nova consulta', async () => {
  const request = createLatestRequest(), first = deferred(), second = deferred(), events = []
  const old = request.run(() => first.promise, { error: () => events.push('erro antigo'), settled: () => events.push('fim antigo') })
  const latest = request.run(() => second.promise, { success: () => events.push('novo'), settled: () => events.push('fim novo') })
  first.reject(new Error('timeout')); await old
  assert.deepEqual(events, [])
  second.resolve(); await latest
  assert.deepEqual(events, ['novo', 'fim novo'])
})

test('alteração de CEP, retirada e desmontagem invalidam requisição pendente', async () => {
  const request = createLatestRequest(), pending = deferred(), events = []
  const running = request.run(() => pending.promise, { success: () => events.push('endereço'), settled: () => events.push('fim') })
  request.invalidate()
  pending.resolve(); await running
  assert.deepEqual(events, [])
})

test('falha da consulta atual permite terminar carregamento e mostrar erro', async () => {
  const request = createLatestRequest(), events = []
  await request.run(() => Promise.reject(new Error('CEP indisponível')), { error: err => events.push(err.message), settled: () => events.push('fim') })
  assert.deepEqual(events, ['CEP indisponível', 'fim'])
})
