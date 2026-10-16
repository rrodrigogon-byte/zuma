import test from 'node:test';
import assert from 'node:assert/strict';
import { registerWhatsappConexaoRoutes } from './whatsapp-conexao-routes.js';

function routeHarness({ profile = 'gestao', rows = [], queryError = null, control = true, status = async () => ({ status: 'WORKING' }), env = {} } = {}) {
  const routes = new Map();
  const calls = { query: [], status: [], legacy: 0, writes: 0 };
  const app = {
    get(path, handler) { routes.set(path, handler); },
    post() {},
    put() {},
  };
  const database = {
    async queryRead(sql, params) {
      calls.query.push({ sql, params });
      if (queryError) throw queryError;
      return { rows };
    },
    async query() { calls.writes += 1; throw new Error('writer called'); },
  };
  registerWhatsappConexaoRoutes(app, {
    basePath: `/diag-${profile}`,
    tipoCanal: profile,
    database,
    legacyEmpresaId: (req) => req.empresa,
    legacyLojaId: (req) => req.loja,
    wahaConfigured: () => control,
    wahaStatus: async (session) => { calls.status.push(session); return status(session); },
    wahaAssignedSession: () => rows[0]?.configuracao?.waha_session || '',
    env,
    audit: () => { calls.writes += 1; },
    save: () => { calls.writes += 1; },
    enviarMensagem: async () => { calls.writes += 1; },
  });
  async function request({ role = 'admin', empresa = 'tenant-a', loja = 'store-a' } = {}) {
    const req = { user: { role }, empresa, loja, query: {}, body: {} };
    const out = { code: 200, headers: {}, body: null };
    const res = {
      set(name, value) { out.headers[name] = value; return res; },
      status(code) { out.code = code; return res; },
      json(body) { out.body = body; return res; },
    };
    await routes.get(`/diag-${profile}/diagnostico`)(req, res);
    return out;
  }
  return { calls, request };
}

const row = (overrides = {}) => ({
  status: 'ativo',
  credencial_referencia: 'ENV:WAHA_WEBHOOK_SECRET_DINO',
  configuracao: {
    provider: 'waha',
    transporte: 'waha',
    instance: 'private-session-a',
    waha_session: 'private-session-a',
    waha_group_id: '120363012345678901@g.us',
    segredo_env: 'WAHA_WEBHOOK_SECRET_DINO',
    waha_hmac_env: 'WAHA_WEBHOOK_HMAC_KEY_DINO',
  },
  ...overrides,
});

test('403 para não gestor sem consultar banco ou WAHA', async () => {
  const h = routeHarness({ rows: [row()] });
  const result = await h.request({ role: 'staff' });
  assert.equal(result.code, 403);
  assert.equal(h.calls.query.length, 0);
  assert.equal(h.calls.status.length, 0);
  assert.equal(result.headers['Cache-Control'], 'private, no-store');
});

test('409 quando unidade não foi selecionada, sem consulta', async () => {
  const h = routeHarness({ rows: [row()] });
  const result = await h.request({ loja: '' });
  assert.equal(result.code, 409);
  assert.equal(result.body.code, 'STORE_SELECTION_REQUIRED');
  assert.equal(h.calls.query.length, 0);
  assert.equal(h.calls.status.length, 0);
});

test('consulta e resultado ficam isolados por empresa, unidade e perfil', async () => {
  const h = routeHarness({
    profile: 'gestao',
    rows: [row()],
    env: {
      WAHA_WEBHOOK_SECRET_DINO: 'webhook-secret-value',
      WAHA_WEBHOOK_HMAC_KEY_DINO: 'hmac-secret-value',
    },
  });
  const result = await h.request({ empresa: 'tenant-a', loja: 'store-a' });
  assert.equal(result.code, 200);
  assert.equal(result.body.tipoCanal, 'gestao');
  assert.equal(result.body.transporte, 'waha');
  assert.equal(result.body.readiness.controlConfigured, true);
  assert.equal(result.body.readiness.channelConfigured, true);
  assert.equal(result.body.readiness.sessionAssigned, true);
  assert.equal(result.body.readiness.sessionConnected, true);
  assert.equal(result.body.readiness.groupConfigured, true);
  assert.equal(result.body.readiness.webhookSecretConfigured, true);
  assert.equal(result.body.readiness.hmacSecretConfigured, true);
  assert.equal(result.body.checkedAt, result.body.agora);
  assert.equal(h.calls.query[0].params.join('|'), 'tenant-a|store-a|gestao');
  assert.deepEqual(h.calls.status, ['private-session-a']);
  const serialized = JSON.stringify(result.body);
  assert.doesNotMatch(serialized, /tenant-a|store-a|private-session-a|120363|secret-value|WAHA_CONTROL/);
  assert.match(result.headers['Cache-Control'], /no-store/);
});

