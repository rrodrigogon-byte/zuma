import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { reset, db } from './db.js';
import * as barbearia from './barbearia-erp-kytto.js';
import * as captacao from './dino-captacao-kytto.js';
import * as repasses from './barbearia-repasses-kytto.js';
import { listarLancamentos } from './financeiro-central-kytto.js';

const EMP = 'emp-repasse';
const LOJA = 'loja-repasse';
beforeEach((t) => {
  reset();
  // Fixture determinística ao meio-dia: a janela do ensaio não depende da virada UTC.
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-13T16:00:00Z') });
});
afterEach(() => reset());

function cenario({ descontaMaterial = true } = {}) {
  barbearia.atualizarConfiguracao(EMP, { taxasPagamento: { credito: { percentual: 5, fixa: 0, fonte: 'contrato InfinitePay' } } });
  const prof = barbearia.criarProfissional(EMP, { nome: 'Bruno', email: 'bruno@dino.test', percentualComissao: 50, percentualComissaoProduto: 10, descontaMaterial });
  const lamina = barbearia.criarProdutoRevenda(EMP, { lojaId: LOJA, nome: 'Lâmina', precoVenda: 2, custoUnitario: 1.5, estoqueAtual: 100 });
  const corte = barbearia.criarServico(EMP, { nome: 'Corte', preco: 100, duracaoMinutos: 30, consumoInterno: [{ produtoId: lamina.id, quantidade: 2 }] });
  const barba = barbearia.criarServico(EMP, { nome: 'Barba', preco: 60, duracaoMinutos: 30, custoMaterial: 8 });
  const pomada = barbearia.criarProdutoRevenda(EMP, { lojaId: LOJA, nome: 'Pomada', precoVenda: 40, custoUnitario: 18, estoqueAtual: 10 });
  return { prof, corte, barba, pomada };
}

function comandaPaga({ prof, corte, barba, pomada }, meio = 'credito') {
  const c = barbearia.criarComandaBarbearia(EMP, { lojaId: LOJA, profissionalId: prof.id, clienteNome: 'Cliente A', itens: [{ tipo: 'servico', servicoId: corte.id }, { tipo: 'servico', servicoId: barba.id }, { tipo: 'produto', produtoId: pomada.id, quantidade: 1 }] });
  return barbearia.registrarPagamentoComandaBarbearia(EMP, c.id, { confirmado: true, lojaId: LOJA, meioPagamento: meio, valor: c.total, chaveIdempotencia: `pg-${c.id}` });
}

const hoje = () => new Date().toISOString().slice(0, 10);

test('material entra na base só quando o profissional desconta material', () => {
  const c = cenario({ descontaMaterial: true });
  comandaPaga(c);
  assert.equal(barbearia.custoMaterialServico(EMP, c.corte.id), 3); // 2 × 1,50
  assert.equal(barbearia.custoMaterialServico(EMP, c.barba.id), 8);
  const ex = repasses.extratoProfissional(EMP, c.prof.id, { inicio: hoje(), fim: hoje(), lojaId: LOJA });
  const corte = ex.linhas.find((l) => l.descricao === 'Corte');
  assert.equal(corte.taxa, 5);
  assert.equal(corte.material, 3);
  assert.equal(corte.base, 92);
  assert.equal(corte.comissao, 46);
  assert.equal(ex.linhas.find((l) => l.descricao === 'Barba').comissao, 24.5); // (60 − 3 − 8) × 50%
  assert.equal(ex.totais.comissaoProdutos, 3.8); // (40 − 2) × 10%
  assert.equal(ex.totais.materiais, 11);
  assert.equal(ex.totais.comissaoTotal, 74.3);
  // Sem desconto de material: base maior.
  barbearia.atualizarProfissional(EMP, c.prof.id, { descontaMaterial: false });
  assert.equal(repasses.extratoProfissional(EMP, c.prof.id, { inicio: hoje(), fim: hoje(), lojaId: LOJA }).totais.materiais, 0);
});

