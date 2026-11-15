import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchAgendaName, findOwnAppointment, earliestSlots } from './core/whatsapp-ai-tools.js';
import { verificarStatusBarbeiroDino, BARBEIROS_ATIVOS_DINO } from './core/barbershop-agenda.js';
import { confirmIntent, resolveConfirmation, declineWithNewRequest } from './core/whatsapp-ai-intents.js';
import { serviceWithProfessional, extractFastScheduleChoice } from './core/whatsapp-ai-normalize.js';

test('Auditoria 112 Conversas Fila — 1. Resolução de corte-masculino e Corte cabelo masculino (Conversa #100)', () => {
  const servicos = [
    { id: 'srv-1', nome: 'CORTE PREMIUM', preco: 100 },
    { id: 'srv-2', nome: 'BARBA PREMIUM', preco: 100 },
    { id: 'srv-3', nome: 'CORTE E BARBA PREMIUM', preco: 200 },
    { id: 'srv-4', nome: 'Dermaplaning', preco: 60 },
    { id: 'srv-5', nome: 'Depilação Masculina - Nariz', preco: 35 },
  ];

  assert.equal(matchAgendaName('corte-masculino', servicos).item?.id, 'srv-1');
  assert.equal(matchAgendaName('Corte cabelo masculino', servicos).item?.id, 'srv-1');
  assert.equal(matchAgendaName('corte de cabelo', servicos).item?.id, 'srv-1');
  assert.equal(matchAgendaName('cortar o cabelo', servicos).item?.id, 'srv-1');
  assert.equal(matchAgendaName('barba masculina', servicos).item?.id, 'srv-2');
});

test('Auditoria 112 Conversas Fila — 2. Somente Dino, Bruno e Nati são barbeiros ativos (Conversas #4, #7, #13, #18)', () => {
  assert.equal(BARBEIROS_ATIVOS_DINO.length, 3);
  const idsAtivos = BARBEIROS_ATIVOS_DINO.map((b) => b.id).sort();
  assert.deepEqual(idsAtivos, ['bruno', 'dino', 'nati']);

  for (const ex of ['João Victor', 'Joao', 'David', 'David Kauã', 'Amanda', 'Lucas', 'Gustavo']) {
    const status = verificarStatusBarbeiroDino(ex);
    assert.equal(status.ativo, false, `${ex} deve estar inativo`);
    assert.equal(status.exBarbeiro, true, `${ex} deve ser exBarbeiro`);
  }
});

test('Auditoria 112 Conversas Fila — 3. Destravamento de acao_pendente em Dermaplaning e confirmações naturais (Conversas #7 e #9)', () => {
  // Conversa #7 (Maneco): "Eu não quero dermaplaning meu Deus" e "Não dermaplaning"
  assert.equal(confirmIntent('Eu não quero dermaplaning meu Deus'), 'cancel');
  assert.equal(confirmIntent('Não dermaplaning'), 'cancel');
  assert.equal(declineWithNewRequest('Eu quero o corte com o Bruno', 'Dermaplaning com Ester para Maneco'), true);

  // Conversa #9 (Juliany): "Ok. Deixa agendado aí. Se abrir uma vaga antes das 18:00 você me fala"
  assert.equal(confirmIntent('Ok. Deixa agendado aí. Se abrir uma vaga antes das 18:00 você me fala'), 'confirm');
  assert.equal(confirmIntent('Pode deixar marcado obrigado'), 'confirm');
});

test('Auditoria 112 Conversas Fila — 4. Caso Fernanda (#71): desambiguação de CORTE PREMIUM (BRUNO OU NATI) quando escolhe Bruno', () => {
  assert.equal(serviceWithProfessional('CORTE PREMIUM (BRUNO OU NATI)', 'Bruno'), 'CORTE PREMIUM com Bruno');
  assert.equal(serviceWithProfessional('CORTE PREMIUM (BRUNO OU NATI)', 'Nati'), 'CORTE PREMIUM com Nati');
  assert.equal(serviceWithProfessional('CORTE PREMIUM (BRUNO OU NATI)', 'Bruno ou Nati'), 'CORTE PREMIUM (BRUNO OU NATI)');
  assert.equal(serviceWithProfessional('Corte com Bruno ou Nati', 'Nati'), 'Corte com Bruno ou Nati');
});

test('Auditoria 112 Conversas Fila — 5. Confirmações coloquiais ("o sim", "sim, agendar") e escolha de 1ª opção / horário único (#25, #42, #112)', () => {
  assert.equal(confirmIntent('o sim'), 'confirm');
  assert.equal(confirmIntent('ô sim'), 'confirm');
  assert.equal(confirmIntent('sim, agendar'), 'confirm');
  assert.equal(resolveConfirmation('sim, agendar', { lastAssistantText: 'Qual desses fica melhor para os dois?' }), 'confirm');
  assert.equal(resolveConfirmation('sim', { lastAssistantText: 'Quinta-feira, 12/11, às 10h15, por R$ 100. É um corte, certo? Posso agendar pra você?' }), 'confirm');

  const singleChoice = extractFastScheduleChoice(
    'sim',
    'Fechado, Flávio! Quinta-feira, 12/11, às 10h15, por R$ 100. É um corte, certo? Posso agendar pra você?',
    { now: new Date('2026-11-11T12:00:00Z') }
  );
  assert.equal(singleChoice?.horario, '10:15');
  assert.equal(singleChoice?.data, '2026-11-12');

  const firstOption = extractFastScheduleChoice(
    'O primeiro',
    'Fala, Pedro Henrique! Qual dos horários com o Dino você prefere que eu marque? Hoje, 11/11, às 20h00 ou 20h15?',
    { now: new Date('2026-11-11T12:00:00Z') }
  );
  assert.equal(firstOption?.horario, '20:00');
  assert.equal(firstOption?.profissional, 'Dino');
});

