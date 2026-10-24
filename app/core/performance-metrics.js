import { monitorEventLoopDelay, performance } from 'node:perf_hooks';

const BUCKETS = [25, 50, 100, 250, 500, 1000, 2500, 5000, Infinity];
export function createPerformanceMetrics({ now = () => performance.now(), maxRoutes = 128 } = {}) {
  const routes = new Map();
  const started = new Date().toISOString();
  function middleware(req, res, next) {
    const start = now();
    res.once('finish', () => {
      // Somente padrões cadastrados do Express: nunca URL, parâmetros ou query.
      if (typeof req.route?.path !== 'string' || !req.route.path.startsWith('/api/admin/')) return;
      let key = `${req.method} ${req.route.path}`;
      if (!routes.has(key) && routes.size >= maxRoutes) key = 'OTHER';
      if (!routes.has(key)) routes.set(key, { requests: 0, errors: 0, totalMs: 0, maxMs: 0, buckets: BUCKETS.map(() => 0) });
      const row = routes.get(key);
      const ms = Math.max(0, now() - start);
      row.requests += 1; row.errors += Number(res.statusCode >= 500);
      row.totalMs += ms; row.maxMs = Math.max(row.maxMs, ms);
      row.buckets[BUCKETS.findIndex(upper => ms <= upper)] += 1;
    });
    next();
  }
  function snapshot() {
    return { since: started, routes: [...routes].map(([route, row]) => {
      let cumulative = 0;
      const index = row.buckets.findIndex(count => { cumulative += count; return cumulative >= Math.ceil(row.requests * 0.95); });
      return { route, requests: row.requests, serverErrors: row.errors, meanMs: Math.round(row.totalMs / row.requests), maxMs: Math.round(row.maxMs), p95UpperMs: Number.isFinite(BUCKETS[index]) ? BUCKETS[index] : null, p95Over5000ms: index === BUCKETS.length - 1 };
    }) };
  }
  return { middleware, snapshot };
}

export function eventLoopMetrics() {
  const histogram = monitorEventLoopDelay({ resolution: 20 });
  histogram.enable();
  return { snapshot: () => ({ meanMs: Number.isFinite(histogram.mean) ? Math.round(histogram.mean / 1e6) : 0, p95Ms: Math.round(histogram.percentile(95) / 1e6), maxMs: Math.round(histogram.max / 1e6) }), close: () => histogram.disable() };
}
