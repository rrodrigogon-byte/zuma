import { describe, it as test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { pgDeTeste, criarBancoTeste, criarCliente } from './fixtures/clube-pg.js';
import { montarClube, registrarPagamentoClube, executarRotinasClube } from '../modules/clube/index.js';
import * as retencao from '../modules/retencao/servico.js';
import * as cob from '../modules/cobrancas/servico.js';
import * as acesso from '../modules/acesso/repositorio.js';
import * as ret from '../modules/retencao/servico.js';

describe('clube-cobrancas (PostgreSQL)', { skip: pgDeTeste }, () => {

let ctx; let server; let base; let integ; let empresaAtual;
const whats = [];

before(async () => {
  ctx = await criarBancoTeste(['073_clube_acesso_controle.sql', '076_clube_retencao.sql', '077_clube_parceiros.sql', '074_clube_contratos_digitais.sql', '075_clube_aulas_agenda.sql', '078_clube_cobrancas.sql']);
  const app = express();
  // sem gerarLinkPagamento: usa o Pix da própria academia (padrão do montarClube)
  integ = montarClube(app, {
    db: ctx.db,
    empresaDaRequisicao: async () => empresaAtual,
    operadorDaRequisicao: () => 'recepcao-1',
    enviarWhatsapp: async (m) => { whats.push(m); },
    urlPublica: 'https://academia.kytto.com.br',
  });
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server.close(); await ctx.fechar(); });

const json = (url, method = 'GET', body) => fetch(`${base}${url}`, {
  method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
}).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null), headers: r.headers }));

async function academia() {
  const emp = randomUUID();
  const plano = await acesso.salvarPlano(ctx.db, emp, { nome: 'Mensal', valorMensal: 120 });
  return { emp, plano };
}

test('config por empresa: valida chave Pix, exige dados para ligar e normaliza nome/cidade do BR Code', async () => {
  const a = await academia();
  assert.equal((await cob.obterConfig(ctx.db, a.emp)).ativo, false, 'nasce desligada');
  await assert.rejects(cob.salvarConfig(ctx.db, a.emp, { ativo: true }), { code: 'VALIDATION_ERROR' });
  await assert.rejects(cob.salvarConfig(ctx.db, a.emp, { pixChave: 'qualquer coisa' }), { code: 'VALIDATION_ERROR' });
  const c = await cob.salvarConfig(ctx.db, a.emp, { ativo: true, pixChave: '12.345.678/0001-95', pixNome: 'Academia Força & Saúde Ltda', pixCidade: 'Tangará da Serra' });
  assert.deepEqual([c.pixChave, c.pixNome, c.pixCidade], ['12345678000195', 'ACADEMIA FORCA SAUDE LTDA', 'TANGARA DA SERR']);
  assert.equal(cob.normalizarChavePix('+55 (65) 99999-0000'), '+5565999990000');
  assert.equal(cob.normalizarChavePix('Pix@Academia.com.br'), 'pix@academia.com.br');
  // outra empresa continua desligada
  assert.equal((await cob.obterConfig(ctx.db, randomUUID())).ativo, false);
});

