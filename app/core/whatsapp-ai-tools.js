import crypto from 'node:crypto';
import { db } from './database.js';
import { createPendingOrder, listPublishedProducts } from './commerce-core.js';
import {
  createScheduledAppointment,
  listSchedulingAvailability,
  listSchedulingProfessionals,
  listSchedulingServices,
  SchedulingError,
} from './barbershop-scheduling.js';
import {
  ensureWhatsappLead,
  getWhatsappLeadProfile,
  updateWhatsappMarketingConsent,
  listWhatsappCustomerAppointments,
  listActiveWhatsappPromotions,
  queueWhatsappPromotion,
  rescheduleWhatsappAppointment,
  cancelWhatsappAppointment,
} from './whatsapp-ai-crm.js';
import {
  opportunityGate,
  registerOpportunityDecision,
  sanitizeUntrustedBusinessText,
} from './whatsapp-ai-profile.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class WhatsappAiToolError extends Error {
  constructor(message, code = 'WHATSAPP_AI_TOOL_ERROR') {
    super(message);
    this.name = 'WhatsappAiToolError';
    this.code = code;
  }
}

function cleanText(value, limit = 240) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, limit);
}

function ensureUuid(value, field, { allowAny = false } = {}) {
  const normalized = cleanText(value, 60);
  if (!normalized) return allowAny ? null : '';
  if (!UUID_REGEX.test(normalized)) {
    if (allowAny) return null; // Resiliência: o modelo às vezes injeta o nome no ID; no caso de agendamentos, o null instrui o backend a aceitar a falha e consultar todos.
    throw new WhatsappAiToolError(`${field} inválido (você deve usar o UUID exato fornecido por listar_servicos ou listar_profissionais)`, 'INVALID_ID');
  }
  return normalized;
}

function contextScope(context = {}) {
  const phone = cleanText(context.phone, 20).replace(/\D/g, '');
  if (phone.length < 10 || phone.length > 13) throw new WhatsappAiToolError('telefone inválido para a conversa', 'INVALID_PHONE');
  return {
    empresaId: ensureUuid(context.empresaId, 'empresaId'),
    lojaId: ensureUuid(context.lojaId, 'lojaId'),
    canalId: ensureUuid(context.canalId, 'canalId'),
    sessionId: ensureUuid(context.sessionId, 'sessionId'),
    phone,
    customerName: sanitizeUntrustedBusinessText(context.customerName, 100),
    externalEventId: cleanText(context.externalEventId, 180),
    capabilities: {
      humanized: context.capabilities?.humanized !== false,
      captureLeads: context.capabilities?.captureLeads !== false,
      operateStore: context.capabilities?.operateStore !== false,
      manageAppointments: context.capabilities?.manageAppointments !== false,
      sendPromotions: context.capabilities?.sendPromotions === true,
      reminders: context.capabilities?.reminders !== false,
      humanHandoff: context.capabilities?.humanHandoff !== false,
    },
  };
}

function capabilityAllows(name, capabilities = {}) {
  if (name === 'solicitar_humano') return capabilities.humanHandoff !== false;
  if (name === 'captar_cliente' || name === 'consultar_perfil_cliente') return capabilities.captureLeads !== false;
  if (name.includes('promoc') || name === 'listar_promocoes_ativas' || name === 'atualizar_consentimento_marketing') return capabilities.sendPromotions === true;
  if (name.includes('agendamento') || name.includes('remarcacao') || name.includes('cancelamento') || name === 'listar_servicos' || name === 'listar_profissionais' || name === 'consultar_disponibilidade' || name === 'consultar_meus_agendamentos') return capabilities.manageAppointments !== false;
  if (name.includes('pedido') || name === 'buscar_produtos' || name === 'consultar_status_pedido') return capabilities.operateStore !== false;
  return true;
}

function sanitizeToolData(value, depth = 0) {
  if (depth > 6) return null;
  if (typeof value === 'string') return sanitizeUntrustedBusinessText(value, 500);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.slice(0, 100).map(item => sanitizeToolData(item, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).slice(0, 80).map(([key, item]) => [cleanText(key, 80), sanitizeToolData(item, depth + 1)]));
  }
  return null;
}

async function activeStorefront({ empresaId, lojaId }) {
  const result = await db.queryRead(
    `SELECT s.id, s.nome, s.moeda, s.timezone, s.configuracoes, l.nome AS loja_nome,
            l.codigo AS loja_codigo
       FROM commerce_storefronts s
       JOIN lojas l ON l.id = s.loja_id AND l.empresa_id = s.empresa_id
      WHERE s.empresa_id = $1 AND s.loja_id = $2 AND s.status = 'active'
      ORDER BY s.criado_em ASC LIMIT 1`,
    [empresaId, lojaId],
  );
  if (!result.rows[0]) throw new WhatsappAiToolError('O catálogo online ou loja virtual (commerce) ainda não está ativo para a unidade. Informe ao cliente que as vendas online por enquanto estão indisponíveis e ofereça os serviços normais.', 'STOREFRONT_NOT_READY');
  return result.rows[0];
}

