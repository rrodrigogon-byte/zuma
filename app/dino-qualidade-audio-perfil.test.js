import test from 'node:test';
import assert from 'node:assert/strict';
import { presenceConfirmIntent } from './core/whatsapp-ai.js';
import { resolveConfirmation, CONFIRMATION_HINT, stripMediaPrefix } from './core/whatsapp-ai-intents.js';
import { resolveWhatsappCustomerProfile } from './core/whatsapp-ai-profile.js';
import { DINO_EMPRESA_CANONICA } from './dino-equipe-seed.js';

test('Qualidade T-Rex: Reconhecimento de confirmações vindas de áudios transcritos', () => {
  const casosAudio = [
    '[áudio transcrito] Pode confirmar',
    '[áudio transcrito] Sim',
    '[áudio transcrito] Fechado',
    '[áudio transcrito] Combinado',
    '[áudio transcrito] Bora',
    '[audio transcrito] To a caminho',
    '[mensagem de voz] Confirmado',
    '[áudio transcrito] 👍',
    '[áudio transcrito] 💈',
    '[áudio transcrito] corte cabelo e barba'
  ];

  for (const audioMsg of casosAudio) {
    assert.equal(presenceConfirmIntent(audioMsg), true, `Deveria confirmar presença a partir de áudio: "${audioMsg}"`);
  }

  const lastAssistant = `Seu horário... ${CONFIRMATION_HINT}`;
  assert.equal(resolveConfirmation('[áudio transcrito] sim', { lastAssistantText: lastAssistant }), 'confirm');
  assert.equal(resolveConfirmation('[áudio transcrito] pode confirmar', { lastAssistantText: lastAssistant }), 'confirm');
  assert.equal(resolveConfirmation('[mensagem de voz] fechado', { lastAssistantText: lastAssistant }), 'confirm');
});

test('Qualidade T-Rex: stripMediaPrefix remove qualquer prefixo de áudio ou mídia', () => {
  assert.equal(stripMediaPrefix('[áudio transcrito] Opa, pode confirmar'), 'Opa, pode confirmar');
  assert.equal(stripMediaPrefix('[audio transcrito] Sim'), 'Sim');
  assert.equal(stripMediaPrefix('[mensagem de voz] Chegando'), 'Chegando');
  assert.equal(stripMediaPrefix('[foto enviada] Quero esse corte'), 'Quero esse corte');
  assert.equal(stripMediaPrefix('Mensagem normal de texto'), 'Mensagem normal de texto');
});

test('Qualidade T-Rex: Perfil de cliente da Barbearia Dino resolve sem erro 42P01', async () => {
  const context = {
    empresaId: DINO_EMPRESA_CANONICA,
    lojaId: '00000000-0000-4000-8000-000000000001',
    canalId: '00000000-0000-4000-8000-000000000002',
    sessionId: '00000000-0000-4000-8000-000000000003',
    phone: '5565999870379',
  };

  const channel = {
    configuracao: {
      aiPolicy: { personalizationEnabled: true },
    },
  };

  const res = await resolveWhatsappCustomerProfile(context, channel, {});
  assert.ok(res, 'Deve retornar resultado de perfil');
  assert.equal(typeof res.policy, 'object', 'Deve retornar política');
});
