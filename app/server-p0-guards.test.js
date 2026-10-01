import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./server.js', import.meta.url), 'utf8');

const destructiveRoutes = [
  '/api/admin/reset-ranking',
  '/api/admin/ranking/temporada/reset',
  '/api/admin/ranking/seed',
  '/api/admin/seed/campeoes',
  '/api/admin/seed/demo',
  '/api/admin/cardapio/reset',
  '/api/admin/reset',
];

for (const route of destructiveRoutes) {
  test(`${route} possui guard destrutivo fail-closed`, () => {
    const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(source, new RegExp(`app\\.post\\('${escaped}'[^\\n]*destructiveAdminGuard`));
  });
}

const destructiveRoutesByMethod = [
  ['delete', '/api/admin/loja/:id'],
  ['post', '/api/admin/tef/estorno/:id'],
  ['delete', '/api/admin/ligas/:id'],
  ['delete', '/api/admin/ligas/:id/rodadas'],
];

for (const [method, route] of destructiveRoutesByMethod) {
  test(`${route} bloqueia operação destrutiva em produção`, () => {
    const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(source, new RegExp(`app\\.${method}\\('${escaped}'[^\\n]*destructiveAdminGuard`));
  });
}

const legacyPaymentMutations = [
  '/api/loja/checkout/:id/pagamento',
  '/api/pagar',
  '/api/pagamento/:id',
  '/api/pagamento/:id/confirmar',
  '/api/pagamento/webhook',
  '/api/admin/pagamentos/:id',
];

for (const route of legacyPaymentMutations) {
  test(`${route} é bloqueada quando o Commerce Core está ativo`, () => {
    const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(source, new RegExp(`app\\.(?:get|post|patch)\\('${escaped}'[^\\n]*legacyPaymentMutationGuard`));
  });
}

const legacyCommerceMutations = [
  ['patch', '/api/admin/loja/reservas/:id'],
  ['post', '/api/admin/estoque/entrada'],
  ['post', '/api/admin/estoque/ajuste'],
  ['post', '/api/loja/checkout/pedido'],
  ['post', '/api/loja/:id/reservar'],
  ['post', '/api/admin/loja'],
  ['patch', '/api/admin/loja/:id'],
  ['delete', '/api/admin/loja/:id'],
  ['post', '/api/admin/loja/vender'],
  ['post', '/api/loja/pedido'],
  ['patch', '/api/admin/loja/pedidos/:id'],
  ['post', '/api/admin/tef/estorno/:id'],
];

for (const [method, route] of legacyCommerceMutations) {
  test(`${route} não muta o legado quando o Commerce Core está ativo`, () => {
    const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(source, new RegExp(`app\\.${method}\\('${escaped}'[^\\n]*legacyCommerceMutationGuard`));
  });
}

test('leituras legadas puras permanecem sem guard de mutação', () => {
  assert.match(source, /app\.get\('\/api\/admin\/loja'[^\n]*\(req,res\)=>/);
  assert.match(source, /app\.get\('\/api\/admin\/loja\/pedidos'[^\n]*\(req,res\)=>/);
  assert.match(source, /app\.get\('\/api\/admin\/tef\/transacoes'[^\n]*\(req,res\)=>/);
});

test('readiness canônico é sanitizado e consulta PostgreSQL somente com Core ativo', () => {
  assert.match(source, /app\.get\('\/health', async \(req, res\) =>/);
  assert.match(source, /COMMERCE_CORE_ENABLED !== '1'/);
  assert.match(source, /commerceDb\.queryRead\(`SELECT 1 FROM commerce_schema_migrations LIMIT 1`\)/);
  assert.match(source, /status\(503\)\.json\(\{ status: 'not_ready', code: 'COMMERCE_DATABASE_UNAVAILABLE' \}\)/);
});

test('observabilidade de estoque legado/Core é GET e exige reports.read', () => {
  assert.match(source, /app\.get\('\/api\/admin\/commerce\/operations\/inventory-divergence'/);
  assert.match(source, /requireCommercePermission\(req, 'reports\.read'\)/);
  assert.match(source, /compareLegacyAndCoreInventory/);
});
