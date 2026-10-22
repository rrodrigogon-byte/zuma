import { describe, it as test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { randomUUID, createHmac } from 'node:crypto';
import { pgDeTeste, criarBancoTeste, criarCliente } from './fixtures/clube-pg.js';
import * as acesso from '../modules/acesso/repositorio.js';
import { decidirAcesso } from '../modules/acesso/regras.js';
import { validarQrDinamico } from '../modules/acesso/qr.js';
import * as svc from '../modules/parceiros/servico.js';
import { createParceirosWebhookRouter, createParceirosAdminRouter, createPasseRouters } from '../modules/parceiros/rotas.js';
import * as aulas from '../modules/aulas/servico.js';
import * as ret from '../modules/retencao/servico.js';
import { criarDisparadorDeAcoes } from '../modules/clube/index.js';

describe('clube-parceiros (PostgreSQL)', { skip: pgDeTeste }, () => {

process.env.CLUBE_PARCEIROS_SECRET ||= 'segredo-de-teste-dos-parceiros-0123456789abcdef';
process.env.WELLHUB_WEBHOOK_SECRET = 'segredo-webhook-wellhub-teste';
process.env.WELLHUB_API_TOKEN = 'token-parceiro-kytto';
const QR = 'segredo-qr-de-teste-0123456789';

let ctx; let srv; let base;
const whats = [];
// simulador das plataformas: cada chamada fica registrada e a resposta vem da fila
const chamadas = [];
let respostas = [];
const fetchFalso = async (url, op = {}) => {
  chamadas.push({ url, headers: op.headers, body: op.body ? JSON.parse(op.body) : null });
  const r = respostas.shift() || { status: 200, corpo: { status: 'validated' } };
  if (r.erroRede) throw new Error('ECONNRESET');
  return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.corpo || {} };
};

before(async () => {
  ctx = await criarBancoTeste(['073_clube_acesso_controle.sql', '076_clube_retencao.sql', '077_clube_parceiros.sql', '075_clube_aulas_agenda.sql', '078_clube_cobrancas.sql', '083_dino_operational_foundations.sql']);
  const app = express();
  const deps = {
    db: ctx.db, enviarWhatsapp: async (m) => { whats.push(m); return { ok: true }; }, urlPublica: 'https://academia.kytto.com.br', qrSecret: QR,
    fetch: fetchFalso, reservar: (d, e, x) => aulas.reservar(d, e, x),
  };
  app.use('/api/integracoes', createParceirosWebhookRouter(deps));
  const passe = createPasseRouters({ db: ctx.db, qrSecret: QR });
  app.use('/clube/passe', passe.pagina);
  app.use('/api/public/clube/passes', passe.api);
  app.use('/admin/:emp', (req, res, next) => { req.emp = req.params.emp; next(); },
    createParceirosAdminRouter({ db: ctx.db, empresaDaRequisicao: async (req) => req.emp, urlPublica: 'https://academia.kytto.com.br', fetch: fetchFalso }));
  srv = app.listen(0);
  base = `http://127.0.0.1:${srv.address().port}`;
});
after(async () => { srv.close(); await ctx.fechar(); });

const postJson = (url, corpo, headers = {}) => fetch(`${base}${url}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof corpo === 'string' ? corpo : JSON.stringify(corpo) });
const assinar = (texto) => createHmac('sha1', process.env.WELLHUB_WEBHOOK_SECRET).update(texto).digest('hex');
const segredoDe = (url) => url.split('/').pop();
const caminhoDe = (url) => url.replace(/^https?:\/\/[^/]+/, '');

const verificar = (contaId) => ctx.db.query('UPDATE clube_parceiro_contas SET verificada = true, verificada_em = CURRENT_TIMESTAMP WHERE id = $1', [contaId]);

async function academia() {
  const emp = randomUUID();
  const { dispositivo } = await acesso.criarDispositivo(ctx.db, emp, { nome: 'Catraca' });
  await acesso.reservarComandos(ctx.db, dispositivo.id, 'limpa');
  return { emp, dispositivo };
}
function webhookWellhub(gymId, { token = `${Math.floor(Math.random() * 1e13)}`, nome = ['Carlos', 'Lima'], fone = '+55 65 99123-4567', ts = Math.floor(Date.now() / 1000) } = {}) {
  return {
    event_type: 'checkin',
    event_data: {
      user: { unique_token: token, first_name: nome[0], last_name: nome[1], email: `${token}@ex.com`, phone_number: fone },
      gym: { id: Number(gymId), title: 'Academia Teste', product: { id: 1, description: 'Silver' } },
      timestamp: ts,
    },
  };
}
function webhookTotalpass(placeCode, { code = `TP${Math.floor(Math.random() * 1e8)}`, cpf = '123.456.789-09', fone = '65999887766', expira = new Date(Date.now() + 3600000), endpoint } = {}) {
  return {
    type: 'CHECK_IN_CREATED',
    endpoint: endpoint || `https://gym-service-api.totalpass.com/webhook_confirmations/${randomUUID()}`,
    check_in: { started_at: new Date().toISOString(), plan_code: 'TP2', expires_at: expira.toISOString() },
    place: { place: 'x', name: 'Academia', code: placeCode },
    user: { name: 'Marina Souza', email: 'marina@ex.com', phone: fone, document_number: cpf, document_type: 'cpf', code },
  };
}

test('conta: credencial cifrada, URL do webhook com segredo só uma vez, unidade não duplica', async () => {
  const emp = randomUUID();
  await assert.rejects(svc.criarConta(ctx.db, emp, { plataforma: 'totalpass', idExterno: 'PLC1' }), { code: 'VALIDATION_ERROR' });
  const t = await svc.criarConta(ctx.db, emp, { plataforma: 'totalpass', idExterno: 'PLC1', credencial: 'place-api-key-secreta-123' }, { urlPublica: 'https://x.kytto.com.br' });
  assert.match(t.webhookUrl, /^https:\/\/x\.kytto\.com\.br\/api\/integracoes\/totalpass\/webhook\/[\w-]{30,}$/);
  const row = await ctx.db.query('SELECT credencial_cifrada, webhook_segredo_hash FROM clube_parceiro_contas WHERE id = $1', [t.conta.id]);
  assert.ok(!row.rows[0].credencial_cifrada.includes('place-api-key'), 'credencial nunca em claro');
  assert.ok(!row.rows[0].webhook_segredo_hash.includes(segredoDe(t.webhookUrl)));
  assert.equal(t.conta.temCredencial, true);
  assert.ok(!JSON.stringify(await svc.listarContas(ctx.db, emp)).includes('place-api'), 'listagem sem segredo');
  await assert.rejects(svc.criarConta(ctx.db, emp, { plataforma: 'totalpass', idExterno: 'PLC1', credencial: 'outra-chave-123' }), { code: 'CONTA_EXISTE' }, 'mesma academia');
  // outra academia consegue cadastrar o mesmo código (sem verificar), e a resposta não revela quem usa
  const novo = await svc.girarSegredo(ctx.db, emp, t.conta.id);
  assert.equal(await svc.contaPorSegredo(ctx.db, 'totalpass', segredoDe(t.webhookUrl)), null, 'segredo antigo para de funcionar');
  assert.ok(await svc.contaPorSegredo(ctx.db, 'totalpass', segredoDe(novo.webhookUrl)));
});

let fluxo;
test('Wellhub: assinatura obrigatória; 1º check-in cria o cadastro, entra na catraca e recebe o passe', async () => {
  const a = await academia();
  const gymId = String(Math.floor(Math.random() * 1e6));
  const { conta, webhookUrl } = await svc.criarConta(ctx.db, a.emp, { plataforma: 'wellhub', idExterno: gymId });
  const corpo = JSON.stringify(webhookWellhub(gymId, { token: '1111222233334' }));
  assert.equal((await postJson('/api/integracoes/wellhub/webhook', corpo)).status, 401, 'sem assinatura');
  assert.equal((await postJson('/api/integracoes/wellhub/webhook', corpo, { 'x-gympass-signature': assinar(`${corpo}x`) })).status, 401, 'assinatura errada');
  assert.equal((await postJson('/api/integracoes/wellhub/webhook', corpo, { 'x-gympass-signature': assinar(corpo) })).status, 404, 'URL única só atende conta verificada');
  assert.equal((await postJson(caminhoDe(webhookUrl), corpo)).status, 401, 'URL da academia também exige assinatura quando o segredo existe');
  const antes = whats.length;
  // 1º check-in na URL da própria academia comprova a posse e verifica a conta
  const r = await postJson(caminhoDe(webhookUrl), corpo, { 'x-gympass-signature': assinar(corpo) });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true, duplicado: false });
  const k = (await ctx.db.query('SELECT * FROM clube_parceiro_checkins WHERE conta_id = $1', [conta.id])).rows[0];
  assert.equal(k.status, 'recebido');
  assert.ok(new Date(k.expira_em) - new Date(k.recebido_em) >= 19 * 60000, 'validade de 20 min');
  const c = (await ctx.db.query('SELECT nome, telefone FROM commerce_customers WHERE id = $1', [k.customer_id])).rows[0];
  assert.deepEqual(c, { nome: 'Carlos Lima', telefone: '5565991234567' });
  // WhatsApp com o link do passe
  assert.equal(whats.length, antes + 1);
  assert.match(whats.at(-1).texto, /check-in Wellhub foi confirmado.*https:\/\/academia\.kytto\.com\.br\/clube\/passe\/[\w-]{30,}/);
  assert.match(whats.at(-1).texto, /cadastro facial/);
  // a pessoa foi para o aparelho com validade até o fim da janela
  const [cmd] = await acesso.reservarComandos(ctx.db, a.dispositivo.id, 'p1');
  assert.equal(cmd.comando.endpoint, 'create_or_modify_objects');
  assert.equal(cmd.comando.body.values[0].end_time, Math.floor(new Date(k.expira_em).getTime() / 1000));
  assert.equal((await ctx.db.query('SELECT verificada FROM clube_parceiro_contas WHERE id = $1', [conta.id])).rows[0].verificada, true);
  // webhook repetido (agora pela URL única, que já roteia para a conta verificada) não duplica
  const dup = await postJson('/api/integracoes/wellhub/webhook', corpo, { 'x-gympass-signature': assinar(corpo) });
  assert.equal((await dup.json()).duplicado, true);
  fluxo = { ...a, conta, checkin: k, passe: whats.at(-1).texto.match(/\/clube\/passe\/([\w-]+)/)[1] };
});

