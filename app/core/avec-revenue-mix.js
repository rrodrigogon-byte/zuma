import { createHash } from 'node:crypto';

export const DINO_MIX_SCOPE = Object.freeze({ empresaId: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6', lojaId: 'ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8', sourceUnitId: '102577' });
const HEADERS = ['Data','Comanda','Item','Tipo','Categoria','Profissional','Assistente 1','Assistente 2','Comissão (%)','Cliente','Email','Telefone','Celular','Valor','Desconto','Qtd.','Custo','Comissão','Líquido','UA'];
const TYPES = { 'Serviço': 'services', Produto: 'products', Pacote: 'plans', caixinha: 'tips' };
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function fail(message) { throw Object.assign(new Error(message), { code: 'AVEC_MIX_INVALID' }); }
export function moneyCents(value) {
  if (typeof value === 'string') {
    if (!/^-?(?:\d{1,3}(?:\.\d{3})*|\d+)(?:,\d{1,2})?$/.test(value.trim())) fail('Valor monetário inválido.');
    value = Number(value.trim().replaceAll('.', '').replace(',', '.'));
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isSafeInteger(Math.round(value * 100)) || Math.abs(value * 100 - Math.round(value * 100)) > 0.00001) fail('Valor monetário inválido.');
  return Math.round(value * 100);
}
function isoDay(value) {
  const match = String(value).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) fail('Data inválida.');
  const day = `${match[3]}-${match[2]}-${match[1]}`;
  if (new Date(`${day}T12:00:00Z`).toISOString().slice(0, 10) !== day) fail('Data inválida.');
  return day;
}
// Apenas agregados comerciais são persistidos. Contatos, nomes de clientes e
// profissionais não saem do normalizador. Valor já é o total da linha no 0186.
export function normalizeAvecRevenueMix(report) {
  if (!report || JSON.stringify(report.headers) !== JSON.stringify(HEADERS) || !Array.isArray(report.rows) || !report.rows.length || report.rows.length > 100000) fail('Esperado relatório completo Avec 0186, com cabeçalhos originais.');
  const counts = new Map();
  for (const row of report.rows) { if (!Array.isArray(row) || row.length !== HEADERS.length) fail('Linha incompleta.'); const key = hash(row); counts.set(key, (counts.get(key) || 0) + 1); }
  const groups = new Map();
  const summary = { sourceRows: report.rows.length, includedRows: 0, heldRows: 0, heldCents: 0, duplicateRows: 0, unknownTypeRows: 0, invalidRows: 0, sourceCents: 0, includedCents: 0, from: null, to: null };
  for (const row of report.rows) {
    const day = isoDay(row[0]);
    const gross = moneyCents(row[13]), discount = moneyCents(row[14]);
    const cents = gross - discount, quantity = Number(row[15]);
    const invalid = gross < 0 || discount < 0 || cents < 0 || !Number.isFinite(quantity) || quantity <= 0 || quantity > 100000 || !String(row[2] || '').trim();
    summary.sourceCents += cents;
    summary.from = !summary.from || day < summary.from ? day : summary.from;
    summary.to = !summary.to || day > summary.to ? day : summary.to;
    const duplicate = counts.get(hash(row)) > 1, type = TYPES[row[3]];
    if (duplicate || !type || invalid) { summary.heldRows++; summary.heldCents += cents; if (duplicate) summary.duplicateRows++; if (!type) summary.unknownTypeRows++; if (invalid) summary.invalidRows++; continue; }
    summary.includedRows++; summary.includedCents += cents;
    const name = String(row[2]).trim(), category = String(row[4] || 'Sem categoria').trim();
    const key = JSON.stringify([day, type, name, category]);
    const group = groups.get(key) || { day, type, name, category, cents: 0, quantity: 0, records: 0 };
    group.cents += cents; group.quantity += quantity; group.records++;
    groups.set(key, group);
  }
  if (![summary.sourceCents, summary.includedCents, summary.heldCents].every(Number.isSafeInteger)) fail('Total excede limite.');
  return { version: 1, reportHash: hash(report), sourceUnitId: DINO_MIX_SCOPE.sourceUnitId, summary, rows: [...groups.values()].sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) };
}
export function mixForPeriod(snapshot, from, to) {
  const groups = new Map();
  for (const row of snapshot?.rows || []) {
    if (row.day < from || row.day >= to) continue;
    const key = JSON.stringify([row.type, row.name, row.category]);
    const item = groups.get(key) || { type: row.type, name: row.name, category: row.category, cents: 0, quantity: 0, records: 0 };
    item.cents += row.cents; item.quantity += row.quantity; item.records += row.records; groups.set(key, item);
  }
  return [...groups.values()].map(({ cents, ...row }) => ({ ...row, value: cents / 100 })).sort((a,b) => b.value - a.value || a.name.localeCompare(b.name));
}
export function assertDinoMixScope(empresaId, lojaId) {
  if (empresaId !== DINO_MIX_SCOPE.empresaId || lojaId !== DINO_MIX_SCOPE.lojaId) throw Object.assign(new Error('Selecione a empresa Dino e a unidade Dino matriz.'), { code: 'AVEC_MIX_SCOPE' });
}
export async function loadAvecMix(client, empresaId, lojaId) {
  if (empresaId !== DINO_MIX_SCOPE.empresaId || (lojaId && lojaId !== DINO_MIX_SCOPE.lojaId)) return null;
  const result = await client.query('SELECT payload FROM kytto_avec_revenue_mix WHERE empresa_id=$1 AND loja_id=$2', [empresaId, DINO_MIX_SCOPE.lojaId]);
  return result.rows[0]?.payload || null;
}
export async function saveAvecMix(client, snapshot, { empresaId, lojaId, expectedPreviousHash, expectedReportHash }) {
  assertDinoMixScope(empresaId, lojaId);
  if (snapshot.reportHash !== expectedReportHash || !/^[a-f0-9]{64}$/.test(expectedReportHash || '') || (expectedPreviousHash !== null && !/^[a-f0-9]{64}$/.test(expectedPreviousHash || ''))) fail('Prévia inválida.');
  await client.query('BEGIN');
  try {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`avec-mix:${empresaId}:${lojaId}`]);
    const old = await loadAvecMix(client, empresaId, lojaId);
    if (old?.reportHash === snapshot.reportHash) { await client.query('COMMIT'); return { changed: false, reportHash: snapshot.reportHash }; }
    if ((old?.reportHash || null) !== expectedPreviousHash) throw Object.assign(new Error('O histórico mudou após a prévia. Gere nova conferência.'), { code: 'AVEC_MIX_CONFLICT' });
    // Um snapshot completo substitui o anterior; jamais acrescenta o histórico
    // novamente. Versões antigas ficam preservadas para auditoria/reversão.
    await client.query('INSERT INTO kytto_avec_revenue_mix_versions (empresa_id,loja_id,report_hash,payload) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING', [empresaId, lojaId, snapshot.reportHash, snapshot]);
    await client.query('INSERT INTO kytto_avec_revenue_mix (empresa_id,loja_id,report_hash,payload) VALUES ($1,$2,$3,$4) ON CONFLICT (empresa_id,loja_id) DO UPDATE SET report_hash=EXCLUDED.report_hash,payload=EXCLUDED.payload,updated_at=CURRENT_TIMESTAMP', [empresaId, lojaId, snapshot.reportHash, snapshot]);
    await client.query('COMMIT'); return { changed: true, reportHash: snapshot.reportHash };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
}
