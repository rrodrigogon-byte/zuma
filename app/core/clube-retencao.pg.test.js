import { describe, it as test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { pgDeTeste, criarBancoTeste, criarCliente } from './fixtures/clube-pg.js';
import * as acesso from '../modules/acesso/repositorio.js';
import * as ret from '../modules/retencao/servico.js';
import * as ops from '../modules/retencao/operacoes.js';
import * as painel from '../modules/retencao/painel.js';
import { createRetencaoAdminRouter } from '../modules/retencao/rotas.js';
import { executarFerramentaClube } from '../modules/clube/ferramentas-ia.js';
import { registrarPagamentoClube } from '../modules/clube/index.js';

describe('clube-retencao (PostgreSQL)', { skip: pgDeTeste }, () => {

let ctx;
// quarta-feira 21/10/2026, 10:00 em Cuiabá
const AGORA = new Date('2026-10-21T14:00:00Z');
const h = (horas) => new Date(AGORA.getTime() + horas * 3600000);
const d = (dias) => new Date(AGORA.getTime() + dias * 86400000);

before(async () => {
  ctx = await criarBancoTeste(['073_clube_acesso_controle.sql', '076_clube_retencao.sql', '077_clube_parceiros.sql', '074_clube_contratos_digitais.sql', '075_clube_aulas_agenda.sql', '078_clube_cobrancas.sql']);
});
after(async () => { await ctx.fechar(); });

async function academia(config = {}) {
  const emp = randomUUID();
  // a maioria dos cenários testa a cadência; a base legal tem teste próprio (padrão: consentimento)
  await ret.salvarConfig(ctx.db, emp, { ativo: true, telefoneGestor: '65988887777', baseLegalMarketing: 'legitimo_interesse', ...config });
  const plano = await acesso.salvarPlano(ctx.db, emp, { nome: 'Mensal', valorMensal: 120, fidelidadeMeses: 12, congelamentoMaxDiasAno: 30, congelamentoMinDias: 7 });
  return { emp, plano };
}
async function aluno(a, nome, { pagoAte = '2026-11-10', inicio = '2026-01-10', telefone } = {}) {
  const id = await criarCliente(ctx.db, a.emp, nome, telefone || `6599${Math.floor(1000000 + Math.random() * 8999999)}`);
  const m = await acesso.criarMatricula(ctx.db, a.emp, { customerId: id, planoId: a.plano.id, pagoAte, inicio });
  return { id, matriculaId: m.id };
}
async function acessoEm(a, customerId, quando) {
  await ctx.db.query(
    "INSERT INTO acesso_eventos (empresa_id, customer_id, ocorrido_em, decisao, codigo_regra, origem) VALUES ($1, $2, $3, 'liberado', 'ok', 'online')",
    [a.emp, customerId, quando],
  );
}
function canal() {
  const enviados = [];
  const enviar = async (m) => { enviados.push(m); return { ok: true }; };
  return { enviados, enviar };
}
const links = async ({ valor, parcelas = 1 }) => `https://pay.test/pix/${valor}/${parcelas}`;

test('config: padrões seguros (desligada) e limites do CDC', async () => {
  const emp = randomUUID();
  const c = await ret.obterConfig(ctx.db, emp);
  assert.equal(c.ativo, false);
  assert.equal(c.baseLegalMarketing, 'consentimento', 'LGPD: marketing só com consentimento por padrão');
  assert.equal(c.intervaloDias, 3);
  await assert.rejects(ret.salvarConfig(ctx.db, emp, { multaPercentual: 5 }), { code: 'VALIDATION_ERROR' });
  await assert.rejects(ret.salvarConfig(ctx.db, emp, { horaInicio: 20, horaFim: 8 }), { code: 'VALIDATION_ERROR' });
  await assert.rejects(ret.salvarConfig(ctx.db, emp, { tom: 'agressivo' }), { code: 'VALIDATION_ERROR' });
  const salva = await ret.salvarConfig(ctx.db, emp, { tom: 'formal', limiteDiario: 10 });
  assert.equal(salva.tom, 'formal');
  await assert.rejects(ret.salvarRegua(ctx.db, emp, 'faltante_leve', { parametros: { dias: 1 } }), { code: 'VALIDATION_ERROR' });
  await assert.rejects(ret.salvarRegua(ctx.db, emp, 'faltante_leve', { parametros: { qualquer: 3 } }), { code: 'VALIDATION_ERROR' });
  const r = await ret.salvarRegua(ctx.db, emp, 'faltante_leve', { parametros: { dias: 10 }, textos: ['Oi {nome}, sentimos sua falta há {dias} dias!'] });
  assert.equal(r.parametros.dias, 10);
});

test('régua: cada aluno recebe a mensagem certa, uma vez; opt-out e conversa em andamento são respeitados', async () => {
  const a = await academia();
  const devedor = await aluno(a, 'Bruno Devedor', { pagoAte: '2026-10-18' });       // 3 dias de atraso
  const sumido = await aluno(a, 'Sara Sumida');                                     // 9 dias sem treinar
  await acessoEm(a, sumido.id, d(-9));
  const optou = await aluno(a, 'Otto Optout');                                      // sumido, mas pediu para parar
  await acessoEm(a, optou.id, d(-9));
  await ret.registrarOptout(ctx.db, { empresaId: a.emp, customerId: optou.id, agora: d(-5) });
  const conversando = await aluno(a, 'Clara Conversa');                             // sumida, mas respondeu ontem
  await acessoEm(a, conversando.id, d(-9));
  await ret.registrarMensagemRecebida(ctx.db, { empresaId: a.emp, customerId: conversando.id, texto: 'oi, tudo bem', agora: d(-1) });
  const emDia = await aluno(a, 'Edu EmDia');
  await acessoEm(a, emDia.id, d(-1));

  const w = canal();
  const r = await ret.executarRegua(ctx.db, a.emp, { agora: AGORA, enviarWhatsapp: w.enviar, gerarLinkPagamento: links });
  assert.equal(r.enviados, 2);
  const porAluno = Object.fromEntries(w.enviados.map((m) => [m.customerId, m]));
  assert.match(porAluno[devedor.id].texto, /Bruno/);
  assert.match(porAluno[devedor.id].texto, /R\$\s?122,52/, 'mensalidade 120 + multa 2% (2,40) + juros de 3 dias (0,12)');
  assert.match(porAluno[devedor.id].texto, /https:\/\/pay\.test\/pix\//);
  assert.equal(porAluno[devedor.id].gatilho, 'inadimplente');
  assert.equal(porAluno[sumido.id].gatilho, 'faltante_leve');
  assert.match(porAluno[sumido.id].texto, /9 dias/);
  assert.ok(!porAluno[optou.id] && !porAluno[conversando.id] && !porAluno[emDia.id]);
  assert.equal(r.bloqueados.optout, 1);
  assert.equal(r.bloqueados.em_conversa, 1);

  // mesmo minuto de novo: nada duplicado
  const r2 = await ret.executarRegua(ctx.db, a.emp, { agora: h(1), enviarWhatsapp: w.enviar, gerarLinkPagamento: links });
  assert.equal(r2.enviados, 0);
  // dois dias depois: devedor ainda no passo 3 (já enviado) e cadência de 3 dias segura todos;
  // só a Clara, cuja pausa por resposta acabou, recebe o lembrete de faltante
  const antes = w.enviados.length;
  const r3 = await ret.executarRegua(ctx.db, a.emp, { agora: d(2), enviarWhatsapp: w.enviar, gerarLinkPagamento: links });
  assert.equal(r3.enviados, 1);
  assert.equal(w.enviados[antes].customerId, conversando.id);
  // domingo (dia 7 de atraso) não envia; na segunda (8 dias) sai o passo 7
  assert.equal((await ret.executarRegua(ctx.db, a.emp, { agora: d(4), enviarWhatsapp: w.enviar, gerarLinkPagamento: links })).enviados, 0);
  const r4 = await ret.executarRegua(ctx.db, a.emp, { agora: d(5), enviarWhatsapp: w.enviar, gerarLinkPagamento: links });
  assert.ok(w.enviados.slice(3).some((m) => m.customerId === devedor.id && /8 dia/.test(m.texto)));
  const chave = await ctx.db.query("SELECT chave FROM clube_retencao_disparos WHERE customer_id = $1 ORDER BY enviado_em DESC LIMIT 1", [devedor.id]);
  assert.equal(chave.rows[0].chave, 'inadimplente:2026-10-18:7');
  assert.ok(r4.enviados >= 1);
});

test('LGPD: no padrão (consentimento) marketing só sai para quem consentiu; cobrança sai sempre; opt-out revoga', async () => {
  const a = await academia({ baseLegalMarketing: 'consentimento' });
  const devedor = await aluno(a, 'Dora Devedora', { pagoAte: '2026-10-18' });
  const semOk = await aluno(a, 'Sílvio SemOk');
  await acessoEm(a, semOk.id, d(-9));
  const comOk = await aluno(a, 'Celia ComOk');
  await acessoEm(a, comOk.id, d(-9));
  await assert.rejects(ret.registrarConsentimentoMarketing(ctx.db, { empresaId: a.emp, customerId: comOk.id, concedido: true, origem: 'whatsapp' }), { code: 'VALIDATION_ERROR' });
  const c = await ret.registrarConsentimentoMarketing(ctx.db, { empresaId: a.emp, customerId: comOk.id, concedido: true, origem: 'recepcao', operador: 'Recepção 1', agora: d(-2) });
  assert.equal(c.evidencia.origem, 'recepcao');
  const w = canal();
  const r = await ret.executarRegua(ctx.db, a.emp, { agora: AGORA, enviarWhatsapp: w.enviar, gerarLinkPagamento: links });
  const ids = w.enviados.map((m) => m.customerId);
  assert.ok(ids.includes(devedor.id), 'cobrança é informativa: não depende de consentimento');
  assert.ok(ids.includes(comOk.id));
  assert.ok(!ids.includes(semOk.id));
  assert.equal(r.bloqueados.sem_consentimento, 1);
  assert.match(w.enviados.find((m) => m.customerId === comOk.id).texto, /responda PARAR\.$/, 'novidade sempre diz como parar');
  assert.doesNotMatch(w.enviados.find((m) => m.customerId === devedor.id).texto, /PARAR/, 'cobrança é informativa');
  const row = (await ctx.db.query('SELECT marketing_consentido_em, marketing_evidencia FROM clube_retencao_contatos WHERE empresa_id = $1 AND customer_id = $2', [a.emp, comOk.id])).rows[0];
  assert.ok(row.marketing_consentido_em && row.marketing_evidencia.operador === 'Recepção 1', 'evidência guardada');
  // "parar" revoga o consentimento
  await ret.registrarOptout(ctx.db, { empresaId: a.emp, customerId: comOk.id, agora: d(-1) });
  const depois = (await ctx.db.query('SELECT marketing_consentido_em FROM clube_retencao_contatos WHERE empresa_id = $1 AND customer_id = $2', [a.emp, comOk.id])).rows[0];
  assert.equal(depois.marketing_consentido_em, null);
  await assert.rejects(ret.salvarConfig(ctx.db, a.emp, { baseLegalMarketing: 'qualquer' }), { code: 'VALIDATION_ERROR' });
});

test('cobrança continua informativa depois do opt-out; marketing não', async () => {
  const a = await academia();
  const x = await aluno(a, 'Pedro Pare', { pagoAte: '2026-10-20' });
  await acessoEm(a, x.id, d(-9));
  const rec = await ret.registrarMensagemRecebida(ctx.db, { empresaId: a.emp, customerId: x.id, texto: 'PARAR', agora: d(-4) });
  assert.equal(rec.optout, true);
  const w = canal();
  await ret.executarRegua(ctx.db, a.emp, { agora: AGORA, enviarWhatsapp: w.enviar });
  assert.equal(w.enviados.length, 1);
  assert.equal(w.enviados[0].gatilho, 'inadimplente');
  assert.match(w.enviados[0].texto, /Quer que eu gere o Pix/, 'sem gerador de link: oferece gerar');
});

test('horário, domingo e limite diário por prioridade', async () => {
  const a = await academia({ limiteDiario: 1 });
  const fiel = await aluno(a, 'Fabio Faltante');
  await acessoEm(a, fiel.id, d(-8));
  const dev = await aluno(a, 'Dora Devedora', { pagoAte: '2026-10-20' });
  await acessoEm(a, dev.id, d(-1));
  const w = canal();
  assert.equal((await ret.executarRegua(ctx.db, a.emp, { agora: new Date('2026-10-22T01:30:00Z'), enviarWhatsapp: w.enviar })).enviados, 0, '21h30 local');
  assert.equal((await ret.executarRegua(ctx.db, a.emp, { agora: new Date('2026-10-25T14:00:00Z'), enviarWhatsapp: w.enviar })).enviados, 0, 'domingo');
  const r = await ret.executarRegua(ctx.db, a.emp, { agora: AGORA, enviarWhatsapp: w.enviar });
  assert.equal(r.enviados, 1);
  assert.equal(w.enviados[0].customerId, dev.id, 'cobrança tem prioridade no limite do dia');
  assert.equal(r.bloqueados.limite_diario, 1);
});

test('falha do canal: fica como falha, não conta no limite e tenta de novo depois de 30 min (até 3x)', async () => {
  const a = await academia();
  const x = await aluno(a, 'Fausto Falha');
  await acessoEm(a, x.id, d(-8));
  let n = 0;
  const falha = async () => { n += 1; return { ok: false, error: 'CLUBE_SEM_CANAL_WHATSAPP' }; };
  const r1 = await ret.executarRegua(ctx.db, a.emp, { agora: AGORA, enviarWhatsapp: falha });
  assert.equal(r1.falhas, 1);
  const st = await ctx.db.query('SELECT status, erro, tentativas FROM clube_retencao_disparos WHERE customer_id = $1', [x.id]);
  assert.deepEqual([st.rows[0].status, st.rows[0].erro, st.rows[0].tentativas], ['falhou', 'CLUBE_SEM_CANAL_WHATSAPP', 1]);
  assert.equal((await ret.executarRegua(ctx.db, a.emp, { agora: h(0.2), enviarWhatsapp: falha })).falhas, 0, 'antes de 30 min não tenta');
  const w = canal();
  assert.equal((await ret.executarRegua(ctx.db, a.emp, { agora: h(1), enviarWhatsapp: w.enviar })).enviados, 1);
  const ok = await ctx.db.query('SELECT status, tentativas FROM clube_retencao_disparos WHERE customer_id = $1', [x.id]);
  assert.deepEqual([ok.rows[0].status, ok.rows[0].tentativas], ['enviado', 2]);
  assert.equal(n, 1);
});

test('resultados: voltou a treinar, pagou (receita recuperada) e renovou; funil confere', async () => {
  const a = await academia();
  const volta = await aluno(a, 'Vera Volta');
  await acessoEm(a, volta.id, d(-8));
  const paga = await aluno(a, 'Paulo Paga', { pagoAte: '2026-10-20' });
  await acessoEm(a, paga.id, d(-1));
  const renova = await aluno(a, 'Rita Renova', { inicio: '2025-11-15' }); // fidelidade termina 2026-11-15
  await acessoEm(a, renova.id, d(-1));
  const w = canal();
  await ret.executarRegua(ctx.db, a.emp, { agora: AGORA, enviarWhatsapp: w.enviar, gerarLinkPagamento: links });
  assert.deepEqual(w.enviados.map((m) => m.gatilho).sort(), ['faltante_leve', 'inadimplente', 'renovacao']);

  await acessoEm(a, volta.id, h(26));
  await acesso.registrarPagamento(ctx.db, a.emp, paga.matriculaId, '2026-11-20');
  const pg = await ret.registrarPagamentoRecebido(ctx.db, { empresaId: a.emp, customerId: paga.id, valor: 121.24, agora: h(3) });
  assert.equal(pg.gatilho, 'inadimplente');
  await ctx.db.query("UPDATE acesso_matriculas SET fim_fidelidade = '2027-11-15', atualizado_em = $2 WHERE id = $1", [renova.matriculaId, h(30)]);
  const res = await ret.atribuirResultados(ctx.db, { agora: d(2) });
  assert.equal(res.voltou, 1);
  assert.equal(res.renovou, 1);

  const f = await painel.funil(ctx.db, a.emp, { mes: '2026-10' });
  assert.equal(f.total.disparadas, 3);
  assert.equal(f.total.resolvidas, 3);
  assert.equal(f.total.recuperado, 121.24);
  assert.equal(f.porGatilho.find((x) => x.gatilho === 'inadimplente').recuperado, 121.24);
  assert.deepEqual(f.resultados.map((x) => x.resultado).sort(), ['pagou', 'renovou', 'voltou']);
});

test('baixa externa (Asaas/link da IA): estende meses pelo valor, libera a catraca e soma receita', async () => {
  const a = await academia();
  const { dispositivo } = await acesso.criarDispositivo(ctx.db, a.emp, { nome: 'Catraca' });
  const x = await aluno(a, 'Bia Baixa', { pagoAte: '2026-10-10' });
  await acessoEm(a, x.id, d(-1));
  const w = canal();
  await ret.executarRegua(ctx.db, a.emp, { agora: AGORA, enviarWhatsapp: w.enviar, gerarLinkPagamento: links });
  await acesso.reservarComandos(ctx.db, dispositivo.id, 'limpa');
  const r = await registrarPagamentoClube(ctx.db, { empresaId: a.emp, customerId: x.id, pagamentoId: 'asaas_pay_001', valor: 240, agora: h(1) });
  assert.equal(r.matricula.pagoAte, '2026-12-10');
  // webhook reentregue: não estende de novo nem soma receita de novo
  const dup = await registrarPagamentoClube(ctx.db, { empresaId: a.emp, customerId: x.id, pagamentoId: 'asaas_pay_001', valor: 240, agora: h(2) });
  assert.equal(dup.duplicado, true);
  assert.equal((await ctx.db.query('SELECT pago_ate::text AS p FROM acesso_matriculas WHERE id = $1', [x.matriculaId])).rows[0].p, '2026-12-10');
  await assert.rejects(registrarPagamentoClube(ctx.db, { empresaId: a.emp, customerId: x.id, valor: 10 }), { code: 'VALIDATION_ERROR' }, 'sem id do pagamento');
  await assert.rejects(registrarPagamentoClube(ctx.db, { empresaId: a.emp, customerId: x.id, pagamentoId: 'p2', meses: '92abc' }), { code: 'VALIDATION_ERROR' });
  // fim de mês: 31/01 + 1 mês = 28/02 (sem transbordar para março)
  const fm = await aluno(a, 'Fim Mes', { pagoAte: '2027-01-31' });
  const r2 = await registrarPagamentoClube(ctx.db, { empresaId: a.emp, customerId: fm.id, pagamentoId: 'p3', meses: '1' });
  assert.equal(r2.matricula.pagoAte, '2027-02-28');
  assert.equal(r.atribuicao.gatilho, 'inadimplente');
  const [cmd] = await acesso.reservarComandos(ctx.db, dispositivo.id, 'pagou');
  assert.ok(cmd, 'comando de atualização foi para a catraca na hora');
  const f = await painel.funil(ctx.db, a.emp, { mes: '2026-10' });
  assert.equal(f.total.recuperado, 240);
});

test('acordo: dentro da regra vira promessa e pausa a cobrança; fora da regra vai para humano', async () => {
  const a = await academia({ acordoMaxParcelas: 3, acordoMaxDiasPromessa: 10 });
  const x = await aluno(a, 'Ana Acordo', { pagoAte: '2026-10-18' });
  await acessoEm(a, x.id, d(-1));
  const gestor = canal();
  const notificar = async ({ texto }) => gestor.enviar({ texto });
  const fora = await ops.proporAcordo(ctx.db, a.emp, x.id, { tipo: 'parcelamento', parcelas: 6 }, { agora: AGORA, gerarLinkPagamento: links, notificarGestor: notificar });
  assert.equal(fora.humano, true);
  assert.match(gestor.enviados[0].texto, /Ana Acordo precisa de atendimento humano \(acordo fora da regra\)/);
  const prom = await ops.proporAcordo(ctx.db, a.emp, x.id, { tipo: 'promessa', promessaAte: '2026-10-28' }, { agora: AGORA });
  assert.equal(prom.tipo, 'promessa');
  await assert.rejects(ops.proporAcordo(ctx.db, a.emp, x.id, { tipo: 'promessa', promessaAte: '2026-10-27' }, { agora: AGORA }), { code: 'ACORDO_ABERTO' });
  // a régua não cobra até a data prometida (e a ocorrência pausou a conversa)
  const w = canal();
  await ctx.db.query('UPDATE clube_retencao_contatos SET ultima_resposta_em = NULL WHERE customer_id = $1', [x.id]);
  await ret.executarRegua(ctx.db, a.emp, { agora: AGORA, enviarWhatsapp: w.enviar });
  assert.equal(w.enviados.length, 0);
  // pagou só parte: acordo segue aberto e a promessa continua valendo
  const total = Number((await ctx.db.query('SELECT valor_total FROM clube_retencao_acordos WHERE customer_id = $1', [x.id])).rows[0].valor_total);
  await ret.registrarPagamentoRecebido(ctx.db, { empresaId: a.emp, customerId: x.id, valor: 50, agora: h(2) });
  assert.equal((await ctx.db.query('SELECT status FROM clube_retencao_acordos WHERE customer_id = $1', [x.id])).rows[0].status, 'aberto');
  assert.ok((await ctx.db.query('SELECT promessa_ate FROM clube_retencao_contatos WHERE customer_id = $1', [x.id])).rows[0].promessa_ate);
  // pagou o resto: acordo cumprido e promessa limpa
  await ret.registrarPagamentoRecebido(ctx.db, { empresaId: a.emp, customerId: x.id, valor: Math.round((total - 50) * 100) / 100, agora: h(3) });
  const st = await ctx.db.query('SELECT status, valor_pago FROM clube_retencao_acordos WHERE customer_id = $1', [x.id]);
  assert.equal(st.rows[0].status, 'cumprido');
  assert.equal((await ctx.db.query('SELECT promessa_ate FROM clube_retencao_contatos WHERE customer_id = $1', [x.id])).rows[0].promessa_ate, null);

  const y = await aluno(a, 'Igor Parcela', { pagoAte: '2026-09-20' });
  const parc = await ops.proporAcordo(ctx.db, a.emp, y.id, { tipo: 'parcelamento', parcelas: 3 }, { agora: AGORA, gerarLinkPagamento: links });
  assert.match(parc.link, /\/3$/);
  assert.equal(parc.valor, 247.28, '31 dias = 2 meses (240) + multa 2% (4,80) + juros de 31 dias (2,48)');
});

test('congelamento: regra do plano, devolve os dias, tira da catraca e volta sozinho', async () => {
  const a = await academia();
  const { dispositivo } = await acesso.criarDispositivo(ctx.db, a.emp, { nome: 'Catraca' });
  const x = await aluno(a, 'Gil Gelo', { pagoAte: '2026-11-10', inicio: '2026-03-01' });
  await acesso.reservarComandos(ctx.db, dispositivo.id, 'limpa');
  await assert.rejects(ops.congelarPlano(ctx.db, a.emp, x.id, { dias: 3 }, { agora: AGORA }), { code: 'FORA_DA_REGRA' });
  await assert.rejects(ops.congelarPlano(ctx.db, a.emp, x.id, { dias: 40 }, { agora: AGORA }), { code: 'FORA_DA_REGRA' });
  const c = await ops.congelarPlano(ctx.db, a.emp, x.id, { dias: 20 }, { agora: AGORA });
  assert.deepEqual([c.inicio, c.fim, c.voltaEm, c.restanteNoAno], ['2026-10-21', '2026-11-09', '2026-11-10', 10]);
  const m = await ctx.db.query('SELECT status, pago_ate::text AS p, fim_fidelidade::text AS f FROM acesso_matriculas WHERE id = $1', [x.matriculaId]);
  assert.deepEqual([m.rows[0].status, m.rows[0].p, m.rows[0].f], ['congelada', '2026-11-30', '2027-03-21']);
  const [cmd] = await acesso.reservarComandos(ctx.db, dispositivo.id, 'cong');
  assert.equal(cmd.comando.endpoint, 'destroy_objects', 'congelado sai da catraca');
  await assert.rejects(ops.congelarPlano(ctx.db, a.emp, x.id, { dias: 7 }, { agora: AGORA }), { code: 'SEM_MATRICULA' });
  // fim do congelamento: a rotina reativa
  const fim = await ops.aplicarCongelamentos(ctx.db, { agora: new Date('2026-11-10T13:00:00Z') });
  assert.equal(fim.encerrados, 1);
  const m2 = await ctx.db.query('SELECT status FROM acesso_matriculas WHERE id = $1', [x.matriculaId]);
  assert.equal(m2.rows[0].status, 'ativa');

  // em atraso não congela; congelamento futuro começa na data; encerrar antes devolve os dias
  const dev = await aluno(a, 'Dani Atraso', { pagoAte: '2026-10-15' });
  await assert.rejects(ops.congelarPlano(ctx.db, a.emp, dev.id, { dias: 10 }, { agora: AGORA }), { code: 'EM_ATRASO' });
  const fut = await aluno(a, 'Fred Futuro', { pagoAte: '2026-11-30' });
  const cf = await ops.congelarPlano(ctx.db, a.emp, fut.id, { dias: 10, inicio: '2026-10-25' }, { agora: AGORA });
  assert.equal((await ctx.db.query('SELECT status FROM acesso_matriculas WHERE id = $1', [fut.matriculaId])).rows[0].status, 'ativa');
  await ops.aplicarCongelamentos(ctx.db, { agora: new Date('2026-10-25T12:00:00Z') });
  assert.equal((await ctx.db.query('SELECT status FROM acesso_matriculas WHERE id = $1', [fut.matriculaId])).rows[0].status, 'congelada');
  const enc = await ops.encerrarCongelamento(ctx.db, a.emp, cf.congelamentoId, { agora: new Date('2026-10-28T12:00:00Z') });
  assert.equal(enc.diasDevolvidos, 7, 'usou 25, 26 e 27; devolve 28 a 03/11');
  const m3 = await ctx.db.query('SELECT status, pago_ate::text AS p FROM acesso_matriculas WHERE id = $1', [fut.matriculaId]);
  assert.deepEqual([m3.rows[0].status, m3.rows[0].p], ['ativa', '2026-12-03']);
});

test('score, alunos em risco, churn e motivos', async () => {
  const a = await academia();
  const risco = await aluno(a, 'Rui Risco', { pagoAte: '2026-10-15' });
  for (let i = 30; i < 50; i += 2) await acessoEm(a, risco.id, d(-i));
  const ok = await aluno(a, 'Olga Ok');
  for (let i = 1; i < 50; i += 3) await acessoEm(a, ok.id, d(-i));
  const saiu = await aluno(a, 'Saulo Saiu', { inicio: '2026-05-01' });
  await ctx.db.query("UPDATE acesso_matriculas SET criado_em = '2026-05-01' WHERE customer_id = ANY($1)", [[risco.id, ok.id, saiu.id]]);
  await acesso.alterarStatusMatricula(ctx.db, a.emp, saiu.matriculaId, 'cancelada');
  await ops.registrarMotivoSaida(ctx.db, a.emp, saiu.id, { categoria: 'horario', detalhe: 'mudou de turno' });
  await assert.rejects(ops.registrarMotivoSaida(ctx.db, a.emp, saiu.id, { categoria: 'xyz' }), { code: 'VALIDATION_ERROR' });

  const s = await ret.calcularScores(ctx.db, a.emp, { agora: AGORA });
  assert.equal(s.calculados, 2);
  assert.equal((await ret.calcularScores(ctx.db, a.emp, { agora: AGORA })).jaCalculado, true);
  const lista = await painel.alunosEmRisco(ctx.db, a.emp, { agora: AGORA, minimo: 0 });
  assert.equal(lista[0].nome, 'Rui Risco');
  assert.ok(lista[0].risco > 50);
  assert.ok(lista[0].fatores.some((x) => /atraso/.test(x.fator)));
  const c = await painel.churn(ctx.db, a.emp, { mes: hojeMes() });
  assert.equal(c.atual.saidas, 1);
  assert.equal(c.atual.base, 3);
  assert.equal(c.atual.taxa, 33.3);
  assert.deepEqual(await painel.motivosDeSaida(ctx.db, a.emp, { mes: hojeMes() }), [{ categoria: 'horario', n: 1 }]);
});
const hojeMes = () => new Date().toISOString().slice(0, 7);

test('IA: financeiro, link, congelar, humano sem detalhe de saúde, nota baixa, parar mensagens, interesse', async () => {
  const a = await academia();
  const x = await aluno(a, 'Lia Conversa', { pagoAte: '2026-10-18' });
  const gestor = canal();
  const notificarGestor = async ({ texto }) => gestor.enviar({ texto });
  const conversa = { empresaId: a.emp, customerId: x.id };
  const op = { agora: AGORA, gerarLinkPagamento: links, notificarGestor };
  const fin = await executarFerramentaClube(ctx.db, conversa, 'clube_consultar_financeiro', {}, op);
  assert.equal(fin.diasAtraso, 3);
  assert.equal(fin.regra, undefined, 'regra de acordo não vai para o modelo');
  const link = await executarFerramentaClube(ctx.db, conversa, 'clube_gerar_link_pagamento', {}, op);
  assert.match(link.link, /^https:\/\/pay\.test/);
  const cong = await executarFerramentaClube(ctx.db, conversa, 'clube_congelar_plano', { dias: 10 }, op);
  assert.equal(cong.codigo, 'EM_ATRASO');
  const hum = await executarFerramentaClube(ctx.db, conversa, 'clube_transferir_para_humano', { tipo: 'saude', motivo: 'lesão no joelho direito, cirurgia' }, op);
  assert.match(hum.protocolo, /^[0-9A-F]{8}$/);
  assert.ok(!gestor.enviados[0].texto.includes('joelho'), 'detalhe de saúde fica só no painel');
  const nota = await executarFerramentaClube(ctx.db, conversa, 'clube_registrar_nota', { nota: 4, comentario: 'aparelhos quebrados' }, op);
  assert.equal(nota.atendente_avisado, true);
  const oc = await ops.listarOcorrencias(ctx.db, a.emp);
  assert.deepEqual(oc.map((o) => o.tipo).sort(), ['nota_baixa', 'saude']);
  await ops.atualizarOcorrencia(ctx.db, a.emp, oc[0].id, { status: 'resolvida', solucao: 'Ligamos e resolvemos' });
  assert.equal((await ops.listarOcorrencias(ctx.db, a.emp)).length, 1);
  await executarFerramentaClube(ctx.db, conversa, 'clube_parar_mensagens', {}, op);
  const ct = await ctx.db.query('SELECT optout_em FROM clube_retencao_contatos WHERE customer_id = $1', [x.id]);
  assert.ok(ct.rows[0].optout_em);
  const novo = await criarCliente(ctx.db, a.emp, 'Nina Nova');
  const int = await executarFerramentaClube(ctx.db, { empresaId: a.emp, customerId: novo }, 'clube_registrar_interesse', { origem: 'preco', interesse: 'pilates' }, op);
  assert.equal(int.registrado, true);
  const ja = await executarFerramentaClube(ctx.db, conversa, 'clube_registrar_interesse', { origem: 'preco' }, op);
  assert.equal(ja.registrado, false);
  const freq = await executarFerramentaClube(ctx.db, conversa, 'clube_consultar_frequencia', {}, op);
  assert.equal(freq.ok, true);
});

test('interessado: retorno no 1º/3º/7º dia e matrícula fecha o funil', async () => {
  const a = await academia();
  const p = await criarCliente(ctx.db, a.emp, 'Pietra Prospect');
  await ops.registrarInteresse(ctx.db, a.emp, p, { origem: 'experimental' });
  await ctx.db.query("UPDATE clube_prospects SET criado_em = $2 WHERE customer_id = $1", [p, d(-1)]);
  const w = canal();
  await ret.executarRegua(ctx.db, a.emp, { agora: AGORA, enviarWhatsapp: w.enviar });
  assert.equal(w.enviados[0].gatilho, 'prospect');
  await acesso.criarMatricula(ctx.db, a.emp, { customerId: p, planoId: a.plano.id, pagoAte: '2026-11-21' });
  await ctx.db.query('UPDATE acesso_matriculas SET criado_em = $2 WHERE customer_id = $1', [p, h(5)]);
  await ops.converterInteressado(ctx.db, a.emp, p, h(5));
  const r = await ret.atribuirResultados(ctx.db, { agora: h(6) });
  assert.equal(r.matriculou, 1);
});

test('prévia e rotas do painel: simula sem enviar; validação vira 400', async () => {
  const a = await academia();
  const x = await aluno(a, 'Mila Previa');
  await acessoEm(a, x.id, new Date(Date.now() - 8 * 86400000)); // a prévia usa o relógio real
  const app = express();
  app.use('/r', createRetencaoAdminRouter({ db: ctx.db, empresaDaRequisicao: async () => a.emp, operadorDaRequisicao: () => 'gestor' }));
  const srv = app.listen(0);
  const base = `http://127.0.0.1:${srv.address().port}/r`;
  try {
    const prev = await (await fetch(`${base}/previa`)).json();
    assert.equal(prev.mensagens.length, 1);
    assert.match(prev.mensagens[0].texto, /Mila/);
    assert.equal((await ctx.db.query('SELECT COUNT(*)::int AS n FROM clube_retencao_disparos WHERE empresa_id = $1', [a.emp])).rows[0].n, 0);
    const bad = await fetch(`${base}/config`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ limiteDiario: -1 }) });
    assert.equal(bad.status, 400);
    const p = await (await fetch(`${base}/painel?mes=2026-10`)).json();
    assert.ok(p.funil && p.churn && Array.isArray(p.emRisco));
    assert.equal((await fetch(`${base}/funil?mes=2026-13`)).status, 400);
  } finally { srv.close(); }
});

});
