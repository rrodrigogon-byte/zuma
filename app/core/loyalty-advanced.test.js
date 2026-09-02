import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cancelRewardRedemption,
  creditPaidOrderLoyaltyPoints,
  defaultLoyaltyLevels,
  getLoyaltyRanking,
  markRewardDelivered,
  normalizeLoyaltyLevels,
  normalizeLoyaltySettings,
  normalizeRewardInput,
  redeemReward,
  updateReward,
} from './loyalty-advanced.js';

const SCOPE = {
  empresaId: '11111111-1111-4111-8111-111111111111',
  lojaId: '22222222-2222-4222-8222-222222222222',
  usuarioId: '33333333-3333-4333-8333-333333333333',
};
const CUSTOMER = '44444444-4444-4444-8444-444444444444';
const REWARD = '55555555-5555-4555-8555-555555555555';
const REDEMPTION = '66666666-6666-4666-8666-666666666666';
const LEDGER = '77777777-7777-4777-8777-777777777777';
const ACCOUNT = '88888888-8888-4888-8888-888888888888';
const ORDER = '99999999-9999-4999-8999-999999999999';

function mockDb(handler) {
  const state = { calls: [], commits: 0, rollbacks: 0 };
  return {
    state,
    async query(sql, params) {
      state.calls.push({ mode: 'pool', sql, params });
      return handler(sql, params, state);
    },
    async beginTransaction() { return { id: 'tx' }; },
    async queryInTransaction(client, sql, params) {
      state.calls.push({ mode: 'tx', sql, params });
      return handler(sql, params, state);
    },
    async commit() { state.commits += 1; },
    async rollback() { state.rollbacks += 1; },
  };
}

test('defaults de níveis são virtuais e não incluem identificador persistido', () => {
  const levels = defaultLoyaltyLevels();
  assert.deepEqual(levels.map(item => [item.nome, item.pontos_minimos]), [['Bronze', 0], ['Prata', 1000], ['Ouro', 3000]]);
  assert.equal(levels.every(item => item.persistido === false && !item.id), true);
});

test('níveis exigem início em zero, limites crescentes e códigos únicos', () => {
  assert.throws(() => normalizeLoyaltyLevels([{ nome: 'Bronze', pontos_minimos: 10 }]), /zero pontos/);
  assert.throws(() => normalizeLoyaltyLevels([
    { nome: 'Bronze', pontos_minimos: 0 },
    { nome: 'Prata', pontos_minimos: 0 },
  ]), /estritamente crescentes/);
  assert.throws(() => normalizeLoyaltyLevels([
    { codigo: 'vip', nome: 'Bronze', pontos_minimos: 0 },
    { codigo: 'vip', nome: 'Prata', pontos_minimos: 1000 },
  ]), /códigos.*únicos/);
});

test('normalização de recompensa usa allowlist e rejeita estoque menor que resgates', () => {
  const reward = normalizeRewardInput({
    nome: 'Corte cortesia', custo_pontos: 800, estoque_total: '', limite_por_cliente: 1,
    descricao: 'Benefício físico', status: 'rascunho', secret: 'não persistir',
  });
  assert.deepEqual(Object.keys(reward).sort(), ['codigo', 'custo_pontos', 'descricao', 'estoque_total', 'fim_em', 'inicio_em', 'limite_por_cliente', 'nome', 'status'].sort());
  assert.equal(reward.codigo, 'corte-cortesia');
  assert.equal(reward.estoque_total, null);
  assert.equal('secret' in reward, false);
  assert.throws(() => normalizeRewardInput({ estoque_total: 1 }, {
    nome: 'Teste', codigo: 'teste', custo_pontos: 100, quantidade_resgatada: 2, status: 'ativa',
  }), /menor que a quantidade/);
});

test('ranking aplica nível virtual quando a loja ainda não persistiu níveis', async () => {
  const db = mockDb(() => ({ rows: [{
    cliente_id: CUSTOMER, nome: 'Cliente A', pontos_acumulados: 1500,
    saldo_total: 1500, pontos_a_expirar_30d: 0, nivel_nome: null,
  }] }));
  const ranking = await getLoyaltyRanking(db, { ...SCOPE, limit: 10 });
  assert.equal(ranking[0].nivel_nome, 'Prata');
  assert.match(db.state.calls[0].sql, /a\.empresa_id = \$1 AND a\.loja_id = \$2/);
});