test('academia que cadastra o Gym ID de outra não recebe os check-ins dela', async () => {
  const dona = await academia(); const intrusa = await academia();
  const gymId = String(Math.floor(Math.random() * 1e6));
  const falsa = await svc.criarConta(ctx.db, intrusa.emp, { plataforma: 'wellhub', idExterno: gymId });
  const real = await svc.criarConta(ctx.db, dona.emp, { plataforma: 'wellhub', idExterno: gymId });
  const corpo = JSON.stringify(webhookWellhub(gymId));
  // só a dona cadastra a URL dela no portal: o 1º check-in verifica a conta da dona
  assert.equal((await postJson(caminhoDe(real.webhookUrl), corpo, { 'x-gympass-signature': assinar(corpo) })).status, 200);
  const corpo2 = JSON.stringify(webhookWellhub(gymId));
  assert.equal((await postJson('/api/integracoes/wellhub/webhook', corpo2, { 'x-gympass-signature': assinar(corpo2) })).status, 200);
  const daIntrusa = await ctx.db.query('SELECT COUNT(*)::int AS n FROM clube_parceiro_checkins WHERE conta_id = $1', [falsa.conta.id]);
  assert.equal(daIntrusa.rows[0].n, 0);
  const daDona = await ctx.db.query('SELECT COUNT(*)::int AS n FROM clube_parceiro_checkins WHERE conta_id = $1', [real.conta.id]);
  assert.equal(daDona.rows[0].n, 2);
  // a intrusa não consegue verificar o mesmo Gym ID depois
  const contaFalsa = (await ctx.db.query('SELECT * FROM clube_parceiro_contas WHERE id = $1', [falsa.conta.id])).rows[0];
  await assert.rejects(svc.marcarVerificada(ctx.db, contaFalsa), { code: 'CONTA_EM_USO' });
});

