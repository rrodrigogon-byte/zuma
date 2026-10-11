import crypto from 'node:crypto';
import { CommerceError, assertUuid, tenantContext } from './commerce-core.js';
import { shippingProviders, shippingSecretConfigured } from './shipping-adapters.js';
import { pickupOnlyItems, PICKUP_ONLY_ERROR_CODE, PICKUP_ONLY_MESSAGE } from './commerce-pickup-rules.js';

const SECRET_REF = /^env:[A-Z][A-Z0-9_]{2,}$/;
const CEP = /^\d{8}$/;
const ALLOWED_METHODS = new Set(['melhorenvio', 'correios', 'manual']);

const SHIPPING_PROVIDERS = [
  { code: 'melhorenvio', name: 'Melhor Envio', adapter: true, methods: ['quote', 'label', 'tracking'] },
  { code: 'correios', name: 'Correios', adapter: true, methods: ['quote', 'label', 'tracking'], label: true, note: 'Pré-postagem e rótulo dependem de API 36/serviço contratado liberados no CWS.' },
  { code: 'manual', name: 'Tabela manual Kytto', adapter: true, methods: ['quote'], note: 'Regras por município/UF definidas pela loja; não gera etiqueta nem rastreio automático.' },
  { code: 'frenet', name: 'Frenet', adapter: false, methods: ['quote', 'label', 'tracking'] },
];

function text(value, max = 240) { return String(value ?? '').trim().slice(0, max); }
function nullableText(value, max = 240) { const normalized = text(value, max); return normalized || null; }
function number(value, fallback = null) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
function round(value) { return Math.round((number(value, 0) + Number.EPSILON) * 100) / 100; }