test('vale limitado ao realizado, repasse abate vale, gera recibo e despesa, sem repetir o período', () => {
  const c = cenario();
  comandaPaga(c);
  assert.throws(() => repasses.registrarVale(EMP, { profissionalId: c.prof.id, lojaId: LOJA, valor: 500, confirmado: true }), /passa da comissão/);
  const vale = repasses.registrarVale(EMP, { profissionalId: c.prof.id, lojaId: LOJA, valor: 30, confirmado: true, chaveIdempotencia: 'v1' });
  assert.equal(repasses.registrarVale(EMP, { profissionalId: c.prof.id, lojaId: LOJA, valor: 30, confirmado: true, chaveIdempotencia: 'v1' }).repetido, true);
  assert.equal(repasses.saldoDisponivel(EMP, c.prof.id, { lojaId: LOJA }).disponivel, 44.3);
  assert.throws(() => repasses.registrarRepasse(EMP, { profissionalId: c.prof.id, lojaId: LOJA, inicio: hoje(), fim: hoje() }), /Confirme/);
  const r = repasses.registrarRepasse(EMP, { profissionalId: c.prof.id, lojaId: LOJA, inicio: hoje(), fim: hoje(), confirmado: true, meio: 'pix', usuario: 'gestor' });
  assert.equal(r.recibo, 'REC-00001');
  assert.equal(r.valorPago, 44.3);
  assert.equal(r.valesAbatidos, 30);
  assert.equal(repasses.listarVales(EMP, { status: 'abatido' })[0].id, vale.id);
  assert.throws(() => repasses.registrarRepasse(EMP, { profissionalId: c.prof.id, lojaId: LOJA, inicio: hoje(), fim: hoje(), confirmado: true }), /Já existe o repasse/);
  const despesas = listarLancamentos(EMP, { origem: 'barbearia_repasse_comissao' });
  assert.equal(despesas.length, 1);
  assert.equal(despesas[0].valor, 44.3);
  const html = repasses.reciboHtml(EMP, r.id, { empresaNome: 'Dino <Barbearia>' });
  assert.ok(html.includes('REC-00001') && html.includes('Dino &lt;Barbearia&gt;') && html.includes('44,30'));
  assert.equal(repasses.saldoDisponivel(EMP, c.prof.id, { lojaId: LOJA }).disponivel, 0);
});

test('estorno mantém histórico, reabre os vales e libera o período', () => {
  const c = cenario();
  comandaPaga(c);
  repasses.registrarVale(EMP, { profissionalId: c.prof.id, lojaId: LOJA, valor: 10, confirmado: true });
  const r = repasses.registrarRepasse(EMP, { profissionalId: c.prof.id, lojaId: LOJA, inicio: hoje(), fim: hoje(), confirmado: true });
  assert.throws(() => repasses.estornarRepasse(EMP, r.id, { lojaId: LOJA, motivo: '' }), /motivo/);
  const e = repasses.estornarRepasse(EMP, r.id, { lojaId: LOJA, motivo: 'Valor pago na conta errada' });
  assert.equal(e.status, 'estornado');
  assert.equal(repasses.listarVales(EMP, { status: 'aberto' }).length, 1);
  assert.ok(repasses.reciboHtml(EMP, r.id).includes('ESTORNADO'));
  const novo = repasses.registrarRepasse(EMP, { profissionalId: c.prof.id, lojaId: LOJA, inicio: hoje(), fim: hoje(), confirmado: true });
  assert.equal(novo.recibo, 'REC-00002');
});

test('comissão sobre plano: pote dividido pelos pontos dos serviços atendidos pelo plano', () => {
  const a = barbearia.criarProfissional(EMP, { nome: 'Ana', percentualComissao: 50 });
  const b = barbearia.criarProfissional(EMP, { nome: 'Beto', percentualComissao: 50 });
  const corte = barbearia.criarServico(EMP, { nome: 'Corte', preco: 60, duracaoMinutos: 30 });
  const barba = barbearia.criarServico(EMP, { nome: 'Barba', preco: 40, duracaoMinutos: 30 });
  const plano = barbearia.criarPlano(EMP, { nome: 'Clube', preco: 150, sessoesIncluidas: 10, servicosIds: [corte.id, barba.id], percentualPote: 40 });
  const ass = barbearia.criarAssinatura(EMP, { lojaId: LOJA, planoId: plano.id, clienteNome: 'Cliente Clube', inicio: new Date(Date.now() - 86400000).toISOString() });
  barbearia.alterarStatusAssinatura(EMP, ass.id, 'ativa', { confirmadoSemCobranca: true, pagamentoConfirmado: false });
  captacao.registrarPagamentoAssinatura(EMP, ass.id, { valor: 150, meio: 'pix' });
  const ag = (profissionalId, servicoId, hora) => barbearia.criarAgendamento(EMP, { lojaId: LOJA, clienteNome: 'Cliente Clube', profissionalId, servicoId, dataHora: `${hoje()}T${hora}:00-03:00` }, { permitirEncaixe: true });
  const u1 = ag(a.id, corte.id, '09'); const u2 = ag(b.id, barba.id, '10');
  captacao.registrarUsoAssinatura(EMP, ass.id, { servicoId: corte.id, agendamentoId: u1.id });
  captacao.registrarUsoAssinatura(EMP, ass.id, { servicoId: barba.id, agendamentoId: u2.id });
  const pote = repasses.poteDosPlanos(EMP, { inicio: hoje(), fim: hoje(), lojaId: LOJA });
  assert.equal(pote.planos[0].pote, 60); // 40% de 150
  assert.equal(pote.porProfissional.get(a.id).valor, 36); // 60 de 100 pontos
  assert.equal(Number(pote.porProfissional.get(b.id).valor.toFixed(2)), 24);
  const ex = repasses.extratoProfissional(EMP, a.id, { inicio: hoje(), fim: hoje(), lojaId: LOJA });
  assert.equal(ex.totais.comissaoPlanos, 36);
  assert.equal(ex.pote[0].plano, 'Clube');
});

