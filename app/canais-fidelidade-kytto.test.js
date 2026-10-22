import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LegacyLoyaltyWriteBlockedError,
  obterFidelidade,
  creditarFidelidade,
  cadastrarMembroFidelidade,
} from './canais-fidelidade-kytto.js';

const empresa = `legacy-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const contexto = { legacyMigration: true, lojaId: 'loja-legado-teste' };

test('ledger JSON legado é leitura sem mutação implícita', () => {
  const leitura = obterFidelidade(empresa);
  assert.deepEqual(leitura.movimentos, []);
  assert.deepEqual(leitura.membros, []);
  assert.throws(() => creditarFidelidade(empresa, 'cliente', 20, 'teste', { chaveIdempotencia: 'legacy-credit-0001' }), error => error instanceof LegacyLoyaltyWriteBlockedError && error.code === 'LEGACY_LOYALTY_WRITE_BLOCKED');
});

test('escrita legada só passa por migração/quarentena explícita e nunca por crédito sem loja', () => {
  assert.throws(() => cadastrarMembroFidelidade(empresa, { clienteId: 'cliente', nome: 'Cliente' }), error => error.code === 'LEGACY_LOYALTY_WRITE_BLOCKED');
  assert.throws(() => creditarFidelidade(empresa, 'cliente', 20, 'teste', { ...contexto, quarantine: true, lojaId: undefined }), error => error.code === 'LEGACY_LOYALTY_WRITE_BLOCKED');
  const member = cadastrarMembroFidelidade(empresa, { clienteId: 'cliente', nome: 'Cliente', ...contexto });
  assert.equal(member.clienteId, 'cliente');
  assert.throws(() => creditarFidelidade(empresa, 'cliente', 20, 'operacao', { ...contexto, quarantine: true }), error => error.code === 'LEGACY_LOYALTY_WRITE_BLOCKED');
  const result = creditarFidelidade(empresa, 'cliente', 20, 'migracao', { ...contexto, chaveIdempotencia: 'legacy-credit-0002' });
  assert.equal(result.pontosCreditados, 20);
  assert.equal(result.movimento.lojaId, contexto.lojaId);
});
