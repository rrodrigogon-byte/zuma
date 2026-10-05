// Captação e retenção da barbearia: autoatendimento, lista de espera, indicação,
// clube de assinatura, retorno previsto, ocupação e metas por profissional; e a
// agenda única usada pela IA do WhatsApp.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'captacao-')), 'db.json');

const test = (await import('node:test')).default;
const { beforeEach } = await import('node:test');
const assert = (await import('node:assert/strict')).default;
const { db, reset } = await import('./db.js');
const barbearia = await import('./barbearia-erp-kytto.js');
const clientes = await import('./clientes-contas-kytto.js');
const fidelidade = await import('./canais-fidelidade-kytto.js');
const financeiro = await import('./financeiro-central-kytto.js');
const captacao = await import('./dino-captacao-kytto.js');
const agenda = await import('./core/barbershop-agenda.js');

const EMPRESA = '0f0e0d0c-1b2a-4c3d-8e9f-0123456789ab';
const LOJA = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const DIA_MS = 86400000;
const TODOS_OS_DIAS = [0, 1, 2, 3, 4, 5, 6];

function dataLocal(ms) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}

function isoLocal(data, hora) {
  return new Date(`${data}T${hora}:00-04:00`).toISOString();
}

function montarBarbearia() {
  barbearia.atualizarConfiguracao(EMPRESA, {
    horarioAbertura: '08:00', horarioFechamento: '20:00', intervaloMinutos: 30,
    diasFuncionamento: TODOS_OS_DIAS, antecedenciaMinutos: 0, janelaReservaDias: 60, politicaCancelamentoHoras: 4,
    slugPublico: 'dino-teste', nomePublico: 'Dino Teste',
  });
  const bruno = barbearia.criarProfissional(EMPRESA, { nome: 'Bruno', horarioInicio: '08:00', horarioFim: '20:00', diasTrabalho: TODOS_OS_DIAS });
  const carlos = barbearia.criarProfissional(EMPRESA, { nome: 'Carlos', horarioInicio: '08:00', horarioFim: '20:00', diasTrabalho: TODOS_OS_DIAS });
  const corte = barbearia.criarServico(EMPRESA, { nome: 'Corte', preco: 50, duracaoMinutos: 30 });
  const barba = barbearia.criarServico(EMPRESA, { nome: 'Barba', preco: 40, duracaoMinutos: 30 });
  return { bruno, carlos, corte, barba };
}

function agendar({ profissional, servico, data, hora, nome = 'Cliente Um', telefone = '65999990001', codigo = 'ABCD1234', clienteId }) {
  return barbearia.criarAgendamento(EMPRESA, {
    clienteId, clienteNome: nome, clienteTelefone: telefone, profissionalId: profissional.id, servicoId: servico.id,
    dataHora: isoLocal(data, hora), dataAgenda: data, horaLocal: hora, lojaId: LOJA, origem: 'agendamento_online', codigoConfirmacao: codigo,
  });
}

function concluir(agendamento) {
  barbearia.alterarStatusAgendamento(EMPRESA, agendamento.id, 'em_atendimento');
  const concluido = barbearia.alterarStatusAgendamento(EMPRESA, agendamento.id, 'concluido');
  const agora = new Date().toISOString();
  const lancamento = financeiro.registrarLancamento(EMPRESA, {
    tipo: 'receita', categoria: 'Serviços', descricao: `Atendimento de barbearia ${agendamento.id}`,
    valor: agendamento.valor, origem: 'barbearia_atendimento', status: 'pago', meioPagamento: 'pix',
    dataOperacao: agora, pagoEm: agora, automatico: true,
    chaveIdempotencia: `barbearia_atendimento:${EMPRESA}:${agendamento.id}`,
    referencia: { agendamentoId: agendamento.id, servicoId: agendamento.servicoId, profissionalId: agendamento.profissionalId },
  });
  return barbearia.vincularLancamentoFinanceiro(EMPRESA, concluido.id, lancamento.id);
}

beforeEach(() => { reset(); agenda.limparCacheFonteAgenda(); });

test('autoatendimento: consulta, remarca e cancela com código + telefone dentro da política', () => {
  const { bruno, corte } = montarBarbearia();
  const amanha = dataLocal(Date.now() + 2 * DIA_MS);
  agendar({ profissional: bruno, servico: corte, data: amanha, hora: '10:00' });

  assert.throws(() => captacao.consultarAgendamentoCliente(EMPRESA, { codigo: 'ABCD1234', telefone: '65988887777', lojaId: LOJA }), { code: 'AGENDAMENTO_NAO_ENCONTRADO' });
  assert.throws(() => captacao.consultarAgendamentoCliente(EMPRESA, { codigo: 'ABCD1234', telefone: '65999990001', lojaId: 'outra-loja' }), { code: 'AGENDAMENTO_NAO_ENCONTRADO' });
  const visao = captacao.consultarAgendamentoCliente(EMPRESA, { codigo: 'abcd-1234', telefone: '(65) 99999-0001', lojaId: LOJA });
  assert.equal(visao.podeCancelar, true);
  assert.equal(visao.servico.nome, 'Corte');
  assert.equal(visao.profissional.nome, 'Bruno');

  const remarcado = captacao.remarcarAgendamentoCliente(EMPRESA, { codigo: 'ABCD1234', telefone: '65999990001', data: amanha, horario: '15:00', lojaId: LOJA });
  assert.equal(remarcado.agendamento.horaLocal, '15:00');
  assert.equal(remarcado.agendamento.profissionalId, bruno.id, 'mantém o barbeiro');
  assert.equal(remarcado.agendamento.historicoRemarcacoes.length, 1);

  const cancelado = captacao.cancelarAgendamentoCliente(EMPRESA, { codigo: 'ABCD1234', telefone: '65999990001', motivo: 'imprevisto', lojaId: LOJA });
  assert.equal(cancelado.agendamento.status, 'cancelado');
  assert.match(cancelado.agendamento.observacoes, /Cancelado pelo cliente: imprevisto/);
  assert.throws(() => captacao.cancelarAgendamentoCliente(EMPRESA, { codigo: 'ABCD1234', telefone: '65999990001', lojaId: LOJA }), { code: 'CANCELAMENTO_FORA_DA_POLITICA' });
});

