#!/usr/bin/env node
/**
 * ============================================================================
 * SIMULAÇÃO INTEGRADA DE 30 DIAS — BAR KYTTO
 * ============================================================================
 * Ambiente isolado: DB_PATH temporário + GCS desabilitado + SIMULATION_MODE.
 * Fluxos: compras, aprovação, recebimento, estoque, KDS/produção, PDV,
 * pagamentos, clientes/contas a receber, caixa diário, fechamento e financeiro.
 * ============================================================================
 */

import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const PORT = 18084;
const BASE = `http://127.0.0.1:${PORT}`;
const DIR = '/tmp/kytto-simulacao-bar-30dias';
const DB_PATH = `${DIR}/db.json`;
const LOG_PATH = `${DIR}/simulacao.log`;
const ERROS_PATH = `${DIR}/erros.json`;
const RELATORIO_PATH = `${DIR}/relatorio.json`;
const DIAS = 30;

const PADRAO_DIA = {
  domingo: 30,
  segunda: 15,
  terca: 18,
  quarta: 20,
  quinta: 25,
  sexta: 45,
  sabado: 60,
};

const NOME_DIA = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
let semente = 20260809;
function aleatorio() {
  semente = (semente * 1664525 + 1013904223) >>> 0;
  return semente / 4294967296;
}
function inteiro(min, maxExclusivo) {
  return Math.floor(aleatorio() * (maxExclusivo - min)) + min;
}
function escolher(lista) { return lista[inteiro(0, lista.length)]; }
function moeda(valor) { return Number(Number(valor || 0).toFixed(2)); }
function isoDia(dia, hora = '12:00:00.000Z') {
  return `2026-01-${String(dia).padStart(2, '0')}T${hora}`;
}
function dataCurta(dia) { return `2026-01-${String(dia).padStart(2, '0')}`; }

const erros = [];
const logLinhas = [];
function log(mensagem) {
  const linha = `[${new Date().toISOString()}] ${mensagem}`;
  console.log(linha);
  logLinhas.push(linha);
}
function registrarErro(modulo, rota, payload, erro) {
  const item = {
    timestamp: new Date().toISOString(),
    modulo,
    rota,
    payload,
    status: erro?.status || 0,
    mensagem: erro?.mensagem || erro?.message || String(erro),
  };
  erros.push(item);
  console.error(`ERRO [${modulo}] ${rota}: ${item.mensagem}`);
}

function precoInicial(item) {
  const nome = String(item.nome || '').toLowerCase();
  const embalagem = String(item.embalagem || '').toLowerCase();
  const subcategoria = String(item.subcategoria || '').toLowerCase();
  if (item.cat === 'Espetinhos') {
    if (/(bacon|medalhão|queijo coalho)/.test(nome)) return 16.9;
    if (/pão de alho/.test(nome)) return 10.9;
    if (/legumes/.test(nome)) return 12.9;
    return 14.9;
  }
  if (subcategoria === 'chopes') return /heineken/.test(nome) ? 12.9 : /ipa/.test(nome) ? 14.9 : 10.9;
  if (subcategoria === 'águas') return /com gás/.test(nome) ? 5.5 : 4.5;
  if (subcategoria === 'energéticos') return /monster/.test(nome) ? 15.9 : 12.9;
  if (subcategoria === 'hidratação') return 9.9;
  if (subcategoria === 'sucos e chás') return /matte/.test(nome) ? 8.9 : 7.9;
  if (subcategoria === 'refrigerantes') return /600 ml|500 ml/.test(embalagem) ? 8.9 : 6.9;
  if (subcategoria === 'cervejas') {
    if (/garrafa 600/.test(embalagem)) return /(heineken|amstel|original)/.test(nome) ? 22.9 : 16.9;
    if (/lata 350/.test(embalagem)) return /(heineken|spaten|brahma duplo malte|petra|amstel)/.test(nome) ? 9.9 : 7.9;
    if (/long neck/.test(embalagem)) return /(hoegaarden|baden|colorado|wäls|lagunitas|blue moon|black princess|therezópolis|praya)/.test(nome) ? 17.9 : 12.9;
    return 10.9;
  }
  return 9.9;
}

