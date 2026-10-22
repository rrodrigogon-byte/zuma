import assert from 'node:assert/strict';
import test from 'node:test';
import { reconcileLegacyLoyalty } from './core/loyalty-advanced.js';

const EMPRESA = '11111111-1111-4111-8111-111111111111';
const LOJA = '22222222-2222-4222-8222-222222222222';
const CUSTOMER = '33333333-3333-4333-8333-333333333333';

function fakeDb() {
  const state = { account: null, ledger: [], committed: 0, rolledBack: 0 };
  let snapshot = null;
  const client = {};
  return {
    state,
    async beginTransaction() {
      snapshot = { account: state.account && { ...state.account }, ledger: [...state.ledger] };
      return client;
    },
    async queryInTransaction(_client, sql, params = []) {
      if (sql.includes('FROM lojas')) return { rows: [{ id: LOJA }] };
      if (sql.includes('FROM commerce_customers')) {
        if (String(params[1] || '') === CUSTOMER || String(params[1] || '') === '5565999990000') {
          return { rows: [{ id: CUSTOMER, nome: 'Cliente Commerce', telefone: '65 99999-0000' }] };
        }
        return { rows: [] };
      }
      if (sql.includes('FROM commerce_loyalty_accounts')) return { rows: state.account ? [{ ...state.account }] : [] };
      if (sql.startsWith('INSERT INTO commerce_loyalty_accounts')) {
        state.account ||= { id: '44444444-4444-4444-8444-444444444444', saldo_pontos: 0, pontos_acumulados: 0 };
        return { rows: [{ ...state.account }] };
      }
      if (sql.includes('INSERT INTO commerce_loyalty_ledger')) {
        state.ledger.push({ pontos: params[4], saldoAnterior: params[5], saldoPosterior: params[6], referenciaId: params[8] });
        return { rows: [] };
      }
      if (sql.startsWith('UPDATE commerce_loyalty_accounts')) {
        state.account = { ...state.account, saldo_pontos: params[0], pontos_acumulados: params[1] };
        return { rows: [] };
      }
      throw new Error(`Query não prevista no fake: ${sql}`);
    },
    async commit() {
      snapshot = null;
      state.committed += 1;
    },
    async rollback() {
      if (snapshot) {
        state.account = snapshot.account;
        state.ledger = snapshot.ledger;
      }
      snapshot = null;
      state.rolledBack += 1;
    },
  };
}

test('prévia da reconciliação não grava e identifica pontos de crédito e ajuste', async () => {
  const db = fakeDb();
  const resultado = await reconcileLegacyLoyalty(db, {
    empresaId: EMPRESA,
    lojaId: LOJA,
    legacyMembers: [{ id: 'legacy-member-1', clienteId: CUSTOMER, nome: 'Cliente Legado', pontos: 100, pontosAcumulados: 150 }],
    dryRun: true,
  });
  assert.equal(resultado.migrated, 1);
  assert.equal(resultado.pointsCredited, 150);
  assert.equal(resultado.pointsAdjusted, -50);
  assert.equal(db.state.ledger.length, 0);
  assert.equal(db.state.account, null);
  assert.equal(db.state.committed, 0);
  assert.equal(db.state.rolledBack, 1);
});

test('execução confirmada é idempotente ao ser repetida', async () => {
  const db = fakeDb();
  const input = {
    empresaId: EMPRESA,
    lojaId: LOJA,
    legacyMembers: [{ id: 'legacy-member-1', clienteId: CUSTOMER, nome: 'Cliente Legado', pontos: 100, pontosAcumulados: 150 }],
    usuarioId: '55555555-5555-4555-8555-555555555555',
    dryRun: false,
  };
  const primeira = await reconcileLegacyLoyalty(db, input);
  const segunda = await reconcileLegacyLoyalty(db, input);
  assert.equal(primeira.migrated, 1);
  assert.equal(primeira.pointsCredited, 150);
  assert.equal(primeira.pointsAdjusted, -50);
  assert.equal(segunda.migrated, 0);
  assert.equal(segunda.unchanged, 1);
  assert.equal(segunda.pointsCredited, 0);
  assert.equal(db.state.account.saldo_pontos, 100);
  assert.equal(db.state.account.pontos_acumulados, 150);
  assert.equal(db.state.ledger.length, 2);
  assert.equal(db.state.committed, 2);
  assert.equal(db.state.rolledBack, 0);
});
