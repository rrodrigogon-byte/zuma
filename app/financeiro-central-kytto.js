
// ── Cache de Performance para Consultas Financeiras (Resumo e DRE) ───────────
let _cacheVersaoFinanceiro = 1;
const _cacheMemoriaFinanceiro = new Map();
const TTL_CACHE_FINANCEIRO_MS = 30_000; // 30 segundos

export function invalidarCacheFinanceiro() {
  _cacheVersaoFinanceiro += 1;
  _cacheMemoriaFinanceiro.clear();
}
// ============================================================================
// FINANCEIRO CENTRAL KYTTO
// Livro-caixa multientidade com rastreabilidade de eventos operacionais.
// A persistência continua sendo o banco JSON; cada mutação confirma save() e
// reverte a mutação local se a gravação falhar.
// ============================================================================

import crypto from 'node:crypto';
import { db, save } from './db.js';

const MOEDA = 'BRL';
const TIPOS = new Set(['receita', 'despesa']);
const STATUS = new Set(['pendente', 'pago', 'cancelado']);
const EMPRESA_LEGADO = 'emp-kytto-001';
const CAMPOS_REFERENCIA = [
  'comandaId', 'contaReceberId', 'fornecedorId', 'produtoId', 'documentoId', 'pedidoId',
  'movimentoId', 'clienteId', 'notaNumero', 'cobrancaId', 'agendamentoId', 'valeId',
  'origemId', 'actionId', 'tipo', 'referencia', 'servicoId', 'profissionalId', 'repasseId',
  'lancamentoOriginalId', 'reversalId',
];
const CAMPOS_PAYLOAD = [
  'tipo', 'categoria', 'descricao', 'valor', 'moeda', 'origem', 'status', 'vencimento',
  'dataOperacao', 'pagoEm', 'meioPagamento', 'lojaId', 'observacao', 'referencia', 'usuario',
  'automatico', 'cobrancaId', 'agendamentoId', 'valeId', 'origemId', 'actionId', 'metadata',
];
const CHAVES_SENSIVEIS = /pass(word|code)?|senha|secret|token|authorization|cookie|credential|private.?key|api.?key/i;

export class FinancialError extends Error {
  constructor(message, code = 'FINANCIAL_INVALID', statusCode = 400, details = {}) {
    super(message);
    this.name = 'FinancialError';
    this.code = code;
    this.statusCode = statusCode;
    this.status = statusCode;
    Object.assign(this, details);
  }
}

const agora = () => new Date().toISOString();
const valorMonetario = (valor) => Number(Number(valor || 0).toFixed(2));
const texto = (valor, limite = 240) => String(valor ?? '').replace(/\u0000/g, '').trim().slice(0, limite);

function dataIso(valor, fallback = agora()) {
  const data = valor ? new Date(valor) : new Date(fallback);
  return Number.isNaN(data.valueOf()) ? new Date(fallback).toISOString() : data.toISOString();
}

function dataCurta(valor) {
  return dataIso(valor).slice(0, 10);
}

function clone(valor) {
  if (valor === undefined) return undefined;
  return typeof structuredClone === 'function' ? structuredClone(valor) : JSON.parse(JSON.stringify(valor));
}

function idEscopo(valor, limite = 120) {
  const resultado = texto(valor, limite);
  return resultado && !['undefined', 'null', 'nan'].includes(resultado.toLowerCase()) ? resultado : '';
}

export const DINO_EMPRESA_CANONICA = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
export const DINO_LOJA_CANONICA = 'ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8';
export const DINO_EMPRESA_LEGADA = 'emp-kytto-001';
export const DINO_LOJA_LEGADA = 'dino-web-estoque';

export function saoEmpresasEquivalentes(empresaA, empresaB) {
  const a = idEscopo(empresaA);
  const b = idEscopo(empresaB);
  if (!a || !b) return false;
  if (a === b) return true;
  if ((a === DINO_EMPRESA_CANONICA && b === DINO_EMPRESA_LEGADA) ||
      (a === DINO_EMPRESA_LEGADA && b === DINO_EMPRESA_CANONICA)) return true;
  return false;
}

export function saoLojasEquivalentes(lojaA, lojaB) {
  const a = idEscopo(lojaA);
  const b = idEscopo(lojaB);
  if (a === b) return true;
  if ((a === DINO_LOJA_CANONICA && b === DINO_LOJA_LEGADA) ||
      (a === DINO_LOJA_LEGADA && b === DINO_LOJA_CANONICA)) return true;
  return false;
}

export function podeAcessarLancamentoNaLoja(lojaPedida, lojaRegistro) {
  const pedida = idEscopo(lojaPedida);
  const registro = idEscopo(lojaRegistro);
  if (!pedida || !registro) return true;
  return saoLojasEquivalentes(pedida, registro);
}

function marcadorCompatibilidade(...valores) {
  return valores.some((valor) => valor === true)
    || valores.some((valor) => ['legacy', 'quarantine', 'quarentena', 'legado'].includes(String(valor || '').toLowerCase()));
}

function modoCompatibilidade(dados = {}, opcoes = {}) {
  const fonte = { ...(dados && typeof dados === 'object' ? dados : {}), ...(opcoes && typeof opcoes === 'object' ? opcoes : {}) };
  const quarantine = fonte.quarantine === true || fonte.quarentena === true || ['quarantine', 'quarentena'].includes(String(fonte.modo || fonte.scopeMode || '').toLowerCase());
  const legacy = quarantine || fonte.legacy === true || fonte.legado === true || ['legacy', 'legado'].includes(String(fonte.modo || fonte.scopeMode || '').toLowerCase());
  return { legacy, quarantine };
}

function contexto(empresaId, lojaId, dados = {}, opcoes = {}, { lojaObrigatoria = true } = {}) {
  const modo = modoCompatibilidade(dados, opcoes);
  const empresaInformada = idEscopo(empresaId);
  const empresaDados = idEscopo(dados?.empresaId);
  if (empresaInformada && empresaDados && !saoEmpresasEquivalentes(empresaInformada, empresaDados)) throw new FinancialError('empresaId divergente no escopo financeiro.', 'FINANCIAL_SCOPE_MISMATCH', 409);
  const empresa = empresaInformada || empresaDados;
  const loja = idEscopo(lojaId || dados?.lojaId);
  if (!empresa && !modo.legacy) throw new FinancialError('empresaId é obrigatório para o lançamento financeiro.', 'FINANCIAL_SCOPE_REQUIRED', 400);
  if (lojaObrigatoria && !loja && !modo.legacy) throw new FinancialError('lojaId é obrigatório para o lançamento financeiro operacional.', 'FINANCIAL_SCOPE_REQUIRED', 400);
  return {
    empresaId: empresa || EMPRESA_LEGADO,
    lojaId: loja,
    legacy: modo.legacy,
    quarantine: modo.quarantine || (!loja && modo.legacy),
  };
}

function storeEmpresa(empresaId) {
  const estado = db();
  estado.financeiroKytto ||= { empresas: {} };
  estado.financeiroKytto.empresas ||= {};
  const chave = idEscopo(empresaId) || EMPRESA_LEGADO;
  estado.financeiroKytto.empresas[chave] ||= { lancamentos: {}, fechamentos: {}, sequencia: 0 };
  const empresa = estado.financeiroKytto.empresas[chave];
  empresa.lancamentos ||= {};
  empresa.fechamentos ||= {};
  empresa.sequencia ||= 0;
  return empresa;
}

function novoId(empresaId, prefixo) {
  const store = storeEmpresa(empresaId);
  store.sequencia += 1;
  return `${prefixo}-${Date.now().toString(36)}-${String(store.sequencia).padStart(5, '0')}`;
}