test('autoatendimento: fora do prazo da política o cliente é orientado a falar com a barbearia', () => {
  const { bruno, corte } = montarBarbearia();
  const daqui2h = Date.now() + 2 * 3600000;
  const data = dataLocal(daqui2h);
  const hora = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Cuiaba', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(daqui2h));
  barbearia.atualizarConfiguracao(EMPRESA, { horarioAbertura: '00:00', horarioFechamento: '23:59' });
  barbearia.atualizarProfissional(EMPRESA, bruno.id, { horarioInicio: '00:00', horarioFim: '23:59' });
  const [h, m] = hora.split(':').map(Number);
  if (h * 60 + m + 30 > 23 * 60 + 59) return; // perto da meia-noite local: cenário não se aplica
  agendar({ profissional: bruno, servico: corte, data, hora });
  const visao = captacao.consultarAgendamentoCliente(EMPRESA, { codigo: 'ABCD1234', telefone: '65999990001', lojaId: LOJA });
  assert.equal(visao.podeCancelar, false);
  assert.equal(visao.motivoBloqueio, 'fora_do_prazo');
  assert.throws(() => captacao.cancelarAgendamentoCliente(EMPRESA, { codigo: 'ABCD1234', telefone: '65999990001', lojaId: LOJA }), /4h antes/);
});

test('lista de espera: vaga aberta avisa quem pediu aquele dia e período, sem repetir', () => {
  const { bruno, corte } = montarBarbearia();
  const dia = dataLocal(Date.now() + 3 * DIA_MS);
  const primeiro = captacao.entrarListaEspera(EMPRESA, { nome: 'Ana', telefone: '65911110001', data: dia, servicoId: corte.id, periodo: 'manha', consentimentoWhatsapp: true });
  captacao.entrarListaEspera(EMPRESA, { nome: 'Beto', telefone: '65911110002', data: dia, servicoId: corte.id, periodo: 'tarde' });
  captacao.entrarListaEspera(EMPRESA, { nome: 'Caio', telefone: '65911110003', data: dia, servicoId: corte.id, periodo: 'qualquer' });
  const repetida = captacao.entrarListaEspera(EMPRESA, { nome: 'Ana', telefone: '65911110001', data: dia, servicoId: corte.id });
  assert.equal(repetida.repetida, true);
  assert.equal(repetida.id, primeiro.id);
  assert.throws(() => captacao.entrarListaEspera(EMPRESA, { nome: 'Ana', telefone: '65911110001', data: '2020-01-01', servicoId: corte.id }), { code: 'DATA_PASSADA' });

  const ag = agendar({ profissional: bruno, servico: corte, data: dia, hora: '09:00' });
  const cancelado = barbearia.alterarStatusAgendamento(EMPRESA, ag.id, 'cancelado');
  const todos = captacao.candidatosParaVaga(EMPRESA, cancelado, { incluirSemConsentimento: true });
  assert.deepEqual(todos.map((item) => item.nome), ['Ana', 'Caio'], 'manhã + qualquer período, na ordem de chegada');
  const candidatos = captacao.candidatosParaVaga(EMPRESA, cancelado);
  assert.deepEqual(candidatos.map((item) => item.nome), ['Ana'], 'aviso automático só para quem autorizou o WhatsApp');
  assert.match(candidatos[0].mensagem, /Abriu um horário/);
  assert.equal(captacao.candidatosParaVaga(EMPRESA, cancelado).length, 1, 'consultar não marca ninguém como avisado');
  assert.equal(captacao.marcarAvisados(EMPRESA, cancelado, [candidatos[0].id]), 1);
  assert.equal(captacao.candidatosParaVaga(EMPRESA, cancelado).length, 0, 'não avisa duas vezes a mesma vaga');

  // Quem marca horário naquele dia sai da lista; SAIR desliga os avisos.
  assert.equal(captacao.marcarListaEsperaAgendada(EMPRESA, { telefone: '(65) 91111-0002', data: dia }), 1);
  assert.equal(captacao.listarListaEspera(EMPRESA, { data: dia }).find((item) => item.nome === 'Beto').status, 'agendado');
  assert.deepEqual(captacao.revogarAvisosListaEspera(EMPRESA, '65911110001'), [primeiro.id]);
  assert.throws(() => captacao.entrarListaEspera(EMPRESA, { nome: 'Longe', telefone: '65911110009', data: '2099-01-01', servicoId: corte.id }), { code: 'DATA_DISTANTE' });
});

test('lista de espera: leitura e status não atravessam a unidade', () => {
  const { corte } = montarBarbearia();
  const dia = dataLocal(Date.now() + 3 * DIA_MS);
  const outraLoja = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff';
  const item = captacao.entrarListaEspera(EMPRESA, { nome: 'Outra loja', telefone: '65911110010', data: dia, servicoId: corte.id, lojaId: outraLoja });
  assert.equal(captacao.listarListaEspera(EMPRESA, { lojaId: LOJA }).length, 0);
  assert.equal(captacao.alterarStatusListaEspera(EMPRESA, item.id, 'desistiu', LOJA), null);
  assert.equal(captacao.listarListaEspera(EMPRESA, { lojaId: outraLoja })[0].status, 'aguardando');
});

test('indicação: o indicado novo gera pontos para os dois ao concluir o primeiro atendimento', () => {
  const { bruno, carlos, corte } = montarBarbearia();
  const indicador = clientes.criarCliente(EMPRESA, { nome: 'Rafael Indicador', telefone: '65977770001' });
  const { codigo } = captacao.codigoIndicacaoCliente(EMPRESA, indicador.id);
  assert.match(codigo, /^[A-Z0-9]{6,7}$/);
  assert.equal(captacao.codigoIndicacaoCliente(EMPRESA, indicador.id).codigo, codigo, 'código estável');

  const dia = dataLocal(Date.now() + DIA_MS);
  const indicado = clientes.criarCliente(EMPRESA, { nome: 'Lucas Novo', telefone: '65977770002' });
  const ag = agendar({ profissional: bruno, servico: corte, data: dia, hora: '11:00', nome: 'Lucas Novo', telefone: '65977770002', clienteId: indicado.id, codigo: 'IND00001' });
  const registro = captacao.registrarIndicacao(EMPRESA, { codigo, agendamento: ag });
  assert.equal(registro.status, 'pendente');

  const autoindicacao = agendar({ profissional: carlos, servico: corte, data: dia, hora: '11:00', nome: 'Rafael Indicador', telefone: '65977770001', clienteId: indicador.id, codigo: 'IND00002' });
  assert.equal(captacao.registrarIndicacao(EMPRESA, { codigo, agendamento: autoindicacao }), null, 'autoindicação não conta');

  const concluido = concluir(ag);
  const resultado = captacao.processarConclusaoIndicacao(EMPRESA, concluido);
  assert.equal(resultado.status, 'recompensada');
  assert.equal(resultado.pontosIndicador, 100);
  assert.equal(resultado.pontosIndicado, 50);
  const membros = fidelidade.obterFidelidade(EMPRESA).membros;
  assert.equal(membros.find((m) => m.clienteId === indicador.id).pontos, 100, 'indicador inscrito e pontuado');
  assert.equal(membros.find((m) => m.clienteId === indicado.id).pontos, 50);
  assert.equal(captacao.processarConclusaoIndicacao(EMPRESA, concluido), null, 'idempotente');
  const painel = captacao.painelIndicacoes(EMPRESA);
  assert.equal(painel.convertidas, 1);
  assert.equal(painel.ranking[0].nome, 'Rafael Indicador');
  assert.equal(painel.recentes[0].indicadoTelefone, undefined, 'painel não expõe o telefone do indicado');
});

