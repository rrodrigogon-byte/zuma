import { customerToken } from './dino-grafo.js';

const RELATIONS = new Set(['COMPROU', 'AGENDOU', 'ATENDIDO_POR', 'INDICOU', 'PERGUNTOU', 'INTERESSE']);
const STATUSES = new Set(['ok', 'limitado', 'indisponivel', 'desconhecido']);
const AREAS = new Set(['clientes', 'operacao', 'financeiro', 'commerce', 'estoque', 'oportunidades', 'geral']);
const DAY_MS = 24 * 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PHONE = /(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?\d[\d\s().-]{7,}\d/;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu;
const CPF_TEXT = /(^|[^\d])(\d{3}\.?\d{3}\.?\d{3}-?\d{2})(?!\d)/g;
const CNPJ_TEXT = /(^|[^\d])(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})(?!\d)/g;
const UUID_TEXT = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;
const PHONE_TEXT = /(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?\d[\d\s().-]{7,}\d/g;

const RELATION_LABELS = Object.freeze({
  COMPROU: 'comprou',
  AGENDOU: 'agendou',
  ATENDIDO_POR: 'atendido por',
  INDICOU: 'indicou',
  PERGUNTOU: 'perguntou sobre',
  INTERESSE: 'tem interesse em',
});

const ORDER_STATUS_LABELS = Object.freeze({
  paid: 'Pago',
  processing: 'Em processamento',
  ready: 'Pronto',
  shipped: 'Enviado',
  ready_for_pickup: 'Pronto para retirada',
  delivered: 'Entregue',
  picked_up: 'Retirado',
  completed: 'Concluído',
  pending_payment: 'Pagamento pendente',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
  partially_refunded: 'Parcialmente reembolsado',
});

const list = (value) => (Array.isArray(value) ? value : []);
const finite = (value) => value !== null && value !== undefined && typeof value !== 'boolean'
  && !(typeof value === 'string' && !value.trim()) && Number.isFinite(Number(value));
const numberOrNull = (value) => (finite(value) ? Number(value) : null);
const stockOrNull = (value) => {
  const parsed = numberOrNull(value);
  return parsed !== null && parsed >= 0 ? parsed : null;
};

function asDate(value) {
  const date = value instanceof Date ? value : new Date(value || '');
  return Number.isNaN(date.valueOf()) ? null : date;
}

function iso(value) {
  const date = asDate(value);
  return date ? date.toISOString() : null;
}

function normalizeStatus(value, fallback = 'indisponivel') {
  const candidate = value === 'unavailable' ? 'indisponivel' : String(value || '');
  return STATUSES.has(candidate) ? candidate : fallback;
}

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
}

export function redactNetworkText(value, fallback = '') {
  const text = String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240);
  if (!text) return fallback;
  return text
    .replace(EMAIL, 'e-mail oculto')
    .replace(CNPJ_TEXT, '$1documento oculto')
    .replace(CPF_TEXT, '$1documento oculto')
    .replace(UUID_TEXT, 'identificador oculto')
    .replace(PHONE_TEXT, 'contato oculto');
}

function safeLabel(value, fallback) {
  const text = String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
  const phoneMatch = PHONE.exec(text);
  if (!text || UUID.test(text) || (phoneMatch && phoneMatch[0] === text) || /^(?:commerce|erp|order|pedido|local|cliente|customer)[_:/-]/i.test(text)) return fallback;
  return redactNetworkText(text, fallback);
}

function safeUnitLabel(value) {
  return safeLabel(value, 'Unidade ativa');
}

function hasValidScope(scope) {
  return UUID.test(String(scope?.empresaId || '').trim()) && UUID.test(String(scope?.lojaId || '').trim());
}

export function scopedCustomerRef(scope, key) {
  const empresaId = String(scope?.empresaId || '').trim().toLowerCase();
  const lojaId = String(scope?.lojaId || '').trim().toLowerCase();
  if (!UUID.test(empresaId) || !UUID.test(lojaId) || key === null || key === undefined || String(key) === '') return null;
  return customerToken(`business-network|${empresaId}|${lojaId}|${String(key)}`);
}

function hash(value) {
  let first = 2166136261;
  let second = 5381;
  for (const character of String(value)) {
    first ^= character.charCodeAt(0);
    first = Math.imul(first, 16777619) >>> 0;
    second = (Math.imul(second, 33) ^ character.charCodeAt(0)) >>> 0;
  }
  return `${first.toString(36)}${second.toString(36)}`;
}

function entityId(type, key, scope = null) {
  const empresaId = String(scope?.empresaId || '').trim().toLowerCase();
  const lojaId = String(scope?.lojaId || '').trim().toLowerCase();
  if (!UUID.test(empresaId) || !UUID.test(lojaId) || key === null || key === undefined || String(key) === '') return null;
  const namespace = `${empresaId}|${lojaId}`;
  return `${type}:${hash(`${namespace}|${type}|${key}`)}`;
}

function readMap(map, key) {
  if (map instanceof Map) return map.get(key);
  if (map && typeof map === 'object') return map[key];
  return undefined;
}

function sourceStatus(qualitySources, graphSources, name, hasData = false) {
  const direct = qualitySources?.[name] || qualitySources?.sources?.[name] || graphSources?.quality?.fontes?.[name];
  if (direct && typeof direct === 'object') return normalizeStatus(direct.status, hasData ? 'ok' : 'indisponivel');
  if (typeof direct === 'string') return normalizeStatus(direct, hasData ? 'ok' : 'indisponivel');
  return hasData ? 'ok' : 'indisponivel';
}

function combineStatuses(values) {
  const states = values.map((value) => normalizeStatus(value, 'desconhecido'));
  if (!states.length || states.every((state) => state === 'desconhecido')) return 'desconhecido';
  if (states.every((state) => state === 'indisponivel')) return 'indisponivel';
  if (states.some((state) => ['limitado', 'indisponivel', 'desconhecido'].includes(state))) return 'limitado';
  return 'ok';
}