test('catraca libera pelo check-in e só então valida no Wellhub (com Gym ID e Wellhub ID)', async () => {
  const { emp, checkin } = fluxo;
  const ctxAcesso = await acesso.carregarContexto(ctx.db, { empresaId: emp, customerId: checkin.customer_id, agora: new Date() }, { parceiro: svc.passeParaAcesso });
  const d = decidirAcesso({ ...ctxAcesso, agora: new Date(), fuso: 'America/Cuiaba' });
  assert.equal(d.liberado, true);
  assert.equal(d.codigo, 'parceiro');
  assert.equal(d.checkinId, checkin.id);
  assert.equal(chamadas.length, 0, 'nada é validado antes de passar');
  respostas = [{ status: 200, corpo: { status: 'validated' } }];
  const disparar = criarDisparadorDeAcoes({ db: ctx.db, fetch: fetchFalso });
  await disparar({ acao: d.acao, empresaId: emp, customerId: checkin.customer_id, checkinId: d.checkinId, em: new Date() });
  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0].url, 'https://apitesting.partners.gympass.com/access/v1/validate');
  assert.equal(chamadas[0].headers.authorization, 'Bearer token-parceiro-kytto');
  assert.equal(chamadas[0].headers['x-gym-id'], fluxo.conta.idExterno);
  assert.deepEqual(chamadas[0].body, { gympass_id: '1111222233334' });
  const k = (await ctx.db.query('SELECT status, passou_catraca_em, validado_em FROM clube_parceiro_checkins WHERE id = $1', [checkin.id])).rows[0];
  assert.equal(k.status, 'validado');
  assert.ok(k.passou_catraca_em && k.validado_em);
  // segunda passagem (mesmo check-in) não valida de novo
  await disparar({ acao: d.acao, empresaId: emp, customerId: checkin.customer_id, checkinId: d.checkinId, em: new Date() });
  assert.equal(chamadas.length, 1);
});

