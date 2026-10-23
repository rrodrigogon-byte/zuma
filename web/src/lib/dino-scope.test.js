import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DINO_COMPANY, DINO_SCOPE, DINO_STORE, isDinoDedicatedHost, scopeDinoAdminHeaders } from './dino-scope.js'

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

test('fallback visual da unidade mantém o par canônico e o rótulo operacional', () => {
  assert.equal(DINO_COMPANY.id, DINO_SCOPE.empresaId)
  assert.equal(DINO_COMPANY.nome, 'Barbearia Dino')
  assert.equal(DINO_STORE.id, DINO_SCOPE.lojaId)
  assert.equal(DINO_STORE.empresaId, 'emp-kytto-001')
  assert.equal(DINO_STORE.commerceEmpresaId, DINO_SCOPE.empresaId)
  assert.equal(DINO_STORE.codigo, 'DINO-MATRIZ')
  assert.equal(DINO_STORE.nome, 'Barbearia Dino')
})

test('rotas fora do ERP Dino e outros hosts preservam os cabeçalhos recebidos', () => {
  const headers = { 'X-Empresa-Id': 'empresa-atual', 'X-Loja-Id': 'loja-atual' }
  assert.deepEqual(scopeDinoAdminHeaders('/api/admin/metricas/operacional', headers, 'dino.kytto.com.br'), headers)
  assert.deepEqual(scopeDinoAdminHeaders('/api/admin/barbearia/bi', headers, 'kytto.com.br'), headers)
})
