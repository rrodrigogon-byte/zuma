// Dados exclusivamente sintéticos. Mede cálculo, não a latência das telas.
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { scheduleStats } from '../app/dino-bi.js';
import { buildDinoDashboardAnalytics } from '../app/dino-dashboard.js';
import { buildIdentityGraph } from '../app/core/customer-360.js';
const now = new Date('2026-09-20T16:00:00Z');
const window = { fromDate: new Date('2026-09-01T04:00:00Z'), toDate: now };
const appointments = Array.from({ length: 2000 }, (_, i) => ({ id: String(i), dataHora: '2026-09-10T14:00:00Z', status: 'concluido' }));
const history = Array.from({ length: 50000 }, (_, i) => ({ id: `h-${i}`, dataAgenda: `2026-09-${String(i % 19 + 1).padStart(2, '0')}`, clienteNome: `Cliente ${i}`, servicoNome: 'Corte', valor: 50, status: 'concluido' }));
const clients = Array.from({ length: 3000 }, (_, i) => ({ id: String(i), nome: 'Cliente', telefone: '65999999999' }));
for (const [name, run] of [
  ['bi-2000', () => scheduleStats(appointments, window)],
  ['dashboard-50000', () => buildDinoDashboardAnalytics({ historicalAppointments: history }, { period: 30, now })],
  ['identity-shared-contact-3000', () => buildIdentityGraph({ localClients: clients })],
]) {
  const start = performance.now();
  const result = run();
  console.log(JSON.stringify({ name, node: process.version, milliseconds: Math.round(performance.now() - start), processPeakRssKB: process.resourceUsage().maxRSS,
    hash: createHash('sha256').update(JSON.stringify(result)).digest('hex') }));
}
