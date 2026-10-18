import { describe, it as test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pgDeTeste, criarBancoTeste } from './fixtures/clube-pg.js';
import * as bar from '../modules/bar/servico.js';

describe('bar-pdv multiempresa (PostgreSQL)', { skip: pgDeTeste }, () => {
  let ctx;
  before(async () => { ctx = await criarBancoTeste(['081_bar_pdv_multiempresa.sql']); });
  after(async () => { await ctx?.fechar(); });

  test('vende dose como fração da garrafa e mantém o KDS isolado', async () => {
    const empresa = randomUUID();
    const outraEmpresa = randomUUID();
    const produto = await bar.salvarProduto(ctx.db, empresa, {
      nome: 'Dose de gin', categoria: 'Bebidas', setor: 'bar', preco: 18,
      fatorEstoque: 0.05, estoqueAtual: 1, unidade: 'dose',
    });
    const mesa = await bar.salvarMesa(ctx.db, empresa, { numero: 1, tipo: 'fisica' });
    const comanda = await bar.abrirComanda(ctx.db, empresa, { mesaId: mesa.id });
    const atual = await bar.adicionarItens(ctx.db, empresa, comanda.id, [{ produtoId: produto.id, qtd: 1 }]);
    assert.equal(atual.itens[0].status, 'pendente');
    assert.equal((await bar.listarProdutos(ctx.db, empresa))[0].estoqueAtual, 0.95);
    assert.equal((await bar.listarPedidosKds(ctx.db, empresa))[0].comandaId, comanda.id);
    assert.deepEqual(await bar.listarProdutos(ctx.db, outraEmpresa), []);
    await assert.rejects(() => bar.obterComanda(ctx.db, outraEmpresa, comanda.id), (error) => error.code === 'NOT_FOUND');
  });

  test('aceita somente a sequência de status de produção válida', async () => {
    const empresa = randomUUID();
    const produto = await bar.salvarProduto(ctx.db, empresa, { nome: 'X-Burger', categoria: 'Lanches', setor: 'chapa', preco: 30, estoqueAtual: 10 });
    const comanda = await bar.abrirComanda(ctx.db, empresa, { nome: 'Balcão' });
    const aberta = await bar.adicionarItens(ctx.db, empresa, comanda.id, [{ produtoId: produto.id, qtd: 1 }]);
    const item = aberta.itens[0];
    await bar.atualizarStatusItem(ctx.db, empresa, comanda.id, item.id, 'preparando');
    await bar.atualizarStatusItem(ctx.db, empresa, comanda.id, item.id, 'pronto');
    await bar.atualizarStatusItem(ctx.db, empresa, comanda.id, item.id, 'servido');
    await assert.rejects(() => bar.atualizarStatusItem(ctx.db, empresa, comanda.id, item.id, 'pendente'), (error) => error.code === 'TRANSICAO_INVALIDA');
  });

  test('duas vendas concorrentes não consomem a mesma fração do estoque', async () => {
    const empresa = randomUUID();
    const produto = await bar.salvarProduto(ctx.db, empresa, { nome: 'Garrafa fracionada', categoria: 'Bebidas', setor: 'bar', preco: 10, fatorEstoque: 0.1, estoqueAtual: 0.1 });
    const comanda = await bar.abrirComanda(ctx.db, empresa, { nome: 'Concorrência' });
    const resultados = await Promise.allSettled([
      bar.adicionarItens(ctx.db, empresa, comanda.id, [{ produtoId: produto.id, qtd: 1 }]),
      bar.adicionarItens(ctx.db, empresa, comanda.id, [{ produtoId: produto.id, qtd: 1 }]),
    ]);
    assert.equal(resultados.filter((resultado) => resultado.status === 'fulfilled').length, 1);
    assert.equal(resultados.filter((resultado) => resultado.status === 'rejected' && resultado.reason.code === 'ESTOQUE_INSUFICIENTE').length, 1);
    assert.equal((await bar.listarProdutos(ctx.db, empresa))[0].estoqueAtual, 0);
  });
});

test('regras puras do A1 recusam transição inválida e calculam dose', () => {
  assert.equal(bar.consumoDoEstoque(2, 0.05), 0.1);
  assert.equal(bar.validarTransicaoStatusItem('pendente', 'preparando'), 'preparando');
  assert.throws(() => bar.validarTransicaoStatusItem('pronto', 'preparando'), (error) => error.code === 'TRANSICAO_INVALIDA');
});
