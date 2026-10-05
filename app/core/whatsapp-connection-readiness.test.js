import test from 'node:test';
import assert from 'node:assert/strict';
import { canCheckWhatsappConnection, safeWhatsappConnection } from './whatsapp-connection-readiness.js';

const channel = { status: 'ativo', instance: 'dino-1' };
const provider = { provider: 'chatbot_backend', mode: 'instancias', instance: 'dino-1' };

test('consulta só o estado da instância Commerce da unidade, nunca de outra', () => {
  assert.equal(canCheckWhatsappConnection({ channel, provider }), true);
  assert.equal(canCheckWhatsappConnection({ channel, provider: { ...provider, instance: 'isa-1' } }), false);
  assert.equal(canCheckWhatsappConnection({ channel: { ...channel, status: 'pausado' }, provider }), false);
  assert.equal(canCheckWhatsappConnection({ channel, provider: { ...provider, provider: 'evolution' } }), false);
});

test('sessão única exige titular explícito da empresa', () => {
  const isa = { ...provider, mode: 'isa' };
  assert.equal(canCheckWhatsappConnection({ channel, provider: isa, tenantId: 'dino', ownerTenantId: 'dino' }), true);
  assert.equal(canCheckWhatsappConnection({ channel, provider: isa, tenantId: 'dino', ownerTenantId: 'isa' }), false);
  assert.equal(canCheckWhatsappConnection({ channel, provider: isa, tenantId: 'dino' }), false);
});

test('resposta pública inclui apenas estado e instante; nunca QR, telefone ou erro bruto', () => {
  const safe = safeWhatsappConnection({ ok: true, state: 'open', phone: 'private', qrRaw: 'private', pairingCode: 'private', error: 'private' });
  assert.deepEqual(Object.keys(safe), ['state', 'checkedAt']);
  assert.equal(safe.state, 'open');
  assert.equal(safeWhatsappConnection({ ok: false, state: 'open' }).state, 'unknown');
  assert.equal(safeWhatsappConnection({ ok: true, state: 'unexpected' }).state, 'unknown');
});
