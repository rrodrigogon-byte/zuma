/** Isolated greetings must not revive a previous conversation topic. */
export function standaloneGreetingReply(text, { human = false, pendingAction = false, customerName = '' } = {}) {
  if (human || pendingAction || typeof text !== 'string' || text.length > 100) return null;
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[!.,?\s]+/g, ' ').trim();
  if (!/^(?:oi+|ola+|bom dia|boa tarde|boa noite)(?: (?:tudo bem|tudo bom))?$/.test(normalized)) return null;
  const nome = customerName ? customerName.split(' ')[0] : '';
  return nome ? `Olá, ${nome}! Sou a assistente virtual. Como posso ajudar você hoje?` : 'Olá! Sou a assistente virtual. Como posso ajudar você hoje?';
}