async function requisicao(caminho, { method = 'GET', token = '', body } = {}) {
  const resposta = await fetch(`${BASE}${caminho}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const dados = await resposta.json().catch(() => ({}));
  return { status: resposta.status, ok: resposta.ok, dados };
}

async function api(caminho, opcoes = {}) {
  const resposta = await requisicao(caminho, opcoes);
  if (!resposta.ok) {
    const erro = new Error(resposta.dados.erro || resposta.dados.error || `HTTP ${resposta.status}`);
    erro.status = resposta.status;
    erro.mensagem = erro.message;
    throw erro;
  }
  return resposta.dados;
}

async function aguardarServidor() {
  for (let tentativa = 0; tentativa < 100; tentativa += 1) {
    try {
      const resposta = await fetch(`${BASE}/health`);
      if (resposta.ok) return resposta.json();
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Servidor isolado não iniciou.');
}

async function configurarCatalogo(token) {
  const catalogo = await api('/api/admin/cardapio', { token });
  assert.equal(catalogo.length, 86, 'O catálogo Kytto inicial deve conter 86 itens.');
  for (const item of catalogo) {
    await api(`/api/admin/cardapio/${encodeURIComponent(item.id)}`, {
      method: 'PATCH', token,
      body: { preco: precoInicial(item), indisponivel: false, precoPendente: false },
    });
  }
  await api('/api/admin/estoque/sincronizar-cardapio', { method: 'POST', token, body: {} });
  const operacional = await api('/api/cardapio', { token });
  assert.equal(operacional.length, 86, 'Todos os 86 itens devem estar liberados para PDV e Garçom.');
  return operacional;
}

async function criarFornecedores(token) {
  const entradas = [
    { nome: 'Distribuidora Kytto Bebidas', cnpj: '12345678000101', condicaoPagamento: '7 dias' },
    { nome: 'Atacado Regional MT', cnpj: '12345678000102', condicaoPagamento: '14 dias' },
    { nome: 'Cozinha & Chapa Nacional', cnpj: '12345678000103', condicaoPagamento: '7 dias' },
  ];
  const fornecedores = [];
  for (const entrada of entradas) {
    const resultado = await api('/api/admin/fornecedores', { method: 'POST', token, body: entrada });
    fornecedores.push(resultado.fornecedor);
  }
  return fornecedores;
}

async function criarClientes(token) {
  const clientes = [];
  for (let i = 1; i <= 6; i += 1) {
    const resultado = await api('/api/admin/clientes', {
      method: 'POST', token,
      body: {
        nome: `Cliente Crédito ${String(i).padStart(2, '0')}`,
        tipo: 'pf',
        cpfCnpj: `1000000000${i}`,
        limiteCreditoMensal: 5000,
        diasVencimento: 7,
      },
    });
    clientes.push(resultado.cliente);
  }
  return clientes;
}

async function executarCompra(token, fornecedor, produtos, dia, { grande = false } = {}) {
  const itens = produtos.map((produto) => {
    const quantidade = grande ? 150 : 90;
    const custo = moeda(precoInicial(produto) * (produto.cat === 'Espetinhos' ? 0.42 : 0.48));
    return { produtoId: produto.id, descricao: produto.nome, quantidade, unidade: produto.unidade || 'UN', valorUnitario: custo };
  });
  const pedidoResp = await api('/api/admin/compras/pedidos', {
    method: 'POST', token,
    body: {
      fornecedorId: fornecedor.id,
      condicaoPagamento: fornecedor.condicaoPagamento,
      valorFrete: grande ? 280 : 65,
      previsaoEntrega: dataCurta(dia),
      itens,
    },
  });
  let pedido = pedidoResp.pedido;
  if (pedido.status === 'aguardando_aprovacao') {
    pedido = (await api(`/api/admin/compras/pedidos/${pedido.id}/aprovar`, { method: 'POST', token, body: {} })).pedido;
  }
  const recebimento = await api(`/api/admin/compras/pedidos/${pedido.id}/receber`, {
    method: 'POST', token,
    body: {
      documento: `NF-SIM-${String(dia).padStart(2, '0')}-${pedido.numero}`,
      dataOperacao: isoDia(dia, '09:00:00.000Z'),
      statusFinanceiro: 'pendente',
    },
  });
  assert.ok(recebimento.lancamentosFinanceiros.length === itens.length, 'Cada item recebido deve gerar uma conta a pagar.');
  return recebimento;
}

async function realizarVenda(token, produtos, produtosCozinha, clientes, dia, indice) {
  const mesas = await api('/api/mesas', { token });
  const mesa = mesas.fisicas.find((item) => item.status === 'livre');
  assert.ok(mesa, 'Deve haver mesa livre para iniciar atendimento.');
  const abertura = await api(`/api/mesa/${mesa.num}/pedir`, {
    method: 'POST', token, body: { nome: `Cliente Dia ${dia} Venda ${indice + 1}`, itens: [] },
  });
  const totalItens = inteiro(2, 5);
  const itens = [];
  const usarCozinha = indice % 5 === 0;
  if (usarCozinha) itens.push({ produtoId: escolher(produtosCozinha).id, qtd: inteiro(1, 3), obs: 'Produção simulada' });
  while (itens.length < totalItens) itens.push({ produtoId: escolher(produtos).id, qtd: inteiro(1, 3), obs: '' });

  const comanda = await api(`/api/comanda/${abertura.comandaId}/adicionar`, {
    method: 'POST', token, body: { itens },
  });
  assert.equal(comanda.itens.length, itens.length, 'Todos os itens devem persistir na comanda.');

  for (let posicao = 0; posicao < comanda.itens.length; posicao += 1) {
    const item = comanda.itens[posicao];
    if (item.cozinha) {
      await api(`/api/kds/comanda/${abertura.comandaId}/item/${posicao}/status`, { method: 'PATCH', token, body: { status: 'pronto' } });
      await api(`/api/kds/comanda/${abertura.comandaId}/item/${posicao}/status`, { method: 'PATCH', token, body: { status: 'entregue' } });
    }
  }

  await api(`/api/comanda/${abertura.comandaId}/conta`, { method: 'POST', token, body: {} });
  const total = moeda(comanda.total);
  const escolhaPagamento = indice % 21;
  let body;
  let dinheiro = 0;
  let credito = false;
  if (escolhaPagamento === 20) {
    credito = true;
    const cliente = clientes[indice % clientes.length];
    body = {
      meio: 'conta', clienteId: cliente.id,
      dataOperacao: isoDia(dia, '20:30:00.000Z'),
      dataVencimento: isoDia(Math.min(DIAS, dia + 7), '12:00:00.000Z'),
    };
  } else if (escolhaPagamento === 19) {
    const parteDinheiro = moeda(total * 0.5);
    const partePix = moeda(total - parteDinheiro);
    dinheiro = parteDinheiro;
    body = {
      meios: [{ meio: 'dinheiro', valor: parteDinheiro }, { meio: 'pix', valor: partePix }],
      dataOperacao: isoDia(dia, '20:30:00.000Z'),
    };
  } else if (escolhaPagamento < 8) {
    dinheiro = total;
    body = { meio: 'dinheiro', dataOperacao: isoDia(dia, '20:30:00.000Z') };
  } else if (escolhaPagamento < 15) {
    body = { meio: 'pix', dataOperacao: isoDia(dia, '20:30:00.000Z') };
  } else {
    body = { meio: 'cartao', dataOperacao: isoDia(dia, '20:30:00.000Z') };
  }
  const pagamento = await api(`/api/comanda/${abertura.comandaId}/pagar`, { method: 'POST', token, body });
  assert.equal(pagamento.ok, true, 'Pagamento deve concluir a comanda.');
  const apos = await api('/api/mesas', { token });
  assert.equal(apos.fisicas.find((item) => item.num === mesa.num).status, 'livre', 'Mesa deve ser liberada após o pagamento.');
  return { total, dinheiro, credito, conta: pagamento.contasReceber?.[0] || null, pagamentos: pagamento.pagamentos || [] };
}

async function main() {
  let servidor;
  let logServidor = '';
  const relatorio = {
    inicio: new Date().toISOString(),
    configuracao: { dias: DIAS, ambiente: 'isolado', gcs: false, estoqueNegativo: false },
    totais: { vendas: 0, valorVendas: 0, dinheiro: 0, pix: 0, cartao: 0, conta: 0, compras: 0, valorCompras: 0, caixasFechados: 0, fechamentosDiarios: 0, contasReceberLiquidadas: 0, vendasEsperadas: 0 },
    dias: [],
    falhas: erros,
  };

  try {
    await rm(DIR, { recursive: true, force: true });
    await mkdir(DIR, { recursive: true });
    servidor = spawn('node', ['server-erp.js'], {
      cwd: new URL('.', import.meta.url).pathname,
      env: { ...process.env, NODE_ENV: 'development', SIMULATION_MODE: 'true', PORT: String(PORT), DB_PATH, GCS_BUCKET: '', GCS_OBJECT: '', TZ: 'America/Cuiaba' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    servidor.stdout.on('data', (dado) => { logServidor += dado.toString(); });
    servidor.stderr.on('data', (dado) => { logServidor += dado.toString(); });
    const health = await aguardarServidor();
    relatorio.health = health;

    const login = await api('/api/admin/login', { method: 'POST', body: { user: 'admin@setpoint-ultra.local', senha: 'SetPoint@2026Temp' } });
    const token = login.token;
    assert.ok(token, 'Login administrativo deve retornar token.');
    relatorio.empresaId = login.user.empresaId;

    await api('/api/admin/empresa-ativa/configuracoes', { method: 'PATCH', token, body: { permitirEstoqueNegativo: false } });
    await api('/api/admin/mesas/config', { method: 'POST', token, body: { mesasFisicas: 10 } });
    const catalogo = await configurarCatalogo(token);
    const produtosCozinha = catalogo.filter((item) => item.cozinha === true);
    const produtosVenda = catalogo.filter((item) => item.cozinha !== true);
    assert.ok(produtosCozinha.length >= 12, 'Espetinhos devem estar disponíveis como itens de produção.');
    const fornecedores = await criarFornecedores(token);
    const clientes = await criarClientes(token);

    // Compra inicial de todos os 86 itens para permitir estoque estritamente positivo.
    const compraInicial = await executarCompra(token, fornecedores[0], catalogo, 1, { grande: true });
    relatorio.totais.compras += 1;
    relatorio.totais.valorCompras += compraInicial.lancamentosFinanceiros.reduce((soma, item) => soma + item.valor, 0);
    const contasPagarPendentes = compraInicial.lancamentosFinanceiros.map((item) => ({ id: item.id, quitarDia: 8 }));
    const contasReceberPendentes = [];

    for (let dia = 1; dia <= DIAS; dia += 1) {
      const data = new Date(2026, 0, dia);
      const nomeDia = NOME_DIA[data.getDay()];
      const metaVendas = PADRAO_DIA[nomeDia];
      relatorio.totais.vendasEsperadas += metaVendas;
      const resumoDia = { dia, data: dataCurta(dia), diaSemana: nomeDia, metaVendas, vendas: 0, valorVendas: 0, compras: 0, caixa: null, fechamento: null, erros: 0 };
      log(`DIA ${String(dia).padStart(2, '0')} — ${nomeDia}: ${metaVendas} vendas previstas`);

      try {
        // Renovação semanal de estoque via compra aprovada/recebida.
        if ([8, 15, 22].includes(dia)) {
          const inicio = (dia * 3) % catalogo.length;
          const selecionados = [...catalogo.slice(inicio, inicio + 12)];
          while (selecionados.length < 12) selecionados.push(catalogo[selecionados.length]);
          const compra = await executarCompra(token, fornecedores[(dia / 7) % fornecedores.length | 0], selecionados, dia);
          relatorio.totais.compras += 1;
          resumoDia.compras += 1;
          const valorCompra = compra.lancamentosFinanceiros.reduce((soma, item) => soma + item.valor, 0);
          relatorio.totais.valorCompras += valorCompra;
          compra.lancamentosFinanceiros.forEach((item) => contasPagarPendentes.push({ id: item.id, quitarDia: Math.min(DIAS, dia + 7) }));
        }

        // Liquidação das contas a pagar vencidas.
        for (const conta of contasPagarPendentes.filter((item) => item.quitarDia === dia && !item.liquidada)) {
          await api('/api/admin/financeiro/pagamento', { method: 'POST', token, body: { lancamentoId: conta.id, dataPagamento: isoDia(dia, '10:00:00.000Z'), meioPagamento: 'pix' } });
          conta.liquidada = true;
        }
        // Recebimento de créditos de clientes no prazo contratado.
        for (const conta of contasReceberPendentes.filter((item) => item.quitarDia === dia && !item.liquidada)) {
          await api(`/api/admin/contas-receber/${conta.id}`, { method: 'PATCH', token, body: { dataPagamento: isoDia(dia, '11:00:00.000Z'), meioPagamento: 'pix' } });
          conta.liquidada = true;
          relatorio.totais.contasReceberLiquidadas += 1;
        }

        const fundo = 300;
        const aberturaCaixa = await api('/api/admin/caixa/abrir', { method: 'POST', token, body: { numeroCaixa: 1, valorAbertura: fundo, dataOperacao: isoDia(dia, '08:00:00.000Z'), observacao: `Abertura operacional D${dia}` } });
        let dinheiroDia = 0;

        for (let venda = 0; venda < metaVendas; venda += 1) {
          try {
            const resultado = await realizarVenda(token, produtosVenda, produtosCozinha, clientes, dia, venda);
            resumoDia.vendas += 1;
            resumoDia.valorVendas += resultado.total;
            dinheiroDia += resultado.dinheiro;
            relatorio.totais.vendas += 1;
            relatorio.totais.valorVendas += resultado.total;
            relatorio.totais.dinheiro += resultado.dinheiro;
            resultado.pagamentos.forEach((pagamento) => {
              if (pagamento.meio === 'pix') relatorio.totais.pix += pagamento.valor;
              if (['cartao', 'credito', 'debito', 'tef'].includes(pagamento.meio)) relatorio.totais.cartao += pagamento.valor;
              if (pagamento.meio === 'conta') relatorio.totais.conta += pagamento.valor;
            });
            if (resultado.conta) contasReceberPendentes.push({ id: resultado.conta.id, quitarDia: Math.min(DIAS, dia + 7) });
          } catch (erro) {
            registrarErro('VENDAS', `D${dia}-V${venda + 1}`, { dia, venda: venda + 1 }, erro);
            resumoDia.erros += 1;
          }
        }

        // Inventário e perda operacional controlada ao final do 15º dia.
        if (dia === 15) {
          const estoque = await api('/api/admin/estoque', { token });
          const alvo = estoque.estoque.find((item) => Number(item.qtd || 0) > 10);
          if (alvo) await api('/api/admin/estoque/ajuste', { method: 'POST', token, body: { produtoId: alvo.produtoId, qtd: Number(alvo.qtd) - 3, dataOperacao: isoDia(dia, '21:00:00.000Z') } });
        }

        const sangria = dinheiroDia >= 80 ? moeda(dinheiroDia * 0.25) : 0;
        const suprimento = dia % 6 === 0 ? 20 : 0;
        if (sangria > 0) await api('/api/admin/caixa/sangria', { method: 'POST', token, body: { caixaId: aberturaCaixa.caixa.id, valor: sangria, descricao: 'Sangria operacional simulada', dataOperacao: isoDia(dia, '22:00:00.000Z') } });
        if (suprimento > 0) await api('/api/admin/caixa/suprimento', { method: 'POST', token, body: { caixaId: aberturaCaixa.caixa.id, valor: suprimento, descricao: 'Suprimento de troco simulado', dataOperacao: isoDia(dia, '22:10:00.000Z') } });
        const valorEsperado = moeda(fundo + dinheiroDia - sangria + suprimento);
        const caixa = await api('/api/admin/caixa/fechar', { method: 'POST', token, body: { caixaId: aberturaCaixa.caixa.id, valorInformado: valorEsperado, dataOperacao: isoDia(dia, '23:50:00.000Z'), observacao: `Fechamento operacional D${dia}` } });
        assert.equal(caixa.resumo.divergencia, 0, 'A simulação deve fechar o caixa sem divergência não explicada.');
        resumoDia.caixa = caixa.resumo;
        relatorio.totais.caixasFechados += 1;

        const fechamento = await api('/api/admin/fechamento-diario', { method: 'POST', token, body: { data: isoDia(dia, '12:00:00.000Z') } });
        assert.ok(fechamento.fechamento, 'Fechamento auditável de clientes deve ser criado.');
        assert.ok(fechamento.fechamentoFinanceiro, 'Fechamento financeiro deve ser criado.');
        resumoDia.fechamento = fechamento.fechamentoFinanceiro;
        relatorio.totais.fechamentosDiarios += 1;
      } catch (erro) {
        registrarErro('OPERACAO_DIARIA', `D${dia}`, { dia }, erro);
        resumoDia.erros += 1;
      }
      resumoDia.valorVendas = moeda(resumoDia.valorVendas);
      relatorio.dias.push(resumoDia);
      log(`  Concluído: ${resumoDia.vendas}/${metaVendas} vendas; R$ ${resumoDia.valorVendas.toFixed(2)}; erros: ${resumoDia.erros}`);
    }

    const estoqueFinal = await api('/api/admin/estoque/inventario', { token });
    const financeiro = await api(`/api/admin/financeiro/resumo?data=${dataCurta(DIAS)}`, { token });
    const lancamentos = await api('/api/admin/financeiro/lancamentos', { token });
    const fechamentosFinanceiros = await api('/api/admin/financeiro/fechamentos', { token });
    const fechamentosClientes = await api('/api/admin/fechamento-diario', { token });
    const contasReceber = await api('/api/admin/contas-receber', { token });

    const negativos = estoqueFinal.itens.filter((item) => Number(item.qtd || 0) < 0);
    assert.equal(erros.length, 0, `A simulação não pode encerrar com erros: ${JSON.stringify(erros.slice(0, 3))}`);
    assert.equal(relatorio.totais.vendas, relatorio.totais.vendasEsperadas, 'Todas as vendas previstas pelo calendário devem ser executadas.');
    assert.equal(relatorio.totais.caixasFechados, DIAS, 'Deve haver um caixa fechado por dia.');
    assert.equal(relatorio.totais.fechamentosDiarios, DIAS, 'Deve haver um fechamento diário por dia.');
    assert.equal(fechamentosFinanceiros.fechamentos.length, DIAS, 'Livro-caixa deve registrar 30 fechamentos.');
    assert.equal(fechamentosClientes.fechamentos.length, DIAS, 'Contas a receber devem registrar 30 snapshots auditáveis.');
    assert.equal(negativos.length, 0, 'Estoque negativo deve permanecer bloqueado durante toda a simulação.');
    assert.ok(lancamentos.some((item) => item.origem === 'comanda'), 'Vendas devem alimentar o financeiro.');
    assert.ok(lancamentos.some((item) => item.origem === 'estoque'), 'Compras devem alimentar contas a pagar.');
    assert.ok(lancamentos.some((item) => item.origem === 'estoque_ajuste'), 'Inventário com perda deve gerar ajuste financeiro.');

    relatorio.totais.valorVendas = moeda(relatorio.totais.valorVendas);
    relatorio.totais.dinheiro = moeda(relatorio.totais.dinheiro);
    relatorio.totais.pix = moeda(relatorio.totais.pix);
    relatorio.totais.cartao = moeda(relatorio.totais.cartao);
    relatorio.totais.conta = moeda(relatorio.totais.conta);
    relatorio.totais.valorCompras = moeda(relatorio.totais.valorCompras);
    relatorio.validacao = {
      erros: erros.length,
      estoqueNegativo: negativos.length,
      itensEstoque: estoqueFinal.itens.length,
      lancamentosFinanceiros: lancamentos.length,
      contasReceber: contasReceber.contas.length,
      financeiro,
      fechamentoFinanceiro: fechamentosFinanceiros.fechamentos.length,
      fechamentoClientes: fechamentosClientes.fechamentos.length,
    };
    relatorio.fim = new Date().toISOString();
    await writeFile(LOG_PATH, `${logLinhas.join('\n')}\n`);
    await writeFile(ERROS_PATH, JSON.stringify(erros, null, 2));
    await writeFile(RELATORIO_PATH, JSON.stringify(relatorio, null, 2));
    console.log(JSON.stringify({ ok: true, ...relatorio.totais, validacao: relatorio.validacao, relatorio: RELATORIO_PATH, erros: ERROS_PATH }, null, 2));
  } catch (erro) {
    registrarErro('SIMULACAO', 'main', {}, erro);
    await mkdir(DIR, { recursive: true });
    await writeFile(LOG_PATH, `${logLinhas.join('\n')}\n`);
    await writeFile(ERROS_PATH, JSON.stringify(erros, null, 2));
    await writeFile(RELATORIO_PATH, JSON.stringify(relatorio, null, 2));
    console.error(logServidor.slice(-3500));
    process.exitCode = 1;
  } finally {
    if (servidor && servidor.exitCode === null && !servidor.killed) {
      const saiu = new Promise((resolve) => servidor.once('exit', resolve));
      servidor.kill('SIGTERM');
      await Promise.race([saiu, new Promise((resolve) => setTimeout(resolve, 3000))]);
    }
  }
}

main();
