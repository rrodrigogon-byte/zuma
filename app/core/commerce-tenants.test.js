import assert from 'node:assert/strict';
import test from 'node:test';
import { db } from './database.js';
import { provisionCommerceTenant, publicConfig, validateProvisioningInput } from './commerce-tenants.js';

const ids = {
  empresa: '11111111-1111-4111-8111-111111111111',
  sourceUser: '22222222-2222-4222-8222-222222222222',
  tenantUser: '33333333-3333-4333-8333-333333333333',
  loja: '44444444-4444-4444-8444-444444444444',
  role: '55555555-5555-4555-8555-555555555555',
  storefront: '66666666-6666-4666-8666-666666666666',
};

const validInput = {
  nomeFantasia: 'Dino',
  razaoSocial: 'Dino Comércio e Serviços Ltda.',
  cnpj: '12345678000195',
  tipoNegocio: 'barbearia',
  adminEmail: 'admin@example.com',
  adminName: 'Admin Dino',
  alias: 'dino',
  brandKey: 'dino',
  lojaCodigo: 'DINO-MATRIZ',
  storefrontCodigo: 'dino-web',
  confirmAdminAccess: true,
  publicConfig: { displayName: 'Dino', tagline: 'Barbearia e perfumaria.' },
};

function fakeTransaction({ aliasInsertAllowed = true, existingCompany = false } = {}) {
  const calls = [];
  const query = async (sql, params = []) => {
    calls.push({ sql, params });
    if (sql.includes('FROM usuarios') && sql.includes('lower(email)')) return { rows: [{ id: ids.sourceUser, email: 'admin@example.com', senha_hash: 'hash-reutilizado', nome_completo: 'Admin Existente' }] };
    if (sql.includes('FROM empresas') && sql.includes('WHERE cnpj')) return { rows: existingCompany ? [{ id: ids.empresa, nome: 'Dino', cnpj: validInput.cnpj, razao_social: validInput.razaoSocial, ativa: true, tipo_negocio: 'barbearia' }] : [] };
    if (sql.includes('INSERT INTO empresas')) return { rows: [{ id: ids.empresa, nome: 'Dino', cnpj: validInput.cnpj, razao_social: validInput.razaoSocial, ativa: true, tipo_negocio: 'barbearia' }] };
    if (sql.includes('FROM commerce_storefront_aliases a') && sql.includes('FOR UPDATE')) return { rows: [] };
    if (sql.includes('INSERT INTO usuarios ')) return { rows: [{ id: ids.tenantUser, empresa_id: ids.empresa, email: 'admin@example.com', nome_completo: 'Admin Dino', ativo: true, role: 'admin' }] };
    if (sql.includes('INSERT INTO lojas ')) return { rows: [{ id: ids.loja, empresa_id: ids.empresa, codigo: 'DINO-MATRIZ', nome: 'Dino', nome_fantasia: 'Dino', timezone: 'America/Sao_Paulo', ativa: true }] };
    if (sql.includes('FROM commerce_roles')) return { rows: [{ id: ids.role }] };
    if (sql.includes('INSERT INTO commerce_memberships')) return { rows: [] };
    if (sql.includes('INSERT INTO usuarios_lojas')) return { rows: [] };
    if (sql.includes('INSERT INTO commerce_storefronts')) return { rows: [{ id: ids.storefront, empresa_id: ids.empresa, loja_id: ids.loja, codigo: 'dino-web', nome: 'Dino · E-commerce', canal: 'web', status: 'draft', moeda: 'BRL', timezone: 'America/Sao_Paulo', configuracoes: {} }] };
    if (sql.includes('INSERT INTO commerce_storefront_aliases')) return { rows: aliasInsertAllowed ? [{ empresa_id: ids.empresa, storefront_id: ids.storefront, alias: 'dino' }] : [] };
    if (sql.includes('INSERT INTO commerce_inventory_locations')) return { rows: [] };
    if (sql.includes('INSERT INTO commerce_shipping_methods')) return { rows: [] };
    throw new Error(`SQL não previsto no teste: ${sql.slice(0, 100)}`);
  };
  return { calls, query };
}

async function withTransaction(fake, callback) {
  const original = db.transaction;
  db.transaction = async fn => fn({ query: fake.query });
  try { return await callback(); } finally { db.transaction = original; }
}

test('provisionamento exige confirmação humana da concessão administrativa', () => {
  assert.throws(
    () => validateProvisioningInput({ ...validInput, confirmAdminAccess: false }),
    error => error.code === 'TENANT_ADMIN_ACCESS_CONFIRMATION_REQUIRED',
  );
});

test('normaliza tenant sem aceitar logo inseguro ou cor arbitrária', () => {
  const payload = validateProvisioningInput({ ...validInput, publicConfig: { logoUrl: 'http://inseguro.example/logo.png', colors: { accent: 'red' } } });
  assert.equal(payload.adminEmail, 'admin@example.com');
  assert.equal(payload.storeAlias, 'dino');
  assert.equal(payload.public.logoUrl, '');
  assert.equal(payload.public.colors.accent, '#6E7CE0');
});

test('publicConfig aceita somente URL HTTPS e cores hexadecimais completas', () => {
  const value = publicConfig({ logoUrl: 'https://cdn.example/logo.svg', colors: { accent: '#123abc' } }, 'Dino');
  assert.equal(value.logoUrl, 'https://cdn.example/logo.svg');
  assert.equal(value.colors.accent, '#123ABC');
});

test('provisiona empresa, unidade, membership, storefront, alias, estoque e retirada sem criar catálogo ou credenciais', async () => {
  const fake = fakeTransaction();
  const result = await withTransaction(fake, () => provisionCommerceTenant(validInput));
  assert.equal(result.created, true);
  assert.equal(result.alias, 'dino');
  assert.equal(result.storefront.status, 'draft');
  const sql = fake.calls.map(call => call.sql).join('\n');
  assert.match(sql, /ON CONFLICT \(empresa_id, usuario_id\) WHERE loja_id IS NULL/);
  assert.match(sql, /commerce_storefront_aliases\.empresa_id = EXCLUDED\.empresa_id/);
  assert.match(sql, /INSERT INTO commerce_inventory_locations/);
  assert.match(sql, /INSERT INTO commerce_shipping_methods/);
  assert.doesNotMatch(sql, /INSERT INTO commerce_products|INSERT INTO commerce_prices|INSERT INTO commerce_payments/);
  assert.equal(fake.calls.some(call => call.params.includes('hash-reutilizado')), true);
});

test('reexecução sobre a mesma empresa permanece reconciliação e não nova criação', async () => {
  const fake = fakeTransaction({ existingCompany: true });
  const result = await withTransaction(fake, () => provisionCommerceTenant(validInput));
  assert.equal(result.created, false);
  assert.equal(fake.calls.filter(call => call.sql.includes('INSERT INTO empresas')).length, 0);
});

test('conflito concorrente de alias não pode transferir o canal para outro tenant', async () => {
  const fake = fakeTransaction({ aliasInsertAllowed: false });
  await assert.rejects(
    withTransaction(fake, () => provisionCommerceTenant(validInput)),
    error => error.code === 'STOREFRONT_ALIAS_CONFLICT',
  );
});
