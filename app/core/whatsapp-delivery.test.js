import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import { enviarMensagem } from './whatsapp.js';

async function withServer(handler, callback) {
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    return await callback(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('enviarMensagem usa o payload Evolution atual e normaliza telefone sem expor mensagem no retorno', async () => {
  let requestBody;
  await withServer((req, res) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      requestBody = JSON.parse(raw);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ key: { id: 'provider-id' } }));
    });
  }, async baseUrl => {
    const result = await enviarMensagem({ whatsapp_api_url: baseUrl, whatsapp_instance: 'dino', whatsapp_api_key: 'secret' }, '65999990000', 'Mensagem privada');
    assert.equal(result.ok, true);
    assert.equal(result.uncertain, false);
    assert.deepEqual(requestBody, { number: '5565999990000', text: 'Mensagem privada', delay: 1200 });
    assert.equal(JSON.stringify(result).includes('Mensagem privada'), false);
    const scoped = await enviarMensagem({ empresa_id: '44444444-4444-4444-8444-444444444444', loja_id: '22222222-2222-4222-8222-222222222222', whatsapp_api_url: baseUrl, whatsapp_instance: 'outro-canal', whatsapp_api_key: 'synthetic-tenant-key' }, '65999990000', 'Teste sintético escopado');
    assert.equal(scoped.ok, true);
  });
});

test('enviarMensagem trata HTTP 429 como retry seguro e HTTP 500 como resultado incerto', async () => {
  for (const [status, expected] of [[429, { retryable: true, uncertain: false }], [500, { retryable: false, uncertain: true }]]) {
    await withServer((_req, res) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ message: 'falha controlada' }));
    }, async baseUrl => {
      const result = await enviarMensagem({ whatsapp_api_url: baseUrl, whatsapp_instance: 'dino', whatsapp_api_key: 'secret' }, '65999990000', 'Teste');
      assert.equal(result.ok, false);
      assert.equal(result.retryable, expected.retryable);
      assert.equal(result.uncertain, expected.uncertain);
      assert.equal(result.status, status);
    });
  }
});

test('enviarMensagem trata falha de conexão como incerta e não sugere retry automático', async () => {
  const result = await enviarMensagem({ whatsapp_api_url: 'http://127.0.0.1:1', whatsapp_instance: 'dino', whatsapp_api_key: 'secret' }, '65999990000', 'Teste');
  assert.equal(result.ok, false);
  assert.equal(result.retryable, false);
  assert.equal(result.uncertain, true);
  assert.equal(result.status, null);
  assert.equal(typeof result.error, 'string');
});
