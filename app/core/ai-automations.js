// Automações do cérebro do atendente, com governança fixa:
// - cada automação nasce desligada e só roda com o cérebro ativo;
// - marketing exige consentimento de marketing; pós-atendimento exige o de atendimento;
// - horário silencioso 21h–8h (Cuiabá): nada é enfileirado;
// - no máximo 1 mensagem de marketing a cada 14 dias por cliente;
// - teto diário por unidade (padrão 60, bem abaixo do aquecimento do número);
// - toda mensagem termina com a opção SAIR; a referência impede repetir o mesmo envio.

import { createHash } from 'node:crypto';
import { db } from './database.js';
import { enviarMensagem } from './whatsapp.js';
import { AUTOMATIONS, getBrainSettings, whatsappConsentMap } from './ai-memory.js';
import * as clientesLocais from '../clientes-contas-kytto.js';
import { graphPhone, nextBestOffers, plainText, productKey, isAnonymized, SEND_THRESHOLD } from '../dino-grafo.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TZ = 'America/Cuiaba';
export const MARKETING_COOLDOWN_DAYS = 14;
export const DAILY_CAP = Math.min(400, Math.max(1, Number.parseInt(process.env.AI_AUTOMATION_DAILY_CAP || '60', 10) || 60));
const DAY = 86400000;
const OPT_OUT_LINE = 'Para não receber estas mensagens, responda SAIR.';
const IDENTITY_SOURCES = ['clients', 'appointments', 'commands', 'retailSales', 'pedidos'];

function hasCompleteIdentityCoverage(graph) {
  const sources = graph?.quality?.fontes;
  return IDENTITY_SOURCES.every((name) => sources?.[name]?.status === 'ok');
}

function firstName(value) {
  const name = String(value || '').trim().split(/\s+/)[0] || '';
  return name.length >= 2 && name.length <= 30 ? name : '';
}

export function localHour(now = new Date()) {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hourCycle: 'h23' }).format(now));
}

export function quietHours(now = new Date()) {
  const hour = localHour(now);
  return hour >= 21 || hour < 8;
}

