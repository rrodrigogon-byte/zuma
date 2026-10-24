import test from 'node:test';
import assert from 'node:assert/strict';
import { agendaHistoricaAvec, profissionalAtivoDoHistorico } from './dino-agenda-historica.js';

const profissionais = [
  { id: 'p-bruno', nome: 'Bruno' }, { id: 'p-natani', nome: 'Natani' }, { id: 'p-dino', nome: 'Dino' },
  { id: 'p-david', nome: 'David' }, { id: 'p-joao', nome: 'João' },
];

test('liga o nome completo do Avec ao profissional ativo sem confundir homônimos', () => {
  assert.equal(profissionalAtivoDoHistorico('Bruno Mendes pedroso', profissionais).id, 'p-bruno');
  assert.equal(profissionalAtivoDoHistorico('GUILHERME CUNHA MARTINS', profissionais).id, 'p-dino');
  assert.equal(profissionalAtivoDoHistorico('Joao Victor Domingos Ruedel', profissionais).id, 'p-joao');
  assert.equal(profissionalAtivoDoHistorico('Bruno Rafael dos Santos', profissionais), null, 'outro Bruno, ex-profissional');
  assert.equal(profissionalAtivoDoHistorico('Bruno Mendes pedroso', [...profissionais, { id: 'p-bruno-2', nome: 'Bruno' }]), null, 'ambíguo não liga');
});

test('agenda histórica usa a hora de fechamento só quando a comanda fechou no mesmo dia e filtra por profissional', () => {
  const historico = [
    { id: 'h1', dataAgenda: '2026-10-21', numeroComanda: '0100', clienteNome: 'Cliente A', servicoNome: 'Corte', profissionalId: 'hist-bruno', profissionalNome: 'Bruno Mendes pedroso', total: 50 },
    { id: 'h2', dataAgenda: '2026-10-21', numeroComanda: '0101', clienteNome: 'Cliente B', servicoNome: 'Barba', profissionalId: 'hist-natani', profissionalNome: 'Natani Minanis Dobler', total: 30 },
    { id: 'h3', dataAgenda: '2026-10-20', numeroComanda: '0090', clienteNome: 'Cliente C', servicoNome: 'Corte', profissionalId: 'hist-velho', profissionalNome: 'Vitor Muriel Silva Boy', total: 40 },
  ];
  const comandas = [
    { numeroComanda: '0100', dataComandaIso: '2026-10-21', dataFinalizacaoOriginal: '21/10/2026 17:42' },
    { numeroComanda: '0101', dataComandaIso: '2026-10-21', dataFinalizacaoOriginal: '23/10/2026 09:00' },
  ];
  const todos = agendaHistoricaAvec({ historico, comandas, profissionais });
  assert.deepEqual(todos.map((item) => [item.id, item.hora, item.profissionalId, item.profissionalNome]), [
    ['h3', '', 'hist-velho', 'Vitor Muriel Silva Boy'],
    ['h1', '17:42', 'p-bruno', 'Bruno'],
    ['h2', '', 'p-natani', 'Natani'],
  ]);
  assert.ok(todos.every((item) => item.historico && item.origem === 'avec' && item.status === 'concluido'));
  assert.deepEqual(agendaHistoricaAvec({ historico, comandas, profissionais, profissionalId: 'p-bruno' }).map((item) => item.id), ['h1']);
  assert.deepEqual(agendaHistoricaAvec({ historico, comandas, profissionais, profissionalId: 'hist-velho' }).map((item) => item.id), ['h3']);
});
