// Gate de saída exclusivo do chatbot_backend multi-instância.
// Não consulta conteúdo de mensagens nem expõe telefones/logs; negar antes de qualquer HTTP.
import { db } from './database.js';
import { chatbotBackendMode, instanceLineVerified, instanceOwner, isaChatId, validInstance, whatsappProviderName } from './whatsapp-provider.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const deny = (reason) => ({ ok: false, reason });

export function egressMode() {
  const value = String(process.env.WHATSAPP_EGRESS_MODE || '').trim().toLowerCase();
  if (value === 'on' && process.env.WHATSAPP_FULL_ROLLOUT_APPROVED !== '1') return 'off';
  return value === 'pilot' || value === 'on' ? value : 'off';
}

export function evaluateWhatsappEgress({ empresaId, lojaId, canalId, instance, number } = {}) {
  if (whatsappProviderName() !== 'chatbot_backend' || chatbotBackendMode() !== 'instancias') return deny('provider_scope');
  // Cada instância tem uma empresa dona (CHATBOT_BACKEND_INSTANCES, ou o par antigo
  // CHATBOT_BACKEND_INSTANCE + CHATBOT_BACKEND_EMPRESA_ID). Só a dona envia por ela.
  const resolved = validInstance(instance);
  if (!resolved || !instanceOwner(resolved)) return deny('instance_scope');
  const owner = instanceOwner(resolved);
  if (!UUID.test(owner) || !UUID.test(String(empresaId || '')) || owner !== String(empresaId).toLowerCase()) return deny('company_scope');
  if (!UUID.test(String(lojaId || '')) || !UUID.test(String(canalId || ''))) return deny('channel_scope');
  if (!instanceLineVerified(resolved)) return deny('line_unverified');
  const mode = egressMode();
  if (mode === 'off') return deny('egress_off');
  const recipient = isaChatId(number);
  if (!recipient || !/^55\d{10,11}$/.test(recipient)) return deny('recipient_invalid');
  if (mode === 'pilot') {
    const allowed = new Set(String(process.env.WHATSAPP_POLL_PILOT_PHONES || '').split(',').map(isaChatId).filter(Boolean));
    if (!allowed.has(recipient)) return deny('pilot_not_listed');
  }
  return { ok: true, reason: mode };
}

export async function authorizeWhatsappEgress(context, { database = db, lock = false } = {}) {
  const decision = evaluateWhatsappEgress(context);
  if (!decision.ok) return decision;
  try {
    const result = await database.queryRead(
      `SELECT c.id FROM canais_integracao c
         JOIN lojas l ON l.id = c.loja_id AND l.empresa_id = c.empresa_id
        WHERE c.id = $3::uuid AND c.empresa_id = $1::uuid AND c.loja_id = $2::uuid
          AND c.provedor = 'whatsapp' AND c.status = 'ativo'
          AND LOWER(BTRIM(c.configuracao->>'instance')) = $4
          AND NOT EXISTS (
            SELECT 1 FROM canais_integracao other
             WHERE other.id <> c.id AND other.status = 'ativo' AND other.provedor = 'whatsapp'
               AND LOWER(BTRIM(other.configuracao->>'instance')) = $4)
       LIMIT 1${lock ? ' FOR SHARE OF c' : ''}`,
      [context.empresaId, context.lojaId, context.canalId, validInstance(context.instance)],
    );
    return result.rows.length === 1 ? decision : deny('channel_inactive_or_shared');
  } catch {
    return deny('channel_unavailable');
  }
}

// Motivos do gate traduzidos para a tela do gestor. Nunca expõem telefones nem
// valores de segredo — só o nome da variável que o operador precisa ajustar.
const MOTIVOS_EGRESS = {
  provider_scope: 'O servidor não está no modo multi-instância do backend NossaGente (WHATSAPP_PROVIDER=chatbot_backend e CHATBOT_BACKEND_MODE=instancias).',
  company_scope: 'Esta empresa não é a dona da instância no servidor (CHATBOT_BACKEND_INSTANCES ou CHATBOT_BACKEND_EMPRESA_ID).',
  channel_scope: 'Canal da unidade inválido para envio. Selecione a unidade e confira o canal do WhatsApp.',
  instance_scope: 'A instância desta empresa não está liberada no servidor (inclua em CHATBOT_BACKEND_INSTANCES como instancia=id-da-empresa).',
  line_unverified: 'A linha ainda não foi confirmada pelo titular no aparelho (inclua a instância em WHATSAPP_LINE_VERIFIED_INSTANCES, ou WHATSAPP_LINE_VERIFIED=1 para a instância padrão).',
  egress_off: 'O envio de mensagens está desligado no servidor (WHATSAPP_EGRESS_MODE=off). Para testar, defina WHATSAPP_EGRESS_MODE=pilot e inclua este número em WHATSAPP_POLL_PILOT_PHONES.',
  recipient_invalid: 'Número inválido. Informe DDD + número, por exemplo 65 99999-0000.',
  pilot_not_listed: 'Modo piloto: este número não está na lista autorizada (WHATSAPP_POLL_PILOT_PHONES). Inclua o número no servidor ou use um número já autorizado.',
  channel_inactive_or_shared: 'O canal do WhatsApp não está ativo ou a instância está ligada a mais de um canal ativo.',
  channel_unavailable: 'Não foi possível confirmar o canal do WhatsApp agora. Tente de novo em instantes.',
  channel_lookup_failed: 'Não foi possível confirmar o canal do WhatsApp agora. Tente de novo em instantes.',
};

/** Aceita o motivo cru (`egress_off`) ou o código do core (`WHATSAPP_EGRESS_EGRESS_OFF`). */
export function egressMotivo(code) {
  const raw = String(code || '').trim();
  const reason = raw.toUpperCase().startsWith('WHATSAPP_EGRESS_') ? raw.slice('WHATSAPP_EGRESS_'.length) : raw;
  return reason.toLowerCase();
}

export function egressMensagem(code) {
  return MOTIVOS_EGRESS[egressMotivo(code)] || '';
}

/** Resumo sem dados pessoais para a tela de conexão: modo de saída e se há lista piloto. */
export function egressResumo() {
  const modo = egressMode();
  const pilotoConfigurado = String(process.env.WHATSAPP_POLL_PILOT_PHONES || '').split(',').map(isaChatId).filter(Boolean).length > 0;
  return { modo, linhaVerificada: process.env.WHATSAPP_LINE_VERIFIED === '1', pilotoConfigurado };
}
