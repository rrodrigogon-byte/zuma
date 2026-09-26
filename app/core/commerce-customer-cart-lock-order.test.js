import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const carts = readFileSync(new URL('./commerce-abandoned-carts.js', import.meta.url), 'utf8');
const core = readFileSync(new URL('./commerce-core.js', import.meta.url), 'utf8');

test('sync e checkout adquirem identidade antes do carrinho', () => {
  const syncStart = carts.indexOf('export async function syncPublicCart');
  const syncEnd = carts.indexOf('export async function markCartConverted');
  const sync = carts.slice(syncStart, syncEnd);
  assert.ok(sync.indexOf('resolveCommerceCustomer(') < sync.indexOf('commerce-cart-sync:'), 'sync deve travar customer antes do cart');

  const orderStart = core.indexOf('export async function createPendingOrder');
  const orderEnd = core.indexOf('\nfunction slugify', orderStart);
  const order = core.slice(orderStart, orderEnd);
  const customerLock = order.indexOf('resolveCommerceCustomer(');
  assert.ok(customerLock >= 0);
  assert.ok(customerLock < order.indexOf('markCartConverted(', customerLock), 'criação normal deve travar customer antes do cart');
});