function saneamento(valor, profundidade = 0) {
  if (valor === null || typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean') {
    if (typeof valor === 'string') return texto(valor, 1000);
    return typeof valor === 'number' && !Number.isFinite(valor) ? null : valor;
  }
  if (profundidade >= 5 || valor === undefined || typeof valor === 'function' || typeof valor === 'symbol' || typeof valor === 'bigint') return undefined;
  if (Array.isArray(valor)) return valor.slice(0, 50).map((item) => saneamento(item, profundidade + 1)).filter((item) => item !== undefined);
  if (typeof valor !== 'object') return undefined;
  const resultado = {};
  Object.keys(valor).sort().slice(0, 80).forEach((chave) => {
    if (CHAVES_SENSIVEIS.test(chave)) return;
    const chaveLimpa = texto(chave, 80);
    if (!chaveLimpa) return;
    const item = saneamento(valor[chave], profundidade + 1);
    if (item !== undefined) resultado[chaveLimpa] = item;
  });
  return resultado;
}

function metadataSaneada(valor) {
  if (valor === undefined) return undefined;
  const resultado = saneamento(valor);
  return resultado && typeof resultado === 'object' && !Array.isArray(resultado) ? resultado : {};
}

function normalizarReferencia(referencia = {}) {
  if (!referencia || typeof referencia !== 'object' || Array.isArray(referencia)) return {};
  return Object.fromEntries(
    CAMPOS_REFERENCIA
      .filter((campo) => referencia[campo] !== undefined && referencia[campo] !== null && referencia[campo] !== '')
      .map((campo) => [campo, texto(referencia[campo], 180)])
      .filter(([, valor]) => valor !== '')
  );
}

function campoReferencia(dados, nome) {
  return dados[nome] ?? dados.referencia?.[nome];
}

function serializar(lancamento) {
  return clone({
    ...lancamento,
    referencia: { ...(lancamento.referencia || {}) },
    ...(lancamento.metadata !== undefined ? { metadata: clone(lancamento.metadata) } : {}),
  });
}

function payloadRelevante(lancamento) {
  return Object.fromEntries(CAMPOS_PAYLOAD.filter((campo) => lancamento[campo] !== undefined).map((campo) => [campo, clone(lancamento[campo])]));
}

function stringifyEstavel(valor) {
  if (Array.isArray(valor)) return `[${valor.map(stringifyEstavel).join(',')}]`;
  if (valor && typeof valor === 'object') return `{${Object.keys(valor).sort().map((chave) => `${JSON.stringify(chave)}:${stringifyEstavel(valor[chave])}`).join(',')}}`;
  return JSON.stringify(valor);
}

function fingerprintPayload(payload) {
  return crypto.createHash('sha256').update(stringifyEstavel(payload)).digest('hex');
}

function fingerprintFor(lancamento) {
  return lancamento.payloadFingerprint || fingerprintPayload(payloadRelevante(lancamento));
}

function chaveDados(dados = {}) {
  return texto(dados.chaveIdempotencia ?? dados.idempotencyKey, 255);
}

function conflitoIdempotencia(chave, existente, fingerprint, payloadFingerprint) {
  const fingerprintExistente = texto(existente.fingerprint, 255);
  const payloadExistente = fingerprintFor(existente);
  if ((fingerprintExistente && fingerprintExistente !== fingerprint) || payloadExistente !== payloadFingerprint) {
    throw new FinancialError('A chave idempotente já foi usada com payload financeiro divergente.', 'FINANCIAL_IDEMPOTENCY_CONFLICT', 409, {
      idempotencyKey: chave,
      lancamentoId: existente.id,
    });
  }
  return serializar(existente);
}

function snapshotStore(store) {
  return { lancamentos: clone(store.lancamentos), fechamentos: clone(store.fechamentos), sequencia: store.sequencia };
}

function restoreStore(store, snapshot) {
  store.lancamentos = snapshot.lancamentos;
  store.fechamentos = snapshot.fechamentos;
  store.sequencia = snapshot.sequencia;
}

function persistir(store, snapshot, callback) {
  try {
    const resultado = callback();
    save();
    return resultado;
  } catch (erro) {
    restoreStore(store, snapshot);
    throw erro;
  }
}

function registrosEmpresa(empresaId) {
  return Object.values(db().financeiroKytto?.empresas?.[String(empresaId)]?.lancamentos || {})
    .filter((item) => item.empresaId === String(empresaId));
}

function semLoja(item) {
  return !idEscopo(item?.lojaId);
}

function contagemQuarentena(empresaId) {
  return registrosEmpresa(empresaId).filter(semLoja).length;
}

function exigeLeituraLoja(empresaId, lojaId, opcoes = {}, nome = 'consulta financeira') {
  const modo = modoCompatibilidade(opcoes, opcoes);
  const contextoLido = contexto(empresaId, lojaId, opcoes, opcoes, { lojaObrigatoria: true });
  if (!contextoLido.lojaId && !modo.legacy) throw new FinancialError(`lojaId é obrigatório para ${nome}.`, 'FINANCIAL_SCOPE_REQUIRED', 400);
  return contextoLido;
}

function parseRegistrar(empresaOuDados, dadosOuOpcoes = {}, opcoes = {}) {
  if (empresaOuDados && typeof empresaOuDados === 'object' && !Array.isArray(empresaOuDados)) {
    const dados = { ...empresaOuDados };
    const opcoesRegistro = dadosOuOpcoes && typeof dadosOuOpcoes === 'object' ? dadosOuOpcoes : {};
    return { empresaId: dados.empresaId, dados, opcoes: opcoesRegistro };
  }
  return { empresaId: empresaOuDados, dados: { ...(dadosOuOpcoes || {}) }, opcoes: opcoes || {} };
}

export function obterLancamento(empresaId, id, opcoes = {}) {
  const empresa = idEscopo(empresaId);
  const estado = db().financeiroKytto?.empresas || {};
  let item = estado[empresa]?.lancamentos?.[String(id)];
  if (!item && saoEmpresasEquivalentes(empresa, DINO_EMPRESA_CANONICA)) {
    const outraEmpresa = empresa === DINO_EMPRESA_CANONICA ? DINO_EMPRESA_LEGADA : DINO_EMPRESA_CANONICA;
    item = estado[outraEmpresa]?.lancamentos?.[String(id)];
  }
  if (!item || !saoEmpresasEquivalentes(item.empresaId, empresa)) return null;
  const lojaId = idEscopo(typeof opcoes === 'string' ? opcoes : opcoes?.lojaId);
  if (!podeAcessarLancamentoNaLoja(lojaId, item.lojaId)) return null;
  const serializado = serializar(item);
  if (empresa === DINO_EMPRESA_CANONICA && serializado.empresaId === DINO_EMPRESA_LEGADA) {
    serializado.empresaId = DINO_EMPRESA_CANONICA;
    if (serializado.lojaId === DINO_LOJA_LEGADA) serializado.lojaId = DINO_LOJA_CANONICA;
  }
  return serializado;
}

