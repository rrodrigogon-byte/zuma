// Prévia das automações: o vínculo empresa/unidade do ERP é aceito pela assinatura do login, pela
// ponte explícita da Dino ou para o administrador da plataforma (acesso já conferido pelo Commerce).
import test from 'node:test';
import assert from 'node:assert/strict';
import { verifiedLegacyScope } from './ai-brain-routes.js';

const DINO = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
const LOJA = 'ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8';
const OUTRA = '11111111-1111-4111-8111-111111111111';
const ctx = { empresaId: DINO, lojaId: LOJA };

test('login assinado com a mesma empresa e unidade continua valendo', () => {
  assert.deepEqual(verifiedLegacyScope({ user: { empresaId: DINO, lojaId: LOJA } }, ctx), { empresaId: DINO, lojaId: LOJA });
});

test('ponte da Dino (emp-kytto-001 / dino-web-estoque) resolve para os ids canônicos', () => {
  assert.deepEqual(verifiedLegacyScope({ user: { empresaId: 'emp-kytto-001', lojaId: 'dino-web-estoque' } }, ctx), { empresaId: DINO, lojaId: LOJA });
});

test('administrador da plataforma usa a empresa e a unidade conferidas pelo Commerce', () => {
  assert.deepEqual(verifiedLegacyScope({ user: { platformAdmin: true, empresaId: 'emp-agro-open' } }, ctx), { empresaId: DINO, lojaId: LOJA });
});

test('usuário comum de outra empresa ou unidade continua sem vínculo', () => {
  assert.equal(verifiedLegacyScope({ user: { empresaId: OUTRA, lojaId: LOJA } }, ctx), null);
  assert.equal(verifiedLegacyScope({ user: { empresaId: 'emp-kytto-001', lojaId: 'outra-loja' } }, ctx), null);
  assert.equal(verifiedLegacyScope({ user: { empresaId: DINO } }, ctx), null);
});

test('conta Postgres ou unidade sem UUID não ganham vínculo, nem como administrador', () => {
  assert.equal(verifiedLegacyScope({ user: { pgAccount: true, platformAdmin: true } }, ctx), null);
  assert.equal(verifiedLegacyScope({ user: { platformAdmin: true } }, { empresaId: DINO, lojaId: '' }), null);
});
