import { brandFromContext } from './brand.js'

const BASE = 'WHATSAPP_AI_WEBHOOK_SECRET'

// Cada empresa usa um segredo de webhook próprio: o servidor recusa a mesma variável
// em duas empresas. A Dino (e a plataforma sem marca) mantém a variável original;
// as demais marcas usam WHATSAPP_AI_WEBHOOK_SECRET_<MARCA>, ex.: _STALLONE.
export function webhookSecretEnvFor(empresa) {
  const marca = brandFromContext(empresa)
  if (!marca || marca === 'dino' || marca === 'kytto' || !/^[a-z0-9]+$/.test(marca)) return BASE
  return `${BASE}_${marca.toUpperCase()}`
}

// Corpo para mudar o estado do atendente sem perder o que já está salvo no canal
// (instância, nome, cabeçalho, capacidades e segmento).
export function channelStatusPayload(channel = {}, { status, instance, empresa } = {}) {
  const ativo = status === 'ativo'
  return {
    instance: channel.instance || instance || '',
    displayName: channel.nome || `Atendimento ${empresa?.nome || 'da empresa'}`.slice(0, 120),
    status: ativo ? 'ativo' : 'rascunho',
    confirmed: ativo,
    webhookSecretEnv: webhookSecretEnvFor(empresa),
    webhookHeader: channel.webhookHeader || 'x-setpoint-webhook-token',
    capabilities: channel.capabilities || {},
    ...(channel.segmento ? { segmento: channel.segmento } : {}),
  }
}