test('link da régua/IA: Pix da academia com valor; página pública; baixa da recepção libera e não duplica', async () => {
  const a = await academia();
  empresaAtual = a.emp;
  const gerar = integ.gerarLinkPagamento;
  const c = await criarCliente(ctx.db, a.emp, 'Paulo Pix');
  await acesso.criarMatricula(ctx.db, a.emp, { customerId: c, planoId: a.plano.id, pagoAte: '2026-01-31' });
  assert.equal(await gerar({ empresaId: a.emp, customerId: c, valor: 120 }), null, 'sem cobrança ligada: régua manda sem link');

  await cob.salvarConfig(ctx.db, a.emp, { ativo: true, pixChave: 'pix@academia.com.br', pixNome: 'Academia Teste', pixCidade: 'Cuiaba' });
  const link = await gerar({ empresaId: a.emp, customerId: c, valor: 122.52, descricao: 'Mensalidade em atraso' });
  assert.match(link, /^https:\/\/academia\.kytto\.com\.br\/clube\/pagar\/[\w-]{30,}$/);
  const token = link.split('/').pop();

  const pagina = await fetch(`${base}/clube/pagar/${token}`);
  assert.equal(pagina.status, 200);
  assert.equal(pagina.headers.get('cache-control'), 'no-store');
  assert.equal(pagina.headers.get('referrer-policy'), 'no-referrer');
  const dados = await json(`/api/public/clube/pagamentos/${token}`);
  assert.equal(dados.status, 200);
  assert.equal(dados.body.valorFormatado, 'R$ 122,52');
  assert.match(dados.body.pixCopiaCola, /^000201.*pix@academia\.com\.br.*5406122\.52.*ACADEMIA TESTE.*CUIABA.*6304[0-9A-F]{4}$/);
  assert.ok(!('customerId' in dados.body) && !('nome' in dados.body), 'página pública não expõe o aluno');
  assert.equal((await json('/api/public/clube/pagamentos/token-que-nao-existe-123456')).status, 404);

  const lista = await json('/api/admin/clube/cobrancas?status=pendente');
  assert.equal(lista.body.length, 1);
  const id = lista.body[0].id;
  assert.equal(lista.body[0].origem, 'regua');
  const ok = await json(`/api/admin/clube/cobrancas/${id}/confirmar`, 'POST');
  assert.equal(ok.status, 200);
  assert.equal(ok.body.efeito.matricula.pagoAte, '2026-02-28', '1 mensalidade (122,52 ≈ 120): soma 1 mês no banco');
  const de_novo = await json(`/api/admin/clube/cobrancas/${id}/confirmar`, 'POST');
  assert.equal(de_novo.body.repetida, true);
  assert.equal(de_novo.body.efeito.duplicado, true, 'não estende o acesso duas vezes');
  assert.equal((await json(`/api/public/clube/pagamentos/${token}`)).body.status, 'paga');
  assert.equal((await json(`/api/public/clube/pagamentos/${token}`)).body.pixCopiaCola, null);
  assert.equal((await json(`/api/admin/clube/cobrancas/${id}/cancelar`, 'POST')).status, 409, 'paga não cancela');
});

test('multiempresa: uma academia não lista, confirma nem cancela cobrança de outra', async () => {
  const a = await academia(); const b = await academia();
  await cob.salvarConfig(ctx.db, a.emp, { ativo: true, pixChave: 'a@a.com.br', pixNome: 'A', pixCidade: 'Cuiaba' });
  const c = await criarCliente(ctx.db, a.emp, 'Aluno A');
  const r = await cob.criarCobranca(ctx.db, { empresaId: a.emp, customerId: c, valor: 99, origem: 'recepcao' });
  empresaAtual = b.emp;
  assert.equal((await json('/api/admin/clube/cobrancas')).body.length, 0);
  assert.equal((await json(`/api/admin/clube/cobrancas/${r.id}/confirmar`, 'POST')).status, 404);
  assert.equal((await json(`/api/admin/clube/cobrancas/${r.id}/cancelar`, 'POST')).status, 404);
  // aluno de outra empresa não recebe cobrança desta
  await cob.salvarConfig(ctx.db, b.emp, { ativo: true, pixChave: 'b@b.com.br', pixNome: 'B', pixCidade: 'Cuiaba' });
  assert.equal((await json('/api/admin/clube/cobrancas', 'POST', { customerId: c, valor: 50 })).status, 404);
  empresaAtual = a.emp;
  assert.equal((await json(`/api/admin/clube/cobrancas/${r.id}/cancelar`, 'POST')).body.status, 'cancelada');
  assert.equal((await json(`/api/admin/clube/cobrancas/${r.id}/confirmar`, 'POST')).status, 409, 'cancelada não confirma');
});

