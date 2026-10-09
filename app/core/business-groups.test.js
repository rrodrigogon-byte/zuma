import test from 'node:test';
import assert from 'node:assert/strict';
import { groupCnpj, groupSlug, validateGroupInput } from './business-groups.js';

test('grupo empresarial gera slug estável a partir do nome', () => {
  assert.equal(groupSlug('Silvester Holding'), 'silvester-holding');
  assert.equal(groupSlug('  Grupo Ação & Cia.  '), 'grupo-acao-cia');
  assert.throws(() => groupSlug('!'), /nome do grupo inválido/);
});

test('CNPJ da holding é opcional, mas quando informado precisa ser válido', () => {
  assert.equal(groupCnpj(''), null);
  assert.equal(groupCnpj(null), null);
  assert.equal(groupCnpj('56.099.531/0001-38'), '56099531000138');
  assert.throws(() => groupCnpj('56.099.531/0001-39'), /CNPJ do grupo inválido/);
  assert.throws(() => groupCnpj('11111111111111'), /CNPJ do grupo inválido/);
});

test('validação do grupo exige nome e normaliza os campos', () => {
  assert.deepEqual(validateGroupInput({ nome: 'Silvester Holding' }), { nome: 'Silvester Holding', slug: 'silvester-holding', cnpj: null, razaoSocial: null });
  assert.throws(() => validateGroupInput({ nome: ' ' }), /informe o nome do grupo/);
});
