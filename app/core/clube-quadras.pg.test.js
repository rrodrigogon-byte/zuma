import { describe, it as test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { pgDeTeste, criarBancoTeste, criarCliente } from './fixtures/clube-pg.js';
import * as quadras from '../modules/quadras/servico.js';
import * as acesso from '../modules/acesso/repositorio.js';
import { executarFerramentaClube } from '../modules/clube/ferramentas-ia.js';
import { extensaoIaClube } from '../modules/clube/ia-agro-open.js';
import { montarClube } from '../modules/clube/index.js';

describe('clube-quadras (PostgreSQL)', { skip: pgDeTeste }, () => {

let ctx;
// terça-feira, 20/10/2026, 10:00 em Cuiabá
const AGORA = new Date('2026-10-20T10:00:00-04:00');
const DIA = '2026-10-20';
const TODOS_OS_DIAS = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, [{ abre: '05:00', fecha: '23:00' }]]));

before(async () => {
  ctx = await criarBancoTeste(['073_clube_acesso_controle.sql', '076_clube_retencao.sql', '077_clube_parceiros.sql', '074_clube_contratos_digitais.sql', '075_clube_aulas_agenda.sql', '078_clube_cobrancas.sql', '080_clube_quadras.sql']);
});
after(async () => { await ctx.fechar(); });

/** Clube como o TTC: 05h às 23h todo dia, 7 quadras de saibro e 7 de beach tennis, um plano. */
async function clubeTtc() {
  const emp = randomUUID();
  await quadras.salvarConfig(ctx.db, emp, { funcionamento: TODOS_OS_DIAS });
  const saibro = await quadras.criarQuadrasEmLote(ctx.db, emp, { quantidade: 7, prefixo: 'Saibro', modalidade: 'tenis', piso: 'saibro' });
  const beach = await quadras.criarQuadrasEmLote(ctx.db, emp, { quantidade: 7, prefixo: 'Beach', modalidade: 'beach_tennis', piso: 'areia' });
  const plano = await acesso.salvarPlano(ctx.db, emp, { nome: 'Sócio Individual', valorMensal: 120 });
  return { emp, saibro: saibro.criadas, beach: beach.criadas, plano };
}
async function socio(c, nome, pagoAte = '2026-11-30') {
  const id = await criarCliente(ctx.db, c.emp, nome);
  await acesso.criarMatricula(ctx.db, c.emp, { customerId: id, planoId: c.plano.id, pagoAte, inicio: '2026-10-01' });
  return id;
}
const erroCom = (codigo) => (e) => { assert.equal(e.code, codigo, e.message); return true; };

test('TTC: 05h às 23h, 7 quadras de saibro e 7 de beach tennis; criar de novo não duplica', async () => {
  const c = await clubeTtc();
  assert.equal(c.saibro.length, 7);
  assert.deepEqual(c.beach.map((q) => q.nome), ['Beach 1', 'Beach 2', 'Beach 3', 'Beach 4', 'Beach 5', 'Beach 6', 'Beach 7']);
  const de_novo = await quadras.criarQuadrasEmLote(ctx.db, c.emp, { quantidade: 7, prefixo: 'Saibro', modalidade: 'tenis', piso: 'saibro' });
  assert.equal(de_novo.criadas.length, 0);
  assert.equal(de_novo.jaExistiam, 7);

  const g = await quadras.grade(ctx.db, c.emp, { data: DIA, agora: AGORA });
  assert.equal(g.configurado, true);
  assert.equal(g.quadras.length, 14);
  assert.deepEqual(g.faixas, [{ abre: '05:00', fecha: '23:00' }]);
  assert.equal(g.horarios[0], '05:00');
  assert.equal(g.horarios.at(-1), '22:00', 'último início de 1 h termina às 23:00');
  assert.equal(g.horarios.length, 18);
  assert.equal(g.agora, '10:00');
  // ordem: saibro primeiro, depois beach (ordem de cadastro)
  assert.equal(g.quadras[0].nome, 'Saibro 1');
  assert.equal(g.quadras[7].modalidadeRotulo, 'Beach tennis');
  const soBeach = await quadras.grade(ctx.db, c.emp, { data: DIA, modalidade: 'beach', agora: AGORA });
  assert.equal(soBeach.quadras.length, 7);

  // funcionamento inválido é recusado com mensagem clara
  await assert.rejects(quadras.salvarConfig(ctx.db, c.emp, { funcionamento: { 1: [{ abre: '23:00', fecha: '05:00' }] } }), /depois da abertura/);
});

