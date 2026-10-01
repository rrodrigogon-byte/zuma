import { canonicalWhatsappPhone, phoneMatchKeySql } from './whatsapp-phone.js';
import crypto from 'node:crypto';
import { db } from './database.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const POLICY_EVENT_TYPES = new Set([
  'profile_resolved', 'profile_ambiguous', 'personalization_prompted',
  'personalization_granted', 'personalization_revoked', 'opportunity_allowed',
  'opportunity_blocked', 'opportunity_offered', 'opportunity_declined',
  'output_blocked', 'injection_suspected', 'sensitive_input_blocked',
]);

function clean(value, limit = 500) {
  return String(value || '').trim().replace(/\u0000/g, '').replace(/[\r\n\t]+/g, ' ').slice(0, limit);
}

function plain(value) {
  return clean(value, 4000).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function clampInteger(value, minimum, maximum, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

function uuid(value, field) {
  const normalized = clean(value, 60);
  if (!UUID_PATTERN.test(normalized)) {
    const error = new Error(`${field} inválido`);
    error.code = 'INVALID_CONTEXT';
    throw error;
  }
  return normalized;
}

export function normalizeWhatsappProfilePhone(value) {
  return canonicalWhatsappPhone(value);
}

function firstName(value) {
  const candidate = clean(value, 80).split(/\s+/)[0] || '';
  return candidate.replace(/[^\p{L}'’-]/gu, '').slice(0, 60);
}

function safePreferenceTime(value) {
  const normalized = plain(value);
  if (/\bmanha\b/.test(normalized)) return 'manhã';
  if (/\btarde\b/.test(normalized)) return 'tarde';
  if (/\bnoite\b/.test(normalized)) return 'noite';
  return '';
}

function safePolicyMetadata(input = {}) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const allowed = ['category', 'source', 'policyVersion', 'cooldownDays', 'maxOpportunities', 'blockedField', 'detector'];
  return Object.fromEntries(allowed
    .filter(key => source[key] !== undefined && source[key] !== null)
    .map(key => [key, typeof source[key] === 'number' ? source[key] : clean(source[key], 120)]));
}

export function whatsappAiPolicy(channel = {}) {
  const source = channel?.configuracao?.ai_policy && typeof channel.configuracao.ai_policy === 'object'
    ? channel.configuracao.ai_policy
    : {};
  return {
    version: 1,
    personalizationEnabled: source.personalization_enabled === true,
    opportunitiesEnabled: source.opportunities_enabled === true,
    maxOpportunities: Math.min(1, clampInteger(source.max_opportunities, 0, 1, 1)),
    cooldownDays: clampInteger(source.cooldown_days, 7, 90, 30),
    privacyNotice: clean(source.privacy_notice, 500),
  };
}

export function personalizationConsentIntent(text, { prompted = false } = {}) {
  const value = plain(text).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const grant = new Set(['sim personalizar', 'pode personalizar', 'autorizo personalizacao', 'sim pode usar meu historico']);
  const revoke = new Set(['nao personalizar', 'nao personalize', 'revogar personalizacao', 'esqueca minhas preferencias', 'esquecer minhas preferencias']);
  if (grant.has(value)) return 'grant';
  if (revoke.has(value) || (prompted && ['nao', 'não'].includes(value))) return 'revoke';
  return null;
}

export function shouldPromptPersonalization(text) {
  const value = plain(text);
  return /\b(recomenda|recomendar|recomendacao|sugestao|sugerir|combina comigo|qual escolher|o que escolher)\b/.test(value);
}

export function recommendationRequested(text) {
  return shouldPromptPersonalization(text);
}

function luhnValid(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19 || /^(\d)\1+$/.test(digits)) return false;
  let sum = 0;
  let doubleDigit = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (doubleDigit) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    doubleDigit = !doubleDigit;
  }
  return sum % 10 === 0;
}

export function sensitiveCustomerData(text) {
  const value = clean(text, 4000);
  if (/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b|\b\d{2}\.?\d{3}\.?\d{3}\/\d{4}-?\d{2}\b/.test(value)) return 'DOCUMENT';
  if (/\b(cvv|cvc|senha|password|token|codigo de seguranca|código de segurança)\b/i.test(value)) return 'CREDENTIAL';
  const candidates = value.match(/(?:\d[ -]?){13,19}/g) || [];
  if (candidates.some(candidate => {
    const digits = candidate.replace(/\D/g, '');
    if (/^55\d{10,11}$/.test(digits)) return false;
    return luhnValid(digits);
  })) return 'PAYMENT_CARD';
  return null;
}

export function suspiciousPromptInjection(text) {
  const value = plain(text);
  return /\b(ignore|ignorar|desconsidere|revele|mostrar|mostre|exiba)\b.{0,80}\b(instrucao|instrucoes|prompt|token|segredo|chave de api|api key|sistema)\b/.test(value)
    || /\b(system prompt|developer message|jailbreak|modo desenvolvedor)\b/.test(value);
}

export async function recordWhatsappAiPolicyEvent(context = {}, type, { reasonCode = null, metadata = {}, eventKey = null } = {}) {
  if (!POLICY_EVENT_TYPES.has(type)) throw new Error('tipo de evento de política inválido');
  const empresaId = uuid(context.empresaId, 'empresaId');
  const lojaId = uuid(context.lojaId, 'lojaId');
  const canalId = uuid(context.canalId, 'canalId');
  const sessionId = UUID_PATTERN.test(String(context.sessionId || '')) ? context.sessionId : null;
  const normalizedKey = clean(eventKey, 180) || null;
  await db.query(
    `INSERT INTO whatsapp_ai_policy_events
      (empresa_id, loja_id, canal_id, sessao_id, event_key, tipo, reason_code, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     ON CONFLICT (empresa_id, event_key) WHERE event_key IS NOT NULL DO NOTHING`,
    [empresaId, lojaId, canalId, sessionId, normalizedKey, type, clean(reasonCode, 80) || null, JSON.stringify(safePolicyMetadata(metadata))],
  );
}

async function crmMatches(empresaId, phone, query = db.queryRead.bind(db)) {
  return query(
    `SELECT id, nome
       FROM clientes
      WHERE empresa_id = $1 AND ativo = true
        AND ${phoneMatchKeySql('telefone')} = ${phoneMatchKeySql('$2')}
      ORDER BY criado_em ASC LIMIT 2`,
    [empresaId, phone],
  );
}

async function consentForCustomer(empresaId, customerId) {
  if (!customerId) return { personalization: false, marketing: false };
  const result = await db.queryRead(
    `SELECT finalidade, concedido
       FROM consentimentos_cliente
      WHERE empresa_id = $1 AND cliente_id = $2 AND canal = 'whatsapp'
        AND finalidade IN ('atendimento_personalizado','marketing')`,
    [empresaId, customerId],
  );
  return {
    personalization: result.rows.some(row => row.finalidade === 'atendimento_personalizado' && row.concedido === true),
    marketing: result.rows.some(row => row.finalidade === 'marketing' && row.concedido === true),
  };
}

async function commerceProfile(empresaId, lojaId, phone) {
  const result = await db.queryRead(
    `WITH matching_customers AS (
       SELECT id, nome
         FROM commerce_customers
        WHERE empresa_id = $1 AND bloqueado = false
          AND ${phoneMatchKeySql('telefone')} = ${phoneMatchKeySql('$3')}
     ), scoped_orders AS (
       SELECT o.id, o.customer_id, o.criado_em
         FROM commerce_orders o
         JOIN commerce_storefronts s ON s.empresa_id = o.empresa_id AND s.id = o.storefront_id
        WHERE o.empresa_id = $1 AND s.loja_id = $2
          AND o.customer_id IN (SELECT id FROM matching_customers)
          AND o.status NOT IN ('draft','cancelled','refunded','returned')
          AND o.criado_em >= CURRENT_TIMESTAMP - INTERVAL '365 days'
     ), ranked_categories AS (
       SELECT COALESCE(NULLIF(c.nome, ''), 'Outros') AS category_name, COUNT(*)::int AS frequency
         FROM scoped_orders o
         JOIN commerce_order_items oi ON oi.empresa_id = $1 AND oi.order_id = o.id
         LEFT JOIN commerce_product_variants v ON v.empresa_id = $1 AND v.id = oi.variant_id
         LEFT JOIN commerce_products p ON p.empresa_id = $1 AND p.id = v.product_id
         LEFT JOIN commerce_categories c ON c.empresa_id = $1 AND c.id = p.category_id
        GROUP BY COALESCE(NULLIF(c.nome, ''), 'Outros')
        ORDER BY frequency DESC, category_name ASC
        LIMIT 3
     )
     SELECT
       (SELECT COUNT(*)::int FROM matching_customers) AS customer_count,
       (SELECT COUNT(DISTINCT lower(trim(nome)))::int FROM matching_customers) AS distinct_name_count,
       (SELECT min(nome) FROM matching_customers) AS customer_name,
       (SELECT COUNT(*)::int FROM scoped_orders) AS order_count,
       (SELECT max(criado_em) FROM scoped_orders) AS last_order_at,
       COALESCE((SELECT jsonb_agg(jsonb_build_object('name', category_name, 'frequency', frequency)) FROM ranked_categories), '[]'::jsonb) AS categories`,
    [empresaId, lojaId, phone],
  );
  return result.rows[0] || { customer_count: 0, distinct_name_count: 0, order_count: 0, categories: [] };
}

async function barbershopProfile(empresaId, phone) {
  try {
    const result = await db.queryRead(
      `SELECT nome, total_visitas, ultima_visita, preferencias
         FROM clientes_barbearia
        WHERE empresa_id = $1 AND ativo = true
          AND ${phoneMatchKeySql('telefone')} = ${phoneMatchKeySql('$2')}
        LIMIT 2`,
      [empresaId, phone],
    );
    return result.rows;
  } catch (error) {
    if (error?.code === '42P01') return [];
    throw error;
  }
}

function recencyBucket(value) {
  if (!value) return null;
  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000));
  if (days <= 30) return 'até 30 dias';
  if (days <= 90) return '31 a 90 dias';
  if (days <= 180) return '91 a 180 dias';
  return '181 a 365 dias';
}