test('configuração de acúmulo é inerte por padrão e valida limites', () => {
  assert.deepEqual(normalizeLoyaltySettings({}), {
    ativo: false, pontos_por_real: 1, valor_minimo_compra: 0, validade_dias: null,
  });
  assert.throws(() => normalizeLoyaltySettings({ pontos_por_real: -1 }), /intervalo permitido/);
  assert.throws(() => normalizeLoyaltySettings({ validade_dias: 0 }), /inteiro fora/);
});

test('crédito de pedido pago usa a regra ativa e atualiza o ledger uma única vez', async () => {
  const calls = [];
  const trx = { async query(sql) {
    calls.push(sql);
    if (sql.includes('FROM commerce_orders o')) return { rows: [{ id: ORDER, customer_id: CUSTOMER, total: '259.00', public_code: 'DINO-1', loja_id: SCOPE.lojaId }] };
    if (sql.includes('FROM commerce_loyalty_settings')) return { rows: [{ pontos_por_real: '1.0000', valor_minimo_compra: '10.00', validade_dias: 365 }] };
    if (sql.includes('FROM commerce_loyalty_ledger')) return { rows: [] };
    if (sql.includes('INSERT INTO commerce_loyalty_accounts')) return { rows: [] };
    if (sql.includes('FROM commerce_loyalty_accounts')) return { rows: [{ id: ACCOUNT, saldo_pontos: 10, pontos_acumulados: 10 }] };
    if (sql.includes('INSERT INTO commerce_loyalty_ledger')) return { rows: [{ id: LEDGER }] };
    if (sql.includes('UPDATE commerce_loyalty_accounts')) return { rows: [] };
    throw new Error(`SQL inesperado: ${sql}`);
  } };
  const result = await creditPaidOrderLoyaltyPoints(trx, { ...SCOPE, orderId: ORDER });
  assert.deepEqual(result, { credited: true, points: 259, customerId: CUSTOMER, lojaId: SCOPE.lojaId });
  assert.equal(calls.filter(sql => sql.includes('INSERT INTO commerce_loyalty_ledger')).length, 1);
  assert.equal(calls.filter(sql => sql.includes('UPDATE commerce_loyalty_accounts')).length, 1);
});

test('crédito de pedido pago retorna replay sem alterar a conta', async () => {
  const calls = [];
  const trx = { async query(sql) {
    calls.push(sql);
    if (sql.includes('FROM commerce_orders o')) return { rows: [{ id: ORDER, customer_id: CUSTOMER, total: '259.00', public_code: 'DINO-1', loja_id: SCOPE.lojaId }] };
    if (sql.includes('FROM commerce_loyalty_settings')) return { rows: [{ pontos_por_real: '1.0000', valor_minimo_compra: '0.00', validade_dias: null }] };
    if (sql.includes('FROM commerce_loyalty_ledger')) return { rows: [{ id: LEDGER, pontos: 259 }] };
    throw new Error(`SQL inesperado: ${sql}`);
  } };
  const result = await creditPaidOrderLoyaltyPoints(trx, { ...SCOPE, orderId: ORDER });
  assert.equal(result.replay, true);
  assert.equal(calls.some(sql => sql.includes('UPDATE commerce_loyalty_accounts')), false);
});

test('edição rejeita recompensa de outra loja sem executar UPDATE', async () => {
  const db = mockDb(sql => {
    if (sql.includes('SELECT * FROM fidelidade_recompensas')) return { rows: [] };
    throw new Error(`SQL inesperado: ${sql}`);
  });
  await assert.rejects(
    () => updateReward(db, { ...SCOPE, rewardId: REWARD, input: { nome: 'Teste', custo_pontos: 100 } }),
    error => error.statusCode === 404 && error.code === 'REWARD_NOT_FOUND',
  );
  assert.equal(db.state.calls.some(call => call.sql.includes('UPDATE fidelidade_recompensas')), false);
  assert.match(db.state.calls[0].sql, /empresa_id = \$2 AND loja_id = \$3/);
  assert.equal(db.state.rollbacks, 1);
});