test('passe por link: página sem cache e QR assinado que a catraca aceita; vencido = 410', async () => {
  const pg = await fetch(`${base}/clube/passe/${fluxo.passe}`);
  assert.equal(pg.status, 200);
  assert.equal(pg.headers.get('cache-control'), 'no-store');
  assert.equal(pg.headers.get('referrer-policy'), 'no-referrer');
  assert.match(await pg.text(), /Passe de entrada/);
  const q = await (await fetch(`${base}/api/public/clube/passes/${fluxo.passe}/qr`)).json();
  const userId = validarQrDinamico(QR, q.qr);
  const pe = await ctx.db.query('SELECT user_id_equipamento FROM acesso_pessoas_equipamento WHERE customer_id = $1', [fluxo.checkin.customer_id]);
  assert.equal(userId, Number(pe.rows[0].user_id_equipamento));
  assert.equal(q.plataforma, 'Wellhub');
  assert.equal(q.nome, 'Carlos');
  assert.equal((await fetch(`${base}/api/public/clube/passes/${'x'.repeat(32)}/qr`)).status, 404);
  await ctx.db.query("UPDATE clube_passes SET expira_em = CURRENT_TIMESTAMP - interval '1 minute' WHERE customer_id = $1", [fluxo.checkin.customer_id]);
  assert.equal((await fetch(`${base}/api/public/clube/passes/${fluxo.passe}/qr`)).status, 410);
});

