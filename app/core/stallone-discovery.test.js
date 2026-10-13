import test from 'node:test';
import assert from 'node:assert/strict';
import { stalloneDiscovery } from './stallone-discovery.js';
import { stallonePageMeta } from './stallone-page-meta.js';

test('sitemap do domínio Stallone contém só o endereço canônico da loja', () => {
  const result = stalloneDiscovery('stallone.kytto.com.br', '/sitemap.xml');
  assert.equal(result.type, 'application/xml');
  const urls = [...result.body.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);
  assert.deepEqual(urls, [stallonePageMeta('stallone.kytto.com.br', '/').url]);
  assert.doesNotMatch(result.body, /setpoint|dino|\/admin|\/checkout/);
});
test('robots aponta sitemap Stallone sem anunciar áreas internas como públicas', () => {
  const result = stalloneDiscovery('www.stallone.kytto.com.br', '/robots.txt');
  assert.equal(result.type, 'text/plain');
  assert.match(result.body, /Sitemap: https:\/\/stallone.kytto.com.br\/sitemap.xml/);
  assert.match(result.body, /Disallow: \/api\//);
});
test('favicon usa somente o ícone existente da marca, sem destino fornecido pelo cliente', () => {
  assert.deepEqual(stalloneDiscovery('stallone.kytto.com.br', '/favicon.svg'), { redirect: '/brand/stallone-mark.svg' });
});
test('não interfere em outras marcas ou rotas', () => {
  for (const host of ['kytto.com.br', 'dino.kytto.com.br', 'stallone.kytto.com.br.evil.test', 'evil.test']) {
    for (const route of ['/robots.txt', '/sitemap.xml', '/favicon.svg']) assert.equal(stalloneDiscovery(host, route), null);
  }
  for (const route of ['/api/info', '/ecommerce/stallone', '/brand/stallone-mark.svg']) assert.equal(stalloneDiscovery('stallone.kytto.com.br', route), null);
});
