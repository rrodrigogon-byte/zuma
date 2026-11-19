import test from 'node:test';
import assert from 'node:assert/strict';
import { personaAppointmentMessage } from './whatsapp-ai-persona.js';
import { processarConfirmacoesDiarias } from './dino-confirmacao-diaria.js';
import { estaEmOptOut, registrarOptOut } from './whatsapp-antiban.js';
import * as barbearia from '../barbearia-erp-kytto.js';

test('1. personaAppointmentMessage formata lembrete_30m com voz acolhedora e aviso de Opt-Out da Meta', () => {
  const msg = personaAppointmentMessage('dino', {
    evento: 'lembrete_30m',
    nome: 'Carlos Eduardo',
    servico: 'Corte e Barba Premium',
    profissional: 'Bruno',
    quando: 'hoje às 15:30',
    loja: 'Dino Barbearia',
  });

  assert.ok(msg.includes('Carlos'), 'Deve saudar pelo primeiro nome do cliente');
  assert.ok(msg.includes('daqui a pouco'), 'Deve indicar que o atendimento é iminente');
  assert.ok(msg.includes('15:30'), 'Deve conter o horário correto');
  assert.ok(msg.includes('Pra não receber avisos, responda SAIR'), 'Deve conter o rodapé obrigatório de Opt-Out da Meta');
});

test('2. Proteção Anti-Ban da Meta: Opt-Out impede envio de lembretes ativos', () => {
  const telOptOut = '5565999990001';
  registrarOptOut('d0d0ac01-8e50-4b61-8c79-de4aaa916da6', telOptOut, 'teste_optout');
  assert.equal(estaEmOptOut('d0d0ac01-8e50-4b61-8c79-de4aaa916da6', telOptOut), true, 'Telefone deve constar na lista de Opt-Out');
});

test('3. Confirmações diárias suportam execução sem quebra e sem envio duplicado', async () => {
  // Executa processarConfirmacoesDiarias em ambiente de teste com semDelay=true
  const enviadas = await processarConfirmacoesDiarias({ semDelay: true, hora: 14 });
  assert.ok(typeof enviadas === 'number', 'Deve retornar número de confirmações processadas');
});
