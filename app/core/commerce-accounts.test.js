import test from 'node:test';
import assert from 'node:assert/strict';
import { accountCredential, accountRequestIdentity, assertAccountManager, createAccount, setAccountActive } from './commerce-accounts.js';
const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222', C='33333333-3333-4333-8333-333333333333';
const U1='44444444-4444-4444-8444-444444444444', U2='55555555-5555-4555-8555-555555555555';
const user={ accountAccess:[{ empresa_id:A,usuario_id:U1,loja_id:null,role_codigo:'store_admin' },{ empresa_id:B,usuario_id:U2,loja_id:null,role_codigo:'finance' }] };
const manager={id:1,role:'admin',platformAdmin:true};

test('admin empresarial e conta canônica não se tornam gestores globais', () => {
  assert.doesNotThrow(() => assertAccountManager(manager));
  for (const actor of [{role:'admin'}, {role:'admin',mainAdmin:true,pgAccount:true}, {role:'admin',platformAdmin:true,pgOperational:true}, {role:'organizador',platformAdmin:true}]) assert.throws(() => assertAccountManager(actor), error => error.code==='PERMISSION_DENIED');
});
test('uma conta resolve IDs distintos e perfis distintos por empresa, nunca pelo e-mail', () => {
  assert.throws(() => accountRequestIdentity(user), error => error.code==='TENANT_SELECTION_REQUIRED');
  assert.equal(accountRequestIdentity(user,{empresaId:A}).usuarioId,U1);
  assert.equal(accountRequestIdentity(user,{empresaId:B}).usuarioId,U2);
  assert.equal(accountRequestIdentity(user,{empresaId:B}).roleCode,'finance');
  assert.throws(() => accountRequestIdentity(user,{empresaId:C}), error => error.code==='PERMISSION_DENIED');
  assert.throws(() => accountRequestIdentity(user,{empresaId:A,lojaId:'bad'}), error => error.code==='INVALID_ID');
});
test('perfil de loja não substitui um perfil corporativo mais alto', () => {
  const scoped={ accountAccess:[{empresa_id:A,usuario_id:U1,loja_id:null,role_codigo:'tenant_owner'},{empresa_id:A,usuario_id:U1,loja_id:C,role_codigo:'support'}] };
  assert.equal(accountRequestIdentity(scoped,{empresaId:A,lojaId:C}).roleCode,'tenant_owner');
});
test('importação legada preserva a senha atual apenas do ID explicitamente associado', () => {
  const account={origem:'legacy',origem_id:'2',email:'legacy@example.invalid',senha_hash:'old'};
  assert.equal(accountCredential(account,[{id:2,email:'legacy@example.invalid',senhaHash:'current',ativo:true}]),'current');
  assert.equal(accountCredential(account,[{id:3,email:'legacy@example.invalid',senhaHash:'homonym',ativo:true}]),null);
  assert.equal(accountCredential(account,[{id:2,email:'legacy@example.invalid',senhaHash:'current',ativo:false}]),null);
});
test('criação direta rejeita platform_owner, senha fraca e conta legado antes de gravar', async () => {
  const noWrite={transaction(){throw new Error('não deve gravar')}};
  const input={nome:'Teste',email:'test@example.invalid',senha:'Teste-forte-123!',access:[{empresaId:A,roleCode:'store_admin'}]};
  await assert.rejects(() => createAccount(manager,{...input,access:[{empresaId:A,roleCode:'platform_owner'}]},{database:noWrite}),error=>error.code==='PERMISSION_DENIED');
  await assert.rejects(() => createAccount(manager,{...input,senha:'123'},{database:noWrite}),error=>error.code==='WEAK_PASSWORD');
  await assert.rejects(() => createAccount(manager,input,{database:noWrite,legacyUsers:[{id:9,email:input.email}]}),error=>error.code==='IDENTITY_ALREADY_EXISTS');
  await assert.rejects(() => setAccountActive(manager,A,'false',noWrite),error=>error.code==='VALIDATION_ERROR');
});

test('senhas com mais de 72 bytes UTF-8 não são truncadas silenciosamente pelo bcrypt', async () => {
  const noWrite={transaction(){throw new Error('não deve gravar')}};
  const input={nome:'Teste',email:'bytes@example.invalid',access:[{empresaId:A,roleCode:'store_admin'}]};
  for (const senha of ['Aa1!'+'x'.repeat(69), 'Aa1!'+'ç'.repeat(35)]) {
    await assert.rejects(() => createAccount(manager,{...input,senha},{database:noWrite}),error=>error.code==='WEAK_PASSWORD');
  }
});
