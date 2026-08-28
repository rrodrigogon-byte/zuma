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
  const normalized = String(value).replace(/R\$\s*/gi, '').replace(/\./g, '').replace(',', '.').trim();
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
        const amount = parseProviderMoney(row.price?.pcFinal ?? row.price?.pcTotal ?? row.price?.pcBaseGeral ?? row.price?.pcBase ?? row.price?.valor);
        if (amount === null || amount < 0) return null;
        const days = safeNumber(row.prazo?.prazoEntrega ?? row.prazo?.prazo ?? row.prazoEntrega);
        const name = config.serviceNames?.[row.code] || `Correios ${row.code}`;
        const publicOption = { id: row.code, name: String(name).slice(0, 160), amount, currency: 'BRL', deliveryDays: days === null ? null : Math.max(0, Math.round(days)), deliveryRange: { min: days === null ? null : Math.max(0, Math.round(days)), max: days === null ? null : Math.max(0, Math.round(days)) }, carrier: 'Correios', carrierId: row.code };
        return { public: publicOption, raw: { price: row.price, prazo: row.prazo, packages: [{ width: pack.width, height: pack.height, length: pack.length, weight: pack.weightGrams / 1000 }] } };
      }).filter(Boolean);
      if (!optionsWithSnapshots.length) throw new CommerceError('Correios não retornou preço válido para os serviços configurados', 'SHIPPING_NO_OPTIONS');
      return { options: optionsWithSnapshots.map(item => item.public), providerOptions: optionsWithSnapshots, provider: 'correios' };
    },

    async createShipment() {
      throw new CommerceError('pré-postagem Correios depende da API 36 e do schema autorizado no CWS desta conta; valide a documentação antes de habilitar etiqueta', 'SHIPPING_PROVIDER_CAPABILITY_UNAVAILABLE');
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

export function melhorEnvioConfigured() {
  return Boolean(process.env.ME_ACCESS_TOKEN || process.env.MELHOR_ENVIO_ACCESS_TOKEN);
}

export { SECRET_REF, accountPublicConfig, accountSecretRef, normalizeProviderOption, referenceEnv };