// Invalida cache ao registrar novo lançamento
invalidarCacheFinanceiro();
export function registrarLancamento(empresaOuDados, dadosOuOpcoes = {}, opcoes = {}) {
  const parsed = parseRegistrar(empresaOuDados, dadosOuOpcoes, opcoes);
  const dados = parsed.dados || {};
  const escopo = contexto(parsed.empresaId, parsed.opcoes.lojaId || dados.lojaId, dados, parsed.opcoes, { lojaObrigatoria: true });
  const store = storeEmpresa(escopo.empresaId);
  const tipo = String(dados.tipo || '').toLowerCase();
  const valor = valorMonetario(dados.valor);
  if (!TIPOS.has(tipo)) throw new FinancialError('Tipo financeiro deve ser receita ou despesa.', 'FINANCIAL_TYPE_INVALID', 400);
  if (!Number.isFinite(valor) || valor <= 0) throw new FinancialError('Valor financeiro deve ser positivo.', 'FINANCIAL_VALUE_INVALID', 400);

  const chaveIdempotencia = chaveDados(dados);
  const status = STATUS.has(String(dados.status || '').toLowerCase()) ? String(dados.status).toLowerCase() : 'pendente';
  const dataOperacao = dataIso(dados.dataOperacao);
  const vencimento = dataCurta(dados.vencimento || dataOperacao);
  const pagoEm = status === 'pago' ? dataIso(dados.pagoEm || dataOperacao) : null;
  const referencia = normalizarReferencia({ ...(dados.referencia || {}), ...Object.fromEntries(CAMPOS_REFERENCIA.filter((campo) => dados[campo] !== undefined).map((campo) => [campo, dados[campo]])) });
  const metadata = metadataSaneada(dados.metadata ?? dados.metadados);
  const base = {
    empresaId: escopo.empresaId,
    tipo,
    categoria: texto(dados.categoria || 'Outros', 100),
    descricao: texto(dados.descricao || 'Lançamento financeiro', 240),
    valor,
    moeda: MOEDA,
    origem: texto(dados.origem || 'manual', 60),
    status,
    vencimento,
    dataOperacao,
    pagoEm,
    meioPagamento: texto(dados.meioPagamento || '', 40).toLowerCase() || null,
    lojaId: escopo.lojaId,
    observacao: texto(dados.observacao || dados.obs || '', 500),
    referencia,
    usuario: texto(dados.usuario || dados.usuarioId || 'sistema@kytto.local', 120),
    automatico: dados.automatico === true,
    chaveIdempotencia: chaveIdempotencia || null,
    ...(campoReferencia(dados, 'cobrancaId') ? { cobrancaId: texto(campoReferencia(dados, 'cobrancaId'), 180) } : {}),
    ...(campoReferencia(dados, 'agendamentoId') ? { agendamentoId: texto(campoReferencia(dados, 'agendamentoId'), 180) } : {}),
    ...(campoReferencia(dados, 'valeId') ? { valeId: texto(campoReferencia(dados, 'valeId'), 180) } : {}),
    ...(campoReferencia(dados, 'origemId') ? { origemId: texto(campoReferencia(dados, 'origemId'), 180) } : {}),
    ...(dados.actionId !== undefined ? { actionId: texto(dados.actionId, 180) || null } : {}),
    ...(dados.correlationId !== undefined ? { correlationId: texto(dados.correlationId, 180) || null } : {}),
    ...(dados.fingerprint !== undefined ? { fingerprint: texto(dados.fingerprint, 255) || null } : {}),
    ...(metadata !== undefined ? { metadata } : {}),
    ...(escopo.legacy ? { legado: true } : {}),
    ...(escopo.quarantine ? { quarentena: true } : {}),
  };
  const payload = payloadRelevante(base);
  const payloadFingerprint = fingerprintPayload(payload);
  const fingerprint = texto(base.fingerprint, 255) || payloadFingerprint;
  const existente = chaveIdempotencia
    ? Object.values(store.lancamentos).find((item) => item.chaveIdempotencia === chaveIdempotencia && (!escopo.lojaId ? semLoja(item) : item.lojaId === escopo.lojaId))
    : null;
  if (existente) return conflitoIdempotencia(chaveIdempotencia, existente, fingerprint, payloadFingerprint);

  const snapshot = snapshotStore(store);
  const id = novoId(escopo.empresaId, 'fin');
  const lancamento = {
    id,
    ...base,
    fingerprint,
    payloadFingerprint,
    criadoEm: agora(),
    atualizadoEm: agora(),
  };
  return persistir(store, snapshot, () => {
    store.lancamentos[id] = lancamento;
  invalidarCacheFinanceiro();
    return serializar(lancamento);
  });
}

export function buscarLancamentoPorChave(empresaOuOpcoes, lojaOuChave, chaveOuOpcoes, opcoes = {}) {
  let empresaId; let lojaId; let chave; let extras;
  if (empresaOuOpcoes && typeof empresaOuOpcoes === 'object') {
    extras = empresaOuOpcoes;
    empresaId = extras.empresaId;
    lojaId = extras.lojaId;
    chave = extras.chaveIdempotencia ?? extras.idempotencyKey;
  } else {
    empresaId = empresaOuOpcoes;
    if (lojaOuChave && typeof lojaOuChave === 'object') {
      extras = lojaOuChave;
      lojaId = extras.lojaId;
      chave = extras.chaveIdempotencia ?? extras.idempotencyKey;
    } else if (chaveOuOpcoes && typeof chaveOuOpcoes === 'object') {
      extras = chaveOuOpcoes;
      if (extras.lojaId !== undefined) {
        lojaId = extras.lojaId;
        chave = extras.chaveIdempotencia ?? extras.idempotencyKey ?? lojaOuChave;
      } else {
        lojaId = lojaOuChave;
        chave = extras.chaveIdempotencia ?? extras.idempotencyKey;
      }
    } else {
      lojaId = chaveOuOpcoes === undefined ? '' : lojaOuChave;
      chave = chaveOuOpcoes === undefined ? lojaOuChave : chaveOuOpcoes;
      extras = opcoes || {};
    }
  }
  const escopo = exigeLeituraLoja(empresaId, lojaId, extras || {}, 'buscar lançamento por chave');
  const item = registrosEmpresa(escopo.empresaId).find((registro) => registro.chaveIdempotencia === texto(chave, 255)
    && (escopo.lojaId ? registro.lojaId === escopo.lojaId : semLoja(registro)));
  return item ? serializar(item) : null;
}

export function listarLancamentosPorOrigem(empresaOuOpcoes, origemOuLoja, origemOuOpcoes, opcoes = {}) {
  let empresaId; let origemId; let filtros;
  if (empresaOuOpcoes && typeof empresaOuOpcoes === 'object') {
    filtros = empresaOuOpcoes;
    empresaId = filtros.empresaId;
    origemId = filtros.origemId ?? filtros.origem;
  } else {
    empresaId = empresaOuOpcoes;
    if (origemOuLoja && typeof origemOuLoja === 'object') {
      filtros = origemOuLoja;
      origemId = filtros.origemId ?? filtros.origem;
    } else if (origemOuOpcoes && typeof origemOuOpcoes === 'object') {
      filtros = origemOuOpcoes;
      origemId = filtros.origemId ?? filtros.origem ?? origemOuLoja;
    } else if (origemOuOpcoes !== undefined) {
      filtros = { ...(opcoes || {}), lojaId: origemOuLoja };
      origemId = origemOuOpcoes;
    } else {
      filtros = opcoes || {};
      origemId = origemOuLoja;
    }
  }
  const escopo = exigeLeituraLoja(empresaId, filtros?.lojaId, filtros || {}, 'listar lançamentos por origem');
  const origem = texto(origemId, 180);
  return registrosEmpresa(escopo.empresaId)
    .filter((item) => (!escopo.lojaId ? semLoja(item) : item.lojaId === escopo.lojaId))
    .filter((item) => item.origemId === origem || item.origem === origem || item.referencia?.origemId === origem)
    .sort((a, b) => String(b.dataOperacao).localeCompare(String(a.dataOperacao)) || String(b.criadoEm).localeCompare(String(a.criadoEm)))
    .map(serializar);
}

