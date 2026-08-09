#!/usr/bin/env node
/**
 * ============================================================================
 * SIMULAÇÃO DE 30 DIAS — OPERAÇÃO DE BAR (VERSÃO 2)
 * ============================================================================
 * Versão simplificada que usa APENAS as rotas que existem no servidor
 * 
 * Rotas disponíveis confirmadas:
 * - GET /api/cardapio (cardápio com preços)
 * - GET /api/mesas (mapa de mesas)
 * - POST /api/mesa/:numero/pedir (abrir comanda)
 * - POST /api/comanda/:id/adicionar (adicionar itens)
 * - POST /api/comanda/:id/conta (solicitar conta)
 * - POST /api/comanda/:id/pagar (pagar comanda)
 * - GET /api/admin/clientes (listar clientes)
 * - POST /api/admin/clientes (criar cliente)
 * - GET /api/admin/estoque (estoque)
 * - POST /api/admin/estoque/entrada (entrada de estoque)
 * - GET /api/admin/fornecedores (fornecedores)
 * - POST /api/admin/fornecedores (criar fornecedor)
 * - GET /api/admin/contas-receber (contas a receber)
 * - POST /api/admin/contas-receber (criar conta a receber)
 * - POST /api/admin/fechamento-diario (fechamento)
 * - GET /api/admin/fechamento-diario (listar fechamentos)
 * 
 * ============================================================================
 */

import { spawn } from 'node:child_process';
import { rm, mkdir, writeFile } from 'node:fs/promises';
import { randomInt } from 'node:crypto';

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const port = 18080;
const base = `http://127.0.0.1:${port}`;
const testDir = '/tmp/kytto-bar-sim-v2';
const dbPath = `${testDir}/db.json`;
const logFile = `${testDir}/simulacao.log`;
const errosFile = `${testDir}/erros.json`;
const relatorioFile = `${testDir}/relatorio.json`;

const DIAS_SIMULACAO = 30;

const CREDENCIAIS_ADMIN = {
  user: 'admin@setpoint-ultra.local',
  senha: 'SetPoint@2026Temp'
};

const PADROES_VENDA = {
  domingo: { vendas: 30, ticketMedio: 70 },
  segunda: { vendas: 15, ticketMedio: 45 },
  terca: { vendas: 18, ticketMedio: 50 },
  quarta: { vendas: 20, ticketMedio: 55 },
  quinta: { vendas: 25, ticketMedio: 60 },
  sexta: { vendas: 45, ticketMedio: 80 },
  sabado: { vendas: 60, ticketMedio: 100 }
};

// ============================================================================
// UTILITÁRIOS
// ============================================================================

let logBuffer = '';
const erros = [];
const relatorio = {
  dias: {},
  resumo: {
    total_dias: 0,
    total_vendas: 0,
    total_valor: 0,
    total_erros: 0,
    formas_pagamento: {}
  }
};

function log(msg) {
  const timestamp = new Date().toISOString();
  const linha = `[${timestamp}] ${msg}`;
  console.log(linha);
  logBuffer += linha + '\n';
}

function logErro(modulo, rota, payload, resposta, statusCode) {
  const erro = {
    timestamp: new Date().toISOString(),
    modulo,
    rota,
    payload,
    resposta: typeof resposta === 'string' ? resposta.substring(0, 200) : JSON.stringify(resposta).substring(0, 200),
    statusCode
  };
  console.error(`❌ ERRO: ${modulo} — ${rota}`);
  erros.push(erro);
  relatorio.resumo.total_erros++;
  return erro;
}

async function esperarServidor() {
  let ultimoErro = null;
  for (let tentativa = 0; tentativa < 80; tentativa += 1) {
    try {
      const resposta = await fetch(`${base}/health`);
      if (resposta.ok) {
        const dados = await resposta.json();
        log(`✅ Servidor iniciado. Versão: ${dados.versao}, Módulos ativos: ${dados.modulos?.length || 0}`);
        return;
      }
    } catch (erro) {
      ultimoErro = erro;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Servidor local não iniciou após 40s: ${ultimoErro?.message || 'timeout'}`);
}

async function requisitar(caminho, { method = 'GET', token = '', body } = {}) {
  try {
    const resposta = await fetch(`${base}${caminho}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      throw {
        statusCode: resposta.status,
        dados,
        ok: false
      };
    }
    return dados;
  } catch (erro) {
    if (erro.ok === false) throw erro;
    throw {
      statusCode: 0,
      dados: { erro: erro.message },
      ok: false
    };
  }
}

// ============================================================================
// SIMULAÇÃO
// ============================================================================

