import test from 'node:test';
import assert from 'node:assert/strict';
import { marketingWindow, marketingGate, marketingPhoneForTask, markMarketingSendBlocked, recordMarketingSend, reserveMarketingSend } from './whatsapp-marketing-guard.js';

const cuiaba = (iso) => new Date(`${iso}-04:00`);
const COMPANY = '11111111-1111-4111-8111-111111111111';
const STORE = '22222222-2222-4222-8222-222222222222';
const OTHER_STORE = '33333333-3333-4333-8333-333333333333';
const fakeDb = (logRows, phone = '65999990001', verified = true) => {
  const calls = [];
  return { calls, query: async (sql, params) => {
    calls.push({ sql, params });
    if (/SELECT id, automacao, status, referencia, criado_em FROM ai_automation_log/.test(sql)) {
      return { rows: logRows.filter(row => row.automacao === 'opt_out' || ((params[4] == null || row.referencia !== params[4]) && (params[5] == null || row.id !== params[5]))) };
    }
    if (/INSERT INTO ai_automation_log/.test(sql)) return { rows: [{ id: 'log', status: 'enfileirada' }] };
    return /whatsapp_ai_sessions/.test(sql) ? { rows: verified ? [{ ok: 1 }] : [] } : { rows: [{ telefone: phone }], rowCount: 1 };
  } };
};
const task = { tipo: 'enviar_campanha', empresa_id: COMPANY, loja_id: STORE, payload: { campaignDeliveryId: 'x' } };

test('marketing só sai entre 8h e 21h de Cuiabá', () => {
  assert.equal(marketingWindow(cuiaba('2026-09-28T10:00:00')).open, true);
  const noite = marketingWindow(cuiaba('2026-09-28T21:30:00'));
  assert.equal(noite.open, false);
  assert.equal(noite.nextOpen.toISOString().slice(0, 16), '2026-09-29T12:01', 'amanhã às 8h01 de Cuiabá');
  assert.equal(marketingWindow(cuiaba('2026-09-28T06:00:00')).nextOpen.toISOString().slice(0, 13), '2026-09-28T12');
});

test('fora do horário adia; SAIR permanente pula; mensagem nas últimas 24h adia', async () => {
  assert.equal((await marketingGate(task, { now: cuiaba('2026-09-28T22:00:00'), database: fakeDb([]) })).action, 'defer');
  const dia = cuiaba('2026-09-28T10:00:00');
  assert.equal((await marketingGate(task, { now: dia, database: fakeDb([{ automacao: 'opt_out', status: 'bloqueada', criado_em: '2026-01-01' }]) })).action, 'skip');
  const reserved = await marketingGate({ ...task, payload: { campaignDeliveryId: 'other-delivery' } }, { now: dia, database: fakeDb([{ automacao: 'carrinho', status: 'enfileirada', criado_em: cuiaba('2026-09-28T09:00:00').toISOString() }]) });
  assert.equal(reserved.reason, 'limite_24h', 'a reserva persistente bloqueia outra mensagem antes do envio');
  assert.equal((await marketingGate(task, { now: dia, database: fakeDb([{ automacao: 'campanha', status: 'enfileirada', referencia: 'x', criado_em: cuiaba('2026-09-28T09:00:00').toISOString() }]) })).action, 'go', 'a própria reserva não bloqueia o replay idempotente');
  const limite = await marketingGate(task, { now: dia, database: fakeDb([{ automacao: 'reativacao', status: 'enviada', criado_em: cuiaba('2026-09-28T09:00:00').toISOString() }]) });
  assert.equal(limite.action, 'defer');
  assert.equal(limite.reason, 'limite_24h');
  assert.equal((await marketingGate(task, { now: dia, database: fakeDb([]) })).action, 'go');
  assert.equal((await marketingGate(task, { now: dia, database: fakeDb([], '') })).reason, 'destino_unidade_nao_verificado');
  assert.equal((await marketingGate({ tipo: 'processar_conversa' }, { now: cuiaba('2026-09-28T23:00:00') })).action, 'go', 'atendimento não tem horário');
});

test('lembrete de carrinho só vai para número que já falou com a loja ou autorizou marketing', async () => {
  const cart = { tipo: 'recuperar_carrinho', empresa_id: COMPANY, loja_id: STORE, referencia_externa: 'c' };
  const dia = cuiaba('2026-09-28T10:00:00');
  assert.equal((await marketingGate(cart, { now: dia, database: fakeDb([], '65999990001', false) })).reason, 'telefone_nao_verificado');
  assert.equal((await marketingGate(cart, { now: dia, database: fakeDb([], '65999990001', true) })).action, 'go');
});

