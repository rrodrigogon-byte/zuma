import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'push-equipe-')), 'db.json');

const test = (await import('node:test')).default;
const assert = (await import('node:assert/strict')).default;
const webpush = (await import('web-push')).default;
const { db } = await import('./db.js');
const push = await import('./dino-push-equipe.js');
const barbearia = await import('./barbearia-erp-kytto.js');

const chaves = webpush.generateVAPIDKeys();
process.env.VAPID_PUBLIC_KEY = chaves.publicKey;
process.env.VAPID_PRIVATE_KEY = chaves.privateKey;
process.env.VAPID_SUBJECT = 'mailto:equipe@exemplo.test';
const sub = (n) => ({ endpoint: `https://fcm.googleapis.com/fcm/send/aparelho-${n}`, keys: { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) } });
const unidade = 'unit-fixture';

test('assina, envia só ao profissional do agendamento e à gestão "todos", e remove assinatura expirada', async () => {
  db().pushEquipe = {};
  assert.equal(push.pushConfigurado(), true);
  const p1 = barbearia.criarProfissional('e1', { nome: 'Carlos', email: 'carlos@x.test' }).id;
  barbearia.criarProfissional('e1', { nome: 'Rafa', email: 'rafa@x.test' });
  push.assinar({ empresaId: 'e1', lojaId: unidade, usuario: { id: 1, email: 'carlos@x.test' }, profissionalId: 'p1', assinatura: sub(1) });
  push.assinar({ empresaId: 'e1', lojaId: unidade, usuario: { id: 2, email: 'rafa@x.test' }, profissionalId: 'p2', assinatura: sub(2) });
  push.assinar({ empresaId: 'e1', lojaId: unidade, usuario: { id: 3, email: 'gestor@x.test' }, todos: true, assinatura: sub(3) });
  push.assinar({ empresaId: 'outra', lojaId: unidade, usuario: { id: 4 }, todos: true, assinatura: sub(4) });
  const enviados = [];
  const enviar = async (assinatura, payload) => {
    enviados.push([assinatura.endpoint.slice(-10), JSON.parse(payload)]);
    if (assinatura.endpoint.endsWith('-3')) { const erro = new Error('gone'); erro.statusCode = 410; throw erro; }
  };
  const r = await push.notificarEquipe('e1', { id: 'a1', lojaId: unidade, profissionalId: p1, clienteNome: 'João Silva', dataHora: '2026-10-02T13:00:00.000Z' }, 'criado', { servicoNome: 'Corte', enviar });
  assert.deepEqual(enviados.map(([e]) => e).sort(), ['aparelho-1', 'aparelho-3']);
  assert.equal(r.enviados, 1); assert.equal(r.removidos, 1);
  assert.equal(Object.keys(db().pushEquipe).length, 3);
  assert.equal(enviados[0][1].title, 'Novo agendamento');
});

test('evento "lembrete" não envia nada', async () => {
  let chamadas = 0;
  await push.notificarEquipe('e1', { id: 'a1', lojaId: unidade, profissionalId: 'p1' }, 'lembrete', { enviar: async () => { chamadas += 1; } });
  assert.equal(chamadas, 0);
});

test('cancelar só remove a assinatura do próprio usuário', () => {
  db().pushEquipe = {};
  const contexto = { empresaId: 'e1', lojaId: unidade, usuario: { id: 1 } };
  push.assinar({ ...contexto, profissionalId: 'p1', assinatura: sub(9) });
  assert.equal(push.cancelar({ ...contexto, usuario: { id: 2 }, endpoint: sub(9).endpoint }), false);
  assert.equal(push.situacao({ ...contexto, endpoint: sub(9).endpoint }).assinado, true);
  assert.equal(push.cancelar({ ...contexto, endpoint: sub(9).endpoint }), true);
  assert.equal(push.situacao({ ...contexto, endpoint: sub(9).endpoint }).assinado, false);
});

test('limite de aparelhos por usuário', () => {
  db().pushEquipe = {};
  for (let i = 0; i < 9; i += 1) push.assinar({ empresaId: 'e1', lojaId: unidade, usuario: { id: 7 }, profissionalId: 'p1', assinatura: sub(`l${i}`) });
  assert.equal(Object.values(db().pushEquipe).filter((a) => a.usuarioId === '7').length, 6);
});

test('limite de aparelhos nunca descarta o aparelho que acabou de assinar', () => {
  for (let rodada = 0; rodada < 20; rodada += 1) {
    db().pushEquipe = {};
    for (let i = 0; i < 12; i += 1) {
      const r = push.assinar({ empresaId: 'e1', lojaId: unidade, usuario: { id: 8 }, profissionalId: 'p1', assinatura: sub(`r${rodada}-${i}`) });
      assert.ok(db().pushEquipe[r.id]);
    }
    assert.equal(Object.values(db().pushEquipe).filter((a) => a.usuarioId === '8').length, 6);
  }
});

test('teste de notificação vai só para o aparelho que pediu', async () => {
  db().pushEquipe = {};
  const contexto = { empresaId: 'e1', lojaId: unidade, usuario: { id: 1 } };
  push.assinar({ ...contexto, profissionalId: 'p1', assinatura: sub('t1') });
  push.assinar({ ...contexto, profissionalId: 'p1', assinatura: sub('t2') });
  const alvos = [];
  await push.enviarTeste({ ...contexto, endpoint: sub('t2').endpoint }, { enviar: async (s) => { alvos.push(s.endpoint); } });
  assert.deepEqual(alvos, [sub('t2').endpoint]);
  await assert.rejects(() => push.enviarTeste({ ...contexto, usuario: { id: 2 }, endpoint: sub('t2').endpoint }, { enviar: async () => {} }), /Ative/);
});