test('extrato traz o histórico Avec do profissional pela regra de comissão dele, sem somar ao a receber', () => {
  const c = cenario();
  const outro = barbearia.criarProfissional(EMP, { nome: 'Bruna', email: 'bruna@dino.test', percentualComissao: 40 });
  // Agenda importada antes (12/10) já trazia o profissional do Kytto: é a evidência do vínculo.
  const antigos = [];
  for (let dia = 1; dia <= 6; dia += 1) antigos.push({ dataAgenda: `2026-09-0${dia}`, hora: '10:00', clienteNome: `Cliente ${dia}`, profissionalId: c.prof.id, profissionalNome: 'Bruno', servicoNome: 'Corte' });
  barbearia.importarHistoricoAtendimentos(EMP, antigos, { origem: 'importacao_avec' });
  const estado = db().barbearias[EMP];
  const avec = (dia, cliente, nome, valor) => ({ id: `hist-avec-${dia}-${cliente}-${nome}`, empresaId: EMP, lojaId: LOJA, dataAgenda: dia, clienteNome: cliente, profissionalId: `prof-avec-hist-${nome}`, profissionalNome: nome, servicoNome: 'Corte Avec', status: 'concluido', valor, total: valor, numeroComanda: '10', somenteHistorico: true, sourceSystem: 'avec', origem: 'avec-import-20261022' });
  for (let dia = 1; dia <= 6; dia += 1) { const item = avec(`2026-09-0${dia}`, `Cliente ${dia}`, 'Bruno Mendes Pedroso', 100); estado.historicoAtendimentos[item.id] = item; }
  const semVinculo = avec('2026-09-02', 'Cliente X', 'Bruno Rafael dos Santos', 70);
  estado.historicoAtendimentos[semVinculo.id] = semVinculo;
  const ex = repasses.extratoProfissional(EMP, c.prof.id, { inicio: '2026-09-01', fim: '2026-09-30', lojaId: LOJA });
  assert.equal(ex.historicoAvec.atendimentos, 6, 'só o Bruno ligado pela agenda; o outro Bruno do Avec não entra');
  assert.equal(ex.historicoAvec.bruto, 600);
  assert.equal(ex.historicoAvec.percentual, 50);
  assert.equal(ex.historicoAvec.comissao, 300);
  assert.deepEqual(ex.historicoAvec.nomesAvec, ['Bruno Mendes Pedroso']);
  assert.equal(ex.totais.aReceber, 0, 'histórico Avec não vira a receber');
  assert.equal(repasses.extratoProfissional(EMP, outro.id, { inicio: '2026-09-01', fim: '2026-09-30', lojaId: LOJA }).historicoAvec.atendimentos, 0);
  const vinculos = repasses.vinculosProfissionaisAvec(EMP);
  assert.equal(vinculos.get('bruno mendes pedroso').profissionalId, c.prof.id);
  assert.equal(vinculos.has('bruno rafael dos santos'), false, 'dois Brunos no Avec: sem evidência na agenda, não liga pelo nome');
});

