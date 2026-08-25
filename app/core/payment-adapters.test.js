import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PaymentProviderRegistry,
  createPaymentAttempt,
  paymentProviders,
  validatePaymentMethod,
} from './payment-adapters.js';
import { CommerceError } from './commerce-core.js';

const empresaId = '11111111-1111-4111-8111-111111111111';
const orderId = '55555555-5555-4555-8555-555555555555';

test('registry exige createCheckout e verifyWebhook', () => {
  const registry = new PaymentProviderRegistry();
  assert.throws(() => registry.register('fake', {}), TypeError);
  const adapter = { createCheckout: async () => ({}), verifyWebhook: async () => ({ eventId: 'evt' }) };
  registry.register('TestProvider', adapter);
  assert.equal(registry.get('testprovider'), adapter);
});

test('método de pagamento aceita somente valores explícitos', () => {
  assert.equal(validatePaymentMethod('pix'), 'pix');
  assert.equal(validatePaymentMethod('credit_card'), 'credit_card');
  assert.throws(() => validatePaymentMethod('card_number'), error => error instanceof CommerceError && error.code === 'PAYMENT_METHOD_INVALID');
});

test('nenhum gateway não registrado pode criar cobrança', async () => {
  paymentProviders.adapters.clear();
  await assert.rejects(
    () => createPaymentAttempt({ empresaId }, { orderId, provider: 'gateway-inexistente', method: 'pix', idempotencyKey: 'payment-test-1' }),
    error => error instanceof CommerceError && error.code === 'PAYMENT_PROVIDER_NOT_CONFIGURED',
  );
});
