// Gate de saída exclusivo do chatbot_backend multi-instância.
// Não consulta conteúdo de mensagens nem expõe telefones/logs; negar antes de qualquer HTTP.
import { db } from './database.js';
import { chatbotBackendConfig, chatbotBackendMode, isaChatId, validInstance, whatsappProviderName } from './whatsapp-provider.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const deny = (reason) => ({ ok: false, reason });

export function egressMode() {
  const value = String(process.env.WHATSAPP_EGRESS_MODE || '').trim().toLowerCase();
  if (value === 'on' && process.env.WHATSAPP_FULL_ROLLOUT_APPROVED !== '1') return 'off';
  return value === 'pilot' || value === 'on' ? value : 'off';
}

export function evaluateWhatsappEgress({ empresaId, lojaId, canalId, instance, number } = {}) {
  if (whatsappProviderName() !== 'chatbot_backend' || chatbotBackendMode() !== 'instancias') return deny('provider_scope');
  const owner = String(process.env.CHATBOT_BACKEND_EMPRESA_ID || '').trim();
  if (!UUID.test(owner) || !UUID.test(String(empresaId || '')) || owner !== String(empresaId)) return deny('company_scope');
  if (!UUID.test(String(lojaId || '')) || !UUID.test(String(canalId || ''))) return deny('channel_scope');
  const resolved = validInstance(instance);
  if (!resolved || resolved !== chatbotBackendConfig().instance) return deny('instance_scope');
  if (process.env.WHATSAPP_LINE_VERIFIED !== '1') return deny('line_unverified');
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
