import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import bcrypt from 'bcryptjs';
import { normalizarNascimento } from './clientes-contas-kytto.js';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');

test('normalizarNascimento aceita os formatos do balcão e rejeita datas inválidas', () => {
  assert.deepEqual(normalizarNascimento('1990-05-17'), { dataNascimento: '1990-05-17', aniversario: '05-17' });
  assert.deepEqual(normalizarNascimento('17/05/1990'), { dataNascimento: '1990-05-17', aniversario: '05-17' });
  assert.deepEqual(normalizarNascimento('7/5'), { dataNascimento: '', aniversario: '05-07' });
  assert.deepEqual(normalizarNascimento('29/02'), { dataNascimento: '', aniversario: '02-29' });
  assert.deepEqual(normalizarNascimento(''), { dataNascimento: '', aniversario: '' });
  assert.throws(() => normalizarNascimento('31/02/1990'), /inválida/);
  assert.throws(() => normalizarNascimento('29/02/2001'), /inválida/);
  assert.throws(() => normalizarNascimento('amanhã'), /inválida/);
  assert.throws(() => normalizarNascimento('01/01/1800'), /intervalo/);
});

async function request(base, route, options = {}) {
  const response = await fetch(`${base}${route}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  return { response, body: await response.json().catch(() => ({})) };
}

test('cliente da barbearia guarda aniversário e aparece entre os aniversariantes', { timeout: 60000 }, async () => {
  const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'setpoint-aniversario-'));
  const dbPath = path.join(diretorio, 'db.json');
  const senha = 'aniversario-only-test-pass';
  fs.writeFileSync(dbPath, JSON.stringify({ seq: 1, usuarios: [{ id: 1, nome: 'Gestão', email: 'aniversario@example.com', senhaHash: bcrypt.hashSync(senha, 4), role: 'admin', ativo: true, empresaId: 'empresa-aniversario' }] }));
  const port = 33600 + Math.floor(Math.random() * 300);
  const base = `http://127.0.0.1:${port}`;
  const processo = spawn(process.execPath, ['server.js'], {
    cwd: path.join(ROOT, 'app'),
    env: { ...process.env, NODE_ENV: 'development', PORT: String(port), DB_PATH: dbPath, JWT_SECRET: 'aniversario-only-jwt', COMMERCE_CORE_ENABLED: '0', SEED_DEMO: '0', WPP_BASE_URL: '', WPP_APIKEY: '', AI_API_KEY: '', OPENAI_API_KEY: '', GEMINI_API_KEY: '' },
    stdio: 'ignore',
  });
  try {
    const inicio = Date.now();
    while (Date.now() - inicio < 20000) {
      try { if ((await fetch(`${base}/api/info`)).ok) break; } catch {}
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    const login = await request(base, '/api/admin/login', { method: 'POST', body: JSON.stringify({ user: 'aniversario@example.com', pass: senha }) });
    assert.equal(login.response.status, 200);
    const headers = { Authorization: `Bearer ${login.body.token}` };

    const criado = await request(base, '/api/admin/barbearia/clientes', { method: 'POST', headers, body: JSON.stringify({ nome: 'Ana Aniversário', telefone: '65999990001', dataNascimento: '12/10/1990' }) });
    assert.equal(criado.response.status, 201);
    assert.equal(criado.body.cliente.dataNascimento, '1990-10-12');
    assert.equal(criado.body.cliente.aniversario, '10-12');

    const invalido = await request(base, '/api/admin/barbearia/clientes', { method: 'POST', headers, body: JSON.stringify({ nome: 'Data errada', dataNascimento: '31/02/1990' }) });
    assert.equal(invalido.response.status, 400);

    // Editar outro campo não apaga o aniversário.
    const editado = await request(base, `/api/admin/barbearia/clientes/${criado.body.cliente.id}`, { method: 'PATCH', headers, body: JSON.stringify({ email: 'ana@example.com' }) });
    assert.equal(editado.response.status, 200);
    assert.equal(editado.body.cliente.aniversario, '10-12');

    const semAno = await request(base, '/api/admin/barbearia/clientes', { method: 'POST', headers, body: JSON.stringify({ nome: 'Bruno Sem Ano', aniversario: '15/10' }) });
    assert.equal(semAno.body.cliente.aniversario, '10-15');
    await request(base, '/api/admin/barbearia/clientes', { method: 'POST', headers, body: JSON.stringify({ nome: 'Carla Fora da Janela', dataNascimento: '01/01/1985' }) });

    const lista = await request(base, '/api/admin/barbearia/clientes/aniversariantes?data=2026-10-11&dias=7', { headers });
    assert.equal(lista.response.status, 200);
    assert.deepEqual(lista.body.aniversariantes.map((item) => [item.nome, item.emDias, item.idade]), [['Ana Aniversário', 1, 36], ['Bruno Sem Ano', 4, null]]);
    assert.equal(lista.body.aniversariantes[0].marketingWhatsapp, false);
  } finally {
    processo.kill('SIGTERM');
  }
});