test('indicação: cliente que já foi atendido antes não conta como indicado', () => {
  const { bruno, corte } = montarBarbearia();
  const indicador = clientes.criarCliente(EMPRESA, { nome: 'Indicador', telefone: '65977770011' });
  const { codigo } = captacao.codigoIndicacaoCliente(EMPRESA, indicador.id);
  const antigo = agendar({ profissional: bruno, servico: corte, data: dataLocal(Date.now() - 10 * DIA_MS), hora: '10:00', nome: 'Antigo', telefone: '65977770012', codigo: 'OLD00001' });
  concluir(antigo);
  const novo = agendar({ profissional: bruno, servico: corte, data: dataLocal(Date.now() + DIA_MS), hora: '10:00', nome: 'Antigo', telefone: '65977770012', codigo: 'NEW00001' });
  assert.equal(captacao.registrarIndicacao(EMPRESA, { codigo, agendamento: novo }), null);
});

test('clube: pagamento do ciclo, consumo na conclusão, limite por ciclo e bloqueio de inadimplente', () => {
  const { bruno, corte, barba } = montarBarbearia();
  const cliente = clientes.criarCliente(EMPRESA, { nome: 'Assinante', telefone: '65966660001' });
  const plano = barbearia.criarPlano(EMPRESA, { nome: 'Clube 2 cortes', preco: 80, sessoesIncluidas: 2, ciclo: 'mensal', validadeDias: 30, servicosIds: [corte.id] });
  const pendente = barbearia.criarAssinatura(EMPRESA, { planoId: plano.id, clienteId: cliente.id, clienteNome: cliente.nome, inicio: new Date(Date.now() - DIA_MS).toISOString() });
  barbearia.alterarStatusAssinatura(EMPRESA, pendente.id, 'ativa', { confirmadoSemCobranca: true, pagamentoConfirmado: false });

  assert.equal(captacao.resumoAssinatura(EMPRESA, pendente.id).situacaoPagamento, 'aguardando_pagamento');
  assert.throws(() => captacao.registrarUsoAssinatura(EMPRESA, pendente.id, { servicoId: corte.id }), { code: 'ASSINATURA_SEM_PAGAMENTO' });

  const pago = captacao.registrarPagamentoAssinatura(EMPRESA, pendente.id, { valor: 80, meio: 'pix', referencia: 'pix-1' });
  assert.equal(pago.situacaoPagamento, 'em_dia');
  assert.equal(captacao.registrarPagamentoAssinatura(EMPRESA, pendente.id, { valor: 80, referencia: 'pix-1' }).repetido, true, 'pagamento idempotente');

  const dia = dataLocal(Date.now() + DIA_MS);
  const ag1 = concluir(agendar({ profissional: bruno, servico: corte, data: dia, hora: '09:00', nome: cliente.nome, telefone: cliente.telefone, clienteId: cliente.id, codigo: 'CLB00001' }));
  const uso1 = captacao.consumirAssinaturaNaConclusao(EMPRESA, ag1);
  assert.equal(uso1.usosNoCiclo, 1);
  assert.equal(captacao.consumirAssinaturaNaConclusao(EMPRESA, ag1).usosNoCiclo, 1, 'mesmo atendimento não consome duas vezes');

  const agBarba = concluir(agendar({ profissional: bruno, servico: barba, data: dia, hora: '10:00', nome: cliente.nome, telefone: cliente.telefone, clienteId: cliente.id, codigo: 'CLB00002' }));
  assert.equal(captacao.consumirAssinaturaNaConclusao(EMPRESA, agBarba), null, 'serviço fora do plano não consome');

  const ag2 = concluir(agendar({ profissional: bruno, servico: corte, data: dia, hora: '11:00', nome: cliente.nome, telefone: cliente.telefone, clienteId: cliente.id, codigo: 'CLB00003' }));
  assert.equal(captacao.consumirAssinaturaNaConclusao(EMPRESA, ag2).sessoesRestantes, 0);
  assert.throws(() => captacao.registrarUsoAssinatura(EMPRESA, pendente.id, { servicoId: corte.id }), { code: 'LIMITE_DO_CICLO' });

  // 40 dias depois sem novo pagamento: passou do pago-até + carência.
  const depois = Date.now() + 40 * DIA_MS;
  assert.equal(captacao.resumoAssinatura(EMPRESA, pendente.id, { agora: depois }).situacaoPagamento, 'inadimplente');
  assert.throws(() => captacao.registrarUsoAssinatura(EMPRESA, pendente.id, { servicoId: corte.id }, { agora: depois }), { code: 'ASSINATURA_INADIMPLENTE' });

  const saude = captacao.saudeClube(EMPRESA);
  assert.equal(saude.assinantesAtivos, 1);
  assert.equal(saude.mrr, 80);
  assert.equal(saude.itens[0].valorAvulsoConsumido, 100);
  assert.ok(saude.itens[0].alertas.includes('uso_acima_da_mensalidade'));
  assert.ok(captacao.saudeClube(EMPRESA, { agora: depois }).itens[0].alertas.includes('inadimplente'));
});