test('instabilidade: tenta de novo por até 15 min e depois vira pendência de retroativo preenchida', async () => {
  const a = await academia();
  const gymId = String(Math.floor(Math.random() * 1e6));
  const { conta } = await svc.criarConta(ctx.db, a.emp, { plataforma: 'wellhub', idExterno: gymId });
  await verificar(conta.id);
  const t0 = new Date('2026-10-30T13:00:00Z');
  const ev = (await import('../modules/parceiros/adaptadores.js')).wellhub.lerCheckin(webhookWellhub(gymId, { ts: Math.floor(t0 / 1000) }));
  const r = await svc.receberCheckin(ctx.db, (await ctx.db.query('SELECT * FROM clube_parceiro_contas WHERE id = $1', [conta.id])).rows[0], ev, { agora: t0 });
  respostas = [{ status: 503 }];
  const v1 = await svc.naPassagem(ctx.db, { checkinId: r.checkinId, em: t0 }, { fetch: fetchFalso, agora: t0 });
  assert.equal(v1.status, 'falhou');
  assert.equal(v1.proximaTentativaEm.getTime(), t0.getTime() + 60000);
  // rotina antes da hora não tenta
  assert.equal((await svc.rotinaParceiros(ctx.db, { agora: new Date(t0.getTime() + 30000), fetch: fetchFalso })).tentativas, 0);
  respostas = [{ erroRede: true }, { status: 500 }, { status: 502 }, { status: 503 }, { status: 503 }, { status: 503 }];
  let agora = t0.getTime();
  let st;
  for (let i = 0; i < 8; i += 1) {
    agora += 5 * 60000;
    await svc.rotinaParceiros(ctx.db, { agora: new Date(agora), fetch: fetchFalso });
    st = (await ctx.db.query('SELECT status, tentativas FROM clube_parceiro_checkins WHERE id = $1', [r.checkinId])).rows[0];
    if (st.status === 'retroativo') break;
  }
  assert.equal(st.status, 'retroativo');
  const [p] = await svc.pendenciasRetroativo(ctx.db, a.emp);
  assert.equal(p.prazo, '2026-11-02', 'Wellhub: retroativo até o dia 2 do mês seguinte');
  assert.equal(p.nome, 'Carlos Lima');
  assert.ok(p.idNaPlataforma && p.passouCatracaEm && p.unidade === gymId);
  await svc.resolverRetroativo(ctx.db, a.emp, p.id, { aprovado: true });
  assert.equal((await svc.pendenciasRetroativo(ctx.db, a.emp)).length, 0);
});

test('check-in não usado vence e sai do aparelho; recusa da plataforma depois da passagem vira retroativo', async () => {
  const a = await academia();
  const gymId = String(Math.floor(Math.random() * 1e6));
  const { conta } = await svc.criarConta(ctx.db, a.emp, { plataforma: 'wellhub', idExterno: gymId, validadeMin: 5 });
  await verificar(conta.id);
  const contaRow = (await ctx.db.query('SELECT * FROM clube_parceiro_contas WHERE id = $1', [conta.id])).rows[0];
  const { wellhub } = await import('../modules/parceiros/adaptadores.js');
  const t0 = new Date();
  const r = await svc.receberCheckin(ctx.db, contaRow, wellhub.lerCheckin(webhookWellhub(gymId)), { agora: t0 });
  await acesso.reservarComandos(ctx.db, a.dispositivo.id, 'entrou');
  const venc = await svc.rotinaParceiros(ctx.db, { agora: new Date(t0.getTime() + 6 * 60000) });
  assert.equal(venc.expirados, 1);
  const [cmd] = await acesso.reservarComandos(ctx.db, a.dispositivo.id, 'saiu');
  assert.equal(cmd.comando.endpoint, 'destroy_objects');
  assert.equal((await ctx.db.query('SELECT status FROM clube_parceiro_checkins WHERE id = $1', [r.checkinId])).rows[0].status, 'expirado');

  const r2 = await svc.receberCheckin(ctx.db, contaRow, wellhub.lerCheckin(webhookWellhub(gymId)), { agora: t0 });
  respostas = [{ status: 400, corpo: { message: 'user already checked in today' } }];
  const v = await svc.naPassagem(ctx.db, { checkinId: r2.checkinId, em: t0 }, { fetch: fetchFalso, agora: t0 });
  assert.equal(v.status, 'retroativo');
  assert.match(v.erro, /already checked in/);
});

