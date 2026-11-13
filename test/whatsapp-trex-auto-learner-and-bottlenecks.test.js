import test from 'node:test';
import assert from 'node:assert/strict';

import {
  findOwnAppointment,
  priorizarHorarioComercial,
  earliestSlots,
  isGenericCustomerName,
  localDateIso
} from '../app/core/whatsapp-ai-tools.js';

import {
  presenceConfirmIntent,
  isArrivalIntent,
  buildWhatsappAiSystemPrompt
} from '../app/core/whatsapp-ai.js';

import {
  auditDailySessions,
  recordLearningProposal,
  autoApproveHighConfidenceLearnings,
  getDynamicLearnedGuidance
} from '../app/core/trex-auto-learner.js';

test('Gargalo 1: Remarcação focal resiliente após lembrete (elimina loop APPOINTMENT_AMBIGUOUS)', () => {
  const agendamentos = [
    {
      id: 'age-001',
      dataAgenda: '2026-11-13',
      horaLocal: '11:00',
      dataHora: '2026-11-13T11:00:00Z',
      status: 'confirmado',
      servico: { id: 'srv-corte', nome: 'Corte Feminino' },
      profissional: { id: 'prof-nati', nome: 'Nati' }
    },
    {
      id: 'age-002',
      dataAgenda: '2026-11-13',
      horaLocal: '13:15',
      dataHora: '2026-11-13T13:15:00Z',
      status: 'confirmado',
      servico: { id: 'srv-dino', nome: 'Corte com Dino' },
      profissional: { id: 'prof-dino', nome: 'Dino' }
    }
  ];

  // Caso A: Cliente responde "Remarca" após lembrete da sessão
  const remarcadoLembrete = findOwnAppointment(agendamentos, '', 'Remarca', {
    lastReminderAppointmentId: 'age-002',
    lastAssistantText: 'Dino Barbearia passando pra lembrar do seu horário de Corte com Dino hoje às 13:15.'
  });
  assert.equal(remarcadoLembrete?.id, 'age-002');
  assert.equal(remarcadoLembrete?.profissional?.nome, 'Dino');

  // Caso B: Cliente pede "no mesmo horário 13:15" ou cita o horário
  const remarcadoPorHora = findOwnAppointment(agendamentos, '', 'Pode deixar pra sexta que vem no mesmo horário 13:15');
  assert.equal(remarcadoPorHora?.id, 'age-002');
  assert.equal(remarcadoPorHora?.horaLocal, '13:15');

  // Caso C: Cliente cita o profissional "Dino"
  const remarcadoPorProf = findOwnAppointment(agendamentos, '', 'Quero mudar o do Dino');
  assert.equal(remarcadoPorProf?.id, 'age-002');
});

test('Gargalo 2: Filtro anti-madrugada (< 07h30) e priorização comercial normal (08h00 - 18h30)', async () => {
  const slots = ['06:00', '06:30', '07:00', '08:30', '09:00', '14:00', '19:30'];

  // Priorização comercial deve colocar horários padrão diurnos antes de 06:00
  const priorizados = priorizarHorarioComercial(slots);
  assert.ok(priorizados.indexOf('08:30') < priorizados.indexOf('06:00'));
  assert.ok(priorizados.indexOf('09:00') < priorizados.indexOf('06:00'));
  assert.ok(priorizados.indexOf('14:00') < priorizados.indexOf('06:00'));

  // earliestSlots com period: 'qualquer' deve filtrar slots de madrugada se houver comercial
  const fetchMock = async (date) => ({ slots: ['06:00', '06:30', '08:30', '10:00'] });
  const result = await earliestSlots({
    fetchDay: fetchMock,
    fromDate: '2026-11-16',
    period: 'qualquer',
    limit: 2
  });

  assert.equal(result.slots.length, 2);
  assert.equal(result.slots[0].time, '08:30');
  assert.equal(result.slots[1].time, '10:00');
  // 06:00 não deve ser oferecido
  assert.ok(!result.slots.some((s) => s.time === '06:00'));
});

test('Gargalo 3: Blindagem temporal anti-alucinação no system prompt do T-Rex', () => {
  const prompt = buildWhatsappAiSystemPrompt({
    storeName: 'Barbearia Dino',
    persona: { id: 'trex', nome: 'T-Rex' }
  });

  // O prompt deve conter a âncora de data e hora atual explícita
  assert.match(prompt, /DATA E HORA ATUAL:/);
  assert.match(prompt, /Toda referência a "hoje", "amanhã" ou "semana que vem" parte OBRIGATORIAMENTE desta data!/);
  assert.match(prompt, /NUNCA alucine meses passados como julho/);
});