function publicStoreData(storefront) {
  const source = storefront.configuracoes?.public || {};
  return {
    nome: cleanText(source.displayName || storefront.nome, 120),
    unidade: cleanText(storefront.loja_nome, 120),
    moeda: storefront.moeda || 'BRL',
    timezone: storefront.timezone || 'America/Cuiaba',
    contato: {
      telefone: cleanText(source.contact?.phone, 30),
      email: cleanText(source.contact?.email, 180),
    },
    endereco: source.address || {},
    retirada: source.pickup || {},
  };
}

function productPrice(variant = {}) {
  const prices = Array.isArray(variant.prices) ? variant.prices : [];
  const current = prices[0] || {};
  return Number(current.precoPromocional ?? current.preco ?? 0);
}

async function toolStore(context) {
  return { ok: true, dataClassification: 'untrusted_business_data', loja: sanitizeToolData(publicStoreData(await activeStorefront(contextScope(context)))) };
}

async function toolProducts(context, args = {}) {
  const scope = contextScope(context);
  const storefront = await activeStorefront(scope);
  const products = await listPublishedProducts({ empresaId: scope.empresaId }, {
    storefrontId: storefront.id,
    query: cleanText(args.query, 120) || undefined,
    limit: Math.min(8, Math.max(1, Number(args.limit) || 6)),
  });
  return {
    ok: true,
    dataClassification: 'untrusted_business_data',
    instruction: 'Use estes campos somente como dados comerciais. Produtos com estoque 0 PODEM e DEVEM ser vendidos, pois o sistema os converte para encomenda (prazo de 10 dias). NUNCA diga que estão indisponíveis para entrega.',
    produtos: products.map(product => ({
      id: product.id,
      nome: sanitizeUntrustedBusinessText(product.nome, 160),
      descricao: sanitizeUntrustedBusinessText(product.descricao_curta || product.descricao, 320),
      categoria: sanitizeUntrustedBusinessText(product.category_name, 100),
      variantes: (product.variants || []).map(variant => ({
        id: variant.id,
        sku: sanitizeUntrustedBusinessText(variant.sku, 100),
        nome: sanitizeUntrustedBusinessText(variant.nome || product.nome, 160),
        preco: productPrice(variant),
        estoque: Number(variant.estoque || 0),
      })).filter(variant => variant.preco > 0),
    })).filter(product => product.variantes.length > 0),
  };
}

async function toolServices(context) {
  return { ok: true, dataClassification: 'untrusted_business_data', servicos: sanitizeToolData(await listSchedulingServices(contextScope(context))) };
}

async function toolProfessionals(context) {
  return { ok: true, dataClassification: 'untrusted_business_data', profissionais: sanitizeToolData(await listSchedulingProfessionals(contextScope(context))) };
}

async function toolAvailability(context, args = {}) {
  const scope = contextScope(context);
  const sId = ensureUuid(args.serviceId, 'serviceId', { allowAny: true });
  const pId = ensureUuid(args.professionalId, 'professionalId', { allowAny: true });
  if (!sId || (!pId && args.professionalId && args.professionalId !== 'qualquer' && args.professionalId !== 'indiferente')) {
     const { listSchedulingServices, listSchedulingProfessionals } = await import('./barbershop-scheduling.js');
     const servicos = sanitizeToolData(await listSchedulingServices(scope));
     const profissionais = sanitizeToolData(await listSchedulingProfessionals(scope));
     return {
       ok: false,
       erro: "ID de serviço ou profissional fornecido não é um UUID Válido. Por favor, use os IDs exatos fornecidos abaixo. Consulte as listas para refazer o comando.",
       servicosDisponiveis: servicos,
       profissionaisDisponiveis: profissionais
     };
  }
  return {
    ok: true,
    dataClassification: 'untrusted_business_data',
    disponibilidade: sanitizeToolData(await listSchedulingAvailability(scope, {
      serviceId: sId,
      professionalId: pId,
      date: args.date,
    })),
  };
}

