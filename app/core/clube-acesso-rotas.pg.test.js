import { describe, it as test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { pgDeTeste, criarBancoTeste, criarCliente } from './fixtures/clube-pg.js';
import { createControlIdRouter, createAcessoAdminRouter } from '../modules/acesso/rotas.js';
import { gerarQrDinamico } from '../modules/acesso/qr.js';
import { ErroDominio } from '../modules/acesso/banco.js';

describe('clube-acesso-rotas (PostgreSQL)', { skip: pgDeTeste }, () => {

const EMPRESA = randomUUID();
const QR_SECRET = 'segredo-de-teste-qr-0123456789';
const AGORA = new Date('2026-10-21T22:30:00Z'); // quarta 18:30 em Cuiabá
let ctx; let server; let base; const acoes = [];

before(async () => {
  ctx = await criarBancoTeste(['073_clube_acesso_controle.sql', '076_clube_retencao.sql', '077_clube_parceiros.sql', '078_clube_cobrancas.sql']);
  const app = express();
  app.use('/api/acesso/controlid', createControlIdRouter({
    db: ctx.db, qrSecret: QR_SECRET, agora: () => AGORA, dispararAcao: async (a) => { acoes.push(a); },
  }));
  // Simula a trava /api/admin do server.js: usuário logado e empresa ativa.
  app.use('/api/admin/clube/acesso', createAcessoAdminRouter({
    db: ctx.db,
    qrSecret: QR_SECRET,
    urlPublica: 'https://dino.kytto.com.br',
    empresaDaRequisicao: async (req) => {
      if (req.headers['x-teste-sem-permissao']) throw new ErroDominio('PERMISSION_DENIED', 'Sem permissão', 403);
      return EMPRESA;
    },
    operadorDaRequisicao: () => 'usuario-recepcao',
  }));
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server.close(); await ctx.fechar(); });

const admin = (path, opts = {}) => fetch(`${base}/api/admin/clube/acesso${path}`, {
  ...opts,
  headers: { 'content-type': 'application/json', ...(opts.headers || {}) },
  body: opts.body ? JSON.stringify(opts.body) : undefined,
});
const aparelho = (segredo, path, form) => fetch(`${base}/api/acesso/controlid/${segredo}${path}`, {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams(form).toString(),
});

let segredo; let dispositivoId; let customerId; let matriculaId; let userId;

test('fluxo completo: cadastra aparelho, plano, matrícula; catraca libera e bloqueia', async () => {
  // 1. aparelho
  let r = await admin('/dispositivos', { method: 'POST', body: { nome: 'Catraca entrada' } });
  assert.equal(r.status, 201);
  const criado = await r.json();
  assert.match(criado.configuracao.servidorOnline, /^https:\/\/dino\.kytto\.com\.br\/api\/acesso\/controlid\/.{30,}$/);
  segredo = criado.configuracao.servidorOnline.split('/').pop();
  dispositivoId = criado.dispositivo.id;

  // 2. plano + cliente + matrícula
  r = await admin('/planos', { method: 'POST', body: { nome: 'Livre' } });
  const plano = await r.json();
  customerId = await criarCliente(ctx.db, EMPRESA, 'Carlos Lima', '65988887777');
  r = await admin('/clientes?busca=carl');
  assert.equal((await r.json())[0].id, customerId);
  r = await admin('/matriculas', { method: 'POST', body: { customerId, planoId: plano.id, pagoAte: '2026-11-01' } });
  assert.equal(r.status, 201);
  matriculaId = (await r.json()).id;

  // 3. o aparelho busca o cadastro pelo Push
  r = await fetch(`${base}/api/acesso/controlid/${segredo}/push?deviceId=5501&uuid=push-a`);
  const push = await r.json();
  const valores = (push.transactions ? push.transactions.map((t) => t.body) : [push.body]).flatMap((b) => b.values || []);
  userId = valores.find((v) => v.name === 'Carlos Lima').id;
  r = await fetch(`${base}/api/acesso/controlid/${segredo}/result?deviceId=5501&uuid=push-a`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ response: {} }),
  });
  assert.equal(r.status, 200);

  // 4. identificação na catraca → liberado
  r = await aparelho(segredo, '/new_user_identified.fcgi', { device_id: '5501', user_id: String(userId), event: '7', portal_id: '1', uuid: 'ev-1' });
  const lib = await r.json();
  assert.equal(lib.result.event, 7);
  assert.equal(lib.result.message, 'Bom treino, Carlos!');
  assert.deepEqual(lib.result.actions, [{ action: 'catra', parameters: 'allow=clockwise' }]);

  // 5. recepção ao vivo mostra a entrada
  r = await admin('/eventos');
  const eventos = await r.json();
  assert.equal(eventos[0].nome, 'Carlos Lima');
  assert.equal(eventos[0].decisao, 'liberado');

  // 6. bloqueio manual → próxima tentativa negada e ação disparada
  r = await admin(`/matriculas/${matriculaId}/bloqueio`, { method: 'POST', body: { bloqueada: true, motivo: 'Pendência documental' } });
  assert.equal(r.status, 200);
  r = await aparelho(segredo, '/new_user_identified.fcgi', { device_id: '5501', user_id: String(userId), event: '7', portal_id: '1', uuid: 'ev-2' });
  const neg = await r.json();
  assert.equal(neg.result.event, 6);
  assert.equal(neg.result.message, 'Procure a recepção');
  await new Promise((ok) => setImmediate(ok));
  assert.equal(acoes.at(-1).acao, 'avisar_recepcao');
  assert.equal(acoes.at(-1).customerId, customerId);
  await admin(`/matriculas/${matriculaId}/bloqueio`, { method: 'POST', body: { bloqueada: false } });
});

