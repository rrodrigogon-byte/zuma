import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { db, reset } from './db.js';
import { EMPRESA_PADRAO_ID, garantirEmpresaPadrao, criarUsuario } from './cadastros-mestres-kytto.js';
import { issuePasswordReset, validatePasswordResetToken, consumePasswordReset, passwordPolicy } from './password-reset-kytto.js';

test('recuperação laranja usa token hash, consumo único e senha forte', async () => {
  reset();
  garantirEmpresaPadrao();
  const user = criarUsuario(EMPRESA_PADRAO_ID, { nome: 'Admin Teste', email: 'admin.test@example.com', platformAdmin: true, tipoUsuario: 'administrador', perfis: ['administrador'], roles: ['admin'], senhaHash: bcrypt.hashSync('SenhaAntiga-1', 12) });
  const issued = await issuePasswordReset(user, { ip: '127.0.0.1' });

  assert.equal(issued.sent, true);
  assert.equal(validatePasswordResetToken(issued.token).ok, true);
  assert.notEqual(db().passwordResets[0].tokenHash, issued.token);
  assert.equal(consumePasswordReset(issued.token, 'fraca').ok, false);

  const consumed = consumePasswordReset(issued.token, 'NovaSenha-2026');
  assert.equal(consumed.ok, true);
  assert.equal(bcrypt.compareSync('NovaSenha-2026', consumed.user.senhaHash), true);
  assert.equal(validatePasswordResetToken(issued.token).ok, false);
  assert.equal(consumePasswordReset(issued.token, 'OutraSenha-2026').ok, false);
});

test('recuperação laranja rejeita token expirado e política fraca', async () => {
  reset();
  garantirEmpresaPadrao();
  const user = criarUsuario(EMPRESA_PADRAO_ID, { nome: 'Admin Expiração', email: 'admin.expiracao@example.com', platformAdmin: true, tipoUsuario: 'administrador', perfis: ['administrador'], roles: ['admin'], senhaHash: bcrypt.hashSync('SenhaAntiga-1', 12) });
  const issued = await issuePasswordReset(user);
  db().passwordResets[0].expiresAt = new Date(Date.now() - 1000).toISOString();
  assert.equal(validatePasswordResetToken(issued.token).ok, false);
  assert.equal(passwordPolicy('sem-maiuscula-123').length > 0, true);
  assert.equal(passwordPolicy('SenhaForte-123'), null);
});
