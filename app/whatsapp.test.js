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

test('módulo legado nunca envia pela URL nem instância exclusiva Dino', async () => {
  const names = ['CHATBOT_BACKEND_MODE', 'CHATBOT_BACKEND_EMPRESA_ID', 'CHATBOT_BACKEND_URL', 'CHATBOT_BACKEND_INSTANCE']
  const old = Object.fromEntries(names.map(name => [name, process.env[name]]))
  try {
    process.env.CHATBOT_BACKEND_MODE = 'instancias'
    process.env.CHATBOT_BACKEND_EMPRESA_ID = '11111111-1111-4111-8111-111111111111'
    process.env.CHATBOT_BACKEND_URL = 'https://dino.example.invalid'
    process.env.CHATBOT_BACKEND_INSTANCE = 'dino'
    for (const env of [
      { base: 'https://outra.example.invalid', key: 'teste', instance: 'dino' },
      { base: 'https://dino.example.invalid/', key: 'teste', instance: 'agro' },
    ]) {
      const { wpp } = await loadWhatsApp(env)
      await assert.rejects(() => wpp.enviar('65999999999', 'teste'), { code: 'WHATSAPP_INSTANCE_SCOPE_DENIED' })
    }
    const { wpp: other } = await loadWhatsApp({ base: 'https://outra.example.invalid', key: 'teste', instance: 'agro' })
    await assert.rejects(() => other.enviar('123', 'teste'), { code: 'WHATSAPP_INVALID_PHONE' })
  } finally {
    for (const name of names) { if (old[name] === undefined) delete process.env[name]; else process.env[name] = old[name] }
  }
})
