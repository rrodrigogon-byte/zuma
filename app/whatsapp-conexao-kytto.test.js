import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { reset } from './db.js';

beforeEach(() => {
  reset();
  process.env.CHATBOT_BACKEND_INSTANCE = 'dino-1';
  process.env.CHATBOT_BACKEND_MODE = 'instancias';
  process.env.WHATSAPP_PROVIDER = 'chatbot_backend';
  process.env.CHATBOT_BACKEND_URL = 'https://backend.test';
  process.env.CHATBOT_BACKEND_KEY = 'k'.repeat(24);
  delete process.env.WAHA_CONTROL_URL;
  delete process.env.WAHA_CONTROL_BRIDGE_SECRET;
  delete process.env.CHATBOT_BACKEND_EMPRESA_ID;
});
afterEach(() => {
  reset();
  for (const key of ['CHATBOT_BACKEND_INSTANCE', 'CHATBOT_BACKEND_MODE', 'CHATBOT_BACKEND_EMPRESA_ID', 'WHATSAPP_PROVIDER', 'CHATBOT_BACKEND_URL', 'CHATBOT_BACKEND_KEY', 'WAHA_CONTROL_URL', 'WAHA_CONTROL_BRIDGE_SECRET']) delete process.env[key];
});

test('a instância padrão fica com uma só empresa e nunca com a principal da plataforma', async () => {
  const conexao = await import('./whatsapp-conexao-kytto.js');
  assert.equal(conexao.obterConexao('principal').instance, '', 'plataforma não pega a instância');
  assert.equal(conexao.obterConexao('emp-a').instance, 'dino-1');
  assert.equal(conexao.obterConexao('emp-b').instance, '', 'outra empresa não herda');
  const qr = await conexao.gerarQr('emp-b', { fetchImpl: async () => { throw new Error('não deveria chamar o backend'); } });
  assert.equal(qr.code, 'WHATSAPP_INSTANCE_UNASSIGNED');
  assert.throws(() => conexao.configurar('emp-b', { instance: 'dino-1' }), /administração da plataforma/);
  assert.throws(() => conexao.configurar('emp-b', { instance: 'dino-1' }, { podeTrocarInstancia: true }), /outra empresa/);
  assert.equal(conexao.configurar('emp-b', { instance: 'loja-b-1' }, { podeTrocarInstancia: true }).instance, 'loja-b-1');
});

test('com CHATBOT_BACKEND_EMPRESA_ID, só essa empresa recebe a instância padrão', async () => {
  process.env.CHATBOT_BACKEND_EMPRESA_ID = 'emp-dono';
  const conexao = await import('./whatsapp-conexao-kytto.js');
  assert.equal(conexao.obterConexao('emp-outra').instance, '');
  assert.equal(conexao.obterConexao('emp-dono').instance, 'dino-1');
});

test('gestor vê telefone do backend recente; equipe vê apenas máscara e campo manual nunca comprova sessão', async () => {
  const conexao = await import('./whatsapp-conexao-kytto.js');
  const estado = conexao.obterConexao('emp-a');
  estado.state = 'open'; estado.phone = '5565999991234'; estado.lastCheckAt = new Date().toISOString();
  let manager = conexao.visaoPublica(estado, { numeroCompleto: true });
  const staff = conexao.visaoPublica(estado);
  assert.equal(manager.phoneNumber, '5565999991234');
  assert.equal(staff.phoneMasked, '5565•••••1234');
  assert.equal(Object.hasOwn(staff, 'phoneNumber'), false);
  assert.equal(Object.hasOwn(staff, 'phoneReference'), false);

  manager = conexao.configurar('emp-a', { numeroExibicao: '(65) 99888-0000' });
  assert.equal(manager.phoneMasked, '5565•••••1234');
  assert.equal(conexao.visaoPublica(estado, { numeroCompleto: true }).phoneReference, '5565998880000');
  assert.throws(() => conexao.configurar('emp-a', { numeroExibicao: '123' }), /DDD/);
  estado.lastCheckAt = new Date(Date.now() - 3 * 60_000).toISOString();
  manager = conexao.visaoPublica(estado, { numeroCompleto: true });
  assert.equal(manager.phoneNumber, '');
  assert.equal(manager.phoneMasked, '');
  assert.equal(manager.phoneReference, '5565998880000', 'referência permanece rotulada como manual');
  conexao.configurar('emp-a', { instance: 'dino-novo' }, { podeTrocarInstancia: true });
  assert.equal(conexao.visaoPublica(estado, { numeroCompleto: true }).phoneReference, '');
});

