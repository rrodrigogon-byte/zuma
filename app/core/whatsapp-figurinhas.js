// ============================================================================
// FIGURINHAS DA PERSONA (pacote do T-Rex)
//
// Arquivos: app/assets/trex/figurinhas/<nome>.webp (512×512, < 100 KB, fundo
// transparente). O envio é "melhor esforço": se o provedor não suporta
// figurinha, nada é enviado e o atendimento segue normal (o texto já foi).
// Passa pelas mesmas travas de saída do texto: canal dono da instância,
// escopo de empresa/loja e modo de egress.
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fetch from 'node-fetch';
import { db } from './database.js';
import { authorizeWhatsappEgress, evaluateWhatsappEgress } from './whatsapp-egress.js';
import { chatbotBackendMode, chatbotBackendStickerPath, sendStickerViaChatbotBackend, whatsappProviderName } from './whatsapp-provider.js';
import { STICKERS } from './whatsapp-ai-persona.js';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'trex', 'figurinhas');
const cache = new Map();

export function caminhoFigurinha(nome) {
  if (!Object.hasOwn(STICKERS, nome)) return '';
  return path.join(DIR, `${nome}.webp`);
}

export function lerFigurinha(nome) {
  if (cache.has(nome)) return cache.get(nome);
  const arquivo = caminhoFigurinha(nome);
  if (!arquivo || !fs.existsSync(arquivo)) return null;
  const base64 = fs.readFileSync(arquivo).toString('base64');
  cache.set(nome, base64);
  return base64;
}

/** O provedor configurado sabe mandar figurinha? */
export function figurinhaSuportada(env = process.env) {
  if (whatsappProviderName() === 'chatbot_backend') return Boolean(chatbotBackendStickerPath(env));
  return Boolean(env.EVOLUTION_API_URL) && env.WHATSAPP_AI_STICKERS_EVOLUTION !== 'off';
}

export function figurinhaDisponivel(nome) {
  return Boolean(caminhoFigurinha(nome)) && Boolean(lerFigurinha(nome));
}

function numero(telefone) {
  const digits = String(telefone || '').replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

async function viaEvolution(tenant, telefone, base64) {
  if (!(tenant?.whatsapp_api_url && tenant?.whatsapp_api_key && tenant?.whatsapp_instance)) {
    return { ok: false, unsupported: true, error: 'WHATSAPP_EVOLUTION_TENANT_CONFIG_REQUIRED' };
  }
  try {
    const res = await fetch(`${tenant.whatsapp_api_url.replace(/\/$/, '')}/message/sendSticker/${encodeURIComponent(tenant.whatsapp_instance)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: tenant.whatsapp_api_key },
      body: JSON.stringify({ number: numero(telefone), sticker: base64, delay: 800 }),
      signal: AbortSignal.timeout(20000),
    });
    return { ok: res.ok, status: res.status, unsupported: res.status === 404, uncertain: !res.ok && res.status >= 500 };
  } catch (error) {
    return { ok: false, uncertain: true, error: String(error?.name || 'NETWORK_ERROR').slice(0, 80) };
  }
}

/**
 * Envia a figurinha `nome` para `telefone`. Nunca lança: devolve
 * { ok, skipped?, unsupported?, error? } para o chamador registrar.
 */
export async function enviarFigurinha(tenant, telefone, nome) {
  const base64 = lerFigurinha(nome);
  if (!base64) return { ok: false, skipped: true, error: 'STICKER_NOT_FOUND' };
  if (!figurinhaSuportada()) return { ok: false, skipped: true, unsupported: true, error: 'STICKER_UNSUPPORTED' };
  const destino = numero(telefone);
  if (whatsappProviderName() === 'chatbot_backend') {
    const instance = tenant?.whatsapp_instance || tenant?.instance || undefined;
    if (chatbotBackendMode() === 'instancias') {
      const context = { empresaId: tenant?.empresa_id, lojaId: tenant?.loja_id, canalId: tenant?.canal_id, instance, number: destino };
      const preliminary = evaluateWhatsappEgress(context);
      if (!preliminary.ok) return { ok: false, skipped: true, error: `WHATSAPP_EGRESS_${preliminary.reason.toUpperCase()}` };
      try {
        return await db.transaction(async (trx) => {
          const decision = await authorizeWhatsappEgress(context, { database: { queryRead: trx.query }, lock: true });
          if (!decision.ok) return { ok: false, skipped: true, error: `WHATSAPP_EGRESS_${decision.reason.toUpperCase()}` };
          return sendStickerViaChatbotBackend({ instance, number: destino, base64, fileName: `${nome}.webp` });
        });
      } catch (error) {
        return { ok: false, error: String(error?.code || 'STICKER_SEND_FAILED').slice(0, 80) };
      }
    }
    return sendStickerViaChatbotBackend({ instance, number: destino, base64, fileName: `${nome}.webp` });
  }
  return viaEvolution(tenant, destino, base64);
}
