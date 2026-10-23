import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DINO_SCOPE, isDinoDedicatedHost, scopeDinoAdminHeaders } from './dino-scope.js'

test('host dedicado Dino reconhece os domínios permitidos e rejeita homônimos', () => {
  assert.equal(isDinoDedicatedHost('dino.kytto.com.br'), true)
  assert.equal(isDinoDedicatedHost('dinoperfumaria.com.br'), true)
  assert.equal(isDinoDedicatedHost('dinobarbearia.com.br'), true)
  assert.equal(isDinoDedicatedHost('dino.kytto.com.br.evil.test'), false)
  assert.equal(isDinoDedicatedHost('kytto.com.br'), false)
})

test('chamadas do ERP no host Dino usam somente a empresa e loja canônicas', () => {
  const headers = scopeDinoAdminHeaders('/api/admin/barbearia/bi?inicio=2026-10-01', {
    Authorization: 'Bearer test',
    'X-Empresa-Id': 'empresa-incorreta',
    'X-Loja-Id': 'loja-incorreta',
  }, 'dino.kytto.com.br')
  assert.equal(headers.Authorization, 'Bearer test')
  assert.equal(headers['X-Empresa-Id'], DINO_SCOPE.empresaId)
  assert.equal(headers['X-Loja-Id'], DINO_SCOPE.lojaId)
})

test('rotas fora do ERP Dino e outros hosts preservam os cabeçalhos recebidos', () => {
  const headers = { 'X-Empresa-Id': 'empresa-atual', 'X-Loja-Id': 'loja-atual' }
  assert.deepEqual(scopeDinoAdminHeaders('/api/admin/metricas/operacional', headers, 'dino.kytto.com.br'), headers)
  assert.deepEqual(scopeDinoAdminHeaders('/api/admin/barbearia/bi', headers, 'kytto.com.br'), headers)
})
