import assert from 'node:assert/strict';
import test from 'node:test';
import { db } from './database.js';
import { markCartConverted, normalizeCartPhone, recordCartRecoveryOptOut, syncPublicCart } from './commerce-abandoned-carts.js';

const CONTEXT = {
  empresaId: '11111111-1111-4111-8111-111111111111',
  lojaId: '22222222-2222-4222-8222-222222222222',
  storefrontId: '33333333-3333-4333-8333-333333333333',
};
const CART = '44444444-4444-4444-8444-444444444444';
const VARIANT = '55555555-5555-4555-8555-555555555555';
const ORDER = '66666666-6666-4666-8666-666666666666';
const CUSTOMER = '77777777-7777-4777-8777-777777777777';
const SESSION = 'session_key_1234567890_abcdefghij';

test('normaliza WhatsApp brasileiro e rejeita contato incompleto', () => {
  assert.equal(normalizeCartPhone('(65) 99999-0000'), '5565999990000');
  assert.equal(normalizeCartPhone('+55 65 99999-0000'), '5565999990000');
  assert.equal(normalizeCartPhone('999'), '');
});

test('consentimento exige checkbox, texto e origem antes de abrir transação', async () => {
  const original = db.transaction;
  let called = false;
  db.transaction = async () => { called = true; };
  try {
    await assert.rejects(
      () => syncPublicCart(CONTEXT, { sessionKey: SESSION, items: [{ variantId: VARIANT, quantity: 1 }], recoveryConsent: true, recoverySource: 'checkout_checkbox', recoveryEvidence: { checkbox: false, notice: 'texto insuficiente' }, contact: { name: 'Ana', phone: '(65) 99999-0000' } }),
      error => error.code === 'CONSENT_EVIDENCE_REQUIRED',
    );
    assert.equal(called, false);
  } finally { db.transaction = original; }
});

test('sync sem contato persiste somente hash, itens e preço revalidado no tenant/storefront', async () => {
  const original = db.transaction;
  const calls = [];
  db.transaction = async callback => callback({ async query(sql, params) {
    calls.push({ sql, params });
    if (sql.includes('SELECT * FROM commerce_carts')) return { rows: [] };
    if (sql.includes('SELECT DISTINCT ON (v.id)')) return { rows: [{ id: VARIANT, sku: 'SKU-1', product_name: 'Produto', price: '19.90' }] };
    if (sql.includes('INSERT INTO commerce_carts')) return { rows: [{ id: CART, empresa_id: CONTEXT.empresaId, storefront_id: CONTEXT.storefrontId, recovery_status: 'not_requested' }] };
    return { rows: [], rowCount: 1 };
  } });
  try {
    const result = await syncPublicCart(CONTEXT, { sessionKey: SESSION, items: [{ variantId: VARIANT, quantity: 2 }] });
    assert.deepEqual(result, { status: 'not_requested', itemCount: 1 });
    const select = calls.find(call => call.sql.includes('SELECT * FROM commerce_carts'));
    assert.deepEqual(select.params.slice(0, 2), [CONTEXT.empresaId, CONTEXT.storefrontId]);
    assert.equal(select.params[2].length, 64);
    assert.notEqual(select.params[2], SESSION);
    const itemInsert = calls.find(call => call.sql.includes('INSERT INTO commerce_cart_items'));
    assert.equal(itemInsert.params[4], '19.90');
    assert.equal(calls.some(call => call.sql.includes('commerce_customers')), false);
    assert.equal(calls.some(call => call.sql.includes('tarefas_integracao_canais')), false);
  } finally { db.transaction = original; }
});

test('sync vazio versionado cria tombstone e impede reabertura por requisição atrasada', async () => {
  const original = db.transaction;
  const calls = [];
  db.transaction = async callback => callback({ async query(sql, params) {
    calls.push({ sql, params });
    if (sql.includes('SELECT * FROM commerce_carts')) return { rows: [] };
    return { rows: [], rowCount: 1 };
  } });
  try {
    const result = await syncPublicCart(CONTEXT, { sessionKey: SESSION, items: [], syncVersion: 200 });
    assert.deepEqual(result, { status: 'expired', itemCount: 0, syncVersion: 200 });
    const tombstone = calls.find(call => call.sql.includes('INSERT INTO commerce_carts'));
    assert.match(tombstone.sql, /client_sync_version,recovery_status/);
    assert.deepEqual(tombstone.params.slice(-1), [200]);
  } finally { db.transaction = original; }
});

