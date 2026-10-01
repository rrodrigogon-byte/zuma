import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'funnel-')), 'db.json');
const { recordStorefrontEvent, funnelSummary } = await import('./storefront-funnel.js');
const { db } = await import('./db.js');
const { buildDinoDashboardAnalytics } = await import('./dino-dashboard.js');

test('funil conta sessão única por evento e dia, sem guardar a sessão em claro', () => {
  const at = new Date('2026-09-10T15:00:00Z');
  assert.equal(recordStorefrontEvent('emp', { event: 'visit', sessionKey: 'sessao-aaaa-1', at, persist: false }).recorded, true);
  assert.equal(recordStorefrontEvent('emp', { event: 'visit', sessionKey: 'sessao-aaaa-1', at, persist: false }).reason, 'duplicate');
  recordStorefrontEvent('emp', { event: 'visit', sessionKey: 'sessao-bbbb-2', at, persist: false });
  recordStorefrontEvent('emp', { event: 'cart', sessionKey: 'sessao-bbbb-2', at, persist: false });
  assert.equal(recordStorefrontEvent('emp', { event: 'compra', sessionKey: 'sessao-bbbb-2', at, persist: false }).reason, 'invalid_event');
  assert.equal(recordStorefrontEvent('emp', { event: 'visit', sessionKey: 'x', at, persist: false }).reason, 'invalid_session');
  const total = funnelSummary('emp', new Date('2026-09-01T00:00:00Z'), new Date('2026-10-01T00:00:00Z'));
  assert.deepEqual({ visit: total.visit, cart: total.cart, checkout: total.checkout }, { visit: 2, cart: 1, checkout: 0 });
  assert.equal(funnelSummary('outra', new Date('2026-09-01T00:00:00Z'), new Date('2026-10-01T00:00:00Z')).visit, 0);
  assert.equal(JSON.stringify(db().storefrontFunnelKytto).includes('sessao-aaaa-1'), false);
});

test('painel mostra lucro estimado e conversão quando os dados existem', () => {
  const now = new Date('2026-09-25T12:00:00Z');
  const analytics = buildDinoDashboardAnalytics({
    commerceAvailable: true,
    commerceCurrent: { sales: { summary: { orders: 3, gross_total: 300 }, daily: [] } },
    commercePrevious: { sales: { summary: { orders: 1, gross_total: 100 } } },
    profit: { current: { resultado: 500, margem: 40, receita: 1250, comissoes: 400, cmvRevenda: 50, despesasPagas: 300, notas: [] }, previous: { resultado: 250 } },
    funnel: { current: { visit: 150, cart: 30, checkout: 10 }, previous: { visit: 100 } },
  }, { period: 30, now });
  const profit = analytics.kpis.find((kpi) => kpi.id === 'profit');
  assert.equal(profit.available, true);
  assert.equal(profit.value, 500);
  assert.equal(profit.trendPct, 100);
  const conversion = analytics.kpis.find((kpi) => kpi.id === 'conversion');
  assert.equal(conversion.available, true);
  assert.equal(conversion.value, 2);
  assert.equal(analytics.charts.funnel[0].value, 150);
  assert.equal(analytics.dataQuality.funnelAvailable, true);
  const vazio = buildDinoDashboardAnalytics({}, { period: 30, now });
  assert.equal(vazio.kpis.find((kpi) => kpi.id === 'profit').available, false);
  assert.equal(vazio.kpis.find((kpi) => kpi.id === 'conversion').available, false);
});
