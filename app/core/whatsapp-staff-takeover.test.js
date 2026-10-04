import test from 'node:test';
import assert from 'node:assert/strict';
import { isStaffTyped, latestStaffMessages, staffPauseMinutes, staffTakeoverEnabled } from './whatsapp-staff-takeover.js';
import { fetchOutboundMessages } from './whatsapp-provider.js';

test('só mensagem de saída "organic" conta como equipe no celular', () => {
  assert.equal(isStaffTyped({ role: 'assistant', interactionType: 'organic' }), true);
  assert.equal(isStaffTyped({ role: 'assistant', interactionType: 'ORGANIC ' }), true);
  assert.equal(isStaffTyped({ role: 'assistant', interactionType: 'bot' }), false, 'IA/lembrete/campanha');
  assert.equal(isStaffTyped({ role: 'assistant' }), false, 'sem o campo: fail-safe, não pausa');
  assert.equal(isStaffTyped({ role: 'user', interactionType: 'organic' }), false, 'mensagem do cliente');
});

test('última mensagem da equipe por contato, ignorando grupo e horário inválido', () => {
  const itens = [
    { chatId: '5565999990001', role: 'assistant', interactionType: 'organic', timestamp: '2026-10-02T13:00:00Z' },
    { chatId: '5565999990001@c.us', role: 'assistant', interactionType: 'organic', timestamp: '2026-10-02T13:05:00Z' },
    { chatId: '5565999990001', role: 'assistant', interactionType: 'bot', timestamp: '2026-10-02T13:10:00Z' },
    { chatId: '120363000000@g.us', role: 'assistant', interactionType: 'organic', timestamp: '2026-10-02T13:00:00Z' },
    { chatId: '5565999990002', role: 'assistant', interactionType: 'organic', timestamp: 'quebrado' },
  ];
  const r = latestStaffMessages(itens);
  assert.equal(r.length, 1);
  assert.equal(r[0].phone, '5565999990001');
  assert.equal(r[0].at.toISOString(), '2026-10-02T13:05:00.000Z');
});

test('pausa padrão de 120 min, limitada entre 15 e 720; desliga com off', () => {
  const antes = { ...process.env };
  try {
    delete process.env.WHATSAPP_AI_STAFF_PAUSE_MIN;
    assert.equal(staffPauseMinutes(), 120);
    process.env.WHATSAPP_AI_STAFF_PAUSE_MIN = '1';
    assert.equal(staffPauseMinutes(), 15);
    process.env.WHATSAPP_AI_STAFF_PAUSE_MIN = '99999';
    assert.equal(staffPauseMinutes(), 720);
    assert.equal(staffTakeoverEnabled(), true);
    process.env.WHATSAPP_AI_STAFF_TAKEOVER = 'off';
    assert.equal(staffTakeoverEnabled(), false);
  } finally {
    process.env = antes;
  }
});

test('fetchOutboundMessages pede role=assistant e descarta o que não é saída', async () => {
  const antes = { ...process.env };
  try {
    Object.assign(process.env, {
      WHATSAPP_PROVIDER: 'chatbot_backend',
      CHATBOT_BACKEND_URL: 'https://backend.teste',
      CHATBOT_BACKEND_KEY: 'chave-de-teste-com-mais-de-20',
      CHATBOT_BACKEND_MODE: 'instancias',
      CHATBOT_BACKEND_INSTANCE: 'dino',
    });
    let urlPedida = '';
    const fetchImpl = async (url) => {
      urlPedida = String(url);
      const corpo = JSON.stringify({ users: [{ chatId: '5565999990001', messages: [
        { role: 'assistant', interactionType: 'organic', content: 'oi', timestamp: '2026-10-02T13:00:00Z' },
        { role: 'user', content: 'cliente', timestamp: '2026-10-02T13:01:00Z' },
      ] }] });
      return { ok: true, status: 200, headers: new Map([['content-type', 'application/json']]), text: async () => corpo, json: async () => JSON.parse(corpo) };
    };
    const r = await fetchOutboundMessages({ instance: 'dino', from: Date.parse('2026-10-02T12:30:00Z') }, fetchImpl);
    assert.equal(r.ok, true);
    assert.match(urlPedida, /role=assistant/);
    assert.match(urlPedida, /instanceName=dino/);
    assert.equal(r.messages.length, 1);
    assert.equal(r.messages[0].chatId, '5565999990001');
  } finally {
    process.env = antes;
  }
});
