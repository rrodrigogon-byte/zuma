import assert from 'node:assert/strict';
import test from 'node:test';
import { storefrontCode } from './commerce-storefronts.js';
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
