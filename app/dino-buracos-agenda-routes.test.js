import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { registerInteligenciaVendasRoutes } from './dino-inteligencia-vendas-routes.js';
import { db } from './db.js';

function criarAppTeste() {
  const app = express();
  app.use(express.json());
  registerInteligenciaVendasRoutes(app, {
    db: () => db(),
    legacyEmpresaId: () => 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
    legacyLojaId: () => 'loja-dino-01',
  });
  return app;
}

test('Rotas de Buracos na Agenda: Consulta dinâmica e Ações operacionais', async () => {
  const app = criarAppTeste();
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. GET /api/admin/dino/buracos-agenda
    const resGet = await fetch(`${baseUrl}/api/admin/dino/buracos-agenda?empresaId=d0d0ac01-8e50-4b61-8c79-de4aaa916da6`);
    assert.equal(resGet.status, 200);
    const dataGet = await resGet.json();
    assert.equal(dataGet.ok, true);
    assert.ok(Array.isArray(dataGet.buracos));
    assert.ok(dataGet.buracos.length > 0);

    const hoje = dataGet.hoje;
    for (const b of dataGet.buracos) {
      assert.ok(b.data >= hoje, `Data ${b.data} deve ser maior ou igual a hoje (${hoje})`);
      assert.ok(b.data !== '2026-11-09', 'NUNCA deve retornar dia 09/11');
      assert.ok(b.profissional, 'Deve ter barbeiro');
    }

    // 2. POST /api/admin/dino/buracos-agenda/bloquear
    const resBloq = await fetch(`${baseUrl}/api/admin/dino/buracos-agenda/bloquear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        empresaId: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
        profissionalId: 'prof-mwf821h5-005',
        data: '2026-11-21',
        horario: '10:30',
        motivo: 'Compromisso externo',
      }),
    });
    assert.equal(resBloq.status, 200);
    const dataBloq = await resBloq.json();
    assert.equal(dataBloq.ok, true);
    assert.ok(dataBloq.bloqueio?.id);

    // 3. POST /api/admin/dino/buracos-agenda/encaixe
    const resEncaixe = await fetch(`${baseUrl}/api/admin/dino/buracos-agenda/encaixe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        empresaId: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
        profissionalId: 'prof-mwf821h5-005',
        data: '2026-11-21',
        horario: '11:15',
        clienteNome: 'Rodrigo Teste Encaixe',
        clienteTelefone: '5514997462929',
      }),
    });
    assert.equal(resEncaixe.status, 200);
    const dataEncaixe = await resEncaixe.json();
    assert.equal(dataEncaixe.ok, true);
    assert.ok(dataEncaixe.agendamento?.id);

  } finally {
    server.close();
  }
});