export async function resolveWhatsappCustomerProfile(context = {}, channel = {}, session = {}) {
  const empresaId = uuid(context.empresaId, 'empresaId');
  const lojaId = uuid(context.lojaId, 'lojaId');
  const canalId = uuid(context.canalId, 'canalId');
  const sessionId = uuid(context.sessionId, 'sessionId');
  const phone = normalizeWhatsappProfilePhone(context.phone);
  const policy = whatsappAiPolicy(channel);
  if (!phone) return { policy, ambiguous: true, profile: null, consent: { personalization: false, marketing: false } };
  if (!policy.personalizationEnabled) {
    return {
      policy,
      ambiguous: false,
      profile: {
        schemaVersion: 1,
        asOf: new Date().toISOString(),
        identity: { preferredName: firstName(context.customerName), relationship: 'não personalizado' },
        consent: { personalization: false, marketing: false },
        declaredPreferences: {},
        observedFacts: {},
        engagement: { opportunityAllowed: false, opportunityCount: 0, opportunityDeclined: false, handoffRequired: session?.status === 'humano' },
      },
      consent: { personalization: false, marketing: false },
      crmCustomerId: null,
    };
  }

  const crm = await crmMatches(empresaId, phone);
  const crmRows = crm.rows;
  const crmAmbiguous = crmRows.length > 1;
  const consent = await consentForCustomer(empresaId, crmAmbiguous ? null : crmRows[0]?.id);
  const eligibleForHistory = policy.personalizationEnabled && consent.personalization && !crmAmbiguous;
  const [commerce, barbershop] = eligibleForHistory
    ? await Promise.all([
      commerceProfile(empresaId, lojaId, phone),
      barbershopProfile(empresaId, phone),
    ])
    : [{ customer_count: 0, distinct_name_count: 0, order_count: 0, categories: [] }, []];
  const ambiguous = crmAmbiguous || Number(commerce.distinct_name_count || 0) > 1 || barbershop.length > 1;
  const personalizationAllowed = eligibleForHistory && !ambiguous;
  const marketingAllowed = consent.marketing && session?.estado?.marketingOptOut !== true && !ambiguous;
  const sessionName = firstName(context.customerName);
  const knownName = personalizationAllowed
    ? firstName(crmRows[0]?.nome || commerce.customer_name || barbershop[0]?.nome || context.customerName)
    : sessionName;
  const commerceCategories = Array.isArray(commerce.categories) ? commerce.categories : [];
  const safeCategories = commerceCategories
    .filter(item => Number(item?.frequency || 0) >= 2)
    .map(item => sanitizeUntrustedBusinessText(item?.name, 80))
    .filter(Boolean)
    .slice(0, 3);
  const preferredTime = safePreferenceTime(barbershop[0]?.preferencias?.horario_preferido);
  const visits = Number(barbershop[0]?.total_visitas || 0);
  const orders = Number(commerce.order_count || 0);
  const profile = {
    schemaVersion: 1,
    asOf: new Date().toISOString(),
    identity: {
      preferredName: knownName,
      relationship: personalizationAllowed
        ? (visits + orders >= 2 ? 'recorrente' : (visits + orders === 1 ? 'conhecido' : 'novo'))
        : 'não personalizado',
    },
    consent: {
      personalization: personalizationAllowed,
      marketing: marketingAllowed,
    },
    declaredPreferences: personalizationAllowed ? {
      timeWindow: preferredTime || null,
    } : {},
    observedFacts: personalizationAllowed ? {
      frequentProductCategories: safeCategories,
      lastInteractionBucket: recencyBucket(commerce.last_order_at || barbershop[0]?.ultima_visita),
    } : {},
    engagement: {
      opportunityAllowed: policy.opportunitiesEnabled && personalizationAllowed && marketingAllowed,
      opportunityCount: Number(session?.opportunity_count || 0),
      opportunityDeclined: Boolean(session?.opportunity_declined_at),
      handoffRequired: session?.status === 'humano',
    },
  };
  await recordWhatsappAiPolicyEvent({ empresaId, lojaId, canalId, sessionId }, ambiguous ? 'profile_ambiguous' : 'profile_resolved', {
    reasonCode: ambiguous ? 'IDENTITY_AMBIGUOUS' : (personalizationAllowed ? 'PERSONALIZED' : 'ESSENTIAL_ONLY'),
    metadata: { source: personalizationAllowed ? 'consented_sources' : 'essential' },
    eventKey: `profile:${sessionId}:${clean(context.externalEventId, 100) || crypto.randomUUID()}`,
  });
  return { policy, ambiguous, profile, consent: { personalization: personalizationAllowed, marketing: marketingAllowed }, crmCustomerId: ambiguous ? null : (crmRows[0]?.id || null) };
}

