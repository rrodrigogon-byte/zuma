#!/usr/bin/env node
/**
 * Auditoria e recálculo controlado do ERP legado da Barbearia Dino.
 *
 * O runner primeiro calcula todas as divergências sem mutar o banco. Quando
 * habilitado com DINO_RECALC_CONFIRM, corrige apenas campos derivados seguros:
 * saldo devedor do cliente, status/dias de atraso das contas, totalizadores
 * derivados de comandas/vendas e fechamento esperado de caixas. Histórico
 * Avec, pagamentos, lançamentos originais, estoque de origem e cadastros não
 * são reescritos.
 */
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let db;
let save;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIRMATION = 'PRD_DINO_RECALC_20261022_V1';
const RUN_KEY = 'dino-recalc-20261022-v1';
const DEFAULT_EMPRESA_ID = 'emp-kytto-001';
const DEFAULT_LOJA_ID = 'dino-web-estoque';
const MAX_SAMPLES = 200;
const round = (value) => Number(Number(value || 0).toFixed(2));
const text = (value, limit = 240) => String(value ?? '').trim().slice(0, limit);
const now = () => new Date().toISOString();
const idOf = (value) => text(value, 160);
const sameMoney = (a, b) => Math.abs(Number(a || 0) - Number(b || 0)) <= 0.005;
const digest = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 32);

function addIssue(report, type, detail) {
  report.divergencias.total += 1;
  report.divergencias.porTipo[type] = (report.divergencias.porTipo[type] || 0) + 1;
  if (report.divergencias.amostras.length < MAX_SAMPLES) report.divergencias.amostras.push({ type, ...detail });
}

function resolveScope(root) {
  const requestedEmpresaId = text(process.env.DINO_RECALC_EMPRESA_ID || DEFAULT_EMPRESA_ID, 160);
  const requestedLojaId = text(process.env.DINO_RECALC_LOJA_ID || DEFAULT_LOJA_ID, 160);
  const exists = (id) => Boolean(root.barbearias?.[id] || root.clientesKytto?.empresas?.[id]);
  let empresaId = requestedEmpresaId;
  if (!exists(empresaId)) {
    const candidates = Object.entries(root.barbearias || {}).filter(([id, state]) => {
      const config = state?.configuracao || {};
      const slug = text(config.slugPublico || config.slugAgendamento, 100).toLowerCase();
      const name = text(config.nomePublico || config.nome, 160).toLowerCase();
      return id !== DEFAULT_EMPRESA_ID && (slug === 'dino' || (name.includes('dino') && name.includes('barbearia')));
    }).map(([id]) => id);
    if (candidates.length !== 1) throw new Error(`Escopo Dino inseguro: o tenant solicitado não existe e foram encontrados ${candidates.length} candidatos.`);
    empresaId = candidates[0];
  }
  const config = root.barbearias?.[empresaId]?.configuracao || {};
  const lojaId = requestedLojaId === DEFAULT_LOJA_ID && config.lojaPublicaId ? text(config.lojaPublicaId, 160) : requestedLojaId;
  return { empresaId, lojaId };
}

function ensureReportShape(report) {
  report.correcoes ||= { total: 0, porTipo: {} };
  report.divergencias ||= { total: 0, porTipo: {}, amostras: [] };
}

function buildReport(scope, dryRun) {
  return {
    runKey: RUN_KEY,
    status: dryRun ? 'dry_run' : 'pending',
    dryRun,
    startedAt: now(),
    target: { empresaId: scope.empresaId, lojaId: scope.lojaId },
    correcoes: { total: 0, porTipo: {} },
    divergencias: { total: 0, porTipo: {}, amostras: [] },
    contagens: {},
    saldos: {},
    indicadores: { porMes: {}, porProfissional: {}, porServico: {}, porFrenteAtuacao: {} },
    seguranca: { historicalOnlyUntouched: true, paymentsCreated: 0, financialEntriesCreated: 0, operationalOrdersCreated: 0, sourceBalancesUntouched: true },
  };
}

function registerCorrection(report, type) {
  report.correcoes.total += 1;
  report.correcoes.porTipo[type] = (report.correcoes.porTipo[type] || 0) + 1;
}

function setDerived(report, changes, object, key, value, type) {
  if (object[key] === value) return false;
  changes.push({ object, key, previous: object[key], value, type });
  registerCorrection(report, type);
  return true;
}