test('clube: candidatos são clientes sem plano que gastam mais no avulso do que o plano custa', () => {
  const { bruno, corte } = montarBarbearia();
  barbearia.criarPlano(EMPRESA, { nome: 'Clube Corte', preco: 60, sessoesIncluidas: 4, validadeDias: 30 });
  for (const [i, dias] of [[1, 50], [2, 35], [3, 20], [4, 5]].entries()) {
    concluir(agendar({ profissional: bruno, servico: corte, data: dataLocal(Date.now() - dias[1] * DIA_MS), hora: '09:00', nome: 'Frequente', telefone: '65955550001', codigo: `FRQ0000${i}` }));
  }
  concluir(agendar({ profissional: bruno, servico: corte, data: dataLocal(Date.now() - 30 * DIA_MS), hora: '10:00', nome: 'Raro', telefone: '65955550002', codigo: 'RARO0001' }));
  const { candidatos, planoReferencia } = captacao.candidatosAoClube(EMPRESA, { dias: 60 });
  assert.equal(planoReferencia.nome, 'Clube Corte');
  assert.equal(candidatos.length, 1);
  assert.equal(candidatos[0].nome, 'Frequente');
  assert.equal(candidatos[0].gastoMensalAvulso, 100);
  assert.equal(candidatos[0].economiaMensal, 40);
  assert.match(candidatos[0].argumento, /R\$ 100,00/);
});

test('retorno previsto: intervalo habitual, atraso e próximo horário do barbeiro preferido', () => {
  const { bruno, carlos, corte } = montarBarbearia();
  for (const [i, dias] of [70, 50, 30].entries()) {
    concluir(agendar({ profissional: bruno, servico: corte, data: dataLocal(Date.now() - dias * DIA_MS), hora: '09:00', nome: 'Habitual', telefone: '65944440001', codigo: `HAB0000${i}` }));
  }
  for (const [i, dias] of [40, 25].entries()) {
    concluir(agendar({ profissional: carlos, servico: corte, data: dataLocal(Date.now() - dias * DIA_MS), hora: '09:00', nome: 'Agendado', telefone: '65944440002', codigo: `AGD0000${i}` }));
  }
  agendar({ profissional: carlos, servico: corte, data: dataLocal(Date.now() + 2 * DIA_MS), hora: '09:00', nome: 'Agendado', telefone: '65944440002', codigo: 'AGD00009' });
  const resultado = captacao.retornosPrevistos(EMPRESA, { lojaId: LOJA });
  assert.equal(resultado.resumo.clientesComHistorico, 2);
  const habitual = resultado.todos.find((item) => item.nome === 'Habitual');
  assert.equal(habitual.intervaloHabitualDias, 20);
  assert.equal(habitual.situacao, 'atrasado');
  assert.ok(habitual.diasAtraso >= 9 && habitual.diasAtraso <= 11);
  assert.equal(habitual.profissionalPreferido.nome, 'Bruno');
  assert.equal(resultado.todos.find((item) => item.nome === 'Agendado').situacao, 'agendado');
  const acionavel = resultado.acionaveis.find((item) => item.nome === 'Habitual');
  assert.ok(acionavel.sugestao?.horario, 'sugere um horário livre');
});

test('ocupação da agenda e metas por profissional', () => {
  const { bruno, corte } = montarBarbearia();
  const hoje = dataLocal(Date.now() + DIA_MS);
  agendar({ profissional: bruno, servico: corte, data: hoje, hora: '09:00', codigo: 'OCP00001' });
  agendar({ profissional: bruno, servico: corte, data: hoje, hora: '10:00', telefone: '65933330002', codigo: 'OCP00002' });
  const ocupacao = captacao.ocupacaoAgenda(EMPRESA, { inicio: hoje, fim: hoje });
  const linha = ocupacao.profissionais.find((item) => item.nome === 'Bruno');
  assert.equal(linha.capacidadeMinutos, 12 * 60);
  assert.equal(linha.minutosAgendados, 60);
  assert.equal(linha.ocupacao, Number((60 / 720).toFixed(4)));
  assert.equal(ocupacao.capacidadeMinutos, 24 * 60, 'dois barbeiros');
  assert.throws(() => captacao.ocupacaoAgenda(EMPRESA, { inicio: hoje, fim: '2000-01-01' }), { code: 'PERIODO_INVALIDO' });

  const mes = hoje.slice(0, 7);
  captacao.salvarMetaProfissional(EMPRESA, { profissionalId: bruno.id, mes, receita: 5000, atendimentos: 100 });
  const painel = captacao.painelMetasProfissionais(EMPRESA, { mes });
  const meta = painel.profissionais.find((item) => item.nome === 'Bruno');
  assert.equal(meta.meta.receita, 5000);
  assert.equal(meta.progressoReceita, 0);
  assert.throws(() => captacao.salvarMetaProfissional(EMPRESA, { profissionalId: 'nao-existe', mes }), { code: 'PROFISSIONAL_NAO_ENCONTRADO' });
});

test('agenda única: com equipe na agenda da barbearia, a IA lê e grava nela', async () => {
  assert.equal(await agenda.agendaSource({ empresaId: EMPRESA }), 'postgres', 'sem equipe continua no caminho antigo');
  const { bruno, corte } = montarBarbearia();
  agenda.limparCacheFonteAgenda();
  assert.equal(await agenda.agendaSource({ empresaId: EMPRESA }), 'barbearia');
  const scope = { empresaId: EMPRESA, lojaId: LOJA, phone: '5565922220001' };
  const servicos = await agenda.listServices(scope);
  assert.deepEqual(servicos.map((item) => item.nome).sort(), ['Barba', 'Corte']);
  const dia = dataLocal(Date.now() + 2 * DIA_MS);
  const disponivel = await agenda.availability(scope, { serviceId: corte.id, professionalId: bruno.id, date: dia });
  assert.ok(disponivel.slots.includes('10:00'));

  // Um cliente do site ocupa 10:00 com o Bruno: a IA não enxerga mais esse horário.
  agendar({ profissional: bruno, servico: corte, data: dia, hora: '10:00', telefone: '65911119999', codigo: 'SITE0001' });
  assert.ok(!(await agenda.availability(scope, { serviceId: corte.id, professionalId: bruno.id, date: dia })).slots.includes('10:00'));
  await assert.rejects(agenda.createAppointment(null, scope, { serviceId: corte.id, professionalId: bruno.id, date: dia, time: '10:00', customerName: 'Pelo WhatsApp', customerPhone: scope.phone }), { code: 'SLOT_UNAVAILABLE' });

  const criado = await agenda.createAppointment(null, scope, { serviceId: corte.id, professionalId: 'qualquer', date: dia, time: '11:00', customerName: 'Pelo WhatsApp', customerPhone: scope.phone });
  assert.match(criado.codigo, /^[0-9A-F]{8}$/);
  const naAgenda = barbearia.listarAgendamentos(EMPRESA, {}).find((item) => item.id === criado.id);
  assert.equal(naAgenda.origem, 'whatsapp_ia', 'aparece na agenda do admin');
  const cliente = clientes.obterCliente(EMPRESA, naAgenda.clienteId);
  assert.equal(cliente.consentimentos.whatsapp.atendimento.concedido, true, 'avisos do próprio agendamento liberados');
  assert.notEqual(cliente.consentimentos.whatsapp.marketing?.concedido, true, 'marketing segue exigindo opt-in');

  const meus = await agenda.listCustomerAppointments(scope, {});
  assert.deepEqual(meus.map((item) => item.id), [criado.id]);
  const remarcado = await agenda.rescheduleAppointment(null, scope, { appointmentId: criado.id, date: dia, time: '14:00' });
  assert.equal(remarcado.horaLocal, '14:00');
  captacao.entrarListaEspera(EMPRESA, { nome: 'Espera', telefone: '65911118888', data: dia, servicoId: corte.id, periodo: 'tarde', consentimentoWhatsapp: true });
  const cancelado = await agenda.cancelAppointment(null, scope, criado.id);
  assert.equal(cancelado.status, 'cancelado');
  assert.equal(cancelado.listaEsperaCandidatos, 1);
  await assert.rejects(agenda.cancelAppointment(null, { ...scope, phone: '5565900000000' }, criado.id), { code: 'APPOINTMENT_NOT_FOUND' });
});

