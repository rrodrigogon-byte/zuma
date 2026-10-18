import test from 'node:test';
import assert from 'node:assert/strict';
import * as cid from '../modules/acesso/controlid.js';

const AGORA = new Date('2026-10-21T22:30:00Z');
const dispositivo = {
  id: 'disp-1',
  empresaId: 'emp-1',
  unidadeId: 'u1',
  fuso: 'America/Cuiaba',
  modelo: 'catraca',
  sentidoEntrada: 'clockwise',
};

function deps(contexto, extra = {}) {
  const eventos = [];
  const acoes = [];
  return {
    eventos,
    acoes,
    agora: () => AGORA,
    buscarDispositivo: async (id) => (id === '1001' ? dispositivo : null),
    carregarContexto: async () => contexto,
    registrarEvento: async (e) => eventos.push(e),
    dispararAcao: async (a) => acoes.push(a),
    ...extra,
  };
}

const emDia = {
  pessoa: { id: 'p1', nome: 'Ana Souza' },
  matricula: { pagoAte: new Date('2026-11-01T00:00:00Z'), plano: {} },
  contrato: { status: 'aceito' },
  acessosRecentes: [],
  reservas: [],
};

const corpo = (extra = {}) => ({ device_id: '1001', user_id: '42', event: '7', portal_id: '1', uuid: 'abc', time: '1792708200', ...extra });

const flush = () => new Promise((r) => setImmediate(r));

test('libera a catraca no sentido de entrada com a mensagem do motor', async () => {
  const d = deps(emDia);
  const r = await cid.tratarIdentificacao(corpo(), d);
  assert.equal(r.result.event, 7);
  assert.deepEqual(r.result.actions, [{ action: 'catra', parameters: 'allow=clockwise' }]);
  assert.equal(r.result.message, 'Bom treino, Ana!');
  assert.equal(r.result.user_id, 42);
  assert.equal(d.eventos.length, 1);
  assert.equal(d.eventos[0].decisao, 'liberado');
});

test('nega inadimplente e dispara link de pagamento fora do caminho crítico', async () => {
  const d = deps({ ...emDia, matricula: { pagoAte: new Date('2026-10-01T00:00:00Z'), plano: {} } });
  const r = await cid.tratarIdentificacao(corpo(), d);
  assert.equal(r.result.event, 6);
  assert.deepEqual(r.result.actions, []);
  assert.equal(r.result.message, 'Mensalidade em aberto');
  await flush();
  assert.equal(d.acoes[0].acao, 'enviar_link_pagamento');
  assert.equal(d.acoes[0].pessoaId, 'p1');
});

test('equipamento não pareado recebe evento 1', async () => {
  const r = await cid.tratarIdentificacao(corpo({ device_id: '9999' }), deps(emDia));
  assert.equal(r.result.event, cid.EVENTO.EQUIPAMENTO_INVALIDO);
});

test('sem device_id recebe evento 2', async () => {
  const r = await cid.tratarIdentificacao({ user_id: '1' }, deps(emDia));
  assert.equal(r.result.event, cid.EVENTO.PARAMETROS_INVALIDOS);
});

test('pessoa não identificada pelo aparelho', async () => {
  const d = deps(emDia);
  const r = await cid.tratarIdentificacao(corpo({ user_id: '0', event: '3' }), d);
  assert.equal(r.result.event, cid.EVENTO.NAO_IDENTIFICADO);
  assert.equal(d.eventos[0].codigo, 'nao_identificado');
});

test('falha ao gravar evento não impede a liberação', async () => {
  const d = deps(emDia, { registrarEvento: async () => { throw new Error('db fora'); } });
  const r = await cid.tratarIdentificacao(corpo(), d);
  assert.equal(r.result.event, 7);
});

test('falha no disparo do WhatsApp não afeta a resposta', async () => {
  const d = deps({ ...emDia, pessoa: { id: 'p1', nome: 'Ana', bloqueada: true } }, {
    dispararAcao: async () => { throw new Error('whatsapp fora'); },
  });
  const r = await cid.tratarIdentificacao(corpo(), d);
  assert.equal(r.result.event, 6);
  await flush();
});

test('porta usa ação door em vez de catra', async () => {
  const d = deps(emDia, { buscarDispositivo: async () => ({ ...dispositivo, modelo: 'porta' }) });
  const r = await cid.tratarIdentificacao(corpo(), d);
  assert.deepEqual(r.result.actions, [{ action: 'door', parameters: 'door=1' }]);
});

test('mensagem longa é cortada sem quebrar palavra', () => {
  const m = cid.mensagemVisor('Seu plano libera das 06h às 12h e das 18h às 22h de segunda a sexta-feira');
  assert.ok(m.length <= 48);
  assert.ok(m.endsWith('…'));
});

test('push: vazio, comando único e lote', () => {
  assert.equal(cid.montarRespostaPush([]), null);
  const up = cid.comandoUpsertUsuario({
    userIdEquipamento: 42,
    nome: 'Ana Souza',
    matricula: { pagoAte: new Date('2026-11-01T00:00:00Z'), plano: {} },
  });
  const unico = cid.montarRespostaPush([up]);
  assert.equal(unico.endpoint, 'create_or_modify_objects');
  assert.equal(unico.body.values[0].end_time, Math.floor(Date.parse('2026-11-06T00:00:00Z') / 1000));

  const lote = cid.montarRespostaPush([up, cid.comandoRemoverUsuario({ userIdEquipamento: 7 })]);
  assert.equal(lote.transactions.length, 2);
  assert.equal(lote.transactions[1].transactionid, '2');
  assert.equal(lote.transactions[1].endpoint, 'destroy_objects');
});

test('push: lê resultado simples e em lote', () => {
  assert.deepEqual(cid.lerResultadoPush({ response: {} })[0].sucesso, true);
  assert.equal(cid.lerResultadoPush({ error: 'x' })[0].sucesso, false);
  const lote = cid.lerResultadoPush({
    transactions_results: [
      { transactionid: 1, success: true, response: '{}' },
      { transactionid: 2, success: false, response: 'erro' },
    ],
  });
  assert.deepEqual(lote.map((r) => r.sucesso), [true, false]);
});
