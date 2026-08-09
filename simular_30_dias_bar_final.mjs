#!/usr/bin/env node
/**
 * ============================================================================
 * SIMULAÇÃO DE 30 DIAS — OPERAÇÃO DE BAR (VERSÃO FINAL)
 * ============================================================================
 * Baseado no teste de integração existente (testar_comandas_kytto_integracao.mjs)
 * Expande para 30 dias com rastreamento completo de erros e relatórios
 * 
 * ============================================================================
 */

import { spawn } from 'node:child_process';
import { rm, mkdir, writeFile } from 'node:fs/promises';
import { randomInt } from 'node:crypto';
import assert from 'node:assert';

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const port = 18080;
const base = `http://127.0.0.1:${port}`;
const testDir = '/tmp/kytto-bar-sim-30dias-final';
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
    formas_pagamento: {},
    modulos_com_erro: {}
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
  console.error(`❌ ERRO: ${modulo} — ${rota} (HTTP ${statusCode})`);
  erros.push(erro);
  relatorio.resumo.total_erros++;
  relatorio.resumo.modulos_com_erro[modulo] = (relatorio.resumo.modulos_com_erro[modulo] || 0) + 1;
  return erro;
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

async function simularDia(diaNum, token, mesas, cardapio, clienteTesteId) {
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

      assert.ok(abertura.comandaId, 'Abertura deve retornar identificador da comanda.');

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

      assert.equal(comanda.itens.length, itensComanda.length, 'Todos os itens enviados devem ser incluídos na comanda.');
      assert.ok(comanda.itens.every((item, indice) => item.qtd === itensComanda[indice].qtd), 'As quantidades devem ser persistidas.');
      assert.ok(comanda.total > 0, 'Total deve ser calculado.');

      // Solicitar conta
      const contaSolicitada = await requisitar(`/api/comanda/${abertura.comandaId}/conta`, {
        method: 'POST',
        token,
        body: {}
      });

      assert.equal(contaSolicitada.comanda.status, 'conta', 'Solicitação de conta deve atualizar o status.');

      // Pagar (mix de formas: 40% dinheiro, 35% PIX, 20% cartão, 5% conta)
      const formas = ['dinheiro', 'dinheiro', 'dinheiro', 'dinheiro', 'pix', 'pix', 'pix', 'pix', 'pix', 'pix', 'pix', 'cartao', 'cartao', 'cartao', 'cartao', 'conta'];
      const forma = formas[randomInt(0, formas.length - 1)];

      const pagamento = await requisitar(`/api/comanda/${abertura.comandaId}/pagar`, {
        method: 'POST',
        token,
        body: {
          meio: forma,
          ...(forma === 'conta' ? { clienteId: clienteTesteId } : {})
        }
      });

      assert.equal(pagamento.ok, true, 'Pagamento deve encerrar a comanda.');

      // Verificar que a mesa foi liberada
      const mesasApos = await requisitar('/api/mesas', { token });
      const mesaApos = mesasApos.fisicas.find((item) => item.num === mesaLivre.num);
      assert.equal(mesaApos.status, 'livre', 'Mesa deve ser liberada após pagamento.');

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

    } catch (erro) {
      logErro('VENDAS', `Venda ${v + 1}/${padrao.vendas}`, { mesa: mesaLivre?.num }, erro.dados || erro.message, erro.statusCode || 0);
      diaData.erros_dia++;
    }
  }

  log(`   ✅ Dia concluído: ${diaData.vendas.length} vendas, R$ ${diaData.total_valor.toFixed(2)}, ${diaData.erros_dia} erros`);
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
  let serverLog = '';

  try {
    // Preparar ambiente
    log('🔧 Preparando ambiente de simulação...');
    await rm(testDir, { recursive: true, force: true });
    await mkdir(testDir, { recursive: true });

    // Iniciar servidor
    log('🚀 Iniciando servidor isolado...');
    servidor = spawn('node', ['app/server-erp.js'], {
      cwd: new URL('.', import.meta.url).pathname,
      env: { ...process.env, NODE_ENV: 'development', SIMULATION_MODE: 'true', PORT: String(port), DB_PATH: dbPath, GCS_BUCKET: '', GCS_OBJECT: '' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    servidor.stdout.on('data', (chunk) => { serverLog += chunk.toString(); });
    servidor.stderr.on('data', (chunk) => { serverLog += chunk.toString(); });

    // Aguardar servidor iniciar
    let tentativas = 0;
    while (tentativas < 100) {
      try {
        const resposta = await fetch(`${base}/health`);
        if (resposta.ok) {
          const dados = await resposta.json();
          log(`✅ Servidor iniciado. Versão: ${dados.versao}, Módulos: ${dados.modulos?.length || 0}`);
          break;
        }
      } catch (erro) {
        // Ignorar erro e tentar novamente
      }
      tentativas++;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    if (tentativas >= 100) {
      throw new Error('Servidor não iniciou após 50 segundos');
    }

    // Login
    log('🔐 Autenticando...');
    const login = await requisitar('/api/admin/login', {
      method: 'POST',
      body: CREDENCIAIS_ADMIN
    });
    assert.ok(login.token, 'Login administrativo deve retornar token.');
    const token = login.token;
    log(`✅ Token obtido: ${token.substring(0, 20)}...`);

    // Criar cliente de teste para as vendas lançadas em conta
    const clienteTeste = await requisitar('/api/admin/clientes', {
      method: 'POST',
      token,
      body: {
        nome: 'Cliente Simulação 30 Dias',
        tipo: 'pf',
        documento: '12345678909',
        limiteCreditoMensal: 50000,
        diasVencimento: 7
      }
    });
    const clienteTesteId = clienteTeste.cliente?.id;
    assert.ok(clienteTesteId, 'Cliente de simulação deve ser criado.');
    log(`✅ Cliente de conta criado: ${clienteTesteId}`);

    // Configurar mesas
    log('📋 Configurando mesas...');
    try {
      await requisitar('/api/admin/mesas/config', {
        method: 'POST',
        token,
        body: { mesasFisicas: 10 }
      });
    } catch (erro) {
      log('⚠️  Erro ao configurar mesas (continuando)');
    }

    // Obter mesas
    const mesasResp = await requisitar('/api/mesas', { token });
    const mesas = mesasResp.fisicas || [];
    assert.ok(Array.isArray(mesas) && mesas.length > 0, 'Mapa físico de mesas deve existir.');
    log(`✅ Mesas disponíveis: ${mesas.length}`);

    // Obter catálogo administrativo
    log('🍹 Populando catálogo...');
    const catalogoAdmin = await requisitar('/api/admin/cardapio', { token });
    assert.ok(Array.isArray(catalogoAdmin) && catalogoAdmin.length > 0, 'Catálogo administrativo deve ter itens.');
    log(`   Catálogo administrativo: ${catalogoAdmin.length} itens`);

    // Atualizar preços
    let atualizados = 0;
    for (const item of catalogoAdmin) {
      try {
        const preco = 10 + Math.random() * 20;
        await requisitar(`/api/admin/cardapio/${encodeURIComponent(item.id)}`, {
          method: 'PATCH',
          token,
          body: { preco: Number(preco.toFixed(2)), indisponivel: false, precoPendente: false }
        });
        atualizados++;
      } catch (erro) {
        // Ignorar erros de atualização individual
      }
    }
    log(`   Atualizados: ${atualizados} itens`);

    // Obter cardápio operacional
    const cardapioResp = await requisitar('/api/cardapio', { token });
    const cardapio = (Array.isArray(cardapioResp) ? cardapioResp : cardapioResp.itens || [])
      .filter(item => Number(item.preco) > 0);
    assert.ok(cardapio.length > 0, 'Catálogo operacional deve conter ao menos um produto com preço válido.');
    log(`✅ Cardápio operacional: ${cardapio.length} itens com preço`);

    // Simular 30 dias
    log(`\n📊 INICIANDO SIMULAÇÃO DE ${DIAS_SIMULACAO} DIAS`);
    log('='.repeat(80));

    relatorio.resumo.total_dias = DIAS_SIMULACAO;

    for (let dia = 1; dia <= DIAS_SIMULACAO; dia++) {
      await simularDia(dia, token, mesas, cardapio, clienteTesteId);
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
    log(`\nMódulos com erro:`);
    Object.entries(relatorio.resumo.modulos_com_erro).forEach(([modulo, qtd]) => {
      log(`  - ${modulo}: ${qtd} erros`);
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
    if (serverLog) {
      console.error('\n--- SERVER LOG ---');
      console.error(serverLog.slice(-2000));
    }
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