test('edição retorna recompensa e estado anterior para auditoria produtiva', async () => {
  const before = {
    id: REWARD, empresa_id: SCOPE.empresaId, loja_id: SCOPE.lojaId,
    codigo: 'corte', nome: 'Corte', descricao: null, custo_pontos: 500,
    estoque_total: 10, quantidade_resgatada: 1, limite_por_cliente: 2,
    inicio_em: null, fim_em: null, status: 'rascunho',
  };
  const after = { ...before, status: 'ativa', custo_pontos: 600 };
  const db = mockDb(sql => {
    if (sql.includes('SELECT * FROM fidelidade_recompensas')) return { rows: [before] };
    if (sql.includes('UPDATE fidelidade_recompensas')) return { rows: [after] };
    throw new Error(`SQL inesperado: ${sql}`);
  });
  const result = await updateReward(db, { ...SCOPE, rewardId: REWARD, input: { ...after } });
  assert.equal(result.reward.status, 'ativa');
  assert.equal(result.before.status, 'rascunho');
  assert.equal(db.state.commits, 1);
  assert.equal(db.state.rollbacks, 0);
});

test('resgate exige confirmação e idempotency key antes de abrir transação', async () => {
  let began = 0;
  const db = { async beginTransaction() { began += 1; return {}; } };
  await assert.rejects(
    () => redeemReward(db, { ...SCOPE, clienteId: CUSTOMER, recompensaId: REWARD, confirmar: false, idempotencyKey: 'loyalty-reward:1234567890' }),
    /Confirmação humana explícita/,
  );
  await assert.rejects(
    () => redeemReward(db, { ...SCOPE, clienteId: CUSTOMER, recompensaId: REWARD, confirmar: true, idempotencyKey: 'curta' }),
    /idempotência inválida/,
  );
  assert.equal(began, 0);
});

test('resgate confirmado debita saldo e estoque uma única vez em transação tenant-scoped', async () => {
  const db = mockDb((sql) => {
    if (sql.includes('pg_advisory_xact_lock')) return { rows: [] };
    if (sql.includes('WHERE rr.empresa_id = $1 AND rr.idempotency_key')) return { rows: [] };
    if (sql.includes('SELECT id FROM lojas')) return { rows: [{ id: SCOPE.lojaId }] };
    if (sql.includes('SELECT id, nome FROM commerce_customers')) return { rows: [{ id: CUSTOMER, nome: 'Cliente A' }] };
    if (sql.includes('SELECT id FROM commerce_loyalty_settings')) return { rows: [{ id: 'config' }] };
    if (sql.includes('SELECT * FROM fidelidade_recompensas')) return { rows: [{
      id: REWARD, empresa_id: SCOPE.empresaId, loja_id: SCOPE.lojaId, nome: 'Corte', status: 'ativa',
      custo_pontos: 500, estoque_total: 10, quantidade_resgatada: 1, limite_por_cliente: 2,
      inicio_em: null, fim_em: null,
    }] };
    if (sql.includes('COALESCE(SUM(quantidade)')) return { rows: [{ total: 0 }] };
    if (sql.includes('SELECT id, saldo_pontos, pontos_acumulados')) return { rows: [{ id: ACCOUNT, saldo_pontos: 900, pontos_acumulados: 1200 }] };
    if (sql.includes('INSERT INTO commerce_loyalty_ledger')) return { rows: [{ id: LEDGER }] };
    if (sql.includes('UPDATE commerce_loyalty_accounts')) return { rows: [] };
    if (sql.includes('UPDATE fidelidade_recompensas')) return { rows: [] };
    if (sql.includes('INSERT INTO fidelidade_resgates_recompensa')) return { rows: [{
      id: REDEMPTION, empresa_id: SCOPE.empresaId, loja_id: SCOPE.lojaId,
      cliente_id: CUSTOMER, recompensa_id: REWARD, pontos_resgatados: 500, quantidade: 1,
    }] };
    throw new Error(`SQL inesperado: ${sql}`);
  });
  const result = await redeemReward(db, {
    ...SCOPE, clienteId: CUSTOMER, recompensaId: REWARD, quantidade: 1,
    confirmar: true, idempotencyKey: 'loyalty-reward:1234567890abcdef',
  });
  assert.equal(result.replay, false);
  assert.equal(result.redemption.pontos_resgatados, 500);
  assert.equal(db.state.commits, 1);
  assert.equal(db.state.rollbacks, 0);
  assert.equal(db.state.calls.filter(call => call.sql.includes('INSERT INTO commerce_loyalty_ledger')).length, 1);
  assert.equal(db.state.calls.filter(call => call.sql.includes('UPDATE commerce_loyalty_accounts')).length, 1);
  assert.equal(db.state.calls.filter(call => call.sql.includes('UPDATE fidelidade_recompensas')).length, 1);
});

