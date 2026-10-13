import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { reset } from './db.js';
import * as barbearia from './barbearia-erp-kytto.js';
import * as captacao from './dino-captacao-kytto.js';
import * as repasses from './barbearia-repasses-kytto.js';
import { listarLancamentos } from './financeiro-central-kytto.js';

const EMP = 'emp-repasse';
beforeEach(() => reset());
afterEach(() => reset());

function cenario({ descontaMaterial = true } = {}) {
  barbearia.atualizarConfiguracao(EMP, { taxasPagamento: { credito: { percentual: 5, fixa: 0, fonte: 'contrato InfinitePay' } } });
  const prof = barbearia.criarProfissional(EMP, { nome: 'Bruno', email: 'bruno@dino.test', percentualComissao: 50, percentualComissaoProduto: 10, descontaMaterial });
  const lamina = barbearia.criarProdutoRevenda(EMP, { nome: 'Lâmina', precoVenda: 2, custoUnitario: 1.5, estoqueAtual: 100 });
  const corte = barbearia.criarServico(EMP, { nome: 'Corte', preco: 100, duracaoMinutos: 30, consumoInterno: [{ produtoId: lamina.id, quantidade: 2 }] });
  const barba = barbearia.criarServico(EMP, { nome: 'Barba', preco: 60, duracaoMinutos: 30, custoMaterial: 8 });
  const pomada = barbearia.criarProdutoRevenda(EMP, { nome: 'Pomada', precoVenda: 40, custoUnitario: 18, estoqueAtual: 10 });
  return { prof, corte, barba, pomada };
}

function comandaPaga({ prof, corte, barba, pomada }, meio = 'credito') {
  const c = barbearia.criarComandaBarbearia(EMP, { profissionalId: prof.id, clienteNome: 'Cliente A', itens: [{ tipo: 'servico', servicoId: corte.id }, { tipo: 'servico', servicoId: barba.id }, { tipo: 'produto', produtoId: pomada.id, quantidade: 1 }] });
  return barbearia.registrarPagamentoComandaBarbearia(EMP, c.id, { confirmado: true, meioPagamento: meio, valor: c.total, chaveIdempotencia: `pg-${c.id}` });
}

const hoje = () => new Date().toISOString().slice(0, 10);

test('material entra na base só quando o profissional desconta material', () => {
  const c = cenario({ descontaMaterial: true });
  comandaPaga(c);
  assert.equal(barbearia.custoMaterialServico(EMP, c.corte.id), 3); // 2 × 1,50
  assert.equal(barbearia.custoMaterialServico(EMP, c.barba.id), 8);
  const ex = repasses.extratoProfissional(EMP, c.prof.id, { inicio: hoje(), fim: hoje() });
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
  assert.equal(repasses.extratoProfissional(EMP, c.prof.id, { inicio: hoje(), fim: hoje() }).totais.materiais, 0);
});

test('vale limitado ao realizado, repasse abate vale, gera recibo e despesa, sem repetir o período', () => {
  const c = cenario();
  comandaPaga(c);
  assert.throws(() => repasses.registrarVale(EMP, { profissionalId: c.prof.id, valor: 500, confirmado: true }), /passa da comissão/);
  const vale = repasses.registrarVale(EMP, { profissionalId: c.prof.id, valor: 30, confirmado: true, chaveIdempotencia: 'v1' });
  assert.equal(repasses.registrarVale(EMP, { profissionalId: c.prof.id, valor: 30, confirmado: true, chaveIdempotencia: 'v1' }).repetido, true);
  assert.equal(repasses.saldoDisponivel(EMP, c.prof.id).disponivel, 44.3);
  assert.throws(() => repasses.registrarRepasse(EMP, { profissionalId: c.prof.id, inicio: hoje(), fim: hoje() }), /Confirme/);
  const r = repasses.registrarRepasse(EMP, { profissionalId: c.prof.id, inicio: hoje(), fim: hoje(), confirmado: true, meio: 'pix', usuario: 'gestor' });
  assert.equal(r.recibo, 'REC-00001');
  assert.equal(r.valorPago, 44.3);
  assert.equal(r.valesAbatidos, 30);
  assert.equal(repasses.listarVales(EMP, { status: 'abatido' })[0].id, vale.id);
  assert.throws(() => repasses.registrarRepasse(EMP, { profissionalId: c.prof.id, inicio: hoje(), fim: hoje(), confirmado: true }), /Já existe o repasse/);
  const despesas = listarLancamentos(EMP, { origem: 'barbearia_repasse_comissao' });
  assert.equal(despesas.length, 1);
  assert.equal(despesas[0].valor, 44.3);
  const html = repasses.reciboHtml(EMP, r.id, { empresaNome: 'Dino <Barbearia>' });
  assert.ok(html.includes('REC-00001') && html.includes('Dino &lt;Barbearia&gt;') && html.includes('44,30'));
  assert.equal(repasses.saldoDisponivel(EMP, c.prof.id).disponivel, 0);
});

