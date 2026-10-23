import { describe, it as test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pgDeTeste, criarBancoTeste } from './fixtures/clube-pg.js';
import * as est from '../modules/suprimentos/estoque.js';
import * as varejo from '../modules/varejo/servico.js';

const sql = (arquivo) => readFileSync(new URL(`../migrations/${arquivo}`, import.meta.url), 'utf8');

describe('Varejo/supermercado (PostgreSQL)', { skip: pgDeTeste }, () => {
  let ctx; let l1; let l2; let arroz; let feijao;
  const A = randomUUID(); const B = randomUUID();
  const agora = new Date('2026-10-22T15:00:00-04:00');
  before(async () => {
    ctx = await criarBancoTeste();
    await ctx.db.query('CREATE TABLE empresas (id UUID PRIMARY KEY); CREATE TABLE lojas (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id UUID NOT NULL, nome VARCHAR(120), cnpj VARCHAR(14), ativa BOOLEAN NOT NULL DEFAULT true);');
    for (const m of ['081_bar_pdv_multiempresa.sql', '082_financeiro_cadastros_multiempresa.sql', '090_financeiro_razao.sql', '091_estoque_compras.sql', '096_varejo_supermercado.sql']) await ctx.db.query(sql(m));
    await ctx.db.query('INSERT INTO empresas (id) VALUES ($1), ($2)', [A, B]);
    l1 = (await ctx.db.query("INSERT INTO lojas (empresa_id, nome) VALUES ($1, 'Centro') RETURNING id", [A])).rows[0].id;
    l2 = (await ctx.db.query("INSERT INTO lojas (empresa_id, nome) VALUES ($1, 'Bairro') RETURNING id", [A])).rows[0].id;
    arroz = await est.criarItem(ctx.db, A, { nome: 'Arroz 5kg', ean: '7890000000017', unidade: 'UN', custoMedio: 20 });
    feijao = await est.criarItem(ctx.db, A, { nome: 'Feijão 1kg', ean: '7890000000024', unidade: 'UN', custoMedio: 6 });
    await est.movimentar(ctx.db, A, { lojaId: l1, itemId: arroz.id, tipo: 'entrada', quantidade: 10, custoUnitario: 20 });
  });
  after(async () => { await ctx?.fechar(); });

  test('preço base, preço da unidade, promoção vigente e margem', async () => {
    await varejo.configurarProduto(ctx.db, A, arroz.id, { precoBase: 30, departamento: 'Mercearia', plu: '123' });
    const naL2 = await varejo.configurarProduto(ctx.db, A, arroz.id, { precoUnidade: 28 }, { lojaId: l2 });
    assert.equal(naL2.precoFinal, 28);
    await assert.rejects(() => varejo.configurarProduto(ctx.db, A, arroz.id, { precoUnidade: 1 }, { lojaId: randomUUID() }), (e) => e.status === 404);
    const promo = await varejo.criarPromocao(ctx.db, A, { nome: 'Semana do arroz', tipo: 'percentual', percentual: 10, inicio: '2026-10-20T00:00:00-04:00', fim: '2026-10-27T00:00:00-04:00', itens: [arroz.id], status: 'ativa' });
    const [p1] = (await varejo.listarProdutos(ctx.db, A, { lojaId: l1, agora })).filter((p) => p.id === arroz.id);
    assert.equal(p1.precoFinal, 27);
    assert.equal(p1.promocao.texto, '10% OFF');
    assert.equal(p1.margem, 25.9);
    assert.equal(p1.saldo, 10);
    await varejo.mudarStatusPromocao(ctx.db, A, promo.id, 'pausada');
    assert.equal((await varejo.buscarPorCodigo(ctx.db, A, '7890000000017', { lojaId: l1, agora })).precoFinal, 30);
    await assert.rejects(() => varejo.criarPromocao(ctx.db, A, { nome: 'Ruim', tipo: 'leve_pague', leve: 2, pague: 3, inicio: '2026-10-20', fim: '2026-10-21', itens: [arroz.id] }), (e) => e.code === 'VALIDATION_ERROR');
    assert.equal((await varejo.listarProdutos(ctx.db, B)).length, 0);
  });

  test('promoção: menor preço por unidade ganha; preço fixo acima do de venda é ignorado; leve-pague é só texto', () => {
    const promos = [
      { id: 'a', tipo: 'preco_fixo', preco_fixo: 35, nome: 'Fixo acima' },
      { id: 'b', tipo: 'leve_pague', leve: 3, pague: 2, nome: '3 por 2' },
    ];
    // preço fixo acima não vale; sobra o leve-pague, que mantém o preço de venda
    assert.deepEqual(varejo.aplicarPromocoes(30, promos).id, 'b');
    assert.equal(varejo.aplicarPromocoes(30, promos).preco, 30);
    // um desconto real ganha do leve-pague
    assert.equal(varejo.aplicarPromocoes(30, [...promos, { id: 'c', tipo: 'percentual', percentual: 5 }]).id, 'c');
    assert.equal(varejo.aplicarPromocoes(30, [{ id: 'd', tipo: 'preco_fixo', preco_fixo: 30 }]), null);
  });

  test('promoção com data sozinha usa o fuso: começa à 0h e termina no fim do dia', async () => {
    const p = await varejo.criarPromocao(ctx.db, A, { nome: 'Só sábado', tipo: 'percentual', percentual: 5, inicio: '2026-10-24', fim: '2026-10-24', itens: [arroz.id] });
    assert.equal(new Date(p.inicio).toISOString(), '2026-10-24T04:00:00.000Z');
    assert.equal(new Date(p.fim).toISOString(), '2026-10-25T04:00:00.000Z');
  });

  test('lotes com validade: entrada, baixa, situação e isolamento', async () => {
    await varejo.registrarLote(ctx.db, A, { itemId: feijao.id, lote: 'L01', validade: '2026-10-25', quantidade: 12 }, { lojaId: l1 });
    await varejo.registrarLote(ctx.db, A, { itemId: feijao.id, lote: 'L00', validade: '2026-10-01', quantidade: 3 }, { lojaId: l1 });
    await varejo.registrarLote(ctx.db, A, { itemId: feijao.id, lote: 'L01', quantidade: -2 }, { lojaId: l1 });
    await assert.rejects(() => varejo.registrarLote(ctx.db, A, { itemId: feijao.id, lote: 'L01', quantidade: -50 }, { lojaId: l1 }), (e) => e.code === 'ESTOQUE_INSUFICIENTE');
    const lotes = await varejo.listarLotes(ctx.db, A, { lojaId: l1, hoje: '2026-10-22' });
    assert.deepEqual(lotes.map((l) => [l.lote, l.quantidade, l.situacao]), [['L00', 3, 'vencido'], ['L01', 10, 'critico']]);
    assert.equal((await varejo.listarLotes(ctx.db, B)).length, 0);
    // lote é por unidade: sem unidade não registra
    await assert.rejects(() => varejo.registrarLote(ctx.db, A, { itemId: feijao.id, lote: 'L02', quantidade: 1 }), (e) => e.code === 'VALIDATION_ERROR');
  });

  test('transferência: sai na origem ao enviar, entra no destino ao receber, falta vira perda da origem', async () => {
    const t = await varejo.criarTransferencia(ctx.db, A, { origemId: l1, destinoId: l2, itens: [{ itemId: arroz.id, quantidade: 4 }] }, { usuario: 'gerente' });
    assert.equal(t.status, 'rascunho');
    await assert.rejects(() => varejo.acaoTransferencia(ctx.db, A, t.id, 'receber'), (e) => e.code === 'INVALID_STATUS');
    await varejo.acaoTransferencia(ctx.db, A, t.id, 'enviar', { lojaRestrita: l1 });
    const saldo = async (loja) => (await est.listarItens(ctx.db, A, { lojaId: loja })).find((i) => i.id === arroz.id)?.saldo ?? 0;
    assert.deepEqual([await saldo(l1), await saldo(l2)], [6, 0]);
    await assert.rejects(() => varejo.acaoTransferencia(ctx.db, A, t.id, 'receber', { lojaRestrita: l1 }), (e) => e.status === 404);
    const r = await varejo.acaoTransferencia(ctx.db, A, t.id, 'receber', { recebidos: [{ itemId: arroz.id, quantidade: 3 }], motivoFalta: 'pacote rasgado', lojaRestrita: l2 });
    assert.equal(r.status, 'recebida_parcial');
    assert.deepEqual([await saldo(l1), await saldo(l2)], [6, 3]);
    const perda = (await ctx.db.query("SELECT quantidade, motivo FROM est_movimentos WHERE empresa_id = $1 AND tipo = 'perda' AND origem_id = $2", [A, t.id])).rows;
    assert.equal(perda.length, 1);
    assert.equal(Number(perda[0].quantidade), -1);
    assert.match(perda[0].motivo, /pacote rasgado/);
    const grande = await varejo.criarTransferencia(ctx.db, A, { origemId: l1, destinoId: l2, itens: [{ itemId: arroz.id, quantidade: 100 }] });
    await assert.rejects(() => varejo.acaoTransferencia(ctx.db, A, grande.id, 'enviar'), (e) => e.code === 'ESTOQUE_INSUFICIENTE');
    const c = await varejo.criarTransferencia(ctx.db, A, { origemId: l1, destinoId: l2, itens: [{ itemId: arroz.id, quantidade: 2 }] });
    await varejo.acaoTransferencia(ctx.db, A, c.id, 'enviar');
    await varejo.acaoTransferencia(ctx.db, A, c.id, 'cancelar');
    assert.equal(await saldo(l1), 6);
  });

  test('etiquetas com o preço vigente (e o "de" da promoção)', async () => {
    const promo = await varejo.criarPromocao(ctx.db, A, { nome: 'Feijão fixo', tipo: 'preco_fixo', precoFixo: 7.49, inicio: '2026-10-20T00:00:00-04:00', fim: '2026-10-30T00:00:00-04:00', itens: [feijao.id], status: 'ativa' });
    await assert.rejects(() => varejo.gerarEtiquetas(ctx.db, A, { itens: [{ itemId: feijao.id, quantidade: 2 }] }, { lojaId: l1, agora }), (e) => e.code === 'SEM_PRECO');
    await varejo.configurarProduto(ctx.db, A, feijao.id, { precoBase: 8.99 });
    const r = await varejo.gerarEtiquetas(ctx.db, A, { itens: [{ itemId: feijao.id, quantidade: 2 }, { itemId: arroz.id }] }, { lojaId: l1, agora });
    assert.deepEqual(r.etiquetas.map((e) => [e.nome, e.preco, e.precoDe]), [['Feijão 1kg', 7.49, 8.99], ['Arroz 5kg', 30, null]]);
    assert.equal((await varejo.listarEtiquetas(ctx.db, A, { lojaId: l1 })).length, 2);
    void promo;
  });
});
