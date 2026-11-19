import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularBuracosAgendaDino,
  executarBloqueioBuraco,
  executarEncaixeRapidoBuraco,
  obterHojeCuiaba,
} from './dino-buracos-agenda-engine.js';

test('1. Buracos de Agenda: NUNCA retorna datas passadas e sempre mostra de HOJE para FRENTE', () => {
  const hoje = '2026-11-19'; // Quinta-feira
  const estado = {
    profissionais: {
      'prof-bruno': { id: 'prof-bruno', nome: 'Bruno Mendes', ativo: true },
      'prof-dino': { id: 'prof-dino', nome: 'Dino', ativo: true },
      'prof-nati': { id: 'prof-nati', nome: 'Nati', ativo: true },
    },
    agendamentos: {
      'ag-01': { dataAgenda: '2026-11-19', horaLocal: '09:00', profissionalId: 'prof-bruno', status: 'agendado' }
    },
    bloqueios: {}
  };

  const baseClientes = [
    { key: 'cli-01', nome: 'Lucas Alencar', telefone: '5565999887766', barbeiroNomeExibicao: 'Bruno', diasSemVir: 25 },
    { key: 'cli-02', nome: 'Fernando Silva', telefone: '5565999112233', barbeiroNomeExibicao: 'Dino', diasSemVir: 30 },
  ];

  const buracos = calcularBuracosAgendaDino({
    estado,
    hoje,
    baseClientes,
    diasAFrente: 7,
    limiteVagas: 20,
  });

  assert.ok(buracos.length > 0, 'Deve gerar lista de buracos');

  // Nenhuma data pode ser anterior a hoje (2026-11-19)
  for (const b of buracos) {
    assert.ok(b.data >= hoje, `Data ${b.data} deve ser maior ou igual a hoje (${hoje})`);
    assert.ok(b.data !== '2026-11-09', 'NUNCA deve conter o dia 09/11 (passado)');
    assert.ok(b.horario, 'Deve ter horário');
    assert.ok(b.profissional, 'Deve ter profissional');
    assert.ok(b.linkAgendamento.startsWith('https://kytto.com.br/agendar/dino'), 'Deve ter link de agendamento');
  }

  // O slot das 09:00 do Bruno em 2026-11-19 estava ocupado no mock, logo NÃO pode aparecer como buraco
  const slotOcupadoBruno = buracos.find(b => b.data === '2026-11-19' && b.horario === '09:00' && b.profissional === 'Bruno');
  assert.equal(slotOcupadoBruno, undefined, 'Slot ocupado não pode ser listado como buraco');

  // Match inteligente de cliente
  const buracoBruno = buracos.find(b => b.profissional === 'Bruno' && b.clienteSugerido);
  assert.ok(buracoBruno, 'Deve encontrar cliente sugerido para o Bruno');
  assert.equal(buracoBruno.clienteSugerido.nome, 'Lucas Alencar');
});

test('2. Ações Operacionais: Bloquear buraco e Fazer Encaixe Rápido na Barbearia Dino', () => {
  const empresaId = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';

  // 1. Testar bloqueio de buraco
  const resBloqueio = executarBloqueioBuraco(empresaId, {
    profissionalId: 'prof-mwf821h5-005', // Dino
    data: '2026-11-20',
    horario: '14:00',
    motivo: 'Ausência médica à tarde',
  });

  assert.equal(resBloqueio.ok, true);
  assert.ok(resBloqueio.bloqueio?.id);

  // 2. Testar encaixe rápido (tabela do profissional Dino auto-calculada para 300)
  const resEncaixe = executarEncaixeRapidoBuraco(empresaId, {
    profissionalId: 'prof-mwf821h5-005', // Dino
    data: '2026-11-20',
    horario: '15:30',
    clienteNome: 'Rodrigo Ribeiro Gonçalves',
    clienteTelefone: '5514997462929',
    servicoId: 'srv-dino-corte-001',
  });

  assert.equal(resEncaixe.ok, true);
  assert.ok(resEncaixe.agendamento?.id);
  assert.equal(resEncaixe.agendamento.clienteNome, 'Rodrigo Ribeiro Gonçalves');
  assert.equal(resEncaixe.agendamento.valor, 300);
});
