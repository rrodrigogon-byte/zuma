import { confirmPhoneVerification, phoneVerificationAvailable, startPhoneVerification, verifyPhoneToken } from './phone-verification.js';
import { createCreditPayment } from './commerce-credit.js';
import { phoneMatchKey } from './whatsapp-phone.js';
import crypto from 'node:crypto';
import express from 'express';
import { db } from './database.js';
import { customerReport, fulfillmentReport, inventoryReport, salesReport } from './commerce-reports.js';
import { canTransitionPaymentStatus, captureNeedsRefund, otherCapturedPayment, createPaymentAttempt, publicPaymentMethods, paymentAccountReady, paymentProviders, reconcilePaymentByIdentifiers, recordLatePaymentCapture, resolvedPaymentMethod, syncPaymentAttempt, validatePaymentMethod, verifyPaymentWebhook } from './payment-adapters.js';
import { infinitepayWebhookDuplicateOwnerSql, infinitepayWebhookUnboundOwnerSql, publicInfinitepayPaymentLookupSql } from './commerce-payment-return.js';
import { lateCaptureReviewExistsSql } from './commerce-order-payment-status.js';
import { createPaymentAccount, listPaymentAccounts, listPaymentProviders, listPayments, updatePaymentAccount } from './commerce-payment-admin.js';
import { resolveCommerceIdentity } from './commerce-identity-bridge.js';
import { restricaoDePermissao } from './perfis-acesso.js';
import { applyPromotionToOrder, createPromotion, createPromotionCode, createPromotionTemplate, listPromotionTemplates, listPromotions, previewPromotion, updatePromotion, updatePromotionCode } from './commerce-promotions.js';
import { createStorefront, listStorefronts, updateStorefront } from './commerce-storefronts.js';
import { resolveStorefrontAlias } from './commerce-tenants.js';
import { executeCatalogImport, previewCatalogImport } from './commerce-catalog-import.js';
import { previewAvecCatalog } from './avec-catalog-preview.js';
import { previewAvecGovernance } from './avec-import-governance.js';
import { createMembership, isLegacyGlobalAdmin, listMembershipCandidates, listMemberships, listRoles, updateMembership } from './commerce-admin-users.js';
import { createCustomer, createCustomerAddress, deleteCustomerAddress, getCustomer, listCustomerAddresses, updateCustomer, updateCustomerAddress } from './commerce-customers.js';
import { createCreditAccount, listCreditAccounts, listCreditEntries, updateCreditAccount } from './commerce-credit.js';
import { createStorefrontDomain, listStorefrontDomains, setPrimaryStorefrontDomain, verifyStorefrontDomain } from './commerce-domains.js';
import { createShippingAccount, failShippingLabel, finalizeShippingCancellation, issueShippingLabel, listShippingAccounts, listShippingProviders, lookupPostalCode, prepareShippingCancellation, publicShippingMethod, quoteAvailableShipping, quoteShipping, reconcileShippingLabel, shippingAccountReady, updateShippingAccount, updateShippingTracking } from './commerce-shipping.js';
import { shippingProviders } from './shipping-adapters.js';
import { recordStorefrontEvent } from '../storefront-funnel.js';
import { commerceMediaIdForIdempotencyKey, deleteCommerceImage, newCommerceMediaId, streamCommerceImage, uploadCommerceImage } from './commerce-media.js';
import { claimWhatsappAiHandoff, closeWhatsappAiHandoff, getWhatsappAiConversation, sendWhatsappAiStaffMessage, configureWhatsappAiChannel, configureWhatsappAiPolicy, listWhatsappAiSessions, releaseWhatsappAiHandoff, syncWhatsappAiWebhook, testWhatsappAiGemini, whatsappAiOperationalStatus, configureWhatsappAiHandoff, diagnosticoAgendaVendaWhatsappAi, whatsappChannelType } from './whatsapp-ai.js';
import { campaignMetrics, cancelCampaign, confirmCampaign, createCampaign, listCampaignAudience, listCampaigns, previewCampaign, updateCampaignConsent } from './commerce-campaigns.js';
import { cartRecoveryMetrics, listAbandonedCarts, syncPublicCart } from './commerce-abandoned-carts.js';
import { consumePublicRateLimit, consumeWebhookRateLimit, createWebhookAuditAdapter, publicRequestFingerprint, webhookPayloadHash, webhookRequestId } from './commerce-public-rate-limit.js';
import { satisfactionEligible, submitOrderSatisfaction } from './commerce-satisfaction.js';
import {
  CommerceError,
  assertUuid,
  auditLog,
  adjustInventory,
  archiveCatalogProduct,
  archiveCatalogVariant,
  createCatalogMedia,
  createCatalogProduct,
  createCatalogVariant,
  createCategory,
  createFulfillment,
  createInventoryLocation,
  createPendingOrder,
  recoverExpiredPaidOrder,
  listPublishedProducts,
  publishCatalogProduct,
  saveCatalogProductWorkspace,
  setVariantPrice,
  updateCategory,
  updateCatalogVariant,
  deleteCatalogMedia,
  listCatalogMedia,
  resolveCatalogResourceScope,
  createShippingMethod,
  updateShippingMethod,
  tenantContext,
  transitionOrder,
  flagPaymentAfterCancellation,
  updateCatalogProduct,
  updateFulfillment,
  withCommerceTransaction,
  allowedMediaUrl,
} from './commerce-core.js';

function whatsappTipoCanal(req) {
  // Só aceita cliente/gestao/lancamentos; valor fora disso responde erro em vez de virar filtro livre.
  return whatsappChannelType(req.query?.canal || req.body?.tipoCanal || req.body?.channelType || 'cliente');
}

function publicHost(req) {
  const forwarded = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  return (forwarded || req.hostname || '').split(':')[0].toLowerCase();
}

async function resolvePublicStorefront(req) {
  if (req.publicResolvedStorefront) {
    if (!req.publicResolvedStorefront.loja_id) throw new CommerceError('storefront ainda não possui unidade operacional', 'STOREFRONT_OPERATIONAL_STORE_REQUIRED');
    return req.publicResolvedStorefront;
  }
  if (req.publicStoreAlias) {
    req.publicResolvedStorefront = await resolveStorefrontAlias(req.publicStoreAlias);
    if (!req.publicResolvedStorefront?.loja_id) throw new CommerceError('storefront ainda não possui unidade operacional', 'STOREFRONT_OPERATIONAL_STORE_REQUIRED');
    return req.publicResolvedStorefront;
  }
  const dominio = publicHost(req);
  if (!dominio) throw new CommerceError('domínio da loja não resolvido', 'STOREFRONT_DOMAIN_REQUIRED');
  const result = await db.query(
    `SELECT s.id, s.empresa_id, s.loja_id, s.codigo, s.nome, s.canal, s.status, s.moeda, s.timezone,
            s.configuracoes,
            COALESCE((SELECT a.public_config FROM commerce_storefront_aliases a
                       WHERE a.empresa_id = s.empresa_id AND a.storefront_id = s.id AND a.ativo = true
                         AND a.public_config <> '{}'::jsonb
                       ORDER BY a.atualizado_em DESC NULLS LAST LIMIT 1), '{}'::jsonb) AS public_config,
            COALESCE(s.configuracoes->>'brandKey', 'default') AS brand_key
       FROM commerce_store_domains d
       JOIN commerce_storefronts s
         ON s.empresa_id = d.empresa_id AND s.id = d.storefront_id
      WHERE lower(d.dominio) = lower($1) AND d.verificado_em IS NOT NULL AND s.status = 'active'
      LIMIT 1`,
    [dominio],
  );
  if (!result.rows[0]) throw new CommerceError('storefront não encontrado para este domínio', 'STOREFRONT_NOT_FOUND');
  if (!result.rows[0].loja_id) throw new CommerceError('storefront ainda não possui unidade operacional', 'STOREFRONT_OPERATIONAL_STORE_REQUIRED');
  req.publicResolvedStorefront = result.rows[0];
  return req.publicResolvedStorefront;
}

function publicSharedRateLimit({ scope, limit, windowSeconds, subject = () => '' }) {
  return async (req, res, next) => {
    try {
      const storefront = await resolvePublicStorefront(req);
      const context = { empresaId: storefront.empresa_id, lojaId: storefront.loja_id, storefrontId: storefront.id };
      const outcome = await withCommerceTransaction(trx => consumePublicRateLimit(trx, context, {
        scope,
        subject: subject(req),
        fingerprintValue: publicRequestFingerprint(req),
        limit,
        windowSeconds,
      }));
      if (!outcome.allowed) {
        res.set('Retry-After', String(outcome.retryAfterSeconds));
        return res.status(429).json({ error: 'Muitas solicitações. Tente novamente em alguns minutos.', code: 'RATE_LIMIT' });
      }
      return next();
    } catch (error) { return jsonError(res, error); }
  };
}

const publicShippingRateLimit = publicSharedRateLimit({ scope: 'shipping-ip', limit: 20, windowSeconds: 300 });
const publicCartRateLimit = publicSharedRateLimit({ scope: 'cart-ip', limit: 30, windowSeconds: 300 });
const publicSatisfactionRateLimit = publicSharedRateLimit({ scope: 'satisfaction-ip', limit: 30, windowSeconds: 600 });
const publicSatisfactionOrderRateLimit = publicSharedRateLimit({ scope: 'satisfaction-order', limit: 5, windowSeconds: 600, subject: req => req.params.publicCode });

async function enforcePaymentAttemptRateLimit(req, storefront, accountId) {
  return withCommerceTransaction(trx => consumePublicRateLimit(trx, {
    empresaId: storefront.empresa_id,
    lojaId: storefront.loja_id,
    storefrontId: storefront.id,
  }, {
    scope: 'public-payment-provider',
    subject: `${String(accountId).slice(0, 100)}:${String(req.body?.provider || '').trim().toLowerCase()}`,
    fingerprintValue: publicRequestFingerprint(req),
    limit: 8,
    windowSeconds: 600,
  }));
}

export function publicCommercePolicy(req) {
  const route = String(req.path || '/').split('?')[0];
  if (req.method === 'GET' && route.startsWith('/shipping/address/')) return { scope: 'public-shipping-address', limit: 80, windowSeconds: 600 };
  if (req.method === 'POST' && route.startsWith('/shipping/quotes')) return { scope: 'public-shipping-quote', limit: 30, windowSeconds: 600 };
  if (req.method === 'POST' && route.startsWith('/phone-verification/')) return { scope: 'public-phone-verification', limit: 10, windowSeconds: 600 };
  if (req.method === 'POST' && /^\/orders\/[^/]+\/payments\/return$/.test(route)) return { scope: 'public-payment-return', limit: 8, windowSeconds: 600 };
  if (req.method === 'POST' && (route === '/orders' || /^\/orders\/[^/]+\/payments$/.test(route))) return { scope: 'public-order-write', limit: 12, windowSeconds: 600 };
  if (req.method === 'GET' && /^\/orders\/[^/]+$/.test(route)) return { scope: 'public-order-read', limit: 120, windowSeconds: 600 };
  if (req.method === 'GET' && /^\/media\/[^/]+$/.test(route)) return { scope: 'public-media-read', limit: 600, windowSeconds: 600 };
  if (req.method === 'GET') return { scope: 'public-general-read', limit: 300, windowSeconds: 600 };
  return { scope: 'public-general-write', limit: 60, windowSeconds: 600 };
}

export function createCommercePublicRateLimitGuard() {
  return async (req, res, next) => {
    try {
      const storefront = await resolvePublicStorefront(req);
      const policy = publicCommercePolicy(req);
      const context = { empresaId: storefront.empresa_id, lojaId: storefront.loja_id, storefrontId: storefront.id };
      const outcome = await withCommerceTransaction(trx => consumePublicRateLimit(trx, context, { ...policy, fingerprintValue: publicRequestFingerprint(req) }));
      if (!outcome.allowed) {
        res.set('Retry-After', String(outcome.retryAfterSeconds));
        return res.status(429).json({ error: 'Muitas solicitações. Tente novamente em alguns minutos.', code: 'PUBLIC_RATE_LIMIT' });
      }
      return next();
    } catch (error) { return jsonError(res, error); }
  };
}

export function parsePagination(req, defaultLimit = 100, maxLimit = 500) {
  const parsedLimit = Number.parseInt(String(req.query.limit || defaultLimit), 10);
  const parsedOffset = Number.parseInt(String(req.query.offset || 0), 10);
  return { limit: Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), maxLimit) : defaultLimit, offset: Number.isFinite(parsedOffset) ? Math.max(parsedOffset, 0) : 0 };
}

function statusCounts(rows = []) {
  return rows.reduce((result, row) => {
    result[String(row.status)] = Number(row.total || 0);
    return result;
  }, {});
}

function safePublicUrl(value) {
  const candidate = String(value || '').trim();
  return /^https?:\/\//i.test(candidate) ? candidate.slice(0, 600) : null;
}

export function sanitizePublicStorefrontConfig(storefront = {}) {
  // Objeto vazio não conta como configuração: cai para configuracoes.public (antes o domínio próprio
  // sempre recebia {} e a vitrine ficava com cor e contato padrão).
  const source = storefront.public_config && typeof storefront.public_config === 'object' && Object.keys(storefront.public_config).length
    ? storefront.public_config
    : storefront.configuracoes?.public && typeof storefront.configuracoes.public === 'object'
      ? storefront.configuracoes.public
      : {};
  const safeColor = (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value).toUpperCase() : fallback;
  const phone = String(source.contact?.phone || '').replace(/[^+\d]/g, '').slice(0, 16);
  const email = String(source.contact?.email || '').trim().toLowerCase().slice(0, 255);
  const address = source.address && typeof source.address === 'object' ? source.address : {};
  const policies = source.policies && typeof source.policies === 'object' ? source.policies : {};
  return {
    brandKey: /^[a-z0-9][a-z0-9_-]{1,79}$/.test(String(storefront.brand_key || '')) ? String(storefront.brand_key) : 'default',
    displayName: String(source.displayName || storefront.nome || '').trim().slice(0, 120),
    tagline: String(source.tagline || '').trim().slice(0, 240),
    logoUrl: safePublicUrl(source.logoUrl) || '',
    faviconUrl: safePublicUrl(source.faviconUrl) || '',
    contact: {
      phone: /^\+?\d{10,15}$/.test(phone) ? phone : '',
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '',
      whatsapp: String(source.contact?.whatsapp || '').replace(/[^+\d]/g, '').slice(0, 16),
      instagram: String(source.contact?.instagram || '').trim().slice(0, 80),
    },
    address: {
      street: String(address.street || '').trim().slice(0, 180),
      number: String(address.number || '').trim().slice(0, 30),
      complement: String(address.complement || '').trim().slice(0, 100),
      neighborhood: String(address.neighborhood || '').trim().slice(0, 100),
      city: String(address.city || '').trim().slice(0, 100),
      state: /^[A-Z]{2}$/.test(String(address.state || '').toUpperCase()) ? String(address.state).toUpperCase() : '',
      postalCode: String(address.postalCode || '').replace(/\D/g, '').slice(0, 8),
      hours: String(address.hours || '').trim().slice(0, 200),
    },
    pickup: {
      enabled: source.pickup?.enabled !== false,
      instructions: String(source.pickup?.instructions || '').trim().slice(0, 500),
      leadTimeHours: Math.max(0, Math.min(720, Number(source.pickup?.leadTimeHours) || 0)),
    },
    policies: {
      privacyUrl: safePublicUrl(policies.privacyUrl),
      returnsUrl: safePublicUrl(policies.returnsUrl),
      shippingUrl: safePublicUrl(policies.shippingUrl),
      termsUrl: safePublicUrl(policies.termsUrl),
    },
    announcement: {
      enabled: Boolean(source.announcement?.enabled),
      text: String(source.announcement?.text || '').trim().slice(0, 200),
      link: safePublicUrl(source.announcement?.link) || '',
      bgColor: safeColor(source.announcement?.bgColor, '#172033'),
      textColor: safeColor(source.announcement?.textColor, '#FFFFFF'),
    },
    banners: Array.isArray(source.banners) ? source.banners.slice(0, 6).map((b, idx) => ({
      id: String(b.id || idx),
      title: String(b.title || '').trim().slice(0, 100),
      subtitle: String(b.subtitle || '').trim().slice(0, 200),
      imageUrl: safePublicUrl(b.imageUrl) || '',
      linkUrl: safePublicUrl(b.linkUrl) || '',
      ctaText: String(b.ctaText || 'Ver produtos').trim().slice(0, 40),
      active: b.active !== false,
    })) : [],
    badges: Array.isArray(source.badges) ? source.badges.slice(0, 6).map((badge, idx) => ({
      id: String(badge.id || idx),
      title: String(badge.title || '').trim().slice(0, 60),
      description: String(badge.description || '').trim().slice(0, 120),
      icon: String(badge.icon || 'shield').trim().slice(0, 40),
      active: badge.active !== false,
    })) : [],
    seo: {
      metaTitle: String(source.seo?.metaTitle || '').trim().slice(0, 120),
      metaDescription: String(source.seo?.metaDescription || '').trim().slice(0, 300),
      ogImage: safePublicUrl(source.seo?.ogImage) || '',
    },
    tracking: {
      metaPixelId: String(source.tracking?.metaPixelId || '').replace(/[^\w-]/g, '').slice(0, 50),
      gaMeasurementId: String(source.tracking?.gaMeasurementId || '').replace(/[^\w-]/g, '').slice(0, 50),
    },
    colors: {
      accent: safeColor(source.colors?.accent, '#FF6B2C'),
      accentStrong: safeColor(source.colors?.accentStrong, '#D84A16'),
      background: safeColor(source.colors?.background, '#F7F8FA'),
      surface: safeColor(source.colors?.surface, '#FFFFFF'),
      text: safeColor(source.colors?.text, '#172033'),
    },
  };
}

function sanitizePublicFulfillment(value = {}) {
  const occurrences = Array.isArray(value.ocorrencias) ? value.ocorrencias.slice(-100).map((event = {}) => ({
    at: event.at || event.data || event.dtHrCriado || null,
    status: String(event.status || event.codigo || 'tracking_update').slice(0, 80),
    description: String(event.description || event.descricao || event.mensagem || 'Movimentação registrada').slice(0, 300),
    ...(event.location && typeof event.location === 'object' ? { location: { city: String(event.location.city || '').slice(0, 120) || null, state: String(event.location.state || '').slice(0, 2).toUpperCase() || null } } : {}),
  })).filter(event => event.at || event.description) : [];
  return {
    status: String(value.status || 'pending').slice(0, 30),
    trackingCode: String(value.trackingCode || '').slice(0, 160) || null,
    trackingUrl: safePublicUrl(value.trackingUrl),
    carrier: String(value.carrier || '').slice(0, 120) || null,
    ocorrencias: occurrences,
  };
}

function sanitizePublicShippingOption(value = {}) {
  if (!value || typeof value !== 'object') return null;
  const asNumber = input => Number.isFinite(Number(input)) ? Number(input) : null;
  const min = asNumber(value.deliveryRange?.min);
  const max = asNumber(value.deliveryRange?.max);
  return {
    id: String(value.id || '').slice(0, 80) || null,
    name: String(value.name || '').slice(0, 160) || null,
    amount: asNumber(value.amount),
    currency: String(value.currency || 'BRL').slice(0, 8),
    provider: String(value.provider || '').slice(0, 60).toLowerCase() || null,
    manualZone: String(value.manualZone || '').slice(0, 80) || null,
    providerAmount: asNumber(value.providerAmount),
    surchargeRate: asNumber(value.surchargeRate),
    surchargeAmount: asNumber(value.surchargeAmount),
    priceNote: String(value.priceNote || '').slice(0, 180) || null,
    priceBreakdown: value.priceBreakdown && typeof value.priceBreakdown === 'object' ? {
      providerAmount: asNumber(value.priceBreakdown.providerAmount),
      surchargeAmount: asNumber(value.priceBreakdown.surchargeAmount),
      totalAmount: asNumber(value.priceBreakdown.totalAmount),
    } : null,
    deliveryDays: asNumber(value.deliveryDays),
    providerDeliveryDays: asNumber(value.providerDeliveryDays),
    preparationDays: asNumber(value.preparationDays),
    deliveryRange: { min, max },
    deliveryNote: String(value.deliveryNote || '').slice(0, 180) || null,
    carrier: String(value.carrier || '').slice(0, 120) || null,
  };
}

