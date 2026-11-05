import test from 'node:test';
import assert from 'node:assert/strict';
import * as barbearia from './barbearia-erp-kytto.js';
import { createAppointment as createScheduledAppointment, availability as agendaAvailability } from './core/barbershop-agenda.js';

test('Duração de serviços no catálogo e agendamento da Barbearia Dino / IA T-Rex', async (t) => {
  const EMPRESA = 'test-emp-duracao-' + Date.now();
  const LOJA = 'loja-duracao-' + Date.now();

  // 1. Cadastrar serviços com durações reais do catálogo
  const srvCorte = barbearia.criarServico(EMPRESA, {
    nome: 'Corte com Dino',
    duracaoMinutos: 40,
    preco: 300,
  });
  const srvBarba = barbearia.criarServico(EMPRESA, {
    nome: 'Barba com Dino',
    duracaoMinutos: 30,
    preco: 300,
  });
  const srvCombo = barbearia.criarServico(EMPRESA, {
    nome: 'Corte e barba com Dino',
    duracaoMinutos: 60,
    preco: 600,
  });
  const srvSelagem = barbearia.criarServico(EMPRESA, {
    nome: 'Selagem',
    duracaoMinutos: 45,
    preco: 120,
  });
  const srvProtese = barbearia.criarServico(EMPRESA, {
    nome: 'Prótese Capilar',
    duracaoMinutos: 90,
    preco: 150,
  });

  // 2. Cadastrar profissional Dino e Nati
  const profDino = barbearia.criarProfissional(EMPRESA, {
    nome: 'Guilherme Cunha Martins (Dino)',
    apelido: 'Dino',
    atendimento24x7: true,
    horarioInicio: '00:00',
    horarioFim: '23:59',
    diasTrabalho: [0, 1, 2, 3, 4, 5, 6],
  });

  const profNati = barbearia.criarProfissional(EMPRESA, {
    nome: 'Natani Minanis Dobler',
    apelido: 'Nati',
    horarioInicio: '08:00',
    horarioFim: '20:00',
    diasTrabalho: [0, 1, 2, 3, 4, 5, 6],
  });

  const config = barbearia.obterConfiguracao(EMPRESA);

  await t.test('1. duracaoAtendimentoProfissional reflete rigorosamente a duração de cada serviço no catálogo', () => {
    assert.equal(barbearia.duracaoAtendimentoProfissional(srvCorte, profDino, config), 40, 'Corte com Dino deve durar 40 min');
    assert.equal(barbearia.duracaoAtendimentoProfissional(srvBarba, profDino, config), 30, 'Barba com Dino deve durar 30 min');
    assert.equal(barbearia.duracaoAtendimentoProfissional(srvCombo, profDino, config), 60, 'Combo Corte e Barba deve durar 60 min');
    assert.equal(barbearia.duracaoAtendimentoProfissional(srvSelagem, profNati, config), 45, 'Selagem deve durar 45 min');
    assert.equal(barbearia.duracaoAtendimentoProfissional(srvProtese, profNati, config), 90, 'Prótese Capilar deve durar 90 min');
  });

  await t.test('2. Agendamento criado pelo ERP grava duracaoMinutos exata do serviço', () => {
    const dataAgenda = new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10);
    const agendamento = barbearia.criarAgendamento(EMPRESA, {
      clienteNome: 'Cliente Teste Dino',
      clienteTelefone: '65999990001',
      profissionalId: profDino.id,
      servicoId: srvCombo.id,
      dataAgenda,
      horaLocal: '10:00',
      dataHora: `${dataAgenda}T14:00:00.000Z`,
      lojaId: LOJA,
    });

    assert.equal(agendamento.duracaoMinutos, 60, 'Agendamento de Combo deve ter duracaoMinutos = 60');
  });

  await t.test('3. Agendamento criado via createScheduledAppointment (IA WhatsApp) grava a duração real do catálogo', async () => {
    const dataAgenda = new Date(Date.now() + 86400000 * 4).toISOString().slice(0, 10);
    const scope = {
      empresaId: EMPRESA,
      lojaId: LOJA,
      legacyEmpresaId: EMPRESA,
      legacyLojaId: LOJA,
      phone: '5565999990002',
    };

    const criado = await createScheduledAppointment(null, scope, {
      customerName: 'Cliente IA WhatsApp',
      customerPhone: '5565999990002',
      serviceId: srvCorte.id,
      professionalId: profDino.id,
      date: dataAgenda,
      time: '14:00',
      actionId: 'act-test-ia-duracao',
    });

    assert.equal(criado.duracaoMinutos, 40, 'Agendamento via IA deve gravar duracaoMinutos = 40 para Corte com Dino');
  });

  await t.test('4. Bloqueio de colisão respeita a duração completa do procedimento', () => {
    const dataAgenda = new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10);
    // Agendamento das 15:00 com 60 min de duração (ocupa 15:00 até 16:00)
    barbearia.criarAgendamento(EMPRESA, {
      clienteNome: 'Cliente Combo 60min',
      clienteTelefone: '65999990003',
      profissionalId: profDino.id,
      servicoId: srvCombo.id,
      dataAgenda,
      horaLocal: '15:00',
      dataHora: `${dataAgenda}T19:00:00.000Z`,
      lojaId: LOJA,
    });

    // Tentar marcar às 15:30 (dentro do intervalo de 60 min) deve ser rejeitado por conflito
    assert.throws(() => {
      barbearia.criarAgendamento(EMPRESA, {
        clienteNome: 'Cliente Colisao',
        clienteTelefone: '65999990004',
        profissionalId: profDino.id,
        servicoId: srvCorte.id,
        dataAgenda,
        horaLocal: '15:30',
        dataHora: `${dataAgenda}T19:30:00.000Z`,
        lojaId: LOJA,
      });
    }, /Horário indisponível/);
  });
});