test('extrato mostra comissões e antecipações pagas no Avec para o profissional do período', () => {
  const c = cenario();
  const raiz = db();
  raiz.financeiroKytto ||= { empresas: {} };
  raiz.financeiroKytto.empresas ||= {};
  raiz.financeiroKytto.empresas[EMP] ||= { lancamentos: {} };
  const store = raiz.financeiroKytto.empresas[EMP];
  store.lancamentos ||= {};
  const lanc = (id, descricao, categoria, valor, pagoEm) => { store.lancamentos[id] = { id, empresaId: EMP, lojaId: LOJA, tipo: 'despesa', status: 'pago', descricao, categoria, valor, pagoEm: `${pagoEm}T12:00:00.000Z`, vencimento: pagoEm, dataOperacao: `${pagoEm}T12:00:00.000Z`, origem: 'avec-import-financeiro-20261022', metadata: { historicoAvec: true } }; };
  lanc('a1', 'Comissão Bruno Mendes pedroso - Barbeiro de 01/09/2026 a 30/09/2026', 'BRUNO1', 3000, '2026-10-04');
  lanc('a2', 'Antecipação de comissão - VALE PIX', 'BRUNO1', 500, '2026-09-15');
  lanc('a3', 'Antecipação de comissão - VALE PIX', 'DAVID', 200, '2026-09-15');
  lanc('a4', 'Comissão Natani Minanis Dobler  - Barbeiro de 01/09/2026 a 30/09/2026', 'NATANI', 2500, '2026-10-04');
  const ex = repasses.extratoProfissional(EMP, c.prof.id, { inicio: '2026-09-01', fim: '2026-09-30', lojaId: LOJA });
  assert.equal(ex.historicoAvec.pagamentos.comissoes, 3000, 'comissão do período, pelo vínculo do cadastro do Avec');
  assert.equal(ex.historicoAvec.pagamentos.antecipacoes, 500, 'só a antecipação na categoria do Bruno');
  assert.equal(ex.historicoAvec.pagamentos.total, 3500);
  assert.equal(ex.totais.aReceber, 0, 'pagamento do Avec não mexe no a receber do Kytto');
});

test('pote dividido por atendimento (como o Avec) e valor fixo por atendimento do plano', () => {
  const a = barbearia.criarProfissional(EMP, { nome: 'Ana', percentualComissao: 50 });
  const b = barbearia.criarProfissional(EMP, { nome: 'Beto', percentualComissao: 50 });
  const corte = barbearia.criarServico(EMP, { nome: 'Corte Club', preco: 70, duracaoMinutos: 30 });
  const barba = barbearia.criarServico(EMP, { nome: 'Barba Club', preco: 30, duracaoMinutos: 30 });
  const plano = barbearia.criarPlano(EMP, { nome: 'Club Combo', preco: 200, sessoesIncluidas: 10, servicosIds: [corte.id, barba.id], percentualPote: 30, rateioPote: 'atendimento' });
  assert.equal(plano.rateioPote, 'atendimento');
  assert.equal(plano.valorFixoPorUso, 0);
  const ass = barbearia.criarAssinatura(EMP, { lojaId: LOJA, planoId: plano.id, clienteNome: 'Cliente Club', inicio: new Date(Date.now() - 86400000).toISOString() });
  barbearia.alterarStatusAssinatura(EMP, ass.id, 'ativa', { confirmadoSemCobranca: true, pagamentoConfirmado: false });
  captacao.registrarPagamentoAssinatura(EMP, ass.id, { valor: 200, meio: 'pix' });
  const ag = (profissionalId, servicoId, hora) => barbearia.criarAgendamento(EMP, { lojaId: LOJA, clienteNome: 'Cliente Club', profissionalId, servicoId, dataHora: `${hoje()}T${hora}:00-03:00` }, { permitirEncaixe: true });
  captacao.registrarUsoAssinatura(EMP, ass.id, { servicoId: corte.id, agendamentoId: ag(a.id, corte.id, '09').id });
  captacao.registrarUsoAssinatura(EMP, ass.id, { servicoId: barba.id, agendamentoId: ag(b.id, barba.id, '10').id });
  captacao.registrarUsoAssinatura(EMP, ass.id, { servicoId: barba.id, agendamentoId: ag(b.id, barba.id, '11').id });
  let pote = repasses.poteDosPlanos(EMP, { inicio: hoje(), fim: hoje(), lojaId: LOJA });
  assert.equal(pote.planos[0].pote, 60, '30% de 200');
  assert.equal(pote.planos[0].usos, 3);
  assert.equal(pote.planos[0].valorPorPonto, 20, 'R$ 20 por atendimento, igual para corte e barba');
  assert.equal(pote.porProfissional.get(a.id).valor, 20);
  assert.equal(pote.porProfissional.get(b.id).valor, 40);

  // Valor fixo por atendimento, sem pote.
  barbearia.atualizarPlano(EMP, plano.id, { percentualPote: 0, valorFixoPorUso: 12.5 });
  pote = repasses.poteDosPlanos(EMP, { inicio: hoje(), fim: hoje(), lojaId: LOJA });
  assert.equal(pote.planos[0].pote, 0);
  assert.equal(pote.planos[0].fixoPago, 37.5);
  assert.equal(pote.porProfissional.get(b.id).valor, 25);
  const ex = repasses.extratoProfissional(EMP, b.id, { inicio: hoje(), fim: hoje(), lojaId: LOJA });
  assert.equal(ex.totais.comissaoPlanos, 25);
  assert.equal(ex.pote[0].usos, 2);
  assert.equal(ex.pote[0].valorFixo, 25);
});