export function isValidCpfCnpj(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (![11, 14].includes(digits.length) || /^([0-9])\1+$/.test(digits)) return false;
  const calculate = (base, weights) => {
    const total = weights.reduce((sum, weight, index) => sum + Number(base[index]) * weight, 0);
    const remainder = total % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  if (digits.length === 11) {
    const first = calculate(digits.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
    const second = calculate(digits.slice(0, 9) + first, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
    return first === Number(digits[9]) && second === Number(digits[10]);
  }
  const first = calculate(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = calculate(digits.slice(0, 12) + first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return first === Number(digits[12]) && second === Number(digits[13]);
}

export function normalizeCep(value) {
  const normalized = String(value ?? '').replace(/\D/g, '');
  if (!CEP.test(normalized)) throw new CommerceError('CEP deve conter 8 dígitos', 'SHIPPING_CEP_INVALID');
  return normalized;
}

export function normalizeShippingAddress(input = {}, { requireComplete = true } = {}) {
  if (!input || typeof input !== 'object') throw new CommerceError('endereço de entrega é obrigatório', 'SHIPPING_ADDRESS_REQUIRED');
  const address = {
    modo: text(input.modo || 'entrega', 20),
    destinatario: text(input.destinatario, 240),
    email: nullableText(input.email, 320)?.toLowerCase() || null,
    telefone: nullableText(input.telefone || input.phone, 30),
    documento: nullableText(input.documento || input.document, 40),
    companyDocument: nullableText(input.companyDocument || input.company_document, 40),
    cep: normalizeCep(input.cep),
    logradouro: nullableText(input.logradouro, 240),
    numero: nullableText(input.numero, 30),
    complemento: nullableText(input.complemento, 120),
    bairro: nullableText(input.bairro, 120),
    cidade: nullableText(input.cidade, 120),
    estado: nullableText(input.estado, 2)?.toUpperCase() || null,
    referencia: nullableText(input.referencia, 240),
  };
  if (!address.destinatario) throw new CommerceError('destinatário do endereço é obrigatório', 'SHIPPING_ADDRESS_REQUIRED');
  if (address.estado && !/^[A-Z]{2}$/.test(address.estado)) throw new CommerceError('UF do endereço é inválida', 'SHIPPING_ADDRESS_STATE_INVALID');
  if (requireComplete && (!address.logradouro || !address.numero || !address.bairro || !address.cidade || !address.estado)) {
    throw new CommerceError('complete logradouro, número, bairro, cidade e UF para entrega', 'SHIPPING_ADDRESS_INCOMPLETE');
  }
  if (requireComplete && !address.documento && !address.companyDocument) throw new CommerceError('CPF ou CNPJ do destinatário é obrigatório para entrega', 'SHIPPING_ADDRESS_DOCUMENT_REQUIRED');
  if (requireComplete && !isValidCpfCnpj(address.documento || address.companyDocument)) throw new CommerceError('CPF ou CNPJ do destinatário é inválido', 'SHIPPING_ADDRESS_DOCUMENT_INVALID');
  return address;
}

function safeConfig(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const config = {};
  if (source.provider) config.provider = text(source.provider, 60).toLowerCase();
  if (source.shippingAccountId) config.shippingAccountId = assertUuid(source.shippingAccountId, 'shippingAccountId');
  if (source.origemCep || source.originPostalCode) config.origemCep = normalizeCep(source.origemCep || source.originPostalCode);
  if (source.origin && typeof source.origin === 'object') {
    const origin = source.origin;
    config.origin = {
      name: text(origin.name, 240), email: text(origin.email, 320).toLowerCase(), phone: text(origin.phone, 30), document: text(origin.document, 20), companyDocument: text(origin.companyDocument || origin.company_document, 20), stateRegister: text(origin.stateRegister || origin.state_register, 40), address: text(origin.address || origin.logradouro, 240), number: text(origin.number || origin.numero, 30), complement: text(origin.complement || origin.complemento, 120), district: text(origin.district || origin.bairro, 120), city: text(origin.city || origin.cidade, 120), postalCode: normalizeCep(origin.postalCode || origin.postal_code || origin.cep), stateAbbr: text(origin.stateAbbr || origin.state_abbr || origin.estado, 2).toUpperCase(),
    };
  }
  if (source.services !== undefined) config.services = Array.isArray(source.services) ? source.services.map(value => String(value).replace(/\D/g, '')).filter(Boolean).slice(0, 20) : [];
  if (source.servicesAdditional !== undefined) config.servicesAdditional = Array.isArray(source.servicesAdditional) ? source.servicesAdditional.map(value => String(value).replace(/\D/g, '')).filter(Boolean).slice(0, 20) : [];
  if (source.contractNumber) config.contractNumber = text(source.contractNumber, 40);
  if (source.postingCard || source.cardNumber) config.postingCard = text(source.postingCard || source.cardNumber, 40);
  if (source.objectType) config.objectType = text(source.objectType, 8);
  if (source.prepostagemApiEnabled !== undefined) config.prepostagemApiEnabled = source.prepostagemApiEnabled === true;
  if (source.modalidadePagamento !== undefined) config.modalidadePagamento = text(source.modalidadePagamento, 1);
  if (source.labelType !== undefined) config.labelType = text(source.labelType, 1).toUpperCase();
  if (source.labelFormat !== undefined) config.labelFormat = text(source.labelFormat, 2).toUpperCase();
  if (source.labelLayout !== undefined) config.labelLayout = text(source.labelLayout, 30).toUpperCase();
  if (source.serviceNames && typeof source.serviceNames === 'object') config.serviceNames = Object.fromEntries(Object.entries(source.serviceNames).slice(0, 20).map(([key, value]) => [String(key).replace(/\D/g, '').slice(0, 8), text(value, 160)]).filter(([key, value]) => key && value));
  if (source.options && typeof source.options === 'object') config.options = { receipt: source.options.receipt === true, ownHand: source.options.ownHand === true };
  if (source.userAgent) config.userAgent = text(source.userAgent, 240);
  if (source.webhookSecretRef) {
    const ref = text(source.webhookSecretRef, 240);
    if (!SECRET_REF.test(ref)) throw new CommerceError('webhookSecretRef deve ser uma referência env:VARIAVEL', 'SHIPPING_SECRET_REF_INVALID');
    config.webhookSecretRef = ref;
  }
  if (source.shipment && typeof source.shipment === 'object') {
    const shipment = {};
    if (source.shipment.nonCommercial !== undefined) shipment.nonCommercial = source.shipment.nonCommercial === true;
    if (source.shipment.invoiceKey) shipment.invoiceKey = text(source.shipment.invoiceKey, 80);
    config.shipment = shipment;
  }
  return config;
}

const OWN_DELIVERY_TYPES = new Set(['motoboy', 'regional_table', 'express', 'free_shipping']);
const OWN_DELIVERY_NUMBERS = ['baseFee', 'pricePerKm', 'pricePerZone', 'fixedFee', 'additionalFee', 'freeShippingAbove', 'maxRadiusKm', 'distanceKm'];
const BRAZIL_REGIONS = new Set(['norte', 'nordeste', 'centro-oeste', 'sudeste', 'sul']);
const BRAZIL_UFS = new Set(['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']);
const DINO_LOCAL_CEP_FROM = '78300000';
const DINO_LOCAL_CEP_TO = '78309999';

export function isDinoLocalManualMethod(method, cep) {
  const config = method?.configuracao || {};
  const rules = Array.isArray(config.rules) ? config.rules : [];
  return method?.storefront_code === 'dino-web' && method?.codigo === 'dino-motoboy'
    && config.provider === 'manual' && config.deliveryType === 'motoboy'
    && cep >= DINO_LOCAL_CEP_FROM && cep <= DINO_LOCAL_CEP_TO
    && rules.length > 0 && rules.every(rule => rule.cepFrom && rule.cepTo
      && rule.cepFrom >= DINO_LOCAL_CEP_FROM && rule.cepTo <= DINO_LOCAL_CEP_TO
      && !rule.fallback && !rule.uf && !rule.ufs?.length && !rule.cities?.length && !rule.regions?.length)
    && rules.some(rule => cep >= rule.cepFrom && cep <= rule.cepTo);
}

function stringList(value, max = 50) {
  const values = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(values.map(item => text(item, 120)).filter(Boolean))].slice(0, max);
}

function nonNegative(value, field, { nullable = true } = {}) {
  if (value === undefined || value === null || value === '') return nullable ? null : 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new CommerceError(`${field} deve ser um número não negativo`, 'SHIPPING_METHOD_CONFIG_INVALID', { field });
  return round(parsed);
}

function normalizeOwnDeliveryRule(input = {}, index = 0) {
  if (!input || Array.isArray(input) || typeof input !== 'object') throw new CommerceError('cada faixa de entrega deve ser um objeto', 'SHIPPING_METHOD_CONFIG_INVALID', { field: `rules[${index}]` });
  const id = text(input.id || `regra-${index + 1}`, 80).toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
  const label = text(input.label || input.name, 160);
  if (!id || !label) throw new CommerceError('cada faixa exige identificador e nome', 'SHIPPING_METHOD_CONFIG_INVALID', { field: `rules[${index}]` });
  const uf = text(input.uf, 2).toUpperCase();
  if (uf && !BRAZIL_UFS.has(uf)) throw new CommerceError('UF inválida na faixa de entrega', 'SHIPPING_METHOD_CONFIG_INVALID', { field: `rules[${index}].uf` });
  const ufs = stringList(input.ufs).map(value => value.toUpperCase());
  if (ufs.some(value => !BRAZIL_UFS.has(value))) throw new CommerceError('lista de UFs inválida na faixa de entrega', 'SHIPPING_METHOD_CONFIG_INVALID', { field: `rules[${index}].ufs` });
  const regions = stringList(input.regions || input.region).map(value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[ _]+/g, '-'));
  if (regions.some(value => !BRAZIL_REGIONS.has(value))) throw new CommerceError('região brasileira inválida na faixa de entrega', 'SHIPPING_METHOD_CONFIG_INVALID', { field: `rules[${index}].regions` });
  const cepFromRaw = text(input.cepFrom || input.cepInicial || input.postalCodeFrom, 20);
  const cepToRaw = text(input.cepTo || input.cepFinal || input.postalCodeTo, 20);
  const cepFrom = cepFromRaw ? normalizeCep(cepFromRaw) : '';
  const cepTo = cepToRaw ? normalizeCep(cepToRaw) : '';
  if (cepFrom && cepTo && cepFrom > cepTo) throw new CommerceError('faixa de CEP está invertida', 'SHIPPING_METHOD_CONFIG_INVALID', { field: `rules[${index}]` });
  const deliveryDays = Math.round(nonNegative(input.deliveryDays ?? input.businessDays ?? 1, `rules[${index}].deliveryDays`, { nullable: false }));
  if (deliveryDays < 1 || deliveryDays > 90) throw new CommerceError('prazo da faixa deve ficar entre 1 e 90 dias úteis', 'SHIPPING_METHOD_CONFIG_INVALID', { field: `rules[${index}].deliveryDays` });
  const fallback = input.fallback === true;
  const cities = stringList(input.cities);
  if (!fallback && !uf && !ufs.length && !regions.length && !cities.length && !cepFrom && !cepTo) throw new CommerceError('cada faixa deve informar cidade, UF, região, CEP ou ser fallback', 'SHIPPING_METHOD_CONFIG_INVALID', { field: `rules[${index}]` });
  return {
    id,
    label,
    ...(uf ? { uf } : {}),
    ...(ufs.length ? { ufs } : {}),
    ...(regions.length ? { regions } : {}),
    ...(cities.length ? { cities } : {}),
    ...(cepFrom ? { cepFrom } : {}),
    ...(cepTo ? { cepTo } : {}),
    ...(input.zone !== undefined || input.zona !== undefined ? { zone: nonNegative(input.zone ?? input.zona, `rules[${index}].zone`, { nullable: false }) } : {}),
    ...(input.distanceKm !== undefined || input.km !== undefined ? { distanceKm: nonNegative(input.distanceKm ?? input.km, `rules[${index}].distanceKm`, { nullable: false }) } : {}),
    ...(input.amount !== undefined && input.amount !== '' ? { amount: nonNegative(input.amount, `rules[${index}].amount`, { nullable: false }) } : {}),
    deliveryDays,
    priority: Number.isFinite(Number(input.priority)) ? Math.round(Number(input.priority)) : 0,
    ...(fallback ? { fallback: true } : {}),
  };
}

export function normalizeOwnDeliveryConfig(input = {}) {
  if (!input || Array.isArray(input) || typeof input !== 'object') throw new CommerceError('configuração da entrega própria deve ser um objeto', 'SHIPPING_METHOD_CONFIG_INVALID');
  const rawType = text(input.deliveryType || input.kind || input.tipoEntrega || input.ownDeliveryType || 'regional_table', 40).toLowerCase();
  if (!OWN_DELIVERY_TYPES.has(rawType)) throw new CommerceError('modalidade de entrega própria inválida', 'SHIPPING_METHOD_CONFIG_INVALID', { field: 'deliveryType' });
  const rulesInput = input.rules === undefined ? [] : input.rules;
  if (!Array.isArray(rulesInput) || rulesInput.length > 80) throw new CommerceError('faixas de entrega devem ser uma lista com no máximo 80 itens', 'SHIPPING_METHOD_CONFIG_INVALID', { field: 'rules' });
  const rules = rulesInput.map(normalizeOwnDeliveryRule);
  if (new Set(rules.map(rule => rule.id)).size !== rules.length) throw new CommerceError('identificadores das faixas devem ser únicos', 'SHIPPING_METHOD_CONFIG_INVALID', { field: 'rules' });
  if (rules.filter(rule => rule.fallback).length > 1) throw new CommerceError('apenas uma faixa pode ser fallback', 'SHIPPING_METHOD_CONFIG_INVALID', { field: 'rules' });
  if (['motoboy', 'regional_table'].includes(rawType) && !rules.length) throw new CommerceError('motoboy e tabela regional exigem pelo menos uma faixa explícita', 'SHIPPING_METHOD_CONFIG_INVALID', { field: 'rules' });
  const deliveryDays = Math.round(nonNegative(input.deliveryDays ?? input.prazoDias ?? (rawType === 'express' || rawType === 'motoboy' ? 1 : 3), 'deliveryDays', { nullable: false }));
  if (deliveryDays < 1 || deliveryDays > 90) throw new CommerceError('prazo deve ficar entre 1 e 90 dias úteis', 'SHIPPING_METHOD_CONFIG_INVALID', { field: 'deliveryDays' });
  const normalized = { provider: 'manual', deliveryType: rawType, deliveryDays };
  if (input.origemCep || input.originPostalCode) normalized.origemCep = normalizeCep(input.origemCep || input.originPostalCode);
  const aliases = { pricePerZone: input.valorPorZona, additionalFee: input.adicionalExpresso, freeShippingAbove: input.freteGratisAcima, maxRadiusKm: input.raioKm, distanceKm: input.distanciaKm, baseFee: input.taxaBase, pricePerKm: input.valorPorKm, fixedFee: input.taxaFixa };
  for (const field of OWN_DELIVERY_NUMBERS) {
    const value = input[field] ?? aliases[field];
    if (value !== undefined && value !== '') normalized[field] = nonNegative(value, field, { nullable: false });
  }
  if (rawType === 'free_shipping' && !(normalized.freeShippingAbove > 0)) throw new CommerceError('frete grátis exige valor mínimo maior que zero', 'SHIPPING_METHOD_CONFIG_INVALID', { field: 'freeShippingAbove' });
  if (rules.length) normalized.rules = rules;
  return normalized;
}

function safePublicConfig(config = {}) {
  const source = config && typeof config === 'object' ? config : {};
  return {
    ...(source.provider ? { provider: text(source.provider, 60).toLowerCase() } : {}),
    ...(source.origemCep ? { origemCep: String(source.origemCep) } : {}),
    ...(Array.isArray(source.services) ? { services: source.services.slice(0, 20) } : {}),
    ...(Array.isArray(source.servicesAdditional) ? { servicesAdditional: source.servicesAdditional.slice(0, 20) } : {}),
    ...(source.prepostagemApiEnabled === true ? { prepostagemApiEnabled: true } : {}),
    ...(source.modalidadePagamento ? { modalidadePagamento: text(source.modalidadePagamento, 1) } : {}),
    ...(source.labelType ? { labelType: text(source.labelType, 1).toUpperCase() } : {}),
    ...(source.labelFormat ? { labelFormat: text(source.labelFormat, 2).toUpperCase() } : {}),
    ...(source.labelLayout ? { labelLayout: text(source.labelLayout, 30).toUpperCase() } : {}),
    ...(source.objectType ? { objectType: text(source.objectType, 8) } : {}),
    ...(source.options ? { options: { receipt: source.options.receipt === true, ownHand: source.options.ownHand === true } } : {}),
  };
}

function accountOriginConfigured(config = {}) {
  const candidate = config.origemCep || config.origin?.postalCode || config.origin?.postal_code || '';
  return CEP.test(String(candidate).replace(/\D/g, ''));
}

function accountSenderConfigured(config = {}) {
  const origin = config.origin || {};
  const document = origin.document || origin.companyDocument;
  return accountOriginConfigured(config) && Boolean(origin.name && origin.email && origin.phone && origin.address && origin.number && origin.district && origin.city && origin.stateAbbr && document && isValidCpfCnpj(document));
}

function accountQuoteConfigured(provider, config = {}) {
  if (provider !== 'correios') return true;
  return Array.isArray(config.services) && config.services.length > 0;
}

export function shippingAccountReady(row) {
  const provider = text(row?.provider, 60).toLowerCase();
  const config = row?.public_config || {};
  return Boolean(row?.id && row?.ativo && shippingProviders.get(provider) && accountOriginConfigured(config) && accountQuoteConfigured(provider, config) && shippingSecretConfigured(row.secret_ref) && (provider !== 'melhorenvio' || shippingSecretConfigured(config.webhookSecretRef)));
}

export function publicShippingMethod(method) {
  const config = method?.configuracao && typeof method.configuracao === 'object' ? method.configuracao : {};
  return {
    id: method.id,
    codigo: method.codigo,
    nome: method.nome,
    tipo: method.tipo,
    quoteEnabled: ['delivery', 'carrier'].includes(method.tipo) && (config.provider === 'manual' || Boolean(config.provider && (config.shippingAccountId || config.accountId) && method.shipping_account_ready === true)),
    provider: config.provider ? text(config.provider, 60).toLowerCase() : null,
    configuracao: safePublicConfig(config),
  };
}

export function postalCodeNotFound(body) {
  if (!body || typeof body !== 'object') return true;
  if (body.erro === true || String(body.erro).toLowerCase() === 'true') return true;
  return !text(body.localidade, 120) || !text(body.uf, 2);
}

export async function lookupPostalCode(value) {
  const cep = normalizeCep(value);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { headers: { Accept: 'application/json' }, signal: controller.signal });
    if (!response.ok) throw new CommerceError('serviço de CEP indisponível', 'SHIPPING_CEP_PROVIDER_ERROR');
    const body = await response.json();
    // O ViaCEP responde `erro: true` ou `erro: "true"` (texto) para CEP inexistente;
    // sem município o CEP também não serve para entrega.
    if (postalCodeNotFound(body)) throw new CommerceError('CEP não encontrado; confira os números', 'SHIPPING_CEP_NOT_FOUND');
    return { cep, logradouro: text(body.logradouro, 240) || null, complemento: text(body.complemento, 120) || null, bairro: text(body.bairro, 120) || null, cidade: text(body.localidade, 120) || null, estado: text(body.uf, 2).toUpperCase() || null, ibge: text(body.ibge, 20) || null };
  } catch (error) {
    if (error instanceof CommerceError) throw error;
    if (error.name === 'AbortError') throw new CommerceError('serviço de CEP não respondeu no prazo', 'SHIPPING_CEP_PROVIDER_TIMEOUT');
    throw new CommerceError('não foi possível consultar o CEP', 'SHIPPING_CEP_PROVIDER_ERROR');
  } finally {
    clearTimeout(timer);
  }
}

function accountRow(row) {
  const provider = text(row.provider, 60).toLowerCase();
  const registered = Boolean(shippingProviders.get(provider));
  const tokenConfigured = shippingSecretConfigured(row.secret_ref);
  const webhookConfigured = provider === 'melhorenvio' ? shippingSecretConfigured(row.public_config?.webhookSecretRef) : true;
  return {
    id: row.id,
    storefront_id: row.storefront_id,
    storefront_name: row.storefront_name || null,
    provider,
    ambiente: row.ambiente,
    nome: row.nome,
    ativo: row.ativo,
    registered,
    ready: registered && accountOriginConfigured(row.public_config || {}) && accountQuoteConfigured(provider, row.public_config || {}) && tokenConfigured && webhookConfigured,
    label_ready: registered && accountSenderConfigured(row.public_config || {}) && tokenConfigured && webhookConfigured && (provider === 'melhorenvio' || (provider === 'correios' && row.public_config?.prepostagemApiEnabled === true && ['1', '2', '3', '4'].includes(String(row.public_config?.modalidadePagamento || '')))),
    secret_configured: tokenConfigured,
    webhook_configured: webhookConfigured,
    public_config: safePublicConfig(row.public_config),
    criado_em: row.criado_em,
    atualizado_em: row.atualizado_em,
  };
}

export function listShippingProviders() {
  return { items: SHIPPING_PROVIDERS.map(provider => ({ ...provider, registered: Boolean(shippingProviders.get(provider.code)) })) };
}

function providerDefinition(provider) {
  const code = text(provider, 60).toLowerCase();
  const definition = SHIPPING_PROVIDERS.find(item => item.code === code);
  if (!definition || !ALLOWED_METHODS.has(code)) throw new CommerceError('provedor logístico ainda não possui adapter operacional', 'SHIPPING_PROVIDER_UNSUPPORTED', { provider: code });
  return definition;
}

function secretRef(value) {
  const normalized = text(value, 240);
  if (!SECRET_REF.test(normalized)) throw new CommerceError('secretRef deve ser uma referência env:VARIAVEL, nunca um segredo', 'SHIPPING_SECRET_REF_INVALID');
  return normalized;
}

function accountReadyForActivation(provider, secretReference, config) {
  return Boolean(shippingProviders.get(provider) && accountOriginConfigured(config) && accountQuoteConfigured(provider, config) && shippingSecretConfigured(secretReference) && (provider !== 'melhorenvio' || shippingSecretConfigured(config.webhookSecretRef)));
}

export async function listShippingAccounts(client, contextInput) {
  const context = tenantContext(contextInput);
  const result = await client.query(
    `SELECT a.id, a.storefront_id, s.nome AS storefront_name, a.provider, a.ambiente, a.nome,
            a.public_config, a.secret_ref, a.ativo, a.criado_em, a.atualizado_em
       FROM commerce_shipping_accounts a
       LEFT JOIN commerce_storefronts s ON s.empresa_id = a.empresa_id AND s.id = a.storefront_id
      WHERE a.empresa_id = $1 AND ($2::uuid IS NULL OR s.loja_id = $2)
      ORDER BY a.atualizado_em DESC, a.nome ASC`,
    [context.empresaId, context.lojaId],
  );
  return { items: result.rows.map(accountRow) };
}

export async function createShippingAccount(trx, contextInput, input = {}) {
  const context = tenantContext(contextInput);
  const definition = providerDefinition(input.provider);
  const nome = text(input.nome, 120);
  const ambiente = text(input.ambiente || 'sandbox', 20).toLowerCase();
  const storefrontId = assertUuid(input.storefrontId, 'storefrontId');
  if (!nome || !['sandbox', 'production'].includes(ambiente)) throw new CommerceError('nome e ambiente logístico válidos são obrigatórios', 'SHIPPING_ACCOUNT_INVALID');
  const secretReference = secretRef(input.secretRef);
  const config = safeConfig(input.publicConfig);
  if (definition.code === 'melhorenvio' && !config.webhookSecretRef) throw new CommerceError('a conta Melhor Envio exige webhookSecretRef para tracking assinado', 'SHIPPING_ACCOUNT_INVALID');
  if (input.ativo === true && !accountReadyForActivation(definition.code, secretReference, config)) throw new CommerceError('não é possível ativar a conta logística sem adapter e secrets configurados', 'SHIPPING_ACCOUNT_NOT_CONFIGURED');
  const storefront = await trx.query(`SELECT id FROM commerce_storefronts WHERE empresa_id = $1 AND id = $2 AND status = 'active' AND ($3::uuid IS NULL OR loja_id = $3) LIMIT 1`, [context.empresaId, storefrontId, context.lojaId]);
  if (!storefront.rows[0]) throw new CommerceError('storefront fora do escopo da loja', 'STORE_SCOPE_MISMATCH');
  const result = await trx.query(
    `INSERT INTO commerce_shipping_accounts (empresa_id, storefront_id, provider, ambiente, nome, secret_ref, public_config, ativo)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
     RETURNING id, storefront_id, provider, ambiente, nome, public_config, secret_ref, ativo, criado_em, atualizado_em`,
    [context.empresaId, storefrontId, definition.code, ambiente, nome, secretReference, JSON.stringify(config), input.ativo === true],
  );
  return accountRow(result.rows[0]);
}

export async function updateShippingAccount(trx, contextInput, idInput, input = {}) {
  const context = tenantContext(contextInput);
  const id = assertUuid(idInput, 'shippingAccountId');
  const currentResult = await trx.query(
    `SELECT a.id, a.storefront_id, a.provider, a.ambiente, a.nome, a.secret_ref, a.public_config, a.ativo
       FROM commerce_shipping_accounts a
       JOIN commerce_storefronts s ON s.empresa_id = a.empresa_id AND s.id = a.storefront_id
      WHERE a.empresa_id = $1 AND a.id = $2 AND ($3::uuid IS NULL OR s.loja_id = $3)
      FOR UPDATE`,
    [context.empresaId, id, context.lojaId],
  );
  const current = currentResult.rows[0];
  if (!current) throw new CommerceError('conta logística não encontrada', 'SHIPPING_ACCOUNT_NOT_FOUND');
  const config = { ...(current.public_config || {}) };
  const sets = [];
  const values = [context.empresaId, id];
  let nextSecret = current.secret_ref;
  let nextActive = current.ativo;
  if (input.nome !== undefined) { const nome = text(input.nome, 120); if (!nome) throw new CommerceError('nome da conta logística é obrigatório', 'SHIPPING_ACCOUNT_INVALID'); values.push(nome); sets.push(`nome = $${values.length}`); }
  if (input.ambiente !== undefined) { const ambiente = text(input.ambiente, 20).toLowerCase(); if (!['sandbox', 'production'].includes(ambiente)) throw new CommerceError('ambiente logístico inválido', 'SHIPPING_ACCOUNT_INVALID'); values.push(ambiente); sets.push(`ambiente = $${values.length}`); }
  if (input.secretRef !== undefined) { nextSecret = secretRef(input.secretRef); values.push(nextSecret); sets.push(`secret_ref = $${values.length}`); }
  if (input.publicConfig !== undefined) { Object.assign(config, safeConfig(input.publicConfig)); values.push(JSON.stringify(config)); sets.push(`public_config = $${values.length}::jsonb`); }
  if (input.ativo !== undefined) { if (input.ativo !== true && input.ativo !== false) throw new CommerceError('ativo deve ser booleano', 'SHIPPING_ACCOUNT_INVALID'); nextActive = input.ativo; values.push(nextActive); sets.push(`ativo = $${values.length}`); }
  if (!sets.length) throw new CommerceError('nenhuma alteração informada', 'NO_CHANGES');
  if (nextActive && !accountReadyForActivation(current.provider, nextSecret, config)) throw new CommerceError('não é possível manter ativa a conta logística sem adapter e secrets configurados', 'SHIPPING_ACCOUNT_NOT_CONFIGURED');
  sets.push('atualizado_em = CURRENT_TIMESTAMP');
  const result = await trx.query(`UPDATE commerce_shipping_accounts SET ${sets.join(', ')} WHERE empresa_id = $1 AND id = $2 RETURNING id, storefront_id, provider, ambiente, nome, public_config, secret_ref, ativo, criado_em, atualizado_em`, values);
  return accountRow(result.rows[0]);
}

function storefrontConfigOrigin(storefront, methodConfig, accountConfig = {}) {
  const configured = methodConfig.origin || methodConfig.origem || accountConfig.origin || storefront.configuracoes?.shipping?.origin || storefront.configuracoes?.logistica?.origem || {};
  const candidate = configured.cep || configured.postalCode || configured.originPostalCode || methodConfig.origemCep || accountConfig.origemCep || storefront.configuracoes?.shipping?.originPostalCode || '';
  return candidate ? normalizeCep(candidate) : null;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).filter(key => value[key] !== undefined).sort().map(key => [key, canonicalJson(value[key])]));
  }
  return value;
}