// Invalida cache ao atualizar lançamento
invalidarCacheFinanceiro();
export function atualizarLancamento(empresaId, id, dados = {}, opcoes = {}) {
  const empresa = idEscopo(empresaId);
  let store = storeEmpresa(empresa);
  let lancamento = store.lancamentos[String(id)];
  let storeOrigem = store;
  let ehLegadoDino = false;

  if (!lancamento && saoEmpresasEquivalentes(empresa, DINO_EMPRESA_CANONICA)) {
    const outraEmpresa = empresa === DINO_EMPRESA_CANONICA ? DINO_EMPRESA_LEGADA : DINO_EMPRESA_CANONICA;
    const storeOutra = storeEmpresa(outraEmpresa);
    if (storeOutra.lancamentos[String(id)]) {
      lancamento = storeOutra.lancamentos[String(id)];
      storeOrigem = storeOutra;
      ehLegadoDino = true;
    }
  }

  if (!lancamento || !saoEmpresasEquivalentes(lancamento.empresaId, empresa)) return null;
  const lojaId = idEscopo(opcoes.lojaId || dados.lojaId);
  if (!podeAcessarLancamentoNaLoja(lojaId, lancamento.lojaId)) return null;
  if (lancamento.status === 'pago' && String(dados.status || '').toLowerCase() === 'cancelado') {
    throw new FinancialError('Lançamento pago é imutável; use reverterLancamento.', 'FINANCIAL_REVERSAL_REQUIRED', 409);
  }
  if (lancamento.automatico && !opcoes.permitirAutomatico) {
    const camposPermitidos = new Set(['status', 'pagoEm', 'meioPagamento', 'observacao', 'obs', 'lojaId']);
    if (Object.keys(dados).some((campo) => !camposPermitidos.has(campo))) throw new FinancialError('Lançamentos automáticos só podem ter status, pagamento ou observação atualizados.', 'FINANCIAL_AUTOMATIC_ENTRY', 400);
  }
  const snapshot = snapshotStore(store);
  return persistir(store, snapshot, () => {
    if (dados.tipo !== undefined) {
      const tipo = String(dados.tipo).toLowerCase();
      if (!TIPOS.has(tipo)) throw new FinancialError('Tipo financeiro inválido.', 'FINANCIAL_TYPE_INVALID', 400);
      lancamento.tipo = tipo;
    }
    if (dados.valor !== undefined) {
      const valor = valorMonetario(dados.valor);
      if (!Number.isFinite(valor) || valor <= 0) throw new FinancialError('Valor financeiro deve ser positivo.', 'FINANCIAL_VALUE_INVALID', 400);
      lancamento.valor = valor;
    }
    if (dados.categoria !== undefined) lancamento.categoria = texto(dados.categoria, 100) || 'Outros';
    if (dados.descricao !== undefined) lancamento.descricao = texto(dados.descricao, 240) || lancamento.descricao;
    if (dados.vencimento !== undefined) lancamento.vencimento = dataCurta(dados.vencimento);
    if (dados.meioPagamento !== undefined) lancamento.meioPagamento = texto(dados.meioPagamento, 40).toLowerCase() || null;
    if (dados.lojaId !== undefined) {
      const novaLoja = idEscopo(dados.lojaId);
      lancamento.lojaId = novaLoja || null;
    }
    if (dados.observacao !== undefined || dados.obs !== undefined) lancamento.observacao = texto(dados.observacao ?? dados.obs, 500);
    if (dados.referencia !== undefined) lancamento.referencia = normalizarReferencia(dados.referencia);
    if (dados.metadata !== undefined || dados.metadados !== undefined) lancamento.metadata = metadataSaneada(dados.metadata ?? dados.metadados);
    if (dados.status !== undefined) {
      const status = String(dados.status).toLowerCase();
      if (!STATUS.has(status)) throw new FinancialError('Status financeiro inválido.', 'FINANCIAL_STATUS_INVALID', 400);
      if (lancamento.status === 'pago' && status !== 'pago') throw new FinancialError('Lançamento pago é imutável; use reverterLancamento.', 'FINANCIAL_REVERSAL_REQUIRED', 409);
      lancamento.status = status;
      lancamento.pagoEm = status === 'pago' ? dataIso(dados.pagoEm || lancamento.pagoEm || agora()) : null;
    } else if (dados.pagoEm !== undefined) {
      lancamento.pagoEm = dados.pagoEm ? dataIso(dados.pagoEm) : null;
      if (lancamento.pagoEm) lancamento.status = 'pago';
    }
    lancamento.atualizadoEm = agora();

    // Se o lançamento era originário do cadastro legado da Dino, materializa também no cadastro canônico:
    if (ehLegadoDino && empresa === DINO_EMPRESA_CANONICA) {
      const canonico = {
        ...lancamento,
        empresaId: DINO_EMPRESA_CANONICA,
        lojaId: (!lancamento.lojaId || lancamento.lojaId === DINO_LOJA_LEGADA) ? DINO_LOJA_CANONICA : lancamento.lojaId,
      };
      delete canonico.somenteLeitura;
      delete canonico.fonteCadastro;
      store.lancamentos[String(id)] = canonico;
      return serializar(canonico);
    }

    return serializar(lancamento);
  });
}

invalidarCacheFinanceiro();
export function reverterLancamento({ empresaId, lojaId, lancamentoId, actionId, idempotencyKey, chaveIdempotencia, motivo, usuarioId, correlationId, confirmado, metadata } = {}) {
  const escopo = contexto(empresaId, lojaId, {}, {}, { lojaObrigatoria: true });
  const idOriginal = texto(lancamentoId, 180);
  const chave = texto(idempotencyKey ?? chaveIdempotencia, 255);
  const action = texto(actionId, 180);
  const razao = texto(motivo, 500);
  const usuario = texto(usuarioId, 180);
  if (!idOriginal) throw new FinancialError('lancamentoId é obrigatório para a reversão.', 'FINANCIAL_REVERSAL_INVALID', 400);
  if (!action) throw new FinancialError('actionId é obrigatório para a reversão.', 'FINANCIAL_REVERSAL_INVALID', 400);
  if (!chave) throw new FinancialError('idempotencyKey é obrigatório para a reversão.', 'FINANCIAL_REVERSAL_INVALID', 400);
  if (!razao) throw new FinancialError('motivo é obrigatório para a reversão.', 'FINANCIAL_REVERSAL_INVALID', 400);
  if (!usuario) throw new FinancialError('usuarioId é obrigatório para a reversão.', 'FINANCIAL_REVERSAL_INVALID', 400);
  if (confirmado !== true) throw new FinancialError('A reversão exige confirmação explícita.', 'FINANCIAL_REVERSAL_CONFIRMATION_REQUIRED', 409);
  const store = storeEmpresa(escopo.empresaId);
  const original = store.lancamentos[idOriginal];
  if (!original || original.empresaId !== escopo.empresaId || original.lojaId !== escopo.lojaId) throw new FinancialError('Lançamento financeiro original não encontrado no escopo da loja.', 'FINANCIAL_ENTRY_NOT_FOUND', 404);
  if (original.status !== 'pago') throw new FinancialError('Somente lançamentos pagos podem ser revertidos.', 'FINANCIAL_REVERSAL_STATUS_INVALID', 409);
  const payload = { lancamentoOriginalId: original.id, lojaId: escopo.lojaId, actionId: action, motivo: razao, usuarioId: usuario, metadata: metadataSaneada(metadata) || {} };
  const payloadFingerprint = fingerprintPayload(payload);
  const fingerprint = payloadFingerprint;
  const existentePorChave = Object.values(store.lancamentos).find((item) => item.chaveIdempotencia === chave && item.lojaId === escopo.lojaId);
  if (existentePorChave) {
    if (existentePorChave.lancamentoOriginalId !== original.id || existentePorChave.reversalFingerprint !== fingerprint) throw new FinancialError('A chave idempotente da reversão já foi usada com dados divergentes.', 'FINANCIAL_IDEMPOTENCY_CONFLICT', 409, { idempotencyKey: chave, lancamentoId: existentePorChave.id });
    return serializar(existentePorChave);
  }
  const reversaoExistente = Object.values(store.lancamentos).find((item) => item.lancamentoOriginalId === original.id);
  if (reversaoExistente) throw new FinancialError('O lançamento original já possui uma reversão.', 'FINANCIAL_REVERSAL_ALREADY_EXISTS', 409, { lancamentoId: original.id, reversalId: reversaoExistente.id });
  const snapshot = snapshotStore(store);
  const id = novoId(escopo.empresaId, 'fin-rev');
  const agoraIso = agora();
  const referencias = normalizarReferencia({ ...(original.referencia || {}), cobrancaId: original.cobrancaId, agendamentoId: original.agendamentoId, valeId: original.valeId, origemId: original.origemId, actionId: action, lancamentoOriginalId: original.id, reversalId: id });
  const reversao = {
    id,
    empresaId: escopo.empresaId,
    lojaId: escopo.lojaId,
    tipo: original.tipo === 'receita' ? 'despesa' : 'receita',
    categoria: original.categoria,
    descricao: `Reversão de ${original.descricao}`.slice(0, 240),
    valor: original.valor,
    valorEfeito: original.tipo === 'receita' ? -original.valor : original.valor,
    moeda: original.moeda || MOEDA,
    origem: 'reversao',
    origemId: original.origemId || original.id,
    status: 'pago',
    vencimento: dataCurta(agoraIso),
    dataOperacao: agoraIso,
    pagoEm: agoraIso,
    meioPagamento: original.meioPagamento || null,
    observacao: razao,
    referencia: referencias,
    usuario: usuario,
    usuarioId: usuario,
    automatico: false,
    chaveIdempotencia: chave,
    actionId: action,
    correlationId: texto(correlationId, 180) || null,
    fingerprint,
    payloadFingerprint,
    reversalFingerprint: fingerprint,
    lancamentoOriginalId: original.id,
    reversalId: id,
    confirmado: true,
    metadata: { ...(metadataSaneada(metadata) || {}), motivo: razao, lancamentoOriginalId: original.id, reversalId: id },
    criadoEm: agoraIso,
    atualizadoEm: agoraIso,
  };
  return persistir(store, snapshot, () => {
    store.lancamentos[id] = reversao;
  invalidarCacheFinanceiro();
    return serializar(reversao);
  });
}