test('TotalPass: URL por academia, token de uso único cifrado, reconhece pelo CPF e pelo telefone do cadastro, valida com a place key', async () => {
  const a = await academia();
  const place = `PL${Math.floor(Math.random() * 1e6)}`;
  const { webhookUrl } = await svc.criarConta(ctx.db, a.emp, { plataforma: 'totalpass', idExterno: place, credencial: 'place-key-academia-xyz' });
  const caminho = caminhoDe(webhookUrl);
  // cliente já existente com o mesmo telefone: o resolvedor do Commerce reaproveita o cadastro
  // (o passe só vai para o telefone do cadastro, então quem recebe é o dono do número)
  const existente = await criarCliente(ctx.db, a.emp, 'Marina S.', '(65) 99988-7766');
  const corpo = webhookTotalpass(place, { code: 'TPX1' });
  assert.equal((await postJson(caminho.replace(/[\w-]+$/, 'segredo-errado-xxxxxxxxxxxxxxxxx'), corpo)).status, 401);
  assert.equal((await postJson(caminho, { ...corpo, endpoint: 'https://evil.example.com/steal' })).status, 400, 'URL de validação fora da TotalPass');
  const r = await postJson(caminho, corpo);
  assert.equal(r.status, 200);
  const k = (await ctx.db.query("SELECT * FROM clube_parceiro_checkins WHERE empresa_id = $1 AND plataforma = 'totalpass'", [a.emp])).rows[0];
  assert.equal(k.customer_id, existente, 'sem cadastro duplicado para o mesmo telefone');
  const totalClientes = (await ctx.db.query('SELECT count(*)::int AS n FROM commerce_customers WHERE empresa_id = $1', [a.emp])).rows[0].n;
  assert.equal(totalClientes, 1);
  assert.ok(!String(k.validacao_cifrada).includes('totalpass.com'), 'URL de validação cifrada');
  assert.ok(Math.abs(new Date(k.expira_em) - new Date(corpo.check_in.expires_at)) < 1000, 'expira no expires_at da TotalPass');
  const pp = (await ctx.db.query('SELECT documento_hmac FROM clube_parceiro_pessoas WHERE customer_id = $1', [k.customer_id])).rows[0];
  assert.ok(pp.documento_hmac && !pp.documento_hmac.includes('12345678909'), 'CPF só como HMAC');
  // mesma pessoa com outro código TotalPass, telefone diferente: achada pelo CPF
  await postJson(caminho, webhookTotalpass(place, { code: 'TPX2', fone: '11911112222' }));
  const k2 = (await ctx.db.query("SELECT customer_id FROM clube_parceiro_checkins WHERE empresa_id = $1 AND pessoa_externa = 'TPX2'", [a.emp])).rows[0];
  assert.equal(k2.customer_id, k.customer_id);

  chamadas.length = 0;
  respostas = [{ status: 422, corpo: { message: 'Checkin expirado' } }];
  const v = await svc.naPassagem(ctx.db, { checkinId: k.id }, { fetch: fetchFalso });
  assert.equal(chamadas[0].url, corpo.endpoint);
  assert.equal(chamadas[0].headers.authorization, 'Bearer place-key-academia-xyz');
  assert.equal(v.status, 'retroativo', 'passou na catraca e a plataforma recusou: pendência');
});

test('telefone e e-mail de cadastros diferentes: fica com o do telefone; modo sem catraca valida ao receber', async () => {
  const a = await academia();
  const place = `PL${Math.floor(Math.random() * 1e6)}`;
  const { webhookUrl } = await svc.criarConta(ctx.db, a.emp, { plataforma: 'totalpass', idExterno: place, credencial: 'place-key-2-xyz', modo: 'sem_catraca' });
  const doTelefone = await criarCliente(ctx.db, a.emp, 'Marina Souza', '65977776666');
  await ctx.db.query("INSERT INTO commerce_customers (empresa_id, nome, email) VALUES ($1, 'Outra Pessoa', 'marina@ex.com')", [a.emp]);
  chamadas.length = 0;
  respostas = [{ status: 200, corpo: { status: 'ok' } }];
  const r = await postJson(caminhoDe(webhookUrl), webhookTotalpass(place, { code: 'AMB1', cpf: '987.654.321-00', fone: '65977776666' }));
  assert.equal(r.status, 200);
  const k = (await ctx.db.query('SELECT status, customer_id FROM clube_parceiro_checkins WHERE empresa_id = $1', [a.emp])).rows[0];
  assert.equal(k.customer_id, doTelefone, 'o passe vai para o telefone: liga ao cadastro do telefone');
  assert.equal(k.status, 'validado');
  assert.equal(chamadas.length, 1);
});

