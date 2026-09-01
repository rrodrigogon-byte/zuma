import crypto from 'node:crypto';
import { CommerceError } from './commerce-core.js';

const SECRET_REF = /^env:[A-Z][A-Z0-9_]{2,}$/;
const DEFAULT_USER_AGENT = 'Kytto Commerce (integracoes@kytto.com.br)';

export class ShippingProviderRegistry {
  constructor() { this.adapters = new Map(); }

  register(provider, adapter) {
    if (!provider || typeof adapter?.quote !== 'function' || typeof adapter?.createShipment !== 'function' || typeof adapter?.track !== 'function' || typeof adapter?.verifyWebhook !== 'function') {
      throw new TypeError('adapter logístico deve implementar quote, createShipment, track e verifyWebhook');
    }
    this.adapters.set(String(provider).toLowerCase(), adapter);
    return this;
  }

  get(provider) { return this.adapters.get(String(provider || '').toLowerCase()); }
}

export const shippingProviders = new ShippingProviderRegistry();

function referenceEnv(reference) {
  const value = String(reference || '').trim();
  if (!SECRET_REF.test(value)) return '';
  return process.env[value.slice(4)] || '';
}

export function shippingSecretConfigured(reference) {
  return Boolean(referenceEnv(reference));
}

function accountSecretRef(account) {
  return account?.secretRef || account?.secret_ref || '';
}

function accountPublicConfig(account) {
  return account?.publicConfig || account?.public_config || {};
}

function providerBaseUrl(provider, environment) {
  const production = String(environment || '').toLowerCase() === 'production';
  if (String(provider || '').toLowerCase() === 'correios') return production ? 'https://api.correios.com.br' : 'https://apihom.correios.com.br';
  return production ? 'https://melhorenvio.com.br' : 'https://sandbox.melhorenvio.com.br';
}

function safeNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positiveNumber(value, field) {
  const number = safeNumber(value);
  if (number === null || number <= 0) throw new CommerceError(`${field} deve ser maior que zero para cotar frete`, 'SHIPPING_PACKAGE_DATA_REQUIRED');
  return number;
}

function safeJson(value) {
  try { return JSON.parse(JSON.stringify(value)); } catch { return {}; }
}

function normalizeProviderOption(option) {
  const amount = safeNumber(option.custom_price ?? option.price);
  if (amount === null || amount < 0) return null;
  const range = option.custom_delivery_range || option.delivery_range || {};
  const minimumDays = safeNumber(range.min ?? option.custom_delivery_time ?? option.delivery_time);
  const maximumDays = safeNumber(range.max ?? option.custom_delivery_time ?? option.delivery_time);
  const providerId = String(option.id ?? option.service_id ?? '').trim();
  if (!providerId) return null;
  return {
    id: providerId,
    name: String(option.name || option.service_name || `Serviço ${providerId}`).slice(0, 160),
    amount: Number(amount.toFixed(2)),
    currency: String(option.currency || 'BRL').slice(0, 8),
    deliveryDays: minimumDays === null ? null : Math.max(0, Math.round(minimumDays)),
    deliveryRange: {
      min: minimumDays === null ? null : Math.max(0, Math.round(minimumDays)),
      max: maximumDays === null ? null : Math.max(0, Math.round(maximumDays)),
    },
    carrier: String(option.company?.name || option.company_name || '').slice(0, 120) || null,
    carrierId: option.company?.id ?? option.company_id ?? null,
  };
}

const DEFAULT_MANUAL_SHIPPING_RULES = Object.freeze([
  { id: 'tangara-da-serra', label: 'Tangará da Serra', uf: 'MT', cities: ['Tangará da Serra'], amount: 25, deliveryDays: 1, priority: 100 },
  { id: 'regional-150km', label: 'Região até 150 km de Tangará da Serra', uf: 'MT', cities: ['Nova Olímpia', 'Barra do Bugres', 'Denise', 'Porto Estrela'], amount: 20, deliveryDays: 1, priority: 80 },
  { id: 'grande-cuiaba', label: 'Grande Cuiabá', uf: 'MT', cities: ['Cuiabá', 'Várzea Grande', 'Acorizal', 'Chapada dos Guimarães', 'Nossa Senhora do Livramento', 'Santo Antônio do Leverger', 'Campo Verde'], amount: 25, deliveryDays: 1, priority: 70 },
  { id: 'fallback-nacional', label: 'Demais localidades', amount: 30, deliveryDays: 10, priority: -100, fallback: true },
]);

function normalizeManualCity(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function normalizeRuleCep(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return /^\d{8}$/.test(digits) ? digits : '';
}

export const OWN_DELIVERY_TYPES = new Set(['motoboy', 'regional_table', 'express', 'free_shipping']);

const BRAZIL_REGION_UFS = {
  norte: ['AC', 'AP', 'AM', 'PA', 'RO', 'RR', 'TO'],
  nordeste: ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'],
  'centro-oeste': ['DF', 'GO', 'MS', 'MT'],
  sudeste: ['ES', 'MG', 'RJ', 'SP'],
  sul: ['PR', 'RS', 'SC'],
};

function normalizeRegion(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/[ _]+/g, '-');
}

function listValues(value) {
  if (Array.isArray(value)) return value;
  return String(value || '').split(',');
}

function ownDeliveryKind(config = {}) {
  const value = String(config.deliveryType || config.kind || config.tipoEntrega || config.ownDeliveryType || 'regional_table').trim().toLowerCase();
  return OWN_DELIVERY_TYPES.has(value) ? value : 'regional_table';
}

function ownDeliveryLabel(kind) {
  return { motoboy: 'Motoboy / entrega local', regional_table: 'Tabela regional', express: 'Entrega expressa', free_shipping: 'Frete grátis' }[kind] || 'Entrega própria';
}