export function cancelarLancamento(empresaId, id, usuarioOuOpcoes = 'sistema@kytto.local', opcoes = {}) {
  const extras = typeof usuarioOuOpcoes === 'object' ? usuarioOuOpcoes : { ...opcoes, usuarioId: usuarioOuOpcoes };
  const empresa = idEscopo(empresaId);
  const lancamento = obterLancamento(empresa, id);
  if (!lancamento) return null;
  if (lancamento.status === 'pago') {
    if (extras.confirmado === true && extras.lojaId && extras.actionId && (extras.idempotencyKey || extras.chaveIdempotencia)) {
      return reverterLancamento({ empresaId: empresa, lojaId: extras.lojaId, lancamentoId: id, actionId: extras.actionId, idempotencyKey: extras.idempotencyKey || extras.chaveIdempotencia, motivo: extras.motivo || 'Cancelamento autorizado', usuarioId: extras.usuarioId || extras.usuario || 'sistema', correlationId: extras.correlationId, confirmado: true, metadata: extras.metadata });
    }
    throw new FinancialError('Lançamento pago não pode ser cancelado; use reverterLancamento.', 'FINANCIAL_REVERSAL_REQUIRED', 409);
  }
  return atualizarLancamento(empresa, id, { status: 'cancelado', observacao: `Cancelado por ${texto(extras.usuarioId || extras.usuario || usuarioOuOpcoes || 'sistema@kytto.local', 120)}` }, { ...extras, permitirAutomatico: true, lojaId: extras.lojaId || lancamento.lojaId, legacy: semLoja(lancamento) });
}

// Extrato JSON da Dino gravado sob o id legado (histórico Avec de 22/10 e o que foi
// lançado entre 23 e 24/10, quando o ERP apontou para lá). Entra na leitura da Dino
// como somente leitura, sem duplicar lançamentos que já existam no cadastro canônico.

function lancamentosLegadosDaDino(proprios) {
  const legado = db().financeiroKytto?.empresas?.[DINO_EMPRESA_LEGADA]?.lancamentos;
  if (!legado) return [];
  const ids = new Set(proprios.map((item) => item.id));
  const chaves = new Set(proprios.map((item) => item.chaveIdempotencia).filter(Boolean));
  const impressoes = new Set(proprios.map((item) => item.fingerprint).filter(Boolean));
  return Object.values(legado)
    .filter((item) => item && item.empresaId === DINO_EMPRESA_LEGADA)
    .filter((item) => !ids.has(item.id) && !(item.chaveIdempotencia && chaves.has(item.chaveIdempotencia)) && !(item.fingerprint && impressoes.has(item.fingerprint)))
    .map((item) => ({
      ...item,
      empresaId: DINO_EMPRESA_CANONICA,
      lojaId: item.lojaId === DINO_LOJA_LEGADA ? DINO_LOJA_CANONICA : item.lojaId,
      somenteLeitura: true,
      fonteCadastro: 'legado',
    }));
}

export function listarLancamentos(empresaId, filtros = {}) {
  const empresa = idEscopo(empresaId);
  const store = storeEmpresa(empresa);
  const proprios = Object.values(store.lancamentos).filter((item) => item.empresaId === empresa);
  const base = empresa === DINO_EMPRESA_CANONICA && filtros.semCadastroLegado !== true ? [...proprios, ...lancamentosLegadosDaDino(proprios)] : proprios;
  const tipo = texto(filtros.tipo, 20).toLowerCase();
  const status = texto(filtros.status, 20).toLowerCase();
  const origem = texto(filtros.origem, 60).toLowerCase();
  const categoria = texto(filtros.categoria, 100);
  const de = texto(filtros.de, 10);
  const ate = texto(filtros.ate, 10);
  const lojaId = idEscopo(filtros.lojaId);
  const incluirQuarentena = filtros.incluirQuarentena === true || filtros.quarantine === true || filtros.quarentena === true;
  return base
    .filter((item) => incluirQuarentena || !semLoja(item))
    .filter((item) => !lojaId || saoLojasEquivalentes(lojaId, item.lojaId) || (incluirQuarentena && semLoja(item)))
    .filter((item) => !tipo || item.tipo === tipo)
    .filter((item) => !status || item.status === status)
    .filter((item) => !origem || item.origem === origem)
    .filter((item) => !categoria || item.categoria === categoria)
    .filter((item) => !de || item.vencimento >= de)
    .filter((item) => !ate || item.vencimento <= ate)
    .sort((a, b) => String(b.dataOperacao).localeCompare(String(a.dataOperacao)) || String(b.criadoEm).localeCompare(String(a.criadoEm)))
    .map(serializar);
}

