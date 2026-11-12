import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mensagem,
  gerarLinkGoogleAgenda,
  formatarTicketDinoBloco,
} from './barbershop-appointment-notifications.js';

test('gerarLinkGoogleAgenda cria link funcional com datas e parâmetros corretos', () => {
  const link = gerarLinkGoogleAgenda({
    titulo: 'Barba & Corte — Dino',
    inicioIso: '2026-11-14T08:00:00.000Z',
    duracaoMinutos: 60,
    detalhes: 'Agendamento com Nati',
    localizacao: 'Rua Avelina Jaci Bohn, 80W — Centro',
  });
  assert.ok(link.includes('calendar.google.com/calendar/render'));
  assert.ok(link.includes('action=TEMPLATE'));
  assert.ok(link.includes('dates=20261114T080000Z') && link.includes('20261114T090000Z'));
  assert.ok(link.includes(encodeURIComponent('Rua Avelina Jaci Bohn, 80W — Centro')));
});

test('formatarTicketDinoBloco gera card estilizado com divisores, emojis e atalhos', () => {
  const ticket = formatarTicketDinoBloco({
    tituloTicket: 'TICKET DIGITAL DE AGENDAMENTO',
    servico: 'BARBA PREMIUM & CORTE',
    profissional: 'Nati',
    quando: 'Sábado, 14/11 às 08:00',
    inicioIso: '2026-11-14T08:00:00.000Z',
    duracaoMinutos: 60,
    preco: 100,
  });

  assert.ok(ticket.includes('━━━━━━━━━━━━━━━━━━━━━━'));
  assert.ok(ticket.includes('🎫 *TICKET DIGITAL DE AGENDAMENTO*'));
  assert.ok(ticket.includes('💈 *Serviço:* BARBA PREMIUM & CORTE'));
  assert.ok(ticket.includes('✂ *Profissional:* Nati'));
  assert.ok(ticket.includes('📅 *Data & Horário:* Sábado, 14/11 às 08:00'));
  assert.ok(ticket.includes('📍 *Localização:* Rua Avelina Jaci Bohn, 80W — Centro'));
  assert.ok(ticket.includes('💰 *Valor:* R$ 100,00'));
  assert.ok(ticket.includes('calendar.google.com'));
  assert.ok(ticket.includes('https://kytto.com.br/minha/dino'));
});

test('mensagem evento criado e confirmacao_dia inclui o Ticket Digital Premium', () => {
  const snapshot = {
    servicos: [{ id: 's1', nome: 'Barba Premium & Corte' }],
    profissionais: [{ id: 'p1', nome: 'Nati' }],
    configuracao: { nomePublico: 'Dino Barbearia' },
  };
  const agendamento = {
    id: 'ag-test-1',
    servicoId: 's1',
    profissionalId: 'p1',
    dataHora: '2026-11-14T08:00:00.000Z',
    preco: 100,
  };
  const cliente = { nome: 'Rodrigo Gonçalves' };

  const msgCriado = mensagem(snapshot, agendamento, cliente, 'criado');
  assert.ok(msgCriado.includes('TICKET DIGITAL DE AGENDAMENTO'));
  assert.ok(msgCriado.includes('Barba Premium & Corte'));
  assert.ok(msgCriado.includes('Nati'));
  assert.ok(msgCriado.includes('Rua Avelina Jaci Bohn, 80W — Centro'));
  assert.ok(msgCriado.includes('calendar.google.com'));
  assert.ok(msgCriado.includes('https://kytto.com.br/minha/dino'));

  const msgConfirmacao = mensagem(snapshot, agendamento, cliente, 'confirmacao_dia');
  assert.ok(msgConfirmacao.includes('CONFIRMAÇÃO DE ATENDIMENTO — HOJE'));
  assert.ok(msgConfirmacao.includes('Responda CONFIRMO para confirmar sua presença'));
  assert.ok(msgConfirmacao.includes('https://kytto.com.br/minha/dino'));
});
