import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const storefrontSource = readFileSync(new URL('../pages/public/Ecommerce.jsx', import.meta.url), 'utf8');
const checkoutSource = readFileSync(new URL('../pages/public/CommerceCheckout.jsx', import.meta.url), 'utf8');
const storefrontLibSource = readFileSync(new URL('./storefront.js', import.meta.url), 'utf8');

test('Commerce Core navega do carrinho para uma única página dedicada de checkout', () => {
  assert.match(storefrontSource, /if \(catalogSource === 'core'\) \{\s*navigate\(checkoutRoute\)/);
  assert.match(storefrontSource, /onClick=\{openCheckout\}/);
  assert.doesNotMatch(storefrontSource, /form="commerce-inline-checkout-form"/);
  assert.equal((storefrontSource.match(/id="commerce-inline-checkout-form"/g) || []).length, 1);
});

test('os dois fluxos legados restantes usam trava single-flight imperativa', () => {
  assert.match(storefrontSource, /if \(orderRequestRef\.current\) return/);
  assert.match(storefrontSource, /if \(!order \|\| !paymentMethods\.length \|\| paymentRequestRef\.current\) return/);
  assert.match(checkoutSource, /if \(orderRequestRef\.current\) return/);
  assert.match(checkoutSource, /if \(!order \|\| paymentRequestRef\.current\) return/);
});

test('checkout dedicado mantém idempotência entre reloads e preserva os campos completos', () => {
  assert.match(checkoutSource, /storefrontCheckoutIdempotencyKey\(storeAlias\)/);
  assert.match(checkoutSource, /clearStorefrontCheckoutIdempotencyKey\(storeAlias\)/);
  assert.match(checkoutSource, /note: note\.trim\(\)/);
  assert.match(checkoutSource, /promotionCode: promotionCode\.trim\(\)/);
  assert.match(checkoutSource, /CPF ou CNPJ do destinatário/);
  assert.match(checkoutSource, /Continuar para pagamento/);
});

test('checkout dedicado permite excluir item e invalida estado derivado antes de nova submissão', () => {
  assert.match(checkoutSource, /function removeCartItem\(item\)/);
  assert.match(checkoutSource, /removeStorefrontCartItem\(cart, item\.produtoId, item\.variantId\)/);
  assert.match(checkoutSource, /localStorage\.removeItem\(cartStorageKey\)/);
  assert.match(checkoutSource, /setShippingQuote\(null\)/);
  assert.match(checkoutSource, /clearStorefrontCheckoutIdempotencyKey\(storeAlias\)/);
  assert.match(checkoutSource, /aria-label=\{`Excluir \$\{item\.nome\} do carrinho`\}/);
  assert.match(checkoutSource, />Excluir<\/span>/);
  assert.match(checkoutSource, /role="status" aria-live="polite"/);
  assert.match(checkoutSource, /emptyCartLinkRef\.current\?\.focus\(\)/);
  assert.match(checkoutSource, /nextStorefrontCartSyncVersion\(storeAlias\)/);
  assert.match(checkoutSource, /window\.addEventListener\('storage'/);
});

test('checkout InfinitePay apresenta o provedor uma vez e delega a escolha de Pix ou cartão ao ambiente seguro', () => {
  assert.match(checkoutSource, /checkoutPaymentChoices\(paymentMethods\)/);
  assert.match(storefrontLibSource, /method: 'external'/);
  assert.match(checkoutSource, /Continuar na InfinitePay/);
  assert.match(checkoutSource, /escolha Pix ou cartão uma única vez/i);
  assert.doesNotMatch(checkoutSource, /InfinitePay Checkout' : item\.provider/);
});
