import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanCustomerDisplayName } from './whatsapp-ai-normalize.js';
import { personaAppointmentMessage } from './whatsapp-ai-persona.js';
import { findOwnAppointment } from './whatsapp-ai-tools.js';
import { handoffIntent, parseWahaMessage } from './whatsapp-ai.js';

test('cleanCustomerDisplayName limpa anotações entre parênteses, tags e datas residuais', () => {
  assert.equal(cleanCustomerDisplayName('Juarez orsolin novo (dino)'), 'Juarez Orsolin');
  assert.equal(cleanCustomerDisplayName('Juarez orsolin novo (dino)', { firstNameOnly: true }), 'Juarez');
  assert.equal(cleanCustomerDisplayName('Renan trindade, hoje, sábado 31/10 às 17'), 'Renan Trindade');
  assert.equal(cleanCustomerDisplayName('Renan trindade, hoje, sábado 31/10 às 17', { firstNameOnly: true }), 'Renan');
  assert.equal(cleanCustomerDisplayName('Lead WhatsApp 2254'), '');
});

test('personaAppointmentMessage formata confirmacao_dia na voz amigável do T-Rex sem tom agressivo', () => {
  const persona = { id: 'trex', nome: 'T-Rex' };
  const msg = personaAppointmentMessage(persona, {
    evento: 'confirmacao_dia',
    nome: 'Juarez orsolin novo (dino)',
    servico: 'Corte',
    profissional: 'Dino',
    quando: 'às 9h',
    quandoRelativo: 'hoje',
    loja: 'Barbearia Dino',
  });

  assert.match(msg, /^Opa, Juarez!/);
  assert.match(msg, /Passando pra confirmar seu horário de hoje/);
  assert.match(msg, /Corte com Dino/);
  assert.match(msg, /CONFIRMO/);
  assert.match(msg, /REMARCAR/);
  assert.doesNotMatch(msg, /cancelado automaticamente/);
  assert.doesNotMatch(msg, /dino\)/i);
});

test('findOwnAppointment recupera agendamento único mesmo se cliente ou IA passar texto vago', () => {
  const agendamento = {
    id: 'age-12345',
    codigo: '5C3A19FA',
    cliente: 'Renan Trindade',
    servico: { nome: 'Barba' },
    profissional: { nome: 'João Victor' },
    status: 'confirmado',
    dataHora: '2026-10-31T21:45:00-04:00',
  };

  assert.equal(findOwnAppointment([agendamento], '').id, 'age-12345');
  assert.equal(findOwnAppointment([agendamento], '5C3A19FA').id, 'age-12345');
  assert.equal(findOwnAppointment([agendamento], 'Sim').id, 'age-12345');
  assert.equal(findOwnAppointment([agendamento], 'Barba').id, 'age-12345');
});

test('handoffIntent não dispara falso positivo em "qualquer pessoa" (profissional)', () => {
  assert.equal(handoffIntent('É a primeira vez que vou cortar com vocês meu amigo, por ser qualquer pessoa'), false);
  assert.equal(handoffIntent('pode ser qualquer pessoa'), false);
  assert.equal(handoffIntent('qualquer pessoa me atendendo ta bom'), false);
  assert.equal(handoffIntent('quero falar com um atendente'), true);
  assert.equal(handoffIntent('falar com humano'), true);
  assert.equal(handoffIntent('quero falar com uma pessoa de verdade'), true);
});

test('parseWahaMessage aceita mensagem direta 1:1 e extrai telefone quando grupo não está configurado', () => {
  const base = {
    event: 'message',
    session: 'barbearia-dino-gestao',
    payload: {
      id: { _serialized: 'WAHA-DIRECT-1' },
      from: '5514997462929@c.us',
      fromMe: false,
      body: 'Qual o faturamento de hoje?',
      pushName: 'Dino',
    },
  };
  const parsed = parseWahaMessage(base, { sessionName: 'barbearia-dino-gestao' });
  assert.equal(parsed.ignored, false);
  assert.equal(parsed.remoteJid, '5514997462929@c.us');
  assert.equal(parsed.phone, '5514997462929');
  assert.equal(parsed.name, 'Dino');
  assert.equal(parsed.text, 'Qual o faturamento de hoje?');
  assert.equal(parsed.fromMe, false);
});