function relationshipSourceStatus(source, qualitySources, graphSources, graphStatus) {
  const name = String(source || '').trim();
  if (!name || name === 'graph' || name === 'grafo') return graphStatus;
  const graphName = ({ orders: 'pedidos', facts: 'memoria' })[name] || name;
  const direct = graphSources?.quality?.fontes?.[graphName]
    || qualitySources?.[name]
    || qualitySources?.sources?.[name]
    || graphSources?.quality?.fontes?.[name];
  if (direct && typeof direct === 'object') return normalizeStatus(direct.status, graphStatus);
  if (typeof direct === 'string') return normalizeStatus(direct, graphStatus);
  return graphStatus;
}

function sourceList(value) {
  const values = Array.isArray(value) ? value : [value];
  return [...new Set(values.filter((item) => item !== null && item !== undefined && String(item).trim() !== '')
    .map((item) => safeLabel(item, 'Fonte')))].filter((item) => item !== 'Fonte');
}

function riskSeverity(status, value, thresholds = {}) {
  if (status !== 'ok' || value === null || value === undefined) return 'unknown';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 'normal';
  if (thresholds.high !== undefined && numeric >= thresholds.high) return 'high';
  if (numeric > 0) return thresholds.medium ? 'medium' : 'info';
  return 'normal';
}

function relationshipCategory(value) {
  const category = normalizeKey(value);
  if (category.includes('servico')) return 'servico';
  if (category.includes('produto')) return 'produto';
  if (category.includes('familia')) return 'familia';
  return 'outro';
}

function relationshipCategoryLabel(category) {
  return ({ produto: 'produto', servico: 'serviço', familia: 'família olfativa', outro: 'categoria' })[category] || 'categoria';
}

function buildWindows({ period = {}, now = new Date(), edgeDates = [], stockAt = null } = {}) {
  const end = asDate(period.to) || asDate(now) || new Date();
  const start = asDate(period.from) || new Date(end.valueOf() - (Number(period.days) || 30) * DAY_MS);
  const days = Number.isFinite(Number(period.days)) ? Number(period.days) : Math.round((end - start) / DAY_MS);
  const dates = edgeDates.filter(Boolean).map((value) => new Date(value).valueOf()).filter(Number.isFinite);
  const relationshipFrom = dates.length ? new Date(Math.min(...dates)).toISOString() : null;
  const relationshipTo = dates.length ? new Date(Math.max(...dates)).toISOString() : null;
  const snapshot = iso(stockAt);
  return {
    relationshipHistory: {
      kind: 'relationship_history', from: relationshipFrom, to: relationshipTo, maxDays: 365,
      label: 'Relações datadas nos últimos 365 dias',
    },
    undatedRelationships: {
      kind: 'undated_relationships', from: null, to: null,
      label: 'Relações sem data verificável; contagem temporal desconhecida',
    },
    selectedPeriod: {
      kind: 'selected_period', from: start.toISOString(), to: end.toISOString(), days,
      label: `Período selecionado de ${days} dias`,
    },
    currentOverduePosition: {
      kind: 'current_overdue_position', asOf: end.toISOString(),
      label: 'Posição atual de recebíveis vencidos na data da consulta',
    },
    stockSnapshot: {
      kind: 'current_stock_snapshot', capturedAt: snapshot,
      label: snapshot ? 'Data informada para atualização do estoque' : 'Saldo atual; horário global de atualização não informado',
    },
  };
}

function graphCustomers(graphModel, customerKeys, scope) {
  const source = graphModel?.customers instanceof Map ? graphModel.customers : new Map();
  const selected = new Map();
  for (const key of customerKeys) {
    if (!scopedCustomerRef(scope, String(key))) continue;
    selected.set(String(key), source.get(key) || {});
  }
  return [...selected.entries()].sort((a, b) => String(scopedCustomerRef(scope, a[0])).localeCompare(String(scopedCustomerRef(scope, b[0]))));
}

function endpoint(raw, context) {
  const text = String(raw || '');
  const separator = text.indexOf(':');
  if (separator <= 0) return null;
  const prefix = text.slice(0, separator);
  const key = text.slice(separator + 1);
  if (!key) return null;
  if (prefix === 'c') {
    const node = context.customerNodes.get(key);
    return node ? { id: node.id, kind: 'customer', key } : null;
  }
  if (prefix === 'p') {
    const mapped = readMap(context.graphModel?.productNames, key);
    const label = safeLabel(mapped, 'Produto');
    const id = context.entityId('product', key);
    context.addEntityNode({ id, type: 'product', area: 'commerce', label, entityKey: key, priority: 58 });
    return { id, kind: 'product', key };
  }
  if (prefix === 's') {
    const mappedName = context.serviceNames.get(normalizeKey(key));
    const label = safeLabel(mappedName || key, 'Serviço');
    const id = context.entityId('service', mappedName || key);
    context.addEntityNode({ id, type: 'service', area: 'operacao', label, entityKey: mappedName || key, priority: 57 });
    return { id, kind: 'service', key };
  }
  if (prefix === 'f') {
    const label = `Profissional ${context.professionalRank.get(key) || 1}`;
    const id = context.entityId('professional', key);
    context.addEntityNode({ id, type: 'professional', area: 'operacao', label, entityKey: key, priority: 56 });
    return { id, kind: 'professional', key };
  }
  if (prefix === 'i') {
    const category = context.interestCategory(key, context.currentCustomerKey, context.currentRelation);
    const interestKey = `${context.currentRelation}|${category}`;
    const id = context.entityId('interest', interestKey);
    context.addEntityNode({
      id, type: 'interest', area: 'oportunidades', label: `${context.currentRelation === 'PERGUNTOU' ? 'Perguntas sobre' : 'Interesse em'} ${relationshipCategoryLabel(category)}`,
      entityKey: interestKey, priority: 52,
    });
    return { id, kind: 'interest', key: interestKey };
  }
  return null;
}

