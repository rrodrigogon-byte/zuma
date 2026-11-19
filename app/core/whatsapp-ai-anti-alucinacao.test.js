import assert from 'node:assert/strict';
import test from 'node:test';
import { isGenericCustomerName } from './whatsapp-ai-intents.js';
import { cleanCustomerDisplayName } from './whatsapp-ai-normalize.js';
import { splitBubbles } from './whatsapp-ai-style.js';
import { withPendingReminder } from './whatsapp-ai.js';
import { perfilDoTelefone } from '../dino-captacao-kytto.js';

test('anti-alucinacao: nomes com profissão ou genéricos (Eng Civil, Advogado, Lead) são tratados como genéricos', () => {
  assert.equal(isGenericCustomerName('Eng Civil'), true);
  assert.equal(isGenericCustomerName('eng'), true);
  assert.equal(isGenericCustomerName('Engenheiro'), true);
  assert.equal(isGenericCustomerName('Advogado'), true);
  assert.equal(isGenericCustomerName('Lead WhatsApp 123'), true);
  assert.equal(isGenericCustomerName('Cliente'), true);
  assert.equal(isGenericCustomerName('Rodrigo'), false);
  assert.equal(isGenericCustomerName('Juliany Cordeiro'), false);
  assert.equal(cleanCustomerDisplayName('Eng Civil', { firstNameOnly: true }), '');
});

test('anti-alucinacao: perfil sem visitas não inventa período habitual de madrugada', () => {
  const perfil = perfilDoTelefone('d0d0ac01-8e50-4b61-8c79-de4aaa916da6', '5599999999999');
  assert.equal(perfil.padraoCliente.visitasTotais, 0);
  assert.equal(perfil.padraoCliente.periodoPreferido, null);
  assert.equal(perfil.padraoCliente.profissionalPreferido, null);
});

test('anti-alucinacao: splitBubbles não divide saudações curtas nem perguntas finais em bolhas soltas', () => {
  const texto = 'Show de bola, Rodrigo!\n\nPra fazer a barba com o João Victor hoje, quarta 04/11, as últimas opções são: às 15h30 por R$ 80, às 15h45 por R$ 80 ou às 16h por R$ 80.\n\nQual desses horários te atende melhor?';
  const bolhas = splitBubbles(texto, { max: 260 });
  // Deve agrupar em 1 ou no máximo 2 bolhas coesas, sem soltar "Show de bola, Rodrigo!" em uma bolha de 22 caracteres
  assert.ok(bolhas.length <= 2, `bolhas geradas: ${bolhas.length}`);
  assert.ok(bolhas[0].includes('Show de bola, Rodrigo!'));
  assert.ok(bolhas[bolhas.length - 1].includes('Qual desses horários te atende melhor?'));
});

test('anti-alucinacao: withPendingReminder não duplica aviso de confirmação se já presente no texto', () => {
  const pending = {
    actionId: 'act-123',
    mostrado: true,
    summary: 'CORTE PREMIUM com Nati às 19:00',
    type: 'agendamento'
  };
  const textoComAviso = 'Seu agendamento ainda está esperando sua confirmação: CORTE PREMIUM para Juliany às 19h.';
  const resultado = withPendingReminder(textoComAviso, pending);
  assert.equal(resultado, textoComAviso);
});

test('anti-alucinacao: regex remove justificativas espurias de teste em agendamentos', () => {
  const textoOriginal = 'Ah, desculpe a confusão! O agendamento que te passei foi um teste. Para o dia 26/11 às 17h30 com a Nati, quais serviços você gostaria de agendar?';
  const sanitizado = textoOriginal.replace(/\b(o\s+agendamento\s+que\s+te\s+passei\s+foi\s+um\s+teste\.?|foi\s+(um\s+)?teste\.?|era\s+(um\s+)?teste\.?|apenas\s+um\s+teste\.?|somente\s+um\s+teste\.?)\s*/gi, '').trim();
  assert.ok(sanitizado.includes('Para o dia 26/11 às 17h30 com a Nati'));
});
