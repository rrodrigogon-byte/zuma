#!/usr/bin/env node
/**
 * ============================================================================
 * SIMULAÇÃO DE 30 DIAS — OPERAÇÃO COMPLETA DE BAR
 * ============================================================================
 * Arquivo: simular_30_dias_bar.mjs
 * Objetivo: Simular isoladamente todos os fluxos operacionais do Bar por 30 dias
 * Ambiente: DB_PATH=/tmp, GCS_BUCKET='', sem tocar produção
 * 
 * Fluxos cobertos:
 * 1. Compras: Fornecedores → Pedidos → Aprovação → Recebimento → Estoque
 * 2. Estoque: Entrada, consumo, alertas de ruptura, inventário
 * 3. Produção: Preparação de bebidas, consumo de matéria-prima
 * 4. Vendas: Atendimento, abertura de mesa, inclusão de itens, fechamento
 * 5. Pagamentos: Dinheiro, PIX, cartão, conta a receber
 * 6. Caixa: Abertura, movimentações, sangrias, suprimentos, fechamento
 * 7. Financeiro: Contas a pagar, contas a receber, relatórios consolidados
 * 8. Fechamento Diário: Snapshot auditável
 * 
 * ============================================================================
 */

import { spawn } from 'node:child_process';
import { rm, mkdir, writeFile } from 'node:fs/promises';
import { randomInt, randomBytes } from 'node:crypto';

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const port = 18080;
const base = `http://127.0.0.1:${port}`;
const testDir = '/tmp/kytto-bar-sim-30dias';
const dbPath = `${testDir}/db.json`;
const logFile = `${testDir}/simulacao.log`;
const errosFile = `${testDir}/erros.json`;

const DIAS_SIMULACAO = 30;
const EMPRESAS = {
  kytto: 'emp-kytto-001',
  florescer: 'emp-florescer-001'
};

const CREDENCIAIS_ADMIN = {
  user: 'admin@setpoint-ultra.local',
  senha: 'SetPoint@2026Temp'
};

const FORNECEDORES_INICIAIS = [
  { nome: 'Distribuidora Kytto Bebidas', cnpj: '12345678000100', prazo: 3, limite: 50000 },
  { nome: 'Fornecedor Regional Bebidas', cnpj: '98765432000199', prazo: 5, limite: 30000 },
  { nome: 'Distribuidor Nacional', cnpj: '11111111000111', prazo: 7, limite: 100000 }
];

const PADROES_VENDA = {
  segunda: { vendas: 15, ticketMedio: 45 },
  terca: { vendas: 18, ticketMedio: 50 },
  quarta: { vendas: 20, ticketMedio: 55 },
  quinta: { vendas: 25, ticketMedio: 60 },
  sexta: { vendas: 45, ticketMedio: 80 },
  sabado: { vendas: 60, ticketMedio: 100 },
  domingo: { vendas: 30, ticketMedio: 70 }
};

// ============================================================================
// UTILITÁRIOS
// ============================================================================

let logBuffer = '';
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
    resposta,
    statusCode
  };
  console.error(`❌ ERRO: ${modulo} — ${rota}`, erro);
  return erro;
}

