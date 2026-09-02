import assert from 'node:assert/strict';
import test from 'node:test';
import { decrementCartQuantity, loadAllStorefrontProducts, normalizeStorefrontAlias, storefrontAliasFromPath, storefrontApiBase, storefrontCartSessionKey, storefrontMediaUrl, storefrontRoute, storefrontStorageKey } from './storefront.js';

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

test('mantém a mídia pública no mesmo alias do catálogo', () => {
  const mediaId = '37b91a0c-78f0-56b2-b074-33ca5063100d';
  assert.equal(storefrontMediaUrl(`/api/storefront/media/${mediaId}`, 'dino'), `/api/public/storefront/dino/media/${mediaId}`);
  assert.equal(storefrontMediaUrl(`/api/storefront/media/${mediaId}`, ''), `/api/storefront/media/${mediaId}`);
  assert.equal(storefrontMediaUrl(`/api/public/storefront/agro-open/media/${mediaId}`, 'dino'), `/api/public/storefront/agro-open/media/${mediaId}`);
  assert.equal(storefrontMediaUrl('https://cdn.example.com/produto.webp', 'dino'), 'https://cdn.example.com/produto.webp');
  assert.equal(storefrontMediaUrl('/api/storefront/media/../segredo', 'dino'), '/api/storefront/media/../segredo');
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

test('sessionKey do carrinho é opaca, estável e particionada por alias', () => {
  const storage = new Map();
  const original = globalThis.localStorage;
  globalThis.localStorage = { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) };
  try {
    const dino = storefrontCartSessionKey('dino');
    assert.match(dino, /^[A-Za-z0-9_-]{24,180}$/);
    assert.equal(storefrontCartSessionKey('dino'), dino);
    assert.notEqual(storefrontCartSessionKey('agro-open'), dino);
  } finally { globalThis.localStorage = original; }
});

test('decremento permite remover a última unidade sem produzir quantidade negativa', () => {
  assert.equal(decrementCartQuantity(2), 1);
  assert.equal(decrementCartQuantity(1), 0);
  assert.equal(decrementCartQuantity(0), 0);
  assert.equal(decrementCartQuantity('inválido'), 0);
});

test('extrai alias somente das rotas Commerce conhecidas', () => {
  assert.equal(storefrontAliasFromPath('/ecommerce/dino'), 'dino');
  assert.equal(storefrontAliasFromPath('/perfumaria/dino?x=1'), 'dino');
  assert.equal(storefrontAliasFromPath('/checkout/dino'), 'dino');
  assert.equal(storefrontAliasFromPath('/pedido/dino/DINO-123'), 'dino');
  assert.equal(storefrontAliasFromPath('/admin/ecommerce'), '');
});

test('carrega todas as páginas do catálogo sem truncar após o primeiro lote', async () => {
  const source = Array.from({ length: 164 }, (_, index) => ({ id: index + 1 }));
  const calls = [];
  const items = await loadAllStorefrontProducts(({ limit, offset }) => {
    calls.push({ limit, offset });
    return { items: source.slice(offset, offset + limit) };
  });
  assert.equal(items.length, 164);
  assert.deepEqual(calls, [{ limit: 100, offset: 0 }, { limit: 100, offset: 100 }]);
});

test('respeita o limite máximo de segurança da paginação', async () => {
  const items = await loadAllStorefrontProducts(({ limit, offset }) => ({ items: Array.from({ length: limit }, (_, index) => ({ id: offset + index })) }), { pageSize: 100, maxItems: 250 });
  assert.equal(items.length, 250);
});
