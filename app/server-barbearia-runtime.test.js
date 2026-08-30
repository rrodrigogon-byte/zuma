import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import bcrypt from 'bcryptjs';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');

async function request(base, route, options = {}) {
  const response = await fetch(`${base}${route}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function aguardarServidor(base, processo) {
  const inicio = Date.now();
  while (Date.now() - inicio < 12000) {
    if (processo.exitCode !== null) throw new Error(`server.js encerrou antes do healthcheck: ${processo.exitCode}`);
    try {
      const { response } = await request(base, '/api/info');
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('Tempo excedido aguardando server.js iniciar.');
}

test('server.js efetivo expõe Barbearia no contrato administrativo', async () => {
  const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'setpoint-barbearia-runtime-'));
  const dbPath = path.join(diretorio, 'db.json');
  const senhaTeste = 'runtime-only-test-pass';
  fs.writeFileSync(dbPath, JSON.stringify({
    seq: 1,
    usuarios: [{ id: 1, nome: 'Usuário de Teste', email: 'runtime@example.com', senhaHash: bcrypt.hashSync(senhaTeste, 4), role: 'admin', ativo: true }],
  }));
  const port = 32000 + Math.floor(Math.random() * 500);
  const base = `http://127.0.0.1:${port}`;
  const processo = spawn(process.execPath, ['server.js'], {
    cwd: path.join(ROOT, 'app'),
    env: { ...process.env, NODE_ENV: 'development', PORT: String(port), DB_PATH: dbPath, JWT_SECRET: 'runtime-only-jwt-secret', COMMERCE_CORE_ENABLED: '0', SEED_DEMO: '0' },
    stdio: 'ignore',
  });

  try {
    await aguardarServidor(base, processo);
    const login = await request(base, '/api/admin/login', { method: 'POST', body: JSON.stringify({ user: 'runtime@example.com', pass: senhaTeste }) });
    assert.equal(login.response.status, 200);
    const token = login.body.token;
    assert.ok(token);
    const headers = { Authorization: `Bearer ${token}` };

    const configuracoes = await request(base, '/api/admin/barbearia/configuracoes', { headers });
    assert.equal(configuracoes.response.status, 200);
    assert.equal(configuracoes.body.configuracao.intervaloMinutos, 30);

    const servico = await request(base, '/api/admin/barbearia/servicos', { method: 'POST', headers, body: JSON.stringify({ nome: 'Corte runtime', duracaoMinutos: 45, preco: 50 }) });
    assert.equal(servico.response.status, 201);
    const profissional = await request(base, '/api/admin/barbearia/profissionais', { method: 'POST', headers, body: JSON.stringify({ nome: 'Profissional runtime' }) });
    assert.equal(profissional.response.status, 201);
    const agenda = await request(base, '/api/admin/barbearia/agenda', { method: 'POST', headers, body: JSON.stringify({ clienteNome: 'Cliente runtime', profissionalId: profissional.body.profissional.id, servicoId: servico.body.servico.id, dataAgenda: '2030-06-10', dataHora: '2030-06-10T13:00:00.000Z' }) });
    assert.equal(agenda.response.status, 201);

    const listagem = await request(base, '/api/admin/barbearia/agenda?data=2030-06-10', { headers });
    assert.equal(listagem.response.status, 200);
    assert.equal(listagem.body.total, 1);
    assert.equal(listagem.body.agendamentos[0].servicoNome, 'Corte runtime');

    const confirmado = await request(base, `/api/admin/barbearia/agenda/${agenda.body.agendamento.id}/status`, { method: 'PATCH', headers, body: JSON.stringify({ status: 'confirmado' }) });
    assert.equal(confirmado.response.status, 200);
    const dashboard = await request(base, '/api/admin/barbearia/dashboard?data=2030-06-10', { headers });
    assert.equal(dashboard.response.status, 200);
    assert.equal(dashboard.body.indicadores.agendamentosHoje, 1);
  } finally {
    processo.kill('SIGTERM');
    await Promise.race([once(processo, 'exit'), new Promise((resolve) => setTimeout(resolve, 3000))]);
    fs.rmSync(diretorio, { recursive: true, force: true });
  }
});
