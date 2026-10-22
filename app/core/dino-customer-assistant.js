const FINAL_COMANDA = new Set(['paga', 'em_conta']);
const ACTIVE_APPOINTMENT = new Set(['agendado', 'confirmado', 'em_atendimento']);
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PRODUCT_REORDER_DAYS = 30;

function normalizeText(value) {
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function operationalDate(value, timezone = process.env.KYTTO_TIMEZONE || 'America/Cuiaba') {
  const raw = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const date = new Date(raw);
  if (!Number.isFinite(date.valueOf())) return '';
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function dayNumber(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  return match ? Math.floor(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / DAY_MS) : NaN;
}

function daysBetween(lastDate, nowDate) {
  const last = dayNumber(lastDate);
  const now = dayNumber(nowDate);
  return Number.isFinite(last) && Number.isFinite(now) ? now - last : null;
}

function exactCustomer(item, customerId) {
  return String(item?.clienteId ?? item?.cliente_id ?? '') === String(customerId || '');
}

function notReversed(item) {
  return item?.estornada !== true
    && item?.dinoReversal?.status !== 'completed'
    && item?.dinoReversal?.status !== 'estornada'
    && item?.reversao?.status !== 'concluida';
}

function serviceKey(serviceId, name) {
  return String(serviceId || '').trim() ? `id:${String(serviceId).trim()}` : `nome:${normalizeText(name)}`;
}

function serviceEvents({ customerId, appointments, comandas, historicalAppointments, storeId, timezone }) {
  const events = [];
  const add = (item, { source, serviceId, name, dateValue, sourceId }) => {
    if (!exactCustomer(item, customerId)) return;
    if (storeId && item?.lojaId && String(item.lojaId) !== String(storeId)) return;
    const date = operationalDate(dateValue, timezone);
    const keyName = String(name || '').trim();
    if (!date || (!serviceId && !keyName)) return;
    events.push({ serviceId: String(serviceId || ''), name: keyName, date, source, sourceId: String(sourceId || ''), unidadeIndefinida: Boolean(storeId && !item?.lojaId) });
  };

  for (const item of appointments || []) {
    if (item?.status !== 'concluido' || !notReversed(item)) continue;
    add(item, { source: 'agenda', serviceId: item.servicoId ?? item.servico_id, name: item.servicoNome ?? item.servico_nome, dateValue: item.dataAgenda || item.dataHora || item.data_hora, sourceId: item.id });
  }
  for (const item of historicalAppointments || []) {
    if (item?.status !== 'concluido' || !notReversed(item)) continue;
    add(item, { source: 'historico_importado', serviceId: item.servicoId ?? item.servico_id, name: item.servicoNome ?? item.servico_nome, dateValue: item.dataAgenda || item.data || item.dataHora, sourceId: item.id });
  }
  for (const comanda of comandas || []) {
    if (!FINAL_COMANDA.has(String(comanda?.status || '')) || !notReversed(comanda)) continue;
    for (const item of comanda.itens || []) {
      if (String(item?.tipo || '').toLowerCase() !== 'servico') continue;
      add(comanda, { source: 'comanda', serviceId: item.servicoId ?? item.servico_id ?? item.itemId, name: item.nome ?? item.servicoNome, dateValue: comanda.dataAtendimento || comanda.fechadaEm || comanda.atualizadoEm || comanda.criadoEm, sourceId: `${comanda.id || ''}:${item.id || item.servicoId || item.nome || ''}` });
    }
  }

  // O mesmo atendimento pode aparecer na agenda, na comanda e em um histórico importado.
  // Para periodicidade, uma ocorrência por cliente/serviço/dia é suficiente e evita falso recency.
  const unique = new Map();
  for (const event of events) {
    const key = `${serviceKey(event.serviceId, event.name)}|${event.date}`;
    const prior = unique.get(key);
    if (!prior || (prior.unidadeIndefinida && !event.unidadeIndefinida)) unique.set(key, event);
  }
  return [...unique.values()].sort((a, b) => b.date.localeCompare(a.date));
}

function productEvents({ customerId, comandas, retailSales, storeId, timezone }) {
  const events = [];
  const add = (item, { productId, name, quantity, dateValue, source, sourceId }) => {
    if (!exactCustomer(item, customerId)) return;
    if (storeId && item?.lojaId && String(item.lojaId) !== String(storeId)) return;
    const date = operationalDate(dateValue, timezone);
    const label = String(name || '').trim();
    if (!date || (!productId && !label)) return;
    events.push({ productId: String(productId || ''), name: label, date, quantity: Math.max(0, Number(quantity) || 0), source, sourceId: String(sourceId || ''), unidadeIndefinida: Boolean(storeId && !item?.lojaId) });
  };
  for (const sale of retailSales || []) {
    if (sale?.status !== 'pago' || !notReversed(sale)) continue;
    for (const item of sale.itens || []) add(sale, { productId: item.produtoId ?? item.produto_id, name: item.nome, quantity: item.quantidade ?? item.qtd, dateValue: sale.criadoEm || sale.atualizadoEm, source: 'revenda', sourceId: `${sale.id || ''}:${item.id || item.produtoId || item.nome || ''}` });
  }
  for (const comanda of comandas || []) {
    if (!FINAL_COMANDA.has(String(comanda?.status || '')) || !notReversed(comanda)) continue;
    for (const item of comanda.itens || []) {
      if (String(item?.tipo || '').toLowerCase() !== 'produto') continue;
      add(comanda, { productId: item.produtoId ?? item.produto_id ?? item.itemId, name: item.nome, quantity: item.quantidade ?? item.qtd, dateValue: comanda.dataAtendimento || comanda.fechadaEm || comanda.atualizadoEm || comanda.criadoEm, source: 'comanda', sourceId: `${comanda.id || ''}:${item.id || item.produtoId || item.nome || ''}` });
    }
  }
  return events.sort((a, b) => b.date.localeCompare(a.date));
}

function configuredDays(value, fallback = 0) {
  const number = Number(value ?? fallback);
  return Number.isFinite(number) ? Math.max(0, Math.min(3650, Math.round(number))) : 0;
}

export function buildDinoCustomerAssistant({
  customerId = '', identityVerified = false, appointments = [], comandas = [], retailSales = [],
  historicalAppointments = [], services = [], products = [], currentServiceId = '',
  now = new Date(), storeId = '', timezone = process.env.KYTTO_TIMEZONE || 'America/Cuiaba',
} = {}) {
  if (!customerId || identityVerified !== true) {
    return {
      disponivel: false,
      motivo: customerId ? 'vinculo_nao_confirmado' : 'cliente_sem_cadastro_vinculado',
      historicoServicos: [], servicosParaOferecer: [], servicosRecentes: [],
      historicoProdutos: [], oportunidadesProdutos: [], produtosRecentes: [],
    };
  }
  if (!storeId) {
    return {
      disponivel: false, motivo: 'unidade_nao_selecionada',
      historicoServicos: [], servicosParaOferecer: [], servicosRecentes: [],
      historicoProdutos: [], oportunidadesProdutos: [], produtosRecentes: [],
    };
  }
  const hoje = operationalDate(now, timezone);
  const ocorrencias = serviceEvents({ customerId, appointments, comandas, historicalAppointments, storeId, timezone });
  const serviceMap = new Map();
  const serviceByName = new Map();
  for (const service of services || []) {
    if (service?.id) serviceMap.set(String(service.id), service);
    const key = normalizeText(service?.nome);
    if (key && !serviceByName.has(key)) serviceByName.set(key, service);
  }
  const byService = new Map();
  for (const event of ocorrencias) {
    const service = serviceMap.get(event.serviceId) || serviceByName.get(normalizeText(event.name));
    const key = service?.id ? `id:${service.id}` : serviceKey(event.serviceId, event.name);
    const aggregate = byService.get(key) || { serviceId: service?.id || event.serviceId || '', nome: service?.nome || event.name || 'Serviço', ultimaRealizacaoEm: event.date, diasDesdeUltima: daysBetween(event.date, hoje), atendimentos: 0, origens: new Set(), unidadeIndefinida: true };
    aggregate.atendimentos += 1;
    aggregate.origens.add(event.source);
    aggregate.unidadeIndefinida = aggregate.unidadeIndefinida && event.unidadeIndefinida;
    if (event.date > aggregate.ultimaRealizacaoEm) {
      aggregate.ultimaRealizacaoEm = event.date;
      aggregate.diasDesdeUltima = daysBetween(event.date, hoje);
    }
    byService.set(key, aggregate);
  }
  const serviceHistory = [...byService.values()].map((item) => {
    const service = serviceMap.get(String(item.serviceId)) || serviceByName.get(normalizeText(item.nome));
    return { ...item, origens: [...item.origens], intervaloRecomendacaoDias: configuredDays(service?.intervaloRecomendacaoDias) };
  }).sort((a, b) => b.ultimaRealizacaoEm.localeCompare(a.ultimaRealizacaoEm) || a.nome.localeCompare(b.nome, 'pt-BR'));
  const historyById = new Map();
  const historyByName = new Map();
  for (const item of serviceHistory) {
    if (item.serviceId) historyById.set(String(item.serviceId), item);
    historyByName.set(normalizeText(item.nome), item);
  }
  const booked = new Set((appointments || []).filter((item) => exactCustomer(item, customerId) && ACTIVE_APPOINTMENT.has(String(item.status)) && (!storeId || !item.lojaId || String(item.lojaId) === String(storeId)) && operationalDate(item.dataAgenda || item.dataHora, timezone) >= hoje).map((item) => String(item.servicoId || '')));
  const servicosParaOferecer = [];
  const servicosRecentes = [];
  for (const service of services || []) {
    if (!service || service.ativo === false) continue;
    const interval = configuredDays(service.intervaloRecomendacaoDias);
    const prior = historyById.get(String(service.id)) || historyByName.get(normalizeText(service.nome));
    if (!prior) continue;
    const days = prior.diasDesdeUltima;
    if (days == null || days < 0 || String(service.id) === String(currentServiceId || '') || booked.has(String(service.id))) continue;
    const item = { servicoId: String(service.id), nome: service.nome, ultimaRealizacaoEm: prior.ultimaRealizacaoEm, diasDesdeUltima: days, intervaloDias: interval, categoria: service.categoria || 'Geral' };
    if (prior.unidadeIndefinida) servicosRecentes.push({ ...item, motivo: 'unidade_nao_identificada' });
    else if (interval > 0 && days >= interval) servicosParaOferecer.push({ ...item, motivo: 'intervalo_recomendado_atingido' });
    else if ((interval > 0 && days < interval) || (interval === 0 && days <= 30)) servicosRecentes.push({ ...item, motivo: interval > 0 ? 'ainda_dentro_do_intervalo' : 'intervalo_nao_configurado' });
  }
  servicosParaOferecer.sort((a, b) => b.diasDesdeUltima - a.diasDesdeUltima || a.nome.localeCompare(b.nome, 'pt-BR'));
  servicosRecentes.sort((a, b) => a.diasDesdeUltima - b.diasDesdeUltima || a.nome.localeCompare(b.nome, 'pt-BR'));

  const productCatalog = new Map((products || []).filter((item) => item?.id).map((item) => [String(item.id), item]));
  const purchases = productEvents({ customerId, comandas, retailSales, storeId, timezone });
  const byProduct = new Map();
  for (const event of purchases) {
    const catalog = productCatalog.get(event.productId);
    const key = event.productId ? `id:${event.productId}` : `nome:${normalizeText(event.name)}`;
    const aggregate = byProduct.get(key) || { produtoId: event.productId, nome: catalog?.nome || event.name || 'Produto', ultimaCompraEm: event.date, diasDesdeUltima: daysBetween(event.date, hoje), quantidadeTotal: 0, compras: 0, origens: new Set(), unidadeIndefinida: true };
    aggregate.quantidadeTotal += event.quantity;
    aggregate.compras += 1;
    aggregate.origens.add(event.source);
    aggregate.unidadeIndefinida = aggregate.unidadeIndefinida && event.unidadeIndefinida;
    if (event.date > aggregate.ultimaCompraEm) {
      aggregate.ultimaCompraEm = event.date;
      aggregate.diasDesdeUltima = daysBetween(event.date, hoje);
    }
    byProduct.set(key, aggregate);
  }
  const historicoProdutos = [...byProduct.values()].map((item) => {
    const catalog = productCatalog.get(String(item.produtoId));
    return { ...item, origens: [...item.origens], intervaloRecompraDias: configuredDays(catalog?.intervaloRecompraDias, DEFAULT_PRODUCT_REORDER_DAYS), ativo: catalog ? catalog.ativo !== false : false, emEstoque: catalog ? Number(catalog.estoqueAtual || 0) > 0 : false, precoVenda: catalog ? Number(catalog.precoVenda || 0) : null };
  }).sort((a, b) => b.ultimaCompraEm.localeCompare(a.ultimaCompraEm) || a.nome.localeCompare(b.nome, 'pt-BR'));
  const oportunidadesProdutos = [];
  const produtosRecentes = [];
  for (const item of historicoProdutos) {
    if (!item.produtoId || !item.ativo || !item.emEstoque || item.diasDesdeUltima == null || item.diasDesdeUltima < 0) continue;
    const opportunity = { produtoId: item.produtoId, nome: item.nome, ultimaCompraEm: item.ultimaCompraEm, diasDesdeUltima: item.diasDesdeUltima, intervaloDias: item.intervaloRecompraDias, precoVenda: item.precoVenda };
    if (item.unidadeIndefinida) produtosRecentes.push({ ...opportunity, motivo: 'unidade_nao_identificada' });
    else if (item.intervaloRecompraDias > 0 && item.diasDesdeUltima >= item.intervaloRecompraDias) oportunidadesProdutos.push({ ...opportunity, motivo: 'recompra_periodica' });
    else if (item.intervaloRecompraDias > 0) produtosRecentes.push({ ...opportunity, motivo: 'compra_recente' });
  }
  oportunidadesProdutos.sort((a, b) => b.diasDesdeUltima - a.diasDesdeUltima || a.nome.localeCompare(b.nome, 'pt-BR'));
  produtosRecentes.sort((a, b) => a.diasDesdeUltima - b.diasDesdeUltima || a.nome.localeCompare(b.nome, 'pt-BR'));

  return {
    disponivel: true, motivo: null, geradoEm: new Date(now).toISOString(),
    historicoServicos: serviceHistory,
    servicosParaOferecer,
    servicosRecentes,
    historicoProdutos,
    oportunidadesProdutos,
    produtosRecentes,
    politica: { origem: 'agenda, comanda faturada, revenda paga e histórico importado vinculado por ID', semSugestaoSemIntervalo: true, periodoPadraoRecompraProdutoDias: DEFAULT_PRODUCT_REORDER_DAYS },
  };
}
