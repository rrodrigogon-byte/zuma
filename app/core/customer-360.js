// Customer 360 — visão única do cliente, somente leitura.
//
// O cliente da Dino vive em dois mundos que não se referenciam:
//   • barbearia (store JSON: cliente, agenda, comandas, revenda, contas, fidelidade, planos)
//   • Commerce Core (PostgreSQL: commerce_customers, pedidos, crediário, pontos,
//     carrinhos, WhatsApp IA, campanhas e consentimentos de marketing)
// Este módulo junta as duas bases pela identidade de contato (telefone normalizado
// e e-mail), sem gravar vínculo algum, e degrada por fonte: uma fonte indisponível
// nunca derruba a ficha. Dados pessoais saem mascarados por padrão (LGPD).

import { db } from './database.js';
import { buildDinoCustomerAssistant } from './dino-customer-assistant.js';
// Mesmo critério de localeCompare(…, 'pt-BR'), sem criar um collator a cada comparação.
const COLLATOR_PT_BR = new Intl.Collator('pt-BR');

// ───────────────────────── identidade e mascaramento ─────────────────────────

export function onlyDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

/** Mesmo critério de commerce-campaigns/abandoned-carts/whatsapp-ai-profile: E.164 BR sem "+". */
export function normalizePhone(value) {
  let digits = onlyDigits(value);
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return digits.length >= 12 && digits.length <= 13 ? digits : '';
}