export function registrarVendaComanda(empresaId, { comanda, pagamentos = [], contasReceber = [], usuario, dataOperacao, lojaId, legacy = false, quarantine = false } = {}) {
  if (!comanda?.id) throw new FinancialError('Comanda é obrigatória para registrar o recebimento.', 'FINANCIAL_REFERENCE_REQUIRED', 400);
  const loja = lojaId || comanda.lojaId;
  const contasPorIndice = new Map((contasReceber || []).map((conta, indice) => [indice, conta]));
  const registros = [];
  (pagamentos || []).forEach((pagamento, indice) => {
    const meioPagamento = texto(pagamento?.meio, 40).toLowerCase() || 'dinheiro';
    const conta = meioPagamento === 'conta' ? contasPorIndice.get(registros.filter((registro) => registro.meioPagamento === 'conta').length) : null;
    const pendente = meioPagamento === 'conta';
    registros.push(registrarLancamento(empresaId, {
      tipo: 'receita', categoria: 'Bar/Lanchonete', descricao: `Comanda ${comanda.id} — ${comanda.nome || comanda.mesa || 'Atendimento'} (${meioPagamento})`, valor: pagamento?.valor,
      origem: 'comanda', status: pendente ? 'pendente' : 'pago', vencimento: pendente ? conta?.dataVencimento : dataOperacao, dataOperacao, pagoEm: pendente ? null : dataOperacao,
      meioPagamento, lojaId: loja, referencia: { comandaId: comanda.id, contaReceberId: conta?.id, clienteId: conta?.clienteId }, usuario, automatico: true,
      chaveIdempotencia: `comanda:${comanda.id}:pagamento:${pagamento?.id || indice}`, legacy: legacy || comanda.legacy === true, quarantine: quarantine || comanda.quarantine === true,
    }));
  });
  return registros;
}

export function registrarEntradaEstoque(empresaId, { produtoId, produtoNome, qtd, custo, valorTotal, fornecedorId, documento, usuario, dataOperacao, meioPagamento, status = 'pendente', movimentoId, lojaId, legacy = false, quarantine = false } = {}) {
  const quantidade = Number(qtd || 0);
  const custoUnitario = Number(custo || 0);
  const valor = valorTotal === undefined ? valorMonetario(quantidade * custoUnitario) : valorMonetario(valorTotal);
  if (!produtoId || quantidade <= 0 || !Number.isFinite(custoUnitario) || custoUnitario <= 0 || valor <= 0) return null;
  return registrarLancamento(empresaId, {
    tipo: 'despesa', categoria: 'Alimentação/Bebidas', descricao: `Entrada de estoque — ${texto(produtoNome || produtoId, 160)} (${quantidade} un.)`, valor, origem: 'estoque', status,
    vencimento: dataOperacao, dataOperacao, pagoEm: status === 'pago' ? dataOperacao : null, meioPagamento, lojaId, referencia: { produtoId, fornecedorId, documentoId: documento, movimentoId }, usuario, automatico: true,
    chaveIdempotencia: movimentoId ? `estoque:${movimentoId}` : '', legacy, quarantine,
  });
}

export function sincronizarContaReceber(empresaId, conta, { usuario, meioPagamento, lojaId, legacy = false, quarantine = false } = {}) {
  if (!conta?.id) return null;
  const store = storeEmpresa(empresaId);
  const contaLoja = lojaId || conta.lojaId;
  const existente = Object.values(store.lancamentos).find((item) => item.referencia?.contaReceberId === conta.id && (!contaLoja || item.lojaId === contaLoja));
  const statusConta = conta.status === 'paga' ? 'pago' : 'pendente';
  if (existente) return atualizarLancamento(empresaId, existente.id, { status: statusConta, pagoEm: conta.dataPagamento || null, vencimento: conta.dataVencimento, meioPagamento: meioPagamento || existente.meioPagamento, observacao: conta.observacao || existente.observacao }, { permitirAutomatico: true, lojaId: contaLoja, legacy, quarantine });
  return registrarLancamento(empresaId, {
    tipo: 'receita', categoria: 'Bar/Lanchonete', descricao: conta.descricao || `Conta a receber ${conta.id}`, valor: conta.valor, origem: 'contas_receber', status: statusConta,
    vencimento: conta.dataVencimento, dataOperacao: conta.criadoEm, pagoEm: conta.dataPagamento, meioPagamento: meioPagamento || 'conta', lojaId: contaLoja,
    referencia: { contaReceberId: conta.id, clienteId: conta.clienteId }, usuario, automatico: true, chaveIdempotencia: `conta-receber:${conta.id}`, legacy, quarantine,
  });
}

function parseResumo(empresaOuOpcoes, opcoes = {}) {
  if (empresaOuOpcoes && typeof empresaOuOpcoes === 'object') return { empresaId: empresaOuOpcoes.empresaId, opcoes: empresaOuOpcoes };
  return { empresaId: empresaOuOpcoes, opcoes: opcoes || {} };
}