function manualShippingRules(config = {}) {
  const kind = ownDeliveryKind(config);
  const rules = Array.isArray(config.rules) && config.rules.length ? config.rules : kind === 'regional_table' ? DEFAULT_MANUAL_SHIPPING_RULES : [];
  return rules.map((rule, index) => ({
    id: String(rule?.id || `manual-${index + 1}`).slice(0, 80),
    label: String(rule?.label || rule?.name || 'Entrega manual').slice(0, 160),
    uf: String(rule?.uf || '').trim().toUpperCase().slice(0, 2),
    ufs: [...new Set([
      ...listValues(rule?.ufs).map(value => String(value || '').trim().toUpperCase()),
      ...listValues(rule?.regions || rule?.region).flatMap(value => BRAZIL_REGION_UFS[normalizeRegion(value)] || []),
    ].filter(value => /^[A-Z]{2}$/.test(value)))],
    cities: listValues(rule?.cities).map(normalizeManualCity).filter(Boolean),
    cepFrom: normalizeRuleCep(rule?.cepFrom || rule?.cepInicial || rule?.postalCodeFrom),
    cepTo: normalizeRuleCep(rule?.cepTo || rule?.cepFinal || rule?.postalCodeTo),
    zone: Number.isFinite(Number(rule?.zone || rule?.zona)) ? Number(rule.zone || rule.zona) : null,
    distanceKm: Number.isFinite(Number(rule?.distanceKm || rule?.km)) ? Number(rule.distanceKm || rule.km) : null,
    amount: rule?.amount == null || rule?.amount === '' ? null : Number(rule.amount),
    deliveryDays: Math.max(1, Math.round(Number(rule?.deliveryDays || rule?.businessDays || 1))),
    priority: Number.isFinite(Number(rule?.priority)) ? Number(rule.priority) : 0,
    fallback: rule?.fallback === true,
  })).filter(rule => (rule.amount === null || (Number.isFinite(rule.amount) && rule.amount >= 0)) && rule.label);
}

function selectManualShippingRule(config, destinationAddress = {}) {
  const cep = normalizeRuleCep(destinationAddress.cep || destinationAddress.postalCode);
  const city = normalizeManualCity(destinationAddress.cidade || destinationAddress.city);
  const uf = String(destinationAddress.estado || destinationAddress.state || '').trim().toUpperCase();
  const rules = manualShippingRules(config);
  return rules.filter(rule => {
    if (rule.fallback) return true;
    if (rule.uf && rule.uf !== uf) return false;
    if (rule.ufs.length && !rule.ufs.includes(uf)) return false;
    if (rule.cities.length && !rule.cities.includes(city)) return false;
    if (rule.cepFrom && (!cep || cep < rule.cepFrom)) return false;
    if (rule.cepTo && (!cep || cep > rule.cepTo)) return false;
    return true;
  }).sort((left, right) => right.priority - left.priority)[0] || null;
}

function ownDeliveryQuote(methodConfig = {}, destinationAddress = {}, subtotal = 0) {
  const kind = ownDeliveryKind(methodConfig);
  const rule = selectManualShippingRule(methodConfig, destinationAddress);
  const baseFee = Math.max(0, safeNumber(methodConfig.baseFee ?? methodConfig.taxaBase ?? methodConfig.base, 0));
  const perKm = Math.max(0, safeNumber(methodConfig.pricePerKm ?? methodConfig.valorPorKm ?? methodConfig.perKm, 0));
  const perZone = Math.max(0, safeNumber(methodConfig.pricePerZone ?? methodConfig.valorPorZona ?? methodConfig.perZone, 0));
  const zone = Math.max(0, safeNumber(rule?.zone ?? methodConfig.zone ?? methodConfig.zona, 0));
  const distanceKm = Math.max(0, safeNumber(rule?.distanceKm ?? methodConfig.distanceKm ?? methodConfig.distanciaKm, 0));
  const maxRadiusKm = safeNumber(methodConfig.maxRadiusKm ?? methodConfig.raioKm ?? methodConfig.raioAtendimentoKm, null);
  if (maxRadiusKm !== null && distanceKm > maxRadiusKm) throw new CommerceError('este destino está fora do raio de atendimento da loja', 'SHIPPING_DESTINATION_OUTSIDE_RADIUS');
  if ((kind === 'regional_table' || (['motoboy', 'express', 'free_shipping'].includes(kind) && Array.isArray(methodConfig.rules) && methodConfig.rules.length)) && !rule) throw new CommerceError('nenhuma regra de entrega própria está disponível para este destino', 'SHIPPING_DESTINATION_UNAVAILABLE');
  const fixedFee = Math.max(0, safeNumber(methodConfig.fixedFee ?? methodConfig.taxaFixa ?? methodConfig.fee, baseFee));
  const additionalFeeInput = methodConfig.additionalFee ?? methodConfig.adicionalExpresso;
  const hasAdditionalFee = additionalFeeInput !== undefined && additionalFeeInput !== null && additionalFeeInput !== '';
  const additionalFee = Math.max(0, safeNumber(additionalFeeInput, 0));
  const freeAbove = safeNumber(methodConfig.freeShippingAbove ?? methodConfig.freteGratisAcima, null);
  if (kind === 'free_shipping' && freeAbove !== null && Number(subtotal) < freeAbove) throw new CommerceError('o valor mínimo para frete grátis ainda não foi atingido', 'SHIPPING_FREE_SHIPPING_THRESHOLD_NOT_MET', { minimum: freeAbove });
  let amount = kind === 'free_shipping'
    ? 0
    : kind === 'express'
      ? (hasAdditionalFee ? (rule?.amount ?? baseFee) + additionalFee : (rule?.amount ?? fixedFee))
      : kind === 'motoboy'
        ? (rule?.amount ?? baseFee + (zone > 0 && perZone > 0 ? perZone * zone : perKm * distanceKm))
        : (rule?.amount ?? baseFee);
  const freeShippingApplied = freeAbove !== null && Number(subtotal) >= freeAbove;
  if (freeShippingApplied) amount = 0;
  const deliveryDays = Math.max(1, Math.round(Number(rule?.deliveryDays || methodConfig.deliveryDays || methodConfig.prazoDias || (kind === 'express' ? 1 : kind === 'motoboy' ? 1 : 3))));
  const label = rule?.label || ownDeliveryLabel(kind);
  const carrier = kind === 'motoboy' ? 'Motoboy local' : kind === 'express' ? 'Kytto Express' : 'Kytto Entrega';
  const totalAmount = Number(Math.max(0, amount).toFixed(2));
  const priceNote = freeShippingApplied ? `Frete grátis a partir de ${Number(freeAbove).toFixed(2)}` : `${ownDeliveryLabel(kind)} · operação própria, sem Correios`;
  const publicOption = {
    id: `${kind}:${rule?.id || 'default'}`,
    name: freeShippingApplied ? `${label} · frete grátis` : label,
    amount: totalAmount,
    currency: 'BRL',
    provider: 'manual',
    deliveryType: kind,
    providerAmount: totalAmount,
    surchargeRate: 0,
    surchargeAmount: 0,
    priceNote,
    priceBreakdown: { providerAmount: totalAmount, surchargeAmount: 0, totalAmount },
    deliveryDays,
    providerDeliveryDays: null,
    preparationDays: null,
    deliveryRange: { min: deliveryDays, max: deliveryDays },
    deliveryNote: deliveryDays === 1 ? 'Entrega em até 24 horas úteis' : `Prazo estimado de até ${deliveryDays} dias úteis`,
    carrier,
    carrierId: `kytto-${kind}`,
    manualZone: rule?.id || null,
    distanceKm,
    zone,
    freeShippingApplied,
  };
  return { public: publicOption, raw: { ruleId: rule?.id || null, kind, amount: totalAmount, deliveryDays, distanceKm, zone, subtotal: Number(subtotal) || 0 } };
}