test('troca de instância descarta status antigo e reinicia dados transitórios sem herdar titularidade', async () => {
  const conexao = await import('./whatsapp-conexao-kytto.js');
  const estado = conexao.obterConexao('emp-a');
  estado.ativo = true; estado.autoReconnect = true; estado.reconnectAttempts = 4;
  estado.nextReconnectAt = new Date(Date.now() + 600_000).toISOString();
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const antigo = conexao.verificarConexao('emp-a', { fetchImpl: async () => {
    await pending;
    return { ok: true, status: 200, text: async () => '{"state":"open","phone":"5565999991234"}' };
  } });
  conexao.configurar('emp-a', { instance: 'dino-novo' }, { podeTrocarInstancia: true });
  release();
  const view = await antigo;
  assert.equal(view.instance, 'dino-novo');
  assert.equal(view.state, 'unknown');
  assert.equal(view.phoneMasked, '');
  assert.equal(estado.ativo, false);
  assert.equal(estado.autoReconnect, false);
  assert.equal(estado.reconnectAttempts, 0);
  assert.equal(estado.nextReconnectAt, null);
  assert.equal(estado.history[0].instance, 'dino-1');
});

test('vigia antigo não aplica reconexão após troca e código sem imagem entra no estado QR', async () => {
  const conexao = await import('./whatsapp-conexao-kytto.js');
  const estado = conexao.obterConexao('emp-a'); estado.ativo = true;
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  let calls = 0;
  const antigo = conexao.vigiarConexao('emp-a', { fetchImpl: async () => {
    calls++;
    await pending;
    return { ok: true, status: 200, text: async () => '{"state":"close"}' };
  } });
  conexao.configurar('emp-a', { instance: 'dino-novo' }, { podeTrocarInstancia: true });
  release();
  assert.deepEqual(await antigo, { action: 'skip', reason: 'connection_changed' });
  assert.equal(calls, 1, 'sem pedido de QR para a instância antiga');
  const paired = await conexao.gerarQr('emp-a', { fetchImpl: async () => ({
    ok: true, status: 200, text: async () => '{"pairingCode":"ABCD-1234"}',
  }) });
  assert.equal(paired.ok, true);
  assert.equal(paired.pairingCode, 'ABCD-1234');
  assert.equal(paired.conexao.state, 'qr');
  assert.ok(paired.conexao.lastQrAt);
});

