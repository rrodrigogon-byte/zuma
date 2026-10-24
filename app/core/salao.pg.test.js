import { describe, it as test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pgDeTeste, criarBancoTeste } from './fixtures/clube-pg.js';
import * as salao from '../modules/salao/servico.js';
import * as bar from '../modules/bar/servico.js';

const sql = (arquivo) => readFileSync(new URL(`../migrations/${arquivo}`, import.meta.url), 'utf8');

describe('Reservas de mesa e fila de espera (PostgreSQL)', { skip: pgDeTeste }, () => {
  let ctx; let mesa5;
  const A = randomUUID(); const B = randomUUID();
  const agora = new Date('2026-10-22T15:00:00-04:00');
  before(async () => {
    ctx = await criarBancoTeste();
    await ctx.db.query('CREATE TABLE empresas (id UUID PRIMARY KEY); CREATE TABLE lojas (id UUID PRIMARY KEY, empresa_id UUID NOT NULL);');
    for (const m of ['081_bar_pdv_multiempresa.sql', '094_salao_reservas.sql']) await ctx.db.query(sql(m));
    await ctx.db.query('INSERT INTO empresas (id) VALUES ($1), ($2)', [A, B]);
    mesa5 = await bar.salvarMesa(ctx.db, A, { numero: 5, nome: 'Varanda' });
  });
  after(async () => { await ctx?.fechar(); });

  test('horário local do fuso, mesa sem sobreposição e idempotência', async () => {
    assert.equal(salao.instanteLocal('2026-10-22T19:00').toISOString(), '2026-10-22T23:00:00.000Z');
    const r = await salao.criarReserva(ctx.db, A, { clienteNome: 'Ana Lima', telefone: '65999990000', pessoas: 4, mesaNum: 5, inicioEm: '2026-10-22T19:00', duracaoMinutos: 120, idempotencia: 'r-1' }, { agora });
    assert.equal(r.mesaNum, 5);
    assert.equal((await salao.criarReserva(ctx.db, A, { clienteNome: 'Ana Lima', pessoas: 4, mesaNum: 5, inicioEm: '2026-10-22T19:00', idempotencia: 'r-1' }, { agora })).id, r.id);
    await assert.rejects(() => salao.criarReserva(ctx.db, A, { clienteNome: 'Bia', pessoas: 2, mesaNum: 5, inicioEm: '2026-10-22T20:30' }, { agora }), (e) => e.code === 'MESA_RESERVADA');
    const depois = await salao.criarReserva(ctx.db, A, { clienteNome: 'Bia', pessoas: 2, mesaNum: 5, inicioEm: '2026-10-22T21:00' }, { agora });
    assert.ok(depois.id);
    await assert.rejects(() => salao.criarReserva(ctx.db, B, { clienteNome: 'X', pessoas: 2, mesaNum: 5, inicioEm: '2026-10-22T21:00' }, { agora }), (e) => e.status === 404);
    await assert.rejects(() => salao.criarReserva(ctx.db, A, { clienteNome: 'Velha', pessoas: 2, inicioEm: '2026-10-21T19:00' }, { agora }), (e) => e.code === 'VALIDATION_ERROR');
    const lista = await salao.listarReservas(ctx.db, A, { de: '2026-10-22' });
    assert.equal(lista.length, 2);
    assert.equal((await salao.listarReservas(ctx.db, B, { de: '2026-10-22' })).length, 0);
  });

  test('chegou → acomodar abre a comanda da mesa; no-show só depois do horário; visão do dia', async () => {
    const [r] = await salao.listarReservas(ctx.db, A, { de: '2026-10-22' });
    await assert.rejects(() => salao.mudarStatusReserva(ctx.db, A, r.id, 'no_show', { agora }), (e) => e.code === 'INVALID_STATUS');
    await assert.rejects(() => salao.mudarStatusReserva(ctx.db, A, r.id, 'cumprida', { agora }), (e) => e.code === 'INVALID_STATUS');
    await salao.mudarStatusReserva(ctx.db, A, r.id, 'chegou');
    const sentada = await salao.mudarStatusReserva(ctx.db, A, r.id, 'em_atendimento', { usuario: 'garcom' });
    assert.ok(sentada.comandaId);
    const mesas = await bar.listarMesas(ctx.db, A);
    assert.equal(mesas.fisicas.find((m) => m.id === mesa5.id).comandaId, sentada.comandaId);
    const v = await salao.visaoDoDia(ctx.db, A, { data: '2026-10-22' });
    assert.equal(v.ocupacao.totalReservas, 2);
    assert.equal(v.ocupacao.pessoasPrevistas, 6);
  });

  test('fila: senha sequencial por dia, chamar para mesa e sentar reaproveita a comanda', async () => {
    const s1 = await salao.entrarNaFila(ctx.db, A, { clienteNome: 'Carlos Souza', telefone: '65988887777', pessoas: 3, previsaoMinutos: 20 }, { agora });
    const s2 = await salao.entrarNaFila(ctx.db, A, { clienteNome: 'Duda', pessoas: 2 }, { agora });
    assert.deepEqual([s1.senha, s2.senha], [1, 2]);
    await assert.rejects(() => salao.finalizar(ctx.db, A, s1.id, 'atendido'), (e) => e.code === 'INVALID_STATUS');
    // mesa 5 tem a comanda da reserva da Ana aberta: ocupada
    await assert.rejects(() => salao.chamar(ctx.db, A, s1.id, { mesaNum: 5, agora }), (e) => e.code === 'MESA_OCUPADA');
    // mesa 7 tem reserva às 16h (daqui a 1 h): não vai para a fila
    await bar.salvarMesa(ctx.db, A, { numero: 7, nome: 'Salão' });
    await salao.criarReserva(ctx.db, A, { clienteNome: 'Gil', pessoas: 2, mesaNum: 7, inicioEm: '2026-10-22T16:00' }, { agora });
    await assert.rejects(() => salao.chamar(ctx.db, A, s1.id, { mesaNum: 7, agora }), (e) => e.code === 'MESA_RESERVADA');
    await bar.salvarMesa(ctx.db, A, { numero: 6, nome: 'Janela' });
    const ch = await salao.chamar(ctx.db, A, s1.id, { mesaNum: 6, agora });
    assert.match(ch.mensagem, /Carlos, sua mesa 6 está pronta/);
    // a mesma mesa não é chamada para duas senhas
    await assert.rejects(() => salao.chamar(ctx.db, A, s2.id, { mesaNum: 6, agora }), (e) => e.code === 'MESA_OCUPADA');
    assert.match(ch.notificacao, /65988887777/);
    const fim = await salao.finalizar(ctx.db, A, s1.id, 'atendido', { usuario: 'garcom' });
    assert.ok(fim.comandaId);
    await salao.finalizar(ctx.db, A, s2.id, 'cancelado');
    assert.deepEqual((await salao.listarFila(ctx.db, A, { agora })).map((f) => f.senha), []);
    assert.equal((await salao.listarFila(ctx.db, A, { agora, todas: true })).length, 2);
    // quem entrou às 23h40 e ainda espera aparece depois da meia-noite
    const tarde = await salao.entrarNaFila(ctx.db, A, { clienteNome: 'Noturno', pessoas: 2 }, { agora: new Date('2026-10-22T23:40:00-04:00') });
    await ctx.db.query("UPDATE sal_fila SET criado_em = '2026-10-22T23:40:00-04:00' WHERE id = $1", [tarde.id]);
    assert.ok((await salao.listarFila(ctx.db, A, { agora: new Date('2026-10-23T00:30:00-04:00') })).some((f) => f.id === tarde.id));
    const amanha = await salao.entrarNaFila(ctx.db, A, { clienteNome: 'Eva', pessoas: 1 }, { agora: new Date('2026-10-23T12:00:00-04:00') });
    assert.equal(amanha.senha, 1);
  });

  test('isolamento por unidade: usuário de unidade não vê nem mexe em registro sem unidade ou de outra', async () => {
    const L1 = randomUUID(); const L2 = randomUUID();
    const daL1 = await salao.criarReserva(ctx.db, A, { clienteNome: 'Unidade 1', pessoas: 2, inicioEm: '2026-10-23T19:00' }, { agora, lojaId: L1 });
    await salao.criarReserva(ctx.db, A, { clienteNome: 'Sem unidade', pessoas: 2, inicioEm: '2026-10-23T19:00' }, { agora });
    const vistas = await salao.listarReservas(ctx.db, A, { de: '2026-10-23', lojaId: L1 });
    assert.deepEqual(vistas.map((r) => r.clienteNome), ['Unidade 1']);
    await assert.rejects(() => salao.mudarStatusReserva(ctx.db, A, daL1.id, 'cancelada', { lojaRestrita: L2 }), (e) => e.status === 404);
    const semUnidade = (await salao.listarReservas(ctx.db, A, { de: '2026-10-23' })).find((r) => r.clienteNome === 'Sem unidade');
    await assert.rejects(() => salao.mudarStatusReserva(ctx.db, A, semUnidade.id, 'cancelada', { lojaRestrita: L1 }), (e) => e.status === 404);
  });
});
