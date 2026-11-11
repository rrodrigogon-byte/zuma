import assert from 'node:assert/strict';
import { test, beforeEach, afterEach } from 'node:test';
import { db, reset } from './db.js';
import * as caixa from './caixa-diario-kytto.js';
import { listarLancamentos } from './financeiro-central-kytto.js';
import { criarServico, criarComandaBarbearia, registrarPagamentoComandaBarbearia } from './barbearia-erp-kytto.js';

const EMPRESA_A = 'empresa-caixa-a';
const EMPRESA_B = 'empresa-caixa-b';
const DATA = '2031-05-10';

beforeEach(() => reset());
afterEach(() => reset());

test('leituras do caixa não materializam empresas ou buckets vazios', () => {
  assert.equal(db().caixaKytto, undefined);
  assert.deepEqual(caixa.listarCaixas(EMPRESA_A, { data: DATA, lojaId: 'loja-a' }), []);
  assert.equal(caixa.obterCaixa(EMPRESA_A, 'inexistente'), null);
  assert.deepEqual(caixa.movimentosDoCaixa(EMPRESA_A, 'inexistente'), []);
  assert.equal(db().caixaKytto, undefined);
});

test('isola abertura por empresa e unidade e impede movimento em caixa de outra unidade', () => {
  const caixaA = caixa.abrirCaixa(EMPRESA_A, { numeroCaixa: 1, dataOperacao: `${DATA}T08:00:00.000Z`, lojaId: 'loja-a', valorAbertura: 100 });
  const caixaOutraLoja = caixa.abrirCaixa(EMPRESA_A, { numeroCaixa: 1, dataOperacao: `${DATA}T08:01:00.000Z`, lojaId: 'loja-b', valorAbertura: 80 });
  assert.equal(caixa.listarCaixas(EMPRESA_A, { data: DATA, lojaId: 'loja-a' }).length, 1);
  assert.equal(caixa.listarCaixas(EMPRESA_A, { data: DATA, lojaId: 'loja-b' }).length, 1);
  assert.equal(caixa.listarCaixas(EMPRESA_B, { data: DATA }).length, 0);
  assert.throws(() => caixa.abrirCaixa(EMPRESA_A, { numeroCaixa: 1, dataOperacao: `${DATA}T09:00:00.000Z`, lojaId: 'loja-a', valorAbertura: 10 }), /já está aberto nesta unidade/);
  assert.throws(() => caixa.registrarMovimento(EMPRESA_A, { caixaId: caixaOutraLoja.id, lojaId: 'loja-a', tipo: 'suprimento', valor: 10 }), /Caixa não pertence/);
  assert.equal(caixa.obterCaixa(EMPRESA_A, caixaA.id).lojaId, 'loja-a');
});

test('registra recebimento idempotente e calcula fechamento com movimentos e divergência', () => {
  const caixaAberto = caixa.abrirCaixa(EMPRESA_A, { numeroCaixa: 1, dataOperacao: `${DATA}T08:00:00.000Z`, lojaId: 'loja-a', valorAbertura: 100 });
  const primeiro = caixa.registrarRecebimento(EMPRESA_A, { caixaId: caixaAberto.id, lojaId: 'loja-a', valor: 50, referencia: 'comanda-1', chaveIdempotencia: 'recebimento-1' });
  const repetido = caixa.registrarRecebimento(EMPRESA_A, { caixaId: caixaAberto.id, lojaId: 'loja-a', valor: 999, referencia: 'comanda-1', chaveIdempotencia: 'recebimento-1' });
  assert.equal(repetido.id, primeiro.id);
  caixa.registrarMovimento(EMPRESA_A, { caixaId: caixaAberto.id, lojaId: 'loja-a', tipo: 'suprimento', valor: 20, descricao: 'Troco inicial' });
  caixa.registrarMovimento(EMPRESA_A, { caixaId: caixaAberto.id, lojaId: 'loja-a', tipo: 'sangria', valor: 5, descricao: 'Retirada autorizada' });
  const fechamento = caixa.fecharCaixa(EMPRESA_A, { caixaId: caixaAberto.id, lojaId: 'loja-a', valorInformado: 160 });
  assert.equal(fechamento.resumo.recebimentosDinheiro, 50);
  assert.equal(fechamento.resumo.valorEsperado, 165);
  assert.equal(fechamento.resumo.valorInformado, 160);
  assert.equal(fechamento.resumo.divergencia, -5);
  assert.equal(fechamento.movimentos.filter((item) => item.tipo === 'recebimento').length, 1);
  assert.throws(() => caixa.registrarMovimento(EMPRESA_A, { caixaId: caixaAberto.id, tipo: 'sangria', valor: 1 }), /já fechado|deve estar aberto/i);
});

test('pagamento em dinheiro de comanda gera um único recebimento no caixa da unidade', () => {
  const caixaAberto = caixa.abrirCaixa(EMPRESA_A, { numeroCaixa: 1, dataOperacao: `${DATA}T08:00:00.000Z`, lojaId: 'loja-a', valorAbertura: 0 });
  const servico = criarServico(EMPRESA_A, { nome: 'Corte caixa', duracaoMinutos: 30, preco: 50 });
  const comanda = criarComandaBarbearia(EMPRESA_A, { lojaId: 'loja-a', clienteNome: 'Cliente caixa', itens: [{ tipo: 'servico', servicoId: servico.id }] });
  const pagamento = { confirmado: true, lojaId: 'loja-a', meioPagamento: 'dinheiro', valor: 50, caixaId: caixaAberto.id, chaveIdempotencia: 'pagamento-comanda-1', usuario: 'teste' };
  const paga = registrarPagamentoComandaBarbearia(EMPRESA_A, comanda.id, pagamento);
  const repetida = registrarPagamentoComandaBarbearia(EMPRESA_A, comanda.id, pagamento);
  assert.equal(paga.status, 'paga');
  assert.equal(repetida.status, 'paga');
  const movimentos = caixa.movimentosDoCaixa(EMPRESA_A, caixaAberto.id);
  assert.equal(movimentos.filter((item) => item.tipo === 'recebimento').length, 1);
  assert.equal(movimentos.find((item) => item.tipo === 'recebimento').valor, 50);
  assert.equal(listarLancamentos(EMPRESA_A, { origem: 'barbearia_comanda' }).length, 1);
  assert.equal(db().barbearias[EMPRESA_A].comandas[comanda.id].pagamentos.length, 1);
});

test('pagamento em dinheiro não aceita caixa de outra unidade', () => {
  const caixaOutraLoja = caixa.abrirCaixa(EMPRESA_A, { numeroCaixa: 1, dataOperacao: `${DATA}T08:00:00.000Z`, lojaId: 'loja-b', valorAbertura: 0 });
  const servico = criarServico(EMPRESA_A, { nome: 'Barba caixa', duracaoMinutos: 30, preco: 40 });
  const comanda = criarComandaBarbearia(EMPRESA_A, { lojaId: 'loja-a', clienteNome: 'Cliente escopo', itens: [{ tipo: 'servico', servicoId: servico.id }] });
  assert.throws(() => registrarPagamentoComandaBarbearia(EMPRESA_A, comanda.id, { confirmado: true, lojaId: 'loja-a', meioPagamento: 'dinheiro', valor: 40, caixaId: caixaOutraLoja.id }), /não está aberto ou não pertence/);
  assert.equal(caixa.movimentosDoCaixa(EMPRESA_A, caixaOutraLoja.id).length, 0);
  assert.equal(listarLancamentos(EMPRESA_A, { origem: 'barbearia_comanda' }).length, 0);
});
