import fs from 'node:fs';
import path from 'node:path';

const DISK_ROOT = '/var/data';

// Called before db.js load() and before any seed/save. Never print account data
// or parse errors: missing/corrupt durable storage requires manual recovery.
export function assertDurableLegacyJson({ env = process.env, io = fs } = {}) {
  if (env.NODE_ENV !== 'production' || env.RENDER !== 'true' || env.GCS_BUCKET) return true;

  const configured = String(env.DB_PATH || '').trim();
  if (!configured || !path.isAbsolute(configured)) throw new Error('LEGACY_DB_DURABILITY_REQUIRED');
  const dbPath = path.resolve(configured);
  if (!dbPath.startsWith(`${DISK_ROOT}/`)) throw new Error('LEGACY_DB_DURABILITY_REQUIRED');

  try {
    const mounted = io.readFileSync('/proc/self/mountinfo', 'utf8')
      .split('\n').some(line => line.split(' ')[4] === DISK_ROOT);
    const realDir = io.realpathSync(path.dirname(dbPath));
    if (!mounted || (realDir !== DISK_ROOT && !realDir.startsWith(`${DISK_ROOT}/`))) {
      throw new Error('LEGACY_DB_DURABILITY_REQUIRED');
    }
    // save() writes .tmp and rotates .bak. Do not follow any existing link,
    // including a dangling one that existsSync would mistake for an absent file.
    for (const candidate of [dbPath, `${dbPath}.bak`, `${dbPath}.tmp`]) {
      try {
        const info = io.lstatSync(candidate);
        if (!info.isFile() || info.isSymbolicLink()
          || !io.realpathSync(candidate).startsWith(`${DISK_ROOT}/`)) {
          throw new Error('LEGACY_DB_DURABILITY_REQUIRED');
        }
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
    // A .bak may be healthy even when the primary is corrupt. On Render do NOT
    // auto-load it: the next save() could rotate the corrupt primary over the
    // only good backup. Stop for a verified, reversible manual restore instead.
    const data = JSON.parse(io.readFileSync(dbPath, 'utf8'));
    const hasActiveAdmin = Array.isArray(data?.usuarios) && data.usuarios.some(user =>
      user && user.ativo === true && user.role === 'admin'
      && typeof user.email === 'string' && user.email.trim()
      && typeof user.senhaHash === 'string' && user.senhaHash.length > 0);
    if (!hasActiveAdmin) throw new Error('LEGACY_DB_DURABILITY_REQUIRED');
  } catch {
    throw new Error('LEGACY_DB_DURABILITY_REQUIRED');
  }
  return true;
}