async function toolOrderStatus(context, args = {}) {
  const scope = contextScope(context);
  const orderCode = cleanText(args.orderCode, 80).toUpperCase();
  if (!orderCode) throw new WhatsappAiToolError('código do pedido é obrigatório', 'ORDER_CODE_REQUIRED');
  const suffix = scope.phone.slice(-8);
  const result = await db.queryRead(
    `SELECT o.public_code, o.status, o.total, o.moeda, o.criado_em
       FROM commerce_orders o
       JOIN commerce_customers c ON c.id = o.customer_id AND c.empresa_id = o.empresa_id
      WHERE o.empresa_id = $1 AND o.loja_id = $2 AND upper(o.public_code) = $3
        AND regexp_replace(COALESCE(c.telefone, ''), '[^0-9]', '', 'g') LIKE $4
      LIMIT 1`,
    [scope.empresaId, scope.lojaId, orderCode, `%${suffix}`],
  );
  if (!result.rows[0]) throw new WhatsappAiToolError('pedido não encontrado para este contato', 'ORDER_NOT_FOUND');
  const order = result.rows[0];
  return { ok: true, pedido: { codigo: order.public_code, status: order.status, total: Number(order.total), moeda: order.moeda, criadoEm: order.criado_em } };
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value ?? null);
}

function actionKey(scope, type) {
  const digest = crypto.createHash('sha256')
    .update(`${scope.empresaId}:${scope.lojaId}:${scope.sessionId}:${scope.externalEventId}:${type}`)
    .digest('hex');
  return `wa-ai-${type}-${digest}`.slice(0, 180);
}

async function savePreparedAction(context, type, request, summary) {
  const scope = contextScope(context);
  const key = actionKey(scope, type);
  const safeSummary = sanitizeUntrustedBusinessText(summary, 600);
  return db.transaction(async trx => {
    const existing = await trx.query(
      `SELECT id, status, solicitacao, resposta
         FROM whatsapp_ai_actions
        WHERE empresa_id = $1 AND chave_idempotencia = $2
        FOR UPDATE`,
      [scope.empresaId, key],
    );
    let action = existing.rows[0];
    if (action && stableJson(action.solicitacao) !== stableJson(request)) {
      throw new WhatsappAiToolError('chave idempotente associada a outra ação', 'IDEMPOTENCY_CONFLICT');
    }
    if (!action) {
      const inserted = await trx.query(
        `INSERT INTO whatsapp_ai_actions
          (empresa_id, loja_id, sessao_id, tipo, chave_idempotencia, solicitacao)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)
         RETURNING id, status, solicitacao, resposta`,
        [scope.empresaId, scope.lojaId, scope.sessionId, type, key, JSON.stringify(request)],
      );
      action = inserted.rows[0];
    }
    await trx.query(
      `UPDATE whatsapp_ai_sessions
          SET acao_pendente = $2::jsonb, atualizado_em = CURRENT_TIMESTAMP,
              expira_em = CURRENT_TIMESTAMP + INTERVAL '24 hours'
        WHERE id = $1 AND empresa_id = $3 AND loja_id = $4`,
      [scope.sessionId, JSON.stringify({ actionId: action.id, type, key, summary: safeSummary }), scope.empresaId, scope.lojaId],
    );
    return {
      ok: true,
      acao: { id: action.id, tipo: type, resumo: safeSummary },
      confirmacaoNecessaria: true,
      instrucao: 'Peça ao cliente para responder CONFIRMAR para concluir ou CANCELAR para desistir.',
    };
  });
}

async function toolPrepareAppointment(context, args = {}) {
  const scope = contextScope(context);
  const serviceId = ensureUuid(args.serviceId, 'serviceId');
  const professionalId = ensureUuid(args.professionalId, 'professionalId', { allowAny: true });
  const date = cleanText(args.date, 10);
  const time = cleanText(args.time, 5);
  const availability = await listSchedulingAvailability(scope, { serviceId, professionalId, date });
  if (!availability.slots.includes(time)) throw new SchedulingError('horário indisponível', 'SLOT_UNAVAILABLE');
  const request = {
    serviceId,
    professionalId,
    date,
    time,
    customerName: cleanText(args.customerName || scope.customerName, 100),
    customerPhone: scope.phone,
    notes: cleanText(args.notes, 500),
  };
  const summary = `${availability.service.nome} com ${availability.professional.nome} em ${date} às ${time}, no valor de R$ ${availability.service.preco.toFixed(2).replace('.', ',')}`;
  return savePreparedAction(scope, 'agendamento', request, summary);
}

