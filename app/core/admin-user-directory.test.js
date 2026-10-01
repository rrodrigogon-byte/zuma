import test from 'node:test';
import assert from 'node:assert/strict';
import { DIRECTORY_SQL, listAdminUserDirectory, projectCommerceAccounts, projectLegacyAccounts } from './admin-user-directory.js';

const companyA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const companyB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const storeA = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const storeB = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const sqlUser = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const row = (patch = {}) => ({ id: sqlUser, empresa_id: companyA, empresa_nome: 'Empresa A', nome_completo: 'Pessoa Fictícia', email: 'tester@example.invalid', ativo: true, membership_id: 'mmmm', membership_ativo: true, loja_id: null, loja_nome: null, role_codigo: 'tenant_owner', role_nome: 'Titular', role_permissions: ['users.write'], ...patch });
const legacy = [
  { id: 1, empresaId: companyA, lojaId: storeA, nome: 'Pessoa Fictícia', email: 'tester@example.invalid', role: 'admin', ativo: true, senhaHash: 'segredo' },
  { id: 2, empresaId: companyB, lojaId: storeB, nome: 'Outra', email: 'other@example.invalid', role: 'staff', ativo: false },
  { id: 3, nome: 'Plataforma', email: 'global@example.invalid', role: 'admin', ativo: true },
];

test('cada conta SQL é retornada uma vez por tenant, incluindo as sem membership e inativas', () => {
  const result = projectCommerceAccounts([
    row(), row({ membership_id: 'n2', loja_id: storeA, loja_nome: 'Unidade A', role_codigo: 'auditor', role_permissions: ['reports.read'] }),
    row({ id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', email: 'inactive@example.invalid', ativo: false, membership_ativo: false }),
    row({ id: '11111111-1111-4111-8111-111111111111', email: 'none@example.invalid', membership_id: null }),
  ]);
  assert.equal(result.length, 3);
  assert.equal(result[0].vinculos.length, 2);
  assert.deepEqual(result[0].permissoes, ['reports.read', 'users.write']);
  assert.equal(result[1].acessoAtivo, false);
  assert.deepEqual(result[1].permissoes, []);
  assert.equal(result[2].acessoAtivo, false);
  assert.deepEqual(result[2].vinculos, []);
});

test('origem JSON preserva contas duplicadas por e-mail sem unir identidades nem devolver hash', () => {
  const users = projectLegacyAccounts(legacy, { allCompanies: true });
  assert.equal(users.length, 3);
  assert.equal(users[0].email, 'tester@example.invalid');
  assert.equal(users[0].senhaHash, undefined);
  assert.equal(users[0].cpf, undefined);
  assert.equal(users[2].empresaNome, 'Plataforma');
  assert.equal(projectLegacyAccounts(legacy, { empresaId: companyA, lojaId: storeA }).length, 1);
  assert.equal(projectLegacyAccounts(legacy, { empresaId: companyA, lojaId: storeB }).length, 0);
});

test('diretório consulta SQL com tenant e unidade obrigatórios e não substitui falha SQL por lista parcial', async () => {
  let seen;
  const db = { queryRead: async (sql, args) => { seen = { sql, args }; return { rows: [row()] }; } };
  const result = await listAdminUserDirectory({ commerceDb: db, legacyUsers: legacy, allCompanies: false, empresaId: companyA, lojaId: storeA, coreEnabled: true });
  assert.deepEqual(seen.args, [companyA, storeA]);
  assert.equal(result.usuarios.length, 2, 'JSON e SQL permanecem distintos');
  assert.notEqual(result.usuarios[0].key, result.usuarios[1].key);
  assert.match(seen.sql, /\$1::uuid IS NULL OR u.empresa_id = \$1/);
  assert.match(seen.sql, /\$2::uuid IS NULL OR m.id IS NOT NULL/);
  assert.equal(DIRECTORY_SQL.includes('cpf'), false);
  const failed = { queryRead: async () => { throw new Error('offline'); } };
  await assert.rejects(listAdminUserDirectory({ commerceDb: failed, legacyUsers: legacy, allCompanies: true, coreEnabled: true }), /offline/);
});