function restoreChanges(changes) {
  for (let index = changes.length - 1; index >= 0; index -= 1) {
    const change = changes[index];
    if (change.previous === undefined) delete change.object[change.key];
    else change.object[change.key] = change.previous;
  }
}

function operationalState(root, empresaId) {
  return root.barbearias?.[empresaId] || {};
}

function auditReceivables(root, report, scope, changes) {
  const store = root.clientesKytto?.empresas?.[scope.empresaId] || {};
  const clients = store.clientes || {};
  const accounts = store.contasReceber || {};
  let openTotal = 0;
  let paidTotal = 0;
  let pendingCount = 0;
  let overdueCount = 0;
  let accountsCount = 0;
  for (const account of Object.values(accounts)) {
    if (account?.empresaId !== scope.empresaId) continue;
    accountsCount += 1;
    const due = new Date(account.dataVencimento).valueOf();
    const paid = Boolean(account.dataPagamento);
    const overdueDays = Number.isFinite(due) ? Math.max(0, Math.floor((Date.now() - due) / 86400000)) : 0;
    const expectedStatus = paid ? 'paga' : overdueDays > 0 ? 'atrasada' : 'pendente';
    if (!paid) { openTotal += Number(account.valor || 0); if (expectedStatus === 'pendente') pendingCount += 1; else overdueCount += 1; }
    else paidTotal += Number(account.valor || 0);
    if (account.status !== expectedStatus) {
      addIssue(report, 'conta_status', { id: account.id, atual: account.status, esperado: expectedStatus });
      setDerived(report, changes, account, 'status', expectedStatus, 'conta_status');
    }
    if (Number(account.diasAtraso || 0) !== overdueDays) {
      addIssue(report, 'conta_dias_atraso', { id: account.id, atual: Number(account.diasAtraso || 0), esperado: overdueDays });
      setDerived(report, changes, account, 'diasAtraso', overdueDays, 'conta_dias_atraso');
    }
  }
  for (const client of Object.values(clients)) {
    if (!client || client.empresaId !== scope.empresaId || client.status === 'deletado') continue;
    let expected = 0;
    for (const account of Object.values(accounts)) {
      if (account?.empresaId === scope.empresaId && account.clienteId === client.id && account.status !== 'paga') expected += Number(account.valor || 0);
    }
    expected = round(Math.max(0, expected));
    if (!sameMoney(client.saldoDevedor, expected)) {
      addIssue(report, 'cliente_saldo_devedor', { id: client.id, atual: round(client.saldoDevedor), esperado: expected });
      setDerived(report, changes, client, 'saldoDevedor', expected, 'cliente_saldo_devedor');
    }
  }
  report.contagens.contasReceber = accountsCount;
  report.saldos.contasReceber = { aberto: round(openTotal), recebido: round(paidTotal), pendentes: pendingCount, atrasadas: overdueCount };
}

function auditFinancial(root, report, scope) {
  const store = root.financeiroKytto?.empresas?.[scope.empresaId] || {};
  const entries = store.lancamentos || {};
  const summary = { total: 0, receitasPagas: 0, despesasPagas: 0, receitasPendentes: 0, despesasPendentes: 0, receitasCanceladas: 0, despesasCanceladas: 0, receitaPaga: 0, despesaPaga: 0, receber: 0, pagar: 0, semLoja: 0, referenciasAusentes: 0, valoresInvalidos: 0 };
  for (const entry of Object.values(entries)) {
    if (!entry || entry.empresaId !== scope.empresaId) continue;
    summary.total += 1;
    if (!entry.lojaId) summary.semLoja += 1;
    if (!(Number(entry.valor) > 0) || !['receita', 'despesa'].includes(entry.tipo)) { summary.valoresInvalidos += 1; addIssue(report, 'lancamento_invalido', { id: entry.id, tipo: entry.tipo, valor: entry.valor }); }
    if (entry.status === 'pago' && !entry.pagoEm) addIssue(report, 'lancamento_pago_sem_data', { id: entry.id });
    if (entry.status === 'pendente' && !entry.vencimento) addIssue(report, 'lancamento_pendente_sem_vencimento', { id: entry.id });
    if (entry.status === 'pago' && entry.tipo === 'receita') { summary.receitasPagas += 1; summary.receitaPaga += Number(entry.valor || 0); }
    if (entry.status === 'pago' && entry.tipo === 'despesa') { summary.despesasPagas += 1; summary.despesaPaga += Number(entry.valor || 0); }
    if (entry.status === 'pendente' && entry.tipo === 'receita') { summary.receitasPendentes += 1; summary.receber += Number(entry.valor || 0); }
    if (entry.status === 'pendente' && entry.tipo === 'despesa') { summary.despesasPendentes += 1; summary.pagar += Number(entry.valor || 0); }
    if (entry.status === 'cancelado' && entry.tipo === 'receita') summary.receitasCanceladas += 1;
    if (entry.status === 'cancelado' && entry.tipo === 'despesa') summary.despesasCanceladas += 1;
  }
  report.contagens.lancamentosFinanceiros = summary.total;
  report.saldos.financeiro = { ...summary, receitaPaga: round(summary.receitaPaga), despesaPaga: round(summary.despesaPaga), receber: round(summary.receber), pagar: round(summary.pagar), saldoPago: round(summary.receitaPaga - summary.despesaPaga) };
}