function monthKey(now) { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit' }).format(now); }

/** Variante A/B determinística por telefone (só usada no nível 3 de autonomia). */
export function variantFor(phone, autonomia) {
  if (Number(autonomia) < 3) return 'A';
  let hash = 0;
  for (const ch of String(phone)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash % 2 ? 'B' : 'A';
}

export function renderMessage(automacao, variante, data = {}) {
  const nome = firstName(data.nome);
  const oi = nome ? `Oi, ${nome}!` : 'Oi!';
  const loja = data.loja || 'Dino';
  const prof = data.profissional ? ` com ${data.profissional}` : '';
  const T = {
    reativacao: {
      A: `${oi} Faz um tempinho desde seu último atendimento${prof} na ${loja}. Quer que eu veja um horário para esta semana?`,
      B: `${oi} Tá na hora de dar aquele trato no visual? Posso reservar um horário${prof} pra você. É só responder com o melhor dia.`,
    },
    pos_atendimento: {
      A: `${oi} Obrigado pela visita na ${loja}. De 1 a 5, quanto você curtiu o atendimento${prof}?`,
      B: `${oi} Valeu por vir na ${loja}! Como foi o atendimento${prof}? Responda com uma nota de 1 a 5.`,
    },
    aniversario: {
      A: `${oi} Seu aniversário está chegando e a ${loja} deseja um ótimo dia! Quer aproveitar para agendar um horário especial?`,
      B: `${oi} Parabéns adiantado! 🎉 Que tal chegar no seu dia com o visual em dia? Posso ver um horário pra você.`,
    },
    oferta_individual: {
      A: `${oi} Separei uma sugestão pra você na ${loja}: ${data.produto || 'um produto'}${data.preco ? ` (${data.preco})` : ''}. Quer que eu reserve um?`,
      B: `${oi} Lembrei de você: ${data.produto || 'um produto'} combina com o que você costuma usar. Posso separar pra você conferir no próximo horário?`,
    },
    aviso_estoque: {
      A: `${oi} O ${data.produto || 'produto'} que você procurou chegou na ${loja}. Quer que eu reserve um pra você?`,
      B: `${oi} Boa notícia: temos ${data.produto || 'o produto'} de novo. Posso separar um no seu nome?`,
    },
  };
  const text = T[automacao]?.[variante] || T[automacao]?.A;
  return text ? `${text}\n\n${OPT_OUT_LINE}` : '';
}

/**
 * Planeja as automações a partir do grafo. Puro: não grava nem envia.
 * @returns {Array<{ automacao, telefone, referencia, mensagem, variante, cliente, motivo }>}
 */
export function planAutomations({ graph, sources, settings, recentMarketing = new Map(), recentAny = new Map(), sentRefs = new Set(), now = new Date() }) {
  const out = [];
  if (!(graph?.customers instanceof Map) || !hasCompleteIdentityCoverage(graph)) return out;
  const loja = sources?.configuracao?.nomePublico || 'Dino';
  const nowMs = now.valueOf();
  const catalogInStock = (sources?.catalog || []).filter((item) => item.publicado !== false && Number(item.estoque) > 0);
  const offers = settings.automacoes?.oferta_individual
    ? new Map(nextBestOffers(graph, { catalog: sources?.catalog || [], services: [], limit: 500, onlyConsented: true, minScore: SEND_THRESHOLD })
      .filter((row) => row.enviar && row.melhor.tipo === 'produto').map((row) => [graph.byToken?.get(row.cliente.chave), row.melhor]))
    : new Map();
  for (const c of graph.customers.values()) {
    const phone = graphPhone(c.phone);
    if (!phone || c.identityUnresolved || c.automationBlocked) continue;
    const variante = variantFor(phone, settings.autonomia);
    const profissional = c.favoriteProfessional ? graph.professionalNames.get(c.favoriteProfessional) : null;
    const base = { telefone: phone, cliente: c.nome || 'Cliente', variante };
    if (c.consent.optOut) continue; // pediu para não receber mensagens automáticas
    const lastAny = recentAny.get(phone);
    if (lastAny && nowMs - lastAny < DAY) continue; // no máximo uma mensagem automática por cliente a cada 24 h
    const push = (automacao, referencia, motivo, data = {}) => {
      if (!settings.automacoes?.[automacao]) return;
      if (sentRefs.has(`${automacao}|${phone}|${referencia}`)) return;
      const finalidade = AUTOMATIONS[automacao].finalidade;
      if (finalidade === 'marketing') {
        if (!c.consent.marketing) return;
        const last = recentMarketing.get(phone);
        if (last && nowMs - last < MARKETING_COOLDOWN_DAYS * DAY) return;
      } else if (!c.consent.atendimento) return;
      out.push({ ...base, automacao, referencia, motivo, mensagem: renderMessage(automacao, variante, { nome: c.nome, loja, profissional, ...data }) });
    };
    // Pós-atendimento: comanda paga entre 2 h e 30 h atrás
    if (c.lastCommand) {
      const age = nowMs - new Date(c.lastCommand.at).valueOf();
      if (age >= 2 * 3600000 && age <= 30 * 3600000) {
        const prof = c.lastCommand.profissionalId ? graph.professionalNames.get(c.lastCommand.profissionalId) : profissional;
        push('pos_atendimento', `comanda:${c.lastCommand.id}`, 'atendimento pago nas últimas 30 h', { profissional: prof });
      }
    }
    // Reativação: passou de 1,5× o intervalo habitual, sem horário marcado, até 180 dias
    if (c.interval && c.daysSince !== null && c.visits.length >= 2 && !c.nextAppointmentMs
        && c.daysSince > 1.5 * c.interval && c.daysSince <= 180) {
      push('reativacao', `ciclo:${new Date(c.lastVisitMs).toISOString().slice(0, 10)}`, `${c.daysSince} dias sem vir (habitual ${c.interval})`);
    }
    // Aniversário: 3 dias antes
    if (c.birthdayIn === 3) push('aniversario', `ano:${now.getUTCFullYear()}`, 'aniversário em 3 dias');
    // Aviso de estoque: interesse ativo em produto que está disponível
    for (const interest of c.interests.filter((i) => i.categoria === 'produto_interesse' && i.texto)) {
      const product = catalogInStock.find((item) => { const n = plainText(item.nome); return n.includes(interest.texto) || interest.texto.includes(n); });
      if (product && !c.products.has(productKey(product))) {
        push('aviso_estoque', `produto:${product.id}:${monthKey(now)}`, `interesse em ${product.nome}`, { produto: product.nome });
        break;
      }
    }
    // Próxima melhor oferta: só produto com estoque, score ≥ 0,60 e consentimento
    const offer = offers.get(c.key);
    if (offer) push('oferta_individual', `oferta:${offer.id}:${monthKey(now)}`, `score ${offer.score.toFixed(2)}: ${offer.motivos.join('; ') || 'afinidade'}`, { produto: offer.nome, preco: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(offer.preco) });
  }
  // Uma automação por cliente por rodada (prioridade: pós-atendimento, estoque, aniversário, reativação)
  const priority = { pos_atendimento: 0, aviso_estoque: 1, aniversario: 2, reativacao: 3, oferta_individual: 4 };
  const byPhone = new Map();
  for (const item of out.sort((a, b) => priority[a.automacao] - priority[b.automacao])) if (!byPhone.has(item.telefone)) byPhone.set(item.telefone, item);
  return [...byPhone.values()];
}

export async function automationGuards(empresaId, lojaId, { now = new Date(), queryRead = db.queryRead } = {}) {
  if (!UUID.test(String(empresaId || '')) || !UUID.test(String(lojaId || ''))) {
    throw Object.assign(new Error('Selecione uma unidade válida para consultar os limites das automações.'), { code: 'STORE_SCOPE_REQUIRED' });
  }
  const [recent, refs, today, any] = await Promise.all([
    queryRead(
      `SELECT telefone, MAX(criado_em) AS ultimo FROM ai_automation_log
        WHERE empresa_id = $1 AND loja_id = $2 AND status IN ('enfileirada','enviada','falhou') AND automacao NOT IN ('pos_atendimento','opt_out')
          AND criado_em >= CURRENT_TIMESTAMP - ($3::text || ' days')::interval
        GROUP BY telefone`,
      [empresaId, lojaId, MARKETING_COOLDOWN_DAYS],
    ),
    queryRead(`SELECT automacao, telefone, referencia FROM ai_automation_log
                WHERE empresa_id = $1 AND loja_id = $2 AND status IN ('enfileirada','enviada','falhou')
                  AND criado_em >= CURRENT_TIMESTAMP - INTERVAL '400 days'`, [empresaId, lojaId]),
    queryRead(
      `SELECT COUNT(*)::int AS total FROM ai_automation_log
        WHERE empresa_id = $1 AND loja_id = $2 AND status IN ('enfileirada','enviada')
          AND criado_em >= date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE '${TZ}') AT TIME ZONE '${TZ}'`,
      [empresaId, lojaId],
    ),
    queryRead(
      `SELECT telefone, MAX(criado_em) AS ultimo FROM ai_automation_log
        WHERE empresa_id = $1 AND loja_id = $2 AND status IN ('enfileirada','enviada','falhou') AND automacao <> 'opt_out' AND criado_em >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
        GROUP BY telefone`,
      [empresaId, lojaId],
    ),
  ]);
  return {
    recentAny: new Map(any.rows.map((row) => [row.telefone, new Date(row.ultimo).valueOf()])),
    recentMarketing: new Map(recent.rows.map((row) => [row.telefone, new Date(row.ultimo).valueOf()])),
    sentRefs: new Set(refs.rows.map((row) => `${row.automacao}|${row.telefone}|${row.referencia}`)),
    sentToday: Number(today.rows[0]?.total || 0),
    quiet: quietHours(now),
  };
}

/** Coloca na fila os envios planejados, respeitando horário e teto diário. */
export async function enqueueAutomations(empresaId, lojaId, planned = [], { quiet = false } = {}) {
  if (!UUID.test(String(empresaId || '')) || !UUID.test(String(lojaId || ''))) return { queued: 0, blocked: planned.length, reason: 'escopo_invalido' };
  if (quiet) return { queued: 0, blocked: planned.length, reason: 'horario_silencioso' };
  return db.transaction(async (trx) => {
    // Serializa a quota do dia local por empresa+unidade; sentToday do preview é apenas informativo.
    await trx.query(
      `SELECT pg_advisory_xact_lock(hashtextextended('ai-automation:' || $1::text || ':' || $2::text || ':' || to_char(CURRENT_TIMESTAMP AT TIME ZONE '${TZ}', 'YYYY-MM-DD'), 0))`,
      [empresaId, lojaId],
    );
    const sent = await trx.query(
      `SELECT COUNT(*)::int AS total FROM ai_automation_log
        WHERE empresa_id = $1 AND loja_id = $2 AND status IN ('enfileirada','enviada')
          AND criado_em >= date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE '${TZ}') AT TIME ZONE '${TZ}'`,
      [empresaId, lojaId],
    );
    const sentToday = Number(sent.rows[0]?.total || 0);
    const room = Math.max(0, DAILY_CAP - sentToday);
    if (!room) return { queued: 0, blocked: planned.length, reason: 'teto_diario' };
    const canal = await trx.query(
      `SELECT id FROM canais_integracao WHERE empresa_id = $1 AND loja_id = $2 AND provedor = 'whatsapp' AND status = 'ativo'
        ORDER BY data_atualizacao DESC NULLS LAST LIMIT 1`,
      [empresaId, lojaId],
    );
    if (!canal.rows[0]) return { queued: 0, blocked: planned.length, reason: 'canal_inativo' };
    let queued = 0;
    for (const item of planned.slice(0, room)) {
      const log = await trx.query(
        `INSERT INTO ai_automation_log (empresa_id, loja_id, telefone, automacao, referencia, status, motivo)
         VALUES ($1,$2,$3,$4,$5,'enfileirada',$6) ON CONFLICT DO NOTHING RETURNING id`,
        [empresaId, lojaId, item.telefone, item.automacao, item.referencia, `variante ${item.variante}`],
      );
      if (!log.rows[0]) continue;
      const task = await trx.query(
        `INSERT INTO tarefas_integracao_canais (empresa_id, loja_id, canal_id, tipo, referencia_externa, payload, status, proxima_tentativa_em)
         VALUES ($1,$2,$3,'automacao_ia',$4,$5::jsonb,'pendente',CURRENT_TIMESTAMP)
         ON CONFLICT (empresa_id, tipo, referencia_externa) WHERE tipo = 'automacao_ia' DO NOTHING RETURNING id`,
        [empresaId, lojaId, canal.rows[0].id, `${lojaId}:${item.automacao}:${item.telefone}:${createHash('sha256').update(String(item.referencia)).digest('hex')}`,
          JSON.stringify({ version: 'ai-automation-v1', logId: log.rows[0].id, automacao: item.automacao, telefone: item.telefone, mensagem: item.mensagem, variante: item.variante })],
      );
      if (!task.rows[0]) {
        await trx.query(`DELETE FROM ai_automation_log WHERE id = $1 AND empresa_id = $2 AND loja_id = $3`, [log.rows[0].id, empresaId, lojaId]);
        continue;
      }
      queued += 1;
    }
    return {
      queued,
      blocked: Math.max(0, planned.length - queued),
      reason: planned.length > room ? 'teto_diario_parcial' : queued < planned.length ? 'duplicado' : null,
    };
  });
}

function deliveryError(message, code, retryable = false) {
  return Object.assign(new Error(message), { code, retryable });
}

export async function markAutomationTaskBlocked(task = {}, reason = 'marketing_gate_skip') {
  const logId = String(task.payload?.logId || '');
  if (!UUID.test(String(task.empresa_id || '')) || !UUID.test(String(task.loja_id || '')) || !UUID.test(logId)) {
    throw deliveryError('unidade e log são obrigatórios para bloquear a automação', 'STORE_SCOPE_REQUIRED', false);
  }
  if (task.delivery_started_at) throw deliveryError('envio já iniciado; exige reconciliação, não bloqueio', 'AUTOMATION_DELIVERY_UNKNOWN', false);
  const result = await db.query(
    `UPDATE ai_automation_log SET status = 'bloqueada', motivo = $4
      WHERE id = $1 AND empresa_id = $2 AND loja_id = $3 AND status = 'enfileirada'
      RETURNING id`,
    [logId, task.empresa_id, task.loja_id, String(reason).slice(0, 80)],
  );
  if (result.rows[0]) return { blocked: true };
  const current = await db.query(
    `SELECT status FROM ai_automation_log WHERE id = $1 AND empresa_id = $2 AND loja_id = $3 LIMIT 1`,
    [logId, task.empresa_id, task.loja_id],
  );
  if (['bloqueada', 'enviada', 'falhou'].includes(current.rows[0]?.status)) return { blocked: current.rows[0].status === 'bloqueada', already: true };
  throw deliveryError('registro da automação não pode ser bloqueado', 'AUTOMATION_LOG_UPDATE_FAILED', true);
}

/**
 * Consentimento no momento do envio: CRM/WhatsApp (PostgreSQL) + cadastro da barbearia.
 * Qualquer erro de leitura bloqueia o envio.
 */
export async function sendTimeConsent(empresaId, phone, finalidade, { consentMap = whatsappConsentMap, localClients = null } = {}) {
  let pg;
  try { pg = (await consentMap(empresaId, { phone })).get(phone) || null; } catch { return { ok: false, reason: 'consentimento_indisponivel' }; }
  if (pg?.optOut) return { ok: false, reason: 'opt_out' };
  let local = [];
  try {
    const list = localClients || clientesLocais.listarClientes(String(empresaId)).map((c) => clientesLocais.obterCliente(String(empresaId), c.id) || c);
    local = list.filter((c) => graphPhone(c.telefone) === phone);
  } catch { return { ok: false, reason: 'cadastro_indisponivel' }; }
  if (local.some(isAnonymized)) return { ok: false, reason: 'cliente_anonimizado' };
  if (new Set(local.map(c => c.id)).size > 1) return { ok: false, reason: 'identidade_ambigua' };
  const localFlag = (field) => local.some((c) => c.consentimentos?.whatsapp?.[field]?.concedido === true);
  if (finalidade === 'marketing') {
    if (pg?.marketing === false) return { ok: false, reason: 'sem_consentimento_marketing' };
    return (pg?.marketing === true || localFlag('marketing')) ? { ok: true } : { ok: false, reason: 'sem_consentimento_marketing' };
  }
  return localFlag('atendimento') || pg?.personalizacao === true ? { ok: true } : { ok: false, reason: 'sem_consentimento_atendimento' };
}

/** Executado pelo worker do WhatsApp para tarefas "automacao_ia". */
export async function processAutomationTask(task = {}) {
  const payload = task.payload || {};
  if (!UUID.test(String(task.empresa_id || '')) || !UUID.test(String(task.loja_id || ''))) {
    throw deliveryError('unidade ausente ou inválida na tarefa de automação', 'STORE_SCOPE_REQUIRED', false);
  }
  if (!UUID.test(String(payload.logId || ''))) throw deliveryError('registro da automação inválido', 'AUTOMATION_LOG_INVALID', false);
  const stored = await db.query(
    `SELECT status, automacao, telefone FROM ai_automation_log
      WHERE id = $1 AND empresa_id = $2 AND loja_id = $3 LIMIT 1`,
    [payload.logId, task.empresa_id, task.loja_id],
  );
  const existing = stored.rows[0];
  if (!existing) throw deliveryError('registro da automação não encontrado nesta unidade', 'AUTOMATION_LOG_NOT_FOUND', false);
  if (existing.automacao !== payload.automacao || graphPhone(existing.telefone) !== graphPhone(payload.telefone)) {
    throw deliveryError('registro da automação não corresponde à tarefa', 'AUTOMATION_LOG_SCOPE_MISMATCH', false);
  }
  if (existing.status === 'enviada') return { sent: true, idempotent: true, automacao: payload.automacao, variante: payload.variante };
  if (existing.status === 'bloqueada') return { skipped: true, reason: 'automation_already_blocked' };
  if (task.delivery_started_at) throw deliveryError('resultado anterior incerto; revisão humana', 'AUTOMATION_DELIVERY_UNKNOWN', false);
  if (existing.status === 'falhou') {
    const reset = await db.query(
      `UPDATE ai_automation_log SET status = 'enfileirada', criado_em = CURRENT_TIMESTAMP
        WHERE id = $1 AND empresa_id = $2 AND loja_id = $3 AND status = 'falhou' RETURNING id`,
      [payload.logId, task.empresa_id, task.loja_id],
    );
    if (!reset.rows[0]) throw deliveryError('o estado do log mudou antes do retry', 'AUTOMATION_LOG_STATE_CHANGED', true);
  } else if (existing.status !== 'enfileirada') {
    throw deliveryError('estado da automação não permite envio', 'AUTOMATION_LOG_STATE_INVALID', false);
  }
  const settings = await getBrainSettings(task.empresa_id);
  const mark = async (status, motivo) => {
    const result = await db.query(
      `UPDATE ai_automation_log
          SET status = $4, motivo = COALESCE($5, motivo),
              criado_em = CASE WHEN $4 = 'enviada' THEN CURRENT_TIMESTAMP ELSE criado_em END
        WHERE id = $1 AND empresa_id = $2 AND loja_id = $3 AND status = 'enfileirada'
        RETURNING id`,
      [payload.logId, task.empresa_id, task.loja_id, status, motivo || null],
    );
    if (!result.rows[0]) throw deliveryError('não foi possível registrar o estado da automação', 'AUTOMATION_LOG_UPDATE_FAILED', true);
    return result.rows[0];
  };
  if (!settings.ativo || !settings.automacoes?.[payload.automacao]) { await mark('bloqueada', 'desligada_antes_do_envio'); return { skipped: true, reason: 'automation_disabled' }; }
  if (quietHours()) { await mark('bloqueada', 'horario_silencioso'); return { skipped: true, reason: 'quiet_hours' }; }
  const phone = graphPhone(payload.telefone);
  if (!phone || !payload.mensagem) { await mark('bloqueada', 'payload_invalido'); return { skipped: true, reason: 'payload_invalid' }; }
  const consent = await sendTimeConsent(task.empresa_id, phone, AUTOMATIONS[payload.automacao]?.finalidade || 'marketing');
  if (!consent.ok) { await mark('bloqueada', consent.reason); return { skipped: true, reason: consent.reason }; }
  const channel = await db.query(
    `SELECT id, api_base_url, configuracao FROM canais_integracao
      WHERE id = $1 AND empresa_id = $2 AND loja_id = $3 AND provedor = 'whatsapp' AND status = 'ativo' LIMIT 1`,
    [task.canal_id, task.empresa_id, task.loja_id],
  );
  const canal = channel.rows[0];
  if (!canal) { await mark('bloqueada', 'canal_inativo'); return { skipped: true, reason: 'whatsapp_channel_inactive' }; }
  const claimed = await db.query(`UPDATE tarefas_integracao_canais SET delivery_started_at = CURRENT_TIMESTAMP WHERE id = $1 AND status = 'processando' AND lease_token = $2::uuid AND delivery_started_at IS NULL`, [task.id, task.lease_token]);
  if (!claimed.rowCount) return { skipped: true, reason: 'lease_lost' };
  const result = await enviarMensagem({
    whatsapp_api_url: process.env.EVOLUTION_API_URL || canal.api_base_url,
    whatsapp_api_key: process.env.EVOLUTION_API_KEY,
    whatsapp_instance: canal.configuracao?.instance || process.env.EVOLUTION_INSTANCE,
    empresa_id: task.empresa_id, loja_id: task.loja_id, canal_id: task.canal_id,
  }, phone, String(payload.mensagem).slice(0, 1200));
  if (!result?.ok) {
    const unknown = result?.uncertain === true;
    if (!unknown) await db.query(
      `UPDATE tarefas_integracao_canais SET delivery_started_at = NULL
        WHERE id = $1 AND empresa_id = $2 AND loja_id = $3 AND canal_id = $4 AND lease_token = $5::uuid`,
      [task.id, task.empresa_id, task.loja_id, task.canal_id, task.lease_token],
    );
    await mark(unknown ? 'enfileirada' : 'falhou', unknown ? 'resultado_incerto' : 'envio_recusado');
    throw deliveryError(unknown ? 'resultado do envio incerto' : 'envio recusado', unknown ? 'AUTOMATION_DELIVERY_UNKNOWN' : 'AUTOMATION_SEND_FAILED', !unknown && result?.retryable === true);
  }
  await mark('enviada', null);
  return { sent: true, automacao: payload.automacao, variante: payload.variante };
}

/** Rodada completa para uma unidade: carrega dados, planeja, aplica travas e enfileira. */
export async function runAutomationRound({ empresaId, lojaId, loadGraph, now = new Date(), dryRun = false,
  getSettings = getBrainSettings, loadGuards = automationGuards, queue = enqueueAutomations } = {}) {
  if (!UUID.test(String(empresaId || '')) || !UUID.test(String(lojaId || ''))) return { skipped: true, reason: 'escopo_invalido', planned: [] };
  const settings = await getSettings(empresaId);
  if (!settings.ativo) return { skipped: true, reason: 'cerebro_desligado', planned: [] };
  const { graph, sources } = await loadGraph();
  const guards = await loadGuards(empresaId, lojaId, { now });
  const planned = planAutomations({ graph, sources, settings, recentMarketing: guards.recentMarketing, recentAny: guards.recentAny, sentRefs: guards.sentRefs, now });
  const missingIdentitySources = IDENTITY_SOURCES.filter((name) => graph?.quality?.fontes?.[name]?.status !== 'ok');
  const identityCoverage = {
    status: missingIdentitySources.length ? 'limitado' : 'ok',
    ...(missingIdentitySources.length ? { detail: `Prévia bloqueada: cobertura incompleta de ${missingIdentitySources.join(', ')}.` } : {}),
  };
  if (dryRun) return { skipped: false, dryRun: true, planned, identityCoverage, guards: { sentToday: guards.sentToday, quiet: guards.quiet, dailyCap: DAILY_CAP } };
  if (missingIdentitySources.length) return { skipped: true, reason: 'identity_coverage_incomplete', planned: 0, blocked: 0, identityCoverage };
  const result = await queue(empresaId, lojaId, planned, guards);
  return { skipped: false, planned: planned.length, ...result };
}

/** Resultado por automação e variante: enviadas e quantos voltaram (visita/compra) em 14 dias. */
export function automationResults(logRows = [], graph) {
  const byKey = new Map();
  for (const row of logRows) {
    if (row.status !== 'enviada' || !AUTOMATIONS[row.automacao]) continue;
    const variante = String(row.motivo || '').match(/variante ([AB])/)?.[1] || 'A';
    const key = `${row.automacao}|${variante}`;
    if (!byKey.has(key)) byKey.set(key, { automacao: row.automacao, label: AUTOMATIONS[row.automacao]?.label || row.automacao, variante, enviadas: 0, voltaram: 0 });
    const item = byKey.get(key);
    item.enviadas += 1;
    const c = graph?.customers?.get(row.telefone);
    const sentAt = new Date(row.criado_em).valueOf();
    if (c && c.visits.some((v) => { const t = new Date(v).valueOf(); return t > sentAt && t - sentAt <= 14 * DAY; })) item.voltaram += 1;
  }
  return [...byKey.values()].map((item) => ({ ...item, taxa: item.enviadas ? Math.round((item.voltaram / item.enviadas) * 1000) / 10 : 0 }));
}

export { nextBestOffers };
