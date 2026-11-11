import test from 'node:test';
import assert from 'node:assert/strict';
import { presenceConfirmIntent, shouldAskPersonalization, buildWhatsappAiSystemPrompt } from './core/whatsapp-ai.js';

test('T-Rex RV: Reconhecimento abrangente e veloz de confirmações de presença', () => {
  const casosValidos = [
    'confirmo',
    'CONFIRMO',
    'confirmando',
    'Confirmado',
    'pode confirmar',
    'pode ser sim',
    'sim pode ser',
    'fechado',
    'fechou',
    'combinado',
    'bora',
    'show',
    'com certeza',
    'estarei ai',
    'vou sim',
    'to a caminho',
    'chegando',
    '👍',
    '💈',
    '✂️',
    'sim obrigado',
    'confirmo obrigada'
  ];

  for (const texto of casosValidos) {
    assert.equal(presenceConfirmIntent(texto), true, `Deveria reconhecer como confirmação: "${texto}"`);
  }

  const casosNegativos = [
    'corte cabelo e barba',
    'corte e barba',
    'não vou conseguir',
    'cancela',
    'remarcar para outro dia',
    'tem horário mais tarde?',
    'quanto custa o corte?'
  ];

  for (const texto of casosNegativos) {
    assert.equal(presenceConfirmIntent(texto), false, `NÃO deveria reconhecer como confirmação: "${texto}"`);
  }
});

test('T-Rex RV: Supressão de perguntas de preferências que atrasam o atendimento', () => {
  const personaTrex = { id: 'trex', nome: 'T-Rex', segmento: 'barbearia' };
  const devePerguntar = shouldAskPersonalization({
    policy: { personalizationEnabled: true },
    consent: { personalization: false },
    session: { personalization_prompted_at: null, estado: {} },
    pendingAction: false,
    persona: personaTrex
  });

  assert.equal(devePerguntar, false, 'Para o T-Rex não deve perguntar sobre salvar preferências');
});

test('T-Rex RV: System prompt contém instruções de agilidade e agendamento expresso', () => {
  const prompt = buildWhatsappAiSystemPrompt({
    storeName: 'Dino Barbearia',
    persona: { id: 'trex', nome: 'T-Rex', segmento: 'barbearia', maxBolha: 350, maxBolhasModelo: 2 }
  });

  assert.match(prompt, /MODO RV \(RÉGUA VELOZ/i, 'Deve conter diretriz expressa de Régua Veloz (RV)');
  assert.match(prompt, /AGENDAMENTO EXPRESSO EM 2 TURNOS/i, 'Deve instruir agendamento expresso em 2 turnos');
  assert.match(prompt, /CONFIRMAÇÃO DE LEMBRETE EM 1 TURNO/i, 'Deve instruir confirmação de lembrete em 1 turno');
});
