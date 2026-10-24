import { createHash } from 'node:crypto';

const COLLECTIONS = ['historicoAtendimentos', 'historicoComandas'];
const fail = code => Object.assign(new Error(code), { code });
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
const hash = value => createHash('sha256').update(value).digest('hex');
const rowKey = row => JSON.stringify([row.collection, row.source_id]);
const manifest = rows => hash(rows.map(row => [rowKey(row), row.content_hash]).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(row => JSON.stringify(row)).join('\n'));

export function planHistoryArchive(root, { empresaId, lojaId } = {}) {
  if (typeof empresaId !== 'string' || !empresaId.trim() || typeof lojaId !== 'string' || !lojaId.trim()) throw fail('HISTORY_SCOPE_REQUIRED');
  const state = root?.barbearias?.[empresaId];
  if (!state) throw fail('HISTORY_COMPANY_NOT_FOUND');
  const rows = [], excluded = { missingStore: 0, otherStore: 0 };
  for (const collection of COLLECTIONS) {
    const keys = new Set();
    for (const [id, source] of Object.entries(state[collection] || {})) {
      if (!source?.lojaId) { excluded.missingStore += 1; continue; }
      if (String(source.lojaId) !== lojaId) { excluded.otherStore += 1; continue; }
      if (source.id !== id || source.empresaId !== empresaId) throw fail('HISTORY_RECORD_SCOPE_MISMATCH');
      const document = JSON.parse(JSON.stringify(source));
      const sourceKey = typeof source.sourceKey === 'string' && source.sourceKey ? source.sourceKey : null;
      if (sourceKey && keys.has(sourceKey)) throw fail('HISTORY_DUPLICATE_SOURCE_KEY');
      if (sourceKey) keys.add(sourceKey);
      rows.push({ collection, source_id: id, source_key: sourceKey, content_hash: hash(canonical(document)), document });
    }
  }
  return { empresaId, lojaId, sourceHash: manifest(rows), rows, excluded };
}

export function publicArchivePlan(plan) {
  return { empresaId: plan.empresaId, lojaId: plan.lojaId, sourceHash: plan.sourceHash, records: plan.rows.length,
    collections: Object.fromEntries(COLLECTIONS.map(collection => [collection, plan.rows.filter(row => row.collection === collection).length])),
    excluded: plan.excluded, financialWrites: 0, stockWrites: 0, sourceWrites: 0, readSourceChanged: false };
}

async function targetRows(client, plan) {
  return (await client.query('SELECT collection, source_id, content_hash, document FROM kytto_barbershop_history_archive WHERE empresa_id=$1 AND loja_id=$2', [plan.empresaId, plan.lojaId])).rows;
}
function compare(plan, target) {
  if (target.some(row => hash(canonical(row.document)) !== row.content_hash)) throw fail('HISTORY_TARGET_CORRUPT');
  const source = new Map(plan.rows.map(row => [rowKey(row), row.content_hash]));
  if (target.some(row => !source.has(rowKey(row)) || source.get(rowKey(row)) !== row.content_hash)) throw fail('HISTORY_ARCHIVE_CONFLICT');
  return { existing: target.length, missing: plan.rows.length - target.length };
}
export async function previewHistoryArchive(client, plan) {
  return { ...publicArchivePlan(plan), ...compare(plan, await targetRows(client, plan)), applied: false };
}

// A transação pertence a este executor. Nunca o chame dentro de outra transação.
export async function applyHistoryArchive(client, { getSource, empresaId, lojaId, expectedSourceHash, confirm = false }) {
  const plan = planHistoryArchive(await getSource(), { empresaId, lojaId });
  if (!confirm || !expectedSourceHash || expectedSourceHash !== plan.sourceHash || !plan.rows.length) throw fail('HISTORY_PREVIEW_REQUIRED');
  await client.query('BEGIN');
  try {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [JSON.stringify(['history-archive', empresaId, lojaId])]);
    const before = compare(plan, await targetRows(client, plan));
    let inserted = 0;
    for (let offset = 0; offset < plan.rows.length; offset += 250) {
      const result = await client.query(`INSERT INTO kytto_barbershop_history_archive (empresa_id, loja_id, collection, source_id, source_key, content_hash, document)
        SELECT $1,$2,r.collection,r.source_id,r.source_key,r.content_hash,r.document
        FROM jsonb_to_recordset($3::jsonb) AS r(collection text, source_id text, source_key text, content_hash text, document jsonb)
        ON CONFLICT (empresa_id,loja_id,collection,source_id) DO NOTHING`, [empresaId, lojaId, JSON.stringify(plan.rows.slice(offset, offset + 250))]);
      inserted += result.rowCount;
    }
    const target = await targetRows(client, plan);
    compare(plan, target);
    if (manifest(target) !== plan.sourceHash) throw fail('HISTORY_TARGET_MISMATCH');
    const fresh = planHistoryArchive(await getSource(), { empresaId, lojaId });
    if (fresh.sourceHash !== plan.sourceHash) throw fail('HISTORY_SOURCE_CHANGED');
    await client.query('COMMIT');
    return { ...publicArchivePlan(plan), existing: before.existing, inserted, verifiedHash: manifest(target), applied: true };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
