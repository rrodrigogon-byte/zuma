import test from 'node:test';
import assert from 'node:assert/strict';
import * as barbearia from './barbearia-erp-kytto.js';
import { matchAgendaName } from './core/whatsapp-ai-tools.js';

test('Correção da Duração e Agendamento da Barbearia Dino (Prevenção de Encaixe Indevido de 15 min)', async (t) => {
  const EMPRESA = 'test-emp-dino-fix-' + Date.now();
  const LOJA = 'loja-dino-' + Date.now();

  const profNati = barbearia.criarProfissional(EMPRESA, {
    nome: 'Natani Minanis Dobler',
    apelido: 'Nati',
    horarioInicio: '08:00',
    horarioFim: '18:00',
    diasTrabalho: [1, 2, 3, 4, 5, 6],
  });

  const profBruno = barbearia.criarProfissional(EMPRESA, {
    nome: 'Bruno Mendes Pedroso',
    apelido: 'Bruno',
    horarioInicio: '08:00',
    horarioFim: '19:00',
    diasTrabalho: [1, 2, 3, 4, 5, 6],
  });

  const profDino = barbearia.criarProfissional(EMPRESA, {
    nome: 'Guilherme Cunha Martins (Dino)',
    apelido: 'Dino',
    atendimento24x7: true,
    horarioInicio: '00:00',
    horarioFim: '23:59',
    diasTrabalho: [0, 1, 2, 3, 4, 5, 6],
  });

  await t.test('1. estimarDuracaoPorNomeServico infere com precisão tempos reais de procedimentos', () => {
    assert.equal(barbearia.estimarDuracaoPorNomeServico('CORTE E BARBA PREMIUM'), 60);
    assert.equal(barbearia.estimarDuracaoPorNomeServico('Corte e barba com Dino'), 60);
    assert.equal(barbearia.estimarDuracaoPorNomeServico('Barba e cabelo avulso'), 60);
    assert.equal(barbearia.estimarDuracaoPorNomeServico('Combo'), 60);
    assert.equal(barbearia.estimarDuracaoPorNomeServico('CORTE  PREMIUM'), 40);
    assert.equal(barbearia.estimarDuracaoPorNomeServico('Corte com Dino'), 40);
    assert.equal(barbearia.estimarDuracaoPorNomeServico('BARBA PREMIUM'), 30);
    assert.equal(barbearia.estimarDuracaoPorNomeServico('Detox de barba'), 30);
    assert.equal(barbearia.estimarDuracaoPorNomeServico('Selagem'), 45);
    assert.equal(barbearia.estimarDuracaoPorNomeServico('Prótese Capilar'), 90);
    assert.equal(barbearia.estimarDuracaoPorNomeServico('Design de Sobrancelha'), 15);
    assert.equal(barbearia.estimarDuracaoPorNomeServico('Serviço Desconhecido'), 30);
  });

  await t.test('2. duracaoAtendimentoProfissional nunca cai no fallback de 15 minutos do intervalo da grade', () => {
    const config = barbearia.obterConfiguracao(EMPRESA);
    // Simula serviço com duracaoMinutos null no banco
    const servicoSemDuracao = { nome: 'CORTE E BARBA PREMIUM', duracaoMinutos: null };
    const durNati = barbearia.duracaoAtendimentoProfissional(servicoSemDuracao, profNati, config);
    assert.equal(durNati, 60, 'Combo sem duracaoMinutos explícita deve calcular 60 min');

    const corteSemDuracao = { nome: 'CORTE  PREMIUM', duracaoMinutos: null };
    const durCorte = barbearia.duracaoAtendimentoProfissional(corteSemDuracao, profNati, config);
    assert.equal(durCorte, 40, 'Corte sem duracaoMinutos explícita deve calcular 40 min');

    const barbaSemDuracao = { nome: 'BARBA PREMIUM', duracaoMinutos: null };
    const durBarba = barbearia.duracaoAtendimentoProfissional(barbaSemDuracao, profNati, config);
    assert.equal(durBarba, 30, 'Barba sem duracaoMinutos explícita deve calcular 30 min');
  });

  await t.test('3. duracaoAtendimentoProfissional protege combo mesmo se profissional tiver tempo personalizado menor', () => {
    const config = barbearia.obterConfiguracao(EMPRESA);
    const profExpresso = { ...profBruno, duracaoAtendimentoMinutos: 30 };
    const servicoCombo = { nome: 'CORTE E BARBA PREMIUM', duracaoMinutos: 60 };
    const dur = barbearia.duracaoAtendimentoProfissional(servicoCombo, profExpresso, config);
    assert.equal(dur, 60, 'Combo não pode ser encolhido para 30 min pelo tempo de corte do barbeiro');
  });

  await t.test('4. Slot de 15 min antes de outro agendamento (08:15 vs 08:30) é IMPEDIDO para Combo de 60 min', () => {
    const estado = barbearia.estadoEmpresa(EMPRESA);
    const data = '2026-11-26';

    // Cria serviço combo sem duração no banco
    const srvCombo = barbearia.criarServico(EMPRESA, {
      nome: 'CORTE E BARBA PREMIUM',
      preco: 200,
    });

    const srvCorteClub = barbearia.criarServico(EMPRESA, {
      nome: 'Corte Club',
      duracaoMinutos: 30,
      preco: 100,
    });

    // Rogério agendado às 08:30
    barbearia.criarAgendamento(EMPRESA, {
      clienteNome: 'Rogerio Lima Vox2you',
      clienteTelefone: '65999990001',
      profissionalId: profNati.id,
      servicoId: srvCorteClub.id,
      dataAgenda: data,
      horaLocal: '08:30',
      dataHora: `${data}T12:30:00.000Z`,
      duracaoMinutos: 30,
      lojaId: LOJA,
    });

    const horarios = barbearia.listarHorariosDisponiveis(EMPRESA, {
      data,
      servicoId: srvCombo.id,
      profissionalId: profNati.id,
      lojaId: LOJA,
    });

    const slot815 = horarios.find((h) => h.horario === '08:15');
    assert.equal(slot815?.disponivel, false, 'Slot das 08:15 deve estar indisponível para combo de 60m pois colide com 08:30');
  });

  await t.test('5. criarAgendamento blinda agendamento de combo contra payload forçando 15 minutos', () => {
    const data = '2026-11-26';
    const servicos = barbearia.listarServicos(EMPRESA);
    const srvCombo = servicos.find((s) => s.nome.includes('CORTE E BARBA'));

    const agendamento = barbearia.criarAgendamento(EMPRESA, {
      clienteNome: 'Fabio dos Santos Negrão',
      clienteTelefone: '65992928503',
      profissionalId: profNati.id,
      servicoId: srvCombo.id,
      dataAgenda: data,
      horaLocal: '10:00',
      dataHora: `${data}T14:00:00.000Z`,
      duracaoMinutos: 15, // Tentativa indevida de forçar 15 min
      lojaId: LOJA,
    });

    assert.equal(agendamento.duracaoMinutos, 60, 'Agendamento de combo deve ser forçado a no mínimo 60 min');
  });

  await t.test('6. matchAgendaName resolve perfeitamente variações com Nati sem disparar AGENDA_REF_NOT_FOUND', () => {
    const listaServicos = [
      { id: 'srv-mv1a0akw-023', nome: 'BARBA PREMIUM' },
      { id: 'srv-mv1a0btp-026', nome: 'CORTE  PREMIUM' },
      { id: 'srv-mv1a0c6n-028', nome: 'Corte com Dino' },
      { id: 'srv-mv1a0clh-030', nome: 'Corte e barba com Dino' },
      { id: 'srv-mv1a0cds-029', nome: 'CORTE E BARBA PREMIUM' },
      { id: 'srv-avec-720223e847ecb5e779f5c2b3', nome: 'Corte Visagista' },
      { id: 'srv-mv1a0e6o-038', nome: 'Detox de barba' },
    ];

    const res1 = matchAgendaName('barba e cabelo', listaServicos, { isDino: false });
    assert.equal(res1.item?.id, 'srv-mv1a0cds-029', 'Deve resolver para CORTE E BARBA PREMIUM quando profissional não for Dino');

    const res2 = matchAgendaName('corte e barba', listaServicos, { isDino: false });
    assert.equal(res2.item?.id, 'srv-mv1a0cds-029', 'Deve resolver para CORTE E BARBA PREMIUM');

    const res3 = matchAgendaName('corte e barba com a nati', listaServicos, { isDino: false });
    assert.equal(res3.item?.id, 'srv-mv1a0cds-029', 'Deve resolver direto para CORTE E BARBA PREMIUM');

    const res4 = matchAgendaName('corte e barba com o dino', listaServicos, { isDino: true });
    assert.equal(res4.item?.id, 'srv-mv1a0clh-030', 'Deve resolver para Corte e barba com Dino quando for com Dino');
  });

  await t.test('7. garantirDuracoesServicosBarbearia saneia serviços com duracaoMinutos null ou 15', () => {
    const estado = barbearia.estadoEmpresa(EMPRESA);
    // Força serviço com duracaoMinutos = 15
    estado.servicos['srv-teste-viciado'] = {
      id: 'srv-teste-viciado',
      empresaId: EMPRESA,
      nome: 'CORTE E BARBA PREMIUM',
      duracaoMinutos: 15,
      ativo: true,
    };

    barbearia.garantirDuracoesServicosBarbearia(EMPRESA);
    assert.equal(estado.servicos['srv-teste-viciado'].duracaoMinutos, 60, 'garantirDuracoesServicosBarbearia deve corrigir para 60 min');
  });
});
