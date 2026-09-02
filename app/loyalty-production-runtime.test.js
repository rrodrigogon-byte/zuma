import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const server = readFileSync(new URL('./server.js', import.meta.url), 'utf8');
const render = readFileSync(new URL('../render.yaml', import.meta.url), 'utf8');
const app = readFileSync(new URL('../web/src/App.jsx', import.meta.url), 'utf8');
const page = readFileSync(new URL('../web/src/pages/admin/CanaisFidelidade.jsx', import.meta.url), 'utf8');
const panel = readFileSync(new URL('../web/src/pages/admin/LoyaltyAdvancedPanel.jsx', import.meta.url), 'utf8');

function routeBlock(method, path) {
  const marker = `app.${method}('${path}'`;
  const start = server.indexOf(marker);
  assert.notEqual(start, -1, `rota ausente: ${method.toUpperCase()} ${path}`);
  return server.slice(start, start + 1400);
}

test('Render publica server.js e a rota de interface monta CanaisFidelidade', () => {
  assert.match(render, /startCommand:\s*cd app && node server\.js/);
  assert.match(app, /path="\/admin\/omnichannel"\s+element=\{<Layout><CanaisFidelidade \/><\/Layout>\}/);
});

test('visão avançada exige customers.read no runtime produtivo', () => {
  assert.match(routeBlock('get', '/api/admin/fidelidade/avancada'), /loyaltyAdvancedContext\(req, 'customers\.read'\)/);
  assert.match(routeBlock('get', '/api/admin/fidelidade/avancada/clientes/:id'), /loyaltyAdvancedContext\(req, 'customers\.read'\)/);
});

test('níveis e catálogo exigem customers.write no runtime produtivo', () => {
  assert.match(routeBlock('put', '/api/admin/fidelidade/avancada/niveis'), /loyaltyAdvancedContext\(req, 'customers\.write'\)/);
  assert.match(routeBlock('post', '/api/admin/fidelidade/avancada/recompensas'), /loyaltyAdvancedContext\(req, 'customers\.write'\)/);
  assert.match(routeBlock('put', '/api/admin/fidelidade/avancada/recompensas/:id'), /loyaltyAdvancedContext\(req, 'customers\.write'\)/);
});

test('resgate, entrega e cancelamento exigem orders.write e confirmação do serviço', () => {
  assert.match(routeBlock('post', '/api/admin/fidelidade/avancada/recompensas/:id/resgatar'), /loyaltyAdvancedContext\(req, 'orders\.write'\)/);
  assert.match(routeBlock('patch', '/api/admin/fidelidade/avancada/resgates/:id/entregar'), /loyaltyAdvancedContext\(req, 'orders\.write'\)/);
  assert.match(routeBlock('post', '/api/admin/fidelidade/avancada/resgates/:id/cancelar'), /loyaltyAdvancedContext\(req, 'orders\.write'\)/);
  assert.match(server, /confirmar:\s*req\.body\?\.confirmar/);
  assert.match(server, /idempotencyKey:\s*req\.body\?\.idempotency_key\s*\|\|\s*req\.get\('Idempotency-Key'\)/);
});

test('tela canônica carrega e renderiza o painel avançado com falha isolada', () => {
  assert.match(page, /Promise\.allSettled/);
  assert.match(page, /api\.get\('\/api\/admin\/fidelidade\/avancada'\)/);
  assert.match(page, /<LoyaltyAdvancedPanel/);
  assert.match(page, /Selecione um cliente ranqueado/);
});

test('painel usa somente o namespace administrativo produtivo', () => {
  assert.match(panel, /const LOYALTY_API = '\/api\/admin\/fidelidade\/avancada'/);
  assert.doesNotMatch(panel, /\/api\/omnichannel\/fidelidade/);
  assert.match(panel, /confirmar:\s*true/);
  assert.match(panel, /idempotency_key:\s*redemption\.idempotencyKey/);
});
