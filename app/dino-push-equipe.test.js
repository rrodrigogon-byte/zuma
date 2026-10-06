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

test('assina, envia só ao profissional do agendamento e à gestão "todos", e remove assinatura expirada', async () => {
  db().pushEquipe = {};
  assert.equal(push.pushConfigurado(), true);
  const p1 = barbearia.criarProfissional('e1', { nome: 'Carlos', email: 'carlos@x.test' }).id;
  barbearia.criarProfissional('e1', { nome: 'Rafa', email: 'rafa@x.test' });
  push.assinar({ empresaId: 'e1', usuario: { id: 1, email: 'carlos@x.test' }, profissionalId: 'p1', assinatura: sub(1) });
  push.assinar({ empresaId: 'e1', usuario: { id: 2, email: 'rafa@x.test' }, profissionalId: 'p2', assinatura: sub(2) });
  push.assinar({ empresaId: 'e1', usuario: { id: 3, email: 'gestor@x.test' }, todos: true, assinatura: sub(3) });
  push.assinar({ empresaId: 'outra', usuario: { id: 4 }, todos: true, assinatura: sub(4) });
  const enviados = [];
  const enviar = async (assinatura, payload) => {
    enviados.push([assinatura.endpoint.slice(-10), JSON.parse(payload)]);
    if (assinatura.endpoint.endsWith('-3')) { const erro = new Error('gone'); erro.statusCode = 410; throw erro; }
  };
  const r = await push.notificarEquipe('e1', { id: 'a1', profissionalId: p1, clienteNome: 'João Silva', dataHora: '2026-10-02T13:00:00.000Z' }, 'criado', { servicoNome: 'Corte', enviar });
  assert.deepEqual(enviados.map(([e]) => e).sort(), ['aparelho-1', 'aparelho-3']);
  assert.equal(r.enviados, 1);
  assert.equal(r.removidos, 1);
  assert.equal(Object.keys(db().pushEquipe).length, 3, 'assinatura expirada removida');
  assert.equal(enviados[0][1].titulo, 'Novo agendamento');
});

test('evento "lembrete" ou sem push configurado não envia nada', async () => {
  let chamadas = 0;
  const enviar = async () => { chamadas += 1; };
  await push.notificarEquipe('e1', { id: 'a1', profissionalId: 'p1' }, 'lembrete', { enviar });
  assert.equal(chamadas, 0);
});

test('cancelar só remove a assinatura do próprio usuário', () => {
  db().pushEquipe = {};
  push.assinar({ empresaId: 'e1', usuario: { id: 1 }, profissionalId: 'p1', assinatura: sub(9) });
  assert.equal(push.cancelar({ empresaId: 'e1', usuario: { id: 2 }, endpoint: sub(9).endpoint }), false);
  assert.equal(push.situacao({ empresaId: 'e1', usuario: { id: 1 }, endpoint: sub(9).endpoint }).assinado, true);
  assert.equal(push.cancelar({ empresaId: 'e1', usuario: { id: 1 }, endpoint: sub(9).endpoint }), true);
  assert.equal(push.situacao({ empresaId: 'e1', usuario: { id: 1 }, endpoint: sub(9).endpoint }).assinado, false);
});

test('limite de aparelhos por usuário', () => {
  db().pushEquipe = {};
  for (let i = 0; i < 9; i += 1) push.assinar({ empresaId: 'e1', usuario: { id: 7 }, profissionalId: 'p1', assinatura: sub(`l${i}`) });
  assert.equal(Object.values(db().pushEquipe).filter((a) => a.usuarioId === '7').length, 6);
});

test('limite de aparelhos nunca descarta o aparelho que acabou de assinar', () => {
  for (let rodada = 0; rodada < 20; rodada += 1) {
    db().pushEquipe = {};
    for (let i = 0; i < 12; i += 1) {
      const r = push.assinar({ empresaId: 'e1', usuario: { id: 8 }, profissionalId: 'p1', assinatura: sub(`r${rodada}-${i}`) });
      assert.ok(db().pushEquipe[r.id], 'aparelho recém-assinado deve permanecer');
    }
    assert.equal(Object.values(db().pushEquipe).filter((a) => a.usuarioId === '8').length, 6);
  }
});

test('teste de notificação vai só para o aparelho que pediu', async () => {
  db().pushEquipe = {};
  push.assinar({ empresaId: 'e1', usuario: { id: 1 }, profissionalId: 'p1', assinatura: sub('t1') });
  push.assinar({ empresaId: 'e1', usuario: { id: 1 }, profissionalId: 'p1', assinatura: sub('t2') });
  const alvos = [];
  await push.enviarTeste({ empresaId: 'e1', usuario: { id: 1 }, endpoint: sub('t2').endpoint }, { enviar: async (s) => { alvos.push(s.endpoint); } });
  assert.deepEqual(alvos, [sub('t2').endpoint]);
  await assert.rejects(() => push.enviarTeste({ empresaId: 'e1', usuario: { id: 2 }, endpoint: sub('t2').endpoint }, { enviar: async () => {} }), /Ative/);
});

test('vínculo conferido no envio: e-mail trocado no cadastro deixa de receber', async () => {
  db().pushEquipe = {};
  const prof = barbearia.criarProfissional('e2', { nome: 'Davi', email: 'davi@x.test' });
  push.assinar({ empresaId: 'e2', usuario: { id: 11, email: 'davi@x.test' }, profissionalId: prof.id, assinatura: sub('v1') });
  let enviados = 0;
  const enviar = async () => { enviados += 1; };
  await push.notificarEquipe('e2', { id: 'x1', profissionalId: prof.id }, 'criado', { enviar });
  assert.equal(enviados, 1);
  barbearia.atualizarProfissional('e2', prof.id, { email: 'outro@x.test' });
  await push.notificarEquipe('e2', { id: 'x2', profissionalId: prof.id }, 'criado', { enviar });
  assert.equal(enviados, 1, 'login antigo não recebe mais');
});

test('link do aviso leva o endereço público da barbearia', () => {
  db().barbearias.e2.configuracao = { ...(db().barbearias.e2.configuracao || {}), slugPublico: 'navalha' };
  assert.equal(push.slugPublicoDaEmpresa('e2'), 'navalha');
  assert.equal(push.montarMensagem({ id: 'a', dataAgenda: '2026-10-02' }, 'criado', '', 'navalha').url, '/barbeiro/navalha?data=2026-10-02');
});