export function resumoFinanceiro(empresaOuOpcoes, opcoes = {}) {
  const parsed = parseResumo(empresaOuOpcoes, opcoes);
  const filtros = parsed.opcoes || {};
  const escopo = exigeLeituraLoja(parsed.empresaId, filtros.lojaId, filtros, 'resumo financeiro');
  const hoje = dataCurta(filtros.hoje || agora());
  const mesAtual = String(hoje).slice(0, 7);

  const dataInicio = filtros.dataInicio ? dataCurta(filtros.dataInicio) : (filtros.de ? dataCurta(filtros.de) : null);
  const dataFim = filtros.dataFim ? dataCurta(filtros.dataFim) : (filtros.ate ? dataCurta(filtros.ate) : null);

  // Verificação de cache rápido em memória
  const cacheKey = `res:${_cacheVersaoFinanceiro}:${escopo.empresaId}:${escopo.lojaId || ''}:${dataInicio || ''}:${dataFim || ''}:${hoje}`;
  const cached = _cacheMemoriaFinanceiro.get(cacheKey);
  const agoraMs = Date.now();
  if (cached && agoraMs - cached.ts < TTL_CACHE_FINANCEIRO_MS) {
    return { ...cached.data };
  }

  const lancamentos = listarLancamentos(escopo.empresaId, { ...filtros, lojaId: escopo.lojaId });

  // Single-pass O(N) aggregation sem arrays intermediários (alta performance e economia de memória no Render)
  let totalReceitas = 0;
  let totalDespesas = 0;
  let recMes = 0;
  let despMes = 0;
  let recPeriodo = 0;
  let despPeriodo = 0;
  let aReceber = 0;
  let aPagar = 0;
  let aReceberPeriodo = 0;
  let aPagarPeriodo = 0;
  let recBar = 0;
  let inadimplentes = 0;

  for (let i = 0; i < lancamentos.length; i++) {
    const item = lancamentos[i];
    if (item.status === 'cancelado') continue;
    const valor = Number(item.valor || 0);
    const refDataPago = String(item.pagoEm || item.dataOperacao || item.vencimento || '').slice(0, 10);
    const refDataVenc = String(item.vencimento || '').slice(0, 10);

    const noPeriodoPago = dataInicio && dataFim
      ? (refDataPago >= dataInicio && refDataPago <= dataFim)
      : (refDataPago.slice(0, 7) === mesAtual);

    const noPeriodoVenc = dataInicio && dataFim
      ? (refDataVenc >= dataInicio && refDataVenc <= dataFim)
      : (refDataVenc.slice(0, 7) === mesAtual);

    if (item.tipo === 'receita' || (item.metadata?.historicoAvec === true && item.tipo === 'receita') || (item.origem === 'avec-import-financeiro-20261022' && item.tipo === 'receita') || (item.origem === 'avec-import-20261022' && item.tipo === 'receita')) {
      if (item.status === 'pago') {
        totalReceitas += valor;
        if (refDataPago.slice(0, 7) === mesAtual) {
          recMes += valor;
        }
        if (noPeriodoPago) {
          recPeriodo += valor;
        }
        if (item.origem === 'comanda' || item.origem === 'barbearia_cobranca') {
          recBar += valor;
        }
      } else if (item.status === 'pendente') {
        aReceber += valor;
        if (noPeriodoVenc) {
          aReceberPeriodo += valor;
        }
        if (item.vencimento < hoje) {
          inadimplentes += 1;
        }
      }
    } else if (item.tipo === 'despesa' || (item.metadata?.historicoAvec === true && item.tipo === 'despesa') || (item.origem === 'avec-import-financeiro-20261022' && item.tipo === 'despesa') || (item.origem === 'avec-import-20261022' && item.tipo === 'despesa')) {
      if (item.status === 'pago') {
        totalDespesas += valor;
        if (refDataPago.slice(0, 7) === mesAtual) {
          despMes += valor;
        }
        if (noPeriodoPago) {
          despPeriodo += valor;
        }
      } else if (item.status === 'pendente') {
        aPagar += valor;
        if (noPeriodoVenc) {
          aPagarPeriodo += valor;
        }
      }
    }
  }

  const recFinal = dataInicio && dataFim ? recPeriodo : recMes;
  const despFinal = dataInicio && dataFim ? despPeriodo : despMes;
  const resultadoPeriodo = valorMonetario(recFinal - despFinal);
  const margemPeriodo = recFinal > 0 ? Number(((resultadoPeriodo / recFinal) * 100).toFixed(1)) : 0;

  const resultado = {
    empresaId: escopo.empresaId,
    lojaId: escopo.lojaId || null,
    hoje,
    mesAtual,
    dataInicio: dataInicio || null,
    dataFim: dataFim || null,
    saldo: valorMonetario(totalReceitas - totalDespesas),
    totalReceitas: valorMonetario(totalReceitas),
    totalDespesas: valorMonetario(totalDespesas),
    recBar: valorMonetario(recBar),
    recMes: valorMonetario(recMes),
    despMes: valorMonetario(despMes),
    // Valores específicos do período filtrado:
    recPeriodo: valorMonetario(recFinal),
    despPeriodo: valorMonetario(despFinal),
    resultadoPeriodo,
    margemPeriodo,
    aReceberPeriodo: valorMonetario(dataInicio && dataFim ? aReceberPeriodo : aReceber),
    aPagarPeriodo: valorMonetario(dataInicio && dataFim ? aPagarPeriodo : aPagar),
    aReceber: valorMonetario(aReceber),
    aPagar: valorMonetario(aPagar),
    inadimplentes,
    mensRecebidas: 0,
    mensPendentes: 0,
    mensVencidas: 0,
    inscRec: 0,
    quarentenaCount: contagemQuarentena(escopo.empresaId),
  };

  _cacheMemoriaFinanceiro.set(cacheKey, { ts: agoraMs, data: resultado });
  return resultado;
}
function parseFechamento(empresaOuOpcoes, data, usuario, opcoes) {
  if (empresaOuOpcoes && typeof empresaOuOpcoes === 'object') return { empresaId: empresaOuOpcoes.empresaId, data: empresaOuOpcoes.data || empresaOuOpcoes.hoje, usuario: empresaOuOpcoes.usuario || empresaOuOpcoes.usuarioId, opcoes: empresaOuOpcoes };
  if (data && typeof data === 'object') return { empresaId: empresaOuOpcoes, data: data.data || data.hoje, usuario: data.usuario || data.usuarioId, opcoes: data };
  return { empresaId: empresaOuOpcoes, data, usuario: typeof usuario === 'string' ? usuario : usuario?.usuario || usuario?.usuarioId, opcoes: (usuario && typeof usuario === 'object' ? usuario : opcoes) || {} };
}

export function fecharDia(empresaOuOpcoes, data, usuario = 'sistema@kytto.local', opcoes = {}) {
  const parsed = parseFechamento(empresaOuOpcoes, data, usuario, opcoes);
  const filtros = parsed.opcoes || {};
  const escopo = exigeLeituraLoja(parsed.empresaId, filtros.lojaId, filtros, 'fechamento diário');
  const store = storeEmpresa(escopo.empresaId);
  const dia = dataCurta(parsed.data || agora());
  const chaveFechamento = `${escopo.lojaId || '__legacy__'}:${dia}`;
  const existente = store.fechamentos[chaveFechamento] || (escopo.legacy ? store.fechamentos[dia] : null);
  if (existente) return { ...clone(existente), criadoAgora: false, quarentenaCount: contagemQuarentena(escopo.empresaId) };
  const lancamentos = listarLancamentos(escopo.empresaId, { lojaId: escopo.lojaId, incluirQuarentena: false }).filter((item) => new Date(item.dataOperacao).toLocaleString("sv", { timeZone: process.env.KYTTO_TIMEZONE || "America/Cuiaba" }).slice(0, 10) === dia && item.status !== 'cancelado');
  const recebimentos = lancamentos.filter((item) => item.tipo === 'receita' && item.status === 'pago').reduce((soma, item) => soma + item.valor, 0);
  const pagamentos = lancamentos.filter((item) => item.tipo === 'despesa' && item.status === 'pago').reduce((soma, item) => soma + item.valor, 0);
  const pendenteReceber = lancamentos.filter((item) => item.tipo === 'receita' && item.status === 'pendente').reduce((soma, item) => soma + item.valor, 0);
  const pendentePagar = lancamentos.filter((item) => item.tipo === 'despesa' && item.status === 'pendente').reduce((soma, item) => soma + item.valor, 0);
  const fechamento = {
    id: `fin-fec-${escopo.empresaId}-${escopo.lojaId || 'legacy'}-${dia}`, empresaId: escopo.empresaId, lojaId: escopo.lojaId || null, data: dia,
    recebimentos: valorMonetario(recebimentos), pagamentos: valorMonetario(pagamentos), pendenteReceber: valorMonetario(pendenteReceber), pendentePagar: valorMonetario(pendentePagar), saldoDia: valorMonetario(recebimentos - pagamentos),
    totalLancamentos: lancamentos.length, quarentenaCount: contagemQuarentena(escopo.empresaId), responsavel: texto(parsed.usuario || 'sistema@kytto.local', 120), criadoEm: agora(),
    ...(filtros.resumoOperacao ? { resumoOperacao: filtros.resumoOperacao } : {}),
  };
  const snapshot = snapshotStore(store);
  return persistir(store, snapshot, () => {
    store.fechamentos[chaveFechamento] = fechamento;
    return { ...clone(fechamento), criadoAgora: true };
  });
}

export function listarFechamentos(empresaId, opcoes = {}) {
  const empresa = idEscopo(empresaId);
  const lojaId = idEscopo(opcoes.lojaId);
  return Object.values(storeEmpresa(empresa).fechamentos)
    .filter((item) => item.empresaId === empresa && (!lojaId || item.lojaId === lojaId))
    .sort((a, b) => String(b.data).localeCompare(String(a.data)))
    .map((item) => clone(item));
}

export function fluxoFinanceiro(empresaId, meses = 12, dataReferencia = agora(), opcoes = {}) {
  let quantidade = meses; let referenciaData = dataReferencia; let filtros = opcoes || {};
  if (meses && typeof meses === 'object') { filtros = meses; quantidade = filtros.meses || 12; referenciaData = filtros.dataReferencia || filtros.data || agora(); }
  const escopo = exigeLeituraLoja(empresaId, filtros.lojaId, filtros, 'fluxo financeiro');
  const referencia = new Date(referenciaData || agora());
  const periodo = [];
  for (let i = Math.max(1, Number(quantidade) || 12) - 1; i >= 0; i -= 1) {
    const data = new Date(referencia.getFullYear(), referencia.getMonth() - i, 1);
    periodo.push(`${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`);
  }
  const lancamentos = listarLancamentos(escopo.empresaId, { lojaId: escopo.lojaId });

  // Agrupamento em única passagem O(N) com hash-map O(1) eliminando buscas aninhadas
  const mesesMap = Object.create(null);
  for (let i = 0; i < lancamentos.length; i++) {
    const item = lancamentos[i];
    if (item.status !== 'pago' || !item.pagoEm) continue;
    const mes = item.pagoEm.slice(0, 7);
    let entry = mesesMap[mes];
    if (!entry) {
      entry = mesesMap[mes] = { receitas: 0, despesas: 0 };
    }
    const val = Number(item.valor || 0);
    if (item.tipo === 'receita') entry.receitas += val;
    else if (item.tipo === 'despesa') entry.despesas += val;
  }

  return periodo.map((mes) => {
    const entry = mesesMap[mes];
    const receitas = entry ? entry.receitas : 0;
    const despesas = entry ? entry.despesas : 0;
    return { mes, receitas: valorMonetario(receitas), despesas: valorMonetario(despesas), saldo: valorMonetario(receitas - despesas) };
  });
}

