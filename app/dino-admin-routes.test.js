import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { registerDinoAdminRoutes } from './dino-admin-routes.js';

async function withAuditRoute({ coreEnabled, permission, context }, check) {
  const previous = process.env.COMMERCE_CORE_ENABLED;
  process.env.COMMERCE_CORE_ENABLED = coreEnabled ? '1' : '0';
  const app = express();
  const queries = [];
  const permissions = [];
  app.use((req, res, next) => {
    req.user = { role: 'admin', empresaId: 'tenant-a', lojaId: 'store-a' };
    next();
  });
  registerDinoAdminRoutes(app, {
    db: () => ({ auditoria: [
      { id: 1, empresaId: 'tenant-a', ts: '2026-09-30T00:00:00Z', acao: 'LEGADO', user: 'operador' },
      { id: 2, empresaId: 'tenant-b', ts: '2026-09-30T00:00:00Z', acao: 'OUTRA_EMPRESA', user: 'operador' },
    ] }),
    legacyEmpresaId: req => req.user.empresaId,
    legacyLojaId: req => req.user.lojaId,
    requireCommercePermission: async (req, name) => {
      permissions.push(name);
      if (permission) throw Object.assign(new Error('negado'), { code: permission });
      return context || { empresaId: 'tenant-a', lojaId: 'store-a' };
    },
    commerceDb: { async queryRead(sql, values) { queries.push({ sql, values }); return { rows: [] }; } },
  });
  const server = await new Promise(resolve => {
    const started = app.listen(0, '127.0.0.1', () => resolve(started));
  });
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/barbearia/auditoria`);
    await check({ response, body: await response.json(), queries, permissions });
  } finally {
    await new Promise(resolve => server.close(resolve));
    if (previous === undefined) delete process.env.COMMERCE_CORE_ENABLED;
    else process.env.COMMERCE_CORE_ENABLED = previous;
  }
}

test('Core ativo exige audit.read antes de tocar em log local ou banco', async () => {
  await withAuditRoute({ coreEnabled: true, permission: 'PERMISSION_DENIED' }, ({ response, body, queries, permissions }) => {
    assert.equal(response.status, 403);
    assert.equal(body.code, 'PERMISSION_DENIED');
    assert.equal(body.itens, undefined);
    assert.deepEqual(permissions, ['audit.read']);
    assert.equal(queries.length, 0);
  });
});

test('membership restrita à loja não recebe eventos antigos sem loja nem SQL cross-store', async () => {
  await withAuditRoute({ coreEnabled: true }, ({ response, body, queries, permissions }) => {
    assert.equal(response.status, 200);
    assert.deepEqual(permissions, ['audit.read']);
    assert.deepEqual(body.itens, []);
    assert.equal(body.fontes.sistema, false);
    assert.equal(queries.length, 1);
    assert.match(queries[0].sql, /l\.loja_id = \$3/);
    assert.deepEqual(queries[0].values, ['tenant-a', 300, 'store-a']);
  });
});

test('Core desligado mantém auditoria local do tenant sem supor permissão PostgreSQL', async () => {
  await withAuditRoute({ coreEnabled: false }, ({ response, body, queries, permissions }) => {
    assert.equal(response.status, 200);
    assert.equal(body.itens.length, 1);
    assert.equal(body.itens[0].acao, 'LEGADO');
    assert.deepEqual(permissions, []);
    assert.deepEqual(queries, []);
  });
});