test('recepção: reserva do sócio, choque de horário, mesmo sócio em duas quadras e fora do funcionamento', async () => {
  const c = await clubeTtc();
  const ana = await socio(c, 'Ana Saibro');
  const bia = await socio(c, 'Bia Beach');
  const s1 = c.saibro[0].id;

  const r = await quadras.reservar(ctx.db, c.emp, { quadraId: s1, customerId: ana, data: DIA, hora: '18:00', agora: AGORA, operador: 'Recepção' });
  assert.equal(r.inicio, '18:00');
  assert.equal(r.fim, '19:00');
  assert.match(r.rotulo, /Saibro 1 · terça, 20\/10, das 18:00 às 19:00/);

  // começa no meio da reserva da Ana: choque
  await assert.rejects(quadras.reservar(ctx.db, c.emp, { quadraId: s1, customerId: bia, data: DIA, hora: '18:30', duracaoMin: 60, agora: AGORA }), erroCom('OCUPADA'));
  // logo depois: livre
  await quadras.reservar(ctx.db, c.emp, { quadraId: s1, customerId: bia, data: DIA, hora: '19:00', agora: AGORA });
  // Ana em outra quadra no mesmo horário: não
  await assert.rejects(quadras.reservar(ctx.db, c.emp, { quadraId: c.saibro[1].id, customerId: ana, data: DIA, hora: '18:00', agora: AGORA }), erroCom('JA_RESERVADO'));
  // 22:30 + 60 min passa das 23:00
  await assert.rejects(quadras.reservar(ctx.db, c.emp, { quadraId: s1, customerId: ana, data: DIA, hora: '22:30', agora: AGORA }), erroCom('FORA_DO_FUNCIONAMENTO'));
  await assert.rejects(quadras.reservar(ctx.db, c.emp, { quadraId: s1, customerId: ana, data: DIA, hora: '04:00', agora: AGORA }), erroCom('FORA_DO_FUNCIONAMENTO'));
  // horário que já passou
  await assert.rejects(quadras.reservar(ctx.db, c.emp, { quadraId: s1, customerId: ana, data: DIA, hora: '07:00', agora: AGORA }), erroCom('HORARIO_PASSOU'));

  const g = await quadras.grade(ctx.db, c.emp, { data: DIA, agora: AGORA });
  const q1 = g.quadras.find((q) => q.id === s1);
  assert.deepEqual(q1.reservas.map((x) => [x.inicio, x.fim, x.nome]), [['18:00', '19:00', 'Ana Saibro'], ['19:00', '20:00', 'Bia Beach']]);
  assert.equal(g.ocupacao.ocupados, 2);
});

test('mensalidade em aberto bloqueia a reserva do sócio; o clube pode desligar essa regra', async () => {
  const c = await clubeTtc();
  const caio = await socio(c, 'Caio Atrasado', '2026-10-01'); // tolerância de 5 dias: venceu em 06/10
  await assert.rejects(quadras.reservar(ctx.db, c.emp, { quadraId: c.beach[0].id, customerId: caio, data: DIA, hora: '17:00', agora: AGORA }), erroCom('INADIMPLENTE'));
  const semPlano = await criarCliente(ctx.db, c.emp, 'Sem Plano');
  await assert.rejects(quadras.reservar(ctx.db, c.emp, { quadraId: c.beach[0].id, customerId: semPlano, data: DIA, hora: '17:00', agora: AGORA }), erroCom('SEM_MATRICULA'));
  await quadras.salvarConfig(ctx.db, c.emp, { exigeSocioEmDia: false });
  const ok = await quadras.reservar(ctx.db, c.emp, { quadraId: c.beach[0].id, customerId: caio, data: DIA, hora: '17:00', agora: AGORA });
  assert.equal(ok.quadra, 'Beach 1');
  // o funcionamento salvo antes continua (PUT parcial não apaga o resto)
  assert.deepEqual((await quadras.obterConfig(ctx.db, c.emp)).funcionamento['2'], [{ abre: '05:00', fecha: '23:00' }]);
});

