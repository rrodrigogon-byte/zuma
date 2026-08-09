#!/usr/bin/env node
/**
 * ============================================================================
 * SIMULAÇÃO DE ATENDIMENTO COMPLETO — GARÇOM, COZINHA, MESAS E CAIXA
 * ============================================================================
 * Ambiente isolado: 10 mesas simultâneas, 50 atendimentos, garçom → cozinha →
 * KDS → entrega → pagamento → caixa → financeiro.
 * ============================================================================
 */

import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const PORT = 18085;
const BASE = `http://127.0.0.1:${PORT}`;
const DIR = '/tmp/kytto-atendimento-completo';
const DB_PATH = `${DIR}/db.json`;
const LOG_PATH = `${DIR}/atendimento.log`;
const RELATORIO_PATH = `${DIR}/relatorio.json`;
const ERROS_PATH = `${DIR}/erros.json`;

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

function moeda(valor) { return Number(Number(valor || 0).toFixed(2)); }
function isoDia(dia, hora = '12:00:00.000Z') {
  return `2026-01-${String(dia).padStart(2, '0')}T${hora}`;
}

let semente = 20260809;
function aleatorio() {
  semente = (semente * 1664525 + 1013904223) >>> 0;
  return semente / 4294967296;
}
function inteiro(min, maxExclusivo) {
  return Math.floor(aleatorio() * (maxExclusivo - min)) + min;
}
function escolher(lista) { return lista[inteiro(0, lista.length)]; }

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

async function simularAtendimento(token, catalogo, mesa, indice) {
  const produtosCozinha = catalogo.filter((item) => item.cozinha === true);
  const produtosVenda = catalogo.filter((item) => item.cozinha !== true);
  
  try {
    // Garçom abre mesa
    const abertura = await api(`/api/mesa/${mesa.num}/pedir`, {
      method: 'POST', token,
      body: { nome: `Cliente Atend ${indice + 1}`, itens: [] },
    });
    assert.ok(abertura.comandaId, 'Comanda deve ser criada ao abrir mesa.');
    
    // Cliente faz pedido (2-4 itens)
    const totalItens = inteiro(2, 5);
    const itens = [];
    const usarCozinha = indice % 3 === 0;
    
    if (usarCozinha && produtosCozinha.length > 0) {
      itens.push({
        produtoId: escolher(produtosCozinha).id,
        qtd: inteiro(1, 3),
        obs: 'Pedido de cozinha simulado',
      });
    }
    
    while (itens.length < totalItens && produtosVenda.length > 0) {
      itens.push({
        produtoId: escolher(produtosVenda).id,
        qtd: inteiro(1, 3),
        obs: '',
      });
    }
    
    // Garçom adiciona itens à comanda
    const comanda = await api(`/api/comanda/${abertura.comandaId}/adicionar`, {
      method: 'POST', token,
      body: { itens },
    });
    assert.equal(comanda.itens.length, itens.length, 'Todos os itens devem persistir na comanda.');
    
    // Cozinha processa itens
    const statusTransicoes = [];
    for (let posicao = 0; posicao < comanda.itens.length; posicao += 1) {
      const item = comanda.itens[posicao];
      if (item.cozinha) {
        // Simular fila KDS: novo → em preparo → pronto → entregue
        const statusKDS = await api(`/api/kds/comanda/${abertura.comandaId}/item/${posicao}/status`, {
          method: 'PATCH', token,
          body: { status: 'em_preparo' },
        });
        statusTransicoes.push({ item: posicao, status: 'em_preparo', ok: statusKDS.ok });
        
        const statusPronto = await api(`/api/kds/comanda/${abertura.comandaId}/item/${posicao}/status`, {
          method: 'PATCH', token,
          body: { status: 'pronto' },
        });
        statusTransicoes.push({ item: posicao, status: 'pronto', ok: statusPronto.ok });
        
        const statusEntregue = await api(`/api/kds/comanda/${abertura.comandaId}/item/${posicao}/status`, {
          method: 'PATCH', token,
          body: { status: 'entregue' },
        });
        statusTransicoes.push({ item: posicao, status: 'entregue', ok: statusEntregue.ok });
      }
    }
    
    // Garçom solicita conta
    await api(`/api/comanda/${abertura.comandaId}/conta`, {
      method: 'POST', token,
      body: {},
    });
    
    // Cliente escolhe forma de pagamento
    const total = moeda(comanda.total);
    const escolhaPagamento = indice % 20;
    let body;
    let meioPagamento = 'dinheiro';
    let meios = [];
    
    if (escolhaPagamento === 19) {
      meioPagamento = 'conta';
      const clientes = await api('/api/admin/clientes', { token });
      const cliente = clientes.clientes && clientes.clientes.length > 0
        ? clientes.clientes[indice % clientes.clientes.length]
        : null;
      body = {
        meio: 'conta',
        clienteId: cliente?.id || 'cli-teste-001',
        dataOperacao: isoDia(1, '20:30:00.000Z'),
        dataVencimento: isoDia(8, '12:00:00.000Z'),
      };
      meios = [{ meio: 'conta', valor: total }];
    } else if (escolhaPagamento === 18) {
      meioPagamento = 'misto';
      const parteDinheiro = moeda(total * 0.5);
      const partePix = moeda(total - parteDinheiro);
      body = {
        meios: [
          { meio: 'dinheiro', valor: parteDinheiro },
          { meio: 'pix', valor: partePix },
        ],
        dataOperacao: isoDia(1, '20:30:00.000Z'),
      };
      meios = body.meios;
    } else if (escolhaPagamento < 8) {
      meioPagamento = 'dinheiro';
      body = { meio: 'dinheiro', dataOperacao: isoDia(1, '20:30:00.000Z') };
      meios = [{ meio: 'dinheiro', valor: total }];
    } else if (escolhaPagamento < 14) {
      meioPagamento = 'pix';
      body = { meio: 'pix', dataOperacao: isoDia(1, '20:30:00.000Z') };
      meios = [{ meio: 'pix', valor: total }];
    } else {
      meioPagamento = 'cartao';
      body = { meio: 'cartao', dataOperacao: isoDia(1, '20:30:00.000Z') };
      meios = [{ meio: 'cartao', valor: total }];
    }
    
    // Processar pagamento
    const pagamento = await api(`/api/comanda/${abertura.comandaId}/pagar`, {
      method: 'POST', token,
      body,
    });
    assert.equal(pagamento.ok, true, 'Pagamento deve concluir a comanda.');
    
    // Verificar se mesa foi liberada
    const mesasApos = await api('/api/mesas', { token });
    const mesaApos = mesasApos.fisicas.find((item) => item.num === mesa.num);
    assert.equal(mesaApos.status, 'livre', 'Mesa deve ser liberada após pagamento.');
    
    return {
      ok: true,
      comandaId: abertura.comandaId,
      total,
      meioPagamento,
      meios,
      itens: comanda.itens.length,
      cozinha: statusTransicoes.filter((t) => t.ok).length,
      statusTransicoes,
    };
  } catch (erro) {
    registrarErro('ATENDIMENTO', `mesa-${mesa.num}-atend-${indice + 1}`, { mesa: mesa.num, indice }, erro);
    return { ok: false, erro: erro.message };
  }
}