async function ensureCrmCustomer(trx, context, session) {
  const phone = normalizeWhatsappProfilePhone(session.telefone || context.phone);
  if (!phone) throw Object.assign(new Error('telefone inválido para consentimento'), { code: 'INVALID_PHONE' });
  const matches = await crmMatches(context.empresaId, phone, trx.query.bind(trx));
  if (matches.rows.length > 1) throw Object.assign(new Error('cadastro ambíguo; atendimento humano obrigatório'), { code: 'IDENTITY_AMBIGUOUS' });
  if (matches.rows[0]) return matches.rows[0];
  const inserted = await trx.query(
    `INSERT INTO clientes (empresa_id, nome, telefone, tags)
     VALUES ($1, $2, $3, '["whatsapp_ai"]'::jsonb)
     RETURNING id, nome`,
    [context.empresaId, clean(session.nome || context.customerName, 200) || 'Cliente WhatsApp', phone],
  );
  return inserted.rows[0];
}

export async function applyWhatsappPersonalizationConsent(context = {}, session = {}, granted, externalEventId = '') {
  const scope = {
    empresaId: uuid(context.empresaId, 'empresaId'),
    lojaId: uuid(context.lojaId, 'lojaId'),
    canalId: uuid(context.canalId, 'canalId'),
    sessionId: uuid(context.sessionId, 'sessionId'),
    customerName: clean(context.customerName, 160),
  };
  const evidenceHash = crypto.createHash('sha256').update(`${scope.canalId}:${clean(externalEventId, 200)}`).digest('hex');
  return db.transaction(async trx => {
    const customer = await ensureCrmCustomer(trx, scope, session);
    await trx.query(
      `INSERT INTO consentimentos_cliente
        (empresa_id, cliente_id, canal, finalidade, concedido, origem, evidencia)
       VALUES ($1, $2, 'whatsapp', 'atendimento_personalizado', $3, $4, $5::jsonb)
       ON CONFLICT (empresa_id, cliente_id, canal, finalidade) DO UPDATE
         SET concedido = EXCLUDED.concedido, origem = EXCLUDED.origem,
             evidencia = EXCLUDED.evidencia, atualizado_em = CURRENT_TIMESTAMP`,
      [scope.empresaId, customer.id, granted === true, granted ? 'whatsapp_ai_cliente' : 'revogacao_cliente', JSON.stringify({ eventHash: evidenceHash, recordedAt: new Date().toISOString() })],
    );
    await trx.query(
      `UPDATE whatsapp_ai_sessions
          SET personalization_prompted_at = NULL,
              atualizado_em = CURRENT_TIMESTAMP
        WHERE id = $1 AND empresa_id = $2 AND loja_id = $3`,
      [scope.sessionId, scope.empresaId, scope.lojaId],
    );
    await trx.query(
      `INSERT INTO whatsapp_ai_policy_events
        (empresa_id, loja_id, canal_id, sessao_id, event_key, tipo, reason_code, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       ON CONFLICT (empresa_id, event_key) WHERE event_key IS NOT NULL DO NOTHING`,
      [scope.empresaId, scope.lojaId, scope.canalId, scope.sessionId, `consent:${scope.sessionId}:${evidenceHash.slice(0, 40)}`,
        granted ? 'personalization_granted' : 'personalization_revoked', granted ? 'CUSTOMER_GRANTED' : 'CUSTOMER_REVOKED',
        JSON.stringify({ source: granted ? 'whatsapp_ai_cliente' : 'revogacao_cliente', policyVersion: 1 })],
    );
    return { granted: granted === true, customerId: customer.id };
  });
}

