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

function ensureUuid(value, field) {
  const normalized = cleanText(value, 60);
  if (!UUID_REGEX.test(normalized)) throw new WhatsappAiToolError(`${field} inválido`, 'INVALID_ID');
  return normalized;
}

function contextScope(context = {}) {
  return {
    empresaId: ensureUuid(context.empresaId, 'empresaId'),
    lojaId: ensureUuid(context.lojaId, 'lojaId'),
    canalId: ensureUuid(context.canalId, 'canalId'),
    sessionId: ensureUuid(context.sessionId, 'sessionId'),
    phone: cleanText(context.phone, 20).replace(/\D/g, ''),
    customerName: cleanText(context.customerName, 100),
    externalEventId: cleanText(context.externalEventId, 180),
  };
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
  if (!result.rows[0]) throw new WhatsappAiToolError('loja virtual não configurada para esta unidade', 'STOREFRONT_NOT_READY');
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
  return { ok: true, loja: publicStoreData(await activeStorefront(contextScope(context))) };
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
    produtos: products.map(product => ({
      id: product.id,
      nome: product.nome,
      descricao: cleanText(product.descricao_curta || product.descricao, 320),
      categoria: product.category_name || '',
      variantes: (product.variants || []).map(variant => ({
        id: variant.id,
        sku: variant.sku,
        nome: variant.nome || product.nome,
        preco: productPrice(variant),
        estoque: Number(variant.estoque || 0),
      })).filter(variant => variant.preco > 0 && variant.estoque > 0),
    })).filter(product => product.variantes.length > 0),
  };
}

async function toolServices(context) {
  return { ok: true, servicos: await listSchedulingServices(contextScope(context)) };
}

async function toolProfessionals(context) {
  return { ok: true, profissionais: await listSchedulingProfessionals(contextScope(context)) };
}

async function toolAvailability(context, args = {}) {
  const scope = contextScope(context);
  return {
    ok: true,
    disponibilidade: await listSchedulingAvailability(scope, {
      serviceId: args.serviceId,
      professionalId: args.professionalId,
      date: args.date,
    }),
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
      [scope.sessionId, JSON.stringify({ actionId: action.id, type, key, summary }), scope.empresaId, scope.lojaId],
    );
    return {
      ok: true,
      acao: { id: action.id, tipo: type, resumo: summary },
      confirmacaoNecessaria: true,
      instrucao: 'Peça ao cliente para responder CONFIRMAR para concluir ou CANCELAR para desistir.',
    };
  });
}

async function toolPrepareAppointment(context, args = {}) {
  const scope = contextScope(context);
  const serviceId = ensureUuid(args.serviceId, 'serviceId');
  const professionalId = ensureUuid(args.professionalId, 'professionalId');
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
  const summarized = items.map(item => {
    const found = variants.get(item.variantId);
    if (!found || found.price <= 0 || Number(found.variant.estoque || 0) < item.quantity) {
      throw new WhatsappAiToolError('produto indisponível ou estoque insuficiente', 'ITEM_UNAVAILABLE');
    }
    const subtotal = Number((found.price * item.quantity).toFixed(2));
    total += subtotal;
    return { ...item, nome: found.product.nome, preco: found.price, subtotal };
  });
  const method = await db.queryRead(
    `SELECT id, nome FROM commerce_shipping_methods
      WHERE empresa_id = $1 AND storefront_id = $2 AND ativo = true AND tipo = 'pickup'
      ORDER BY criado_em ASC LIMIT 1`,
    [scope.empresaId, storefront.id],
  );
  if (!method.rows[0]) throw new WhatsappAiToolError('retirada não configurada para a loja', 'PICKUP_NOT_READY');
  const request = {
    storefrontId: storefront.id,
    shippingMethodId: method.rows[0].id,
    items,
    customer: { nome: cleanText(args.customerName || scope.customerName, 100), telefone: scope.phone },
    note: 'Pedido preparado pelo atendimento WhatsApp para retirada.',
  };
  const summary = `${summarized.map(item => `${item.quantity}x ${item.nome}`).join(', ')}. Total R$ ${total.toFixed(2).replace('.', ',')}; retirada na unidade.`;
  return savePreparedAction(scope, 'pedido', request, summary);
}

