// Sem --apply, só confere. Nunca grava o JSON nem altera a fonte das telas.
import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { planHistoryArchive, previewHistoryArchive, applyHistoryArchive } from '../core/barbershop-history-archive.js';

const args = Object.fromEntries(process.argv.slice(2).map(arg => { const [key, ...value] = arg.replace(/^--/, '').split('='); return [key, value.join('=') || true]; }));
const file = process.env.DB_PATH;
if (!file || !path.isAbsolute(file)) throw new Error('DB_PATH absoluto é obrigatório');
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!connectionString) throw new Error('Conexão PostgreSQL gerenciada é obrigatória');
const scope = { empresaId: args.empresa, lojaId: args.loja };
const getSource = async () => JSON.parse(await fs.readFile(file, 'utf8'));
const client = new pg.Client({ connectionString, ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false } });
try {
  await client.connect();
  const result = args.apply
    ? await applyHistoryArchive(client, { getSource, ...scope, expectedSourceHash: args['source-hash'], confirm: args.apply === true })
    : await previewHistoryArchive(client, planHistoryArchive(await getSource(), scope));
  console.log(JSON.stringify(result));
} catch (error) {
  console.error(JSON.stringify({ ok: false, code: error.code || 'HISTORY_ARCHIVE_FAILED', applied: false }));
  process.exitCode = 1;
} finally { await client.end(); }
