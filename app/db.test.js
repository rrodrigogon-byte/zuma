import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const appDir = path.dirname(fileURLToPath(import.meta.url));

test('login audit batches sequence allocation into one durable save and preserves the previous JSON snapshot', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kytto-db-save-'));
  const databasePath = path.join(dir, 'db.json');
  const previous = JSON.stringify({ seq: 7, auditoria: [{ id: 6, acao: 'previous' }] });
  fs.writeFileSync(databasePath, previous);

  const script = `
    import { db, nextId, save, estadoGravacao } from './db.js';
    const id = nextId({ persist: false });
    db().auditoria.push({ id, acao: 'LOGIN painel' });
    save();
    process.stdout.write(JSON.stringify({ id, gravacoes: estadoGravacao().gravacoes }));
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
    cwd: appDir,
    encoding: 'utf8',
    env: { ...process.env, DB_PATH: databasePath, DB_BAK_INTERVAL_MS: '0' },
  });

  try {
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.deepEqual(JSON.parse(result.stdout), { id: 7, gravacoes: 1 });
    assert.equal(fs.readFileSync(databasePath + '.bak', 'utf8'), previous);
    const current = JSON.parse(fs.readFileSync(databasePath, 'utf8'));
    assert.equal(current.seq, 8);
    assert.deepEqual(current.auditoria.at(-1), { id: 7, acao: 'LOGIN painel' });
    const backupStat = fs.statSync(databasePath + '.bak');
    assert.notEqual(backupStat.ino, fs.statSync(databasePath).ino);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('carrega db.json em streaming sem perder valores aninhados ou Unicode', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kytto-db-stream-'));
  const databasePath = path.join(dir, 'db.json');
  const esperado = {
    seq: 42,
    config: { marca: 'Dino — Barbearia', regras: { ativo: true, limite: null } },
    historico: Array.from({ length: 5000 }, (_, index) => ({ id: index, texto: `corte ${index} ✂️`, itens: [{ quantidade: 1, valor: index + 0.5 }] })),
    vazio: [],
  };
  fs.writeFileSync(databasePath, JSON.stringify(esperado));
  const script = `
    import { db } from './db.js';
    process.stdout.write(JSON.stringify({ seq: db().seq, marca: db().config.marca, total: db().historico.length, ultimo: db().historico.at(-1).texto, vazio: db().vazio.length }));
  `;
  try {
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
      cwd: appDir,
      encoding: 'utf8',
      env: { ...process.env, DB_PATH: databasePath },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.deepEqual(JSON.parse(result.stdout), { seq: 42, marca: 'Dino — Barbearia', total: 5000, ultimo: 'corte 4999 ✂️', vazio: 0 });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
