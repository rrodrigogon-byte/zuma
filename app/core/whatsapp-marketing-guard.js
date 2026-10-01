// Regras comuns para mensagens de marketing no WhatsApp (campanhas e carrinho abandonado):
// horário comercial no fuso da loja, no máximo uma mensagem de marketing por número a cada
// 24 horas (somando campanhas, carrinho e automações do atendente) e respeito ao SAIR permanente.
import { db } from './database.js';
import { canonicalWhatsappPhone, phoneMatchKeySql } from './whatsapp-phone.js';
import { AUTOMATIONS } from './ai-memory.js';

const TZ = () => process.env.KYTTO_TIMEZONE || 'America/Cuiaba';
const START = () => Math.min(23, Math.max(0, Number.parseInt(process.env.WHATSAPP_MARKETING_START_HOUR || '8', 10)));
const END = () => Math.min(24, Math.max(1, Number.parseInt(process.env.WHATSAPP_MARKETING_END_HOUR || '21', 10)));

function localParts(date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ(), hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(date).map(p => [p.type, p.value]));
  return { hour: Number(parts.hour), minute: Number(parts.minute) };
}

// Janela de envio. Fora dela, devolve o próximo início (hoje ou amanhã) em horário real.
export function marketingWindow(now = new Date()) {
  const { hour, minute } = localParts(now);
  if (hour >= START() && hour < END()) return { open: true };
  const minutesNow = hour * 60 + minute;
  let wait = START() * 60 - minutesNow;
  if (wait <= 0) wait += 24 * 60;
  return { open: false, nextOpen: new Date(now.getTime() + wait * 60000 + 60000) };
}

export async function marketingPhoneForTask(task, database = db) {
  if (task.tipo === 'enviar_campanha') {
    const row = (await database.query(
      `SELECT cl.telefone FROM envios_campanha ec JOIN clientes cl ON cl.id = ec.cliente_id AND cl.empresa_id = ec.empresa_id
        WHERE ec.id::text = $1 AND ec.empresa_id = $2`, [String(task.payload?.campaignDeliveryId || ''), task.empresa_id])).rows[0];
    return canonicalWhatsappPhone(row?.telefone);
  }
  if (task.tipo === 'automacao_ia') return canonicalWhatsappPhone(task.payload?.telefone);
  if (task.tipo === 'recuperar_carrinho') {
    const row = (await database.query(
      `SELECT cu.telefone FROM commerce_carts c JOIN commerce_customers cu ON cu.empresa_id = c.empresa_id AND cu.id = c.customer_id
        WHERE c.id::text = $1 AND c.empresa_id = $2`, [String(task.referencia_externa || ''), task.empresa_id])).rows[0];
    return canonicalWhatsappPhone(row?.telefone);
  }
  return '';
}

// Decide o que fazer com a tarefa agora: enviar, adiar (horário ou limite) ou pular (SAIR).
export async function marketingGate(task, { now = new Date(), database = db } = {}) {
  // Automação do atendente com finalidade de marketing (reativação, aniversário, oferta…)
  // passa pela mesma regra na hora do envio, não só quando entrou na fila.
  const automacaoMarketing = task.tipo === 'automacao_ia' && AUTOMATIONS[task.payload?.automacao]?.finalidade === 'marketing';
  if (!['enviar_campanha', 'recuperar_carrinho'].includes(task.tipo) && !automacaoMarketing) return { action: 'go' };
  const window = marketingWindow(now);
  if (!window.open) return { action: 'defer', until: window.nextOpen, reason: 'fora_do_horario' };
  const phone = await marketingPhoneForTask(task, database);
  if (!phone) return { action: 'go' };
  const log = await database.query(
    `SELECT automacao, status, criado_em FROM ai_automation_log
      WHERE empresa_id = $1 AND ${phoneMatchKeySql('telefone')} = ${phoneMatchKeySql('$2')}
        AND ((automacao = 'opt_out') OR (status = 'enviada' AND criado_em > $3::timestamptz - INTERVAL '24 hours'))
      ORDER BY criado_em DESC LIMIT 5`,
    [task.empresa_id, phone, now.toISOString()],
  ).catch(error => (error?.code === '42P01' ? { rows: [] } : Promise.reject(error)));
  if (log.rows.some(row => row.automacao === 'opt_out')) return { action: 'skip', reason: 'cliente_pediu_sair', phone };
  // O consentimento do carrinho é uma caixa marcada no checkout, sem confirmar o número.
  // Por padrão, o lembrete só vai para número que já falou com a loja pelo WhatsApp ou
  // que autorizou marketing no CRM; assim ninguém recebe mensagem por um número digitado por outro.
  if (task.tipo === 'recuperar_carrinho' && String(process.env.CART_RECOVERY_REQUIRE_VERIFIED_PHONE ?? '1') !== '0') {
    const verified = await database.query(
      `SELECT 1 FROM whatsapp_ai_sessions WHERE empresa_id = $1 AND ${phoneMatchKeySql('telefone')} = ${phoneMatchKeySql('$2')}
       UNION ALL
       SELECT 1 FROM commerce_carts ct WHERE ct.empresa_id = $1 AND ct.id::text = $3 AND ct.recovery_evidence->>'phoneVerified' = 'true'
       UNION ALL
       SELECT 1 FROM consentimentos_cliente cc JOIN clientes c ON c.id = cc.cliente_id AND c.empresa_id = cc.empresa_id
        WHERE cc.empresa_id = $1 AND cc.canal = 'whatsapp' AND cc.finalidade = 'marketing' AND cc.concedido = true
          AND ${phoneMatchKeySql('c.telefone')} = ${phoneMatchKeySql('$2')}
       LIMIT 1`,
      [task.empresa_id, phone, String(task.referencia_externa || '')],
    ).catch(error => (error?.code === '42P01' ? { rows: [] } : Promise.reject(error)));
    if (!verified.rows[0]) return { action: 'skip', reason: 'telefone_nao_verificado', phone };
  }
  const last = log.rows.find(row => row.status === 'enviada');
  if (last) return { action: 'defer', until: new Date(new Date(last.criado_em).getTime() + 24 * 3600000 + 60000), reason: 'limite_24h', phone };
  return { action: 'go', phone };
}

export async function recordMarketingSend(task, phone, database = db) {
  // A automação já grava o próprio envio em ai_automation_log.
  if (!phone || task.tipo === 'automacao_ia') return;
  const kind = task.tipo === 'enviar_campanha' ? 'campanha' : 'carrinho';
  const ref = String(task.payload?.campaignDeliveryId || task.referencia_externa || task.id).slice(0, 160);
  await database.query(
    `INSERT INTO ai_automation_log (empresa_id, telefone, automacao, referencia, status, motivo)
     VALUES ($1, $2, $3, $4, 'enviada', 'marketing') ON CONFLICT (empresa_id, automacao, telefone, referencia) DO NOTHING`,
    [task.empresa_id, phone, kind, ref],
  ).catch(() => null);
}