function canonicalDestination(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function canonicalShippingLines(items) {
  const source = Array.isArray(items) ? items : [];
  if (!source.length || source.length > 100) throw new CommerceError('a cotação exige de 1 a 100 itens, com quantidades entre 1 e 999', 'SHIPPING_ITEMS_REQUIRED');
  const totals = new Map();
  for (const item of source) {
    const variantId = assertUuid(item.variantId, 'variantId');
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 999) throw new CommerceError('a cotação exige de 1 a 100 itens, com quantidades entre 1 e 999', 'SHIPPING_ITEMS_REQUIRED');
    totals.set(variantId, (totals.get(variantId) || 0) + quantity);
  }
  const lines = [...totals.entries()].map(([variantId, quantity]) => ({ variantId, quantity })).sort((left, right) => left.variantId.localeCompare(right.variantId));
  if (!lines.length || lines.length > 100 || lines.some(line => line.quantity > 999)) throw new CommerceError('a cotação exige de 1 a 100 itens, com quantidades entre 1 e 999', 'SHIPPING_ITEMS_REQUIRED');
  return lines;
}

function requestHash(snapshot) { return crypto.createHash('sha256').update(JSON.stringify(canonicalJson(snapshot))).digest('hex'); }

const BACKORDER_LEAD_DAYS = 10;

