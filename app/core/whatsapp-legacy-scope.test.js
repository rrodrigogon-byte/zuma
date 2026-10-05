import test from 'node:test';
import assert from 'node:assert/strict';
import { legacyWppAvailable } from './whatsapp-legacy-scope.js';

const base = { tenantScoped: false, configured: true, coreEnabled: true };

test('não envia pelo adaptador global quando há canal WhatsApp próprio da unidade', () => {
  assert.equal(legacyWppAvailable({ ...base, aiStatus: { channel: { status: 'ativo' } } }), false);
  assert.equal(legacyWppAvailable({ ...base, aiStatus: { channel: { status: 'pausado' } } }), false);
});

test('consulta indisponível ou empresa sem seleção nunca liberam fallback de envio global', () => {
  assert.equal(legacyWppAvailable({ ...base, aiStatus: { unavailable: true, channel: null } }), false);
  assert.equal(legacyWppAvailable({ ...base }), false);
  assert.equal(legacyWppAvailable({ ...base, aiStatus: {} }), false);
  assert.equal(legacyWppAvailable({ ...base, globalUnselected: true, aiStatus: { unavailable: true } }), true, 'só admin global sem tenant conserva seu adaptador próprio');
});

test('usuário tenant-scoped nunca usa envio legado, mesmo sem canal Commerce', () => {
  assert.equal(legacyWppAvailable({ ...base, tenantScoped: true, aiStatus: { channel: null } }), false);
  assert.equal(legacyWppAvailable({ ...base, tenantScoped: true, coreEnabled: false }), false);
  assert.equal(legacyWppAvailable({ ...base, tenantScoped: true, globalUnselected: true }), false);
});

test('adaptador legado só permanece possível para admin global quando não há canal Commerce próprio', () => {
  assert.equal(legacyWppAvailable({ ...base, aiStatus: { channel: null } }), true);
  assert.equal(legacyWppAvailable({ ...base, coreEnabled: false }), true);
  assert.equal(legacyWppAvailable({ ...base, configured: false, aiStatus: { channel: null } }), false);
});
