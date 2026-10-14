import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import { avecGovernanceNoStore } from './avec-import-http-policy.js';
test('política específica roda antes do parser global e protege erro de JSON/tamanho', async () => {
  const source = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  assert.ok(source.indexOf('app.use(avecGovernanceNoStore)') < source.indexOf('app.use(express.json('));
  const app = express(); app.use(avecGovernanceNoStore); app.use(express.json({ limit: '1mb' }));
  const route = '/api/admin/commerce/catalog/avec/governance/preview';
  app.post(route, (_req, res) => res.json({ writePerformed: false }));
  app.get('/unrelated', (_req, res) => res.json({ ok: true }));
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: 'Solicitação inválida' }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const [body, status] of [['{"PRIVATE-BODY":', 400], [JSON.stringify({ padding: 'x'.repeat(1024 * 1024) }), 413], ['{}', 200]]) {
      const res = await fetch(url + route + '?review=1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      assert.equal(res.status, status); assert.equal(res.headers.get('cache-control'), 'no-store'); assert.doesNotMatch(await res.text(), /PRIVATE-BODY|padding/);
    }
    assert.equal((await fetch(url + '/unrelated')).headers.get('cache-control'), null);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
