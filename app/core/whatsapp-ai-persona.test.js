import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isPersonaGreeting,
  mergeIntroduction,
  personaAppointmentMessage,
  personaConfirmationFailure,
  personaConfirmationReply,
  personaFixedText,
  personaGreeting,
  personaIntroduction,
  personaRobotAnswer,
  personaRobotQuestion,
  personaSystemBlock,
  personaView,
  pick,
  quandoCurto,
  resolvePersona,
  sanitizePersonaInput,
  STICKERS,
} from './whatsapp-ai-persona.js';

test('persona: canal manda, ambiente só dá o padrão', () => {
  assert.equal(resolvePersona({}, {}), null);
  assert.equal(resolvePersona({}, { WHATSAPP_AI_PERSONA: 'trex' }).nome, 'T-Rex');
  assert.equal(resolvePersona({ persona: { id: 'trex', ativo: false } }, { WHATSAPP_AI_PERSONA: 'trex' }), null, 'desligada no canal vence o ambiente');
  assert.equal(resolvePersona({ persona: { id: 'trex', nome: 'Rex' } }, {}).nome, 'Rex');
  assert.equal(resolvePersona({}, { WHATSAPP_AI_PERSONA: 'off' }), null);
  assert.equal(resolvePersona({}, { WHATSAPP_AI_PERSONA: 'desconhecida' }), null);
  const padrao = resolvePersona({}, { WHATSAPP_AI_PERSONA: 'trex' });
  assert.equal(padrao.maxBolha, 120);
  assert.equal(padrao.revelarIa, 'quando_perguntado');
});

test('persona: entrada do painel é validada', () => {
  assert.throws(() => sanitizePersonaInput({ id: 'outra' }), /persona desconhecida/);
  assert.throws(() => sanitizePersonaInput({ nome: 'Dino' }), /barbeiro master/);
  assert.throws(() => sanitizePersonaInput({ nome: '<script>' }), /nome do atendente inválido/);
  assert.deepEqual(sanitizePersonaInput({ nome: 'T-Rex', figurinhas: false, revelarIa: 'qualquer' }), {
    id: 'trex', ativo: true, nome: 'T-Rex', mensagensCurtas: true, figurinhas: false, revelarIa: 'quando_perguntado',
  });
  const view = personaView({ persona: { id: 'trex', nome: 'T-Rex' } }, {});
  assert.equal(view.ativa, true);
  assert.equal(view.origem, 'canal');
  assert.equal(view.figurinhasDisponiveis.length, Object.keys(STICKERS).length);
});

test('persona: escolha determinística (reenvio gera o mesmo texto)', () => {
  const op = ['a', 'b', 'c'];
  assert.equal(pick(op, 'evt-1'), pick(op, 'evt-1'));
  const usados = new Set(Array.from({ length: 30 }, (_, i) => pick(op, `evt-${i}`)));
  assert.equal(usados.size, 3, 'varia entre mensagens diferentes');
});

test('persona: saudação curta, com o período quando o cliente diz', () => {
  const p = resolvePersona({}, { WHATSAPP_AI_PERSONA: 'trex' });
  const tarde = personaGreeting(p, { text: 'Oi, boa tarde', seed: 'x' });
  assert.match(tarde, /boa tarde/i);
  assert.ok(tarde.length <= 120);
  assert.doesNotMatch(tarde, /assistente virtual/i);
  for (let i = 0; i < 20; i += 1) assert.ok(personaGreeting(p, { text: 'oi', seed: `s${i}` }).length <= 120);
});

test('persona: saudação ampla sem pedido', () => {
  for (const t of ['Oi, bom dia', 'olá, tudo bem?', 'E aí, beleza', 'boa noite', 'Opa', 'oii']) assert.equal(isPersonaGreeting(t), true, t);
  for (const t of ['oi, quero cortar', 'bom dia, tem horário?', 'oi '.repeat(30)]) assert.equal(isPersonaGreeting(t), false, t);
});

test('persona: apresentação entra depois da saudação', () => {
  const p = resolvePersona({}, { WHATSAPP_AI_PERSONA: 'trex' });
  const intro = personaIntroduction(p, 'Barbearia Dino');
  assert.equal(intro, 'Aqui é o T-Rex, da Barbearia Dino.');
  assert.equal(mergeIntroduction(intro, 'Opa, boa tarde! Quer marcar um horário?'), 'Opa, boa tarde! Aqui é o T-Rex, da Barbearia Dino. Quer marcar um horário?');
  assert.equal(mergeIntroduction(intro, 'Corte masculino sai R$ 45.'), 'Opa! Aqui é o T-Rex, da Barbearia Dino. Corte masculino sai R$ 45.');
  assert.match(mergeIntroduction(intro, 'x'.repeat(150)), /^Opa! Aqui é o T-Rex, da Barbearia Dino\.\n\nx/);
  const revela = resolvePersona({ persona: { id: 'trex', revelarIa: 'na_apresentacao' } }, {});
  assert.match(personaIntroduction(revela, 'Barbearia Dino'), /assistente digital/);
});

