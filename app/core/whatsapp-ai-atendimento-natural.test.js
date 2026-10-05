// Correções do teste real de 05/10 na Dino: nome "Cliente", Markdown cru no WhatsApp,
// resumo repetido, confirmação perdida quando o cliente mudou de assunto e prazo curto.
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatForWhatsapp, formatActionSummary, isGenericCustomerName, actionTtlMinutes, CONFIRMATION_HINT } from './whatsapp-ai-intents.js';
import { composeReplyWithNewAction, withPendingReminder, PENDING_REMINDER_HINT } from './whatsapp-ai.js';
import { resolveConfirmation } from './whatsapp-ai-intents.js';
import { followUpText } from './whatsapp-ai-followup.js';

test('nome genérico nunca vira nome de cliente', () => {
  for (const nome of ['Cliente', 'cliente', ' CLIENTE ', 'Contato', '', '5565999990000', '.', 'cliente 2', 'Usuário']) {
    assert.equal(isGenericCustomerName(nome), true, nome);
  }
  for (const nome of ['Rodrigo', 'Ana Paula', 'Léo', 'João Pedro']) assert.equal(isGenericCustomerName(nome), false, nome);
});

test('Markdown do modelo vira formatação do WhatsApp (sem "**SIM*" nem asterisco solto)', () => {
  assert.equal(formatForWhatsapp('Se sim, me diga **SIM* para confirmar.'), 'Se sim, me diga *SIM* para confirmar.');
  assert.equal(
    formatForWhatsapp('Encontrei na *segunda-feira, 5 de outubro: *   **10:00* *   *10:30* *   *11:00* Qual desses?'),
    'Encontrei na segunda-feira, 5 de outubro:\n• *10:00*\n• *10:30*\n• *11:00* Qual desses?',
  );
  assert.equal(formatForWhatsapp('### Planos\n* VIP\n- Básico'), '*Planos*\n• VIP\n• Básico');
  assert.equal(formatForWhatsapp('Veja [aqui](https://dino.kytto.com.br/agendar)'), 'Veja aqui: https://dino.kytto.com.br/agendar');
  assert.equal(formatForWhatsapp('Tudo certo, *Rafael*!'), 'Tudo certo, *Rafael*!');
});

test('resumo de vários serviços sai em linhas', () => {
  const resumo = formatActionSummary('hoje, segunda 05/10 às 17:00 para Rodrigo: Corte Masculino com Dino às 17:00 + Barba Completa às 17:30 + Manicure às 18:00, total R$ 185,00');
  assert.equal(resumo, 'hoje, segunda 05/10 às 17:00 para Rodrigo:\n• Corte Masculino com Dino às 17:00\n• Barba Completa às 17:30\n• Manicure às 18:00\nTotal: R$ 185,00');
  assert.equal(formatActionSummary('Corte com Bruno amanhã às 15:00.'), 'Corte com Bruno amanhã às 15:00');
});

test('ação nova: o texto do modelo que repete o resumo vira só uma abertura', () => {
  const pending = { actionId: 'a1', type: 'agendamento', summary: 'hoje às 17:00 para Rodrigo: Corte com Dino às 17:00 + Barba às 17:30, total R$ 85,00' };
  const texto = composeReplyWithNewAction('Perfeito! Seu agendamento para *hoje às 17:00* está preparado. Responda **SIM* ou CONFIRMAR.', pending);
  assert.match(texto, /^Perfeito! Confere pra mim:\n\nResumo para confirmar: hoje às 17:00 para Rodrigo:\n• Corte com Dino às 17:00\n• Barba às 17:30\nTotal: R\$ 85,00\n/);
  assert.equal(texto.match(/SIM/g).length, 1);
  // texto útil que não repete o resumo é mantido
  assert.match(composeReplyWithNewAction('A barba fica com o Léo, que faz esse serviço.', pending), /^A barba fica com o Léo/);
});

