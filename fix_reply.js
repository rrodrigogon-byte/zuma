const CONFIRMATION_BUSINESS_ERRORS = new Set([
  'PLANO_VENCIDO','PLANO_INDISPONIVEL','LIMITE_DO_CICLO',
  'ACTION_EXPIRED', 'ACTION_NOT_CONFIRMABLE', 'ACTION_NOT_FOUND', 'NO_PENDING_ACTION',
  'SLOT_UNAVAILABLE', 'PHONE_LIMIT', 'ALREADY_BOOKED', 'APPOINTMENT_NOT_FOUND', 'APPOINTMENT_NOT_ACTIVE', 'APPOINTMENT_PAST',
  'SERVICE_NOT_FOUND', 'PROFESSIONAL_NOT_FOUND', 'DATE_OUT_OF_RANGE', 'INSUFFICIENT_STOCK', 'OUT_OF_STOCK', 'PRODUCT_UNAVAILABLE',
]);

export function confirmationFailureReply(code, type = '') {
  const oQue = type === 'pedido' ? 'o pedido' : type === 'cancelamento' ? 'o cancelamento' : type === 'remarcacao' ? 'a remarcação' : type === 'despesa_financeira' ? 'a despesa' : 'o horário';
  switch (code) {
    case 'ACTION_EXPIRED':
      return `Essa confirmação passou do prazo e eu não concluí ${oQue}. Quer que eu veja de novo agora? É só me dizer o dia e o período.`;
    case 'SLOT_UNAVAILABLE':
      return 'Poxa, esse horário acabou de ser ocupado. Quer que eu te mostre os próximos horários livres?';
    case 'PLANO_VENCIDO':
    case 'PLANO_INDISPONIVEL':
      return 'O pacote não está disponível para este horário. Confira a renovação com a equipe para usar os benefícios; posso consultar um atendimento avulso.';
    case 'LIMITE_DO_CICLO':
      return 'As sessões deste ciclo já foram usadas ou reservadas. Posso consultar um atendimento avulso ou orientar você a falar com a equipe.';
    case 'PHONE_LIMIT':
      return 'Você já tem horários marcados por este número. Para marcar outro, posso remarcar ou cancelar um deles. Quer ver seus horários?';
    case 'ALREADY_BOOKED':
      return 'Você já tem esse serviço marcado nesse dia, então não dupliquei. Quer ver ou mudar o horário que já está marcado?';
    case 'APPOINTMENT_PAST':
      return 'Esse horário já passou. Quer marcar um novo?';
    case 'INSUFFICIENT_STOCK':
    case 'OUT_OF_STOCK':
    case 'PRODUCT_UNAVAILABLE':
      return 'Esse produto acabou de sair do estoque e não consegui separar. Quer que eu veja uma alternativa?';
    default:
      return `Não consegui concluir ${oQue} porque algo mudou desde o resumo. Posso preparar de novo para você?`;
  }
}