test('avulso e bloqueio de manutenção ocupam a grade e somem dos horários livres', async () => {
  const c = await clubeTtc();
  await quadras.reservar(ctx.db, c.emp, { quadraId: c.saibro[2].id, tipo: 'avulso', titulo: 'Visitante João', data: DIA, hora: '15:00', duracaoMin: 90, agora: AGORA });
  await quadras.reservar(ctx.db, c.emp, { quadraId: c.saibro[3].id, tipo: 'manutencao', data: DIA, hora: '10:00', duracaoMin: 780, agora: AGORA });
  await assert.rejects(quadras.reservar(ctx.db, c.emp, { quadraId: c.saibro[2].id, tipo: 'avulso', data: DIA, hora: '08:00', agora: AGORA }), /nome de quem vai jogar/);
  const g = await quadras.grade(ctx.db, c.emp, { data: DIA, modalidade: 'tenis', agora: AGORA });
  const s3 = g.quadras.find((q) => q.nome === 'Saibro 3').reservas[0];
  assert.deepEqual([s3.tipo, s3.titulo, s3.inicio, s3.fim], ['avulso', 'Visitante João', '15:00', '16:30']);
  const s4 = g.quadras.find((q) => q.nome === 'Saibro 4').reservas[0];
  assert.deepEqual([s4.tipoRotulo, s4.inicio, s4.fim], ['Manutenção', '10:00', '23:00']);

  const livres = await quadras.horariosLivres(ctx.db, c.emp, { data: DIA, modalidade: 'tenis', agora: AGORA, limite: 30 });
  assert.equal(livres.horarios[0].hora, '11:00', 'só horários que ainda não começaram');
  const as15 = livres.horarios.find((h) => h.hora === '15:00');
  assert.equal(as15.quadras.length, 5, '7 saibros menos o avulso e a manutenção');
  assert.ok(!as15.quadras.some((q) => q.nome === 'Saibro 3' || q.nome === 'Saibro 4'));
  assert.equal(livres.horarios.at(-1).hora, '22:00');
  // domingo fechado: grade e livres avisam
  await quadras.salvarConfig(ctx.db, c.emp, { funcionamento: { ...TODOS_OS_DIAS, 0: [] } });
  const dom = await quadras.horariosLivres(ctx.db, c.emp, { data: '2026-10-25', agora: AGORA });
  assert.equal(dom.aberto, false);
  await assert.rejects(quadras.reservar(ctx.db, c.emp, { quadraId: c.saibro[0].id, tipo: 'avulso', titulo: 'X', data: '2026-10-25', hora: '08:00', agora: AGORA }), erroCom('FECHADO'));
});

test('reservas ao mesmo tempo no mesmo horário: só uma passa', async () => {
  const c = await clubeTtc();
  const socios = await Promise.all([1, 2, 3, 4, 5].map((i) => socio(c, `Sócio Corrida ${i}`)));
  const r = await Promise.allSettled(socios.map((s) => quadras.reservar(ctx.db, c.emp, { quadraId: c.beach[6].id, customerId: s, data: DIA, hora: '20:00', agora: AGORA })));
  assert.equal(r.filter((x) => x.status === 'fulfilled').length, 1);
  assert.ok(r.filter((x) => x.status === 'rejected').every((x) => x.reason.code === 'OCUPADA'));
  const n = (await ctx.db.query("SELECT COUNT(*)::int n FROM clube_quadra_reservas WHERE empresa_id = $1 AND status = 'confirmada'", [c.emp])).rows[0].n;
  assert.equal(n, 1);
});

