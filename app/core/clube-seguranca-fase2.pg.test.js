// Regressão dos achados da revisão independente da Fase 2 (retenção, parceiros, painel).
// Cada teste reproduz o defeito/ataque encontrado e garante que a correção continua de pé.
import { describe, it as test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { pgDeTeste, criarBancoTeste, criarCliente } from './fixtures/clube-pg.js';
import * as acesso from '../modules/acesso/repositorio.js';
import { decidirAcesso } from '../modules/acesso/regras.js';
import { exigirData } from '../modules/acesso/banco.js';
import * as ret from '../modules/retencao/servico.js';
import * as ops from '../modules/retencao/operacoes.js';
import { createRetencaoAdminRouter } from '../modules/retencao/rotas.js';
import * as parc from '../modules/parceiros/servico.js';
import { wellhub } from '../modules/parceiros/adaptadores.js';

describe('clube-seguranca-fase2 (PostgreSQL)', { skip: pgDeTeste }, () => {

process.env.CLUBE_PARCEIROS_SECRET ||= 'segredo-de-teste-dos-parceiros-0123456789abcdef';
let ctx;
const AGORA = new Date('2026-10-21T14:00:00Z'); // quarta, 10:00 em Cuiabá
const d = (n) => new Date(AGORA.getTime() + n * 86400000);

before(async () => {
  ctx = await criarBancoTeste(['073_clube_acesso_controle.sql', '076_clube_retencao.sql', '077_clube_parceiros.sql', '074_clube_contratos_digitais.sql', '075_clube_aulas_agenda.sql', '078_clube_cobrancas.sql']);
});
after(async () => { await ctx.fechar(); });

async function academia(cfg = {}) {
  const emp = randomUUID();
  await ret.salvarConfig(ctx.db, emp, { ativo: true, baseLegalMarketing: 'legitimo_interesse', ...cfg });
  const plano = await acesso.salvarPlano(ctx.db, emp, { nome: 'Mensal', valorMensal: 100, congelamentoMaxDiasAno: 30, congelamentoMinDias: 7 });
  return { emp, plano };
}
async function aluno(a, nome, extra = {}) {
  const id = await criarCliente(ctx.db, a.emp, nome);
  const m = await acesso.criarMatricula(ctx.db, a.emp, { customerId: id, planoId: a.plano.id, pagoAte: '2026-12-31', inicio: '2026-01-05', ...extra });
  return { id, matriculaId: m.id };
}
const canal = () => { const l = []; return { l, f: async (m) => { l.push(m); return { ok: true }; } }; };

test('A3: migration 076 dá às matrículas antigas a data de criação, não a do deploy', async () => {
  // aplica 073 e 076 num schema novo com uma matrícula criada antes da 076
  const conn = process.env.CLUBE_PG_TEST_URL;
  const schema = `t_mig_${Date.now()}`;
  const c = new pg.Client({ connectionString: conn });
  await c.connect();
  try {
    await c.query(`CREATE SCHEMA ${schema}; SET search_path = ${schema}, public`);
    await c.query('CREATE TABLE commerce_customers (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id UUID, nome TEXT, telefone TEXT, email TEXT, criado_em TIMESTAMPTZ DEFAULT now())');
    await c.query(readFileSync(new URL('../migrations/073_clube_acesso_controle.sql', import.meta.url), 'utf8'));
    const e = randomUUID();
    const p = await c.query("INSERT INTO acesso_planos (empresa_id, nome) VALUES ($1, 'P') RETURNING id", [e]);
    await c.query("INSERT INTO acesso_matriculas (empresa_id, customer_id, plano_id, pago_ate, criado_em) VALUES ($1, gen_random_uuid(), $2, '2026-12-01', '2024-03-10T15:00:00Z')", [e, p.rows[0].id]);
    await c.query(readFileSync(new URL('../migrations/076_clube_retencao.sql', import.meta.url), 'utf8'));
    await c.query(readFileSync(new URL('../migrations/076_clube_retencao.sql', import.meta.url), 'utf8')); // reaplica sem erro
    const r = await c.query('SELECT inicio::text AS i FROM acesso_matriculas');
    assert.equal(r.rows[0].i, '2024-03-10');
  } finally {
    await c.query(`DROP SCHEMA ${schema} CASCADE`).catch(() => {});
    await c.end();
  }
});

test('A3: sem eventos de catraca na academia, ninguém é tratado como sumido nem em risco', async () => {
  const a = await academia();
  const x = await aluno(a, 'Sem Catraca');
  const w = canal();
  await ret.executarRegua(ctx.db, a.emp, { agora: AGORA, enviarWhatsapp: w.f });
  assert.equal(w.l.length, 0);
  await ret.calcularScores(ctx.db, a.emp, { agora: AGORA, forcar: true });
  const s = await ctx.db.query('SELECT risco FROM clube_retencao_score WHERE customer_id = $1', [x.id]);
  assert.equal(s.rows[0].risco, 0);
});

test('A3: pesquisa da 1ª semana só para quem entrou depois de a régua ser ligada', async () => {
  const a = await academia();
  await ctx.db.query('UPDATE clube_retencao_config SET ativada_em = $2 WHERE empresa_id = $1', [a.emp, d(-30)]);
  const antigo = await aluno(a, 'Antigo', { inicio: '2026-10-12' });
  await ctx.db.query('UPDATE clube_retencao_config SET ativada_em = $2 WHERE empresa_id = $1', [a.emp, new Date('2026-10-13T12:00:00Z')]);
  const novo = await aluno(a, 'Novo', { inicio: '2026-10-14' });
  for (const x of [antigo, novo]) {
    await ctx.db.query("INSERT INTO acesso_eventos (empresa_id, customer_id, ocorrido_em, decisao, codigo_regra, origem) VALUES ($1, $2, $3, 'liberado', 'ok', 'online')", [a.emp, x.id, d(-1)]);
  }
  const w = canal();
  await ret.executarRegua(ctx.db, a.emp, { agora: AGORA, enviarWhatsapp: w.f });
  assert.deepEqual(w.l.map((m) => [m.customerId, m.gatilho]), [[novo.id, 'pos_aula']]);
});

test('M5: link de pagamento nunca passa do parcelamento máximo da academia', async () => {
  const a = await academia({ acordoMaxParcelas: 3 });
  const x = await aluno(a, 'Parcela', { pagoAte: '2026-10-10' });
  const gerar = async ({ parcelas }) => `https://pay.test/${parcelas}`;
  await assert.rejects(ops.gerarLink(ctx.db, a.emp, x.id, { agora: AGORA, gerarLinkPagamento: gerar, parcelas: 48 }), { code: 'FORA_DA_REGRA' });
  assert.equal((await ops.gerarLink(ctx.db, a.emp, x.id, { agora: AGORA, gerarLinkPagamento: gerar, parcelas: 3 })).link, 'https://pay.test/3');
});

test('M10: o mesmo link de pagamento é reaproveitado (uma cobrança por dívida)', async () => {
  const a = await academia();
  const x = await aluno(a, 'Um Link', { pagoAte: '2026-10-18' });
  let gerados = 0;
  const gerar = async () => `https://pay.test/link-${++gerados}`;
  const l1 = await ops.gerarLink(ctx.db, a.emp, x.id, { agora: AGORA, gerarLinkPagamento: gerar });
  const l2 = await ops.gerarLink(ctx.db, a.emp, x.id, { agora: new Date(AGORA.getTime() + 3600000), gerarLinkPagamento: gerar });
  assert.equal(l1.link, l2.link);
  assert.equal(gerados, 1);
});

test('M6: reativar pela recepção não desfaz congelamento; encerrar devolve os dias', async () => {
  const a = await academia();
  const x = await aluno(a, 'Gelo', { pagoAte: '2026-11-30' });
  await ops.congelarPlano(ctx.db, a.emp, x.id, { dias: 10 }, { agora: AGORA });
  await assert.rejects(acesso.alterarStatusMatricula(ctx.db, a.emp, x.matriculaId, 'ativa'), { code: 'CONGELAMENTO_ATIVO' });
  // a rotina não recongela quem já começou
  const r = await ops.aplicarCongelamentos(ctx.db, { agora: d(1) });
  assert.equal(r.iniciados, 0);
  const e = await ops.encerrarCongelamentoDoAluno(ctx.db, a.emp, x.id, { agora: d(3) });
  assert.equal(e.diasDevolvidos, 7);
  const m = await ctx.db.query('SELECT status, pago_ate::text AS p FROM acesso_matriculas WHERE id = $1', [x.matriculaId]);
  assert.deepEqual([m.rows[0].status, m.rows[0].p], ['ativa', '2026-12-03']);
});

test('faltante não conta os dias congelados', async () => {
  const a = await academia();
  const x = await aluno(a, 'Voltou do Gelo', { pagoAte: '2026-12-31' });
  await ctx.db.query("INSERT INTO acesso_eventos (empresa_id, customer_id, ocorrido_em, decisao, codigo_regra, origem) VALUES ($1, $2, $3, 'liberado', 'ok', 'online')", [a.emp, x.id, d(-40)]);
  await ctx.db.query(
    "INSERT INTO clube_congelamentos (empresa_id, matricula_id, customer_id, inicio, fim, dias, status, iniciado_em) VALUES ($1, $2, $3, '2026-09-12', '2026-10-19', 38, 'encerrado', now())",
    [a.emp, x.matriculaId, x.id],
  );
  const w = canal();
  await ret.executarRegua(ctx.db, a.emp, { agora: AGORA, enviarWhatsapp: w.f });
  assert.equal(w.l.length, 0, 'voltou do congelamento ontem: não é "sumido há 40 dias"');
});

test('M4: passe de parceiro vale só na unidade da conta (online e no aparelho)', async () => {
  const a = await academia();
  const unidadeA = randomUUID(); const unidadeB = randomUUID();
  const { dispositivo: dA } = await acesso.criarDispositivo(ctx.db, a.emp, { nome: 'A', unidadeId: unidadeA });
  const { dispositivo: dB } = await acesso.criarDispositivo(ctx.db, a.emp, { nome: 'B', unidadeId: unidadeB });
  await acesso.reservarComandos(ctx.db, dA.id, 'x'); await acesso.reservarComandos(ctx.db, dB.id, 'x');
  const gym = String(Math.floor(Math.random() * 1e6));
  const { conta } = await parc.criarConta(ctx.db, a.emp, { plataforma: 'wellhub', idExterno: gym, unidadeId: unidadeA });
  await ctx.db.query('UPDATE clube_parceiro_contas SET verificada = true WHERE id = $1', [conta.id]);
  const contaRow = (await ctx.db.query('SELECT * FROM clube_parceiro_contas WHERE id = $1', [conta.id])).rows[0];
  const r = await parc.receberCheckin(ctx.db, contaRow, wellhub.lerCheckin({ event_type: 'checkin', event_data: { user: { unique_token: '7777' }, gym: { id: Number(gym) }, timestamp: Math.floor(Date.now() / 1000) } }), {});
  const cA = await acesso.reservarComandos(ctx.db, dA.id, 'y');
  const cB = await acesso.reservarComandos(ctx.db, dB.id, 'y');
  assert.equal(cA[0].comando.endpoint, 'create_or_modify_objects');
  assert.equal(cB[0].comando.endpoint, 'destroy_objects', 'outra unidade não recebe o passe');
  const ctxA = await acesso.carregarContexto(ctx.db, { empresaId: a.emp, customerId: r.customerId, agora: new Date() }, { parceiro: parc.passeParaAcesso });
  assert.equal(decidirAcesso({ ...ctxA, agora: new Date(), unidadeId: unidadeA }).liberado, true);
  assert.equal(decidirAcesso({ ...ctxA, agora: new Date(), unidadeId: unidadeB }).liberado, false);
});

test('opt-out não muda o disparo de cobrança (a receita ainda é atribuída)', async () => {
  const a = await academia();
  const x = await aluno(a, 'Para Cobranca', { pagoAte: '2026-10-18' });
  await ctx.db.query("INSERT INTO acesso_eventos (empresa_id, customer_id, ocorrido_em, decisao, codigo_regra, origem) VALUES ($1, $2, $3, 'liberado', 'ok', 'online')", [a.emp, x.id, d(-1)]);
  const w = canal();
  await ret.executarRegua(ctx.db, a.emp, { agora: AGORA, enviarWhatsapp: w.f });
  await ret.registrarMensagemRecebida(ctx.db, { empresaId: a.emp, customerId: x.id, texto: 'PARAR', agora: d(0.1) });
  const st = await ctx.db.query('SELECT status FROM clube_retencao_disparos WHERE customer_id = $1', [x.id]);
  assert.equal(st.rows[0].status, 'respondeu');
  const pg2 = await ret.registrarPagamentoRecebido(ctx.db, { empresaId: a.emp, customerId: x.id, valor: 100, agora: d(0.2) });
  assert.equal(pg2.atribuido, true);
});

test('datas inexistentes são recusadas antes do banco', () => {
  assert.throws(() => exigirData('2026-02-31', 'x'), { code: 'VALIDATION_ERROR' });
  assert.throws(() => exigirData('2026-13-01', 'x'), { code: 'VALIDATION_ERROR' });
  assert.equal(exigirData('2028-02-29', 'x'), '2028-02-29');
});

test('perfil: salvar um campo não apaga os outros; rotas do aluno exigem aluno da própria academia', async () => {
  const a = await academia();
  const x = await aluno(a, 'Perfil');
  await ops.salvarPerfil(ctx.db, a.emp, x.id, { dataNascimento: '1990-05-01', observacoes: 'lesão no joelho' });
  const p = await ops.salvarPerfil(ctx.db, a.emp, x.id, { objetivo: 'correr 10 km' });
  assert.deepEqual(p, { dataNascimento: '1990-05-01', objetivo: 'correr 10 km', observacoes: 'lesão no joelho' });
  const outra = await academia();
  const app = express();
  app.use('/r', createRetencaoAdminRouter({ db: ctx.db, empresaDaRequisicao: async () => outra.emp }));
  const srv = app.listen(0);
  const base = `http://127.0.0.1:${srv.address().port}/r`;
  try {
    assert.equal((await fetch(`${base}/alunos/${x.id}/perfil`)).status, 404, 'aluno de outra academia');
    assert.equal((await fetch(`${base}/alunos/${x.id}/financeiro`)).status, 404);
    assert.equal((await fetch(`${base}/risco?minimo=abc`)).status, 200, 'parâmetro inválido usa o padrão');
  } finally { srv.close(); }
});

test('cadastro do parceiro: dois webhooks simultâneos da mesma pessoa criam um cadastro só', async () => {
  const a = await academia();
  const gym = String(Math.floor(Math.random() * 1e6));
  const { conta } = await parc.criarConta(ctx.db, a.emp, { plataforma: 'wellhub', idExterno: gym });
  const contaRow = (await ctx.db.query('SELECT * FROM clube_parceiro_contas WHERE id = $1', [conta.id])).rows[0];
  const ev = (ts) => wellhub.lerCheckin({ event_type: 'checkin', event_data: { user: { unique_token: '42424242', first_name: 'Duplo' }, gym: { id: Number(gym) }, timestamp: ts } });
  await Promise.all([parc.receberCheckin(ctx.db, contaRow, ev(1790000001), {}), parc.receberCheckin(ctx.db, contaRow, ev(1790000002), {})]);
  const n = await ctx.db.query("SELECT COUNT(*)::int AS n FROM commerce_customers WHERE empresa_id = $1 AND nome = 'Duplo'", [a.emp]);
  assert.equal(n.rows[0].n, 1);
});

test('Wellhub sem id nem horário do evento é recusado (reentrega não vira check-in novo)', () => {
  assert.equal(wellhub.lerCheckin({ event_type: 'checkin', event_data: { user: { unique_token: '1' }, gym: { id: 1 } } }).invalido, true);
  const e = wellhub.lerCheckin({ event_type: 'checkin', event_id: 'evt-9', event_data: { user: { unique_token: '1' }, gym: { id: 1 } } });
  assert.equal(e.idExterno, 'evt:evt-9');
});

test('repasse: duas visitas no mesmo dia somam; reimportar substitui', async () => {
  const a = await academia();
  const linhas = [{ idNaPlataforma: 'P1', data: '2026-09-03', valor: 20 }, { idNaPlataforma: 'P1', data: '2026-09-03', valor: 15 }];
  await parc.importarRepasse(ctx.db, a.emp, { plataforma: 'wellhub', mes: '2026-09', linhas });
  await parc.importarRepasse(ctx.db, a.emp, { plataforma: 'wellhub', mes: '2026-09', linhas });
  const r = await ctx.db.query('SELECT valor_pago::float AS v FROM clube_parceiro_repasses WHERE empresa_id = $1', [a.emp]);
  assert.deepEqual(r.rows.map((x) => x.v), [35]);
});

});