function createManualShippingAdapter() {
  return {
    async quote({ methodConfig = {}, destinationAddress = {}, subtotal = 0 }) {
      const option = ownDeliveryQuote(methodConfig, destinationAddress, subtotal);
      return { options: [option.public], providerOptions: [option], provider: 'manual' };
    },
    async createShipment() { throw new CommerceError('a entrega própria não gera etiqueta automática; faça a expedição pela operação da loja', 'SHIPPING_PROVIDER_CAPABILITY_UNAVAILABLE'); },
    async track() { throw new CommerceError('a entrega própria não possui rastreamento automático', 'SHIPPING_TRACKING_UNSUPPORTED'); },
    async verifyWebhook() { throw new CommerceError('a entrega própria não possui webhook de rastreamento', 'SHIPPING_WEBHOOK_UNSUPPORTED'); },
  };
}

function hmacBase64(secret, rawBody) {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
}

function timingSafeEqualText(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function signatureFromRequest(signature) {
  return String(signature || '').trim();
}

function requestHeaders(token, userAgent = DEFAULT_USER_AGENT, idempotencyKey) {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'User-Agent': String(userAgent || DEFAULT_USER_AGENT).slice(0, 240),
    ...(idempotencyKey ? { 'X-Idempotency-Key': String(idempotencyKey).slice(0, 180) } : {}),
  };
}

function accountCredentials(account) {
  const token = referenceEnv(accountSecretRef(account));
  if (!token) throw new CommerceError('token do provedor logístico não configurado no secret manager', 'SHIPPING_ACCOUNT_NOT_CONFIGURED');
  const config = accountPublicConfig(account);
  const provider = String(account?.provider || config.provider || '').toLowerCase();
  const userAgent = config.userAgent || (provider === 'correios' ? process.env.CORREIOS_USER_AGENT : process.env.ME_USER_AGENT || process.env.MELHOR_ENVIO_USER_AGENT) || DEFAULT_USER_AGENT;
  return { token, config, provider, baseUrl: providerBaseUrl(provider, account?.ambiente || account?.environment), userAgent };
}