export async function markPersonalizationPrompted(context = {}, session = {}, externalEventId = '') {
  await db.transaction(async trx => {
    await trx.query(
      `UPDATE whatsapp_ai_sessions
          SET personalization_prompted_at = COALESCE(personalization_prompted_at, CURRENT_TIMESTAMP),
              atualizado_em = CURRENT_TIMESTAMP
        WHERE id = $1 AND empresa_id = $2 AND loja_id = $3`,
      [context.sessionId, context.empresaId, context.lojaId],
    );
    await trx.query(
      `INSERT INTO whatsapp_ai_policy_events
        (empresa_id, loja_id, canal_id, sessao_id, event_key, tipo, reason_code, metadata)
       VALUES ($1, $2, $3, $4, $5, 'personalization_prompted', 'RECOMMENDATION_CONTEXT', '{"policyVersion":1}'::jsonb)
       ON CONFLICT (empresa_id, event_key) WHERE event_key IS NOT NULL DO NOTHING`,
      [context.empresaId, context.lojaId, context.canalId, context.sessionId, `personalization-prompt:${context.sessionId}:${clean(externalEventId, 100)}`],
    );
  });
}

function daysSince(value) {
  return value ? Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000)) : Number.POSITIVE_INFINITY;
}

export function opportunityGate({ policy = {}, profile = null, session = {}, category = '', primaryIntentResolved = false } = {}) {
  if (!primaryIntentResolved) return { allowed: false, reason: 'PRIMARY_INTENT_NOT_RESOLVED' };
  if (!policy.opportunitiesEnabled) return { allowed: false, reason: 'OPPORTUNITIES_DISABLED' };
  if (!profile?.consent?.personalization) return { allowed: false, reason: 'PERSONALIZATION_NOT_GRANTED' };
  if (!profile?.consent?.marketing) return { allowed: false, reason: 'MARKETING_NOT_GRANTED' };
  if (session.status === 'humano') return { allowed: false, reason: 'HUMAN_HANDOFF' };
  if (session.opportunity_declined_at && daysSince(session.opportunity_declined_at) < Number(policy.cooldownDays || 30)) return { allowed: false, reason: 'COOLDOWN_ACTIVE' };
  if (Number(session.opportunity_count || 0) >= Number(policy.maxOpportunities || 1)) return { allowed: false, reason: 'CONVERSATION_LIMIT' };
  const normalizedCategory = plain(category);
  const relevant = (profile.observedFacts?.frequentProductCategories || []).some(item => plain(item) === normalizedCategory);
  if (!normalizedCategory || !relevant) return { allowed: false, reason: 'NOT_RELEVANT' };
  return { allowed: true, reason: 'CONSENTED_RELEVANT_OPPORTUNITY' };
}

