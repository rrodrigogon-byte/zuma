import test from 'node:test';
import assert from 'node:assert/strict';
import * as barbearia from './barbearia-erp-kytto.js';

test('agenda com intervalo de 15 minutos e tempo configurável para Dino', async (t) => {
  const EMPRESA = 'test-emp-agenda-15min-' + Date.now();
  
  await t.test('1. Configuração padrão inicializa com intervalo de 15 minutos', () => {
    const config = barbearia.obterConfiguracao(EMPRESA);
    assert.equal(config.intervaloMinutos, 15, 'Intervalo padrão deve ser 15 minutos');
  });

  await t.test('2. Permite configurar tempo de atendimento do Dino e atualizar intervalo', () => {
    const atualizada = barbearia.atualizarConfiguracao(EMPRESA, {
      horarioAbertura: '08:00',
      horarioFechamento: '12:00',
      intervaloMinutos: 15,
      tempoAtendimentoDinoMinutos: 45,
      diasFuncionamento: [0, 1, 2, 3, 4, 5, 6],
      antecedenciaMinutos: 0,
      janelaReservaDias: 365,
    });
    assert.equal(atualizada.intervaloMinutos, 15);
    assert.equal(atualizada.tempoAtendimentoDinoMinutos, 45);
  });

  await t.test('3. Grade de horários disponíveis gera slots a cada 15 minutos', () => {
    // Cadastrar serviço de 30 min
    const servico = barbearia.criarServico(EMPRESA, {
      nome: 'Corte Clássico',
      duracaoMinutos: 30,
      preco: 80,
    });
    assert.ok(servico.id);

    // Cadastrar barbeiro padrão
    const barbeiro = barbearia.criarProfissional(EMPRESA, {
      nome: 'Carlos Barbeiro',
      horarioInicio: '08:00',
      horarioFim: '12:00',
      diasTrabalho: [0, 1, 2, 3, 4, 5, 6],
    });
    assert.ok(barbeiro.id);

    // Data daqui a 5 dias (dentro da janela de reserva)
    const dataFutura = new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10);
    const slots = barbearia.listarHorariosDisponiveis(EMPRESA, {
      data: dataFutura,
      servicoId: servico.id,
      profissionalId: barbeiro.id,
    });

    assert.ok(slots.length > 0, 'Deve retornar horários disponíveis');
    // Verificar que o passo entre os slots é exatamente 15 minutos
    assert.equal(slots[0].horario, '08:00');
    assert.equal(slots[1].horario, '08:15');
    assert.equal(slots[2].horario, '08:30');
    assert.equal(slots[3].horario, '08:45');
    assert.equal(slots[4].horario, '09:00');
  });

  await t.test('4. Dino aplica tempo configurado de atendimento (ex: 45 min)', () => {
    const servico = barbearia.listarServicos(EMPRESA)[0];

    // Cadastrar profissional Dino
    const dino = barbearia.criarProfissional(EMPRESA, {
      nome: 'Dino Guilherme Cunha',
      atendimento24x7: true,
      horarioInicio: '00:00',
      horarioFim: '23:59',
      diasTrabalho: [0, 1, 2, 3, 4, 5, 6],
    });

    const config = barbearia.obterConfiguracao(EMPRESA);
    const duracaoDino = barbearia.duracaoAtendimentoProfissional(servico, dino, config);
    assert.equal(duracaoDino, 45, 'Dino deve usar os 45 minutos configurados em tempoAtendimentoDinoMinutos');
  });

  await t.test('5. Profissional com duracaoAtendimentoMinutos personalizada tem precedência', () => {
    const servico = barbearia.listarServicos(EMPRESA)[0];

    // Barbeiro com tempo expresso de 20 min
    const barbeiroExpresso = barbearia.criarProfissional(EMPRESA, {
      nome: 'Dino Express',
      duracaoAtendimentoMinutos: 20,
      horarioInicio: '08:00',
      horarioFim: '18:00',
    });

    const config = barbearia.obterConfiguracao(EMPRESA);
    const duracao = barbearia.duracaoAtendimentoProfissional(servico, barbeiroExpresso, config);
    assert.equal(duracao, 20, 'Tempo específico do profissional prevalece');
  });

  await t.test('6. Agendamento com intervalo de 15 min ocupa a duração e bloqueia colisão', () => {
    const servico = barbearia.listarServicos(EMPRESA)[0];
    const barbeiro = barbearia.listarProfissionais(EMPRESA).find((p) => p.nome === 'Carlos Barbeiro');
    const dataFutura = new Date(Date.now() + 86400000 * 6).toISOString().slice(0, 10);

    // Agendar às 08:15 (slot de 15 min de início)
    const agendamento = barbearia.criarAgendamento(EMPRESA, {
      dataAgenda: dataFutura,
      horaLocal: '08:15',
      dataHora: `${dataFutura}T12:15:00.000Z`,
      servicoId: servico.id,
      profissionalId: barbeiro.id,
      clienteNome: 'Cliente 15min',
      clienteTelefone: '65999991515',
    });

    assert.ok(agendamento.id);
    assert.equal(agendamento.horaLocal, '08:15');
    assert.equal(agendamento.duracaoMinutos, 30); // 08:15 até 08:45

    // Tentar agendar no mesmo profissional às 08:30 (dentro do intervalo 08:15-08:45) deve dar erro de colisão
    assert.throws(() => {
      barbearia.criarAgendamento(EMPRESA, {
        dataAgenda: dataFutura,
        horaLocal: '08:30',
        dataHora: `${dataFutura}T12:30:00.000Z`,
        servicoId: servico.id,
        profissionalId: barbeiro.id,
        clienteNome: 'Cliente Colisão',
        clienteTelefone: '65999991516',
      });
    }, /indisponível|conflito/i);

    // Às 08:45 deve estar livre e permitir agendamento
    const agendamentoSeguinte = barbearia.criarAgendamento(EMPRESA, {
      dataAgenda: dataFutura,
      horaLocal: '08:45',
      dataHora: `${dataFutura}T12:45:00.000Z`,
      servicoId: servico.id,
      profissionalId: barbeiro.id,
      clienteNome: 'Cliente Seguinte',
      clienteTelefone: '65999991517',
    });
    assert.ok(agendamentoSeguinte.id);
    assert.equal(agendamentoSeguinte.horaLocal, '08:45');
  });
});
