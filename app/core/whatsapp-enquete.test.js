// Enquete do WhatsApp na IA de atendimento (igual às aprovações da Isa): o cliente toca na opção.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sendPollViaChatbotBackend } from './whatsapp-provider.js';
import { createWhatsappAiToolExecutor, enqueteEmTexto, normalizarEnquete, WHATSAPP_AI_TOOL_DECLARATIONS } from './whatsapp-ai-tools.js';
import { ENQUETE_CONFIRMACAO_OPCOES, enqueteNoHistorico, buildWhatsappAiSystemPrompt } from './whatsapp-ai.js';
import { parseBackendMessage, votoDaEnquete } from './whatsapp-isa-poll.js';
import { resolveConfirmation, strictConfirmIntent, CONFIRMATION_HINT } from './whatsapp-ai-intents.js';

async function withEnv(vars, fn) {
  const antes = {};
  for (const [k, v] of Object.entries(vars)) { antes[k] = process.env[k]; if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  try { return await fn(); } finally {
    for (const [k, v] of Object.entries(antes)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
}

const context = {
  empresaId: '11111111-1111-4111-8111-111111111111',
  lojaId: '22222222-2222-4222-8222-222222222222',
  canalId: '33333333-3333-4333-8333-333333333333',
  sessionId: '44444444-4444-4444-8444-444444444999',
  phone: '5565999999999',
};

test('enquete aceita 2 a 12 opções distintas e corta o excesso', () => {
  assert.equal(normalizarEnquete({ pergunta: 'Qual?', opcoes: ['Só uma'] }), null);
  assert.equal(normalizarEnquete({ pergunta: '', opcoes: ['A', 'B'] }), null);
  const e = normalizarEnquete({ pergunta: 'Qual sabor?', opcoes: ['Chocolate', 'chocolate', 'Morango', ...Array.from({ length: 20 }, (_, i) => `Op ${i}`)] });
  assert.equal(e.opcoes.length, 12);
  assert.deepEqual(e.opcoes.slice(0, 2), ['Chocolate', 'Morango'], 'repetida (sem diferenciar maiúscula) sai');
  assert.ok(e.opcoes.every(o => o.length <= 100));
});

test('enviar_enquete guarda uma enquete por resposta e orienta o texto curto', async () => {
  const ctx = { ...context };
  const exec = createWhatsappAiToolExecutor(ctx);
  const r = await exec('enviar_enquete', { pergunta: 'Qual whey chocolate branco?', opcoes: ['Isolado 450g — R$ 329', 'Sachê 4 cx — R$ 89', 'Shake 250ml — R$ 14,90'] });
  assert.equal(r.ok, true);
  assert.equal(ctx.poll.opcoes.length, 3);
  assert.match(r.instruction, /sem repetir as opções|não.*numerar|frase curta/i);
  await assert.rejects(exec('enviar_enquete', { pergunta: 'De novo?', opcoes: ['A', 'B'] }), { code: 'POLL_LIMIT' });
  assert.ok(WHATSAPP_AI_TOOL_DECLARATIONS.some(t => t.name === 'enviar_enquete'));
});

test('enquete desligada (off): não chama a rede e cai no texto numerado', async () => withEnv({ CHATBOT_BACKEND_POLL_PATH: 'off', CHATBOT_BACKEND_URL: 'https://backend.example.invalid', CHATBOT_BACKEND_KEY: 'x'.repeat(24) }, async () => {
  let chamou = false;
  const out = await sendPollViaChatbotBackend({ number: '5565999990001', name: 'Qual?', options: ['A', 'B'] }, async () => { chamou = true; });
  assert.equal(out.unsupported, true);
  assert.equal(chamou, false);
  const texto = enqueteEmTexto({ pergunta: 'Retirada ou entrega?', opcoes: ['Retirar na loja', 'Entrega'] });
  assert.match(texto, /1️⃣ Retirar na loja\n2️⃣ Entrega/);
}));

test('rota padrão /send-poll: manda instância, chat_id, pergunta e opções (uma escolha)', async () => withEnv({ CHATBOT_BACKEND_POLL_PATH: undefined, CHATBOT_BACKEND_URL: 'https://backend.example.invalid', CHATBOT_BACKEND_KEY: 'x'.repeat(24), CHATBOT_BACKEND_MODE: 'instancias', CHATBOT_BACKEND_INSTANCE: 'stallone-1' }, async () => {
  let pedido = null;
  const out = await sendPollViaChatbotBackend({ instance: 'stallone-1', number: '5565999990001', name: 'Qual sabor?', options: ['Chocolate', 'Baunilha'] }, async (url, init) => {
    pedido = { url, body: JSON.parse(init.body) };
    return { ok: true, status: 200, text: async () => JSON.stringify({ success: true }) };
  });
  assert.equal(out.ok, true);
  assert.equal(pedido.url, 'https://backend.example.invalid/api/v1/whats-app/send-poll');
  assert.deepEqual(pedido.body, { instanceName: 'stallone-1', chat_id: '5565999990001', poll: { name: 'Qual sabor?', options: ['Chocolate', 'Baunilha'], selectableCount: 1 } });
  const errado = await sendPollViaChatbotBackend({ instance: 'outra', number: '5565999990001', name: 'Q', options: ['A', 'B'] }, async () => { throw new Error('não deveria chamar'); });
  assert.equal(errado.error, 'INSTANCE_SCOPE_MISMATCH');
}));

test('voto da enquete vira o texto da opção escolhida', () => {
  assert.equal(votoDaEnquete({ selectedOptions: [{ name: 'Retirar na loja' }] }), 'Retirar na loja');
  assert.equal(votoDaEnquete({ messageType: 'poll_vote', content: JSON.stringify({ selectedOptions: ['Pix'] }) }), 'Pix');
  assert.equal(votoDaEnquete({ content: 'oi' }), '');
  const msg = parseBackendMessage({ chatId: '5565999990001', role: 'user', messageType: 'poll_vote', selectedOptions: ['✅ Sim, confirmar'], whatsappMessageId: 'ABC', timestamp: new Date().toISOString() });
  assert.equal(msg.ignored, false);
  assert.equal(msg.text, '✅ Sim, confirmar');
});

test('enquete de confirmação conclui ou cancela pelas palavras explícitas', () => {
  const [sim, mudar, cancelar] = ENQUETE_CONFIRMACAO_OPCOES;
  assert.equal(strictConfirmIntent(sim), 'confirm');
  assert.equal(strictConfirmIntent(cancelar), 'cancel');
  assert.equal(resolveConfirmation(mudar, { actionType: 'pedido', lastAssistantText: `Resumo\n${CONFIRMATION_HINT}` }), null, '"Quero mudar" vai para o modelo');
});

test('histórico mostra a enquete numerada e o prompt manda usar enquete', () => {
  assert.equal(enqueteNoHistorico({ pergunta: 'Qual sabor?', opcoes: ['Chocolate', 'Baunilha'] }), 'Qual sabor? — 1) Chocolate; 2) Baunilha');
  const prompt = buildWhatsappAiSystemPrompt({ storeName: 'Stallone Nutre Sport', segment: 'suplementos' });
  assert.match(prompt, /enviar_enquete/);
});

test('backend ainda sem a rota (404): marca unsupported para cair no texto numerado', async () => withEnv({ CHATBOT_BACKEND_POLL_PATH: undefined, CHATBOT_BACKEND_URL: 'https://backend.example.invalid', CHATBOT_BACKEND_KEY: 'x'.repeat(24), CHATBOT_BACKEND_MODE: undefined }, async () => {
  const out = await sendPollViaChatbotBackend({ number: '5565999990001', name: 'Q', options: ['A', 'B'] }, async () => ({ ok: false, status: 404, text: async () => '{"message":"Cannot POST"}' }));
  assert.equal(out.ok, false);
  assert.equal(out.unsupported, true);
  assert.equal(out.uncertain, false);
}));
