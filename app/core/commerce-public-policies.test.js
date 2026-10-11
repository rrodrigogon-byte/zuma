import test from 'node:test';
import assert from 'node:assert/strict';
import { mergePublicPolicies } from './commerce-public-policies.js';
test('editar políticas preserva marca, contato, frete e políticas não alteradas', () => {
  const config = { brandKey:'stallone', other:{keep:true}, public:{contact:{phone:'123'}, policies:{returnsUrl:'https://example.test/returns'}} };
  const before = JSON.stringify(config);
  const result = mergePublicPolicies(config, {privacyUrl:'https://example.test/privacy', arbitrary:'discard'});
  assert.equal(result.public.policies.returnsUrl, config.public.policies.returnsUrl);
  assert.deepEqual(result.public.contact, config.public.contact);
  assert.deepEqual(result.other, config.other);
  assert.equal(result.public.policies.arbitrary, undefined);
  assert.equal(JSON.stringify(config), before);
});
test('não publica URLs executáveis, com credenciais ou sem HTTPS', () => {
  for (const value of ['javascript:alert(1)','http://example.test','https://user:pass@example.test','inválido']) assert.throws(() => mergePublicPolicies({}, {privacyUrl:value}), {code:'PUBLIC_POLICIES_URL_INVALID'});
  assert.equal(mergePublicPolicies({}, {privacyUrl:''}).public.policies.privacyUrl, null);
});