function auditFinancialClosures(root, report, scope, changes) {
  const store = root.financeiroKytto?.empresas?.[scope.empresaId] || {};
  const entries = Object.values(store.lancamentos || {}).filter((item) => item?.empresaId === scope.empresaId);
  const closures = store.fechamentos || {};
  let count = 0;
  for (const closure of Object.values(closures)) {
    if (!closure || closure.empresaId !== scope.empresaId || !/^\d{4}-\d{2}-\d{2}$/.test(String(closure.data || ''))) continue;
    const relevant = entries.filter((item) => item.status !== 'cancelado' && String(item.dataOperacao || '').slice(0, 10) === closure.data
      && (closure.lojaId ? item.lojaId === closure.lojaId : !item.lojaId));
    const recebimentos = relevant.filter((item) => item.tipo === 'receita' && item.status === 'pago').reduce((sum, item) => sum + Number(item.valor || 0), 0);
    const pagamentos = relevant.filter((item) => item.tipo === 'despesa' && item.status === 'pago').reduce((sum, item) => sum + Number(item.valor || 0), 0);
    const pendenteReceber = relevant.filter((item) => item.tipo === 'receita' && item.status === 'pendente').reduce((sum, item) => sum + Number(item.valor || 0), 0);
    const pendentePagar = relevant.filter((item) => item.tipo === 'despesa' && item.status === 'pendente').reduce((sum, item) => sum + Number(item.valor || 0), 0);
    const expected = { recebimentos: round(recebimentos), pagamentos: round(pagamentos), pendenteReceber: round(pendenteReceber), pendentePagar: round(pendentePagar), saldoDia: round(recebimentos - pagamentos), totalLancamentos: relevant.length };
    count += 1;
    for (const [key, value] of Object.entries(expected)) {
      if ((key === 'totalLancamentos' ? Number(closure[key] || 0) !== value : !sameMoney(closure[key], value))) {
        addIssue(report, 'fechamento_financeiro_derivado', { id: closure.id, campo: key, atual: closure[key], esperado: value });
        setDerived(report, changes, closure, key, value, 'fechamento_financeiro_derivado');
      }
    }
  }
  report.contagens.fechamentosFinanceiros = count;
}

