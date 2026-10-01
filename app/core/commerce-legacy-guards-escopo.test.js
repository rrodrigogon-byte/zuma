import test from 'node:test';
import assert from 'node:assert/strict';
import { createLegacyPaymentMutationGuard } from './commerce-legacy-guards.js';

const run = (guard, req) => {
  let status = 200; let passed = false;
  const res = { status(code) { status = code; return this; }, json() { return this; } };
  const original = console.warn; console.warn = () => {};
  try { guard(req, res, () => { passed = true; }); } finally { console.warn = original; }
  return { status, passed };
};

test('Commerce ativo bloqueia só pagamento legado da loja; evento e reservas seguem', () => {
  const guard = createLegacyPaymentMutationGuard({ COMMERCE_CORE_ENABLED: '1' }, { tipoDoPedido: (req) => req.body?.tipo });
  assert.equal(run(guard, { body: { tipo: 'loja' } }).status, 410);
  for (const tipo of ['inscricao', 'ingresso', 'reserva', 'mensalidade']) assert.equal(run(guard, { body: { tipo } }).passed, true, tipo);
});

test('sem resolvedor mantém o bloqueio total; com Commerce desligado nada é bloqueado', () => {
  assert.equal(run(createLegacyPaymentMutationGuard({ COMMERCE_CORE_ENABLED: '1' }), { body: {} }).status, 410);
  assert.equal(run(createLegacyPaymentMutationGuard({ COMMERCE_CORE_ENABLED: '0' }), { body: { tipo: 'loja' } }).passed, true);
});

test('operação destrutiva fica bloqueada quando o ambiente não é desenvolvimento/teste declarado', async () => {
  const { createDestructiveAdminGuard } = await import('./commerce-legacy-guards.js');
  for (const NODE_ENV of [undefined, '', 'prod', 'Production ', 'staging']) assert.equal(run(createDestructiveAdminGuard({ NODE_ENV }), { body: {} }).status, 403, String(NODE_ENV));
  assert.equal(run(createDestructiveAdminGuard({ NODE_ENV: 'development' }), { body: {} }).passed, true);
});
