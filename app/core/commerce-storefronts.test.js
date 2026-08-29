import assert from 'node:assert/strict';
import test from 'node:test';
import { createStorefront, listStorefronts, storefrontCode } from './commerce-storefronts.js';
import { listPromotionTemplates } from './commerce-promotions.js';

const empresaId = '11111111-1111-4111-8111-111111111111';

const context = { empresaId, lojaId: null, usuarioId: '66666666-6666-4666-8666-666666666666' };

test('storefrontCode normaliza identificadores válidos', () => {
  assert.equal(storefrontCode(' Loja-Centro_01 '), 'loja-centro_01');
});

test('storefrontCode rejeita identificador curto ou inválido', () => {
  assert.throws(() => storefrontCode('x'), /código da loja/);
  assert.throws(() => storefrontCode('loja com espaço'), /código da loja/);
});

test('listStorefronts retorna todos os canais do tenant sem loja ativa fixa', async () => {
  const queries = [];
  const client = { query: async (sql, values) => {
    queries.push({ sql, values });
    return { rows: [
      { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', loja_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', codigo: 'loja-principal', nome: 'Loja principal' },
      { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', loja_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', codigo: 'loja-2', nome: 'Loja 2' },
    ] };
  } };
  const result = await listStorefronts(client, { ...context, lojaId: null });
  assert.equal(result.items.length, 2);
  assert.match(queries[0].sql, /\$2::uuid IS NULL OR s\.loja_id = \$2/);
  assert.deepEqual(queries[0].values, [empresaId, null]);
});

test('createStorefront cria membership de loja para o administrador responsável', async () => {
  const queries = [];
  const loja = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', codigo: 'NOVA-LOJA', nome: 'Nova Loja', ativa: true };
  const storefront = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', empresa_id: empresaId, loja_id: loja.id, codigo: 'nova-loja', nome: 'Nova Loja', status: 'active' };
  const responses = [
    { rows: [] },
    { rows: [loja] },
    { rows: [] },
    { rows: [] },
    { rows: [storefront] },
    { rows: [] },
    { rows: [] },
  ];
  const client = { query: async (sql, values) => {
    queries.push({ sql, values });
    return responses.shift() || { rows: [] };
  } };
  const result = await createStorefront(client, context, { codigo: 'nova-loja', nome: 'Nova Loja', criarUnidade: true });
  assert.equal(result.id, storefront.id);
  assert.ok(queries.some(item => /INSERT INTO commerce_memberships/.test(item.sql)));
  assert.deepEqual(queries.find(item => /INSERT INTO commerce_memberships/.test(item.sql)).values, [empresaId, context.usuarioId, loja.id]);
});

test('templates promocionais retornam modelos globais e do tenant', async () => {
  const queries = [];
  const client = { query: async (sql, values) => {
    queries.push({ sql, values });
    return { rows: [
      { empresa_id: null, codigo: 'boas-vindas-10', tipo: 'percentage', valor: 10 },
      { empresa_id: empresaId, codigo: 'vip-15', tipo: 'percentage', valor: 15 },
    ] };
  } };
  const result = await listPromotionTemplates(client, context);
  assert.equal(result.items.length, 2);
  assert.match(queries[0].sql, /empresa_id IS NULL OR empresa_id = \$1/);
  assert.deepEqual(queries[0].values, [empresaId]);
});