function auditCash(root, report, scope, changes) {
  const store = root.caixaKytto?.empresas?.[scope.empresaId] || {};
  const cashboxes = store.caixas || {};
  const movements = store.movimentos || {};
  let totalExpected = 0;
  let totalDifference = 0;
  let closed = 0;
  for (const cashbox of Object.values(cashboxes)) {
    if (!cashbox || cashbox.empresaId !== scope.empresaId) continue;
    const related = Object.values(movements).filter((item) => item?.empresaId === scope.empresaId && item.caixaId === cashbox.id);
    const receipts = related.filter((item) => item.tipo === 'recebimento').reduce((sum, item) => sum + Number(item.valor || 0), 0);
    const receiptReversals = related.filter((item) => item.tipo === 'estorno_recebimento').reduce((sum, item) => sum + Number(item.valor || 0), 0);
    const withdrawals = related.filter((item) => item.tipo === 'sangria').reduce((sum, item) => sum + Number(item.valor || 0), 0);
    const supplies = related.filter((item) => item.tipo === 'suprimento').reduce((sum, item) => sum + Number(item.valor || 0), 0);
    const expected = round(Number(cashbox.valorAbertura || 0) + receipts - receiptReversals + supplies - withdrawals);
    if (cashbox.status === 'fechado') {
      closed += 1; totalExpected += expected; totalDifference += Number(cashbox.divergencia || 0);
      if (!sameMoney(cashbox.valorEsperado, expected)) {
        addIssue(report, 'caixa_valor_esperado', { id: cashbox.id, atual: cashbox.valorEsperado, esperado: expected });
        setDerived(report, changes, cashbox, 'valorEsperado', expected, 'caixa_valor_esperado');
      }
      if (cashbox.valorInformado !== null && cashbox.valorInformado !== undefined) {
        const divergence = round(Number(cashbox.valorInformado || 0) - expected);
        if (!sameMoney(cashbox.divergencia, divergence)) {
          addIssue(report, 'caixa_divergencia', { id: cashbox.id, atual: cashbox.divergencia, esperado: divergence });
          setDerived(report, changes, cashbox, 'divergencia', divergence, 'caixa_divergencia');
        }
      }
    }
  }
  report.contagens.caixas = Object.keys(cashboxes).length;
  report.contagens.movimentosCaixa = Object.keys(movements).length;
  report.saldos.caixa = { fechados: closed, valorEsperadoFechados: round(totalExpected), divergenciaRegistradaFechados: round(totalDifference) };
}

function auditStock(root, report, scope, changes) {
  const state = operationalState(root, scope.empresaId);
  const products = state.produtosRevenda || {};
  const movements = state.movimentosEstoque || {};
  const byProduct = new Map();
  for (const movement of Object.values(movements)) {
    if (!movement || movement.empresaId !== scope.empresaId || !movement.produtoId) continue;
    const list = byProduct.get(String(movement.produtoId)) || [];
    list.push(movement); byProduct.set(String(movement.produtoId), list);
  }
  let negative = 0;
  let mismatches = 0;
  let sourceProducts = 0;
  let sourceStock10 = 0;
  for (const product of Object.values(products)) {
    if (!product || product.empresaId !== scope.empresaId) continue;
    if (product.origemImportacao === 'avec-import-20261022') { sourceProducts += 1; if (Number(product.estoqueAtual) === 10) sourceStock10 += 1; }
    if (Number(product.estoqueAtual || 0) < 0) { negative += 1; addIssue(report, 'estoque_negativo', { id: product.id, estoqueAtual: product.estoqueAtual }); }
    const history = (byProduct.get(String(product.id)) || []).filter((item) => Number.isFinite(Number(item.estoquePosterior))).sort((a, b) => String(a.criadoEm || '').localeCompare(String(b.criadoEm || '')) || String(a.id).localeCompare(String(b.id)));
    const last = history.at(-1);
    if (last && !sameMoney(product.estoqueAtual, last.estoquePosterior)) {
      mismatches += 1;
      addIssue(report, 'estoque_derivado_divergente', { id: product.id, atual: product.estoqueAtual, esperado: last.estoquePosterior, movimento: last.id });
      setDerived(report, changes, product, 'estoqueAtual', Number(last.estoquePosterior), 'estoque_derivado_divergente');
    }
    let previous = null;
    for (const movement of history) {
      if (previous !== null && !sameMoney(movement.estoqueAnterior, previous)) addIssue(report, 'estoque_movimento_descontinuo', { produtoId: product.id, movimento: movement.id, anteriorInformado: movement.estoqueAnterior, esperado: previous });
      previous = Number(movement.estoquePosterior);
    }
  }
  report.contagens.produtos = Object.keys(products).length;
  report.contagens.movimentosEstoque = Object.keys(movements).length;
  report.saldos.estoque = { produtosOrigemAvec: sourceProducts, produtosOrigemAvecComSaldo10: sourceStock10, produtosNegativos: negative, divergenciasDerivadas: mismatches };
}

function totalComanda(comanda) {
  const subtotal = (comanda.itens || []).reduce((sum, item) => sum + Number(item.subtotal || (Number(item.precoUnitario || 0) * Number(item.quantidade || 0))), 0);
  const desconto = Math.min(subtotal, Math.max(0, Number(comanda.desconto || 0)));
  return round(Math.max(0, subtotal - desconto + Math.max(0, Number(comanda.gorjeta || 0))));
}