test('falha de logout não marca localmente uma sessão que continua aberta', async () => {
  const saved = { WHATSAPP_PROVIDER: process.env.WHATSAPP_PROVIDER, CHATBOT_BACKEND_URL: process.env.CHATBOT_BACKEND_URL, CHATBOT_BACKEND_KEY: process.env.CHATBOT_BACKEND_KEY };
  process.env.WHATSAPP_PROVIDER = 'chatbot_backend';
  process.env.CHATBOT_BACKEND_URL = 'https://backend.test';
  process.env.CHATBOT_BACKEND_KEY = 'k'.repeat(24);
  try {
    const conexao = await import('./whatsapp-conexao-kytto.js');
    const estado = conexao.obterConexao('emp-a');
    estado.state = 'open';
    estado.ativo = true;
    const result = await conexao.desconectar('emp-a', { fetchImpl: async () => ({ ok: false, status: 404, text: async () => '{}' }) });
    assert.equal(result.ok, false);
    assert.equal(result.conexao.ativo, true);
    assert.equal(result.conexao.state, 'open');
  } finally {
    for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});

test('verificação reativa a conexão local quando o backend confirma estado aberto', async () => {
  const saved = { WHATSAPP_PROVIDER: process.env.WHATSAPP_PROVIDER, CHATBOT_BACKEND_URL: process.env.CHATBOT_BACKEND_URL, CHATBOT_BACKEND_KEY: process.env.CHATBOT_BACKEND_KEY };
  process.env.WHATSAPP_PROVIDER = 'chatbot_backend';
  process.env.CHATBOT_BACKEND_URL = 'https://backend.test';
  process.env.CHATBOT_BACKEND_KEY = 'k'.repeat(24);
  try {
    const conexao = await import('./whatsapp-conexao-kytto.js');
    const estado = conexao.obterConexao('emp-a');
    estado.ativo = false;
    const result = await conexao.verificarConexao('emp-a', { fetchImpl: async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ state: 'open' }) }) });
    assert.equal(result.state, 'open');
    assert.equal(result.ativo, true);
  } finally {
    for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});

test('watchdog não regrava o db.json quando só o horário da checagem mudou', async () => {
  const saved = { WHATSAPP_PROVIDER: process.env.WHATSAPP_PROVIDER, CHATBOT_BACKEND_URL: process.env.CHATBOT_BACKEND_URL, CHATBOT_BACKEND_KEY: process.env.CHATBOT_BACKEND_KEY };
  process.env.WHATSAPP_PROVIDER = 'chatbot_backend';
  process.env.CHATBOT_BACKEND_URL = 'https://backend.test';
  process.env.CHATBOT_BACKEND_KEY = 'k'.repeat(24);
  try {
    const conexao = await import('./whatsapp-conexao-kytto.js');
    const { estadoGravacao } = await import('./db.js');
    const estado = conexao.obterConexao('emp-a');
    estado.ativo = true;
    const fetchImpl = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ state: 'open' }) });
    await conexao.vigiarConexao('emp-a', { fetchImpl });
    const gravacoesDepoisDaMudanca = estadoGravacao().gravacoes;
    await conexao.vigiarConexao('emp-a', { fetchImpl });
    assert.equal(estadoGravacao().gravacoes, gravacoesDepoisDaMudanca);
    assert.equal(conexao.obterConexao('emp-a').state, 'open');
  } finally {
    for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});

test('logout por instância exige GET final close/qr, pausa reconexão e apaga identidade anterior', async () => {
  const conexao = await import('./whatsapp-conexao-kytto.js');
  const estado = conexao.obterConexao('emp-a');
  estado.state = 'open'; estado.ativo = true; estado.phone = '5565999991234'; estado.numeroExibicao = '5565999991234'; estado.autoReconnect = true;
  const calls = [];
  const result = await conexao.desconectar('emp-a', { fetchImpl: async (url, opts) => {
    calls.push([opts.method, url]);
    return { ok: true, status: 200, text: async () => JSON.stringify(opts.method === 'DELETE' ? { success: true } : { state: 'qr' }) };
  } });
  assert.equal(result.ok, true);
  assert.deepEqual(calls.map(([method, url]) => [method, new URL(url).pathname + new URL(url).search]), [
    ['DELETE', '/api/v1/whats-app/instances/dino-1/session?confirm=true'],
    ['GET', '/api/v1/whats-app/instances/dino-1/status'],
  ]);
  assert.equal(result.conexao.state, 'close');
  assert.equal(result.conexao.ativo, false);
  assert.equal(result.conexao.autoReconnect, false);
  assert.equal(result.conexao.phoneMasked, '');
  assert.equal(Object.hasOwn(result.conexao, 'numeroExibicao'), false);
  assert.deepEqual(await conexao.vigiarConexao('emp-a', { fetchImpl: () => { throw new Error('não chamar'); } }), { action: 'skip', reason: 'inactive' });
});

