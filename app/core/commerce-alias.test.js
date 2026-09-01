import assert from 'node:assert/strict';
import test from 'node:test';
import { createCommercePublicRouter } from './commerce-routes.js';
import { db } from './database.js';

const dino = {
  empresaId: '11111111-1111-4111-8111-111111111111',
  lojaId: '22222222-2222-4222-8222-222222222222',
  storefrontId: '33333333-3333-4333-8333-333333333333',
};

function handler(path) {
  const router = createCommercePublicRouter();
  const layer = router.stack.find(item => item.route?.path === path);
  assert.ok(layer?.route?.stack?.[0]?.handle, `rota ${path} não encontrada`);
  return layer.route.stack[0].handle;
}

function responseDouble() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

async function withDbQuery(query, callback) {
  const original = db.query;
  db.query = query;
  try { return await callback(); } finally { db.query = original; }
}

function aliasRow() {
  return {
    alias: 'dino',
    brand_key: 'dino',
    public_config: {
      displayName: 'Dino',
      tagline: 'Barbearia e perfumaria.',
      logoUrl: 'javascript:alert(1)',
      colors: { accent: '#6e7ce0', background: 'invalid' },
      segredo: 'não publicar',
    },
    id: dino.storefrontId,
    empresa_id: dino.empresaId,
    loja_id: dino.lojaId,
    codigo: 'dino-web',
    nome: 'Dino · E-commerce',
    canal: 'web',
    status: 'active',
    moeda: 'BRL',
    timezone: 'America/Sao_Paulo',
    configuracoes: { privateToken: 'não publicar' },
  };
}

test('contexto público por alias ignora x-empresa-id e publica somente marca sanitizada', async () => {
  const calls = [];
  const res = responseDouble();
  await withDbQuery(async (sql, params = []) => {
    calls.push({ sql, params });
    if (sql.includes('FROM commerce_storefront_aliases a')) return { rows: [aliasRow()] };
    if (sql.includes('FROM commerce_payment_accounts')) return { rows: [] };
    if (sql.includes('FROM commerce_shipping_accounts')) return { rows: [] };
    if (sql.includes('FROM commerce_shipping_methods')) return { rows: [] };
    throw new Error(`SQL não previsto: ${sql.slice(0, 100)}`);
  }, () => handler('/context')({
    publicStoreAlias: 'dino',
    hostname: 'setpoint.kytto.com.br',
    headers: {
      'x-empresa-id': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'x-loja-id': 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    },
  }, res));
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.storefront.id, dino.storefrontId);
  assert.equal(res.body.storefront.public.brandKey, 'dino');
  assert.equal(res.body.storefront.public.displayName, 'Dino');
  assert.equal(res.body.storefront.public.logoUrl, '');
  assert.equal(res.body.storefront.public.colors.accent, '#6E7CE0');
  assert.equal(res.body.storefront.public.colors.background, '#F7F8FA');
  assert.equal('segredo' in res.body.storefront.public, false);
  assert.equal('configuracoes' in res.body.storefront, false);
  for (const call of calls.slice(1)) assert.deepEqual(call.params, [dino.empresaId, dino.storefrontId]);
});

test('pedido público por alias sempre consulta empresa e storefront resolvidos no servidor', async () => {
  const calls = [];
  const res = responseDouble();
  await withDbQuery(async (sql, params = []) => {
    calls.push({ sql, params });
    if (sql.includes('FROM commerce_storefront_aliases a')) return { rows: [aliasRow()] };
    if (sql.includes('FROM commerce_orders o')) return { rows: [{ public_code: 'DINO-TEST', status: 'pending_payment', total: 49.9, items: [], fulfillments: [], timeline: [] }] };
    throw new Error(`SQL não previsto: ${sql.slice(0, 100)}`);
  }, () => handler('/orders/:publicCode')({
    publicStoreAlias: 'dino',
    hostname: 'setpoint.kytto.com.br',
    headers: { 'x-empresa-id': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
    params: { publicCode: 'dino-test' },
  }, res));
  assert.equal(res.statusCode, 200);
  const orderCall = calls.find(call => call.sql.includes('FROM commerce_orders o'));
  assert.deepEqual(orderCall.params, [dino.empresaId, dino.storefrontId, 'DINO-TEST']);
});

test('alias inexistente retorna 404 sem fallback para domínio ou outro tenant', async () => {
  const res = responseDouble();
  await withDbQuery(async sql => {
    if (sql.includes('FROM commerce_storefront_aliases a')) return { rows: [] };
    throw new Error('nenhuma outra consulta deveria ocorrer');
  }, () => handler('/context')({ publicStoreAlias: 'inexistente', hostname: 'loja.kytto.com.br', headers: {} }, res));
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.code, 'STOREFRONT_NOT_FOUND');
});