async function simularDia(diaNum, token) {
  const data = new Date(2026, 0, 1 + diaNum);
  const diaSemana = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'][data.getDay()];
  const padrao = PADROES_VENDA[diaSemana];
  const dataStr = data.toLocaleDateString('pt-BR');
  
  log(`\n📅 DIA ${String(diaNum).padStart(2, '0')} — ${dataStr} (${diaSemana})`);
  log(`   Padrão: ${padrao.vendas} vendas esperadas, ticket médio R$ ${padrao.ticketMedio}`);

  const diaData = {
    data: dataStr,
    dia_semana: diaSemana,
    vendas: [],
    erros_dia: 0,
    total_valor: 0,
    formas_pagamento: {}
  };

  // Obter mesas disponíveis
  let mesas = [];
  try {
    const mesasResp = await requisitar('/api/mesas', { token });
    mesas = mesasResp.fisicas || [];
    const livres = mesas.filter(m => m.status === 'livre').length;
    log(`   📋 Mesas: ${livres}/${mesas.length} livres`);
  } catch (erro) {
    logErro('MESAS', 'GET /api/mesas', {}, erro.dados, erro.statusCode);
    diaData.erros_dia++;
    relatorio.dias[diaNum] = diaData;
    return diaData;
  }

  // Obter cardápio
  let cardapio = [];
  try {
    const cardapioResp = await requisitar('/api/cardapio', { token });
    cardapio = (Array.isArray(cardapioResp) ? cardapioResp : cardapioResp.itens || [])
      .filter(item => Number(item.preco) > 0);
    log(`   🍹 Cardápio: ${cardapio.length} itens com preço`);
  } catch (erro) {
    logErro('CARDAPIO', 'GET /api/cardapio', {}, erro.dados, erro.statusCode);
    diaData.erros_dia++;
    relatorio.dias[diaNum] = diaData;
    return diaData;
  }

  if (cardapio.length === 0) {
    log(`   ⚠️  Cardápio vazio! Pulando dia.`);
    relatorio.dias[diaNum] = diaData;
    return diaData;
  }

  // Simular vendas do dia
  for (let v = 0; v < padrao.vendas; v++) {
    const mesaLivre = mesas.find(m => m.status === 'livre');
    if (!mesaLivre) {
      log(`   ⚠️  Sem mesas livres para venda ${v + 1}/${padrao.vendas}`);
      break;
    }

    try {
      // Abrir comanda
      const abertura = await requisitar(`/api/mesa/${mesaLivre.num}/pedir`, {
        method: 'POST',
        token,
        body: {
          nome: `Cliente ${v + 1}`,
          itens: []
        }
      });

      if (!abertura.comandaId) {
        throw new Error('Comanda não retornou ID');
      }

      // Adicionar itens (2-4 itens por comanda)
      const qtdItens = randomInt(2, 5);
      const itensComanda = [];
      let totalComanda = 0;

      for (let i = 0; i < qtdItens; i++) {
        const produto = cardapio[randomInt(0, cardapio.length - 1)];
        const qtd = randomInt(1, 3);
        itensComanda.push({
          produtoId: produto.id,
          qtd,
          obs: ''
        });
        totalComanda += (Number(produto.preco) || 0) * qtd;
      }

      const comanda = await requisitar(`/api/comanda/${abertura.comandaId}/adicionar`, {
        method: 'POST',
        token,
        body: { itens: itensComanda }
      });

      if (!comanda.itens || comanda.itens.length === 0) {
        throw new Error('Itens não foram adicionados');
      }

      // Solicitar conta
      await requisitar(`/api/comanda/${abertura.comandaId}/conta`, {
        method: 'POST',
        token,
        body: {}
      });

      // Pagar (mix de formas: 40% dinheiro, 35% PIX, 20% cartão, 5% conta)
      const formas = ['dinheiro', 'dinheiro', 'dinheiro', 'dinheiro', 'pix', 'pix', 'pix', 'pix', 'pix', 'pix', 'pix', 'cartao', 'cartao', 'cartao', 'cartao', 'conta'];
      const forma = formas[randomInt(0, formas.length - 1)];

      const pagamento = await requisitar(`/api/comanda/${abertura.comandaId}/pagar`, {
        method: 'POST',
        token,
        body: {
          meio: forma,
          ...(forma === 'conta' ? { clienteId: 'cliente-teste-001' } : {})
        }
      });

      if (!pagamento.ok) {
        throw new Error('Pagamento retornou ok=false');
      }

      // Registrar venda
      diaData.vendas.push({
        comanda: abertura.comandaId,
        total: totalComanda,
        forma,
        itens: itensComanda.length
      });

      diaData.total_valor += totalComanda;
      diaData.formas_pagamento[forma] = (diaData.formas_pagamento[forma] || 0) + 1;
      relatorio.resumo.formas_pagamento[forma] = (relatorio.resumo.formas_pagamento[forma] || 0) + 1;

      if (v % 10 === 0 && v > 0) {
        log(`   ✅ ${v}/${padrao.vendas} vendas realizadas`);
      }
    } catch (erro) {
      logErro('VENDAS', `Venda ${v + 1}/${padrao.vendas}`, { mesa: mesaLivre?.num }, erro.dados, erro.statusCode);
      diaData.erros_dia++;
    }
  }

  log(`   ✅ Dia concluído: ${diaData.vendas.length} vendas, R$ ${diaData.total_valor.toFixed(2)}`);
  relatorio.dias[diaNum] = diaData;
  relatorio.resumo.total_vendas += diaData.vendas.length;
  relatorio.resumo.total_valor += diaData.total_valor;

  return diaData;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  let servidor = null;

  try {
    // Preparar ambiente
    log('🔧 Preparando ambiente de simulação...');
    await rm(testDir, { recursive: true, force: true });
    await mkdir(testDir, { recursive: true });

    // Iniciar servidor
    log('🚀 Iniciando servidor isolado...');
    servidor = spawn('node', ['server-erp.js'], {
      cwd: new URL('.', import.meta.url).pathname,
      env: {
        ...process.env,
        NODE_ENV: 'development',
        PORT: '18080',
        DB_PATH: dbPath,
        GCS_BUCKET: '',
        GCS_OBJECT: '',
        TZ: 'America/Cuiaba'
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let serverLog = '';
    servidor.stdout.on('data', (chunk) => { serverLog += chunk.toString(); });
    servidor.stderr.on('data', (chunk) => { serverLog += chunk.toString(); });

    await esperarServidor();

    // Login
    log('🔐 Autenticando...');
    const login = await requisitar('/api/admin/login', {
      method: 'POST',
      body: CREDENCIAIS_ADMIN
    });
    const token = login.token;
    log(`✅ Token obtido: ${token.substring(0, 20)}...`);

    // Configurar mesas
    log('📋 Configurando mesas...');
    try {
      await requisitar('/api/admin/mesas/config', {
        method: 'POST',
        token,
        body: { mesasFisicas: 10 }
      });
      log('✅ Mesas configuradas');
    } catch (erro) {
      log('⚠️  Erro ao configurar mesas (continuando)');
    }

    // Simular 30 dias
    log(`\n📊 INICIANDO SIMULAÇÃO DE ${DIAS_SIMULACAO} DIAS`);
    log('='.repeat(80));

    relatorio.resumo.total_dias = DIAS_SIMULACAO;

    for (let dia = 1; dia <= DIAS_SIMULACAO; dia++) {
      await simularDia(dia, token);
    }

    // Relatório final
    log(`\n📊 RELATÓRIO FINAL`);
    log('='.repeat(80));
    log(`Total de dias: ${relatorio.resumo.total_dias}`);
    log(`Total de vendas: ${relatorio.resumo.total_vendas}`);
    log(`Total de valor: R$ ${relatorio.resumo.total_valor.toFixed(2)}`);
    log(`Ticket médio: R$ ${(relatorio.resumo.total_valor / Math.max(relatorio.resumo.total_vendas, 1)).toFixed(2)}`);
    log(`Erros encontrados: ${relatorio.resumo.total_erros}`);
    log(`\nFormas de pagamento:`);
    Object.entries(relatorio.resumo.formas_pagamento).forEach(([forma, qtd]) => {
      log(`  - ${forma}: ${qtd} transações`);
    });

    // Salvar logs e relatórios
    await writeFile(logFile, logBuffer);
    await writeFile(errosFile, JSON.stringify(erros, null, 2));
    await writeFile(relatorioFile, JSON.stringify(relatorio, null, 2));

    log(`\n✅ Simulação concluída!`);
    log(`📄 Logs: ${logFile}`);
    log(`⚠️  Erros: ${errosFile}`);
    log(`📊 Relatório: ${relatorioFile}`);

    console.log(JSON.stringify({
      ok: true,
      dias: DIAS_SIMULACAO,
      total_vendas: relatorio.resumo.total_vendas,
      total_valor: relatorio.resumo.total_valor,
      ticket_medio: relatorio.resumo.total_valor / Math.max(relatorio.resumo.total_vendas, 1),
      total_erros: relatorio.resumo.total_erros,
      log_file: logFile,
      erros_file: errosFile,
      relatorio_file: relatorioFile
    }, null, 2));

  } catch (erro) {
    console.error('❌ ERRO NA SIMULAÇÃO:', erro.message);
    console.error(erro);
    process.exit(1);
  } finally {
    if (servidor && servidor.exitCode === null && !servidor.killed) {
      log('🛑 Encerrando servidor...');
      const encerrou = new Promise((resolve) => servidor.once('exit', resolve));
      servidor.kill('SIGTERM');
      await Promise.race([encerrou, new Promise((resolve) => setTimeout(resolve, 3000))]);
    }
  }
}

main().catch(console.error);