test('canal sem transporte WAHA não herda sessão Cliente nem consulta rede', async () => {
  const h = routeHarness({
    profile: 'lancamentos',
    rows: [{ configuracao: { provider: 'chatbot_backend', transporte: 'legado', instance: 'legacy-client' } }],
  });
  const result = await h.request({ empresa: 'tenant-b', loja: 'store-b' });
  assert.equal(result.body.tipoCanal, 'lancamentos');
  assert.equal(result.body.readiness.channelConfigured, false);
  assert.equal(result.body.readiness.sessionAssigned, false);
  assert.equal(result.body.readiness.sessionConnected, null);
  assert.equal(result.body.readiness.groupConfigured, false);
  assert.equal(h.calls.status.length, 0);
  assert.doesNotMatch(JSON.stringify(result.body), /legacy-client|tenant-b|store-b/);
});

test('WAHA ausente não consulta sessão e mantém conectividade unknown', async () => {
  const h = routeHarness({ rows: [row()], control: false });
  const result = await h.request();
  assert.equal(result.body.readiness.controlConfigured, false);
  assert.equal(result.body.readiness.sessionAssigned, true);
  assert.equal(result.body.readiness.sessionConnected, null);
  assert.equal(h.calls.status.length, 0);
});

test('sessão, grupo e segredos ausentes ou inválidos são bloqueados sem eco', async () => {
  const h = routeHarness({
    rows: [row({ configuracao: {
      provider: 'waha', transporte: 'waha', instance: 'private-session-a', waha_session: 'other-session',
      waha_group_id: 'not-a-group', segredo_env: 'DATABASE_URL', waha_hmac_env: 'JWT_SECRET',
    } })],
    env: { DATABASE_URL: 'postgres-secret', JWT_SECRET: 'jwt-secret' },
  });
  const result = await h.request();
  assert.equal(result.body.readiness.sessionAssigned, false);
  assert.equal(result.body.readiness.sessionConnected, null);
  assert.equal(result.body.readiness.groupConfigured, false);
  assert.equal(result.body.readiness.webhookSecretConfigured, false);
  assert.equal(result.body.readiness.hmacSecretConfigured, false);
  assert.equal(h.calls.status.length, 0);
  assert.doesNotMatch(JSON.stringify(result.body), /private-session-a|other-session|DATABASE_URL|JWT_SECRET|postgres-secret|jwt-secret/);
});

test('falha de leitura DB ou rede preserva unknown e não vaza erro', async () => {
  const dbFailure = routeHarness({ queryError: new Error('SQL secret / postgres://private') });
  const dbResult = await dbFailure.request();
  assert.equal(dbResult.code, 200);
  assert.equal(dbResult.body.readiness.channelConfigured, null);
  assert.equal(dbResult.body.readiness.sessionAssigned, null);
  assert.equal(dbResult.body.readiness.sessionConnected, null);
  assert.doesNotMatch(JSON.stringify(dbResult.body), /SQL|postgres|private/);

  const networkFailure = routeHarness({ rows: [row()], status: async () => { throw new Error('bridge https://private.example secret'); } });
  const networkResult = await networkFailure.request();
  assert.equal(networkResult.code, 200);
  assert.equal(networkResult.body.readiness.sessionConnected, null);
  assert.equal(networkResult.body.readiness.sessionAssigned, true);
  assert.doesNotMatch(JSON.stringify(networkResult.body), /bridge|https|private-session-a|secret/);
});

test('provider e transporte incoerentes ou incompletos não são canal WAHA nem consultam sessão', async () => {
  for (const config of [
    { provider: 'chatbot_backend', transporte: 'waha' },
    { provider: 'waha', transporte: 'legado' },
    { provider: 'waha', transporte: undefined },
    { provider: undefined, transporte: 'waha' },
  ]) {
    const configured = row();
    configured.configuracao = { ...configured.configuracao, ...config };
    const h = routeHarness({ rows: [configured], env: { WAHA_WEBHOOK_SECRET_DINO: 'SYNTHETIC_WEBHOOK', WAHA_WEBHOOK_HMAC_KEY_DINO: 'SYNTHETIC_HMAC' } });
    const result = await h.request();
    assert.equal(result.body.readiness.channelConfigured, false);
    assert.equal(result.body.readiness.sessionAssigned, false);
    assert.equal(result.body.readiness.sessionConnected, null);
    assert.equal(h.calls.status.length, 0);
    assert.equal(h.calls.writes, 0);
  }
});

test('status WAHA desconhecido permanece null; negativo conhecido não vira conectividade positiva', async () => {
  for (const [status, expected] of [['MYSTERY_STATE', null], ['STOPPED', false], ['FAILED', false], ['SCAN_QR_CODE', false], ['STARTING', false], ['WORKING', true]]) {
    const h = routeHarness({ rows: [row()], status: async () => ({ status }) });
    const result = await h.request();
    assert.equal(result.body.readiness.sessionConnected, expected, status);
    assert.equal(h.calls.writes, 0);
    assert.doesNotMatch(JSON.stringify(result.body), /MYSTERY_STATE|private-session-a/);
  }
});
