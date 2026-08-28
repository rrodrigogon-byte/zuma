import test from 'node:test'
import assert from 'node:assert/strict'

async function loadWhatsApp(env) {
  const previous = {
    base: process.env.WPP_BASE_URL,
    key: process.env.WPP_APIKEY,
    instance: process.env.WPP_INSTANCE,
  }
  if (env.base === undefined) delete process.env.WPP_BASE_URL
  else process.env.WPP_BASE_URL = env.base
  if (env.key === undefined) delete process.env.WPP_APIKEY
  else process.env.WPP_APIKEY = env.key
  if (env.instance === undefined) delete process.env.WPP_INSTANCE
  else process.env.WPP_INSTANCE = env.instance
  const module = await import(`./whatsapp.js?test=${Date.now()}-${Math.random()}`)
  process.env.WPP_BASE_URL = previous.base
  process.env.WPP_APIKEY = previous.key
  process.env.WPP_INSTANCE = previous.instance
  return module
}

test('WhatsApp sem configuração não retorna sucesso simulado', async () => {
  const { wpp } = await loadWhatsApp({ base: '', key: '' })
  await assert.rejects(() => wpp.enviar('65999999999', 'teste'), error => {
    assert.equal(error.code, 'WHATSAPP_NOT_CONFIGURED')
    return true
  })
})

test('WhatsApp rejeita telefone inválido antes da chamada externa', async () => {
  const { wpp } = await loadWhatsApp({ base: 'https://example.invalid', key: 'test-key' })
  await assert.rejects(() => wpp.enviar('123', 'teste'), error => {
    assert.equal(error.code, 'WHATSAPP_INVALID_PHONE')
    return true
  })
})