test('consentimento: o link público e a IA nunca religam o WhatsApp de quem respondeu SAIR', () => {
  montarBarbearia();
  const cliente = clientes.criarCliente(EMPRESA, { nome: 'Revogou', telefone: '65900001111' });
  assert.equal(captacao.registrarConsentimentoAtendimento(EMPRESA, cliente.id, 'teste'), true);
  clientes.atualizarConsentimentoCliente(EMPRESA, cliente.id, { canal: 'whatsapp', finalidade: 'atendimento', concedido: false, origem: 'whatsapp_opt_out' });
  assert.equal(captacao.registrarConsentimentoAtendimento(EMPRESA, cliente.id, 'agendamento_online_checkbox'), false);
  assert.equal(clientes.obterCliente(EMPRESA, cliente.id).consentimentos.whatsapp.atendimento.concedido, false);
});

test('clube: ativação com pagamento confirmado cobre só o 1º ciclo; pagamento sem referência é idempotente', () => {
  const { corte } = montarBarbearia();
  const cliente = clientes.criarCliente(EMPRESA, { nome: 'Confirmado', telefone: '65966660009' });
  const plano = barbearia.criarPlano(EMPRESA, { nome: 'Clube Mensal', preco: 99, sessoesIncluidas: 4, validadeDias: 30, servicosIds: [corte.id] });
  const inicio = Date.now() - DIA_MS;
  const assinatura = barbearia.criarAssinatura(EMPRESA, { planoId: plano.id, clienteId: cliente.id, clienteNome: cliente.nome, inicio: new Date(inicio).toISOString() });
  barbearia.alterarStatusAssinatura(EMPRESA, assinatura.id, 'ativa', { confirmadoSemCobranca: true, pagamentoConfirmado: true });
  assert.equal(captacao.resumoAssinatura(EMPRESA, assinatura.id).situacaoPagamento, 'em_dia');
  assert.equal(captacao.resumoAssinatura(EMPRESA, assinatura.id, { agora: inicio + 35 * DIA_MS }).situacaoPagamento, 'inadimplente', 'sem pagar o 2º ciclo, atrasa');
  const pago = captacao.registrarPagamentoAssinatura(EMPRESA, assinatura.id, { valor: 99 });
  assert.equal(pago.pagoAte.slice(0, 10), new Date(inicio + 60 * DIA_MS).toISOString().slice(0, 10), 'paga o 2º ciclo, contando do fim do 1º');
  assert.equal(captacao.registrarPagamentoAssinatura(EMPRESA, assinatura.id, { valor: 99, referencia: `${assinatura.id}:ate:${new Date(inicio + 30 * DIA_MS).toISOString().slice(0, 10)}` }).repetido, true, 'mesmo período não é pago duas vezes');
});

test('ocupação: atendimento coberto pelo plano não conta como receita avulsa', () => {
  const { bruno, corte } = montarBarbearia();
  const cliente = clientes.criarCliente(EMPRESA, { nome: 'Plano', telefone: '65966660010' });
  const plano = barbearia.criarPlano(EMPRESA, { nome: 'Clube', preco: 99, sessoesIncluidas: 4, validadeDias: 30 });
  const assinatura = barbearia.criarAssinatura(EMPRESA, { planoId: plano.id, clienteId: cliente.id, clienteNome: cliente.nome, inicio: new Date(Date.now() - DIA_MS).toISOString() });
  barbearia.alterarStatusAssinatura(EMPRESA, assinatura.id, 'ativa', { confirmadoSemCobranca: true, pagamentoConfirmado: true });
  const dia = dataLocal(Date.now() - 3600000);
  const ag = concluir(agendar({ profissional: bruno, servico: corte, data: dia, hora: '08:00', nome: cliente.nome, telefone: cliente.telefone, clienteId: cliente.id, codigo: 'PLN00001' }));
  assert.equal(captacao.consumirAssinaturaNaConclusao(EMPRESA, ag).usosNoCiclo, 1);
  const linha = captacao.ocupacaoAgenda(EMPRESA, { inicio: dia, fim: dia }).profissionais.find((item) => item.nome === 'Bruno');
  assert.equal(linha.receita, 0);
  assert.equal(linha.cobertosPeloPlano, 1);
});

// ---------------------------------------------------------------------------
// Onda 2: IA que vende (plano do cliente, clube pela frequência, produto pós-serviço)
// ---------------------------------------------------------------------------
const tools = await import('./core/whatsapp-ai-tools.js');
const { db: pg } = await import('./core/database.js');

const CONTEXTO_IA = {
  empresaId: EMPRESA,
  lojaId: LOJA,
  canalId: '33333333-3333-4333-8333-333333333333',
  sessionId: '44444444-4444-4444-8444-444444444444',
  externalEventId: 'MSG-ONDA2',
};

function visitasConcluidas({ profissional, servico, telefone, nome, quantas, clienteId, hora = '09:00' }) {
  for (let i = 0; i < quantas; i += 1) {
    const dia = dataLocal(Date.now() - (2 + i * 6) * DIA_MS);
    concluir(agendar({ profissional, servico, data: dia, hora, nome, telefone, clienteId, codigo: `V${hora.replace(':', '')}${String(i).padStart(3, '0')}` }));
  }
}