test('sync mais antigo não sobrescreve o carrinho já atualizado', async () => {
  const original = db.transaction;
  const calls = [];
  db.transaction = async callback => callback({ async query(sql, params) {
    calls.push({ sql, params });
    if (sql.includes('pg_advisory_xact_lock')) return { rows: [] };
    if (sql.includes('SELECT * FROM commerce_carts')) return { rows: [{ id: CART, status: 'expired', client_sync_version: '300' }] };
    throw new Error(`consulta inesperada: ${sql}`);
  } });
  try {
    const result = await syncPublicCart(CONTEXT, { sessionKey: SESSION, items: [{ variantId: VARIANT, quantity: 1 }], syncVersion: 299 });
    assert.deepEqual(result, { status: 'expired', stale: true, syncVersion: 300 });
    assert.equal(calls.length, 2);
    assert.match(calls[0].sql, /pg_advisory_xact_lock/);
  } finally { db.transaction = original; }
});

test('conversão do pedido é tenant/storefront-scoped e cancela apenas a tarefa desse tenant', async () => {
  const calls = [];
  const trx = { async query(sql, params) {
    calls.push({ sql, params });
    if (sql.includes('SELECT * FROM commerce_carts')) return { rows: [{ id: CART, customer_id: CUSTOMER }] };
    return { rows: [], rowCount: 1 };
  } };
  const result = await markCartConverted(trx, CONTEXT, { cartSessionKey: SESSION, storefrontId: CONTEXT.storefrontId, orderId: ORDER });
  assert.equal(result, CART);
  assert.match(calls[0].sql, /empresa_id=\$1 AND storefront_id=\$2 AND session_key_hash=\$3/);
  const cancel = calls.find(call => call.sql.includes('UPDATE tarefas_integracao_canais'));
  assert.match(cancel.sql, /empresa_id=\$1/);
  assert.deepEqual(cancel.params, [CONTEXT.empresaId, CART]);
  const event = calls.find(call => call.sql.includes('INSERT INTO commerce_cart_recovery_events'));
  assert.equal(event.params[0], CONTEXT.empresaId);
  assert.equal(event.params[2], CART);
  assert.equal(event.params[4], 'converted');
});

test('opt-out ignora texto ambíguo sem consultar banco', async () => {
  const original = db.transaction;
  let called = false;
  db.transaction = async () => { called = true; };
  try {
    const result = await recordCartRecoveryOptOut({ empresa_id: CONTEXT.empresaId, loja_id: CONTEXT.lojaId }, { phone: '5565999990000', text: 'quero sair mais tarde' });
    assert.deepEqual(result, { optedOut: false });
    assert.equal(called, false);
  } finally { db.transaction = original; }
});

test('opt-out inequívoco revoga somente carrinhos do telefone e loja do canal', async () => {
  const original = db.transaction;
  const calls = [];
  db.transaction = async callback => callback({ async query(sql, params) {
    calls.push({ sql, params });
    if (sql.includes('SELECT c.* FROM commerce_carts')) return { rows: [{ id: CART, customer_id: CUSTOMER }], rowCount: 1 };
    return { rows: [], rowCount: 1 };
  } });
  try {
    const result = await recordCartRecoveryOptOut({ empresa_id: CONTEXT.empresaId, loja_id: CONTEXT.lojaId }, { phone: '(65) 99999-0000', text: 'SAIR!', externalId: 'msg-1' });
    assert.deepEqual(result, { optedOut: true, carts: 1 });
    assert.deepEqual(calls[0].params, [CONTEXT.empresaId, CONTEXT.lojaId, '5565999990000']);
    assert.match(calls[0].sql, /s\.loja_id=\$2/);
    assert.match(calls.find(call => call.sql.includes('UPDATE tarefas_integracao_canais')).sql, /empresa_id=\$1/);
  } finally { db.transaction = original; }
});