async function toolHuman(context, args = {}) {
  const scope = contextScope(context);
  const reason = cleanText(args.reason, 500) || 'Solicitação do cliente';
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
  { name: 'consultar_loja', description: 'Consulta endereço, contato, horário e retirada da unidade Dino.', parameters: { type: 'OBJECT', properties: {} } },
  { name: 'buscar_produtos', description: 'Busca produtos realmente publicados e com preço/estoque no catálogo Dino.', parameters: { type: 'OBJECT', properties: { query: { type: 'STRING', description: 'Nome, marca ou característica do produto' }, limit: { type: 'INTEGER', description: 'Máximo de resultados, entre 1 e 8' } } } },
  { name: 'listar_servicos', description: 'Lista serviços de barbearia ativos e seus valores/duração.', parameters: { type: 'OBJECT', properties: {} } },
  { name: 'listar_profissionais', description: 'Lista profissionais ativos da unidade.', parameters: { type: 'OBJECT', properties: {} } },
  { name: 'consultar_disponibilidade', description: 'Consulta horários disponíveis para serviço, profissional e data.', parameters: { type: 'OBJECT', properties: { serviceId: { type: 'STRING' }, professionalId: { type: 'STRING' }, date: { type: 'STRING', description: 'Data ISO AAAA-MM-DD' } }, required: ['serviceId', 'professionalId', 'date'] } },
  { name: 'consultar_status_pedido', description: 'Consulta um pedido somente quando pertence ao telefone desta conversa.', parameters: { type: 'OBJECT', properties: { orderCode: { type: 'STRING' } }, required: ['orderCode'] } },
  { name: 'preparar_agendamento', description: 'Prepara um agendamento para confirmação. Não grava o agendamento.', parameters: { type: 'OBJECT', properties: { serviceId: { type: 'STRING' }, professionalId: { type: 'STRING' }, date: { type: 'STRING' }, time: { type: 'STRING' }, customerName: { type: 'STRING' }, notes: { type: 'STRING' } }, required: ['serviceId', 'professionalId', 'date', 'time', 'customerName'] } },
  { name: 'preparar_pedido', description: 'Prepara um pedido de retirada para confirmação. Não cria o pedido.', parameters: { type: 'OBJECT', properties: { customerName: { type: 'STRING' }, items: { type: 'ARRAY', items: { type: 'OBJECT', properties: { variantId: { type: 'STRING' }, quantity: { type: 'INTEGER' } }, required: ['variantId', 'quantity'] } } }, required: ['customerName', 'items'] } },
  { name: 'solicitar_humano', description: 'Encaminha a conversa para atendimento humano em dúvidas sensíveis, exceções, reclamações ou pedido explícito.', parameters: { type: 'OBJECT', properties: { reason: { type: 'STRING' } }, required: ['reason'] } },
];

const TOOL_MAP = {
  consultar_loja: toolStore,
  buscar_produtos: toolProducts,
  listar_servicos: toolServices,
  listar_profissionais: toolProfessionals,
  consultar_disponibilidade: toolAvailability,
  consultar_status_pedido: toolOrderStatus,
  preparar_agendamento: toolPrepareAppointment,
  preparar_pedido: toolPrepareOrder,
  solicitar_humano: toolHuman,
};

export function createWhatsappAiToolExecutor(context) {
  let preparedAction = false;
  return async (name, args) => {
    const tool = TOOL_MAP[name];
    if (!tool) throw new WhatsappAiToolError('ferramenta não permitida', 'TOOL_NOT_ALLOWED');
    if (name.startsWith('preparar_')) {
      if (preparedAction) throw new WhatsappAiToolError('apenas uma ação pode ser preparada por mensagem', 'MULTIPLE_ACTIONS_NOT_ALLOWED');
      preparedAction = true;
    }
    return tool(context, args || {});
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
          WHERE id = $1 AND empresa_id = $2 AND status = 'preparada'`,
        [actionId, scope.empresaId],
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
      await trx.query(`UPDATE whatsapp_ai_actions SET status = 'cancelada' WHERE id = $1`, [action.id]);
      await trx.query(`UPDATE whatsapp_ai_sessions SET acao_pendente = NULL WHERE id = $1`, [scope.sessionId]);
      throw new WhatsappAiToolError('a confirmação expirou; prepare a ação novamente', 'ACTION_EXPIRED');
    }

    await trx.query(`UPDATE whatsapp_ai_actions SET status = 'confirmada', confirmado_em = CURRENT_TIMESTAMP WHERE id = $1`, [action.id]);
    let response;
    if (action.tipo === 'agendamento') {
      response = await createScheduledAppointment(trx, scope, action.solicitacao);
    } else if (action.tipo === 'pedido') {
      response = await createPendingOrder(trx, { empresaId: scope.empresaId, lojaId: scope.lojaId }, {
        ...action.solicitacao,
        idempotencyKey: action.chave_idempotencia,
        correlationId: `whatsapp:${action.id}`,
      });
    } else {
      throw new WhatsappAiToolError('tipo de ação não permitido', 'ACTION_TYPE_NOT_ALLOWED');
    }

    await trx.query(
      `UPDATE whatsapp_ai_actions SET status = 'concluida', resposta = $2::jsonb, concluido_em = CURRENT_TIMESTAMP WHERE id = $1`,
      [action.id, JSON.stringify(response)],
    );
    await trx.query(
      `UPDATE whatsapp_ai_sessions SET acao_pendente = NULL, atualizado_em = CURRENT_TIMESTAMP WHERE id = $1`,
      [scope.sessionId],
    );
    return { ok: true, type: action.tipo, result: response };
  });
}