test('acordo parcelado: grava todas as parcelas; a 1ª sai agora e as outras pela rotina, a cada 30 dias', async () => {
  const a = await academia();
  empresaAtual = a.emp;
  await cob.salvarConfig(ctx.db, a.emp, { ativo: true, pixChave: 'pix@x.com.br', pixNome: 'X', pixCidade: 'Cuiaba', validadeHoras: 48 });
  const c = await criarCliente(ctx.db, a.emp, 'Parcelado Silva');
  const agora = new Date('2026-10-18T13:00:00Z');
  const r = await cob.criarCobranca(ctx.db, { empresaId: a.emp, customerId: c, valor: 300.01, parcelas: 3, descricao: 'Acordo em 3x', origem: 'acordo', agora }, { urlPublica: 'https://x.kytto.com.br' });
  assert.equal(r.valor, 100);
  const linhas = (await ctx.db.query('SELECT parcela, valor, tipo, token_hash IS NULL AS agendada, enviar_em FROM clube_cobrancas WHERE empresa_id = $1 ORDER BY parcela', [a.emp])).rows;
  assert.deepEqual(linhas.map((l) => [l.parcela, Number(l.valor), l.tipo, l.agendada]), [[1, 100, 'acordo', false], [2, 100, 'acordo', true], [3, 100.01, 'acordo', true]], 'centavos na última');
  const visao = await cob.cobrancaPorToken(ctx.db, r.link.split('/').pop(), { agora });
  assert.equal(visao.descricao, 'Acordo em 3x (parcela 1/3)');
  assert.equal((await cob.cobrancaPorToken(ctx.db, r.link.split('/').pop(), { agora: new Date(agora.getTime() + 3 * 86400000) })).status, 'vencida');

  const enviados = [];
  const enviar = async (m) => { enviados.push(m); };
  assert.equal((await cob.enviarParcelasDevidas(ctx.db, { enviarWhatsapp: enviar, urlPublica: 'https://x.kytto.com.br', agora })).enviadas, 0, 'antes da hora não sai');
  const dia31 = new Date(agora.getTime() + 31 * 86400000);
  const rot = await executarRotinasClube(ctx.db, { enviarWhatsapp: enviar, urlPublica: 'https://x.kytto.com.br', agora: dia31, gerarGrade: false, rodarRetencao: false });
  assert.equal(rot.parcelas.enviadas, 1);
  assert.match(enviados[0].texto, /parcela 2\/3 do seu acordo: R\$ 100,00\. Pix: https:\/\/x\.kytto\.com\.br\/clube\/pagar\/[\w-]{30,}$/);
  assert.equal((await cob.enviarParcelasDevidas(ctx.db, { enviarWhatsapp: enviar, urlPublica: 'https://x.kytto.com.br', agora: dia31 })).enviadas, 0, 'não reenvia');
  const token2 = enviados[0].texto.split('/').pop();
  assert.equal((await cob.cobrancaPorToken(ctx.db, token2, { agora: dia31 })).status, 'pendente');
});

test('baixa: parcial dá dias proporcionais, avulsa não mexe no acesso, mensal soma o mês', async () => {
  const a = await academia(); // mensalidade 120
  empresaAtual = a.emp;
  await cob.salvarConfig(ctx.db, a.emp, { ativo: true, pixChave: 'pix@y.com.br', pixNome: 'Y', pixCidade: 'Cuiaba' });
  const c = await criarCliente(ctx.db, a.emp, 'Bia Baixa');
  await acesso.criarMatricula(ctx.db, a.emp, { customerId: c, planoId: a.plano.id, pagoAte: '2026-10-01' });
  const pago = async () => (await ctx.db.query('SELECT pago_ate::text AS d FROM acesso_matriculas WHERE empresa_id = $1 AND customer_id = $2', [a.emp, c])).rows[0].d;

  const parcela = await cob.criarCobranca(ctx.db, { empresaId: a.emp, customerId: c, valor: 120, parcelas: 3, origem: 'acordo' });
  await json(`/api/admin/clube/cobrancas/${parcela.id}/confirmar`, 'POST');
  assert.equal(await pago(), '2026-10-11', 'R$ 40 de 120 = 10 dias, não 1 mês');

  const diaria = await cob.criarCobranca(ctx.db, { empresaId: a.emp, customerId: c, valor: 20, tipo: 'avulsa', origem: 'recepcao' });
  await json(`/api/admin/clube/cobrancas/${diaria.id}/confirmar`, 'POST');
  assert.equal(await pago(), '2026-10-11', 'diária avulsa não estende a mensalidade');

  const mensal = await cob.criarCobranca(ctx.db, { empresaId: a.emp, customerId: c, valor: 120, origem: 'recepcao' });
  await json(`/api/admin/clube/cobrancas/${mensal.id}/confirmar`, 'POST');
  assert.equal(await pago(), '2026-11-11');
});

