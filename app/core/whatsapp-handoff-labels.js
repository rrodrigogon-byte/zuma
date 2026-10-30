// Rótulos legíveis dos motivos de handoff (painel da recepção e resumo diário).

export const MOTIVOS_EQUIPE = {
  equipe_no_celular: 'equipe respondendo pelo celular',
  pedido_do_cliente: 'cliente pediu uma pessoa',
  cliente_confuso: 'cliente não entendeu',
  identity_ambiguous: 'cadastro a confirmar',
  whatsapp_delivery_unknown: 'entrega incerta',
  whatsapp_delivery_skipped: 'mensagem não enviada',
  gemini_circuit_open: 'IA indisponível',
  equipe_assumiu: 'atendente assumiu',
  duvida_sem_resposta: 'T-Rex não soube responder',
  reclamacao: 'reclamação',
  excecao_financeira: 'exceção financeira',
  dado_sensivel: 'dado sensível enviado',
  identidade_ambigua: 'cadastro a confirmar',
};

/** Rótulo legível do motivo de handoff (códigos com prefixo viram a família). */
export function motivoLegivel(reason) {
  const codigo = String(reason || '').trim();
  if (!codigo) return 'revisão humana';
  if (MOTIVOS_EQUIPE[codigo]) return MOTIVOS_EQUIPE[codigo];
  if (codigo.startsWith('security:sensitive')) return 'dado sensível enviado';
  if (codigo.startsWith('security:')) return 'segurança';
  if (codigo.startsWith('gemini:')) return `IA indisponível${/^gemini:GEMINI_[A-Z_]+$/.test(codigo) ? ` (${codigo.slice(7)})` : ''}`;
  if (codigo.startsWith('delivery:')) return 'falha de envio';
  return codigo.replace(/_/g, ' ').slice(0, 60);
}

