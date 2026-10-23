import { describe, it as test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pgDeTeste, criarBancoTeste } from './fixtures/clube-pg.js';
import * as pdv from '../modules/pdv-offline/servico.js';
import * as bar from '../modules/bar/servico.js';
import * as fontes from '../modules/razao/fontes.js';
import * as razao from '../modules/razao/servico.js';

const sql = (arquivo) => readFileSync(new URL(`../migrations/${arquivo}`, import.meta.url), 'utf8');

describe('PDV offline (PostgreSQL)', { skip: pgDeTeste }, () => {
  let ctx; let loja; let terminal; let token; let cerveja;
  const A = randomUUID(); const B = randomUUID();
  const agora = new Date('2026-10-22T20:00:00-04:00');
  before(async () => {
    ctx = await criarBancoTeste();
    await ctx.db.query('CREATE TABLE empresas (id UUID PRIMARY KEY); CREATE TABLE lojas (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id UUID NOT NULL, nome VARCHAR(120), ativa BOOLEAN NOT NULL DEFAULT true);');
    for (const m of ['081_bar_pdv_multiempresa.sql', '090_financeiro_razao.sql', '095_pdv_offline_multiempresa.sql']) await ctx.db.query(sql(m));
    await ctx.db.query('INSERT INTO empresas (id) VALUES ($1), ($2)', [A, B]);
    loja = (await ctx.db.query("INSERT INTO lojas (empresa_id, nome) VALUES ($1, 'Sede') RETURNING id", [A])).rows[0].id;
    cerveja = await bar.salvarProduto(ctx.db, A, { nome: 'Cerveja', categoria: 'Bebidas', setor: 'bar', preco: 10, estoqueAtual: 1 });
  });
  after(async () => { await ctx?.fechar(); });

  const venda = (extra = {}) => ({ id_externo: randomUUID(), ocorreu_em: '2026-10-22T18:30:00-04:00', usuario_vendedor_id: randomUUID(), itens: [{ produto_id: cerveja.id, quantidade: 3, valor_unitario: 10 }], pagamentos: [{ tipo: 'dinheiro', valor: 30 }], ...extra });
  const evento = (payload, seq = 1) => ({ id: randomUUID(), sequencia: seq, tipo: 'venda_offline', payload, criado_em: '2026-10-22T18:30:00-04:00' });

  test('terminal: token só na criação, hash no banco, autenticação e rotação', async () => {
    const r = await pdv.criarTerminal(ctx.db, A, { loja_id: loja, codigo: 'caixa-01', nome: 'Caixa principal' });
    terminal = r.terminal; token = r.token_provisionamento;
    assert.equal(terminal.codigo, 'CAIXA-01');
    assert.match(token, /^kytto_term_/);
    const bruto = (await ctx.db.query('SELECT token_hash FROM pdv_terminais WHERE id = $1', [terminal.id])).rows[0].token_hash;
    assert.notEqual(bruto, token);
    assert.equal((await pdv.autenticarTerminal(ctx.db, terminal.id, token)).id, terminal.id);
    await assert.rejects(() => pdv.autenticarTerminal(ctx.db, terminal.id, 'kytto_term_errado'), (e) => e.status === 401);
    await assert.rejects(() => pdv.criarTerminal(ctx.db, B, { loja_id: loja, codigo: 'X1', nome: 'Outro' }), (e) => e.status === 404);
    await assert.rejects(() => pdv.criarTerminal(ctx.db, A, { loja_id: loja, codigo: 'CAIXA-01', nome: 'Duplicado' }), (e) => e.code === 'CONFLICT');
    const rot = await pdv.rotacionarToken(ctx.db, A, terminal.id);
    await assert.rejects(() => pdv.autenticarTerminal(ctx.db, terminal.id, token), (e) => e.status === 401);
    token = rot.token_provisionamento;
    assert.equal((await pdv.listarTerminais(ctx.db, B)).length, 0);
  });

  test('venda offline vira comanda paga com a data da venda, mesmo sem estoque, e entra no razão uma vez', async () => {
    const t = await pdv.autenticarTerminal(ctx.db, terminal.id, token);
    const v = venda();
    const lote = randomUUID();
    const ev = evento(v);
    const r = await pdv.sincronizar(ctx.db, t, { lote_cliente_id: lote, eventos: [ev] }, { agora });
    assert.equal(r.eventos[0].resultado.aplicado, true);
    assert.deepEqual(r.eventos[0].resultado.conflitos, ['estoque_insuficiente']);
    const comandaId = r.eventos[0].resultado.comanda_id;
    const c = await bar.obterComanda(ctx.db, A, comandaId);
    assert.equal(c.status, 'paga');
    assert.equal((await bar.listarProdutos(ctx.db, A)).find((p) => p.id === cerveja.id).estoqueAtual, 0);
    // mesmo lote de novo, mesmo evento em outro lote e mesma venda em outro evento: nada duplica
    assert.equal((await pdv.sincronizar(ctx.db, t, { lote_cliente_id: lote, eventos: [ev] }, { agora })).repetido, true);
    await pdv.sincronizar(ctx.db, t, { lote_cliente_id: randomUUID(), eventos: [ev] }, { agora });
    const r3 = await pdv.sincronizar(ctx.db, t, { lote_cliente_id: randomUUID(), eventos: [evento(v, 2)] }, { agora });
    assert.equal(r3.eventos[0].resultado.repetida, true);
    assert.equal((await ctx.db.query("SELECT count(*)::int AS n FROM bar_comandas WHERE empresa_id = $1 AND status = 'paga'", [A])).rows[0].n, 1);
    await fontes.sincronizarBar(ctx.db, A);
    const [l] = await razao.listar(ctx.db, A, { origem: 'bar_comanda' });
    assert.equal(l.valor, 30);
    assert.equal(l.competencia, '2026-10-22');
  });

  test('preço divergente aplica e avisa; produto inexistente segura até a gerência; Pix e total errado falham', async () => {
    const t = await pdv.autenticarTerminal(ctx.db, terminal.id, token);
    const r = await pdv.sincronizar(ctx.db, t, { lote_cliente_id: randomUUID(), eventos: [
      evento(venda({ itens: [{ produto_id: cerveja.id, quantidade: 1, valor_unitario: 8 }], pagamentos: [{ tipo: 'cartao_debito', valor: 8, referencia_externa: 'NSU123' }] }), 1),
      evento(venda({ itens: [{ produto_id: randomUUID(), quantidade: 1, valor_unitario: 5 }], pagamentos: [{ tipo: 'dinheiro', valor: 5 }] }), 2),
      evento(venda({ pagamentos: [{ tipo: 'pix', valor: 30 }] }), 3),
      evento(venda({ pagamentos: [{ tipo: 'dinheiro', valor: 29 }] }), 4),
    ] }, { agora });
    assert.deepEqual(r.eventos.map((e) => e.status), ['conflito', 'conflito', 'falha', 'falha']);
    assert.equal(r.eventos[0].resultado.aplicado, true);
    assert.equal(r.eventos[1].resultado.aplicado, false);
    assert.equal(r.lote.status, 'parcial');
    const conflitos = await pdv.listarConflitos(ctx.db, A);
    // venda segurada registra só o bloqueio; Pix e total errado aparecem como venda recusada
    assert.deepEqual(conflitos.map((c) => c.tipo_conflito).sort(), ['estoque_insuficiente', 'estoque_insuficiente', 'preco_divergente', 'produto_inexistente', 'venda_rejeitada', 'venda_rejeitada']);
    assert.equal((await ctx.db.query("SELECT meio FROM bar_comanda_pagamentos WHERE comanda_id = $1", [r.eventos[0].resultado.comanda_id])).rows[0].meio, 'cartao_debito');
    // aviso só aceita "ciente"
    const aviso = conflitos.find((c) => c.tipo_conflito === 'preco_divergente');
    await assert.rejects(() => pdv.resolverConflito(ctx.db, A, aviso.id, 'aceito_cliente'), (e) => e.status === 422);
    assert.equal((await pdv.resolverConflito(ctx.db, A, aviso.id, 'aceito_servidor')).status, 'resolvido')
    const bloqueante = conflitos.find((c) => c.tipo_conflito === 'produto_inexistente');
    await assert.rejects(() => pdv.resolverConflito(ctx.db, A, bloqueante.id, 'aceito_cliente'), (e) => e.code === 'AINDA_EM_CONFLITO');
    assert.equal((await pdv.resolverConflito(ctx.db, A, bloqueante.id, 'descartado', { usuario: 'gerente' })).status, 'resolvido');
    assert.equal((await pdv.listarConflitos(ctx.db, B)).length, 0);
  });

  test('desconto e acréscimo: itens com o preço cobrado, desconto na comanda, total = pago; estoque efetivo no movimento', async () => {
    const t = await pdv.autenticarTerminal(ctx.db, terminal.id, token);
    const agua = await bar.salvarProduto(ctx.db, A, { nome: 'Água', categoria: 'Bebidas', setor: 'bar', preco: 3.33, estoqueAtual: 2 });
    const v = venda({ itens: [{ produto_id: agua.id, quantidade: 3, valor_unitario: 3.33, desconto_item: 0.1 }], valor_acrescimo: 1, pagamentos: [{ tipo: 'dinheiro', valor: 10.89 }] });
    const r = await pdv.sincronizar(ctx.db, t, { lote_cliente_id: randomUUID(), eventos: [evento(v)] }, { agora });
    assert.equal(r.eventos[0].resultado.aplicado, true);
    const c = (await ctx.db.query('SELECT * FROM bar_comandas WHERE id = $1', [r.eventos[0].resultado.comanda_id])).rows[0];
    const itens = (await ctx.db.query('SELECT quantidade, valor_unitario FROM bar_comanda_itens WHERE comanda_id = $1', [c.id])).rows;
    const somaItens = itens.reduce((s, i) => s + Number(i.quantidade) * Number(i.valor_unitario), 0);
    assert.equal(Number(c.total), 9.99);
    assert.ok(Math.abs(somaItens - Number(c.total)) < 0.001);
    assert.equal(Number(c.desconto_valor), 0.1);
    assert.equal(Number(c.valor_final), 10.89);
    // havia 2, vendeu 3: o movimento registra 2 (o que saiu de fato)
    const mov = (await ctx.db.query("SELECT quantidade, saldo_apos FROM bar_estoque_movimentos WHERE produto_id = $1 AND origem = 'pdv_offline'", [agua.id])).rows;
    assert.deepEqual(mov.map((m) => [Number(m.quantidade), Number(m.saldo_apos)]), [[2, 0]]);
    // quantidade com mais de 3 casas e TEF sem NSU são recusados
    const r2 = await pdv.sincronizar(ctx.db, t, { lote_cliente_id: randomUUID(), eventos: [
      evento(venda({ itens: [{ produto_id: agua.id, quantidade: 1.0001, valor_unitario: 3.33 }], pagamentos: [{ tipo: 'dinheiro', valor: 3.33 }] }), 1),
      evento(venda({ itens: [{ produto_id: agua.id, quantidade: 1, valor_unitario: 3.33 }], pagamentos: [{ tipo: 'tef', valor: 3.33 }] }), 2),
    ] }, { agora });
    assert.deepEqual(r2.eventos.map((e) => e.status), ['falha', 'falha']);
  });

  test('dia fechado segura a venda; "lançar hoje" aplica na data de hoje; decidido não reaplica', async () => {
    const t = await pdv.autenticarTerminal(ctx.db, terminal.id, token);
    await ctx.db.query("INSERT INTO fin_fechamentos (empresa_id, loja_id, data, totais, responsavel) VALUES ($1, NULL, '2026-10-21', '{}', 'gerente')", [A]);
    const v = venda({ ocorreu_em: '2026-10-21T15:00:00-04:00', itens: [{ produto_id: cerveja.id, quantidade: 1, valor_unitario: 10 }], pagamentos: [{ tipo: 'dinheiro', valor: 10 }] });
    const ev = evento(v);
    const r = await pdv.sincronizar(ctx.db, t, { lote_cliente_id: randomUUID(), eventos: [ev] }, { agora });
    assert.equal(r.eventos[0].status, 'conflito');
    assert.equal(r.eventos[0].resultado.aplicado, false);
    const c = (await pdv.listarConflitos(ctx.db, A)).find((x) => x.tipo_conflito === 'dia_fechado');
    assert.equal(c.dados_servidor.dia_fechado, '2026-10-21');
    const res = await pdv.resolverConflito(ctx.db, A, c.id, 'aceito_cliente', { agora });
    const comanda = (await ctx.db.query('SELECT fechada_em FROM bar_comandas WHERE id = $1', [res.comandaId])).rows[0];
    assert.equal(new Date(comanda.fechada_em).toISOString(), agora.toISOString());
    // reenvio do mesmo evento não reaplica
    const r2 = await pdv.sincronizar(ctx.db, t, { lote_cliente_id: randomUUID(), eventos: [ev] }, { agora });
    assert.equal(r2.eventos[0].repetido, true);
    // pagamento antigo com data de dia fechado entra no razão no dia de hoje
    await ctx.db.query("UPDATE bar_comanda_pagamentos SET criado_em = '2026-10-21T15:00:00-04:00' WHERE comanda_id = $1", [res.comandaId]);
    await fontes.sincronizarBar(ctx.db, A);
    const l = (await ctx.db.query("SELECT data_competencia::text AS d FROM fin_lancamentos WHERE origem_id = $1", [res.comandaId])).rows[0];
    assert.notEqual(l.d, '2026-10-21');
  });

  test('descartar resolve todos os bloqueios do evento; aceitar depois de descartado é recusado', async () => {
    const t = await pdv.autenticarTerminal(ctx.db, terminal.id, token);
    const v = venda({ itens: [{ produto_id: randomUUID(), quantidade: 1, valor_unitario: 5 }, { produto_id: randomUUID(), quantidade: 1, valor_unitario: 5 }], pagamentos: [{ tipo: 'dinheiro', valor: 10 }] });
    const r = await pdv.sincronizar(ctx.db, t, { lote_cliente_id: randomUUID(), eventos: [evento(v)] }, { agora });
    assert.equal(r.eventos[0].status, 'conflito');
    const [c1, c2] = (await pdv.listarConflitos(ctx.db, A)).filter((x) => x.tipo_conflito === 'produto_inexistente');
    await pdv.resolverConflito(ctx.db, A, c1.id, 'descartado');
    assert.equal((await pdv.listarConflitos(ctx.db, A)).filter((x) => x.tipo_conflito === 'produto_inexistente').length, 0);
    assert.equal((await pdv.resolverConflito(ctx.db, A, c2.id, 'aceito_cliente')).status, 'resolvido'); // já resolvido junto: devolve o estado
  });

  test('terminal desativado não sincroniza; dispositivos por unidade', async () => {
    await pdv.criarDispositivo(ctx.db, A, { loja_id: loja, terminal_id: terminal.id, tipo: 'impressora_termica', nome: 'Térmica balcão', configuracoes: { modo: 'rede', host: '192.168.0.50', porta: 9100 } });
    assert.equal((await pdv.listarDispositivos(ctx.db, A, { lojaId: loja }))[0].configuracoes.porta, 9100);
    // unidade inativa: o terminal não autentica
    await ctx.db.query('UPDATE lojas SET ativa = false WHERE id = $1', [loja]);
    await assert.rejects(() => pdv.autenticarTerminal(ctx.db, terminal.id, token), (e) => e.status === 401);
    await ctx.db.query('UPDATE lojas SET ativa = true WHERE id = $1', [loja]);
    await pdv.atualizarTerminal(ctx.db, A, terminal.id, { ativo: false });
    await assert.rejects(() => pdv.autenticarTerminal(ctx.db, terminal.id, token), (e) => e.status === 401);
  });
});
