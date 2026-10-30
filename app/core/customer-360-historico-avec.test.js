// A carteira do Clientes 360 passa a contar o histórico importado da Avec.
import test from 'node:test';
import assert from 'node:assert/strict';
import { localMetricsByClient } from './customer-360.js';

const clientes = [
  { id: 'c1', nome: 'Thiago', telefone: '(65) 99987-0866' },
  { id: 'c2', nome: 'Marcio', telefone: '64981000189' },
  { id: 'c3', nome: 'Sem histórico', telefone: '65911112222' },
];

test('histórico Avec: liga por id, por telefone completo e pelos 8 últimos dígitos; uma visita por dia', () => {
  const m = localMetricsByClient({
    clients: clientes,
    historicalAppointments: [
      { clienteId: 'c1', dataAgenda: '2025-06-05', hora: '10:00', valor: 100, status: 'concluido' },
      { clienteId: 'c1', dataAgenda: '2025-06-05', hora: '10:30', valor: 30, status: 'concluido' }, // mesmo dia: 1 visita
      { clienteTelefone: '65999870866', dataAgenda: '2025-07-01', valor: 50 },
      { clienteTelefone: '5564981000189', dataAgenda: '2025-08-10', valor: 45 },
      { clienteTelefone: '81000189', dataAgenda: '2025-09-10', valor: 45 }, // só 8 dígitos, único
      { clienteTelefone: '65900000000', dataAgenda: '2025-09-10', valor: 999 }, // ninguém
      { clienteId: 'c2', dataAgenda: '2025-10-01', valor: 70, status: 'cancelado' }, // não conta
    ],
  });
  assert.deepEqual([m.get('c1').visitas, m.get('c1').tickets, m.get('c1').receita], [2, 2, 180]);
  assert.deepEqual([m.get('c2').visitas, m.get('c2').receita], [2, 90]);
  assert.equal(m.get('c3').visitas, 0);
  assert.equal(new Date(m.get('c1').ultimaAtividade).toISOString().slice(0, 10), '2025-07-01');
});

test('8 últimos dígitos repetidos em dois cadastros não ligam a ninguém', () => {
  const m = localMetricsByClient({
    clients: [{ id: 'a', telefone: '65911112222' }, { id: 'b', telefone: '11911112222' }],
    historicalAppointments: [{ clienteTelefone: '11112222', dataAgenda: '2025-01-01', valor: 10 }],
  });
  assert.equal(m.get('a').visitas + m.get('b').visitas, 0);
});

test('sem histórico informado, o resultado é o mesmo de antes', () => {
  const m = localMetricsByClient({ clients: clientes });
  assert.deepEqual(m.get('c1'), { visitas: 0, faltas: 0, receita: 0, tickets: 0, aReceber: 0, pontos: 0, ultimaAtividade: 0, proximo: 0 });
});
