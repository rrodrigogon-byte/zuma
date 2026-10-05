// O cartão da unidade deve refletir a operação Commerce/IA, nunca o adaptador
// de envio manual legado (global e indisponível para operadores tenant-scoped).
export function whatsappIntegrationStatus(whatsapp = {}) {
  const ai = whatsapp?.ai || {};
  const channel = ai.channel;
  if (ai.unavailable) return {
    badge: 'pendente_configuracao', label: 'Status indisponível para a unidade selecionada',
    automatic: 'Não verificável',
  };
  if (!channel) return {
    badge: 'pendente_configuracao', label: 'Canal da unidade ainda não cadastrado',
    automatic: 'Aguardando canal',
  };
  if (channel.status === 'pausado') return {
    badge: 'pausada', label: 'Canal pausado pela equipe', automatic: 'Pausado',
  };
  if (channel.status !== 'ativo') return {
    badge: 'pendente_ativacao', label: 'Canal sem atendimento ativo', automatic: 'Inativo',
  };
  if (channel.aiCircuitOpen) return {
    badge: 'pausada', label: 'Canal ativo · IA pausada por segurança', automatic: 'Handoff de segurança',
  };
  if (!ai.featureEnabled) return {
    badge: 'pendente_ativacao', label: 'Canal ativo · atendimento IA desativado', automatic: 'Desativado',
  };
  if (!ai.messagingConfigured && !ai.evolutionConfigured) return {
    badge: 'pendente_configuracao', label: 'Canal ativo · provedor de mensagens indisponível', automatic: 'Indisponível',
  };
  if (!ai.gemini?.configured) return {
    badge: 'pendente_configuracao', label: 'Canal ativo · provedor IA indisponível', automatic: 'Indisponível',
  };
  const lastCheck = new Date(ai.connection?.checkedAt || 0).getTime();
  const connectionFresh = lastCheck > 0 && Math.abs(Date.now() - lastCheck) < 90000;
  const connection = connectionFresh ? ai.connection?.state : 'unknown';
  if (connection !== 'open') return {
    badge: 'nao_verificado',
    label: connection === 'qr' ? 'Canal ativo · aguardando pareamento'
      : connection === 'close' ? 'Canal ativo · número desconectado'
        : connection === 'connecting' ? 'Canal ativo · conectando número'
          : 'Canal ativo · conexão ainda não verificada',
    automatic: 'Aguardando conexão',
  };
  const heartbeat = new Date(ai.worker?.lastHeartbeatAt || 0).getTime();
  if (!heartbeat || Math.abs(Date.now() - heartbeat) >= 180000) return {
    badge: 'nao_verificado', label: 'Número conectado · worker sem ciclo recente',
    automatic: 'Worker indisponível',
  };
  return {
    badge: 'configurado', label: 'Canal da unidade conectado · atendimento automático habilitado',
    automatic: 'Ativo por padrão (reativo)',
  };
}
