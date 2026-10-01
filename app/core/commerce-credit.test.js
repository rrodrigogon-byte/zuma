import assert from 'node:assert/strict';
import test from 'node:test';
import { createCreditAccount, createCreditPayment, listCreditAccounts, updateCreditAccount } from './commerce-credit.js';
import { db } from './database.js';

const empresaId = '10000000-0000-4000-8000-000000000201';
const lojaId = '10000000-0000-4000-8000-000000000202';
const storefrontId = '10000000-0000-4000-8000-000000000203';
const customerId = '10000000-0000-4000-8000-000000000204';
const accountId = '10000000-0000-4000-8000-000000000205';

function accountRow(overrides = {}) {
  return { id: accountId, empresa_id: empresaId, storefront_id: storefrontId, customer_id: customerId, limite_credito: '500.00', saldo_devedor: '0.00', prazo_dias: 30, status: 'active', observacoes: null, ...overrides };
}

test('cria conta de crediário no escopo do cliente e do storefront', async () => {
  const statements = [];
  const trx = { query: async (sql, params) => {
    statements.push({ sql, params });
    if (sql.includes('SELECT id, bloqueado')) return { rows: [{ id: customerId, bloqueado: false }] };
    if (sql.includes('SELECT id FROM commerce_storefronts')) return { rows: [{ id: storefrontId }] };
    if (sql.includes('SELECT id FROM commerce_customer_credit_accounts')) return { rows: [] };
    if (sql.includes('INSERT INTO commerce_customer_credit_accounts')) return { rows: [accountRow()] };
    if (sql.includes('INSERT INTO commerce_audit_logs')) return { rows: [] };
    throw new Error(`query inesperada: ${sql}`);
  } };
  const created = await createCreditAccount(trx, { empresaId, lojaId, usuarioId: '10000000-0000-4000-8000-000000000206' }, { storefrontId, customerId, limiteCredito: 500, prazoDias: 30 });
  assert.equal(created.id, accountId);
  assert.equal(statements.some(item => item.sql.includes('empresa_id = $1')), true);
  assert.equal(statements.some(item => item.sql.includes('INSERT INTO commerce_audit_logs')), true);
});

test('atualiza limite sem permitir ficar abaixo do saldo devedor', async () => {
  const statements = [];
  const trx = { query: async (sql, params) => {
    statements.push({ sql, params });
    if (sql.includes('SELECT ca.*')) return { rows: [accountRow({ saldo_devedor: '120.00' })] };
    if (sql.includes('UPDATE commerce_customer_credit_accounts')) return { rows: [accountRow({ limite_credito: '800.00', saldo_devedor: '120.00' })] };
    if (sql.includes('INSERT INTO commerce_audit_logs')) return { rows: [] };
    throw new Error(`query inesperada: ${sql}`);
  } };
  const updated = await updateCreditAccount(trx, { empresaId, lojaId, usuarioId: '10000000-0000-4000-8000-000000000206' }, accountId, { limiteCredito: 800, prazoDias: 45 });
  assert.equal(updated.limite_credito, '800.00');
  await assert.rejects(() => updateCreditAccount(trx, { empresaId, lojaId }, accountId, { limiteCredito: 100 }), /abaixo do saldo/);
});

test('lista contas de crediário pelo escopo do tenant', async () => {
  let received;
  const client = { query: async (sql, params) => { received = { sql, params }; return { rows: [accountRow({ customer_name: 'Cliente Dino', storefront_name: 'Dino Web' })] }; } };
  const result = await listCreditAccounts(client, { empresaId, lojaId }, { storefrontId });
  assert.equal(result.items[0].customer_name, 'Cliente Dino');
  assert.equal(received.params[0], empresaId);
  assert.equal(received.params[1], storefrontId);
});

test('crediário bloqueia rascunho e payment_failed sem executar DML financeiro', async () => {
  const original = db.transaction;
  const calls = [];
  let orderStatus = 'payment_failed';
  db.transaction = async callback => callback({ query: async (sql, params = []) => {
    calls.push({ sql, params });
    if (sql.includes('FROM commerce_payments')) return { rows: [] };
    if (sql.includes('FROM commerce_orders o')) return { rows: [{ id: '10000000-0000-4000-8000-000000000207', public_code: 'KC-CREDIT', storefront_id: storefrontId, loja_id: lojaId, customer_id: customerId, status: orderStatus, total: '25.00', customer_name: 'Cliente', bloqueado: false }] };
    throw new Error(`query inesperada: ${sql}`);
  } });
  try {
    for (const status of ['payment_failed', 'draft']) {
      orderStatus = status;
      await assert.rejects(
        () => createCreditPayment({ empresaId, lojaId }, { orderId: '10000000-0000-4000-8000-000000000207', idempotencyKey: `credit-${status}` }),
        error => error?.code === 'PAYMENT_ORDER_STATE_INVALID',
      );
    }
    assert.equal(calls.some(call => /^\s*(INSERT|UPDATE|DELETE)/i.test(call.sql)), false);
  } finally {
    db.transaction = original;
  }
});
