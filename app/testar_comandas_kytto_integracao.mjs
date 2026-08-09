import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { rm, mkdir } from 'node:fs/promises';

const port = 18080;
const base = `http://127.0.0.1:${port}`;
const testDir = '/tmp/kytto-comandas-integracao';
const dbPath = `${testDir}/db.json`;

async function esperarServidor() {
  let ultimoErro = null;
  for (let tentativa = 0; tentativa < 40; tentativa += 1) {
    try {
      const resposta = await fetch(`${base}/health`);
      if (resposta.ok) return;
    } catch (erro) {
      ultimoErro = erro;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Servidor local não iniciou: ${ultimoErro?.message || 'tempo esgotado'}`);
}

async function requisitar(caminho, { method = 'GET', token = '', body } = {}) {
  const resposta = await fetch(`${base}${caminho}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(`${method} ${caminho}: HTTP ${resposta.status} — ${dados.erro || dados.error || JSON.stringify(dados)}`);
  return dados;
}

await rm(testDir, { recursive: true, force: true });
await mkdir(testDir, { recursive: true });

const servidor = spawn('node', ['server-erp.js'], {
  cwd: new URL('.', import.meta.url).pathname,
  env: { ...process.env, NODE_ENV: 'development', PORT: String(port), DB_PATH: dbPath, GCS_BUCKET: '', GCS_OBJECT: '' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
servidor.stdout.on('data', (chunk) => { log += chunk.toString(); });
servidor.stderr.on('data', (chunk) => { log += chunk.toString(); });

try {
  await esperarServidor();

  const login = await requisitar('/api/admin/login', {
    method: 'POST',
    body: { user: 'admin@setpoint-ultra.local', senha: 'SetPoint@2026Temp' },
  });
  assert.ok(login.token, 'Login administrativo deve retornar token.');
  const token = login.token;

  await requisitar('/api/admin/mesas/config', {
    method: 'POST', token, body: { mesasFisicas: 3 },
  });
  await requisitar('/api/admin/cardapio', {
    method: 'POST', token,
    body: { nome: 'Produto de Teste para Comanda', marca: 'Kytto', tipo: 'Teste', embalagem: 'UN', cat: 'Bebidas', setor: 'bar', preco: 10, unidade: 'UN' },
  });
  const mesasIniciais = await requisitar('/api/mesas', { token });
  assert.ok(Array.isArray(mesasIniciais.fisicas) && mesasIniciais.fisicas.length > 0, 'Mapa físico de mesas deve existir.');
  const mesa = mesasIniciais.fisicas.find((item) => item.status === 'livre');
  assert.ok(mesa, 'Deve existir ao menos uma mesa livre para o teste.');

  const cardapio = await requisitar('/api/cardapio', { token });
  const produto = cardapio.find((item) => Number(item.preco) > 0);
  assert.ok(produto, 'Catálogo operacional deve conter ao menos um produto com preço válido.');

  const abertura = await requisitar(`/api/mesa/${mesa.num}/pedir`, {
    method: 'POST', token, body: { nome: 'Teste Integração Kytto', itens: [] },
  });
  assert.ok(abertura.comandaId, 'Abertura deve retornar identificador da comanda.');

  const aposAbertura = await requisitar('/api/mesas', { token });
  const mesaOcupada = aposAbertura.fisicas.find((item) => item.num === mesa.num);
  assert.equal(mesaOcupada.status, 'ocupada', 'Mesa deve permanecer ocupada após abertura.');
  assert.equal(mesaOcupada.comandaId, abertura.comandaId, 'Mesa deve manter vínculo com a comanda.');

  const comandaComItem = await requisitar(`/api/comanda/${abertura.comandaId}/adicionar`, {
    method: 'POST', token, body: { itens: [{ produtoId: produto.id, qtd: 2, obs: 'Teste de persistência' }] },
  });
  assert.equal(comandaComItem.itens.length, 1, 'Item deve ser incluído na comanda.');
  assert.equal(comandaComItem.itens[0].qtd, 2, 'Quantidade deve ser persistida.');
  assert.ok(comandaComItem.total > 0, 'Total deve ser calculado.');

  const contaSolicitada = await requisitar(`/api/comanda/${abertura.comandaId}/conta`, { method: 'POST', token, body: {} });
  assert.equal(contaSolicitada.comanda.status, 'conta', 'Solicitação de conta deve atualizar o status.');

  const pagamentoDinheiro = await requisitar(`/api/comanda/${abertura.comandaId}/pagar`, {
    method: 'POST', token, body: { meio: 'dinheiro' },
  });
  assert.equal(pagamentoDinheiro.ok, true, 'Pagamento em dinheiro deve encerrar a comanda.');

  const aposDinheiro = await requisitar('/api/mesas', { token });
  assert.equal(aposDinheiro.fisicas.find((item) => item.num === mesa.num).status, 'livre', 'Mesa deve ser liberada após pagamento.');

  const clienteCriado = await requisitar('/api/admin/clientes', {
    method: 'POST', token,
    body: { nome: 'Cliente Teste Conta', tipo: 'pf', limiteCreditoMensal: 1000, diasVencimento: 7 },
  });
  assert.ok(clienteCriado.cliente?.id, 'Cliente de teste deve ser criado no escopo da empresa ativa.');

  const segundaAbertura = await requisitar(`/api/mesa/${mesa.num}/pedir`, {
    method: 'POST', token, body: { nome: 'Cliente Teste Conta', itens: [{ produtoId: produto.id, qtd: 1 }] },
  });
  const pagamentoConta = await requisitar(`/api/comanda/${segundaAbertura.comandaId}/pagar`, {
    method: 'POST', token, body: { meio: 'conta', clienteId: clienteCriado.cliente.id },
  });
  assert.equal(pagamentoConta.ok, true, 'Pagamento em conta deve encerrar a comanda.');
  assert.equal(pagamentoConta.contasReceber.length, 1, 'Pagamento em conta deve criar uma conta a receber.');
  assert.equal(pagamentoConta.contasReceber[0].clienteId, clienteCriado.cliente.id, 'Conta a receber deve ficar vinculada ao cliente selecionado.');

  const aposConta = await requisitar('/api/mesas', { token });
  assert.equal(aposConta.fisicas.find((item) => item.num === mesa.num).status, 'livre', 'Mesa deve ser liberada após lançamento em conta.');

  console.log(JSON.stringify({ ok: true, cenarios: ['abrir', 'adicionar-item', 'pedir-conta', 'pagar-dinheiro', 'lancar-em-conta'], produto: produto.nome }, null, 2));
} finally {
  if (servidor.exitCode === null && !servidor.killed) {
    const encerrou = new Promise((resolve) => servidor.once('exit', resolve));
    servidor.kill('SIGTERM');
    await Promise.race([encerrou, new Promise((resolve) => setTimeout(resolve, 3000))]);
  }
  if (servidor.exitCode && servidor.exitCode !== 0 && !log.includes('Servidor rodando')) {
    console.error(log.slice(-3000));
  }
  await rm(testDir, { recursive: true, force: true });
}
