import test from 'node:test';
import assert from 'node:assert/strict';
import {
  criarBloqueio,
  listarBloqueios,
  desativarBloqueio,
  listarConflitosBloqueio,
  checarConflitoAgendamento,
  criarAgendamento,
  criarProfissional,
  criarServico,
} from './barbearia-erp-kytto.js';

test('Bloqueios de agenda em datas futuras na Barbearia Dino', async (t) => {
  const EMPRESA_ID = 'emp-teste-bloqueio-' + Date.now();
  
  // Cadastra profissionais e serviço para teste com horários e dias completos
  const profNati = criarProfissional(EMPRESA_ID, {
    nome: 'Natani Minanis Dobler',
    apelido: 'Natani/Nati',
    ativo: true,
    horarioInicio: '08:00',
    horarioFim: '20:00',
    diasTrabalho: [0, 1, 2, 3, 4, 5, 6],
  });
  const profBruno = criarProfissional(EMPRESA_ID, {
    nome: 'Bruno Mendes',
    apelido: 'Bruno',
    ativo: true,
    horarioInicio: '08:00',
    horarioFim: '20:00',
    diasTrabalho: [0, 1, 2, 3, 4, 5, 6],
  });
  const servicoCorte = criarServico(EMPRESA_ID, {
    nome: 'Corte Masculino',
    preco: 50,
    duracaoMinutos: 30,
    ativo: true,
  });

  await t.test('1. Permite criar bloqueio para dias futuros (17 e 18 de novembro)', () => {
    const bloqueio17 = criarBloqueio(EMPRESA_ID, {
      titulo: 'Viagem / Ausência',
      motivo: 'Viagem de Nati',
      inicio: '2026-11-17T00:00:00.000Z',
      fim: '2026-11-17T23:59:59.000Z',
      profissionalId: profNati.id,
    });
    assert.ok(bloqueio17 && bloqueio17.id, 'Deve criar bloqueio para o dia 17');
    assert.equal(bloqueio17.profissionalId, profNati.id);

    const bloqueio18 = criarBloqueio(EMPRESA_ID, {
      titulo: 'Viagem / Ausência',
      motivo: 'Viagem de Nati',
      inicio: '2026-11-18T00:00:00.000Z',
      fim: '2026-11-18T23:59:59.000Z',
      profissionalId: profNati.id,
    });
    assert.ok(bloqueio18 && bloqueio18.id, 'Deve criar bloqueio para o dia 18');

    const lista = listarBloqueios(EMPRESA_ID);
    assert.ok(lista.length >= 2, 'Deve listar os bloqueios criados');
    assert.ok(lista.some(b => b.id === bloqueio17.id));
    assert.ok(lista.some(b => b.id === bloqueio18.id));
  });

  await t.test('2. Conflito impede agendamento para o profissional bloqueado na data futura', () => {
    // Checagem de conflito para Nati no dia 17
    const conflitoNati = checarConflitoAgendamento(EMPRESA_ID, {
      dataHora: '2026-11-17T14:00:00.000Z',
      duracaoMinutos: 30,
      profissionalId: profNati.id,
    });
    assert.ok(conflitoNati, 'Deve acusar conflito para Nati no dia 17');
    assert.equal(conflitoNati.tipo, 'bloqueio', 'O tipo de conflito deve ser bloqueio');

    // Tentativa de criarAgendamento para Nati no dia 17 deve lançar erro
    assert.throws(
      () => {
        criarAgendamento(EMPRESA_ID, {
          clienteNome: 'Cliente Teste',
          clienteTelefone: '65999991111',
          profissionalId: profNati.id,
          servicoId: servicoCorte.id,
          dataAgenda: '2026-11-17',
          horaLocal: '10:00',
          dataHora: '2026-11-17T14:00:00.000Z',
          duracaoMinutos: 30,
        });
      },
      /Horário indisponível/,
      'Deve rejeitar agendamento no dia bloqueado'
    );

    // Mas outro profissional (Bruno) pode agendar normalmente no dia 17
    const conflitoBruno = checarConflitoAgendamento(EMPRESA_ID, {
      dataHora: '2026-11-17T14:00:00.000Z',
      duracaoMinutos: 30,
      profissionalId: profBruno.id,
    });
    assert.ok(!conflitoBruno, 'Bruno deve estar livre no dia 17');
  });

  await t.test('3. listarConflitosBloqueio detecta clientes já agendados para remanejamento', () => {
    // Cria um agendamento prévio no dia 19
    const ag = criarAgendamento(EMPRESA_ID, {
      clienteNome: 'Cliente Previo',
      clienteTelefone: '65999998888',
      profissionalId: profNati.id,
      servicoId: servicoCorte.id,
      dataAgenda: '2026-11-19',
      horaLocal: '10:00',
      dataHora: '2026-11-19T14:00:00.000Z',
      duracaoMinutos: 30,
    });
    assert.ok(ag && ag.id, 'Agendamento criado');

    // Ao verificar se pode bloquear dia 19, a função lista o cliente para remanejamento
    const conflitos = listarConflitosBloqueio(EMPRESA_ID, {
      inicio: '2026-11-19T00:00:00.000Z',
      fim: '2026-11-19T23:59:59.000Z',
      profissionalId: profNati.id,
    });
    assert.ok(conflitos.length >= 1, 'Deve encontrar o agendamento prévio');
    assert.equal(conflitos[0].clienteNome, 'Cliente Previo');
    assert.equal(conflitos[0].clienteTelefone, '65999998888');
  });

  await t.test('4. Desativação do bloqueio libera a agenda do profissional', () => {
    const lista = listarBloqueios(EMPRESA_ID);
    const b17 = lista.find(b => b.inicio.includes('2026-11-17'));
    assert.ok(b17, 'Encontrou bloqueio do dia 17');

    desativarBloqueio(EMPRESA_ID, b17.id);

    const conflitoAposRemover = checarConflitoAgendamento(EMPRESA_ID, {
      dataHora: '2026-11-17T14:00:00.000Z',
      duracaoMinutos: 30,
      profissionalId: profNati.id,
    });
    assert.ok(!conflitoAposRemover, 'Após desativar bloqueio, horário deve ficar liberado');
  });

  await t.test('5. availability retorna bloqueio ativo com motivo quando dia estiver bloqueado', async () => {
    const { availability } = await import('./core/barbershop-agenda.js');
    const b18 = criarBloqueio(EMPRESA_ID, {
      titulo: 'Viagem Nati',
      motivo: 'Nati em viagem nos dias 17 e 18 de novembro',
      inicio: '2026-11-18T00:00:00.000Z',
      fim: '2026-11-18T23:59:59.000Z',
      profissionalId: profNati.id,
    });
    assert.ok(b18?.id);

    const res = await availability(
      { empresaId: EMPRESA_ID, legacyEmpresaId: EMPRESA_ID, lojaId: 'loja-dino-01' },
      { date: '2026-11-18', serviceId: servicoCorte.id, professionalId: profNati.id }
    );
    assert.equal(res.slots.length, 0, 'Slots de Nati no dia 18 devem estar vazios');
    assert.ok(res.bloqueio?.ativo, 'Deve indicar bloqueio ativo');
    assert.match(res.bloqueio.motivo, /viagem/i, 'Motivo deve citar viagem');
  });
});
