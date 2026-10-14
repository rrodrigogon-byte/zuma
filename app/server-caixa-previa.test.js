import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const senha = 'fixture-preview-only';

function servico(id, lojaId, produtoId, custoMaterial) {
  return { id, empresaId: 'tenant-a', ...(lojaId ? { lojaId } : {}), nome: id, preco: 100, duracaoMinutos: 30, custoMaterial, consumoInterno: produtoId ? [{ produtoId, quantidade: 1 }] : [], ativo: true };
}

function produto(id, lojaId, custoUnitario) {
  return { id, empresaId: 'tenant-a', ...(lojaId ? { lojaId } : {}), nome: id, unidade: 'un', precoVenda: 10, custoUnitario, estoqueAtual: 10, estoqueMinimo: 0, ativo: true };
}

test('HTTP real: duas unidades no mesmo tenant não atravessam baseline; legado sem unidade fica bloqueado e não vira TAXA_NOVA/MATERIAL_NOVO', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dino-caixa-preview-'));
  const file = path.join(dir, 'db.json');
  const port = 33100 + Math.floor(Math.random() * 400);
  const base = `http://127.0.0.1:${port}`;
  const senhaHash = bcrypt.hashSync(senha, 4);
  fs.writeFileSync(file, JSON.stringify({
    seq: 10,
    usuarios: [
      { id: 1, nome: 'Fixture A', email: 'a@fixture.invalid', senhaHash, role: 'admin', ativo: true, empresaId: 'tenant-a', lojaId: 'unit-a' },
      { id: 2, nome: 'Fixture B', email: 'b@fixture.invalid', senhaHash, role: 'admin', ativo: true, empresaId: 'tenant-b', lojaId: 'unit-b' },
      { id: 3, nome: 'Fixture Staff', email: 'staff@fixture.invalid', senhaHash, role: 'staff', ativo: true, empresaId: 'tenant-a', lojaId: 'unit-a' },
      { id: 4, nome: 'Fixture A2', email: 'a2@fixture.invalid', senhaHash, role: 'admin', ativo: true, empresaId: 'tenant-a', lojaId: 'unit-b' },
    ],
    barbearias: { 'tenant-a': {
      configuracao: { taxasPagamento: { pix: { percentual: 9, fixa: 0, fonte: 'legado-tenant' } }, lojas: {} },
      servicos: {
        'service-unit-a': servico('service-unit-a', 'unit-a', 'product-unit-a', 1),
        'service-unit-b': servico('service-unit-b', 'unit-b', 'product-unit-b', 2),
        'service-legacy': servico('service-legacy', '', 'product-legacy', 99),
      },
      produtosRevenda: {
        'product-unit-a': produto('product-unit-a', 'unit-a', 1),
        'product-unit-b': produto('product-unit-b', 'unit-b', 2),
        'product-legacy': produto('product-legacy', '', 99),
      },
    } },
  }));
  const proc = spawn(process.execPath, ['server.js'], { cwd: path.join(ROOT, 'app'), env: {
    PATH: process.env.PATH, HOME: process.env.HOME, LANG: 'C.UTF-8', TZ: 'UTC', NODE_ENV: 'test', DB_PATH: file, PORT: String(port), JWT_SECRET: 'fixture-preview-jwt-only', COMMERCE_CORE_ENABLED: '0', SEED_DEMO: '0', WPP_BASE_URL: '', WPP_APIKEY: '', AI_API_KEY: '', GEMINI_API_KEY: '',
  }, stdio: 'ignore' });
  const req = async (route, body, token) => {
    const res = await fetch(base + route, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, cache: res.headers.get('cache-control'), body: await res.json().catch(() => ({})) };
  };
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) { if (proc.exitCode !== null) throw new Error('Servidor de fixture encerrou.'); try { ready = (await req('/api/info')).status === 200; } catch {} if (ready) break; await new Promise(r => setTimeout(r, 120)); }
    assert.equal(ready, true);
    const login = async user => { const r = await req('/api/admin/login', { user, pass: senha }); assert.equal(r.status, 200); return r.body.token; };
    const a = await login('a@fixture.invalid');
    const a2 = await login('a2@fixture.invalid');
    const b = await login('b@fixture.invalid');
    const staff = await login('staff@fixture.invalid');
    const endpoint = '/api/admin/barbearia/caixa/previa-taxas-materiais';
    const payloadA = { empresaId: 'tenant-a', lojaId: 'unit-a', idempotencyKey: 'fixture-preview-unit-a', taxas: [{ meio: 'pix', percentual: 2, fonte: 'fixture' }], materiais: [{ servicoId: 'service-unit-a', produtoId: 'product-unit-a', quantidade: 1, unidade: 'un', custoUnitario: 1, fonte: 'fixture' }], simulacoes: [{ servicoId: 'service-unit-a', bruto: 100, meio: 'pix' }] };
    const businessState = () => { const data = JSON.parse(fs.readFileSync(file, 'utf8')); delete data.auditoria; delete data.seq; return data; };
    const before = businessState();
    assert.equal((await req(endpoint, payloadA)).status, 401);
    assert.equal((await req(endpoint, payloadA, staff)).status, 403);
    const first = await req(endpoint, payloadA, a);
    assert.equal(first.status, 200);
    assert.equal(first.cache, 'no-store');
    assert.deepEqual(first.body.escopo, { empresaId: 'tenant-a', lojaId: 'unit-a' });
    assert.equal(first.body.somenteLeitura, true);
    assert.equal(first.body.gravacaoAplicada, false);
    assert.equal(first.body.status, 'pendente_revisao');
    assert.equal(first.body.linhas[0].liquido, 97);
    assert.equal(first.body.comparativo.status, 'parcial_bloqueado');
    assert.equal(first.body.comparativo.taxasAtuais, null);
    assert.equal(first.body.comparativo.materiaisAtuais, null);
    assert.match(first.body.comparativo.baseline.taxas.message, /não há vínculo explícito/);
    assert.match(first.body.comparativo.baseline.materiais.message, /registros legados sem vínculo explícito/);
    assert.equal(first.body.divergencias.some(item => ['TAXA_NOVA', 'MATERIAL_NOVO'].includes(item.tipo)), false);
    assert.equal((await req(endpoint, payloadA, a)).body.idempotente, true);

    const payloadB = { ...payloadA, lojaId: 'unit-b', idempotencyKey: 'fixture-preview-unit-b', materiais: [{ ...payloadA.materiais[0], servicoId: 'service-unit-b', produtoId: 'product-unit-b', custoUnitario: 2 }], simulacoes: [{ ...payloadA.simulacoes[0], servicoId: 'service-unit-b' }] };
    assert.equal((await req(endpoint, payloadB, a)).status, 409);
    const otherUnit = await req(endpoint, payloadB, a2);
    assert.equal(otherUnit.status, 200);
    assert.equal(otherUnit.body.escopo.lojaId, 'unit-b');
    assert.equal(otherUnit.body.comparativo.materiaisAtuais, null);
    assert.equal(otherUnit.body.comparativo.taxasAtuais, null);
    assert.equal(JSON.stringify(otherUnit.body).includes('service-unit-a'), false);
    assert.equal(JSON.stringify(otherUnit.body).includes('product-unit-a'), false);

    const legacy = await req(endpoint, { ...payloadA, idempotencyKey: 'fixture-preview-legacy', materiais: [{ ...payloadA.materiais[0], servicoId: 'service-legacy', produtoId: 'product-legacy' }], simulacoes: [{ ...payloadA.simulacoes[0], servicoId: 'service-legacy' }] }, a);
    assert.equal(legacy.status, 409);
    assert.equal(legacy.body.code, 'SERVICE_SCOPE_MISMATCH');
    assert.equal((await req(endpoint, payloadA, b)).status, 409);
    assert.deepEqual(businessState(), before);
    assert.ok(JSON.parse(fs.readFileSync(file, 'utf8')).auditoria.some(item => item.acao === `POST ${endpoint}`));
  } finally {
    proc.kill('SIGTERM');
    await Promise.race([once(proc, 'exit'), new Promise(r => setTimeout(r, 3000))]);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
