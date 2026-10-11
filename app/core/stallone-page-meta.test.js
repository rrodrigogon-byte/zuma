import test from 'node:test';
import assert from 'node:assert/strict';
import { stallonePageMeta } from './stallone-page-meta.js';
test('vitrine usa endereço verificado e imagem da Stallone, inclusive por alias', () => {
  const meta = stallonePageMeta('kytto.com.br', '/ecommerce/stallone');
  assert.equal(meta.indexar, true);
  assert.equal(meta.url, 'https://stallone.kytto.com.br/ecommerce/stallone');
  assert.match(meta.imagem, /stallone-icon-512.png$/);
});
test('páginas internas no domínio Stallone não são indexadas nem recebem canonical da loja', () => {
  for (const route of ['/login', '/admin/ecommerce', '/checkout/stallone', '/pedido/stallone']) {
    const meta = stallonePageMeta('stallone.kytto.com.br', route);
    assert.equal(meta.indexar, false);
    assert.equal(meta.url, '');
  }
});
test('não altera API, assets ou páginas de outras empresas', () => {
  for (const route of ['/api/info', '/brand/stallone-icon-512.png', '/ecommerce/dino']) assert.equal(stallonePageMeta('stallone.kytto.com.br', route), null);
  assert.equal(stallonePageMeta('dino.kytto.com.br', '/'), null);
  assert.equal(stallonePageMeta('stallone.kytto.com.br.evil.test', '/'), null);
});
