import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeStorefrontAlias, storefrontAliasFromPath, storefrontApiBase, storefrontRoute, storefrontStorageKey } from './storefront.js';

test('normaliza apenas aliases públicos seguros', () => {
  assert.equal(normalizeStorefrontAlias(' DINO '), 'dino');
  assert.equal(normalizeStorefrontAlias('../dino'), '');
  assert.equal(normalizeStorefrontAlias('d'), '');
  assert.equal(normalizeStorefrontAlias('dino loja'), '');
});

test('separa endpoints públicos do Dino e do storefront resolvido por host', () => {
  assert.equal(storefrontApiBase('dino'), '/api/public/storefront/dino');
  assert.equal(storefrontApiBase(''), '/api/storefront');
  assert.notEqual(storefrontApiBase('dino'), storefrontApiBase('agro-open'));
});

test('mantém vitrine, checkout e pedido no mesmo alias', () => {
  assert.equal(storefrontRoute('dino', 'store'), '/ecommerce/dino');
  assert.equal(storefrontRoute('dino', 'checkout'), '/checkout/dino');
  assert.equal(storefrontRoute('dino', 'order'), '/pedido/dino');
});

test('carrinho e entrega são particionados por alias', () => {
  assert.equal(storefrontStorageKey('dino', 'cart'), 'kytto_commerce_cart:dino');
  assert.equal(storefrontStorageKey('', 'cart'), 'kytto_commerce_cart:host');
  assert.notEqual(storefrontStorageKey('dino', 'cart'), storefrontStorageKey('agro-open', 'cart'));
  assert.notEqual(storefrontStorageKey('dino', 'cart'), storefrontStorageKey('dino', 'delivery'));
});

test('extrai alias somente das rotas Commerce conhecidas', () => {
  assert.equal(storefrontAliasFromPath('/ecommerce/dino'), 'dino');
  assert.equal(storefrontAliasFromPath('/perfumaria/dino?x=1'), 'dino');
  assert.equal(storefrontAliasFromPath('/checkout/dino'), 'dino');
  assert.equal(storefrontAliasFromPath('/pedido/dino/DINO-123'), 'dino');
  assert.equal(storefrontAliasFromPath('/admin/ecommerce'), '');
});