test('replay idempotente retorna o resgate existente sem novo débito', async () => {
  const db = mockDb(sql => {
    if (sql.includes('pg_advisory_xact_lock')) return { rows: [] };
    if (sql.includes('WHERE rr.empresa_id = $1 AND rr.idempotency_key')) return { rows: [{
      id: REDEMPTION, empresa_id: SCOPE.empresaId, loja_id: SCOPE.lojaId,
      cliente_id: CUSTOMER, recompensa_id: REWARD, quantidade: 1,
      idempotency_key: 'loyalty-reward:1234567890abcdef', pontos_resgatados: 500,
      recompensa_nome: 'Corte', cliente_nome: 'Cliente A',
    }] };
    throw new Error(`SQL inesperado em replay: ${sql}`);
  });
  const result = await redeemReward(db, {
    ...SCOPE, clienteId: CUSTOMER, recompensaId: REWARD, confirmar: true,
    idempotencyKey: 'loyalty-reward:1234567890abcdef',
  });
  assert.equal(result.replay, true);
  assert.equal(db.state.calls.some(call => call.sql.includes('INSERT INTO commerce_loyalty_ledger')), false);
  assert.equal(db.state.commits, 1);
});

test('reutilização da chave idempotente com outra quantidade é rejeitada sem débito', async () => {
  const db = mockDb(sql => {
    if (sql.includes('pg_advisory_xact_lock')) return { rows: [] };
    if (sql.includes('WHERE rr.empresa_id = $1 AND rr.idempotency_key')) return { rows: [{
      id: REDEMPTION, empresa_id: SCOPE.empresaId, loja_id: SCOPE.lojaId,
      cliente_id: CUSTOMER, recompensa_id: REWARD, quantidade: 1,
      pontos_resgatados: 500, recompensa_nome: 'Corte', cliente_nome: 'Cliente A',
    }] };
    throw new Error(`SQL inesperado: ${sql}`);
  });
  await assert.rejects(
    () => redeemReward(db, {
      ...SCOPE, clienteId: CUSTOMER, recompensaId: REWARD, quantidade: 2,
      confirmar: true, idempotencyKey: 'loyalty-reward:1234567890abcdef',
    }),
    error => error.statusCode === 409 && error.code === 'IDEMPOTENCY_CONFLICT',
  );
  assert.equal(db.state.calls.some(call => call.sql.includes('INSERT INTO commerce_loyalty_ledger')), false);
  assert.equal(db.state.rollbacks, 1);
});

test('confirmação de entrega é idempotente e não executa segundo UPDATE', async () => {
  const db = mockDb(sql => {
    if (sql.includes('SELECT * FROM fidelidade_resgates_recompensa')) return { rows: [{
      id: REDEMPTION, empresa_id: SCOPE.empresaId, loja_id: SCOPE.lojaId, status: 'entregue',
    }] };
    throw new Error(`SQL inesperado: ${sql}`);
  });
  const result = await markRewardDelivered(db, {
    ...SCOPE, redemptionId: REDEMPTION, confirmar: true,
  });
  assert.equal(result.replay, true);
  assert.equal(db.state.calls.some(call => call.sql.includes('UPDATE fidelidade_resgates_recompensa')), false);
  assert.equal(db.state.commits, 1);
});

test('cancelamento de recompensa entregue é bloqueado sem estorno', async () => {
  const db = mockDb(sql => {
    if (sql.includes('FROM fidelidade_resgates_recompensa rr')) return { rows: [{
      id: REDEMPTION, status: 'entregue', recompensa_nome: 'Corte',
    }] };
    throw new Error(`SQL inesperado: ${sql}`);
  });
  await assert.rejects(
    () => cancelRewardRedemption(db, {
      ...SCOPE, redemptionId: REDEMPTION, confirmar: true, motivo: 'Teste controlado',
    }),
    error => error.statusCode === 409 && error.code === 'REDEMPTION_DELIVERED',
  );
  assert.equal(db.state.calls.some(call => call.sql.includes('INSERT INTO commerce_loyalty_ledger')), false);
  assert.equal(db.state.rollbacks, 1);
});