export async function registerOpportunityDecision(context = {}, { allowed, reason, category = '', offered = false } = {}) {
  const type = offered ? 'opportunity_offered' : (allowed ? 'opportunity_allowed' : 'opportunity_blocked');
  await db.transaction(async trx => {
    if (offered) {
      await trx.query(
        `UPDATE whatsapp_ai_sessions
            SET opportunity_offered_at = CURRENT_TIMESTAMP,
                opportunity_count = LEAST(10, opportunity_count + 1),
                atualizado_em = CURRENT_TIMESTAMP
          WHERE id = $1 AND empresa_id = $2 AND loja_id = $3`,
        [context.sessionId, context.empresaId, context.lojaId],
      );
    }
    await trx.query(
      `INSERT INTO whatsapp_ai_policy_events
        (empresa_id, loja_id, canal_id, sessao_id, event_key, tipo, reason_code, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       ON CONFLICT (empresa_id, event_key) WHERE event_key IS NOT NULL DO NOTHING`,
      [context.empresaId, context.lojaId, context.canalId, context.sessionId,
        `opportunity:${context.sessionId}:${clean(context.externalEventId, 100)}:${type}`,
        type, clean(reason, 80), JSON.stringify(safePolicyMetadata({ category, policyVersion: 1 }))],
    );
  });
}

