// Um status de conexão global não comprova sessão ativa para outra empresa.
import { instanceOwner } from './whatsapp-provider.js';

export function canCheckWhatsappConnection({ channel, provider, tenantId, ownerTenantId } = {}) {
  if (!channel || channel.status !== 'ativo' || provider?.provider !== 'chatbot_backend') return false;
  if (provider.mode === 'instancias') {
    // Instância registrada: só a empresa dona consulta. Sem registro, vale a instância padrão.
    const owner = instanceOwner(channel.instance);
    if (owner) return Boolean(tenantId && owner === String(tenantId).toLowerCase());
    return Boolean(channel.instance && channel.instance === provider.instance);
  }
  // No contrato de sessão única, o ambiente precisa apontar explicitamente
  // para a empresa dona. Nunca consultar a sessão da Isa como se fosse Dino.
  return provider.mode === 'isa' && Boolean(tenantId && ownerTenantId && tenantId === ownerTenantId);
}

export function safeWhatsappConnection(result) {
  const state = result?.ok === true && ['open', 'qr', 'connecting', 'close'].includes(result?.state)
    ? result.state : 'unknown';
  // Não incluir phone, qrImage, qrRaw, pairingCode, URLs nem erro bruto.
  return { state, checkedAt: new Date().toISOString() };
}