test('reservas pelo app da plataforma entram com selo da origem e ocupam só as vagas de parceiro', async () => {
  const a = await academia();
  const place = `PL${Math.floor(Math.random() * 1e6)}`;
  const { webhookUrl } = await svc.criarConta(ctx.db, a.emp, { plataforma: 'totalpass', idExterno: place, credencial: 'place-key-3-xyz' });
  const m = await aulas.salvarModalidade(ctx.db, a.emp, { nome: 'Spin' });
  await aulas.salvarTurma(ctx.db, a.emp, { modalidadeId: m.id, nome: 'Spin 19h', diasSemana: [0, 1, 2, 3, 4, 5, 6], horaInicio: '19:00', duracaoMin: 45, capacidade: 10, vagasParceiros: 1, vigenciaInicio: '2026-01-01' });
  const amanha = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  await aulas.gerarOcorrencias(ctx.db, a.emp, { de: amanha, ate: amanha });
  const [oc] = await aulas.listarGrade(ctx.db, a.emp, { de: `${amanha}T00:00:00Z`, ate: `${amanha}T23:59:59Z` });
  const caminho = caminhoDe(webhookUrl).replace('/webhook/', '/reservas/');
  const reserva = (code) => ({ type: 'BOOKING_CREATED', occurrence: { external_id: oc.id }, user: { code, name: `Aluno ${code}`, phone: `6598${code.slice(-7).padStart(7, '0')}` }, booking: { code: `B${code}` } });
  const r1 = await postJson(caminho, reserva('1000001'));
  assert.equal(r1.status, 200);
  const r2 = await postJson(caminho, reserva('1000002'));
  assert.equal(r2.status, 409, 'só 1 vaga de parceiro');
  const lista = await aulas.listaDaAula(ctx.db, a.emp, oc.id);
  assert.equal(lista[0].origem, 'totalpass');
});

test('conciliação: validado e não pago, pago sem check-in, valor diferente; receita por visita', async () => {
  const a = await academia();
  const gymId = String(Math.floor(Math.random() * 1e6));
  const { conta } = await svc.criarConta(ctx.db, a.emp, { plataforma: 'wellhub', idExterno: gymId });
  await verificar(conta.id);
  await svc.salvarValor(ctx.db, a.emp, { plataforma: 'wellhub', produto: '*', valor: 25 });
  const contaRow = (await ctx.db.query('SELECT * FROM clube_parceiro_contas WHERE id = $1', [conta.id])).rows[0];
  const { wellhub } = await import('../modules/parceiros/adaptadores.js');
  const dias = ['2026-09-03', '2026-09-04', '2026-09-05'];
  const tokens = ['900001', '900002', '900003'];
  for (let i = 0; i < 3; i += 1) {
    const t = new Date(`${dias[i]}T14:00:00Z`);
    const r = await svc.receberCheckin(ctx.db, contaRow, wellhub.lerCheckin(webhookWellhub(gymId, { token: tokens[i], ts: Math.floor(t / 1000) })), { agora: t });
    await ctx.db.query("UPDATE clube_parceiro_checkins SET status = 'validado' WHERE id = $1", [r.checkinId]);
  }
  const imp = await svc.importarRepasse(ctx.db, a.emp, { plataforma: 'wellhub', mes: '2026-09', linhas: [
    { idNaPlataforma: '900001', data: '2026-09-03', valor: 25 },
    { idNaPlataforma: '900002', data: '2026-09-04', valor: 20 },
    { idNaPlataforma: '777777', data: '2026-09-10', valor: 25 },
  ] });
  assert.equal(imp.importadas, 3);
  await assert.rejects(svc.importarRepasse(ctx.db, a.emp, { plataforma: 'wellhub', mes: '2026-09', linhas: [{ idNaPlataforma: 'x', data: '2026-08-01', valor: 1 }] }), { code: 'VALIDATION_ERROR' });
  const c = await svc.conciliacao(ctx.db, a.emp, { mes: '2026-09' });
  const tipos = c.divergencias.map((x) => x.tipo).sort();
  assert.deepEqual(tipos, ['pago_sem_checkin', 'validado_nao_pago', 'valor_diferente']);
  const w = c.resumo.find((x) => x.plataforma === 'wellhub');
  assert.deepEqual([w.visitasValidadas, w.visitasPagas, w.receita, w.esperado, w.mediaPorVisita], [3, 3, 70, 75, 23.33]);
});

