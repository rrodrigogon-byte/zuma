import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatPhoneNumberE164,
  getCloudApiConfig,
  sendCloudApiTextMessage,
  sendCloudApiInteractiveButtons,
  sendCloudApiTemplateMessage,
  verifyMetaWebhookChallenge,
  parseMetaWebhookEvent,
} from './whatsapp-cloud-api.js';

test('1. formatPhoneNumberE164 formata números brasileiros para o padrão internacional Meta', () => {
  assert.equal(formatPhoneNumberE164('14997462929'), '5514997462929');
  assert.equal(formatPhoneNumberE164('(14) 99746-2929'), '5514997462929');
  assert.equal(formatPhoneNumberE164('+55 65 99905-6008'), '5565999056008');
  assert.equal(formatPhoneNumberE164('5565999056008'), '5565999056008');
  assert.equal(formatPhoneNumberE164(''), '');
});

test('2. getCloudApiConfig extrai credenciais corretamente', () => {
  const cfg = getCloudApiConfig({
    meta_access_token: 'EAAB_test_token',
    meta_phone_number_id: '100200300',
    meta_waba_id: '400500600',
    meta_verify_token: 'secret_verify_token',
  });

  assert.equal(cfg.token, 'EAAB_test_token');
  assert.equal(cfg.phoneNumberId, '100200300');
  assert.equal(cfg.wabaId, '400500600');
  assert.equal(cfg.verifyToken, 'secret_verify_token');
});

test('3. sendCloudApiTextMessage monta payload correto para a Meta Graph API', async () => {
  let requestCaptured = null;
  const mockFetch = async (url, options) => {
    requestCaptured = { url, options, body: JSON.parse(options.body) };
    return {
      ok: true,
      status: 200,
      json: async () => ({
        messaging_product: 'whatsapp',
        contacts: [{ input: '5565999056008', wa_id: '5565999056008' }],
        messages: [{ id: 'wamid.HBgLM' }],
      }),
    };
  };

  const res = await sendCloudApiTextMessage({
    phoneNumberId: '100200300',
    token: 'EAAB_test_token',
    to: '65 99905-6008',
    text: 'Olá! Seu agendamento está confirmado.',
    fetchImpl: mockFetch,
  });

  assert.equal(res.ok, true);
  assert.equal(res.messageId, 'wamid.HBgLM');
  assert.equal(res.recipient, '5565999056008');
  assert.equal(requestCaptured.body.messaging_product, 'whatsapp');
  assert.equal(requestCaptured.body.type, 'text');
  assert.equal(requestCaptured.body.text.body, 'Olá! Seu agendamento está confirmado.');
  assert.ok(requestCaptured.url.includes('/v22.0/100200300/messages'));
});

test('4. sendCloudApiInteractiveButtons monta botões de resposta rápida (CONFIRMAR, REMARCAR)', async () => {
  let requestCaptured = null;
  const mockFetch = async (url, options) => {
    requestCaptured = { url, options, body: JSON.parse(options.body) };
    return {
      ok: true,
      status: 200,
      json: async () => ({
        messages: [{ id: 'wamid.HBgLInteractive' }],
      }),
    };
  };

  const res = await sendCloudApiInteractiveButtons({
    phoneNumberId: '100200300',
    token: 'EAAB_test_token',
    to: '14997462929',
    bodyText: 'Confirma seu horário amanhã às 09:00 com Bruno?',
    buttons: [
      { id: 'btn_confirmar', title: 'CONFIRMAR' },
      { id: 'btn_remarcar', title: 'REMARCAR' },
      { id: 'btn_cancelar', title: 'CANCELAR' },
    ],
    headerText: 'Barbearia Dino',
    footerText: 'Responda tocando em um botão',
    fetchImpl: mockFetch,
  });

  assert.equal(res.ok, true);
  assert.equal(res.messageId, 'wamid.HBgLInteractive');
  assert.equal(requestCaptured.body.type, 'interactive');
  assert.equal(requestCaptured.body.interactive.type, 'button');
  assert.equal(requestCaptured.body.interactive.action.buttons.length, 3);
  assert.equal(requestCaptured.body.interactive.action.buttons[0].reply.id, 'btn_confirmar');
  assert.equal(requestCaptured.body.interactive.action.buttons[0].reply.title, 'CONFIRMAR');
});

test('5. verifyMetaWebhookChallenge responde ao handshake da Meta com sucesso', () => {
  const challengeQuery = {
    'hub.mode': 'subscribe',
    'hub.verify_token': 'minha_chave_secreta_2026',
    'hub.challenge': '1158201444',
  };

  const ok = verifyMetaWebhookChallenge(challengeQuery, 'minha_chave_secreta_2026');
  assert.equal(ok.verified, true);
  assert.equal(ok.challenge, '1158201444');

  const fail = verifyMetaWebhookChallenge(challengeQuery, 'chave_errada');
  assert.equal(fail.verified, false);
});

test('6. parseMetaWebhookEvent extrai texto, remetente e botões clicados', () => {
  const payloadTexto = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '400500600',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              contacts: [{ profile: { name: 'Rodrigo Gonçalves' }, wa_id: '5565999056008' }],
              messages: [
                {
                  from: '5565999056008',
                  id: 'wamid.HBgLZGVz',
                  timestamp: '1731195600',
                  type: 'text',
                  text: { body: 'Quero agendar corte hoje às 17h' },
                },
              ],
            },
          },
        ],
      },
    ],
  };

  const parsed = parseMetaWebhookEvent(payloadTexto);
  assert.equal(parsed.messages.length, 1);
  assert.equal(parsed.messages[0].from, '5565999056008');
  assert.equal(parsed.messages[0].senderName, 'Rodrigo Gonçalves');
  assert.equal(parsed.messages[0].text, 'Quero agendar corte hoje às 17h');

  // Teste com clique de botão interativo
  const payloadBotao = {
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            value: {
              contacts: [{ profile: { name: 'João' }, wa_id: '5514997462929' }],
              messages: [
                {
                  from: '5514997462929',
                  id: 'wamid.btn123',
                  type: 'interactive',
                  interactive: {
                    type: 'button_reply',
                    button_reply: { id: 'btn_confirmar', title: 'CONFIRMAR' },
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  };

  const parsedBtn = parseMetaWebhookEvent(payloadBotao);
  assert.equal(parsedBtn.messages[0].buttonId, 'btn_confirmar');
  assert.equal(parsedBtn.messages[0].text, 'CONFIRMAR');
});
