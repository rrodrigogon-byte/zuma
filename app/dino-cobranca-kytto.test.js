// Cobranças da barbearia (onda 3): sinal, mensalidade do clube, cashback, canal
// de origem e receita atribuída à IA.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cobranca-')), 'db.json');
delete process.env.INFINITEPAY_HANDLE;
delete process.env.INFINITEPAY_TAG;

const test = (await import('node:test')).default;
const { beforeEach } = await import('node:test');
const assert = (await import('node:assert/strict')).default;
const { reset, db } = await import('./db.js');
const barbearia = await import('./barbearia-erp-kytto.js');
const clientes = await import('./clientes-contas-kytto.js');
const captacao = await import('./dino-captacao-kytto.js');
const cobranca = await import('./dino-cobranca-kytto.js');
const financeiro = await import('./financeiro-central-kytto.js');

const EMPRESA = '0f0e0d0c-1b2a-4c3d-8e9f-0123456789ab';
const LOJA = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const OUTRA_LOJA = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff';
const DIA_MS = 86400000;
const TODOS = [0, 1, 2, 3, 4, 5, 6];
const dataLocal = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba' }).format(new Date(ms));
const isoLocal = (data, hora) => new Date(`${data}T${hora}:00-04:00`).toISOString();

function montar() {
  barbearia.atualizarConfiguracao(EMPRESA, { horarioAbertura: '08:00', horarioFechamento: '20:00', diasFuncionamento: TODOS, antecedenciaMinutos: 0, janelaReservaDias: 60, slugPublico: 'dino-teste', nomePublico: 'Dino Teste' });
  const bruno = barbearia.criarProfissional(EMPRESA, { nome: 'Bruno', horarioInicio: '08:00', horarioFim: '20:00', diasTrabalho: TODOS });
  const corte = barbearia.criarServico(EMPRESA, { nome: 'Corte', preco: 50, duracaoMinutos: 30 });
  return { bruno, corte };
}
function agendar({ bruno, corte, dias = 1, hora = '10:00', telefone = '65999990001', nome = 'Cliente', clienteId, origem = 'agendamento_online' }) {
  const data = dataLocal(Date.now() + dias * DIA_MS);
  return barbearia.criarAgendamento(EMPRESA, { clienteId, clienteNome: nome, clienteTelefone: telefone, profissionalId: bruno.id, servicoId: corte.id, dataHora: isoLocal(data, hora), dataAgenda: data, horaLocal: hora, lojaId: LOJA, origem, codigoConfirmacao: `C${hora.replace(':', '')}${dias}`.padEnd(8, '0') });
}
function concluir(ag) {
  barbearia.alterarStatusAgendamento(EMPRESA, ag.id, 'em_atendimento');
  const concluido = barbearia.alterarStatusAgendamento(EMPRESA, ag.id, 'concluido');
  const agora = new Date().toISOString();
  const lancamento = financeiro.registrarLancamento(EMPRESA, {
    tipo: 'receita', categoria: 'Serviços', descricao: `Atendimento ${ag.id}`, valor: ag.valor,
    origem: 'barbearia_atendimento', status: 'pago', meioPagamento: 'pix', dataOperacao: agora, pagoEm: agora,
    lojaId: ag.lojaId, automatico: true, chaveIdempotencia: `barbearia_atendimento:${EMPRESA}:${ag.id}`,
    referencia: { agendamentoId: ag.id, servicoId: ag.servicoId, profissionalId: ag.profissionalId },
  });
  return barbearia.vincularLancamentoFinanceiro(EMPRESA, concluido.id, lancamento.id);
}
const PIX = { chave: '12.345.678/0001-90', nomeRecebedor: 'Barbearia Dino Ltda', cidade: 'Tangará da Serra' };

beforeEach(() => { reset(); delete process.env.INFINITEPAY_HANDLE; });

test('configuração: nada liga sem meio de cobrança; chave Pix é validada e normalizada', () => {
  assert.throws(() => cobranca.salvarConfiguracaoCobranca(EMPRESA, { sinal: { ativo: true } }), (e) => e.code === 'PROVEDOR_AUSENTE');
  assert.throws(() => cobranca.salvarConfiguracaoCobranca(EMPRESA, { pix: { chave: 'qualquer coisa' } }), (e) => e.code === 'PIX_CHAVE_INVALIDA');
  const config = cobranca.salvarConfiguracaoCobranca(EMPRESA, { pix: PIX, sinal: { ativo: true, tipo: 'percentual', valor: 30 } });
  assert.equal(config.provedor, 'pix_manual');
  assert.equal(config.pix.chave, '12345678000190');
  assert.equal(config.pix.cidade, 'TANGARA DA SERR');
  assert.equal(cobranca.valorDoSinal(EMPRESA, 50), 15);
});

test('contrato operacional: loja é obrigatória e provedor não aceita override interno', async () => {
  cobranca.salvarConfiguracaoCobranca(EMPRESA, { pix: PIX, sinal: { ativo: true, tipo: 'fixo', valor: 20 } });
  const base = montar();
  const ag = agendar({ ...base, telefone: '65999990111' });
  await assert.rejects(() => cobranca.criarSinalDoAgendamento(EMPRESA, { ...ag, lojaId: '' }), (e) => e.code === 'LOJA_OBRIGATORIA');
  await assert.rejects(() => cobranca.criarCobranca(EMPRESA, { tipo: 'sinal', referencia: 'sem-loja', valor: 20 }, { provedor: 'pix_manual' }), (e) => e.code === 'LOJA_OBRIGATORIA');
  const cob = await cobranca.criarCobranca(EMPRESA, { tipo: 'sinal', referencia: 'override-bloqueado', valor: 20, lojaId: LOJA }, { provedor: 'infinitepay' });
  assert.equal(cob.provedor, 'pix_manual');
});

