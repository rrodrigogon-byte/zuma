import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { loadCommerceSalesDetail, registerDinoAdminRoutes } from './dino-admin-routes.js';

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

test('detalhe Commerce limita os pedidos à storefront da unidade ativa', async () => {
  const queries = [];
  const result = await loadCommerceSalesDetail({
    async queryRead(sql, values) { queries.push({ sql, values }); return { rows: [] }; },
  }, { empresaId: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6', lojaId: 'ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8' }, '2026-09-01T04:00:00.000Z', '2026-10-01T04:00:00.000Z');
  assert.deepEqual(result, { revenueItems: 0, cost: 0, topProducts: [] });
  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /o\.storefront_id IN \(SELECT id FROM commerce_storefronts WHERE empresa_id = \$1 AND loja_id = \$5::uuid\)/);
  assert.deepEqual(queries[0].values.slice(0, 3), ['d0d0ac01-8e50-4b61-8c79-de4aaa916da6', '2026-09-01T04:00:00.000Z', '2026-10-01T04:00:00.000Z']);
  assert.equal(queries[0].values[4], 'ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8');
});

test('BI usa apenas pedidos Commerce confirmados e mostra pendências e capturas separadas', async () => {
  const previous = process.env.COMMERCE_CORE_ENABLED;
  process.env.COMMERCE_CORE_ENABLED = '1';
  const app = express();
  app.use((req, _res, next) => { req.user = { role: 'admin', empresaId: 'tenant-a', lojaId: 'store-a' }; next(); });
  registerDinoAdminRoutes(app, {
    legacyEmpresaId: req => req.user.empresaId,
    legacyLojaId: req => req.user.lojaId,
    db: () => ({}), audit: () => {}, save: () => {},
    requireCommercePermission: async () => ({ empresaId: 'tenant-a', lojaId: 'store-a' }),
    salesReport: async () => ({
      summary: { gross_total: '13206', confirmed_total: '6', confirmed_orders: 1, pending_total: '13200', pending_orders: 1, captured_total: '6' },
      daily: [{ day: '2026-09-10', total: '13206', confirmed_total: '6' }],
      capturedDaily: [{ day: '2026-09-11', total: '6', transactions: 1 }],
    }),
    commerceDb: { async queryRead() { return { rows: [] }; } },
    barbeariaErpKytto: { listarAgendamentos: () => [], listarComandasBarbearia: () => [], listarVendasRevenda: () => [], listarProdutosRevenda: () => [], listarProfissionais: () => [], listarHistoricoAtendimentos: () => [] },
    financeiroKytto: { listarLancamentos: () => [] },
    clientesKytto: { listarClientes: () => [] },
  });
  const server = await new Promise(resolve => { const started = app.listen(0, '127.0.0.1', () => resolve(started)); });
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/barbearia/bi?inicio=2026-09-01&fim=2026-09-30`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.fontesReceita.find((item) => item.id === 'ecommerce').receita, 6);
    assert.equal(body.lojaOnline.receitaConfirmada, 6);
    assert.equal(body.lojaOnline.pendentePagamento, 13200);
    assert.equal(body.lojaOnline.capturadoNoPeriodo, 6);
    assert.equal(body.serieDiaria.find((item) => item.dia === '2026-09-10').ecommerce, 6);
  } finally {
    await new Promise(resolve => server.close(resolve));
    if (previous === undefined) delete process.env.COMMERCE_CORE_ENABLED;
    else process.env.COMMERCE_CORE_ENABLED = previous;
  }
});
