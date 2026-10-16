const LABELS = Object.freeze({
  controlConfigured: 'Controle privado WAHA não confirmado',
  sessionAssigned: 'Sessão exclusiva não atribuída',
  sessionConnected: 'Pareamento da sessão não confirmado',
  channelConfigured: 'Canal desta unidade não preparado',
  groupConfigured: 'Grupo Admin exclusivo não confirmado',
  webhookSecretConfigured: 'Segredo de entrada não confirmado',
  hmacSecretConfigured: 'Assinatura HMAC não confirmada',
})

export function internalWhatsappReadiness(connection, diagnostic, operational, profile, now = Date.now()) {
  const blocked = label => ({ ready: false, readyForActivation: false, label, blockers: [label] })
  if (!['gestao', 'lancamentos'].includes(profile)) return blocked('Perfil interno inválido')
  if (connection?.provider !== 'waha' || connection?.providerConfigured !== true) return blocked('Controle privado WAHA não configurado')
  const checkedAt = Date.parse(diagnostic?.agora || '')
  if (diagnostic?.tipoCanal !== profile || diagnostic?.transporte !== 'waha'
      || !Number.isFinite(checkedAt) || checkedAt > now + 5000 || now - checkedAt > 120000) {
    return blocked('Prontidão WAHA ainda não verificável neste perfil')
  }
  const blockers = Object.entries(LABELS).filter(([key]) => diagnostic?.readiness?.[key] !== true).map(([, label]) => label)
  if (connection.state !== 'open' && !blockers.includes(LABELS.sessionConnected)) blockers.push(LABELS.sessionConnected)
  if (operational?.featureEnabled !== true) blockers.push('IA não liberada no servidor')
  if (operational?.gemini?.configured !== true) blockers.push('IA principal não configurada')
  if (!operational?.channel || typeof operational.channel !== 'object' || Array.isArray(operational.channel)
      || !['ativo', 'rascunho', 'pausado'].includes(operational.channel.status)) blockers.push('Canal deste perfil não verificado')
  const readyForActivation = blockers.length === 0
  const ready = readyForActivation && operational.channel.status === 'ativo'
  return { ready, readyForActivation, blockers, label: ready ? 'Canal interno habilitado · entrega ainda requer homologação' : readyForActivation ? 'Pronto para ativar o atendente deste perfil' : blockers[0] }
}