export function normalizeEmail(value) {
  const email = String(value ?? '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

export function maskPhone(value) {
  const digits = onlyDigits(value);
  if (digits.length < 8) return digits ? '•'.repeat(digits.length) : '';
  const national = digits.length >= 12 && digits.startsWith('55') ? digits.slice(2) : digits;
  const ddd = national.length >= 10 ? national.slice(0, 2) : '';
  return `${ddd ? `(${ddd}) ` : ''}•••••-${national.slice(-4)}`;
}

export function maskEmail(value) {
  const email = String(value ?? '').trim();
  const at = email.indexOf('@');
  if (at < 1) return email ? '•••' : '';
  return `${email.slice(0, Math.min(2, at))}•••${email.slice(at)}`;
}

export function maskDocument(value) {
  const digits = onlyDigits(value);
  if (!digits) return String(value || '').trim() ? '•••' : '';
  if (digits.length <= 4) return '•'.repeat(digits.length);
  return `•••.•••.${digits.slice(-5, -2)}-${digits.slice(-2)}`;
}

// ref estável na URL: dino:<id JSON> | loja:<uuid Commerce> | tel:<telefone normalizado>
const REF_PATTERN = /^(dino|loja|tel):([A-Za-z0-9._-]{1,120})$/;

export function buildRef(kind, id) {
  const value = kind === 'tel' ? normalizePhone(id) : String(id ?? '').trim();
  const ref = `${kind}:${value}`;
  return REF_PATTERN.test(ref) ? ref : '';
}

export function parseRef(input) {
  const match = REF_PATTERN.exec(String(input ?? '').trim());
  if (!match) return null;
  const [, kind, id] = match;
  if (kind === 'tel' && !normalizePhone(id)) return null;
  if (kind === 'loja' && !/^[0-9a-f-]{36}$/i.test(id)) return null;
  return { kind, id };
}

export function identityOf(record = {}) {
  return {
    phones: [...new Set([record.telefone_normalizado, record.telefone, record.celular, record.whatsapp].map(normalizePhone).filter(Boolean))],
    emails: [...new Set([record.email_normalizado, record.email].map(normalizeEmail).filter(Boolean))],
  };
}

function normalizeSearch(value) {
  return String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// ───────────────────────── grafo de identidade ─────────────────────────
//
// Cada registro (cliente da barbearia ou da loja) é um nó. Dois nós viram a
// mesma pessoa quando compartilham telefone/e-mail normalizado OU quando um
// operador os vinculou manualmente. Um par marcado como "não é a mesma pessoa"
// nunca é unido pelo contato (o vínculo manual continua prevalecendo).

export function recordRef(kind, record) {
  return kind === 'local' ? buildRef('dino', record?.id) : buildRef('loja', record?.id);
}

function pairKey(a, b) {
  return [String(a), String(b)].sort().join('|');
}

export function buildIdentityGraph({ localClients = [], commerceCustomers = [], links = [], separations = [] } = {}) {
  const nodes = [
    ...localClients.map((record) => ({ kind: 'local', record, ref: recordRef('local', record), identity: identityOf(record) })),
    ...commerceCustomers.map((record) => ({ kind: 'commerce', record, ref: recordRef('commerce', record), identity: identityOf(record) })),
  ].filter((node) => node.ref);
  const index = new Map(nodes.map((node, position) => [node.ref, position]));
  const parent = nodes.map((_, position) => position);
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const union = (a, b) => { const ra = find(a); const rb = find(b); if (ra !== rb) parent[rb] = ra; };
  const separated = new Set(separations.map((item) => pairKey(item.a, item.b)));
  const reasons = new Map();
  const addReason = (a, b, reason) => {
    for (const ref of [a, b]) { if (!reasons.has(ref)) reasons.set(ref, new Set()); reasons.get(ref).add(reason); }
  };
  const byKey = new Map();
  const addContact = (key, position) => {
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(position);
  };
  nodes.forEach((node, position) => {
    for (const phone of node.identity.phones) addContact(`p:${phone}`, position);
    for (const email of node.identity.emails) addContact(`e:${email}`, position);
  });
  const separationRefs = new Set(separations.flatMap(item => [item.a, item.b]));
  const contactConflictKeys = new Set();
  for (const [key, positions] of byKey) {
    const commercePositions = positions.filter((position) => nodes[position].kind === 'commerce');
    if (new Set(commercePositions.map((position) => nodes[position].record?.id)).size > 1) {
      contactConflictKeys.add(key);
      for (const position of positions) reasons.set(nodes[position].ref, new Set([...(reasons.get(nodes[position].ref) || []), 'conflito de contato']));
      continue;
    }
    // Sem regras de separação neste grupo, uma árvore conecta os mesmos nós
    // que todos os pares. Grupos com qualquer separação mantêm a regra original.
    if (positions.length > 1 && positions.every(position => !separationRefs.has(nodes[position].ref))) {
      const first = positions[0];
      for (let i = 1; i < positions.length; i += 1) {
        union(positions[i], first);
        addReason(nodes[positions[i]].ref, nodes[first].ref, key.startsWith('p:') ? 'telefone' : 'e-mail');
      }
      continue;
    }
    for (let i = 1; i < positions.length; i += 1) {
      for (let j = 0; j < i; j += 1) {
        const a = nodes[positions[i]]; const b = nodes[positions[j]];
        if (separated.has(pairKey(a.ref, b.ref))) continue;
        union(positions[i], positions[j]);
        addReason(a.ref, b.ref, key.startsWith('p:') ? 'telefone' : 'e-mail');
      }
    }
  }
  for (const link of links) {
    const a = index.get(link.a); const b = index.get(link.b);
    if (a === undefined || b === undefined) continue;
    union(a, b);
    addReason(link.a, link.b, 'vínculo manual');
  }
  const components = new Map();
  nodes.forEach((node, position) => {
    const root = find(position);
    if (!components.has(root)) components.set(root, []);
    components.get(root).push(node);
  });
  const persons = [...components.values()].map((members) => {
    const local = members.filter((node) => node.kind === 'local').map((node) => node.record);
    const commerce = members.filter((node) => node.kind === 'commerce').map((node) => node.record);
    const phones = [...new Set(members.flatMap((node) => node.identity.phones))];
    const emails = [...new Set(members.flatMap((node) => node.identity.emails))];
    const names = [...new Set(members.map((node) => normalizeSearch(node.record?.nome)).filter(Boolean))];
    const matchedBy = [...new Set(members.flatMap((node) => [...(reasons.get(node.ref) || [])]))];
    const primary = members.find((node) => node.kind === 'local') || members[0];
    const contactConflict = members.some((node) => [
      ...node.identity.phones.map((phone) => `p:${phone}`),
      ...node.identity.emails.map((email) => `e:${email}`),
    ].some((key) => contactConflictKeys.has(key)));
    return {
      ref: primary.ref,
      refs: members.map((node) => node.ref),
      local, commerce, phones, emails, names, matchedBy,
      contactConflict,
      ambiguous: contactConflict || local.length > 1 || commerce.length > 1 || names.length > 1,
    };
  });
  const byRef = new Map();
  persons.forEach((person) => person.refs.forEach((ref) => byRef.set(ref, person)));
  return { persons, byRef };
}

// ───────────────────────── busca unificada ─────────────────────────

/** Uma entrada mascarada por pessoa (ref preferencial: dino > loja). */
export function mergeCustomerDirectory({ localClients = [], commerceCustomers = [], links = [], separations = [] } = {}) {
  return buildIdentityGraph({ localClients, commerceCustomers, links, separations }).persons.map((person) => {
    const primary = person.local[0] || person.commerce[0];
    return {
      ref: person.ref,
      refs: person.refs,
      nome: primary?.nome || 'Cliente sem nome',
      telefone: maskPhone(person.phones[0] || primary?.telefone),
      email: maskEmail(person.emails[0] || primary?.email),
      fontes: [...(person.local.length ? ['barbearia'] : []), ...(person.commerce.length ? ['loja'] : [])],
      duplicados: Math.max(0, person.local.length - 1) + Math.max(0, person.commerce.length - 1),
      possivelDuplicidade: person.ambiguous,
      conflitoContato: person.contactConflict,
      anonimizado: [...person.local, ...person.commerce].every((record) => record?.anonimizadoEm || record?.metadados?.anonimizadoEm),
      _person: person,
      _search: normalizeSearch([...person.local.map((i) => i.nome), ...person.commerce.map((i) => i.nome), ...person.phones, ...person.emails].join(' ')),
    };
  }).filter((item) => item.ref);
}

export function matchesQuery(item, query = '') {
  const terms = normalizeSearch(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const digits = onlyDigits(query);
  if (digits.length >= 4 && item._search.includes(digits)) return true;
  return terms.every((term) => item._search.includes(term));
}

export function publicDirectoryItem({ _search, _person, ...item }) {
  return item;
}

export function searchCustomerDirectory(directory = [], query = '', { limit = 20 } = {}) {
  const matches = directory.filter((item) => matchesQuery(item, query));
  return {
    total: matches.length,
    items: matches
      .sort((a, b) => b.fontes.length - a.fontes.length || COLLATOR_PT_BR.compare(a.nome, b.nome))
      .slice(0, Math.max(1, Math.min(50, Number(limit) || 20)))
      .map(publicDirectoryItem),
  };
}

// ───────────────────────── montagem da ficha ─────────────────────────

const money = (value) => Number(Number(value || 0).toFixed(2));
const time = (value) => { const ms = new Date(value || 0).valueOf(); return Number.isFinite(ms) && ms > 0 ? ms : 0; };
const PAID_ORDER = new Set(['paid', 'processing', 'ready', 'shipped', 'ready_for_pickup', 'delivered', 'picked_up', 'completed']);
export const PAID_ORDER_STATUSES = [...PAID_ORDER];

/** Segmento de relacionamento — mesma regra na ficha e na carteira. */
export function customerSegment({ lastActivityMs = 0, lifetimeValue = 0, engagements = 0, nowMs = Date.now() } = {}) {
  if (!lastActivityMs) return 'sem_historico';
  const days = Math.floor((nowMs - lastActivityMs) / 86400000);
  if (days > 90) return 'inativo';
  if (days > 45) return 'em_risco';
  if (lifetimeValue >= 1000 || engagements >= 6) return 'vip';
  return engagements <= 1 ? 'novo' : 'recorrente';
}

/** Escolhe a pessoa a partir de um ref (dino/loja/tel), respeitando vínculos e separações. */
export function resolveIdentity(ref, { localClients = [], commerceCustomers = [], links = [], separations = [] } = {}) {
  const parsed = typeof ref === 'string' ? parseRef(ref) : ref;
  if (!parsed) return null;
  const graph = buildIdentityGraph({ localClients, commerceCustomers, links, separations });
  let person = null;
  if (parsed.kind === 'tel') {
    const phone = normalizePhone(parsed.id);
    const matches = graph.persons.filter((item) => item.phones.includes(phone));
    person = matches.length > 1
      ? { ref: buildRef('tel', phone), refs: [], local: [], commerce: [], phones: [phone], emails: [], names: [], matchedBy: ['conflito de contato'], contactConflict: true, ambiguous: true }
      : matches[0] || { ref: buildRef('tel', phone), refs: [], local: [], commerce: [], phones: [phone], emails: [], names: [], matchedBy: [], contactConflict: false, ambiguous: false };
  } else {
    person = graph.byRef.get(buildRef(parsed.kind, parsed.id)) || null;
  }
  if (!person) return null;
  const seed = parsed.kind === 'dino' ? person.local.find((item) => String(item.id) === parsed.id) : parsed.kind === 'loja' ? person.commerce.find((item) => String(item.id) === parsed.id) : null;
  // a semente vira o registro principal da ficha
  const local = seed && parsed.kind === 'dino' ? [seed, ...person.local.filter((item) => item !== seed)] : person.local;
  const commerce = seed && parsed.kind === 'loja' ? [seed, ...person.commerce.filter((item) => item !== seed)] : person.commerce;
  return {
    ref: parsed.kind === 'tel' ? buildRef('tel', parsed.id) : buildRef(parsed.kind, parsed.id),
    canonicalRef: person.ref,
    refs: person.refs,
    seed: seed || null, local, commerce,
    phones: person.phones, emails: person.emails,
    matchedBy: person.contactConflict || person.refs.length > 1 ? person.matchedBy : [],
    contactConflict: person.contactConflict === true,
    ambiguous: person.ambiguous,
  };
}

function consentView(localClient, commerceConsents = []) {
  const out = [];
  for (const canal of ['whatsapp', 'email']) {
    for (const finalidade of ['atendimento', 'marketing']) {
      const entry = localClient?.consentimentos?.[canal]?.[finalidade];
      if (entry) out.push({ origem: 'barbearia', canal, finalidade, concedido: entry.concedido === true, atualizadoEm: entry.atualizadoEm || null, fonte: entry.origem || null });
    }
  }
  for (const item of commerceConsents) {
    out.push({ origem: 'loja', canal: item.canal, finalidade: item.finalidade, concedido: item.concedido === true, atualizadoEm: item.atualizado_em || null, fonte: item.origem || null });
  }
  return out;
}

/**
 * Monta a ficha 360 a partir das fontes já carregadas. `reveal` libera os dados
 * pessoais sem máscara (usado apenas pela exportação auditada).
 */
export function buildCustomer360(identity, { local = {}, commerce = {}, now = new Date(), reveal = false } = {}) {
  const localClient = identity.local[0] || null;
  const commerceCustomer = identity.commerce[0] || null;
  const appointments = (local.appointments || []).slice().sort((a, b) => time(b.dataHora) - time(a.dataHora));
  const comandas = local.comandas || [];
  const retail = local.retailSales || [];
  const receivables = local.receivables || [];
  const loyaltyMember = local.loyaltyMember || null;
  const loyaltyMoves = local.loyaltyMoves || [];
  const subscriptions = local.subscriptions || [];
  const orders = (commerce.orders?.items || []).slice().sort((a, b) => time(b.criado_em) - time(a.criado_em));
  const nowMs = time(now) || Date.now();

  const doneVisits = appointments.filter((item) => item.status === 'concluido');
  const upcoming = appointments.filter((item) => !['cancelado', 'concluido', 'nao_compareceu', 'faltou'].includes(item.status) && time(item.dataHora) >= nowMs);
  const historicalAppointments = local.historicalAppointments || [];
  const noShows = appointments.filter((item) => ['nao_compareceu', 'faltou', 'ausente'].includes(item.status)).length;
  const historicalRevenue = historicalAppointments.reduce((sum, item) => sum + Number(item.valor || 0), 0);
  const barberRevenue = comandas.filter((item) => item.status === 'paga').reduce((sum, item) => sum + Number(item.totalPago || item.total || 0), 0)
    + retail.filter((item) => item.status === 'pago').reduce((sum, item) => sum + Number(item.total || 0), 0)
    + historicalRevenue;
  const paidOrders = orders.filter((item) => PAID_ORDER.has(item.status));
  const storeRevenue = paidOrders.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const openReceivables = receivables.filter((item) => item.status !== 'paga');
  const creditAccounts = commerce.credit?.items || [];
  const storeDebt = creditAccounts.reduce((sum, item) => sum + Number(item.saldo_devedor || 0), 0);
  const loyaltyAccounts = commerce.loyalty?.items || [];
  const storePoints = loyaltyAccounts.reduce((sum, item) => sum + Number(item.saldo_pontos || 0), 0);
  const carts = commerce.carts?.items || [];
  const openCarts = carts.filter((item) => ['open', 'abandoned'].includes(item.status));

  const activityDates = [
    ...appointments.map((item) => item.dataHora), ...comandas.map((item) => item.atualizadoEm || item.criadoEm),
    ...retail.map((item) => item.criadoEm), ...orders.map((item) => item.criado_em),
    ...(commerce.whatsapp?.items || []).map((item) => item.ultima_interacao_em),
    ...historicalAppointments.map((item) => item.dataAgenda),
  ].map(time).filter((ms) => ms && ms <= nowMs + 86400000);
  const lastActivity = activityDates.length ? Math.max(...activityDates) : 0;
  const firstActivity = activityDates.length ? Math.min(...activityDates) : 0;
  const visitTimes = [...doneVisits.map((item) => time(item.dataHora)), ...historicalAppointments.map((item) => time(item.dataAgenda))].filter(Boolean).sort((a, b) => a - b);
  const lastVisit = visitTimes.length ? visitTimes[visitTimes.length - 1] : 0;
  const visitGaps = visitTimes.slice(1).map((ms, index) => ms - visitTimes[index]);
  const averageReturnDays = visitGaps.length ? Math.round(visitGaps.reduce((a, b) => a + b, 0) / visitGaps.length / 86400000) : null;
  const daysSinceLast = lastActivity ? Math.max(0, Math.floor((nowMs - lastActivity) / 86400000)) : null; // agendamento de hoje ainda por vir conta como "hoje", não "há -1 dias"

  const lifetimeValue = money(barberRevenue + storeRevenue);
  const totalTickets = comandas.filter((item) => item.status === 'paga').length + retail.filter((item) => item.status === 'pago').length + paidOrders.length + historicalAppointments.length;
  // visitas concluídas também contam como relacionamento (comanda nem sempre é aberta para o atendimento)
  const engagements = Math.max(totalTickets, doneVisits.length + paidOrders.length + historicalAppointments.length);
  const segment = customerSegment({ lastActivityMs: lastActivity, lifetimeValue, engagements, nowMs });
  const identityRef = String(identity.ref || '');
  const assistant = buildDinoCustomerAssistant({
    customerId: localClient?.id || '',
    identityVerified: Boolean(localClient && !localClient.anonimizadoEm && identity.local.length === 1
      && (identityRef.startsWith('dino:') || (identity.matchedBy || []).includes('vínculo manual'))),
    appointments, comandas, retailSales: retail,
    historicalAppointments: local.historicalAppointments || [],
    services: local.services || [], products: local.products || [],
    storeId: local.storeId || '', now,
  });

  const phone = identity.phones[0] || normalizePhone(localClient?.telefone || commerceCustomer?.telefone);
  const email = identity.emails[0] || normalizeEmail(localClient?.email || commerceCustomer?.email);
  const document = localClient?.cpfCnpj || '';
  const profile = {
    nome: localClient?.nome || commerceCustomer?.nome || 'Cliente',
    tipo: localClient?.tipo || 'pf',
    telefone: reveal ? phone : maskPhone(phone),
    email: reveal ? email : maskEmail(email),
    documento: reveal ? (document || commerceCustomer?.documento_mascarado || '') : (document ? maskDocument(document) : (commerceCustomer?.documento_mascarado || '')),
    endereco: reveal ? (localClient?.endereco || '') : (localClient?.endereco ? 'Endereço cadastrado' : ''),
    observacao: localClient?.observacao || '',
    bloqueadoNaLoja: Boolean(commerceCustomer?.bloqueado),
    clienteDesde: firstActivity ? new Date(Math.min(firstActivity, time(localClient?.criadoEm) || Infinity, time(commerceCustomer?.criado_em) || Infinity)).toISOString() : (localClient?.criadoEm || commerceCustomer?.criado_em || null),
    mascarado: !reveal,
    bairro: localClient?.bairro || '',
    cidade: localClient?.cidade || '',
    estadoCivil: localClient?.estadoCivil || '',
    conjugeNome: localClient?.conjugeNome || '',
    familia: localClient?.familia || [],
    preferencias: localClient?.preferencias || {},
    camposRevelaveis: [phone && 'telefone', email && 'email', document && 'documento', localClient?.endereco && 'endereco'].filter(Boolean),
  };

  const timeline = [
    ...appointments.map((item) => ({ tipo: 'agendamento', em: item.dataHora, titulo: item.servicoNome || item.servico_nome || 'Atendimento', detalhe: [item.status, item.motivoCancelamento === 'falta_confirmacao' ? 'cancelado por falta de confirmação' : '', item.profissionalNome || item.profissional_nome].filter(Boolean).join(' · '), valor: money(item.valorRecebido || item.valor || 0) })),
    ...comandas.map((item) => ({ tipo: 'comanda', em: item.atualizadoEm || item.criadoEm, titulo: `Comanda ${item.id}`, detalhe: item.status, valor: money(item.totalPago || item.total) })),
    ...retail.map((item) => ({ tipo: 'revenda', em: item.criadoEm, titulo: 'Compra no balcão', detalhe: item.status, valor: money(item.total) })),
    ...orders.map((item) => ({ tipo: 'pedido', em: item.criado_em, titulo: `Pedido ${item.public_code}`, detalhe: item.status, valor: money(item.total) })),
    ...carts.map((item) => ({ tipo: 'carrinho', em: item.last_activity_at || item.atualizado_em, titulo: 'Carrinho na loja online', detalhe: item.status, valor: money(item.subtotal) })),
    ...(commerce.whatsapp?.items || []).map((item) => ({ tipo: 'whatsapp', em: item.ultima_interacao_em, titulo: 'Conversa no WhatsApp', detalhe: `${item.status} · ${Number(item.mensagens || 0)} mensagens`, valor: null })),
    ...(commerce.campaigns?.items || []).map((item) => ({ tipo: 'campanha', em: item.enviado_em || item.criado_em, titulo: item.campanha_nome || 'Campanha WhatsApp', detalhe: item.status, valor: item.receita_atribuida ? money(item.receita_atribuida) : null })),
    ...loyaltyMoves.map((item) => ({ tipo: 'pontos', em: item.criadoEm, titulo: `+${item.pontos} pontos`, detalhe: item.origem, valor: null })),
    ...historicalAppointments.map((item) => ({ tipo: 'historico_legado', em: item.dataAgenda, titulo: item.servicoNome || 'Serviço Histórico', detalhe: [item.profissionalNome, 'AVEC'].filter(Boolean).join(' · '), valor: money(item.valor) })),
  ].filter((item) => time(item.em)).sort((a, b) => time(b.em) - time(a.em)).slice(0, 60);

  const sourceStatus = (name, facet) => ({ fonte: name, disponivel: !facet?.unavailable, motivo: facet?.unavailable ? (facet.reason || 'indisponível') : null });

  return {
    ref: identity.ref,
    perfil: profile,
    identidade: {
      fontes: [...(identity.local.length ? ['barbearia'] : []), ...(identity.commerce.length ? ['loja'] : [])],
      vinculadoPor: identity.matchedBy,
      possivelDuplicidade: identity.ambiguous,
      registros: { barbearia: identity.local.length, loja: identity.commerce.length },
    },
    indicadores: {
      valorVitalicio: lifetimeValue,
      receitaBarbearia: money(barberRevenue),
      receitaLoja: money(storeRevenue),
      ticketMedio: totalTickets ? money(lifetimeValue / totalTickets) : 0,
      visitas: doneVisits.length + historicalAppointments.length,
      faltas: noShows,
      pedidos: orders.length,
      pedidosPagos: paidOrders.length,
      pontos: Number(loyaltyMember?.pontos || 0) + storePoints,
      nivel: loyaltyMember?.nivel || null,
      aReceber: money(openReceivables.reduce((sum, item) => sum + Number(item.valor || 0), 0) + storeDebt),
      limiteCredito: money(Number(localClient?.limiteCreditoMensal || 0) + creditAccounts.reduce((sum, item) => sum + Number(item.limite_credito || 0), 0)),
      carrinhosAbertos: openCarts.length,
      ultimaAtividadeEm: lastActivity ? new Date(lastActivity).toISOString() : null,
      ultimaVisitaEm: lastVisit ? new Date(lastVisit).toISOString() : null,
      diasSemAtividade: daysSinceLast,
      retornoMedioDias: averageReturnDays,
      segmento: segment,
    },
    proximos: upcoming.sort((a, b) => time(a.dataHora) - time(b.dataHora)).slice(0, 5).map((item) => ({ id: item.id, dataHora: item.dataHora, servico: item.servicoNome || item.servico_nome || '', profissional: item.profissionalNome || item.profissional_nome || '', status: item.status })),
    barbearia: {
      agendamentos: appointments.slice(0, 50).map((item) => ({ id: item.id, dataHora: item.dataHora, servico: item.servicoNome || item.servico_nome || '', profissional: item.profissionalNome || item.profissional_nome || '', status: item.status, motivoCancelamento: item.motivoCancelamento || null, valor: money(item.valorRecebido || item.valor || 0) })),
      historicoServicos: assistant.historicoServicos,
      historicoProdutos: assistant.historicoProdutos,
      assistenteAtendimento: assistant,
      comandas: comandas.slice(0, 50).map((item) => ({ id: item.id, em: item.atualizadoEm || item.criadoEm, status: item.status, total: money(item.total), pago: money(item.totalPago) })),
      revenda: retail.slice(0, 50).map((item) => ({ id: item.id, em: item.criadoEm, status: item.status, total: money(item.total), itens: (item.itens || []).length })),
      contas: receivables.slice(0, 50).map((item) => ({ id: item.id, descricao: item.descricao, valor: money(item.valor), status: item.status, vencimento: item.dataVencimento, diasAtraso: item.diasAtraso || 0 })),
      planos: subscriptions.map((item) => ({ id: item.id, plano: item.planoNome || item.plano_nome || item.planoId || '', status: item.status, desde: item.criadoEm })),
      fidelidade: loyaltyMember ? { pontos: Number(loyaltyMember.pontos || 0), acumulados: Number(loyaltyMember.pontosAcumulados || 0), nivel: loyaltyMember.nivel || 'bronze', movimentos: loyaltyMoves.slice(0, 30).map((item) => ({ em: item.criadoEm, pontos: item.pontos, origem: item.origem, valor: money(item.valor) })) } : null,
      credito: localClient ? { limite: money(localClient.limiteCreditoMensal), saldoDevedor: money(localClient.saldoDevedor), diasVencimento: localClient.diasVencimento || null } : null,
    },
    loja: {
      pedidos: orders.slice(0, 50).map((item) => ({ id: item.id, codigo: item.public_code, em: item.criado_em, status: item.status, total: money(item.total), itens: Number(item.itens || 0) })),
      crediario: creditAccounts.map((item) => ({ id: item.id, limite: money(item.limite_credito), saldoDevedor: money(item.saldo_devedor), prazoDias: item.prazo_dias, status: item.status })),
      pontos: loyaltyAccounts.map((item) => ({ lojaId: item.loja_id, saldo: Number(item.saldo_pontos || 0), acumulados: Number(item.pontos_acumulados || 0) })),
      carrinhos: carts.slice(0, 20).map((item) => ({ id: item.id, status: item.status, atualizadoEm: item.last_activity_at || item.atualizado_em, itens: Number(item.itens || 0), subtotal: money(item.subtotal), lembrete: item.recovery_status || null })),
    },
    relacionamento: {
      whatsapp: (commerce.whatsapp?.items || []).map((item) => ({ id: item.id, status: item.status, ultimaInteracaoEm: item.ultima_interacao_em, mensagens: Number(item.mensagens || 0) })),
      campanhas: (commerce.campaigns?.items || []).map((item) => ({ id: item.id, campanha: item.campanha_nome || '', status: item.status, enviadoEm: item.enviado_em, convertidoEm: item.convertido_em, receita: money(item.receita_atribuida) })),
      consentimentos: consentView(localClient, commerce.consents?.items || []),
    },
    linhaDoTempo: timeline,
    fontes: [
      { fonte: 'barbearia', disponivel: true, motivo: null },
      sourceStatus('pedidos', commerce.orders), sourceStatus('crediario_loja', commerce.credit), sourceStatus('pontos_loja', commerce.loyalty),
      sourceStatus('carrinhos', commerce.carts), sourceStatus('whatsapp', commerce.whatsapp), sourceStatus('campanhas', commerce.campaigns), sourceStatus('consentimentos_loja', commerce.consents),
    ],
    geradoEm: new Date(nowMs).toISOString(),
  };
}

/** Valor sem máscara de um único campo, para o fluxo "revelar" auditado. */
export function revealField(identity, field) {
  const localClient = identity.local[0] || null;
  const commerceCustomer = identity.commerce[0] || null;
  if (field === 'telefone') return String(localClient?.telefone || commerceCustomer?.telefone || identity.phones[0] || '');
  if (field === 'email') return identity.emails[0] || String(localClient?.email || commerceCustomer?.email || '');
  if (field === 'documento') return String(localClient?.cpfCnpj || '');
  if (field === 'endereco') return String(localClient?.endereco || '');
  return null;
}

// ───────────────────────── Commerce Core (PostgreSQL) ─────────────────────────

function unavailable(error) {
  const code = String(error?.code || '');
  return { unavailable: true, items: [], reason: code === '42P01' ? 'tabela_ausente' : code === '42703' ? 'coluna_ausente' : 'temporariamente_indisponivel' };
}

async function facet(query) {
  try { return { items: (await query()).rows || [] }; }
  catch (error) { return unavailable(error); }
}

const PHONE_SQL = (column) => `CASE WHEN length(regexp_replace(COALESCE(${column},''), '\\D', '', 'g')) IN (10,11) THEN '55' || regexp_replace(${column}, '\\D', '', 'g') ELSE regexp_replace(COALESCE(${column},''), '\\D', '', 'g') END`;

/** Diretório de clientes da loja (Commerce) para busca/merge. */
export async function loadCommerceDirectory(context, { query = '', limit = 200 } = {}) {
  const values = [context.empresaId];
  let filter = '';
  const q = String(query || '').trim().slice(0, 80);
  if (q) {
    values.push(`%${q.toLowerCase()}%`);
    const digits = onlyDigits(q);
    values.push(digits.length >= 4 ? `%${digits}%` : '__no_digits__');
    filter = ` AND (lower(nome) LIKE $2 OR COALESCE(email_normalizado,'') LIKE $2 OR COALESCE(telefone_normalizado,'') LIKE $3)`;
  }
  values.push(Math.max(1, Math.min(5000, Number(limit) || 200)));
  const result = await db.queryRead(
    `SELECT id, nome, email, telefone, email_normalizado, telefone_normalizado, documento_mascarado, bloqueado, criado_em
       FROM commerce_customers
      WHERE empresa_id = $1${filter}
      ORDER BY atualizado_em DESC
      LIMIT $${values.length}`,
    values,
  );
  return result.rows;
}

/** Todas as facetas Commerce da pessoa. Cada uma degrada sozinha. */
export async function loadCommerceFacets(context, { customerIds = [], phones = [], emails = [] } = {}) {
  const ids = [...new Set(customerIds.filter((id) => /^[0-9a-f-]{36}$/i.test(String(id))))];
  const phoneList = [...new Set(phones.map(normalizePhone).filter(Boolean))];
  const emailList = [...new Set(emails.map(normalizeEmail).filter(Boolean))];
  const empty = { items: [] };
  const storeValues = context.lojaId ? [context.lojaId] : [];
  const storeClause = (alias, index) => (context.lojaId ? ` AND ${alias}.storefront_id IN (SELECT id FROM commerce_storefronts WHERE empresa_id = $1 AND loja_id = $${index})` : '');

  const [orders, credit, loyalty, carts, whatsapp, campaigns, consents] = await Promise.all([
    ids.length ? facet(() => db.queryRead(
      `SELECT o.id, o.public_code, o.status, o.total, o.criado_em,
              (SELECT COUNT(*)::integer FROM commerce_order_items i WHERE i.empresa_id = o.empresa_id AND i.order_id = o.id) AS itens
         FROM commerce_orders o
        WHERE o.empresa_id = $1 AND o.customer_id = ANY($2::uuid[])${storeClause('o', 3)}
        ORDER BY o.criado_em DESC LIMIT 100`,
      [context.empresaId, ids, ...storeValues])) : empty,
    ids.length ? facet(() => db.queryRead(
      `SELECT a.id, a.limite_credito, a.saldo_devedor, a.prazo_dias, a.status
         FROM commerce_customer_credit_accounts a
        WHERE a.empresa_id = $1 AND a.customer_id = ANY($2::uuid[])${storeClause('a', 3)}`,
      [context.empresaId, ids, ...storeValues])) : empty,
    ids.length ? facet(() => db.queryRead(
      `SELECT loja_id, saldo_pontos, pontos_acumulados
         FROM commerce_loyalty_accounts
        WHERE empresa_id = $1 AND customer_id = ANY($2::uuid[])${context.lojaId ? ' AND loja_id = $3' : ''}`,
      [context.empresaId, ids, ...storeValues])) : empty,
    ids.length ? facet(() => db.queryRead(
      `SELECT c.id, c.status, c.recovery_status, c.last_activity_at, c.atualizado_em,
              COALESCE(SUM(i.quantidade), 0)::integer AS itens,
              COALESCE(SUM(i.quantidade * i.preco_unitario), 0)::numeric AS subtotal
         FROM commerce_carts c
         LEFT JOIN commerce_cart_items i ON i.empresa_id = c.empresa_id AND i.cart_id = c.id
        WHERE c.empresa_id = $1 AND c.customer_id = ANY($2::uuid[])${storeClause('c', 3)}
        GROUP BY c.id ORDER BY c.atualizado_em DESC LIMIT 20`,
      [context.empresaId, ids, ...storeValues])) : empty,
    phoneList.length ? facet(() => db.queryRead(
      `SELECT s.id, s.status, s.ultima_interacao_em,
              (SELECT COUNT(*)::integer FROM whatsapp_ai_messages m WHERE m.sessao_id = s.id AND m.direcao IN ('entrada','saida')) AS mensagens
         FROM whatsapp_ai_sessions s
        WHERE s.empresa_id = $1 AND ${PHONE_SQL('s.telefone')} = ANY($2::text[])${context.lojaId ? ' AND s.loja_id = $3' : ''}
        ORDER BY s.ultima_interacao_em DESC LIMIT 20`,
      [context.empresaId, phoneList, ...storeValues])) : empty,
    phoneList.length ? facet(() => db.queryRead(
      `SELECT e.id, e.status, e.criado_em, e.enviado_em, e.convertido_em, e.receita_atribuida, c.nome AS campanha_nome
         FROM envios_campanha e
         LEFT JOIN campanhas_crm c ON c.id = e.campanha_id
        WHERE e.empresa_id = $1 AND e.telefone_normalizado = ANY($2::text[])
        ORDER BY e.criado_em DESC LIMIT 30`,
      [context.empresaId, phoneList])) : empty,
    phoneList.length || emailList.length ? facet(() => db.queryRead(
      `SELECT cc.canal, cc.finalidade, cc.concedido, cc.origem, cc.atualizado_em
         FROM consentimentos_cliente cc
         JOIN clientes cl ON cl.id = cc.cliente_id AND cl.empresa_id = cc.empresa_id
        WHERE cc.empresa_id = $1
          AND (${PHONE_SQL('cl.telefone')} = ANY($2::text[]) OR lower(COALESCE(cl.email,'')) = ANY($3::text[]))
        ORDER BY cc.atualizado_em DESC LIMIT 20`,
      [context.empresaId, phoneList, emailList])) : empty,
  ]);
  return { orders, credit, loyalty, carts, whatsapp, campaigns, consents };
}

/** Trilha de leitura/revelação/exportação no log durável do Commerce. Nunca lança. */
export function safeInet(value) {
  const ip = String(value || '').trim();
  return /^[0-9a-f:.]{3,45}$/i.test(ip) && (ip.includes('.') || ip.includes(':')) ? ip : null;
}

export async function auditCustomerAccess(context, { acao, ref, campo = null, motivo = null, ip = null, userAgent = null, operador = null } = {}) {
  if (!context?.empresaId) return false;
  const insert = (usuarioId) => db.query(
    `INSERT INTO commerce_audit_logs (empresa_id, loja_id, usuario_id, entidade, entidade_id, acao, depois, ip_address, user_agent)
     VALUES ($1, $2, $3, 'customer_360', NULL, $4, $5::jsonb, $6, $7)`,
    [context.empresaId, context.lojaId || null, usuarioId, String(acao).slice(0, 30),
      JSON.stringify({ ref, campo, motivo: motivo ? String(motivo).slice(0, 240) : null, operador, usuarioId: context.usuarioId || null }),
      safeInet(ip), userAgent ? String(userAgent).slice(0, 400) : null],
  );
  try {
    await insert(context.usuarioId || null);
    return true;
  } catch (error) {
    // usuário da membership pode pertencer a outra empresa (FK composta): registra sem o vínculo, mantendo o id no JSON.
    if (error?.code === '23503') {
      try { await insert(null); return true; } catch (retryError) { error = retryError; }
    }
    console.warn('Customer 360: falha ao registrar auditoria de acesso:', error?.code || error?.message || error);
    return false;
  }
}

// ───────────────────────── carteira (portfolio) ─────────────────────────

/** Métricas por cliente da barbearia a partir dos dados já carregados do store JSON. */
export function localMetricsByClient({ clients = [], appointments = [], comandas = [], retailSales = [], receivables = [], loyaltyMembers = [], historicalAppointments = [] } = {}) {
  const metrics = new Map(clients.map((client) => [String(client.id), { visitas: 0, faltas: 0, receita: 0, tickets: 0, aReceber: 0, pontos: 0, ultimaAtividade: 0, proximo: 0 }]));
  const phoneToId = new Map();
  for (const client of clients) { const phone = normalizePhone(client.telefone); if (phone && !phoneToId.has(phone)) phoneToId.set(phone, String(client.id)); }
  const target = (item) => metrics.get(String(item.clienteId || '')) || (item.clienteTelefone ? metrics.get(phoneToId.get(normalizePhone(item.clienteTelefone)) || '') : null);
  const nowMs = Date.now();
  const touch = (entry, value) => { const ms = time(value); if (ms && ms <= nowMs + 86400000 && ms > entry.ultimaAtividade) entry.ultimaAtividade = ms; };
  for (const item of appointments) {
    const entry = target(item); if (!entry) continue;
    if (item.status === 'concluido') { entry.visitas += 1; touch(entry, item.dataHora); }
    else if (['nao_compareceu', 'faltou', 'ausente'].includes(item.status)) entry.faltas += 1;
    else if (item.status !== 'cancelado' && time(item.dataHora) > nowMs && (!entry.proximo || time(item.dataHora) < entry.proximo)) entry.proximo = time(item.dataHora);
  }
  for (const item of comandas) {
    const entry = target(item); if (!entry) continue;
    touch(entry, item.atualizadoEm || item.criadoEm);
    if (item.status === 'paga') { entry.receita += Number(item.totalPago || item.total || 0); entry.tickets += 1; }
  }
  for (const item of retailSales) {
    const entry = target(item); if (!entry) continue;
    touch(entry, item.criadoEm);
    if (item.status === 'pago') { entry.receita += Number(item.total || 0); entry.tickets += 1; }
  }
  for (const item of receivables) {
    const entry = metrics.get(String(item.clienteId || '')); if (!entry) continue;
    if (item.status !== 'paga') entry.aReceber += Number(item.valor || 0);
  }
  for (const member of loyaltyMembers) {
    const entry = metrics.get(String(member.clienteId || '')); if (entry) entry.pontos += Number(member.pontos || 0);
  }
  addHistoricalAppointments(metrics, clients, phoneToId, historicalAppointments, touch);
  return metrics;
}

// Histórico importado da Avec (um registro por serviço realizado). Liga ao cadastro pelo
// clienteId; sem ele, pelo telefone (completo ou, se único, pelos 8 últimos dígitos). Cada dia
// com atendimento conta uma visita e um ticket; o valor dos serviços entra na receita.
function addHistoricalAppointments(metrics, clients, phoneToId, historical, touch) {
  if (!historical?.length) return;
  const tail8 = new Map();
  for (const client of clients) {
    const digits = onlyDigits(client.telefone);
    if (digits.length < 8) continue;
    const key = digits.slice(-8);
    tail8.set(key, tail8.has(key) && tail8.get(key) !== String(client.id) ? null : String(client.id));
  }
  const days = new Map();
  for (const item of historical) {
    if (item.status && item.status !== 'concluido') continue;
    let id = item.clienteId && metrics.has(String(item.clienteId)) ? String(item.clienteId) : '';
    if (!id && item.clienteTelefone) {
      id = phoneToId.get(normalizePhone(item.clienteTelefone)) || '';
      if (!id) { const digits = onlyDigits(item.clienteTelefone); if (digits.length >= 8) id = tail8.get(digits.slice(-8)) || ''; }
    }
    const entry = id && metrics.get(id); if (!entry) continue;
    entry.receita += Number(item.valor || 0);
    const day = String(item.dataAgenda || '').slice(0, 10);
    if (!day) continue;
    let seen = days.get(id); if (!seen) { seen = new Set(); days.set(id, seen); }
    if (!seen.has(day)) { seen.add(day); entry.visitas += 1; entry.tickets += 1; }
    touch(entry, `${day}T${/^\d{2}:\d{2}$/.test(String(item.hora || '')) ? item.hora : '12:00'}:00`);
  }
}

/** Agregados da loja por customer_id (pedidos, carrinhos abertos, saldo do crediário). */
export async function loadCommercePortfolioMetrics(context) {
  const storeValues = context.lojaId ? [context.lojaId] : [];
  const storeClause = (alias, index) => (context.lojaId ? ` AND ${alias}.storefront_id IN (SELECT id FROM commerce_storefronts WHERE empresa_id = $1 AND loja_id = $${index})` : '');
  const toMap = (facetResult, key = 'customer_id') => ({ ...facetResult, map: new Map((facetResult.items || []).map((row) => [String(row[key]), row])) });
  const [orders, carts, credit] = await Promise.all([
    facet(() => db.queryRead(
      `SELECT o.customer_id, COUNT(*)::integer AS pedidos,
              COUNT(*) FILTER (WHERE o.status = ANY($2::text[]))::integer AS pedidos_pagos,
              COALESCE(SUM(o.total) FILTER (WHERE o.status = ANY($2::text[])), 0)::numeric AS receita,
              MAX(o.criado_em) AS ultimo_pedido
         FROM commerce_orders o
        WHERE o.empresa_id = $1 AND o.customer_id IS NOT NULL${storeClause('o', 3)}
        GROUP BY o.customer_id`,
      [context.empresaId, PAID_ORDER_STATUSES, ...storeValues])),
    facet(() => db.queryRead(
      `SELECT c.customer_id, COUNT(*)::integer AS carrinhos
         FROM commerce_carts c
        WHERE c.empresa_id = $1 AND c.customer_id IS NOT NULL AND c.status IN ('open','abandoned')${storeClause('c', 2)}
        GROUP BY c.customer_id`,
      [context.empresaId, ...storeValues])),
    facet(() => db.queryRead(
      `SELECT a.customer_id, COALESCE(SUM(a.saldo_devedor), 0)::numeric AS saldo
         FROM commerce_customer_credit_accounts a
        WHERE a.empresa_id = $1${storeClause('a', 2)}
        GROUP BY a.customer_id`,
      [context.empresaId, ...storeValues])),
  ]);
  return { orders: toMap(orders), carts: toMap(carts), credit: toMap(credit) };
}

const EMPTY_COMMERCE_METRICS = { orders: { map: new Map() }, carts: { map: new Map() }, credit: { map: new Map() } };

/** Uma linha por pessoa com métricas somadas (barbearia + loja) e segmento. */
export function buildPortfolio(directory = [], { localMetrics = new Map(), commerceMetrics = EMPTY_COMMERCE_METRICS, tagsByRef = {}, nowMs = Date.now() } = {}) {
  return directory.map((item) => {
    const person = item._person;
    let receita = 0; let tickets = 0; let visitas = 0; let faltas = 0; let aReceber = 0; let pontos = 0; let pedidos = 0; let pedidosPagos = 0; let carrinhos = 0; let ultima = 0; let proximo = 0;
    for (const client of person.local) {
      const m = localMetrics.get(String(client.id)); if (!m) continue;
      receita += m.receita; tickets += m.tickets; visitas += m.visitas; faltas += m.faltas; aReceber += m.aReceber; pontos += m.pontos;
      ultima = Math.max(ultima, m.ultimaAtividade); if (m.proximo && (!proximo || m.proximo < proximo)) proximo = m.proximo;
    }
    for (const customer of person.commerce) {
      const o = commerceMetrics.orders.map.get(String(customer.id));
      if (o) { receita += Number(o.receita || 0); pedidos += Number(o.pedidos || 0); pedidosPagos += Number(o.pedidos_pagos || 0); ultima = Math.max(ultima, time(o.ultimo_pedido)); }
      carrinhos += Number(commerceMetrics.carts.map.get(String(customer.id))?.carrinhos || 0);
      aReceber += Number(commerceMetrics.credit.map.get(String(customer.id))?.saldo || 0);
    }
    const lifetimeValue = money(receita);
    const engagements = Math.max(tickets + pedidosPagos, visitas + pedidosPagos);
    const etiquetas = [...new Set(person.refs.flatMap((ref) => tagsByRef[ref] || []))];
    return {
      ...item,
      etiquetas,
      metricas: {
        valorVitalicio: lifetimeValue, visitas, faltas, pedidos, pontos,
        aReceber: money(aReceber), carrinhosAbertos: carrinhos,
        ultimaAtividadeEm: ultima ? new Date(ultima).toISOString() : null,
        proximoAtendimentoEm: proximo ? new Date(proximo).toISOString() : null,
        diasSemAtividade: ultima ? Math.floor((nowMs - ultima) / 86400000) : null,
        segmento: customerSegment({ lastActivityMs: ultima, lifetimeValue, engagements, nowMs }),
      },
    };
  });
}

export const PORTFOLIO_SEGMENTS = ['vip', 'recorrente', 'novo', 'em_risco', 'inativo', 'sem_historico'];
const SORTS = {
  valor: (a, b) => b.metricas.valorVitalicio - a.metricas.valorVitalicio,
  recente: (a, b) => (b.metricas.ultimaAtividadeEm || '').localeCompare(a.metricas.ultimaAtividadeEm || ''),
  sumidos: (a, b) => (b.metricas.diasSemAtividade ?? -1) - (a.metricas.diasSemAtividade ?? -1),
  saldo: (a, b) => b.metricas.aReceber - a.metricas.aReceber,
  visitas: (a, b) => b.metricas.visitas - a.metricas.visitas,
  nome: (a, b) => COLLATOR_PT_BR.compare(a.nome, b.nome),
};

export function summarizePortfolio(rows = []) {
  const bySegment = Object.fromEntries(PORTFOLIO_SEGMENTS.map((segment) => [segment, 0]));
  let valor = 0; let aReceber = 0; let comSaldo = 0; let comCarrinho = 0; let ambasFontes = 0; let duplicidades = 0;
  for (const row of rows) {
    bySegment[row.metricas.segmento] = (bySegment[row.metricas.segmento] || 0) + 1;
    valor += row.metricas.valorVitalicio; aReceber += row.metricas.aReceber;
    if (row.metricas.aReceber > 0) comSaldo += 1;
    if (row.metricas.carrinhosAbertos > 0) comCarrinho += 1;
    if (row.fontes.length > 1) ambasFontes += 1;
    if (row.possivelDuplicidade) duplicidades += 1;
  }
  return { clientes: rows.length, porSegmento: bySegment, valorTotal: money(valor), aReceber: money(aReceber), comSaldo, comCarrinho, ambasFontes, possiveisDuplicidades: duplicidades, ticketPorCliente: rows.length ? money(valor / rows.length) : 0 };
}

export function queryPortfolio(rows = [], { q = '', segmento = '', fonte = '', saldo = false, carrinho = false, etiqueta = '', ordem = 'valor', pagina = 1, tamanho = 25 } = {}) {
  const filtered = rows.filter((row) => {
    if (row.anonimizado) return false;
    if (segmento && row.metricas.segmento !== segmento) return false;
    if (fonte === 'barbearia' && !(row.fontes.length === 1 && row.fontes[0] === 'barbearia')) return false;
    if (fonte === 'loja' && !(row.fontes.length === 1 && row.fontes[0] === 'loja')) return false;
    if (fonte === 'ambas' && row.fontes.length < 2) return false;
    if (saldo && !(row.metricas.aReceber > 0)) return false;
    if (carrinho && !(row.metricas.carrinhosAbertos > 0)) return false;
    if (etiqueta && !row.etiquetas.includes(String(etiqueta).toLowerCase())) return false;
    return matchesQuery(row, q);
  });
  const size = Math.max(5, Math.min(100, Number(tamanho) || 25));
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const page = Math.max(1, Math.min(pages, Number(pagina) || 1));
  const sorted = filtered.slice().sort((a, b) => (SORTS[ordem] || SORTS.valor)(a, b) || COLLATOR_PT_BR.compare(a.nome, b.nome));
  return { total: filtered.length, pagina: page, paginas: pages, tamanho: size, items: sorted.slice((page - 1) * size, page * size).map(publicDirectoryItem) };
}

// ───────────────────────── fila de possíveis duplicados ─────────────────────────

function recordCard(kind, record) {
  return { ref: recordRef(kind, record), fonte: kind === 'local' ? 'barbearia' : 'loja', nome: record?.nome || 'Sem nome', telefone: maskPhone(record?.telefone), email: maskEmail(record?.email), criadoEm: record?.criadoEm || record?.criado_em || null };
}

/**
 * Sugestões para revisão humana:
 *  • mesma pessoa pelo contato, mas nomes diferentes ou cadastro repetido na mesma base;
 *  • pessoas diferentes com o mesmo nome (sem contato em comum) — candidatas a vínculo manual.
 * Pares já decididos (vinculados ou separados) não voltam para a fila.
 */
export function duplicateSuggestions({ localClients = [], commerceCustomers = [], links = [], separations = [], limit = 50 } = {}) {
  const decided = new Set([...links, ...separations].map((item) => pairKey(item.a, item.b)));
  const graph = buildIdentityGraph({ localClients, commerceCustomers, links, separations });
  const suggestions = [];
  const push = (a, b, motivo, confianca) => {
    const key = pairKey(a.ref, b.ref);
    if (decided.has(key) || suggestions.some((item) => item.key === key)) return;
    suggestions.push({ key, a, b, motivo, confianca });
  };
  for (const person of graph.persons) {
    const members = [...person.local.map((record) => recordCard('local', record)), ...person.commerce.map((record) => recordCard('commerce', record))];
    if (members.length < 2) continue;
    for (let i = 1; i < members.length; i += 1) {
      const a = members[0]; const b = members[i];
      const sameName = normalizeSearch(a.nome) === normalizeSearch(b.nome);
      if (a.fonte === b.fonte) push(a, b, `Cadastro repetido na ${a.fonte === 'loja' ? 'loja' : 'barbearia'} com o mesmo contato`, 'alta');
      else if (!sameName) push(a, b, 'Mesmo contato com nomes diferentes — confirme se é a mesma pessoa', 'media');
    }
  }
  const byName = new Map();
  for (const person of graph.persons) {
    for (const [kind, list] of [['local', person.local], ['commerce', person.commerce]]) {
      for (const record of list) {
        const name = normalizeSearch(record?.nome);
        if (!name || name.split(' ').length < 2) continue;
        byName.set(name, [...(byName.get(name) || []), { person, card: recordCard(kind, record) }]);
      }
    }
  }
  for (const entries of byName.values()) {
    for (let i = 1; i < entries.length; i += 1) {
      for (let j = 0; j < i; j += 1) {
        if (entries[i].person === entries[j].person) continue;
        push(entries[j].card, entries[i].card, 'Mesmo nome sem contato em comum — vincule se for a mesma pessoa', 'baixa');
      }
    }
  }
  const order = { alta: 0, media: 1, baixa: 2 };
  return suggestions.sort((x, y) => order[x.confianca] - order[y.confianca]).slice(0, limit).map(({ key, ...item }) => item);
}

// ───────────────────────── LGPD: histórico e anonimização da loja ─────────────────────────

export async function loadCommerceAccessHistory(context, refs = [], limit = 50) {
  if (!context?.empresaId || !refs.length) return { unavailable: !context?.empresaId, items: [] };
  return facet(() => db.queryRead(
    `SELECT criado_em, acao, depois->>'ref' AS ref, depois->>'campo' AS campo, depois->>'motivo' AS motivo,
            COALESCE(depois->>'operador', usuario_id::text) AS operador
       FROM commerce_audit_logs
      WHERE empresa_id = $1 AND entidade = 'customer_360' AND depois->>'ref' = ANY($2::text[])
      ORDER BY criado_em DESC LIMIT $3`,
    [context.empresaId, refs, Math.max(1, Math.min(200, Number(limit) || 50))],
  ));
}

/**
 * Anonimiza o titular no Commerce: cadastro, endereços, evidências de carrinho,
 * sessões/mensagens do WhatsApp IA, cadastro de campanha e consentimentos.
 * Pedidos e pagamentos permanecem (obrigação fiscal), sem novos dados pessoais.
 * Cada etapa usa SAVEPOINT: uma tabela ausente não aborta as demais.
 */
export async function anonymizeCommerceCustomers(context, { customerIds = [], phones = [], emails = [], operador = '' } = {}) {
  const ids = [...new Set(customerIds.filter((id) => /^[0-9a-f-]{36}$/i.test(String(id))))];
  const phoneList = [...new Set(phones.map(normalizePhone).filter(Boolean))];
  const emailList = [...new Set(emails.map(normalizeEmail).filter(Boolean))];
  const result = {};
  await db.transaction(async (trx) => {
    let step = 0;
    const run = async (name, sql, params) => {
      step += 1;
      await trx.query(`SAVEPOINT c360_${step}`);
      try {
        const res = await trx.query(sql, params);
        result[name] = Number(res.rowCount || 0);
        await trx.query(`RELEASE SAVEPOINT c360_${step}`);
      } catch (error) {
        await trx.query(`ROLLBACK TO SAVEPOINT c360_${step}`);
        result[name] = error?.code === '42P01' ? 'tabela_ausente' : 'falhou';
      }
    };
    if (ids.length) {
      await run('clientes_loja',
        `UPDATE commerce_customers
            SET nome = 'Titular anonimizado', email = NULL, telefone = NULL, documento_mascarado = NULL,
                consentimentos = '{}'::jsonb, metadados = jsonb_build_object('anonimizadoEm', CURRENT_TIMESTAMP),
                bloqueado = true, atualizado_em = CURRENT_TIMESTAMP
          WHERE empresa_id = $1 AND id = ANY($2::uuid[])`, [context.empresaId, ids]);
      await run('enderecos', `DELETE FROM commerce_customer_addresses WHERE empresa_id = $1 AND customer_id = ANY($2::uuid[])`, [context.empresaId, ids]);
      await run('carrinhos',
        `UPDATE commerce_carts SET recovery_evidence = '{}'::jsonb, recovery_consent_at = NULL,
                recovery_revoked_at = COALESCE(recovery_revoked_at, CURRENT_TIMESTAMP), recovery_due_at = NULL
          WHERE empresa_id = $1 AND customer_id = ANY($2::uuid[])`, [context.empresaId, ids]);
    }
    if (phoneList.length) {
      await run('mensagens_whatsapp',
        `UPDATE whatsapp_ai_messages SET conteudo = '[removido por anonimização]', metadados = '{}'::jsonb
          WHERE empresa_id = $1 AND sessao_id IN (SELECT id FROM whatsapp_ai_sessions WHERE empresa_id = $1 AND ${PHONE_SQL('telefone')} = ANY($2::text[]))`,
        [context.empresaId, phoneList]);
      await run('sessoes_whatsapp',
        `UPDATE whatsapp_ai_sessions SET nome = NULL, estado = '{}'::jsonb, acao_pendente = NULL, status = 'encerrado',
                remote_jid = 'anonimizado:' || id::text, telefone = '0', atualizado_em = CURRENT_TIMESTAMP
          WHERE empresa_id = $1 AND ${PHONE_SQL('telefone')} = ANY($2::text[])`, [context.empresaId, phoneList]);
      await run('envios_campanha', `UPDATE envios_campanha SET telefone_normalizado = NULL WHERE empresa_id = $1 AND telefone_normalizado = ANY($2::text[])`, [context.empresaId, phoneList]);
    }
    if (phoneList.length || emailList.length) {
      await run('consentimentos',
        `UPDATE consentimentos_cliente SET concedido = false, evidencia = '{}'::jsonb, origem = 'anonimizacao_lgpd', atualizado_em = CURRENT_TIMESTAMP
          WHERE empresa_id = $1 AND cliente_id IN (SELECT id FROM clientes WHERE empresa_id = $1 AND (${PHONE_SQL('telefone')} = ANY($2::text[]) OR lower(COALESCE(email,'')) = ANY($3::text[])))`,
        [context.empresaId, phoneList, emailList]);
      await run('cadastro_campanhas',
        `UPDATE clientes SET nome = 'Titular anonimizado', cpf_cnpj = NULL, telefone = NULL, email = NULL, ativo = false
          WHERE empresa_id = $1 AND (${PHONE_SQL('telefone')} = ANY($2::text[]) OR lower(COALESCE(email,'')) = ANY($3::text[]))`,
        [context.empresaId, phoneList, emailList]);
    }
    // trilha sem dados pessoais: só ids e contagens
    await run('auditoria',
      `INSERT INTO commerce_audit_logs (empresa_id, loja_id, entidade, entidade_id, acao, depois)
       VALUES ($1, $2, 'customer_360', NULL, 'anonymize', $3::jsonb)`,
      [context.empresaId, context.lojaId || null, JSON.stringify({ customerIds: ids, operador, resultado: { ...result } })]);
  });
  return result;
}
