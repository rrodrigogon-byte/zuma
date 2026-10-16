import test from 'node:test'
import assert from 'node:assert/strict'
import { internalWhatsappReadiness } from './whatsapp-internal-readiness.js'
const now = Date.now()
const connection = { provider: 'waha', providerConfigured: true, state: 'open', saida: { modo: 'off' } }
const readiness = { controlConfigured: true, sessionAssigned: true, sessionConnected: true, channelConfigured: true, groupConfigured: true, webhookSecretConfigured: true, hmacSecretConfigured: true }
const diag = { tipoCanal: 'gestao', transporte: 'waha', agora: new Date(now).toISOString(), readiness }
const operational = { featureEnabled: true, gemini: { configured: true }, channel: { status: 'rascunho' } }
test('pré-requisitos completos permitem ativação, não alegam envio nem herdam modo Cliente', () => {
 const result = internalWhatsappReadiness(connection, diag, operational, 'gestao', now)
 assert.equal(result.readyForActivation, true); assert.equal(result.ready, false)
 assert.equal(internalWhatsappReadiness(connection, diag, { ...operational, channel: { status: 'ativo' } }, 'gestao', now).ready, true)
})
test('cada pré-requisito ausente ou desconhecido bloqueia ativação', () => {
 for (const key of Object.keys(readiness)) for (const value of [false, null, undefined, 'true']) {
  const result = internalWhatsappReadiness(connection, { ...diag, readiness: { ...readiness, [key]: value } }, operational, 'gestao', now)
  assert.equal(result.readyForActivation, false, `${key}: ${value}`); assert.equal(result.ready, false)
 }
})
test('diagnóstico de Clientes ou de outro perfil nunca libera WAHA', () => {
 assert.equal(internalWhatsappReadiness(connection, { conclusoes: [{ titulo: 'Saída das respostas', ok: true }] }, operational, 'gestao', now).readyForActivation, false)
 assert.equal(internalWhatsappReadiness(connection, { ...diag, tipoCanal: 'lancamentos' }, operational, 'gestao', now).readyForActivation, false)
 assert.equal(internalWhatsappReadiness({ ...connection, provider: 'chatbot_backend' }, diag, operational, 'gestao', now).readyForActivation, false)
})
test('diagnóstico antigo, futuro ou sem data falha fechado', () => {
 for (const agora of ['', 'invalid', new Date(now - 120001).toISOString(), new Date(now + 5001).toISOString()]) assert.equal(internalWhatsappReadiness(connection, { ...diag, agora }, operational, 'gestao', now).readyForActivation, false)
})
test('estado de sessão, IA e canal são obrigatórios além da estrutura', () => {
 assert.equal(internalWhatsappReadiness({ ...connection, state: 'unknown' }, diag, operational, 'gestao', now).readyForActivation, false)
 for (const op of [{ ...operational, featureEnabled: false }, { ...operational, gemini: null }, { ...operational, channel: null }]) assert.equal(internalWhatsappReadiness(connection, diag, op, 'gestao', now).readyForActivation, false)
})
test('canal vazio, array ou status desconhecido nunca habilita ativação', () => {
 for (const channel of [{}, [], 'ativo', { status: null }, { status: 'unknown' }, { status: 'ativo,rascunho' }]) {
  const result = internalWhatsappReadiness(connection, diag, { ...operational, channel }, 'gestao', now)
  assert.equal(result.readyForActivation, false); assert.equal(result.ready, false)
 }
})