test('cliente mudou de assunto com resumo pendente: responde e lembra a confirmação', () => {
  const pending = { actionId: 'a1', type: 'agendamento', mostrado: true, preparadoEm: new Date().toISOString(), summary: 'hoje às 17:00 para Rodrigo: Corte com Dino às 17:00' };
  const texto = withPendingReminder('Temos o Plano VIP por R$ 150,00 por mês.', pending);
  assert.match(texto, /^Temos o Plano VIP/);
  assert.match(texto, /seu agendamento ainda está esperando sua confirmação: hoje às 17:00 para Rodrigo: Corte com Dino às 17:00/);
  assert.ok(texto.endsWith(PENDING_REMINDER_HINT));
  // um "quero"/"sim" depois do lembrete NÃO confirma (pode estar respondendo outra pergunta); CONFIRMAR confirma
  assert.equal(resolveConfirmation('quero', { lastAssistantText: texto }), null);
  // "sim" curto logo após o lembrete confirma, se a parte de cima não fez outra pergunta (caso real de 05/10)
  assert.equal(resolveConfirmation('sim', { lastAssistantText: texto }), 'confirm');
  const comPergunta = withPendingReminder('Quer incluir a barba?', pending);
  assert.equal(resolveConfirmation('sim', { lastAssistantText: comPergunta }), null);
  assert.equal(resolveConfirmation('CONFIRMAR', { lastAssistantText: texto }), 'confirm');
  assert.equal(resolveConfirmation('desistir', { lastAssistantText: texto }), 'cancel');
  // não duplica quando já pediu SIM, nem lembra ação vencida ou ainda não mostrada
  assert.equal(withPendingReminder(`ok\n${CONFIRMATION_HINT}`, pending), `ok\n${CONFIRMATION_HINT}`);
  assert.equal(withPendingReminder('oi', { ...pending, preparadoEm: new Date(Date.now() - 6 * 3600e3).toISOString() }), 'oi');
  assert.equal(withPendingReminder('oi', { ...pending, mostrado: false }), 'oi');
});

test('prazo da confirmação padrão 120 min e configurável', () => {
  const antes = process.env.WHATSAPP_AI_ACTION_TTL_MIN;
  delete process.env.WHATSAPP_AI_ACTION_TTL_MIN;
  assert.equal(actionTtlMinutes(), 120);
  process.env.WHATSAPP_AI_ACTION_TTL_MIN = '45';
  assert.equal(actionTtlMinutes(), 45);
  process.env.WHATSAPP_AI_ACTION_TTL_MIN = '1';
  assert.equal(actionTtlMinutes(), 15);
  if (antes === undefined) delete process.env.WHATSAPP_AI_ACTION_TTL_MIN; else process.env.WHATSAPP_AI_ACTION_TTL_MIN = antes;
});

test('toque de confirmação nunca diz "Oi, Cliente!"', () => {
  const texto = followUpText({ nome: 'Cliente', nome_na_acao: 'Cliente', acao_pendente: { summary: 'Corte com Dino às 17:00' } });
  assert.match(texto, /^Oi! Ficou faltando/);
  assert.match(followUpText({ nome: 'Cliente', nome_na_acao: 'Rodrigo', acao_pendente: { summary: 'Corte' } }), /^Oi, Rodrigo!/);
});

test('com resumo pendente, o modelo não pode dizer que já confirmou', async () => {
  const { claimsCompletion } = await import('./whatsapp-ai.js');
  for (const t of ['Que ótimo! Seu pedido do Dior está confirmado para retirada.', 'Pronto, horário agendado!', 'Seu agendamento foi marcado.', 'Pedido confirmado!']) assert.equal(claimsCompletion(t), true, t);
  for (const t of ['Temos 3 horários amanhã.', 'Quer confirmar?', 'O Dior custa R$ 1.800,00.']) assert.equal(claimsCompletion(t), false, t);
});
