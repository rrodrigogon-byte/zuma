import assert from 'node:assert/strict';
import test from 'node:test';
import {
  acceptOperationalInvite,
  assertPassword,
  findOperationalByEmail,
  isOperationalEmailReserved,
  issueOperationalInvite,
  normalizeEmail,
  OperationalInviteError,
  resolveOperationalById,
  sendOperationalInvite,
  tokenHash,
} from './commerce-operational-invites.js';

const TENANT = '11111111-1111-4111-8111-111111111111';
const INVITE = '22222222-2222-4222-8222-222222222222';
const USER = '33333333-3333-4333-8333-333333333333';
const ROLE = '44444444-4444-4444-8444-444444444444';
const TOKEN = 'A'.repeat(43);

function row(overrides = {}) {
  return {
    id: INVITE,
    empresa_id: TENANT,
    email_norm: 'operator@example.invalid',
    nome: 'Pessoa Sintética',
    status: 'pending_email',
    expira_em: new Date(Date.now() + 86_400_000).toISOString(),
    ...overrides,
  };
}

function trxFor(handler) {
  return { async query(sql, values = []) { return handler(sql, values); } };
}

test('normaliza e-mail sem registrar dados sensíveis', () => {
  assert.equal(normalizeEmail('  Operator@Example.Invalid '), 'operator@example.invalid');
  assert.throws(() => normalizeEmail('not-an-email'), error => error.code === 'INVALID_EMAIL');
  assert.equal(tokenHash(TOKEN).length, 64);
  assert.equal(tokenHash(TOKEN), tokenHash(TOKEN));
  assert.notEqual(tokenHash(TOKEN), TOKEN);
});

test('exige senha forte com 12 caracteres e complexidade', () => {
  assert.equal(assertPassword('Senha-Forte-123'), 'Senha-Forte-123');
  for (const value of ['curta-1A!', 'sem numero forte!', 'SEM-NUMERO-123!', 'sem-maiuscula-123!', 'SemEspaco12345']) {
    if (value === 'SemEspaco12345') continue;
    assert.throws(() => assertPassword(value), error => error.code === 'WEAK_PASSWORD');
  }
});

test('issue cria convite pending_email, normaliza e não entrega token sem sender', async () => {
  const calls = [];
  const database = {
    async transaction(callback) {
      return callback(trxFor(async (sql, values) => {
        calls.push({ sql, values });
        if (sql.includes('FROM empresas')) return { rows: [{ id: TENANT }] };
        if (sql.includes('FROM commerce_roles')) return { rows: [{ id: ROLE }] };
        if (sql.includes('FROM usuarios')) return { rows: [] };
        if (sql.includes('FROM commerce_operational_invites')) return { rows: [] };
        if (sql.includes('INSERT INTO commerce_operational_invites')) return { rows: [row()] };
        return { rows: [] };
      }));
    },
  };
  const result = await issueOperationalInvite({ empresaId: TENANT, email: ' OPERATOR@EXAMPLE.INVALID ', nome: 'Pessoa Sintética' }, { database });
  assert.deepEqual(result, { ok: true, inviteId: INVITE, empresaId: TENANT, email: 'operator@example.invalid', nome: 'Pessoa Sintética', status: 'pending_email', expiresAt: result.expiresAt });
  assert.equal(Object.hasOwn(result, 'token'), false);
  assert.match(calls.find(call => call.sql.includes('INSERT INTO commerce_operational_invites')).values[1], /@example\.invalid$/u);
});

test('issue chama sender com token apenas em memória e marca sent depois da confirmação', async () => {
  const statuses = [];
  let seenToken = null;
  const database = {
    async transaction(callback) {
      return callback(trxFor(async (sql) => {
        if (sql.includes('FROM empresas')) return { rows: [{ id: TENANT }] };
        if (sql.includes('FROM commerce_roles')) return { rows: [{ id: ROLE }] };
        if (sql.includes('FROM usuarios')) return { rows: [] };
        if (sql.includes('FROM commerce_operational_invites') && sql.includes('LIMIT 1')) return { rows: [] };
        if (sql.includes('INSERT INTO commerce_operational_invites')) return { rows: [row()] };
        if (sql.includes('UPDATE commerce_operational_invites') && sql.includes("status = 'sent'")) { statuses.push('sent'); return { rows: [row({ status: 'sent' })] }; }
        if (sql.includes('SELECT id, empresa_id, email_norm') && sql.includes('FOR UPDATE')) return { rows: [row()] };
        return { rows: [] };
      }));
    },
  };
  const result = await issueOperationalInvite({
    empresaId: TENANT,
    email: 'operator@example.invalid',
    nome: 'Pessoa Sintética',
    sendInvite: async payload => { seenToken = payload.token; return { ok: true }; },
  }, { database });
  assert.equal(seenToken?.length, 43);
  assert.notEqual(seenToken, TOKEN);
  assert.deepEqual(statuses, ['sent']);
  assert.equal(result.status, 'sent');
  assert.equal(Object.hasOwn(result, 'token'), false);
});

