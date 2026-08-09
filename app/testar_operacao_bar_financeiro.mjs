#!/usr/bin/env node
/**
 * Teste integrado isolado — Bar + Estoque + Clientes + Financeiro Central.
 * Não usa GCS e não altera dados de produção.
 */

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';

const port = 18082;
const base = `http://127.0.0.1:${port}`;
const dir = '/tmp/kytto-teste-bar-financeiro';
const dbPath = `${dir}/db.json`;
const resultadoPath = `${dir}/resultado.json`;

async function esperarServidor() {
  for (let tentativa = 0; tentativa < 100; tentativa += 1) {
    try {
      const resposta = await fetch(`${base}/health`);
      if (resposta.ok) return resposta.json();
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Servidor de teste não iniciou.');
}

async function requisicao(caminho, { method = 'GET', token = '', body } = {}) {
  const resposta = await fetch(`${base}${caminho}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const dados = await resposta.json().catch(() => ({}));
  return { resposta, dados };
}

async function api(caminho, opcoes = {}) {
  const { resposta, dados } = await requisicao(caminho, opcoes);
  if (!resposta.ok) {
    throw new Error(`${opcoes.method || 'GET'} ${caminho}: HTTP ${resposta.status} — ${dados.erro || dados.error || JSON.stringify(dados)}`);
  }
  return dados;
}

async function vender(token, produtoId, meio, dataOperacao, clienteId = null) {
  const mesas = await api('/api/mesas', { token });
  const mesa = mesas.fisicas.find((item) => item.status === 'livre');
  assert.ok(mesa, 'Deve haver mesa livre para a venda.');
  const abertura = await api(`/api/mesa/${mesa.num}/pedir`, {
    method: 'POST', token, body: { nome: `Cliente ${meio}`, itens: [] },
  });
  const comanda = await api(`/api/comanda/${abertura.comandaId}/adicionar`, {
    method: 'POST', token, body: { itens: [{ produtoId, qtd: 2, obs: 'Teste operacional' }] },
  });
  assert.equal(comanda.itens.length, 1, 'A comanda deve conter o item lançado.');
  await api(`/api/comanda/${abertura.comandaId}/conta`, { method: 'POST', token, body: {} });
  const pagamento = await api(`/api/comanda/${abertura.comandaId}/pagar`, {
    method: 'POST', token,
    body: {
      meio,
      clienteId,
      dataOperacao,
      dataVencimento: '2026-02-10T12:00:00.000Z',
    },
  });
  assert.equal(pagamento.ok, true, 'Pagamento deve encerrar a comanda.');
  assert.equal(pagamento.lancamentosFinanceiros.length, 1, 'Pagamento deve criar um lançamento financeiro.');
  return pagamento;
}

async function main() {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const servidor = spawn('node', ['server-erp.js'], {
    cwd: new URL('.', import.meta.url).pathname,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      SIMULATION_MODE: 'true',
      PORT: String(port),
      DB_PATH: dbPath,
      GCS_BUCKET: '',
      GCS_OBJECT: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logServidor = '';
  servidor.stdout.on('data', (dado) => { logServidor += dado.toString(); });
  servidor.stderr.on('data', (dado) => { logServidor += dado.toString(); });

  try {
    const health = await esperarServidor();
    assert.equal(health.status, 'ok');

    const login = await api('/api/admin/login', {
      method: 'POST',
      body: { user: 'admin@setpoint-ultra.local', senha: 'SetPoint@2026Temp' },
    });
    const token = login.token;
    assert.ok(token, 'Login administrativo deve retornar token.');

    await api('/api/admin/mesas/config', {
      method: 'POST', token, body: { mesasFisicas: 5 },
    });

    const catalogo = await api('/api/admin/cardapio', { token });
    assert.ok(catalogo.length >= 86, 'Catálogo inicial deve conter todos os itens Kytto.');
    const produto = catalogo[0];
    const produtoCozinha = catalogo.find((item) => item.cat === 'Espetinhos');
    assert.ok(produtoCozinha, 'Catálogo deve conter um item de produção para o KDS.');
    await api(`/api/admin/cardapio/${encodeURIComponent(produto.id)}`, {
      method: 'PATCH', token,
      body: { preco: 15, indisponivel: false, precoPendente: false },
    });
    await api(`/api/admin/cardapio/${encodeURIComponent(produtoCozinha.id)}`, {
      method: 'PATCH', token,
      body: { preco: 20, indisponivel: false, precoPendente: false, cozinha: true, setor: 'cozinha' },
    });
    await api('/api/admin/estoque/sincronizar-cardapio', { method: 'POST', token, body: {} });

    const fornecedorResp = await api('/api/admin/fornecedores', {
      method: 'POST', token,
      body: { nome: 'Fornecedor Simulação Bar', cnpj: '12345678000190', condicaoPagamento: '7 dias' },
    });
    const fornecedor = fornecedorResp.fornecedor;
    assert.ok(fornecedor?.id, 'Fornecedor deve ser criado.');

    const pedidoCompra = await api('/api/admin/compras/pedidos', {
      method: 'POST', token,
      body: {
        fornecedorId: fornecedor.id,
        condicaoPagamento: '7 dias',
        valorFrete: 5,
        itens: [{ produtoId: produto.id, descricao: produto.nome, quantidade: 1200, unidade: 'UN', valorUnitario: 5 }],
      },
    });
    assert.equal(pedidoCompra.pedido.status, 'aguardando_aprovacao', 'Compra acima da alçada deve aguardar aprovação.');
    const pedidoAprovado = await api(`/api/admin/compras/pedidos/${pedidoCompra.pedido.id}/aprovar`, {
      method: 'POST', token, body: {},
    });
    assert.equal(pedidoAprovado.pedido.status, 'aprovado', 'Pedido deve ser aprovado antes do recebimento.');
    const recebimento = await api(`/api/admin/compras/pedidos/${pedidoCompra.pedido.id}/receber`, {
      method: 'POST', token,
      body: { documento: 'NF-SIM-001', dataOperacao: '2026-02-01T12:00:00.000Z', statusFinanceiro: 'pendente' },
    });
    assert.equal(recebimento.pedido.status, 'recebido', 'Pedido aprovado deve ser recebido.');
    assert.equal(recebimento.entradasEstoque[0].quantidade, 1200, 'Recebimento deve alimentar o estoque.');
    assert.equal(recebimento.lancamentosFinanceiros[0].tipo, 'despesa', 'Recebimento deve criar uma despesa.');
    assert.equal(recebimento.lancamentosFinanceiros[0].valor, 6005, 'Despesa deve incluir mercadoria e frete rateado.');

    const contasPagar = await api('/api/admin/financeiro/contas-pagar', { token });
    assert.equal(contasPagar.length, 1, 'A compra recebida deve aparecer em contas a pagar.');
    const baixaCompra = await api('/api/admin/financeiro/pagamento', {
      method: 'POST', token,
      body: { lancamentoId: recebimento.lancamentosFinanceiros[0].id, dataPagamento: '2026-02-02T12:00:00.000Z', meioPagamento: 'pix' },
    });
    assert.equal(baixaCompra.lancamento.status, 'pago', 'Conta a pagar deve poder ser liquidada.');

    const clienteResp = await api('/api/admin/clientes', {
      method: 'POST', token,
      body: { nome: 'Cliente Crédito Bar', tipo: 'pf', cpfCnpj: '98765432100', limiteCreditoMensal: 5000, diasVencimento: 7 },
    });
    const cliente = clienteResp.cliente;
    assert.ok(cliente?.id, 'Cliente deve ser criado.');

    const aberturaCaixa = await api('/api/admin/caixa/abrir', {
      method: 'POST', token,
      body: { numeroCaixa: 1, valorAbertura: 100, dataOperacao: '2026-02-03T08:00:00.000Z', observacao: 'Abertura de teste' },
    });
    assert.equal(aberturaCaixa.caixa.status, 'aberto', 'Caixa deve abrir corretamente.');

    const vendaDinheiro = await vender(token, produto.id, 'dinheiro', '2026-02-03T12:00:00.000Z');
    await api('/api/admin/caixa/sangria', {
      method: 'POST', token,
      body: { caixaId: aberturaCaixa.caixa.id, valor: 20, descricao: 'Sangria de segurança', dataOperacao: '2026-02-03T18:00:00.000Z' },
    });
    await api('/api/admin/caixa/suprimento', {
      method: 'POST', token,
      body: { caixaId: aberturaCaixa.caixa.id, valor: 10, descricao: 'Reposição de troco', dataOperacao: '2026-02-03T18:30:00.000Z' },
    });
    const vendaPix = await vender(token, produto.id, 'pix', '2026-02-04T12:00:00.000Z');
    const vendaCartao = await vender(token, produto.id, 'cartao', '2026-02-05T12:00:00.000Z');
    const vendaConta = await vender(token, produto.id, 'conta', '2026-02-06T12:00:00.000Z', cliente.id);
    const contaReceber = vendaConta.contasReceber[0];
    assert.ok(contaReceber?.id, 'Venda lançada em conta deve criar conta a receber.');
    assert.equal(vendaConta.lancamentosFinanceiros[0].status, 'pendente', 'Venda em conta deve ficar pendente no financeiro.');

    const baixaConta = await api(`/api/admin/contas-receber/${contaReceber.id}`, {
      method: 'PATCH', token,
      body: { dataPagamento: '2026-02-10T12:00:00.000Z', meioPagamento: 'pix' },
    });
    assert.equal(baixaConta.conta.status, 'paga', 'Conta do cliente deve ser liquidada.');
    assert.equal(baixaConta.lancamentoFinanceiro.status, 'pago', 'Liquidação do cliente deve atualizar o livro-caixa.');

    // Produção: item de cozinha entra no KDS, bloqueia o fechamento e exige entrega.
    const mesasProducao = await api('/api/mesas', { token });
    const mesaProducao = mesasProducao.fisicas.find((item) => item.status === 'livre');
    const aberturaProducao = await api(`/api/mesa/${mesaProducao.num}/pedir`, {
      method: 'POST', token, body: { nome: 'Cliente Produção', itens: [] },
    });
    await api(`/api/comanda/${aberturaProducao.comandaId}/adicionar`, {
      method: 'POST', token, body: { itens: [{ produtoId: produtoCozinha.id, qtd: 1 }] },
    });
    const filaKds = await api('/api/kds/pedidos', { token });
    assert.equal(filaKds.pedidos.length, 1, 'KDS deve receber o item de cozinha.');
    const tentativaConta = await requisicao(`/api/comanda/${aberturaProducao.comandaId}/conta`, { method: 'POST', token, body: {} });
    assert.equal(tentativaConta.resposta.status, 409, 'Conta deve ser bloqueada enquanto item de cozinha estiver pendente.');
    await api(`/api/kds/comanda/${aberturaProducao.comandaId}/item/0/status`, { method: 'PATCH', token, body: { status: 'pronto' } });
    await api(`/api/kds/comanda/${aberturaProducao.comandaId}/item/0/status`, { method: 'PATCH', token, body: { status: 'entregue' } });
    await api(`/api/comanda/${aberturaProducao.comandaId}/conta`, { method: 'POST', token, body: {} });
    const vendaProducao = await api(`/api/comanda/${aberturaProducao.comandaId}/pagar`, {
      method: 'POST', token, body: { meio: 'dinheiro', dataOperacao: '2026-02-07T12:00:00.000Z' },
    });
    assert.equal(vendaProducao.ok, true, 'Item produzido deve poder ser faturado após a entrega.');

    const fechamentoCaixa = await api('/api/admin/caixa/fechar', {
      method: 'POST', token,
      body: { caixaId: aberturaCaixa.caixa.id, valorInformado: 120, dataOperacao: '2026-02-03T23:59:59.000Z' },
    });
    assert.equal(fechamentoCaixa.caixa.status, 'fechado', 'Caixa deve ser fechado.');
    assert.equal(fechamentoCaixa.resumo.valorEsperado, 120, 'Fechamento deve somar fundo, dinheiro, sangria e suprimento.');
    assert.equal(fechamentoCaixa.resumo.divergencia, 0, 'Fechamento correto não deve ter divergência.');

    const notaManual = await api('/api/admin/financeiro/lancamentos', {
      method: 'POST', token,
      body: {
        tipo: 'despesa',
        categoria: 'Utilities (Água/Luz)',
        descricao: 'Conta de energia — fevereiro',
        valor: 320.5,
        vencimento: '2026-02-12',
        obs: 'Lançamento manual de nota',
        dataOperacao: '2026-02-07T12:00:00.000Z',
      },
    });
    assert.equal(notaManual.origem, 'manual', 'Nota manual deve permanecer identificada.');

    const lancamentos = await api('/api/admin/financeiro/lancamentos', { token });
    assert.equal(lancamentos.length, 7, 'Livro-caixa deve conter compra, cinco vendas e nota manual.');
    assert.equal(lancamentos.filter((item) => item.origem === 'comanda').length, 5, 'Todas as vendas devem gerar eventos automáticos.');

    const resumo = await api('/api/admin/financeiro/resumo?data=2026-02-10', { token });
    assert.equal(resumo.recBar, 140, 'Receita de Bar deve refletir quatro comandas de R$ 30,00 e uma produção de R$ 20,00.');
    assert.equal(resumo.aPagar, 320.5, 'Nota manual pendente deve compor o contas a pagar.');

    const fluxo = await api('/api/admin/financeiro/fluxo?meses=1&data=2026-02-28', { token });
    assert.equal(fluxo.length, 1, 'Fluxo deve retornar o período solicitado.');
    assert.equal(fluxo[0].receitas, 140, 'Fluxo deve consolidar receitas recebidas do mês.');
    assert.equal(fluxo[0].despesas, 6005, 'Fluxo deve consolidar a compra liquidada.');

    const fechamento = await api('/api/admin/financeiro/fechamento', {
      method: 'POST', token, body: { data: '2026-02-10T12:00:00.000Z' },
    });
    assert.equal(fechamento.fechamento.data, '2026-02-10', 'Fechamento deve registrar a data informada.');

    const resultado = {
      ok: true,
      health,
      empresa: login.user.empresaId,
      fornecedorId: fornecedor.id,
      produtoId: produto.id,
      vendas: [vendaDinheiro.total, vendaPix.total, vendaCartao.total, vendaConta.total, vendaProducao.total],
      resumo,
      fluxo,
      fechamento: fechamento.fechamento,
      caixa: fechamentoCaixa,
      lancamentos: lancamentos.map(({ id, tipo, origem, status, valor, referencia }) => ({ id, tipo, origem, status, valor, referencia })),
    };
    await writeFile(resultadoPath, JSON.stringify(resultado, null, 2));
    console.log(JSON.stringify(resultado, null, 2));
  } catch (erro) {
    console.error(erro);
    console.error(logServidor.slice(-3000));
    process.exitCode = 1;
  } finally {
    if (servidor.exitCode === null && !servidor.killed) {
      const saiu = new Promise((resolve) => servidor.once('exit', resolve));
      servidor.kill('SIGTERM');
      await Promise.race([saiu, new Promise((resolve) => setTimeout(resolve, 3000))]);
    }
  }
}

main();