test('Auditoria 112 Conversas Fila — 6. Catálogo completo (Desondulação/Selagem, Limpeza de Pele, Detox) e busca por dia da semana (#74, Rodrigo #9139)', () => {
  const servicos = [
    { id: 'srv-corte', nome: 'CORTE PREMIUM', preco: 100 },
    { id: 'srv-selagem', nome: 'Desondulação (Selagem)', preco: 150 },
    { id: 'srv-limpeza', nome: 'Limpeza de Pele', preco: 60 },
    { id: 'srv-detox', nome: 'Detox Capilar', preco: 50 },
  ];
  assert.equal(matchAgendaName('desondulação', servicos).item?.id, 'srv-selagem');
  assert.equal(matchAgendaName('selagem', servicos).item?.id, 'srv-selagem');
  assert.equal(matchAgendaName('progressiva', servicos).item?.id, 'srv-selagem');
  assert.equal(matchAgendaName('limpeza de pele', servicos).item?.id, 'srv-limpeza');

  const agendamentos = [
    { id: 'ag-quarta', dataAgenda: '2026-11-11', dataHora: '2026-11-11T18:00:00-04:00', status: 'agendado', servico: { nome: 'Corte Club' }, profissional: { nome: 'Dino' } },
    { id: 'ag-sexta', dataAgenda: '2026-11-13', dataHora: '2026-11-13T15:30:00-04:00', status: 'agendado', servico: { nome: 'Desondulação (Selagem)' }, profissional: { nome: 'Bruno' } },
  ];
  const achadoSexta = findOwnAppointment(agendamentos, '', 'Quero cancelar meu horário de sexta');
  assert.equal(achadoSexta?.id, 'ag-sexta');
});

test('Auditoria 112 Conversas Fila — 7. Caso Pablo Selle (#8): remarcação antes das 17:00 na quinta preserva dia e filtra notAfter', async () => {
  const agendamentos = [
    { id: 'ag-seg', dataAgenda: '2026-11-09', dataHora: '2026-11-09T17:00:00-04:00', status: 'confirmado', servico: { id: 'srv-barba', nome: 'BARBA PREMIUM' }, profissional: { id: 'prof-bruno', nome: 'Bruno' } },
    { id: 'ag-qui', dataAgenda: '2026-11-12', dataHora: '2026-11-12T17:30:00-04:00', status: 'agendado', servico: { id: 'srv-barba', nome: 'BARBA PREMIUM' }, profissional: { id: 'prof-bruno', nome: 'Bruno' } },
  ];
  const achadoQuinta = findOwnAppointment(agendamentos, '', 'Tenho um horário com o Bruno na quinta 17:00, preciso que mantenha na quinta mais cedo, antes das 17:00');
  assert.equal(achadoQuinta?.id, 'ag-qui');

  const res = await earliestSlots({
    fetchDay: async (date) => ({
      slots: date === '2026-11-12' ? ['10:45', '11:00', '14:00', '17:30', '18:00'] : ['15:30'],
      professional: { nome: 'Bruno' },
    }),
    fromDate: '2026-11-12',
    days: 2,
    limit: 3,
    notAfter: '17:00',
  });
  assert.deepEqual(res.slots.map((s) => `${s.date} ${s.time}`), [
    '2026-11-12 10:45',
    '2026-11-12 11:00',
    '2026-11-12 14:00',
  ]);
});

test('Auditoria 112 Conversas Fila — 8. Remarcação adjacente no mesmo dia ignora o próprio agendamento antigo (ignorarAgendamentoId)', async () => {
  const barbearia = await import('./barbearia-erp-kytto.js');
  const empId = 'emp-teste-remarcacao-adjacente';
  barbearia.estadoEmpresa(empId, true);
  const prof = barbearia.criarProfissional(empId, { nome: 'Bruno Teste', apelido: 'Bruno', ativo: true, atendeCliente: true });
  const srvExistente = barbearia.listarServicos(empId).find((s) => /corte premium/i.test(s.nome));
  const srv = srvExistente || barbearia.criarServico(empId, { nome: 'CORTE REMARCACAO ADJACENTE', preco: 100, duracaoMinutos: 40, ativo: true, permiteAgendamentoOnline: true, profissionaisIds: [prof.id] });
  const estado = barbearia.estadoEmpresa(empId);
  if (estado.servicos[srv.id]) {
    estado.servicos[srv.id].profissionaisIds = [prof.id];
    estado.servicos[srv.id].permiteAgendamentoOnline = true;
  }
  assert.ok(prof && srv);
  const dataFutura = new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10);
  const ag = barbearia.criarAgendamento(empId, {
    clienteNome: 'Yuk Andrade',
    clienteTelefone: '556599990377',
    profissionalId: prof.id,
    servicoId: srv.id,
    dataAgenda: dataFutura,
    horaLocal: '16:00',
    dataHora: `${dataFutura}T16:00:00-04:00`,
  });
  // Sem ignorarAgendamentoId, 16:15 conflita com o agendamento de 16:00; com ignorarAgendamentoId, fica livre!
  const livreComIgnore = barbearia.resolverProfissionalDisponivel(empId, {
    data: dataFutura,
    horario: '16:15',
    servicoId: srv.id,
    profissionalId: prof.id,
    ignorarAgendamentoId: ag.id,
  });
  assert.equal(livreComIgnore.horaLocal, '16:15');
});
