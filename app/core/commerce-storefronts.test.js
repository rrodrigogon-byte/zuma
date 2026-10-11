import assert from 'node:assert/strict';
import test from 'node:test';
import { createStorefront, listStorefronts, storefrontCode, updateStorefront } from './commerce-storefronts.js';
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

test('updateStorefront ativa canal no tenant correto e registra auditoria', async () => {
  const storefrontId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const lojaId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const current = { id: storefrontId, empresa_id: empresaId, loja_id: lojaId, codigo: 'dino-web', nome: 'Dino Web', status: 'draft' };
  const active = { ...current, status: 'active' };
  const responses = [{ rows: [current] }, { rows: [{ id: lojaId, ativa: true }] }, { rows: [active] }, { rows: [] }];
  const queries = [];
  const client = { query: async (sql, values) => {
    queries.push({ sql, values });
    return responses.shift() || { rows: [] };
  } };

  const result = await updateStorefront(client, context, storefrontId, { status: 'active' });

  assert.equal(result.status, 'active');
  assert.match(queries[0].sql, /s\.empresa_id = \$1 AND s\.id = \$2/);
  assert.deepEqual(queries[0].values, [empresaId, storefrontId]);
  const update = queries.find(item => /UPDATE commerce_storefronts/.test(item.sql));
  assert.ok(update);
  assert.match(update.sql, /status = \$3/);
  assert.deepEqual(update.values, [empresaId, storefrontId, 'active']);
  const audit = queries.find(item => /INSERT INTO commerce_audit_logs/.test(item.sql));
  assert.ok(audit);
  assert.equal(audit.values[0], empresaId);
  assert.equal(audit.values[1], lojaId);
  assert.equal(audit.values[3], 'storefront');
  assert.equal(audit.values[5], 'updated');
  assert.deepEqual(JSON.parse(audit.values[7]), { fields: ['status'] });
});

test('updateStorefront não permite remover a loja de um canal que permaneceria ativo', async () => {
  const storefrontId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const lojaId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const queries = [];
  const client = { query: async (sql, values) => {
    queries.push({ sql, values });
    if (queries.length === 1) return { rows: [{ id: storefrontId, empresa_id: empresaId, loja_id: lojaId, codigo: 'dino-web', nome: 'Dino Web', status: 'active' }] };
    throw new Error('nenhum UPDATE deve ser executado');
  } };
  await assert.rejects(
    () => updateStorefront(client, context, storefrontId, { lojaId: null }),
    error => error.code === 'STOREFRONT_OPERATIONAL_STORE_REQUIRED',
  );
  assert.equal(queries.length, 1);
});

test('updateStorefront bloqueia alteração comum quando a loja atual do canal ativo está inativa', async () => {
  const storefrontId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const lojaId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const queries = [];
  const client = { query: async (sql, values) => {
    queries.push({ sql, values });
    if (sql.includes('FROM commerce_storefronts s')) return { rows: [{ id: storefrontId, empresa_id: empresaId, loja_id: lojaId, codigo: 'dino-web', nome: 'Dino Web', status: 'active' }] };
    if (sql.includes('FROM lojas')) return { rows: [{ id: lojaId, ativa: false }] };
    throw new Error('nenhum UPDATE deve ser executado');
  } };
  await assert.rejects(
    () => updateStorefront(client, context, storefrontId, { nome: 'Novo nome' }),
    error => error.code === 'STOREFRONT_OPERATIONAL_STORE_REQUIRED',
  );
  assert.equal(queries.some(item => /UPDATE commerce_storefronts/.test(item.sql)), false);
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

 test('políticas são gravadas sob trava e sincronizadas apenas nos aliases do mesmo tenant/canal', async () => {
  const storefrontId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const lojaId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const current = {id:storefrontId,empresa_id:empresaId,loja_id:lojaId,status:'active',configuracoes:{public:{contact:{phone:'123'}}}};
  const responses = [{rows:[current]},{rows:[{id:lojaId,ativa:true}]},{rows:[current]},{rows:[]},{rows:[]}];
  const queries = [];
  const client = {query:async (sql,values) => {queries.push({sql,values});return responses.shift() || {rows:[]};}};
  await updateStorefront(client, context, storefrontId, {publicPolicies:{privacyUrl:'https://example.test/privacy'}});
  assert.match(queries[0].sql,/FOR UPDATE/);
  const config = JSON.parse(queries.find(q=>q.sql.startsWith('UPDATE commerce_storefronts')).values[2]);
  assert.equal(config.public.contact.phone,'123');
  const alias = queries.find(q=>q.sql.startsWith('UPDATE commerce_storefront_aliases'));
  assert.match(alias.sql,/empresa_id = \$1 AND storefront_id = \$2/);
  assert.deepEqual(alias.values.slice(0,2),[empresaId,storefrontId]);
  assert.deepEqual(JSON.parse(alias.values[2]),{privacyUrl:'https://example.test/privacy'});
});
