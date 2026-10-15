import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');

test('Servidor real: desempenho GET, gestor, duas empresas/unidades, sem contatos e zero mudança de negócio', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dino-performance-http-'));
  const file = path.join(dir, 'db.json');
  const socket = net.createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening'); const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  const pass = 'fixture-performance-only'; const senhaHash = bcrypt.hashSync(pass, 4);
  const employee = (id, lojaId, nome) => ({ id, empresaId: 'tenant-a', lojaId, nome, ativo: true, percentualComissao: 40, percentualComissaoProduto: 10 });
  const command = (id, lojaId, profissionalId, subtotal = 200) => ({ id, empresaId: 'tenant-a', lojaId, profissionalId, status: 'paga', agendamentoId: id === 'c1' ? 'a1' : null, fechadaEm: '2026-10-10T14:00:00-04:00', total: subtotal, totalPago: subtotal, desconto: 20, clienteNome: 'CLIENT-PRIVATE-CANARY', itens: [{ id: `${id}-i`, tipo: 'servico', servicoId: 's1', nome: 'Serviço fixture', quantidade: 2, subtotal, profissionalId }], pagamentos: [{ meio: 'dinheiro', valor: subtotal - 20 }] });
  fs.writeFileSync(file, JSON.stringify({ seq: 10, usuarios: [
    { id: 1, nome: 'Manager fixture', email: 'manager@fixture.invalid', senhaHash, role: 'admin', ativo: true, empresaId: 'tenant-a', lojaId: 'unit-a' },
    { id: 2, nome: 'Staff fixture', email: 'staff@fixture.invalid', senhaHash, role: 'staff', ativo: true, empresaId: 'tenant-a', lojaId: 'unit-a' },
    { id: 3, nome: 'Other fixture', email: 'other@fixture.invalid', senhaHash, role: 'admin', ativo: true, empresaId: 'tenant-b', lojaId: 'unit-b' },
    { id: 4, nome: 'Unselected fixture', email: 'unselected@fixture.invalid', senhaHash, role: 'admin', ativo: true, empresaId: 'tenant-a' },
  ], barbearias: {
    'tenant-a': { configuracao: {}, profissionais: { p1: employee('p1', 'unit-a', 'Profissional A fixture'), p2: employee('p2', 'unit-b', 'OTHER-UNIT-EMPLOYEE-CANARY') }, servicos: { s1: { id: 's1', empresaId: 'tenant-a', lojaId: 'unit-a', nome: 'Serviço fixture', ativo: true, preco: 100 } }, comandas: { c1: command('c1', 'unit-a', 'p1'), c2: command('c2', 'unit-b', 'p2', 999999), legacy: command('legacy', '', 'p1', 888888) }, agendamentos: { a1: { id: 'a1', empresaId: 'tenant-a', lojaId: 'unit-a', profissionalId: 'p1', servicoId: 's1', status: 'concluido', dataHora: '2026-10-10T12:00:00-04:00', dataAgenda: '2026-10-10', clienteNome: 'CLIENT-PRIVATE-CANARY' } }, vendasRevenda: {} },
    'tenant-b': { configuracao: {}, profissionais: {}, agendamentos: {}, comandas: {}, vendasRevenda: {}, servicos: {} },
  } }));
  const proc = spawn(process.execPath, ['server.js'], { cwd: path.join(ROOT, 'app'), env: { PATH: process.env.PATH, HOME: process.env.HOME, LANG: 'C.UTF-8', TZ: 'UTC', NODE_ENV: 'test', DB_PATH: file, PORT: String(port), JWT_SECRET: 'fixture-performance-jwt-only', COMMERCE_CORE_ENABLED: '0', SEED_DEMO: '0', WPP_BASE_URL: '', WPP_APIKEY: '', GEMINI_API_KEY: '' }, stdio: 'ignore' });
  const request = async (route, { token, method = 'GET', body, headers = {} } = {}) => { const response = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) }); return { status: response.status, cache: response.headers.get('cache-control'), body: await response.json().catch(() => ({})) }; };
  try {
    let ready = false; for (let n = 0; n < 100; n++) { if (proc.exitCode !== null) throw new Error('Servidor fixture encerrou.'); try { ready = (await request('/api/info')).status === 200; } catch {} if (ready) break; await new Promise(resolve => setTimeout(resolve, 100)); }
    assert.equal(ready, true);
    const login = async user => { const r = await request('/api/admin/login', { method: 'POST', body: { user, pass } }); assert.equal(r.status, 200); return r.body.token; };
    const manager = await login('manager@fixture.invalid'); const staff = await login('staff@fixture.invalid'); const other = await login('other@fixture.invalid'); const unselected = await login('unselected@fixture.invalid');
    const state = () => { const snapshot = JSON.parse(fs.readFileSync(file)); delete snapshot.auditoria; delete snapshot.seq; return snapshot; };
    const before = state(); const route = '/api/admin/barbearia/equipe/desempenho?inicio=2026-10-01&fim=2026-10-15';
    const anonymous = await request(route); assert.equal(anonymous.status, 401); assert.equal(anonymous.cache, 'no-store');
    assert.equal((await request(route, { token: staff })).status, 403);
    assert.equal((await request(route, { token: unselected })).status, 409);
    const result = await request(route, { token: manager }); assert.equal(result.status, 200); assert.equal(result.cache, 'no-store'); assert.equal(result.body.summary.revenue, 180); assert.equal(result.body.readOnly, true); assert.deepEqual(result.body.scope, { empresaId: 'tenant-a', lojaId: 'unit-a' });
    assert.equal(JSON.stringify(result.body).includes('OTHER-UNIT'), false); assert.equal(JSON.stringify(result.body).includes('CLIENT-PRIVATE'), false); assert.equal(JSON.stringify(result.body).includes('888888'), false);
    assert.equal((await request(route, { token: manager, headers: { 'x-loja-id': 'unit-b' } })).status, 403);
    const otherResult = await request(route, { token: other }); assert.equal(otherResult.status, 200); assert.equal(JSON.stringify(otherResult.body).includes('Profissional A fixture'), false);
    for (const method of ['POST', 'PATCH', 'DELETE']) assert.equal((await request(route, { token: manager, method })).status, 405);
    assert.deepEqual(state(), before);
  } finally { proc.kill('SIGTERM'); await Promise.race([once(proc, 'exit'), new Promise(resolve => setTimeout(resolve, 3000))]); fs.rmSync(dir, { recursive: true, force: true }); }
});
