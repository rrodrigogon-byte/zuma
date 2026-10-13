import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const SENHA = 'fixture-comanda-only-pass';

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
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error('Tempo excedido aguardando server.js iniciar.');
}

test('router real prova comanda mista, parcial, replay, divergência, estoque, caixa, ledger e isolamento', async () => {
  const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'dino-comanda-jornada-'));
  const dbPath = path.join(diretorio, 'db.json');
  const port = 32500 + Math.floor(Math.random() * 400);
  const base = `http://127.0.0.1:${port}`;
  const senhaHash = bcrypt.hashSync(SENHA, 4);
  fs.writeFileSync(dbPath, JSON.stringify({
    seq: 1,
    usuarios: [
      { id: 1, nome: 'Operador Fixture A', email: 'operador-a@fixture.invalid', senhaHash, role: 'admin', ativo: true, empresaId: 'empresa-a.invalid', lojaId: 'loja-a.invalid' },
      { id: 2, nome: 'Operador Fixture B', email: 'operador-b@fixture.invalid', senhaHash, role: 'admin', ativo: true, empresaId: 'empresa-b.invalid', lojaId: 'loja-b.invalid' },
    ],
  }));
  const processo = spawn(process.execPath, ['server.js'], {
    cwd: path.join(ROOT, 'app'),
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      LANG: 'C.UTF-8',
      TZ: 'UTC',
      NODE_ENV: 'test',
      DB_PATH: dbPath,
      PORT: String(port),
      JWT_SECRET: 'fixture-only-jwt-secret',
      COMMERCE_CORE_ENABLED: '0',
      SEED_DEMO: '0',
      WPP_BASE_URL: '',
      WPP_APIKEY: '',
      AI_API_KEY: '',
      OPENAI_API_KEY: '',
      GEMINI_API_KEY: '',
    },
    stdio: 'ignore',
  });

  try {
    await aguardarServidor(base, processo);
    const loginA = await request(base, '/api/admin/login', { method: 'POST', body: JSON.stringify({ user: 'operador-a@fixture.invalid', pass: SENHA }) });
    assert.equal(loginA.response.status, 200);
    const headersA = { Authorization: `Bearer ${loginA.body.token}` };

    const servico = await request(base, '/api/admin/barbearia/servicos', {
      method: 'POST', headers: headersA,
      body: JSON.stringify({ nome: 'Servico fixture .invalid', duracaoMinutos: 30, preco: 50 }),
    });
    assert.equal(servico.response.status, 201);
    const produto = await request(base, '/api/admin/barbearia/estoque-revenda', {
      method: 'POST', headers: headersA,
      body: JSON.stringify({ nome: 'Produto fixture .invalid', sku: 'SKU-FIXTURE-INVALID', precoVenda: 30, estoqueAtual: 2, estoqueMinimo: 0 }),
    });
    assert.equal(produto.response.status, 201);

    const abertura = await request(base, '/api/admin/barbearia/operacao/caixas', {
      method: 'POST', headers: headersA,
      body: JSON.stringify({ confirmado: true, numeroCaixa: 1, valorAbertura: 0 }),
    });
    assert.equal(abertura.response.status, 201);
    const caixaId = abertura.body.caixa.id;

    const criada = await request(base, '/api/admin/barbearia/comandas', {
      method: 'POST', headers: headersA,
      body: JSON.stringify({
        clienteNome: 'Cliente fixture .invalid',
        itens: [
          { tipo: 'servico', servicoId: servico.body.servico.id },
          { tipo: 'produto', produtoId: produto.body.produto.id, quantidade: 1 },
        ],
      }),
    });
    assert.equal(criada.response.status, 201);
    const comandaId = criada.body.comanda.id;
    assert.equal(criada.body.comanda.total, 80);

    const parcialPayload = { confirmado: true, chaveIdempotencia: 'fixture-comanda-parcial-1', pagamentos: [{ meio: 'pix', valor: 20 }] };
    const parcial = await request(base, `/api/admin/barbearia/comandas/${comandaId}/pagamentos`, { method: 'POST', headers: headersA, body: JSON.stringify(parcialPayload) });
    assert.equal(parcial.response.status, 200);
    assert.equal(parcial.body.comanda.status, 'parcialmente_paga');
    assert.equal(parcial.body.comanda.totalFaturado, 20);
    assert.equal(parcial.body.comanda.totalPago, 20);
    assert.equal(parcial.body.comanda.saldoPendente, 60);
    assert.equal(parcial.body.comanda.pagamentos.length, 1);

    const retry = await request(base, `/api/admin/barbearia/comandas/${comandaId}/pagamentos`, { method: 'POST', headers: headersA, body: JSON.stringify(parcialPayload) });
    assert.equal(retry.response.status, 200);
    assert.equal(retry.body.comanda.idempotente, true);
    assert.equal(retry.body.comanda.pagamentos.length, 1);
    assert.equal(retry.body.comanda.saldoPendente, 60);

    const divergente = await request(base, `/api/admin/barbearia/comandas/${comandaId}/pagamentos`, {
      method: 'POST', headers: headersA,
      body: JSON.stringify({ ...parcialPayload, pagamentos: [{ meio: 'pix', valor: 21 }] }),
    });
    assert.equal(divergente.response.status, 400);
    assert.match(divergente.body.error, /payload diferente/i);
    const depoisDivergente = await request(base, `/api/admin/barbearia/comandas/${comandaId}`, { headers: headersA });
    assert.equal(depoisDivergente.body.comanda.pagamentos.length, 1);
    assert.equal(depoisDivergente.body.comanda.saldoPendente, 60);

    const finalPayload = {
      confirmado: true,
      chaveIdempotencia: 'fixture-comanda-final-1',
      pagamentos: [
        { meio: 'dinheiro', valor: 30, caixaId },
        { meio: 'pix', valor: 30 },
      ],
    };
    const [final, finalConcurrentRetry] = await Promise.all([
      request(base, `/api/admin/barbearia/comandas/${comandaId}/pagamentos`, { method: 'POST', headers: headersA, body: JSON.stringify(finalPayload) }),
      request(base, `/api/admin/barbearia/comandas/${comandaId}/pagamentos`, { method: 'POST', headers: headersA, body: JSON.stringify(finalPayload) }),
    ]);
    assert.equal(final.response.status, 200);
    assert.equal(finalConcurrentRetry.response.status, 200);
    assert.equal(final.body.comanda.status, 'paga');
    assert.equal(finalConcurrentRetry.body.comanda.status, 'paga');
    assert.equal([final.body.comanda.idempotente, finalConcurrentRetry.body.comanda.idempotente].filter(Boolean).length, 1);
    assert.equal(final.body.comanda.totalFaturado, 80);
    assert.equal(final.body.comanda.totalPago, 80);
    assert.equal(final.body.comanda.saldoPendente, 0);
    assert.equal(final.body.comanda.pagamentos.length, 3);
    assert.equal(finalConcurrentRetry.body.comanda.pagamentos.length, 3);

    const finalRetry = await request(base, `/api/admin/barbearia/comandas/${comandaId}/pagamentos`, { method: 'POST', headers: headersA, body: JSON.stringify(finalPayload) });
    assert.equal(finalRetry.response.status, 200);
    assert.equal(finalRetry.body.comanda.idempotente, true);
    assert.equal(finalRetry.body.comanda.pagamentos.length, 3);
    const mismatchAfterPaid = await request(base, `/api/admin/barbearia/comandas/${comandaId}/pagamentos`, {
      method: 'POST', headers: headersA,
      body: JSON.stringify({ ...finalPayload, pagamentos: [{ meio: 'dinheiro', valor: 31, caixaId }, { meio: 'pix', valor: 29 }] }),
    });
    assert.equal(mismatchAfterPaid.response.status, 400);
    assert.match(mismatchAfterPaid.body.error, /payload diferente/i);

    const movimentosCaixa = await request(base, `/api/admin/barbearia/operacao/caixas/${caixaId}/movimentos`, { headers: headersA });
    assert.equal(movimentosCaixa.response.status, 200);
    assert.equal(movimentosCaixa.body.movimentos.filter((item) => item.tipo === 'recebimento').length, 1);
    assert.equal(movimentosCaixa.body.movimentos.find((item) => item.tipo === 'recebimento').valor, 30);

    const estoque = await request(base, `/api/admin/barbearia/estoque-revenda?produtoId=${encodeURIComponent(produto.body.produto.id)}`, { headers: headersA });
    assert.equal(estoque.response.status, 200);
    assert.equal(estoque.body.produtos.find((item) => item.id === produto.body.produto.id).estoqueAtual, 1);
    const movimentosEstoque = await request(base, `/api/admin/barbearia/estoque-revenda/movimentos?produtoId=${encodeURIComponent(produto.body.produto.id)}`, { headers: headersA });
    assert.equal(movimentosEstoque.response.status, 200);
    assert.equal(movimentosEstoque.body.movimentos.filter((item) => item.tipo === 'saida_comanda' && item.comandaId === comandaId).length, 1);

    const resumo = await request(base, '/api/admin/barbearia/operacao/resumo', { headers: headersA });
    assert.equal(resumo.response.status, 200);
    assert.equal(resumo.body.operacao.faturamentoComandas, 80);
    assert.equal(resumo.body.operacao.receitaRecebida, 80);
    assert.deepEqual(resumo.body.operacao.porMeio, { pix: 50, dinheiro: 30 });
    assert.equal(resumo.body.operacao.recebimentosDinheiro, 30);

    const loginB = await request(base, '/api/admin/login', { method: 'POST', body: JSON.stringify({ user: 'operador-b@fixture.invalid', pass: SENHA }) });
    assert.equal(loginB.response.status, 200);
    const headersB = { Authorization: `Bearer ${loginB.body.token}` };
    const vazamento = await request(base, `/api/admin/barbearia/comandas/${comandaId}`, { headers: headersB });
    assert.equal(vazamento.response.status, 404);
    const estoqueB = await request(base, '/api/admin/barbearia/estoque-revenda', { headers: headersB });
    assert.equal(estoqueB.response.status, 200);
    assert.equal(estoqueB.body.produtos.some((item) => item.id === produto.body.produto.id), false);
  } finally {
    processo.kill('SIGTERM');
    await Promise.race([once(processo, 'exit'), new Promise((resolve) => setTimeout(resolve, 3000))]);
    fs.rmSync(diretorio, { recursive: true, force: true });
  }
});