test('persona: "vc é robô?" é detectado e respondido com a verdade', () => {
  for (const t of ['vc é robô?', 'é bot?', 'isso é IA?', 'to falando com robo', 'você é humano?', 'é uma pessoa de verdade?', 'é robo']) {
    assert.equal(personaRobotQuestion(t), true, t);
  }
  for (const t of ['quero falar com um humano', 'me chama uma pessoa', 'quero cortar o cabelo', 'tem horário amanhã?', 'a barba de verdade ficou boa']) {
    assert.equal(personaRobotQuestion(t), false, t);
  }
  const p = resolvePersona({}, { WHATSAPP_AI_PERSONA: 'trex' });
  for (let i = 0; i < 6; i += 1) {
    const r = personaRobotAnswer(p, 'Barbearia Dino', `s${i}`);
    assert.match(r, /assistente/);
    assert.match(r, /equipe/);
    assert.doesNotMatch(r, /\b(não sou|sou humano|sou uma pessoa)\b/i, 'nunca nega ser assistente');
  }
});

test('persona: confirmação curta com os 4 dados e o código', () => {
  const p = resolvePersona({}, { WHATSAPP_AI_PERSONA: 'trex' });
  const r = personaConfirmationReply(p, { type: 'agendamento', result: { servico: 'Corte Masculino', profissional: 'Bruno', dataAgenda: '2026-10-10', horaLocal: '09:00', codigo: 'AG12' } }, 'e1');
  assert.match(r, /Corte Masculino com Bruno, sáb 10\/10 às 9h\. Código AG12\./);
  assert.ok(r.length <= 120, r);
  assert.equal(quandoCurto({ dataAgenda: '2026-10-08', horaLocal: '17:30' }), 'qui 8/10 às 17h30');
  assert.equal(quandoCurto({ dataHora: '2026-10-10T13:00:00.000Z' }), 'sáb 10/10 às 9h');
  assert.match(personaConfirmationFailure('SLOT_UNAVAILABLE'), /acabou de sair/);
  const pedido = personaConfirmationReply(p, { type: 'pedido', result: { publicCode: 'PD9', total: 389 } }, 'e2');
  assert.match(pedido, /PD9.*R\$ 389,00/);
});

test('persona: textos fixos trocam o tom, não a ação', () => {
  const p = resolvePersona({}, { WHATSAPP_AI_PERSONA: 'trex' });
  assert.equal(personaFixedText(null, 'handoff', 'original'), 'original');
  assert.equal(personaFixedText(p, 'tipo_desconhecido', 'original'), 'original');
  assert.match(personaFixedText(p, 'handoff', 'x', { storeName: 'Barbearia Dino', seed: 'a' }), /equipe da Barbearia Dino/);
  for (const kind of ['opt_out', 'handoff', 'sensitive_handoff', 'gemini_fallback', 'confusion_handoff', 'personalization_granted']) {
    const texto = personaFixedText(p, kind, 'x', { storeName: 'Barbearia Dino', seed: kind });
    assert.doesNotMatch(texto, /assistente virtual|Fico à disposição|Prezado/i, kind);
  }
  assert.match(personaFixedText(p, 'personalization_granted', 'x'), /NÃO PERSONALIZAR/, 'mantém o comando de revogação');
});

test('persona: prompt traz as regras duras e a honestidade', () => {
  const p = resolvePersona({}, { WHATSAPP_AI_PERSONA: 'trex' });
  const bloco = personaSystemBlock(p, 'Barbearia Dino');
  assert.match(bloco, /Você é o T-Rex/);
  assert.match(bloco, /até 120 caracteres/);
  assert.match(bloco, /Nunca negue ser assistente/);
  assert.match(bloco, /Nunca se chame de "Dino"/);
  assert.match(bloco, /enviar_figurinha/);
  const semFig = personaSystemBlock({ ...p, figurinhas: false }, 'Barbearia Dino');
  assert.doesNotMatch(semFig, /enviar_figurinha/);
});

test('persona: lembrete de 24 h curto, com os mesmos comandos', () => {
  const p = resolvePersona({}, { WHATSAPP_AI_PERSONA: 'trex' });
  const msg = personaAppointmentMessage(p, { evento: 'lembrete', nome: 'João Silva', servico: 'Corte Masculino', profissional: 'Bruno', quando: 'sáb 10/10 às 9h', quandoRelativo: 'amanhã' });
  assert.equal(msg, 'Opa, João! Passando pra lembrar: amanhã, sáb 10/10 às 9h, Corte Masculino com Bruno. Responda CONFIRMO, REMARCAR ou CANCELO. Pra não receber avisos, responda SAIR.');
  for (const evento of ['remarcado', 'cancelado', 'criado']) assert.match(personaAppointmentMessage(p, { evento, nome: 'Ana', servico: 'S', profissional: 'P', quando: 'q', quandoRelativo: 'amanhã', loja: 'Barbearia Dino' }), /SAIR/);
});