function auditOperations(root, report, scope, changes) {
  const state = operationalState(root, scope.empresaId);
  const financialEntries = root.financeiroKytto?.empresas?.[scope.empresaId]?.lancamentos || {};
  let comandas = 0; let vendas = 0; let paidOrders = 0; let operationalRevenue = 0; let derivedTotal = 0;
  for (const comanda of Object.values(state.comandas || {})) {
    if (!comanda || comanda.empresaId !== scope.empresaId) continue;
    comandas += 1;
    const expectedTotal = totalComanda(comanda);
    const paid = (comanda.pagamentos || []).reduce((sum, item) => sum + Number(item.valor || 0), 0);
    const cashPaid = (comanda.pagamentos || []).filter((item) => String(item.meio || '').toLowerCase() !== 'conta').reduce((sum, item) => sum + Number(item.valor || 0), 0);
    const expectedPending = round(Math.max(0, expectedTotal - paid));
    if (!sameMoney(comanda.totalFaturado, paid)) { addIssue(report, 'comanda_total_faturado', { id: comanda.id, atual: comanda.totalFaturado, esperado: round(paid) }); setDerived(report, changes, comanda, 'totalFaturado', round(paid), 'comanda_total_faturado'); }
    if (!sameMoney(comanda.totalPago, cashPaid)) { addIssue(report, 'comanda_total_pago', { id: comanda.id, atual: comanda.totalPago, esperado: round(cashPaid) }); setDerived(report, changes, comanda, 'totalPago', round(cashPaid), 'comanda_total_pago'); }
    if (!sameMoney(comanda.saldoPendente, expectedPending)) { addIssue(report, 'comanda_saldo_pendente', { id: comanda.id, atual: comanda.saldoPendente, esperado: expectedPending }); setDerived(report, changes, comanda, 'saldoPendente', expectedPending, 'comanda_saldo_pendente'); }
    if (comanda.status !== 'cancelada' && paid > 0) {
      const expectedStatus = expectedPending <= 0.02 ? ((comanda.pagamentos || []).some((item) => String(item.meio || '').toLowerCase() === 'conta') ? 'em_conta' : 'paga') : cashPaid > 0 ? 'parcialmente_paga' : 'aguardando_pagamento';
      if (comanda.status !== expectedStatus) { addIssue(report, 'comanda_status', { id: comanda.id, atual: comanda.status, esperado: expectedStatus }); setDerived(report, changes, comanda, 'status', expectedStatus, 'comanda_status'); }
    }
    if (comanda.status === 'paga' || comanda.status === 'em_conta') { paidOrders += 1; operationalRevenue += paid; }
    for (const id of comanda.financeiroLancamentoIds || []) if (!financialEntries[id]) { addIssue(report, 'comanda_referencia_financeira_ausente', { id: comanda.id, lancamentoId: id }); }
    derivedTotal += expectedTotal;
  }
  for (const sale of Object.values(state.vendasRevenda || {})) {
    if (!sale || sale.empresaId !== scope.empresaId) continue;
    vendas += 1;
    const expected = round((sale.itens || []).reduce((sum, item) => sum + Number(item.subtotal || (Number(item.precoUnitario || 0) * Number(item.quantidade || 0))), 0));
    if (!sameMoney(sale.total, expected)) { addIssue(report, 'venda_total', { id: sale.id, atual: sale.total, esperado: expected }); setDerived(report, changes, sale, 'total', expected, 'venda_total'); }
    if (sale.status === 'pago') operationalRevenue += Number(sale.total || 0);
    derivedTotal += expected;
  }
  report.contagens.comandasOperacionais = comandas;
  report.contagens.vendasRevenda = vendas;
  report.saldos.operacional = { comandasPagas: paidOrders, receitaOperacional: round(operationalRevenue), valorDerivadoComandasEVendas: round(derivedTotal) };
}

