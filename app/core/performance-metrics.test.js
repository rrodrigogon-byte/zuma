import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createPerformanceMetrics } from './performance-metrics.js';

test('métricas usam padrão de rota, não dados do cliente, e preservam contagem e percentis', () => {
  let clock = 0;
  const metrics = createPerformanceMetrics({ now: () => clock });
  for (const ms of [20, 40, 1000]) {
    const res = new EventEmitter(); res.statusCode = ms === 1000 ? 503 : 200;
    metrics.middleware({ method: 'GET', route: { path: '/api/admin/clientes/:id' }, originalUrl: '/api/admin/clientes/SEGREDO?q=telefone' }, res, () => {});
    clock += ms; res.emit('finish');
  }
  const state = metrics.snapshot();
  assert.equal(state.routes[0].requests, 3);
  assert.equal(state.routes[0].serverErrors, 1);
  assert.equal(state.routes[0].p95UpperMs, 1000);
  assert.equal(JSON.stringify(state).includes('SEGREDO'), false);
});

test('métricas têm limite de rotas e ignoram páginas sem padrão administrativo', () => {
  const metrics = createPerformanceMetrics({ maxRoutes: 1 });
  for (const path of ['/api/admin/a', '/api/admin/b', '/api/admin/c', '/publico']) {
    const res = new EventEmitter(); res.statusCode = 200;
    metrics.middleware({ method: 'GET', route: { path } }, res, () => {}); res.emit('finish');
  }
  assert.deepEqual(metrics.snapshot().routes.map(x => [x.route, x.requests]), [['GET /api/admin/a', 1], ['OTHER', 2]]);
});