function addMetricNode(context, {
  id, area, type = 'metric', label, value, detail, source, status, severity = 'normal', window,
  priority = 120, valueFormat = 'number',
}) {
  const actualStatus = normalizeStatus(status, 'indisponivel');
  const actualValue = actualStatus === 'ok' ? (value === undefined ? null : value) : null;
  context.addNode({
    id: `metric:${id}`, type, area, label: safeLabel(label, 'Indicador'), value: actualValue,
    detail: safeLabel(detail, 'Indicador agregado.'), status: actualStatus,
    severity: actualStatus === 'ok' ? severity : 'unknown', sources: sourceList(source), window, valueFormat,
  }, priority);
}

function orderStatusSeverity(status) {
  if (['cancelled', 'refunded', 'partially_refunded'].includes(status)) return 'high';
  if (status === 'pending_payment') return 'medium';
  return 'normal';
}

/**
 * Transforma somente dados já carregados em uma rede executiva tipada.
 * A função não faz I/O e não expõe chaves internas de clientes, Commerce, ERP,
 * pedidos ou fatos de memória. `weight` conta ocorrências de uma relação.
 */
export function buildBusinessNetwork({
  graphModel = {}, graphSources = {}, metrics = {}, offers = [], quality = {}, period = {},
  now = new Date(), businessLabel = 'Unidade ativa', scope = null, maxNodes = 180, maxLinks = 500,
} = {}) {
  if (!hasValidScope(scope)) {
    const windows = buildWindows({ period, now: asDate(now) || new Date(), edgeDates: [], stockAt: null });
    const summary = {
      nodesTotal: 0, nodesVisible: 0, linksTotal: 0, linksVisible: 0,
      omittedNodes: 0, omittedLinks: 0, omittedObservedLinks: 0, omittedStructuralLinks: 0,
      truncated: false, windows,
    };
    return { nodes: [], links: [], summary, windows };
  }
  const qualitySources = quality?.sources || quality || {};
  const nowDate = asDate(now) || new Date();
  const nowTime = nowDate.valueOf();
  const cutoffTime = nowTime - 365 * DAY_MS;
  const candidateEdges = list(graphModel?.edges).filter((edge) => RELATIONS.has(String(edge?.rel || '')));
  const graphEdges = candidateEdges.filter((edge) => {
    const observed = iso(edge?.at);
    if (!observed) return true;
    const timestamp = new Date(observed).valueOf();
    return Number.isFinite(timestamp) && timestamp >= cutoffTime && timestamp <= nowTime;
  });
  const customerKeys = new Set();
  const professionalKeys = new Set();
  for (const edge of graphEdges) {
    for (const value of [edge?.from, edge?.to]) {
      const text = String(value || '');
      if (text.startsWith('c:') && text.slice(2)) customerKeys.add(text.slice(2));
      if (text.startsWith('f:') && text.slice(2)) professionalKeys.add(text.slice(2));
    }
  }
  const edgeDates = graphEdges.map((edge) => iso(edge?.at)).filter(Boolean);
  const stockInput = graphSources?.commerce?.stockCapturedAt || graphSources?.commerce?.capturedAt
    || graphSources?.stockCapturedAt || null;
  const windows = buildWindows({ period, now: nowDate, edgeDates, stockAt: stockInput });
  const graphStatus = sourceStatus(qualitySources, graphSources, 'graph', Boolean(graphEdges.length || customerKeys.size));
  const graphTemporalStatus = graphStatus;
  const nodes = new Map();
  const internal = new Map();
  const links = new Map();
  const customerNodes = new Map();
  const professionalRank = new Map([...professionalKeys].sort().map((key, index) => [key, index + 1]));
  const datedNodeIds = new Set();
  const undatedNodeIds = new Set();
  const customerEntries = graphCustomers(graphModel, customerKeys, scope);
  const customerRank = new Map(customerEntries.map(([key], index) => [String(key), index + 1]));
  const serviceNames = new Map();
  for (const [key, value] of (graphModel?.serviceNames instanceof Map ? graphModel.serviceNames.entries() : [])) {
    serviceNames.set(normalizeKey(key), value);
    serviceNames.set(normalizeKey(value), value);
  }

  const addNode = (node, priority = 50) => {
    if (!node || !node.id || !AREAS.has(node.area)) return null;
    const existing = nodes.get(node.id);
    if (existing) {
      if (node.value !== null && node.value !== undefined && (existing.value === null || existing.value === undefined)) existing.value = node.value;
      if (node.status === 'ok' && existing.status !== 'ok') existing.status = node.status;
      if (Array.isArray(node.sources)) existing.sources = [...new Set([...(existing.sources || []), ...node.sources])].sort();
      internal.get(node.id).priority = Math.max(internal.get(node.id).priority, priority);
      return existing;
    }
    const normalized = {
      id: String(node.id), type: String(node.type || 'metric'), area: node.area,
      label: safeLabel(node.label, 'Indicador'), value: node.value ?? null,
      valueFormat: ['currency', 'percent'].includes(node.valueFormat) ? node.valueFormat : 'number',
      detail: safeLabel(node.detail, 'Indicador agregado.'),
      status: normalizeStatus(node.status, 'indisponivel'), severity: String(node.severity || 'unknown'),
      sources: [...new Set(Array.isArray(node.sources) ? node.sources.map(String) : [])].sort(),
      window: node.window || windows.selectedPeriod,
    };
    if (node.customerRef) normalized.customerRef = String(node.customerRef);
    nodes.set(normalized.id, normalized);
    internal.set(normalized.id, { priority, degree: 0, relationOccurrences: 0, sources: new Set() });
    return normalized;
  };

  const addEntityNode = ({ id, type, area, label, entityKey, priority }) => {
    const node = addNode({
      id, type, area, label, value: null, detail: 'Relacionamentos observados no histórico disponível.',
      status: graphTemporalStatus, severity: graphTemporalStatus === 'ok' ? 'normal' : 'unknown',
      sources: ['graph'], window: windows.relationshipHistory,
    }, priority);
    if (node && !internal.get(id).entityKey) internal.get(id).entityKey = entityKey;
    return node;
  };

  const context = {
    graphModel, addNode, addEntityNode, customerNodes, serviceNames,
    entityId: (type, key) => entityId(type, key, scope), professionalRank,
    currentCustomerKey: null, currentRelation: null,
    interestCategory: (raw, customerKey, relation) => {
      const customer = graphModel?.customers instanceof Map ? graphModel.customers.get(customerKey) : null;
      const target = normalizeKey(raw);
      const matches = list(customer?.interests).filter((interest) => normalizeKey(interest?.valor || interest?.texto) === target);
      const match = matches.sort((a, b) => relationshipCategory(a?.categoria).localeCompare(relationshipCategory(b?.categoria)))[0];
      if (match) return relationshipCategory(match.categoria);
      return relation === 'INTERESSE' ? 'servico' : 'produto';
    },
  };

  addNode({
    id: 'business', type: 'business', area: 'geral', label: safeUnitLabel(businessLabel), value: null,
    detail: 'Unidade ativa com dados escopados.', status: 'ok', severity: 'normal', sources: ['context'], window: windows.selectedPeriod,
  }, 1000);

  for (const [key] of customerEntries) {
    const textKey = String(key);
    const customerRef = scopedCustomerRef(scope, textKey);
    if (!customerRef) continue;
    const id = entityId('customer', customerRef, scope);
    const customer = graphModel?.customers instanceof Map ? graphModel.customers.get(key) || {} : {};
    const visits = list(customer?.visits).length;
    const node = addNode({
      id, type: 'customer', area: 'clientes', label: `Cliente ${customerRank.get(textKey) || 0}`,
      value: null,
      detail: 'Identidade anonimizada; referência opaca disponível para o ego graph.',
      status: graphTemporalStatus,
      severity: graphTemporalStatus !== 'ok' ? 'unknown' : customer?.interval && customer?.daysSince > customer.interval * 1.5 ? 'high' : 'normal',
      sources: ['graph'], window: windows.relationshipHistory,
      customerRef,
    }, 90);
    customerNodes.set(textKey, node);
  }

  const aggregateLink = (from, to, relation, at, rawSources) => {
    const observed = iso(at);
    const window = observed ? windows.relationshipHistory : windows.undatedRelationships;
    const sourceNames = (Array.isArray(rawSources) ? rawSources : [rawSources]).filter(Boolean).map(String);
    if (!sourceNames.length) sourceNames.push('grafo');
    const edgeSources = sourceList(sourceNames);
    const evidenceStatus = combineStatuses(sourceNames.map((source) => relationshipSourceStatus(source, qualitySources, graphSources, graphStatus)));
    const status = observed ? evidenceStatus : combineStatuses([evidenceStatus, 'limitado']);
    const key = `${from.id}\u0000${relation}\u0000${to.id}\u0000${window.kind}`;
    if (!edgeSources.length) edgeSources.push('grafo');
    let aggregate = links.get(key);
    if (!aggregate) {
      aggregate = { from: from.id, to: to.id, relation, weight: 0, dates: [], sources: new Set(), status, window, dated: Boolean(observed) };
      links.set(key, aggregate);
    } else aggregate.status = combineStatuses([aggregate.status, status]);
    aggregate.weight += 1;
    for (const source of edgeSources) aggregate.sources.add(source);
    if (observed) aggregate.dates.push(observed);
    (observed ? datedNodeIds : undatedNodeIds).add(from.id);
    (observed ? datedNodeIds : undatedNodeIds).add(to.id);
    for (const id of [from.id, to.id]) {
      const metadata = internal.get(id);
      if (metadata) for (const source of edgeSources) metadata.sources.add(source);
    }
  };

  for (const edge of graphEdges) {
    const relation = String(edge.rel);
    const fromText = String(edge.from || '');
    const fromKey = fromText.startsWith('c:') ? fromText.slice(2) : null;
    context.currentCustomerKey = fromKey;
    context.currentRelation = relation;
    const from = endpoint(edge.from, context);
    const to = endpoint(edge.to, context);
    if (!from || !to) continue;
    aggregateLink(from, to, relation, edge.at, edge.sources || edge.source || 'grafo');
  }

  const allLinks = [...links.values()].map((aggregate) => {
    const dates = aggregate.dates.slice().sort();
    const link = {
      from: aggregate.from, to: aggregate.to, relation: aggregate.relation,
      label: RELATION_LABELS[aggregate.relation], weight: aggregate.status === 'ok' ? aggregate.weight : null,
      status: aggregate.status, sources: [...aggregate.sources].sort(), window: aggregate.window,
    };
    if (dates.length) { link.observedFrom = dates[0]; link.observedTo = dates[dates.length - 1]; }
    const fromInternal = internal.get(link.from);
    const toInternal = internal.get(link.to);
    if (fromInternal) { fromInternal.degree += 1; if (aggregate.dated && aggregate.status === 'ok') fromInternal.relationOccurrences += aggregate.weight; }
    if (toInternal) { toInternal.degree += 1; if (aggregate.dated && aggregate.status === 'ok') toInternal.relationOccurrences += aggregate.weight; }
    return link;
  });

  const addStructuralLink = ({ from, to, label, status, sources, window }) => {
    if (!nodes.has(from) || !nodes.has(to)) return null;
    const link = {
      from, to, relation: 'AGRUPA', label: safeLabel(label, 'Agrupa'), weight: null,
      structural: true, status: normalizeStatus(status, 'desconhecido'),
      sources: sourceList(sources), window: window || windows.selectedPeriod,
    };
    allLinks.push(link);
    const fromInternal = internal.get(from);
    const toInternal = internal.get(to);
    if (fromInternal) fromInternal.degree += 1;
    if (toInternal) toInternal.degree += 1;
    return link;
  };

  for (const [id, metadata] of internal.entries()) {
    const node = nodes.get(id);
    if (node && ['customer', 'product', 'service', 'professional', 'interest'].includes(node.type)) {
      const relationSources = [...(metadata.sources || [])].filter((source) => source !== 'grafo').sort();
      if (relationSources.length) node.sources = relationSources;
      const hasUndatedRelations = undatedNodeIds.has(id);
      const onlyUndatedRelations = hasUndatedRelations && !datedNodeIds.has(id);
      const evidenceStatus = combineStatuses(relationSources.length
        ? relationSources.map((source) => relationshipSourceStatus(source, qualitySources, graphSources, graphStatus))
        : [graphStatus]);
      node.status = hasUndatedRelations ? combineStatuses([evidenceStatus, 'limitado']) : evidenceStatus;
      node.severity = node.status === 'ok' ? node.severity : 'unknown';
      node.window = onlyUndatedRelations ? windows.undatedRelationships : windows.relationshipHistory;
      node.value = evidenceStatus === 'ok' && datedNodeIds.has(id) && !hasUndatedRelations ? metadata.relationOccurrences : null;
    }
  }

  const customersMetrics = metrics.customers || {};
  const operations = metrics.operations || {};
  const finance = metrics.finance || {};
  const commerce = metrics.commerce || {};
  const inventory = metrics.inventory || {};
  const offersMetric = Array.isArray(metrics.offers) ? metrics.offers : [];
  const rowsByStatus = list(graphSources?.commerce?.ordersByStatus || commerce.ordersByStatus);
  const inventoryRows = list(graphSources?.commerce?.inventory || graphSources?.inventory || []);
  const offersRows = list(offers).length ? list(offers) : offersMetric;
  const statusFor = (name, value, hasData = value !== null && value !== undefined) => sourceStatus(qualitySources, graphSources, name, hasData);
  const valueFor = (name, value, status = statusFor(name, value)) => status === 'ok' ? (value === undefined ? null : value) : null;

  addMetricNode({ addNode }, {
    id: 'customers-total', area: 'clientes', label: 'Clientes', value: valueFor('graph', customersMetrics.total),
    detail: 'Base agregada observada no histórico relacional disponível, de até 365 dias.', source: 'graph', status: statusFor('graph', customersMetrics.total),
    severity: riskSeverity(statusFor('graph', customersMetrics.atRisk), customersMetrics.atRisk, { medium: true }), window: windows.relationshipHistory,
  });
  addMetricNode({ addNode }, {
    id: 'customers-at-risk', area: 'clientes', label: 'Clientes além do intervalo habitual', value: valueFor('graph', customersMetrics.atRisk),
    detail: 'Clientes acima de 1,5 vez o intervalo habitual, calculado no histórico relacional de até 365 dias.', source: 'graph', status: statusFor('graph', customersMetrics.atRisk),
    severity: riskSeverity(statusFor('graph', customersMetrics.atRisk), customersMetrics.atRisk, { high: 10, medium: true }), window: windows.relationshipHistory,
  });
  addMetricNode({ addNode }, {
    id: 'operations-total', area: 'operacao', label: 'Agendamentos', value: valueFor('appointments', operations.total),
    detail: 'Agendamentos observados no período selecionado.', source: 'appointments', status: statusFor('appointments', operations.total),
    severity: 'normal', window: windows.selectedPeriod,
  });
  addMetricNode({ addNode }, {
    id: 'operations-no-show', area: 'operacao', label: 'Faltas na agenda', value: valueFor('appointments', operations.noShow),
    detail: 'Agendamentos marcados como falta no período selecionado.', source: 'appointments', status: statusFor('appointments', operations.noShow),
    severity: riskSeverity(statusFor('appointments', operations.noShow), operations.noShow, { high: 5, medium: true }), window: windows.selectedPeriod,
  });
  addMetricNode({ addNode }, {
    id: 'operations-cancelled', area: 'operacao', label: 'Cancelamentos na agenda', value: valueFor('appointments', operations.cancelled),
    detail: 'Agendamentos cancelados no período selecionado.', source: 'appointments', status: statusFor('appointments', operations.cancelled),
    severity: riskSeverity(statusFor('appointments', operations.cancelled), operations.cancelled, { high: 5, medium: true }), window: windows.selectedPeriod,
  });
  addMetricNode({ addNode }, {
    id: 'operations-attendance-rate', area: 'operacao', label: 'Comparecimento', value: valueFor('appointments', operations.attendanceRate),
    detail: 'Percentual de concluídos ÷ concluídos + faltas; cancelamentos ficam fora do denominador.',
    source: 'appointments', status: statusFor('appointments', operations.attendanceRate), window: windows.selectedPeriod,
    valueFormat: 'percent',
  });
  addMetricNode({ addNode }, {
    id: 'operations-cancellation-rate', area: 'operacao', label: 'Taxa de cancelamento', value: valueFor('appointments', operations.cancellationRate),
    detail: 'Percentual informado pelo resolvedor canônico da agenda.',
    source: 'appointments', status: statusFor('appointments', operations.cancellationRate), window: windows.selectedPeriod,
    valueFormat: 'percent',
  });
  addMetricNode({ addNode }, {
    id: 'finance-income', area: 'financeiro', label: 'Receitas pagas', value: valueFor('finance', finance.paidIncome),
    detail: 'Receitas com pagamento confirmado no período selecionado.', source: 'finance', status: statusFor('finance', finance.paidIncome),
    severity: 'normal', window: windows.selectedPeriod, valueFormat: 'currency',
  });
  addMetricNode({ addNode }, {
    id: 'finance-expenses', area: 'financeiro', label: 'Despesas pagas', value: valueFor('finance', finance.paidExpenses),
    detail: 'Despesas com pagamento confirmado no período selecionado.', source: 'finance', status: statusFor('finance', finance.paidExpenses),
    severity: 'normal', window: windows.selectedPeriod, valueFormat: 'currency',
  });
  addMetricNode({ addNode }, {
    id: 'finance-ledger-net', area: 'financeiro', label: 'Saldo do ledger', value: valueFor('finance', finance.net),
    detail: 'Receita menos despesas pagas registradas; não representa lucro contábil.', source: 'finance', status: statusFor('finance', finance.net),
    severity: 'normal', window: windows.selectedPeriod, valueFormat: 'currency',
  });
  addMetricNode({ addNode }, {
    id: 'finance-overdue', area: 'financeiro', label: 'Receitas vencidas', value: valueFor('receivables', finance.overdueCount),
    detail: 'Posição atual de lançamentos de receita pendentes e vencidos na data da consulta; não é limitada ao período selecionado.', source: 'receivables', status: statusFor('receivables', finance.overdueCount),
    severity: riskSeverity(statusFor('receivables', finance.overdueCount), finance.overdueCount, { high: 1, medium: true }), window: windows.currentOverduePosition,
  });
  addMetricNode({ addNode }, {
    id: 'finance-overdue-amount', area: 'financeiro', label: 'Valor pendente vencido', value: valueFor('receivables', finance.overdueAmount),
    detail: `${finance.overdueCount ?? '—'} lançamento(s) pendente(s), vencidos na data da consulta; valor informado no ledger e fora do recorte 30/90.`,
    source: 'receivables', status: statusFor('receivables', finance.overdueAmount),
    severity: riskSeverity(statusFor('receivables', finance.overdueCount), finance.overdueCount, { high: 1, medium: true }),
    window: windows.currentOverduePosition, valueFormat: 'currency',
  });
  addMetricNode({ addNode }, {
    id: 'cash-discrepancies', area: 'financeiro', label: 'Divergências de caixa', value: valueFor('cash', finance.cashDiscrepancyCount),
    detail: 'Fechamentos com divergência observada no período selecionado.', source: 'cash', status: statusFor('cash', finance.cashDiscrepancyCount),
    severity: riskSeverity(statusFor('cash', finance.cashDiscrepancyCount), finance.cashDiscrepancyCount, { high: 1, medium: true }), window: windows.selectedPeriod,
  });
  addMetricNode({ addNode }, {
    id: 'cash-discrepancy-gross', area: 'financeiro', label: 'Soma absoluta das diferenças', value: valueFor('cash', finance.cashDiscrepancyGross),
    detail: 'Soma dos valores absolutos dos fechamentos; não é o saldo líquido.', source: 'cash', status: statusFor('cash', finance.cashDiscrepancyGross),
    severity: riskSeverity(statusFor('cash', finance.cashDiscrepancyCount), finance.cashDiscrepancyCount, { high: 1, medium: true }),
    window: windows.selectedPeriod, valueFormat: 'currency',
  });
  addMetricNode({ addNode }, {
    id: 'cash-discrepancy-net', area: 'financeiro', label: 'Saldo líquido das diferenças', value: valueFor('cash', finance.cashDiscrepancyNet),
    detail: 'Soma com sinais das diferenças; divergências opostas podem se cancelar.', source: 'cash', status: statusFor('cash', finance.cashDiscrepancyNet),
    severity: 'normal', window: windows.selectedPeriod, valueFormat: 'currency',
  });
  addMetricNode({ addNode }, {
    id: 'orders-total', area: 'commerce', label: 'Pedidos', value: valueFor('orders', commerce.ordersTotal),
    detail: 'Pedidos observados no período selecionado.', source: 'orders', status: statusFor('orders', commerce.ordersTotal),
    severity: 'normal', window: windows.selectedPeriod,
  });
  addMetricNode({ addNode }, {
    id: 'payments-captured', area: 'commerce', label: 'Transações capturadas', value: valueFor('payments', commerce.capturedTransactions),
    detail: 'Transações capturadas no período selecionado.', source: 'payments', status: statusFor('payments', commerce.capturedTransactions),
    severity: 'normal', window: windows.selectedPeriod,
  });
  addMetricNode({ addNode }, {
    id: 'payments-captured-amount', area: 'commerce', label: 'Valor capturado', value: valueFor('payments', commerce.capturedAmount),
    detail: 'Valor de pagamentos com captura confirmada; não é faturamento líquido de estornos.',
    source: 'payments', status: statusFor('payments', commerce.capturedAmount),
    severity: 'normal', window: windows.selectedPeriod, valueFormat: 'currency',
  });
  addMetricNode({ addNode }, {
    id: 'inventory-products', area: 'estoque', label: 'Produtos em estoque', value: valueFor('inventory', inventory.products),
    detail: 'Produtos com saldo observado no snapshot atual.', source: 'inventory', status: statusFor('inventory', inventory.products),
    severity: riskSeverity(statusFor('inventory', inventory.lowStock), inventory.lowStock, { high: 10, medium: true }), window: windows.stockSnapshot,
  });
  addMetricNode({ addNode }, {
    id: 'inventory-low-stock', area: 'estoque', label: 'Produtos com estoque baixo', value: valueFor('inventory', inventory.lowStock),
    detail: 'Produtos abaixo do mínimo ou esgotados no snapshot atual.', source: 'inventory', status: statusFor('inventory', inventory.lowStock),
    severity: riskSeverity(statusFor('inventory', inventory.lowStock), inventory.lowStock, { high: 1, medium: true }), window: windows.stockSnapshot,
  });
  const offersStatus = qualitySources?.offers
    ? statusFor('offers', offersRows.length)
    : (offersRows.length ? graphStatus : sourceStatus(qualitySources, graphSources, 'offers', false));
  addMetricNode({ addNode }, {
    id: 'offers-total', area: 'oportunidades', label: 'Oportunidades agregadas', value: valueFor('offers', customersMetrics.customersWithOffers, offersStatus),
    detail: 'Clientes com oferta sugerida pelas regras atuais a partir do histórico relacional disponível, de até 365 dias; não é probabilidade.', source: 'offers', status: offersStatus,
    severity: offersStatus === 'ok' ? 'info' : 'unknown', window: windows.relationshipHistory,
  });

  for (const row of rowsByStatus) {
    const rawStatus = String(row?.status || '').toLowerCase();
    const key = Object.hasOwn(ORDER_STATUS_LABELS, rawStatus) ? rawStatus : 'other';
    const label = ORDER_STATUS_LABELS[rawStatus] || 'Outro status de pedido';
    const count = numberOrNull(row?.total ?? row?.count);
    const status = statusFor('orders', count);
    addMetricNode({ addNode }, {
      id: `order-status-${key}`, area: 'commerce', type: 'order_status', label, value: valueFor('orders', count, status),
      detail: 'Quantidade de pedidos por status no período selecionado.', source: 'orders', status,
      severity: status === 'ok' ? orderStatusSeverity(rawStatus) : 'unknown', window: windows.selectedPeriod, priority: 115,
    });
  }

  const seenInventory = new Set();
  for (const row of inventoryRows) {
    const label = safeLabel(row?.name || row?.nome, 'Produto');
    const id = entityId('inventory', `${label}|${row?.origem || ''}|${row?.id || ''}`, scope);
    if (seenInventory.has(id)) continue;
    seenInventory.add(id);
    const local = row?.origem === 'balcao' || String(row?.id || '').startsWith('local:');
    const source = local ? 'localInventory' : 'inventory';
    const rawAvailable = row?.available ?? row?.estoque;
    const sourceStatusValue = statusFor(source, rawAvailable);
    const available = stockOrNull(rawAvailable);
    const minimum = stockOrNull(row?.minimum ?? row?.minimo);
    const rowStatus = sourceStatusValue === 'ok' && available === null ? 'limitado' : sourceStatusValue;
    const updatedAt = iso(row?.updatedAt ?? row?.updated_at);
    const productWindow = {
      ...windows.stockSnapshot,
      capturedAt: updatedAt,
      label: updatedAt ? 'Saldo atual; atualização deste produto' : 'Saldo atual; horário de atualização do produto não informado',
    };
    const severity = rowStatus !== 'ok' || available === null ? 'unknown'
      : available <= 0 ? 'high' : minimum !== null && available <= minimum ? 'medium' : 'normal';
    addNode({
      id, type: 'inventory', area: 'estoque', label, value: valueFor(source, available, rowStatus),
      detail: rowStatus === 'ok'
        ? `Saldo ${available === null ? 'não informado' : available}; mínimo ${minimum === null ? 'não informado' : minimum}. Snapshot de estoque, não contagem de vendas.`
        : 'Cobertura de estoque limitada ou indisponível; saldo e mínimo não são apresentados.', status: rowStatus,
      severity, sources: [source], window: productWindow,
    }, 61);
    const rawProductId = String(row?.id || '');
    if (rawProductId) {
      const productKey = rawProductId.startsWith('local:') || rawProductId.startsWith('commerce:')
        ? rawProductId : `${local ? 'local' : 'commerce'}:${rawProductId}`;
      const productNode = nodes.get(entityId('product', productKey, scope));
      if (productNode) addStructuralLink({
        from: id, to: productNode.id, label: 'Mesmo produto, ID confirmado',
        status: combineStatuses([rowStatus, graphTemporalStatus]),
        sources: [source, 'graph'], window: productWindow,
      });
    }
  }

  for (const row of offersRows) {
    const type = normalizeKey(row?.type || row?.tipo) === 'servico' ? 'serviço' : 'produto';
    const label = safeLabel(row?.name || row?.nome, 'Oferta agregada');
    const count = numberOrNull(row?.count);
    const id = entityId('offer', `${type}|${label}`, scope);
    addNode({
      id, type: 'offer', area: 'oportunidades', label, value: valueFor('offers', count, offersStatus),
      detail: `Oferta agregada por ${type}; clientes elegíveis com base no histórico relacional disponível, de até 365 dias.`, status: offersStatus,
      severity: offersStatus === 'ok' ? 'info' : 'unknown', sources: ['offers'], window: windows.relationshipHistory,
    }, 64);
  }

  const financeStatus = combineStatuses([
    statusFor('finance', finance.paidIncome), statusFor('cash', finance.cashDiscrepancyCount),
  ]);
  const commerceStatus = combineStatuses([
    statusFor('orders', commerce.confirmedOrders ?? commerce.ordersTotal), statusFor('payments', commerce.capturedTransactions),
  ]);
  const inventoryStatus = combineStatuses([
    statusFor('inventory', inventory.products), statusFor('localInventory', inventory.products),
  ]);
  const offerHubStatus = combineStatuses([offersStatus, graphTemporalStatus]);
  const hubSpecs = [
    { area: 'clientes', label: 'Clientes', value: customersMetrics.total, status: graphTemporalStatus, sources: ['graph'], window: windows.relationshipHistory, detail: 'Entidades de cliente anonimizadas e relações observadas no histórico datado.' },
    { area: 'operacao', label: 'Operação', value: operations.total, status: statusFor('appointments', operations.total), sources: ['appointments'], window: windows.selectedPeriod, detail: 'Agenda e eventos operacionais observados no período selecionado.' },
    { area: 'financeiro', label: 'Financeiro e caixa', value: finance.paidIncome, status: financeStatus, sources: ['finance', 'cash'], window: windows.selectedPeriod, detail: 'Receitas e diferenças de caixa com cobertura identificada.' },
    { area: 'commerce', label: 'Commerce', value: commerce.confirmedOrders ?? commerce.ordersTotal, status: commerceStatus, sources: ['orders', 'payments'], window: windows.selectedPeriod, detail: 'Pedidos confirmados e transações capturadas; demais estados permanecem separados.' },
    { area: 'estoque', label: 'Estoque', value: inventory.lowStock, status: inventoryStatus, sources: ['inventory', 'localInventory'], window: windows.stockSnapshot, detail: 'Saldos e mínimos observados no snapshot atual.' },
    { area: 'oportunidades', label: 'Oportunidades', value: customersMetrics.customersWithOffers, status: offerHubStatus, sources: ['offers', 'graph'], window: windows.relationshipHistory, detail: 'Ofertas por regras observáveis aplicadas ao histórico relacional disponível, de até 365 dias; não é probabilidade de conversão.' },
  ];
  for (const spec of hubSpecs) {
    const hub = addNode({
      id: `hub:${spec.area}`, type: 'hub', area: spec.area, label: spec.label,
      value: spec.status === 'ok' ? (spec.value ?? null) : null,
      detail: spec.detail, status: spec.status,
      severity: spec.status === 'ok' ? 'normal' : 'unknown', sources: spec.sources, window: spec.window,
    }, 130);
    if (!hub) continue;
    addStructuralLink({ from: 'business', to: hub.id, label: 'Área de negócio', status: spec.status, sources: spec.sources, window: spec.window });
    const children = [...nodes.values()].filter((node) => node.area === spec.area && node.id !== hub.id && node.type !== 'hub');
    for (const child of children) {
      addStructuralLink({ from: hub.id, to: child.id, label: 'Agrupa entidade', status: combineStatuses([spec.status, child.status]), sources: [...spec.sources, ...(child.sources || [])], window: child.window });
    }
  }

  const nodeLimit = Math.max(1, Math.floor(Number(maxNodes) || 180));
  const linkLimit = Math.max(1, Math.floor(Number(maxLinks) || 500));
  const allNodes = [...nodes.values()];
  const nodeRank = (left, right) => {
    const a = internal.get(left.id) || {};
    const b = internal.get(right.id) || {};
    const aConnected = a.degree > 0 ? 1 : 0;
    const bConnected = b.degree > 0 ? 1 : 0;
    return (left.id === 'business' ? -1 : right.id === 'business' ? 1 : 0)
      || (b.priority || 0) - (a.priority || 0)
      || bConnected - aConnected
      || (b.degree || 0) - (a.degree || 0)
      || String(left.area).localeCompare(String(right.area))
      || String(left.type).localeCompare(String(right.type))
      || String(left.label).localeCompare(String(right.label), 'pt-BR')
      || String(left.id).localeCompare(String(right.id));
  };
  const rankedNodes = allNodes.slice().sort(nodeRank);
  const nodeById = new Map(rankedNodes.map((node) => [node.id, node]));
  const selectedNodeIds = new Set();
  const isCoreNode = (node) => node?.id === 'business' || node?.type === 'hub' || node?.type === 'metric'
    || (internal.get(node?.id)?.priority || 0) >= 115;
  for (const node of rankedNodes) {
    if (isCoreNode(node) && selectedNodeIds.size < nodeLimit) selectedNodeIds.add(node.id);
  }
  const observedCandidates = allLinks.filter((link) => !link.structural && nodeById.has(link.from) && nodeById.has(link.to))
    .slice().sort((left, right) => (Number(right.weight) || 0) - (Number(left.weight) || 0)
      || left.relation.localeCompare(right.relation) || left.from.localeCompare(right.from) || left.to.localeCompare(right.to));
  for (const link of observedCandidates) {
    const missing = [...new Set([link.from, link.to])].filter((id) => !selectedNodeIds.has(id));
    if (selectedNodeIds.size + missing.length > nodeLimit) continue;
    for (const id of missing) selectedNodeIds.add(id);
  }
  for (const node of rankedNodes) {
    if (selectedNodeIds.size >= nodeLimit) break;
    selectedNodeIds.add(node.id);
  }
  const visibleNodes = rankedNodes.filter((node) => selectedNodeIds.has(node.id));
  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
  const candidateLinks = allLinks.filter((link) => visibleNodeIds.has(link.from) && visibleNodeIds.has(link.to));
  const rankedLinks = candidateLinks.slice().sort((left, right) => Number(Boolean(left.structural)) - Number(Boolean(right.structural))
    || (Number(right.weight) || 0) - (Number(left.weight) || 0)
    || left.relation.localeCompare(right.relation)
    || left.from.localeCompare(right.from)
    || left.to.localeCompare(right.to));
  const visibleLinks = rankedLinks.slice(0, linkLimit);
  const visibleLinkSet = new Set(visibleLinks);
  const omittedObservedLinks = allLinks.filter((link) => !link.structural && !visibleLinkSet.has(link)).length;
  const omittedStructuralLinks = allLinks.filter((link) => link.structural && !visibleLinkSet.has(link)).length;
  const summary = {
    nodesTotal: allNodes.length,
    nodesVisible: visibleNodes.length,
    linksTotal: allLinks.length,
    linksVisible: visibleLinks.length,
    omittedNodes: Math.max(0, allNodes.length - visibleNodes.length),
    omittedLinks: Math.max(0, allLinks.length - visibleLinks.length),
    omittedObservedLinks,
    omittedStructuralLinks,
    truncated: allNodes.length > visibleNodes.length || allLinks.length > visibleLinks.length,
    windows,
  };
  return { nodes: visibleNodes, links: visibleLinks, summary, windows };
}

export const NETWORK_RELATIONS = Object.freeze([...RELATIONS]);