test('estorno mantém histórico, reabre os vales e libera o período', () => {
  const c = cenario();
  comandaPaga(c);
  repasses.registrarVale(EMP, { profissionalId: c.prof.id, valor: 10, confirmado: true });
  const r = repasses.registrarRepasse(EMP, { profissionalId: c.prof.id, inicio: hoje(), fim: hoje(), confirmado: true });
  assert.throws(() => repasses.estornarRepasse(EMP, r.id, { motivo: '' }), /motivo/);
  const e = repasses.estornarRepasse(EMP, r.id, { motivo: 'Valor pago na conta errada' });
  assert.equal(e.status, 'estornado');
  assert.equal(repasses.listarVales(EMP, { status: 'aberto' }).length, 1);
  assert.ok(repasses.reciboHtml(EMP, r.id).includes('ESTORNADO'));
  const novo = repasses.registrarRepasse(EMP, { profissionalId: c.prof.id, inicio: hoje(), fim: hoje(), confirmado: true });
  assert.equal(novo.recibo, 'REC-00002');
});

test('comissão sobre plano: pote dividido pelos pontos dos serviços atendidos pelo plano', () => {
  const a = barbearia.criarProfissional(EMP, { nome: 'Ana', percentualComissao: 50 });
  const b = barbearia.criarProfissional(EMP, { nome: 'Beto', percentualComissao: 50 });
  const corte = barbearia.criarServico(EMP, { nome: 'Corte', preco: 60, duracaoMinutos: 30 });
  const barba = barbearia.criarServico(EMP, { nome: 'Barba', preco: 40, duracaoMinutos: 30 });
  const plano = barbearia.criarPlano(EMP, { nome: 'Clube', preco: 150, sessoesIncluidas: 10, servicosIds: [corte.id, barba.id], percentualPote: 40 });
  const ass = barbearia.criarAssinatura(EMP, { planoId: plano.id, clienteNome: 'Cliente Clube', inicio: new Date(Date.now() - 86400000).toISOString() });
  barbearia.alterarStatusAssinatura(EMP, ass.id, 'ativa', { confirmadoSemCobranca: true, pagamentoConfirmado: false });
  captacao.registrarPagamentoAssinatura(EMP, ass.id, { valor: 150, meio: 'pix' });
  const ag = (profissionalId, servicoId, hora) => barbearia.criarAgendamento(EMP, { clienteNome: 'Cliente Clube', profissionalId, servicoId, dataHora: `${hoje()}T${hora}:00-03:00` }, { permitirEncaixe: true });
  const u1 = ag(a.id, corte.id, '09'); const u2 = ag(b.id, barba.id, '10');
  captacao.registrarUsoAssinatura(EMP, ass.id, { servicoId: corte.id, agendamentoId: u1.id });
  captacao.registrarUsoAssinatura(EMP, ass.id, { servicoId: barba.id, agendamentoId: u2.id });
  const pote = repasses.poteDosPlanos(EMP, { inicio: hoje(), fim: hoje() });
  assert.equal(pote.planos[0].pote, 60); // 40% de 150
  assert.equal(pote.porProfissional.get(a.id).valor, 36); // 60 de 100 pontos
  assert.equal(Number(pote.porProfissional.get(b.id).valor.toFixed(2)), 24);
  const ex = repasses.extratoProfissional(EMP, a.id, { inicio: hoje(), fim: hoje() });
  assert.equal(ex.totais.comissaoPlanos, 36);
  assert.equal(ex.pote[0].plano, 'Clube');
});
