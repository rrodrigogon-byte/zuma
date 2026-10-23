import { describe, it as test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pgDeTeste, criarBancoTeste, criarCliente } from './fixtures/clube-pg.js';
import * as razao from '../modules/razao/servico.js';
import * as fontes from '../modules/razao/fontes.js';
import * as bar from '../modules/bar/servico.js';
import * as a2 from '../modules/a2/servico.js';

const sql = (arquivo) => readFileSync(new URL(`../migrations/${arquivo}`, import.meta.url), 'utf8');
// Réplicas mínimas das tabelas de produção que o razão lê (só as colunas usadas).
const STUBS = `
CREATE TABLE empresas (id UUID PRIMARY KEY);
CREATE TABLE lojas (id UUID PRIMARY KEY, empresa_id UUID NOT NULL);
CREATE TABLE clube_pagamentos_recebidos (empresa_id UUID NOT NULL, pagamento_id VARCHAR(120) NOT NULL, customer_id UUID NOT NULL, valor NUMERIC(10,2), nova_data DATE, resultado JSONB, criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (empresa_id, pagamento_id));
CREATE TABLE clube_cobrancas (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id UUID NOT NULL, customer_id UUID, valor NUMERIC(10,2) NOT NULL DEFAULT 199.9, descricao VARCHAR(120) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'pendente', enviar_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, cancelado_em TIMESTAMPTZ);
CREATE TABLE commerce_orders (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id UUID NOT NULL, loja_id UUID, customer_id UUID, public_code VARCHAR(40) NOT NULL, UNIQUE (empresa_id, id));
CREATE TABLE commerce_payments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id UUID NOT NULL, order_id UUID NOT NULL, method VARCHAR(30) NOT NULL, status VARCHAR(30) NOT NULL, amount NUMERIC(14,2) NOT NULL, captured_at TIMESTAMPTZ, refunded_at TIMESTAMPTZ, criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);`;

