import test from 'node:test';
import assert from 'node:assert/strict';
import * as barbearia from './barbearia-erp-kytto.js';
import { DINO_EMPRESA_CANONICA, provisionarEquipeDino } from './dino-equipe-seed.js';
import { presenceConfirmIntent, confirmNextAppointment } from './core/whatsapp-ai.js';
import { findOwnAppointment } from './core/whatsapp-ai-tools.js';

test('presenceConfirmIntent deve reconhecer todas as variações de confirmação dos prints', () => {
  const casosValidos = [
    'Confirmo',
    'confirmando',
    'Pode confirmar',
    'Confirmado',
    'sim',
    'ok',
    'fechado',
    'fechou',
    'perfeito',
    'beleza',
    'blz',
    'show',
    '👍',
    'certo',
    'marcado',
    'ta marcado',
    'confirmo presença',
    'pode confirmar obrigado',
  ];

  for (const caso of casosValidos) {
    assert.equal(presenceConfirmIntent(caso), true, `Deveria reconhecer como confirmação: "${caso}"`);
  }
});

test('findOwnAppointment deve selecionar o agendamento mais próximo quando há múltiplos agendamentos', () => {
  const ag1 = { id: 'ag-1', dataHora: '2026-11-07T08:00:00-04:00', status: 'agendado', servico: { nome: 'Corte Club' } };
  const ag2 = { id: 'ag-2', dataHora: '2026-11-07T11:00:00-04:00', status: 'agendado', servico: { nome: 'Barba' } };

  // Sem ref, deve pegar o primeiro cronológico (ag1)
  const selecionado = findOwnAppointment([ag2, ag1]);
  assert.equal(selecionado.id, 'ag-1', 'Deveria selecionar o agendamento mais próximo (ag-1)');
});

test('confirmNextAppointment deve confirmar presença na barbearia e retornar mensagem calorosa', async () => {
  const telefone = '65999009988'; // Telefone único para teste isolado
  const empresaId = DINO_EMPRESA_CANONICA;
  const lojaId = '00000000-0000-4000-8000-000000000001';
  const canalId = '00000000-0000-4000-8000-000000000003';
  const sessionId = '00000000-0000-4000-8000-000000000002';

  // Garante sementes da Dino
  provisionarEquipeDino(empresaId);

  // Garante serviço ativo
  let servicos = barbearia.listarServicos(empresaId, {});
  if (!servicos.length) {
    barbearia.salvarServico(empresaId, {
      id: 'srv-corte-teste',
      nome: 'Corte Premium',
      preco: 100,
      duracaoMinutos: 45,
      ativo: true,
    });
    servicos = barbearia.listarServicos(empresaId, {});
  }
  const profs = barbearia.listarProfissionais(empresaId, {});
  let prof = profs.find(p => /dino/i.test(p.nome)) || profs[0];

  const servicoId = servicos[0]?.id;
  const profissionalId = prof.id;

  // Cria um agendamento futuro com permitirEncaixe
  const amanha = new Date(Date.now() + 24 * 3600 * 1000);
  const dataStr = amanha.toISOString().split('T')[0];

  const ag = barbearia.criarAgendamento(empresaId, {
    clienteNome: 'Luiz Júnior',
    clienteTelefone: telefone,
    servicoId,
    profissionalId,
    dataHora: `${dataStr}T10:00:00-04:00`,
    dataAgenda: dataStr,
    horaLocal: '10:00',
    status: 'agendado',
    ignorarHorario: true,
    lojaId,
    origem: 'whatsapp_ia',
  }, { permitirEncaixe: true });

  assert.equal(ag.status, 'agendado');

  const context = {
    empresaId,
    lojaId,
    canalId,
    sessionId,
    phone: telefone,
    customerName: 'Luiz Júnior',
    session: {
      id: sessionId,
      empresa_id: empresaId,
      loja_id: lojaId,
      canal_id: canalId,
      estado: { ultimoAgendamentoLembradoId: ag.id },
    },
  };

  const resultado = await confirmNextAppointment(context);
  assert.ok(resultado, 'Deveria retornar resultado de confirmação');
  assert.equal(resultado.kind, 'presence_confirmed');
  assert.match(resultado.text, /Confirmado.*Luiz/i);
  assert.match(resultado.text, /Te esperamos na Dino Barbearia/i);

  // Verifica se o status foi alterado para confirmado no ERP
  const agAtualizado = barbearia.listarAgendamentos(empresaId, { incluirInativos: true }).find(a => a.id === ag.id);
  assert.equal(agAtualizado.status, 'confirmado');
  assert.match(agAtualizado.observacoes, /Presença confirmada pelo cliente no WhatsApp/);

  // Segunda chamada (idempotente/já confirmado)
  const resultado2 = await confirmNextAppointment(context);
  assert.ok(resultado2, 'Deveria responder idempotentemente para agendamento já confirmado');
  assert.match(resultado2.text, /Tudo certo.*Luiz.*já está 100% confirmado/i);
});
