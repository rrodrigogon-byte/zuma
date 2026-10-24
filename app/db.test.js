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

function runDb(script, env) {
  return spawnSync(process.execPath, ['--input-type=module', '--eval', script], { cwd: appDir, encoding: 'utf8', env: { ...process.env, DB_BAK_INTERVAL_MS: '0', ...env } });
}

test('gravação em fluxo produz exatamente o JSON nativo (registros grandes, Unicode, Date, undefined)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kytto-db-hybrid-'));
  const databasePath = path.join(dir, 'db.json');
  fs.writeFileSync(databasePath, JSON.stringify({ seq: 1 }));
  const script = `
    import fs from 'node:fs';
    import { db, save } from './db.js';
    const base = db();
    base.grande = {};
    for (let i = 0; i < 12000; i++) base.grande['k' + i] = { id: i, texto: 'é "aspas" \\\\ \\u2028 ✂️', itens: [{ a: i, b: undefined, f: () => 1 }], meta: { ok: true, nada: undefined } };
    base.lista = Array.from({ length: 4000 }, (_, i) => (i % 3 ? { i } : undefined));
    base.quando = new Date(0);
    base.fora = undefined;
    base.profundo = { a: { b: { c: Object.fromEntries(Array.from({ length: 5000 }, (_, i) => ['x' + i, [i, null, NaN]])) } } };
    save();
    fs.writeFileSync(process.env.DB_PATH + '.esperado', JSON.stringify(base));
  `;
  try {
    const result = runDb(script, { DB_PATH: databasePath, DB_SAVE_COALESCE: '0' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.readFileSync(databasePath, 'utf8'), fs.readFileSync(databasePath + '.esperado', 'utf8'));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('agrupamento: várias chamadas viram uma gravação, leitura do arquivo e saída gravam o pendente', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kytto-db-coalesce-'));
  const databasePath = path.join(dir, 'db.json');
  fs.writeFileSync(databasePath, JSON.stringify({ seq: 1 }));
  const script = `
    import fs from 'node:fs';
    import { db, save, estadoGravacao, caminhoBanco } from './db.js';
    for (let i = 0; i < 5; i++) { db().contador = i; save(); }
    const antes = estadoGravacao();
    const lidoAntes = JSON.parse(fs.readFileSync(process.env.DB_PATH, 'utf8')).contador ?? null;
    setTimeout(() => {
      const depois = estadoGravacao();
      db().contador = 99; save();
      const arquivo = caminhoBanco();
      const lidoCaminho = JSON.parse(fs.readFileSync(arquivo, 'utf8')).contador;
      db().contador = 100; save();
      process.stdout.write(JSON.stringify({ antes: antes.gravacoes, alteracoes: antes.alteracoes, agrupadas: antes.gravacoesAgrupadas, pendente: antes.gravacaoPendente, lidoAntes, depois: depois.gravacoes, lidoCaminho }));
    }, 120);
  `;
  try {
    const result = runDb(script, { DB_PATH: databasePath, DB_SAVE_COALESCE: '1', DB_SAVE_COALESCE_MS: '20' });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { antes: 0, alteracoes: 5, agrupadas: 4, pendente: true, lidoAntes: null, depois: 1, lidoCaminho: 99 });
    assert.equal(JSON.parse(fs.readFileSync(databasePath, 'utf8')).contador, 100, 'a saída do processo grava o último pendente');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('agrupamento: falha de disco adiada é relançada no próximo save()', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kytto-db-coalesce-err-'));
  const databasePath = path.join(dir, 'db.json');
  fs.writeFileSync(databasePath, JSON.stringify({ seq: 1 }));
  const script = `
    import fs from 'node:fs';
    import { db, save } from './db.js';
    const original = fs.renameSync;
    let falhar = true;
    fs.renameSync = (...args) => { if (falhar) { const e = new Error('disco cheio'); e.code = 'ENOSPC'; throw e; } return original(...args); };
    db().x = 1; save();
    setTimeout(() => {
      let relancado = null;
      try { db().x = 2; save(); } catch (e) { relancado = e.code; }
      falhar = false;
      db().x = 3; save();
      process.stdout.write(JSON.stringify({ relancado }));
    }, 80);
  `;
  try {
    const result = runDb(script, { DB_PATH: databasePath, DB_SAVE_COALESCE: '1', DB_SAVE_COALESCE_MS: '10' });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { relancado: 'ENOSPC' });
    assert.equal(JSON.parse(fs.readFileSync(databasePath, 'utf8')).x, 3);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
