import test from 'node:test';
import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import pg from 'pg';
import { listAdminUserDirectory } from './admin-user-directory.js';

const url = process.env.COMMERCE_USER_DIRECTORY_TEST_DATABASE_URL;
const enabled = Boolean(url && /(?:localhost|127\.0\.0\.1|\/var\/run\/postgresql)/.test(url) && /user_directory_test/.test(url));

test('PostgreSQL real: contas completas por tenant, unidade, papel e origem sem PII de documento', { skip: !enabled }, async () => {
  const pool = new pg.Pool({ connectionString: url, ssl: false });
  const client = await pool.connect();
  const source = { queryRead: (sql, args) => client.query(sql, args) };
  try {
    await client.query('BEGIN');
    const createCompany = async (name, cnpj) => (await client.query(
      'INSERT INTO empresas (nome, cnpj, razao_social, tipo_negocio) VALUES ($1,$2,$1,$3) RETURNING id',
      [name, cnpj, 'outro'],
    )).rows[0].id;
    const cnpj = () => `9${randomInt(10 ** 12, 10 ** 13)}`;
    const a = await createCompany('Empresa Sintética A', cnpj());
    const b = await createCompany('Empresa Sintética B', cnpj());
    const lojaA = (await client.query('INSERT INTO lojas (empresa_id, codigo, nome) VALUES ($1,$2,$3) RETURNING id', [a, 'a', 'Unidade A'])).rows[0].id;
    const lojaB = (await client.query('INSERT INTO lojas (empresa_id, codigo, nome) VALUES ($1,$2,$3) RETURNING id', [a, 'b', 'Unidade B'])).rows[0].id;
    const role = (await client.query("SELECT id FROM commerce_roles WHERE empresa_id IS NULL AND codigo = 'tenant_owner' LIMIT 1")).rows[0].id;
    const user = async (company, email, active = true) => (await client.query(
      "INSERT INTO usuarios (empresa_id, nome_completo, email, senha_hash, role, ativo) VALUES ($1, 'Pessoa Sintética', $2, 'not-a-real-password', 'admin', $3) RETURNING id",
      [company, email, active],
    )).rows[0].id;
    const owner = await user(a, 'duplicate@example.invalid');
    const inactive = await user(a, 'inactive@example.invalid', false);
    const noRole = await user(a, 'norole@example.invalid');
    const storeOnly = await user(a, 'store@example.invalid');
    const otherCompany = await user(b, 'duplicate@example.invalid');
    const membership = (company, userId, store = null) => client.query(
      'INSERT INTO commerce_memberships (empresa_id, usuario_id, loja_id, role_id) VALUES ($1,$2,$3,$4)',
      [company, userId, store, role],
    );
    await membership(a, owner);
    await membership(a, inactive);
    await membership(a, storeOnly, lojaA);
    await membership(a, storeOnly, lojaB);
    await membership(b, otherCompany);
    const globals = await listAdminUserDirectory({ commerceDb: source, legacyUsers: [], allCompanies: true, coreEnabled: true });
    const fixtureAccounts = globals.usuarios.filter(item => [a, b].includes(item.empresaId));
    assert.equal(fixtureAccounts.length, 5);
    assert.equal(fixtureAccounts.filter(item => item.email === 'duplicate@example.invalid').length, 2, 'mesmo e-mail não une tenants');
    assert.ok(globals.usuarios.every(item => item.cpf === undefined && item.senhaHash === undefined && item.telefone === undefined));
    assert.equal(fixtureAccounts.find(item => item.id === noRole).acessoAtivo, false);
    assert.equal(fixtureAccounts.find(item => item.id === inactive).permissoes.length, 0);
    assert.equal(fixtureAccounts.find(item => item.id === owner).permissoes.includes('users.write'), true);
    const tenant = await listAdminUserDirectory({ commerceDb: source, legacyUsers: [], allCompanies: false, empresaId: a, coreEnabled: true });
    assert.equal(tenant.usuarios.length, 4);
    const scoped = await listAdminUserDirectory({ commerceDb: source, legacyUsers: [], allCompanies: false, empresaId: a, lojaId: lojaA, coreEnabled: true });
    assert.deepEqual(scoped.usuarios.map(item => item.id).sort(), [owner, inactive, storeOnly].sort(), 'conta inativa com vínculo corporativo também é visível');
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
  }
});
