import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { registerInteligenciaVendasRoutes } from './dino-inteligencia-vendas-routes.js';

test('Controle Estrito de Permissões Multi-Tenant em Como Vender Mais com IA', async () => {
  const app = express();
  app.use(express.json());

  // Simula usuários
  const mockUserRodrigo = {
    email: 'rodrigo.goncalves@kytto.com.br',
    username: 'rrodrigogon',
    role: 'admin',
    platformAdmin: true,
  };

  const mockUserGuilherme = {
    email: 'guicunha@barbeariadino.com.br',
    username: 'dino',
    role: 'admin',
    platformAdmin: false,
    empresaId: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
  };

  const mockUserSilvester = {
    email: 'silvester@stallonenutre.com.br',
    username: 'silvester',
    role: 'admin',
    platformAdmin: false,
    empresaId: '31f70c83-9172-40c2-945f-9e793b5048be',
  };

  let currentUser = mockUserGuilherme;
  const mockAuth = (req, res, next) => {
    req.user = currentUser;
    next();
  };
  const mockRequireStaff = (req, res, next) => next();

  const isAdminGlobal = (user) => {
    const ident = String(user?.email || user?.username || '').toLowerCase();
    return Boolean(user?.platformAdmin || ident.includes('rodrigo.goncalves') || ident.includes('rrodrigogon'));
  };

  const isGuilhermeUser = (user) => {
    if (isAdminGlobal(user)) return false;
    const ident = String(user?.email || user?.username || '').toLowerCase();
    return ident.includes('guilherme') || ident.includes('guicunha') || ident.includes('dino');
  };

  const isSilvesterUser = (user) => {
    if (isAdminGlobal(user)) return false;
    const ident = String(user?.email || user?.username || '').toLowerCase();
    return ident.includes('silvester') || ident.includes('stallone');
  };

  const fakeDb = () => ({
    clientesKytto: { empresas: { dino: { clientes: [] }, stallone: { clientes: [] } } },
    dinoInteligenciaConfig: {},
  });

  registerInteligenciaVendasRoutes(app, {
    db: fakeDb,
    auth: mockAuth,
    requireStaff: mockRequireStaff,
    isAdminGlobal,
    isGuilhermeUser,
    isSilvesterUser,
  });

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Guilherme consulta empresas autorizadas -> apenas Dino
    currentUser = mockUserGuilherme;
    const resGui = await fetch(`${baseUrl}/api/admin/inteligencia-vendas/empresas-autorizadas`).then((r) => r.json());
    assert.equal(resGui.ehAdminPlataforma, false, 'Guilherme não pode ser Admin Global');
    assert.equal(resGui.empresas.length, 1, 'Guilherme deve ter exatamente 1 empresa autorizada');
    assert.equal(resGui.empresas[0].id, 'dino', 'A única empresa autorizada de Guilherme é a Dino');

    // 2. Guilherme tenta acessar dados de Stallone -> 403 Forbidden
    currentUser = mockUserGuilherme;
    const resBloqueio = await fetch(`${baseUrl}/api/admin/inteligencia-vendas?empresaId=stallone`);
    assert.equal(resBloqueio.status, 403, 'Acesso de Guilherme a Stallone deve retornar 403 Forbidden');
    const erroJson = await resBloqueio.json();
    assert.equal(erroJson.code, 'TENANT_FORBIDDEN', 'Código de erro deve ser TENANT_FORBIDDEN');
    assert.equal(erroJson.empresaPermitida, 'dino', 'Deve indicar permissão exclusiva para Dino');

    // 3. Guilherme acessa Dino com sucesso -> 200 OK
    currentUser = mockUserGuilherme;
    const resDinoOk = await fetch(`${baseUrl}/api/admin/inteligencia-vendas?empresaId=dino`);
    assert.equal(resDinoOk.status, 200, 'Guilherme deve acessar Dino normalmente');

    // 4. Rodrigo (Proprietário) consulta empresas autorizadas -> todas as 4 empresas
    currentUser = mockUserRodrigo;
    const resRod = await fetch(`${baseUrl}/api/admin/inteligencia-vendas/empresas-autorizadas`).then((r) => r.json());
    assert.equal(resRod.ehAdminPlataforma, true, 'Rodrigo deve ser identificado como Admin Global');
    assert.equal(resRod.empresas.length, 4, 'Rodrigo deve visualizar todas as 4 empresas da holding');

    // 5. Rodrigo acessa qualquer empresa com sucesso (Dino, Stallone, Agro Open)
    currentUser = mockUserRodrigo;
    const resRodStallone = await fetch(`${baseUrl}/api/admin/inteligencia-vendas?empresaId=stallone`);
    assert.equal(resRodStallone.status, 200, 'Rodrigo tem acesso total a Stallone');

    // 6. Silvester consulta empresas autorizadas -> Stallone e Agro Open
    currentUser = mockUserSilvester;
    const resSilv = await fetch(`${baseUrl}/api/admin/inteligencia-vendas/empresas-autorizadas`).then((r) => r.json());
    assert.equal(resSilv.ehAdminPlataforma, false, 'Silvester não pode ser Admin Global');
    assert.equal(resSilv.empresas.length, 2, 'Silvester deve ter acesso a 2 empresas');
    assert.deepEqual(
      resSilv.empresas.map((e) => e.id),
      ['stallone', 'agroopen'],
      'Empresas autorizadas devem ser stallone e agroopen'
    );
  } finally {
    server.close();
  }
});