test('baixa que caiu no meio é retomada com a mesma data: nunca estende duas vezes', async () => {
  const a = await academia();
  const c = await criarCliente(ctx.db, a.emp, 'Rui Retomada');
  await acesso.criarMatricula(ctx.db, a.emp, { customerId: c, planoId: a.plano.id, pagoAte: '2026-10-01' });
  // 1ª tentativa: a matrícula é estendida e a atribuição da régua falha (queda de conexão)
  const dbFalhoTx = { ...ctx.db, beginTransaction: ctx.db.beginTransaction, queryInTransaction: async (cl, t, v) => { if (/clube_retencao_disparos/.test(t)) throw new Error('conexão caiu'); return ctx.db.queryInTransaction(cl, t, v); }, commit: ctx.db.commit, rollback: ctx.db.rollback };
  const antes = new Date(Date.now() - 10 * 60000);
  await assert.rejects(registrarPagamentoClube(dbFalhoTx, { empresaId: a.emp, customerId: c, pagamentoId: 'pix-retomar', valor: 120, agora: antes }), /conexão caiu/);
  const pago = async () => (await ctx.db.query('SELECT pago_ate::text AS d FROM acesso_matriculas WHERE empresa_id = $1 AND customer_id = $2', [a.emp, c])).rows[0].d;
  assert.equal(await pago(), '2026-11-01');
  // retry (painel ou gateway reenviando): conclui sem somar outro mês
  const r = await registrarPagamentoClube(ctx.db, { empresaId: a.emp, customerId: c, pagamentoId: 'pix-retomar', valor: 120 });
  assert.equal(r.concluido, true);
  assert.equal(await pago(), '2026-11-01');
  const de_novo = await registrarPagamentoClube(ctx.db, { empresaId: a.emp, customerId: c, pagamentoId: 'pix-retomar', valor: 120 });
  assert.equal(de_novo.duplicado, true);
  assert.equal(await pago(), '2026-11-01');
});

test('link guardado só é reaproveitado se a cobrança seguir em aberto; pago na matrícula cancela o Pix', async () => {
  const a = await academia();
  empresaAtual = a.emp;
  await cob.salvarConfig(ctx.db, a.emp, { ativo: true, pixChave: 'pix@z.com.br', pixNome: 'Z', pixCidade: 'Cuiaba' });
  const c = await criarCliente(ctx.db, a.emp, 'Leo Link');
  const m = await acesso.criarMatricula(ctx.db, a.emp, { customerId: c, planoId: a.plano.id, pagoAte: '2026-10-01' });
  const gerar = integ.gerarLinkPagamento;
  const l1 = await retencao.linkDePagamento(ctx.db, { empresaId: a.emp, customerId: c, valor: 120, gerar });
  assert.equal(await retencao.linkDePagamento(ctx.db, { empresaId: a.emp, customerId: c, valor: 120, gerar }), l1, 'em aberto: reaproveita');
  const id1 = (await ctx.db.query("SELECT id FROM clube_cobrancas WHERE empresa_id = $1 AND status = 'pendente'", [a.emp])).rows[0].id;
  await json(`/api/admin/clube/cobrancas/${id1}/cancelar`, 'POST');
  const l2 = await retencao.linkDePagamento(ctx.db, { empresaId: a.emp, customerId: c, valor: 120, gerar });
  assert.notEqual(l2, l1, 'cancelada: gera outro link');
  // a recepção registra o pagamento direto na matrícula: o Pix em aberto deixa de valer
  await json(`/api/admin/clube/acesso/matriculas/${m.id}/pagamento`, 'POST', { pagoAte: '2026-11-01', valor: '120' });
  const abertas = (await ctx.db.query("SELECT count(*)::int n FROM clube_cobrancas WHERE empresa_id = $1 AND status = 'pendente'", [a.emp])).rows[0].n;
  assert.equal(abertas, 0);
  // sem PUBLIC_BASE_URL não há link (relativo não abre no WhatsApp)
  assert.equal(await cob.criarGeradorDeLink(ctx.db, { urlPublica: '' })({ empresaId: a.emp, customerId: c, valor: 120 }), null);
});

test('IA: link de pagamento sai pelo Pix da academia; sem cobrança ligada, a IA recebe "indisponível"', async () => {
  const a = await academia();
  const c = await criarCliente(ctx.db, a.emp, 'Ivo IA');
  await acesso.criarMatricula(ctx.db, a.emp, { customerId: c, planoId: a.plano.id, pagoAte: '2026-01-31' });
  await ret.salvarConfig(ctx.db, a.emp, { ativo: true });
  const sem = await integ.executarFerramenta({ empresaId: a.emp, customerId: c }, 'clube_gerar_link_pagamento', {});
  assert.equal(sem.ok, false);
  await cob.salvarConfig(ctx.db, a.emp, { ativo: true, pixChave: 'pix@ivo.com.br', pixNome: 'Ivo Academia', pixCidade: 'Cuiaba' });
  const com = await integ.executarFerramenta({ empresaId: a.emp, customerId: c }, 'clube_gerar_link_pagamento', {});
  assert.equal(com.ok, true, JSON.stringify(com));
  assert.match(com.link, /\/clube\/pagar\//);
  const origem = (await ctx.db.query('SELECT origem FROM clube_cobrancas WHERE empresa_id = $1', [a.emp])).rows[0].origem;
  assert.equal(origem, 'ia');
});

});
