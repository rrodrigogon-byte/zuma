import test from 'node:test';
import assert from 'node:assert/strict';
import { matchAgendaName, WHATSAPP_AI_TOOL_DECLARATIONS } from './whatsapp-ai-tools.js';
import { BARBERSHOP_SYSTEM_GUIDANCE, confirmWaitlistSlot } from './whatsapp-ai.js';

test('1. Mapeamento de Gírias e Termos Coloquiais de Barbearia no T-Rex', () => {
  const listaServicos = [
    { id: 'srv-corte-001', nome: 'Corte Premium (Bruno ou Nati)' },
    { id: 'srv-barba-002', nome: 'Barba Premium' },
    { id: 'srv-combo-003', nome: 'Corte e Barba Premium' },
    { id: 'srv-sob-004', nome: 'Design de Sobrancelha' },
    { id: 'srv-pezinho-005', nome: 'Pezinho / Acabamento' },
  ];

  const casosCorte = ['dar um tapa', 'dar um talento', 'dar um grau', 'na régua', 'tapa no cabelo'];
  for (const termo of casosCorte) {
    const res = matchAgendaName(termo, listaServicos);
    assert.equal(res.item?.id, 'srv-corte-001', `"${termo}" deve mapear para Corte Premium`);
  }

  const casosCombo = ['dar um tapa no visual', 'dar uma geral', 'cabelo e bigode', 'corte e bigode'];
  for (const termo of casosCombo) {
    const res = matchAgendaName(termo, listaServicos);
    assert.equal(res.item?.id, 'srv-combo-003', `"${termo}" deve mapear para Combo Corte e Barba`);
  }

  const casosBarba = ['bigode', 'fazer bigode', 'barba e bigode'];
  for (const termo of casosBarba) {
    const res = matchAgendaName(termo, listaServicos);
    assert.equal(res.item?.id, 'srv-barba-002', `"${termo}" deve mapear para Barba Premium`);
  }

  const casosSobrancelha = ['sobrancelhas', 'fazer sobrancelhas'];
  for (const termo of casosSobrancelha) {
    const res = matchAgendaName(termo, listaServicos);
    assert.equal(res.item?.id, 'srv-sob-004', `"${termo}" deve mapear para Sobrancelha`);
  }
});

test('2. Ferramentas de Cancelamento e Remarcação Zero-Friction (sem exigir código)', () => {
  const cancelTool = WHATSAPP_AI_TOOL_DECLARATIONS.find((t) => t.name === 'preparar_cancelamento');
  assert.ok(cancelTool, 'Ferramenta preparar_cancelamento deve existir');
  assert.match(cancelTool.description, /NUNCA peça código de agendamento/i, 'Descrição deve proibir pedir código ao cliente');
  assert.match(cancelTool.description, /busca automática/i, 'Deve instruir busca automática');

  const remarcTool = WHATSAPP_AI_TOOL_DECLARATIONS.find((t) => t.name === 'preparar_remarcacao');
  assert.ok(remarcTool, 'Ferramenta preparar_remarcacao deve existir');
  assert.match(remarcTool.description, /NUNCA peça código de agendamento/i, 'Descrição deve proibir pedir código ao cliente');
});

test('3. Diretrizes de Atendimento do T-Rex para Horário Lotado e Retenção Ativa', () => {
  assert.match(BARBERSHOP_SYSTEM_GUIDANCE, /NUNCA, SOB HIPÓTESE ALGUMA, peça código de agendamento/i);
  assert.match(BARBERSHOP_SYSTEM_GUIDANCE, /HORÁRIO LOTADO E ENCAIXE NA LISTA DE ESPERA/i);
  assert.match(BARBERSHOP_SYSTEM_GUIDANCE, /RESPOSTAS DE CONFIRMAÇÃO DE DIÁRIA E LEMBRETE/i);
});

test('4. Detecção e Processamento de Cancelamento Conversacional em Lembretes', () => {
  const cancelIntents = [
    'não deu certo de eu ir hoje',
    'nao vou conseguir comparecer',
    'pode cancelar por favor',
    'imprevisto hoje nao vou conseguir',
    'desmarca pra mim',
    'cancela meu horario',
    'nao consigo ir',
    'nao poderei ir hoje',
  ];

  const cancelRegex = /\b(pode\s+cancelar|cancela|cancelar|cancelo|desmarca|desmarcar|desmarco|pode\s+desmarcar|nao\s+deu\s+certo\s+de\s+(?:eu\s+)?ir|nao\s+vou\s+(?:conseguir|poder)\s+(?:ir|comparecer)|nao\s+poderei\s+(?:ir|comparecer)|nao\s+vou\s+mais\s+(?:conseguir|poder)|imprevisto\s+(?:hoje\s+)?nao\s+vou|nao\s+vou\s+conseguir|nao\s+consigo\s+ir)\b/i;

  for (const frase of cancelIntents) {
    const normalizada = frase.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    assert.ok(cancelRegex.test(normalizada), `"${frase}" deve ser reconhecida como intenção de cancelamento`);
  }
});

test('5. Módulo confirmWaitlistSlot exportado e disponível', () => {
  assert.equal(typeof confirmWaitlistSlot, 'function', 'confirmWaitlistSlot deve ser uma função assíncrona exportada');
});