test('WhatsApp: antecedência, limite de reservas, cancelamento tardio e só as próprias reservas', async () => {
  const c = await clubeTtc();
  const dani = await socio(c, 'Dani Tenista');
  const edu = await socio(c, 'Edu Tenista');
  await quadras.salvarConfig(ctx.db, c.emp, { aberturaDias: 2, limiteReservasFuturas: 2, cancelamentoMinAntes: 120 });
  const conversa = { empresaId: c.emp, customerId: dani };

  const livres = await executarFerramentaClube(ctx.db, conversa, 'clube_quadras_livres', { dia: DIA, modalidade: 'Tênis', hora: '18:00' }, { agora: AGORA });
  assert.equal(livres.ok, true);
  assert.equal(livres.horarios[0].hora, '18:00');
  assert.equal(livres.horarios[0].quadras.length, 7);
  assert.ok(!livres.horarios[0].quadras.some((q) => q.modalidade !== 'Tênis'));

  const r1 = await executarFerramentaClube(ctx.db, conversa, 'clube_reservar_quadra', { quadra_id: livres.horarios[0].quadras[0].quadra_id, dia: DIA, hora: '11:00' }, { agora: AGORA });
  assert.equal(r1.ok, true, JSON.stringify(r1));
  assert.match(r1.reserva, /Saibro 1 · terça, 20\/10, das 11:00 às 12:00/);
  const longe = await executarFerramentaClube(ctx.db, conversa, 'clube_reservar_quadra', { quadra_id: c.saibro[1].id, dia: '2026-10-25', hora: '08:00' }, { agora: AGORA });
  assert.equal(longe.codigo, 'RESERVA_FECHADA');
  await executarFerramentaClube(ctx.db, conversa, 'clube_reservar_quadra', { quadra_id: c.saibro[1].id, dia: '2026-10-21', hora: '08:00' }, { agora: AGORA });
  const terceira = await executarFerramentaClube(ctx.db, conversa, 'clube_reservar_quadra', { quadra_id: c.saibro[2].id, dia: '2026-10-22', hora: '08:00' }, { agora: AGORA });
  assert.equal(terceira.codigo, 'LIMITE_RESERVAS');
  // a recepção pode passar do limite
  await quadras.reservar(ctx.db, c.emp, { quadraId: c.saibro[2].id, customerId: dani, data: '2026-10-22', hora: '08:00', agora: AGORA });

  const minhas = await executarFerramentaClube(ctx.db, conversa, 'clube_minhas_reservas_quadra', {}, { agora: AGORA });
  assert.equal(minhas.reservas.length, 3);
  // Edu não cancela a reserva da Dani
  const alheia = await executarFerramentaClube(ctx.db, { empresaId: c.emp, customerId: edu }, 'clube_cancelar_reserva_quadra', { reserva_id: r1.reserva_id }, { agora: AGORA });
  assert.equal(alheia.ok, false);
  // a 1 h do jogo: cancela, mas fica marcado como tardio
  const canc = await executarFerramentaClube(ctx.db, conversa, 'clube_cancelar_reserva_quadra', { reserva_id: r1.reserva_id }, { agora: AGORA });
  assert.deepEqual([canc.ok, canc.cancelada, canc.tardio], [true, true, true]);
  // a quadra volta a ficar livre
  const de_novo = await quadras.reservar(ctx.db, c.emp, { quadraId: c.saibro[0].id, customerId: edu, data: DIA, hora: '11:00', agora: AGORA });
  assert.equal(de_novo.quadra, 'Saibro 1');
});