function addBackorderLeadTime(option, extraDays) {
  if (!extraDays || !option || typeof option !== 'object') return option;
  const add = value => value == null || !Number.isFinite(Number(value)) ? value : Number(value) + extraDays;
  const next = { ...option, backorderLeadDays: extraDays };
  if (option.deliveryDays != null) next.deliveryDays = add(option.deliveryDays);
  if (option.preparationDays != null) next.preparationDays = add(option.preparationDays);
  if (option.deliveryRange && typeof option.deliveryRange === 'object') {
    next.deliveryRange = { ...option.deliveryRange, min: add(option.deliveryRange.min), max: add(option.deliveryRange.max) };
  }
  next.deliveryNote = `${String(option.deliveryNote || '').trim()} + ${extraDays} dias úteis por item sob encomenda`.trim();
  return next;
}

async function loadQuoteContext(client, contextInput, input = {}) {
  const context = tenantContext(contextInput);
  const storefrontId = assertUuid(input.storefrontId, 'storefrontId');
  const shippingMethodId = assertUuid(input.shippingMethodId, 'shippingMethodId');
  const destinationCep = normalizeCep(input.destinationCep || input.destination?.cep);
  const methodResult = await client.query(
    `SELECT sm.id, sm.codigo, sm.nome, sm.tipo, sm.configuracao, s.id AS storefront_id, s.codigo AS storefront_code, s.loja_id, s.configuracoes
       FROM commerce_shipping_methods sm
       JOIN commerce_storefronts s ON s.empresa_id = sm.empresa_id AND s.id = sm.storefront_id AND s.status = 'active'
      WHERE sm.empresa_id = $1 AND sm.storefront_id = $2 AND sm.id = $3 AND sm.ativo = true
      LIMIT 1`,
    [context.empresaId, storefrontId, shippingMethodId],
  );
  const method = methodResult.rows[0];
  if (!method || !['delivery', 'carrier'].includes(method.tipo)) throw new CommerceError('método de entrega não habilitado para cotação', 'SHIPPING_METHOD_NOT_FOUND');
  const storedMethodConfig = method.configuracao && typeof method.configuracao === 'object' ? method.configuracao : {};
  const provider = text(storedMethodConfig.provider || 'melhorenvio', 60).toLowerCase();
  const definition = providerDefinition(provider);
  const isManual = provider === 'manual';
  const methodConfig = isManual ? normalizeOwnDeliveryConfig(storedMethodConfig) : storedMethodConfig;
  let account = null;
  if (!isManual) {
    const accountId = assertUuid(methodConfig.shippingAccountId || methodConfig.accountId, 'shippingAccountId');
    const accountResult = await client.query(`SELECT id, storefront_id, provider, ambiente, secret_ref, public_config, ativo FROM commerce_shipping_accounts WHERE empresa_id = $1 AND id = $2 AND storefront_id = $3 AND provider = $4 AND ativo = true LIMIT 1`, [context.empresaId, accountId, storefrontId, provider]);
    account = accountResult.rows[0];
    if (!account || !shippingAccountReady(account)) throw new CommerceError('conta logística ativa ainda não está configurada no secret manager ou não possui origem', 'SHIPPING_ACCOUNT_NOT_CONFIGURED');
  }
  const originCep = storefrontConfigOrigin(method, methodConfig, account?.public_config || {});
  if (!isManual && !originCep) throw new CommerceError('CEP de origem logística é obrigatório para provedores externos', 'SHIPPING_ORIGIN_CEP_REQUIRED');
  const destinationAddressInput = input.destinationAddress || input.destination || input.shippingAddress || { cep: destinationCep };
  let destinationCity = text(input.destinationCity || input.destination?.cidade || input.destination?.city || destinationAddressInput.cidade || destinationAddressInput.city, 120);
  let destinationState = text(input.destinationState || input.destination?.estado || input.destination?.state || destinationAddressInput.estado || destinationAddressInput.state, 2).toUpperCase();
  const dinoManual = isManual && method.storefront_code === 'dino-web';
  if (dinoManual && !isDinoLocalManualMethod(method, destinationCep)) {
    throw new CommerceError('entrega fora da área local requer operação logística habilitada', 'SHIPPING_NATIONAL_FULFILLMENT_NOT_READY');
  }
  const locationRules = Array.isArray(methodConfig.rules) ? methodConfig.rules : [];
  // Tabela por UF/cidade/região não pode confiar em destino declarado no navegador.
  // Motoboy com faixa de CEP puro continua operando mesmo se o serviço postal cair.
  const requiresVerifiedLocation = isManual && !dinoManual && (!locationRules.length || locationRules.some(rule => rule.uf || rule.ufs?.length || rule.cities?.length || rule.regions?.length || rule.fallback));
  if (requiresVerifiedLocation || (isManual && (!destinationCity || !/^[A-Z]{2}$/.test(destinationState)))) {
    const lookup = await lookupPostalCode(destinationCep);
    const verifiedCity = text(lookup.cidade, 120);
    const verifiedState = text(lookup.estado, 2).toUpperCase();
    if (!verifiedCity || !BRAZIL_UFS.has(verifiedState)) throw new CommerceError('CEP sem município e UF verificáveis; tente novamente', 'SHIPPING_CEP_PROVIDER_ERROR');
    if ((destinationCity && canonicalDestination(destinationCity) !== canonicalDestination(verifiedCity)) || (destinationState && destinationState !== verifiedState)) {
      throw new CommerceError('CEP não corresponde à cidade ou UF informada; consulte o CEP novamente', 'SHIPPING_CEP_MISMATCH');
    }
    destinationCity = verifiedCity;
    destinationState = verifiedState;
  }
  // A tabela manual não comprova coleta, transporte, etiqueta nem rastreio nacional.
  // Mesmo se uma regra histórica for reativada, a Dino exige conta/quote real.
  if (dinoManual && destinationState !== 'MT') throw new CommerceError('CEP e UF não correspondem à área local', 'SHIPPING_CEP_MISMATCH');
  const destinationAddress = { ...destinationAddressInput, cep: destinationCep, cidade: destinationCity || null, estado: destinationState || null };
  const lines = canonicalShippingLines(input.items);
  const variantIds = [...new Set(lines.map(line => line.variantId))];
  const variants = await client.query(
    `SELECT v.id, v.sku, COALESCE(v.nome, p.nome) AS nome, v.peso_gramas, v.largura_cm, v.altura_cm, v.comprimento_cm,
            v.permite_compra_sem_estoque, p.nome AS product_name, cat.nome AS category_name,
            COALESCE(vp.preco_promocional, vp.preco) AS price
       FROM commerce_product_variants v
       JOIN commerce_products p ON p.empresa_id = v.empresa_id AND p.id = v.product_id AND p.status = 'active'
       LEFT JOIN commerce_categories cat ON cat.empresa_id = p.empresa_id AND cat.id = p.category_id
       JOIN commerce_product_channels pc ON pc.empresa_id = p.empresa_id AND pc.product_id = p.id AND pc.storefront_id = $3 AND pc.publicado = true
       JOIN commerce_variant_prices vp ON vp.empresa_id = v.empresa_id AND vp.variant_id = v.id AND vp.price_list_id = pc.price_list_id
      WHERE v.empresa_id = $1 AND v.id = ANY($2::uuid[]) AND v.ativo = true
        AND vp.vigencia_inicio <= CURRENT_TIMESTAMP AND (vp.vigencia_fim IS NULL OR vp.vigencia_fim > CURRENT_TIMESTAMP)`,
    [context.empresaId, variantIds, storefrontId],
  );
  const variantMap = new Map(variants.rows.map(row => [row.id, row]));
  if (variantMap.size !== variantIds.length) throw new CommerceError('um ou mais itens não estão disponíveis para cotação', 'ITEM_UNAVAILABLE');
  // Congelados/refrigerados não seguem por entrega comum: só retirada na loja.
  const coldItems = pickupOnlyItems(variants.rows.map(row => ({ categoryName: row.category_name, productName: row.product_name || row.nome })));
  if (coldItems.length) throw new CommerceError(PICKUP_ONLY_MESSAGE, PICKUP_ONLY_ERROR_CODE);
  const backorderLeadDays = lines.some(line => variantMap.get(line.variantId)?.permite_compra_sem_estoque === true) ? BACKORDER_LEAD_DAYS : 0;
  const products = lines.map(line => {
    const variant = variantMap.get(line.variantId);
    const dimensions = [variant.largura_cm, variant.altura_cm, variant.comprimento_cm].map(value => number(value));
    if (!isManual && (dimensions.some(value => value === null || value <= 0) || number(variant.peso_gramas) === null || number(variant.peso_gramas) <= 0)) throw new CommerceError(`dimensões e peso ausentes para ${variant.nome || variant.sku}`, 'SHIPPING_PACKAGE_DATA_REQUIRED');
    return { id: variant.sku || variant.id, width: dimensions[0], height: dimensions[1], length: dimensions[2], weight: number(variant.peso_gramas) / 1000, insuranceValue: round(number(variant.price, 0)), quantity: line.quantity };
  });
  const subtotal = round(products.reduce((sum, product) => sum + product.insuranceValue * product.quantity, 0));
  const snapshot = { storefrontId, shippingMethodId, shippingAccountId: account?.id || null, provider, ambiente: account?.ambiente || 'manual', originCep, destinationCep, destination: { cidade: canonicalDestination(destinationCity) || null, estado: destinationState || null }, subtotal, lines, backorderLeadDays, methodConfigHash: requestHash(storedMethodConfig) };
  return { context, storefront: { id: storefrontId, loja_id: method.loja_id, empresa_id: context.empresaId }, method, methodConfig, account, provider: definition.code, originCep, destinationCep, destinationCity, destinationState, destinationAddress, products, subtotal, snapshot, hash: requestHash(snapshot), services: methodConfig.services || [], options: methodConfig.options || {} };
}

