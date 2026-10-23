import { describe, it as test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pgDeTeste, criarBancoTeste } from './fixtures/clube-pg.js';
import * as est from '../modules/suprimentos/estoque.js';
import * as cmp from '../modules/suprimentos/compras.js';
import * as razao from '../modules/razao/servico.js';
import * as bar from '../modules/bar/servico.js';

const sql = (arquivo) => readFileSync(new URL(`../migrations/${arquivo}`, import.meta.url), 'utf8');
const STUBS = `
CREATE TABLE empresas (id UUID PRIMARY KEY);
CREATE TABLE lojas (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id UUID NOT NULL, codigo VARCHAR(30), nome VARCHAR(255), cnpj VARCHAR(14), ativa BOOLEAN NOT NULL DEFAULT true);
CREATE TABLE commerce_products (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id UUID NOT NULL, nome VARCHAR(200) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'active');
CREATE TABLE commerce_product_variants (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id UUID NOT NULL, product_id UUID NOT NULL, sku VARCHAR(100), ativo BOOLEAN NOT NULL DEFAULT true);
CREATE TABLE commerce_orders (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id UUID NOT NULL, loja_id UUID, customer_id UUID, public_code VARCHAR(40) NOT NULL DEFAULT 'P', status VARCHAR(30) NOT NULL);
CREATE TABLE commerce_order_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id UUID NOT NULL, order_id UUID NOT NULL, variant_id UUID, quantidade INTEGER NOT NULL);`;

