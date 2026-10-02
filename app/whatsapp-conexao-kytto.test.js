import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { reset } from './db.js';

beforeEach(() => { reset(); process.env.CHATBOT_BACKEND_INSTANCE = 'dino-1'; delete process.env.CHATBOT_BACKEND_EMPRESA_ID; });
afterEach(() => { reset(); delete process.env.CHATBOT_BACKEND_INSTANCE; delete process.env.CHATBOT_BACKEND_EMPRESA_ID; });

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