export async function quoteShipping(client, contextInput, input = {}) {
  const prepared = await loadQuoteContext(client, contextInput, input);
  const adapter = shippingProviders.get(prepared.provider);
  if (!adapter) throw new CommerceError('adapter logístico não registrado', 'SHIPPING_PROVIDER_NOT_CONFIGURED');
  const quoted = await adapter.quote({ account: prepared.account, methodConfig: prepared.methodConfig, destinationAddress: prepared.destinationAddress, destinationCity: prepared.destinationCity || prepared.destinationAddress?.cidade, destinationState: prepared.destinationState || prepared.destinationAddress?.estado, originPostalCode: prepared.originCep, destinationPostalCode: prepared.destinationCep, products: prepared.products, subtotal: prepared.subtotal, services: prepared.services, options: prepared.options });
  return client.transaction(async trx => {
    const methodCheck = await trx.query(
      `SELECT configuracao FROM commerce_shipping_methods WHERE empresa_id = $1 AND id = $2 AND storefront_id = $3 AND ativo = true FOR UPDATE`,
      [prepared.context.empresaId, prepared.method.id, prepared.storefront.id],
    );
    if (!methodCheck.rows[0] || requestHash(methodCheck.rows[0].configuracao) !== prepared.snapshot.methodConfigHash) {
      throw new CommerceError('regra de frete alterada durante a cotação; recalcule o frete', 'SHIPPING_QUOTE_EXPIRED');
    }
    if (prepared.account) {
      const accountCheck = await trx.query(`SELECT id FROM commerce_shipping_accounts WHERE empresa_id = $1 AND id = $2 AND storefront_id = $3 AND ativo = true FOR UPDATE`, [prepared.context.empresaId, prepared.account.id, prepared.storefront.id]);
      if (!accountCheck.rows[0]) throw new CommerceError('conta logística foi alterada durante a cotação', 'SHIPPING_ACCOUNT_NOT_CONFIGURED');
    }
    const items = (quoted.options || []).map(option => addBackorderLeadTime(option, prepared.snapshot.backorderLeadDays));
    const providerOptions = (quoted.providerOptions || []).map(option => ({ ...option, public: addBackorderLeadTime(option.public, prepared.snapshot.backorderLeadDays) }));
    const result = await trx.query(
      `INSERT INTO commerce_shipping_quotes
        (empresa_id, storefront_id, shipping_method_id, shipping_account_id, provider, ambiente, origem_cep, destino_cep, request_hash, request_snapshot, response_snapshot, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, CURRENT_TIMESTAMP + INTERVAL '15 minutes')
       RETURNING id, expires_at`,
      [prepared.context.empresaId, prepared.storefront.id, prepared.method.id, prepared.account?.id || null, prepared.provider, prepared.account?.ambiente || 'manual', prepared.originCep, prepared.destinationCep, prepared.hash, JSON.stringify(prepared.snapshot), JSON.stringify({ options: items, providerOptions })],
    );
    return { quoteId: result.rows[0].id, expiresAt: result.rows[0].expires_at, provider: prepared.provider, shippingMethodId: prepared.method.id, items };
  });
}

const OPTIONAL_QUOTE_ERRORS = new Set([
  'SHIPPING_DESTINATION_OUTSIDE_RADIUS',
  'SHIPPING_DESTINATION_UNAVAILABLE',
  'SHIPPING_FREE_SHIPPING_THRESHOLD_NOT_MET',
  'SHIPPING_ACCOUNT_NOT_CONFIGURED',
  'SHIPPING_PACKAGE_DATA_REQUIRED',
  'SHIPPING_ORIGIN_CEP_REQUIRED',
  'SHIPPING_METHOD_CONFIG_INVALID',
  'SHIPPING_NATIONAL_FULFILLMENT_NOT_READY',
  'SHIPPING_PROVIDER_UNSUPPORTED',
  'SHIPPING_PROVIDER_NOT_CONFIGURED',
  'SHIPPING_PROVIDER_ERROR',
  'SHIPPING_PROVIDER_TIMEOUT',
  'SHIPPING_NO_OPTIONS',
  'SHIPPING_ADAPTER_INVALID_RESPONSE',
  PICKUP_ONLY_ERROR_CODE,
]);

export async function quoteAvailableShipping(client, contextInput, input = {}) {
  const context = tenantContext(contextInput);
  const storefrontId = assertUuid(input.storefrontId, 'storefrontId');
  const destinationCep = normalizeCep(input.destinationCep || input.destination?.cep);
  const destinationInput = input.destination && typeof input.destination === 'object' ? input.destination : {};
  const destination = destinationInput.cidade && destinationInput.estado
    ? { ...destinationInput, cep: destinationCep }
    : { ...destinationInput, ...(await lookupPostalCode(destinationCep)), cep: destinationCep };
  const methods = await client.query(
    `SELECT id, codigo, nome
       FROM commerce_shipping_methods
      WHERE empresa_id = $1 AND storefront_id = $2 AND ativo = true AND tipo IN ('delivery', 'carrier')
      ORDER BY nome ASC
      LIMIT 12`,
    [context.empresaId, storefrontId],
  );
  const items = [];
  const unavailable = [];
  for (const method of methods.rows) {
    try {
      const quote = await quoteShipping(client, context, { ...input, storefrontId, shippingMethodId: method.id, destinationCep, destination });
      for (const option of quote.items || []) items.push({ ...option, quoteId: quote.quoteId, expiresAt: quote.expiresAt, shippingMethodId: quote.shippingMethodId, shippingMethodCode: method.codigo, shippingMethodName: method.nome, selectionId: `${quote.quoteId}:${option.id}` });
    } catch (error) {
      if (!OPTIONAL_QUOTE_ERRORS.has(error?.code)) throw error;
      unavailable.push({ shippingMethodId: method.id, code: error.code });
    }
  }
  if (!items.length && unavailable.length && unavailable.every(item => item.code === PICKUP_ONLY_ERROR_CODE)) throw new CommerceError(PICKUP_ONLY_MESSAGE, PICKUP_ONLY_ERROR_CODE);
  if (!items.length) throw new CommerceError('nenhuma opção de entrega está disponível para este CEP e carrinho', 'SHIPPING_DESTINATION_UNAVAILABLE');
  const expiresAt = items.map(item => item.expiresAt).filter(Boolean).sort()[0] || null;
  return { storefrontId, destination: { cep: destinationCep, cidade: destination.cidade || null, estado: destination.estado || null }, expiresAt, items, unavailable };
}