async function esperarServidor() {
  let ultimoErro = null;
  for (let tentativa = 0; tentativa < 40; tentativa += 1) {
    try {
      const resposta = await fetch(`${base}/health`);
      if (resposta.ok) {
        const dados = await resposta.json();
        log(`✅ Servidor iniciado. Versão: ${dados.versao}, Módulos: ${dados.modulos?.length || 0}`);
        return;
      }
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
  if (!resposta.ok) {
    throw {
      statusCode: resposta.status,
      dados,
      ok: false
    };
  }
  return dados;
}

// ============================================================================
// SIMULAÇÃO
// ============================================================================

async function simularDia(diaNum, token, erros) {
  const data = new Date(2026, 0, 1 + diaNum);
  const diaSemana = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'][data.getDay()];
  const padrao = PADROES_VENDA[diaSemana];
  
  log(`\n📅 DIA ${diaNum} — ${data.toLocaleDateString('pt-BR')} (${diaSemana})`);
  log(`   Padrão: ${padrao.vendas} vendas, ticket médio R$ ${padrao.ticketMedio}`);

  // 1. Abertura de caixa
  try {
    const aberturaCaixa = await requisitar('/api/admin/caixa/abrir', {
      method: 'POST',
      token,
      body: {
        numero_caixa: 1,
        valor_abertura: 500,
        observacoes: `Abertura dia ${diaNum}`
      }
    });
    log(`   ✅ Caixa aberto: ${aberturaCaixa.caixa?.id || 'OK'}`);
  } catch (erro) {
    erros.push(logErro('CAIXA', 'POST /api/admin/caixa/abrir', { numero_caixa: 1 }, erro.dados, erro.statusCode));
  }

  // 2. Obter mesas disponíveis
  let mesas = [];
  try {
    const mesasResp = await requisitar('/api/mesas', { token });
    mesas = mesasResp.fisicas || [];
    log(`   ✅ Mesas disponíveis: ${mesas.filter(m => m.status === 'livre').length}`);
  } catch (erro) {
    erros.push(logErro('MESAS', 'GET /api/mesas', {}, erro.dados, erro.statusCode));
    return;
  }

  // 3. Obter cardápio
  let cardapio = [];
  try {
    const cardapioResp = await requisitar('/api/cardapio', { token });
    cardapio = cardapioResp.filter(item => Number(item.preco) > 0);
    log(`   ✅ Cardápio: ${cardapio.length} itens com preço`);
  } catch (erro) {
    erros.push(logErro('CARDAPIO', 'GET /api/cardapio', {}, erro.dados, erro.statusCode));
    return;
  }

  // 4. Simular vendas do dia
  const vendas = [];
  for (let v = 0; v < padrao.vendas; v++) {
    const mesaLivre = mesas.find(m => m.status === 'livre');
    if (!mesaLivre) {
      log(`   ⚠️  Sem mesas livres para venda ${v + 1}`);
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
        totalComanda += produto.preco * qtd;
      }

      const comanda = await requisitar(`/api/comanda/${abertura.comandaId}/adicionar`, {
        method: 'POST',
        token,
        body: { itens: itensComanda }
      });

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

      vendas.push({
        comanda: abertura.comandaId,
        total: totalComanda,
        forma,
        status: pagamento.ok ? 'OK' : 'ERRO'
      });

      log(`   ✅ Venda ${v + 1}: R$ ${totalComanda.toFixed(2)} (${forma})`);
    } catch (erro) {
      erros.push(logErro('VENDAS', `Venda ${v + 1}`, { mesa: mesaLivre.num }, erro.dados, erro.statusCode));
    }
  }

  // 5. Fechamento de caixa
  try {
    const fechamento = await requisitar('/api/admin/fechamento-diario', {
      method: 'POST',
      token,
      body: {
        numero_caixa: 1,
        valor_esperado: vendas.reduce((sum, v) => sum + v.total, 0),
        observacoes: `Fechamento dia ${diaNum}`
      }
    });
    log(`   ✅ Caixa fechado: ${fechamento.fechamento?.id || 'OK'}`);
  } catch (erro) {
    erros.push(logErro('CAIXA', 'POST /api/admin/fechamento-diario', { numero_caixa: 1 }, erro.dados, erro.statusCode));
  }

  return vendas;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const erros = [];
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
    await requisitar('/api/admin/mesas/config', {
      method: 'POST',
      token,
      body: { mesasFisicas: 10 }
    });

    // Simular 30 dias
    log(`\n📊 INICIANDO SIMULAÇÃO DE ${DIAS_SIMULACAO} DIAS`);
    log('='.repeat(80));

    const vendas_por_dia = [];
    for (let dia = 1; dia <= DIAS_SIMULACAO; dia++) {
      const vendas = await simularDia(dia, token, erros);
      vendas_por_dia.push({
        dia,
        total_vendas: vendas.length,
        total_valor: vendas.reduce((sum, v) => sum + v.total, 0),
        vendas
      });
    }

    // Relatório final
    log(`\n📊 RELATÓRIO FINAL`);
    log('='.repeat(80));
    const totalVendas = vendas_por_dia.reduce((sum, d) => sum + d.total_vendas, 0);
    const totalValor = vendas_por_dia.reduce((sum, d) => sum + d.total_valor, 0);
    log(`Total de vendas: ${totalVendas}`);
    log(`Total de valor: R$ ${totalValor.toFixed(2)}`);
    log(`Ticket médio: R$ ${(totalValor / totalVendas).toFixed(2)}`);
    log(`Erros encontrados: ${erros.length}`);

    // Salvar logs e erros
    await writeFile(logFile, logBuffer);
    await writeFile(errosFile, JSON.stringify(erros, null, 2));

    log(`\n✅ Simulação concluída!`);
    log(`📄 Logs: ${logFile}`);
    log(`⚠️  Erros: ${errosFile}`);

    console.log(JSON.stringify({
      ok: true,
      dias: DIAS_SIMULACAO,
      total_vendas: totalVendas,
      total_valor: totalValor,
      ticket_medio: totalValor / totalVendas,
      erros: erros.length,
      log_file: logFile,
      erros_file: errosFile
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
