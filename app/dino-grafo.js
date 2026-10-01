import { canonicalWhatsappPhone } from './core/whatsapp-phone.js';
// ============================================================================
// GRAFO DE RELACIONAMENTO + PRÓXIMA MELHOR OFERTA (fase 1, cálculo puro)
// Monta, em memória, o grafo cliente ↔ profissional ↔ serviço ↔ produto ↔ conversa
// a partir do que já existe (agenda, comandas, vendas de balcão, pedidos da loja e
// fatos da memória do atendente) e pontua a próxima oferta de cada cliente:
//   score = 0,40·afinidade + 0,25·interesse + 0,20·momento + 0,15·margem
// Sem I/O: quem chama carrega os dados. Clientes são identificados pelo telefone
// (55 + DDD + número) quando existe, senão pelo id do cadastro local.
// ============================================================================

export const WEIGHTS = Object.freeze({ afinidade: 0.4, interesse: 0.25, momento: 0.2, margem: 0.15 });
export const SEND_THRESHOLD = 0.6;
const DAY = 86400000;
const list = (value) => (Array.isArray(value) ? value : []);
const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const round = (value, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;

const MULTIWORD_BRANDS = ['tom ford', 'calvin klein', 'carolina herrera', 'paco rabanne', 'issey miyake', 'jean paul gaultier', 'giorgio armani', 'hugo boss', 'dolce gabbana', 'yves saint laurent', 'silver scent', 'ralph lauren', 'maison margiela', 'le labo', 'club de nuit'];

export function plainText(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function brandOf(name) {
  const text = plainText(name);
  const multi = MULTIWORD_BRANDS.find((brand) => text.startsWith(`${brand} `) || text === brand);
  if (multi) return multi;
  return text.split(' ')[0] || '';
}

/** Identificador opaco do cliente para a tela (não expõe telefone). */
export function customerToken(key) {
  let hash = 2166136261;
  for (const ch of `dino-grafo|${key}`) { hash ^= ch.charCodeAt(0); hash = Math.imul(hash, 16777619) >>> 0; }
  let hash2 = 5381;
  for (const ch of String(key)) hash2 = (Math.imul(hash2, 33) ^ ch.charCodeAt(0)) >>> 0;
  return `k${hash.toString(36)}${hash2.toString(36)}`;
}

// Mesma forma canônica do consentimento e do opt-out (55 + DDD + celular com o 9): com a
// forma de 12 dígitos, um "SAIR" gravado como 5565999990000 não bloqueava 556599990000.
export function graphPhone(value) {
  const canonical = canonicalWhatsappPhone(value);
  if (canonical) return canonical;
  let digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return digits.length >= 12 && digits.length <= 15 ? digits : '';
}

function dateMs(value) {
  const ms = new Date(value || '').valueOf();
  return Number.isFinite(ms) ? ms : 0;
}

function dayMonth(value) {
  const text = String(value || '');
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return { d: Number(iso[3]), m: Number(iso[2]) };
  const br = text.match(/^(\d{1,2})\/(\d{1,2})/);
  return br ? { d: Number(br[1]), m: Number(br[2]) } : null;
}

export function daysUntilBirthday(value, now = new Date()) {
  const dm = dayMonth(value);
  if (!dm) return null;
  const year = now.getUTCFullYear();
  let next = Date.UTC(year, dm.m - 1, dm.d);
  const today = Date.UTC(year, now.getUTCMonth(), now.getUTCDate());
  if (next < today) next = Date.UTC(year + 1, dm.m - 1, dm.d);
  return Math.round((next - today) / DAY);
}

/** Intervalo habitual (mediana dos intervalos entre visitas, em dias). */
export function habitualInterval(visitDates = []) {
  const sorted = [...new Set(visitDates.map((v) => Math.floor(dateMs(v) / DAY)).filter(Boolean))].sort((a, b) => a - b);
  if (sorted.length < 2) return null;
  const gaps = sorted.slice(1).map((day, i) => day - sorted[i]).filter((gap) => gap >= 5 && gap <= 180);
  if (!gaps.length) return null;
  gaps.sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  return gaps.length % 2 ? gaps[mid] : Math.round((gaps[mid - 1] + gaps[mid]) / 2);
}

/** 1 quando está na hora de voltar (0,8× a 1,3× do intervalo), cai antes e depois. */
export function momentScore({ daysSince = null, interval = null, birthdayIn = null } = {}) {
  let score = 0.3;
  if (daysSince !== null && interval) {
    const ratio = daysSince / interval;
    if (ratio >= 0.8 && ratio <= 1.3) score = 1;
    else if (ratio > 1.3 && ratio <= 2.5) score = 0.8;
    else if (ratio > 2.5) score = 0.5;
    else score = Math.max(0.1, ratio);
  }
  if (birthdayIn !== null && birthdayIn <= 7) score = Math.max(score, 1);
  return round(score);
}

function emptyCustomer(key) {
  return {
    key, phone: key.startsWith('55') ? key : '', clientIds: new Set(), nome: '', aniversario: null,
    consent: { atendimento: false, marketing: false, optOut: false, personalizacao: false },
    visits: [], services: new Map(), professionals: new Map(), products: new Map(), brands: new Set(), categories: new Set(),
    interests: [], indicou: new Set(), totalGasto: 0, nextAppointmentMs: 0, lastCommand: null,
  };
}

/**
 * @param {object} input
 * @param {Array} input.clients     cadastro local { id, nome, telefone, dataNascimento, consentimentos, indicadoPor }
 * @param {Array} input.appointments agenda { clienteId, clienteTelefone, status, dataHora, servicoId, profissionalId }
 * @param {Array} input.commands    comandas { clienteId, clienteTelefone, status, fechadaEm, itens:[{tipo, servicoId, produtoId, nome, subtotal, profissionalId}] }
 * @param {Array} input.retailSales vendas de balcão { clienteId, clienteTelefone, status, itens:[{produtoId, nome, subtotal}] }
 * @param {Array} input.orders      pedidos da loja { telefone, criadoEm, itens:[{nome, subtotal, categoria}] }
 * @param {Array} input.catalog     produtos { id, nome, categoria, preco, custo, estoque, publicado }
 * @param {Array} input.services    serviços { id, nome, preco, categoria, ativo }
 * @param {Array} input.professionals profissionais { id, nome }
 * @param {Array} input.facts       memória { telefone, categoria, valor, status }
 */
export function buildCustomerGraph(input = {}, { now = new Date() } = {}) {
  const customers = new Map();
  const idToKey = new Map();
  const serviceNames = new Map(list(input.services).map((s) => [String(s.id), s.nome]));
  const professionalNames = new Map(list(input.professionals).map((p) => [String(p.id), p.nome]));
  const edges = [];
  const edge = (from, rel, to, at = null, weight = 1) => edges.push({ from, rel, to, at, weight });

  const ensure = (key) => { if (!customers.has(key)) customers.set(key, emptyCustomer(key)); return customers.get(key); };
  for (const client of list(input.clients)) {
    if (!client || client.padrao || /padrao|balcao/i.test(String(client.id))) continue;
    const key = graphPhone(client.telefone) || `id:${client.id}`;
    const c = ensure(key);
    c.clientIds.add(String(client.id));
    c.nome ||= String(client.nome || '').trim();
    c.aniversario ||= client.dataNascimento || client.aniversario || null;
    c.consent.atendimento ||= client.consentimentos?.whatsapp?.atendimento?.concedido === true;
    c.consent.marketing ||= client.consentimentos?.whatsapp?.marketing?.concedido === true;
    idToKey.set(String(client.id), key);
  }
  for (const client of list(input.clients)) {
    const from = idToKey.get(String(client?.id));
    const to = client?.indicadoPor ? idToKey.get(String(client.indicadoPor)) : null;
    if (from && to && from !== to) { ensure(to).indicou.add(from); edge(`c:${to}`, 'INDICOU', `c:${from}`); }
  }
  const keyOf = (item) => {
    if (item?.clienteId && idToKey.has(String(item.clienteId))) return idToKey.get(String(item.clienteId));
    const phone = graphPhone(item?.clienteTelefone || item?.telefone);
    if (phone) return phone;
    return null;
  };
  const addProduct = (c, name, category, at, amount) => {
    const p = plainText(name);
    if (!p) return;
    c.products.set(p, (c.products.get(p) || 0) + 1);
    const brand = brandOf(name);
    if (brand) c.brands.add(brand);
    if (category) c.categories.add(plainText(category));
    c.totalGasto += num(amount);
    edge(`c:${c.key}`, 'COMPROU', `p:${p}`, at);
  };

  const paidCommands = list(input.commands).filter((item) => item?.status === 'paga');
  const inCommand = new Set(paidCommands.map((item) => item.agendamentoId).filter(Boolean));
  for (const command of paidCommands) {
    const key = keyOf(command); if (!key) continue;
    const c = ensure(key);
    const at = command.fechadaEm || command.atualizadoEm || command.criadoEm;
    c.visits.push(at);
    if (!c.lastCommand || dateMs(at) > dateMs(c.lastCommand.at)) c.lastCommand = { id: String(command.id || ''), at, profissionalId: command.profissionalId || null };
    for (const item of list(command.itens)) {
      if (item.tipo === 'servico') {
        const name = item.nome || serviceNames.get(String(item.servicoId)) || 'Serviço';
        const s = plainText(name);
        c.services.set(s, (c.services.get(s) || 0) + 1);
        c.totalGasto += num(item.subtotal);
        edge(`c:${key}`, 'AGENDOU', `s:${s}`, at);
      } else if (item.tipo === 'produto') addProduct(c, item.nome, null, at, item.subtotal);
      const prof = item.profissionalId || command.profissionalId;
      if (prof) { c.professionals.set(String(prof), (c.professionals.get(String(prof)) || 0) + 1); }
    }
    const prof = command.profissionalId || list(command.itens).find((i) => i.profissionalId)?.profissionalId;
    if (prof) edge(`c:${key}`, 'ATENDIDO_POR', `f:${prof}`, at);
  }
  const nowMsEarly = now.valueOf();
  for (const item of list(input.appointments)) {
    const when = dateMs(item?.dataHora);
    if (item && !['concluido', 'cancelado', 'nao_compareceu', 'faltou'].includes(item.status) && when > nowMsEarly) {
      const key = keyOf(item);
      if (key) { const c = ensure(key); if (!c.nextAppointmentMs || when < c.nextAppointmentMs) c.nextAppointmentMs = when; }
      continue;
    }
    if (item?.status !== 'concluido' || inCommand.has(item.id)) continue;
    const key = keyOf(item); if (!key) continue;
    const c = ensure(key);
    c.visits.push(item.dataHora);
    const s = plainText(item.servicoNome || serviceNames.get(String(item.servicoId)) || 'Serviço');
    c.services.set(s, (c.services.get(s) || 0) + 1);
    edge(`c:${key}`, 'AGENDOU', `s:${s}`, item.dataHora);
    if (item.profissionalId) { c.professionals.set(String(item.profissionalId), (c.professionals.get(String(item.profissionalId)) || 0) + 1); edge(`c:${key}`, 'ATENDIDO_POR', `f:${item.profissionalId}`, item.dataHora); }
  }
  for (const sale of list(input.retailSales)) {
    if (sale?.status !== 'pago' || sale.comandaId) continue;
    const key = keyOf(sale); if (!key) continue;
    for (const item of list(sale.itens)) addProduct(ensure(key), item.nome || item.produtoNome, null, sale.pagoEm || sale.criadoEm, item.subtotal);
  }
  for (const order of list(input.orders)) {
    const key = graphPhone(order?.telefone); if (!key) continue;
    const c = ensure(key);
    c.nome ||= String(order.nome || '').trim();
    for (const item of list(order.itens)) addProduct(c, item.nome, item.categoria, order.criadoEm, item.subtotal);
  }
  for (const fact of list(input.facts)) {
    if (fact?.status !== 'ativo') continue;
    const key = graphPhone(fact.telefone); if (!key) continue;
    const c = ensure(key);
    c.interests.push({ categoria: fact.categoria, valor: String(fact.valor || ''), texto: plainText(fact.valor) });
    if (['produto_interesse', 'servico_interesse', 'familia_olfativa'].includes(fact.categoria)) edge(`c:${key}`, fact.categoria === 'servico_interesse' ? 'INTERESSE' : 'PERGUNTOU', `i:${plainText(fact.valor)}`);
  }

  // Consentimentos do CRM/WhatsApp (PostgreSQL): revogação e "SAIR" vencem o cadastro local.
  // Sem essa fonte (erro ao ler), nada de automação: fecha em segurança.
  if (input.consents !== undefined) {
    for (const c of customers.values()) {
      const pg = input.consents instanceof Map && c.phone ? input.consents.get(c.phone) : null;
      if (!(input.consents instanceof Map)) { c.consent.marketing = false; c.consent.optOut = true; continue; }
      if (!pg) continue;
      if (pg.optOut) { c.consent.optOut = true; c.consent.marketing = false; }
      if (pg.marketing === false) c.consent.marketing = false;
      else if (pg.marketing === true && !pg.optOut) c.consent.marketing = true;
      c.consent.personalizacao = pg.personalizacao === true;
    }
  }
  const nowMs = now.valueOf();
  for (const c of customers.values()) {
    c.visits = c.visits.filter(Boolean).sort((a, b) => dateMs(a) - dateMs(b));
    c.lastVisitMs = c.visits.length ? dateMs(c.visits[c.visits.length - 1]) : 0;
    c.daysSince = c.lastVisitMs ? Math.floor((nowMs - c.lastVisitMs) / DAY) : null;
    c.interval = habitualInterval(c.visits);
    c.birthdayIn = daysUntilBirthday(c.aniversario, now);
    c.favoriteProfessional = [...c.professionals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  }
  const byToken = new Map([...customers.keys()].map((key) => [customerToken(key), key]));
  return { customers, edges, serviceNames, professionalNames, byToken };
}

function marginScore(item, maxPrice) {
  const price = num(item.preco);
  if (price <= 0) return 0;
  const cost = num(item.custo);
  if (cost > 0 && cost < price) return round(Math.min(1, ((price - cost) / price) / 0.6));
  return round(0.3 + 0.5 * Math.min(1, price / (maxPrice || price)));
}

function interestScore(c, candidate) {
  let best = 0;
  const name = plainText(candidate.nome);
  const brand = brandOf(candidate.nome);
  const category = plainText(candidate.categoria);
  for (const interest of c.interests) {
    if (!interest.texto) continue;
    if (name && (name.includes(interest.texto) || interest.texto.includes(name))) best = Math.max(best, 1);
    else if (brand && interest.texto.split(' ').includes(brand)) best = Math.max(best, 0.8);
    else if (category && interest.texto.includes(category)) best = Math.max(best, 0.6);
    else if (interest.categoria === 'familia_olfativa' && candidate.familia && plainText(candidate.familia) === interest.texto) best = Math.max(best, 0.7);
  }
  return best;
}

/**
 * Afinidade = parecença do cliente com quem comprou o item.
 * Vizinhos: mesmo profissional preferido, mesma marca ou mesma categoria já compradas.
 */
function affinityIndex(customers) {
  const buyersByProduct = new Map();
  const byProfessional = new Map();
  const byBrand = new Map();
  for (const c of customers.values()) {
    for (const p of c.products.keys()) { if (!buyersByProduct.has(p)) buyersByProduct.set(p, new Set()); buyersByProduct.get(p).add(c.key); }
    for (const s of c.services.keys()) { const k = `s:${s}`; if (!buyersByProduct.has(k)) buyersByProduct.set(k, new Set()); buyersByProduct.get(k).add(c.key); }
    if (c.favoriteProfessional) { if (!byProfessional.has(c.favoriteProfessional)) byProfessional.set(c.favoriteProfessional, new Set()); byProfessional.get(c.favoriteProfessional).add(c.key); }
    for (const b of c.brands) { if (!byBrand.has(b)) byBrand.set(b, new Set()); byBrand.get(b).add(c.key); }
  }
  return { buyersByProduct, byProfessional, byBrand };
}

function affinityScore(c, candidateKey, candidateBrand, index) {
  const buyers = index.buyersByProduct.get(candidateKey);
  const neighbors = new Set();
  if (c.favoriteProfessional) for (const k of index.byProfessional.get(c.favoriteProfessional) || []) neighbors.add(k);
  for (const b of c.brands) for (const k of index.byBrand.get(b) || []) neighbors.add(k);
  neighbors.delete(c.key);
  let score = 0;
  let similar = 0;
  if (buyers && neighbors.size) {
    for (const k of neighbors) if (buyers.has(k)) similar += 1;
    score = Math.min(1, similar / (neighbors.size + 2));
  }
  if (candidateBrand && c.brands.has(candidateBrand)) score = Math.max(score, 0.6);
  return { score: round(score), similar };
}

const UPGRADE_HINT = /(barba|combo|premium|pigment|hidrat|sobrancelha|terapia|limpeza)/;

/** Ofertas candidatas de um cliente, já pontuadas e ordenadas. */
export function scoreCustomer(c, { catalog = [], services = [], index, maxPrice }) {
  const offers = [];
  const moment = momentScore({ daysSince: c.daysSince, interval: c.interval, birthdayIn: c.birthdayIn });
  for (const item of catalog) {
    if (!item || item.publicado === false || num(item.estoque) <= 0 || num(item.preco) <= 0) continue;
    const key = plainText(item.nome);
    if (!key || c.products.has(key)) continue;
    const brand = brandOf(item.nome);
    const aff = affinityScore(c, key, brand, index);
    const interesse = interestScore(c, item);
    const margem = marginScore(item, maxPrice);
    const score = WEIGHTS.afinidade * aff.score + WEIGHTS.interesse * interesse + WEIGHTS.momento * moment + WEIGHTS.margem * margem;
    const reasons = [];
    if (interesse >= 0.8) reasons.push('demonstrou interesse');
    else if (interesse > 0) reasons.push('interesse parecido');
    if (aff.similar) reasons.push(`${aff.similar} cliente(s) parecido(s) compraram`);
    else if (aff.score >= 0.6) reasons.push('já compra essa marca');
    if (moment >= 1) reasons.push(c.birthdayIn !== null && c.birthdayIn <= 7 ? 'aniversário perto' : 'na hora de voltar');
    else if (moment >= 0.5 && c.interval && c.daysSince > c.interval) reasons.push('passou da hora de voltar');
    offers.push({ tipo: 'produto', id: item.id, nome: item.nome, preco: num(item.preco), estoque: num(item.estoque), score: round(score), partes: { afinidade: aff.score, interesse, momento: moment, margem }, motivos: reasons });
  }
  const done = new Set(c.services.keys());
  if (done.size) {
    for (const service of services) {
      if (!service || service.ativo === false) continue;
      const key = plainText(service.nome);
      if (!key || done.has(key) || !UPGRADE_HINT.test(key) || num(service.preco) >= 500) continue;
      const aff = affinityScore(c, `s:${key}`, '', index);
      const interesse = interestScore(c, { nome: service.nome, categoria: service.categoria });
      const margem = round(Math.min(1, 0.5 + num(service.preco) / 300));
      const score = WEIGHTS.afinidade * aff.score + WEIGHTS.interesse * interesse + WEIGHTS.momento * moment + WEIGHTS.margem * margem;
      const reasons = [];
      if (aff.similar) reasons.push(`${aff.similar} cliente(s) do mesmo profissional fazem`);
      if (interesse) reasons.push('perguntou sobre isso');
      if (moment >= 1) reasons.push('na hora de voltar');
      else if (moment >= 0.5 && c.interval && c.daysSince > c.interval) reasons.push('passou da hora de voltar');
      offers.push({ tipo: 'servico', id: service.id, nome: service.nome, preco: num(service.preco), score: round(score), partes: { afinidade: aff.score, interesse, momento: moment, margem }, motivos: reasons });
    }
  }
  return offers.sort((a, b) => b.score - a.score);
}

/** Lista de próximas ofertas da base inteira (top N clientes por score). */
export function nextBestOffers(graph, { catalog = [], services = [], limit = 50, onlyConsented = false, minScore = 0 } = {}) {
  const index = affinityIndex(graph.customers);
  const maxPrice = Math.max(1, ...catalog.map((item) => num(item.preco)));
  const rows = [];
  for (const c of graph.customers.values()) {
    if (onlyConsented && !c.consent.marketing) continue;
    if (!c.visits.length && !c.products.size && !c.interests.length) continue;
    const offers = scoreCustomer(c, { catalog, services, index, maxPrice });
    if (!offers.length || offers[0].score < minScore) continue;
    rows.push({
      cliente: customerView(c, graph),
      melhor: offers[0],
      alternativas: offers.slice(1, 3),
      enviar: offers[0].score >= SEND_THRESHOLD && c.consent.marketing,
    });
  }
  return rows.sort((a, b) => b.melhor.score - a.melhor.score).slice(0, Math.max(1, Math.min(500, limit)));
}

export function customerView(c, graph) {
  return {
    chave: customerToken(c.key),
    nome: c.nome || 'Cliente',
    telefoneFinal: c.phone ? c.phone.slice(-4) : null,
    visitas: c.visits.length,
    diasDesdeUltima: c.daysSince,
    intervaloHabitual: c.interval,
    aniversarioEmDias: c.birthdayIn,
    profissionalPreferido: c.favoriteProfessional ? (graph.professionalNames.get(c.favoriteProfessional) || null) : null,
    consentimento: { ...c.consent },
    produtos: [...c.products.keys()].slice(0, 8),
    servicos: [...c.services.keys()].slice(0, 8),
    interesses: c.interests.slice(0, 8).map((i) => i.valor),
    indicou: c.indicou.size,
    totalGasto: round(c.totalGasto),
  };
}

/** Grafo de um cliente (ele, e tudo a um passo dele) para desenhar na tela. */
export function customerEgo(graph, keyOrToken) {
  const key = graph.byToken?.get(keyOrToken) || keyOrToken;
  const c = graph.customers.get(key);
  if (!c) return null;
  const me = `c:${key}`;
  const nodes = new Map([[me, { id: me, tipo: 'cliente', rotulo: c.nome || 'Cliente' }]]);
  const links = [];
  const seen = new Set();
  for (const e of graph.edges) {
    if (e.from !== me && e.to !== me) continue;
    const other = e.from === me ? e.to : e.from;
    const sig = `${e.from}|${e.rel}|${e.to}`;
    if (seen.has(sig)) { const l = links.find((x) => `${x.from}|${x.rel}|${x.to}` === sig); if (l) l.peso += 1; continue; }
    seen.add(sig);
    if (!nodes.has(other)) {
      const [prefix, ...rest] = other.split(':');
      const raw = rest.join(':');
      const tipo = { c: 'cliente', s: 'servico', p: 'produto', f: 'profissional', i: 'interesse' }[prefix] || 'outro';
      const rotulo = tipo === 'profissional' ? (graph.professionalNames.get(raw) || 'Profissional')
        : tipo === 'cliente' ? (graph.customers.get(raw)?.nome || 'Cliente') : raw;
      nodes.set(other, { id: other, tipo, rotulo });
    }
    links.push({ from: e.from, rel: e.rel, to: e.to, peso: 1 });
  }
  const pub = (id) => (id.startsWith('c:') ? `c:${customerToken(id.slice(2))}` : id);
  return {
    nodes: [...nodes.values()].slice(0, 40).map((n) => ({ ...n, id: pub(n.id) })),
    links: links.slice(0, 60).map((l) => ({ ...l, from: pub(l.from), to: pub(l.to) })),
  };
}

export function graphSummary(graph) {
  const byRel = {};
  for (const e of graph.edges) byRel[e.rel] = (byRel[e.rel] || 0) + 1;
  const productBuyers = new Map();
  for (const c of graph.customers.values()) for (const p of c.products.keys()) productBuyers.set(p, (productBuyers.get(p) || 0) + 1);
  const pairs = new Map();
  for (const c of graph.customers.values()) {
    const items = [...c.products.keys()].sort();
    for (let i = 0; i < items.length; i += 1) for (let j = i + 1; j < items.length; j += 1) {
      const k = `${items[i]}|${items[j]}`; pairs.set(k, (pairs.get(k) || 0) + 1);
    }
  }
  const customers = [...graph.customers.values()];
  return {
    clientes: customers.length,
    comMemoria: customers.filter((c) => c.interests.length).length,
    comIntervalo: customers.filter((c) => c.interval).length,
    relacoes: byRel,
    arestas: graph.edges.length,
    produtosMaisCompartilhados: [...productBuyers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([nome, clientes]) => ({ nome, clientes })),
    compradosJuntos: [...pairs.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => ({ itens: k.split('|'), clientes: n })),
    emRisco: customers.filter((c) => c.interval && c.daysSince !== null && c.daysSince > 1.5 * c.interval).length,
  };
}
