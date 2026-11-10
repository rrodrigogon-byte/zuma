// Confirmação natural: o cliente confirma do jeito que fala no WhatsApp,
// sem nunca confirmar por engano uma resposta com ressalva ou pergunta.
import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmIntent, resolveConfirmation, CONFIRMATION_HINT } from './whatsapp-ai-intents.js';

test('respostas naturais confirmam a ação pendente', () => {
  for (const texto of ['CONFIRMAR', 'sim', 'Sim!', 'simmmm', 'Pode marcar', 'pode sim, obrigado', 'fechado', 'Fechou 👊', 'beleza', 'blz', 'ok', 'OK pode', 'isso mesmo', 'Perfeito', 'tá ótimo', 'bora', 'quero sim', '👍', '👍🏽', '✅', 'sim por favor', 'Combinado!', 'ok fechado', 'sim, pode agendar']) {
    assert.equal(confirmIntent(texto), 'confirm', texto);
  }
});

test('negativas curtas cancelam a ação pendente', () => {
  for (const texto of ['CANCELAR', 'não', 'Nao', 'n', 'não obrigado', 'deixa pra lá', 'mudei de ideia', 'melhor não', '👎', '❌']) {
    assert.equal(confirmIntent(texto), 'cancel', texto);
  }
});

test('ressalva, pergunta, condição ou mensagem longa nunca confirmam: vão para o modelo', () => {
  for (const texto of [
    'sim, mas pode ser às 15h?',
    'pode ser com o Bruno?',
    'ok mas troca para sábado',
    'não, prefiro sábado',
    'sim se tiver vaga mais cedo',
    'qual o valor?',
    'sim quero marcar também a barba para o meu filho e para o meu irmão amanhã',
    'quanto fica',
    'pode ser outro horário',
    'valeu',
    '',
  ]) {
    assert.equal(confirmIntent(texto), null, texto);
  }
});

test('em ação de cancelamento, "pode cancelar" confirma e "cancelar" sozinho fica ambíguo', () => {
  assert.equal(confirmIntent('pode cancelar', { actionType: 'cancelamento' }), 'confirm');
  assert.equal(confirmIntent('cancela aí', { actionType: 'cancelamento' }), 'confirm');
  assert.equal(confirmIntent('sim', { actionType: 'cancelamento' }), 'confirm');
  assert.equal(confirmIntent('cancelar', { actionType: 'cancelamento' }), null);
  assert.equal(confirmIntent('não', { actionType: 'cancelamento' }), 'cancel');
  // fora de cancelamento, "pode cancelar" desiste da ação
  assert.equal(confirmIntent('pode cancelar', { actionType: 'agendamento' }), 'cancel');
});

test('a dica ao cliente usa SIM/NÃO', () => {
  assert.match(CONFIRMATION_HINT, /SIM/);
  assert.match(CONFIRMATION_HINT, /NÃO/);
});

test('resposta natural só vale logo após o pedido de confirmação; palavra explícita vale sempre', () => {
  const resumo = `Resumo para confirmar: Corte com Bruno amanhã às 15:00.\n${CONFIRMATION_HINT}`;
  const outraConversa = 'A barba completa custa R$ 40. Quer incluir?';
  assert.equal(resolveConfirmation('quero', { lastAssistantText: resumo }), 'confirm');
  // depois de outra pergunta do atendente, "quero"/"não" NÃO mexem na ação pendente
  assert.equal(resolveConfirmation('quero', { lastAssistantText: outraConversa }), null);
  assert.equal(resolveConfirmation('não', { lastAssistantText: outraConversa }), null);
  assert.equal(resolveConfirmation('ok', { actionType: 'cancelamento', lastAssistantText: 'Combinado, até amanhã!' }), null);
  // palavra explícita continua valendo como antes
  assert.equal(resolveConfirmation('CONFIRMAR', { lastAssistantText: outraConversa }), 'confirm');
  assert.equal(resolveConfirmation('cancelar', { lastAssistantText: outraConversa }), 'cancel');
  // num cancelamento de horário, "cancela" logo após o resumo confirma o cancelamento
  assert.equal(resolveConfirmation('cancela', { actionType: 'cancelamento', lastAssistantText: resumo }), 'confirm');
  assert.equal(resolveConfirmation('🙏', { lastAssistantText: resumo }), null);

  // Variações reais de assistente ("Confere aí", "Para confirmar, responda SIM ou NÃO", "Posso confirmar?")
  const resumoReal = 'Confere aí: Corte e barba com Dino para Rodrigo Goncalves, hoje, terça 27/10 às 18:45, no valor de R$ 600,00. Para confirmar, responda SIM ou NÃO.';
  assert.equal(resolveConfirmation('Sim', { lastAssistantText: resumoReal }), 'confirm');
  assert.equal(resolveConfirmation('pode marcar', { lastAssistantText: resumoReal }), 'confirm');
  assert.equal(resolveConfirmation('fechado', { lastAssistantText: resumoReal }), 'confirm');
  assert.equal(resolveConfirmation('bora', { lastAssistantText: resumoReal }), 'confirm');
  assert.equal(resolveConfirmation('Não', { lastAssistantText: resumoReal }), 'cancel');
});
