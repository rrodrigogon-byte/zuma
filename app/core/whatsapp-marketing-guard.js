// Regras comuns para mensagens de marketing no WhatsApp (campanhas e carrinho abandonado):
// horário comercial no fuso da loja, no máximo uma mensagem de marketing por número/unidade a cada
// 24 horas (somando campanhas, carrinho e automações do atendente) e respeito ao SAIR permanente global.
import { db } from './database.js';
import { canonicalWhatsappPhone, phoneMatchKeySql } from './whatsapp-phone.js';
import { AUTOMATIONS } from './ai-memory.js';

const TZ = () => process.env.KYTTO_TIMEZONE || 'America/Cuiaba';
const START = () => Math.min(23, Math.max(0, Number.parseInt(process.env.WHATSAPP_MARKETING_START_HOUR || '8', 10)));
const END = () => Math.min(24, Math.max(1, Number.parseInt(process.env.WHATSAPP_MARKETING_END_HOUR || '21', 10)));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  if (!UUID.test(String(task.empresa_id || '')) || !UUID.test(String(task.loja_id || ''))) return '';
  if (task.tipo === 'enviar_campanha') {
    const row = (await database.query(
      `SELECT cl.telefone FROM envios_campanha ec JOIN clientes cl ON cl.id = ec.cliente_id AND cl.empresa_id = ec.empresa_id
        WHERE ec.id::text = $1 AND ec.empresa_id = $2 AND ec.loja_id = $3`,
      [String(task.payload?.campaignDeliveryId || ''), task.empresa_id, task.loja_id])).rows[0];
    return canonicalWhatsappPhone(row?.telefone);
  }
  if (task.tipo === 'automacao_ia') return canonicalWhatsappPhone(task.payload?.telefone);
  if (task.tipo === 'recuperar_carrinho') {
    const row = (await database.query(
      `SELECT cu.telefone FROM commerce_carts c
        JOIN commerce_storefronts sf ON sf.empresa_id = c.empresa_id AND sf.id = c.storefront_id AND sf.loja_id = $3
        JOIN commerce_customers cu ON cu.empresa_id = c.empresa_id AND cu.id = c.customer_id
        WHERE c.id::text = $1 AND c.empresa_id = $2`,
      [String(task.referencia_externa || ''), task.empresa_id, task.loja_id])).rows[0];
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
  if (!UUID.test(String(task.empresa_id || '')) || !UUID.test(String(task.loja_id || ''))) return { action: 'skip', reason: 'escopo_unidade_obrigatorio' };
  const window = marketingWindow(now);
  if (!window.open) return { action: 'defer', until: window.nextOpen, reason: 'fora_do_horario' };
  const phone = await marketingPhoneForTask(task, database);
  if (!phone) return { action: 'skip', reason: 'destino_unidade_nao_verificado' };
  const ownReference = task.tipo === 'enviar_campanha'
    ? String(task.payload?.campaignDeliveryId || '')
    : task.tipo === 'recuperar_carrinho' ? String(task.referencia_externa || '') : null;
  const ownLogId = task.tipo === 'automacao_ia' && UUID.test(String(task.payload?.logId || ''))
    ? task.payload.logId
    : null;
  if (task.tipo === 'automacao_ia' && !ownLogId) return { action: 'skip', reason: 'automation_log_invalid', phone };
  const log = await database.query(
    `SELECT id, automacao, status, referencia, criado_em FROM ai_automation_log
      WHERE empresa_id = $1 AND ${phoneMatchKeySql('telefone')} = ${phoneMatchKeySql('$2')}
        AND (automacao = 'opt_out' OR (
          loja_id = $3 AND status IN ('enfileirada','enviada')
          AND criado_em > $4::timestamptz - INTERVAL '24 hours'
          AND ($5::text IS NULL OR referencia <> $5)
          AND ($6::uuid IS NULL OR id <> $6::uuid)
        ))
      ORDER BY (automacao = 'opt_out') DESC, criado_em DESC LIMIT 6`,
    [task.empresa_id, phone, task.loja_id, now.toISOString(), ownReference, ownLogId],
  );
  if (log.rows.some(row => row.automacao === 'opt_out')) return { action: 'skip', reason: 'cliente_pediu_sair', phone };
  // O consentimento do carrinho é uma caixa marcada no checkout, sem confirmar o número.
  // Por padrão, o lembrete só vai para número que já falou com a loja pelo WhatsApp ou
  // que autorizou marketing no CRM; assim ninguém recebe mensagem por um número digitado por outro.
  if (task.tipo === 'recuperar_carrinho' && String(process.env.CART_RECOVERY_REQUIRE_VERIFIED_PHONE ?? '1') !== '0') {
    const verified = await database.query(
      `SELECT 1 FROM whatsapp_ai_sessions WHERE empresa_id = $1 AND loja_id = $3 AND ${phoneMatchKeySql('telefone')} = ${phoneMatchKeySql('$2')}
       UNION ALL
       SELECT 1 FROM commerce_carts ct JOIN commerce_storefronts sf
         ON sf.empresa_id = ct.empresa_id AND sf.id = ct.storefront_id AND sf.loja_id = $3
        WHERE ct.empresa_id = $1 AND ct.id::text = $4 AND ct.recovery_evidence->>'phoneVerified' = 'true'
       UNION ALL
       SELECT 1 FROM consentimentos_cliente cc JOIN clientes c ON c.id = cc.cliente_id AND c.empresa_id = cc.empresa_id
        WHERE cc.empresa_id = $1 AND cc.canal = 'whatsapp' AND cc.finalidade = 'marketing' AND cc.concedido = true
          AND ${phoneMatchKeySql('c.telefone')} = ${phoneMatchKeySql('$2')}
       LIMIT 1`,
      [task.empresa_id, phone, task.loja_id, String(task.referencia_externa || '')],
    ).catch(error => (error?.code === '42P01' ? { rows: [] } : Promise.reject(error)));
    if (!verified.rows[0]) return { action: 'skip', reason: 'telefone_nao_verificado', phone };
  }
  const last = log.rows.find(row => ['enfileirada', 'enviada'].includes(row.status));
  if (last) return { action: 'defer', until: new Date(new Date(last.criado_em).getTime() + 24 * 3600000 + 60000), reason: 'limite_24h', phone };
  return { action: 'go', phone };
}