test('Gargalo 4: Resolução resiliente de serviços e blindagem de erro de código', () => {
  const prompt = buildWhatsappAiSystemPrompt({
    storeName: 'Barbearia Dino',
    persona: { id: 'trex', nome: 'T-Rex' }
  });

  assert.match(prompt, /RESOLUÇÃO RESILIENTE DE SERVIÇOS/);
  assert.match(prompt, /Combo Corte \+ Barba/);
  assert.match(prompt, /NUNCA diga que o código do serviço não foi encontrado/);
});

test('Gargalo 5: Separação estrita entre chegada ("Tô chegando") e confirmação futura', () => {
  const frasesChegada = ['Tô chegando', 'to a caminho', 'chegando', 'ja to aqui', '2 min', 'dois minutos', 'estou na porta'];
  const frasesConfirmacao = ['confirmo', 'sim confirmo', 'pode confirmar', 'confirmadissimo', 'com certeza'];

  for (const f of frasesChegada) {
    assert.equal(isArrivalIntent(f), true, `Deveria ser chegada: ${f}`);
    assert.equal(presenceConfirmIntent(f), false, `NÃO deveria ser confirmação futura de presença: ${f}`);
  }

  for (const f of frasesConfirmacao) {
    assert.equal(presenceConfirmIntent(f), true, `Deveria ser confirmação: ${f}`);
  }
});

test('Gargalo 6: Eliminação de perguntas redundantes de nome quando já cadastrado', () => {
  assert.equal(isGenericCustomerName('Lucas Mineiro'), false);
  assert.equal(isGenericCustomerName('Rodrigo Gonçalves'), false);
  assert.equal(isGenericCustomerName('Cliente'), true);
  assert.equal(isGenericCustomerName('Contato'), true);
  assert.equal(isGenericCustomerName('5565999056008'), true);
});

test('Auto-Learner: Auditoria, propostas de aprendizado e injeção dinâmica de diretrizes', async () => {
  const empresaId = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';

  // Mock do DB para simular auditoria e registro de propostas
  const mockRows = [];
  const mockQuery = async (sql, params) => {
    if (sql.includes('SELECT s.id, s.telefone')) {
      return {
        rows: [
          { id: 'sess-1', telefone: '5565999990001', nome: 'Cliente 1', status: 'ativo', assigned_to: null, total_mensagens: 4 },
          { id: 'sess-2', telefone: '5565999990002', nome: 'Cliente 2', status: 'humano', assigned_to: 'user-1', total_mensagens: 6 }
        ]
      };
    }
    if (sql.includes('SELECT papel, conteudo')) {
      return { rows: [{ papel: 'user', conteudo: 'Qual deles você quer remarcar? Não entendi' }] };
    }
    if (sql.includes('INSERT INTO ai_learning_proposals')) {
      mockRows.push({ tipo: params[1], chave: params[2], titulo: params[3], proposta: params[4], status: params[5], ocorrencias: 2 });
      return { rows: [] };
    }
    if (sql.includes('SELECT tipo, titulo, proposta FROM ai_learning_proposals')) {
      return {
        rows: [
          { tipo: 'faq', titulo: 'Remarcação após lembrete', proposta: 'Vincular diretamente ao agendamento lembrado.' },
          { tipo: 'objecao', titulo: 'Horário das 6h da manhã', proposta: 'Nunca sugerir horário de madrugada sem pedido expresso.' }
        ]
      };
    }
    return { rows: [] };
  };

  const auditoria = await auditDailySessions({ empresaId, dia: '2026-11-13', query: mockQuery });
  assert.equal(auditoria.totalSessoes, 2);
  assert.equal(auditoria.totalMensagens, 10);
  assert.equal(auditoria.sessoesAutonomas, 1);
  assert.equal(auditoria.sessoesHandoff, 1);
  assert.equal(auditoria.taxaSucessoAutonomo, 50.0);
  assert.equal(auditoria.taxaHandoff, 50.0);

  const diretrizes = await getDynamicLearnedGuidance(empresaId, { query: mockQuery });
  assert.match(diretrizes, /DIRETRIZES E RESPOSTAS AUTO-APRENDIDAS/);
  assert.match(diretrizes, /Remarcação após lembrete/);
  assert.match(diretrizes, /Horário das 6h da manhã/);
});
