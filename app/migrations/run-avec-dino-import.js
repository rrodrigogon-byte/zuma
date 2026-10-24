#!/usr/bin/env node
/**
 * Importação auditável Avec -> Barbearia Dino.
 *
 * O pacote contém cadastro/catálogo, histórico de serviços, cabeçalhos de
 * comandas e o extrato financeiro histórico. O runner não cria comandas ou
 * pagamentos operacionais a partir dos relatórios de histórico. O extrato
 * financeiro, que traz itemid, data, valor, situação e meio/categoria, é
 * lançado no livro financeiro como histórico Avec auditável e separado da
 * operação nova.
 *
 * Modos:
 *   node migrations/run-avec-dino-import.js --dry-run
 *   AVEC_DINO_IMPORT_CONFIRM=PRD_AVEC_DINO_IMPORT_20261022_FINANCE_V1 \
 *     node migrations/run-avec-dino-import.js
 *
 * O modo de aplicação exige a confirmação acima e grava uma única marca de
 * lote no db.json. Reexecução é segura e não duplica registros.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
let db;
let save;
let caminhoBanco;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data', 'avec-dino-20261022');
const CONFIRMATION = 'PRD_AVEC_DINO_IMPORT_20261022_FINANCE_V1';
const RUN_KEY = 'avec-dino-20261022-finance-v1';
const ORIGEM = 'avec-import-20261022';
const ORIGEM_FINANCEIRO = 'avec-import-financeiro-20261022';
const DEFAULT_EMPRESA_ID = 'emp-kytto-001';
const DEFAULT_LOJA_ID = 'dino-web-estoque';
const MAX_EXCEPTIONS = 250;

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function stableHash(value) {
  return sha256(JSON.stringify(value)).slice(0, 32);
}

function text(value, limit = 240) {
  return String(value ?? '').trim().slice(0, limit);
}

function digits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function normalize(value) {
  return text(value, 240)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function money(value) {
  if (typeof value === 'number') return Number(Math.max(0, value).toFixed(2));
  const raw = text(value, 40).replace(/R\$\s?/gi, '').replace(/\./g, '').replace(',', '.');
  const number = Number(raw);
  return Number.isFinite(number) ? Number(Math.max(0, number).toFixed(2)) : 0;
}

function signedMoney(value) {
  const raw = text(value, 40).replace(/R\$\s?/gi, '').replace(/\s/g, '');
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
  const number = Number(normalized);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : null;
}

function brDateToIso(value) {
  const match = text(value, 20).match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : '';
}

function historicalDateTime(value) {
  const date = brDateToIso(value);
  return date ? `${date}T12:00:00.000Z` : '';
}

function paymentMethod(value) {
  const key = normalize(value);
  if (!key) return null;
  if (key.includes('pix')) return 'pix';
  if (key.includes('dinheiro')) return 'dinheiro';
  if (key.includes('transfer')) return 'transferencia';
  if (key.includes('credito')) return 'credito';
  if (key.includes('debito')) return 'debito';
  if (key.includes('boleto')) return 'boleto';
  if (key.includes('deposit')) return 'deposito';
  if (key.includes('cheque')) return 'cheque';
  return key.slice(0, 40).replace(/\s+/g, '_');
}

function now() {
  return new Date().toISOString();
}

function parseJsonLines(file) {
  const rows = [];
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
    if (!lines[lineNumber].trim()) continue;
    try {
      rows.push(JSON.parse(lines[lineNumber]));
    } catch (error) {
      throw new Error(`JSONL inválido em ${path.basename(file)} linha ${lineNumber + 1}: ${error.message}`);
    }
  }
  return rows;
}

function addException(report, entity, reason, detail = {}) {
  report.exceptions.total += 1;
  report.exceptions.byReason[`${entity}:${reason}`] = (report.exceptions.byReason[`${entity}:${reason}`] || 0) + 1;
  if (report.exceptions.samples.length < MAX_EXCEPTIONS) report.exceptions.samples.push({ entity, reason, ...detail });
}

function loadPackage() {
  const manifestPath = path.join(DATA_DIR, 'DATA-MANIFEST.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  for (const [name, expected] of Object.entries(manifest.files || {})) {
    const file = path.join(DATA_DIR, name);
    if (!fs.existsSync(file)) throw new Error(`Arquivo do pacote ausente: ${name}`);
    const bytes = fs.readFileSync(file);
    const actual = sha256(bytes);
    if (actual !== expected.sha256 || bytes.length !== expected.bytes) {
      throw new Error(`Hash/tamanho divergente no pacote: ${name}`);
    }
  }
  const clientes = parseJsonLines(path.join(DATA_DIR, 'clientes.consolidado.jsonl'));
  const historico = parseJsonLines(path.join(DATA_DIR, 'historico-servicos-completo.jsonl'));
  const comandas = parseJsonLines(path.join(DATA_DIR, 'vendas-comandas-cabecalho.jsonl'));
  const financeiro = parseJsonLines(path.join(DATA_DIR, 'financeiro-entradas-saidas-full-2026-10-22.jsonl'));
  const servicos = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'servicos.json'), 'utf8'));
  const profissionais = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'profissionais-inferidos.json'), 'utf8'));
  const produtos = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'produtos-estoque.json'), 'utf8'));
  const expected = manifest.expectedCounts || {};
  const actualCounts = {
    clientes: clientes.length,
    servicos: servicos.length,
    profissionais_inferidos: profissionais.length,
    produtos: produtos.length,
    historico_servicos: historico.length,
    comandas_cabecalho: comandas.length,
    financeiro_entradas_saidas: financeiro.length,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (actualCounts[key] !== value) throw new Error(`Contagem divergente no pacote em ${key}: esperado ${value}, recebido ${actualCounts[key]}`);
  }
  return { manifest, clientes, historico, comandas, financeiro, servicos, profissionais, produtos, actualCounts };
}

function ensureCustomerStore(root, empresaId) {
  root.clientesKytto ||= { empresas: {} };
  root.clientesKytto.empresas ||= {};
  root.clientesKytto.empresas[empresaId] ||= { clientes: {}, contasReceber: {}, alertas: {}, fechamentoDiario: {} };
  const store = root.clientesKytto.empresas[empresaId];
  store.clientes ||= {};
  store.contasReceber ||= {};
  store.alertas ||= {};
  store.fechamentoDiario ||= {};
  return store;
}

function ensureBarbeariaState(root, empresaId) {
  root.barbearias ||= {};
  root.barbearias[empresaId] ||= {};
  const state = root.barbearias[empresaId];
  for (const field of ['profissionais', 'servicos', 'produtosRevenda', 'movimentosEstoque', 'historicoAtendimentos', 'historicoComandas']) state[field] ||= {};
  return state;
}

function makeConsentimentos() {
  return {
    whatsapp: { atendimento: { concedido: false, atualizadoEm: null, origem: null }, marketing: { concedido: false, atualizadoEm: null, origem: null } },
    email: { atendimento: { concedido: false, atualizadoEm: null, origem: null }, marketing: { concedido: false, atualizadoEm: null, origem: null } },
  };
}

function extractPhone(rawName) {
  const match = String(rawName || '').match(/(?:cel|tel|fone)\s*:\s*([+\d()\s-]+)/i);
  return match ? digits(match[1]) : '';
}

function customerKeyFromHistory(row) {
  const cpf = digits(row.cpf);
  const phone = digits(row.celular || row.telefone);
  const name = normalize(row.cliente);
  return `hist:${cpf || 'sem-cpf'}:${phone || 'sem-fone'}:${name}`;
}

function sourceClientKey(row) {
  return `cadastro:${text(row.source_opaque_id, 500) || stableHash(row)}`;
}

function serviceKey(name) {
  return normalize(name);
}

function professionalKey(name) {
  return normalize(name);
}

function addOrGetBySource(bucket, id, create) {
  if (bucket[id]) return { item: bucket[id], created: false };
  bucket[id] = create();
  return { item: bucket[id], created: true };
}

function buildReport(pkg, empresaId, lojaId, dryRun) {
  return {
    runKey: RUN_KEY,
    origem: ORIGEM,
    source: { system: pkg.manifest.sourceSystem, unitId: pkg.manifest.sourceUnitId, packageBatch: pkg.manifest.batchId },
    target: { empresaId, lojaId, dryRun },
    startedAt: now(),
    sourceCounts: pkg.actualCounts,
    imported: {
      clientesCadastro: 0, clientesHistorico: 0, servicosCatalogo: 0, servicosHistoricosAlias: 0,
      profissionaisAtivosInferidos: 0, profissionaisHistoricosInativos: 0, produtos: 0,
      movimentosEstoqueInicial: 0, historicoServicos: 0, historicoComandasCabecalho: 0,
      lancamentosFinanceirosHistoricos: 0,
    },
    existing: { clientes: 0, servicos: 0, profissionais: 0, produtos: 0, historicoServicos: 0, historicoComandas: 0, lancamentosFinanceiros: 0 },
    skipped: { clientesSemNome: 0, historicoInvalido: 0, comandaInvalida: 0, financeiroSemId: 0, financeiroDataInvalida: 0, financeiroValorInvalido: 0 },
    mappings: { historyCustomers: 0, servicesExact: 0, servicesAliases: 0, professionalsExact: 0, professionalsUnresolved: 0 },
    exceptions: { total: 0, byReason: {}, samples: [] },
    financialSafety: {
      operationalOrdersCreated: 0, paymentsCreated: 0, receivablesCreated: 0, financialEntriesCreated: 0,
      historicalRowsImported: 0, historicalRowsExisting: 0, historicalPaidRevenue: 0, historicalPaidExpenses: 0, historicalPendingExpenses: 0,
      note: 'Comandas e pagamentos operacionais não são criados pelo histórico. O extrato Avec é lançado no livro financeiro com origem histórica, chave idempotente e trilha de fonte.',
    },
    stockPolicy: { target: 10, sourceBalancesPreservedAsMetadata: true, operationalStockSetToTarget: true },
  };
}

function importClients(root, pkg, report, empresaId) {
  const store = ensureCustomerStore(root, empresaId);
  const sourceMap = new Map();
  const existingByFingerprint = new Map();
  for (const cliente of Object.values(store.clientes)) {
    if (cliente.origemImportacao === ORIGEM && cliente.sourceKey) existingByFingerprint.set(cliente.sourceKey, cliente.id);
  }
  for (const row of pkg.clientes) {
    const sourceKey = sourceClientKey(row);
    const rawName = text(row.nome, 120);
    if (!rawName) {
      report.skipped.clientesSemNome += 1;
      addException(report, 'cliente', 'sem_nome', { sourceKey });
      continue;
    }
    const phone = digits(row.telefone) || extractPhone(rawName);
    const displayName = /^\s*(cel|tel|fone)\s*:/i.test(rawName) ? `Cliente Avec — ${rawName}` : rawName;
    const id = `cli-avec-${sha256(sourceKey).slice(0, 24)}`;
    const existingId = existingByFingerprint.get(sourceKey);
    const atual = existingId ? store.clientes[existingId] : store.clientes[id];
    if (atual) {
      sourceMap.set(sourceKey, atual.id);
      report.existing.clientes += 1;
      continue;
    }
    const ts = now();
    store.clientes[id] = {
      id, empresaId, nome: displayName, tipo: 'pf', cpfCnpj: digits(row.cpf) || '', email: text(row.email, 100).toLowerCase(),
      telefone: phone, endereco: '', dataNascimento: '', aniversario: '', limiteCreditoMensal: 0, diasVencimento: 30,
      observacao: `Importado do cadastro Avec; nome bruto: ${rawName}`,
      status: 'ativo', saldoDevedor: 0, scoreCredito: 100, risco: 'baixo',
      consentimentos: makeConsentimentos(), consentimentoHistorico: [], criadoEm: ts, atualizadoEm: ts,
      origemImportacao: ORIGEM, sourceSystem: 'avec', sourceUnitId: pkg.manifest.sourceUnitId, sourceKey,
      sourceOpaqueId: text(row.source_opaque_id, 500), sourceVisibleFingerprint: text(row.visible_fingerprint, 100), sourceCapture: { file: row.capture_file, row: row.capture_row },
      qualidadeImportacao: phone || !/^\s*(cel|tel|fone)\s*:/i.test(rawName) ? 'valid' : 'conflict',
    };
    sourceMap.set(sourceKey, id);
    report.imported.clientesCadastro += 1;
  }
  return { store, sourceMap };
}

function importHistoryClients(root, pkg, report, empresaId) {
  const store = ensureCustomerStore(root, empresaId);
  const identityMap = new Map();
  const unique = new Map();
  for (const row of pkg.historico) {
    const key = customerKeyFromHistory(row);
    if (!unique.has(key)) unique.set(key, row);
  }
  for (const [identityKey, row] of unique) {
    const id = `cli-avec-hist-${sha256(identityKey).slice(0, 24)}`;
    identityMap.set(identityKey, id);
    if (store.clientes[id]) {
      report.existing.clientes += 1;
      continue;
    }
    const ts = now();
    const phone = digits(row.celular || row.telefone);
    const cpf = digits(row.cpf);
    store.clientes[id] = {
      id, empresaId, nome: text(row.cliente, 120), tipo: 'pf', cpfCnpj: cpf, email: '', telefone: phone,
      endereco: '', dataNascimento: '', aniversario: '', limiteCreditoMensal: 0, diasVencimento: 30,
      observacao: 'Cliente observado no relatório Avec 0031; cadastro detalhado individual não foi disponibilizado na coleta.',
      status: 'ativo', saldoDevedor: 0, scoreCredito: 100, risco: 'baixo',
      consentimentos: makeConsentimentos(), consentimentoHistorico: [], criadoEm: ts, atualizadoEm: ts,
      origemImportacao: ORIGEM, sourceSystem: 'avec', sourceUnitId: pkg.manifest.sourceUnitId, sourceKey: identityKey,
      qualidadeImportacao: cpf || phone ? 'valid' : 'unresolved',
    };
    report.imported.clientesHistorico += 1;
  }
  report.mappings.historyCustomers = identityMap.size;
  return identityMap;
}

function importServices(state, pkg, report, empresaId, ts) {
  const map = new Map();
  const byName = new Map(Object.values(state.servicos).filter(item => item.empresaId === empresaId).map(item => [serviceKey(item.nome), item]));
  for (const row of pkg.servicos) {
    const name = text(row.nome, 120);
    if (!name) { addException(report, 'servico', 'sem_nome', { sourceRow: row.source_row }); continue; }
    const key = serviceKey(name);
    const existing = byName.get(key);
    if (existing) {
      map.set(key, existing.id);
      report.existing.servicos += 1;
      report.mappings.servicesExact += 1;
      continue;
    }
    const id = `srv-avec-${sha256(`catalog:${key}`).slice(0, 24)}`;
    state.servicos[id] = {
      id, empresaId, nome: name, descricao: text(row.descricao, 500), categoria: text(row.categoria, 80) || 'Geral',
      duracaoMinutos: Math.max(5, Math.min(480, Math.round(Number(row.duracao_minutos) || 30))), preco: money(row.preco_original),
      tipoPreco: money(row.preco_original) > 0 ? 'fixo' : 'sob_consulta', ativo: true,
      permiteAgendamentoOnline: money(row.preco_original) > 0, custoMaterial: null, profissionaisIds: [], consumoInterno: [],
      criadoEm: ts, atualizadoEm: ts, origemImportacao: ORIGEM, sourceSystem: 'avec', sourceUnitId: pkg.manifest.sourceUnitId,
      sourceKey: `catalog-service:${key}`, sourceRow: row.source_row,
    };
    byName.set(key, state.servicos[id]);
    map.set(key, id);
    report.imported.servicosCatalogo += 1;
  }
  const historicalNames = new Set(pkg.historico.map(row => serviceKey(row.servico)).filter(Boolean));
  for (const key of historicalNames) {
    if (map.has(key)) continue;
    const id = `srv-avec-hist-${sha256(`history-service:${key}`).slice(0, 24)}`;
    if (!state.servicos[id]) {
      state.servicos[id] = {
        id, empresaId, nome: key, descricao: 'Nomenclatura histórica observada no relatório Avec 0031; não habilitado para agendamento.',
        categoria: 'Histórico Avec', duracaoMinutos: 30, preco: 0, tipoPreco: 'sob_consulta', ativo: false,
        permiteAgendamentoOnline: false, custoMaterial: null, profissionaisIds: [], consumoInterno: [], criadoEm: ts, atualizadoEm: ts,
        origemImportacao: ORIGEM, sourceSystem: 'avec', sourceUnitId: pkg.manifest.sourceUnitId, sourceKey: `history-service:${key}`, sourceOnly: true,
      };
      report.imported.servicosHistoricosAlias += 1;
    } else report.existing.servicos += 1;
    map.set(key, id);
    report.mappings.servicesAliases += 1;
  }
  return map;
}

function importProfessionals(state, pkg, report, empresaId, ts) {
  const map = new Map();
  const byName = new Map(Object.values(state.profissionais).filter(item => item.empresaId === empresaId).map(item => [professionalKey(item.nome), item]));
  const inferred = new Set(pkg.profissionais.map(row => professionalKey(row.nome)).filter(Boolean));
  for (const name of inferred) {
    const existing = byName.get(name);
    if (existing) {
      map.set(name, existing.id); report.existing.profissionais += 1; report.mappings.professionalsExact += 1; continue;
    }
    const row = pkg.profissionais.find(item => professionalKey(item.nome) === name);
    const id = `prof-avec-${sha256(`inferred:${name}`).slice(0, 24)}`;
    state.profissionais[id] = {
      id, empresaId, nome: text(row.nome, 120), telefone: '', email: '', especialidade: 'Barbearia', tipo: 'parceiro',
      percentualComissao: 0, percentualComissaoProduto: 0, comissoesPorServico: {}, descontaTaxaMaquininha: false,
      descontaMaterial: false, horarioInicio: '08:00', horarioFim: '18:00', diasTrabalho: [1, 2, 3, 4, 5, 6], ativo: true,
      fotoUrl: '', criadoEm: ts, atualizadoEm: ts, origemImportacao: ORIGEM, sourceSystem: 'avec', sourceUnitId: pkg.manifest.sourceUnitId,
      sourceKey: `inferred-professional:${name}`, sourceNote: text(row.source_note, 500), qualidadeImportacao: 'partial_no_commission_data',
    };
    byName.set(name, state.profissionais[id]); map.set(name, id); report.imported.profissionaisAtivosInferidos += 1;
  }
  const historicalNames = new Set(pkg.historico.map(row => professionalKey(row.profissional)).filter(Boolean));
  for (const name of historicalNames) {
    if (!name || name === 'nao informado') continue;
    if (map.has(name)) continue;
    const id = `prof-avec-hist-${sha256(`history-professional:${name}`).slice(0, 24)}`;
    if (!state.profissionais[id]) {
      state.profissionais[id] = {
        id, empresaId, nome: name, telefone: '', email: '', especialidade: 'Histórico Avec', tipo: 'parceiro',
        percentualComissao: 0, percentualComissaoProduto: 0, comissoesPorServico: {}, descontaTaxaMaquininha: false,
        descontaMaterial: false, horarioInicio: '08:00', horarioFim: '18:00', diasTrabalho: [1, 2, 3, 4, 5, 6], ativo: false,
        fotoUrl: '', criadoEm: ts, atualizadoEm: ts, origemImportacao: ORIGEM, sourceSystem: 'avec', sourceUnitId: pkg.manifest.sourceUnitId,
        sourceKey: `history-professional:${name}`, sourceOnly: true, qualidadeImportacao: 'historical_without_official_cadastro',
      };
      report.imported.profissionaisHistoricosInativos += 1;
    } else report.existing.profissionais += 1;
    map.set(name, id);
  }
  report.mappings.professionalsUnresolved = [...historicalNames].filter(name => name === 'nao informado').length;
  if (report.mappings.professionalsUnresolved) addException(report, 'profissional', 'nao_informado', { count: report.mappings.professionalsUnresolved });
  return map;
}

function importProducts(state, pkg, report, empresaId, lojaId, ts) {
  const byName = new Map(Object.values(state.produtosRevenda).filter(item => item.empresaId === empresaId && (!lojaId || !item.lojaId || item.lojaId === lojaId)).map(item => [normalize(item.nome), item]));
  for (const row of pkg.produtos) {
    const name = text(row.nome, 160);
    const key = normalize(name);
    if (!key || money(row.preco_original) <= 0) { addException(report, 'produto', 'cadastro_invalido', { sourceRow: row.source_row, nome: name }); continue; }
    const existing = byName.get(key);
    const targetStock = Number(pkg.manifest.stockTarget || 10);
    if (existing) {
      // O lote financeiro também percorre o catálogo. Um produto já recebido
      // desta fonte pode ter vendas, ajustes e edições posteriores à carga.
      // A ausência da marca de lote não autoriza redefinir esse estado atual.
      if (existing.origemImportacao === ORIGEM
        && existing.sourceUnitId === pkg.manifest.sourceUnitId
        && existing.sourceKey === `product:${key}`) {
        report.existing.produtos += 1;
        continue;
      }
      const previousStock = Number(existing.estoqueAtual || 0);
      existing.precoVenda = money(row.preco_original) || existing.precoVenda;
      existing.estoqueMinimo = Math.max(0, Math.round(Number(row.estoque_minimo) || 0));
      existing.estoqueAtual = targetStock;
      existing.ativo = true;
      existing.origemImportacao = ORIGEM;
      existing.sourceSystem = 'avec';
      existing.sourceUnitId = pkg.manifest.sourceUnitId;
      existing.sourceKey = `product:${key}`;
      existing.sourceEstoqueOriginal = Number(row.estoque_atual || 0);
      existing.estoqueAlvoImportacao = targetStock;
      existing.atualizadoEm = ts;
      report.existing.produtos += 1;
      if (previousStock !== targetStock) {
        const movementId = `mov-avec-${sha256(`stock:${key}:${RUN_KEY}`).slice(0, 24)}`;
        if (!state.movimentosEstoque[movementId]) {
          state.movimentosEstoque[movementId] = { id: movementId, empresaId, lojaId: existing.lojaId || lojaId || null, produtoId: existing.id, tipo: 'importacao_saldo_inicial', quantidade: targetStock - previousStock, estoqueAnterior: previousStock, estoquePosterior: targetStock, observacao: `Saldo Avec ${row.estoque_atual} ajustado para alvo aprovado ${targetStock}.`, origemImportacao: ORIGEM, criadoEm: ts };
          report.imported.movimentosEstoqueInicial += 1;
        }
      }
      continue;
    }
    const id = `rev-avec-${sha256(`product:${key}`).slice(0, 24)}`;
    state.produtosRevenda[id] = {
      id, empresaId, lojaId: lojaId || null, nome: name, sku: text(row.codigo_interno, 80), ean: '', categoria: text(row.categoria, 80) || 'Revenda',
      fornecedorPadraoId: '', unidade: 'un', precoVenda: money(row.preco_original), custoUnitario: 0, estoqueAtual: targetStock,
      estoqueMinimo: Math.max(0, Math.round(Number(row.estoque_minimo) || 0)), ativo: true, criadoEm: ts, atualizadoEm: ts,
      origemImportacao: ORIGEM, sourceSystem: 'avec', sourceUnitId: pkg.manifest.sourceUnitId, sourceKey: `product:${key}`,
      sourceEstoqueOriginal: Number(row.estoque_atual || 0), estoqueAlvoImportacao: targetStock,
    };
    byName.set(key, state.produtosRevenda[id]);
    const movementId = `mov-avec-${sha256(`stock:${key}:${RUN_KEY}`).slice(0, 24)}`;
    state.movimentosEstoque[movementId] = { id: movementId, empresaId, lojaId: lojaId || null, produtoId: id, tipo: 'entrada_inicial', quantidade: targetStock, estoqueAnterior: 0, estoquePosterior: targetStock, observacao: `Saldo inicial importado do Avec com alvo aprovado ${targetStock}; saldo original ${row.estoque_atual}.`, origemImportacao: ORIGEM, criadoEm: ts };
    report.imported.produtos += 1;
    report.imported.movimentosEstoqueInicial += 1;
  }
}

function importHistoricalServices(state, pkg, report, empresaId, lojaId, serviceMap, professionalMap, historyCustomerMap, ts) {
  for (let index = 0; index < pkg.historico.length; index += 1) {
    const row = pkg.historico[index];
    const date = text(row.data_iso, 10);
    const clientName = text(row.cliente, 160);
    const serviceName = text(row.servico, 160);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !clientName || !serviceName) {
      report.skipped.historicoInvalido += 1;
      addException(report, 'historico_servico', 'campos_obrigatorios_ausentes', { sourceRow: index + 1, date, clientName, serviceName });
      continue;
    }
    const sourceKey = `service-row:${index + 1}:${sha256(JSON.stringify(row)).slice(0, 24)}`;
    const id = `hist-avec-${sha256(sourceKey).slice(0, 24)}`;
    if (state.historicoAtendimentos[id]) { report.existing.historicoServicos += 1; continue; }
    const identityKey = customerKeyFromHistory(row);
    const professionalName = text(row.profissional, 120);
    const serviceId = serviceMap.get(serviceKey(serviceName)) || null;
    const professionalId = professionalMap.get(professionalKey(professionalName)) || null;
    if (!professionalId && professionalName && professionalKey(professionalName) !== 'nao informado') addException(report, 'historico_servico', 'profissional_nao_mapeado', { sourceRow: index + 1, professionalName });
    state.historicoAtendimentos[id] = {
      id, empresaId, lojaId: lojaId || null, dataAgenda: date, hora: '', clienteId: historyCustomerMap.get(identityKey) || null,
      clienteNome: clientName, clienteTelefone: digits(row.celular || row.telefone), profissionalId: professionalId, profissionalNome: professionalName,
      servicoId: serviceId, servicoNome: serviceName, status: 'concluido', valor: money(row.valor), quantidade: Math.max(1, Math.round(Number(row.quantidade) || 1)),
      desconto: money(row.desconto), total: money(row.total), frenteAtuacao: text(row.frente_atuacao, 120), pacote: text(row.pacote, 160),
      numeroComanda: text(row.numero_comanda, 60), dataOriginal: text(row.data, 20), diaSemana: text(row.dia_semana, 10), mes: text(row.mes, 7),
      origem: ORIGEM, sourceSystem: 'avec', sourceUnitId: pkg.manifest.sourceUnitId, sourceKey, sourceRow: index + 1,
      sourceHash: sha256(JSON.stringify(row)), importadoEm: ts, importadoPor: 'prd-avec-import-runner', somenteHistorico: true,
    };
    report.imported.historicoServicos += 1;
  }
}

function importHistoricalOrders(state, pkg, report, empresaId, lojaId, historyCustomerMap, ts) {
  const nameCounts = new Map();
  for (const row of pkg.historico) {
    const key = normalize(row.cliente);
    if (key) nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
  }
  for (const row of pkg.comandas) {
    const sourceKey = `order-header:${text(row.header_fingerprint, 120) || stableHash(row)}`;
    const id = `hist-cmd-avec-${sha256(sourceKey).slice(0, 24)}`;
    if (state.historicoComandas[id]) { report.existing.historicoComandas += 1; continue; }
    const clienteNome = text(row.cliente_nome, 160);
    if (!text(row.comanda_codigo, 60) || !text(row.data_comanda_original, 20)) {
      report.skipped.comandaInvalida += 1;
      addException(report, 'historico_comanda', 'cabecalho_incompleto', { sourceKey });
      continue;
    }
    const normalizedName = normalize(clienteNome);
    const matchingHistory = normalizedName && nameCounts.get(normalizedName) === 1
      ? [...historyCustomerMap.entries()].find(([key]) => key.endsWith(`:${normalizedName}`))?.[1] || null
      : null;
    state.historicoComandas[id] = {
      id, empresaId, lojaId: lojaId || null, clienteId: matchingHistory, clienteNome, numeroComanda: text(row.comanda_codigo, 60),
      dataComandaOriginal: text(row.data_comanda_original, 20), dataComandaIso: brDateToIso(row.data_comanda_original), dataFinalizacaoOriginal: text(row.data_finalizacao_original, 40),
      total: money(row.total), itemizacaoCapturada: Boolean(row.itemizacao_capturada), profissionalCapturado: Boolean(row.profissional_capturado),
      unidadeCriacaoOriginal: text(row.unidade_criacao_original, 120), sourceSystem: 'avec', sourceUnitId: pkg.manifest.sourceUnitId,
      sourceKey, sourceHash: sha256(JSON.stringify(row)), sourceFile: text(row.source_file, 300), sourceRow: row.source_row,
      statusImportacao: 'cabecalho_sem_itemizacao_pagamento', somenteHistorico: true, naoEhComandaOperacional: true, importadoEm: ts,
    };
    report.imported.historicoComandasCabecalho += 1;
  }
}

function ensureFinancialStore(root, empresaId) {
  root.financeiroKytto ||= { empresas: {} };
  root.financeiroKytto.empresas ||= {};
  root.financeiroKytto.empresas[empresaId] ||= { lancamentos: {}, fechamentos: {}, sequencia: 0 };
  const store = root.financeiroKytto.empresas[empresaId];
  store.lancamentos ||= {};
  store.fechamentos ||= {};
  store.sequencia ||= 0;
  return store;
}

function importHistoricalFinance(root, pkg, report, empresaId, lojaId, ts) {
  const store = ensureFinancialStore(root, empresaId);
  const existingByKey = new Map(Object.values(store.lancamentos)
    .filter((item) => item?.origem === ORIGEM_FINANCEIRO && item.chaveIdempotencia)
    .map((item) => [item.chaveIdempotencia, item]));
  for (let index = 0; index < pkg.financeiro.length; index += 1) {
    const row = pkg.financeiro[index];
    const itemId = text(row.itemid, 120);
    if (!itemId) {
      report.skipped.financeiroSemId += 1;
      addException(report, 'financeiro', 'itemid_ausente', { sourceRow: index + 1 });
      continue;
    }
    const dataOperacao = historicalDateTime(row.date);
    if (!dataOperacao) {
      report.skipped.financeiroDataInvalida += 1;
      addException(report, 'financeiro', 'data_invalida', { sourceRow: index + 1, itemId, date: text(row.date, 30) });
      continue;
    }
    const valorOriginal = signedMoney(row.value);
    if (valorOriginal === null || valorOriginal === 0) {
      report.skipped.financeiroValorInvalido += 1;
      addException(report, 'financeiro', 'valor_invalido', { sourceRow: index + 1, itemId, value: text(row.value, 40) });
      continue;
    }
    const sourceHash = stableHash(row);
    const chaveIdempotencia = `${ORIGEM_FINANCEIRO}:${itemId}`;
    const status = normalize(row.status) === 'pago' ? 'pago' : 'pendente';
    const tipo = valorOriginal > 0 ? 'receita' : 'despesa';
    const valor = Math.abs(valorOriginal);
    const existente = existingByKey.get(chaveIdempotencia);
    report.financialSafety.historicalRowsExisting += existente ? 1 : 0;
    if (existente) {
      if (String(existente.metadata?.sourceHash || '') !== sourceHash) {
        throw new Error(`Conflito idempotente no lançamento financeiro Avec ${itemId}: a fonte mudou.`);
      }
      report.existing.lancamentosFinanceiros += 1;
    } else {
      const id = `fin-avec-${sha256(itemId).slice(0, 24)}`;
      const lancamento = {
        id, empresaId, tipo, categoria: text(row.category, 100) || 'Outros',
        descricao: text(row.title, 240) || `Lançamento histórico Avec ${itemId}`,
        valor, moeda: 'BRL', origem: ORIGEM_FINANCEIRO, status,
        vencimento: brDateToIso(row.date), dataOperacao,
        pagoEm: status === 'pago' ? dataOperacao : null,
        meioPagamento: paymentMethod(row.payment), lojaId: lojaId || null,
        observacao: 'Histórico financeiro Avec importado para conferência; não representa nova venda operacional.',
        usuario: 'prd-avec-import-runner', automatico: true,
        chaveIdempotencia, origemId: itemId,
        referencia: { origemId: itemId },
        metadata: {
          historicoAvec: true, somenteHistorico: true, naoEhPagamentoOperacional: true,
          sourceSystem: 'Avec SalãoVIP', sourceUnitId: pkg.manifest.sourceUnitId,
          packageBatch: pkg.manifest.batchId, sourceHash, sourceRow: index + 1,
          sourceFile: text(row.source_file, 300), sourceStatus: text(row.status, 40),
          sourceCategory: text(row.category, 100), sourcePayment: text(row.payment, 80),
        },
        fingerprint: sourceHash, payloadFingerprint: sourceHash,
        criadoEm: ts, atualizadoEm: ts,
      };
      store.lancamentos[id] = lancamento;
      existingByKey.set(chaveIdempotencia, lancamento);
      report.imported.lancamentosFinanceirosHistoricos += 1;
      report.financialSafety.historicalRowsImported += 1;
      report.financialSafety.financialEntriesCreated += 1;
    }
    if (status === 'pago' && tipo === 'receita') report.financialSafety.historicalPaidRevenue += valor;
    if (status === 'pago' && tipo === 'despesa') report.financialSafety.historicalPaidExpenses += valor;
    if (status !== 'pago' && tipo === 'despesa') report.financialSafety.historicalPendingExpenses += valor;
  }
  for (const key of ['historicalPaidRevenue', 'historicalPaidExpenses', 'historicalPendingExpenses']) {
    report.financialSafety[key] = Number(report.financialSafety[key].toFixed(2));
  }
}

function writeSnapshotIfPossible(report, dryRun) {
  const dbPath = caminhoBanco();
  if (!fs.existsSync(dbPath)) return null;
  const raw = fs.readFileSync(dbPath);
  const ref = `${dbPath}.${RUN_KEY}.pre.json.gz`;
  if (!dryRun) fs.writeFileSync(ref, gzipSync(raw, { level: 9 }));
  const snapshot = { path: ref, sha256: sha256(raw), bytesOriginal: raw.length, bytesGzip: dryRun ? gzipSync(raw, { level: 9 }).length : fs.statSync(ref).size, createdAt: now() };
  report.snapshot = snapshot;
  return snapshot;
}

function finalizeReport(root, report) {
  report.finishedAt = now();
  report.hash = stableHash({ ...report, hash: undefined });
  root.importacoesAvec ||= {};
  root.importacoesAvec[RUN_KEY] = report;
}

function summarize(root, report, empresaId) {
  const state = root.barbearias?.[empresaId] || {};
  const customers = root.clientesKytto?.empresas?.[empresaId]?.clientes || {};
  const financial = Object.values(root.financeiroKytto?.empresas?.[empresaId]?.lancamentos || {})
    .filter((item) => item.origem === ORIGEM_FINANCEIRO && item.empresaId === empresaId);
  report.after = {
    clientesEmpresa: Object.values(customers).filter(item => item.status !== 'deletado').length,
    profissionaisEmpresa: Object.values(state.profissionais || {}).length,
    servicosEmpresa: Object.values(state.servicos || {}).length,
    produtosEmpresa: Object.values(state.produtosRevenda || {}).length,
    estoqueAlvo10: Object.values(state.produtosRevenda || {}).filter(item => item.origemImportacao === ORIGEM && Number(item.estoqueAtual) === 10).length,
    historicoServicos: Object.values(state.historicoAtendimentos || {}).filter(item => item.origem === ORIGEM).length,
    historicoComandas: Object.values(state.historicoComandas || {}).filter(item => item.origem === ORIGEM || item.sourceSystem === 'avec').length,
    historicoFinanceiro: financial.length,
    historicoFinanceiroPagoReceitas: Number(financial.filter(item => item.tipo === 'receita' && item.status === 'pago').reduce((sum, item) => sum + Number(item.valor || 0), 0).toFixed(2)),
    historicoFinanceiroPagoDespesas: Number(financial.filter(item => item.tipo === 'despesa' && item.status === 'pago').reduce((sum, item) => sum + Number(item.valor || 0), 0).toFixed(2)),
    historicoFinanceiroPendenteDespesas: Number(financial.filter(item => item.tipo === 'despesa' && item.status !== 'pago' && item.status !== 'cancelado').reduce((sum, item) => sum + Number(item.valor || 0), 0).toFixed(2)),
    vendasOperacionaisCriadasPeloLote: 0,
    pagamentosCriadosPeloLote: 0,
    lancamentosFinanceirosCriadosPeloLote: report.imported.lancamentosFinanceirosHistoricos,
  };
}

function resolveTargetScope(root, requestedEmpresaId, requestedLojaId) {
  let empresaId = requestedEmpresaId;
  const hasTenant = (id) => Boolean(root.barbearias?.[id] || root.clientesKytto?.empresas?.[id]);
  if (!hasTenant(empresaId)) {
    const candidates = Object.entries(root.barbearias || {})
      .filter(([id, state]) => {
        const configuracao = state?.configuracao || {};
        const configuredSlug = normalize(configuracao.slugPublico || configuracao.slugAgendamento);
        const publicName = normalize(configuracao.nomePublico);
        return id !== DEFAULT_EMPRESA_ID && (configuredSlug === 'dino' || (publicName.includes('dino') && publicName.includes('barbearia')));
      })
      .map(([id]) => id);
    if (candidates.length !== 1) {
      throw new Error(`Tenant legado ${empresaId} não existe no db.json e a resolução segura encontrou ${candidates.length} candidatos Dino.`);
    }
    empresaId = candidates[0];
  }
  const configuracao = root.barbearias?.[empresaId]?.configuracao || {};
  const lojaId = requestedLojaId === DEFAULT_LOJA_ID && configuracao.lojaPublicaId
    ? text(configuracao.lojaPublicaId, 120)
    : requestedLojaId;
  return { empresaId, lojaId };
}

export async function execute() {
  const pkg = loadPackage();
  const requestedEmpresaId = text(process.env.AVEC_DINO_IMPORT_EMPRESA_ID || pkg.manifest.targetEmpresaId || DEFAULT_EMPRESA_ID, 120);
  const requestedLojaId = text(process.env.AVEC_DINO_IMPORT_LOJA_ID || pkg.manifest.targetLojaId || DEFAULT_LOJA_ID, 120);
  const dryRun = process.argv.includes('--dry-run') || process.env.AVEC_DINO_IMPORT_DRY_RUN === '1';
  if (!dryRun && process.env.AVEC_DINO_IMPORT_CONFIRM !== CONFIRMATION) {
    console.log(JSON.stringify({ skipped: true, reason: 'AVEC_DINO_IMPORT_CONFIRM não habilitado', runKey: RUN_KEY, packageCounts: pkg.actualCounts }));
    return { skipped: true };
  }
  ({ db, save, caminhoBanco } = await import('../db.js'));
  const root = db();
  const { empresaId, lojaId } = resolveTargetScope(root, requestedEmpresaId, requestedLojaId);
  const previous = root.importacoesAvec?.[RUN_KEY];
  if (!dryRun && previous?.status === 'applied') {
    console.log(JSON.stringify({ alreadyApplied: true, runKey: RUN_KEY, report: previous }, null, 2));
    return { alreadyApplied: true, report: previous };
  }
    const report = buildReport(pkg, empresaId, lojaId, dryRun);
  const before = structuredClone(root);
  try {
    const ts = now();
    if (!root.barbearias?.[empresaId] && !root.clientesKytto?.empresas?.[empresaId] && !dryRun) {
      throw new Error(`Tenant legado ${empresaId} não existe no db.json; importação interrompida para evitar gravar no escopo errado.`);
    }
    writeSnapshotIfPossible(report, dryRun);
    const state = ensureBarbeariaState(root, empresaId);
    const { sourceMap } = importClients(root, pkg, report, empresaId);
    const historyCustomerMap = importHistoryClients(root, pkg, report, empresaId);
    const serviceMap = importServices(state, pkg, report, empresaId, ts);
    const professionalMap = importProfessionals(state, pkg, report, empresaId, ts);
    importProducts(state, pkg, report, empresaId, lojaId, ts);
    importHistoricalServices(state, pkg, report, empresaId, lojaId, serviceMap, professionalMap, historyCustomerMap, ts);
    importHistoricalOrders(state, pkg, report, empresaId, lojaId, historyCustomerMap, ts);
    importHistoricalFinance(root, pkg, report, empresaId, lojaId, ts);
    report.crosswalk = {
      cadastroClientesComSourceKey: sourceMap.size,
      clientesHistoricoComSourceKey: historyCustomerMap.size,
      servicesMapped: serviceMap.size,
      professionalsMapped: professionalMap.size,
      financialRowsMappedByItemId: report.imported.lancamentosFinanceirosHistoricos + report.existing.lancamentosFinanceiros,
    };
    summarize(root, report, empresaId);
    if (dryRun) {
      for (const key of Object.keys(root)) delete root[key];
      Object.assign(root, before);
    } else {
      report.status = 'applied';
      finalizeReport(root, report);
      save();
    }
    console.log(JSON.stringify({ ok: true, dryRun, report }, null, 2));
    return { ok: true, dryRun, report };
  } catch (error) {
    for (const key of Object.keys(root)) delete root[key];
    Object.assign(root, before);
    console.error(`Importação Avec não aplicada: ${error.message}`);
    process.exitCode = 1;
    return { ok: false, error: error.message };
  }
}

const entrypoint = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (entrypoint) execute().catch((error) => {
  console.error(`Falha fatal no runner Avec: ${error.stack || error.message || error}`);
  process.exitCode = 1;
});
