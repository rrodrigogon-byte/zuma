import test from 'node:test';
import assert from 'node:assert/strict';
import { requestedScope } from './commerce-identity-bridge.js';

test('requestedScope limita headers de empresa e loja ao contexto de seleção', () => {
  const result = requestedScope({ headers: { 'x-empresa-id': ' empresa-1 ', 'x-loja-id': ' loja-1 ' } });
  assert.deepEqual(result, { empresaId: 'empresa-1', lojaId: 'loja-1' });
});

test('requestedScope não cria tenant implícito quando headers faltam', () => {
  assert.deepEqual(requestedScope({ headers: {} }), { empresaId: '', lojaId: '' });
});
