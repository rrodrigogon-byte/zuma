import test from 'node:test';
import assert from 'node:assert/strict';

import {
  detectAppOrSelfBookingRequest,
  buildAppAndBookingPromptReply,
  withSelfBookingAgendaOption,
  AGENDA_PUBLICA_DINO_BASE,
} from './whatsapp-ai-normalize.js';
import { personaSystemBlock, resolvePersona } from './whatsapp-ai-persona.js';
import { BARBERSHOP_SYSTEM_GUIDANCE, buildWhatsappAiSystemPrompt } from './whatsapp-ai.js';

test('1. Detecção de pedido de app do cliente e agendamento online', () => {
  const pedidosSemProfissional = [
    'vocês têm aplicativo?',
    'tem app?',
    'manda o app da barbearia',
    'qual o app do cliente?',
    'tem apk pra baixar?',
    'tem link de agendamento?',
    'me manda o link pra agendar',
    'tem algo para agendamento?',
    'tem algo pra agendar?',
    'site para agendar',
    'qual o site pra marcar horário?',
    'como faço para agendar pelo app?',
    'como posso agendar online?',
    'onde posso marcar pelo link?',
  ];

  for (const frase of pedidosSemProfissional) {
    const res = detectAppOrSelfBookingRequest(frase);
    assert.ok(res, `Deveria ter detectado pedido de app/agendamento na frase: "${frase}"`);
    assert.equal(res.isRequest, true);
    assert.equal(res.professional, null);
    assert.equal(res.link, AGENDA_PUBLICA_DINO_BASE);
  }
});

test('2. Detecção com profissional especificado na mensagem do cliente', () => {
  const reqBruno = detectAppOrSelfBookingRequest('tem app pra agendar com o Bruno?');
  assert.ok(reqBruno);
  assert.equal(reqBruno.professional, 'Bruno');
  assert.equal(reqBruno.link, `${AGENDA_PUBLICA_DINO_BASE}/bruno`);

  const reqNati = detectAppOrSelfBookingRequest('manda o link de agendamento da Nati');
  assert.ok(reqNati);
  assert.equal(reqNati.professional, 'Nati');
  assert.equal(reqNati.link, `${AGENDA_PUBLICA_DINO_BASE}/nati`);

  const reqDino = detectAppOrSelfBookingRequest('quero o app pra agendar com o Dino');
  assert.ok(reqDino);
  assert.equal(reqDino.professional, 'Dino');
  assert.equal(reqDino.link, `${AGENDA_PUBLICA_DINO_BASE}/dino`);
});

test('3. Não dispara falsos positivos em outras intenções (cancelamento, confirmação, horário avulso)', () => {
  const naoPedidos = [
    'quero cancelar meu horário',
    'desmarcar o corte de amanhã',
    'sim, confirmo minha presença',
    'pode ser às 15h com o Bruno',
    'bom dia, tudo bem?',
    'quanto custa o corte?',
    'onde vocês ficam localizados?',
  ];

  for (const frase of naoPedidos) {
    const res = detectAppOrSelfBookingRequest(frase);
    assert.equal(res, null, `Não deveria disparar pedido de app na frase: "${frase}"`);
  }
});

test('4. Geração de resposta padrão com link do app e solicitação do profissional', () => {
  const reqGeral = detectAppOrSelfBookingRequest('tem app pra agendar?');
  const respostaGeral = buildAppAndBookingPromptReply(reqGeral);

  // Link do app deve estar presente
  assert.match(respostaGeral, new RegExp(AGENDA_PUBLICA_DINO_BASE));
  // Deve pedir o profissional com quem deseja agendar (Dino, Bruno ou Nati)
  assert.match(respostaGeral, /profissional/i);
  assert.match(respostaGeral, /Bruno/i);
  assert.match(respostaGeral, /Nati/i);
  assert.match(respostaGeral, /Dino/i);

  const reqBruno = detectAppOrSelfBookingRequest('manda o app do Bruno');
  const respostaBruno = buildAppAndBookingPromptReply(reqBruno);
  assert.match(respostaBruno, new RegExp(`${AGENDA_PUBLICA_DINO_BASE}/bruno`));
  assert.match(respostaBruno, /Bruno/i);
});

test('5. withSelfBookingAgendaOption complementa com link e profissional quando necessário', () => {
  const userText = 'vocês tem algo para agendamento?';
  const rawReply = 'Olá! Temos sim.';
  const finalReply = withSelfBookingAgendaOption(rawReply, {
    userText,
    isBarbershop: true,
  });

  assert.match(finalReply, new RegExp(AGENDA_PUBLICA_DINO_BASE));
  assert.match(finalReply, /Dino, Bruno ou Nati/i);
});

test('6. Validação dos prompts do T-Rex e Barbershop Guidance', () => {
  assert.match(BARBERSHOP_SYSTEM_GUIDANCE, /SOLICITAÇÃO DE APP OU ALGO PARA AGENDAMENTO/i);
  assert.match(BARBERSHOP_SYSTEM_GUIDANCE, /Dino, Bruno ou Nati/i);
  assert.match(BARBERSHOP_SYSTEM_GUIDANCE, new RegExp(AGENDA_PUBLICA_DINO_BASE));

  const trexPersona = resolvePersona({ persona: { id: 'trex' } }, {});
  const trexPrompt = personaSystemBlock(trexPersona, 'Barbearia Dino');
  assert.match(trexPrompt, /QUANDO O CLIENTE PEDIR O APP OU ALGO PARA AGENDAMENTO/i);
  assert.match(trexPrompt, /Dino, Bruno ou Nati/i);
  assert.match(trexPrompt, new RegExp(AGENDA_PUBLICA_DINO_BASE));
});

test('7. buildWhatsappAiSystemPrompt inclui orientações do T-Rex para pedido de app e agendamento', () => {
  const trexPersona = resolvePersona({ persona: { id: 'trex' } }, {});
  const prompt = buildWhatsappAiSystemPrompt({
    storeName: 'Barbearia Dino',
    persona: trexPersona,
    segment: 'barbearia',
  });
  assert.match(prompt, /SOLICITAÇÃO DE APP OU ALGO PARA AGENDAMENTO/i);
  assert.match(prompt, /Dino, Bruno ou Nati/i);
  assert.match(prompt, new RegExp(AGENDA_PUBLICA_DINO_BASE));
});
