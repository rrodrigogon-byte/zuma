import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import pg from 'pg';
import { resolveCommerceCustomer, resolveCommerceCustomerAddress } from './commerce-customer-identity.js';

const { Pool } = pg;
const connectionString = process.env.COMMERCE_IDENTITY_TEST_DATABASE_URL || '';
const enabled = Boolean(connectionString);
const pool = enabled ? new Pool({ connectionString, ssl: false, max: 8 }) : null;

const TENANT_A = 'a1111111-1111-4111-8111-111111111111';
const TENANT_B = 'b2222222-2222-4222-8222-222222222222';

async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback({ query: (sql, values = []) => client.query(sql, values) });
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function reset() {
  await pool.query('DELETE FROM commerce_customers WHERE empresa_id = ANY($1::uuid[])', [[TENANT_A, TENANT_B]]);
  await pool.query('DELETE FROM empresas WHERE id = ANY($1::uuid[])', [[TENANT_A, TENANT_B]]);
  await pool.query(
    `INSERT INTO empresas (id, nome, cnpj, razao_social, tipo_negocio)
     VALUES ($1, 'Tenant A', '91000000000001', 'Tenant A', 'loja'),
            ($2, 'Tenant B', '91000000000002', 'Tenant B', 'loja')`,
    [TENANT_A, TENANT_B],
  );
}

if (pool) after(async () => { await reset(); await pool.end(); });

const pgTest = (name, fn) => test(name, { skip: !enabled }, async () => { await reset(); await fn(); });

pgTest('duas resoluções simultâneas do mesmo e-mail/telefone criam exatamente um commerce_customer', async () => {
  const input = { nome: 'Concorrente', email: 'EMAIL@EXAMPLE.INVALID', telefone: '(11) 99999-9999' };
  const [first, second] = await Promise.all([
    transaction(trx => resolveCommerceCustomer(trx, { empresaId: TENANT_A }, input)),
    transaction(trx => resolveCommerceCustomer(trx, { empresaId: TENANT_A }, input)),
  ]);
  assert.equal(first.customer.id, second.customer.id);
  const count = await pool.query('SELECT COUNT(*)::int AS total FROM commerce_customers WHERE empresa_id=$1', [TENANT_A]);
  assert.equal(count.rows[0].total, 1);
});

pgTest('EMAIL@EXAMPLE.INVALID e email@example.invalid resolvem o mesmo customer', async () => {
  const first = await transaction(trx => resolveCommerceCustomer(trx, { empresaId: TENANT_A }, { nome: 'E-mail', email: 'EMAIL@EXAMPLE.INVALID' }));
  const second = await transaction(trx => resolveCommerceCustomer(trx, { empresaId: TENANT_A }, { nome: 'E-mail', email: 'email@example.invalid' }));
  assert.equal(first.customer.id, second.customer.id);
});

pgTest('três formatos semanticamente equivalentes de telefone resolvem o mesmo customer', async () => {
  const ids = [];
  for (const telefone of ['(11) 99999-9999', '11999999999', '+5511999999999']) {
    const result = await transaction(trx => resolveCommerceCustomer(trx, { empresaId: TENANT_A }, { nome: 'Telefone', telefone }));
    ids.push(result.customer.id);
  }
  assert.equal(new Set(ids).size, 1);
});

pgTest('e-mail de A e telefone de B retornam CONTACT_CONFLICT sem merge automático', async () => {
  const a = await transaction(trx => resolveCommerceCustomer(trx, { empresaId: TENANT_A }, { nome: 'A', email: 'a@example.invalid' }));
  const b = await transaction(trx => resolveCommerceCustomer(trx, { empresaId: TENANT_A }, { nome: 'B', telefone: '(11) 99999-9999' }));
  await assert.rejects(
    () => transaction(trx => resolveCommerceCustomer(trx, { empresaId: TENANT_A }, { nome: 'Conflito', email: 'a@example.invalid', telefone: '+5511999999999' })),
    error => error.code === 'CONTACT_CONFLICT',
  );
  assert.notEqual(a.customer.id, b.customer.id);
  const count = await pool.query('SELECT COUNT(*)::int AS total FROM commerce_customers WHERE empresa_id=$1', [TENANT_A]);
  assert.equal(count.rows[0].total, 2);
});

pgTest('customerId de A com telefone de B retorna CONTACT_CONFLICT', async () => {
  const a = await transaction(trx => resolveCommerceCustomer(trx, { empresaId: TENANT_A }, { nome: 'A', email: 'a@example.invalid' }));
  await transaction(trx => resolveCommerceCustomer(trx, { empresaId: TENANT_A }, { nome: 'B', telefone: '(11) 99999-9999' }));
  await assert.rejects(
    () => transaction(trx => resolveCommerceCustomer(trx, { empresaId: TENANT_A }, { customerId: a.customer.id, nome: 'A', email: 'a@example.invalid', telefone: '+5511999999999' })),
    error => error.code === 'CONTACT_CONFLICT',
  );
});

pgTest('endereços equivalentes concorrentes geram exatamente uma linha', async () => {
  const customer = await transaction(trx => resolveCommerceCustomer(trx, { empresaId: TENANT_A }, { nome: 'Endereço', email: 'address@example.invalid' }));
  const input = { destinatario: 'Endereço', cep: '12345-678', logradouro: 'Rua das Flores', numero: '10', complemento: 'Sala 1', bairro: 'Centro', cidade: 'Cuiabá', estado: 'MT' };
  const [first, second] = await Promise.all([
    transaction(trx => resolveCommerceCustomerAddress(trx, { empresaId: TENANT_A }, customer.customer.id, input)),
    transaction(trx => resolveCommerceCustomerAddress(trx, { empresaId: TENANT_A }, customer.customer.id, { ...input, cep: '12345678', logradouro: ' rua das flores ' })),
  ]);
  assert.equal(first.address.id, second.address.id);
  const count = await pool.query('SELECT COUNT(*)::int AS total FROM commerce_customer_addresses WHERE empresa_id=$1 AND customer_id=$2', [TENANT_A, customer.customer.id]);
  assert.equal(count.rows[0].total, 1);
});

pgTest('o mesmo contato em tenants distintos cria customers distintos', async () => {
  const input = { nome: 'Isolado', email: 'tenant@example.invalid', telefone: '(11) 98888-7777' };
  const a = await transaction(trx => resolveCommerceCustomer(trx, { empresaId: TENANT_A }, input));
  const b = await transaction(trx => resolveCommerceCustomer(trx, { empresaId: TENANT_B }, input));
  assert.notEqual(a.customer.id, b.customer.id);
});