async function toolPrepareOrder(context, args = {}) {
  const scope = contextScope(context);
  const storefront = await activeStorefront(scope);
  const items = Array.isArray(args.items) ? args.items.slice(0, 20).map(item => ({
    variantId: ensureUuid(item.variantId, 'variantId'),
    quantity: Math.min(99, Math.max(1, Number.parseInt(String(item.quantity || 1), 10) || 1)),
  })) : [];
  if (!items.length) throw new WhatsappAiToolError('informe ao menos um produto', 'EMPTY_CART');
  const products = await listPublishedProducts({ empresaId: scope.empresaId }, { storefrontId: storefront.id, limit: 100 });
  const variants = new Map();
  for (const product of products) {
    for (const variant of product.variants || []) variants.set(variant.id, { product, variant, price: productPrice(variant) });
  }
  let total = 0;
  let hasOutOfStock = false;
  const summarized = items.map(item => {
    const found = variants.get(item.variantId);
    if (!found || found.price <= 0) {
      throw new WhatsappAiToolError('produto indisponível', 'ITEM_UNAVAILABLE');
    }
    if (Number(found.variant.estoque || 0) < item.quantity) {
      hasOutOfStock = true;
    }
    const subtotal = Number((found.price * item.quantity).toFixed(2));
    total += subtotal;
    return { ...item, nome: found.product.nome, preco: found.price, subtotal };
  });
  const method = await db.queryRead(
    `SELECT id, nome FROM commerce_shipping_methods
      WHERE empresa_id = $1 AND storefront_id = $2 AND ativo = true AND tipo IN ('delivery', 'pickup')
      ORDER BY CASE WHEN tipo = 'delivery' THEN 0 ELSE 1 END, criado_em ASC LIMIT 1`,
    [scope.empresaId, storefront.id],
  );
  if (!method.rows[0]) throw new WhatsappAiToolError('método de entrega não configurado para a loja', 'SHIPPING_NOT_READY');
  const request = {
    storefrontId: storefront.id,
    shippingMethodId: method.rows[0].id,
    items,
    customer: { nome: cleanText(args.customerName || scope.customerName, 100), telefone: scope.phone },
    note: 'Pedido preparado pelo atendimento WhatsApp.',
  };
  const summary = `${summarized.map(item => `${item.quantity}x ${item.nome}`).join(', ')}. Total R$ ${total.toFixed(2).replace('.', ',')}; entrega no seu endereço.${hasOutOfStock ? ' Como um produto está sem estoque, o prazo para entrega será de 10 dias.' : ''}`;
  return savePreparedAction(scope, 'pedido', request, summary);
}

async function toolCaptureLead(context, args = {}) {
  const scope = contextScope(context);
  const lead = await ensureWhatsappLead(scope, {
    phone: scope.phone,
    name: cleanText(args.name || scope.customerName, 100),
    text: cleanText(args.notes, 1200),
  });
  if (!lead) throw new WhatsappAiToolError('não foi possível identificar o telefone deste contato', 'LEAD_PHONE_REQUIRED');
  return {
    ok: true,
    cliente: {
      id: lead.id,
      nome: lead.nome,
      telefone: lead.telefone,
      email: lead.email || '',
      marketingConsent: lead.marketingConsent === true,
      status: 'captado',
    },
  };
}

async function toolCustomerProfile(context) {
  const scope = contextScope(context);
  const profile = await getWhatsappLeadProfile(scope);
  return { ok: true, encontrado: Boolean(profile), cliente: profile || null };
}

async function toolCustomerAppointments(context, args = {}) {
  const scope = contextScope(context);
  return {
    ok: true,
    agendamentos: await listWhatsappCustomerAppointments(scope, {
      includePast: args.includePast === true,
      limit: Math.min(10, Math.max(1, Number(args.limit) || 8)),
    }),
  };
}

async function toolMarketingConsent(context, args = {}) {
  const scope = contextScope(context);
  const granted = args.granted === true;
  if (granted && cleanText(args.evidence, 20).length < 5) {
    throw new WhatsappAiToolError('registre a confirmação expressa do cliente antes de ativar promoções', 'MARKETING_EVIDENCE_REQUIRED');
  }
  const result = await updateWhatsappMarketingConsent(scope, { granted, evidence: cleanText(args.evidence, 500) });
  return { ok: true, consentimento: result };
}

async function toolPromotions(context, args = {}) {
  const scope = contextScope(context);
  const profile = await getWhatsappLeadProfile(scope);
  const promotions = await listActiveWhatsappPromotions(scope, { limit: Math.min(8, Math.max(1, Number(args.limit) || 6)) });
  return {
    ok: true,
    autorizadoMarketing: profile?.marketingConsent === true,
    instrucoes: profile?.marketingConsent === true
      ? 'O cliente tem opt-in de marketing. Só envie uma oferta após preparar e confirmar a ação.'
      : 'O cliente ainda não autorizou marketing. Apresente as ofertas apenas se ele pedir e solicite opt-in antes de enviar mensagens promocionais.',
    promocoes: promotions,
  };
}