test('histórico Avec: atendimentos Club sem valor e conferência entre o pago e o calculado', () => {
  const c = cenario();
  const estado = db().barbearias[EMP];
  const avec = (n, servico, cliente, valor, extra = {}) => ({ id: `hist-avec-club-${n}`, empresaId: EMP, lojaId: LOJA, dataAgenda: '2026-09-10', clienteNome: cliente, profissionalId: 'prof-avec-hist-bruno', profissionalNome: 'Bruno Mendes pedroso', servicoNome: servico, status: 'concluido', valor, total: valor, numeroComanda: String(n), somenteHistorico: true, sourceSystem: 'avec', origem: 'avec-import-20261022', ...extra });
  const itens = [
    avec(1, 'Corte', 'Cliente 1', 100), avec(2, 'Corte', 'Cliente 2', 100), avec(3, 'Barba', 'Cliente 3', 100), avec(4, 'Barba', 'Cliente 4', 100),
    avec(5, 'Barba Club', 'Assinante 1', 0), avec(6, 'Barba Club', 'Assinante 2', 0), avec(7, 'Corte Club', 'Assinante 3', 0, { pacote: 'Pacote' }),
    avec(8, 'Corte', 'Fulano (Club Combo - Asaas)', 0),
    avec(9, 'Corte Cortesia', 'Amigo', 0),
  ];
  for (const item of itens) estado.historicoAtendimentos[item.id] = item;
  const raiz = db();
  raiz.financeiroKytto ||= { empresas: {} };
  raiz.financeiroKytto.empresas ||= {};
  raiz.financeiroKytto.empresas[EMP] ||= { lancamentos: {} };
  const store = raiz.financeiroKytto.empresas[EMP];
  store.lancamentos ||= {};
  const lanc = (id, descricao, categoria, valor, pagoEm) => { store.lancamentos[id] = { id, empresaId: EMP, lojaId: LOJA, tipo: 'despesa', status: 'pago', descricao, categoria, valor, pagoEm: `${pagoEm}T12:00:00.000Z`, vencimento: pagoEm, dataOperacao: `${pagoEm}T12:00:00.000Z`, origem: 'avec-import-financeiro-20261022', metadata: { historicoAvec: true } }; };
  lanc('c1', 'Comissão Bruno Mendes pedroso - Barbeiro de 01/09/2026 a 30/09/2026', 'BRUNO1', 230, '2026-10-04');
  lanc('c2', 'Antecipação de comissão - VALE PIX', 'BRUNO1', 10, '2026-09-15');
  const ex = repasses.extratoProfissional(EMP, c.prof.id, { inicio: '2026-09-01', fim: '2026-09-30', lojaId: LOJA });
  const h = ex.historicoAvec;
  assert.equal(h.comissao, 200, '50% dos 400 com valor');
  assert.equal(h.club.atendimentos, 4, 'Club pelo serviço, pelo pacote e pelo nome do cliente; a cortesia não entra');
  assert.deepEqual(h.club.porServico[0], { servico: 'Barba Club', quantidade: 2 });
  assert.equal(h.conferencia.pago, 240);
  assert.equal(h.conferencia.diferenca, 40);
  assert.equal(h.conferencia.porAtendimentoClub, 10);
  assert.equal(ex.totais.aReceber, 0);
  const semPagamento = repasses.extratoProfissional(EMP, c.prof.id, { inicio: '2026-08-01', fim: '2026-08-31', lojaId: LOJA }).historicoAvec;
  assert.equal(semPagamento.conferencia.diferenca, null);
  assert.equal(semPagamento.conferencia.porAtendimentoClub, null);
});
