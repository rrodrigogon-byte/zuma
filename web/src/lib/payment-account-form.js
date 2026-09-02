const PROVIDERS = {
  mercadopago: {
    ambiente: 'sandbox',
    nome: 'Mercado Pago · Sandbox',
    secretRef: 'env:MP_ACCESS_TOKEN',
    webhookSecretRef: 'env:MP_WEBHOOK_SECRET',
  },
  infinitepay: {
    ambiente: 'production',
    nome: 'InfinitePay Checkout · Produção',
    secretRef: 'env:INFINITEPAY_HANDLE',
    webhookSecretRef: '',
  },
}

function safeDomain(value) {
  const domain = String(value || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain) ? domain : ''
}

function aliasFor(storefront, domain) {
  const configured = String(storefront?.configuracoes?.publicAlias || storefront?.configuracoes?.public_alias || storefront?.configuracoes?.alias || '').trim().toLowerCase()
  if (/^[a-z0-9][a-z0-9-]{0,62}$/.test(configured)) return configured
  const fromDomain = safeDomain(domain).split('.')[0]
  if (/^[a-z0-9][a-z0-9-]{0,62}$/.test(fromDomain)) return fromDomain
  const fromCode = String(storefront?.codigo || '').trim().toLowerCase().replace(/-(?:web|storefront)$/, '')
  return /^[a-z0-9][a-z0-9-]{0,62}$/.test(fromCode) ? fromCode : ''
}

export function primaryVerifiedDomain(domains = [], storefrontId = '') {
  const rows = Array.isArray(domains) ? domains : []
  const match = rows.find(item => item?.storefront_id === storefrontId && item?.principal === true && item?.status === 'verified')
    || rows.find(item => item?.storefront_id === storefrontId && item?.status === 'verified')
  return safeDomain(match?.dominio)
}

export function paymentAccountForm(provider = 'mercadopago', context = {}) {
  const code = provider === 'infinitepay' ? 'infinitepay' : 'mercadopago'
  const preset = PROVIDERS[code]
  const storefront = context.storefront || null
  const domain = safeDomain(context.domain)
  const alias = aliasFor(storefront, domain)
  const origin = domain ? `https://${domain}` : ''
  return {
    provider: code,
    ambiente: preset.ambiente,
    nome: preset.nome,
    secretRef: preset.secretRef,
    webhookSecretRef: preset.webhookSecretRef,
    handle: '',
    redirectUrl: code === 'infinitepay' && origin && alias ? `${origin}/checkout/${alias}` : '',
    webhookUrl: code === 'infinitepay' && origin ? `${origin}/api/webhooks/infinitepay/payments` : '',
    methods: code === 'infinitepay' ? ['pix', 'credit_card'] : ['pix'],
    ativo: false,
  }
}

export function paymentAccountPublicConfig(form = {}) {
  if (form.provider === 'infinitepay') {
    return {
      handle: String(form.handle || '').trim().replace(/^\$/, ''),
      redirectUrl: String(form.redirectUrl || '').trim(),
      webhookUrl: String(form.webhookUrl || '').trim(),
      methods: ['pix', 'credit_card'],
    }
  }
  return { webhookSecretRef: String(form.webhookSecretRef || '').trim(), methods: ['pix'] }
}
