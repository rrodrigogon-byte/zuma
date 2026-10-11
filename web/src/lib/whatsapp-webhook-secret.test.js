import test from 'node:test'
import assert from 'node:assert/strict'
import { channelStatusPayload, webhookSecretEnvFor } from './whatsapp-webhook-secret.js'

test('Dino e plataforma mantêm o segredo original; Stallone usa o próprio', () => {
  assert.equal(webhookSecretEnvFor({ id: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6', nome: 'Dino Barbearia' }), 'WHATSAPP_AI_WEBHOOK_SECRET')
  assert.equal(webhookSecretEnvFor(null), 'WHATSAPP_AI_WEBHOOK_SECRET')
  assert.equal(webhookSecretEnvFor({ id: '31f70c83-9172-40c2-945f-9e793b5048be', nome: 'Stallone Nutre Sport' }), 'WHATSAPP_AI_WEBHOOK_SECRET_STALLONE')
})

test('ativar preserva instância, cabeçalho e capacidades do canal salvo', () => {
  const channel = { instance: 'stallone-1', nome: 'Atendimento Stallone', webhookHeader: 'x-setpoint-webhook-token', capabilities: { humanized: true, sendPromotions: false }, segmento: 'varejo' }
  const empresa = { id: '31f70c83-9172-40c2-945f-9e793b5048be', nome: 'Stallone Nutre Sport' }
  const ativo = channelStatusPayload(channel, { status: 'ativo', empresa })
  assert.deepEqual(ativo, { instance: 'stallone-1', displayName: 'Atendimento Stallone', status: 'ativo', confirmed: true, webhookSecretEnv: 'WHATSAPP_AI_WEBHOOK_SECRET_STALLONE', webhookHeader: 'x-setpoint-webhook-token', capabilities: { humanized: true, sendPromotions: false }, segmento: 'varejo' })
  const pausa = channelStatusPayload(channel, { status: 'rascunho', empresa })
  assert.equal(pausa.status, 'rascunho'); assert.equal(pausa.confirmed, false)
})
