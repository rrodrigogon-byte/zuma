import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import bcrypt from 'bcryptjs';
import { rotuloPrecoServico } from './barbearia-erp-kytto.js';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');

test('rótulo de preço para cliente e IA', () => {
  assert.equal(rotuloPrecoServico({ preco: 50, tipoPreco: 'fixo' }).replace(/\s/g, ' '), 'R$ 50,00');
  assert.equal(rotuloPrecoServico({ preco: 1850, tipoPreco: 'a_partir_de' }).replace(/\s/g, ' '), 'A partir de R$ 1.850,00');
  assert.equal(rotuloPrecoServico({ preco: 0, tipoPreco: 'sob_consulta' }), 'Sob consulta');
  assert.equal(rotuloPrecoServico({ preco: 30 }).replace(/\s/g, ' '), 'R$ 30,00');
});

async function request(base, route, options = {}) {
  const response = await fetch(`${base}${route}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  return { response, body: await response.json().catch(() => ({})) };
}

function proximoDiaUtil() {
  const d = new Date(Date.now() + 3 * 86400000);
  while (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function subir(nome, usuarios) {
  const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), `setpoint-${nome}-`));
  const dbPath = path.join(diretorio, 'db.json');
  fs.writeFileSync(dbPath, JSON.stringify({ seq: 1, usuarios }));
  const port = 34000 + Math.floor(Math.random() * 800);
  const base = `http://127.0.0.1:${port}`;
  const processo = spawn(process.execPath, ['server.js'], {
    cwd: path.join(ROOT, 'app'),
    env: { ...process.env, NODE_ENV: 'development', PORT: String(port), DB_PATH: dbPath, JWT_SECRET: `${nome}-only-jwt`, COMMERCE_CORE_ENABLED: '0', SEED_DEMO: '0', WPP_BASE_URL: '', WPP_APIKEY: '', AI_API_KEY: '', OPENAI_API_KEY: '', GEMINI_API_KEY: '' },
    stdio: 'ignore',
  });
  const inicio = Date.now();
  while (Date.now() - inicio < 20000) {
    try { if ((await fetch(`${base}/api/info`)).ok) break; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return { base, processo };
}

test('preço "a partir de"/"sob consulta", encaixe explícito e agenda sem aviso', { timeout: 60000 }, async () => {
  const senha = 'preco-encaixe-only-test-pass';
  const { base, processo } = await subir('preco-encaixe', [
    { id: 1, nome: 'Gestão', email: 'gestao@example.com', senhaHash: bcrypt.hashSync(senha, 4), role: 'admin', ativo: true, empresaId: 'empresa-pe' },
    { id: 2, nome: 'Staff', email: 'staff@example.com', senhaHash: bcrypt.hashSync(senha, 4), role: 'staff', ativo: true, empresaId: 'empresa-pe' },
  ]);
  try {
    const login = await request(base, '/api/admin/login', { method: 'POST', body: JSON.stringify({ user: 'gestao@example.com', pass: senha }) });
    const headers = { Authorization: `Bearer ${login.body.token}` };

    // Sob consulta pode ter preço zero; fixo continua exigindo preço positivo.
    const consulta = await request(base, '/api/admin/barbearia/servicos', { method: 'POST', headers, body: JSON.stringify({ nome: 'Coloração', preco: 0, tipoPreco: 'sob_consulta', duracaoMinutos: 30 }) });
    assert.equal(consulta.response.status, 201, JSON.stringify(consulta.body));
    assert.equal(consulta.body.servico.tipoPreco, 'sob_consulta');
    const fixoZero = await request(base, '/api/admin/barbearia/servicos', { method: 'POST', headers, body: JSON.stringify({ nome: 'Corte zero', preco: 0 }) });
    assert.equal(fixoZero.response.status, 400);
    const tipoErrado = await request(base, '/api/admin/barbearia/servicos', { method: 'POST', headers, body: JSON.stringify({ nome: 'Corte X', preco: 10, tipoPreco: 'promocional' }) });
    assert.equal(tipoErrado.response.status, 400);
    const aPartir = await request(base, '/api/admin/barbearia/servicos', { method: 'POST', headers, body: JSON.stringify({ nome: 'Prótese Capilar', preco: 1850, tipoPreco: 'a partir de', duracaoMinutos: 30 }) });
    assert.equal(aPartir.body.servico.tipoPreco, 'a_partir_de');
    const corte = await request(base, '/api/admin/barbearia/servicos', { method: 'POST', headers, body: JSON.stringify({ nome: 'Corte', preco: 50, duracaoMinutos: 30 }) });
    assert.equal(corte.body.servico.tipoPreco, 'fixo');

    const prof = await request(base, '/api/admin/barbearia/profissionais', { method: 'POST', headers, body: JSON.stringify({ nome: 'Barbeiro Encaixe', ativo: true, horaInicio: '06:00', horaFim: '21:00', diasSemana: [0, 1, 2, 3, 4, 5, 6] }) });
    assert.equal(prof.response.status, 201, JSON.stringify(prof.body));
    const data = proximoDiaUtil();
    const base1 = { profissionalId: prof.body.profissional.id, servicoId: corte.body.servico.id, dataAgenda: data, dataHora: `${data}T14:00:00.000Z`, origem: 'admin' };

    const primeiro = await request(base, '/api/admin/barbearia/agenda', { method: 'POST', headers, body: JSON.stringify({ ...base1, clienteNome: 'Cliente Um' }) });
    assert.equal(primeiro.response.status, 201, JSON.stringify(primeiro.body));
    assert.equal(primeiro.body.agendamento.encaixe, undefined);

    // Sem flag continua bloqueando a sobreposição.
    const conflito = await request(base, '/api/admin/barbearia/agenda', { method: 'POST', headers, body: JSON.stringify({ ...base1, clienteNome: 'Cliente Dois' }) });
    assert.equal(conflito.response.status, 400);
    assert.match(conflito.body.error, /indisponível/);

    // Com encaixe explícito entra e fica marcado; e a gestão pode não avisar o cliente.
    const encaixe = await request(base, '/api/admin/barbearia/agenda', { method: 'POST', headers, body: JSON.stringify({ ...base1, clienteNome: 'Cliente Dois', encaixe: true, notificarCliente: false }) });
    assert.equal(encaixe.response.status, 201, JSON.stringify(encaixe.body));
    assert.equal(encaixe.body.agendamento.encaixe, true);
    assert.equal(encaixe.body.notificacao.reason, 'customer_notification_disabled_by_staff');
    assert.equal(encaixe.body.notificacao.queued, 0);

    // Encaixe nunca vem do link público: o serviço "sob consulta" aparece com rótulo.
    const cfg = await request(base, '/api/admin/barbearia/configuracoes', { method: 'PATCH', headers, body: JSON.stringify({ slugPublico: 'pe-teste' }) });
    assert.equal(cfg.response.status, 200);
    const publico = await request(base, '/api/publico/agendamento/pe-teste');
    assert.equal(publico.response.status, 200);
    const rotulos = Object.fromEntries((publico.body.servicos || []).map((item) => [item.nome, item.preco_rotulo.replace(/\s/g, ' ')]));
    assert.deepEqual(rotulos, { 'Coloração': 'Sob consulta', Corte: 'R$ 50,00', 'Prótese Capilar': 'A partir de R$ 1.850,00' });

    // Quem não é gestão não pode silenciar o aviso ao cliente.
    const loginStaff = await request(base, '/api/admin/login', { method: 'POST', body: JSON.stringify({ user: 'staff@example.com', pass: senha }) });
    assert.equal(loginStaff.response.status, 200);
    const staffHeaders = { Authorization: `Bearer ${loginStaff.body.token}` };
    const semAviso = await request(base, '/api/admin/barbearia/agenda', { method: 'POST', headers: staffHeaders, body: JSON.stringify({ ...base1, dataHora: `${data}T16:00:00.000Z`, clienteNome: 'Cliente Três', notificarCliente: false }) });
    assert.equal(semAviso.response.status, 403);
    assert.equal(semAviso.body.code, 'AVISO_CLIENTE_OBRIGATORIO');
  } finally {
    processo.kill('SIGTERM');
  }
});