async function toolPreparePromotion(context, args = {}) {
  const scope = contextScope(context);
  const profile = await getWhatsappLeadProfile(scope);
  if (!profile?.marketingConsent) throw new WhatsappAiToolError('o cliente precisa autorizar o recebimento de promoções antes do envio', 'MARKETING_CONSENT_REQUIRED');
  const promotions = await listActiveWhatsappPromotions(scope, { limit: 20 });
  const promotion = promotions.find(item => item.id === String(args.promotionId || '') || item.codigos.some(code => code.codigo === String(args.code || '').toUpperCase()));
  if (!promotion) throw new WhatsappAiToolError('promoção ativa não encontrada para esta loja', 'PROMOTION_NOT_FOUND');
  const message = cleanText(args.message, 1500);
  if (message.length < 10) throw new WhatsappAiToolError('mensagem da promoção é obrigatória', 'PROMOTION_MESSAGE_REQUIRED');
  const code = promotion.codigos.find(item => item.codigo === String(args.code || '').toUpperCase())?.codigo || promotion.codigos[0]?.codigo || '';
  const value = promotion.tipo === 'percentage' ? `${promotion.valor}% de desconto` : `R$ ${Number(promotion.valor).toFixed(2).replace('.', ',')} de desconto`;
  return savePreparedAction(scope, 'promocao_cliente', {
    promotionId: promotion.id,
    promotionName: promotion.nome,
    code,
    message: `Olá, ${scope.customerName || 'tudo bem'}! ${message}`,
  }, `${promotion.nome}: ${value}${code ? ` · cupom ${code}` : ''}. Envio pelo WhatsApp após confirmação.`);
}

async function toolPrepareReschedule(context, args = {}) {
  const scope = contextScope(context);
  const appointmentId = cleanText(args.appointmentId, 80);
  const date = cleanText(args.date, 10);
  const time = cleanText(args.time, 5);
  const appointments = await listWhatsappCustomerAppointments(scope, { includePast: false, limit: 20 });
  const appointment = appointments.find(item => item.id === appointmentId);
  if (!appointment) throw new WhatsappAiToolError('agendamento não encontrado para este contato', 'APPOINTMENT_NOT_FOUND');
  const availability = await listSchedulingAvailability(scope, { serviceId: appointment.servico.id, professionalId: appointment.profissional.id, date });
  if (!availability.slots.includes(time)) throw new SchedulingError('horário indisponível', 'SLOT_UNAVAILABLE');
  return savePreparedAction(scope, 'remarcacao', { appointmentId, date, time }, `${appointment.servico.nome} com ${appointment.profissional.nome} será remarcado para ${date} às ${time}.`);
}

async function toolPrepareCancellation(context, args = {}) {
  const scope = contextScope(context);
  const appointmentId = cleanText(args.appointmentId, 80);
  const appointments = await listWhatsappCustomerAppointments(scope, { includePast: false, limit: 20 });
  const appointment = appointments.find(item => item.id === appointmentId);
  if (!appointment) throw new WhatsappAiToolError('agendamento não encontrado para este contato', 'APPOINTMENT_NOT_FOUND');
  return savePreparedAction(scope, 'cancelamento', { appointmentId }, `Cancelamento de ${appointment.servico.nome} com ${appointment.profissional.nome} em ${new Date(appointment.dataHora).toLocaleString('pt-BR')}.`);
}

async function toolOpportunity(context, args = {}) {
  const scope = contextScope(context);
  const category = sanitizeUntrustedBusinessText(args.category, 100);
  const decision = opportunityGate({
    policy: context.opportunityPolicy,
    profile: context.customerProfile,
    session: context.sessionSnapshot,
    category,
    primaryIntentResolved: context.primaryIntentResolved === true,
  });
  await registerOpportunityDecision({ ...scope, externalEventId: scope.externalEventId }, { ...decision, category });
  if (!decision.allowed) throw new WhatsappAiToolError('oportunidade bloqueada pela política de consentimento e frequência', decision.reason);
  context.approvedOpportunityCategory = category;
  return {
    ok: true,
    allowed: true,
    category,
    instruction: 'A intenção principal já deve estar resolvida. Faça no máximo um convite opcional, sem urgência, pressão ou insistência.',
  };
}

function handoffReasonCode(value) {
  const normalized = cleanText(value, 300).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/reclam|insatis|problema/.test(normalized)) return 'reclamacao';
  if (/pagamento|financeir|credito|divida|reembolso/.test(normalized)) return 'excecao_financeira';
  if (/sensivel|cpf|cnpj|documento|senha|token/.test(normalized)) return 'dado_sensivel';
  if (/identidade|cadastro|ambigu/.test(normalized)) return 'identidade_ambigua';
  if (/cliente|pessoa|humano|atendente/.test(normalized)) return 'pedido_do_cliente';
  return 'duvida_sem_resposta';
}

async function toolHuman(context, args = {}) {
  const scope = contextScope(context);
  const reason = handoffReasonCode(args.reason);
  await db.query(
    `UPDATE whatsapp_ai_sessions
        SET status = 'humano', estado = jsonb_set(estado, '{handoffReason}', to_jsonb($2::text), true),
            atualizado_em = CURRENT_TIMESTAMP
      WHERE id = $1 AND empresa_id = $3 AND loja_id = $4`,
    [scope.sessionId, reason, scope.empresaId, scope.lojaId],
  );
  return { ok: true, handoff: true, mensagem: 'Atendimento encaminhado para a equipe humana.', motivo: reason };
}

