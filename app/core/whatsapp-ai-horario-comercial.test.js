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