describe('Razão financeiro único (PostgreSQL)', { skip: pgDeTeste }, () => {
  let ctx;
  const A = randomUUID();
  const B = randomUUID();
  const lojaA = randomUUID();
  const agora = new Date('2026-10-22T15:00:00-04:00');
  before(async () => {
    ctx = await criarBancoTeste();
    await ctx.db.query(STUBS);
    await ctx.db.query(sql('081_bar_pdv_multiempresa.sql'));
    await ctx.db.query(sql('082_financeiro_cadastros_multiempresa.sql'));
    await ctx.db.query(sql('090_financeiro_razao.sql'));
    await ctx.db.query(sql('098_financeiro_ajustes_auditoria.sql'));
    await ctx.db.query('INSERT INTO empresas (id) VALUES ($1), ($2)', [A, B]);
    await ctx.db.query('INSERT INTO lojas (id, empresa_id) VALUES ($1, $2)', [lojaA, A]);
  });
  after(async () => { await ctx?.fechar(); });

  test('lançamento manual com recorrência e isolamento entre empresas', async () => {
    const criados = await razao.criarManual(ctx.db, A, { tipo: 'despesa', categoria: 'Aluguel', descricao: 'Aluguel do salão', valor: '3500,00', vencimento: '2026-01-31', meses: 3, lojaId: lojaA }, { usuario: 'gestor', agora });
    assert.equal(criados.length, 3);
    assert.deepEqual(criados.map((c) => c.vencimento), ['2026-01-31', '2026-02-28', '2026-03-31']);
    assert.deepEqual(criados.map((c) => c.descricao), ['Aluguel do salão (1/3)', 'Aluguel do salão (2/3)', 'Aluguel do salão (3/3)']);
    assert.ok(criados.every((c) => c.natureza === 'pagar' && c.status === 'pendente' && c.valor === 3500 && c.serieId === criados[0].serieId));
    assert.equal((await razao.listar(ctx.db, B)).length, 0);
    await assert.rejects(() => razao.obter(ctx.db, B, criados[0].id), (e) => e.code === 'NOT_FOUND');
    await assert.rejects(() => razao.baixar(ctx.db, B, criados[0].id), (e) => e.code === 'NOT_FOUND');
  });

  test('baixa, cancelamento de série e regras do lançamento manual', async () => {
    const [primeira] = (await razao.listar(ctx.db, A, { categoria: 'Aluguel' })).sort((x, y) => x.vencimento.localeCompare(y.vencimento));
    const paga = await razao.baixar(ctx.db, A, primeira.id, { meioPagamento: 'transferencia', pagoEm: '2026-01-30T10:00:00-04:00' });
    assert.equal(paga.status, 'pago');
    assert.equal(paga.meioPagamento, 'transferencia');
    const r = await razao.cancelarSerie(ctx.db, A, primeira.serieId, { usuario: 'gestor' });
    assert.equal(r.cancelados, 2);
    const lista = await razao.listar(ctx.db, A, { categoria: 'Aluguel' });
    assert.deepEqual(lista.map((l) => l.status).sort(), ['cancelado', 'cancelado', 'pago']);
    await assert.rejects(() => razao.criarManual(ctx.db, A, { tipo: 'despesa', descricao: 'Zero', valor: 0 }), (e) => e.code === 'VALIDATION_ERROR');
    await assert.rejects(() => razao.criarManual(ctx.db, A, { tipo: 'outro', descricao: 'Tipo', valor: 1 }), (e) => e.code === 'VALIDATION_ERROR');
  });

  test('automático é idempotente, não muda de valor e se corrige por estorno', async () => {
    const dados = { tipo: 'receita', categoria: 'Serviços', descricao: 'Atendimento 123', valor: 80, status: 'pago', meioPagamento: 'pix' };
    const a = await razao.registrarAutomatico(ctx.db, A, dados, { chave: 'teste:atendimento:123', origem: 'barbearia_atendimento', agora });
    const b = await razao.registrarAutomatico(ctx.db, A, { ...dados, valor: 999 }, { chave: 'teste:atendimento:123', origem: 'barbearia_atendimento', agora });
    assert.equal(a.criado, true);
    assert.equal(b.criado, false);
    assert.equal(b.lancamento.valor, 80);
    await assert.rejects(() => razao.atualizar(ctx.db, A, a.lancamento.id, { valor: 50 }), (e) => e.code === 'AUTOMATIC_ENTRY');
    await assert.rejects(() => razao.cancelar(ctx.db, A, a.lancamento.id, {}), (e) => e.code === 'AUTOMATIC_ENTRY');
    const ok = await razao.atualizar(ctx.db, A, a.lancamento.id, { valor: 80, lojaId: lojaA, observacao: 'conferido' });
    assert.equal(ok.lojaId, lojaA);
    const est = await razao.estornar(ctx.db, A, a.lancamento.id, { usuario: 'gestor', motivo: 'cobrado em duplicidade', agora });
    assert.equal(est.tipo, 'despesa');
    assert.equal(est.estornoDe, a.lancamento.id);
    await assert.rejects(() => razao.estornar(ctx.db, A, a.lancamento.id, { motivo: 'de novo' }), (e) => e.code === 'ALREADY_REVERSED');
  });

  test('resumo, fluxo e DRE por competência', async () => {
    await razao.criarManual(ctx.db, A, { tipo: 'receita', categoria: 'Vendas de produtos', descricao: 'Venda balcão', valor: 1000, status: 'pago', vencimento: '2026-10-05', pagoEm: '2026-10-05T12:00:00-04:00', lojaId: lojaA }, { agora });
    await razao.criarManual(ctx.db, A, { tipo: 'despesa', categoria: 'Compras de mercadoria', descricao: 'Reposição', valor: 400, status: 'pago', vencimento: '2026-10-06', pagoEm: '2026-10-06T12:00:00-04:00', lojaId: lojaA }, { agora });
    await razao.criarManual(ctx.db, A, { tipo: 'receita', categoria: 'Contas de clientes', descricao: 'A receber vencido', valor: 150, vencimento: '2026-10-01' }, { agora });
    const r = await razao.resumo(ctx.db, A, { agora });
    // outubro: venda 1000 + atendimento automático 80; despesas: reposição 400 + estorno 80
    assert.equal(r.recMes, 1080);
    assert.equal(r.despMes, 480);
    assert.equal(r.aReceber, 150);
    assert.equal(r.receberVencidos, 1);
    assert.ok(r.semUnidade >= 1);
    const soLoja = await razao.resumo(ctx.db, A, { agora, lojaId: lojaA });
    assert.equal(soLoja.aReceber, 0);
    const f = await razao.fluxo(ctx.db, A, { meses: 12, agora });
    assert.equal(f.length, 12);
    assert.equal(f.at(-1).mes, '2026-10');
    assert.equal(f.at(-1).receitas, 1080);
    const d = await razao.dre(ctx.db, A, { de: '2026-10-01', ate: '2026-10-31' });
    // receita bruta = serviços 80 + vendas 1000 + contas de clientes 150; dedução = estorno 80
    assert.equal(d.receitaBruta, 1230);
    assert.equal(d.grupos.find((g) => g.grupo === 'deducao').total, -80);
    assert.equal(d.grupos.find((g) => g.grupo === 'cmv').total, -400);
    assert.equal(d.lucroBruto, 750);
    const janeiro = await razao.dre(ctx.db, A, { de: '2026-01-01', ate: '2026-01-31' });
    assert.equal(janeiro.grupos.find((g) => g.grupo === 'operacional').total, -3500, 'aluguel de janeiro (os cancelados de fev/mar não entram)');
  });

  test('bar: pagamento vira receita; venda em conta vira conta a receber; sem duplicar', async () => {
    const cliente = await criarCliente(ctx.db, A, 'Cliente Fiado');
    const produto = await bar.salvarProduto(ctx.db, A, { nome: 'Cerveja', categoria: 'Bebidas', setor: 'bar', preco: 20, estoqueAtual: 10 });
    const c1 = await bar.abrirComanda(ctx.db, A, { nome: 'Mesa 1' });
    await bar.adicionarItens(ctx.db, A, c1.id, [{ produtoId: produto.id, qtd: 2 }]);
    await bar.pagarComanda(ctx.db, A, c1.id, { servico: false, meios: [{ meio: 'pix', valor: 15 }, { meio: 'dinheiro', valor: 25 }] });
    const c2 = await bar.abrirComanda(ctx.db, A, { nome: 'Mesa 2' });
    await bar.adicionarItens(ctx.db, A, c2.id, [{ produtoId: produto.id, qtd: 1 }]);
    await bar.pagarComanda(ctx.db, A, c2.id, { servico: false, meio: 'conta', clienteId: cliente });
    const r1 = await fontes.sincronizarBar(ctx.db, A);
    const r2 = await fontes.sincronizarBar(ctx.db, A);
    assert.equal(r1.inseridos, 3);
    assert.equal(r2.inseridos, 0);
    const doBar = await razao.listar(ctx.db, A, { origem: 'bar_comanda' });
    assert.equal(doBar.filter((l) => l.status === 'pago').reduce((s, l) => s + l.valor, 0), 40);
    const fiado = doBar.find((l) => l.status === 'pendente');
    assert.equal(fiado.natureza, 'receber');
    assert.equal(fiado.contraparteNome, 'Cliente Fiado');
    assert.equal(fiado.valor, 20);
    assert.equal((await fontes.sincronizarBar(ctx.db, B)).inseridos, 0);
  });

  test('auditoria: empresa de uma unidade só leva a receita do bar para ela; com várias, vale a unidade padrão', async () => {
    const doBar = await razao.listar(ctx.db, A, { origem: 'bar_comanda' });
    assert.ok(doBar.length && doBar.every((l) => l.lojaId === lojaA), 'A tem uma unidade só: a receita do bar é dela');
    // empresa com duas unidades: sem padrão fica sem unidade; ao escolher, o que já entrou passa para ela
    const C = randomUUID(); const c1 = randomUUID(); const c2 = randomUUID();
    await ctx.db.query('INSERT INTO empresas (id) VALUES ($1)', [C]);
    await ctx.db.query('INSERT INTO lojas (id, empresa_id) VALUES ($1, $3), ($2, $3)', [c1, c2, C]);
    const produto = await bar.salvarProduto(ctx.db, C, { nome: 'Água', categoria: 'Bebidas', setor: 'bar', preco: 5, estoqueAtual: 10 });
    const cm = await bar.abrirComanda(ctx.db, C, { nome: 'Balcão' });
    await bar.adicionarItens(ctx.db, C, cm.id, [{ produtoId: produto.id, qtd: 1 }]);
    await bar.pagarComanda(ctx.db, C, cm.id, { servico: false, meio: 'dinheiro' });
    await fontes.sincronizarBar(ctx.db, C);
    assert.equal((await razao.listar(ctx.db, C, { origem: 'bar_comanda' }))[0].lojaId, null);
    const r = await razao.salvarLojaPadrao(ctx.db, C, c2);
    assert.equal(r.atribuidos, 1);
    assert.equal((await razao.listar(ctx.db, C, { origem: 'bar_comanda' }))[0].lojaId, c2);
    assert.equal((await razao.totaisDoDia(ctx.db, C, { data: (await razao.listar(ctx.db, C, { origem: 'bar_comanda' }))[0].competencia, lojaId: c2 })).recebido, 5, 'o fechamento da unidade enxerga o bar');
    await assert.rejects(() => razao.salvarLojaPadrao(ctx.db, C, lojaA), (e) => e.status === 404);
  });

  test('auditoria: parcelar um total em centavos e ratear entre centros de custo no DRE', async () => {
    const D = randomUUID();
    await ctx.db.query('INSERT INTO empresas (id) VALUES ($1)', [D]);
    const parcelas = await razao.criarManual(ctx.db, D, { tipo: 'despesa', categoria: 'Manutenção', descricao: 'Reforma', valor: 1000, vencimento: '2026-11-10', meses: 3, parcelarTotal: true }, { agora });
    assert.deepEqual(parcelas.map((p) => p.valor), [333.33, 333.33, 333.34]);
    assert.deepEqual(razao.dividirEmParcelas(10, 3), [3.33, 3.33, 3.34]);
    const bar = await razao.salvarCentro(ctx.db, D, { codigo: 'BAR', nome: 'Bar' });
    const quadra = await razao.salvarCentro(ctx.db, D, { codigo: 'QDR', nome: 'Quadras' });
    await assert.rejects(() => razao.criarManual(ctx.db, D, { tipo: 'despesa', categoria: 'Energia, água e internet', descricao: 'Luz', valor: 300, vencimento: '2026-12-05', rateio: [{ centroCustoId: bar.id, percentual: 60 }, { centroCustoId: quadra.id, percentual: 30 }] }, { agora }), (e) => e.code === 'VALIDATION_ERROR');
    const [luz] = await razao.criarManual(ctx.db, D, { tipo: 'despesa', categoria: 'Energia, água e internet', descricao: 'Luz', valor: 300, vencimento: '2026-12-05', rateio: [{ centroCustoId: bar.id, percentual: 60 }, { centroCustoId: quadra.id, percentual: 40 }] }, { agora });
    assert.equal(luz.rateio.length, 2);
    const dreBar = await razao.dre(ctx.db, D, { de: '2026-12-01', ate: '2026-12-31', centroCustoId: bar.id });
    const dreQuadra = await razao.dre(ctx.db, D, { de: '2026-12-01', ate: '2026-12-31', centroCustoId: quadra.id });
    assert.equal(dreBar.grupos.find((g) => g.grupo === 'operacional').total, -180);
    assert.equal(dreQuadra.grupos.find((g) => g.grupo === 'operacional').total, -120);
    assert.equal((await razao.dre(ctx.db, D, { de: '2026-12-01', ate: '2026-12-31' })).grupos.find((g) => g.grupo === 'operacional').total, -633.33, 'sem centro: tudo (luz inteira + parcela da reforma)');
    const [listado] = await razao.listar(ctx.db, D, { q: 'Luz' });
    assert.equal(listado.rateio.length, 2);
    // tirar o rateio volta a um centro só
    await razao.atualizar(ctx.db, D, luz.id, { rateio: [], centroCustoId: bar.id });
    assert.equal((await razao.dre(ctx.db, D, { de: '2026-12-01', ate: '2026-12-31', centroCustoId: bar.id })).grupos.find((g) => g.grupo === 'operacional').total, -300);
  });

  test('auditoria: rotina periódica lê as fontes com o razão ligado e uma vez por vez', async () => {
    const { executarRotina } = await import('../modules/razao/rotina.js');
    const desligado = await executarRotina(ctx.db, { razaoAtivo: () => false });
    assert.equal(desligado.pulou, false);
    const ligado = await executarRotina(ctx.db, { razaoAtivo: () => true });
    assert.ok(ligado.empresas >= 2);
    assert.deepEqual(ligado.erros.filter((e) => e.fonte !== 'estoque'), []);
    await ctx.db.query("UPDATE sys_rotinas SET travada_ate = CURRENT_TIMESTAMP + interval '5 minutes' WHERE nome = 'backoffice'");
    assert.equal((await executarRotina(ctx.db, { razaoAtivo: () => true })).pulou, true, 'outra instância com a vez: pula');
    await ctx.db.query("UPDATE sys_rotinas SET travada_ate = '-infinity'");
  });

  test('A2: conta a receber nasce pendente e a baixa na fonte chega ao razão', async () => {
    const cli = await a2.salvarCliente(ctx.db, A, { nome: 'Cliente A2', email: 'a2@teste.local' });
    const conta = await a2.criarConta(ctx.db, A, { clienteId: cli.id, descricao: 'Mensalidade bar', valor: 90, dataVencimento: '2026-11-10' });
    await fontes.sincronizarContasReceber(ctx.db, A);
    let l = (await razao.listar(ctx.db, A, { origem: 'a2_conta' }))[0];
    assert.equal(l.status, 'pendente');
    assert.equal(l.vencimento, '2026-11-10');
    await a2.baixarConta(ctx.db, A, conta.id, new Date());
    const r = await fontes.sincronizarContasReceber(ctx.db, A);
    assert.equal(r.atualizados, 1);
    l = (await razao.listar(ctx.db, A, { origem: 'a2_conta' }))[0];
    assert.equal(l.status, 'pago');
  });

  test('clube e loja online entram uma vez; devolução vira estorno', async () => {
    const aluno = await criarCliente(ctx.db, A, 'Aluno Pix');
    const cb = (await ctx.db.query("INSERT INTO clube_cobrancas (empresa_id, customer_id, descricao) VALUES ($1, $2, 'Mensalidade outubro') RETURNING id", [A, aluno])).rows[0].id;
    await ctx.db.query('INSERT INTO clube_pagamentos_recebidos (empresa_id, pagamento_id, customer_id, valor) VALUES ($1, $2, $3, 199.9), ($1, $4, $3, NULL)', [A, `clube-cobranca:${cb}`, aluno, 'sem-valor']);
    assert.equal((await fontes.sincronizarClube(ctx.db, A)).inseridos, 1);
    assert.equal((await fontes.sincronizarClube(ctx.db, A)).inseridos, 0);
    const mens = (await razao.listar(ctx.db, A, { origem: 'clube_pagamento' }))[0];
    assert.equal(mens.descricao, 'Mensalidade outubro · Aluno Pix');
    assert.equal(mens.meioPagamento, 'pix');
    assert.equal(mens.status, 'pago');

    // cobrança em aberto já é conta a receber; paga, a mesma conta recebe a baixa; cancelada, sai
    const nov = (await ctx.db.query("INSERT INTO clube_cobrancas (empresa_id, customer_id, valor, descricao) VALUES ($1, $2, 150, 'Mensalidade novembro') RETURNING id", [A, aluno])).rows[0].id;
    const dez = (await ctx.db.query("INSERT INTO clube_cobrancas (empresa_id, customer_id, valor, descricao) VALUES ($1, $2, 150, 'Mensalidade dezembro') RETURNING id", [A, aluno])).rows[0].id;
    await fontes.sincronizarClube(ctx.db, A);
    const pendentes = await razao.listar(ctx.db, A, { origem: 'clube_pagamento', status: 'pendente' });
    assert.deepEqual(pendentes.map((l) => l.natureza), ['receber', 'receber']);
    await ctx.db.query('INSERT INTO clube_pagamentos_recebidos (empresa_id, pagamento_id, customer_id, valor) VALUES ($1, $2, $3, 150)', [A, `clube-cobranca:${nov}`, aluno]);
    await ctx.db.query("UPDATE clube_cobrancas SET status = 'cancelada', cancelado_em = CURRENT_TIMESTAMP WHERE id = $1", [dez]);
    const r3 = await fontes.sincronizarClube(ctx.db, A);
    assert.equal(r3.inseridos, 0, 'o pagamento não vira outro lançamento');
    assert.equal(r3.atualizados, 2);
    const todos = await razao.listar(ctx.db, A, { origem: 'clube_pagamento' });
    assert.equal(todos.find((l) => l.descricao.startsWith('Mensalidade novembro')).status, 'pago');
    assert.equal(todos.find((l) => l.descricao.startsWith('Mensalidade dezembro')).status, 'cancelado');

    const pedido = (await ctx.db.query("INSERT INTO commerce_orders (empresa_id, loja_id, public_code) VALUES ($1, $2, 'PED-1') RETURNING id", [A, lojaA])).rows[0].id;
    const pag = (await ctx.db.query("INSERT INTO commerce_payments (empresa_id, order_id, method, status, amount, captured_at) VALUES ($1, $2, 'credit_card', 'captured', 250, CURRENT_TIMESTAMP) RETURNING id", [A, pedido])).rows[0].id;
    await ctx.db.query("INSERT INTO commerce_payments (empresa_id, order_id, method, status, amount) VALUES ($1, $2, 'pix', 'pending', 250)", [A, pedido]);
    assert.equal((await fontes.sincronizarLojaOnline(ctx.db, A)).inseridos, 1);
    await ctx.db.query("UPDATE commerce_payments SET status = 'refunded', refunded_at = CURRENT_TIMESTAMP WHERE id = $1", [pag]);
    assert.equal((await fontes.sincronizarLojaOnline(ctx.db, A)).inseridos, 1);
    assert.equal((await fontes.sincronizarLojaOnline(ctx.db, A)).inseridos, 0);
    const online = await razao.listar(ctx.db, A, { lojaId: lojaA, q: 'PED-1' });
    assert.deepEqual(online.map((l) => l.tipo).sort(), ['despesa', 'receita']);
    assert.equal((await razao.listar(ctx.db, B)).length, 0);
  });

  test('importação do JSON antigo: simula, aplica uma vez e só avança a situação', async () => {
    const lancamentos = [
      { id: 'j1', tipo: 'receita', categoria: 'Serviços', descricao: 'Atendimento antigo', valor: 70, status: 'pago', vencimento: '2026-09-10', pagoEm: '2026-09-10T15:00:00Z', lojaId: 'dino-web-estoque', origem: 'barbearia_atendimento', automatico: true },
      { id: 'j2', tipo: 'despesa', categoria: 'Insumos', descricao: 'Lâminas', valor: 45.5, status: 'pendente', vencimento: '2026-10-30', lojaId: 'unidade-sem-mapa' },
      { id: '', tipo: 'receita', valor: 10, status: 'pago', vencimento: '2026-09-01', lojaId: 'dino-web-estoque' },
      { id: 'q1', tipo: 'receita', categoria: 'Serviços', descricao: 'Em quarentena', valor: 99, status: 'pago', vencimento: '2026-09-02' },
    ];
    const opcoes = { chaveLegada: 'emp-kytto-001', lancamentos, mapaUnidades: { 'dino-web-estoque': lojaA } };
    const sim = await fontes.importarJsonLegado(ctx.db, B, opcoes);
    assert.equal(sim.validos, 2);
    assert.equal(sim.ignorados.length, 1);
    assert.equal(sim.quarentena, 1, 'sem unidade no antigo = quarentena, fora da importação');
    assert.equal(sim.totais.receitaPaga, 70);
    assert.equal(sim.totais.aPagar, 45.5);
    assert.equal((await razao.listar(ctx.db, B)).length, 0, 'simulação não grava');
    const ap = await fontes.importarJsonLegado(ctx.db, B, { ...opcoes, aplicar: true });
    assert.equal(ap.inseridos, 2);
    assert.equal((await fontes.importarJsonLegado(ctx.db, B, { ...opcoes, aplicar: true })).jaExistiam, 2);
    const j1 = (await razao.listar(ctx.db, B, { q: 'Atendimento antigo' }))[0];
    assert.equal(j1.lojaId, lojaA);
    assert.equal(j1.automatico, true);
    // a fonte paga a despesa: o razão acompanha; depois o JSON não "despaga"
    lancamentos[1].status = 'pago';
    lancamentos[1].pagoEm = '2026-10-21T12:00:00Z';
    // a leitura contínua só roda depois da liberação conferida
    assert.equal((await fontes.sincronizarJson(ctx.db, B, opcoes)).aguardandoLiberacao, true);
    const conf = await fontes.conferirJsonLegado(ctx.db, B, opcoes);
    assert.equal(conf.quarentena.quantidade, 1);
    assert.equal(conf.totalFaltando, 0);
    assert.equal(conf.fecha, false, 'o antigo já pagou a despesa e o razão ainda não');
    await fontes.liberarJsonLegado(ctx.db, B, { ...opcoes, usuario: 'plataforma' });
    assert.equal((await fontes.sincronizarJson(ctx.db, B, opcoes)).atualizados, 1);
    assert.equal((await fontes.conferirJsonLegado(ctx.db, B, opcoes)).fecha, true, 'fecha centavo a centavo');
    lancamentos[1].status = 'pendente';
    await fontes.sincronizarJson(ctx.db, B, opcoes);
    assert.equal((await razao.listar(ctx.db, B, { q: 'Lâminas' }))[0].status, 'pago');
  });

  test('prontidão: JSON sem mudança não relê; apagado no antigo sai do razão se ainda em aberto', async () => {
    const E = randomUUID();
    await ctx.db.query('INSERT INTO empresas (id) VALUES ($1)', [E]);
    const lojaE = randomUUID();
    await ctx.db.query('INSERT INTO lojas (id, empresa_id) VALUES ($1, $2)', [lojaE, E]);
    const lancamentos = Array.from({ length: 2500 }, (_, i) => ({ id: `m${i}`, tipo: i % 2 ? 'despesa' : 'receita', categoria: 'Outros', descricao: `Item ${i}`, valor: 10 + i, status: i % 3 ? 'pago' : 'pendente', vencimento: '2026-09-15', lojaId: 'u1' }));
    lancamentos.push({ id: 'rev1', tipo: 'despesa', valor: 10, status: 'pago', vencimento: '2026-09-16', lojaId: 'u1', lancamentoOriginalId: 'm0' });
    const opcoes = { chaveLegada: 'emp-massa', lancamentos, mapaUnidades: { u1: lojaE } };
    const lib = await fontes.liberarJsonLegado(ctx.db, E, { ...opcoes, usuario: 'plataforma' });
    assert.equal(lib.relatorio.inseridos, 2501, 'em lote, com a reversão ligada ao original');
    assert.equal((await fontes.sincronizarJson(ctx.db, E, opcoes)).inseridos, 0);
    const est = (await ctx.db.query("SELECT estorno_de FROM fin_lancamentos WHERE empresa_id = $1 AND origem = 'estorno'", [E])).rows;
    assert.equal(est.length, 1);
    assert.ok(est[0].estorno_de);
    assert.equal((await fontes.sincronizarJson(ctx.db, E, opcoes)).semMudanca, true);
    lancamentos.splice(lancamentos.findIndex((l) => l.id === 'm3'), 1); // pendente apagado no antigo
    lancamentos.splice(lancamentos.findIndex((l) => l.id === 'm1'), 1); // pago apagado: fica (já entrou no caixa)
    const r3 = await fontes.sincronizarJson(ctx.db, E, opcoes);
    assert.equal(r3.atualizados, 1);
    const st = Object.fromEntries((await ctx.db.query("SELECT chave, status FROM fin_lancamentos WHERE empresa_id = $1 AND chave IN ('json:emp-massa:m3', 'json:emp-massa:m1')", [E])).rows.map((r) => [r.chave, r.status]));
    assert.deepEqual(st, { 'json:emp-massa:m3': 'cancelado', 'json:emp-massa:m1': 'pago' });
    // JSON vazio ou encolhido de repente (restauração, arquivo corrompido) não cancela nada
    const r4 = await fontes.sincronizarJson(ctx.db, E, { ...opcoes, lancamentos: [] });
    assert.equal(r4.atualizados, 0);
    const pendentes = (await ctx.db.query("SELECT count(*)::int AS n FROM fin_lancamentos WHERE empresa_id = $1 AND chave LIKE 'json:emp-massa:%' AND status = 'pendente'", [E])).rows[0].n;
    assert.ok(pendentes > 0, 'pendentes continuam em aberto');
  });

  test('prontidão: fiado do bar de antes do Financeiro novo entra como recebido', async () => {
    const F = randomUUID();
    await ctx.db.query('INSERT INTO empresas (id) VALUES ($1)', [F]);
    const cliente = await criarCliente(ctx.db, F, 'Fiado Antigo');
    const produto = await bar.salvarProduto(ctx.db, F, { nome: 'Água', categoria: 'Bebidas', setor: 'bar', preco: 5, estoqueAtual: 10 });
    const antiga = await bar.abrirComanda(ctx.db, F, { nome: 'Mesa antiga' });
    await bar.adicionarItens(ctx.db, F, antiga.id, [{ produtoId: produto.id, qtd: 1 }]);
    await bar.pagarComanda(ctx.db, F, antiga.id, { servico: false, meio: 'conta', clienteId: cliente });
    await ctx.db.query("UPDATE bar_comanda_pagamentos SET criado_em = CURRENT_TIMESTAMP - interval '40 days' WHERE empresa_id = $1", [F]);
    const nova = await bar.abrirComanda(ctx.db, F, { nome: 'Mesa nova' });
    await bar.adicionarItens(ctx.db, F, nova.id, [{ produtoId: produto.id, qtd: 2 }]);
    await bar.pagarComanda(ctx.db, F, nova.id, { servico: false, meio: 'conta', clienteId: cliente });
    await fontes.sincronizarEmpresa(ctx.db, F);
    const doBar = await razao.listar(ctx.db, F, { origem: 'bar_comanda' });
    assert.equal(doBar.length, 2);
    assert.deepEqual(doBar.map((l) => `${l.valor}:${l.status}`).sort(), ['10:pendente', '5:pago']);
    assert.ok((await razao.obterConfig(ctx.db, F)).razaoDesde);
  });

  test('fechamento do dia: totais por meio e um fechamento por dia e unidade', async () => {
    const dia = '2026-10-22';
    await razao.criarManual(ctx.db, B, { tipo: 'receita', descricao: 'Venda dinheiro', valor: 30, status: 'pago', meioPagamento: 'dinheiro', vencimento: dia, pagoEm: '2026-10-22T10:00:00-04:00' }, { agora });
    await razao.criarManual(ctx.db, B, { tipo: 'receita', descricao: 'Venda pix', valor: 20, status: 'pago', meioPagamento: 'pix', vencimento: dia, pagoEm: '2026-10-22T23:30:00-04:00' }, { agora });
    const t = await razao.totaisDoDia(ctx.db, B, { data: dia });
    assert.equal(t.recebido, 50);
    assert.deepEqual(t.recebidoPorMeio, { dinheiro: 30, pix: 20 });
    const f = await razao.fecharDia(ctx.db, B, { data: dia, responsavel: 'Caixa', agora });
    assert.equal(f.totais.recebido, 50);
    await assert.rejects(() => razao.fecharDia(ctx.db, B, { data: dia, responsavel: 'Caixa', agora }), (e) => e.code === 'ALREADY_CLOSED');
    await assert.rejects(() => razao.fecharDia(ctx.db, B, { data: '2026-10-23', responsavel: 'Caixa', agora }), (e) => e.code === 'VALIDATION_ERROR');
    assert.equal((await razao.listarFechamentos(ctx.db, B)).length, 1);
    assert.equal((await razao.listarFechamentos(ctx.db, A)).length, 0);
  });

  test('revisão: estorno no DRE, travas de pago/estorno, unidade de outra empresa, dia fechado e A2', async () => {
    const C = randomUUID(); const lojaC = randomUUID();
    await ctx.db.query('INSERT INTO empresas (id) VALUES ($1)', [C]);
    await ctx.db.query('INSERT INTO lojas (id, empresa_id) VALUES ($1, $2)', [lojaC, C]);
    // estorno de despesa reduz a própria despesa (CMV), não vira receita
    const [compra] = await razao.criarManual(ctx.db, C, { tipo: 'despesa', categoria: 'Compras de mercadoria', descricao: 'Compra errada', valor: 100, status: 'pago', vencimento: '2026-08-05', competencia: '2026-08-05', pagoEm: '2026-08-05' }, { agora });
    const [venda] = await razao.criarManual(ctx.db, C, { tipo: 'receita', categoria: 'Serviços', descricao: 'Venda', valor: 300, status: 'pago', vencimento: '2026-08-05', pagoEm: '2026-08-05' }, { agora });
    await razao.estornar(ctx.db, C, compra.id, { motivo: 'nota devolvida', agora: new Date('2026-08-10T12:00:00Z') });
    await razao.estornar(ctx.db, C, venda.id, { motivo: 'cliente desistiu', agora: new Date('2026-08-10T12:00:00Z') });
    const d = await razao.dre(ctx.db, C, { de: '2026-08-01', ate: '2026-08-31' });
    assert.equal(d.receitaBruta, 300);
    assert.equal(d.grupos.find((g) => g.grupo === 'cmv').total, 0);
    assert.equal(d.grupos.find((g) => g.grupo === 'deducao').total, -300);
    // pago não se cancela; estorno não se cancela nem se edita; pago não muda valor
    await assert.rejects(() => razao.cancelar(ctx.db, C, venda.id, { motivo: 'x' }), (e) => e.code === 'PAID');
    const est = (await razao.listar(ctx.db, C, { origem: 'estorno' }))[0];
    await assert.rejects(() => razao.cancelar(ctx.db, C, est.id, { motivo: 'x' }), (e) => e.code === 'LOCKED_ENTRY');
    await assert.rejects(() => razao.atualizar(ctx.db, C, est.id, { valor: 1 }), (e) => e.code === 'LOCKED_ENTRY');
    await assert.rejects(() => razao.atualizar(ctx.db, C, venda.id, { valor: 1 }), (e) => e.code === 'LOCKED_ENTRY');
    await assert.rejects(() => razao.atualizar(ctx.db, C, venda.id, { status: 'pendente' }), (e) => e.code === 'ALREADY_REVERSED');
    // data pura de pagamento cai no próprio dia, no fuso da empresa
    assert.equal(razao.hojeNoFuso(new Date(compra.pagoEm)), '2026-08-05');
    // unidade de outra empresa é recusada
    await assert.rejects(() => razao.criarManual(ctx.db, C, { tipo: 'despesa', descricao: 'Luz', valor: 10, lojaId: lojaA }), (e) => e.status === 404);
    // dia fechado não aceita baixa nele
    await razao.fecharDia(ctx.db, C, { data: '2026-08-20', responsavel: 'Caixa', agora });
    const [luz] = await razao.criarManual(ctx.db, C, { tipo: 'despesa', descricao: 'Luz', valor: 10, vencimento: '2026-08-20', lojaId: lojaC }, { agora });
    await assert.rejects(() => razao.baixar(ctx.db, C, luz.id, { pagoEm: '2026-08-20' }), (e) => e.code === 'DAY_CLOSED');
    assert.equal((await razao.baixar(ctx.db, C, luz.id, { pagoEm: '2026-08-21' })).status, 'pago');
    await assert.rejects(() => razao.fecharDia(ctx.db, C, { data: '2026-08-21', lojaId: 'sem', responsavel: 'Caixa', agora }), (e) => e.code === 'VALIDATION_ERROR');
    // pendentes saem do mais antigo para o mais novo
    await razao.criarManual(ctx.db, C, { tipo: 'despesa', descricao: 'Antiga', valor: 5, vencimento: '2025-01-10' }, { agora });
    assert.equal((await razao.listar(ctx.db, C, { status: 'pendente', tipo: 'despesa', limite: 1 }))[0].descricao, 'Antiga');
    assert.equal((await razao.listarFechamentos(ctx.db, C, { limite: -5 })).length, 1);
  });

  test('revisão: baixa no razão de conta do A2 baixa no A2; competência do A2 no fuso', async () => {
    const D = randomUUID();
    await ctx.db.query('INSERT INTO empresas (id) VALUES ($1)', [D]);
    const cli = await criarCliente(ctx.db, D, 'Cliente A2');
    const conta = await a2.criarConta(ctx.db, D, { clienteId: cli, descricao: 'Mensalidade outubro', valor: 120, dataVencimento: '2026-10-30' });
    // criada às 22h de Cuiabá (02h UTC do dia seguinte): competência no dia de Cuiabá
    await ctx.db.query("UPDATE a2_contas_receber SET criado_em = '2026-10-21T22:00:00-04:00' WHERE id = $1", [conta.id]);
    await fontes.sincronizarContasReceber(ctx.db, D);
    const l = (await razao.listar(ctx.db, D, { origem: 'a2_conta' }))[0];
    assert.equal(l.competencia, '2026-10-21');
    await razao.baixar(ctx.db, D, l.id, { pagoEm: '2026-10-22', meioPagamento: 'pix' });
    const a2row = (await ctx.db.query('SELECT data_pagamento FROM a2_contas_receber WHERE id = $1', [conta.id])).rows[0];
    assert.ok(a2row.data_pagamento, 'A2 também ficou paga');
  });

  test('revisão: reversão do JSON antigo vira estorno do original e categorias legadas são mapeadas', async () => {
    const E = randomUUID(); const lojaE = randomUUID();
    await ctx.db.query('INSERT INTO empresas (id) VALUES ($1)', [E]);
    const lancamentos = [
      { id: 'o1', tipo: 'despesa', categoria: 'Comissões - vale', descricao: 'Vale', valor: 50, status: 'pago', vencimento: '2026-10-31', dataOperacao: '2026-11-01T01:30:00Z', pagoEm: '2026-11-01T01:30:00Z', lojaId: 'u1' },
      { id: 'r1', tipo: 'receita', categoria: 'Comissões - vale', descricao: 'Reversão de Vale', valor: 50, status: 'pago', vencimento: '2026-11-02', dataOperacao: '2026-11-02T12:00:00Z', pagoEm: '2026-11-02T12:00:00Z', lojaId: 'u1', origem: 'reversao', lancamentoOriginalId: 'o1' },
    ];
    const rel = await fontes.importarJsonLegado(ctx.db, E, { chaveLegada: 'emp-x', lancamentos, mapaUnidades: { u1: lojaE }, aplicar: true });
    assert.equal(rel.inseridos, 2);
    assert.equal(rel.reversoes, 1);
    const orig = (await razao.listar(ctx.db, E, { tipo: 'despesa' }))[0];
    assert.equal(orig.categoria, 'Comissões');
    assert.equal(orig.competencia, '2026-10-31', '21h30 de Cuiabá ainda é outubro');
    await assert.rejects(() => razao.estornar(ctx.db, E, orig.id, { motivo: 'de novo' }), (e) => e.code === 'ALREADY_REVERSED');
    const d = await razao.dre(ctx.db, E, { de: '2026-10-01', ate: '2026-11-30' });
    assert.equal(d.grupos.find((g) => g.grupo === 'pessoal').total, 0);
    assert.equal(d.receitaBruta, 0);
  });
});