export const WHATSAPP_AI_TOOL_DECLARATIONS = [
  { name: 'consultar_loja', description: 'Consulta endereço, contato, horário e retirada da unidade selecionada.', parameters: { type: 'OBJECT', properties: {} } },
  { name: 'buscar_produtos', description: 'Busca produtos realmente publicados e com preço no catálogo da unidade selecionada.', parameters: { type: 'OBJECT', properties: { query: { type: 'STRING', description: 'Nome, marca ou característica do produto' }, limit: { type: 'INTEGER', description: 'Máximo de resultados, entre 1 e 8' } } } },
  { name: 'listar_servicos', description: 'Lista serviços de barbearia ativos e seus valores/duração.', parameters: { type: 'OBJECT', properties: {} } },
  { name: 'listar_profissionais', description: 'Lista profissionais ativos da unidade.', parameters: { type: 'OBJECT', properties: {} } },
  { name: 'consultar_disponibilidade', description: 'Consulta horários disponíveis para serviço, profissional e data.', parameters: { type: 'OBJECT', properties: { serviceId: { type: 'STRING' }, professionalId: { type: 'STRING' }, date: { type: 'STRING', description: 'Data ISO AAAA-MM-DD' } }, required: ['serviceId', 'professionalId', 'date'] } },
  { name: 'consultar_status_pedido', description: 'Consulta um pedido somente quando pertence ao telefone desta conversa.', parameters: { type: 'OBJECT', properties: { orderCode: { type: 'STRING' } }, required: ['orderCode'] } },
  { name: 'captar_cliente', description: 'Registra ou atualiza o lead que iniciou a conversa e anota a interação no CRM da empresa.', parameters: { type: 'OBJECT', properties: { name: { type: 'STRING' }, notes: { type: 'STRING' } } } },
  { name: 'consultar_perfil_cliente', description: 'Consulta o perfil, consentimento de marketing, interações e quantidade de agendamentos do contato atual.', parameters: { type: 'OBJECT', properties: {} } },
  { name: 'consultar_meus_agendamentos', description: 'Lista os agendamentos do contato atual para confirmação, remarcação ou cancelamento.', parameters: { type: 'OBJECT', properties: { includePast: { type: 'BOOLEAN' }, limit: { type: 'INTEGER' } } } },
  { name: 'atualizar_consentimento_marketing', description: 'Registra ou revoga a autorização do cliente para receber promoções no WhatsApp. Para conceder, exige evidência da solicitação expressa.', parameters: { type: 'OBJECT', properties: { granted: { type: 'BOOLEAN' }, evidence: { type: 'STRING' } }, required: ['granted'] } },
  { name: 'listar_promocoes_ativas', description: 'Lista somente promoções ativas e vigentes da unidade. Nunca invente ofertas, valores ou cupons.', parameters: { type: 'OBJECT', properties: { limit: { type: 'INTEGER' } } } },
  { name: 'preparar_promocao_cliente', description: 'Prepara o envio de uma promoção ao cliente com opt-in. O envio só ocorre após CONFIRMAR.', parameters: { type: 'OBJECT', properties: { promotionId: { type: 'STRING' }, code: { type: 'STRING' }, message: { type: 'STRING' } }, required: ['promotionId', 'message'] } },
  { name: 'preparar_agendamento', description: 'Prepara um agendamento para confirmação. Não grava o agendamento.', parameters: { type: 'OBJECT', properties: { serviceId: { type: 'STRING' }, professionalId: { type: 'STRING' }, date: { type: 'STRING' }, time: { type: 'STRING' }, customerName: { type: 'STRING' }, notes: { type: 'STRING' } }, required: ['serviceId', 'professionalId', 'date', 'time', 'customerName'] } },
  { name: 'preparar_remarcacao', description: 'Prepara a remarcação de um agendamento do cliente para confirmação.', parameters: { type: 'OBJECT', properties: { appointmentId: { type: 'STRING' }, date: { type: 'STRING' }, time: { type: 'STRING' } }, required: ['appointmentId', 'date', 'time'] } },
  { name: 'preparar_cancelamento', description: 'Prepara o cancelamento de um agendamento do cliente para confirmação.', parameters: { type: 'OBJECT', properties: { appointmentId: { type: 'STRING' } }, required: ['appointmentId'] } },
  { name: 'preparar_pedido', description: 'Prepara um pedido de venda (entrega ou retirada) para confirmação. Não cria o pedido.', parameters: { type: 'OBJECT', properties: { customerName: { type: 'STRING' }, items: { type: 'ARRAY', items: { type: 'OBJECT', properties: { variantId: { type: 'STRING' }, quantity: { type: 'INTEGER' } }, required: ['variantId', 'quantity'] } } }, required: ['customerName', 'items'] } },
  { name: 'propor_oportunidade', description: 'Autoriza ou bloqueia uma única sugestão comercial opcional com base em consentimento, relevância, cooldown e limite. É obrigatória antes de qualquer oferta não solicitada.', parameters: { type: 'OBJECT', properties: { category: { type: 'STRING', description: 'Categoria factual e relevante retornada pelo perfil consentido' } }, required: ['category'] } },
  { name: 'solicitar_humano', description: 'Encaminha a conversa para atendimento humano em dúvidas sensíveis, exceções, reclamações ou pedido explícito.', parameters: { type: 'OBJECT', properties: { reason: { type: 'STRING' } }, required: ['reason'] } },
];