test('HTTP 200 sem mudança de estado não declara desconexão e telefone velho nunca passa por número verificado', async () => {
  const conexao = await import('./whatsapp-conexao-kytto.js');
  const estado = conexao.obterConexao('emp-a');
  estado.state = 'open'; estado.ativo = true; estado.phone = '5565999991234';
  const result = await conexao.desconectar('emp-a', { fetchImpl: async (_url, opts) => ({ ok: true, status: 200, text: async () => JSON.stringify(opts.method === 'DELETE' ? {} : { state: 'open' }) }) });
  assert.equal(result.ok, false);
  assert.equal(result.conexao.state, 'open');
  assert.equal(result.conexao.ativo, true);
  assert.equal(result.conexao.lastError, 'LOGOUT_STATUS_UNCONFIRMED');
  assert.equal(result.conexao.phoneMasked, '', 'GET final sem telefone não preserva identidade antiga');
  const refreshed = await conexao.verificarConexao('emp-a', { fetchImpl: async () => ({ ok: true, status: 200, text: async () => '{"state":"open"}' }) });
  assert.equal(refreshed.phoneMasked, '', 'status open sem telefone não herda titular anterior');
});

test('timeout de DELETE é reconciliado apenas por GET de status; não há segundo DELETE', async () => {
  const conexao = await import('./whatsapp-conexao-kytto.js');
  const estado = conexao.obterConexao('emp-a'); estado.state = 'open'; estado.ativo = true;
  const methods = [];
  const result = await conexao.desconectar('emp-a', { fetchImpl: async (_url, opts) => {
    methods.push(opts.method);
    if (opts.method === 'DELETE') throw new Error('timeout sintético');
    return { ok: true, status: 200, text: async () => '{"state":"close"}' };
  } });
  assert.equal(result.ok, true);
  assert.deepEqual(methods, ['DELETE', 'GET']);
});

test('timeout sem confirmação mantém a sessão em aberto e nunca repete DELETE', async () => {
  const conexao = await import('./whatsapp-conexao-kytto.js');
  const estado = conexao.obterConexao('emp-a'); estado.state = 'open'; estado.ativo = true;
  const methods = [];
  const result = await conexao.desconectar('emp-a', { fetchImpl: async (_url, opts) => {
    methods.push(opts.method);
    if (opts.method === 'DELETE') throw new Error('timeout sintético');
    return { ok: true, status: 200, text: async () => '{"state":"open"}' };
  } });
  assert.equal(result.ok, false);
  assert.equal(result.conexao.state, 'open');
  assert.equal(result.conexao.ativo, true);
  assert.equal(result.conexao.lastError, 'LOGOUT_NETWORK_UNCERTAIN');
  assert.deepEqual(methods, ['DELETE', 'GET']);
});

test('dois logouts concorrentes fazem um DELETE e não acionam vigia no meio da troca', async () => {
  const conexao = await import('./whatsapp-conexao-kytto.js');
  const estado = conexao.obterConexao('emp-a'); estado.state = 'open'; estado.ativo = true;
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  let calls = 0;
  const fetchImpl = async (_url, opts) => {
    if (opts.method === 'DELETE') { calls++; await pending; return { ok: true, status: 200, text: async () => '{}' }; }
    return { ok: true, status: 200, text: async () => '{"state":"close"}' };
  };
  const first = conexao.desconectar('emp-a', { fetchImpl });
  const second = await conexao.desconectar('emp-a', { fetchImpl });
  assert.equal(second.code, 'WHATSAPP_DISCONNECT_IN_PROGRESS');
  assert.deepEqual(await conexao.vigiarConexao('emp-a', { fetchImpl }), { action: 'skip', reason: 'disconnect_in_progress' });
  release();
  assert.equal((await first).ok, true);
  assert.equal(calls, 1);
});

