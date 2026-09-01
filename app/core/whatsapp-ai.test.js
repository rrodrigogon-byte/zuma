import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWhatsappAiSystemPrompt, parseEvolutionMessage } from './whatsapp-ai.js';

test('parseEvolutionMessage extrai mensagem individual recebida da Evolution', () => {
  const parsed = parseEvolutionMessage({
    event: 'messages.upsert',
    data: {
      key: { id: 'MSG-1', remoteJid: '5565999999999@s.whatsapp.net', fromMe: false },
      pushName: 'Cliente Dino',
      messageTimestamp: 123456,
      message: { conversation: 'Quero agendar um corte' },
    },
  });
  assert.deepEqual(parsed, {
    ignored: false,
    event: 'MESSAGES_UPSERT',
    externalId: 'MSG-1',
    remoteJid: '5565999999999@s.whatsapp.net',
    phone: '5565999999999',
    name: 'Cliente Dino',
    text: 'Quero agendar um corte',
    timestamp: 123456,
  });
});

test('parseEvolutionMessage ignora mensagens enviadas pela própria instância', () => {
  const parsed = parseEvolutionMessage({ event: 'MESSAGES_UPSERT', data: { key: { id: 'MSG-2', remoteJid: '5565999999999@s.whatsapp.net', fromMe: true }, message: { conversation: 'eco' } } });
  assert.equal(parsed.ignored, true);
  assert.equal(parsed.reason, 'from_me');
});

test('parseEvolutionMessage ignora grupos e conteúdo sem texto', () => {
  const group = parseEvolutionMessage({ event: 'MESSAGES_UPSERT', data: { key: { id: 'MSG-3', remoteJid: '1203630@g.us', fromMe: false }, message: { conversation: 'oi' } } });
  assert.equal(group.reason, 'group');
  const media = parseEvolutionMessage({ event: 'MESSAGES_UPSERT', data: { key: { id: 'MSG-4', remoteJid: '5565999999999@s.whatsapp.net', fromMe: false }, message: { audioMessage: {} } } });
  assert.equal(media.reason, 'unsupported_content');
});

test('prompt exige ferramentas, confirmação e handoff sem pagamento externo', () => {
  const prompt = buildWhatsappAiSystemPrompt({ storeName: 'Barbearia Dino', pendingAction: { summary: '1x produto' } });
  assert.match(prompt, /Nunca invente produto/);
  assert.match(prompt, /CONFIRMAR ou CANCELAR/);
  assert.match(prompt, /Pagamento externo não está habilitado/);
  assert.match(prompt, /solicitar_humano/);
  assert.match(prompt, /Há uma ação pendente/);
});