export function sanitizeUntrustedBusinessText(value, limit = 320) {
  const source = clean(value, limit);
  if (suspiciousPromptInjection(source)) return '[conteúdo administrativo removido por segurança]';
  return source.replace(/<\/?(?:system|assistant|user|tool)[^>]*>/gi, '').slice(0, limit);
}

export function validateWhatsappAiOutput(text, { traces = [], recommendationWasRequested = false, opportunityAllowed = false } = {}) {
  const value = clean(text, 4000);
  const normalized = plain(value);
  const violations = [];
  if (!value) violations.push('EMPTY_OUTPUT');
  if (/\b(GEMINI_API_KEY|EVOLUTION_API_KEY|WHATSAPP_AI_WEBHOOK_SECRET|system prompt|developer message)\b/i.test(value)) violations.push('SECRET_OR_PROMPT_REFERENCE');
  if (/\b(?:\d[ -]?){13,19}\b/.test(value)) violations.push('POSSIBLE_PAYMENT_CARD');
  if (/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b|\b\d{2}\.?\d{3}\.?\d{3}\/\d{4}-?\d{2}\b/.test(value)) violations.push('POSSIBLE_DOCUMENT');
  if (/https?:\/\//i.test(value)) violations.push('UNAPPROVED_URL');
  if (/\b(ultima chance|imperdivel|voce precisa|compre agora|nao perca|so hoje)\b/.test(normalized)) violations.push('PRESSURE_LANGUAGE');
  const opportunityLanguage = /\b(oferta|promocao|aproveite|recomendo|sugiro|temos tambem|voce pode gostar|combina com|posso te mostrar uma opcao|que tal adicionar|adicionar ao pedido)\b/.test(normalized);
  const opportunityTrace = traces.some(trace => trace?.name === 'propor_oportunidade' && trace?.ok === true);
  if (opportunityLanguage && !recommendationWasRequested && !(opportunityAllowed && opportunityTrace)) violations.push('UNGOVERNED_OPPORTUNITY');
  return { ok: violations.length === 0, text: value, violations };
}

export async function whatsappAiPolicyMetrics(context = {}) {
  const result = await db.queryRead(
    `SELECT tipo, COUNT(*)::int AS total
       FROM whatsapp_ai_policy_events
      WHERE empresa_id = $1 AND loja_id = $2
        AND criado_em >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
      GROUP BY tipo`,
    [uuid(context.empresaId, 'empresaId'), uuid(context.lojaId, 'lojaId')],
  );
  return Object.fromEntries(result.rows.map(row => [row.tipo, Number(row.total || 0)]));
}