test('GET atrasado não reativa o canal após logout e pausa automática', async () => {
  const conexao = await import('./whatsapp-conexao-kytto.js');
  const estado = conexao.obterConexao('emp-a');
  estado.state = 'close'; estado.ativo = false; estado.autoReconnect = false;
  const result = await conexao.verificarConexao('emp-a', { fetchImpl: async () => ({ ok: true, status: 200, text: async () => '{"state":"open"}' }) });
  assert.equal(result.state, 'open');
  assert.equal(result.ativo, false);
  assert.equal(result.autoReconnect, false);
});

test('vigia iniciado antes do logout não solicita QR ao receber status atrasado', async () => {
  const conexao = await import('./whatsapp-conexao-kytto.js');
  const estado = conexao.obterConexao('emp-a'); estado.state = 'open'; estado.ativo = true;
  let liberarVigia; let liberarLogout;
  const vigiaEmVoo = new Promise((resolve) => { liberarVigia = resolve; });
  const logoutEmVoo = new Promise((resolve) => { liberarLogout = resolve; });
  let qrCalls = 0;
  const vigilante = conexao.vigiarConexao('emp-a', { fetchImpl: async () => {
    await vigiaEmVoo;
    return { ok: true, status: 200, text: async () => '{"state":"close"}' };
  } });
  const sair = conexao.desconectar('emp-a', { fetchImpl: async (_url, opts) => {
    if (opts.method === 'DELETE') { await logoutEmVoo; return { ok: true, status: 200, text: async () => '{}' }; }
    if (_url.includes('/qr')) qrCalls++;
    return { ok: true, status: 200, text: async () => '{"state":"close"}' };
  } });
  liberarVigia();
  assert.deepEqual(await vigilante, { action: 'skip', reason: 'disconnect_in_progress' });
  liberarLogout();
  assert.equal((await sair).ok, true);
  assert.equal(qrCalls, 0);
});

test('GET antigo com open após logout confirmado não ressuscita a conexão local', async () => {
  const conexao = await import('./whatsapp-conexao-kytto.js');
  const estado = conexao.obterConexao('emp-a'); estado.state = 'open'; estado.ativo = true; estado.phone = '5565999991234';
  let liberar;
  const pending = new Promise((resolve) => { liberar = resolve; });
  const antigo = conexao.verificarConexao('emp-a', { fetchImpl: async () => {
    await pending;
    return { ok: true, status: 200, text: async () => '{"state":"open","phone":"5565999991234"}' };
  } });
  const saiu = await conexao.desconectar('emp-a', { fetchImpl: async (_url, opts) => ({
    ok: true, status: 200, text: async () => JSON.stringify(opts.method === 'DELETE' ? { success: true } : { state: 'close' }),
  }) });
  assert.equal(saiu.ok, true);
  liberar();
  const depois = await antigo;
  assert.equal(depois.state, 'close');
  assert.equal(depois.ativo, false);
  assert.equal(depois.phoneMasked, '');
  const eventoAtrasado = conexao.registrarEventoConexao('emp-a', 'open');
  assert.equal(eventoAtrasado.state, 'close', 'webhook tardio não reabre a sessão local pausada');
});