async function providerRequest(account, path, options = {}) {
  const credentials = accountCredentials(account);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${credentials.baseUrl}${path}`, {
      ...options,
      headers: { ...requestHeaders(credentials.token, credentials.userAgent, options.idempotencyKey), ...(options.headers || {}) },
      signal: controller.signal,
    });
    const text = await response.text();
    let body = {};
    try { body = text ? JSON.parse(text) : {}; } catch { body = { message: text.slice(0, 500) }; }
    if (!response.ok) throw new CommerceError('provedor logístico recusou a operação', 'SHIPPING_PROVIDER_ERROR', { status: response.status, providerMessage: String(body.message || body.error || '').slice(0, 300) });
    return body;
  } catch (error) {
    if (error.name === 'AbortError') throw new CommerceError('provedor logístico não respondeu no prazo', 'SHIPPING_PROVIDER_TIMEOUT');
    if (error instanceof CommerceError) throw error;
    throw new CommerceError('não foi possível comunicar com o provedor logístico', 'SHIPPING_PROVIDER_ERROR');
  } finally {
    clearTimeout(timer);
  }
}

function parseProviderMoney(value) {
  if (value == null || value === '') return null;
  const raw = String(value).replace(/R\$\s*/gi, '').replace(/[^0-9,.-]/g, '').trim();
  if (!raw) return null;
  const normalized = raw.includes(',') && raw.includes('.')
    ? (raw.lastIndexOf(',') > raw.lastIndexOf('.') ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, ''))
    : raw.includes(',') ? raw.replace(',', '.') : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : null;
}

function correiosPackages(products) {
  const normalized = products.map(product => ({
    width: positiveNumber(product.width, 'largura'),
    height: positiveNumber(product.height, 'altura'),
    length: positiveNumber(product.length, 'comprimento'),
    weight: positiveNumber(product.weight, 'peso'),
    quantity: Math.max(1, Math.trunc(Number(product.quantity) || 1)),
  }));
  return {
    width: Math.max(...normalized.map(item => item.width)),
    height: Math.max(...normalized.map(item => item.height)),
    length: normalized.reduce((sum, item) => sum + item.length, 0),
    weightGrams: Math.max(1, Math.round(normalized.reduce((sum, item) => sum + item.weight * item.quantity, 0) * 1000)),
  };
}

function correiosServiceCodes(account, services) {
  const config = accountPublicConfig(account);
  const configured = Array.isArray(services) && services.length ? services : config.services;
  return (Array.isArray(configured) ? configured : String(configured || '').split(',')).map(value => String(value).replace(/\D/g, '')).filter(value => value.length >= 4 && value.length <= 8).slice(0, 20);
}

function correiosStatusFromObject(object) {
  const events = Array.isArray(object?.eventos) ? object.eventos : [];
  const latest = events[0] || events[events.length - 1] || {};
  const description = String(latest.descricao || latest.description || '').toLowerCase();
  const code = String(latest.codigo || '').toUpperCase();
  if (/(entregue|entrega realizada|objeto entregue)/.test(description) || ['BDE', 'BDI'].includes(code)) return 'delivered';
  if (/(saiu para entrega|em rota|distribuição)/.test(description) || ['OEC', 'OEC1'].includes(code)) return 'out_for_delivery';
  if (/(cancel|devolvido|recusado)/.test(description)) return 'cancelled';
  if (/(postado|objeto recebido|encaminhado)/.test(description) || ['PO', 'RO', 'DO'].includes(code)) return 'posted';
  return null;
}

function createMelhorEnvioAdapter() {
  return {
    async quote({ account, originPostalCode, destinationPostalCode, products, services, options = {} }) {
      const payload = {
        from: { postal_code: originPostalCode },
        to: { postal_code: destinationPostalCode },
        products: products.map(product => ({
          id: String(product.id).slice(0, 100),
          width: positiveNumber(product.width, 'largura'),
          height: positiveNumber(product.height, 'altura'),
          length: positiveNumber(product.length, 'comprimento'),
          weight: positiveNumber(product.weight, 'peso'),
          insurance_value: Number(Math.max(0, safeNumber(product.insuranceValue, 0)).toFixed(2)),
          quantity: Math.max(1, Math.trunc(Number(product.quantity))),
        })),
        options: { receipt: options.receipt === true, own_hand: options.ownHand === true },
      };
      const serviceList = Array.isArray(services) ? services.map(value => String(value).replace(/[^0-9]/g, '')).filter(Boolean) : [];
      if (serviceList.length) payload.services = serviceList.join(',');
      const response = await providerRequest(account, '/api/v2/me/shipment/calculate', { method: 'POST', body: JSON.stringify(payload) });
      const rawOptions = Array.isArray(response) ? response : Array.isArray(response?.data) ? response.data : Array.isArray(response?.items) ? response.items : [];
      const optionsWithSnapshots = rawOptions.map(raw => ({ public: normalizeProviderOption(raw), raw: safeJson(raw) })).filter(item => item.public);
      if (!optionsWithSnapshots.length) throw new CommerceError('provedor logístico não retornou opções para este CEP e pacote', 'SHIPPING_NO_OPTIONS');
      return {
        options: optionsWithSnapshots.map(item => item.public),
        providerOptions: optionsWithSnapshots,
        provider: 'melhorenvio',
      };
    },

    async createShipment({ account, selectedOption, from, to, products, volumes, shipmentOptions = {}, idempotencyKey }) {
      const credentials = accountCredentials(account);
      const policy = accountPublicConfig(account).shipment || {};
      const nonCommercial = shipmentOptions.nonCommercial === true || policy.nonCommercial === true;
      const invoiceKey = String(shipmentOptions.invoiceKey || policy.invoiceKey || '').trim();
      if (!nonCommercial && !invoiceKey) throw new CommerceError('chave da nota fiscal ou política de declaração de conteúdo é obrigatória antes de gerar etiqueta', 'SHIPPING_INVOICE_REQUIRED');
      const raw = selectedOption?.raw || selectedOption?.providerSnapshot || {};
      const service = Number(raw.id ?? selectedOption?.id);
      if (!Number.isInteger(service) || service <= 0) throw new CommerceError('serviço logístico da cotação é inválido', 'SHIPPING_QUOTE_INVALID');
      const packageVolumes = (volumes?.length ? volumes : raw.packages || []).map(volume => ({
        height: positiveNumber(volume.height ?? volume.dimensions?.height, 'altura'),
        width: positiveNumber(volume.width ?? volume.dimensions?.width, 'largura'),
        length: positiveNumber(volume.length ?? volume.dimensions?.length, 'comprimento'),
        weight: positiveNumber(volume.weight, 'peso'),
      }));
      if (!packageVolumes.length) throw new CommerceError('a cotação não trouxe volumes para geração da etiqueta', 'SHIPPING_PACKAGE_DATA_REQUIRED');
      const payload = {
        service,
        from: { ...from, postal_code: from.postal_code || from.cep, country_id: 'BR' },
        to: { ...to, postal_code: to.postal_code || to.cep, country_id: 'BR' },
        products: products.map(product => ({ name: String(product.name).slice(0, 160), quantity: String(product.quantity), unitary_value: Number(product.unitaryValue || 0) })),
        volumes: packageVolumes,
        options: {
          insurance_value: Number(Math.max(0, safeNumber(shipmentOptions.insuranceValue, 0)).toFixed(2)),
          receipt: shipmentOptions.receipt === true,
          own_hand: shipmentOptions.ownHand === true,
          reverse: false,
          non_commercial: nonCommercial,
          ...(invoiceKey ? { invoice: { key: invoiceKey } } : {}),
          platform: 'Kytto Commerce',
          tags: [{ tag: String(shipmentOptions.orderCode || '').slice(0, 160), url: String(shipmentOptions.orderUrl || '').slice(0, 500) || null }],
        },
      };
      const cart = await providerRequest(account, '/api/v2/me/cart', { method: 'POST', body: JSON.stringify(payload), idempotencyKey });
      const shipmentId = String(cart.id || cart.order_id || '').trim();
      if (!shipmentId) throw new CommerceError('provedor logístico não retornou id do envio', 'SHIPPING_ADAPTER_INVALID_RESPONSE');
      await providerRequest(account, '/api/v2/me/shipment/checkout', { method: 'POST', body: JSON.stringify({ orders: [shipmentId] }), idempotencyKey });
      const generated = await providerRequest(account, '/api/v2/me/shipment/generate', { method: 'POST', body: JSON.stringify({ orders: [shipmentId] }), idempotencyKey });
      const printed = await providerRequest(account, '/api/v2/me/shipment/print', { method: 'POST', body: JSON.stringify({ orders: [shipmentId], mode: 'private' }), idempotencyKey });
      return {
        providerShipmentId: shipmentId,
        trackingCode: String(cart.tracking || cart.tracking_number || '').trim() || null,
        trackingUrl: String(cart.tracking_url || '').trim() || null,
        labelUrl: String(printed.url || '').trim() || null,
        providerStatus: generated?.[shipmentId]?.message || cart.status || 'generated',
        publicData: { labelUrl: String(printed.url || '').trim() || null },
      };
    },

    async track({ account, providerShipmentId }) {
      const response = await providerRequest(account, '/api/v2/me/shipment/tracking', { method: 'POST', body: JSON.stringify({ orders: [String(providerShipmentId)] }) });
      const current = response?.[providerShipmentId] || response?.data?.[providerShipmentId] || response;
      return {
        providerStatus: String(current?.status || '').slice(0, 80) || null,
        trackingCode: String(current?.tracking || current?.melhorenvio_tracking || '').trim() || null,
        trackingUrl: String(current?.tracking_url || '').trim() || null,
        events: Array.isArray(current?.events) ? current.events.slice(-100) : [],
        providerData: safeJson(current),
      };
    },

    async verifyWebhook({ payload, signature, context }) {
      const account = context?.account || {};
      const configuredRef = accountPublicConfig(account).webhookSecretRef || accountPublicConfig(account).webhook_secret_ref || account.webhook_secret_ref || (process.env.ME_WEBHOOK_SECRET ? 'env:ME_WEBHOOK_SECRET' : '');
      const secret = referenceEnv(configuredRef);
      if (!secret) throw new CommerceError('segredo do webhook logístico não configurado', 'SHIPPING_WEBHOOK_INVALID');
      const rawBody = context?.rawBody || Buffer.from(JSON.stringify(payload || {}));
      const received = signatureFromRequest(signature);
      const expected = hmacBase64(secret, rawBody);
      if (!timingSafeEqualText(expected, received)) throw new CommerceError('assinatura do webhook logístico inválida', 'SHIPPING_WEBHOOK_INVALID');
      const providerShipmentId = String(payload?.data?.id || payload?.id || '').trim();
      if (!providerShipmentId) throw new CommerceError('webhook logístico sem id do envio', 'SHIPPING_WEBHOOK_INVALID');
      return {
        eventId: String(payload?.id || `${providerShipmentId}:${payload?.event || payload?.type || 'status'}`).slice(0, 180),
        eventType: String(payload?.event || payload?.type || 'order.status').slice(0, 100),
        providerShipmentId,
        providerStatus: String(payload?.data?.status || payload?.status || '').slice(0, 80),
        trackingCode: String(payload?.data?.tracking || '').trim() || null,
        trackingUrl: String(payload?.data?.tracking_url || '').trim() || null,
        summary: { event: String(payload?.event || payload?.type || '').slice(0, 100) },
      };
    },
  };
}

function correiosDigits(value, max = 240) {
  return String(value || '').replace(/\D/g, '').slice(0, max);
}

function correiosPhoneFields(value) {
  const digits = correiosDigits(value, 20);
  if (digits.length === 11) return { dddCelular: digits.slice(0, 2), celular: digits.slice(2) };
  if (digits.length === 10) return { dddTelefone: digits.slice(0, 2), telefone: digits.slice(2) };
  if (digits.length >= 8) return { telefone: digits.slice(-8) };
  return {};
}

function correiosRequiredAddress(input, role) {
  const address = {
    cep: correiosDigits(input?.postal_code || input?.cep, 8),
    logradouro: String(input?.address || input?.logradouro || '').trim().slice(0, 50),
    numero: String(input?.number || input?.numero || '').trim().slice(0, 6),
    complemento: String(input?.complement || input?.complemento || '').trim().slice(0, 30),
    bairro: String(input?.district || input?.bairro || '').trim().slice(0, 30),
    cidade: String(input?.city || input?.cidade || '').trim().slice(0, 30),
    uf: String(input?.state_abbr || input?.estado || input?.uf || '').trim().toUpperCase().slice(0, 2),
    pais: 'BR',
  };
  if (!/^\d{8}$/.test(address.cep) || !address.logradouro || !address.numero || !address.bairro || !address.cidade || !/^[A-Z]{2}$/.test(address.uf)) {
    throw new CommerceError(`${role} incompleto para pré-postagem Correios`, 'SHIPPING_ADDRESS_INCOMPLETE');
  }
  if (role === 'destinatário') address.regiao = '';
  return address;
}

function correiosPerson(input, role) {
  const name = String(input?.name || input?.destinatario || '').trim().slice(0, 50);
  if (name.length < 3) throw new CommerceError(`${role} deve ter ao menos 3 caracteres`, 'SHIPPING_ADDRESS_REQUIRED');
  const person = { nome: name, endereco: correiosRequiredAddress(input, role) };
  const phone = correiosPhoneFields(input?.phone || input?.telefone);
  Object.assign(person, phone);
  if (input?.email) person.email = String(input.email).trim().slice(0, 255).toLowerCase();
  const document = correiosDigits(input?.document || input?.documento, 14);
  if (document) person.cpfCnpj = document;
  return person;
}

function correiosShipmentVolumes(selectedOption, volumes) {
  const source = volumes?.length ? volumes : selectedOption?.raw?.packages || selectedOption?.providerSnapshot?.packages || [];
  const normalized = source.map(volume => ({
    width: positiveNumber(volume.width ?? volume.dimensions?.width, 'largura'),
    height: positiveNumber(volume.height ?? volume.dimensions?.height, 'altura'),
    length: positiveNumber(volume.length ?? volume.dimensions?.length, 'comprimento'),
    weight: positiveNumber(volume.weight, 'peso'),
  }));
  if (!normalized.length) throw new CommerceError('a cotação não trouxe volumes para pré-postagem Correios', 'SHIPPING_PACKAGE_DATA_REQUIRED');
  return {
    width: Math.max(...normalized.map(item => item.width)),
    height: Math.max(...normalized.map(item => item.height)),
    length: normalized.reduce((sum, item) => sum + item.length, 0),
    weightGrams: Math.max(1, Math.round(normalized.reduce((sum, item) => sum + item.weight, 0) * 1000)),
  };
}

function correiosReceipt(value) {
  if (typeof value === 'string') return value.trim().slice(0, 180) || null;
  return String(value?.idRecibo || value?.recibo || value?.reciboSolicitacaoAssincrona || value?.reciboSolicitacaoAssincronaRotulo || value?.id || '').trim().slice(0, 180) || null;
}

function correiosTrackingUrl(code) {
  const normalized = String(code || '').trim().toUpperCase();
  return /^[A-Z]{2}\d{9}[A-Z]{2}$/.test(normalized) ? `https://rastreamento.correios.com.br/app/index.php?objetos=${encodeURIComponent(normalized)}` : null;
}