test('aparelho com segredo errado ou device_id trocado é recusado', async () => {
  let r = await aparelho('x'.repeat(32), '/new_user_identified.fcgi', { device_id: '5501', user_id: String(userId), event: '7' });
  assert.equal((await r.json()).result.event, 1);
  r = await aparelho(segredo, '/new_user_identified.fcgi', { device_id: '9999', user_id: String(userId), event: '7' });
  assert.equal((await r.json()).result.event, 1, 'segredo copiado para outro aparelho não funciona');
  r = await fetch(`${base}/api/acesso/controlid/${segredo}/push?deviceId=9999`);
  assert.equal(r.status, 401);
});

test('QR dinâmico: válido libera, expirado e adulterado negam', async () => {
  let r = await admin(`/pessoas/${customerId}/qr`);
  assert.equal(r.status, 200);
  // o servidor gera com o relógio real; para o aparelho de teste (AGORA fixo) geramos na mesma janela
  const valido = gerarQrDinamico(QR_SECRET, userId, AGORA.getTime()).valor;
  // Carlos já entrou neste teste: o QR identifica, mas a trava de dupla entrada barra
  r = await aparelho(segredo, '/new_qrcode.fcgi', { device_id: '5501', qrcode_value: valido, portal_id: '1', uuid: 'qr-0' });
  assert.equal((await r.json()).result.message, 'Entrada já registrada');
  await ctx.db.query('DELETE FROM acesso_eventos WHERE customer_id = $1', [customerId]);
  r = await aparelho(segredo, '/new_qrcode.fcgi', { device_id: '5501', qrcode_value: valido, portal_id: '1', uuid: 'qr-1' });
  assert.equal((await r.json()).result.event, 7);

  const velho = gerarQrDinamico(QR_SECRET, userId, AGORA.getTime() - 5 * 60 * 1000).valor;
  r = await aparelho(segredo, '/new_qrcode.fcgi', { device_id: '5501', qrcode_value: velho, portal_id: '1' });
  assert.equal((await r.json()).result.message, 'QR inválido ou expirado');

  const adulterado = valido.replace(`.${userId}.`, `.${userId + 1}.`);
  r = await aparelho(segredo, '/new_qrcode.fcgi', { device_id: '5501', qrcode_value: adulterado, portal_id: '1' });
  assert.equal((await r.json()).result.event, 3);
});

test('pagamento pelo painel enfileira atualização para a catraca', async () => {
  await fetch(`${base}/api/acesso/controlid/${segredo}/push?deviceId=5501&uuid=limpa`);
  let r = await admin(`/matriculas/${matriculaId}/pagamento`, { method: 'POST', body: { pagoAte: '2026-12-01' } });
  assert.equal((await r.json()).pagoAte, '2026-12-01');
  r = await fetch(`${base}/api/acesso/controlid/${segredo}/push?deviceId=5501&uuid=pag`);
  const push = await r.json();
  assert.equal(push.endpoint, 'create_or_modify_objects');
});

test('liberação manual pelo painel registra operador e motivo', async () => {
  let r = await admin(`/dispositivos/${dispositivoId}/liberar`, { method: 'POST', body: { motivo: '' } });
  assert.equal(r.status, 400);
  r = await admin(`/dispositivos/${dispositivoId}/liberar`, { method: 'POST', body: { motivo: 'Visitante autorizado', customerId } });
  assert.equal(r.status, 200);
  const ev = await ctx.db.query("SELECT operador_id FROM acesso_eventos WHERE origem = 'manual'");
  assert.equal(ev.rows[0].operador_id, 'usuario-recepcao');
});

test('painel: sem permissão = 403, erro de validação = 400, nunca 500 cru', async () => {
  let r = await admin('/dispositivos', { headers: { 'x-teste-sem-permissao': '1' } });
  assert.equal(r.status, 403);
  assert.equal((await r.json()).code, 'PERMISSION_DENIED');
  r = await admin('/matriculas', { method: 'POST', body: { customerId: 'abc' } });
  assert.equal(r.status, 400);
  r = await admin(`/matriculas/${randomUUID()}/pagamento`, { method: 'POST', body: { pagoAte: '2026-12-01' } });
  assert.equal(r.status, 404);
});

test('device_is_alive tira da contingência', async () => {
  await ctx.db.query("UPDATE acesso_dispositivos SET status = 'contingencia' WHERE id = $1", [dispositivoId]);
  const r = await aparelho(segredo, '/device_is_alive.fcgi', { device_id: '5501', access_logs: '3' });
  assert.equal(r.status, 200);
  const d = await (await admin('/dispositivos')).json();
  assert.equal(d.find((x) => x.id === dispositivoId).status, 'online');
});
});