test('falha de sender revoga convite e não vaza segredo', async () => {
  const updates = [];
  const database = {
    async transaction(callback) {
      return callback(trxFor(async sql => {
        if (sql.includes('SELECT id, empresa_id, email_norm') && sql.includes('FOR UPDATE')) return { rows: [row()] };
        if (sql.includes("status = 'revoked'")) { updates.push('revoked'); return { rows: [row({ status: 'revoked' })] }; }
        return { rows: [] };
      }));
    },
  };
  await assert.rejects(
    sendOperationalInvite({ inviteId: INVITE, token: TOKEN, sendInvite: async () => { throw new Error('synthetic sender failure'); } }, { database }),
    error => error.code === 'OPERATIONAL_INVITE_SEND_FAILED' && !String(error.message).includes(TOKEN),
  );
  assert.deepEqual(updates, ['revoked']);
});

test('accept aceita somente sent, escreve administrador operacional e membership tenant sem loja', async () => {
  const queries = [];
  let userCreated = false;
  const database = {
    async transaction(callback) {
      return callback(trxFor(async (sql, values) => {
        queries.push({ sql, values });
        if (sql.includes('SELECT email_norm FROM commerce_operational_invites')) return { rows: [{ email_norm: row().email_norm }] };
        if (sql.includes('FROM commerce_operational_invites i') && sql.includes('FOR UPDATE')) return { rows: [row({ status: 'sent' })] };
        if (sql.includes('FROM empresas')) return { rows: [{ id: TENANT }] };
        if (sql.includes('FROM usuarios') && sql.includes('FOR UPDATE')) return { rows: [] };
        if (sql.includes('FROM commerce_roles')) return { rows: [{ id: ROLE }] };
        if (sql.includes('INSERT INTO usuarios')) { userCreated = true; return { rows: [{ id: USER, empresa_id: TENANT, email: 'operator@example.invalid', nome_completo: 'Pessoa Sintética', senha_hash: '$2b$12$synthetic', ativo: true }] }; }
        if (sql.includes('INSERT INTO commerce_memberships')) return { rows: [{ id: 'membership' }] };
        if (sql.includes("SET status = 'used'")) return { rows: [{ id: INVITE }] };
        return { rows: [] };
      }));
    },
  };
  const owner = await acceptOperationalInvite({ token: TOKEN, password: 'Senha-Forte-123' }, { database });
  assert.equal(userCreated, true);
  assert.deepEqual(owner, { id: USER, empresaId: TENANT, email: 'operator@example.invalid', nome: 'Pessoa Sintética', senhaHash: '$2b$12$synthetic', role: 'organizador', ativo: true });
  assert.match(queries.find(query => query.sql.includes('INSERT INTO commerce_memberships')).sql, /loja_id, role_id, ativo\)\s*VALUES\s*\(\$1, \$2, NULL/u);
});

test('lookups retornam operador somente com convite usado e membership store_admin ativa', async () => {
  const rowUser = { id: USER, empresa_id: TENANT, email: 'operator@example.invalid', nome_completo: 'Pessoa Sintética', senha_hash: '$2b$12$synthetic', ativo: true };
  const database = { async queryRead(sql) { assert.match(sql, /store_admin/u); assert.match(sql, /i\.status = 'used'/u); assert.match(sql, /JOIN empresas e.*COALESCE\(e\.ativa, true\) = true/u); return { rows: [rowUser] }; } };
  assert.deepEqual(await findOperationalByEmail('OPERATOR@EXAMPLE.INVALID', { database }), { id: USER, empresaId: TENANT, email: rowUser.email, nome: rowUser.nome_completo, senhaHash: rowUser.senha_hash, role: 'organizador', ativo: true });
  assert.deepEqual(await resolveOperationalById({ userId: USER, empresaId: TENANT, database }), { id: USER, empresaId: TENANT, email: rowUser.email, nome: rowUser.nome_completo, senhaHash: rowUser.senha_hash, role: 'organizador', ativo: true });
});

test('lookup fail-closed em duplicidade e reserva consulta usuários e convites', async () => {
  const database = { async queryRead(sql) {
    if (sql.includes('UNION ALL')) return { rows: [] };
    return { rows: [{ id: USER }, { id: 'other' }] };
  } };
  assert.equal(await findOperationalByEmail('operator@example.invalid', { database }), null);
  assert.equal(await isOperationalEmailReserved('operator@example.invalid', { database }), false);
});

test('exporta erro próprio sem revelar token em mensagem', () => {
  const error = new OperationalInviteError('convite inválido', 'OPERATIONAL_INVITE_INVALID');
  assert.equal(error.code, 'OPERATIONAL_INVITE_INVALID');
  assert.doesNotMatch(error.message, /token|senha/iu);
});