const CORREIOS_PREPARATION_DAYS = 2;
const CORREIOS_SURCHARGE_RATE = 0.12;

function correiosPriceBreakdown(providerAmount) {
  const base = Number(Number(providerAmount).toFixed(2));
  const surchargeAmount = Number((base * CORREIOS_SURCHARGE_RATE).toFixed(2));
  const totalAmount = Number((base + surchargeAmount).toFixed(2));
  return { providerAmount: base, surchargeRate: CORREIOS_SURCHARGE_RATE, surchargeAmount, totalAmount };
}

function correiosPrepostPath(path) {
  return `/prepostagem${path}`;
}

function correiosDeliveryTiming(days) {
  const providerDays = days === null ? null : Math.max(0, Math.round(days));
  if (providerDays === null) return { providerDeliveryDays: null, preparationDays: null, deliveryDays: null, deliveryRange: { min: null, max: null } };
  const totalDays = providerDays + CORREIOS_PREPARATION_DAYS;
  return { providerDeliveryDays: providerDays, preparationDays: CORREIOS_PREPARATION_DAYS, deliveryDays: totalDays, deliveryRange: { min: totalDays, max: totalDays }, deliveryNote: 'Prazo Correios mais 2 dias úteis de preparação e postagem' };
}

function createCorreiosAdapter() {
  return {
    async quote({ account, originPostalCode, destinationPostalCode, products, services }) {
      const codes = correiosServiceCodes(account, services);
      if (!codes.length) throw new CommerceError('configure ao menos um código de serviço contratado dos Correios', 'SHIPPING_SERVICE_CODES_REQUIRED');
      const pack = correiosPackages(products);
      const config = accountPublicConfig(account);
      const additionalServices = (Array.isArray(config.servicesAdditional) ? config.servicesAdditional : []).map(value => String(value).replace(/\D/g, '')).filter(Boolean);
      const declaredValue = Number(products.reduce((sum, product) => sum + Math.max(0, safeNumber(product.insuranceValue, 0)) * Math.max(1, Math.trunc(Number(product.quantity) || 1)), 0).toFixed(2));
      const priceRows = await Promise.all(codes.map(async (code) => {
        const params = new URLSearchParams({ cepDestino: destinationPostalCode, cepOrigem: originPostalCode, psObjeto: String(pack.weightGrams), tpObjeto: String(config.objectType || '2'), comprimento: String(Math.ceil(pack.length)), largura: String(Math.ceil(pack.width)), altura: String(Math.ceil(pack.height)) });
        if (declaredValue > 0) params.set('vlDeclarado', String(declaredValue));
        additionalServices.forEach(value => params.append('servicosAdicionais', value));
        const price = await providerRequest(account, `/preco/v1/nacional/${encodeURIComponent(code)}?${params.toString()}`, { method: 'GET' });
        const prazo = await providerRequest(account, `/prazo/v1/nacional/${encodeURIComponent(code)}?cepOrigem=${encodeURIComponent(originPostalCode)}&cepDestino=${encodeURIComponent(destinationPostalCode)}`, { method: 'GET' });
        return { code, price: safeJson(price), prazo: safeJson(prazo) };
      }));
      const optionsWithSnapshots = priceRows.map(row => {
        const providerAmount = parseProviderMoney(row.price?.pcFinal ?? row.price?.pcTotal ?? row.price?.pcBaseGeral ?? row.price?.pcBase ?? row.price?.valor);
        if (providerAmount === null || providerAmount < 0) return null;
        const pricing = correiosPriceBreakdown(providerAmount);
        const days = safeNumber(row.prazo?.prazoEntrega ?? row.prazo?.prazo ?? row.prazoEntrega);
        const name = config.serviceNames?.[row.code] || `Correios ${row.code}`;
        const timing = correiosDeliveryTiming(days);
        const publicOption = { id: row.code, name: String(name).slice(0, 160), amount: pricing.totalAmount, currency: 'BRL', providerAmount: pricing.providerAmount, surchargeRate: pricing.surchargeRate, surchargeAmount: pricing.surchargeAmount, priceNote: 'Tarifa oficial dos Correios + 12% de operação logística', priceBreakdown: { providerAmount: pricing.providerAmount, surchargeAmount: pricing.surchargeAmount, totalAmount: pricing.totalAmount }, ...timing, carrier: 'Correios', carrierId: row.code };
        return { public: publicOption, raw: { price: row.price, prazo: row.prazo, packages: [{ width: pack.width, height: pack.height, length: pack.length, weight: pack.weightGrams / 1000 }] } };
      }).filter(Boolean);
      if (!optionsWithSnapshots.length) throw new CommerceError('Correios não retornou preço válido para os serviços configurados', 'SHIPPING_NO_OPTIONS');
      return { options: optionsWithSnapshots.map(item => item.public), providerOptions: optionsWithSnapshots, provider: 'correios' };
    },

    async createShipment({ account, selectedOption, from, to, products, volumes, shipmentOptions = {}, idempotencyKey }) {
      const credentials = accountCredentials(account);
      const config = accountPublicConfig(account);
      if (config.prepostagemApiEnabled !== true) throw new CommerceError('pré-postagem Correios desabilitada: valide a API 36 no CWS e ative a capability da conta', 'SHIPPING_PROVIDER_CAPABILITY_UNAVAILABLE');
      const policy = config.shipment || {};
      const modalidadePagamento = String(config.modalidadePagamento || '').trim();
      if (!['1', '2', '3', '4'].includes(modalidadePagamento)) throw new CommerceError('configure a modalidade de pagamento Correios da conta antes da pré-postagem', 'SHIPPING_PREPOST_PAYMENT_MODE_REQUIRED');
      const nonCommercial = shipmentOptions.nonCommercial === true || policy.nonCommercial === true;
      const invoiceNumber = String(shipmentOptions.invoiceNumber || policy.invoiceNumber || '').replace(/\D/g, '');
      const invoiceKey = String(shipmentOptions.invoiceKey || policy.invoiceKey || '').replace(/\D/g, '');
      if (!nonCommercial && !invoiceNumber && !invoiceKey) throw new CommerceError('informe NF, chave NFe ou declaração de conteúdo antes da pré-postagem Correios', 'SHIPPING_INVOICE_REQUIRED');
      if (invoiceNumber && !/^\d{1,12}$/.test(invoiceNumber)) throw new CommerceError('número da nota fiscal inválido para pré-postagem Correios', 'SHIPPING_INVOICE_INVALID');
      if (invoiceKey && !/^\d{44}$/.test(invoiceKey)) throw new CommerceError('chave NFe inválida para pré-postagem Correios', 'SHIPPING_INVOICE_INVALID');
      const serviceCode = String(selectedOption?.id || selectedOption?.raw?.coProduto || '').replace(/\D/g, '').slice(0, 8);
      if (serviceCode.length < 4) throw new CommerceError('serviço Correios da cotação é inválido', 'SHIPPING_QUOTE_INVALID');
      const pack = correiosShipmentVolumes(selectedOption, volumes);
      const declaration = (products || []).map(product => ({
        conteudo: String(product.name || 'Produto').trim().slice(0, 60).padEnd(2, 'P'),
        quantidade: String(Math.max(1, Math.trunc(Number(product.quantity) || 1))),
        valor: Math.max(0, safeNumber(product.unitaryValue, 0)).toFixed(2),
      }));
      if (!declaration.length) throw new CommerceError('a pré-postagem Correios exige ao menos um item na declaração de conteúdo', 'SHIPPING_DECLARATION_REQUIRED');
      const payload = {
        remetente: correiosPerson(from, 'remetente'),
        destinatario: correiosPerson(to, 'destinatário'),
        codigoServico: serviceCode,
        ...(invoiceNumber ? { numeroNotaFiscal: invoiceNumber } : {}),
        ...(invoiceKey ? { chaveNFe: invoiceKey } : {}),
        ...(config.postingCard ? { numeroCartaoPostagem: String(config.postingCard).slice(0, 40) } : {}),
        listaServicoAdicional: (Array.isArray(config.servicesAdditional) ? config.servicesAdditional : []).map(code => ({ codigoServicoAdicional: String(code).replace(/\D/g, '').slice(0, 3) })).filter(item => item.codigoServicoAdicional.length === 3),
        itensDeclaracaoConteudo: declaration,
        pesoInformado: String(pack.weightGrams),
        codigoFormatoObjetoInformado: ['1', '2', '3'].includes(String(config.objectType || '2')) ? String(config.objectType || '2') : '2',
        alturaInformada: String(Math.ceil(pack.height)),
        larguraInformada: String(Math.ceil(pack.width)),
        comprimentoInformado: String(Math.ceil(pack.length)),
        cienteObjetoNaoProibido: '1',
        solicitarColeta: 'N',
        embalagem: 'S',
        logisticaReversa: 'N',
        modalidadePagamento,
        observacao: String(shipmentOptions.orderCode || '').trim().slice(0, 50) || undefined,
        canalExternoOrigem: 'KYTTO',
        pedidoExternoOrigem: String(shipmentOptions.orderCode || '').trim().slice(0, 25) || undefined,
      };
      Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);
      const prepostagem = await providerRequest(account, correiosPrepostPath('/v1/prepostagens'), { method: 'POST', body: JSON.stringify(payload), idempotencyKey });
      const prepost = prepostagem?.prePostagem || prepostagem?.prepostagem || prepostagem?.data || prepostagem;
      const prepostagemId = String(prepost?.id || '').trim();
      const trackingCode = String(prepost?.codigoObjeto || '').trim().toUpperCase() || null;
      if (!prepostagemId) throw new CommerceError('Correios não retornou o identificador da pré-postagem', 'SHIPPING_ADAPTER_INVALID_RESPONSE');
      let labelReceipt = null;
      let labelRequestError = null;
      try {
        const labelResponse = await providerRequest(account, correiosPrepostPath('/v1/prepostagens/rotulo/assincrono/pdf'), { method: 'POST', body: JSON.stringify({ idsPrePostagem: [prepostagemId], tipoRotulo: String(config.labelType || 'P').toUpperCase() === 'R' ? 'R' : 'P', formatoRotulo: String(config.labelFormat || 'ET').toUpperCase() === 'EV' ? 'EV' : 'ET', imprimeRemetente: 'S', layoutImpressao: String(config.labelLayout || 'PADRAO').slice(0, 30) }), idempotencyKey });
        labelReceipt = correiosReceipt(labelResponse);
      } catch (error) {
        labelRequestError = { code: String(error.code || 'SHIPPING_LABEL_REQUEST_FAILED').slice(0, 80), message: String(error.message || 'não foi possível solicitar o rótulo').slice(0, 240) };
      }
      return {
        providerShipmentId: prepostagemId,
        trackingCode,
        trackingUrl: correiosTrackingUrl(trackingCode),
        labelUrl: null,
        providerStatus: labelReceipt ? 'preposted_label_requested' : 'preposted_label_request_failed',
        publicData: { prepostagemId, trackingCode, labelReceipt, ...(labelRequestError ? { labelRequestError } : {}) },
      };
    },

    async cancelShipment({ account, providerShipmentId, trackingCode, idempotencyKey }) {
      const id = String(providerShipmentId || '').trim();
      const code = String(trackingCode || '').trim().toUpperCase();
      if (!id && !/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(code)) throw new CommerceError('pré-postagem Correios sem identificador para cancelamento', 'SHIPPING_SHIPMENT_NOT_FOUND');
      const path = correiosPrepostPath(/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(code) ? `/v1/prepostagens/objeto/${encodeURIComponent(code)}` : `/v1/prepostagens/${encodeURIComponent(id)}`);
      const response = await providerRequest(account, path, { method: 'DELETE', idempotencyKey });
      return { providerStatus: 'cancelled', publicData: { result: String(response?.resultadoCancelamento || '').slice(0, 120) || null, message: String(response?.mensagem || '').slice(0, 240) || null } };
    },

    async track({ account, providerShipmentId }) {
      const code = String(providerShipmentId || '').trim().toUpperCase();
      if (!/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(code)) throw new CommerceError('código de rastreio dos Correios inválido', 'SHIPPING_TRACKING_INVALID');
      const response = await providerRequest(account, `/srorastro/v1/objetos/${encodeURIComponent(code)}?resultado=T`, { method: 'GET' });
      const object = Array.isArray(response?.objetos) ? response.objetos[0] : response?.objeto || response;
      const rawEvents = Array.isArray(object?.eventos) ? object.eventos : [];
      const events = rawEvents.slice(0, 100).map(event => ({ at: event.dtHrCriado || event.data || null, status: event.codigo || null, description: String(event.descricao || '').slice(0, 300), location: event.unidade?.endereco ? { city: event.unidade.endereco.cidade || null, state: event.unidade.endereco.uf || null } : null }));
      return { providerStatus: correiosStatusFromObject(object), trackingCode: String(object?.codObjeto || object?.codigo || code).trim(), trackingUrl: `https://rastreamento.correios.com.br/app/index.php?objetos=${encodeURIComponent(code)}`, events, providerData: safeJson({ codigo: object?.codObjeto || object?.codigo || code, eventos: events }) };
    },

    async verifyWebhook() {
      throw new CommerceError('Correios não possui webhook logístico habilitado neste adapter; use sincronização autenticada de rastreamento', 'SHIPPING_WEBHOOK_UNSUPPORTED');
    },
  };
}

shippingProviders.register('melhorenvio', createMelhorEnvioAdapter());
shippingProviders.register('correios', createCorreiosAdapter());
shippingProviders.register('manual', createManualShippingAdapter());

export function melhorEnvioConfigured() {
  return Boolean(process.env.ME_ACCESS_TOKEN || process.env.MELHOR_ENVIO_ACCESS_TOKEN);
}

export { SECRET_REF, accountPublicConfig, accountSecretRef, normalizeProviderOption, referenceEnv };