function sanitizePublicOrderTracking(row = {}) {
  const fulfillments = Array.isArray(row.fulfillments) ? row.fulfillments.map(sanitizePublicFulfillment) : [];
  const satisfaction = row.satisfaction && typeof row.satisfaction === 'object' ? row.satisfaction : {};
  const address = row.endereco_entrega && typeof row.endereco_entrega === 'object' ? row.endereco_entrega : null;
  const asNumber = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  return {
    public_code: String(row.public_code || '').slice(0, 40),
    status: String(row.status || 'pending_payment').slice(0, 30),
    moeda: String(row.moeda || 'BRL').slice(0, 8),
    subtotal: asNumber(row.subtotal),
    desconto: asNumber(row.desconto),
    frete: asNumber(row.frete),
    impostos: asNumber(row.impostos),
    total: asNumber(row.total),
    payment_status: String(row.payment_status || 'pending').slice(0, 30),
    payment_review_status: row.payment_review_status === 'refund_required' ? 'refund_required' : null,
    shippingMethodType: row.shipping_method_type === 'pickup' ? 'pickup' : row.shipping_method_type ? 'delivery' : null,
    endereco_entrega: address ? {
      cidade: String(address.cidade || '').slice(0, 100) || null,
      estado: String(address.estado || '').slice(0, 2).toUpperCase() || null,
      cep: String(address.cep || '').slice(0, 8) || null,
    } : null,
    criado_em: row.criado_em || null,
    atualizado_em: row.atualizado_em || null,
    shippingOption: sanitizePublicShippingOption(row.shipping_option || row.shippingOption),
    items: Array.isArray(row.items) ? row.items.slice(0, 500).map(item => ({
      nome: String(item?.nome || '').slice(0, 240),
      sku: String(item?.sku || '').slice(0, 120) || null,
      quantidade: Math.max(0, asNumber(item?.quantidade)),
      preco: asNumber(item?.preco),
      subtotal: asNumber(item?.subtotal),
    })) : [],
    fulfillments,
    timeline: Array.isArray(row.timeline) ? row.timeline.slice(-100).map(event => ({
      fromStatus: String(event?.fromStatus || '').slice(0, 30) || null,
      toStatus: String(event?.toStatus || '').slice(0, 30) || null,
      source: String(event?.source || 'system').slice(0, 40),
      at: event?.at || null,
    })) : [],
    satisfactionEligible: satisfactionEligible(row.status, fulfillments),
    satisfaction: { submitted: satisfaction.submitted === true, submittedAt: satisfaction.submittedAt || null },
  };
}

function jsonError(res, error) {
  const statusByCode = {
    PUBLIC_POLICIES_INVALID: 400, PUBLIC_POLICIES_URL_INVALID: 400, PUBLIC_POLICIES_CONFLICT: 400,
    QUANTITY_LIMIT_EXCEEDED: 422,
    SHIPPING_METHOD_REQUIRED: 400,
    CART_ALREADY_CONVERTED: 409,
    CREDIT_ACCOUNT_CONFLICT: 409,
    CREDIT_CUSTOMER_INVALID: 400,
    CREDIT_DUE_DAYS_INVALID: 400,
    CREDIT_LIMIT_BELOW_BALANCE: 409,
    CREDIT_LIMIT_INVALID: 400,
    CREDIT_STATUS_INVALID: 400,
    CREDIT_STOREFRONT_SCOPE_MISMATCH: 403,
    CREDIT_VALUE_INVALID: 400,
    DOMAIN_CONFLICT: 409,
    DOMAIN_NOT_FOUND: 404,
    DOMAIN_NOT_VERIFIED: 409,
    INVENTORY_BASELINE_REQUIRED: 409,
    LAST_TENANT_OWNER_REQUIRED: 409,
    MEMBERSHIP_SCOPE_INVALID: 400,
    PAYMENT_RECONCILIATION_PROVIDER_UNSUPPORTED: 400,
    PRICE_LIST_CONCURRENT_CHANGE: 409,
    PRICE_LIST_SCOPE_MISMATCH: 403,
    PRODUCT_SHARED_SCOPE_MISMATCH: 403,
    SHIPPING_ORIGIN_CEP_REQUIRED: 400,
    SHIPPING_TRACKING_UNSUPPORTED: 400,
    SHIPPING_WEBHOOK_AMBIGUOUS: 409,
    SHIPPING_WEBHOOK_OWNER_UNKNOWN: 404,
    STOREFRONT_ALIAS_CONFLICT: 409,
    STOREFRONT_ALIAS_INVALID: 400,
    STOREFRONT_BRAND_INVALID: 400,
    STOREFRONT_REQUIRED: 400,
    STORE_CODE_INVALID: 400,
    TENANT_ADMIN_ACCESS_CONFIRMATION_REQUIRED: 400,
    TENANT_ADMIN_EMAIL_INVALID: 400,
    TENANT_ADMIN_USER_NOT_FOUND: 404,
    TENANT_CNPJ_CONFLICT: 409,
    TENANT_CNPJ_INVALID: 400,
    TENANT_IDENTITY_REQUIRED: 400,
    TENANT_INACTIVE: 403,
    TENANT_PHONE_INVALID: 400,
    TENANT_POSTAL_CODE_INVALID: 400,
    TENANT_PUBLIC_CONTACT_CONFIRMATION_REQUIRED: 400,
    TENANT_PUBLIC_CONTACT_REQUIRED: 400,
    TENANT_ROLE_NOT_FOUND: 404,
    TENANT_STATE_INVALID: 400,
    INVALID_ID: 400,
    EMPTY_CART: 400,
    VALIDATION_ERROR: 400,
    CONSENT_EVIDENCE_REQUIRED: 400,
    CONTACT_CONFLICT: 409,
    CUSTOMER_EMAIL_CONFLICT: 409,
    CUSTOMER_PHONE_CONFLICT: 409,
    CUSTOMER_REQUIRED: 400,
    ADDRESS_REQUIRED: 400,
    ADDRESS_CEP_INVALID: 400,
    ADDRESS_STATE_INVALID: 400,
    ADDRESS_CONFLICT: 409,
    ADDRESS_NOT_FOUND: 404,
    STOREFRONT_DOMAIN_REQUIRED: 400,
    STOREFRONT_NOT_FOUND: 404,
    ITEM_UNAVAILABLE: 409,
    INSUFFICIENT_STOCK: 409,
    INVENTORY_LEVEL_NOT_FOUND: 409,
    INVENTORY_LOCATION_REQUIRED: 409,
    IDEMPOTENCY_CONFLICT: 409,
    CUSTOMER_NOT_FOUND: 404,
    ORDER_NOT_FOUND: 404,
    INVALID_ORDER_STATUS: 400,
    INVALID_ORDER_TRANSITION: 409,
    TENANT_CONTEXT_REQUIRED: 401,
    TENANT_SELECTION_REQUIRED: 400,
    IDENTITY_AMBIGUOUS: 403,
    STORE_SELECTION_REQUIRED: 400,
    AUDIENCE_STORE_SCOPE_UNAVAILABLE: 409,
    PERMISSION_DENIED: 403,
    CATEGORY_REQUIRED: 400,
    CATEGORY_NOT_FOUND: 404,
    CATEGORY_INVALID: 400,
    CATEGORY_SELF_PARENT: 400,
    PRODUCT_REQUIRED: 400,
    PRODUCT_NOT_FOUND: 404,
    PRODUCT_STOREFRONT_SCOPE_MISMATCH: 404,
    PRODUCT_ARCHIVED: 409,
    PRODUCT_ARCHIVE_REQUIRED: 409,
    PRODUCT_STATE_CONFLICT: 409,
    CATALOG_PRODUCT_IDEMPOTENCY_REQUIRED: 400,
    NO_CHANGES: 400,
    INVALID_PROMOTIONAL_PRICE: 400,
    INVALID_INVENTORY_DELTA: 400,
    INVALID_QUANTITY: 400,
    INVENTORY_STATE_CONFLICT: 409,
    INVENTORY_LOCATION_SCOPE_MISMATCH: 409,
    INVALID_PRICE: 400,
    VARIANT_NOT_FOUND: 404,
    VARIANT_REQUIRED: 400,
    VARIANT_INVALID: 400,
    MEDIA_REQUIRED: 400,
    MEDIA_UPLOAD_EMPTY: 400,
    MEDIA_IMAGE_INVALID: 422,
    MEDIA_NOT_FOUND: 404,
    MEDIA_URL_NOT_ALLOWED: 400,
    MEDIA_SCOPE_MISMATCH: 404,
    MEDIA_STORAGE_NOT_CONFIGURED: 503,
    MEDIA_UPLOAD_TOO_LARGE: 413,
    VALIDATION_ERROR: 400,
    CONFIRMATION_REQUIRED: 400,
    STALE_PREVIEW: 409,
    PRECONDITION_FAILED: 409,
    NOT_FOUND: 404,
    CONFLICT: 409,
    LOCATION_REQUIRED: 400,
    STORE_NOT_FOUND: 404,
    INVALID_REPORT_PERIOD: 400,
    IDENTITY_EMAIL_INVALID: 400,
    DATABASE_UNAVAILABLE: 503,
    SELF_ESCALATION: 403,
    TRANSACTION_REQUIRED: 503,
    GLOBAL_CONFIRMATION_REQUIRED: 400,
    PLATFORM_GRANT_EXPIRATION_INVALID: 400,
    ACTOR_ID_REQUIRED: 403,
    ACCOUNT_INACTIVE: 409,
    PLATFORM_GRANT_CONFIRMATION_REQUIRED: 400,
    PLATFORM_GRANT_NOT_FOUND: 404,
    SELF_REVOCATION_DENIED: 403,
    BUSINESS_GROUP_NAME_INVALID: 400,
    BUSINESS_GROUP_CNPJ_INVALID: 400,
    BUSINESS_GROUP_CONFLICT: 409,
    BUSINESS_GROUP_INVALID: 400,
    BUSINESS_GROUP_NOT_FOUND: 404,
    BUSINESS_GROUP_COMPANY_INVALID: 400,
    BUSINESS_GROUP_COMPANY_NOT_FOUND: 404,
    PAYMENT_PROVIDER_NOT_CONFIGURED: 503,
    PAYMENT_METHOD_INVALID: 400,
    PAYMENT_CUSTOMER_VERIFICATION_REQUIRED: 403,
    INVALID_PHONE: 400,
    PHONE_VERIFICATION_INVALID: 400,
    PHONE_VERIFICATION_EXPIRED: 410,
    PHONE_VERIFICATION_LOCKED: 429,
    PHONE_VERIFICATION_RATE_LIMIT: 429,
    PHONE_VERIFICATION_SEND_FAILED: 409,
    PHONE_VERIFICATION_UNAVAILABLE: 409,
    CREDIT_ACCOUNT_NOT_FOUND: 403,
    CREDIT_NOT_ELIGIBLE: 403,
    PROMOTION_ZERO_TOTAL: 409,
    PAYMENT_RECONCILIATION_CONFLICT: 409,
    PAYMENT_RECONCILIATION_INPUT_INVALID: 400,
    CREDIT_ACCOUNT_NOT_ACTIVE: 403,
    CREDIT_CUSTOMER_BLOCKED: 403,
    CREDIT_LIMIT_EXCEEDED: 409,
    PAYMENT_IDEMPOTENCY_REQUIRED: 400,
    PAYMENT_ACCOUNT_NOT_CONFIGURED: 409,
    PAYMENT_ATTEMPT_IN_PROGRESS: 409,
    PAYMENT_ORDER_STATE_INVALID: 409,
    PAYMENT_ADAPTER_INVALID_RESPONSE: 502,
    PAYMENT_PROVIDER_ERROR: 502,
    PAYMENT_PROVIDER_REJECTED: 502,
    PAYMENT_PROVIDER_NOT_READY: 503,
    PAYMENT_AMOUNT_INVALID: 400,
    PAYMENT_PROVIDER_TIMEOUT: 504,
    PAYMENT_WEBHOOK_INVALID: 400,
    PAYMENT_WEBHOOK_AMBIGUOUS: 409,
    PAYMENT_WEBHOOK_SCOPE_REQUIRED: 409,
    WEBHOOK_PAYLOAD_CONFLICT: 409,
    WEBHOOK_RATE_LIMIT_UNAVAILABLE: 503,
    PUBLIC_RATE_LIMIT_UNAVAILABLE: 503,
    PUBLIC_RATE_LIMIT_SECRET_REQUIRED: 503,
    WEBHOOK_AUDIT_INPUT_INVALID: 400,
    WEBHOOK_PROVIDER_REQUIRED: 400,
    PAYMENT_AMOUNT_MISMATCH: 422,
    PAYMENT_PROVIDER_UNSUPPORTED: 400,
    PAYMENT_SECRET_REF_INVALID: 400,
    PAYMENT_ACCOUNT_INVALID: 400,
    PAYMENT_ACCOUNT_NOT_FOUND: 404,
    PAYMENT_NOT_FOUND: 404,
    PAYMENT_PROVIDER_PAYMENT_NOT_FOUND: 409,
    PAYMENT_PROVIDER_STATUS_INVALID: 502,
    PAYMENT_PROVIDER_STATUS_UNAVAILABLE: 503,
    AUDIT_INVALID: 400,
    SHIPPING_METHOD_INVALID: 400,
    SHIPPING_METHOD_CONFIG_INVALID: 400,
    SHIPPING_METHOD_NOT_FOUND: 404,
    SHIPPING_CEP_INVALID: 400,
    SHIPPING_CEP_NOT_FOUND: 404,
    SHIPPING_CEP_MISMATCH: 422,
    SHIPPING_CEP_PROVIDER_ERROR: 502,
    SHIPPING_CEP_PROVIDER_TIMEOUT: 504,
    SHIPPING_ADDRESS_REQUIRED: 400,
    SHIPPING_ADDRESS_INCOMPLETE: 400,
    SHIPPING_ADDRESS_STATE_INVALID: 400,
    SHIPPING_ADDRESS_DOCUMENT_REQUIRED: 400,
    SHIPPING_ADDRESS_DOCUMENT_INVALID: 422,
    SHIPPING_ITEMS_REQUIRED: 400,
    SHIPPING_PACKAGE_DATA_REQUIRED: 422,
    SHIPPING_PROVIDER_UNSUPPORTED: 400,
    SHIPPING_PROVIDER_NOT_CONFIGURED: 503,
    SHIPPING_PROVIDER_CAPABILITY_UNAVAILABLE: 409,
    SHIPPING_SERVICE_CODES_REQUIRED: 422,
    SHIPPING_TRACKING_INVALID: 400,
    SHIPPING_WEBHOOK_UNSUPPORTED: 409,
    SHIPPING_ACCOUNT_INVALID: 400,
    SHIPPING_ACCOUNT_NOT_FOUND: 404,
    SHIPPING_ACCOUNT_NOT_CONFIGURED: 409,
    SHIPPING_SECRET_REF_INVALID: 400,
    SHIPPING_PROVIDER_ERROR: 502,
    SHIPPING_PROVIDER_TIMEOUT: 504,
    SHIPPING_NO_OPTIONS: 422,
    SHIPPING_DESTINATION_UNAVAILABLE: 422,
    SHIPPING_PICKUP_ONLY_ITEMS: 422,
    SHIPPING_NATIONAL_FULFILLMENT_NOT_READY: 422,
    SHIPPING_DESTINATION_OUTSIDE_RADIUS: 422,
    SHIPPING_FREE_SHIPPING_THRESHOLD_NOT_MET: 422,
    SHIPPING_ADAPTER_INVALID_RESPONSE: 502,
    SHIPPING_QUOTE_REQUIRED: 400,
    SHIPPING_QUOTE_INVALID: 400,
    SHIPPING_QUOTE_EXPIRED: 409,
    SHIPPING_QUOTE_MISMATCH: 409,
    SHIPPING_OPTION_INVALID: 400,
    SHIPPING_INVOICE_REQUIRED: 422,
    SHIPPING_INVOICE_INVALID: 422,
    SHIPPING_DECLARATION_REQUIRED: 422,
    SHIPPING_PREPOST_PAYMENT_MODE_REQUIRED: 422,
    SHIPPING_ORDER_NOT_PAID: 409,
    SHIPPING_ORIGIN_INCOMPLETE: 422,
    SHIPPING_ORIGIN_DOCUMENT_INVALID: 422,
    SHIPPING_SHIPMENT_NOT_FOUND: 409,
    SHIPPING_CANCELLATION_NOT_ALLOWED: 409,
    SHIPPING_ACCOUNT_SCOPE_MISMATCH: 409,
    SHIPPING_WEBHOOK_INVALID: 400,
    SHIPPING_OPERATION_IN_PROGRESS: 409,
    SHIPPING_OPERATION_CONFLICT: 409,
    SHIPPING_OPERATION_RECONCILIATION_REQUIRED: 409,
    SHIPPING_OPERATION_RECONCILIATION_INPUT_INVALID: 400,
    FULFILLMENT_NOT_FOUND: 404,
    FULFILLMENT_ORDER_NOT_PAID: 409,
    FULFILLMENT_DINO_ORDER_SELECTION_REQUIRED: 409,
    FULFILLMENT_ALREADY_EXISTS: 409,
    FULFILLMENT_PAYMENT_NOT_CAPTURED: 409,
    INVALID_FULFILLMENT_TRANSITION: 409,
    PROMOTION_INVALID: 400,
    PROMOTION_CODE_INVALID: 400,
    PROMOTION_NOT_FOUND: 404,
    PROMOTION_ORDER_STATE_INVALID: 409,
    PROMOTION_ALREADY_APPLIED: 409,
    PROMOTION_TYPE_UNSUPPORTED: 400,
    USER_NOT_FOUND: 404,
    ROLE_NOT_FOUND: 404,
    MEMBERSHIP_NOT_FOUND: 404,
    ACCOUNT_NOT_FOUND: 404,
    TENANT_NOT_FOUND: 404,
    IDENTITY_ALREADY_EXISTS: 409,
    MEMBERSHIP_EXPIRATION_INVALID: 400,
    STORE_SCOPE_MISMATCH: 409,
    ORDER_IDEMPOTENCY_REQUIRED: 400,
    ORDER_IDEMPOTENCY_IN_PROGRESS: 409,
    ORDER_RECOVERY_REASON_REQUIRED: 400,
    ORDER_RECOVERY_CONFLICT: 409,
    ORDER_RECOVERY_PAYMENT_CONFLICT: 409,
    ORDER_RECOVERY_SHIPPING_UNAVAILABLE: 409,
    ORDER_RECOVERY_INVENTORY_CONFLICT: 409,
    IDEMPOTENCY_CONFLICT: 409,
    STOREFRONT_OPERATIONAL_STORE_REQUIRED: 409,
    STOREFRONT_CODE_INVALID: 400,
    STOREFRONT_NAME_REQUIRED: 400,
    STOREFRONT_CURRENCY_INVALID: 400,
    STOREFRONT_CHANNEL_INVALID: 400,
    STOREFRONT_STATUS_INVALID: 400,
    STOREFRONT_CONFLICT: 409,
    STOREFRONT_NOT_FOUND: 404,
    PROMOTION_TEMPLATE_NOT_FOUND: 404,
    PROMOTION_TEMPLATE_INVALID: 400,
    PROMOTION_DATE_INVALID: 400,
    PROMOTION_USAGE_LIMIT_CONFLICT: 409,
    PROMOTION_CODE_CONFLICT: 409,
    STORE_SELECTION_REQUIRED: 400,
    CATALOG_IMPORT_SIZE_INVALID: 400,
    CATALOG_IMPORT_SKU_INVALID: 400,
    CATALOG_IMPORT_PRODUCT_INVALID: 400,
    CATALOG_IMPORT_PRICE_INVALID: 400,
    CATALOG_IMPORT_STOCK_INVALID: 400,
    CATALOG_IMPORT_DUPLICATE_SKU: 409,
    CATALOG_IMPORT_SCOPE_INVALID: 400,
    CATALOG_IMPORT_SCOPE_MISMATCH: 409,
    CATALOG_IMPORT_CONFIRMATION_REQUIRED: 400,
    CATALOG_IMPORT_IDEMPOTENCY_REQUIRED: 400,
    CATALOG_IMPORT_PREVIEW_REQUIRED: 400,
    CATALOG_IMPORT_PREVIEW_STALE: 409,
    AVEC_PAYLOAD_INVALID: 400,
    AVEC_PAYLOAD_TOO_DEEP: 400,
    AVEC_SOURCE_VERSION_INVALID: 400,
    AVEC_CATEGORY_INVALID: 400,
    AVEC_SOURCE_ESTABLISHMENT_REQUIRED: 400,
    AVEC_ROWS_INVALID: 400,
    AVEC_INSTANT_REQUIRED: 400,
    AVEC_APPLY_DISABLED: 400,
    AVEC_SENSITIVE_FIELD_REJECTED: 400,
    AVEC_FIELD_NOT_ALLOWED: 400,
    AVEC_FIELD_TOO_LONG: 400,
    AVEC_SCOPE_REQUIRED: 400,
    AVEC_SIZE_INVALID: 400,
    AVEC_SOURCE_INVALID: 400,
    AVEC_FORMULA_CELL: 400,
    AVEC_SCOPE_MISMATCH: 403,
    SATISFACTION_RATING_INVALID: 400,
    SATISFACTION_RECOMMENDATION_REQUIRED: 400,
    SATISFACTION_IDEMPOTENCY_REQUIRED: 400,
    SATISFACTION_IDEMPOTENCY_CONFLICT: 409,
    SATISFACTION_NOT_AVAILABLE: 409,
    SATISFACTION_ALREADY_SUBMITTED: 409,
    STORE_SCOPE_MISMATCH: 403,
    WHATSAPP_AI_STORE_SELECTOR_INVALID: 400,
    WHATSAPP_AI_SESSION_FILTER_INVALID: 400,
    WHATSAPP_AI_SESSION_INVALID: 400,
    AUTHENTICATED_USER_REQUIRED: 400,
    WHATSAPP_AI_SESSION_NOT_FOUND: 404,
    WHATSAPP_AI_SESSION_CONFLICT: 409,
    WHATSAPP_AI_EMPTY_MESSAGE: 400,
    WHATSAPP_AI_SESSION_NOT_WITH_STAFF: 409,
    WHATSAPP_DELIVERY_UNKNOWN: 502,
    WHATSAPP_PROVIDER_REJECTED: 502,
  };
  const status = statusByCode[error?.code] || 500;
  const publicMessages = {
    PAYMENT_PROVIDER_REJECTED: 'O gateway recusou a solicitação. Confirme no painel InfinitePay que o Checkout Integrado está habilitado no mesmo perfil configurado no Commerce, com Pix e cartão ativos, e tente novamente.',
    PAYMENT_PROVIDER_NOT_READY: 'O Checkout Integrado da InfinitePay está desabilitado para o perfil configurado. Habilite-o no app ou painel InfinitePay e confirme que o handle é o mesmo cadastrado no Commerce.',
    PAYMENT_PROVIDER_TIMEOUT: 'O gateway demorou para responder. Verifique a conexão e tente novamente.',
    PAYMENT_ADAPTER_INVALID_RESPONSE: 'O gateway não retornou um link de checkout válido. Tente novamente em instantes.',
    PAYMENT_PROVIDER_ERROR: 'Não foi possível comunicar com o gateway. Tente novamente em instantes.',
    SHIPPING_CEP_PROVIDER_ERROR: 'Não foi possível confirmar o CEP agora. Tente novamente em instantes ou preencha o endereço manualmente.',
    SHIPPING_CEP_PROVIDER_TIMEOUT: 'A consulta de CEP demorou para responder. Tente novamente em instantes.',
    WHATSAPP_DELIVERY_UNKNOWN: 'O WhatsApp não confirmou o envio. Confira no celular antes de reenviar.',
    WHATSAPP_PROVIDER_REJECTED: 'O WhatsApp recusou o envio. Confira a conexão do número e tente de novo.',
  };
  const publicMessage = publicMessages[error?.code] || (status >= 500 ? 'erro interno do Commerce Core' : error.message);
  return res.status(status).json({ error: publicMessage, code: error?.code || 'COMMERCE_ERROR', details: error?.details || {} });
}