function aggregateHistory(root, report, scope) {
  const state = operationalState(root, scope.empresaId);
  const history = state.historicoAtendimentos || {};
  const orders = state.historicoComandas || {};
  const source = report.indicadores;
  let serviceValue = 0; let orderValue = 0; let services = 0; let headers = 0;
  for (const item of Object.values(history)) {
    if (!item || item.empresaId !== scope.empresaId) continue;
    services += 1; serviceValue += Number(item.total ?? item.valor ?? 0);
    const month = text(item.dataAgenda, 7) || 'sem-data';
    const professional = text(item.profissionalNome, 120) || 'não informado';
    const service = text(item.servicoNome, 160) || 'não informado';
    const front = text(item.frenteAtuacao, 120) || 'não informado';
    for (const [bucket, key, amount] of [[source.porMes, month, Number(item.total ?? item.valor ?? 0)], [source.porProfissional, professional, Number(item.total ?? item.valor ?? 0)], [source.porServico, service, Number(item.total ?? item.valor ?? 0)], [source.porFrenteAtuacao, front, Number(item.total ?? item.valor ?? 0)]]) {
      bucket[key] ||= { quantidade: 0, valor: 0 }; bucket[key].quantidade += 1; bucket[key].valor = round(bucket[key].valor + amount);
    }
  }
  for (const item of Object.values(orders)) { if (!item || item.empresaId !== scope.empresaId) continue; headers += 1; orderValue += Number(item.total || 0); }
  report.contagens.historicoAtendimentos = services;
  report.contagens.historicoComandas = headers;
  report.saldos.historico = { valorServicos: round(serviceValue), valorCabecalhosComandas: round(orderValue) };
}

function summarize(report) {
  for (const bucket of Object.values(report.indicadores)) {
    for (const row of Object.values(bucket)) row.valor = round(row.valor);
  }
  report.indicadores.topProfissionais = Object.entries(report.indicadores.porProfissional).sort((a, b) => b[1].valor - a[1].valor).slice(0, 20).map(([nome, dados]) => ({ nome, ...dados }));
  report.indicadores.topServicos = Object.entries(report.indicadores.porServico).sort((a, b) => b[1].valor - a[1].valor).slice(0, 20).map(([nome, dados]) => ({ nome, ...dados }));
  report.indicadores.topFrentes = Object.entries(report.indicadores.porFrenteAtuacao).sort((a, b) => b[1].valor - a[1].valor).slice(0, 20).map(([nome, dados]) => ({ nome, ...dados }));
}

export async function execute() {
  const dryRun = process.argv.includes('--dry-run') || process.env.DINO_RECALC_DRY_RUN === '1';
  ({ db, save } = await import('../db.js'));
  const root = db();
  const scope = resolveScope(root);
  const previous = root.recalculosDino?.[RUN_KEY];
  if (!dryRun && process.env.DINO_RECALC_CONFIRM !== CONFIRMATION) return { skipped: true, reason: 'DINO_RECALC_CONFIRM não habilitado', runKey: RUN_KEY };
  if (!dryRun && previous?.status === 'applied') {
    console.log(JSON.stringify({ alreadyApplied: true, runKey: RUN_KEY, report: previous }, null, 2));
    return { alreadyApplied: true, report: previous };
  }
  const report = buildReport(scope, dryRun);
  const changes = [];
  try {
    auditReceivables(root, report, scope, changes);
    auditFinancial(root, report, scope);
    auditFinancialClosures(root, report, scope, changes);
    auditCash(root, report, scope, changes);
    auditStock(root, report, scope, changes);
    auditOperations(root, report, scope, changes);
    aggregateHistory(root, report, scope);
    summarize(report);
    report.contagens.falhasDeIntegridade = report.divergencias.total;
    report.status = dryRun ? 'dry_run' : 'applied';
    report.finishedAt = now();
    report.hash = digest({ ...report, hash: undefined });
    if (!dryRun) {
      root.recalculosDino ||= {};
      root.recalculosDino[RUN_KEY] = report;
      save();
    } else restoreChanges(changes);
    console.log(JSON.stringify({ ok: true, report }, null, 2));
    return { ok: true, report };
  } catch (error) {
    restoreChanges(changes);
    console.error(`Recálculo Dino não aplicado: ${error.message}`);
    process.exitCode = 1;
    return { ok: false, error: error.message };
  }
}

const entrypoint = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (entrypoint) execute().catch((error) => { console.error(`Falha fatal no recálculo Dino: ${error.stack || error.message || error}`); process.exitCode = 1; });