async function comFonteBarbearia(fn) {
  const anterior = process.env.BARBEARIA_AGENDA_FONTE;
  process.env.BARBEARIA_AGENDA_FONTE = 'barbearia';
  const { queryRead, transaction } = pg;
  pg.queryRead = async () => ({ rows: [] }); // sem loja virtual no teste
  pg.transaction = async (cb) => cb({ query: async () => ({ rows: [] }) });
  try { return await fn(); } finally {
    pg.queryRead = queryRead; pg.transaction = transaction;
    if (anterior === undefined) delete process.env.BARBEARIA_AGENDA_FONTE; else process.env.BARBEARIA_AGENDA_FONTE = anterior;
  }
}

test('onda 2: plano do próprio cliente com saldo do ciclo; clube só pela frequência, sem citar gasto', () => {
  const { bruno, corte } = montarBarbearia();
  barbearia.criarPlano(EMPRESA, { nome: 'Clube Corte', preco: 120, sessoesIncluidas: 4, validadeDias: 30, servicosIds: [corte.id] });
  // Avulso frequente: 6 cortes de R$ 50 em 60 dias = R$ 150/mês > R$ 120 do plano.
  visitasConcluidas({ profissional: bruno, servico: corte, telefone: '65988880001', nome: 'Frequente', quantas: 6 });
  const clube = captacao.clubeParaTelefone(EMPRESA, '(65) 98888-0001');
  assert.equal(clube.elegivel, true);
  assert.equal(clube.plano.nome, 'Clube Corte');
  assert.equal(clube.visitasPorMes, 3);
  assert.equal(JSON.stringify(clube).includes('gasto'), false, 'não expõe gasto');
  // Pouca frequência: não compensa.
  visitasConcluidas({ profissional: bruno, servico: corte, telefone: '65988880002', nome: 'Raro', quantas: 1, hora: '10:00' });
  assert.equal(captacao.clubeParaTelefone(EMPRESA, '65988880002').motivo, 'poucas_visitas');

  // Assinante: saldo do ciclo e não é candidato ao clube de novo.
  const cliente = clientes.criarCliente(EMPRESA, { nome: 'Assinante', telefone: '65988880003' });
  const plano = barbearia.listarPlanos(EMPRESA)[0];
  const assinatura = barbearia.criarAssinatura(EMPRESA, { planoId: plano.id, clienteId: cliente.id, clienteNome: cliente.nome, inicio: new Date(Date.now() - DIA_MS).toISOString() });
  barbearia.alterarStatusAssinatura(EMPRESA, assinatura.id, 'ativa', { confirmadoSemCobranca: true, pagamentoConfirmado: true });
  const meu = captacao.planoDoTelefone(EMPRESA, '65988880003');
  assert.equal(meu.plano, 'Clube Corte');
  assert.equal(meu.restantes, 4);
  assert.equal(meu.pagamentoEmDia, true);
  assert.deepEqual(meu.servicosIncluidos, ['Corte']);
  assert.equal(captacao.clubeParaTelefone(EMPRESA, '65988880003').motivo, 'ja_assinante');
  assert.equal(captacao.planoDoTelefone(EMPRESA, '65900000000'), null);
});

test('onda 2: produto pós-serviço usa o último serviço recente', () => {
  const { bruno, barba } = montarBarbearia();
  assert.equal(captacao.sugestaoPosServico(EMPRESA, '65988880010'), null);
  visitasConcluidas({ profissional: bruno, servico: barba, telefone: '65988880010', nome: 'Barbudo', quantas: 1 });
  const sugestao = captacao.sugestaoPosServico(EMPRESA, '65988880010');
  assert.equal(sugestao.servico, 'Barba');
  assert.deepEqual(sugestao.palavras, ['barba', 'óleo', 'balm']);
});

test('onda 2: ferramentas da IA respeitam pedido do cliente ou oportunidade liberada', async () => {
  const { bruno, corte } = montarBarbearia();
  barbearia.criarPlano(EMPRESA, { nome: 'Clube Corte', preco: 120, sessoesIncluidas: 4, validadeDias: 30, servicosIds: [corte.id] });
  visitasConcluidas({ profissional: bruno, servico: corte, telefone: '5565988880020', nome: 'Frequente', quantas: 6 });
  await comFonteBarbearia(async () => {
    const base = { ...CONTEXTO_IA, phone: '5565988880020' };
    const plano = await tools.createWhatsappAiToolExecutor({ ...base, customerText: 'quantos cortes ainda tenho no plano?' })('consultar_meu_plano', {});
    assert.equal(plano.assinante, false);

    // "Quero um plano VIP, quais os valores?": a IA lista o catálogo real em vez de dizer que não tem acesso.
    const catalogo = await tools.createWhatsappAiToolExecutor({ ...base, customerText: 'quero um plano vip, quais são os valores?' })('listar_planos', {});
    assert.equal(catalogo.ok, true);
    assert.deepEqual(catalogo.planos.map((item) => [item.nome, item.preco, item.servicosIncluidos]), [['Clube Corte', 120, ['Corte']]]);

    // Sem o cliente pedir e sem oportunidade liberada: bloqueado.
    await assert.rejects(
      () => tools.createWhatsappAiToolExecutor({ ...base, customerText: 'obrigado!' })('avaliar_clube', {}),
      (error) => error.code === 'OPPORTUNITY_REQUIRED',
    );
    // O cliente perguntou do clube: avalia pela frequência.
    const pedido = await tools.createWhatsappAiToolExecutor({ ...base, customerText: 'Vale a pena o clube de vocês?' })('avaliar_clube', {});
    assert.equal(pedido.avaliacao.elegivel, true);

    // Oportunidade não solicitada: o gate exige consentimento e só libera "clube" porque a frequência compensa.
    const perfil = { consent: { personalization: true, marketing: true }, observedFacts: { frequentProductCategories: [] } };
    const contexto = { ...base, customerText: 'Confirmado, obrigado', customerProfile: perfil, opportunityPolicy: { opportunitiesEnabled: true, maxOpportunities: 1 }, sessionSnapshot: {} };
    const executar = tools.createWhatsappAiToolExecutor(contexto);
    await executar('consultar_meus_agendamentos', {});
    const liberada = await executar('propor_oportunidade', { category: 'clube' });
    assert.equal(liberada.allowed, true);
    const oferta = await executar('avaliar_clube', {});
    assert.equal(oferta.avaliacao.plano.nome, 'Clube Corte');

    // Sem consentimento de personalização o gate bloqueia.
    const semConsentimento = tools.createWhatsappAiToolExecutor({ ...contexto, customerProfile: { consent: { personalization: false, marketing: true } } });
    await semConsentimento('consultar_meus_agendamentos', {});
    await assert.rejects(() => semConsentimento('propor_oportunidade', { category: 'clube' }), (error) => error.code === 'PERSONALIZATION_NOT_GRANTED');

    // "indica"/"recomenda" sem produto não é pedido de produto.
    await assert.rejects(
      () => tools.createWhatsappAiToolExecutor({ ...base, customerText: 'me indica um horário amanhã' })('sugerir_produto_pos_servico', {}),
      (error) => error.code === 'OPPORTUNITY_REQUIRED',
    );
    await assert.rejects(
      () => tools.createWhatsappAiToolExecutor({ ...base, customerText: 'preciso assinar algo?' })('avaliar_clube', {}),
      (error) => error.code === 'OPPORTUNITY_REQUIRED',
    );
    // Produto pós-serviço: sem loja virtual configurada, não inventa produto.
    const produto = await tools.createWhatsappAiToolExecutor({ ...base, customerText: 'qual óleo ou pomada você recomenda?' })('sugerir_produto_pos_servico', {});
    assert.equal(produto.sugestao.servico, 'Corte');
    assert.deepEqual(produto.produtos, []);
  });
});

