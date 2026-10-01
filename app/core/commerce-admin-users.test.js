import assert from 'node:assert/strict';
import test from 'node:test';
import { createMembership, updateMembership } from './commerce-admin-users.js';

const empresaId = '11111111-1111-4111-8111-111111111111';
const actorId = '22222222-2222-4222-8222-222222222222';
const targetId = '33333333-3333-4333-8333-333333333333';
const membershipId = '44444444-4444-4444-8444-444444444444';
const roleId = '55555555-5555-4555-8555-555555555555';
const lojaAId = '66666666-6666-4666-8666-666666666666';
const lojaBId = '77777777-7777-4777-8777-777777777777';

function trxFor({ actor = 'store_admin', actorLojaId = null, role = 'tenant_owner', current = null, owners = 1 } = {}) {
  const calls = [];
  return {
    calls,
    async query(sql) {
      calls.push(sql);
      if (sql.includes('pg_advisory_xact_lock')) return { rows: [{}] };
      if (sql.includes("p.codigo = 'users.write'")) return { rows: [{ id: 'actor-role', codigo: actor, empresa_id: null, loja_id: actorLojaId }] };
      if (sql.includes('FROM commerce_roles r')) return { rows: [{ id: roleId, codigo: role, empresa_id: null }] };
      if (sql.includes('FROM usuarios')) return { rows: [{ id: targetId }] };
      if (sql.includes('FROM lojas')) return { rows: [{ id: lojaBId }] };
      if (sql.includes('FROM commerce_memberships m') && sql.includes('FOR UPDATE OF m')) return { rows: current ? [current] : [] };
      if (sql.includes('COUNT(*)::integer')) return { rows: [{ total: owners }] };
      if (/INSERT INTO|UPDATE commerce_memberships/.test(sql)) return { rows: [{ id: membershipId, role_id: roleId, ativo: true, mfa_obrigatorio: false, loja_id: null }] };
      if (sql.includes('commerce_audit_logs')) return { rows: [] };
      throw new Error(`query não prevista: ${sql}`);
    },
  };
}

const context = { empresaId, usuarioId: actorId };

test('store_admin não atribui tenant_owner e nenhuma DML ocorre antes da rejeição', async () => {
  const trx = trxFor();
  await assert.rejects(() => createMembership(trx, context, { usuarioId: targetId, roleId }), error => error.code === 'PERMISSION_DENIED');
  assert.equal(trx.calls.some(sql => /INSERT INTO|UPDATE commerce_memberships/.test(sql)), false);
});

test('papel de outro tenant é rejeitado antes de DML', async () => {
  const trx = trxFor();
  trx.query = async sql => {
    trx.calls.push(sql);
    if (sql.includes('pg_advisory_xact_lock')) return { rows: [{}] };
    if (sql.includes("p.codigo = 'users.write'")) return { rows: [{ codigo: 'tenant_owner' }] };
    if (sql.includes('FROM commerce_roles r')) return { rows: [] };
    throw new Error('DML inesperada');
  };
  await assert.rejects(() => createMembership(trx, context, { usuarioId: targetId, roleId }), error => error.code === 'PERMISSION_DENIED');
});

test('último tenant_owner ativo não pode ser desativado', async () => {
  const current = { id: membershipId, role_id: roleId, role_codigo: 'tenant_owner', ativo: true, loja_id: null };
  const trx = trxFor({ actor: 'tenant_owner', role: 'tenant_owner', current, owners: 1 });
  await assert.rejects(() => updateMembership(trx, context, membershipId, { ativo: false }), error => error.code === 'LAST_TENANT_OWNER_REQUIRED');
  assert.equal(trx.calls.some(sql => sql.startsWith('UPDATE commerce_memberships')), false);
});