const DEST_CNPJ = '11222333000181';
const CHAVE = '51261050073355000260550010000012341000012341';
function xmlNota() {
  const det = [
    { n: 1, cProd: 'CX-CERV', ean: '7891234567895', xProd: 'CERVEJA LATA 350ML CX C/12', qCom: '2', vUnCom: '48.00', vProd: '96.00' },
    { n: 2, cProd: 'LIMAO', ean: '', xProd: 'Limão tahiti kg', qCom: '3', vUnCom: '5.00', vProd: '15.00' },
  ].map((i) => `<det nItem="${i.n}"><prod><cProd>${i.cProd}</cProd><cEAN>${i.ean}</cEAN><xProd>${i.xProd}</xProd><NCM>22030000</NCM><CFOP>5102</CFOP><uCom>CX</uCom><qCom>${i.qCom}</qCom><vUnCom>${i.vUnCom}</vUnCom><vProd>${i.vProd}</vProd></prod></det>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><NFe><infNFe Id="NFe${CHAVE}" versao="4.00"><ide><serie>1</serie><nNF>1234</nNF><dhEmi>2026-10-10T10:00:00-04:00</dhEmi></ide><emit><CNPJ>50073355000260</CNPJ><xNome>DISTRIBUIDORA BEBIDAS LTDA</xNome><xFant>Dist Bebidas</xFant></emit><dest><CNPJ>${DEST_CNPJ}</CNPJ></dest>${det}<total><ICMSTot><vProd>111.00</vProd><vNF>120.00</vNF></ICMSTot></total></infNFe></NFe><protNFe><infProt><cStat>100</cStat><chNFe>${CHAVE}</chNFe></infProt></protNFe></nfeProc>`;
}

describe('Estoque e compras por empresa (PostgreSQL)', { skip: pgDeTeste }, () => {
  let ctx;
  const A = randomUUID();
  const B = randomUUID();
  let lojaA1; let lojaA2;
  const agora = new Date('2026-10-22T15:00:00-04:00');
  before(async () => {
    ctx = await criarBancoTeste();
    await ctx.db.query(STUBS);
    for (const m of ['081_bar_pdv_multiempresa.sql', '082_financeiro_cadastros_multiempresa.sql', '090_financeiro_razao.sql', '091_estoque_compras.sql']) await ctx.db.query(sql(m));
    await ctx.db.query('INSERT INTO empresas (id) VALUES ($1), ($2)', [A, B]);
    lojaA1 = (await ctx.db.query("INSERT INTO lojas (empresa_id, codigo, nome, cnpj) VALUES ($1, 'BAR', 'Bar do clube', $2) RETURNING id", [A, DEST_CNPJ])).rows[0].id;
    lojaA2 = (await ctx.db.query("INSERT INTO lojas (empresa_id, codigo, nome) VALUES ($1, 'QDR', 'Quadras') RETURNING id", [A])).rows[0].id;
  });
  after(async () => { await ctx?.fechar(); });

  test('item, entrada com custo médio ponderado, saída sem saldo recusada e isolamento', async () => {
    const it = await est.criarItem(ctx.db, A, { nome: 'Gelo 5kg', sku: 'gelo-5', unidade: 'pct', estoqueMinimo: 10 });
    await est.movimentar(ctx.db, A, { lojaId: lojaA1, itemId: it.id, tipo: 'entrada', quantidade: 10, custoUnitario: 8 });
    await est.movimentar(ctx.db, A, { lojaId: lojaA1, itemId: it.id, tipo: 'entrada', quantidade: 10, custoUnitario: 10 });
    assert.equal((await est.obterItem(ctx.db, A, it.id)).custoMedio, 9);
    await assert.rejects(() => est.movimentar(ctx.db, A, { lojaId: lojaA2, itemId: it.id, tipo: 'saida', quantidade: 1 }), (e) => e.code === 'ESTOQUE_INSUFICIENTE');
    await assert.rejects(() => est.criarItem(ctx.db, A, { nome: 'Outro', sku: 'GELO-5' }), (e) => e.code === 'CONFLICT');
    await assert.rejects(() => est.movimentar(ctx.db, B, { itemId: it.id, tipo: 'entrada', quantidade: 1 }), (e) => e.code === 'NOT_FOUND');
    assert.equal((await est.listarItens(ctx.db, B)).length, 0);
    const [linha] = await est.listarItens(ctx.db, A, { lojaId: lojaA1 });
    assert.equal(linha.saldo, 20);
    assert.equal(linha.abaixoDoMinimo, false);
  });

  test('ajuste pede motivo, perda sai pelo custo e transferência move entre unidades', async () => {
    const [gelo] = await est.listarItens(ctx.db, A);
    await assert.rejects(() => est.movimentar(ctx.db, A, { lojaId: lojaA1, itemId: gelo.id, tipo: 'perda', quantidade: 2 }), (e) => e.code === 'VALIDATION_ERROR');
    await est.movimentar(ctx.db, A, { lojaId: lojaA1, itemId: gelo.id, tipo: 'perda', quantidade: 2, motivo: 'derreteu' });
    await est.transferir(ctx.db, A, { itemId: gelo.id, deLojaId: lojaA1, paraLojaId: lojaA2, quantidade: 3, idempotencia: 't1' });
    await assert.rejects(() => est.transferir(ctx.db, A, { itemId: gelo.id, deLojaId: lojaA1, paraLojaId: lojaA2, quantidade: 3, idempotencia: 't1' }), (e) => e.code === 'DUPLICATE');
    const ajuste = await est.movimentar(ctx.db, A, { lojaId: lojaA2, itemId: gelo.id, tipo: 'ajuste', quantidade: 2, motivo: 'contagem' });
    assert.equal(ajuste.quantidade, -1);
    assert.equal((await est.listarItens(ctx.db, A, { lojaId: lojaA1 }))[0].saldo, 15);
    assert.equal((await est.listarItens(ctx.db, A, { lojaId: lojaA2 }))[0].saldo, 2);
    const perdas = await est.perdasDoPeriodo(ctx.db, A, { de: '2020-01-01', ate: '2100-01-01' });
    assert.equal(perdas.valor, 27); // 2 × 9 (perda) + 1 × 9 (ajuste negativo)
  });

  test('inventário considera as vendas feitas depois da abertura', async () => {
    const [gelo] = await est.listarItens(ctx.db, A);
    const inv = await est.abrirInventario(ctx.db, A, { lojaId: lojaA1, descricao: 'Inventário do bar' }, { usuario: 'gerente' });
    await assert.rejects(() => est.abrirInventario(ctx.db, A, { lojaId: lojaA1, descricao: 'Outro' }), (e) => e.code === 'INVENTORY_OPEN');
    assert.equal(inv.itens.find((i) => i.itemId === gelo.id).saldoSistema, 15);
    await est.movimentar(ctx.db, A, { lojaId: lojaA1, itemId: gelo.id, tipo: 'saida', quantidade: 5 }); // venda no meio
    await est.registrarContagem(ctx.db, A, inv.id, [{ itemId: gelo.id, contado: 9 }]);
    const fim = await est.concluirInventario(ctx.db, A, inv.id, { usuario: 'gerente' });
    assert.equal(fim.status, 'concluido');
    assert.equal(fim.ajustes, 1);
    assert.equal((await est.listarItens(ctx.db, A, { lojaId: lojaA1 }))[0].saldo, 9); // 10 no sistema, 9 contados
    await assert.rejects(() => est.registrarContagem(ctx.db, A, inv.id, []), (e) => e.code === 'INVENTORY_CLOSED');
  });

  test('ficha técnica: venda paga no bar baixa os insumos uma vez só', async () => {
    const limao = await est.criarItem(ctx.db, A, { nome: 'Limão', unidade: 'KG', tipo: 'insumo' });
    await est.movimentar(ctx.db, A, { lojaId: lojaA1, itemId: limao.id, tipo: 'entrada', quantidade: 5, custoUnitario: 6 });
    const caipirinha = await bar.salvarProduto(ctx.db, A, { nome: 'Caipirinha', categoria: 'Drinks', setor: 'bar', preco: 25, estoqueAtual: 100 });
    await est.salvarFicha(ctx.db, A, { fonte: 'bar_produto', fonteId: caipirinha.id, itens: [{ itemId: limao.id, fator: 0.2 }] });
    await assert.rejects(() => est.salvarFicha(ctx.db, B, { fonte: 'bar_produto', fonteId: caipirinha.id, itens: [] }), (e) => e.code === 'NOT_FOUND');
    const c = await bar.abrirComanda(ctx.db, A, { nome: 'Mesa 9' });
    await bar.adicionarItens(ctx.db, A, c.id, [{ produtoId: caipirinha.id, qtd: 3 }]);
    assert.equal((await est.baixarConsumoDasVendas(ctx.db, A, { lojaBar: lojaA1 })).baixados, 0, 'comanda aberta não baixa');
    await bar.pagarComanda(ctx.db, A, c.id, { meio: 'pix', servico: false });
    assert.equal((await est.baixarConsumoDasVendas(ctx.db, A, { lojaBar: lojaA1 })).baixados, 1);
    assert.equal((await est.baixarConsumoDasVendas(ctx.db, A, { lojaBar: lojaA1 })).baixados, 0);
    const saldo = (await est.listarItens(ctx.db, A, { lojaId: lojaA1 })).find((i) => i.id === limao.id).saldo;
    assert.equal(saldo, 4.4);
    const fichas = await est.listarFichas(ctx.db, A);
    assert.equal(fichas.find((f) => f.fonteId === caipirinha.id).custo, 1.2);
  });

  test('pedido, recebimento parcial com parcelas: estoque, contas a pagar e espelho do bar', async () => {
    const forn = (await ctx.db.query("INSERT INTO a2_fornecedores (empresa_id, nome, cnpj, status) VALUES ($1, 'Distribuidora', '50073355000260', 'ativo') RETURNING id", [A])).rows[0].id;
    const cerveja = await est.criarItem(ctx.db, A, { nome: 'Cerveja lata 350ml', ean: '7891234567895', unidade: 'UN' });
    const produtoBar = await bar.salvarProduto(ctx.db, A, { nome: 'Cerveja lata', categoria: 'Bebidas', setor: 'bar', preco: 8, estoqueAtual: 0 });
    await est.salvarFicha(ctx.db, A, { fonte: 'bar_produto', fonteId: produtoBar.id, itens: [{ itemId: cerveja.id, fator: 1, espelho: true }] });
    const ped = await cmp.criarPedido(ctx.db, A, { fornecedorId: forn, lojaId: lojaA1, condicaoPagamento: '30/60', itens: [{ itemId: cerveja.id, quantidade: 48, custoUnitario: 4 }] }, { usuario: 'compras' });
    assert.equal(ped.numero, 1);
    assert.equal(ped.total, 192);
    await cmp.mudarStatusPedido(ctx.db, A, ped.id, 'enviar');
    const r = await cmp.receber(ctx.db, A, { pedidoId: ped.id, lojaId: lojaA1, condicaoPagamento: '30/60', itens: [{ itemId: cerveja.id, quantidade: 24, custoUnitario: 4.1 }] }, { usuario: 'compras', agora });
    assert.equal(r.contasAPagar.length, 2);
    assert.deepEqual(r.contasAPagar.map((l) => [l.vencimento, l.valor, l.natureza, l.status]), [['2026-11-21', 49.2, 'pagar', 'pendente'], ['2026-12-21', 49.2, 'pagar', 'pendente']]);
    assert.equal((await cmp.obterPedido(ctx.db, A, ped.id)).status, 'parcial');
    assert.equal((await est.listarItens(ctx.db, A, { lojaId: lojaA1 })).find((i) => i.id === cerveja.id).saldo, 24);
    assert.equal((await bar.listarProdutos(ctx.db, A)).find((p) => p.id === produtoBar.id).estoqueAtual, 24);
    const aPagar = await razao.resumo(ctx.db, A, { agora });
    assert.equal(aPagar.aPagar, 98.4);
  });

  test('NF-e: prévia confere destinatário e sugere itens; lançar aprende o código e não repete', async () => {
    const previa = await cmp.previaNfe(ctx.db, A, xmlNota());
    assert.equal(previa.autorizada, true);
    assert.deepEqual(previa.avisos, []);
    assert.equal(previa.fornecedor?.nome, 'Distribuidora');
    assert.equal(previa.itens[0].criterio, 'ean');
    assert.equal(previa.itens[1].sugestao, null);
    await assert.rejects(() => cmp.lancarNfe(ctx.db, A, { xml: xmlNota(), lojaId: lojaA1 }), (e) => e.code === 'ITEM_NAO_MAPEADO');
    const r = await cmp.lancarNfe(ctx.db, A, { xml: xmlNota(), lojaId: lojaA1, mapeamento: [{ item: 1, fator: 12 }, { item: 2, criarItem: { nome: 'Limão tahiti', unidade: 'KG', tipo: 'insumo' } }] }, { usuario: 'compras', agora });
    assert.equal(r.recebimento.valorTotal, 120);
    assert.equal(r.contasAPagar.length, 1);
    assert.equal(r.contasAPagar[0].documento, 'NF 1234/1');
    const cerveja = (await est.listarItens(ctx.db, A, { lojaId: lojaA1 })).find((i) => i.nome === 'Cerveja lata 350ml');
    assert.equal(cerveja.saldo, 48); // 24 do pedido + 2 caixas × 12
    await assert.rejects(() => cmp.lancarNfe(ctx.db, A, { xml: xmlNota(), lojaId: lojaA1 }), (e) => e.code === 'NFE_DUPLICATE');
    const outraEmpresa = await cmp.previaNfe(ctx.db, B, xmlNota());
    assert.ok(outraEmpresa.avisos.length > 0, 'destinatário não confere na outra empresa');
    const reaprendido = await cmp.previaNfe(ctx.db, A, xmlNota().replaceAll(CHAVE, '51261050073355000260550010000012351000012349'));
    assert.equal(reaprendido.itens[0].criterio, 'usado_antes');
    assert.equal(reaprendido.itens[0].fator, 12);
  });

  test('condição de pagamento: centavo vai para a primeira parcela', () => {
    assert.deepEqual(cmp.parcelasDaCondicao(100, '30/60/90', '2026-01-31').map((p) => p.valor), [33.34, 33.33, 33.33]);
    assert.equal(cmp.parcelasDaCondicao(10, 'a_vista', '2026-01-31')[0].vencimento, '2026-01-31');
    assert.throws(() => cmp.parcelasDaCondicao(10, '30/x', '2026-01-31'), (e) => e.code === 'VALIDATION_ERROR');
  });

  test('DRE: perdas são informação, sem somar de novo no CMV (a compra já está lá)', async () => {
    const d = await razao.dre(ctx.db, A, { de: '2020-01-01', ate: '2100-01-01' });
    const cmv = d.grupos.find((g) => g.grupo === 'cmv');
    assert.ok(!cmv.linhas.some((l) => l.categoria === 'Perdas e diferenças de estoque'));
    assert.ok(d.perdasEstoque && d.perdasEstoque.movimentos > 0);
  });
});

describe('Estoque e compras: correções da revisão (PostgreSQL)', { skip: pgDeTeste }, () => {
  let ctx; let loja; let outraLoja;
  const C = randomUUID(); const D = randomUUID();
  const agora = new Date('2026-10-22T15:00:00-04:00');
  before(async () => {
    ctx = await criarBancoTeste();
    await ctx.db.query(STUBS);
    for (const m of ['081_bar_pdv_multiempresa.sql', '082_financeiro_cadastros_multiempresa.sql', '090_financeiro_razao.sql', '091_estoque_compras.sql']) await ctx.db.query(sql(m));
    await ctx.db.query('INSERT INTO empresas (id) VALUES ($1), ($2)', [C, D]);
    loja = (await ctx.db.query("INSERT INTO lojas (empresa_id, codigo, nome) VALUES ($1, 'U1', 'Unidade 1') RETURNING id", [C])).rows[0].id;
    outraLoja = (await ctx.db.query("INSERT INTO lojas (empresa_id, codigo, nome) VALUES ($1, 'X', 'De outra empresa') RETURNING id", [D])).rows[0].id;
  });
  after(async () => { await ctx?.fechar(); });
  const saldo = async (itemId) => (await est.listarItens(ctx.db, C, { lojaId: loja })).find((i) => i.id === itemId).saldo;

  test('unidade de outra empresa é recusada no movimento e no pedido', async () => {
    const it = await est.criarItem(ctx.db, C, { nome: 'Copo', unidade: 'UN' });
    await assert.rejects(() => est.movimentar(ctx.db, C, { lojaId: outraLoja, itemId: it.id, tipo: 'entrada', quantidade: 1, custoUnitario: 1 }), (e) => e.status === 404);
    await assert.rejects(() => cmp.criarPedido(ctx.db, C, { fornecedorNome: 'X Ltda', lojaId: outraLoja, itens: [{ itemId: it.id, quantidade: 1 }] }), (e) => e.status === 404);
  });

  test('recebimento: idempotência no clique duplo, pedido não recebe a mais nem item repetido', async () => {
    const it = await est.criarItem(ctx.db, C, { nome: 'Guardanapo', unidade: 'PCT' });
    await assert.rejects(() => cmp.criarPedido(ctx.db, C, { fornecedorNome: 'Papelaria', lojaId: loja, itens: [{ itemId: it.id, quantidade: 5 }, { itemId: it.id, quantidade: 5 }] }), (e) => e.code === 'VALIDATION_ERROR');
    const ped = await cmp.criarPedido(ctx.db, C, { fornecedorNome: 'Papelaria', lojaId: loja, condicaoPagamento: '30/60', itens: [{ itemId: it.id, quantidade: 10, custoUnitario: 5 }] });
    const corpo = { pedidoId: ped.id, idempotencia: 'clique-1', itens: [{ itemId: it.id, quantidade: 4, custoUnitario: 5 }] };
    const res = await Promise.allSettled([cmp.receber(ctx.db, C, corpo, { agora }), cmp.receber(ctx.db, C, corpo, { agora })]);
    assert.equal(res.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(res.find((r) => r.status === 'rejected').reason.code, 'DUPLICATE');
    const ok = res.find((r) => r.status === 'fulfilled').value;
    assert.equal(ok.contasAPagar.length, 2, 'condição 30/60 veio do pedido');
    assert.equal(await saldo(it.id), 4, 'unidade veio do pedido');
    // dois recebimentos paralelos de 5 com 6 pendentes: um passa, o outro excede
    const par = await Promise.allSettled([1, 2].map(() => cmp.receber(ctx.db, C, { pedidoId: ped.id, itens: [{ itemId: it.id, quantidade: 5, custoUnitario: 5 }] }, { agora })));
    assert.equal(par.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(par.find((r) => r.status === 'rejected').reason.code, 'RECEBIMENTO_ACIMA');
    assert.equal(await saldo(it.id), 9);
  });

  test('recebimento: total, parcelas e pago no ato conferidos', async () => {
    const it = await est.criarItem(ctx.db, C, { nome: 'Canudo', unidade: 'PCT' });
    const base = { fornecedorNome: 'Papelaria', lojaId: loja, itens: [{ itemId: it.id, quantidade: 10, custoUnitario: 1 }] };
    await assert.rejects(() => cmp.receber(ctx.db, C, { ...base, valorTotal: 500 }, { agora }), (e) => e.code === 'VALIDATION_ERROR');
    await assert.rejects(() => cmp.receber(ctx.db, C, { ...base, parcelas: [{ vencimento: '2026-11-01', valor: 5 }, { vencimento: '2026-12-01', valor: 4.99 }] }, { agora }), (e) => e.code === 'VALIDATION_ERROR');
    await assert.rejects(() => cmp.receber(ctx.db, C, { ...base, condicaoPagamento: '30/60', pagoNoAto: true }, { agora }), (e) => e.code === 'VALIDATION_ERROR');
  });

  test('inventário: venda depois da contagem continua descontada', async () => {
    const it = await est.criarItem(ctx.db, C, { nome: 'Água 500ml', unidade: 'UN' });
    await est.movimentar(ctx.db, C, { lojaId: loja, itemId: it.id, tipo: 'entrada', quantidade: 10, custoUnitario: 1 });
    const inv = await est.abrirInventario(ctx.db, C, { lojaId: loja, descricao: 'Contagem' });
    await est.registrarContagem(ctx.db, C, inv.id, [{ itemId: it.id, contado: 10 }]);
    await est.movimentar(ctx.db, C, { lojaId: loja, itemId: it.id, tipo: 'saida', quantidade: 3 });
    const fim = await est.concluirInventario(ctx.db, C, inv.id);
    assert.equal(fim.ajustes, 0);
    assert.equal(await saldo(it.id), 7);
  });

  test('perdas líquidas das sobras e DRE sem contagem dupla', async () => {
    const it = await est.criarItem(ctx.db, C, { nome: 'Pão', unidade: 'UN' });
    await cmp.receber(ctx.db, C, { fornecedorNome: 'Padaria', lojaId: loja, itens: [{ itemId: it.id, quantidade: 10, custoUnitario: 10 }] }, { agora });
    await est.movimentar(ctx.db, C, { lojaId: loja, itemId: it.id, tipo: 'ajuste', quantidade: 8, motivo: 'contagem' });
    await est.movimentar(ctx.db, C, { lojaId: loja, itemId: it.id, tipo: 'ajuste', quantidade: 10, motivo: 'achou' });
    const liq = await est.perdasDoPeriodo(ctx.db, C, { de: '2020-01-01', ate: '2100-01-01' });
    assert.equal(liq.valor, 0);
    await est.movimentar(ctx.db, C, { lojaId: loja, itemId: it.id, tipo: 'perda', quantidade: 10, motivo: 'mofou' });
    const d = await razao.dre(ctx.db, C, { de: '2020-01-01', ate: '2100-01-01' });
    assert.equal(d.grupos.find((g) => g.grupo === 'cmv').total, -(20 + 25 + 100), 'só as compras (guardanapo 4+5 e pão)');
    assert.equal(d.perdasEstoque.valor, 100);
  });

  test('espelho respeita o fator de estoque do bar e um item espelha um produto só', async () => {
    const garrafa = await est.criarItem(ctx.db, C, { nome: 'Whisky garrafa', unidade: 'UN' });
    const dose = await bar.salvarProduto(ctx.db, C, { nome: 'Dose de whisky', categoria: 'Drinks', setor: 'bar', preco: 30, estoqueAtual: 0, fatorEstoque: 0.05 });
    await est.salvarFicha(ctx.db, C, { fonte: 'bar_produto', fonteId: dose.id, itens: [{ itemId: garrafa.id, fator: 0.05, espelho: true }] });
    const outro = await bar.salvarProduto(ctx.db, C, { nome: 'Dose dupla', categoria: 'Drinks', setor: 'bar', preco: 55, estoqueAtual: 0, fatorEstoque: 0.1 });
    await assert.rejects(() => est.salvarFicha(ctx.db, C, { fonte: 'bar_produto', fonteId: outro.id, itens: [{ itemId: garrafa.id, fator: 0.1, espelho: true }] }), (e) => e.code === 'VALIDATION_ERROR');
    await cmp.receber(ctx.db, C, { fornecedorNome: 'Adega', lojaId: loja, itens: [{ itemId: garrafa.id, quantidade: 2, custoUnitario: 90 }] }, { agora });
    assert.equal((await bar.listarProdutos(ctx.db, C)).find((p) => p.id === dose.id).estoqueAtual, 2);
  });

  test('venda devolvida depois da baixa devolve o insumo; item de comanda paga não se cancela', async () => {
    const it = await est.criarItem(ctx.db, C, { nome: 'Camiseta', unidade: 'UN' });
    await est.movimentar(ctx.db, C, { lojaId: loja, itemId: it.id, tipo: 'entrada', quantidade: 10, custoUnitario: 20 });
    const prod = (await ctx.db.query("INSERT INTO commerce_products (empresa_id, nome) VALUES ($1, 'Camiseta') RETURNING id", [C])).rows[0].id;
    const vari = (await ctx.db.query('INSERT INTO commerce_product_variants (empresa_id, product_id, sku) VALUES ($1, $2, $3) RETURNING id', [C, prod, 'CAM-M'])).rows[0].id;
    await est.salvarFicha(ctx.db, C, { fonte: 'loja_variante', fonteId: vari, itens: [{ itemId: it.id, fator: 1 }] });
    const ped = (await ctx.db.query("INSERT INTO commerce_orders (empresa_id, loja_id, status) VALUES ($1, $2, 'paid') RETURNING id", [C, loja])).rows[0].id;
    await ctx.db.query('INSERT INTO commerce_order_items (empresa_id, order_id, variant_id, quantidade) VALUES ($1, $2, $3, 3)', [C, ped, vari]);
    await est.baixarConsumoDasVendas(ctx.db, C);
    assert.equal(await saldo(it.id), 7);
    await ctx.db.query("UPDATE commerce_orders SET status = 'refunded' WHERE id = $1", [ped]);
    assert.equal((await est.baixarConsumoDasVendas(ctx.db, C)).estornados, 1);
    assert.equal((await est.baixarConsumoDasVendas(ctx.db, C)).estornados, 0);
    assert.equal(await saldo(it.id), 10);
    const lata = await bar.salvarProduto(ctx.db, C, { nome: 'Refri', categoria: 'Bebidas', setor: 'bar', preco: 6, estoqueAtual: 10 });
    const com = await bar.abrirComanda(ctx.db, C, { nome: 'Mesa 1' });
    await bar.adicionarItens(ctx.db, C, com.id, [{ produtoId: lata.id, qtd: 1 }]);
    await bar.pagarComanda(ctx.db, C, com.id, { meio: 'pix', servico: false });
    await assert.rejects(() => bar.cancelarItemPorIndice(ctx.db, C, com.id, 0), (e) => e.code === 'COMANDA_FECHADA');
  });

  test('unidade do bar configurável; com uma unidade ativa ela é a padrão', async () => {
    assert.equal((await est.obterConfig(ctx.db, C)).lojaBarEfetiva, loja);
    await assert.rejects(() => est.salvarConfig(ctx.db, C, { lojaBar: outraLoja }), (e) => e.status === 404);
    assert.equal((await est.salvarConfig(ctx.db, C, { lojaBar: loja })).lojaBar, loja);
  });
});
