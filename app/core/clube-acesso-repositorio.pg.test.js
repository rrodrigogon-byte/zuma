import { describe, it as test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pgDeTeste, criarBancoTeste, criarCliente } from './fixtures/clube-pg.js';
import * as repo from '../modules/acesso/repositorio.js';
import { decidirAcesso } from '../modules/acesso/regras.js';

describe('clube-acesso-repositorio (PostgreSQL)', { skip: pgDeTeste }, () => {

const EMPRESA = randomUUID();
const OUTRA = randomUUID();
let ctx;

before(async () => { ctx = await criarBancoTeste(['073_clube_acesso_controle.sql', '076_clube_retencao.sql', '077_clube_parceiros.sql', '078_clube_cobrancas.sql']); });
after(async () => { await ctx.fechar(); });

async function cenario() {
  const { db } = ctx;
  const plano = await repo.salvarPlano(db, EMPRESA, { nome: `Livre ${randomUUID().slice(0, 6)}` });
  const { dispositivo, segredo } = await repo.criarDispositivo(db, EMPRESA, { nome: 'Catraca 1' });
  const customerId = await criarCliente(db, EMPRESA, 'Ana Souza');
  const matricula = await repo.criarMatricula(db, EMPRESA, { customerId, planoId: plano.id, pagoAte: '2026-11-01' });
  return { plano, dispositivo, segredo, customerId, matricula };
}

test('dispositivo: segredo só aparece na criação e autentica pelo hash', async () => {
  const { db } = ctx;
  const { dispositivo, segredo } = await repo.criarDispositivo(db, EMPRESA, { nome: 'Recepção' });
  assert.equal(dispositivo.status, 'aguardando');
  assert.ok(segredo.length >= 30);
  const lista = await repo.listarDispositivos(db, EMPRESA);
  assert.ok(!JSON.stringify(lista).includes(segredo), 'segredo não pode vazar na listagem');

  const a = await repo.autenticarDispositivo(db, segredo, '7777');
  assert.equal(a.id, dispositivo.id);
  assert.equal(a.deviceIdExterno, '7777');
  assert.equal(await repo.autenticarDispositivo(db, segredo, '8888'), null, 'device_id diferente com o mesmo segredo é recusado');
  assert.equal(await repo.autenticarDispositivo(db, 'segredo-errado-com-mais-de-20', '7777'), null);
  const depois = (await repo.listarDispositivos(db, EMPRESA)).find((d) => d.id === dispositivo.id);
  assert.equal(depois.status, 'online');
});

test('dispositivo: validações e isolamento entre empresas', async () => {
  const { db } = ctx;
  await assert.rejects(repo.criarDispositivo(db, EMPRESA, { nome: '' }), { code: 'VALIDATION_ERROR' });
  await assert.rejects(repo.criarDispositivo(db, EMPRESA, { nome: 'X', fuso: 'Marte/Base' }), { code: 'VALIDATION_ERROR' });
  const { dispositivo } = await repo.criarDispositivo(db, EMPRESA, { nome: 'Porta' });
  await assert.rejects(repo.atualizarDispositivo(db, OUTRA, dispositivo.id, { nome: 'invasão' }), { code: 'NOT_FOUND' });
});

test('matrícula: cria vínculo no aparelho e enfileira o cadastro com validade offline', async () => {
  const { db } = ctx;
  const { dispositivo, customerId } = await cenario();
  const fila = await repo.reservarComandos(db, dispositivo.id, 'push-1');
  const meu = fila.find((f) => f.comando.body?.values?.[0]?.name === 'Ana Souza');
  assert.ok(meu, 'comando de cadastro da Ana na fila');
  const v = meu.comando.body.values[0];
  // pago até 01/11 23:59:59 em Cuiabá + 5 dias de tolerância + 1 = 07/11 03:59:59Z
  assert.equal(v.end_time, Math.floor(Date.parse('2026-11-07T03:59:59Z') / 1000));
  const pe = await db.query('SELECT user_id_equipamento FROM acesso_pessoas_equipamento WHERE customer_id = $1', [customerId]);
  assert.equal(Number(pe.rows[0].user_id_equipamento), v.id);
});

test('matrícula: não permite duas ativas nem cliente de outra empresa', async () => {
  const { db } = ctx;
  const { plano, customerId } = await cenario();
  await assert.rejects(repo.criarMatricula(db, EMPRESA, { customerId, planoId: plano.id, pagoAte: '2026-12-01' }), { code: 'MATRICULA_ATIVA' });
  const deOutra = await criarCliente(db, OUTRA, 'Intruso');
  await assert.rejects(repo.criarMatricula(db, EMPRESA, { customerId: deOutra, planoId: plano.id, pagoAte: '2026-12-01' }), { code: 'NOT_FOUND' });
  await assert.rejects(repo.criarMatricula(db, EMPRESA, { customerId, planoId: plano.id, pagoAte: '01/12/2026' }), { code: 'VALIDATION_ERROR' });
});

test('pagamento estende (nunca reduz) e substitui o comando pendente da mesma pessoa', async () => {
  const { db } = ctx;
  const { dispositivo, matricula } = await cenario();
  await repo.reservarComandos(db, dispositivo.id, 'limpa');
  const pago = await repo.registrarPagamento(db, EMPRESA, matricula.id, '2026-12-01');
  assert.equal(pago.pagoAte, '2026-12-01');
  const menor = await repo.registrarPagamento(db, EMPRESA, matricula.id, '2026-11-15');
  assert.equal(menor.pagoAte, '2026-12-01', 'data menor não reduz o pago até');
  const pendentes = await db.query("SELECT COUNT(*)::int AS n FROM acesso_fila_push WHERE dispositivo_id = $1 AND status = 'pendente'", [dispositivo.id]);
  assert.equal(pendentes.rows[0].n, 1, 'dois pagamentos seguidos viram um só comando pendente');
});

test('bloqueio e cancelamento removem a pessoa do aparelho', async () => {
  const { db } = ctx;
  const { dispositivo, matricula } = await cenario();
  await repo.reservarComandos(db, dispositivo.id, 'limpa');
  await assert.rejects(repo.definirBloqueio(db, EMPRESA, matricula.id, true, ''), { code: 'VALIDATION_ERROR' });
  await repo.definirBloqueio(db, EMPRESA, matricula.id, true, 'Comportamento');
  const [cmd] = await repo.reservarComandos(db, dispositivo.id, 'p2');
  assert.equal(cmd.comando.endpoint, 'destroy_objects');
  await repo.definirBloqueio(db, EMPRESA, matricula.id, false);
  await repo.alterarStatusMatricula(db, EMPRESA, matricula.id, 'cancelada');
  const [cmd2] = await repo.reservarComandos(db, dispositivo.id, 'p3');
  assert.equal(cmd2.comando.endpoint, 'destroy_objects');
});

test('contexto do motor vem do banco e o motor decide corretamente', async () => {
  const { db } = ctx;
  const { customerId } = await cenario();
  const pe = await db.query('SELECT user_id_equipamento FROM acesso_pessoas_equipamento WHERE customer_id = $1', [customerId]);
  const userId = Number(pe.rows[0].user_id_equipamento);
  const agora = new Date('2026-10-21T22:30:00Z');
  const contexto = await repo.carregarContexto(db, { empresaId: EMPRESA, userIdEquipamento: userId, agora });
  assert.equal(contexto.pessoa.nome, 'Ana Souza');
  assert.equal(decidirAcesso({ ...contexto, agora, unidadeId: null }).liberado, true);

  // outra empresa não enxerga a pessoa
  assert.equal(await repo.carregarContexto(db, { empresaId: OUTRA, userIdEquipamento: userId, agora }), null);

  // vencida há 10 dias
  const depois = new Date('2026-11-11T15:00:00Z');
  const c2 = await repo.carregarContexto(db, { empresaId: EMPRESA, userIdEquipamento: userId, agora: depois });
  assert.equal(decidirAcesso({ ...c2, agora: depois, unidadeId: null }).codigo, 'inadimplente');
});

test('eventos: idempotentes pelo uuid do aparelho e alimentam o limite de acessos', async () => {
  const { db } = ctx;
  const { dispositivo, customerId } = await cenario();
  const e = { empresaId: EMPRESA, dispositivoId: dispositivo.id, customerId, decisao: 'liberado', codigo: 'liberado', origem: 'online', uuid: 'u-1', em: new Date('2026-10-21T11:00:00Z') };
  await repo.registrarEvento(db, e);
  await repo.registrarEvento(db, e);
  const n = await db.query('SELECT COUNT(*)::int AS n FROM acesso_eventos WHERE customer_id = $1', [customerId]);
  assert.equal(n.rows[0].n, 1);
  const pe = await db.query('SELECT user_id_equipamento FROM acesso_pessoas_equipamento WHERE customer_id = $1', [customerId]);
  const c = await repo.carregarContexto(db, { empresaId: EMPRESA, userIdEquipamento: Number(pe.rows[0].user_id_equipamento), agora: new Date('2026-10-21T22:30:00Z') });
  assert.equal(c.acessosRecentes.length, 1);
  const lista = await repo.listarEventos(db, EMPRESA, { limite: 5 });
  assert.ok(lista.some((x) => x.nome === 'Ana Souza'));
});

test('liberação manual exige operador e motivo, registra auditoria e enfileira abertura', async () => {
  const { db } = ctx;
  const { dispositivo, customerId } = await cenario();
  await assert.rejects(repo.liberarManual(db, EMPRESA, dispositivo.id, { operadorId: 'rec-1', motivo: '' }), { code: 'VALIDATION_ERROR' });
  await repo.liberarManual(db, EMPRESA, dispositivo.id, { customerId, operadorId: 'rec-1', motivo: 'Aluno esqueceu o celular' });
  const ev = await db.query("SELECT * FROM acesso_eventos WHERE dispositivo_id = $1 AND origem = 'manual'", [dispositivo.id]);
  assert.equal(ev.rows[0].motivo_manual, 'Aluno esqueceu o celular');
  const fila = await repo.reservarComandos(db, dispositivo.id, 'p-man');
  assert.ok(fila.some((f) => f.comando.endpoint === 'execute_actions'));
});

test('fila Push: resultado em lote, falha volta para a fila, sem resposta reenvia', async () => {
  const { db } = ctx;
  const { dispositivo } = await cenario();
  await repo.reservarComandos(db, dispositivo.id, 'limpa');
  await repo.enfileirarComando(db, { empresaId: EMPRESA, dispositivoId: dispositivo.id, chave: 'a', comando: { endpoint: 'x' } });
  await repo.enfileirarComando(db, { empresaId: EMPRESA, dispositivoId: dispositivo.id, chave: 'b', comando: { endpoint: 'y' } });
  const lote = await repo.reservarComandos(db, dispositivo.id, 'lote-1');
  assert.equal(lote.length, 2);
  const ok = await repo.concluirComandos(db, dispositivo.id, 'lote-1', [
    { transactionid: 1, sucesso: true },
    { transactionid: 2, sucesso: false, resposta: 'falhou' },
  ]);
  assert.equal(ok, 1);
  const denovo = await repo.reservarComandos(db, dispositivo.id, 'lote-2');
  assert.deepEqual(denovo.map((x) => x.comando.endpoint), ['y'], 'só o que falhou volta');

  // sem resposta: simula envio antigo
  await db.query("UPDATE acesso_fila_push SET enviado_em = CURRENT_TIMESTAMP - interval '5 minutes' WHERE push_uuid = 'lote-2'");
  const reenvio = await repo.reservarComandos(db, dispositivo.id, 'lote-3');
  assert.deepEqual(reenvio.map((x) => x.comando.endpoint), ['y']);
  const resumo = await repo.resumoFila(db, EMPRESA, dispositivo.id);
  assert.ok(resumo.ok >= 1);
});

test('sincronização completa reenvia todos os ativos para um aparelho novo', async () => {
  const { db } = ctx;
  await cenario();
  const { dispositivo } = await repo.criarDispositivo(db, EMPRESA, { nome: 'Catraca nova' });
  const n = await repo.sincronizarDispositivoCompleto(db, EMPRESA, dispositivo.id);
  const ativos = await db.query("SELECT COUNT(*)::int AS n FROM acesso_matriculas WHERE empresa_id = $1 AND status = 'ativa' AND NOT bloqueada", [EMPRESA]);
  assert.equal(n, ativos.rows[0].n);
  const fila = await repo.reservarComandos(db, dispositivo.id, 'novo', 500);
  assert.equal(fila.length, n);
});

test('plano: horários e limites validados', async () => {
  const { db } = ctx;
  await assert.rejects(repo.salvarPlano(db, EMPRESA, { nome: 'Manhã', horarios: { 1: [{ inicio: '6h', fim: '12:00' }] } }), { code: 'VALIDATION_ERROR' });
  await assert.rejects(repo.salvarPlano(db, EMPRESA, { nome: 'Manhã', horarios: { 9: [] } }), { code: 'VALIDATION_ERROR' });
  const p = await repo.salvarPlano(db, EMPRESA, { nome: 'Manhã', horarios: { 1: [{ inicio: '06:00', fim: '12:00' }] }, limitePorDia: 1 });
  assert.equal(p.limitePorDia, 1);
  const editado = await repo.salvarPlano(db, EMPRESA, { nome: 'Manhã', limitePorDia: 2 }, p.id);
  assert.equal(editado.limitePorDia, 2);
  assert.equal(editado.horarios, null);
});
});