test('NPS interno: só atendimento concluído, uma vez por atendimento e indicadores da agenda existente', () => {
  const { bruno, corte } = montarBarbearia();
  db().barbeariaCaptacao = { [EMPRESA]: { configuracao: { googleReviewUrl: 'https://g.page/r/antigo/review' } } };
  assert.equal(Object.hasOwn(captacao.obterConfiguracaoCaptacao(EMPRESA), 'googleReviewUrl'), false, 'link legado é ignorado');
  assert.throws(() => captacao.salvarConfiguracaoCaptacao(EMPRESA, { googleReviewUrl: 'https://g.page/r/dino-teste/review' }), (e) => e.code === 'EXTERNAL_REVIEW_DISABLED');
  assert.equal(Object.hasOwn(captacao.obterConfiguracaoCaptacao(EMPRESA), 'googleReviewUrl'), false);
  const futuro = agendar({ profissional: bruno, servico: corte, data: dataLocal(Date.now() + 2 * DIA_MS), hora: '10:00', telefone: '65977770100', codigo: 'NPSFUT01' });
  assert.throws(() => captacao.registrarAvaliacao(EMPRESA, { codigo: futuro.codigoConfirmacao, telefone: '65977770100', nota: 10, lojaId: LOJA }), (e) => e.code === 'ATENDIMENTO_NAO_CONCLUIDO');
  const feito = concluir(agendar({ profissional: bruno, servico: corte, data: dataLocal(Date.now() - DIA_MS), hora: '10:00', nome: 'Paulo Promotor', telefone: '65977770101', codigo: 'NPSOK001' }));
  assert.throws(() => captacao.registrarAvaliacao(EMPRESA, { codigo: 'NPSOK001', telefone: '65900000000', nota: 10, lojaId: LOJA }), (e) => e.code === 'AGENDAMENTO_NAO_ENCONTRADO');
  assert.throws(() => captacao.registrarAvaliacao(EMPRESA, { codigo: 'NPSOK001', telefone: '65977770101', nota: 11, lojaId: LOJA }), (e) => e.code === 'NOTA_INVALIDA');
  assert.throws(() => captacao.registrarAvaliacao(EMPRESA, { codigo: feito.codigoConfirmacao, telefone: '65977770101', nota: 10, lojaId: 'outra-loja' }), (e) => e.code === 'AGENDAMENTO_NAO_ENCONTRADO');
  const promotor = captacao.registrarAvaliacao(EMPRESA, { codigo: feito.codigoConfirmacao, telefone: '(65) 97777-0101', nota: 10, comentario: 'Excelente', lojaId: LOJA });
  assert.deepEqual(promotor, { repetida: false, nota: 10 });
  assert.equal(captacao.registrarAvaliacao(EMPRESA, { codigo: 'NPSOK001', telefone: '65977770101', nota: 2, lojaId: LOJA }).repetida, true, 'não troca a nota');
  const detrator = concluir(agendar({ profissional: bruno, servico: corte, data: dataLocal(Date.now() - DIA_MS), hora: '11:00', nome: 'Dani', telefone: '65977770102', codigo: 'NPSDET01' }));
  assert.deepEqual(captacao.registrarAvaliacao(EMPRESA, { codigo: detrator.codigoConfirmacao, telefone: '65977770102', nota: 4, comentario: 'Atrasou', lojaId: LOJA }), { repetida: false, nota: 4 });
  const painel = captacao.painelNps(EMPRESA);
  assert.equal(painel.respostas, 2);
  assert.equal(painel.nps, 0);
  assert.equal(painel.atendimentosConcluidos, 2);
  assert.equal(painel.taxaResposta, 100);
  assert.deepEqual(painel.distribuicao.filter((item) => item.respostas), [{ nota: 4, respostas: 1 }, { nota: 10, respostas: 1 }]);
  assert.equal(painel.evolucaoMensal.at(-1)?.respostas, 2);
  assert.equal(captacao.painelNps(EMPRESA, { lojaId: 'outra-loja' }).respostas, 0);
  assert.equal(captacao.painelNps('outra-empresa').respostas, 0);
  assert.equal(captacao.painelNps(EMPRESA, { inicio: '2099-01-01' }).nps, null);
  assert.equal(painel.porProfissional[0].nome, 'Bruno');
  assert.equal(painel.comentarios.length, 2);
  assert.equal(JSON.stringify(painel).includes('65977770101'), false, 'painel não expõe telefone');
  assert.equal(JSON.stringify(painel).includes('Paulo Promotor'), false, 'comentário não expõe nome do cliente');
  assert.equal(JSON.stringify(painel).includes('googleReviewUrl'), false, 'API não anuncia review externo');
});

