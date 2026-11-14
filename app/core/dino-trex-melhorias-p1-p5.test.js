import test from 'node:test';
import assert from 'node:assert/strict';
import { matchAgendaName } from './whatsapp-ai-tools.js';
import { gerarMensagemRecuperacaoTrex } from './dino-recuperacao-ativa.js';

test('1. Mapeamento Semântico: "Cabelo e barba" e variações devem mapear para Combo Corte e Barba', () => {
  const listaServicos = [
    { id: 'srv-corte-001', nome: 'Corte Premium (Bruno ou Nati)' },
    { id: 'srv-barba-002', nome: 'Barba Premium' },
    { id: 'srv-combo-003', nome: 'Corte e Barba Premium' },
    { id: 'srv-sob-004', nome: 'Design de Sobrancelha' },
  ];

  // Testar resolução direta por matchAgendaName
  const resCombo1 = matchAgendaName('cabelo e barba', listaServicos);
  assert.equal(resCombo1.item?.id, 'srv-combo-003', 'Deve encontrar o combo para "cabelo e barba"');

  const resCombo2 = matchAgendaName('corte e barba', listaServicos);
  assert.equal(resCombo2.item?.id, 'srv-combo-003', 'Deve encontrar o combo para "corte e barba"');

  const resCombo3 = matchAgendaName('combo', listaServicos);
  assert.equal(resCombo3.item?.id, 'srv-combo-003', 'Deve encontrar o combo para "combo"');

  const resCorte = matchAgendaName('cabelo', listaServicos);
  assert.equal(resCorte.item?.id, 'srv-corte-001', 'Deve encontrar o corte para "cabelo"');

  const resBarba = matchAgendaName('fazer barba', listaServicos);
  assert.equal(resBarba.item?.id, 'srv-barba-002', 'Deve encontrar barba para "fazer barba"');
});

test('2. Recuperação Ativa: Mensagem do T-Rex deve ser calorosa, conter benefícios e link da agenda', () => {
  const clienteMock = {
    nome: 'Helder Matias',
    telefone: '556596416600',
    dias_sem_visita: 68,
  };

  const msg = gerarMensagemRecuperacaoTrex(clienteMock);
  assert.match(msg, /Fala, Helder!/i, 'Deve saudar pelo primeiro nome');
  assert.match(msg, /T-Rex da Barbearia Dino/i, 'Deve apresentar a persona T-Rex');
  assert.match(msg, /faz mais de 68 dias/i, 'Deve citar o tempo de ausência');
  assert.match(msg, /café espresso gourmet ou uma cerveja artesanal/i, 'Deve conter o benefício de retorno');
  assert.match(msg, /https:\/\/kytto\.com\.br\/agendar\/dino/i, 'Deve incluir o link direto de agendamento');
});