function marketingLogKey(task, phone) {
  if (task.tipo === 'automacao_ia') return null;
  if (!['enviar_campanha', 'recuperar_carrinho'].includes(task.tipo)) return null;
  if (!UUID.test(String(task.empresa_id || '')) || !UUID.test(String(task.loja_id || ''))) {
    throw Object.assign(new Error('empresa e unidade são obrigatórias no log de marketing'), { code: 'STORE_SCOPE_REQUIRED', retryable: false });
  }
  return {
    empresaId: task.empresa_id,
    lojaId: task.loja_id,
    phone: phone ? String(phone) : null,
    kind: task.tipo === 'enviar_campanha' ? 'campanha' : 'carrinho',
    ref: String(task.payload?.campaignDeliveryId || task.referencia_externa || task.id).slice(0, 160),
  };
}

export async function reserveMarketingSend(task, phone, database = db) {
  const key = marketingLogKey(task, phone);
  if (!key || !key.phone) return null;
  const result = await database.query(
    `INSERT INTO ai_automation_log (empresa_id, loja_id, telefone, automacao, referencia, status, motivo)
     VALUES ($1, $2, $3, $4, $5, 'enfileirada', 'marketing')
     ON CONFLICT (empresa_id, loja_id, automacao, telefone, referencia) WHERE loja_id IS NOT NULL
     DO UPDATE SET
       status = CASE WHEN ai_automation_log.status IN ('bloqueada','falhou') THEN 'enfileirada' ELSE ai_automation_log.status END,
       criado_em = CASE WHEN ai_automation_log.status IN ('bloqueada','falhou') THEN CURRENT_TIMESTAMP ELSE ai_automation_log.criado_em END,
       motivo = 'marketing'
     RETURNING id, status`,
    [key.empresaId, key.lojaId, key.phone, key.kind, key.ref],
  );
  if (!result.rows[0]) throw Object.assign(new Error('não foi possível reservar a janela de marketing'), { code: 'MARKETING_RESERVATION_FAILED', retryable: true });
  return result.rows[0];
}

export async function recordMarketingSend(task, phone, database = db) {
  const key = marketingLogKey(task, phone);
  if (!key || !key.phone) return;
  await reserveMarketingSend(task, phone, database);
  await database.query(
    `UPDATE ai_automation_log
        SET status = 'enviada', motivo = 'marketing',
            criado_em = CASE WHEN status = 'enviada' THEN criado_em ELSE CURRENT_TIMESTAMP END
      WHERE empresa_id = $1 AND loja_id = $2 AND telefone = $3 AND automacao = $4 AND referencia = $5
        AND status IN ('enfileirada','bloqueada','falhou')`,
    [key.empresaId, key.lojaId, key.phone, key.kind, key.ref],
  );
}

export async function markMarketingSendBlocked(task, phone, reason = 'marketing_gate_skip', database = db) {
  const key = marketingLogKey(task, phone);
  if (!key) return;
  await database.query(
    `UPDATE ai_automation_log SET status = 'bloqueada', motivo = $6
      WHERE empresa_id = $1 AND loja_id = $2 AND automacao = $3 AND referencia = $4
        AND ($5::text IS NULL OR telefone = $5) AND status = 'enfileirada'`,
    [key.empresaId, key.lojaId, key.kind, key.ref, key.phone, String(reason).slice(0, 80)],
  );
}