// Com "Todas as lojas" selecionado não há loja no contexto; o atendimento de
// WhatsApp pertence à loja onde o canal foi criado (ou à primeira loja ativa).
async function withWhatsappLoja(context) {
  if (context?.lojaId) return context;
  const channel = await db.queryRead(
    `SELECT loja_id FROM canais_integracao WHERE empresa_id = $1 AND provedor = 'whatsapp' ORDER BY data_atualizacao DESC NULLS LAST LIMIT 1`,
    [context.empresaId],
  ).catch(() => ({ rows: [] }));
  let lojaId = channel.rows[0]?.loja_id || null;
  if (!lojaId) {
    const loja = await db.queryRead(`SELECT id FROM lojas WHERE empresa_id = $1 AND COALESCE(ativo, true) = true ORDER BY id LIMIT 1`, [context.empresaId]).catch(() => ({ rows: [] }));
    lojaId = loja.rows[0]?.id || null;
  }
  return lojaId ? { ...context, lojaId, lojaInferida: true } : context;
}

async function normalizeWhatsappQueueStoreSelector(req) {
  let requestedLojaId = String(req.headers['x-loja-id'] || '').trim();
  const requestedEmpresaId = String(req.headers['x-empresa-id'] || '').trim();
  if (!requestedLojaId) {
    if (isUuid(requestedEmpresaId)) {
      const firstStore = await db.queryRead(
        `SELECT id, codigo FROM lojas WHERE empresa_id = $1 AND COALESCE(ativa, true) = true ORDER BY data_criacao ASC LIMIT 1`,
        [requestedEmpresaId]
      );
      if (firstStore.rows[0]) {
        requestedLojaId = firstStore.rows[0].id;
        req.headers['x-loja-id'] = requestedLojaId;
        delete req.commerceAdminContext;
        return requestedLojaId;
      }
    }
    return '';
  }
  if (isUuid(requestedLojaId)) return requestedLojaId;
  if (!req.user && !req.commerceAdminContext) throw new CommerceError('sessão autenticada é obrigatória', 'TENANT_CONTEXT_REQUIRED');
  if (!isUuid(requestedEmpresaId)) {
    const error = new Error('seletor de unidade inválido');
    error.code = 'WHATSAPP_AI_STORE_SELECTOR_INVALID';
    throw error;
  }
  const result = await db.queryRead(
    `SELECT id FROM lojas
      WHERE empresa_id = $1
        AND (lower(codigo) = lower($2) OR lower(id::text) = lower($2) OR lower(nome) = lower($2) OR lower(nome) ILIKE '%' || lower($2) || '%')
        AND COALESCE(ativa, true) = true
      LIMIT 1`,
    [requestedEmpresaId, requestedLojaId],
  );
  if (!result.rows[0]) {
    const fallback = await db.queryRead(
      `SELECT id FROM lojas WHERE empresa_id = $1 AND COALESCE(ativa, true) = true ORDER BY data_criacao ASC LIMIT 1`,
      [requestedEmpresaId]
    );
    if (fallback.rows[0]) {
      req.headers['x-loja-id'] = fallback.rows[0].id;
      delete req.commerceAdminContext;
      return requestedLojaId;
    }
    const error = new Error('unidade selecionada não encontrada nesta empresa');
    error.code = 'WHATSAPP_AI_STORE_SELECTOR_INVALID';
    throw error;
  }
  req.headers['x-loja-id'] = result.rows[0].id;
  delete req.commerceAdminContext; // Revalidar a identidade no seletor canônico, não no código legado.
  return requestedLojaId;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

async function adminContext(req) {
  if (!req.commerceAdminContext) req.commerceAdminContext = await resolveCommerceIdentity(req);
  return req.commerceAdminContext;
}

async function requirePermission(req, permission) {
  // Administradores globais e gestores autorizados têm bypass de permissão no Commerce Core
  if (
    req.user?.platformAdmin === true ||
    req.user?.role === 'admin' ||
    req.user?.role === 'administrador' ||
    req.user?.role === 'organizador' ||
    req.user?.role === 'gerente' ||
    req.user?.mainAdmin === true ||
    isLegacyGlobalAdmin(req.user)
  ) {
    const context = await adminContext(req);
    context.corporateAccess = true;
    context.capabilities = context.capabilities instanceof Set ? context.capabilities : new Set(context.capabilities || []);
    context.capabilities.add(permission);
    return context;
  }
  // perfil operador/profissional limita o vínculo (core/perfis-acesso.js)
  const restricao = restricaoDePermissao(req, permission);
  if (restricao) throw new CommerceError(restricao, 'PERMISSION_DENIED', { permission, perfil: true });
  const context = await adminContext(req);
  const result = await db.queryRead(
    `SELECT COUNT(*)::int AS grants, BOOL_OR(m.loja_id IS NULL) AS corporate_access
       FROM commerce_memberships m
       JOIN commerce_roles r ON r.id = m.role_id AND (r.empresa_id = $1 OR r.empresa_id IS NULL)
       JOIN commerce_role_permissions rp ON rp.role_id = r.id
       JOIN commerce_permissions p ON p.id = rp.permission_id AND p.codigo = $2
      WHERE m.empresa_id = $1 AND m.usuario_id = $3 AND m.ativo = true
        AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP)
        AND (m.loja_id IS NULL OR m.loja_id = $4)
      `,
    [context.empresaId, permission, context.usuarioId, context.lojaId],
  );
  if (!Number(result.rows[0]?.grants || 0)) throw new CommerceError('permissão insuficiente para esta operação', 'PERMISSION_DENIED', { permission });
  context.corporateAccess = context.corporateAccess === true || result.rows[0].corporate_access === true;
  context.capabilities = context.capabilities instanceof Set ? context.capabilities : new Set(context.capabilities || []);
  context.capabilities.add(permission);
  return context;
}

async function requireAdminStorefront(req, context, { optionalForCorporate = true } = {}) {
  const raw = req.query?.storefrontId || req.body?.storefrontId || req.headers?.['x-storefront-id'];
  if (!raw) {
    if (optionalForCorporate && context.corporateAccess === true) return null;
    throw new CommerceError('storefrontId é obrigatório para operar a vitrine selecionada', 'STOREFRONT_REQUIRED');
  }
  const storefrontId = assertUuid(raw, 'storefrontId');
  const result = await db.query(
    `SELECT id, loja_id FROM commerce_storefronts
      WHERE empresa_id = $1 AND id = $2 AND status = 'active'
        AND ($3::uuid IS NULL OR loja_id = $3)
      LIMIT 1`,
    [context.empresaId, storefrontId, context.corporateAccess === true ? null : context.lojaId],
  );
  if (!result.rows[0]) throw new CommerceError('storefront fora do escopo da loja', 'STORE_SCOPE_MISMATCH');
  context.storefrontId = storefrontId;
  return storefrontId;
}

export function sanitizePublicOrderInput(input = {}) {
  const sanitized = input && typeof input === 'object' && !Array.isArray(input) ? { ...input } : {};
  delete sanitized.customerId;
  delete sanitized.allowUnverifiedGuest;
  // Prazo de reserva é política do servidor; o cliente não escolhe por quanto tempo segura o estoque.
  delete sanitized.reservationExpiresAt;
  sanitized.customer = sanitized.customer && typeof sanitized.customer === 'object' && !Array.isArray(sanitized.customer)
    ? { ...sanitized.customer }
    : {};
  delete sanitized.customer.customerId;
  delete sanitized.reservationExpiresAt;
  return sanitized;
}

async function creditEligibleOrder(storefront, publicCode) {
  const code = String(publicCode || '').trim().toUpperCase().slice(0, 40);
  if (!code) return null;
  const result = await db.query(
    `SELECT o.id, o.total, c.telefone
       FROM commerce_orders o
       JOIN commerce_customers c ON c.empresa_id = o.empresa_id AND c.id = o.customer_id
       JOIN commerce_customer_credit_accounts a
         ON a.empresa_id = o.empresa_id AND a.storefront_id = o.storefront_id AND a.customer_id = o.customer_id
        AND a.status = 'active' AND a.limite_credito - a.saldo_devedor >= o.total
      WHERE o.empresa_id = $1 AND o.storefront_id = $2 AND o.public_code = $3 AND o.status = 'pending_payment'
      LIMIT 1`,
    [storefront.empresa_id, storefront.id, code],
  ).catch(() => ({ rows: [] }));
  return result.rows[0] || null;
}

export function createCommercePublicRouter() {
  const router = express.Router();
  router.get('/context', async (req, res) => {
    try {
      const storefront = await resolvePublicStorefront(req);
      const [paymentAccounts, shippingAccounts, shippingMethods] = await Promise.all([
        db.query(`SELECT id, provider, ambiente, secret_ref, public_config, ativo FROM commerce_payment_accounts WHERE empresa_id = $1 AND storefront_id = $2 AND ambiente = 'production' AND ativo = true`, [storefront.empresa_id, storefront.id]),
        db.query(`SELECT id, provider, secret_ref, public_config, ativo FROM commerce_shipping_accounts WHERE empresa_id = $1 AND storefront_id = $2 AND ambiente = 'production' AND ativo = true`, [storefront.empresa_id, storefront.id]),
        db.query(`SELECT tipo, configuracao FROM commerce_shipping_methods WHERE empresa_id = $1 AND storefront_id = $2 AND ativo = true AND tipo IN ('delivery', 'carrier')`, [storefront.empresa_id, storefront.id]),
      ]);
      // Crediário vale só para clientes aprovados, então não deixa a loja "pronta para vender"
      // para todo mundo: sem gateway, o checkout público fica desligado.
      const paymentsReady = paymentAccounts.rows.some(paymentAccountReady);
      const manualShippingReady = shippingMethods.rows.some(row => String(row.configuracao?.provider || '').toLowerCase() === 'manual');
      const shippingReady = shippingAccounts.rows.some(shippingAccountReady) || manualShippingReady;
      res.json({ storefront: { id: storefront.id, codigo: storefront.codigo, nome: storefront.nome, moeda: storefront.moeda, timezone: storefront.timezone, public: sanitizePublicStorefrontConfig(storefront) }, capabilities: { catalog: true, cart: true, checkout: true, payments: paymentsReady, shipping: shippingReady } });
    } catch (error) { jsonError(res, error); }
  });
  router.post('/promotions/preview', async (req, res) => {
    try {
      const storefront = await resolvePublicStorefront(req);
      const result = await previewPromotion(db, {
        empresaId: storefront.empresa_id,
        lojaId: storefront.loja_id,
        storefrontId: storefront.id,
      }, { ...(req.body || {}), storefrontId: storefront.id });
      res.set('Cache-Control', 'no-store');
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.get('/products', async (req, res) => {
    try {
      const storefront = await resolvePublicStorefront(req);
      const products = await listPublishedProducts({ empresaId: storefront.empresa_id, lojaId: storefront.loja_id }, { storefrontId: storefront.id, query: req.query.q, categoryId: req.query.categoryId, limit: req.query.limit, offset: req.query.offset });
      res.json({ storefrontId: storefront.id, items: products });
    } catch (error) { jsonError(res, error); }
  });
  router.get('/media/:id', async (req, res) => {
    try {
      const storefront = await resolvePublicStorefront(req);
      const mediaId = assertUuid(req.params.id, 'mediaId');
      const result = await db.query(
        `SELECT m.id, m.product_id, m.storage_key, m.mime_type
           FROM commerce_product_media m
           JOIN commerce_product_channels pc
             ON pc.empresa_id = m.empresa_id AND pc.product_id = m.product_id
            AND pc.storefront_id = $2 AND pc.publicado = true
          WHERE m.empresa_id = $1 AND m.id = $3
          LIMIT 1`,
        [storefront.empresa_id, storefront.id, mediaId],
      );
      if (!result.rows[0]) throw new CommerceError('mídia não encontrada neste storefront', 'MEDIA_NOT_FOUND');
      await streamCommerceImage({ storageKey: result.rows[0].storage_key, mimeType: result.rows[0].mime_type, res, empresaId: storefront.empresa_id, productId: result.rows[0].product_id, mediaId: result.rows[0].id });
    } catch (error) {
      if (!res.headersSent) {
        res.setHeader('Cache-Control', 'no-store');
        res.removeHeader?.('Content-Type');
        jsonError(res, error);
      }
      else res.destroy(error);
    }
  });
  router.get('/shipping/address/:cep', publicShippingRateLimit, async (req, res) => {
    try { res.json(await lookupPostalCode(req.params.cep)); } catch (error) { jsonError(res, error); }
  });
  router.get('/shipping-methods', async (req, res) => {
    try {
      const storefront = await resolvePublicStorefront(req);
      const result = await db.query(
        `SELECT sm.id, sm.codigo, sm.nome, sm.tipo, sm.configuracao,
                a.id AS active_shipping_account_id, a.provider AS active_shipping_provider, a.secret_ref AS active_shipping_secret_ref, a.public_config AS active_shipping_public_config, a.ativo AS active_shipping_account
           FROM commerce_shipping_methods sm
           LEFT JOIN commerce_shipping_accounts a ON a.empresa_id = sm.empresa_id AND a.storefront_id = sm.storefront_id AND a.id::text = COALESCE(sm.configuracao->>'shippingAccountId', sm.configuracao->>'accountId') AND a.ambiente = 'production' AND a.ativo = true
          WHERE sm.empresa_id = $1 AND sm.storefront_id = $2 AND sm.ativo = true
          ORDER BY sm.nome ASC`,
        [storefront.empresa_id, storefront.id],
      );
      res.json({ storefrontId: storefront.id, items: result.rows.map(row => publicShippingMethod({ ...row, shipping_account_ready: shippingAccountReady({ id: row.active_shipping_account_id, provider: row.active_shipping_provider, secret_ref: row.active_shipping_secret_ref, public_config: row.active_shipping_public_config, ativo: row.active_shipping_account }) })) });
    } catch (error) { jsonError(res, error); }
  });
  router.post('/shipping/quotes', publicShippingRateLimit, async (req, res) => {
    try {
      const storefront = await resolvePublicStorefront(req);
      const result = await quoteShipping(db, { empresaId: storefront.empresa_id, lojaId: storefront.loja_id }, { ...req.body, storefrontId: storefront.id });
      res.status(201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.post('/shipping/quotes/available', publicShippingRateLimit, async (req, res) => {
    try {
      const storefront = await resolvePublicStorefront(req);
      const result = await quoteAvailableShipping(db, { empresaId: storefront.empresa_id, lojaId: storefront.loja_id }, { ...req.body, storefrontId: storefront.id });
      res.status(201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.post('/cart', publicCartRateLimit, async (req, res) => {
    try {
      const storefront = await resolvePublicStorefront(req);
      const result = await syncPublicCart({ empresaId: storefront.empresa_id, lojaId: storefront.loja_id, storefrontId: storefront.id }, req.body || {});
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  // Funil anônimo da vitrine (visita → carrinho → checkout) para a conversão do painel.
  router.post('/events', publicCartRateLimit, async (req, res) => {
    try {
      const storefront = await resolvePublicStorefront(req);
      const result = recordStorefrontEvent(storefront.empresa_id, { event: String(req.body?.event || ''), sessionKey: String(req.body?.sessionKey || '') });
      res.status(202).json({ accepted: true, recorded: result.recorded });
    } catch (error) { jsonError(res, error); }
  });
  router.get('/payment-methods', async (req, res) => {
    try {
      const storefront = await resolvePublicStorefront(req);
      const result = await db.query(`SELECT id, provider, ambiente, secret_ref, public_config, ativo FROM commerce_payment_accounts WHERE empresa_id = $1 AND storefront_id = $2 AND ambiente = 'production' AND ativo = true ORDER BY provider`, [storefront.empresa_id, storefront.id]);
      const items = publicPaymentMethods(result.rows);
      // "Marcar na conta" aparece só para o pedido informado, quando o cliente dele tem
      // crediário ativo nesta loja com limite para o total.
      const orderCode = String(req.query?.order || '').trim();
      if (orderCode && phoneVerificationAvailable() && await creditEligibleOrder(storefront, orderCode)) items.push({ provider: 'crediario', method: 'account', ambiente: 'production', requiresPhoneVerification: true, label: 'Marcar na conta' });
      res.json({ storefrontId: storefront.id, available: items.length > 0, items: items.filter((item, index, all) => all.findIndex(candidate => candidate.provider === item.provider && candidate.method === item.method && candidate.ambiente === item.ambiente) === index) });
    } catch (error) { jsonError(res, error); }
  });
  router.post('/phone-verification/start', async (req, res) => {
    try {
      const storefront = await resolvePublicStorefront(req);
      // Código só vai para o WhatsApp do cliente de um pedido que pode ser marcado na conta:
      // o endpoint não serve para mandar mensagens a números quaisquer.
      const eligible = await creditEligibleOrder(storefront, req.body?.order);
      if (!eligible?.telefone || (req.body?.phone && phoneMatchKey(eligible.telefone) !== phoneMatchKey(req.body.phone))) throw new CommerceError('este pedido não pode ser marcado na conta', 'CREDIT_NOT_ELIGIBLE');
      const result = await startPhoneVerification({ empresaId: storefront.empresa_id, lojaId: storefront.loja_id, phone: eligible.telefone, storeName: storefront.nome, ip: req.ip });
      res.status(202).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.post('/phone-verification/confirm', async (req, res) => {
    try {
      const storefront = await resolvePublicStorefront(req);
      const eligible = req.body?.order ? await creditEligibleOrder(storefront, req.body.order) : null;
      if (req.body?.order && !eligible?.telefone) throw new CommerceError('este pedido não pode ser marcado na conta', 'CREDIT_NOT_ELIGIBLE');
      res.json(await confirmPhoneVerification({ empresaId: storefront.empresa_id, phone: eligible?.telefone || req.body?.phone, code: req.body?.code }));
    } catch (error) { jsonError(res, error); }
  });
  router.post('/orders/:publicCode/payments', async (req, res) => {
    try {
      const storefront = await resolvePublicStorefront(req);
      const method = validatePaymentMethod(req.body?.method);
      const provider = String(req.body?.provider || '').trim().toLowerCase();
      const order = await db.query(`SELECT o.id, c.telefone FROM commerce_orders o LEFT JOIN commerce_customers c ON c.empresa_id = o.empresa_id AND c.id = o.customer_id WHERE o.empresa_id = $1 AND o.storefront_id = $2 AND o.public_code = $3 LIMIT 1`, [storefront.empresa_id, storefront.id, String(req.params.publicCode || '').toUpperCase()]);
      if (!order.rows[0]) throw new CommerceError('pedido não encontrado', 'ORDER_NOT_FOUND');
      if (provider === 'crediario' && method === 'account') {
        // Na conta só com o número do pedido confirmado por código no WhatsApp.
        if (!order.rows[0].telefone || !verifyPhoneToken(req.body?.phoneVerificationToken, storefront.empresa_id, order.rows[0].telefone)) {
          throw new CommerceError('confirme o WhatsApp do pedido com o código enviado para marcar na conta', 'PAYMENT_CUSTOMER_VERIFICATION_REQUIRED');
        }
        const idempotencyKey = String(req.body?.idempotencyKey || '').trim().slice(0, 180);
        const result = await createCreditPayment({ empresaId: storefront.empresa_id, lojaId: storefront.loja_id }, { orderId: order.rows[0].id, idempotencyKey });
        return res.status(201).json(result);
      }
      const account = await db.query(`SELECT id, provider, ambiente FROM commerce_payment_accounts WHERE empresa_id = $1 AND storefront_id = $2 AND provider = $3 AND ambiente = 'production' AND ativo = true ORDER BY provider LIMIT 1`, [storefront.empresa_id, storefront.id, provider]);
      if (!account.rows[0]) throw new CommerceError('nenhum gateway ativo para este storefront', 'PAYMENT_PROVIDER_NOT_CONFIGURED');
      const rate = await enforcePaymentAttemptRateLimit(req, storefront, account.rows[0].id);
      if (!rate.allowed) {
        res.set('Retry-After', String(rate.retryAfterSeconds));
        return res.status(429).json({ error: 'limite temporário de tentativas de pagamento atingido', code: 'RATE_LIMIT' });
      }
      const result = await createPaymentAttempt({ empresaId: storefront.empresa_id, lojaId: storefront.loja_id, storefrontId: storefront.id }, { orderId: order.rows[0].id, provider, method, environment: account.rows[0].ambiente, accountId: account.rows[0].id, idempotencyKey: String(req.body?.idempotencyKey || '').trim().slice(0, 180) });
      res.status(201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.post('/orders/:publicCode/payments/return', async (req, res) => {
    try {
      const storefront = await resolvePublicStorefront(req)
      const transactionNsu = String(req.body?.transactionNsu || req.body?.transaction_nsu || '').trim().slice(0, 180)
      const slug = String(req.body?.slug || req.body?.invoice_slug || '').trim().slice(0, 180)
      if (!transactionNsu || !slug) throw new CommerceError('retorno InfinitePay sem identificadores suficientes', 'PAYMENT_WEBHOOK_INVALID')
      const order = await db.query(`SELECT id FROM commerce_orders WHERE empresa_id = $1 AND storefront_id = $2 AND public_code = $3 LIMIT 1`, [storefront.empresa_id, storefront.id, String(req.params.publicCode || '').toUpperCase()])
      if (!order.rows[0]) throw new CommerceError('pedido não encontrado', 'ORDER_NOT_FOUND')
      const payment = await db.query(publicInfinitepayPaymentLookupSql,
        [storefront.empresa_id, order.rows[0].id, transactionNsu, slug, String(req.params.publicCode || '').toUpperCase()])
      if (!payment.rows[0]) throw new CommerceError('tentativa InfinitePay não encontrada', 'PAYMENT_NOT_FOUND')
      if (payment.rows.length > 1) throw new CommerceError('retorno InfinitePay associado a mais de uma tentativa', 'PAYMENT_RECONCILIATION_CONFLICT')
      const result = await reconcilePaymentByIdentifiers(
        { empresaId: storefront.empresa_id, lojaId: storefront.loja_id, storefrontId: storefront.id },
        payment.rows[0].id,
        { transactionNsu, slug, source: 'public_return' },
      )
      res.json({ status: result.status, changed: Boolean(result.changed), pending: Boolean(result.pending), refundRequired: Boolean(result.refundRequired) })
    } catch (error) { jsonError(res, error) }
  })
  router.post('/orders', async (req, res) => {
    try {
      const storefront = await resolvePublicStorefront(req);
      const idempotencyKey = String(req.headers['idempotency-key'] || req.headers['x-idempotency-key'] || req.body?.idempotencyKey || '').trim().slice(0, 180);
      if (!idempotencyKey) throw new CommerceError('envie Idempotency-Key para criar o pedido', 'ORDER_IDEMPOTENCY_REQUIRED');
      const publicInput = sanitizePublicOrderInput({ ...req.body, idempotencyKey });
      const result = await withCommerceTransaction(trx => createPendingOrder(
        trx,
        { empresaId: storefront.empresa_id, lojaId: storefront.loja_id },
        {
          ...publicInput,
          storefrontId: storefront.id,
          correlationId: req.requestId || '',
          finalizeResponse: async order => {
            const promotionCode = String(req.body?.promotionCode || '').trim();
            let finalOrder = order;
            if (promotionCode) {
              const promotion = await applyPromotionToOrder(trx, { empresaId: storefront.empresa_id, lojaId: storefront.loja_id, storefrontId: storefront.id }, { orderId: order.id, codigo: promotionCode, storefrontId: storefront.id });
              finalOrder = { ...order, discount: promotion.desconto, total: promotion.total, promotionCode: promotion.codigo };
            }
            const publicResult = { ...finalOrder };
            delete publicResult.customerId;
            delete publicResult.customerAddressId;
            return publicResult;
          },
        },
      ));
      res.status(201).json(result);
    } catch (error) {
      // Na vitrine pública, não diz se o e-mail ou o telefone já pertencem a outro cliente.
      if (error?.code === 'CONTACT_CONFLICT') {
        const allowedReasons = new Set(['identifiers_resolve_to_different_customers', 'customer_email_mismatch', 'customer_phone_mismatch', 'concurrent_unique_conflict', 'cart_customer_mismatch', 'cart_order_customer_mismatch']);
        const reason = allowedReasons.has(error?.details?.reason) ? error.details.reason : 'unknown';
        console.warn('commerce_checkout_contact_review', JSON.stringify({ requestId: String(req.requestId || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64), reason }));
        res.set('Cache-Control', 'no-store, private');
        return res.status(409).json({ error: 'Não foi possível confirmar seus dados de contato. Confira e-mail e telefone ou fale com a loja.', code: 'CHECKOUT_CONTACT_REVIEW' });
      }
      jsonError(res, error);
    }
  });
  router.get('/orders/:publicCode', async (req, res) => {
    try {
      const storefront = await resolvePublicStorefront(req);
      const result = await db.query(
        `SELECT o.public_code, o.status, o.moeda, o.subtotal, o.desconto, o.frete, o.impostos, o.total,
                CASE WHEN ${lateCaptureReviewExistsSql} THEN 'captured'
                     ELSE (SELECT p.status FROM commerce_payments p WHERE p.empresa_id = o.empresa_id AND p.order_id = o.id ORDER BY p.criado_em DESC LIMIT 1)
                END AS payment_status,
                sm.tipo AS shipping_method_type,
                CASE WHEN ${lateCaptureReviewExistsSql} THEN 'refund_required' ELSE NULL END AS payment_review_status,
                COALESCE((SELECT jsonb_build_object('submitted', true, 'submittedAt', s.criado_em) FROM commerce_order_satisfaction s WHERE s.empresa_id = o.empresa_id AND s.order_id = o.id AND s.retencao_ate > CURRENT_TIMESTAMP LIMIT 1), jsonb_build_object('submitted', false)) AS satisfaction,
                CASE WHEN o.endereco_entrega IS NULL THEN NULL ELSE jsonb_build_object('cidade', o.endereco_entrega->>'cidade', 'estado', o.endereco_entrega->>'estado', 'cep', CASE WHEN length(o.endereco_entrega->>'cep') = 8 THEN left(o.endereco_entrega->>'cep', 5) || '***' ELSE NULL END) END AS endereco_entrega, o.criado_em, o.atualizado_em,
                (SELECT (SELECT option->'public' FROM jsonb_array_elements(COALESCE(q.response_snapshot->'providerOptions', '[]'::jsonb)) AS option WHERE option->'public'->>'id' = q.selected_option_id LIMIT 1)
                   FROM commerce_shipping_quotes q WHERE q.empresa_id = o.empresa_id AND q.id = o.shipping_quote_id LIMIT 1) AS shipping_option,
                COALESCE(jsonb_agg(jsonb_build_object('nome', i.nome_snapshot, 'sku', i.sku_snapshot, 'quantidade', i.quantidade, 'preco', i.preco_unitario, 'subtotal', i.subtotal)) FILTER (WHERE i.id IS NOT NULL), '[]'::jsonb) AS items,
                COALESCE((SELECT jsonb_agg(jsonb_build_object('status', f.status, 'trackingCode', f.tracking_code, 'trackingUrl', f.tracking_url, 'carrier', f.carrier, 'ocorrencias', f.ocorrencias) ORDER BY f.criado_em DESC)
                            FROM commerce_fulfillments f WHERE f.empresa_id = o.empresa_id AND f.order_id = o.id), '[]'::jsonb) AS fulfillments,
                COALESCE((SELECT jsonb_agg(jsonb_build_object('fromStatus', e.de_status, 'toStatus', e.para_status, 'source', e.origem, 'at', e.criado_em) ORDER BY e.criado_em ASC)
                            FROM commerce_order_events e WHERE e.empresa_id = o.empresa_id AND e.order_id = o.id), '[]'::jsonb) AS timeline
           FROM commerce_orders o
           LEFT JOIN commerce_order_items i ON i.empresa_id = o.empresa_id AND i.order_id = o.id
           LEFT JOIN commerce_shipping_methods sm ON sm.empresa_id = o.empresa_id AND sm.id = o.shipping_method_id
          WHERE o.empresa_id = $1 AND o.storefront_id = $2 AND o.public_code = $3
          GROUP BY o.id, sm.tipo
          LIMIT 1`,
        [storefront.empresa_id, storefront.id, String(req.params.publicCode || '').toUpperCase()],
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'pedido não encontrado', code: 'ORDER_NOT_FOUND' });
      res.json(sanitizePublicOrderTracking(result.rows[0]));
    } catch (error) { jsonError(res, error); }
  });
  router.post('/orders/:publicCode/satisfaction', publicSatisfactionRateLimit, publicSatisfactionOrderRateLimit, async (req, res) => {
    try {
      const storefront = await resolvePublicStorefront(req);
      const context = { empresaId: storefront.empresa_id, lojaId: storefront.loja_id, storefrontId: storefront.id };
      const result = await withCommerceTransaction(trx => submitOrderSatisfaction(
        trx,
        context,
        req.params.publicCode,
        { ...req.body, idempotencyKey: req.headers['x-idempotency-key'] || req.body?.idempotencyKey },
      ));
      res.status(result.idempotentReplay ? 200 : 201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  return router;
}

function webhookScope(ownerRow, accountField = 'account_id') {
  const empresaId = ownerRow?.empresa_id;
  const lojaId = ownerRow?.loja_id;
  const storefrontId = ownerRow?.storefront_id;
  const accountId = ownerRow?.[accountField] || ownerRow?.payment_account_id || ownerRow?.shipping_account_id;
  if (!empresaId || !lojaId || !storefrontId || !accountId) {
    throw new CommerceError('webhook sem escopo empresa/loja/storefront/account inequívoco', 'PAYMENT_WEBHOOK_SCOPE_REQUIRED');
  }
  return { empresaId, lojaId, storefrontId, accountId };
}

async function enforceWebhookRateLimit(scope, requestId, payloadHash, provider, rateLimit = consumeWebhookRateLimit) {
  const outcome = await withCommerceTransaction(trx => rateLimit(trx, scope, {
    provider,
    accountId: scope.accountId,
    fingerprintValue: `${requestId}:${payloadHash}`,
    limit: 60,
    windowSeconds: 60,
  }));
  return outcome;
}

async function persistWebhookObservation(auditAdapter, input) {
  if (!auditAdapter || typeof auditAdapter.record !== 'function') return null;
  try {
    return await auditAdapter.record(input);
  } catch (error) {
    // A divergent replay is a security decision, not an observability outage.
    if (error?.code === 'WEBHOOK_PAYLOAD_CONFLICT') throw error;
    console.warn('commerce_webhook_observability_unavailable', JSON.stringify({ requestId: input.requestId, provider: input.provider, eventId: input.providerEventId, errorCode: String(error?.code || 'AUDIT_UNAVAILABLE').slice(0, 80) }));
    return null;
  }
}

async function finishWebhookObservation(auditAdapter, input) {
  if (!auditAdapter || typeof auditAdapter.update !== 'function') return;
  try {
    await auditAdapter.update(input);
  } catch (error) {
    // Observability must not turn a completed provider operation into a retry,
    // and logs contain only bounded codes (never payload, secret, or message).
    console.warn('commerce_webhook_observability_update_unavailable', JSON.stringify({
      provider: String(input.provider || '').slice(0, 80),
      errorCode: String(error?.code || 'AUDIT_UPDATE_UNAVAILABLE').replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, 80),
    }));
  }
}

export function createCommerceWebhookRouter({ auditAdapter = createWebhookAuditAdapter({ db }), rateLimit = consumeWebhookRateLimit } = {}) {
  const router = express.Router();
  router.post('/:provider/shipping', async (req, res) => {
    const startedAt = Date.now();
    const requestId = webhookRequestId(req);
    const payloadHash = webhookPayloadHash(req);
    try {
      const provider = String(req.params.provider || '').trim().toLowerCase();
      const adapter = shippingProviders.get(provider);
      if (!adapter) throw new CommerceError('provedor logístico não suportado', 'SHIPPING_PROVIDER_UNSUPPORTED');
      const providerShipmentId = String(req.body?.data?.id || req.body?.id || '').trim();
      if (!providerShipmentId) throw new CommerceError('webhook logístico sem id do envio', 'SHIPPING_WEBHOOK_INVALID');
      const owner = await db.query(
        `SELECT f.id AS fulfillment_id, f.empresa_id, f.order_id, f.provider_shipment_id, o.storefront_id, s.loja_id,
                a.id AS shipping_account_id, a.secret_ref, a.public_config, a.provider, a.ambiente
           FROM commerce_fulfillments f
           JOIN commerce_orders o ON o.empresa_id = f.empresa_id AND o.id = f.order_id
           JOIN commerce_storefronts s ON s.empresa_id = o.empresa_id AND s.id = o.storefront_id
           JOIN commerce_shipping_accounts a ON a.empresa_id = f.empresa_id AND a.id = COALESCE(f.shipping_account_id, (SELECT q.shipping_account_id FROM commerce_shipping_quotes q WHERE q.empresa_id = f.empresa_id AND q.id = f.shipping_quote_id))
          WHERE f.provider_shipment_id = $1 AND a.provider = $2 AND a.storefront_id = o.storefront_id AND s.status = 'active'
          LIMIT 2`,
        [providerShipmentId, provider],
      );
      if (!owner.rows[0]) throw new CommerceError('owner do webhook logístico não encontrado', 'SHIPPING_WEBHOOK_OWNER_UNKNOWN');
      if (owner.rows.length > 1) throw new CommerceError('webhook associado a mais de um fulfillment persistido', 'SHIPPING_WEBHOOK_AMBIGUOUS');
      const ownerRow = owner.rows[0];
      const scope = webhookScope({ ...ownerRow, account_id: ownerRow.shipping_account_id });
      const rate = await enforceWebhookRateLimit(scope, requestId, payloadHash, provider, rateLimit);
      if (!rate.allowed) {
        res.set('Retry-After', String(rate.retryAfterSeconds));
        return res.status(429).json({ ok: false, code: 'RATE_LIMIT', error: 'limite temporário de eventos atingido' });
      }
      const verified = await adapter.verifyWebhook({ payload: req.body || {}, signature: req.headers['x-me-signature'] || req.headers['x-signature'] || '', context: { rawBody: req.rawBody || Buffer.from(JSON.stringify(req.body || {})), account: { id: ownerRow.shipping_account_id, secret_ref: ownerRow.secret_ref, public_config: ownerRow.public_config }, dataId: providerShipmentId, requestId } });
      if (verified?.signatureValid !== true) throw new CommerceError('assinatura do webhook logístico inválida ou ausente', 'SHIPPING_WEBHOOK_INVALID');
      if (String(verified.providerShipmentId || '') !== providerShipmentId) throw new CommerceError('webhook não corresponde ao shipment persistido', 'SHIPPING_WEBHOOK_INVALID');
      const eventId = String(verified.eventId || '').trim().slice(0, 180);
      if (!eventId) throw new CommerceError('webhook logístico sem identificador de evento', 'SHIPPING_WEBHOOK_INVALID');
      const result = await withCommerceTransaction(async trx => {
        const eventAudit = await persistWebhookObservation(auditAdapter, {
          trx, requestId, payloadHash, provider, providerAccountId: scope.accountId, providerEventId: eventId,
          empresaId: scope.empresaId, lojaId: scope.lojaId, status: 'received', metadata: {
            decision: 'accepted', statusHttp: 200, durationMs: Date.now() - startedAt, attempt: 1,
            eventType: verified.eventType, providerStatus: verified.providerStatus,
          }, headers: { requestId },
        });
        if (eventAudit?.duplicate) return { duplicate: true };
        const inserted = await trx.query(
          `INSERT INTO commerce_shipping_webhooks
            (empresa_id, provider, provider_event_id, provider_shipment_id, event_type, signature_valid, status, payload_hash, payload_resumido)
           VALUES ($1, $2, $3, $4, $5, true, 'received', $6, $7::jsonb)
           ON CONFLICT (empresa_id, provider, provider_event_id) DO NOTHING
           RETURNING id`,
          [ownerRow.empresa_id, provider, eventId, providerShipmentId, String(verified.eventType || 'order.status').slice(0, 100), payloadHash, JSON.stringify(verified.summary || {})],
        );
        if (!inserted.rows[0]) {
          const previous = await trx.query(`SELECT payload_hash FROM commerce_shipping_webhooks WHERE empresa_id = $1 AND provider = $2 AND provider_event_id = $3 LIMIT 1`, [scope.empresaId, provider, eventId]);
          if (previous.rows[0]?.payload_hash && String(previous.rows[0].payload_hash).toLowerCase() !== payloadHash) throw new CommerceError('webhook logístico repetido com payload divergente', 'WEBHOOK_PAYLOAD_CONFLICT');
          return { duplicate: true };
        }
        const updated = await updateShippingTracking(trx, { empresaId: ownerRow.empresa_id, lojaId: ownerRow.loja_id }, ownerRow.fulfillment_id, verified, ownerRow.storefront_id);
        await auditLog(trx, { empresaId: ownerRow.empresa_id, lojaId: ownerRow.loja_id }, { entidade: 'fulfillment', entidadeId: ownerRow.fulfillment_id, acao: 'provider_webhook', depois: { storefrontId: ownerRow.storefront_id, provider, eventId, eventType: verified.eventType, status: verified.providerStatus, trackingCode: verified.trackingCode } });
        await trx.query(`UPDATE commerce_shipping_webhooks SET status = 'processed', processado_em = CURRENT_TIMESTAMP WHERE id = $1`, [inserted.rows[0].id]);
        return { fulfillmentId: ownerRow.fulfillment_id, orderId: ownerRow.order_id, status: updated.status, providerStatus: verified.providerStatus };
      });
      res.json({ ok: true, ...result });
    } catch (error) { jsonError(res, error); }
  });
  router.post('/:provider/payments', async (req, res) => {
    const provider = String(req.params.provider || '').trim().toLowerCase();
    const startedAt = Date.now();
    const requestId = webhookRequestId(req);
    const payloadHash = webhookPayloadHash(req);
    let auditIdentity = null;
    try {
      const dataId = String(req.query['data.id'] || req.body?.data?.id || req.body?.transaction_nsu || req.body?.transactionNsu || '').trim().slice(0, 180);
      const orderNsu = String(req.body?.order_nsu || req.body?.orderNsu || '').trim().slice(0, 180);
      const invoiceSlug = String(req.body?.invoice_slug || req.body?.invoiceSlug || req.body?.slug || '').trim().slice(0, 180);
      if (!dataId && !orderNsu && !invoiceSlug) throw new CommerceError('webhook sem identificador do pagamento', 'PAYMENT_WEBHOOK_INVALID');
      let owner = { rows: [] };
      if (dataId) owner = await db.query(
        `SELECT p.id AS payment_id, p.empresa_id, p.payment_account_id, p.amount, p.method, p.provider_payment_id,
                o.public_code AS order_code, o.storefront_id, s.loja_id, a.secret_ref, a.public_config
           FROM commerce_payments p
           JOIN commerce_orders o ON o.empresa_id = p.empresa_id AND o.id = p.order_id
           JOIN commerce_storefronts s ON s.empresa_id = o.empresa_id AND s.id = o.storefront_id AND s.status = 'active'
           JOIN commerce_payment_accounts a
             ON a.empresa_id = p.empresa_id AND a.id = p.payment_account_id
            AND a.storefront_id = o.storefront_id AND a.ativo = true AND a.ambiente = 'production'
          WHERE p.provider = $1 AND p.provider_payment_id = $2
          LIMIT 2`,
        [provider, dataId],
      );
      if (!owner.rows[0] && provider === 'infinitepay' && orderNsu && invoiceSlug) owner = await db.query(infinitepayWebhookUnboundOwnerSql, [orderNsu, invoiceSlug]);
      if (!owner.rows[0] && provider === 'infinitepay' && orderNsu && invoiceSlug && dataId) owner = await db.query(infinitepayWebhookDuplicateOwnerSql, [orderNsu, dataId]);
      if (!owner.rows[0]) return res.status(200).json({ ok: true, ignored: true });
      // Sem slug na resposta de /links, múltiplas tentativas pendentes não têm
      // vínculo inequívoco: não selecionar a mais recente nem capturar às cegas.
      if (owner.rows.length > 1) throw new CommerceError('webhook associado a mais de uma tentativa persistida', 'PAYMENT_WEBHOOK_AMBIGUOUS');
      const ownerRow = owner.rows[0];
      const scope = webhookScope(ownerRow);
      const rate = await enforceWebhookRateLimit(scope, requestId, payloadHash, provider, rateLimit);
      if (!rate.allowed) {
        res.set('Retry-After', String(rate.retryAfterSeconds));
        return res.status(429).json({ ok: false, code: 'RATE_LIMIT', error: 'limite temporário de eventos atingido' });
      }
      if (!ownerRow.secret_ref) throw new CommerceError('conta de pagamento do webhook não está vinculada', 'PAYMENT_WEBHOOK_INVALID');
      const verified = await verifyPaymentWebhook(provider, req.body || {}, req.headers['x-signature'] || req.headers['x-webhook-signature'] || '', {
        rawBody: req.rawBody || Buffer.from(JSON.stringify(req.body || {})),
        requestId,
        dataId,
        orderNsu,
        account: { secret_ref: ownerRow.secret_ref, public_config: ownerRow.public_config },
        empresaId: ownerRow.empresa_id,
        expectedOrderNsu: ownerRow.order_code,
        expectedTransactionNsu: ownerRow.possible_duplicate ? null : ownerRow.provider_payment_id || null,
        expectedAmount: ownerRow.amount,
        expectedMethod: ownerRow.possible_duplicate ? 'external' : ownerRow.method,
      });
      if (provider === 'infinitepay' && verified.status === 'captured' && (!dataId || verified.providerPaymentId !== dataId)) throw new CommerceError('payment_check confirmou outro identificador', 'PAYMENT_WEBHOOK_INVALID');
      if (ownerRow.possible_duplicate && verified.status !== 'captured') return res.json({ ok: true, ignored: true });
      const empresaId = tenantContext({ empresaId: ownerRow.empresa_id }).empresaId;
      const eventId = String(verified.eventId || '').trim().slice(0, 180);
      if (!eventId) throw new CommerceError('webhook sem identificador do provedor', 'PAYMENT_WEBHOOK_INVALID');
      auditIdentity = { provider, providerAccountId: scope.accountId, providerEventId: eventId, payloadHash, empresaId: scope.empresaId, lojaId: scope.lojaId, storefrontId: scope.storefrontId, requestId };
      const eventAudit = await persistWebhookObservation(auditAdapter, {
        ...auditIdentity,
        status: 'received',
        metadata: { eventType: verified.eventType || verified.type || 'payment.updated', providerStatus: verified.status, decision: 'accepted', durationMs: Date.now() - startedAt },
        headers: { requestId },
      });
      if (eventAudit?.duplicate) return res.json({ ok: true, duplicate: true });
      const result = await withCommerceTransaction(async trx => {
        const inserted = await trx.query(
          `INSERT INTO commerce_payment_webhooks
            (empresa_id, provider, provider_event_id, event_type, signature_valid, status, payload_hash, payload_resumido)
           VALUES ($1, $2, $3, $4, $5, 'received', $6, $7::jsonb)
          ON CONFLICT (provider, provider_event_id) DO NOTHING
           RETURNING id`,
          [empresaId, provider, eventId, String(verified.eventType || verified.type || 'payment.updated').slice(0, 100), verified.signatureValid === true, payloadHash, JSON.stringify({ ...(verified.summary || {}), verification: verified.verification || null })],
        );
        const webhookId = inserted.rows[0]?.id || null;
        if (!inserted.rows[0]) {
          const previous = await trx.query(`SELECT status, payload_resumido->>'reviewCode' AS review_code FROM commerce_payment_webhooks WHERE provider = $1 AND provider_event_id = $2 LIMIT 1`, [provider, eventId]);
          // The legacy table is globally unique by provider/event. Scoped
          // dino_webhook_events above is authoritative; another account's
          // collision must not discard this event.
          if (previous.rows[0]?.review_code === 'PROVIDER_CAPTURE_CONFLICT') return { conflict: true, reviewRequired: true, refundRequired: true };
        }
        const markWebhook = async (status, extra = '') => {
          if (!webhookId) return;
          await trx.query(`UPDATE commerce_payment_webhooks SET status = '${status}'${extra}, processado_em = CURRENT_TIMESTAMP WHERE id = $1`, [webhookId]);
        };
        const payment = await trx.query(
          `SELECT p.id, p.order_id, p.method, p.amount, p.status, p.provider_payment_id, o.status AS order_status
             FROM commerce_payments p
             JOIN commerce_orders o ON o.empresa_id = p.empresa_id AND o.id = p.order_id
            WHERE p.empresa_id = $1 AND p.provider = $2 AND p.id = $3
            FOR UPDATE OF p`,
          [empresaId, provider, ownerRow.payment_id],
        );
        if (!payment.rows[0]) {
          await markWebhook('ignored');
          return { ignored: true };
        }
        const current = payment.rows[0];
        // A leitura inicial de owner ocorreu ANTES do payment_check. Outro retorno
        // pode ter capturado uma transação diferente nesse intervalo. O lock em p
        // é o ponto final de decisão: nunca trocar o ID da captura anterior.
        if (provider === 'infinitepay' && current.provider_payment_id && dataId && current.provider_payment_id !== dataId) {
          if (verified.status === 'captured' && verified.providerPaymentId === dataId) {
            await markWebhook('failed', `, payload_resumido = payload_resumido || '{"reviewCode":"PROVIDER_CAPTURE_CONFLICT","refundRequired":true}'::jsonb`);
            await auditLog(trx, { empresaId }, { entidade: 'payment', entidadeId: current.id, acao: 'provider_capture_conflict', correlationId: eventId, depois: { provider, refundRequired: true, reviewRequired: true, originalPaymentPreserved: true } });
            return { conflict: true, reviewRequired: true, refundRequired: true };
          }
          await markWebhook('ignored');
          return { ignored: true };
        }
        if (provider === 'infinitepay' && verified.status === 'captured' && verified.providerPaymentId && !current.provider_payment_id) {
          await trx.query(`UPDATE commerce_payments SET provider_payment_id = $3, metadata = metadata || $4::jsonb, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2`, [empresaId, current.id, String(verified.providerPaymentId).slice(0, 180), JSON.stringify({ checkout: { orderNsu: verified.summary?.orderNsu || null, transactionNsu: String(verified.providerPaymentId).slice(0, 180), slug: verified.summary?.slug || null, captureMethod: verified.summary?.captureMethod || null, verifiedBy: verified.verification || null } })]);
        }
        if (verified.amount != null && Math.abs(Number(verified.amount) - Number(current.amount)) > 0.01) {
          await markWebhook('failed');
          throw new CommerceError('valor do webhook diverge do pedido', 'PAYMENT_AMOUNT_MISMATCH');
        }
        const statusMap = { authorized: 'authorized', paid: 'captured', captured: 'captured', failed: 'failed', cancelled: 'cancelled', refunded: 'refunded', partially_refunded: 'partially_refunded' };
        const nextPaymentStatus = statusMap[String(verified.status || '').toLowerCase()];
        if (!nextPaymentStatus) throw new CommerceError('status de webhook não suportado', 'PAYMENT_WEBHOOK_INVALID');
        const nextPaymentMethod = resolvedPaymentMethod(provider, current.method, verified.summary?.captureMethod);
        const lateCaptureRequired = captureNeedsRefund(current.status, current.order_status, nextPaymentStatus, { otherCaptured: nextPaymentStatus === 'captured' && current.order_status !== 'pending_payment' && await otherCapturedPayment(trx, empresaId, current.order_id, current.id) });
        if (!lateCaptureRequired && !canTransitionPaymentStatus(current.status, nextPaymentStatus)) {
          await markWebhook('ignored');
          return { stale: true, paymentId: current.id, orderId: current.order_id, status: current.status };
        }
        await trx.query(
          `UPDATE commerce_payments SET status = $3::text, method = $5::text, authorized_at = CASE WHEN $3::text = 'authorized' THEN COALESCE(authorized_at, CURRENT_TIMESTAMP) ELSE authorized_at END,
                  captured_at = CASE WHEN $3::text = 'captured' THEN COALESCE(captured_at, CURRENT_TIMESTAMP) ELSE captured_at END,
                  refunded_at = CASE WHEN $3::text IN ('refunded','partially_refunded') THEN COALESCE(refunded_at, CURRENT_TIMESTAMP) ELSE refunded_at END,
                  metadata = metadata || $4::jsonb, atualizado_em = CURRENT_TIMESTAMP
            WHERE empresa_id = $1 AND id = $2`,
          [empresaId, current.id, nextPaymentStatus, JSON.stringify({ webhookEventId: eventId }), nextPaymentMethod],
        );
        if (nextPaymentStatus === 'captured' && current.order_status === 'pending_payment') await transitionOrder(trx, { empresaId }, { orderId: current.order_id, status: 'paid', origin: 'payment_webhook', correlationId: eventId, payload: { provider, eventId } });
        if (nextPaymentStatus === 'failed' && ['draft', 'pending_payment'].includes(current.order_status)) await transitionOrder(trx, { empresaId }, { orderId: current.order_id, status: 'payment_failed', origin: 'payment_webhook', correlationId: eventId, payload: { provider, eventId } });
        if (nextPaymentStatus === 'cancelled' && ['draft', 'pending_payment', 'payment_failed', 'fraud_review'].includes(current.order_status)) await transitionOrder(trx, { empresaId }, { orderId: current.order_id, status: 'cancelled', origin: 'payment_webhook', correlationId: eventId, payload: { provider, eventId } });
        if (nextPaymentStatus === 'partially_refunded' && current.order_status === 'completed') await transitionOrder(trx, { empresaId }, { orderId: current.order_id, status: 'partially_refunded', origin: 'payment_webhook', correlationId: eventId, payload: { provider, eventId } });
        if (nextPaymentStatus === 'refunded' && ['paid', 'completed'].includes(current.order_status)) await transitionOrder(trx, { empresaId }, { orderId: current.order_id, status: 'refunded', origin: 'payment_webhook', correlationId: eventId, payload: { provider, eventId } });
        const lateCapture = lateCaptureRequired
          ? await recordLatePaymentCapture(trx, { empresaId }, { paymentId: current.id, orderId: current.order_id, orderStatus: current.order_status, source: 'payment_webhook', provider, correlationId: eventId })
          : null;
        await markWebhook('processed');
        return { paymentId: current.id, orderId: current.order_id, status: nextPaymentStatus, refundRequired: Boolean(lateCapture?.refundRequired) };
      });
      await finishWebhookObservation(auditAdapter, {
        ...auditIdentity,
        status: result.conflict ? 'failed' : (result.ignored || result.stale ? 'ignored' : 'processed'),
        metadata: { durationMs: Date.now() - startedAt, decision: result.conflict ? 'review_required' : 'completed', statusHttp: result.conflict ? 400 : 200 },
        errorCode: result.conflict ? 'PROVIDER_CAPTURE_CONFLICT' : null,
      });
      if (result.conflict) return res.status(400).json({ success: false, code: 'PROVIDER_CAPTURE_CONFLICT', reviewRequired: true });
      res.json({ ok: true, ...result });
    } catch (error) {
      await finishWebhookObservation(auditAdapter, {
        ...(auditIdentity || {}),
        status: 'failed',
        metadata: { durationMs: Date.now() - startedAt, decision: 'rejected', statusHttp: Number(error?.statusCode || 500) },
        errorCode: error?.code || 'PAYMENT_WEBHOOK_FAILED',
      });
      jsonError(res, error);
    }
  });
  return router;
}

export function createCommerceAdminRouter() {
  const router = express.Router();
  router.get('/users/roles', async (req, res) => {
    try {
      const context = await requirePermission(req, 'users.write');
      res.json(await listRoles(db, context));
    } catch (error) { jsonError(res, error); }
  });
  router.get('/users/memberships', async (req, res) => {
    try {
      const context = await requirePermission(req, 'users.write');
      res.json(await listMemberships(db, context));
    } catch (error) { jsonError(res, error); }
  });
  router.get('/users/candidates', async (req, res) => {
    try {
      const context = await requirePermission(req, 'users.write');
      res.json(await listMembershipCandidates(db, context, req.query.query || req.query.q || ''));
    } catch (error) { jsonError(res, error); }
  });
  router.post('/users/memberships', async (req, res) => {
    try {
      const context = await requirePermission(req, 'users.write');
      const result = await withCommerceTransaction(trx => createMembership(trx, { ...context, legacyGlobalAdmin: isLegacyGlobalAdmin(req.user) }, req.body));
      res.status(201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.patch('/users/memberships/:id', async (req, res) => {
    try {
      const context = await requirePermission(req, 'users.write');
      const result = await withCommerceTransaction(trx => updateMembership(trx, { ...context, legacyGlobalAdmin: isLegacyGlobalAdmin(req.user) }, req.params.id, req.body));
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.get('/storefront/domains', async (req, res) => {
    try {
      const context = await requirePermission(req, 'catalog.read');
      res.json(await listStorefrontDomains(db, context, req.query.storefrontId || null));
    } catch (error) { jsonError(res, error); }
  });
  router.post('/storefront/domains', async (req, res) => {
    try {
      const context = await requirePermission(req, 'catalog.publish');
      const result = await withCommerceTransaction(trx => createStorefrontDomain(trx, context, req.body));
      res.status(201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.post('/storefront/domains/:id/verify', async (req, res) => {
    try {
      const context = await requirePermission(req, 'catalog.publish');
      const result = await withCommerceTransaction(trx => verifyStorefrontDomain(trx, context, req.params.id));
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.post('/storefront/domains/:id/primary', async (req, res) => {
    try {
      const context = await requirePermission(req, 'catalog.publish');
      const result = await withCommerceTransaction(trx => setPrimaryStorefrontDomain(trx, context, req.params.id));
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.get('/storefronts', async (req, res) => {
    try {
      const context = await requirePermission(req, 'catalog.read');
      res.json(await listStorefronts(db, context));
    } catch (error) { jsonError(res, error); }
  });
  router.post('/storefronts', async (req, res) => {
    try {
      const context = await requirePermission(req, 'settings.write');
      const result = await withCommerceTransaction(trx => createStorefront(trx, context, req.body));
      res.status(201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.patch('/storefronts/:id', async (req, res) => {
    try {
      const context = await requirePermission(req, 'settings.write');
      const result = await withCommerceTransaction(trx => updateStorefront(trx, context, req.params.id, req.body));
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.get('/storefront', async (req, res) => {
    try {
      const context = await requirePermission(req, 'catalog.read');
      const result = await db.query(
        `SELECT id, codigo, nome, canal, moeda, timezone, loja_id
           FROM commerce_storefronts
          WHERE empresa_id = $1 AND status = 'active'
            AND ($2::uuid IS NULL OR loja_id = $2 OR loja_id IS NULL)
          ORDER BY CASE WHEN loja_id = $2 THEN 0 ELSE 1 END, nome ASC`,
        [context.empresaId, context.lojaId],
      );
      res.json({ items: result.rows });
    } catch (error) { jsonError(res, error); }
  });
  router.get('/catalog/products', async (req, res) => {
    try {
      const context = await requirePermission(req, 'catalog.read');
      const selectedStorefrontId = await requireAdminStorefront(req, context, { optionalForCorporate: false });
      const values = [context.empresaId];
      const predicates = ['p.empresa_id = $1'];
      let lojaParam = null;
      let storefrontParam = null;
      let locationParam = null;
      if (context.lojaId) {
        values.push(context.lojaId);
        lojaParam = `$${values.length}`;
        predicates.push(`EXISTS (SELECT 1 FROM commerce_product_channels pc JOIN commerce_storefronts s ON s.empresa_id = pc.empresa_id AND s.id = pc.storefront_id WHERE pc.empresa_id = p.empresa_id AND pc.product_id = p.id AND (s.loja_id = ${lojaParam} OR s.loja_id IS NULL))`);
      }
      if (selectedStorefrontId) {
        const storefrontId = selectedStorefrontId;
        const storefront = await db.query(
          `SELECT id FROM commerce_storefronts
            WHERE empresa_id = $1 AND id = $2 AND status = 'active'
              AND ($3::uuid IS NULL OR loja_id = $3 OR loja_id IS NULL)
            LIMIT 1`,
          [context.empresaId, storefrontId, context.lojaId],
        );
        if (!storefront.rows[0]) throw new CommerceError('storefront fora do escopo da loja', 'STOREFRONT_NOT_FOUND');
        values.push(storefrontId);
        storefrontParam = `$${values.length}`;
        predicates.push(`EXISTS (SELECT 1 FROM commerce_product_channels pc WHERE pc.empresa_id = p.empresa_id AND pc.product_id = p.id AND pc.storefront_id = ${storefrontParam})`);
      }
      if (req.query.status) { values.push(String(req.query.status)); predicates.push(`p.status = $${values.length}`); }
      // O filtro de local atua somente no estoque agregado da listagem. Não
      // enviar seu parâmetro ao COUNT, que não referencia commerce_inventory_levels.
      const countValues = [...values];
      if (req.query.locationId) {
        const locationId = assertUuid(req.query.locationId, 'locationId');
        const location = await db.query(
          `SELECT id FROM commerce_inventory_locations
            WHERE empresa_id = $1 AND id = $2 AND ativo = true
              AND ($3::uuid IS NULL OR loja_id = $3 OR loja_id IS NULL)
            LIMIT 1`,
          [context.empresaId, locationId, context.lojaId],
        );
        if (!location.rows[0]) throw new CommerceError('local de estoque fora do escopo da loja', 'INVENTORY_LOCATION_SCOPE_MISMATCH');
        values.push(locationId);
        locationParam = `$${values.length}`;
      }
      const channelScope = storefrontParam
        ? `AND channel_storefront.id = ${storefrontParam}`
        : lojaParam ? `AND (channel_storefront.loja_id = ${lojaParam} OR channel_storefront.loja_id IS NULL)` : '';
      const priceChannelScope = storefrontParam
        ? `AND channel.storefront_id = ${storefrontParam}`
        : lojaParam ? `AND channel.storefront_id = ANY(ARRAY(SELECT s2.id FROM commerce_storefronts s2 WHERE s2.empresa_id = p.empresa_id AND (s2.loja_id = ${lojaParam} OR s2.loja_id IS NULL)))` : '';
      const inventoryScope = locationParam
        ? `AND il.location_id = ${locationParam}`
        : lojaParam ? `AND EXISTS (SELECT 1 FROM commerce_inventory_locations scoped_location WHERE scoped_location.empresa_id = il.empresa_id AND scoped_location.id = il.location_id AND (scoped_location.loja_id = ${lojaParam} OR scoped_location.loja_id IS NULL))` : '';
      const { limit, offset } = parsePagination(req, 100, 500);
      const count = await db.query(`SELECT COUNT(*)::int AS total FROM commerce_products p LEFT JOIN commerce_categories c ON c.empresa_id = p.empresa_id AND c.id = p.category_id WHERE ${predicates.join(' AND ')}`, countValues);
      const result = await db.query(
        `SELECT p.id, p.slug, p.nome, p.tipo, p.status, p.descricao, p.descricao_curta, p.dados_fiscais, p.seo, p.category_id,
                c.nome AS category_name, p.criado_em, p.atualizado_em,
                COALESCE((
                  SELECT BOOL_OR(pc.publicado AND p.status = 'active')
                    FROM commerce_product_channels pc
                    JOIN commerce_storefronts channel_storefront
                      ON channel_storefront.empresa_id = pc.empresa_id
                     AND channel_storefront.id = pc.storefront_id
                   WHERE pc.empresa_id = p.empresa_id
                     AND pc.product_id = p.id
                     ${channelScope}
                ), false) AS publicado,
                COALESCE((
                  SELECT jsonb_agg(jsonb_build_object(
                    'id', v.id,
                    'sku', v.sku,
                    'nome', v.nome,
                    'atributos', v.atributos,
                    'barcode', v.barcode,
                    'pesoGramas', v.peso_gramas,
                    'larguraCm', v.largura_cm,
                    'alturaCm', v.altura_cm,
                    'comprimentoCm', v.comprimento_cm,
                    'ativo', v.ativo,
                    'preco', vp.preco,
                    'precoPromocional', vp.preco_promocional,
                    'estoque', COALESCE((SELECT SUM(il.disponivel) FROM commerce_inventory_levels il WHERE il.empresa_id = v.empresa_id AND il.variant_id = v.id ${inventoryScope}), 0)
                  ) ORDER BY v.criado_em ASC)
                    FROM commerce_product_variants v
                    LEFT JOIN LATERAL (
                      SELECT price.preco, price.preco_promocional
                        FROM commerce_variant_prices price
                       JOIN commerce_product_channels channel
                         ON channel.empresa_id = price.empresa_id
                        AND channel.price_list_id = price.price_list_id
                        AND channel.product_id = p.id
                        ${priceChannelScope}
                       WHERE price.empresa_id = v.empresa_id AND price.variant_id = v.id
                         AND price.vigencia_inicio <= CURRENT_TIMESTAMP
                         AND (price.vigencia_fim IS NULL OR price.vigencia_fim > CURRENT_TIMESTAMP)
                       ORDER BY price.vigencia_inicio DESC LIMIT 1
                    ) vp ON true
                   WHERE v.empresa_id = p.empresa_id AND v.product_id = p.id
                ), '[]'::jsonb) AS variants,
                COALESCE((
                  SELECT jsonb_agg(jsonb_build_object(
                    'id', m.id,
                    'variantId', m.variant_id,
                    'storageKey', m.storage_key,
                    'publicUrl', m.public_url,
                    'mimeType', m.mime_type,
                    'altText', m.alt_text,
                    'ordem', m.ordem
                  ) ORDER BY m.ordem ASC, m.criado_em ASC)
                    FROM commerce_product_media m
                   WHERE m.empresa_id = p.empresa_id AND m.product_id = p.id
                ), '[]'::jsonb) AS media
           FROM commerce_products p
           LEFT JOIN commerce_categories c ON c.empresa_id = p.empresa_id AND c.id = p.category_id
          WHERE ${predicates.join(' AND ')}
          ORDER BY p.atualizado_em DESC, p.id ASC
          LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, limit, offset],
      );
      const total = Number(count.rows[0]?.total || 0);
      res.json({ items: result.rows, pagination: { limit, offset, total, hasMore: offset + result.rows.length < total } });
    } catch (error) { jsonError(res, error); }
  });
  router.get('/catalog/categories', async (req, res) => {
    try {
      const context = await requirePermission(req, 'catalog.read');
      const result = await db.query(
        `SELECT id, parent_id, slug, nome, descricao, ativo, ordem, criado_em, atualizado_em
           FROM commerce_categories
          WHERE empresa_id = $1
          ORDER BY ordem ASC, nome ASC`,
        [context.empresaId],
      );
      res.json({ items: result.rows });
    } catch (error) { jsonError(res, error); }
  });
  router.post('/catalog/import/preview', async (req, res) => {
    try {
      const context = await requirePermission(req, 'catalog.read');
      await requirePermission(req, 'inventory.read');
      res.json(await previewCatalogImport(context, req.body || {}));
    } catch (error) { jsonError(res, error); }
  });
  router.post('/catalog/avec/preview', async (req, res) => {
    try {
      const context = await requirePermission(req, 'catalog.read');
      await requirePermission(req, 'inventory.read');
      res.set('Cache-Control', 'no-store');
      res.json(await previewAvecCatalog(context, req.body || {}));
    } catch (error) { jsonError(res, error); }
  });
  router.post('/catalog/avec/governance/preview', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const context = await requirePermission(req, 'catalog.read');
      await requirePermission(req, 'inventory.read');
      res.json(await previewAvecGovernance(context, req.body || {}));
    } catch (error) { jsonError(res, error); }
  });
  router.post('/catalog/import/execute', async (req, res) => {
    try {
      const context = await requirePermission(req, 'catalog.write');
      await requirePermission(req, 'catalog.publish');
      await requirePermission(req, 'inventory.write');
      res.json(await executeCatalogImport(context, req.body || {}));
    } catch (error) { jsonError(res, error); }
  });
  router.post('/catalog/categories', async (req, res) => {
    try {
      const context = await requirePermission(req, 'catalog.write');
      const result = await withCommerceTransaction(trx => createCategory(trx, context, req.body));
      res.status(201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.post('/catalog/products', async (req, res) => {
    try {
      const context = await requirePermission(req, 'catalog.write');
      if (req.body?.status === 'active' || req.body?.publicado === true) await requirePermission(req, 'catalog.publish');
      if (['estoque', 'stock', 'targetStock', 'locationId'].some(key => req.body?.[key] !== undefined)) await requirePermission(req, 'inventory.write');
      const storefrontId = await requireAdminStorefront(req, context, { optionalForCorporate: false });
      const result = await withCommerceTransaction(trx => createCatalogProduct(trx, context, { ...req.body, storefrontId }));
      res.status(201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.put('/catalog/products/workspace', async (req, res) => {
    try {
      const context = await requirePermission(req, 'catalog.write');
      await requirePermission(req, 'inventory.write');
      if (req.body?.published === true || req.body?.product?.status === 'active') await requirePermission(req, 'catalog.publish');
      const storefrontId = await requireAdminStorefront(req, context, { optionalForCorporate: false });
      const canPublish = await requirePermission(req, 'catalog.publish').then(() => true, () => false);
      const idempotencyKey = String(req.headers['x-idempotency-key'] || '').trim();
      const body = { ...(req.body || {}) };
      delete body.canPublish;
      const result = await withCommerceTransaction(trx => saveCatalogProductWorkspace(trx, context, { ...body, storefrontId, idempotencyKey, canPublish }));
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.patch('/catalog/categories/:id', async (req, res) => {
    try {
      const context = await requirePermission(req, 'catalog.write');
      const result = await withCommerceTransaction(trx => updateCategory(trx, context, req.params.id, req.body));
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.post('/catalog/products/:id/variants', async (req, res) => {
    try {
      const context = await requirePermission(req, 'catalog.write');
      const storefrontId = await requireAdminStorefront(req, context, { optionalForCorporate: false });
      const result = await withCommerceTransaction(trx => createCatalogVariant(trx, context, req.params.id, { ...req.body, storefrontId }));
      res.status(201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.patch('/catalog/variants/:id', async (req, res) => {
    try {
      const context = await requirePermission(req, 'catalog.write');
      const storefrontId = await requireAdminStorefront(req, context, { optionalForCorporate: false });
      const result = await withCommerceTransaction(trx => updateCatalogVariant(trx, context, req.params.id, { ...req.body, storefrontId }));
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.delete('/catalog/variants/:id', async (req, res) => {
    try {
      const context = await requirePermission(req, 'catalog.write');
      const storefrontId = await requireAdminStorefront(req, context, { optionalForCorporate: false });
      const result = await withCommerceTransaction(trx => archiveCatalogVariant(trx, context, req.params.id, { storefrontId }));
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.get('/catalog/products/:id/media', async (req, res) => {
    try {
      const context = await requirePermission(req, 'catalog.read');
      const storefrontId = await requireAdminStorefront(req, context, { optionalForCorporate: false });
      res.json(await listCatalogMedia(db, context, req.params.id, { storefrontId }));
    } catch (error) { jsonError(res, error); }
  });
  router.get('/catalog/media/:id', async (req, res) => {
    try {
      const context = await requirePermission(req, 'catalog.read');
      const storefrontId = await requireAdminStorefront(req, context, { optionalForCorporate: false });
      const scope = await resolveCatalogResourceScope(db, context, { mediaId: req.params.id, storefrontId, requireChannel: false });
      // Uma vitrine selecionada nunca permite prévia de um produto exclusivo de outra,
      // mesmo para administradores corporativos: não revelar mídia fora do contexto.
      if (!scope.media || !scope.product.authorized_channel) throw new CommerceError('mídia não encontrada nesta vitrine', 'MEDIA_NOT_FOUND');
      await streamCommerceImage({
        storageKey: scope.media.storage_key,
        mimeType: scope.media.mime_type,
        res,
        empresaId: scope.empresaId,
        productId: scope.media.product_id,
        mediaId: scope.media.id,
        privateCache: true,
      });
    } catch (error) {
      if (!res.headersSent) {
        res.setHeader('Cache-Control', 'private, no-store');
        res.removeHeader?.('Content-Type');
        jsonError(res, error);
      }
      else res.destroy(error);
    }
  });
  router.post('/catalog/products/:id/media/upload', express.raw({ type: ['image/*', 'application/octet-stream'], limit: '8mb' }), async (req, res) => {
    let uploaded = null;
    let uploadScope = null;
    let idempotencyKey = '';
    try {
      const context = await requirePermission(req, 'catalog.write');
      const productId = assertUuid(req.params.id, 'productId');
      const storefrontId = await requireAdminStorefront(req, context, { optionalForCorporate: false });
      const product = await db.query(
        `SELECT p.id, p.status FROM commerce_products p
          JOIN commerce_product_channels pc ON pc.empresa_id = p.empresa_id AND pc.product_id = p.id AND pc.storefront_id = $3
          JOIN commerce_storefronts s ON s.empresa_id = pc.empresa_id AND s.id = pc.storefront_id
         WHERE p.empresa_id = $1 AND p.id = $2
           AND ($4::uuid IS NULL OR s.loja_id = $4)
         LIMIT 1`,
        [context.empresaId, productId, storefrontId, context.corporateAccess ? null : context.lojaId],
      );
      if (!product.rows[0]) throw new CommerceError('produto não encontrado no tenant', 'PRODUCT_NOT_FOUND');
      if (product.rows[0].status === 'archived') throw new CommerceError('produto arquivado não pode ser alterado; duplique-o como rascunho', 'PRODUCT_ARCHIVED');
      const variantId = req.headers['x-variant-id'] ? assertUuid(req.headers['x-variant-id'], 'variantId') : null;
      if (variantId) {
        const variant = await db.query('SELECT id FROM commerce_product_variants WHERE empresa_id = $1 AND id = $2 AND product_id = $3 LIMIT 1', [context.empresaId, variantId, productId]);
        if (!variant.rows[0]) throw new CommerceError('variante não pertence ao produto', 'VARIANT_NOT_FOUND');
      }
      idempotencyKey = String(req.headers['x-idempotency-key'] || '').trim();
      const mediaId = idempotencyKey
        ? commerceMediaIdForIdempotencyKey({ empresaId: context.empresaId, productId, idempotencyKey })
        : newCommerceMediaId();
      const result = await withCommerceTransaction(async trx => {
        if (idempotencyKey) {
          await trx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`catalog-media:${context.empresaId}:${productId}:${mediaId}`]);
          const existing = await trx.query(
            'SELECT id, product_id, variant_id, storage_key, public_url, mime_type, alt_text, ordem, criado_em FROM commerce_product_media WHERE empresa_id = $1 AND product_id = $2 AND id = $3 LIMIT 1',
            [context.empresaId, productId, mediaId],
          );
          if (existing.rows[0]) return { ...existing.rows[0], idempotentReplay: true };
        }
        uploaded = await uploadCommerceImage({ empresaId: context.empresaId, productId, mediaId, buffer: Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0), mimeType: req.headers['content-type'] });
        uploadScope = { empresaId: context.empresaId, productId, mediaId, storageKey: uploaded.storageKey };
        return createCatalogMedia(trx, context, productId, {
          storefrontId,
          mediaId,
          storageKey: uploaded.storageKey,
          publicUrl: `/api/storefront/media/${mediaId}`,
          mimeType: uploaded.mimeType,
          altText: String(req.headers['x-image-alt'] || '').slice(0, 255),
          ordem: Number.isInteger(Number(req.headers['x-image-order'])) ? Number(req.headers['x-image-order']) : 0,
          variantId,
        });
      });
      res.status(result.idempotentReplay ? 200 : 201).json(result);
    } catch (error) {
      if (uploaded && uploadScope) {
        await withCommerceTransaction(async trx => {
          if (idempotencyKey) await trx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`catalog-media:${uploadScope.empresaId}:${uploadScope.productId}:${uploadScope.mediaId}`]);
          const referenced = await trx.query('SELECT 1 FROM commerce_product_media WHERE empresa_id = $1 AND product_id = $2 AND id = $3 AND storage_key = $4 LIMIT 1', [uploadScope.empresaId, uploadScope.productId, uploadScope.mediaId, uploadScope.storageKey]);
          if (!referenced.rows[0]) await deleteCommerceImage(uploadScope);
        }).catch(() => {});
      }
      jsonError(res, error);
    }
  });
  router.post('/catalog/products/:id/media', async (req, res) => {
    try {
      const context = await requirePermission(req, 'catalog.write');
      const storefrontId = await requireAdminStorefront(req, context, { optionalForCorporate: false });
      // Mídia por URL: só endereços permitidos; chave de armazenamento e id nunca vêm do cliente.
      const body = req.body || {};
      const url = String(body.url || body.publicUrl || '').trim();
      if (!allowedMediaUrl(url)) throw new CommerceError('use uma imagem enviada pelo painel ou um endereço https autorizado', 'MEDIA_URL_NOT_ALLOWED');
      const result = await withCommerceTransaction(trx => createCatalogMedia(trx, context, req.params.id, { url, variantId: body.variantId, altText: body.altText, ordem: body.ordem, mimeType: body.mimeType, storefrontId }));
      res.status(201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.delete('/catalog/media/:id', async (req, res) => {
    try {
      const context = await requirePermission(req, 'catalog.write');
      const storefrontId = await requireAdminStorefront(req, context, { optionalForCorporate: false });
      const result = await withCommerceTransaction(trx => deleteCatalogMedia(trx, context, req.params.id, { storefrontId }));
      await deleteCommerceImage({ empresaId: context.empresaId, productId: result.product_id, mediaId: result.id, storageKey: result.storage_key });
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.post('/catalog/products/:id/publish', async (req, res) => {
    try {
      const context = await requirePermission(req, 'catalog.publish');
      await requirePermission(req, 'catalog.write');
      const storefrontId = await requireAdminStorefront(req, context, { optionalForCorporate: false });
      const result = await withCommerceTransaction(trx => publishCatalogProduct(trx, context, req.params.id, { ...req.body, storefrontId }));
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.patch('/catalog/products/:id/price', async (req, res) => {
    try {
      const context = await requirePermission(req, 'catalog.write');
      const storefrontId = await requireAdminStorefront(req, context, { optionalForCorporate: false });
      const result = await withCommerceTransaction(trx => setVariantPrice(trx, context, req.params.id, { ...req.body, storefrontId }));
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.patch('/catalog/products/:id', async (req, res) => {
    try {
      const context = await requirePermission(req, 'catalog.write');
      if (req.body?.status === 'active') await requirePermission(req, 'catalog.publish');
      const storefrontId = await requireAdminStorefront(req, context, { optionalForCorporate: false });
      const result = await withCommerceTransaction(trx => updateCatalogProduct(trx, context, req.params.id, { ...req.body, storefrontId }));
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.delete('/catalog/products/:id', async (req, res) => {
    try {
      const context = await requirePermission(req, 'catalog.write');
      await requirePermission(req, 'catalog.publish');
      const storefrontId = await requireAdminStorefront(req, context, { optionalForCorporate: false });
      const result = await withCommerceTransaction(trx => archiveCatalogProduct(trx, context, req.params.id, { storefrontId }));
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.get('/promotions/templates', async (req, res) => {
    try {
      const context = await requirePermission(req, 'promotions.read');
      res.json(await listPromotionTemplates(db, context));
    } catch (error) { jsonError(res, error); }
  });
  router.post('/promotions/templates', async (req, res) => {
    try {
      const context = await requirePermission(req, 'promotions.write');
      const result = await withCommerceTransaction(trx => createPromotionTemplate(trx, context, req.body));
      res.status(201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.get('/promotions', async (req, res) => {
    try {
      const context = await requirePermission(req, 'promotions.read');
      res.json(await listPromotions(db, context));
    } catch (error) { jsonError(res, error); }
  });
  router.post('/promotions', async (req, res) => {
    try {
      const context = await requirePermission(req, 'promotions.write');
      const result = await withCommerceTransaction(trx => createPromotion(trx, context, req.body));
      res.status(201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.patch('/promotions/:id', async (req, res) => {
    try {
      const context = await requirePermission(req, 'promotions.write');
      const result = await withCommerceTransaction(trx => updatePromotion(trx, context, req.params.id, req.body || {}));
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.post('/promotions/codes', async (req, res) => {
    try {
      const context = await requirePermission(req, 'promotions.write');
      const result = await withCommerceTransaction(trx => createPromotionCode(trx, context, req.body));
      res.status(201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.patch('/promotions/codes/:id', async (req, res) => {
    try {
      const context = await requirePermission(req, 'promotions.write');
      const result = await withCommerceTransaction(trx => updatePromotionCode(trx, context, req.params.id, req.body || {}));
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.post('/orders/:id/promotion', async (req, res) => {
    try {
      const context = await requirePermission(req, 'promotions.write');
      const storefrontId = await requireAdminStorefront(req, context);
      const result = await withCommerceTransaction(trx => applyPromotionToOrder(trx, context, { ...req.body, orderId: req.params.id, storefrontId }));
      res.status(201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.post('/shipping/methods', async (req, res) => {
    try {
      const context = await requirePermission(req, 'fulfillment.write');
      const result = await withCommerceTransaction(async trx => {
        const method = await createShippingMethod(trx, context, req.body);
        await auditLog(trx, context, { entidade: 'shipping_method', entidadeId: method.id, acao: 'created', depois: { storefrontId: method.storefront_id, nome: method.nome, tipo: method.tipo, ativo: method.ativo, configuracao: method.configuracao } });
        return method;
      });
      res.status(201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.patch('/shipping/methods/:id', async (req, res) => {
    try {
      const context = await requirePermission(req, 'fulfillment.write');
      const result = await withCommerceTransaction(async trx => {
        const method = await updateShippingMethod(trx, context, req.params.id, req.body);
        await auditLog(trx, context, { entidade: 'shipping_method', entidadeId: method.id, acao: 'updated', depois: { nome: method.nome, tipo: method.tipo, ativo: method.ativo, configuracao: method.configuracao } });
        return method;
      });
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.get('/shipping/methods', async (req, res) => {
    try {
      const context = await requirePermission(req, 'fulfillment.read');
      const values = [context.empresaId];
      const predicates = ['sm.empresa_id = $1'];
      if (context.lojaId) { values.push(context.lojaId); predicates.push(`s.loja_id = $${values.length}`); }
      const result = await db.query(
        `SELECT sm.id, sm.storefront_id, sm.codigo, sm.nome, sm.tipo, sm.ativo, sm.configuracao
           FROM commerce_shipping_methods sm
           JOIN commerce_storefronts s ON s.empresa_id = sm.empresa_id AND s.id = sm.storefront_id
          WHERE ${predicates.join(' AND ')}
          ORDER BY sm.nome ASC`,
        values,
      );
      res.json({ items: result.rows });
    } catch (error) { jsonError(res, error); }
  });
  router.get('/shipping/providers', async (req, res) => {
    try { await requirePermission(req, 'fulfillment.read'); res.json(listShippingProviders()); } catch (error) { jsonError(res, error); }
  });
  router.get('/shipping/accounts', async (req, res) => {
    try { const context = await requirePermission(req, 'fulfillment.read'); res.json(await listShippingAccounts(db, context)); } catch (error) { jsonError(res, error); }
  });
  router.post('/shipping/accounts', async (req, res) => {
    try {
      const context = await requirePermission(req, 'fulfillment.write');
      const result = await withCommerceTransaction(async trx => {
        const account = await createShippingAccount(trx, context, req.body);
        await auditLog(trx, context, { entidade: 'shipping_account', entidadeId: account.id, acao: 'created', depois: account });
        return account;
      });
      res.status(201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.patch('/shipping/accounts/:id', async (req, res) => {
    try {
      const context = await requirePermission(req, 'fulfillment.write');
      const result = await withCommerceTransaction(async trx => {
        const account = await updateShippingAccount(trx, context, req.params.id, req.body);
        await auditLog(trx, context, { entidade: 'shipping_account', entidadeId: account.id, acao: 'updated', depois: account });
        return account;
      });
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.post('/fulfillments/:id/label', async (req, res) => {
    try {
      const context = await requirePermission(req, 'fulfillment.write');
      const storefrontId = await requireAdminStorefront(req, context, { optionalForCorporate: false });
      const result = await issueShippingLabel(withCommerceTransaction, context, req.params.id, req.body || {}, storefrontId);
      if (result.replay) return res.json(result.fulfillment);
      res.status(201).json(result.fulfillment);
    } catch (error) { jsonError(res, error); }
  });
  router.post('/fulfillments/:id/reconcile-label', async (req, res) => {
    try {
      const context = await requirePermission(req, 'fulfillment.write');
      const storefrontId = await requireAdminStorefront(req, context, { optionalForCorporate: false });
      const result = await withCommerceTransaction(async trx => {
        const reconciled = await reconcileShippingLabel(trx, context, req.params.id, req.body || {}, storefrontId);
        if (!reconciled.replay) {
          await auditLog(trx, context, {
            entidade: 'fulfillment',
            entidadeId: req.params.id,
            acao: 'provider_label_reconciled',
            depois: { operationKey: req.body?.operationKey || req.body?.operation_key || '', providerShipmentIdPresent: Boolean(req.body?.providerShipmentId || req.body?.provider_shipment_id) },
          });
        }
        return reconciled;
      });
      res.status(result.replay ? 200 : 201).json(result.fulfillment);
    } catch (error) { jsonError(res, error); }
  });
  router.post('/fulfillments/:id/cancel-label', async (req, res) => {
    try {
      const context = await requirePermission(req, 'fulfillment.write');
      const storefrontId = await requireAdminStorefront(req, context, { optionalForCorporate: false });
      const prepared = await withCommerceTransaction(trx => prepareShippingCancellation(trx, context, req.params.id, storefrontId));
      if (prepared.replay) return res.json(prepared.fulfillment);
      const adapter = shippingProviders.get(prepared.account.provider);
      if (!adapter?.cancelShipment) throw new CommerceError('adapter Correios não oferece cancelamento documentado', 'SHIPPING_PROVIDER_CAPABILITY_UNAVAILABLE');
      let external;
      try {
        external = await adapter.cancelShipment({ account: prepared.account, providerShipmentId: prepared.providerShipmentId, trackingCode: prepared.trackingCode, idempotencyKey: prepared.operationKey });
      } catch (error) {
        await withCommerceTransaction(trx => failShippingLabel(trx, context, req.params.id, prepared.operationKey, error, storefrontId));
        throw error;
      }
      const cancelled = await withCommerceTransaction(async trx => {
        const row = await finalizeShippingCancellation(trx, context, req.params.id, prepared.operationKey, external, storefrontId);
        await auditLog(trx, context, { entidade: 'fulfillment', entidadeId: req.params.id, acao: 'provider_prepostagem_cancelled', depois: { storefrontId, provider: prepared.account.provider, providerStatus: external.providerStatus } });
        return row;
      });
      res.json(cancelled);
    } catch (error) { jsonError(res, error); }
  });
  router.post('/fulfillments/:id/track', async (req, res) => {
    try {
      const context = await requirePermission(req, 'fulfillment.write');
      const storefrontId = await requireAdminStorefront(req, context, { optionalForCorporate: false });
      const owner = await db.query(`SELECT f.id, f.provider_shipment_id, a.provider, a.ambiente, a.secret_ref, a.public_config, (SELECT s.codigo FROM commerce_orders o JOIN commerce_storefronts s ON s.empresa_id = o.empresa_id AND s.id = o.storefront_id WHERE o.empresa_id = f.empresa_id AND o.id = f.order_id LIMIT 1) AS storefront_code FROM commerce_fulfillments f LEFT JOIN commerce_shipping_accounts a ON a.empresa_id = f.empresa_id AND a.id = COALESCE(f.shipping_account_id, (SELECT q.shipping_account_id FROM commerce_shipping_quotes q WHERE q.empresa_id = f.empresa_id AND q.id = f.shipping_quote_id)) WHERE f.empresa_id = $1 AND f.id = $2 AND EXISTS (SELECT 1 FROM commerce_orders o WHERE o.empresa_id = f.empresa_id AND o.id = f.order_id AND ($3::uuid IS NULL OR o.storefront_id = $3) AND ($4::uuid IS NULL OR o.loja_id = $4)) LIMIT 1`, [context.empresaId, req.params.id, storefrontId, context.corporateAccess === true ? null : context.lojaId]);
      if (!owner.rows[0]) throw new CommerceError('fulfillment não encontrado', 'FULFILLMENT_NOT_FOUND');
      if (owner.rows[0].storefront_code === 'dino-web') throw new CommerceError('tracking de transportadora Dino depende de operação logística habilitada', 'SHIPPING_NATIONAL_FULFILLMENT_NOT_READY');
      if (!owner.rows[0].provider_shipment_id || !owner.rows[0].provider) throw new CommerceError('fulfillment ainda não possui shipment no provedor', 'SHIPPING_SHIPMENT_NOT_FOUND');
      const adapter = shippingProviders.get(owner.rows[0].provider);
      if (!adapter) throw new CommerceError('adapter logístico indisponível', 'SHIPPING_PROVIDER_NOT_CONFIGURED');
      const external = await adapter.track({ account: { provider: owner.rows[0].provider, ambiente: owner.rows[0].ambiente, secret_ref: owner.rows[0].secret_ref, public_config: owner.rows[0].public_config }, providerShipmentId: owner.rows[0].provider_shipment_id });
      const updated = await withCommerceTransaction(async trx => {
        const row = await updateShippingTracking(trx, context, owner.rows[0].id, external, storefrontId);
        await auditLog(trx, context, { entidade: 'fulfillment', entidadeId: owner.rows[0].id, acao: 'provider_tracking_sync', depois: { storefrontId, provider: owner.rows[0].provider, providerStatus: external.providerStatus, trackingCode: external.trackingCode } });
        return row;
      });
      res.json(updated);
    } catch (error) { jsonError(res, error); }
  });
  router.post('/fulfillments', async (req, res) => {
    try {
      const context = await requirePermission(req, 'fulfillment.write');
      const storefrontId = await requireAdminStorefront(req, context);
      const result = await withCommerceTransaction(async trx => {
        const created = await createFulfillment(trx, context, { ...req.body, storefrontId });
        await auditLog(trx, context, { entidade: 'fulfillment', entidadeId: created.id, acao: 'created', depois: { orderId: created.order_id, storefrontId, status: created.status } });
        return created;
      });
      res.status(201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.get('/fulfillments', async (req, res) => {
    try {
      const context = await requirePermission(req, 'fulfillment.read');
      const storefrontId = await requireAdminStorefront(req, context);
      const values = [context.empresaId];
      const predicates = ['f.empresa_id = $1'];
      if (context.lojaId) { values.push(context.lojaId); predicates.push(`s.loja_id = $${values.length}`); }
      if (storefrontId) { values.push(storefrontId); predicates.push(`o.storefront_id = $${values.length}`); }
      if (req.query.status) { values.push(String(req.query.status)); predicates.push(`f.status = $${values.length}`); }
      const result = await db.query(
        `SELECT f.id, f.order_id, f.status, f.tracking_code, f.carrier, f.ocorrencias, f.criado_em, f.atualizado_em,
                o.public_code, o.total, s.nome AS storefront_name, f.shipping_quote_id, f.shipping_account_id, a.provider, f.provider_shipment_id, f.tracking_url, f.label_url, f.shipping_operation_status,
                CASE WHEN a.provider = 'correios' AND a.public_config->>'prepostagemApiEnabled' = 'true' AND a.public_config->>'modalidadePagamento' IN ('1', '2', '3', '4') THEN true ELSE false END AS correios_label_ready
           FROM commerce_fulfillments f
           JOIN commerce_orders o ON o.empresa_id = f.empresa_id AND o.id = f.order_id
           JOIN commerce_storefronts s ON s.empresa_id = o.empresa_id AND s.id = o.storefront_id
           LEFT JOIN commerce_shipping_quotes q ON q.empresa_id = f.empresa_id AND q.id = f.shipping_quote_id
           LEFT JOIN commerce_shipping_accounts a ON a.empresa_id = f.empresa_id AND a.id = COALESCE(f.shipping_account_id, q.shipping_account_id)
          WHERE ${predicates.join(' AND ')}
          ORDER BY f.atualizado_em DESC
          LIMIT 500`,
        values,
      );
      res.json({ items: result.rows });
    } catch (error) { jsonError(res, error); }
  });
  router.patch('/fulfillments/:id', async (req, res) => {
    try {
      const context = await requirePermission(req, 'fulfillment.write');
      const storefrontId = await requireAdminStorefront(req, context);
      const result = await withCommerceTransaction(trx => updateFulfillment(trx, context, req.params.id, { ...req.body, storefrontId }));
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.post('/inventory/locations', async (req, res) => {
    try {
      const context = await requirePermission(req, 'inventory.write');
      const result = await withCommerceTransaction(trx => createInventoryLocation(trx, context, req.body));
      res.status(201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.get('/inventory/locations', async (req, res) => {
    try {
      const context = await requirePermission(req, 'inventory.read');
      const result = await db.query(
        `SELECT id, loja_id, codigo, nome, tipo, ativo, criado_em
           FROM commerce_inventory_locations
          WHERE empresa_id = $1 AND ($2::uuid IS NULL OR loja_id = $2 OR loja_id IS NULL)
          ORDER BY nome ASC`,
        [context.empresaId, context.lojaId],
      );
      res.json({ items: result.rows });
    } catch (error) { jsonError(res, error); }
  });
  router.get('/inventory/levels', async (req, res) => {
    try {
      const context = await requirePermission(req, 'inventory.read');
      const values = [context.empresaId];
      const predicates = ['l.empresa_id = $1'];
      if (context.lojaId) { values.push(context.lojaId); predicates.push(`(l.loja_id = $${values.length} OR l.loja_id IS NULL)`); }
      const result = await db.query(
        `SELECT il.id, il.location_id, il.variant_id, il.disponivel, il.reservado, il.comprometido, il.minimo,
                l.codigo AS location_code, l.nome AS location_name, v.sku, COALESCE(v.nome, p.nome) AS product_name
           FROM commerce_inventory_levels il
           JOIN commerce_inventory_locations l ON l.empresa_id = il.empresa_id AND l.id = il.location_id
           JOIN commerce_product_variants v ON v.empresa_id = il.empresa_id AND v.id = il.variant_id
           JOIN commerce_products p ON p.empresa_id = v.empresa_id AND p.id = v.product_id
          WHERE ${predicates.join(' AND ')}
          ORDER BY p.nome ASC, v.sku ASC
          LIMIT 500`,
        values,
      );
      res.json({ items: result.rows });
    } catch (error) { jsonError(res, error); }
  });
  router.post('/inventory/adjust', async (req, res) => {
    try {
      const context = await requirePermission(req, 'inventory.write');
      const result = await withCommerceTransaction(trx => adjustInventory(trx, context, req.body));
      res.status(201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.get('/customers', async (req, res) => {
    try {
      const context = await requirePermission(req, 'customers.read');
      const { limit, offset } = parsePagination(req, 100, 500);
      const values = [context.empresaId];
      const predicates = ['empresa_id = $1'];
      const query = String(req.query.q || '').trim().slice(0, 160);
      if (query) { values.push(`%${query}%`); predicates.push(`(nome ILIKE $${values.length} OR email ILIKE $${values.length})`); }
      const where = predicates.join(' AND ');
      const count = await db.query(`SELECT COUNT(*)::int AS total FROM commerce_customers WHERE ${where}`, values);
      const result = await db.query(
        `SELECT id, nome, email, telefone, documento_mascarado, bloqueado, criado_em, atualizado_em
           FROM commerce_customers
          WHERE ${where}
          ORDER BY atualizado_em DESC
          LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, limit, offset],
      );
      const total = Number(count.rows[0]?.total || 0);
      res.json({ items: result.rows, pagination: { limit, offset, total, hasMore: offset + result.rows.length < total } });
    } catch (error) { jsonError(res, error); }
  });
  router.post('/customers', async (req, res) => {
    try {
      const context = await requirePermission(req, 'customers.write');
      const result = await withCommerceTransaction(trx => createCustomer(trx, context, req.body));
      res.status(201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.patch('/customers/:id', async (req, res) => {
    try {
      const context = await requirePermission(req, 'customers.write');
      const result = await withCommerceTransaction(trx => updateCustomer(trx, context, req.params.id, req.body));
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.get('/customers/:id', async (req, res) => {
    try {
      const context = await requirePermission(req, 'customers.read');
      res.json(await getCustomer(db, context, req.params.id));
    } catch (error) { jsonError(res, error); }
  });
  router.get('/customers/:id/addresses', async (req, res) => {
    try {
      const context = await requirePermission(req, 'customers.read');
      res.json(await listCustomerAddresses(db, context, req.params.id));
    } catch (error) { jsonError(res, error); }
  });
  router.post('/customers/:id/addresses', async (req, res) => {
    try {
      const context = await requirePermission(req, 'customers.write');
      const result = await withCommerceTransaction(trx => createCustomerAddress(trx, context, req.params.id, req.body));
      res.status(201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.patch('/customers/:id/addresses/:addressId', async (req, res) => {
    try {
      const context = await requirePermission(req, 'customers.write');
      const result = await withCommerceTransaction(trx => updateCustomerAddress(trx, context, req.params.id, req.params.addressId, req.body));
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.delete('/customers/:id/addresses/:addressId', async (req, res) => {
    try {
      const context = await requirePermission(req, 'customers.write');
      const result = await withCommerceTransaction(trx => deleteCustomerAddress(trx, context, req.params.id, req.params.addressId));
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.get('/credit/accounts', async (req, res) => {
    try {
      const context = await requirePermission(req, 'customers.read');
      res.json(await listCreditAccounts(db, context, { storefrontId: req.query.storefrontId || null }));
    } catch (error) { jsonError(res, error); }
  });
  router.post('/credit/accounts', async (req, res) => {
    try {
      const context = await requirePermission(req, 'customers.write');
      const result = await withCommerceTransaction(trx => createCreditAccount(trx, context, req.body));
      res.status(201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.patch('/credit/accounts/:id', async (req, res) => {
    try {
      const context = await requirePermission(req, 'customers.write');
      const result = await withCommerceTransaction(trx => updateCreditAccount(trx, context, req.params.id, req.body));
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.get('/credit/accounts/:id/entries', async (req, res) => {
    try {
      const context = await requirePermission(req, 'customers.read');
      res.json(await listCreditEntries(db, context, req.params.id));
    } catch (error) { jsonError(res, error); }
  });
  router.get('/payments/providers', async (req, res) => {
    try {
      await requirePermission(req, 'payments.read');
      res.json(listPaymentProviders());
    } catch (error) { jsonError(res, error); }
  });
  router.get('/payments/accounts', async (req, res) => {
    try {
      const context = await requirePermission(req, 'payments.read');
      const storefrontId = await requireAdminStorefront(req, context);
      res.json(await listPaymentAccounts(db, context, { storefrontId }));
    } catch (error) { jsonError(res, error); }
  });
  router.post('/payments/accounts', async (req, res) => {
    try {
      const context = await requirePermission(req, 'payments.write');
      const storefrontId = await requireAdminStorefront(req, context);
      const result = await withCommerceTransaction(async trx => {
        const account = await createPaymentAccount(trx, context, { ...req.body, storefrontId });
        await auditLog(trx, context, { entidade: 'payment_account', entidadeId: account.id, acao: 'created', depois: account });
        return account;
      });
      res.status(201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.patch('/payments/accounts/:id', async (req, res) => {
    try {
      const context = await requirePermission(req, 'payments.write');
      const storefrontId = await requireAdminStorefront(req, context);
      const result = await withCommerceTransaction(async trx => {
        const account = await updatePaymentAccount(trx, { ...context, storefrontId }, req.params.id, req.body);
        await auditLog(trx, context, { entidade: 'payment_account', entidadeId: account.id, acao: 'updated', depois: account });
        return account;
      });
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.get('/payments', async (req, res) => {
    try {
      const context = await requirePermission(req, 'payments.read');
      const storefrontId = await requireAdminStorefront(req, context);
      res.json(await listPayments(db, context, { ...req.query, storefrontId }));
    } catch (error) { jsonError(res, error); }
  });
  router.post('/orders/:id/payments', async (req, res) => {
    try {
      const context = await requirePermission(req, 'payments.write');
      const storefrontId = await requireAdminStorefront(req, context);
      const result = await createPaymentAttempt({ ...context, storefrontId }, { ...req.body, orderId: req.params.id });
      res.status(201).json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.post('/payments/:id/sync', async (req, res) => {
    try {
      const context = await requirePermission(req, 'payments.write');
      const storefrontId = await requireAdminStorefront(req, context);
      const result = await syncPaymentAttempt({ ...context, storefrontId }, req.params.id);
      await withCommerceTransaction(trx => auditLog(trx, context, { entidade: 'payment', entidadeId: result.paymentId, acao: 'status_reconciled', correlationId: req.requestId || '', depois: { orderId: result.orderId, provider: result.provider, status: result.status, changed: result.changed, stale: Boolean(result.stale) } }));
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.post('/payments/:id/reconcile', async (req, res) => {
    try {
      const context = await requirePermission(req, 'payments.write');
      const storefrontId = await requireAdminStorefront(req, context);
      const result = await reconcilePaymentByIdentifiers({ ...context, storefrontId }, req.params.id, req.body || {});
      await withCommerceTransaction(trx => auditLog(trx, context, { entidade: 'payment', entidadeId: result.paymentId, acao: 'manual_reconciled', correlationId: req.requestId || '', depois: { orderId: result.orderId, provider: result.provider, status: result.status, changed: result.changed, stale: Boolean(result.stale) } }));
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.get('/whatsapp-ai/status', async (req, res) => {
    try {
      const context = await withWhatsappLoja(await requirePermission(req, 'reports.read'));
      const tipoCanal = whatsappTipoCanal(req);
      res.json(await whatsappAiOperationalStatus({ ...context, tipoCanal }, { tipoCanal }));
    } catch (error) { jsonError(res, error); }
  });
  router.get('/whatsapp-ai/sessions', async (req, res) => {
    try {
      const tipoCanal = whatsappTipoCanal(req);
      const hasQueueFilter = req.query.status != null || req.query.assignment != null;
      const requestedLojaId = hasQueueFilter
        ? await normalizeWhatsappQueueStoreSelector(req)
        : String(req.headers['x-loja-id'] || '').trim();
      if (hasQueueFilter && !requestedLojaId) {
        const error = new Error('selecione uma unidade autorizada para abrir a fila humana');
        error.code = 'STORE_SELECTION_REQUIRED';
        throw error;
      }
      const context = hasQueueFilter
        ? await requirePermission(req, 'reports.read')
        : await withWhatsappLoja(await requirePermission(req, 'reports.read'));
      if (hasQueueFilter && (String(context.empresaId).toLowerCase() !== String(req.headers['x-empresa-id'] || '').toLowerCase() || (context.lojaId && String(context.lojaId).toLowerCase() !== String(req.headers['x-loja-id'] || '').toLowerCase()))) {
        throw new CommerceError('unidade fora do escopo selecionado', 'STORE_SCOPE_MISMATCH');
      }
      if (!hasQueueFilter) {
        return res.json({ items: await listWhatsappAiSessions({ ...context, tipoCanal }, { limit: req.query.limit, tipoCanal }) });
      }
      let canClaim = false;
      const ehOperador = req.user?.role === 'operador' || req.user?.perfil === 'operador';
      if (ehOperador) {
        canClaim = true;
      } else {
        try {
          await requirePermission(req, 'settings.write');
          canClaim = true;
        } catch (error) {
          if (error?.code !== 'PERMISSION_DENIED') throw error;
        }
      }
      const items = await listWhatsappAiSessions({ ...context, tipoCanal }, { limit: req.query.limit, status: req.query.status, assignment: req.query.assignment, tipoCanal });
      res.json({
        items,
        canClaim,
        selection: {
          requestedLojaId: requestedLojaId || context.lojaId || req.headers['x-loja-id'] || null,
          canonicalLojaId: context.lojaId || req.headers['x-loja-id'] || null,
          empresaId: context.empresaId || null,
          inferred: context.lojaInferida === true,
        },
      });
    } catch (error) { jsonError(res, error); }
  });
  router.post('/whatsapp-ai/channel', async (req, res) => {
    try {
      const context = await withWhatsappLoja(await requirePermission(req, 'settings.write'));
      const tipoCanal = whatsappTipoCanal(req);
      res.json(await configureWhatsappAiChannel({ ...context, tipoCanal }, { ...(req.body || {}), tipoCanal }));
    } catch (error) { jsonError(res, error); }
  });
  router.patch('/whatsapp-ai/policy', async (req, res) => {
    try {
      const context = await withWhatsappLoja(await requirePermission(req, 'settings.write'));
      const tipoCanal = whatsappTipoCanal(req);
      res.json(await configureWhatsappAiPolicy({ ...context, tipoCanal }, req.body || {}));
    } catch (error) { jsonError(res, error); }
  });
  router.patch('/whatsapp-ai/persona', async (req, res) => {
    try {
      const context = await withWhatsappLoja(await requirePermission(req, 'settings.write'));
      const tipoCanal = whatsappTipoCanal(req);
      res.json(await configureWhatsappAiPersona({ ...context, tipoCanal }, req.body || {}));
    } catch (error) { jsonError(res, error); }
  });
  router.patch('/whatsapp-ai/handoff', async (req, res) => {
    try {
      const context = await withWhatsappLoja(await requirePermission(req, 'settings.write'));
      const tipoCanal = whatsappTipoCanal(req);
      res.json(await configureWhatsappAiHandoff({ ...context, tipoCanal }, req.body || {}));
    } catch (error) { jsonError(res, error); }
  });
  router.post('/whatsapp-ai/diagnostics/gemini', async (req, res) => {
    try {
      const context = await withWhatsappLoja(await requirePermission(req, 'settings.write'));
      const tipoCanal = whatsappTipoCanal(req);
      res.json(await testWhatsappAiGemini({ ...context, tipoCanal }, { confirmed: req.body?.confirmed === true }));
    } catch (error) { jsonError(res, error); }
  });
  // Validação do T-Rex em produção: só ferramentas de leitura (agenda e catálogo).
  router.post('/whatsapp-ai/diagnostics/agenda-venda', async (req, res) => {
    try {
      const context = await withWhatsappLoja(await requirePermission(req, 'settings.write'));
      res.json(await diagnosticoAgendaVendaWhatsappAi(context));
    } catch (error) { jsonError(res, error); }
  });
  router.post('/whatsapp-ai/channel/sync-webhook', async (req, res) => {
    try {
      const context = await withWhatsappLoja(await requirePermission(req, 'settings.write'));
      const tipoCanal = whatsappTipoCanal(req);
      res.json(await syncWhatsappAiWebhook({ ...context, tipoCanal }, { confirmed: req.body?.confirmed === true }));
    } catch (error) { jsonError(res, error); }
  });
  router.post('/whatsapp-ai/sessions/:id/claim', async (req, res) => {
    try {
      const isOp = req.user?.role === 'operador' || req.user?.perfil === 'operador';
      const context = await withWhatsappLoja(await requirePermission(req, isOp ? 'customers.write' : 'settings.write'));
      const tipoCanal = whatsappTipoCanal(req);
      res.json(await claimWhatsappAiHandoff({ ...context, tipoCanal }, req.params.id));
    } catch (error) { jsonError(res, error); }
  });
  router.post('/whatsapp-ai/sessions/:id/release', async (req, res) => {
    try {
      const isOp = req.user?.role === 'operador' || req.user?.perfil === 'operador';
      const context = await withWhatsappLoja(await requirePermission(req, isOp ? 'customers.write' : 'settings.write'));
      const tipoCanal = whatsappTipoCanal(req);
      res.json(await releaseWhatsappAiHandoff({ ...context, tipoCanal }, req.params.id, { retomar: req.body?.retomar !== false }));
    } catch (error) { jsonError(res, error); }
  });
  // Painel da conversa: histórico completo (cliente, T-Rex e equipe) e resposta do atendente.
  router.get('/whatsapp-ai/sessions/:id/messages', async (req, res) => {
    try {
      const isOp = req.user?.role === 'operador' || req.user?.perfil === 'operador';
      const context = await withWhatsappLoja(await requirePermission(req, isOp ? 'customers.read' : 'reports.read'));
      const tipoCanal = whatsappTipoCanal(req);
      res.set('Cache-Control', 'no-store');
      res.json(await getWhatsappAiConversation({ ...context, tipoCanal }, req.params.id, { limit: req.query.limit }));
    } catch (error) { jsonError(res, error); }
  });
  router.post('/whatsapp-ai/sessions/:id/messages', async (req, res) => {
    try {
      const isOp = req.user?.role === 'operador' || req.user?.perfil === 'operador';
      const context = await withWhatsappLoja(await requirePermission(req, isOp ? 'customers.write' : 'settings.write'));
      const tipoCanal = whatsappTipoCanal(req);
      res.json(await sendWhatsappAiStaffMessage({ ...context, tipoCanal, usuarioNome: req.user?.nome || '' }, req.params.id, req.body || {}));
    } catch (error) { jsonError(res, error); }
  });
  router.post('/whatsapp-ai/sessions/:id/close', async (req, res) => {
    try {
      const isOp = req.user?.role === 'operador' || req.user?.perfil === 'operador';
      const context = await withWhatsappLoja(await requirePermission(req, isOp ? 'customers.write' : 'settings.write'));
      const tipoCanal = whatsappTipoCanal(req);
      res.json(await closeWhatsappAiHandoff({ ...context, tipoCanal }, req.params.id));
    } catch (error) { jsonError(res, error); }
  });
  router.get('/cart-recovery', async (req, res) => {
    try {
      const context = await requirePermission(req, 'reports.read');
      res.json(await listAbandonedCarts(context, parsePagination(req, 50, 100)));
    } catch (error) { jsonError(res, error); }
  });
  router.get('/cart-recovery/metrics', async (req, res) => {
    try {
      const context = await requirePermission(req, 'reports.read');
      res.json(await cartRecoveryMetrics(context));
    } catch (error) { jsonError(res, error); }
  });
  router.get('/campaigns', async (req, res) => {
    try {
      const context = await requirePermission(req, 'reports.read');
      res.json(await listCampaigns(context, parsePagination(req, 50, 100)));
    } catch (error) { jsonError(res, error); }
  });
  router.post('/campaigns', async (req, res) => {
    try {
      const context = await requirePermission(req, 'settings.write');
      res.status(201).json(await createCampaign(context, req.body || {}));
    } catch (error) { jsonError(res, error); }
  });
  router.get('/campaigns/audience', async (req, res) => {
    try {
      const context = await requirePermission(req, 'customers.read');
      res.json(await listCampaignAudience(context, { search: req.query.search, ...parsePagination(req, 100, 200) }));
    } catch (error) { jsonError(res, error); }
  });
  router.patch('/campaigns/audience/:customerId/consent', async (req, res) => {
    try {
      const context = await requirePermission(req, 'settings.write');
      res.json(await updateCampaignConsent(context, req.params.customerId, req.body || {}));
    } catch (error) { jsonError(res, error); }
  });
  router.get('/campaigns/:id/preview', async (req, res) => {
    try {
      const context = await requirePermission(req, 'reports.read');
      res.json(await previewCampaign(context, req.params.id));
    } catch (error) { jsonError(res, error); }
  });
  router.post('/campaigns/:id/confirm', async (req, res) => {
    try {
      const context = await requirePermission(req, 'settings.write');
      res.json(await confirmCampaign(context, req.params.id, req.body || {}));
    } catch (error) { jsonError(res, error); }
  });
  router.post('/campaigns/:id/cancel', async (req, res) => {
    try {
      const context = await requirePermission(req, 'settings.write');
      res.json(await cancelCampaign(context, req.params.id));
    } catch (error) { jsonError(res, error); }
  });
  router.get('/campaigns/:id/metrics', async (req, res) => {
    try {
      const context = await requirePermission(req, 'reports.read');
      res.json(await campaignMetrics(context, req.params.id));
    } catch (error) { jsonError(res, error); }
  });
  router.get('/operations/health', async (req, res) => {
    try {
      const context = await requirePermission(req, 'reports.read');
      const storefrontId = await requireAdminStorefront(req, context);
      const scope = [context.empresaId, context.corporateAccess === true ? null : context.lojaId || null, storefrontId];
      const [payments, fulfillments] = await Promise.all([
        db.query(`SELECT p.status, COUNT(*)::int AS total
                    FROM commerce_payments p
                    JOIN commerce_orders o ON o.empresa_id = p.empresa_id AND o.id = p.order_id
                    JOIN commerce_storefronts s ON s.empresa_id = o.empresa_id AND s.id = o.storefront_id
                   WHERE p.empresa_id = $1 AND ($2::uuid IS NULL OR s.loja_id = $2) AND ($3::uuid IS NULL OR o.storefront_id = $3)
                   GROUP BY p.status`, scope),
        db.query(`SELECT f.status, COUNT(*)::int AS total
                    FROM commerce_fulfillments f
                    JOIN commerce_orders o ON o.empresa_id = f.empresa_id AND o.id = f.order_id
                    JOIN commerce_storefronts s ON s.empresa_id = o.empresa_id AND s.id = o.storefront_id
                   WHERE f.empresa_id = $1 AND ($2::uuid IS NULL OR s.loja_id = $2) AND ($3::uuid IS NULL OR o.storefront_id = $3)
                   GROUP BY f.status`, scope),
      ]);
      res.json({
        generatedAt: new Date().toISOString(),
        payments: statusCounts(payments.rows),
        fulfillments: statusCounts(fulfillments.rows),
        webhooks: { available: false, reason: 'storefront_correlation_unavailable' },
      });
    } catch (error) { jsonError(res, error); }
  });
  router.patch('/orders/:id', async (req, res) => {
    try {
      const permission = ['refunded', 'partially_refunded'].includes(req.body?.status) ? 'orders.refund' : 'orders.write';
      const context = await requirePermission(req, permission);
      const storefrontId = await requireAdminStorefront(req, context);
      const result = await withCommerceTransaction(trx => transitionOrder(trx, context, { status: req.body?.status, correlationId: req.body?.correlationId, payload: { motivo: String(req.body?.motivo || req.body?.reason || '').slice(0, 300) || undefined }, origin: 'admin', orderId: req.params.id, storefrontId }));
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  // Operação excepcional autorizada: aceitar uma captura comprovada depois da
  // expiração da reserva somente para retirada, sem flexibilizar PATCH /orders.
  router.post('/orders/:id/recover-late-capture', async (req, res) => {
    try {
      if (req.user?.mainAdmin !== true && req.user?.platformAdmin !== true) {
        throw new CommerceError('recuperação financeira requer administrador global', 'PERMISSION_DENIED');
      }
      const context = await requirePermission(req, 'orders.write');
      await requirePermission(req, 'payments.write');
      await requirePermission(req, 'inventory.write');
      const storefrontId = await requireAdminStorefront(req, context, { optionalForCorporate: false });
      if (req.body?.confirmPickup !== true || req.body?.reasonCode !== 'HONOR_CAPTURED_PICKUP_ORDER') {
        throw new CommerceError('confirme a recuperação por retirada, sem estorno automático', 'ORDER_RECOVERY_REASON_REQUIRED');
      }
      const reason = String(req.body?.reason || '').trim();
      if (reason.length < 20 || reason.length > 180 || !/^[\p{L}\p{M} .,;:!?()_-]+$/u.test(reason)) {
        throw new CommerceError('motivo operacional sem identificadores é obrigatório', 'ORDER_RECOVERY_REASON_REQUIRED');
      }
      const orderId = assertUuid(req.params.id, 'orderId');
      const candidate = await db.queryRead(
        `SELECT p.id FROM commerce_payments p
           JOIN commerce_orders o ON o.empresa_id = p.empresa_id AND o.id = p.order_id
          WHERE o.empresa_id = $1 AND o.id = $2 AND o.storefront_id = $3
            AND ($4::uuid IS NULL OR o.loja_id = $4)
            AND p.provider = 'infinitepay' AND p.status = 'captured'
            AND p.metadata #>> '{lateCapture,state}' IN ('refund_required','accepted_for_fulfillment')
          LIMIT 2`,
        [context.empresaId, orderId, storefrontId, context.corporateAccess === true ? null : context.lojaId || null],
      );
      if (candidate.rows.length !== 1) throw new CommerceError('captura única não encontrada para esta vitrine', 'ORDER_RECOVERY_PAYMENT_CONFLICT');
      // payment_check oficial é consultado de novo; o snapshot no banco e o
      // comprovante do cliente sozinhos não autorizam reativação da venda.
      const verified = await syncPaymentAttempt({ ...context, storefrontId }, candidate.rows[0].id);
      if (verified.status !== 'captured' || verified.stale === true || verified.unconfirmed === true) {
        throw new CommerceError('o provedor não confirma captura vigente', 'ORDER_RECOVERY_PAYMENT_CONFLICT');
      }
      const result = await withCommerceTransaction(trx => recoverExpiredPaidOrder(trx, context, {
        orderId, storefrontId, idempotencyKey: req.get('Idempotency-Key'),
        reason,
        verifyCaptured: payment => paymentProviders.get('infinitepay').getStatus({
          payment,
          account: { id: payment.account_id, ambiente: payment.ambiente,
            secret_ref: payment.secret_ref, public_config: payment.public_config },
        }),
      }));
      res.json(result);
    } catch (error) { jsonError(res, error); }
  });
  router.get('/reports/sales', async (req, res) => {
    try {
      const context = await requirePermission(req, 'reports.read');
      const storefrontId = await requireAdminStorefront(req, context);
      res.json(await salesReport(context, { from: req.query.from, to: req.query.to, storefrontId }));
    } catch (error) { jsonError(res, error); }
  });
  router.get('/reports/fulfillment', async (req, res) => {
    try {
      const context = await requirePermission(req, 'reports.read');
      const storefrontId = await requireAdminStorefront(req, context);
      res.json(await fulfillmentReport(context, { from: req.query.from, to: req.query.to, storefrontId }));
    } catch (error) { jsonError(res, error); }
  });
  router.get('/reports/inventory', async (req, res) => {
    try {
      const context = await requirePermission(req, 'reports.read');
      const storefrontId = await requireAdminStorefront(req, context, { optionalForCorporate: false });
      res.json(await inventoryReport(context, { storefrontId }));
    } catch (error) { jsonError(res, error); }
  });
  router.get('/reports/customers', async (req, res) => {
    try {
      const context = await requirePermission(req, 'reports.read');
      const storefrontId = await requireAdminStorefront(req, context, { optionalForCorporate: false });
      res.json(await customerReport(context, { from: req.query.from, to: req.query.to, storefrontId }));
    } catch (error) { jsonError(res, error); }
  });
  router.get('/audit', async (req, res) => {
    try {
      const context = await requirePermission(req, 'audit.read');
      const requestedLimit = Number(req.query.limit);
      const requestedOffset = Number(req.query.offset);
      const limit = Number.isInteger(requestedLimit) ? Math.min(100, Math.max(1, requestedLimit)) : 100;
      const offset = Number.isInteger(requestedOffset) ? Math.min(100000, Math.max(0, requestedOffset)) : 0;
      const values = [context.empresaId];
      const predicates = ['empresa_id = $1'];
      if (context.lojaId) { values.push(context.lojaId); predicates.push(`loja_id = $${values.length}`); }
      for (const [key, column] of [['entity', 'entidade'], ['action', 'acao']]) {
        const value = String(req.query[key] || '').trim().slice(0, 80);
        if (value && /^[a-z0-9_-]+$/i.test(value)) { values.push(value); predicates.push(`${column} = $${values.length}`); }
      }
      const where = predicates.join(' AND ');
      const count = await db.query(`SELECT COUNT(*)::int AS total FROM commerce_audit_logs WHERE ${where}`, values);
      const result = await db.query(
        `SELECT id, loja_id, usuario_id, entidade, entidade_id, acao, antes, depois, correlation_id, ip_address, criado_em
           FROM commerce_audit_logs
          WHERE ${where}
          ORDER BY criado_em DESC
          LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, limit, offset],
      );
      res.json({ items: result.rows, pagination: { limit, offset, total: count.rows[0]?.total || 0, hasMore: offset + result.rows.length < Number(count.rows[0]?.total || 0) } });
    } catch (error) { jsonError(res, error); }
  });
  router.get('/orders', async (req, res) => {
    try {
      const context = await requirePermission(req, 'orders.read');
      const storefrontId = await requireAdminStorefront(req, context);
      const { limit, offset } = parsePagination(req, 100, 500);
      const values = [context.empresaId];
      const predicates = ['o.empresa_id = $1'];
      if (context.lojaId) { values.push(context.lojaId); predicates.push(`s.loja_id = $${values.length}`); }
      if (storefrontId) { values.push(storefrontId); predicates.push(`o.storefront_id = $${values.length}`); }
      if (req.query.status) { values.push(String(req.query.status)); predicates.push(`o.status = $${values.length}`); }
      const query = String(req.query.q || '').trim().slice(0, 160);
      if (query) { values.push(`%${query}%`); predicates.push(`(o.public_code ILIKE $${values.length} OR COALESCE(c.nome, o.customer_snapshot->>'nome') ILIKE $${values.length} OR COALESCE(c.email, o.customer_snapshot->>'email') ILIKE $${values.length})`); }
      const where = predicates.join(' AND ');
      const count = await db.query(`SELECT COUNT(*)::int AS total FROM commerce_orders o JOIN commerce_storefronts s ON s.empresa_id = o.empresa_id AND s.id = o.storefront_id LEFT JOIN commerce_customers c ON c.empresa_id = o.empresa_id AND c.id = o.customer_id WHERE ${where}`, values);
      const result = await db.query(
        `SELECT o.id, o.public_code, o.status, o.origem, o.subtotal, o.desconto, o.frete, o.impostos, o.total, o.shipping_method_id, o.shipping_quote_id, o.criado_em, o.atualizado_em,
                o.customer_id, COALESCE(c.nome, o.customer_snapshot->>'nome') AS customer_name,
                COALESCE(c.email, o.customer_snapshot->>'email') AS customer_email,
                (SELECT p.status FROM commerce_payments p WHERE p.empresa_id = o.empresa_id AND p.order_id = o.id ORDER BY p.criado_em DESC LIMIT 1) AS payment_status,
                (SELECT jsonb_build_object('status', f.status, 'carrier', f.carrier, 'trackingCode', f.tracking_code, 'trackingUrl', f.tracking_url, 'ocorrencias', f.ocorrencias)
                   FROM commerce_fulfillments f WHERE f.empresa_id = o.empresa_id AND f.order_id = o.id ORDER BY f.atualizado_em DESC NULLS LAST LIMIT 1) AS fulfillment,
                COALESCE((SELECT jsonb_agg(jsonb_build_object('nome', i.nome_snapshot, 'sku', i.sku_snapshot, 'quantidade', i.quantidade, 'preco', i.preco_unitario, 'subtotal', i.subtotal) ORDER BY i.id ASC) FROM commerce_order_items i WHERE i.empresa_id = o.empresa_id AND i.order_id = o.id), '[]'::jsonb) AS items
           FROM commerce_orders o
           JOIN commerce_storefronts s ON s.empresa_id = o.empresa_id AND s.id = o.storefront_id
           LEFT JOIN commerce_customers c ON c.empresa_id = o.empresa_id AND c.id = o.customer_id
          WHERE ${where}
          ORDER BY o.criado_em DESC
          LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, limit, offset],
      );
      const total = Number(count.rows[0]?.total || 0);
      res.json({ items: result.rows, pagination: { limit, offset, total, hasMore: offset + result.rows.length < total } });
    } catch (error) { jsonError(res, error); }
  });
  return router;
}