test('vínculo conferido no envio: e-mail trocado no cadastro deixa de receber', async () => {
  db().pushEquipe = {};
  const prof = barbearia.criarProfissional('e2', { nome: 'Davi', email: 'davi@x.test' });
  push.assinar({ empresaId: 'e2', lojaId: unidade, usuario: { id: 11, email: 'davi@x.test' }, profissionalId: prof.id, assinatura: sub('v1') });
  let enviados = 0;
  const enviar = async () => { enviados += 1; };
  await push.notificarEquipe('e2', { id: 'x1', lojaId: unidade, profissionalId: prof.id }, 'criado', { enviar });
  assert.equal(enviados, 1);
  barbearia.atualizarProfissional('e2', prof.id, { email: 'outro@x.test' });
  await push.notificarEquipe('e2', { id: 'x2', lojaId: unidade, profissionalId: prof.id }, 'criado', { enviar });
  assert.equal(enviados, 1);
});

test('link do aviso usa payload genérico sem URL externa', () => {
  db().barbearias.e2.configuracao = { ...(db().barbearias.e2.configuracao || {}), slugPublico: 'navalha' };
  assert.deepEqual(push.montarMensagem({ id: 'a', dataAgenda: '2026-10-02' }, 'criado', '', 'navalha'), { title: 'Novo agendamento', body: 'Abra o app Dino Equipe para conferir a agenda.' });
});

test('duas unidades e dois tenants: evento nunca alcança outra unidade nem assinatura legada sem lojaId', async () => {
  db().pushEquipe = {}; db().pushEquipeEnvios = {};
  const a = push.assinar({ empresaId: 'unit-scope', lojaId: 'a', usuario: { id: 101 }, todos: true, assinatura: sub('scope-a') });
  push.assinar({ empresaId: 'unit-scope', lojaId: 'b', usuario: { id: 102 }, todos: true, assinatura: sub('scope-b') });
  push.assinar({ empresaId: 'other-scope', lojaId: 'a', usuario: { id: 103 }, todos: true, assinatura: sub('scope-other') });
  db().pushEquipe.legacy = { ...db().pushEquipe[a.id], id: 'legacy', lojaId: undefined, assinatura: sub('legacy') };
  const endpoints = [];
  const r = await push.notificarEquipe('unit-scope', { id: 'event-unit-a', lojaId: 'a' }, 'criado', { enviar: async s => endpoints.push(s.endpoint) });
  assert.equal(r.enviados, 1);
  assert.deepEqual(endpoints, [sub('scope-a').endpoint]);
  assert.ok(db().pushEquipe.legacy, 'registro legado fica inelegível, sem exclusão automática');
});

test('evento sem unidade ou com empresa divergente falha fechado e não persiste envios', async () => {
  db().pushEquipeEnvios = {};
  const before = JSON.stringify(db()); let chamadas = 0;
  for (const agendamento of [{ id: 'no-unit' }, { id: 'blank-unit', lojaId: '  ' }, { id: 'wrong-company', lojaId: 'a', empresaId: 'other-scope' }]) {
    const r = await push.notificarEquipe('unit-scope', agendamento, 'criado', { enviar: async () => { chamadas += 1; } });
    assert.equal(r.enviados, 0); assert.equal(r.motivo, 'PUSH_ESCOPO_INCOMPLETO');
  }
  assert.equal(chamadas, 0); assert.equal(JSON.stringify(db()), before);
});

test('assinatura sem empresa, unidade ou ator é bloqueada antes da persistência', () => {
  const before = JSON.stringify(db());
  const valid = { empresaId: 'scope', lojaId: 'a', usuario: { id: 201 }, assinatura: sub('invalid-scope') };
  for (const values of [{ empresaId: '' }, { lojaId: '' }, { lojaId: ' ' }, { usuario: {} }]) {
    assert.throws(() => push.assinar({ ...valid, ...values }), e => e.code === 'PUSH_ESCOPO_INCOMPLETO' && e.status === 403);
  }
  assert.equal(JSON.stringify(db()), before);
});

test('cancelamento, situação e teste não reutilizam assinatura de outra unidade/conta', async () => {
  db().pushEquipe = {};
  const original = { empresaId: 'endpoint-scope', lojaId: 'a', usuario: { id: 301 } };
  push.assinar({ ...original, todos: true, assinatura: sub('shared-endpoint') });
  const before = JSON.stringify(db()); let chamadas = 0;
  for (const values of [{ lojaId: '' }, { lojaId: 'b' }, { usuario: { id: 302 } }, { empresaId: 'other-company' }]) {
    const request = { ...original, ...values, endpoint: sub('shared-endpoint').endpoint };
    assert.equal(push.situacao(request).assinado, false); assert.equal(push.cancelar(request), false);
    await assert.rejects(() => push.enviarTeste(request, { enviar: async () => { chamadas += 1; } }), e => ['PUSH_NAO_ASSINADO', 'PUSH_ESCOPO_INCOMPLETO'].includes(e.code));
  }
  assert.equal(chamadas, 0); assert.equal(JSON.stringify(db()), before);
});