test('tenant_owner não altera ou desativa outro tenant_owner do mesmo nível', async () => {
  const current = { id: membershipId, usuario_id: targetId, role_id: roleId, role_codigo: 'tenant_owner', ativo: true, loja_id: null };
  for (const input of [{ ativo: false }, { mfaObrigatorio: true }]) {
    const trx = trxFor({ actor: 'tenant_owner', role: 'tenant_owner', current, owners: 2 });
    await assert.rejects(() => updateMembership(trx, context, membershipId, input), error => error.code === 'PERMISSION_DENIED');
    assert.equal(trx.calls.some(sql => sql.startsWith('UPDATE commerce_memberships')), false);
  }
});

test('platform_owner continua autorizado a alterar tenant_owner sem remover o último owner', async () => {
  const current = { id: membershipId, usuario_id: targetId, role_id: roleId, role_codigo: 'tenant_owner', ativo: true, loja_id: null, mfa_obrigatorio: false };
  const trx = trxFor({ actor: 'platform_owner', role: 'tenant_owner', current, owners: 2 });
  const result = await updateMembership(trx, context, membershipId, { ativo: false });
  assert.equal(result.id, membershipId);
  assert.equal(trx.calls.some(sql => sql.startsWith('UPDATE commerce_memberships')), true);
});

test('tenant_owner não cria outro tenant_owner nem autoeleva membership', async () => {
  for (const usuarioId of [targetId, actorId]) {
    const trx = trxFor({ actor: 'tenant_owner', role: 'tenant_owner' });
    await assert.rejects(() => createMembership(trx, context, { usuarioId, roleId }), error => error.code === 'PERMISSION_DENIED');
    assert.equal(trx.calls.some(sql => /INSERT INTO|UPDATE commerce_memberships/.test(sql)), false);
  }
});

test('membership inferior é criada somente depois do lock e das validações', async () => {
  const trx = trxFor({ actor: 'tenant_owner', role: 'store_admin' });
  const result = await createMembership(trx, context, { usuarioId: targetId, roleId });
  assert.equal(result.id, membershipId);
  const lock = trx.calls.findIndex(sql => sql.includes('pg_advisory_xact_lock'));
  const insert = trx.calls.findIndex(sql => sql.includes('INSERT INTO commerce_memberships'));
  const audit = trx.calls.findIndex(sql => sql.includes('commerce_audit_logs'));
  assert.ok(lock >= 0 && lock < insert && insert < audit);
});

test('ator não pode promover a própria membership para owner sem autoridade', async () => {
  const trx = trxFor();
  await assert.rejects(() => createMembership(trx, context, { usuarioId: actorId, roleId }), error => error.code === 'PERMISSION_DENIED');
  assert.equal(trx.calls.some(sql => /INSERT INTO|UPDATE commerce_memberships/.test(sql)), false);
});

test('store_admin não cria membership tenant-wide ou em outra loja', async () => {
  for (const lojaId of [null, lojaBId]) {
    const trx = trxFor({ actor: 'store_admin', actorLojaId: lojaAId, role: 'support' });
    await assert.rejects(
      () => createMembership(trx, { ...context, lojaId: lojaAId }, { usuarioId: targetId, roleId, ...(lojaId ? { lojaId } : {}) }),
      error => error.code === 'PERMISSION_DENIED',
    );
    assert.equal(trx.calls.some(sql => /INSERT INTO|UPDATE commerce_memberships/.test(sql)), false);
  }
});

test('store_admin não altera membership de outra loja', async () => {
  const current = { id: membershipId, usuario_id: targetId, role_id: roleId, role_codigo: 'support', ativo: true, loja_id: lojaBId };
  const trx = trxFor({ actor: 'store_admin', actorLojaId: lojaAId, role: 'support', current });
  await assert.rejects(
    () => updateMembership(trx, { ...context, lojaId: lojaAId }, membershipId, { ativo: false }),
    error => error.code === 'PERMISSION_DENIED',
  );
  assert.equal(trx.calls.some(sql => sql.startsWith('UPDATE commerce_memberships')), false);
});
