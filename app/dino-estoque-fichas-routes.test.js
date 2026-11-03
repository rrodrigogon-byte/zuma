import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { registerDinoEstoqueFichasRoutes } from './dino-estoque-fichas-routes.js';

describe('Dino Estoque, Fichas e Inventário Routes', () => {
  let server;
  let port;
  const baseUrl = () => `http://127.0.0.1:${port}`;

  before(async () => {
    const app = express();
    app.use(express.json());

    const mockAuth = (req, res, next) => {
      req.user = { email: 'admin@barbeariadino.com.br', empresaId: 'dino-test' };
      next();
    };
    const mockStaff = (req, res, next) => next();
    const mockLegacyEmpresa = () => 'dino-test';

    registerDinoEstoqueFichasRoutes(app, {
      auth: mockAuth,
      requireStaff: mockStaff,
      legacyEmpresaId: mockLegacyEmpresa
    });

    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        port = server.address().port;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
  });

  test('GET /api/admin/estoque deve retornar lista de estoque', async () => {
    const res = await fetch(`${baseUrl()}/api/admin/estoque`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.ok(Array.isArray(data.estoque));
  });

  test('POST /api/admin/estoque/ocorrencias deve registrar perda com sucesso', async () => {
    const res = await fetch(`${baseUrl()}/api/admin/estoque/ocorrencias`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        produtoId: 'prod-teste',
        qtd: 2,
        tipo: 'quebra',
        motivo: 'Frasco quebrou na bancada'
      })
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.equal(data.ocorrencia.tipo, 'quebra');
    assert.equal(data.ocorrencia.qtd, 2);
  });

  test('GET /api/admin/estoque/inventarios deve listar inventarios', async () => {
    const res = await fetch(`${baseUrl()}/api/admin/estoque/inventarios`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.ok(Array.isArray(data.inventarios));
  });

  test('GET e POST /api/admin/fichas-tecnicas deve salvar e listar ficha tecnica', async () => {
    const criarRes = await fetch(`${baseUrl()}/api/admin/fichas-tecnicas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        produtoFinalId: 'corte-pomada-' + Date.now(),
        nomeProduto: 'Combo Corte + Pomada',
        categoria: 'Combos',
        itens: [
          { produtoId: 'insumo-pomada', nome: 'Pomada', qtd: 0.1, unidade: 'UN', custoUnitario: 10 }
        ]
      })
    });
    if (criarRes.status !== 201) console.error("FALHA CRIAR:", await criarRes.text()); assert.equal(criarRes.status, 201);
    const criarData = await criarRes.json();
    assert.equal(criarData.ok, true);
    assert.equal(criarData.ficha.nomeProduto, 'Combo Corte + Pomada');

    const listaRes = await fetch(`${baseUrl()}/api/admin/fichas-tecnicas`);
    assert.equal(listaRes.status, 200);
    const listaData = await listaRes.json();
    assert.ok(listaData.fichas.some(f => f.produtoFinalId.startsWith('corte-pomada-')));
  });
});
