import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizePublicStorefrontConfig } from './commerce-routes.js';

test('vitrine no domínio próprio usa a identidade configurada (não cai no laranja padrão)', () => {
  const vazio = sanitizePublicStorefrontConfig({ public_config: {}, configuracoes: { public: { colors: { accent: '#4b57a6' }, contact: { phone: '+5565999990000' } } } });
  assert.equal(vazio.colors.accent, '#4B57A6', 'objeto vazio não bloqueia configuracoes.public');
  const alias = sanitizePublicStorefrontConfig({ public_config: { colors: { accent: '#6E7CE0' } }, configuracoes: {} });
  assert.equal(alias.colors.accent, '#6E7CE0');
  assert.equal(sanitizePublicStorefrontConfig({ public_config: {}, configuracoes: {} }).colors.accent, '#FF6B2C', 'sem configuração, padrão da plataforma');
});