test('sinal com Pix da barbearia: copia e cola válido, idempotente, confirmação manual confirma o horário e lança a receita uma vez', async () => {
  const base = montar();
  cobranca.salvarConfiguracaoCobranca(EMPRESA, { pix: PIX, sinal: { ativo: true, tipo: 'fixo', valor: 20, prazoMinutos: 30 } });
  const ag = agendar(base);
  const sinal = await cobranca.criarSinalDoAgendamento(EMPRESA, ag);
  assert.equal(sinal.valor, 20);
  assert.match(sinal.pixCopiaECola, /^000201.*BR\.GOV\.BCB\.PIX.*12345678000190.*5405?20\.00.*6304[0-9A-F]{4}$/);
  assert.equal((await cobranca.criarSinalDoAgendamento(EMPRESA, ag)).id, sinal.id, 'mesma referência devolve a mesma cobrança');
  const pago = cobranca.confirmarCobranca(EMPRESA, sinal.id, { origem: 'manual', usuario: 'gerente@dino', lojaId: LOJA });
  assert.equal(pago.status, 'paga');
  assert.equal(barbearia.listarAgendamentos(EMPRESA, {}).find((a) => a.id === ag.id).status, 'confirmado');
  assert.equal(cobranca.confirmarCobranca(EMPRESA, sinal.id, { origem: 'manual', lojaId: LOJA }).repetida, true);
  const lancamentos = financeiro.listarLancamentos ? financeiro.listarLancamentos(EMPRESA, {}) : [];
  if (Array.isArray(lancamentos) || Array.isArray(lancamentos?.lancamentos)) {
    const lista = Array.isArray(lancamentos) ? lancamentos : lancamentos.lancamentos;
    assert.equal(lista.filter((l) => l.origem === 'barbearia_cobranca').length, 1);
    const receita = lista.find((l) => l.origem === 'barbearia_cobranca');
    assert.equal(receita.lojaId, LOJA);
    assert.equal(receita.referencia.cobrancaId, sinal.id);
    assert.equal(receita.referencia.agendamentoId, ag.id);
  }
});

test('sinal não pago no prazo libera o horário; pago não expira', async () => {
  const base = montar();
  cobranca.salvarConfiguracaoCobranca(EMPRESA, { pix: PIX, sinal: { ativo: true, tipo: 'percentual', valor: 50, prazoMinutos: 10 } });
  const naoPago = agendar({ ...base, hora: '10:00' });
  const pago = agendar({ ...base, hora: '11:00', telefone: '65999990002' });
  await cobranca.criarSinalDoAgendamento(EMPRESA, naoPago);
  const sinalPago = await cobranca.criarSinalDoAgendamento(EMPRESA, pago);
  cobranca.confirmarCobranca(EMPRESA, sinalPago.id, { origem: 'manual', usuario: 'equipe', lojaId: LOJA });
  assert.equal(cobranca.expirarSinais({ agora: Date.now() + 11 * 60000 }).length, 0, 'tolerância de 5 minutos depois do prazo');
  const liberados = cobranca.expirarSinais({ agora: Date.now() + 16 * 60000 });
  assert.deepEqual(liberados.map((l) => l.agendamento.id), [naoPago.id]);
  const lista = barbearia.listarAgendamentos(EMPRESA, {});
  assert.equal(lista.find((a) => a.id === naoPago.id).status, 'cancelado');
  assert.equal(lista.find((a) => a.id === pago.id).status, 'confirmado');
  const expirado = cobranca.sinalDoAgendamento(EMPRESA, naoPago.id);
  assert.equal(expirado.status, 'expirada');
  // Pagou depois: o dinheiro é registrado, o horário continua liberado e a equipe é alertada.
  const tarde = cobranca.confirmarCobranca(EMPRESA, expirado.id, { origem: 'manual', usuario: 'equipe', lojaId: LOJA });
  assert.equal(tarde.status, 'paga');
  assert.equal(tarde.revisar, 'horario_liberado');
  assert.equal(barbearia.listarAgendamentos(EMPRESA, {}).find((a) => a.id === naoPago.id).status, 'cancelado');
  assert.equal(financeiro.listarLancamentos(EMPRESA, { origem: 'barbearia_cobranca' }).length, 2);
});

