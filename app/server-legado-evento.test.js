import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { spawn } from 'node:child_process';

// Telas do evento (banco global): Torneios, Quadras do torneio e KDS liam rotas que não existiam
// no server.js de produção. Este teste sobe o server.js real e confere as leituras e o isolamento.
const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const SENHA = 'fixture-evento-only-pass';

async function request(base, route, options = {}) {
  const response = await fetch(`${base}${route}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function aguardarServidor(base, processo) {
  const inicio = Date.now();
  while (Date.now() - inicio < 12000) {
    if (processo.exitCode !== null) throw new Error(`server.js encerrou antes do healthcheck: ${processo.exitCode}`);
    try { const { response } = await request(base, '/api/info'); if (response.ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error('Tempo excedido aguardando server.js iniciar.');
}

test('torneios, quadras do torneio e KDS respondem no server.js; usuário de empresa não lê o evento', async () => {
  const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'kytto-evento-'));
  const dbPath = path.join(diretorio, 'db.json');
  const port = 33000 + Math.floor(Math.random() * 400);
  const base = `http://127.0.0.1:${port}`;
  const senhaHash = bcrypt.hashSync(SENHA, 4);
  const agora = new Date().toISOString();
  const antigo = new Date(Date.now() - 45 * 60000).toISOString();
  fs.writeFileSync(dbPath, JSON.stringify({
    seq: 10,
    usuarios: [
      { id: 1, nome: 'Organizador Fixture', email: 'organizador@fixture.invalid', senhaHash, role: 'admin', ativo: true },
      { id: 2, nome: 'Recepcao Empresa Fixture', email: 'empresa@fixture.invalid', senhaHash, role: 'admin', ativo: true, empresaId: 'empresa-a.invalid', lojaId: 'loja-a.invalid' },
    ],
    torneios: [{ id: 3, nome: 'Torneio Fixture', status: 'aberto', categorias: [] }],
    quadras: [{ id: 'q1', nome: 'Quadra 1', ativa: true }],
    reservas: [
      { id: 4, quadraId: 'q1', quadraNome: 'Quadra 1', data: '2026-10-20', horaInicio: '08:00', horaFim: '09:00', status: 'confirmada', socioNome: 'Atleta A' },
      { id: 6, quadraId: 'q1', quadraNome: 'Quadra 1', data: '2026-10-20', horaInicio: '10:00', horaFim: '11:00', status: 'confirmada', socioNome: 'Atleta B' },
    ],
    comandas: [{
      id: 5, nome: 'Mesa 7', tipo: 'fisica', status: 'aberta', criadoEm: antigo,
      itens: [
        { nome: 'Porção fixture', qtd: 1, setor: 'cozinha', cozinha: true, status: 'em_preparo', criadoEm: antigo },
        { nome: 'Chopp fixture', qtd: 2, setor: 'bar', cozinha: false, status: 'entregue', criadoEm: agora },
      ],
    }],
  }));
  const processo = spawn(process.execPath, ['server.js'], {
    cwd: path.join(ROOT, 'app'),
    env: { PATH: process.env.PATH, HOME: process.env.HOME, LANG: 'C.UTF-8', TZ: 'UTC', NODE_ENV: 'test', DB_PATH: dbPath, PORT: String(port),
      JWT_SECRET: 'fixture-only-jwt-secret', COMMERCE_CORE_ENABLED: '0', SEED_DEMO: '0', WPP_BASE_URL: '', WPP_APIKEY: '', AI_API_KEY: '', OPENAI_API_KEY: '', GEMINI_API_KEY: '' },
    stdio: 'ignore',
  });
  try {
    await aguardarServidor(base, processo);
    const login = await request(base, '/api/admin/login', { method: 'POST', body: JSON.stringify({ user: 'organizador@fixture.invalid', pass: SENHA }) });
    assert.equal(login.response.status, 200);
    const h = { Authorization: `Bearer ${login.body.token}` };

    const torneios = await request(base, '/api/admin/torneios', { headers: h });
    assert.equal(torneios.response.status, 200);
    assert.ok(torneios.body.some((t) => t.nome === 'Torneio Fixture'));

    const reservas = await request(base, '/api/admin/quadras/reservas?data=2026-10-20', { headers: h });
    assert.equal(reservas.response.status, 200);
    assert.equal(reservas.body.length, 2);
    const editada = await request(base, '/api/admin/quadras/reservas/4', { method: 'PATCH', headers: h, body: JSON.stringify({ horaFim: '09:30', socioNome: 'Atleta A Silva', id: 999 }) });
    assert.equal(editada.response.status, 200);
    assert.equal(editada.body.horaFim, '09:30');
    assert.equal(editada.body.socioNome, 'Atleta A Silva');
    assert.equal(editada.body.id, 4, 'o id não é alterável pelo corpo');
    const choque = await request(base, '/api/admin/quadras/reservas/4', { method: 'PATCH', headers: h, body: JSON.stringify({ horaFim: '10:30' }) });
    assert.equal(choque.response.status, 409, 'não sobrepõe a reserva das 10h');

    const kds = await request(base, '/api/setores/pedidos', { headers: h });
    assert.equal(kds.response.status, 200);
    assert.equal(kds.body.pedidos.length, 1);
    assert.deepEqual(kds.body.pedidos[0].itens.map((i) => [i.nome, i.indice, i.status]), [['Porção fixture', 0, 'em_preparo']], 'item do bar já entregue não aparece');
    const metricas = await request(base, '/api/admin/kds/metricas', { headers: h });
    assert.equal(metricas.body.metricas.atrasados, 1);
    const pronto = await request(base, '/api/kds/comanda/5/item/0/status', { method: 'PATCH', headers: h, body: JSON.stringify({ status: 'pronto' }) });
    assert.equal(pronto.response.status, 200);
    const invalido = await request(base, '/api/kds/comanda/5/item/0/status', { method: 'PATCH', headers: h, body: JSON.stringify({ status: 'novo' }) });
    assert.equal(invalido.response.status, 409);
    const cancelar = await request(base, '/api/kds/comanda/5/item/0/status', { method: 'PATCH', headers: h, body: JSON.stringify({ status: 'cancelado' }) });
    assert.equal(cancelar.response.status, 409, 'cancelar item é pelo PDV (devolve estoque e tira da conta)');

    // usuário preso a uma empresa não lê o banco global do evento
    const loginEmpresa = await request(base, '/api/admin/login', { method: 'POST', body: JSON.stringify({ user: 'empresa@fixture.invalid', pass: SENHA }) });
    const he = { Authorization: `Bearer ${loginEmpresa.body.token}` };
    assert.equal((await request(base, '/api/admin/torneios', { headers: he })).response.status, 403);
    assert.equal((await request(base, '/api/setores/pedidos', { headers: he })).response.status, 403);
    assert.equal((await request(base, '/api/kds/comanda/5/item/0/status', { method: 'PATCH', headers: he, body: JSON.stringify({ status: 'entregue' }) })).response.status, 403);
  } finally {
    processo.kill('SIGTERM');
    await once(processo, 'exit').catch(() => {});
    fs.rmSync(diretorio, { recursive: true, force: true });
  }
});