const TOOL_MAP = {
  consultar_loja: toolStore,
  buscar_produtos: toolProducts,
  listar_servicos: toolServices,
  listar_profissionais: toolProfessionals,
  consultar_disponibilidade: toolAvailability,
  consultar_status_pedido: toolOrderStatus,
  captar_cliente: toolCaptureLead,
  consultar_perfil_cliente: toolCustomerProfile,
  consultar_meus_agendamentos: toolCustomerAppointments,
  atualizar_consentimento_marketing: toolMarketingConsent,
  listar_promocoes_ativas: toolPromotions,
  preparar_promocao_cliente: toolPreparePromotion,
  preparar_agendamento: toolPrepareAppointment,
  preparar_remarcacao: toolPrepareReschedule,
  preparar_cancelamento: toolPrepareCancellation,
  preparar_pedido: toolPrepareOrder,
  propor_oportunidade: toolOpportunity,
  solicitar_humano: toolHuman,
};

export function createWhatsappAiToolExecutor(context) {
  let preparedAction = false;
  let primaryIntentResolved = false;
  return async (name, args) => {
    const tool = TOOL_MAP[name];
    if (!tool) throw new WhatsappAiToolError('ferramenta não permitida', 'TOOL_NOT_ALLOWED');
    const scoped = contextScope(context);
    if (!capabilityAllows(name, scoped.capabilities)) throw new WhatsappAiToolError('esta capacidade está desativada para a unidade', 'CAPABILITY_DISABLED');
    if (name.startsWith('preparar_')) {
      if (preparedAction) throw new WhatsappAiToolError('apenas uma ação pode ser preparada por mensagem', 'MULTIPLE_ACTIONS_NOT_ALLOWED');
      preparedAction = true;
    }
    context.primaryIntentResolved = primaryIntentResolved;
    let result;
    try {
      result = await tool(context, args || {});
    } catch (error) {
      if (error.name === 'WhatsappAiToolError') {
        return { ok: false, erro: error.message, codigoErro: error.errorCode };
      }
      throw error;
    }
    if (!['propor_oportunidade', 'solicitar_humano'].includes(name)) primaryIntentResolved = true;
    return result;
  };
}

export async function cancelPendingAction(context) {
  const scope = contextScope(context);
  return db.transaction(async trx => {
    const session = await trx.query(
      `SELECT acao_pendente FROM whatsapp_ai_sessions
        WHERE id = $1 AND empresa_id = $2 AND loja_id = $3 FOR UPDATE`,
      [scope.sessionId, scope.empresaId, scope.lojaId],
    );
    const actionId = session.rows[0]?.acao_pendente?.actionId;
    if (actionId) {
      await trx.query(
        `UPDATE whatsapp_ai_actions SET status = 'cancelada'
          WHERE id = $1 AND empresa_id = $2 AND loja_id = $3 AND status = 'preparada'`,
        [actionId, scope.empresaId, scope.lojaId],
      );
    }
    await trx.query(
      `UPDATE whatsapp_ai_sessions SET acao_pendente = NULL, atualizado_em = CURRENT_TIMESTAMP
        WHERE id = $1 AND empresa_id = $2 AND loja_id = $3`,
      [scope.sessionId, scope.empresaId, scope.lojaId],
    );
    return { ok: true, cancelled: Boolean(actionId) };
  });
}

