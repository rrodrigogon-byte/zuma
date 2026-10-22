import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LoyaltyAdvancedError,
  creditLoyaltyForDinoCompletion,
  getLoyaltyEffectStatus,
  reverseLoyaltyForDinoCompletion,
} from './loyalty-advanced.js';

const TENANT = '11111111-1111-4111-8111-111111111111';
const STORE = '22222222-2222-4222-8222-222222222222';
const STORE_B = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ACTION = '33333333-3333-4333-8333-333333333333';
const REVERSE_ACTION = '44444444-4444-4444-8444-444444444444';
const CUSTOMER = '55555555-5555-4555-8555-555555555555';
const LEDGER = '66666666-6666-4666-8666-666666666666';
const ACCOUNT = '77777777-7777-4777-8777-777777777777';
const FP = 'a'.repeat(64);

function fakeDb({ store = STORE, existingEffects = [], source = null, balance = 0 } = {}) {
  const state = { calls: [], effects: existingEffects.map(item => ({ ...item })), ledger: [], balance, store };
  const db = {
    state,
    async transaction(callback) {
      return callback({
        query: async (sql, params = []) => {
          state.calls.push({ sql, params });
          if (sql.includes('FROM dino_effect_outbox')) {
            return { rows: state.effects.filter(row => row.empresa_id === params[0] && row.loja_id === params[1] && row.efeito === params[2] && row.idempotency_key === params[3]) };
          }
          if (sql.includes('FROM lojas')) return { rows: state.store === params[0] ? [{ id: state.store }] : [] };
          if (sql.includes('FROM commerce_customers')) return { rows: [{ id: CUSTOMER }] };
          if (sql.includes('INSERT INTO dino_effect_outbox')) {
            const row = {
              id: `effect-${state.effects.length + 1}`, empresa_id: params[0], loja_id: params[1], efeito: params[2],
              idempotency_key: params[3], fingerprint: params[4], payload_sanitizado: params[5], status: 'pending',
              action_id: params[6], financial_entry_id: null,
            };
            state.effects.push(row);
            return { rows: [row] };
          }
          if (sql.includes('INSERT INTO commerce_loyalty_accounts')) return { rows: [] };
          if (sql.includes('FROM commerce_loyalty_accounts')) return { rows: [{ id: ACCOUNT, saldo_pontos: state.balance, pontos_acumulados: state.balance }] };
          if (sql.includes('FROM commerce_loyalty_ledger') && source) return { rows: [source] };
          if (sql.includes('FROM commerce_loyalty_ledger')) return { rows: [] };
          if (sql.includes('INSERT INTO commerce_loyalty_ledger')) {
            const row = { id: state.ledger.length ? `ledger-${state.ledger.length + 1}` : LEDGER };
            state.ledger.push({ row, sql, params });
            return { rows: [row] };
          }
          if (sql.includes('UPDATE commerce_loyalty_accounts')) {
            state.balance = Number(params[0]);
            return { rows: [] };
          }
          if (sql.includes('UPDATE dino_effect_outbox')) {
            const row = state.effects.find(item => item.empresa_id === params[1] && item.loja_id === params[2] && item.efeito === params[3] && item.idempotency_key === params[4]);
            if (row) { row.status = 'succeeded'; row.financial_entry_id = params[0]; }
            return { rows: [] };
          }
          throw new Error(`SQL não modelado: ${sql}`);
        },
      });
    },
    async query(sql, params = []) {
      state.calls.push({ sql, params });
      if (sql.includes('FROM dino_effect_outbox')) return { rows: state.effects.filter(row => row.empresa_id === params[0] && row.loja_id === params[1]) };
      return { rows: [] };
    },
  };
  return db;
}

function ctx(overrides = {}) {
  return { empresaId: TENANT, lojaId: STORE, actionId: ACTION, idempotencyKey: 'loyalty-dino:credit-001', fingerprint: FP, ...overrides };
}

test('crédito canônico exige escopo e identidade da mutação', async () => {
  const db = fakeDb();
  await assert.rejects(() => creditLoyaltyForDinoCompletion(db, { empresaId: TENANT, lojaId: STORE }, { customerId: CUSTOMER, points: 10 }), e => e.code === 'ACTION_ID_INVALID');
  await assert.rejects(() => creditLoyaltyForDinoCompletion(db, ctx({ lojaId: undefined }), { customerId: CUSTOMER, points: 10 }), e => e.code === 'INVALID_SCOPE');
  assert.equal(db.state.calls.length, 0);
});

test('crédito canônico faz replay estável e conflito 409 sem segundo ledger', async () => {
  const db = fakeDb();
  const input = { customerId: CUSTOMER, points: 120, completionId: ACTION };
  const first = await creditLoyaltyForDinoCompletion(db, ctx(), input);
  const replay = await creditLoyaltyForDinoCompletion(db, ctx(), input);
  assert.equal(first.replay, false);
  assert.equal(replay.replay, true);
  assert.equal(db.state.ledger.length, 1);
  await assert.rejects(() => creditLoyaltyForDinoCompletion(db, ctx({ fingerprint: 'b'.repeat(64) }), { ...input, points: 121 }), e => e instanceof LoyaltyAdvancedError && e.statusCode === 409 && e.code === 'IDEMPOTENCY_CONFLICT');
  assert.equal(db.state.ledger.length, 1);
});

test('loja diferente não reutiliza o efeito canônico', async () => {
  const db = fakeDb();
  await assert.rejects(() => creditLoyaltyForDinoCompletion(db, ctx({ lojaId: STORE_B }), { customerId: CUSTOMER, points: 20, completionId: ACTION }), e => e.code === 'STORE_NOT_FOUND');
  assert.equal(db.state.ledger.length, 0);
});

test('reversão é compensatória e não atualiza linha histórica', async () => {
  const source = { id: LEDGER, empresa_id: TENANT, loja_id: STORE, account_id: ACCOUNT, customer_id: CUSTOMER, pontos: 80 };
  const db = fakeDb({ source, balance: 80 });
  const result = await reverseLoyaltyForDinoCompletion(db, ctx({ actionId: REVERSE_ACTION, idempotencyKey: 'loyalty-dino:reverse-01' }), { customerId: CUSTOMER, points: 80, sourceActionId: ACTION, motivo: 'cancelamento' });
  assert.equal(result.replay, false);
  assert.equal(result.points, 80);
  assert.equal(db.state.ledger.length, 1);
  assert.equal(db.state.calls.some(item => item.sql.includes('UPDATE commerce_loyalty_ledger') || item.sql.includes('DELETE FROM commerce_loyalty_ledger')), false);
  const status = await getLoyaltyEffectStatus(db, { empresaId: TENANT, lojaId: STORE, idempotencyKey: 'loyalty-dino:reverse-01' });
  assert.equal(status.found, true);
  assert.equal(status.status, 'succeeded');
});