test('aluno parceiro frequente recebe oferta de plano próprio (régua do item 4)', async () => {
  const a = await academia();
  const gymId = String(Math.floor(Math.random() * 1e6));
  const { conta } = await svc.criarConta(ctx.db, a.emp, { plataforma: 'wellhub', idExterno: gymId });
  const contaRow = (await ctx.db.query('SELECT * FROM clube_parceiro_contas WHERE id = $1', [conta.id])).rows[0];
  const { wellhub } = await import('../modules/parceiros/adaptadores.js');
  const agora = new Date('2026-10-21T14:00:00Z');
  for (let i = 1; i <= 8; i += 1) {
    const t = new Date(`2026-10-${String(i).padStart(2, '0')}T13:00:00Z`);
    const r = await svc.receberCheckin(ctx.db, contaRow, wellhub.lerCheckin(webhookWellhub(gymId, { token: '5550001112223', ts: Math.floor(t / 1000) })), { agora: t });
    await ctx.db.query("UPDATE clube_parceiro_checkins SET status = 'validado' WHERE id = $1", [r.checkinId]);
  }
  const k = (await ctx.db.query('SELECT customer_id FROM clube_parceiro_checkins WHERE conta_id = $1 LIMIT 1', [conta.id])).rows[0];
  // o 1º check-in já registrou a pessoa como interessada de origem "parceiro"
  assert.equal((await ctx.db.query("SELECT origem FROM clube_prospects WHERE customer_id = $1", [k.customer_id])).rows[0].origem, 'parceiro');
  await ctx.db.query('UPDATE clube_prospects SET criado_em = $2 WHERE customer_id = $1', [k.customer_id, new Date('2026-10-01T12:00:00Z')]);
  await ret.salvarConfig(ctx.db, a.emp, { ativo: true, baseLegalMarketing: 'legitimo_interesse' });
  const enviados = [];
  await ret.executarRegua(ctx.db, a.emp, { agora, enviarWhatsapp: async (m) => { enviados.push(m); return { ok: true }; }, extras: { checkinsParceiroMes: svc.checkinsParceiroMes } });
  assert.equal(enviados.length, 1);
  assert.equal(enviados[0].gatilho, 'parceiro_frequente');
  assert.match(enviados[0].texto, /8 treinos/);
});

test('painel: testar configuração sem gravar nada e checagens de permissão das rotas', async () => {
  const a = await academia();
  const gymId = String(Math.floor(Math.random() * 1e6));
  const { conta } = await svc.criarConta(ctx.db, a.emp, { plataforma: 'wellhub', idExterno: gymId });
  respostas = [{ status: 404, corpo: { message: 'User not found' } }];
  const t = await (await postJson(`/admin/${a.emp}/contas/${conta.id}/testar`, {})).json();
  assert.equal(t.passos.find((p) => /credenciais aceitas/.test(p.passo)).ok, true);
  assert.equal(t.pronto, false, 'ainda não recebeu webhook');
  const outra = randomUUID();
  assert.equal((await postJson(`/admin/${outra}/contas/${conta.id}/testar`, {})).status, 404, 'conta de outra academia');
  const bad = await postJson(`/admin/${a.emp}/contas`, { plataforma: 'xpto', idExterno: '1' });
  assert.equal(bad.status, 400);
  const lista = await (await fetch(`${base}/admin/${a.emp}/checkins`)).json();
  assert.ok(Array.isArray(lista));
});

});