test('NPS: pedido de avaliação só com link público, código e consentimento', async () => {
  const notificacoes = await import('./core/barbershop-appointment-notifications.js');
  const { bruno, corte } = montarBarbearia();
  const cliente = clientes.criarCliente(EMPRESA, { nome: 'Sem Consentimento', telefone: '65977770200' });
  const feito = concluir(agendar({ profissional: bruno, servico: corte, data: dataLocal(Date.now() - 3600000), hora: '08:30', nome: cliente.nome, telefone: cliente.telefone, clienteId: cliente.id, codigo: 'NPSPED01' }));
  const anterior = process.env.PUBLIC_BASE_URL;
  const ambienteAnterior = process.env.NODE_ENV;
  try {
    delete process.env.PUBLIC_BASE_URL; delete process.env.SERVER_URL; delete process.env.PUBLIC_APP_URL;
    const contexto = { empresaId: EMPRESA, lojaId: LOJA, legacyEmpresaId: EMPRESA };
    assert.equal((await notificacoes.queueReviewRequest(contexto, feito)).reason, 'review_link_unavailable');
    process.env.PUBLIC_BASE_URL = 'https://dino.kytto.com.br/';
    assert.equal(notificacoes.linkAvaliacao(EMPRESA, feito), '', 'domínio Dino não serve outro slug');
    barbearia.atualizarConfiguracao(EMPRESA, { slugPublico: 'dino' });
    assert.equal(notificacoes.linkAvaliacao(EMPRESA, feito), 'https://dino.kytto.com.br/avaliar/dino');
    process.env.NODE_ENV = 'production';
    process.env.PUBLIC_BASE_URL = 'https://outro-exemplo.invalid';
    assert.equal(notificacoes.linkAvaliacao(EMPRESA, feito), '', 'produção não redireciona o cliente para outro domínio');
    process.env.PUBLIC_BASE_URL = 'https://dino.kytto.com.br';
    assert.equal(notificacoes.linkAvaliacao(EMPRESA, feito), 'https://dino.kytto.com.br/avaliar/dino');
    // Domínio próprio da barbearia (registro.br) tem prioridade quando configurado.
    process.env.DINO_PUBLIC_URL = 'https://dinobarbearia.com.br';
    assert.equal(notificacoes.linkAvaliacao(EMPRESA, feito), 'https://dinobarbearia.com.br/avaliar/dino');
    process.env.DINO_PUBLIC_URL = 'https://dinobarbearia.com.br.evil.test';
    assert.equal(notificacoes.linkAvaliacao(EMPRESA, feito), '', 'só domínios oficiais da Dino');
    delete process.env.DINO_PUBLIC_URL;
    if (ambienteAnterior === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = ambienteAnterior;
    assert.equal((await notificacoes.queueReviewRequest(contexto, feito)).reason, 'service_consent_required');
    const semCodigo = barbearia.criarAgendamento(EMPRESA, { clienteNome: 'Balcão', clienteTelefone: '65977770201', profissionalId: bruno.id, servicoId: corte.id, dataHora: isoLocal(dataLocal(Date.now() + DIA_MS), '15:00'), dataAgenda: dataLocal(Date.now() + DIA_MS), horaLocal: '15:00', lojaId: LOJA });
    // Na hora do envio confere de novo: sem consentimento ou já avaliado, não envia.
    const tarefa = { empresa_id: EMPRESA, loja_id: LOJA, payload: { legacyEmpresaId: EMPRESA, appointmentId: feito.id, customerId: cliente.id, eventType: 'avaliacao' } };
    assert.equal((await notificacoes.processAppointmentNotificationTask({ ...tarefa, empresa_id: 'outra-empresa' })).reason, 'tenant_scope_mismatch');
    assert.equal((await notificacoes.processAppointmentNotificationTask({ ...tarefa, payload: { ...tarefa.payload, customerId: 'outra-identidade' } })).reason, 'customer_changed');
    assert.equal((await notificacoes.processAppointmentNotificationTask(tarefa)).reason, 'service_consent_required');
    captacao.registrarAvaliacao(EMPRESA, { codigo: 'NPSPED01', telefone: cliente.telefone, nota: 8, lojaId: LOJA });
    assert.equal((await notificacoes.processAppointmentNotificationTask(tarefa)).reason, 'already_reviewed');
    assert.equal(semCodigo.codigoConfirmacao, '');
    assert.match(captacao.garantirCodigoConfirmacao(EMPRESA, semCodigo.id).codigoConfirmacao, /^[A-F0-9]{8}$/);
  } finally {
    if (ambienteAnterior === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = ambienteAnterior;
    if (anterior === undefined) delete process.env.PUBLIC_BASE_URL; else process.env.PUBLIC_BASE_URL = anterior;
  }
});

test('agendamento da IA preso no PostgreSQL migra para a agenda do admin (idempotente)', async () => {
  const { bruno, corte } = montarBarbearia();
  const dia = dataLocal(Date.now() + 2 * DIA_MS);
  const linhas = [
    { id: 'pg-1', loja_id: LOJA, cliente_nome: 'Rodrigo', cliente_telefone: '5514997462929', observacoes: null, dia, hora: '17:00', servico_nome: 'Corte', profissional_nome: 'Bruno Silva' },
    { id: 'pg-2', loja_id: LOJA, cliente_nome: 'Outro', cliente_telefone: '5565900000002', observacoes: null, dia, hora: '18:00', servico_nome: 'Serviço que não existe', profissional_nome: 'Bruno' },
  ];
  const updates = [];
  const deps = { queryRead: async () => ({ rows: linhas }), query: async (sql, params) => { updates.push(params[0]); return { rowCount: 1 }; } };
  const scope = { empresaId: EMPRESA, lojaId: LOJA };
  const primeira = await agenda.migrarAgendaPostgresParaBarbearia(scope, deps);
  assert.equal(primeira.migrados, 1);
  assert.equal(primeira.pendentes, 1, 'sem equivalente único não migra');
  assert.deepEqual(updates, ['pg-1'], 'só a linha migrada sai do PostgreSQL');
  const naAgenda = barbearia.listarAgendamentos(EMPRESA, {}).filter((item) => item.clienteTelefone === '5514997462929');
  assert.equal(naAgenda.length, 1);
  assert.equal(naAgenda[0].profissionalId, bruno.id);
  assert.equal(naAgenda[0].servicoId, corte.id);
  assert.equal(naAgenda[0].horaLocal, '17:00');
  const segunda = await agenda.migrarAgendaPostgresParaBarbearia(scope, deps);
  assert.equal(segunda.migrados, 1);
  assert.equal(barbearia.listarAgendamentos(EMPRESA, {}).filter((item) => item.clienteTelefone === '5514997462929').length, 1, 'repetir não duplica');
});