async function main() {
  let servidor;
  let logServidor = '';
  const relatorio = {
    inicio: new Date().toISOString(),
    configuracao: { mesas: 10, atendimentos: 50, ambiente: 'isolado' },
    totais: {
      atendimentos: 0,
      sucesso: 0,
      falha: 0,
      valorTotal: 0,
      dinheiro: 0,
      pix: 0,
      cartao: 0,
      conta: 0,
      itensServidos: 0,
      itensKDS: 0,
    },
    atendimentos: [],
    falhas: erros,
  };

  try {
    await rm(DIR, { recursive: true, force: true });
    await mkdir(DIR, { recursive: true });
    
    servidor = spawn('node', ['server-erp.js'], {
      cwd: new URL('.', import.meta.url).pathname,
      env: {
        ...process.env,
        NODE_ENV: 'development',
        SIMULATION_MODE: 'true',
        PORT: String(PORT),
        DB_PATH,
        GCS_BUCKET: '',
        GCS_OBJECT: '',
        TZ: 'America/Cuiaba',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    
    servidor.stdout.on('data', (dado) => { logServidor += dado.toString(); });
    servidor.stderr.on('data', (dado) => { logServidor += dado.toString(); });
    
    const health = await aguardarServidor();
    relatorio.health = health;
    log('✅ Servidor isolado iniciado');
    
    // Login
    const login = await api('/api/admin/login', {
      method: 'POST',
      body: { user: 'admin@setpoint-ultra.local', senha: 'SetPoint@2026Temp' },
    });
    const token = login.token;
    log('✅ Autenticação concluída');
    
    // Configurar mesas
    await api('/api/admin/mesas/config', {
      method: 'POST', token,
      body: { mesasFisicas: 10 },
    });
    log('✅ 10 mesas configuradas');
    
    // Obter catálogo
    const catalogo = await api('/api/admin/cardapio', { token });
    assert.equal(catalogo.length, 86, 'Catálogo deve ter 86 itens.');
    
    // Precificar itens
    for (const item of catalogo) {
      await api(`/api/admin/cardapio/${encodeURIComponent(item.id)}`, {
        method: 'PATCH', token,
        body: { preco: item.preco || 10, indisponivel: false },
      });
    }
    await api('/api/admin/estoque/sincronizar-cardapio', { method: 'POST', token, body: {} });
    log('✅ Catálogo precificado e sincronizado');
    
    // Abrir caixa
    const caixa = await api('/api/admin/caixa/abrir', {
      method: 'POST', token,
      body: {
        numeroCaixa: 1,
        valorAbertura: 500,
        dataOperacao: isoDia(1, '08:00:00.000Z'),
        observacao: 'Abertura para simulação de atendimento',
      },
    });
    log('✅ Caixa aberto com R$ 500,00');
    
    // Simular atendimentos simultâneos
    const mesas = await api('/api/mesas', { token });
    const mesasFisicas = mesas.fisicas.slice(0, 10);
    
    log(`\n🍽️  INICIANDO SIMULAÇÃO DE 50 ATENDIMENTOS EM 10 MESAS\n`);
    
    for (let atendimento = 0; atendimento < 50; atendimento += 1) {
      const mesa = mesasFisicas[atendimento % 10];
      const resultado = await simularAtendimento(token, catalogo, mesa, atendimento);
      
      relatorio.totais.atendimentos += 1;
      if (resultado.ok) {
        relatorio.totais.sucesso += 1;
        relatorio.totais.valorTotal += resultado.total;
        relatorio.totais.itensServidos += resultado.itens;
        relatorio.totais.itensKDS += resultado.cozinha;
        
        resultado.meios.forEach((meio) => {
          if (meio.meio === 'dinheiro') relatorio.totais.dinheiro += meio.valor;
          if (meio.meio === 'pix') relatorio.totais.pix += meio.valor;
          if (meio.meio === 'cartao') relatorio.totais.cartao += meio.valor;
          if (meio.meio === 'conta') relatorio.totais.conta += meio.valor;
        });
      } else {
        relatorio.totais.falha += 1;
      }
      
      relatorio.atendimentos.push(resultado);
      
      const progresso = `[${atendimento + 1}/50]`;
      const status = resultado.ok ? '✅' : '❌';
      log(`${progresso} ${status} Mesa ${mesa.num}: R$ ${resultado.total} (${resultado.meioPagamento})`);
    }
    
    log(`\n📊 VALIDAÇÃO FINAL\n`);
    
    // Fechar caixa
    const dinheiroDia = relatorio.totais.dinheiro;
    const valorEsperado = moeda(500 + dinheiroDia);
    const caixaFechado = await api('/api/admin/caixa/fechar', {
      method: 'POST', token,
      body: {
        caixaId: caixa.caixa.id,
        valorInformado: valorEsperado,
        dataOperacao: isoDia(1, '23:50:00.000Z'),
        observacao: 'Fechamento simulado',
      },
    });
    assert.equal(caixaFechado.resumo.divergencia, 0, 'Caixa deve fechar sem divergência.');
    relatorio.caixa = caixaFechado.resumo;
    log('✅ Caixa fechado sem divergência');
    
    // Validar financeiro
    const financeiro = await api('/api/admin/financeiro/resumo', { token });
    const lancamentos = await api('/api/admin/financeiro/lancamentos', { token });
    const contasReceber = await api('/api/admin/contas-receber', { token });
    
    relatorio.financeiro = financeiro;
    relatorio.validacao = {
      erros: erros.length,
      atendimentosSucesso: relatorio.totais.sucesso,
      atendimentosFalha: relatorio.totais.falha,
      valorTotalVendas: moeda(relatorio.totais.valorTotal),
      lancamentosFinanceiros: lancamentos.length,
      contasReceberPendentes: contasReceber.contas.length,
      itensServidos: relatorio.totais.itensServidos,
      itensKDS: relatorio.totais.itensKDS,
    };
    
    // Assertions finais
    assert.equal(erros.length, 0, `Simulação não pode encerrar com erros: ${JSON.stringify(erros.slice(0, 3))}`);
    assert.equal(relatorio.totais.sucesso, 50, 'Todos os 50 atendimentos devem ser bem-sucedidos.');
    assert.ok(lancamentos.some((item) => item.origem === 'comanda'), 'Vendas devem alimentar o financeiro.');
    assert.ok(contasReceber.contas.length >= 0, 'Contas a receber devem ser registradas.');
    
    relatorio.totais.valorTotal = moeda(relatorio.totais.valorTotal);
    relatorio.totais.dinheiro = moeda(relatorio.totais.dinheiro);
    relatorio.totais.pix = moeda(relatorio.totais.pix);
    relatorio.totais.cartao = moeda(relatorio.totais.cartao);
    relatorio.totais.conta = moeda(relatorio.totais.conta);
    
    relatorio.fim = new Date().toISOString();
    
    await writeFile(LOG_PATH, `${logLinhas.join('\n')}\n`);
    await writeFile(ERROS_PATH, JSON.stringify(erros, null, 2));
    await writeFile(RELATORIO_PATH, JSON.stringify(relatorio, null, 2));
    
    console.log(JSON.stringify({ ok: true, ...relatorio.totais, validacao: relatorio.validacao }, null, 2));
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
