import assert from 'node:assert/strict';
import test from 'node:test';
import {
  customerAddressFingerprint,
  normalizeBrazilianPhone,
  normalizeCustomerAddress,
  normalizeCustomerEmail,
  resolveCommerceCustomer,
} from './commerce-customer-identity.js';

const EMPRESA = '11111111-1111-4111-8111-111111111111';
const CUSTOMER_A = '22222222-2222-4222-8222-222222222222';
const CUSTOMER_B = '33333333-3333-4333-8333-333333333333';

test('normaliza variações equivalentes de e-mail e telefone brasileiro', () => {
  assert.equal(normalizeCustomerEmail(' EMAIL@EXAMPLE.INVALID '), 'email@example.invalid');
  assert.equal(normalizeCustomerEmail('email@example.invalid'), 'email@example.invalid');
  const phones = ['(11) 99999-9999', '11999999999', '+5511999999999'].map(normalizeBrazilianPhone);
  assert.deepEqual(phones, ['5511999999999', '5511999999999', '5511999999999']);
});

test('resolveCommerceCustomer bloqueia merge automático quando e-mail e telefone apontam para customers diferentes', async () => {
  const calls = [];
  const trx = { async query(sql, values) {
    calls.push({ sql, values });
    if (sql.includes('pg_advisory_xact_lock')) return { rows: [] };
    if (sql.includes('FROM commerce_customers')) return { rows: [
      { id: CUSTOMER_A, nome: 'A', email_normalizado: 'a@example.invalid', telefone_normalizado: null, bloqueado: false },
      { id: CUSTOMER_B, nome: 'B', email_normalizado: null, telefone_normalizado: '5511999999999', bloqueado: false },
    ] };
    throw new Error(`consulta inesperada: ${sql}`);
  } };
  await assert.rejects(
    () => resolveCommerceCustomer(trx, { empresaId: EMPRESA }, { nome: 'Cliente', email: 'a@example.invalid', telefone: '(11) 99999-9999' }),
    error => error.code === 'CONTACT_CONFLICT',
  );
  assert.equal(calls.some(call => call.sql.includes('UPDATE commerce_customers')), false);
  assert.equal(calls.some(call => call.sql.includes('INSERT INTO commerce_customers')), false);
});

test('resolver audita criação sem persistir nome, e-mail ou telefone no payload do evento', async () => {
  let auditValues = null;
  const created = { id: CUSTOMER_A, nome: 'Pessoa Sensível', email: 'private@example.invalid', telefone: '5511999999999' };
  const trx = { async query(sql, values) {
    if (sql.includes('pg_advisory_xact_lock')) return { rows: [] };
    if (sql.includes('FROM commerce_customers')) return { rows: [] };
    if (sql.includes('INSERT INTO commerce_customers')) return { rows: [created] };
    if (sql.includes('INSERT INTO commerce_audit_logs')) { auditValues = values; return { rows: [] }; }
    throw new Error(`consulta inesperada: ${sql}`);
  } };
  await resolveCommerceCustomer(trx, { empresaId: EMPRESA, identitySource: 'checkout' }, { nome: created.nome, email: created.email, telefone: created.telefone });
  const auditPayload = JSON.stringify(auditValues);
  assert.equal(auditPayload.includes(created.nome), false);
  assert.equal(auditPayload.includes(created.email), false);
  assert.equal(auditPayload.includes(created.telefone), false);
  assert.match(auditPayload, /identity_created/);
  assert.match(auditPayload, /contactFields/);
  assert.match(auditPayload, /contact_supplied_unverified/);
  assert.match(auditPayload, /financialPrivileges/);
});

test('resolver de customer existente não altera cadastro nem consentimentos sem prova de posse', async () => {
  const existing = { id: CUSTOMER_A, nome: 'Nome Autoritativo', email: 'owner@example.invalid', telefone: '5511999999999', email_normalizado: 'owner@example.invalid', telefone_normalizado: '5511999999999', bloqueado: false, consentimentos: {} };
  const calls = [];
  const trx = { async query(sql) {
    calls.push(sql);
    if (sql.includes('pg_advisory_xact_lock')) return { rows: [] };
    if (sql.includes('FROM commerce_customers')) return { rows: [existing] };
    if (sql.includes('INSERT INTO commerce_audit_logs')) return { rows: [] };
    throw new Error(`consulta inesperada: ${sql}`);
  } };
  const result = await resolveCommerceCustomer(trx, { empresaId: EMPRESA, identitySource: 'checkout' }, { nome: 'Tentativa de mudança', email: existing.email, telefone: existing.telefone, consentimentos: { marketing: true } });
  assert.equal(result.customer.nome, existing.nome);
  assert.equal(calls.some(sql => sql.includes('UPDATE commerce_customers')), false);
});

test('fingerprint de endereço ignora caixa, espaços e máscara do CEP', () => {
  const a = normalizeCustomerAddress({ destinatario: 'Ana', cep: '12345-678', logradouro: 'Rua  A', numero: '10', bairro: 'Centro', cidade: 'Cuiabá', estado: 'mt' });
  const b = normalizeCustomerAddress({ destinatario: 'Outra pessoa', cep: '12345678', logradouro: 'rua a', numero: '10', bairro: 'centro', cidade: 'cuiabá', estado: 'MT' });
  assert.equal(customerAddressFingerprint(a), customerAddressFingerprint(b));
});
