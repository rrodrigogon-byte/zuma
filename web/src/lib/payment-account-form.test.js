import assert from 'node:assert/strict'
import test from 'node:test'
import { paymentAccountForm, paymentAccountPublicConfig, primaryVerifiedDomain } from './payment-account-form.js'

const storefront = { id: 'store-1', codigo: 'dino-web', configuracoes: { public: true } }
const domains = [
  { storefront_id: 'store-1', dominio: 'dino.kytto.com.br', principal: true, status: 'verified' },
]

test('prepara InfinitePay em produção e inativa usando o domínio principal verificado', () => {
  const domain = primaryVerifiedDomain(domains, storefront.id)
  const form = paymentAccountForm('infinitepay', { storefront, domain })

  assert.deepEqual({
    provider: form.provider,
    ambiente: form.ambiente,
    secretRef: form.secretRef,
    redirectUrl: form.redirectUrl,
    webhookUrl: form.webhookUrl,
    methods: form.methods,
    ativo: form.ativo,
  }, {
    provider: 'infinitepay',
    ambiente: 'production',
    secretRef: 'env:INFINITEPAY_HANDLE',
    redirectUrl: 'https://dino.kytto.com.br/checkout/dino',
    webhookUrl: 'https://dino.kytto.com.br/api/webhooks/infinitepay/payments',
    methods: ['pix', 'credit_card'],
    ativo: false,
  })
})

test('envia apenas configuração pública allowlisted para InfinitePay', () => {
  assert.deepEqual(paymentAccountPublicConfig({
    provider: 'infinitepay',
    handle: '$rodrigo-ribeiro-d8a',
    redirectUrl: 'https://dino.kytto.com.br/checkout/dino',
    webhookUrl: 'https://dino.kytto.com.br/api/webhooks/infinitepay/payments',
    token: 'não-pode-sair',
  }), {
    handle: 'rodrigo-ribeiro-d8a',
    redirectUrl: 'https://dino.kytto.com.br/checkout/dino',
    webhookUrl: 'https://dino.kytto.com.br/api/webhooks/infinitepay/payments',
    methods: ['pix', 'credit_card'],
  })
})

test('não usa domínio pendente e preserva o contrato Mercado Pago', () => {
  assert.equal(primaryVerifiedDomain([{ ...domains[0], status: 'pending' }], storefront.id), '')
  assert.deepEqual(paymentAccountPublicConfig({ provider: 'mercadopago', webhookSecretRef: 'env:MP_WEBHOOK_SECRET' }), {
    webhookSecretRef: 'env:MP_WEBHOOK_SECRET',
    methods: ['pix'],
  })
})
