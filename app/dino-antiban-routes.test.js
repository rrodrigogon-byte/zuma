import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import { registerDinoAntibanRoutes } from './dino-antiban-routes.js';

async function withServer(appSetup, callback) {
  const app = express();
  app.use(express.json());
  appSetup(app);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  try {
    return await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('GET /api/admin/barbearia/antiban retorna estado de aquecimento e regras', async () => {
  await withServer((app) => {
    registerDinoAntibanRoutes(app, { legacyEmpresaId: () => 'emp_teste_antiban' });
  }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/admin/barbearia/antiban`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.ok(data.antiban);
    assert.ok(data.antiban.estagio);
    assert.ok(data.antiban.limiteDiario > 0);
    assert.ok(data.janelaEnvio);
  });
});

test('POST /api/admin/barbearia/antiban/config atualiza estagio do chip', async () => {
  await withServer((app) => {
    registerDinoAntibanRoutes(app, { legacyEmpresaId: () => 'emp_teste_antiban_cfg' });
  }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/admin/barbearia/antiban/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estagio: 'maduro', limiteDiarioPersonalizado: 250 }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.equal(data.antiban.estagio, 'maduro');
    assert.equal(data.antiban.limiteDiario, 250);
  });
});

test('POST /api/admin/barbearia/antiban/opt-out bloqueia numero', async () => {
  await withServer((app) => {
    registerDinoAntibanRoutes(app, { legacyEmpresaId: () => 'emp_teste_antiban_opt' });
  }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/admin/barbearia/antiban/opt-out`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telefone: '65999998888', motivo: 'teste_unitario' }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
  });
});

test('POST /api/admin/barbearia/antiban/previa-humanizada gera mensagem com spintax', async () => {
  await withServer((app) => {
    registerDinoAntibanRoutes(app, { legacyEmpresaId: () => 'emp_teste_antiban' });
  }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/admin/barbearia/antiban/previa-humanizada`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clienteNome: 'Pedro Alvares', modelo: 'essencial' }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.match(data.previa, /Pedro/);
    assert.match(data.previa, /SAIR/);
  });
});
