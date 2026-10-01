// Migration já aplicada em produção não pode ser editada: o banco não roda de novo e o
// arquivo passa a mentir sobre o schema (aconteceu com a 044 nas PRs #147, #148 e #150).
// Para mudar o schema, crie uma migration nova. Ao adicionar uma, registre o hash aqui:
//   node migrations/checksums.test.js --atualizar
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const dir = path.dirname(new URL(import.meta.url).pathname);
const manifestPath = path.join(dir, 'checksums.json');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, file))).digest('hex');

if (process.argv.includes('--atualizar')) {
  const current = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  for (const file of fs.readdirSync(dir).filter(name => name.endsWith('.sql'))) if (!current[file]) current[file] = hash(file);
  fs.writeFileSync(manifestPath, `${JSON.stringify(Object.fromEntries(Object.entries(current).sort()), null, 1)}\n`);
  console.log('checksums atualizados (só migrations novas)');
} else {
  test('migrations registradas não foram alteradas', () => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    for (const [file, expected] of Object.entries(manifest)) {
      assert.ok(fs.existsSync(path.join(dir, file)), `${file} foi removida`);
      assert.equal(hash(file), expected, `${file} foi editada depois de registrada; crie uma migration nova`);
    }
  });
  test('toda migration nova está registrada', () => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const missing = fs.readdirSync(dir).filter(name => name.endsWith('.sql') && !manifest[name]);
    assert.deepEqual(missing, [], 'rode: node migrations/checksums.test.js --atualizar');
  });
}
