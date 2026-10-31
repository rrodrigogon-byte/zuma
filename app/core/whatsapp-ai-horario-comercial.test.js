import test from 'node:test';
import assert from 'node:assert/strict';
import { earliestSlots, priorizarHorarioComercial } from './whatsapp-ai-tools.js';
import { packBubbles } from './whatsapp-ai-style.js';

// Agenda 24x7 do Dino: começa à meia-noite e vai até 23h45.
const AGENDA_24H = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`);

test('sem período pedido, o horário comercial vem antes da noite e da madrugada', () => {
  const ordem = priorizarHorarioComercial(['00:00', '00:15', '19:00', '09:00', '14:30', '05:45']);
  assert.deepEqual(ordem, ['09:00', '14:30', '19:00', '00:00', '00:15', '05:45']);
});

test('earliestSlots não oferece meia-noite para quem só pediu o dia (30/10)', async () => {
  const result = await earliestSlots({ fetchDay: async () => ({ slots: AGENDA_24H }), fromDate: '2026-11-03', days: 1, limit: 3 });
  assert.deepEqual(result.slots.map((s) => s.time), ['06:00', '06:15', '06:30']);
});

test('"de manhã" é 6h às 12h e "madrugada" é 0h às 6h', async () => {
  const manha = await earliestSlots({ fetchDay: async () => ({ slots: AGENDA_24H }), fromDate: '2026-11-03', days: 1, limit: 2, period: 'manha' });
  assert.deepEqual(manha.slots.map((s) => s.time), ['06:00', '06:15']);
  const madrugada = await earliestSlots({ fetchDay: async () => ({ slots: AGENDA_24H }), fromDate: '2026-11-03', days: 1, limit: 2, period: 'madrugada' });
  assert.deepEqual(madrugada.slots.map((s) => s.time), ['00:00', '00:15']);
});

test('dia só com madrugada livre ainda oferece a madrugada', async () => {
  const result = await earliestSlots({ fetchDay: async () => ({ slots: ['01:00', '02:00'] }), fromDate: '2026-11-03', days: 1, limit: 3 });
  assert.deepEqual(result.slots.map((s) => s.time), ['01:00', '02:00']);
});

test('uma frase com a lista de horários não é partida em duas bolhas', () => {
  const frase = 'Beleza! Para "Corte e Barba" com o Dino no dia 03/11, tenho esses horários disponíveis, todos por R$ 300: terça 03/11 às 9h, terça 03/11 às 9h15 ou terça 03/11 às 9h30.';
  const bolhas = packBubbles(frase, { max: 192, maxBubbles: 2 });
  assert.ok(bolhas.every((b) => !/disponíveis,$/.test(b)), JSON.stringify(bolhas));
  assert.ok(bolhas.some((b) => b.includes('às 9h, terça 03/11 às 9h15 ou terça 03/11 às 9h30')));
});

test('horário extra do Dino só depois das 18h09 ou antes das 6h, mesmo quando o combo custa R$ 600', async () => {
  const { horarioExtraDoDino } = await import('./whatsapp-ai-tools.js');
  const combo = { nome: 'Corte e barba com Dino', preco: 600 };
  assert.equal(horarioExtraDoDino(combo, null, '06:00'), false);
  assert.equal(horarioExtraDoDino(combo, null, '18:15'), true);
  assert.equal(horarioExtraDoDino(combo, null, '05:45'), true);
  assert.equal(horarioExtraDoDino({ nome: 'Corte', preco: 45 }, { nome: 'Bruno' }, '19:00'), false);
});

test('cancelar/remarcar acha o agendamento pelo código da confirmação ou pelo único horário futuro', async () => {
  const { findOwnAppointment } = await import('./whatsapp-ai-tools.js');
  const ag = [{ id: 'age-mvvi7z17-1801', codigo: '5D0FDE32', status: 'agendado' }];
  assert.equal(findOwnAppointment(ag, '5D0FDE32')?.id, 'age-mvvi7z17-1801');
  assert.equal(findOwnAppointment(ag, '5d0fde32')?.id, 'age-mvvi7z17-1801');
  assert.equal(findOwnAppointment(ag, 'age-mvvi7z17-1801')?.id, 'age-mvvi7z17-1801');
  assert.equal(findOwnAppointment(ag, '')?.id, 'age-mvvi7z17-1801', 'único horário futuro');
  const dois = [...ag, { id: 'age-x', codigo: 'AAAA1111', status: 'agendado' }];
  assert.equal(findOwnAppointment(dois, ''), null, 'com dois horários pergunta qual');
  assert.equal(findOwnAppointment(dois, 'AAAA1111')?.id, 'age-x');
  assert.equal(findOwnAppointment([{ id: 'c', codigo: 'X1', status: 'cancelado' }], 'X1'), null);
});

test('horário de funcionamento sai do expediente da equipe, sem o Dino 24x7', async () => {
  const { horarioFuncionamentoTexto } = await import('./whatsapp-ai-tools.js');
  const equipe = [
    { nome: 'Bruno', diasTrabalho: [1, 2, 3, 4, 5, 6], horarioInicio: '06:00', horarioFim: '21:00' },
    { nome: 'Nati', diasTrabalho: [1, 2, 3, 4, 5, 6], horarioInicio: '08:00', horarioFim: '19:00' },
    { nome: 'Dino', atendimento24x7: true, diasTrabalho: [0, 1, 2, 3, 4, 5, 6], horarioInicio: '00:00', horarioFim: '23:59' },
  ];
  assert.equal(horarioFuncionamentoTexto(equipe), 'segunda a sábado, das 6h às 21h; domingo: fechado');
  assert.equal(horarioFuncionamentoTexto([{ nome: 'Dino', atendimento24x7: true }]), '');
});

test('"NÃO, era só teste. Quero ver os perfumes" desiste; "não, prefiro às 15h" ajusta', async () => {
  const { declineWithNewRequest } = await import('./whatsapp-ai-intents.js');
  assert.equal(declineWithNewRequest('NÃO, era só teste. Quero ver os perfumes que vocês têm'), true);
  assert.equal(declineWithNewRequest('não, deixa pra lá. tem perfume da Dior?'), true);
  assert.equal(declineWithNewRequest('não, prefiro às 15h'), false);
  assert.equal(declineWithNewRequest('não, com o Bruno'), false);
  assert.equal(declineWithNewRequest('não, amanhã de manhã'), false);
  assert.equal(declineWithNewRequest('não'), false, '"não" sozinho já é tratado pela confirmação');
  assert.equal(declineWithNewRequest('sim, pode marcar'), false);
});

test('preparar_cancelamento_pedido está declarada para o modelo', async () => {
  const { WHATSAPP_AI_TOOL_DECLARATIONS } = await import('./whatsapp-ai-tools.js');
  const tool = WHATSAPP_AI_TOOL_DECLARATIONS.find((item) => item.name === 'preparar_cancelamento_pedido');
  assert.ok(tool);
  assert.match(tool.description, /aguarda pagamento/);
});