export async function resolveShippingSelection(trx, contextInput, input = {}, { storefrontId, shippingMethodId, lines } = {}) {
  const context = tenantContext(contextInput);
  const quoteId = assertUuid(input.shippingQuoteId, 'shippingQuoteId');
  const methodId = assertUuid(shippingMethodId, 'shippingMethodId');
  const optionId = text(input.shippingOptionId, 180);
  if (!optionId) throw new CommerceError('shippingOptionId é obrigatório', 'SHIPPING_QUOTE_INVALID');
  const destination = normalizeShippingAddress(input.shippingAddress);
  const result = await trx.query(
    `SELECT q.id, q.storefront_id, q.shipping_method_id, q.shipping_account_id, q.provider, q.ambiente, q.request_hash, q.request_snapshot,
            (SELECT s.codigo FROM commerce_storefronts s WHERE s.empresa_id = q.empresa_id AND s.id = q.storefront_id) AS storefront_code,
            q.response_snapshot, q.status, q.expires_at, sm.codigo AS shipping_method_code, sm.configuracao AS current_method_config
       FROM commerce_shipping_quotes q
       JOIN commerce_shipping_methods sm ON sm.empresa_id = q.empresa_id AND sm.storefront_id = q.storefront_id
            AND sm.id = q.shipping_method_id AND sm.ativo = true AND sm.tipo IN ('delivery', 'carrier')
      WHERE q.empresa_id = $1 AND q.id = $2 AND q.storefront_id = $3 AND sm.id = $4
        AND q.status = 'quoted' AND q.expires_at > CURRENT_TIMESTAMP
      FOR UPDATE OF q, sm`,
    [context.empresaId, quoteId, assertUuid(storefrontId, 'storefrontId'), methodId],
  );
  const quote = result.rows[0];
  if (!quote) throw new CommerceError('cotação indisponível, expirada ou com método desativado; recalcule o frete', 'SHIPPING_QUOTE_EXPIRED');
  if (quote.storefront_code === 'dino-web' && quote.provider === 'manual'
    && !isDinoLocalManualMethod({ storefront_code: quote.storefront_code, codigo: quote.shipping_method_code, configuracao: quote.current_method_config }, destination.cep)) {
    throw new CommerceError('entrega fora da área local requer operação logística habilitada', 'SHIPPING_NATIONAL_FULFILLMENT_NOT_READY');
  }
  if (quote.storefront_code === 'dino-web' && quote.provider === 'manual' && destination.estado !== 'MT') throw new CommerceError('CEP e UF não correspondem à área local', 'SHIPPING_CEP_MISMATCH');
  if (!quote.request_snapshot?.methodConfigHash || requestHash(quote.current_method_config) !== quote.request_snapshot.methodConfigHash) {
    throw new CommerceError('regra de frete alterada desde a cotação; recalcule o frete', 'SHIPPING_QUOTE_EXPIRED');
  }
  const canonicalLines = canonicalShippingLines(lines);
  const expectedSnapshot = {
    ...quote.request_snapshot,
    lines: canonicalLines,
    destinationCep: destination.cep,
    destination: { cidade: canonicalDestination(destination.cidade) || null, estado: String(destination.estado || '').trim().toUpperCase() || null },
  };
  const quotedDestination = quote.request_snapshot?.destination || {};
  if (canonicalDestination(quotedDestination.cidade) !== canonicalDestination(destination.cidade)
    || String(quotedDestination.estado || '').trim().toUpperCase() !== String(destination.estado || '').trim().toUpperCase()) {
    throw new CommerceError('cotação não corresponde à cidade ou UF do endereço atual', 'SHIPPING_QUOTE_MISMATCH');
  }
  if (requestHash(expectedSnapshot) !== quote.request_hash) throw new CommerceError('cotação não corresponde ao carrinho ou CEP atual', 'SHIPPING_QUOTE_MISMATCH');
  const providerOptions = Array.isArray(quote.response_snapshot?.providerOptions) ? quote.response_snapshot.providerOptions : [];
  const selected = providerOptions.find(item => String(item.public?.id || '') === optionId);
  if (!selected?.public) throw new CommerceError('opção de frete não pertence à cotação', 'SHIPPING_OPTION_INVALID');
  await trx.query(`UPDATE commerce_shipping_quotes SET status = 'selected', selected_option_id = $3, selected_amount = $4, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2`, [context.empresaId, quote.id, optionId, selected.public.amount]);
  return { quote, address: destination, amount: round(selected.public.amount), optionId, option: selected.public, providerOption: selected.raw };
}

export function normalizeQuoteForPublic(row) {
  return row;
}

export { safeConfig, safePublicConfig, SECRET_REF };

export async function prepareShippingLabel(trx, contextInput, fulfillmentIdInput, storefrontIdInput) {
  const context = tenantContext(contextInput);
  const fulfillmentId = assertUuid(fulfillmentIdInput, 'fulfillmentId');
  const storefrontId = assertUuid(storefrontIdInput, 'storefrontId');
  const result = await trx.query(
    `SELECT f.*, o.public_code, o.customer_id, o.status AS order_status,
            COALESCE(c.email, o.customer_snapshot->>'email') AS customer_email,
            COALESCE(c.documento_mascarado, o.customer_snapshot->>'documentoMascarado') AS customer_document,
            o.endereco_entrega, o.storefront_id,
            s.codigo AS storefront_code,
            q.provider, q.ambiente, q.selected_option_id, q.response_snapshot, q.expires_at AS quote_expires_at,
            a.id AS account_id, a.provider AS account_provider, a.ambiente AS account_environment, a.secret_ref, a.public_config, a.ativo AS account_active,
            m.tipo AS shipping_type
       FROM commerce_fulfillments f
       JOIN commerce_orders o ON o.empresa_id = f.empresa_id AND o.id = f.order_id
       JOIN commerce_storefronts s ON s.empresa_id = o.empresa_id AND s.id = o.storefront_id
       LEFT JOIN commerce_customers c ON c.empresa_id = o.empresa_id AND c.id = o.customer_id
       LEFT JOIN commerce_shipping_quotes q ON q.empresa_id = f.empresa_id AND q.id = f.shipping_quote_id
       LEFT JOIN commerce_shipping_accounts a ON a.empresa_id = f.empresa_id AND a.id = COALESCE(f.shipping_account_id, q.shipping_account_id)
       LEFT JOIN commerce_shipping_methods m ON m.empresa_id = f.empresa_id AND m.id = f.shipping_method_id
      WHERE f.empresa_id = $1 AND f.id = $2 AND o.storefront_id = $3
        AND ($4::uuid IS NULL OR o.storefront_id IN (SELECT id FROM commerce_storefronts WHERE empresa_id = $1 AND loja_id = $4))
      FOR UPDATE OF f`,
    [context.empresaId, fulfillmentId, storefrontId, context.lojaId],
  );
  const fulfillment = result.rows[0];
  if (!fulfillment) throw new CommerceError('fulfillment não encontrado no tenant', 'FULFILLMENT_NOT_FOUND');
  if (!['delivery', 'carrier'].includes(fulfillment.shipping_type || '')) throw new CommerceError('etiqueta só pode ser gerada para entrega ou transportadora', 'SHIPPING_METHOD_INVALID');
  if (!['paid', 'processing', 'ready', 'shipped'].includes(fulfillment.order_status)) throw new CommerceError('a etiqueta só pode ser gerada após o pagamento confirmado', 'SHIPPING_ORDER_NOT_PAID');
  if (fulfillment.provider_shipment_id && fulfillment.shipping_operation_status === 'succeeded') return { replay: true, fulfillment };
  // Enquanto não houver transportadora elegível, nem um fulfillment Dino legado
  // pode contornar o gate público e criar uma etiqueta via rota administrativa.
  if (fulfillment.storefront_code === 'dino-web') throw new CommerceError('etiqueta nacional Dino depende de operação logística habilitada', 'SHIPPING_NATIONAL_FULFILLMENT_NOT_READY');
  if (fulfillment.shipping_operation_status === 'processing' || fulfillment.shipping_operation_status === 'failed') {
    throw new CommerceError('resultado da emissão anterior é incerto; reconcilie a chave da operação antes de tentar novamente', 'SHIPPING_OPERATION_RECONCILIATION_REQUIRED', { operationKey: fulfillment.shipping_operation_key || `shipping-${fulfillment.id}-create` });
  }
  if (!fulfillment.account_id || !fulfillment.account_active || !shippingSecretConfigured(fulfillment.secret_ref)) throw new CommerceError('conta logística do fulfillment não está pronta', 'SHIPPING_ACCOUNT_NOT_CONFIGURED');
  const senderConfig = fulfillment.public_config || {};
  const senderOrigin = senderConfig.origin || {};
  if (!accountOriginConfigured(senderConfig) || !senderOrigin.name || !senderOrigin.email || !senderOrigin.phone || !senderOrigin.address || !senderOrigin.number || !senderOrigin.district || !senderOrigin.city || !senderOrigin.stateAbbr) throw new CommerceError('origem logística incompleta: preencha endereço e contato do remetente', 'SHIPPING_ORIGIN_INCOMPLETE');
  if (!isValidCpfCnpj(senderOrigin.document || senderOrigin.companyDocument)) throw new CommerceError('CPF ou CNPJ do remetente é inválido', 'SHIPPING_ORIGIN_DOCUMENT_INVALID');
  const correiosLabelEnabled = fulfillment.account_provider === 'correios' && fulfillment.public_config?.prepostagemApiEnabled === true && ['1', '2', '3', '4'].includes(String(fulfillment.public_config?.modalidadePagamento || ''));
  if (!['melhorenvio', 'correios'].includes(fulfillment.account_provider) || !shippingProviders.get(fulfillment.account_provider) || (fulfillment.account_provider === 'correios' && !correiosLabelEnabled)) throw new CommerceError('adapter logístico do fulfillment indisponível ou capability de pré-postagem não habilitada', 'SHIPPING_PROVIDER_CAPABILITY_UNAVAILABLE');
  if (!fulfillment.selected_option_id || !fulfillment.response_snapshot?.providerOptions?.length) throw new CommerceError('fulfillment não possui cotação escolhida válida', 'SHIPPING_QUOTE_INVALID');
  const selected = fulfillment.response_snapshot.providerOptions.find(item => String(item.public?.id || '') === String(fulfillment.selected_option_id));
  if (!selected) throw new CommerceError('opção selecionada não está presente na cotação armazenada', 'SHIPPING_OPTION_INVALID');
  const orderItems = await trx.query(`SELECT nome_snapshot, quantidade, preco_unitario FROM commerce_order_items WHERE empresa_id = $1 AND order_id = $2 ORDER BY id ASC`, [context.empresaId, fulfillment.order_id]);
  const operationKey = `shipping-${fulfillment.id}-create`.slice(0, 180);
  await trx.query(`UPDATE commerce_fulfillments SET shipping_operation_status = 'processing', shipping_operation_key = $3, shipping_operation_started_at = CURRENT_TIMESTAMP, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2`, [context.empresaId, fulfillment.id, operationKey]);
  return {
    replay: false,
    operationKey,
    fulfillment,
    account: { id: fulfillment.account_id, provider: fulfillment.account_provider, ambiente: fulfillment.account_environment, secret_ref: fulfillment.secret_ref, public_config: fulfillment.public_config },
    selectedOption: { ...selected.public, raw: selected.raw },
    from: (() => { const origin = fulfillment.public_config?.origin || {}; return { name: origin.name, email: origin.email, phone: origin.phone, document: origin.document, company_document: origin.companyDocument, state_register: origin.stateRegister, address: origin.address, number: origin.number, complement: origin.complement, district: origin.district, city: origin.city, postal_code: origin.postalCode || fulfillment.public_config?.origemCep, state_abbr: origin.stateAbbr, country_id: 'BR' }; })(),
    to: (() => { const address = fulfillment.endereco_entrega || {}; return { name: address.destinatario, email: address.email || fulfillment.customer_email, document: address.documento || address.document || fulfillment.customer_document, company_document: address.companyDocument || address.company_document, address: address.logradouro, number: address.numero, complement: address.complemento, district: address.bairro, city: address.cidade, postal_code: address.cep, state_abbr: address.estado, country_id: 'BR' }; })(),
    products: orderItems.rows.map(item => ({ name: item.nome_snapshot || 'Produto', quantity: item.quantidade, unitaryValue: item.preco_unitario })),
    volumes: selected.raw?.packages || [],
    orderCode: fulfillment.public_code,
  };
}

