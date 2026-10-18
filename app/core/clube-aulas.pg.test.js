import { describe, it as test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pgDeTeste, criarBancoTeste, criarCliente } from './fixtures/clube-pg.js';
import * as aulas from '../modules/aulas/servico.js';
import * as acesso from '../modules/acesso/repositorio.js';
import { decidirAcesso } from '../modules/acesso/regras.js';

describe('clube-aulas (PostgreSQL)', { skip: pgDeTeste }, () => {

const EMP = randomUUID();
let ctx; let plano;
// quarta 21/10/2026, 10:00 em Cuiabá
const AGORA = new Date('2026-10-21T14:00:00Z');
const min = (n) => new Date(AGORA.getTime() + n * 60000);

before(async () => {
  ctx = await criarBancoTeste(['073_clube_acesso_controle.sql', '076_clube_retencao.sql', '077_clube_parceiros.sql', '075_clube_aulas_agenda.sql', '078_clube_cobrancas.sql']);
  plano = await acesso.salvarPlano(ctx.db, EMP, { nome: 'Completo', exigeReserva: true });
});
after(async () => { await ctx.fechar(); });

async function aluno(nome) {
  const id = await criarCliente(ctx.db, EMP, nome);
  await acesso.criarMatricula(ctx.db, EMP, { customerId: id, planoId: plano.id, pagoAte: '2026-12-31' });
  return id;
}

async function turma({ nome = `Spinning ${randomUUID().slice(0, 4)}`, capacidade = 2, vagasParceiros = 0, hora = '18:30', modalidade = {} } = {}) {
  const m = await aulas.salvarModalidade(ctx.db, EMP, { nome: `${nome} mod`, ...modalidade });
  const t = await aulas.salvarTurma(ctx.db, EMP, {
    modalidadeId: m.id, nome, professor: 'Prof. Lia', sala: 'Sala 1', diasSemana: [1, 3, 5], horaInicio: hora,
    duracaoMin: 50, capacidade, vagasParceiros, vigenciaInicio: '2026-10-01',
  });
  await aulas.gerarOcorrencias(ctx.db, EMP, { de: '2026-10-19', ate: '2026-10-25' });
  const grade = await aulas.listarGrade(ctx.db, EMP, { de: '2026-10-21T00:00:00Z', ate: '2026-10-22T06:00:00Z' });
  return { m, t, aula: grade.find((g) => g.turma === nome) };
}

test('gera ocorrências só nos dias da turma, no horário local, sem duplicar', async () => {
  const { t } = await turma({ nome: 'Funcional A' });
  const r2 = await aulas.gerarOcorrencias(ctx.db, EMP, { de: '2026-10-19', ate: '2026-10-25' });
  assert.equal(r2.criadas, 0, 'idempotente');
  const occ = await ctx.db.query('SELECT inicio FROM aulas_ocorrencias WHERE turma_id = $1 ORDER BY inicio', [t.id]);
  assert.deepEqual(occ.rows.map((r) => r.inicio.toISOString()), [
    '2026-10-19T22:30:00.000Z', '2026-10-21T22:30:00.000Z', '2026-10-23T22:30:00.000Z',
  ]);
  await assert.rejects(aulas.salvarTurma(ctx.db, EMP, { modalidadeId: randomUUID(), nome: 'x', diasSemana: [9], horaInicio: '07:00', capacidade: 5, vigenciaInicio: '2026-10-01' }), { code: 'VALIDATION_ERROR' });
});

test('lotação nunca é ultrapassada, mesmo com reservas simultâneas', async () => {
  const { aula } = await turma({ capacidade: 3 });
  const alunos = await Promise.all(Array.from({ length: 8 }, (_, i) => aluno(`Concorrente ${i}`)));
  const resultados = await Promise.allSettled(alunos.map((c) => aulas.reservar(ctx.db, EMP, { ocorrenciaId: aula.id, customerId: c, agora: AGORA })));
  const ok = resultados.filter((r) => r.status === 'fulfilled').length;
  const lotadas = resultados.filter((r) => r.status === 'rejected' && r.reason.code === 'LOTADA').length;
  assert.equal(ok, 3);
  assert.equal(lotadas, 5);
  const [g] = (await aulas.listarGrade(ctx.db, EMP, { de: aula.inicio, ate: new Date(new Date(aula.inicio).getTime() + 1000) })).filter((x) => x.id === aula.id);
  assert.equal(g.ocupadas, 3);
  assert.equal(g.vagas, 0);
});

test('regras do aluno: sem matrícula, repetida, limite de futuras', async () => {
  const { aula, m } = await turma({ capacidade: 10, modalidade: { limiteReservasFuturas: 1 } });
  const semMatricula = await criarCliente(ctx.db, EMP, 'Sem matrícula');
  await assert.rejects(aulas.reservar(ctx.db, EMP, { ocorrenciaId: aula.id, customerId: semMatricula, agora: AGORA }), { code: 'SEM_MATRICULA' });
  const c = await aluno('Rita');
  await aulas.reservar(ctx.db, EMP, { ocorrenciaId: aula.id, customerId: c, agora: AGORA });
  await assert.rejects(aulas.reservar(ctx.db, EMP, { ocorrenciaId: aula.id, customerId: c, agora: AGORA }), { code: 'JA_RESERVADO' });
  const outra = await ctx.db.query("SELECT o.id FROM aulas_ocorrencias o JOIN aulas_turmas t ON t.id = o.turma_id WHERE t.modalidade_id = $1 AND o.id <> $2 AND o.inicio > $3 LIMIT 1", [m.id, aula.id, AGORA]);
  await assert.rejects(aulas.reservar(ctx.db, EMP, { ocorrenciaId: outra.rows[0].id, customerId: c, agora: AGORA }), { code: 'LIMITE_RESERVAS' });
});

test('vagas de parceiros: aluno não ocupa, parceiro só ocupa as dele', async () => {
  const { aula } = await turma({ capacidade: 3, vagasParceiros: 1 });
  const [a1, a2, a3] = await Promise.all([aluno('P1'), aluno('P2'), aluno('P3')]);
  await aulas.reservar(ctx.db, EMP, { ocorrenciaId: aula.id, customerId: a1, agora: AGORA });
  await aulas.reservar(ctx.db, EMP, { ocorrenciaId: aula.id, customerId: a2, agora: AGORA });
  await assert.rejects(aulas.reservar(ctx.db, EMP, { ocorrenciaId: aula.id, customerId: a3, agora: AGORA }), { code: 'LOTADA' }, 'a última vaga é do parceiro');
  const w1 = await criarCliente(ctx.db, EMP, 'Wellhub 1');
  const w2 = await criarCliente(ctx.db, EMP, 'Wellhub 2');
  await aulas.reservar(ctx.db, EMP, { ocorrenciaId: aula.id, customerId: w1, origem: 'wellhub', agora: AGORA });
  await assert.rejects(aulas.reservar(ctx.db, EMP, { ocorrenciaId: aula.id, customerId: w2, origem: 'wellhub', agora: AGORA }), { code: 'LOTADA' });
});

test('fila: cancelamento chama o 1º; sem resposta passa ao próximo; SIM vira reserva', async () => {
  const { aula } = await turma({ capacidade: 1 });
  const [dono, f1, f2] = await Promise.all([aluno('Dono Vaga'), aluno('Fila Um'), aluno('Fila Dois')]);
  const { reservaId } = await aulas.reservar(ctx.db, EMP, { ocorrenciaId: aula.id, customerId: dono, agora: AGORA });
  assert.equal((await aulas.entrarNaFila(ctx.db, EMP, { ocorrenciaId: aula.id, customerId: f1, agora: AGORA })).posicao, 1);
  assert.equal((await aulas.entrarNaFila(ctx.db, EMP, { ocorrenciaId: aula.id, customerId: f2, agora: AGORA })).posicao, 2);

  const cancel = await aulas.cancelarReserva(ctx.db, EMP, { reservaId, agora: AGORA });
  assert.equal(cancel.tardio, false, 'cancelou com mais de 2 h');
  assert.equal(cancel.avisos.length, 1);
  assert.equal(cancel.avisos[0].customerId, f1);
  assert.match(cancel.avisos[0].texto, /Responda SIM em até 15 minutos/);

  // ninguém responde em 15 min → passa para o segundo
  const avisos = await aulas.expirarChamados(ctx.db, { agora: min(16) });
  assert.equal(avisos.length, 1);
  assert.equal(avisos[0].customerId, f2);

  await assert.rejects(aulas.responderFila(ctx.db, EMP, { ocorrenciaId: aula.id, customerId: f1, aceitar: true, agora: min(17) }), { code: 'SEM_CHAMADO' });
  const ok = await aulas.responderFila(ctx.db, EMP, { ocorrenciaId: aula.id, customerId: f2, aceitar: true, agora: min(18) });
  assert.equal(ok.reservado, true);
});

test('fila em corrida (menos de 1 h): avisa todos e fica com o primeiro SIM', async () => {
  const { aula } = await turma({ capacidade: 1 });
  const inicio = new Date(aula.inicio);
  const quase = new Date(inicio.getTime() - 40 * 60000);
  const [dono, a, b] = await Promise.all([aluno('Corrida Dono'), aluno('Corrida A'), aluno('Corrida B')]);
  const { reservaId } = await aulas.reservar(ctx.db, EMP, { ocorrenciaId: aula.id, customerId: dono, agora: AGORA });
  await aulas.entrarNaFila(ctx.db, EMP, { ocorrenciaId: aula.id, customerId: a, agora: AGORA });
  await aulas.entrarNaFila(ctx.db, EMP, { ocorrenciaId: aula.id, customerId: b, agora: AGORA });
  const c = await aulas.cancelarReserva(ctx.db, EMP, { reservaId, agora: quase });
  assert.equal(c.tardio, true, 'cancelou a menos de 2 h: conta como falta para o dono');
  assert.equal(c.avisos.length, 2);
  assert.match(c.avisos[0].texto, /primeiro/);
  const rb = await aulas.responderFila(ctx.db, EMP, { ocorrenciaId: aula.id, customerId: b, aceitar: true, agora: quase });
  assert.equal(rb.reservado, true);
  await assert.rejects(aulas.responderFila(ctx.db, EMP, { ocorrenciaId: aula.id, customerId: a, aceitar: true, agora: quase }), { code: 'SEM_CHAMADO' }, 'A volta a aguardar');
});

test('faltas: no-show após tolerância e bloqueio por excesso de faltas', async () => {
  const { m } = await turma({ capacidade: 5, hora: '07:00', modalidade: { noshowLimiteMes: 2, noshowBloqueioDias: 7, limiteReservasFuturas: 10 } });
  const c = await aluno('Faltoso');
  const occ = await ctx.db.query(
    'SELECT o.id, o.inicio FROM aulas_ocorrencias o JOIN aulas_turmas t ON t.id = o.turma_id WHERE t.modalidade_id = $1 ORDER BY o.inicio',
    [m.id],
  );
  // reserva as duas primeiras (19/10 e 21/10 às 07:00) antes de acontecerem
  const antes = new Date('2026-10-18T12:00:00Z');
  for (const o of occ.rows.slice(0, 2)) await aulas.reservar(ctx.db, EMP, { ocorrenciaId: o.id, customerId: c, agora: antes });
  const r = await aulas.processarFaltas(ctx.db, { agora: AGORA });
  assert.ok(r.faltas >= 2);
  await assert.rejects(aulas.reservar(ctx.db, EMP, { ocorrenciaId: occ.rows[2].id, customerId: c, agora: AGORA }), { code: 'BLOQUEIO_FALTAS' });
});

test('catraca: plano que exige reserva libera só com reserva e marca presença', async () => {
  const { aula } = await turma({ capacidade: 5 });
  const c = await aluno('Presente');
  const naPorta = new Date(new Date(aula.inicio).getTime() - 10 * 60000);
  const extras = { reservas: aulas.reservasParaAcesso };
  let ctxAcesso = await acesso.carregarContexto(ctx.db, { empresaId: EMP, customerId: c, agora: naPorta }, extras);
  assert.equal(decidirAcesso({ ...ctxAcesso, agora: naPorta }).codigo, 'sem_reserva');
  await aulas.reservar(ctx.db, EMP, { ocorrenciaId: aula.id, customerId: c, agora: AGORA });
  ctxAcesso = await acesso.carregarContexto(ctx.db, { empresaId: EMP, customerId: c, agora: naPorta }, extras);
  assert.equal(decidirAcesso({ ...ctxAcesso, agora: naPorta }).liberado, true);
  assert.equal(await aulas.registrarPresencaPorAcesso(ctx.db, { empresaId: EMP, customerId: c, agora: naPorta }), 1);
  const lista = await aulas.listaDaAula(ctx.db, EMP, aula.id);
  assert.equal(lista.find((x) => x.customer_id === c).status, 'presente');
});

test('lembrete 2 h antes uma única vez; cancelamento da aula avisa todos', async () => {
  const { aula } = await turma({ capacidade: 5 });
  const c = await aluno('Lembrada');
  await aulas.reservar(ctx.db, EMP, { ocorrenciaId: aula.id, customerId: c, agora: AGORA });
  const duasHorasAntes = new Date(new Date(aula.inicio).getTime() - 110 * 60000);
  const l1 = (await aulas.lembretesDeAula(ctx.db, { agora: duasHorasAntes })).filter((l) => l.customerId === c);
  assert.equal(l1.length, 1);
  assert.match(l1[0].texto, /hoje às 18:30/);
  assert.equal((await aulas.lembretesDeAula(ctx.db, { agora: duasHorasAntes })).filter((l) => l.customerId === c).length, 0);
  const canc = await aulas.cancelarAula(ctx.db, EMP, aula.id, 'professor em viagem');
  assert.ok(canc.avisos.some((a) => a.customerId === c && /foi cancelada/.test(a.texto)));
  await assert.rejects(aulas.reservar(ctx.db, EMP, { ocorrenciaId: aula.id, customerId: c, agora: AGORA }), { code: 'AULA_CANCELADA' });
});

test('vagas do dia para a IA do WhatsApp', async () => {
  const nome = `Yoga ${randomUUID().slice(0, 4)}`;
  await turma({ nome, capacidade: 4 });
  const vagas = await aulas.listarVagas(ctx.db, EMP, { dia: '2026-10-21', modalidade: 'yoga', agora: AGORA });
  const y = vagas.find((v) => v.turma === nome);
  assert.equal(y.vagasAlunos, 4);
  assert.match(y.rotulo, /às 18:30/);
});
});