// Demonstrativo do Resultado do Exercício Gerencial (DRE Gerencial)
export function dreGerencial(empresaOuOpcoes, opcoes = {}) {
  const parsed = parseResumo(empresaOuOpcoes, opcoes);
  const filtros = parsed.opcoes || {};
  const escopo = exigeLeituraLoja(parsed.empresaId, filtros.lojaId, filtros, 'DRE gerencial');
  const hoje = dataCurta(filtros.hoje || agora());
  const mesAlvo = String(filtros.mes || hoje).slice(0, 7);
  const dataInicio = filtros.dataInicio ? dataCurta(filtros.dataInicio) : (filtros.de ? dataCurta(filtros.de) : null);
  const dataFim = filtros.dataFim ? dataCurta(filtros.dataFim) : (filtros.ate ? dataCurta(filtros.ate) : null);

  // Verificação de cache para DRE
  const cacheKey = `dre:${_cacheVersaoFinanceiro}:${escopo.empresaId}:${escopo.lojaId || ''}:${dataInicio || ''}:${dataFim || ''}:${mesAlvo}`;
  const cached = _cacheMemoriaFinanceiro.get(cacheKey);
  const agoraMs = Date.now();
  if (cached && agoraMs - cached.ts < TTL_CACHE_FINANCEIRO_MS) {
    return { ...cached.data };
  }

  const lancamentos = listarLancamentos(escopo.empresaId, { ...filtros, lojaId: escopo.lojaId });

  let receitaServicos = 0;
  let receitaPlanos = 0;
  let receitaRevenda = 0;
  let receitaOutras = 0;
  let deducoesTaxas = 0;
  let deducoesEstornos = 0;
  let custoComissoes = 0;
  let custoInsumos = 0;
  const despesasOperacionaisPorCategoria = Object.create(null);
  let totalDespesasFixas = 0;

  for (let i = 0; i < lancamentos.length; i++) {
    const item = lancamentos[i];
    if (item.status === 'cancelado') continue;
    const refData = String(item.pagoEm || item.dataOperacao || item.vencimento || '').slice(0, 10);
    if (!refData) continue;
    if (dataInicio && dataFim) {
      if (refData < dataInicio || refData > dataFim) continue;
    } else {
      if (!refData.startsWith(mesAlvo)) continue;
    }

    const valor = Number(item.valor || 0);

    if (item.tipo === 'receita' || (item.metadata?.historicoAvec === true && item.tipo === 'receita') || (item.origem === 'avec-import-financeiro-20261022' && item.tipo === 'receita') || (item.origem === 'avec-import-20261022' && item.tipo === 'receita')) {
      if (item.status !== 'pago') continue;
      const origem = item.origem || '';
      const cat = (item.categoria || '').toLowerCase();
      if (origem === 'comanda' || origem === 'barbearia_atendimento' || cat.includes('serviço')) {
        receitaServicos += valor;
      } else if (cat.includes('plano') || cat.includes('mensalidade') || cat.includes('assinatura') || cat.includes('clube')) {
        receitaPlanos += valor;
      } else if (origem === 'barbearia_revenda' || origem === 'revenda' || cat.includes('produto') || cat.includes('revenda')) {
        receitaRevenda += valor;
      } else {
        receitaOutras += valor;
      }
    } else if (item.tipo === 'despesa' || (item.metadata?.historicoAvec === true && item.tipo === 'despesa') || (item.origem === 'avec-import-financeiro-20261022' && item.tipo === 'despesa') || (item.origem === 'avec-import-20261022' && item.tipo === 'despesa')) {
      if (item.status !== 'pago') continue;
      const cat = item.categoria || 'Outros';
      const catLower = cat.toLowerCase();
      if (catLower.includes('taxa') || catLower.includes('cartão') || catLower.includes('maquininha')) {
        deducoesTaxas += valor;
      } else if (catLower.includes('comissão') || catLower.includes('repasse') || catLower.includes('barbeiro')) {
        custoComissoes += valor;
      } else if (catLower.includes('insumo') || catLower.includes('lavatório') || catLower.includes('consumo')) {
        custoInsumos += valor;
      } else {
        despesasOperacionaisPorCategoria[cat] = (despesasOperacionaisPorCategoria[cat] || 0) + valor;
        totalDespesasFixas += valor;
      }
    }
  }

  const receitaBruta = valorMonetario(receitaServicos + receitaPlanos + receitaRevenda + receitaOutras);
  const totalDeducoes = valorMonetario(deducoesTaxas + deducoesEstornos);
  const receitaLiquida = valorMonetario(receitaBruta - totalDeducoes);
  const totalCustosVariaveis = valorMonetario(custoComissoes + custoInsumos);
  const margemContribuicao = valorMonetario(receitaLiquida - totalCustosVariaveis);
  const margemContribuicaoPercentual = receitaBruta > 0 ? Number(((margemContribuicao / receitaBruta) * 100).toFixed(1)) : 0;
  const totalDespesasOperacionais = valorMonetario(totalDespesasFixas);
  const ebitda = valorMonetario(margemContribuicao - totalDespesasOperacionais);
  const resultadoLiquido = ebitda;
  const margemLiquidaPercentual = receitaBruta > 0 ? Number(((resultadoLiquido / receitaBruta) * 100).toFixed(1)) : 0;

  const rankingCategorias = Object.entries(despesasOperacionaisPorCategoria)
    .map(([categoria, valor]) => ({
      categoria,
      valor: valorMonetario(valor),
      percentual: totalDespesasOperacionais > 0 ? Number(((valor / totalDespesasOperacionais) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.valor - a.valor);

  const resultado = {
    empresaId: escopo.empresaId,
    lojaId: escopo.lojaId || null,
    mes: mesAlvo,
    hoje,
    dataInicio: dataInicio || `${mesAlvo}-01`,
    dataFim: dataFim || `${mesAlvo}-31`,
    customizado: Boolean(dataInicio && dataFim),
    receitaBruta,
    totalDeducoes,
    receitaLiquida,
    totalCustosVariaveis,
    margemContribuicao,
    margemContribuicaoPercentual,
    totalDespesasOperacionais,
    ebitda,
    resultadoLiquido,
    margemLiquidaPercentual,
    rankingCategorias,
    detalhesReceita: {
      servicos: valorMonetario(receitaServicos),
      planos: valorMonetario(receitaPlanos),
      revenda: valorMonetario(receitaRevenda),
      outras: valorMonetario(receitaOutras),
    },
    detalhesCustos: {
      comissoes: valorMonetario(custoComissoes),
      insumos: valorMonetario(custoInsumos),
      taxas: valorMonetario(deducoesTaxas),
    },
  };

  _cacheMemoriaFinanceiro.set(cacheKey, { ts: agoraMs, data: resultado });
  return resultado;
}