export async function finalizeShippingLabel(trx, contextInput, fulfillmentIdInput, operationKey, result, storefrontIdInput) {
  const context = tenantContext(contextInput);
  const fulfillmentId = assertUuid(fulfillmentIdInput, 'fulfillmentId');
  const storefrontId = assertUuid(storefrontIdInput, 'storefrontId');
  const current = await trx.query(
    `SELECT f.id, f.ocorrencias
       FROM commerce_fulfillments f
       JOIN commerce_orders o ON o.empresa_id = f.empresa_id AND o.id = f.order_id
      WHERE f.empresa_id = $1 AND f.id = $2 AND f.shipping_operation_key = $3 AND o.storefront_id = $4
      FOR UPDATE OF f`,
    [context.empresaId, fulfillmentId, operationKey, storefrontId],
  );
  if (!current.rows[0]) throw new CommerceError('operação de etiqueta não encontrada ou já finalizada', 'SHIPPING_OPERATION_CONFLICT');
  const metadata = result?.publicData && typeof result.publicData === 'object' ? {
    prepostagemId: text(result.publicData.prepostagemId, 180) || null,
    trackingCode: text(result.publicData.trackingCode, 80) || null,
    labelReceipt: text(result.publicData.labelReceipt, 180) || null,
    labelRequestError: result.publicData.labelRequestError ? { code: text(result.publicData.labelRequestError.code, 80), message: text(result.publicData.labelRequestError.message, 240) } : null,
  } : null;
  const occurrences = Array.isArray(current.rows[0].ocorrencias) ? current.rows[0].ocorrencias : [];
  if (metadata && (metadata.prepostagemId || metadata.labelReceipt || metadata.labelRequestError)) occurrences.push({ at: new Date().toISOString(), status: result.providerStatus || 'shipping_created', description: 'Operação logística registrada no provedor', providerData: metadata });
  const updated = await trx.query(
    `UPDATE commerce_fulfillments
        SET shipping_operation_status = 'succeeded', provider_shipment_id = $3, tracking_code = COALESCE($4, tracking_code), tracking_url = COALESCE($5, tracking_url), label_url = COALESCE($6, label_url), carrier = COALESCE($7, carrier), ocorrencias = $8::jsonb, atualizado_em = CURRENT_TIMESTAMP
      WHERE empresa_id = $1 AND id = $2
        AND EXISTS (SELECT 1 FROM commerce_orders o WHERE o.empresa_id = commerce_fulfillments.empresa_id AND o.id = commerce_fulfillments.order_id AND o.storefront_id = $9)
      RETURNING *`,
    [context.empresaId, fulfillmentId, result.providerShipmentId, result.trackingCode || null, result.trackingUrl || null, result.labelUrl || null, result.carrier || null, JSON.stringify(occurrences.slice(-100)), storefrontId],
  );
  return updated.rows[0];
}

export async function issueShippingLabel(transaction, context, fulfillmentId, shipmentOptions = {}, storefrontIdInput) {
  const storefrontId = assertUuid(storefrontIdInput, 'storefrontId');
  const prepared = await transaction(trx => prepareShippingLabel(trx, context, fulfillmentId, storefrontId));
  if (prepared.replay) return { replay: true, fulfillment: prepared.fulfillment };
  const adapter = shippingProviders.get(prepared.account.provider);
  if (!adapter) throw new CommerceError('adapter logístico indisponível', 'SHIPPING_PROVIDER_NOT_CONFIGURED');
  let external;
  try {
    external = await adapter.createShipment({ account: prepared.account, selectedOption: prepared.selectedOption, from: prepared.from, to: prepared.to, products: prepared.products, volumes: prepared.volumes, shipmentOptions, idempotencyKey: prepared.operationKey });
  } catch (error) {
    await transaction(trx => failShippingLabel(trx, context, fulfillmentId, prepared.operationKey, error, storefrontId));
    throw error;
  }
  try {
    const fulfillment = await transaction(trx => finalizeShippingLabel(trx, context, fulfillmentId, prepared.operationKey, { ...external, carrier: prepared.selectedOption.carrier }, storefrontId));
    return { replay: false, fulfillment };
  } catch (error) {
    const reconciliation = new CommerceError('a etiqueta pode ter sido emitida, mas a confirmação local falhou; reconciliação manual obrigatória', 'SHIPPING_OPERATION_RECONCILIATION_REQUIRED', { operationKey: prepared.operationKey });
    try { await transaction(trx => failShippingLabel(trx, context, fulfillmentId, prepared.operationKey, reconciliation, storefrontId)); } catch { /* preserva o erro conservador mesmo se a marcação falhar */ }
    throw reconciliation;
  }
}

export async function prepareShippingCancellation(trx, contextInput, fulfillmentIdInput, storefrontIdInput) {
  const context = tenantContext(contextInput);
  const fulfillmentId = assertUuid(fulfillmentIdInput, 'fulfillmentId');
  const storefrontId = assertUuid(storefrontIdInput, 'storefrontId');
  const result = await trx.query(
    `SELECT f.id, f.status, f.provider_shipment_id, f.tracking_code, f.shipping_operation_status, f.shipping_operation_started_at,
            o.storefront_id, q.provider, q.ambiente, q.shipping_account_id,
            a.id AS account_id, a.provider AS account_provider, a.ambiente AS account_environment, a.secret_ref, a.public_config, a.ativo AS account_active
       FROM commerce_fulfillments f
       JOIN commerce_orders o ON o.empresa_id = f.empresa_id AND o.id = f.order_id
       LEFT JOIN commerce_shipping_quotes q ON q.empresa_id = f.empresa_id AND q.id = f.shipping_quote_id
       LEFT JOIN commerce_shipping_accounts a ON a.empresa_id = f.empresa_id AND a.id = COALESCE(f.shipping_account_id, q.shipping_account_id)
      WHERE f.empresa_id = $1 AND f.id = $2 AND o.storefront_id = $3
        AND ($4::uuid IS NULL OR o.storefront_id IN (SELECT id FROM commerce_storefronts WHERE empresa_id = $1 AND loja_id = $4))
      FOR UPDATE OF f`,
    [context.empresaId, fulfillmentId, storefrontId, context.lojaId],
  );
  const fulfillment = result.rows[0];
  if (!fulfillment) throw new CommerceError('fulfillment não encontrado no tenant', 'FULFILLMENT_NOT_FOUND');
  if (fulfillment.status === 'cancelled') return { replay: true, fulfillment };
  if (['delivered', 'picked_up', 'out_for_delivery'].includes(fulfillment.status)) throw new CommerceError('pré-postagem não pode ser cancelada após entrada em rota ou entrega', 'SHIPPING_CANCELLATION_NOT_ALLOWED');
  if (fulfillment.account_provider !== 'correios' || !shippingProviders.get('correios')?.cancelShipment) throw new CommerceError('cancelamento Correios indisponível para este fulfillment', 'SHIPPING_PROVIDER_CAPABILITY_UNAVAILABLE');
  if (!fulfillment.provider_shipment_id) throw new CommerceError('fulfillment ainda não possui pré-postagem no provedor', 'SHIPPING_SHIPMENT_NOT_FOUND');
  if (!fulfillment.account_id || !fulfillment.account_active || !shippingSecretConfigured(fulfillment.secret_ref)) throw new CommerceError('conta Correios do fulfillment não está pronta', 'SHIPPING_ACCOUNT_NOT_CONFIGURED');
  if (fulfillment.shipping_operation_status === 'processing' && fulfillment.shipping_operation_started_at && Date.now() - new Date(fulfillment.shipping_operation_started_at).getTime() < 20 * 60 * 1000) throw new CommerceError('o cancelamento deste fulfillment já está em andamento', 'SHIPPING_OPERATION_IN_PROGRESS');
  const operationKey = `shipping-cancel-${fulfillment.id}-${crypto.randomUUID()}`.slice(0, 180);
  await trx.query(`UPDATE commerce_fulfillments SET shipping_operation_status = 'processing', shipping_operation_key = $3, shipping_operation_started_at = CURRENT_TIMESTAMP, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2`, [context.empresaId, fulfillment.id, operationKey]);
  return {
    replay: false,
    operationKey,
    fulfillment,
    account: { id: fulfillment.account_id, provider: fulfillment.account_provider, ambiente: fulfillment.account_environment, secret_ref: fulfillment.secret_ref, public_config: fulfillment.public_config },
    providerShipmentId: fulfillment.provider_shipment_id,
    trackingCode: fulfillment.tracking_code,
  };
}

