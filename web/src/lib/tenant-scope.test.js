import test from 'node:test'
import assert from 'node:assert/strict'
import { isTenantScope } from './tenant-scope.js'

test('escopo de empresa: usuário de empresa, tenant UUID ou marca Dino', () => {
  assert.equal(isTenantScope({ empresaId: 'emp-a' }, null), true)
  assert.equal(isTenantScope({}, { id: 'd0d0ac01-1234-4abc-8def-001122334455', nome: 'Qualquer' }), true)
  assert.equal(isTenantScope({}, { id: 'principal', nome: 'Barbearia Dino', brandKey: 'dino' }), true)
  assert.equal(isTenantScope({}, { id: 'principal', nome: 'Agro Open' }), false)
  assert.equal(isTenantScope(null, null), false)
})