test('desconectar sem sessão: DELETE recusado, mas o backend confirma QR → encerra sem erro', async () => {
  const saved = { WHATSAPP_PROVIDER: process.env.WHATSAPP_PROVIDER, CHATBOT_BACKEND_URL: process.env.CHATBOT_BACKEND_URL, CHATBOT_BACKEND_KEY: process.env.CHATBOT_BACKEND_KEY };
  process.env.WHATSAPP_PROVIDER = 'chatbot_backend';
  process.env.CHATBOT_BACKEND_URL = 'https://backend.test';
  process.env.CHATBOT_BACKEND_KEY = 'k'.repeat(24);
  try {
    const conexao = await import('./whatsapp-conexao-kytto.js');
    const estado = conexao.obterConexao('emp-sem-sessao');
    estado.state = 'qr';
    estado.ativo = true;
    const metodos = [];
    const result = await conexao.desconectar('emp-sem-sessao', { fetchImpl: async (_url, opts) => {
      metodos.push(opts.method);
      return opts.method === 'DELETE'
        ? { ok: false, status: 400, text: async () => JSON.stringify({ message: 'no session' }) }
        : { ok: true, status: 200, text: async () => JSON.stringify({ state: 'qr' }) };
    } });
    assert.deepEqual(metodos, ['DELETE', 'GET'], 'DELETE uma vez só; depois só leitura');
    assert.equal(result.ok, true);
    assert.equal(result.conexao.state, 'close');
    assert.equal(result.conexao.ativo, false);
  } finally {
    for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});

test('mantém conexão Cliente e Gestão independentes na mesma empresa', async () => {
  const conexao = await import('./whatsapp-conexao-kytto.js');
  const cliente = conexao.obterConexao('emp-a', 'cliente');
  const gestao = conexao.obterConexao('emp-a', 'gestao');
  assert.notEqual(cliente, gestao);
  assert.equal(cliente.tipoCanal, 'cliente');
  assert.equal(gestao.tipoCanal, 'gestao');
  conexao.configurar('emp-a', { instance: 'dino-gestao-1' }, { podeTrocarInstancia: true, tipoCanal: 'gestao' });
  assert.equal(conexao.obterConexao('emp-a', 'cliente').instance, 'dino-1');
  assert.equal(conexao.obterConexao('emp-a', 'gestao').instance, 'dino-gestao-1');
});

test('mantém Cliente, Gestão e Lançamentos independentes na mesma empresa', async () => {
  const conexao = await import('./whatsapp-conexao-kytto.js');
  const cliente = conexao.obterConexao('emp-a', 'cliente');
  const gestao = conexao.obterConexao('emp-a', 'gestao');
  const lancamentos = conexao.obterConexao('emp-a', 'lancamentos');
  cliente.state = 'open';
  gestao.state = 'qr';
  lancamentos.state = 'connecting';
  assert.notEqual(cliente, gestao);
  assert.notEqual(cliente, lancamentos);
  assert.notEqual(gestao, lancamentos);
  assert.equal(conexao.obterConexao('emp-a', 'cliente').state, 'open');
  assert.equal(conexao.obterConexao('emp-a', 'gestao').state, 'qr');
  assert.equal(conexao.obterConexao('emp-a', 'lancamentos').state, 'connecting');
});

test('gera código de pareamento somente para a sessão interna atribuída e salva a referência', async () => {
  process.env.WAHA_CONTROL_URL = 'https://bridge.test';
  process.env.WAHA_CONTROL_BRIDGE_SECRET = 's'.repeat(32);
  const calls = [];
  const oldFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    calls.push([String(url), options]);
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => String(url).endsWith('/provision') ? { status: 'SCAN_QR_CODE' } : { code: '1234-5678' },
    };
  };
  try {
    const conexao = await import('./whatsapp-conexao-kytto.js');
    conexao.configurar('emp-a', { instance: 'private-lancamentos' }, { podeTrocarInstancia: true, tipoCanal: 'lancamentos' });
    const result = await conexao.solicitarCodigoPareamento('emp-a', { phoneNumber: '+55 (11) 99999-9999', tipoCanal: 'lancamentos' });
    assert.equal(result.ok, true);
    assert.equal(result.pairingCode, '1234-5678');
    assert.equal(result.conexao.state, 'connecting');
    assert.equal(calls.length, 2);
    assert.match(calls[1][0], /\/v1\/sessions\/private-lancamentos\/pairing-code$/);
    assert.match(calls[1][1].body, /5511999999999/);
    assert.equal(conexao.visaoPublica(conexao.obterConexao('emp-a', 'lancamentos'), { numeroCompleto: true }).phoneReference, '5511999999999');
  } finally {
    global.fetch = oldFetch;
  }
});