test('InfinitePay: confirmação só depois de conferir na InfinitePay; equipe não confirma na mão', async () => {
  const base = montar();
  process.env.INFINITEPAY_HANDLE = 'dino-teste';
  process.env.INFINITEPAY_BARBEARIA_EMPRESAS = 'outra-empresa';
  assert.equal(cobranca.provedorCobranca(EMPRESA), null, 'a conta InfinitePay do ambiente só vale para as empresas liberadas');
  process.env.INFINITEPAY_BARBEARIA_EMPRESAS = `outra-empresa,${EMPRESA}`;
  cobranca.salvarConfiguracaoCobranca(EMPRESA, { sinal: { ativo: true, tipo: 'fixo', valor: 25 } });
  const chamadas = [];
  const invoiceSlug = 'invoice-dino-teste';
  const adapter = {
    async createCheckout({ order }) { chamadas.push(['link', order.publicCode, order.total]); return { publicData: { url: `https://checkout.infinitepay.io/dino-teste/${order.publicCode}`, slug: invoiceSlug } }; },
    async verifyWebhook({ payload, context }) {
      chamadas.push(['check', payload.order_nsu, context.expectedAmount]);
      const captured = payload.transaction_nsu === 'pago';
      return captured ? { status: 'captured', amount: context.expectedAmount, providerPaymentId: payload.transaction_nsu, summary: { captureMethod: 'pix' } } : { status: 'pending', providerPaymentId: null };
    },
  };
  const ag = agendar(base);
  const sinal = await cobranca.criarSinalDoAgendamento(EMPRESA, ag, { adapter });
  assert.equal(sinal.provedor, 'infinitepay');
  assert.match(sinal.url, /^https:\/\/checkout\.infinitepay\.io\//);
  assert.equal(db().barbeariaCobranca[EMPRESA].cobrancas[sinal.id].invoiceSlug, invoiceSlug);
  assert.throws(() => cobranca.confirmarCobranca(EMPRESA, sinal.id, { origem: 'manual', lojaId: LOJA }), (e) => e.code === 'CONFIRMACAO_AUTOMATICA');
  const orderNsu = chamadas[0][1];
  await assert.rejects(() => cobranca.confirmarPelaInfinitePay({ order_nsu: orderNsu, transaction_nsu: 'ainda-nao' }, { adapter }), (e) => e.code === 'PAGAMENTO_INVOICE_SLUG_AUSENTE');
  await assert.rejects(() => cobranca.confirmarPelaInfinitePay({ order_nsu: orderNsu, transaction_nsu: 'ainda-nao', invoice_slug: 'slug-comercial-dino' }, { adapter }), (e) => e.code === 'PAGAMENTO_INVOICE_SLUG_DIVERGENTE');
  assert.equal(cobranca.obterCobranca(EMPRESA, sinal.id).status, 'pendente');
  const pendente = await cobranca.confirmarPelaInfinitePay({ order_nsu: orderNsu, transaction_nsu: 'ainda-nao', invoice_slug: invoiceSlug }, { adapter });
  assert.equal(pendente.pendente, true);
  const pago = await cobranca.confirmarPelaInfinitePay({ order_nsu: orderNsu, transaction_nsu: 'pago', invoice_slug: invoiceSlug }, { adapter });
  assert.equal(pago.status, 'paga');
  assert.equal(pago.providerPaymentId, 'pago');
  assert.equal(pago.confirmationEvidence.invoiceSlug, invoiceSlug);
  assert.equal(pago.confirmationEvidence.orderNsu, orderNsu);
  assert.equal(pago.confirmationEvidence.transactionNsu, 'pago');
  assert.equal(pago.confirmationEvidence.value, 25);
  assert.equal(pago.confirmationEvidence.method, 'pix');
  assert.match(pago.confirmationEvidence.payloadHash, /^[0-9a-f]{64}$/);
  const replay = await cobranca.confirmarPelaInfinitePay({ order_nsu: orderNsu, transaction_nsu: 'pago', invoice_slug: invoiceSlug }, { adapter });
  assert.equal(replay.repetida, true);
  await assert.rejects(() => cobranca.confirmarPelaInfinitePay({ order_nsu: orderNsu, transaction_nsu: 'outro-pagamento', invoice_slug: invoiceSlug }, { adapter }), (e) => e.code === 'PAGAMENTO_REPLAY_CONFLICT');
  await assert.rejects(() => cobranca.confirmarPelaInfinitePay({ order_nsu: orderNsu, transaction_nsu: 'pago' }, { adapter }), (e) => e.code === 'PAGAMENTO_INVOICE_SLUG_AUSENTE');
  assert.deepEqual(chamadas.filter((c) => c[0] === 'check').map((c) => c[2]), [25, 25], 'confere o valor esperado');
  await assert.rejects(() => cobranca.confirmarPelaInfinitePay({ order_nsu: 'DINOSINVENTADO', transaction_nsu: 'pago', slug: 's' }, { adapter }), (e) => e.status === 404);
  // Horário cancelado com sinal pendente: a cobrança é cancelada; se o cliente pagar mesmo assim, vira "revisar" (sem erro em loop).
  const outro = agendar({ ...base, hora: '12:00', telefone: '65999990009' });
  const sinal2 = await cobranca.criarSinalDoAgendamento(EMPRESA, outro, { adapter });
  barbearia.alterarStatusAgendamento(EMPRESA, outro.id, 'cancelado', { motivoCancelamento: 'solicitado_pelo_cliente' });
  assert.equal(cobranca.cancelarSinalPendente(EMPRESA, outro.id, LOJA), true);
  const nsu2 = chamadas.filter((c) => c[0] === 'link').at(-1)[1];
  const pagoCancelado = await cobranca.confirmarPelaInfinitePay({ order_nsu: nsu2, transaction_nsu: 'pago', invoice_slug: invoiceSlug }, { adapter });
  assert.equal(pagoCancelado.status, 'paga');
  assert.equal(pagoCancelado.revisar, 'cobranca_cancelada');
  assert.equal(cobranca.obterCobranca(EMPRESA, sinal2.id).pagoAposCancelar, true);
  delete process.env.INFINITEPAY_BARBEARIA_EMPRESAS;
});

test('InfinitePay: checkout sem invoice_slug não cria cobrança confirmável', async () => {
  const base = montar();
  process.env.INFINITEPAY_HANDLE = 'dino-teste';
  process.env.INFINITEPAY_BARBEARIA_EMPRESAS = EMPRESA;
  cobranca.salvarConfiguracaoCobranca(EMPRESA, { sinal: { ativo: true, tipo: 'fixo', valor: 25 } });
  const adapter = { async createCheckout() { return { publicData: { url: 'https://checkout.infinitepay.io/sem-slug' } }; } };
  const ag = agendar({ ...base, telefone: '65999990003' });
  await assert.rejects(() => cobranca.criarSinalDoAgendamento(EMPRESA, ag, { adapter }), (e) => e.code === 'PROVEDOR_SEM_INVOICE_SLUG');
  assert.equal(cobranca.listarCobrancas(EMPRESA).length, 0);
  delete process.env.INFINITEPAY_BARBEARIA_EMPRESAS;
});

test('InfinitePay: valor e método divergentes nunca confirmam a cobrança', async () => {
  const base = montar();
  process.env.INFINITEPAY_HANDLE = 'dino-teste';
  process.env.INFINITEPAY_BARBEARIA_EMPRESAS = EMPRESA;
  cobranca.salvarConfiguracaoCobranca(EMPRESA, { sinal: { ativo: true, tipo: 'fixo', valor: 25 } });
  let verificado = { amount: 24, captureMethod: 'pix' };
  const invoiceSlug = 'invoice-validado';
  const adapter = {
    async createCheckout() { return { publicData: { url: 'https://checkout.infinitepay.io/validado', slug: invoiceSlug } }; },
    async verifyWebhook() { return { status: 'captured', amount: verificado.amount, providerPaymentId: 'tx-validado', summary: { captureMethod: verificado.captureMethod } }; },
  };
  const ag = agendar({ ...base, telefone: '65999990004' });
  const sinal = await cobranca.criarSinalDoAgendamento(EMPRESA, ag, { adapter });
  const payload = { order_nsu: db().barbeariaCobranca[EMPRESA].cobrancas[sinal.id].orderNsu, transaction_nsu: 'tx-validado', invoice_slug: invoiceSlug };
  await assert.rejects(() => cobranca.confirmarPelaInfinitePay(payload, { adapter }), (e) => e.code === 'PAGAMENTO_VALOR_DIVERGENTE');
  assert.equal(cobranca.obterCobranca(EMPRESA, sinal.id).status, 'pendente');
  verificado = { amount: 25, captureMethod: 'boleto' };
  await assert.rejects(() => cobranca.confirmarPelaInfinitePay(payload, { adapter }), (e) => e.code === 'PAGAMENTO_METODO_DIVERGENTE');
  assert.equal(cobranca.obterCobranca(EMPRESA, sinal.id).status, 'pendente');
  verificado = { amount: 25, captureMethod: 'pix' };
  assert.equal((await cobranca.confirmarPelaInfinitePay(payload, { adapter })).status, 'paga');
  delete process.env.INFINITEPAY_BARBEARIA_EMPRESAS;
});

test('clube: cobrança do próximo ciclo com a mesma referência do pagamento manual; pagar quita o ciclo uma vez só', async () => {
  const { corte } = montar();
  cobranca.salvarConfiguracaoCobranca(EMPRESA, { pix: PIX, cobrancaClube: { ativa: true, diasAntes: 3 } });
  const cliente = clientes.criarCliente(EMPRESA, { nome: 'Assinante', telefone: '65988880001' });
  const plano = barbearia.criarPlano(EMPRESA, { nome: 'Clube', preco: 99, sessoesIncluidas: 4, validadeDias: 30, servicosIds: [corte.id] });
  const inicio = Date.now() - 28 * DIA_MS;
  const ass = barbearia.criarAssinatura(EMPRESA, { planoId: plano.id, clienteId: cliente.id, clienteNome: cliente.nome, lojaId: LOJA, inicio: new Date(inicio).toISOString() });
  barbearia.alterarStatusAssinatura(EMPRESA, ass.id, 'ativa', { confirmadoSemCobranca: true, pagamentoConfirmado: true });
  const pagoAteAntes = captacao.resumoAssinatura(EMPRESA, ass.id).pagoAte;
  const [cob] = await cobranca.gerarCobrancasDoClube(EMPRESA, { lojaId: LOJA });
  assert.equal(cob.valor, 99);
  assert.equal(cob.referencia, `${ass.id}:ate:${pagoAteAntes.slice(0, 10)}`);
  assert.equal((await cobranca.gerarCobrancasDoClube(EMPRESA, { lojaId: LOJA })).length, 1, 'rodar de novo devolve a mesma cobrança');
  assert.equal(cobranca.listarCobrancas(EMPRESA, { tipo: 'assinatura' }).length, 1);
  cobranca.confirmarCobranca(EMPRESA, cob.id, { origem: 'manual', usuario: 'equipe', lojaId: LOJA });
  const depois = captacao.resumoAssinatura(EMPRESA, ass.id);
  assert.equal(new Date(depois.pagoAte).valueOf() - new Date(pagoAteAntes).valueOf(), 30 * DIA_MS);
  // Registrar o mesmo período no balcão não paga de novo.
  assert.equal(captacao.registrarPagamentoAssinatura(EMPRESA, ass.id, { valor: 99, referencia: cob.referencia }).repetido, true);

  // Próximo ciclo: link enviado, mas o cliente paga no balcão. O link pendente é cancelado.
  const [proxima] = await cobranca.gerarCobrancasDoClube(EMPRESA, { agora: Date.now() + 30 * DIA_MS, lojaId: LOJA });
  assert.notEqual(proxima.id, cob.id);
  captacao.registrarPagamentoAssinatura(EMPRESA, ass.id, { valor: 99 });
  assert.equal(cobranca.cancelarCobrancasClubeQuitadas(EMPRESA, ass.id, { lojaId: LOJA }), 1);
  assert.equal(cobranca.obterCobranca(EMPRESA, proxima.id).status, 'cancelada');
  // Se mesmo assim pagar o link: dinheiro registrado e marcado para devolver.
  const emDobro = cobranca.confirmarCobranca(EMPRESA, proxima.id, { origem: 'manual', usuario: 'equipe', lojaId: LOJA });
  assert.equal(emDobro.revisar, 'cobranca_cancelada');
});

test('pagamento cujo efeito falha ainda é lançado no financeiro e fica para revisão', async () => {
  const { corte } = montar();
  cobranca.salvarConfiguracaoCobranca(EMPRESA, { pix: PIX, cobrancaClube: { ativa: true, diasAntes: 3 } });
  const cliente = clientes.criarCliente(EMPRESA, { nome: 'Encerrou', telefone: '65988880002' });
  const plano = barbearia.criarPlano(EMPRESA, { nome: 'Clube', preco: 99, sessoesIncluidas: 4, validadeDias: 30, servicosIds: [corte.id] });
  const ass = barbearia.criarAssinatura(EMPRESA, { planoId: plano.id, clienteId: cliente.id, clienteNome: cliente.nome, lojaId: LOJA, inicio: new Date(Date.now() - 28 * DIA_MS).toISOString() });
  barbearia.alterarStatusAssinatura(EMPRESA, ass.id, 'ativa', { confirmadoSemCobranca: true, pagamentoConfirmado: true });
  const [cob] = await cobranca.gerarCobrancasDoClube(EMPRESA, { lojaId: LOJA });
  barbearia.alterarStatusAssinatura(EMPRESA, ass.id, 'cancelada', { motivo: 'cliente pediu' });
  const pago = cobranca.confirmarCobranca(EMPRESA, cob.id, { origem: 'manual', usuario: 'equipe', lojaId: LOJA });
  assert.equal(pago.status, 'paga');
  assert.equal(pago.revisar, 'efeito_nao_aplicado');
  assert.ok(pago.efeitoErro);
  assert.equal(financeiro.listarLancamentos(EMPRESA, { origem: 'barbearia_cobranca' }).length, 1);
});

test('cashback: crédito do atendimento pago, uso por ordem de chegada, vencimento e saldo nunca negativo', () => {
  const base = montar();
  assert.equal(cobranca.creditarCashback(EMPRESA, concluir(agendar({ ...base, dias: -3, hora: '09:00' })), { base: 50, lojaId: LOJA }), null, 'desligado por padrão');
  cobranca.salvarConfiguracaoCobranca(EMPRESA, { cashback: { percentual: 10, validadeDias: 30 } });
  const a1 = concluir(agendar({ ...base, dias: -2, hora: '10:00' }));
  const credito = cobranca.creditarCashback(EMPRESA, a1, { base: 50, lojaId: LOJA });
  assert.equal(credito.creditado, 5);
  const digitadoErrado = concluir(agendar({ ...base, dias: -2, hora: '11:00', telefone: '65999990077' }));
  assert.equal(cobranca.creditarCashback(EMPRESA, digitadoErrado, { base: 5000, lojaId: LOJA }).creditado, 5, 'base acima do preço não vira crédito');
  assert.equal(cobranca.creditarCashback(EMPRESA, a1, { base: 50, lojaId: LOJA }).saldo, 5, 'idempotente por atendimento');
  assert.throws(() => cobranca.usarCashback(EMPRESA, { telefone: '65999990001', valor: 6, referencia: 'x' }, { lojaId: LOJA }), (e) => e.code === 'SALDO_INSUFICIENTE');
  const uso = cobranca.usarCashback(EMPRESA, { telefone: '(65) 99999-0001', valor: 3, referencia: 'atendimento:2' }, { lojaId: LOJA });
  assert.equal(uso.saldo, 2);
  assert.equal(cobranca.usarCashback(EMPRESA, { telefone: '65999990001', valor: 3, referencia: 'atendimento:2' }, { lojaId: LOJA }).repetido, true);
  assert.equal(cobranca.saldoCashback(EMPRESA, '65999990001', { agora: Date.now() + 31 * DIA_MS, lojaId: LOJA }).saldo, 0, 'crédito vencido some');
});

test('origem dos clientes e receita atribuída à IA', () => {
  const base = montar();
  const doGoogle = agendar({ ...base, dias: -1, hora: '09:00', telefone: '65977770001' });
  captacao.registrarCanalAgendamento(EMPRESA, doGoogle.id, { canal: 'GBP', campanha: 'perfil' });
  concluir(doGoogle);
  const daIa = agendar({ ...base, dias: -1, hora: '10:00', telefone: '65977770002', origem: 'whatsapp_ia' });
  concluir(daIa);
  const volta = agendar({ ...base, dias: 2, hora: '11:00', telefone: '65977770001' });
  captacao.registrarCanalAgendamento(EMPRESA, volta.id, { canal: 'google' });
  const dia = dataLocal(Date.now() - DIA_MS);
  const painel = captacao.painelCanais(EMPRESA, { inicio: dia, fim: dataLocal(Date.now() + 3 * DIA_MS) });
  const google = painel.canais.find((c) => c.canal === 'Google');
  assert.equal(google.agendamentos, 2);
  assert.equal(google.clientesNovos, 1, 'a segunda visita do mesmo telefone não é cliente novo');
  assert.equal(google.receita, 50);
  assert.equal(painel.canais.find((c) => c.canal === 'WhatsApp (IA)').clientesNovos, 1);
  assert.equal(captacao.normalizarCanal('<script>'), 'script');
  const receita = captacao.painelReceitaIa(EMPRESA, { inicio: dia, fim: dia });
  assert.equal(receita.fontes.find((f) => f.fonte.startsWith('Atendente IA')).receita, 50);
  assert.equal(receita.receitaTotal, 50);
});

test('vale-presente: compra online só vale depois de pago; uso com saldo; balcão lança a receita; vencido não usa', async () => {
  montar();
  await assert.rejects(() => cobranca.comprarVale(EMPRESA, { valor: 100, deNome: 'Ana', deTelefone: '65911112222', lojaId: LOJA }), (e) => e.code === 'PROVEDOR_AUSENTE');
  cobranca.salvarConfiguracaoCobranca(EMPRESA, { pix: PIX });
  await assert.rejects(() => cobranca.comprarVale(EMPRESA, { valor: 100, deNome: 'Ana', deTelefone: '65911112222', lojaId: LOJA }), (e) => e.code === 'VALE_DESLIGADO');
  cobranca.salvarConfiguracaoCobranca(EMPRESA, { vale: { ativo: true } });
  assert.equal(cobranca.obterConfiguracaoCobranca(EMPRESA).vale.ativo, true, 'configuração do vale persiste');
  await assert.rejects(() => cobranca.comprarVale(EMPRESA, { valor: 5, deNome: 'Ana', deTelefone: '65911112222', lojaId: LOJA }), (e) => e.code === 'VALE_VALOR_INVALIDO');
  const compra = await cobranca.comprarVale(EMPRESA, { valor: 100, deNome: 'Ana', deTelefone: '65911112222', paraNome: 'João', lojaId: LOJA });
  assert.match(compra.vale.codigo, /^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
  assert.match(compra.pagamento.pixCopiaECola, /^000201/);
  assert.throws(() => cobranca.saldoUtilVale(EMPRESA, compra.vale.codigo, LOJA), (e) => e.code === 'VALE_INATIVO', 'não vale antes de pagar');
  const cob = cobranca.listarCobrancas(EMPRESA, { tipo: 'vale' })[0];
  cobranca.confirmarCobranca(EMPRESA, cob.id, { origem: 'manual', usuario: 'gerente', lojaId: LOJA });
  assert.equal(cobranca.consultarVale(EMPRESA, compra.vale.codigo.replace('-', '').toLowerCase(), LOJA).saldo, 100);
  assert.throws(() => cobranca.usarVale(EMPRESA, { codigo: compra.vale.codigo, valor: 150, referencia: 'a1', lojaId: LOJA }), (e) => e.code === 'SALDO_INSUFICIENTE');
  assert.equal(cobranca.usarVale(EMPRESA, { codigo: compra.vale.codigo, valor: 60, referencia: 'a1', lojaId: LOJA }).saldo, 40);
  assert.equal(cobranca.usarVale(EMPRESA, { codigo: compra.vale.codigo, valor: 60, referencia: 'a1', lojaId: LOJA }).repetido, true);
  assert.throws(() => cobranca.cancelarVale(EMPRESA, compra.vale.id, { lojaId: LOJA }), (e) => e.code === 'VALE_USADO');
  // Desfazer o uso (conclusão que não gravou) devolve o saldo.
  cobranca.desfazerUsos(EMPRESA, { codigoVale: compra.vale.codigo, referencia: 'a1' });
  assert.equal(cobranca.consultarVale(EMPRESA, compra.vale.codigo, LOJA).saldo, 100);
  // Balcão: nasce ativo e lança a receita uma vez.
  const balcao = cobranca.venderValeNoBalcao(EMPRESA, { valor: 50, deNome: 'Caixa', meioPagamento: 'dinheiro' }, { usuario: 'gerente', lojaId: LOJA });
  assert.equal(balcao.status, 'ativo');
  assert.equal(financeiro.listarLancamentos(EMPRESA, { categoria: 'Vale-presente' }).length, 2);
  // Compra não paga expira; paga no dia seguinte, o vale passa a valer.
  const tarde = await cobranca.comprarVale(EMPRESA, { valor: 30, deNome: 'Bia', deTelefone: '65911113333', lojaId: LOJA });
  cobranca.expirarSinais({ agora: Date.now() + 25 * 60 * 60 * 1000 });
  assert.equal(cobranca.consultarVale(EMPRESA, tarde.vale.codigo, LOJA).status, 'cancelado');
  const cobTarde = cobranca.listarCobrancas(EMPRESA, { tipo: 'vale' }).find((c) => c.status === 'expirada');
  const pagoTarde = cobranca.confirmarCobranca(EMPRESA, cobTarde.id, { origem: 'manual', usuario: 'gerente', lojaId: LOJA });
  assert.equal(pagoTarde.revisar, null);
  assert.equal(cobranca.consultarVale(EMPRESA, tarde.vale.codigo, LOJA).status, 'ativo');
  // Cancelar vale pago exige motivo e lança o estorno; cancelado pela equipe não volta a valer se a cobrança chegar.
  assert.throws(() => cobranca.cancelarVale(EMPRESA, balcao.id), (e) => e.code === 'LOJA_OBRIGATORIA');
  assert.throws(() => cobranca.cancelarVale(EMPRESA, balcao.id, { lojaId: LOJA }), (e) => e.code === 'ESTORNO_OBRIGATORIO');
  const pend = await cobranca.comprarVale(EMPRESA, { valor: 40, deNome: 'Caio', deTelefone: '65911114444', lojaId: LOJA });
  cobranca.cancelarVale(EMPRESA, pend.vale.id, { usuario: 'gerente', lojaId: LOJA });
  const cobPend = cobranca.listarCobrancas(EMPRESA, { tipo: 'vale' }).find((c) => c.status === 'cancelada');
  assert.ok(cobPend, 'a cobrança pendente é cancelada junto');
  const pagoMesmoAssim = cobranca.confirmarCobranca(EMPRESA, cobPend.id, { origem: 'manual', usuario: 'gerente', lojaId: LOJA });
  assert.equal(pagoMesmoAssim.revisar, 'cobranca_cancelada');
  assert.equal(cobranca.consultarVale(EMPRESA, pend.vale.codigo, LOJA).status, 'cancelado');
  const estornado = cobranca.cancelarVale(EMPRESA, tarde.vale.id, { usuario: 'gerente', motivo: 'cliente desistiu', meioEstorno: 'pix', lojaId: LOJA });
  assert.equal(estornado.status, 'cancelado');
  assert.equal(financeiro.listarLancamentos(EMPRESA, { categoria: 'Estorno de vale-presente' }).length, 1);
  // Vencido não é usado.
  const raiz = db().barbeariaCobranca[EMPRESA].vales[balcao.id];
  raiz.validoAte = new Date(Date.now() - DIA_MS).toISOString();
  assert.throws(() => cobranca.usarVale(EMPRESA, { codigo: balcao.codigo, valor: 10, referencia: 'x', lojaId: LOJA }), (e) => e.code === 'VALE_VENCIDO');
});

test('minha conta e comparativo por unidade', () => {
  const base = montar();
  const futuro = agendar({ ...base, dias: 3, hora: '10:00', telefone: '65955550001', nome: 'Lia Silva' });
  concluir(agendar({ ...base, dias: -2, hora: '09:00', telefone: '65955550001', nome: 'Lia Silva' }));
  assert.throws(() => captacao.minhaConta(EMPRESA, { codigo: futuro.codigoConfirmacao, telefone: '65900000000', lojaId: LOJA }), (e) => e.code === 'AGENDAMENTO_NAO_ENCONTRADO');
  const conta = captacao.minhaConta(EMPRESA, { codigo: futuro.codigoConfirmacao, telefone: '(65) 95555-0001', lojaId: LOJA });
  assert.equal(conta.nome, 'Lia');
  assert.equal(conta.visitas, 1);
  assert.equal(conta.proximos.length, 1);
  assert.equal(conta.proximos[0].codigo, futuro.codigoConfirmacao);
  assert.ok(conta.paraAvaliar, 'último atendimento concluído aparece para avaliar');
  assert.equal(JSON.stringify(conta).includes('65955550001'), false, 'não devolve o telefone');
  const comp = captacao.comparativoUnidades(EMPRESA, { inicio: dataLocal(Date.now() - 5 * DIA_MS), fim: dataLocal(Date.now() + 5 * DIA_MS) });
  assert.equal(comp.unidades.length, 1);
  assert.equal(comp.unidades[0].lojaId, LOJA);
  assert.equal(comp.unidades[0].concluidos, 1);
  assert.equal(comp.unidades[0].valorAtendido, 50);
});

test('régua do clube: 3 tentativas, pausa o plano por atraso e reativa ao pagar', async () => {
  const { corte } = montar();
  cobranca.salvarConfiguracaoCobranca(EMPRESA, { pix: PIX, cobrancaClube: { ativa: true, diasAntes: 3, tentativas: 3, intervaloDias: 2, bloquearAposDias: 5 } });
  const cliente = clientes.criarCliente(EMPRESA, { nome: 'Atrasado', telefone: '65988880009' });
  const plano = barbearia.criarPlano(EMPRESA, { nome: 'Clube', preco: 99, sessoesIncluidas: 4, validadeDias: 30, servicosIds: [corte.id] });
  const ass = barbearia.criarAssinatura(EMPRESA, { planoId: plano.id, clienteId: cliente.id, clienteNome: cliente.nome, lojaId: LOJA, inicio: new Date(Date.now() - 28 * DIA_MS).toISOString() });
  barbearia.alterarStatusAssinatura(EMPRESA, ass.id, 'ativa', { confirmadoSemCobranca: true, pagamentoConfirmado: true });
  const [cob] = await cobranca.gerarCobrancasDoClube(EMPRESA, { lojaId: LOJA });
  const vencimento = Date.parse(`${cob.referencia.split(':ate:')[1]}T12:00:00Z`);
  // Antes do vencimento: nada a reenviar.
  assert.equal(cobranca.processarReguaClube(EMPRESA, { agora: vencimento - DIA_MS }).reenviar.length, 0);
  const t2 = cobranca.processarReguaClube(EMPRESA, { agora: vencimento + 60000 });
  assert.equal(t2.reenviar[0].tentativa, 2);
  assert.equal(cobranca.processarReguaClube(EMPRESA, { agora: vencimento + 3600000 }).reenviar.length, 0, 'não repete a mesma tentativa');
  const t3 = cobranca.processarReguaClube(EMPRESA, { agora: vencimento + 2 * DIA_MS + 60000 });
  assert.equal(t3.reenviar[0].tentativa, 3);
  assert.equal(cobranca.processarReguaClube(EMPRESA, { agora: vencimento + 4 * DIA_MS }).reenviar.length, 0, 'no máximo 3 tentativas');
  const bloqueio = cobranca.processarReguaClube(EMPRESA, { agora: vencimento + 5 * DIA_MS + 60000 });
  assert.equal(bloqueio.bloqueadas[0].assinaturaId, ass.id);
  assert.equal(barbearia.listarAssinaturas(EMPRESA).find((a) => a.id === ass.id).status, 'pausada');
  assert.throws(() => captacao.registrarUsoAssinatura(EMPRESA, ass.id, { servicoId: corte.id }), /não está ativa/);
  assert.equal(cobranca.painelReguaClube(EMPRESA, { lojaId: LOJA }).bloqueadas.length, 1);
  // Pagou o link: o ciclo é quitado e o plano volta a ficar ativo sozinho.
  cobranca.confirmarCobranca(EMPRESA, cob.id, { origem: 'manual', usuario: 'equipe', lojaId: LOJA });
  assert.equal(barbearia.listarAssinaturas(EMPRESA).find((a) => a.id === ass.id).status, 'ativa');
  assert.equal(cobranca.painelReguaClube(EMPRESA, { lojaId: LOJA }).reativadas.length, 1);
});

test('régua do clube desligada não reenvia nem bloqueia', async () => {
  montar();
  cobranca.salvarConfiguracaoCobranca(EMPRESA, { pix: PIX, cobrancaClube: { ativa: false } });
  assert.deepEqual(cobranca.processarReguaClube(EMPRESA, { agora: Date.now() + 60 * DIA_MS }), { reenviar: [], bloqueadas: [] });
});

test('cobranças, vales e cashback não atravessam a unidade da sessão', async () => {
  const base = montar();
  cobranca.salvarConfiguracaoCobranca(EMPRESA, { pix: PIX, sinal: { ativo: true, tipo: 'fixo', valor: 20 }, vale: { ativo: true }, cashback: { percentual: 10 } });
  const daLojaA = agendar(base);
  const data = dataLocal(Date.now() + DIA_MS);
  const daLojaB = barbearia.criarAgendamento(EMPRESA, {
    clienteNome: 'Cliente B', clienteTelefone: '65988880008', profissionalId: base.bruno.id, servicoId: base.corte.id,
    dataHora: isoLocal(data, '11:00'), dataAgenda: data, horaLocal: '11:00', lojaId: OUTRA_LOJA, origem: 'agendamento_online', codigoConfirmacao: 'LOJAB001',
  });
  const sinalA = await cobranca.criarSinalDoAgendamento(EMPRESA, daLojaA);
  const sinalB = await cobranca.criarSinalDoAgendamento(EMPRESA, daLojaB);
  assert.equal(sinalA.lojaId, LOJA);
  assert.equal(sinalB.lojaId, OUTRA_LOJA);
  assert.equal(cobranca.sinalDoAgendamento(EMPRESA, daLojaA.id, OUTRA_LOJA), null);
  assert.equal(cobranca.listarCobrancas(EMPRESA, { lojaId: OUTRA_LOJA }).map((item) => item.id).includes(sinalA.id), false);
  assert.throws(() => cobranca.confirmarCobranca(EMPRESA, sinalA.id, { origem: 'manual', lojaId: OUTRA_LOJA }), (e) => e.code === 'COBRANCA_NAO_ENCONTRADA');

  const valeB = await cobranca.comprarVale(EMPRESA, { valor: 100, deNome: 'Cliente B', deTelefone: '65988880008', lojaId: OUTRA_LOJA });
  assert.throws(() => cobranca.consultarVale(EMPRESA, valeB.vale.codigo, LOJA), (e) => e.code === 'VALE_NAO_ENCONTRADO');
});

test('outbox e reconciliação: efeitos idempotentes e falha financeira retry-safe', async () => {
  const base = montar();
  cobranca.salvarConfiguracaoCobranca(EMPRESA, { pix: PIX, sinal: { ativo: true, tipo: 'fixo', valor: 20 } });
  const ag = agendar({ ...base, telefone: '65999990112' });
  const cob = await cobranca.criarSinalDoAgendamento(EMPRESA, ag);
  cobranca.confirmarCobranca(EMPRESA, cob.id, { origem: 'manual', usuario: 'operador', lojaId: LOJA, actionId: 'acao-manual-1' });
  const chamadas = [];
  const outbox = { async enqueueDinoEffect(contexto, input) { chamadas.push({ contexto, input }); return { id: `out-${chamadas.length}`, replayed: chamadas.length > 2 }; } };
  const enfileirado = await cobranca.enqueueCobrancaEffects(EMPRESA, cob.id, { outbox, lojaId: LOJA, requestId: 'req-1', actionId: 'acao-manual-1', usuario: 'operador' });
  assert.equal(enfileirado.enfileirados, 2);
  assert.equal(new Set(chamadas.map((item) => item.input.idempotencyKey)).size, 2);
  assert.ok(chamadas.every((item) => item.contexto.lojaId === LOJA));

  const interno = db().barbeariaCobranca[EMPRESA].cobrancas[cob.id];
  interno.financeStatus = 'pending';
  interno.financeEntryId = null;
  interno.lastFinanceError = 'falha temporária saneada';
  interno.effectStatus = 'pending';
  let efeitos = 0;
  let fin = 0;
  const reconciliado = await cobranca.reconcileCobranca(EMPRESA, cob.id, {
    lojaId: LOJA,
    handlers: {
      effect: async () => { efeitos += 1; return { ok: true }; },
      finance: async () => { fin += 1; return { id: 'fin-injetado' }; },
    },
  });
  assert.equal(efeitos, 1);
  assert.equal(fin, 1);
  assert.equal(reconciliado.financeStatus, 'paid');
  assert.equal(reconciliado.financeEntryId, 'fin-injetado');
  assert.deepEqual(reconciliado.pendencias, []);
  assert.equal(reconciliado.reconciled, true);
});
