// Envio de WhatsApp do Clube pelo MESMO caminho do resto do agro-open (core/whatsapp.js →
// enviarMensagem), com o canal de atendimento ao cliente da empresa, igual às automações da IA
// (core/ai-automations.js). Nada aqui muda variáveis WHATSAPP_* / CHATBOT_BACKEND_*: se o canal da
// empresa não estiver ativo, ou a trava de saída recusar, a mensagem não sai e o motivo volta.
import { db } from '../../core/database.js';
import { enviarMensagem } from '../../core/whatsapp.js';
import { whatsappConsentMap, memoryPhone } from '../../core/ai-memory.js';
import { canonicalWhatsappPhone } from '../../core/whatsapp-phone.js';

const cache = new Map();
const CACHE_MS = 5 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Canal de atendimento ao cliente (nunca o de gestão/lançamentos), com instância configurada. */
async function canalDaEmpresa(empresaId) {
  const salvo = cache.get(empresaId);
  if (salvo && Date.now() - salvo.em < CACHE_MS) return salvo.canal;
  const r = await db.queryRead(
    `SELECT c.id, c.loja_id, c.api_base_url, c.configuracao
       FROM canais_integracao c
      WHERE c.empresa_id = $1::uuid AND c.provedor = 'whatsapp' AND c.status = 'ativo'
        AND COALESCE(c.tipo_canal, 'cliente') = 'cliente'
        AND COALESCE(BTRIM(c.configuracao->>'instance'), '') <> ''
      ORDER BY c.data_criacao
      LIMIT 1`,
    [empresaId],
  );
  const canal = r.rows[0] || null;
  cache.set(empresaId, { canal, em: Date.now() });
  return canal;
}

// mesma forma canônica do núcleo (com o 9º dígito): é a chave do mapa de consentimento
const telefoneCanonico = (t) => canonicalWhatsappPhone(t) || null;

/**
 * Assinatura usada pelo módulo Clube: ({ empresaId, customerId, telefone, texto, tipo, gatilho, marketing })
 * `marketing: true` (gatilhos de retenção que não são cobrança) também respeita o opt-out global do
 * WhatsApp (pedido "SAIR" na conversa, opt-out das automações): quem saiu não recebe.
 */
export async function enviarWhatsappClube({ empresaId, telefone, texto, marketing = false }) {
  if (!UUID.test(String(empresaId || ''))) return { ok: false, error: 'CLUBE_EMPRESA_INVALIDA' };
  const fone = telefoneCanonico(telefone);
  if (!fone) return { ok: false, error: 'CLUBE_TELEFONE_INVALIDO' };
  if (marketing) {
    try {
      const mapa = await whatsappConsentMap(empresaId, { phone: fone });
      // pediu SAIR, ou revogou marketing no CRM: não recebe novidade (a consulta já é só deste telefone)
      const c = mapa.get(memoryPhone(fone)) || [...mapa.values()][0];
      if (c?.optOut || c?.marketing === false) return { ok: false, error: 'CLUBE_OPT_OUT' };
    } catch {
      return { ok: false, error: 'CLUBE_CONSENTIMENTO_INDISPONIVEL' };
    }
  }
  const canal = await canalDaEmpresa(empresaId);
  if (!canal) {
    console.warn('[clube] WhatsApp não enviado: empresa sem canal de atendimento ativo');
    return { ok: false, error: 'CLUBE_SEM_CANAL_WHATSAPP' };
  }
  const resultado = await enviarMensagem(
    {
      whatsapp_api_url: process.env.EVOLUTION_API_URL || canal.api_base_url,
      whatsapp_api_key: process.env.EVOLUTION_API_KEY,
      whatsapp_instance: canal.configuracao?.instance || process.env.EVOLUTION_INSTANCE,
      empresa_id: empresaId, loja_id: canal.loja_id, canal_id: canal.id,
    },
    fone,
    String(texto || '').slice(0, 1200),
  );
  if (!resultado?.ok) console.warn('[clube] WhatsApp não enviado:', resultado?.error || resultado?.status);
  return resultado;
}
