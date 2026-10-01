import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');

async function request(base, route, options = {}) {
  const response = await fetch(`${base}${route}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}
async function aguardar(base, processo) {
  const inicio = Date.now();
  while (Date.now() - inicio < 15000) {
    if (processo.exitCode !== null) throw new Error(`server.js encerrou: ${processo.exitCode}`);
    try { const { response } = await request(base, '/api/info'); if (response.ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error('timeout aguardando server.js');
}

test('contas: esqueci-senha não troca senha, gestão de usuários respeita empresa, troca de e-mail exige senha', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'setpoint-contas-'));
  const dbPath = path.join(dir, 'db.json');
  const s = 'senha-de-teste-1';
  const h = bcrypt.hashSync(s, 4);
  const u = (id, email, role, extra = {}) => ({ id, nome: `U${id}`, email, senhaHash: h, role, ativo: true, ...extra });
  fs.writeFileSync(dbPath, JSON.stringify({ seq: 20, usuarios: [
    u(1, 'global@example.com', 'admin'),
    u(2, 'dono-a@example.com', 'admin', { empresaId: 'emp-a', lojaId: 'loja-a' }),
    u(3, 'staff-a@example.com', 'staff', { empresaId: 'emp-a', lojaId: 'loja-a' }),
    u(4, 'dono-b@example.com', 'admin', { empresaId: 'emp-b', lojaId: 'loja-b' }),
    u(5, 'plataforma@example.com', 'admin', { empresaId: 'emp-a' }),
    u(6, 'inativo-b@example.com', 'staff', { empresaId: 'emp-b', lojaId: 'loja-b', ativo: false }),
  ] }));
  const port = 32600 + Math.floor(Math.random() * 300);
  const base = `http://127.0.0.1:${port}`;
  const proc = spawn(process.execPath, ['server.js'], {
    cwd: path.join(ROOT, 'app'),
    env: { ...process.env, NODE_ENV: 'development', PORT: String(port), DB_PATH: dbPath, JWT_SECRET: 'contas-test-jwt', COMMERCE_CORE_ENABLED: '0', SEED_DEMO: '0', PLATFORM_ADMIN_EMAILS: 'plataforma@example.com', ADMIN_USER: 'global@example.com', WPP_BASE_URL: '', WPP_APIKEY: '', AI_API_KEY: '', OPENAI_API_KEY: '' },
    stdio: 'ignore',
  });
  const login = async (email, senha = s) => {
    const r = await request(base, '/api/admin/login', { method: 'POST', body: JSON.stringify({ user: email, pass: senha }) });
    return r.response.status === 200 ? { Authorization: `Bearer ${r.body.token}` } : null;
  };
  try {
    await aguardar(base, proc);

    // 1) esqueci-senha anônimo não trava a conta
    const esq = await request(base, '/api/auth/esqueci-senha', { method: 'POST', body: JSON.stringify({ email: 'dono-b@example.com' }) });
    assert.equal(esq.response.status, 200);
    const ha = await login('dono-b@example.com');
    assert.ok(ha, 'senha original continua válida após esqueci-senha');

    // 2) admin da empresa A não enxerga nem mexe em usuários de B / globais / plataforma
    const hA = await login('dono-a@example.com');
    assert.ok(hA);
    const directoryA = await request(base, '/api/admin/usuarios-diretorio', { headers: hA });
    assert.equal(directoryA.response.status, 200);
    assert.equal(directoryA.body.completo, false, 'Core desligado nunca implica diretório SQL completo');
    assert.deepEqual(directoryA.body.usuarios.map(x => x.email).sort(), ['dono-a@example.com', 'staff-a@example.com']);
    assert.ok(directoryA.body.usuarios.every(x => x.senhaHash === undefined && x.cpf === undefined));
    const deniedStaff = await login('staff-a@example.com');
    assert.equal((await request(base, '/api/admin/usuarios-diretorio', { headers: deniedStaff })).response.status, 403);
    const staleAdminToken = jwt.sign({ id: 3, email: 'staff-a@example.com', role: 'admin', empresaId: 'emp-a', lojaId: 'loja-a' }, 'contas-test-jwt');
    assert.equal((await request(base, '/api/admin/usuarios-diretorio', { headers: { Authorization: `Bearer ${staleAdminToken}` } })).response.status, 403, 'papel atual no cadastro prevalece sobre JWT antigo');
    const staleEmailToken = jwt.sign({ id: 2, email: 'dono-b@example.com', role: 'admin', empresaId: 'emp-a', lojaId: 'loja-a' }, 'contas-test-jwt');
    assert.equal((await request(base, '/api/admin/usuarios-diretorio', { headers: { Authorization: `Bearer ${staleEmailToken}` } })).response.status, 401, 'e-mail atual prevalece sobre identidade do JWT');
    assert.equal((await request(base, '/api/admin/usuarios-diretorio?empresaId=emp-b', { headers: hA })).body.usuarios.length, 2, 'query string não troca o tenant');
    const lista = await request(base, '/api/admin/usuarios', { headers: hA });
    if (lista.response.status === 200) {
      const emails = lista.body.map((x) => x.email).sort();
      assert.deepEqual(emails, ['dono-a@example.com', 'staff-a@example.com']);
    } else {
      assert.ok([401, 403].includes(lista.response.status));
    }
    for (const alvo of [1, 4, 5]) {
      const r = await request(base, `/api/admin/usuarios/${alvo}/reset-senha`, { method: 'POST', headers: hA });
      assert.notEqual(r.response.status, 200, `reset do usuário ${alvo} bloqueado`);
      assert.equal(r.body.senha, undefined);
      const p = await request(base, `/api/admin/usuarios/${alvo}`, { method: 'PATCH', headers: hA, body: JSON.stringify({ senha: 'invasor123' }) });
      assert.notEqual(p.response.status, 200);
      const d = await request(base, `/api/admin/usuarios/${alvo}`, { method: 'DELETE', headers: hA });
      assert.notEqual(d.response.status, 200);
    }
    assert.ok(await login('dono-b@example.com'), 'conta da empresa B intacta');
    assert.ok(await login('global@example.com'), 'conta global intacta');

    // dentro da própria empresa continua funcionando (quando a rota é acessível ao tenant)
    if (lista.response.status === 200) {
      const r = await request(base, '/api/admin/usuarios/3/reset-senha', { method: 'POST', headers: hA });
      assert.equal(r.response.status, 200);
      const novo = await request(base, '/api/admin/usuarios', { method: 'POST', headers: hA, body: JSON.stringify({ nome: 'Novo', email: 'novo-a@example.com', senha: 'senha-nova-1', role: 'staff' }) });
      assert.equal(novo.response.status, 200);
      assert.ok(await login('novo-a@example.com', 'senha-nova-1'));
      const salvo = JSON.parse(fs.readFileSync(dbPath, 'utf8')).usuarios.find((x) => x.email === 'novo-a@example.com');
      assert.equal(salvo.empresaId, 'emp-a', 'usuário criado por tenant herda a empresa');
      assert.equal(salvo.lojaId, 'loja-a');
      const self = await request(base, '/api/admin/usuarios/2', { method: 'DELETE', headers: hA });
      assert.notEqual(self.response.status, 200);
    }

    // módulos legados do evento: usuário de empresa não grava cardápio, loja nem estoque antigos
    for (const [metodo, rota, corpo] of [['POST', '/api/admin/cardapio', { nome: 'X', preco: 1 }], ['POST', '/api/admin/loja', { nome: 'X', preco: 1 }], ['POST', '/api/admin/estoque/ajuste', { id: 1, qtd: 1 }], ['POST', '/api/admin/loja/vender', { itens: [] }]]) {
      const r = await request(base, rota, { method: metodo, headers: hA, body: JSON.stringify(corpo) });
      assert.equal(r.response.status, 403, `${rota} bloqueada para empresa`);
      assert.equal(r.body.code, 'TENANT_USE_SCOPED_MODULE');
    }
    const cardapioGlobal = await request(base, '/api/admin/cardapio', { method: 'POST', headers: await login('global@example.com'), body: JSON.stringify({ nome: 'Água', preco: 5, cat: 'Bebidas' }) });
    assert.notEqual(cardapioGlobal.response.status, 403, 'admin global continua gerenciando o cardápio do evento');

    // global ainda gerencia todos
    const hG = await login('global@example.com');
    const listaG = await request(base, '/api/admin/usuarios', { headers: hG });
    assert.equal(listaG.response.status, 200);
    assert.ok(listaG.body.length >= 5);
    const all = await request(base, '/api/admin/usuarios-diretorio', { headers: hG });
    assert.equal(all.response.status, 200);
    assert.ok(all.body.usuarios.some(x => x.email === 'inativo-b@example.com' && x.ativo === false));
    assert.ok(all.body.usuarios.some(x => x.email === 'dono-b@example.com'));
    assert.equal(all.response.headers.get('cache-control'), 'private, no-store');

    // 3) troca de e-mail no perfil exige senha, unicidade e não pode ser reservado
    const hB = await login('dono-b@example.com');
    const semSenha = await request(base, '/api/auth/perfil', { method: 'PATCH', headers: hB, body: JSON.stringify({ email: 'outro-b@example.com' }) });
    assert.equal(semSenha.response.status, 401);
    const reservado = await request(base, '/api/auth/perfil', { method: 'PATCH', headers: hB, body: JSON.stringify({ email: 'plataforma@example.com', senhaAtual: s }) });
    assert.equal(reservado.response.status, 409);
    const duplicado = await request(base, '/api/auth/perfil', { method: 'PATCH', headers: hB, body: JSON.stringify({ email: 'dono-a@example.com', senhaAtual: s }) });
    assert.equal(duplicado.response.status, 409);
    const ok = await request(base, '/api/auth/perfil', { method: 'PATCH', headers: hB, body: JSON.stringify({ email: 'outro-b@example.com', senhaAtual: s }) });
    assert.equal(ok.response.status, 200);
    assert.ok(await login('outro-b@example.com'));
  } finally {
    proc.kill('SIGTERM');
  }
});