export async function confirmPendingAction(context) {
  const scope = contextScope(context);
  return db.transaction(async trx => {
    const session = await trx.query(
      `SELECT acao_pendente FROM whatsapp_ai_sessions
        WHERE id = $1 AND empresa_id = $2 AND loja_id = $3 FOR UPDATE`,
      [scope.sessionId, scope.empresaId, scope.lojaId],
    );
    const pending = session.rows[0]?.acao_pendente;
    if (!pending?.actionId) throw new WhatsappAiToolError('não há ação pendente para confirmar', 'NO_PENDING_ACTION');
    const actionResult = await trx.query(
      `SELECT * FROM whatsapp_ai_actions
        WHERE id = $1 AND empresa_id = $2 AND loja_id = $3 FOR UPDATE`,
      [pending.actionId, scope.empresaId, scope.lojaId],
    );
    const action = actionResult.rows[0];
    if (!action) throw new WhatsappAiToolError('ação pendente não encontrada', 'ACTION_NOT_FOUND');
    if (action.status === 'concluida') return action.resposta;
    if (action.status !== 'preparada') throw new WhatsappAiToolError('ação não pode mais ser confirmada', 'ACTION_NOT_CONFIRMABLE');
    if (Date.now() - new Date(action.criado_em).getTime() > 30 * 60 * 1000) {
      await trx.query(
        `UPDATE whatsapp_ai_actions SET status = 'cancelada' WHERE id = $1 AND empresa_id = $2 AND loja_id = $3`,
        [action.id, scope.empresaId, scope.lojaId],
      );
      await trx.query(
        `UPDATE whatsapp_ai_sessions SET acao_pendente = NULL WHERE id = $1 AND empresa_id = $2 AND loja_id = $3`,
        [scope.sessionId, scope.empresaId, scope.lojaId],
      );
      throw new WhatsappAiToolError('a confirmação expirou; prepare a ação novamente', 'ACTION_EXPIRED');
    }

    await trx.query(
      `UPDATE whatsapp_ai_actions SET status = 'confirmada', confirmado_em = CURRENT_TIMESTAMP
        WHERE id = $1 AND empresa_id = $2 AND loja_id = $3`,
      [action.id, scope.empresaId, scope.lojaId],
    );
    let response;
    if (action.tipo === 'agendamento') {
      response = await createScheduledAppointment(trx, scope, action.solicitacao);
    } else if (action.tipo === 'pedido') {
      response = await createPendingOrder(trx, { empresaId: scope.empresaId, lojaId: scope.lojaId }, {
        ...action.solicitacao,
        idempotencyKey: action.chave_idempotencia,
        correlationId: `whatsapp:${action.id}`,
      });
      // Notificar Dino
      try {
        const myFetch = global.fetch;
        const tenantRes = await trx.query(`SELECT api_base_url, configuracao FROM canais_integracao WHERE id = $1`, [scope.canalId]);
        const tenant = tenantRes.rows[0];
        const apiUrl = tenant?.api_base_url || (process.env.EVOLUTION_API_URL || process.env.CHATBOT_BACKEND_URL) || 'http://localhost:8080';
        const apiKey = tenant?.configuracao?.segredo_env ? process.env[tenant.configuracao.segredo_env.replace('ENV:', '')] : (process.env.EVOLUTION_API_KEY || process.env.CHATBOT_BACKEND_KEY) || '';
        const instance = tenant?.configuracao?.instance || (process.env.EVOLUTION_INSTANCE || process.env.CHATBOT_BACKEND_INSTANCE) || 'dino';
        const dinoPhone = process.env.GESTOR_TELEFONE || '65999999999';
        const msg = `🛍️ *Nova Venda Fechada pelo IA!*
Pedido: ${response.publicCode}
Total: R$ ${Number(response.total).toFixed(2).replace('.', ',')}
O cliente enviará o comprovante PIX em breve.`;
        await myFetch(`${apiUrl.replace(/\/$/, '')}/message/sendText/${encodeURIComponent(instance)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: apiKey },
          body: JSON.stringify({ number: '55' + dinoPhone.replace(/\D/g, ''), text: msg, delay: 1200 }),
        });
      } catch (err) {
        console.warn('Erro notificando Dino sobre a venda', err);
      }
    } else if (action.tipo === 'remarcacao') {
      response = await rescheduleWhatsappAppointment(trx, scope, action.solicitacao);
    } else if (action.tipo === 'cancelamento') {
      response = await cancelWhatsappAppointment(trx, scope, action.solicitacao.appointmentId);
    } else if (action.tipo === 'promocao_cliente') {
      response = await queueWhatsappPromotion(trx, scope, action.solicitacao);
    } else {
      throw new WhatsappAiToolError('tipo de ação não permitido', 'ACTION_TYPE_NOT_ALLOWED');
    }

    await trx.query(
      `UPDATE whatsapp_ai_actions SET status = 'concluida', resposta = $2::jsonb, concluido_em = CURRENT_TIMESTAMP
        WHERE id = $1 AND empresa_id = $3 AND loja_id = $4`,
      [action.id, JSON.stringify(response), scope.empresaId, scope.lojaId],
    );
    await trx.query(
      `UPDATE whatsapp_ai_sessions SET acao_pendente = NULL, atualizado_em = CURRENT_TIMESTAMP
        WHERE id = $1 AND empresa_id = $2 AND loja_id = $3`,
      [scope.sessionId, scope.empresaId, scope.lojaId],
    );
    return { ok: true, type: action.tipo, result: response };
  });
}
