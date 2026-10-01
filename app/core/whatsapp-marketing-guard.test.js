import test from 'node:test';
import assert from 'node:assert/strict';
import { marketingWindow, marketingGate } from './whatsapp-marketing-guard.js';

const cuiaba = (iso) => new Date(`${iso}-04:00`);
const fakeDb = (logRows, phone = '65999990001', verified = true) => ({ query: async (sql) => (/ai_automation_log/.test(sql) ? { rows: logRows } : /whatsapp_ai_sessions/.test(sql) ? { rows: verified ? [{ ok: 1 }] : [] } : { rows: [{ telefone: phone }] }) });
const task = { tipo: 'enviar_campanha', empresa_id: 'e', payload: { campaignDeliveryId: 'x' } };

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
  const limite = await marketingGate(task, { now: dia, database: fakeDb([{ automacao: 'reativacao', status: 'enviada', criado_em: cuiaba('2026-09-28T09:00:00').toISOString() }]) });
  assert.equal(limite.action, 'defer');
  assert.equal(limite.reason, 'limite_24h');
  assert.equal((await marketingGate(task, { now: dia, database: fakeDb([]) })).action, 'go');
  assert.equal((await marketingGate({ tipo: 'processar_conversa' }, { now: cuiaba('2026-09-28T23:00:00') })).action, 'go', 'atendimento não tem horário');
});

test('lembrete de carrinho só vai para número que já falou com a loja ou autorizou marketing', async () => {
  const cart = { tipo: 'recuperar_carrinho', empresa_id: 'e', referencia_externa: 'c' };
  const dia = cuiaba('2026-09-28T10:00:00');
  assert.equal((await marketingGate(cart, { now: dia, database: fakeDb([], '65999990001', false) })).reason, 'telefone_nao_verificado');
  assert.equal((await marketingGate(cart, { now: dia, database: fakeDb([], '65999990001', true) })).action, 'go');
});

test('automação de marketing do atendente passa pela janela, pelo SAIR e pelo limite de 24h na hora do envio', async () => {
  const dia = cuiaba('2026-09-28T10:00:00');
  const auto = { tipo: 'automacao_ia', empresa_id: 'e', payload: { automacao: 'reativacao', telefone: '556599990001' } };
  assert.equal((await marketingGate(auto, { now: cuiaba('2026-09-28T22:00:00'), database: fakeDb([]) })).action, 'defer');
  const sair = await marketingGate(auto, { now: dia, database: fakeDb([{ automacao: 'opt_out', status: 'bloqueada', criado_em: '2026-01-01' }]) });
  assert.equal(sair.action, 'skip');
  assert.equal(sair.phone, '5565999990001', 'telefone de 12 dígitos vira o canônico');
  const campanhaAntes = await marketingGate(auto, { now: dia, database: fakeDb([{ automacao: 'campanha', status: 'enviada', criado_em: cuiaba('2026-09-28T09:40:00').toISOString() }]) });
  assert.equal(campanhaAntes.reason, 'limite_24h', 'campanha e automação somam no mesmo limite');
  const servico = { tipo: 'automacao_ia', empresa_id: 'e', payload: { automacao: 'pos_atendimento', telefone: '556599990001' } };
  assert.equal((await marketingGate(servico, { now: cuiaba('2026-09-28T22:00:00'), database: fakeDb([]) })).action, 'go', 'pós-atendimento não é marketing');
});