export async function finalizeShippingCancellation(trx, contextInput, fulfillmentIdInput, operationKey, result, storefrontIdInput) {
  const context = tenantContext(contextInput);
  const fulfillmentId = assertUuid(fulfillmentIdInput, 'fulfillmentId');
  const storefrontId = assertUuid(storefrontIdInput, 'storefrontId');
  const current = await trx.query(
    `SELECT f.id, f.status, f.ocorrencias
       FROM commerce_fulfillments f
       JOIN commerce_orders o ON o.empresa_id = f.empresa_id AND o.id = f.order_id
      WHERE f.empresa_id = $1 AND f.id = $2 AND f.shipping_operation_key = $3 AND o.storefront_id = $4
      FOR UPDATE OF f`,
    [context.empresaId, fulfillmentId, operationKey, storefrontId],
  );
  if (!current.rows[0]) throw new CommerceError('operação de cancelamento não encontrada ou já finalizada', 'SHIPPING_OPERATION_CONFLICT');
  const occurrences = Array.isArray(current.rows[0].ocorrencias) ? current.rows[0].ocorrencias : [];
  occurrences.push({ at: new Date().toISOString(), status: 'cancelled', description: 'Pré-postagem cancelada no provedor Correios', providerData: result?.publicData && typeof result.publicData === 'object' ? { result: text(result.publicData.result, 120) || null, message: text(result.publicData.message, 240) || null } : null });
  const updated = await trx.query(`UPDATE commerce_fulfillments SET status = 'cancelled', shipping_operation_status = 'succeeded', ocorrencias = $3::jsonb, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2 AND EXISTS (SELECT 1 FROM commerce_orders o WHERE o.empresa_id = commerce_fulfillments.empresa_id AND o.id = commerce_fulfillments.order_id AND o.storefront_id = $4) RETURNING *`, [context.empresaId, fulfillmentId, JSON.stringify(occurrences.slice(-100)), storefrontId]);
  return updated.rows[0];
}

export async function failShippingLabel(trx, contextInput, fulfillmentIdInput, operationKey, error, storefrontIdInput) {
  const context = tenantContext(contextInput);
  const fulfillmentId = assertUuid(fulfillmentIdInput, 'fulfillmentId');
  const storefrontId = assertUuid(storefrontIdInput, 'storefrontId');
  const message = text(error?.message || 'falha no provedor logístico', 300);
  const current = await trx.query(`SELECT f.ocorrencias FROM commerce_fulfillments f JOIN commerce_orders o ON o.empresa_id = f.empresa_id AND o.id = f.order_id WHERE f.empresa_id = $1 AND f.id = $2 AND f.shipping_operation_key = $3 AND o.storefront_id = $4 FOR UPDATE OF f`, [context.empresaId, fulfillmentId, operationKey, storefrontId]);
  if (!current.rows[0]) return null;
  const occurrences = Array.isArray(current.rows[0].ocorrencias) ? current.rows[0].ocorrencias : [];
  occurrences.push({ at: new Date().toISOString(), status: 'shipping_unknown', description: message, providerData: { operationKey } });
  const updated = await trx.query(`UPDATE commerce_fulfillments SET shipping_operation_status = 'failed', ocorrencias = $3::jsonb, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2 AND EXISTS (SELECT 1 FROM commerce_orders o WHERE o.empresa_id = commerce_fulfillments.empresa_id AND o.id = commerce_fulfillments.order_id AND o.storefront_id = $4) RETURNING *`, [context.empresaId, fulfillmentId, JSON.stringify(occurrences.slice(-100)), storefrontId]);
  return updated.rows[0];
}

export async function reconcileShippingLabel(trx, contextInput, fulfillmentIdInput, input = {}, storefrontIdInput) {
  const context = tenantContext(contextInput);
  const fulfillmentId = assertUuid(fulfillmentIdInput, 'fulfillmentId');
  const storefrontId = assertUuid(storefrontIdInput, 'storefrontId');
  const operationKey = text(input.operationKey || input.operation_key, 180);
  const providerShipmentId = text(input.providerShipmentId || input.provider_shipment_id, 180);
  if (!operationKey || !providerShipmentId) throw new CommerceError('operationKey e providerShipmentId são obrigatórios', 'SHIPPING_OPERATION_RECONCILIATION_INPUT_INVALID');
  const result = await trx.query(
    `SELECT f.*, o.storefront_id
       FROM commerce_fulfillments f
       JOIN commerce_orders o ON o.empresa_id = f.empresa_id AND o.id = f.order_id
      WHERE f.empresa_id = $1 AND f.id = $2 AND o.storefront_id = $3
        AND ($4::uuid IS NULL OR o.storefront_id IN (
          SELECT id FROM commerce_storefronts WHERE empresa_id = $1 AND loja_id = $4
        ))
      FOR UPDATE OF f`,
    [context.empresaId, fulfillmentId, storefrontId, context.lojaId],
  );
  const current = result.rows[0];
  if (!current) throw new CommerceError('fulfillment não encontrado no tenant ou na loja ativa', 'FULFILLMENT_NOT_FOUND');
  if (current.shipping_operation_status === 'succeeded') {
    if (current.provider_shipment_id === providerShipmentId) return { replay: true, fulfillment: current };
    throw new CommerceError('a etiqueta já foi conciliada com outro identificador do provedor', 'SHIPPING_OPERATION_CONFLICT');
  }
  if (!['processing', 'failed'].includes(current.shipping_operation_status) || current.shipping_operation_key !== operationKey) {
    throw new CommerceError('operação de etiqueta não corresponde ao estado incerto registrado', 'SHIPPING_OPERATION_CONFLICT');
  }
  if (current.provider_shipment_id && current.provider_shipment_id !== providerShipmentId) {
    throw new CommerceError('o fulfillment já possui outro identificador do provedor', 'SHIPPING_OPERATION_CONFLICT');
  }
  const occurrences = Array.isArray(current.ocorrencias) ? current.ocorrencias : [];
  occurrences.push({
    at: new Date().toISOString(),
    status: 'shipping_reconciled',
    description: 'Etiqueta conciliada manualmente após resultado externo incerto',
    providerData: { operationKey },
  });
  const updated = await trx.query(
    `UPDATE commerce_fulfillments
        SET shipping_operation_status = 'succeeded', provider_shipment_id = $4,
            tracking_code = COALESCE($5, tracking_code), tracking_url = COALESCE($6, tracking_url),
            label_url = COALESCE($7, label_url), carrier = COALESCE($8, carrier),
            ocorrencias = $9::jsonb, atualizado_em = CURRENT_TIMESTAMP
      WHERE empresa_id = $1 AND id = $2 AND shipping_operation_key = $3
        AND EXISTS (SELECT 1 FROM commerce_orders o WHERE o.empresa_id = commerce_fulfillments.empresa_id AND o.id = commerce_fulfillments.order_id AND o.storefront_id = $10)
      RETURNING *`,
    [
      context.empresaId,
      fulfillmentId,
      operationKey,
      providerShipmentId,
      text(input.trackingCode || input.tracking_code, 160) || null,
      text(input.trackingUrl || input.tracking_url, 500) || null,
      text(input.labelUrl || input.label_url, 500) || null,
      text(input.carrier, 120) || null,
      JSON.stringify(occurrences.slice(-100)),
      storefrontId,
    ],
  );
  return { replay: false, fulfillment: updated.rows[0] };
}

export async function updateShippingTracking(trx, contextInput, fulfillmentIdInput, tracking, storefrontIdInput) {
  const context = tenantContext(contextInput);
  const fulfillmentId = assertUuid(fulfillmentIdInput, 'fulfillmentId');
  const storefrontId = assertUuid(storefrontIdInput, 'storefrontId');
  const status = text(tracking.providerStatus, 80).toLowerCase();
  const statusMap = { posted: 'shipped', delivered: 'delivered', canceled: 'cancelled', cancelled: 'cancelled', expired: 'cancelled' };
  const next = statusMap[status] || null;
  const allowedByCurrent = { pending: ['cancelled'], preparing: ['cancelled'], ready: ['shipped', 'cancelled'], shipped: ['delivered', 'cancelled'], out_for_delivery: ['delivered', 'cancelled'], failed: ['cancelled'], delivered: [], picked_up: [], cancelled: [] };
  const result = await trx.query(`SELECT f.id, f.status, f.ocorrencias, s.codigo AS storefront_code FROM commerce_fulfillments f JOIN commerce_orders o ON o.empresa_id = f.empresa_id AND o.id = f.order_id JOIN commerce_storefronts s ON s.empresa_id = o.empresa_id AND s.id = o.storefront_id WHERE f.empresa_id = $1 AND f.id = $2 AND o.storefront_id = $3 FOR UPDATE OF f`, [context.empresaId, fulfillmentId, storefrontId]);
  if (!result.rows[0]) throw new CommerceError('fulfillment não encontrado no tenant', 'FULFILLMENT_NOT_FOUND');
  const current = result.rows[0];
  if (current.storefront_code === 'dino-web') throw new CommerceError('tracking de transportadora Dino depende de operação logística habilitada', 'SHIPPING_NATIONAL_FULFILLMENT_NOT_READY');
  const occurrences = Array.isArray(current.ocorrencias) ? current.ocorrencias : [];
  occurrences.push({ at: new Date().toISOString(), status: status || 'tracking_update', description: 'Atualização recebida do provedor logístico' });
  const fields = [];
  const values = [context.empresaId, fulfillmentId, storefrontId];
  const allowedTransition = next && (next === current.status || allowedByCurrent[current.status]?.includes(next));
  if (next && next !== current.status && allowedTransition) { values.push(next); fields.push(`status = $${values.length}`); }
  values.push(tracking.trackingCode || null); fields.push(`tracking_code = COALESCE($${values.length}, tracking_code)`);
  values.push(tracking.trackingUrl || null); fields.push(`tracking_url = COALESCE($${values.length}, tracking_url)`);
  values.push(JSON.stringify(occurrences.slice(-100))); fields.push(`ocorrencias = $${values.length}::jsonb`);
  fields.push(`atualizado_em = CURRENT_TIMESTAMP`);
  const updated = await trx.query(`UPDATE commerce_fulfillments SET ${fields.join(', ')} WHERE empresa_id = $1 AND id = $2 AND EXISTS (SELECT 1 FROM commerce_orders o WHERE o.empresa_id = commerce_fulfillments.empresa_id AND o.id = commerce_fulfillments.order_id AND o.storefront_id = $3) RETURNING *`, values);
  return updated.rows[0];
}