test('IA: quem não é sócio vê horários livres sem nomes; quadra ativa liga as ferramentas do clube', async () => {
  const emp = randomUUID();
  await quadras.salvarConfig(ctx.db, emp, { funcionamento: TODOS_OS_DIAS });
  const ext = extensaoIaClube({ db: ctx.db, integracao: { executarFerramenta: async () => ({ ok: true }), aoReceberMensagem: async () => {} } });
  assert.equal(await ext.ativaPara({ empresaId: emp }), false, 'sem plano, turma ou quadra o clube não aparece na IA');
  await quadras.criarQuadrasEmLote(ctx.db, emp, { quantidade: 2, prefixo: 'Beach', modalidade: 'beach_tennis', piso: 'areia' });
  assert.equal(await ext.ativaPara({ empresaId: emp }), true);
  const amanha = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Cuiaba' });
  const r = await ext.executar({ empresaId: emp, phone: '5565999990000' }, 'clube_quadras_livres', { dia: amanha, modalidade: 'beach tennis' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.horarios[0].quadras, ['Beach 1', 'Beach 2']);
  assert.match(r.observacao, /precisa ser sócia/);
  const ruim = await ext.executar({ empresaId: emp, phone: '5565999990000' }, 'clube_quadras_livres', { dia: 'amanhã' });
  assert.equal(ruim.ok, false);
  // reservar continua exigindo cadastro
  const res = await ext.executar({ empresaId: emp, phone: '5565999990000' }, 'clube_reservar_quadra', { quadra_id: randomUUID(), dia: amanha, hora: '08:00' });
  assert.equal(res.ok, false);
});

test('API da recepção: grade, reserva, cancelamento e isolamento entre empresas', async () => {
  const c = await clubeTtc();
  const fabio = await socio(c, 'Fábio API');
  let empresaAtual = c.emp;
  const app = express();
  montarClube(app, { db: ctx.db, empresaDaRequisicao: async () => empresaAtual, operadorDaRequisicao: () => 'Recepção 2' });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api/admin/clube/quadras`;
  const chamar = (caminho, metodo = 'GET', corpo) => fetch(base + caminho, {
    method: metodo, headers: { 'content-type': 'application/json' }, body: corpo ? JSON.stringify(corpo) : undefined,
  }).then(async (r) => ({ status: r.status, body: await r.json() }));
  try {
    const amanha = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Cuiaba' });
    const cfg = await chamar('/config');
    assert.equal(cfg.body.funcionamento['3'][0].fecha, '23:00');
    const g = await chamar(`/grade?data=${amanha}`);
    assert.equal(g.status, 200);
    assert.equal(g.body.quadras.length, 14);
    const r = await chamar('/reservas', 'POST', { quadraId: c.beach[2].id, customerId: fabio, data: amanha, hora: '07:00', duracaoMin: 90 });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const dono = (await ctx.db.query('SELECT criado_por, origem FROM clube_quadra_reservas WHERE id = $1', [r.body.reservaId])).rows[0];
    assert.deepEqual([dono.criado_por, dono.origem], ['Recepção 2', 'recepcao']);
    const choque = await chamar('/reservas', 'POST', { quadraId: c.beach[2].id, tipo: 'avulso', titulo: 'Outro', data: amanha, hora: '08:00' });
    assert.equal(choque.status, 409);
    assert.match(choque.body.error, /Beach 3 já está reservada das 07:00 às 08:30/);
    const doSocio = await chamar(`/reservas?customerId=${fabio}`);
    assert.equal(doSocio.body.length, 1);
    const lote = await chamar('/cadastro/lote', 'POST', { quantidade: 2, prefixo: 'Padel', modalidade: 'padel' });
    assert.equal(lote.status, 201);
    assert.equal(lote.body.criadas.length, 2);

    // outra empresa não vê nem cancela nada deste clube
    empresaAtual = randomUUID();
    assert.equal((await chamar(`/grade?data=${amanha}`)).body.quadras.length, 0);
    assert.equal((await chamar(`/reservas/${r.body.reservaId}/cancelar`, 'POST', {})).status, 404);
    assert.equal((await chamar('/reservas', 'POST', { quadraId: c.beach[2].id, tipo: 'avulso', titulo: 'Intruso', data: amanha, hora: '12:00' })).status, 404);
    empresaAtual = c.emp;
    const canc = await chamar(`/reservas/${r.body.reservaId}/cancelar`, 'POST', {});
    assert.equal(canc.status, 200);
    assert.equal(canc.body.cancelada, true);
  } finally {
    server.close();
  }
});

test('revisão: lead sem matrícula não reserva pelo WhatsApp, duração fora do passo é recusada, antecedência na IA e horário de verão', async () => {
  const c = await clubeTtc();
  await quadras.salvarConfig(ctx.db, c.emp, { exigeSocioEmDia: false, aberturaDias: 3 });
  // interessado (cadastro sem matrícula) não reserva pela IA, mesmo com "sócio em dia" desligado
  const lead = await criarCliente(ctx.db, c.emp, 'Lead Interessado');
  const r = await executarFerramentaClube(ctx.db, { empresaId: c.emp, customerId: lead }, 'clube_reservar_quadra', { quadra_id: c.saibro[0].id, dia: DIA, hora: '15:00' }, { agora: AGORA });
  assert.equal(r.codigo, 'SEM_MATRICULA');
  // a recepção pode (regra desligada)
  await quadras.reservar(ctx.db, c.emp, { quadraId: c.saibro[0].id, customerId: lead, data: DIA, hora: '15:00', agora: AGORA });
  // duração e passo precisam ser múltiplos de 15
  await assert.rejects(quadras.salvarConfig(ctx.db, c.emp, { duracaoMin: 50 }), /múltiplos de 15/);
  await assert.rejects(quadras.horariosLivres(ctx.db, c.emp, { data: DIA, duracaoMin: 50, agora: AGORA }), /múltipla de 15/);
  // a IA não oferece dia que o sócio ainda não pode reservar
  const longe = await executarFerramentaClube(ctx.db, { empresaId: c.emp, customerId: lead }, 'clube_quadras_livres', { dia: '2026-10-30' }, { agora: AGORA });
  assert.deepEqual(longe.horarios, []);
  assert.match(longe.orientacao, /abrem 3 dia/);
  // a recepção vê a grade de qualquer dia
  assert.ok((await quadras.horariosLivres(ctx.db, c.emp, { data: '2026-10-30', agora: AGORA })).horarios.length > 0);

  // fuso com horário de verão: 01/11/2026 em Nova York já é EST (-5)
  const ny = randomUUID();
  await quadras.salvarConfig(ctx.db, ny, { fuso: 'America/New_York', funcionamento: TODOS_OS_DIAS });
  const [q] = (await quadras.criarQuadrasEmLote(ctx.db, ny, { quantidade: 1, prefixo: 'Court', modalidade: 'tenis' })).criadas;
  const res = await quadras.reservar(ctx.db, ny, { quadraId: q.id, tipo: 'avulso', titulo: 'Guest', data: '2026-11-01', hora: '08:00', agora: AGORA });
  const linha = (await ctx.db.query('SELECT inicio FROM clube_quadra_reservas WHERE id = $1', [res.reservaId])).rows[0];
  assert.equal(new Date(linha.inicio).toISOString(), '2026-11-01T13:00:00.000Z');
  const g = await quadras.grade(ctx.db, ny, { data: '2026-11-01', agora: AGORA });
  assert.deepEqual([g.quadras[0].reservas[0].inicio, g.quadras[0].reservas[0].fim], ['08:00', '09:00']);
  // fechamento à meia-noite
  await quadras.salvarConfig(ctx.db, ny, { funcionamento: { ...TODOS_OS_DIAS, 0: [{ abre: '05:00', fecha: '24:00' }] } });
  const tarde = await quadras.reservar(ctx.db, ny, { quadraId: q.id, tipo: 'avulso', titulo: 'Late', data: '2026-11-01', hora: '23:00', agora: AGORA });
  assert.equal(tarde.fim, '24:00');
  const g2 = await quadras.grade(ctx.db, ny, { data: '2026-11-01', agora: AGORA });
  assert.equal(g2.quadras[0].reservas.at(-1).fim, '24:00');
});

});