test('automação de marketing do atendente passa pela janela, pelo SAIR e pelo limite de 24h na hora do envio', async () => {
  const dia = cuiaba('2026-09-28T10:00:00');
  const auto = { tipo: 'automacao_ia', empresa_id: COMPANY, loja_id: STORE, payload: { logId: '99999999-9999-4999-8999-999999999999', automacao: 'reativacao', telefone: '556599990001' } };
  assert.equal((await marketingGate(auto, { now: cuiaba('2026-09-28T22:00:00'), database: fakeDb([]) })).action, 'defer');
  const sair = await marketingGate(auto, { now: dia, database: fakeDb([{ automacao: 'opt_out', status: 'bloqueada', criado_em: '2026-01-01' }]) });
  assert.equal(sair.action, 'skip');
  assert.equal(sair.phone, '5565999990001', 'telefone de 12 dígitos vira o canônico');
  const campanhaAntes = await marketingGate(auto, { now: dia, database: fakeDb([{ automacao: 'campanha', status: 'enviada', criado_em: cuiaba('2026-09-28T09:40:00').toISOString() }]) });
  assert.equal(campanhaAntes.reason, 'limite_24h', 'campanha e automação somam no mesmo limite');
  const servico = { tipo: 'automacao_ia', empresa_id: COMPANY, loja_id: STORE, payload: { automacao: 'pos_atendimento', telefone: '556599990001' } };
  assert.equal((await marketingGate(servico, { now: cuiaba('2026-09-28T22:00:00'), database: fakeDb([]) })).action, 'go', 'pós-atendimento não é marketing');
});

test('cooldown e telefone de campanha/carrinho usam a unidade; unidade ausente falha fechado', async () => {
  const db = fakeDb([]);
  await marketingGate(task, { now: cuiaba('2026-09-28T10:00:00'), database: db });
  const campaignQuery = db.calls.find(({ sql }) => /envios_campanha/.test(sql));
  const limitQuery = db.calls.find(({ sql }) => /ai_automation_log/.test(sql));
  assert.match(campaignQuery.sql, /ec\.loja_id = \$3/);
  assert.deepEqual(campaignQuery.params, ['x', COMPANY, STORE]);
  assert.match(limitQuery.sql, /loja_id = \$3/);
  assert.match(limitQuery.sql, /ORDER BY \(automacao = 'opt_out'\) DESC, criado_em DESC LIMIT 6/);
  assert.equal(limitQuery.params[2], STORE);
  assert.match(limitQuery.sql, /status IN \('enfileirada','enviada'\)/);
  assert.match(limitQuery.sql, /referencia <> \$5/);
  assert.equal(limitQuery.params[4], 'x', 'a reserva da própria entrega não se bloqueia');

  const cartDb = fakeDb([]);
  assert.equal(await marketingPhoneForTask({ tipo: 'recuperar_carrinho', empresa_id: COMPANY, loja_id: STORE, referencia_externa: 'cart-id' }, cartDb), '5565999990001');
  assert.match(cartDb.calls[0].sql, /commerce_storefronts[\s\S]*sf\.loja_id = \$3/);
  const invalidDb = fakeDb([]);
  assert.equal((await marketingGate({ ...task, loja_id: null }, { now: cuiaba('2026-09-28T10:00:00'), database: invalidDb })).reason, 'escopo_unidade_obrigatorio');
  assert.equal(invalidDb.calls.length, 0);
  const missingSchema = { query: async sql => /ai_automation_log/.test(sql) ? Promise.reject(Object.assign(new Error('missing migration'), { code: '42P01' })) : { rows: [{ telefone: '65999990001' }] } };
  await assert.rejects(marketingGate(task, { now: cuiaba('2026-09-28T10:00:00'), database: missingSchema }), error => error.code === '42P01');
});

test('reserva de campanha é loja-scoped e usa status enfileirada antes de chamar o provedor', async () => {
  const db = fakeDb([]);
  await reserveMarketingSend(task, '5565999990001', db);
  const insert = db.calls.find(({ sql }) => /INSERT INTO ai_automation_log/.test(sql));
  assert.match(insert.sql, /empresa_id, loja_id, telefone/);
  assert.deepEqual(insert.params.slice(0, 3), [COMPANY, STORE, '5565999990001']);
  assert.match(insert.sql, /VALUES[\s\S]*'enfileirada'/);
  assert.match(insert.sql, /ON CONFLICT \(empresa_id, loja_id, automacao, telefone, referencia\) WHERE loja_id IS NOT NULL/);
});

test('registro finaliza reserva sem engolir falha e skip libera somente reserva da mesma unidade/referência', async () => {
  const db = fakeDb([]);
  await recordMarketingSend(task, '5565999990001', db);
  const finalize = db.calls.find(({ sql }) => /UPDATE ai_automation_log/.test(sql));
  assert.match(finalize.sql, /SET status = 'enviada'/);
  assert.deepEqual(finalize.params.slice(0, 5), [COMPANY, STORE, '5565999990001', 'campanha', 'x']);

  const noPhoneDb = fakeDb([]);
  await markMarketingSendBlocked(task, null, 'cliente_pediu_sair', noPhoneDb);
  const blocked = noPhoneDb.calls.find(({ sql }) => /UPDATE ai_automation_log/.test(sql));
  assert.match(blocked.sql, /empresa_id = \$1 AND loja_id = \$2 AND automacao = \$3 AND referencia = \$4/);
  assert.match(blocked.sql, /\(\$5::text IS NULL OR telefone = \$5\)/);
  assert.equal(blocked.params[4], null);
});
