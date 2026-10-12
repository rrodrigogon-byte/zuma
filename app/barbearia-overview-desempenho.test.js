// Garante que a visão geral da barbearia continua rápida com uma base do tamanho
// da Dino após a migração da AVEC (3,3 mil clientes e ~1 mil agendamentos).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import bcrypt from 'bcryptjs';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const EMPRESA = 'empresa-desempenho';
const TOTAL_CLIENTES = 3300;
const TOTAL_AGENDAMENTOS = 1000;

function semear() {
  const clientes = {};
  for (let i = 0; i < TOTAL_CLIENTES; i += 1) {
    const id = `cli-${i}`;
    clientes[id] = { id, empresaId: EMPRESA, nome: `Cliente ${String(TOTAL_CLIENTES - i).padStart(5, '0')} Silva`, tipo: 'pf', telefone: `556599${String(100000 + i).padStart(7, '0')}`, email: '', status: 'ativo', criadoEm: '2026-10-09T12:00:00.000Z' };
  }
  const profissionais = { 'prof-1': { id: 'prof-1', empresaId: EMPRESA, nome: 'Barbeiro Um', ativo: true }, 'prof-2': { id: 'prof-2', empresaId: EMPRESA, nome: 'Barbeiro Dois', ativo: true } };
  const servicos = { 'srv-1': { id: 'srv-1', empresaId: EMPRESA, nome: 'Corte', preco: 50, duracaoMinutos: 30, ativo: true } };
  const agendamentos = {};
  const hoje = new Date();
  for (let i = 0; i < TOTAL_AGENDAMENTOS; i += 1) {
    const dia = new Date(hoje.valueOf() + (i % 60) * 86400000);
    const dataAgenda = dia.toISOString().slice(0, 10);
    const id = `age-${i}`;
    agendamentos[id] = { id, empresaId: EMPRESA, clienteId: `cli-${(i * 7) % TOTAL_CLIENTES}`, profissionalId: i % 2 ? 'prof-1' : 'prof-2', servicoId: 'srv-1', dataAgenda, dataHora: `${dataAgenda}T${String(8 + (i % 10)).padStart(2, '0')}:00:00.000Z`, duracaoMinutos: 30, status: 'agendado', valor: 50, criadoEm: '2026-10-10T12:00:00.000Z' };
  }
  return { clientesKytto: { empresas: { [EMPRESA]: { clientes } } }, barbearias: { [EMPRESA]: { profissionais, servicos, agendamentos } } };
}

async function request(base, route, options = {}) {
  const response = await fetch(`${base}${route}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  return { response, body: await response.json().catch(() => ({})) };
}

test('visão geral da barbearia responde rápido com base do porte da Dino', { timeout: 120000 }, async () => {
  const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'setpoint-overview-desempenho-'));
  const dbPath = path.join(diretorio, 'db.json');
  const senha = 'desempenho-only-test-pass';
  fs.writeFileSync(dbPath, JSON.stringify({
    seq: 1,
    usuarios: [{ id: 1, nome: 'Gestão', email: 'desempenho@example.com', senhaHash: bcrypt.hashSync(senha, 4), role: 'admin', ativo: true, empresaId: EMPRESA }],
    ...semear(),
  }));
  const port = 33000 + Math.floor(Math.random() * 500);
  const base = `http://127.0.0.1:${port}`;
  const processo = spawn(process.execPath, ['server.js'], {
    cwd: path.join(ROOT, 'app'),
    env: { ...process.env, NODE_ENV: 'development', PORT: String(port), DB_PATH: dbPath, JWT_SECRET: 'desempenho-only-jwt', COMMERCE_CORE_ENABLED: '0', SEED_DEMO: '0', WPP_BASE_URL: '', WPP_APIKEY: '', AI_API_KEY: '', OPENAI_API_KEY: '', GEMINI_API_KEY: '' },
    stdio: 'ignore',
  });
  try {
    const inicio = Date.now();
    while (Date.now() - inicio < 20000) {
      try { if ((await fetch(`${base}/api/info`)).ok) break; } catch {}
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    const login = await request(base, '/api/admin/login', { method: 'POST', body: JSON.stringify({ user: 'desempenho@example.com', pass: senha }) });
    assert.equal(login.response.status, 200);
    const headers = { Authorization: `Bearer ${login.body.token}` };
    const data = new Date().toISOString().slice(0, 10);

    const antes = Date.now();
    const overview = await request(base, `/api/admin/barbearia/overview?data=${data}`, { headers });
    const duracao = Date.now() - antes;

    assert.equal(overview.response.status, 200, JSON.stringify(overview.body).slice(0, 300));
    assert.equal(overview.body.clientes.length, TOTAL_CLIENTES);
    assert.equal(overview.body.relacionamento.indicadores.clientesAtivos, TOTAL_CLIENTES);
    const doDia = overview.body.agendamentos;
    assert.ok(doDia.length > 0, 'deve haver agendamentos no dia');
    // O enriquecimento continua resolvendo nome do cliente, do profissional e do serviço.
    for (const item of doDia) {
      assert.match(item.clienteNome, /^Cliente \d{5} Silva$/);
      assert.ok(['Barbeiro Um', 'Barbeiro Dois'].includes(item.profissionalNome));
      assert.equal(item.servicoNome, 'Corte');
    }
    // A ordenação por nome (pt-BR) se mantém.
    const nomes = overview.body.clientes.slice(0, 3).map((c) => c.nome);
    assert.deepEqual(nomes, ['Cliente 00001 Silva', 'Cliente 00002 Silva', 'Cliente 00003 Silva']);
    // Antes da correção esta chamada levava dezenas de segundos com esta base.
    assert.ok(duracao < 5000, `visão geral levou ${duracao} ms`);
    console.log(`overview com ${TOTAL_CLIENTES} clientes e ${TOTAL_AGENDAMENTOS} agendamentos: ${duracao} ms`);
  } finally {
    processo.kill('SIGTERM');
  }
});
