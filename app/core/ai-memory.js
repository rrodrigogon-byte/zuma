import { canonicalWhatsappPhone, canonicalPhoneSql, phoneMatchKeySql } from './whatsapp-phone.js';
// Memória individual por cliente do cérebro do atendente.
// Guarda resumos de conversa e fatos (com fonte, confiança e validade) por telefone,
// dentro da empresa. Só entra no atendimento quando o cliente autorizou a personalização.
// Dados sensíveis (saúde, finanças, documentos, religião, política, sexualidade) nunca
// viram fato. O cliente ou a equipe podem contestar um fato, e "esquecer" apaga tudo.

import { db } from './database.js';
import { sensitiveCustomerData } from './whatsapp-ai-profile.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const FACT_CATEGORIES = Object.freeze({
  preferencia_horario: 'Horário preferido',
  profissional_preferido: 'Profissional preferido',
  servico_interesse: 'Interesse em serviço',
  produto_interesse: 'Interesse em produto',
  familia_olfativa: 'Família olfativa',
  estilo: 'Estilo e preferências',
  data_especial: 'Data especial',
  objecao: 'Objeção',
  canal: 'Forma de contato',
  outro: 'Outro',
});

export const AUTONOMY_LEVELS = Object.freeze([
  { level: 0, label: 'Só registra', detail: 'Resume conversas. Não cria fatos nem muda o atendimento.' },
  { level: 1, label: 'Aprende fatos', detail: 'Fatos com confiança ≥ 0,8 entram ativos; os demais ficam para revisão.' },
  { level: 2, label: 'Propõe melhorias', detail: 'Além dos fatos, redige respostas para perguntas novas. Você aprova.' },
  { level: 3, label: 'Testa mensagens', detail: 'Alterna mensagens aprovadas das automações e mede qual converte mais.' },
]);

export const AUTOMATIONS = Object.freeze({
  reativacao: { label: 'Reativação pelo intervalo', finalidade: 'marketing' },
  pos_atendimento: { label: 'Pós-atendimento e indicação', finalidade: 'atendimento' },
  aniversario: { label: 'Aniversário', finalidade: 'marketing' },
  aviso_estoque: { label: 'Chegou o que você queria', finalidade: 'marketing' },
  oferta_individual: { label: 'Próxima melhor oferta (score ≥ 0,60)', finalidade: 'marketing' },
});

const SENSITIVE_TOPICS = /(alerg|doen[cç]|rem[eé]dio|medica[cç]|diabet|hipertens|press[aã]o alta|gr[aá]vid|gesta[cç]|depress|ansiedad|psic[oó]l|psiquiatr|terapia|hiv|c[aâ]ncer|tratamento|cirurgi|defici[eê]nci|sal[aá]rio|renda|d[ií]vida|empr[eé]stimo|serasa|spc|cpf|rg\b|cart[aã]o|senha|conta banc|pix\b|religi|igreja|pol[ií]tic|partido|vot[oa]|orienta[cç][aã]o sexual|gay|l[eé]sbica|bissexual|trans\b|racial|etnia|sindicat|preso|pris[aã]o|processo judicial|pol[ií]cia)/i;

function clean(value, limit = 300) {
  return String(value ?? '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
}

export function memoryPhone(value) {
  const canonical = canonicalWhatsappPhone(value);
  if (canonical) return canonical;
  let digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return digits.length >= 12 && digits.length <= 15 ? digits : '';
}

function uuid(value, field = 'empresaId') {
  const text = String(value || '');
  if (!UUID.test(text)) throw Object.assign(new Error(`${field} inválido`), { status: 400, code: 'VALIDATION_ERROR' });
  return text;
}

export function isSensitiveFact(text) {
  const value = String(text || '');
  return SENSITIVE_TOPICS.test(value) || Boolean(sensitiveCustomerData(value));
}

/** Normaliza um fato vindo da IA. Devolve null quando não serve ou é sensível. */
export function normalizeFact(raw = {}) {
  const categoria = Object.hasOwn(FACT_CATEGORIES, raw.categoria) ? raw.categoria : 'outro';
  const valor = clean(raw.valor, 300);
  const chaveBase = clean(raw.chave || categoria, 60).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const trecho = clean(raw.trecho, 300);
  const confianca = Math.min(1, Math.max(0, Number(raw.confianca)));
  if (!valor || valor.length < 2 || !chaveBase || !Number.isFinite(confianca)) return null;
  if (isSensitiveFact(`${chaveBase} ${valor} ${trecho}`)) return null;
  // Data especial: só dia/mês de aniversário, nunca ano (evita inferir idade)
  if (categoria === 'data_especial' && !/^(anivers[aá]rio|casamento|namoro)?\s*[:\-]?\s*\d{1,2}\/\d{1,2}$/i.test(valor.replace(/\s+/g, ' '))) return null;
  return { chave: chaveBase.slice(0, 60), valor, categoria, confianca: Math.round(confianca * 100) / 100, trecho };
}

export function initialFactStatus(confianca, autonomia) {
  if (Number(autonomia) >= 1 && Number(confianca) >= 0.8) return 'ativo';
  return 'proposto';
}

// ── Configuração ─────────────────────────────────────────────────────────────

export function defaultBrainSettings() {
  return {
    ativo: false,
    autonomia: 1,
    tetoDiarioCentavos: 2000,
    automacoes: Object.fromEntries(Object.keys(AUTOMATIONS).map((id) => [id, false])),
  };
}

function settingsView(row) {
  const base = defaultBrainSettings();
  if (!row) return base;
  return {
    ativo: row.ativo === true,
    autonomia: Math.min(3, Math.max(0, Number(row.autonomia ?? base.autonomia))),
    tetoDiarioCentavos: Number(row.teto_diario_centavos ?? base.tetoDiarioCentavos),
    automacoes: { ...base.automacoes, ...Object.fromEntries(Object.entries(row.automacoes || {}).filter(([k]) => Object.hasOwn(AUTOMATIONS, k)).map(([k, v]) => [k, v === true])) },
    atualizadoPor: row.atualizado_por || null,
    atualizadoEm: row.atualizado_em || null,
  };
}

export async function getBrainSettings(empresaId) {
  if (!UUID.test(String(empresaId || ''))) return defaultBrainSettings();
  try {
    const result = await db.queryRead('SELECT * FROM ai_brain_settings WHERE empresa_id = $1', [empresaId]);
    return settingsView(result.rows[0]);
  } catch (error) {
    if (error?.code === '42P01') return defaultBrainSettings();
    throw error;
  }
}

export async function saveBrainSettings(empresaId, input = {}, operador = '') {
  const id = uuid(empresaId);
  const atual = await getBrainSettings(id);
  const next = {
    ativo: input.ativo === undefined ? atual.ativo : input.ativo === true,
    autonomia: input.autonomia === undefined ? atual.autonomia : Math.min(3, Math.max(0, Math.round(Number(input.autonomia)))),
    tetoDiarioCentavos: input.tetoDiarioCentavos === undefined ? atual.tetoDiarioCentavos : Math.min(1000000, Math.max(0, Math.round(Number(input.tetoDiarioCentavos)))),
    automacoes: { ...atual.automacoes },
  };
  if (!Number.isFinite(next.autonomia) || !Number.isFinite(next.tetoDiarioCentavos)) throw Object.assign(new Error('Valores inválidos'), { status: 400, code: 'VALIDATION_ERROR' });
  for (const [key, value] of Object.entries(input.automacoes || {})) if (Object.hasOwn(AUTOMATIONS, key)) next.automacoes[key] = value === true;
  const result = await db.query(
    `INSERT INTO ai_brain_settings (empresa_id, ativo, autonomia, teto_diario_centavos, automacoes, atualizado_por, atualizado_em)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6,CURRENT_TIMESTAMP)
     ON CONFLICT (empresa_id) DO UPDATE SET ativo = EXCLUDED.ativo, autonomia = EXCLUDED.autonomia,
       teto_diario_centavos = EXCLUDED.teto_diario_centavos, automacoes = EXCLUDED.automacoes,
       atualizado_por = EXCLUDED.atualizado_por, atualizado_em = CURRENT_TIMESTAMP
     RETURNING *`,
    [id, next.ativo, next.autonomia, next.tetoDiarioCentavos, JSON.stringify(next.automacoes), clean(operador, 160) || null],
  );
  return settingsView(result.rows[0]);
}

// ── Resumos e fatos ──────────────────────────────────────────────────────────

const RESULTADOS = new Set(['agendou', 'comprou', 'duvida', 'reclamacao', 'sem_resposta', 'humano']);
const SENTIMENTOS = new Set(['positivo', 'neutro', 'negativo']);

export async function saveConversationSummary(query, { empresaId, lojaId = null, sessaoId = null, telefone, dia, resumo, resultado, sentimento, mensagens = 0, modelo = null }) {
  const phone = memoryPhone(telefone);
  if (!phone) return null;
  const texto = clean(resumo, 1200);
  if (!texto) return null;
  const result = await query(
    `INSERT INTO ai_conversation_summaries (empresa_id, loja_id, sessao_id, telefone, dia, resumo, resultado, sentimento, mensagens, modelo)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (empresa_id, telefone, dia) DO UPDATE SET resumo = EXCLUDED.resumo, resultado = EXCLUDED.resultado,
       sentimento = EXCLUDED.sentimento, mensagens = EXCLUDED.mensagens, modelo = EXCLUDED.modelo,
       sessao_id = COALESCE(EXCLUDED.sessao_id, ai_conversation_summaries.sessao_id)
     RETURNING id`,
    [uuid(empresaId), lojaId && UUID.test(lojaId) ? lojaId : null, sessaoId && UUID.test(sessaoId) ? sessaoId : null, phone, dia, texto,
      RESULTADOS.has(resultado) ? resultado : 'duvida', SENTIMENTOS.has(sentimento) ? sentimento : 'neutro', Math.max(0, Number(mensagens) || 0), clean(modelo, 120) || null],
  );
  return result.rows[0]?.id || null;
}

/**
 * Grava fatos já normalizados. Regras: fato contestado pela equipe/cliente com o mesmo
 * valor não volta; fato igual ao existente só reforça a confiança; valor novo substitui.
 */
export async function upsertFacts(query, { empresaId, telefone, facts = [], autonomia = 1, resumoId = null, modelo = null, validadeDias = 180 }) {
  const phone = memoryPhone(telefone);
  if (!phone || Number(autonomia) < 1) return { saved: 0, active: 0, proposed: 0 };
  let saved = 0; let active = 0; let proposed = 0;
  for (const raw of facts.slice(0, 12)) {
    const fact = normalizeFact(raw);
    if (!fact) continue;
    const status = initialFactStatus(fact.confianca, autonomia);
    const result = await query(
      `INSERT INTO ai_customer_facts (empresa_id, telefone, chave, valor, categoria, confianca, status, fonte_resumo_id, fonte_trecho, extraido_por, valido_ate)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, CURRENT_DATE + ($11::text || ' days')::interval)
       ON CONFLICT (empresa_id, telefone, chave) DO UPDATE SET
         valor = EXCLUDED.valor,
         categoria = EXCLUDED.categoria,
         confianca = CASE WHEN ai_customer_facts.valor = EXCLUDED.valor
                          THEN LEAST(1, GREATEST(ai_customer_facts.confianca, EXCLUDED.confianca) + 0.05)
                          ELSE EXCLUDED.confianca END,
         status = CASE WHEN ai_customer_facts.valor = EXCLUDED.valor AND ai_customer_facts.status = 'ativo' THEN 'ativo'
                       ELSE EXCLUDED.status END,
         fonte_resumo_id = EXCLUDED.fonte_resumo_id, fonte_trecho = EXCLUDED.fonte_trecho,
         extraido_por = EXCLUDED.extraido_por, valido_ate = EXCLUDED.valido_ate, atualizado_em = CURRENT_TIMESTAMP
       WHERE NOT (ai_customer_facts.status = 'contestado' AND ai_customer_facts.valor = EXCLUDED.valor)
       RETURNING status`,
      [uuid(empresaId), phone, fact.chave, fact.valor, fact.categoria, fact.confianca, status, resumoId, fact.trecho || null, clean(modelo, 120) || null, Math.max(7, Math.min(730, validadeDias))],
    );
    const row = result.rows[0];
    if (!row) continue;
    saved += 1;
    if (row.status === 'ativo') active += 1; else proposed += 1;
  }
  return { saved, active, proposed };
}

export async function expireFacts(query, empresaId) {
  const result = await query(
    `UPDATE ai_customer_facts SET status = 'expirado', atualizado_em = CURRENT_TIMESTAMP
      WHERE empresa_id = $1 AND status IN ('ativo','proposto') AND valido_ate IS NOT NULL AND valido_ate < CURRENT_DATE`,
    [uuid(empresaId)],
  );
  return Number(result.rowCount || 0);
}

function factView(row) {
  return {
    id: row.id, chave: row.chave, valor: row.valor, categoria: row.categoria,
    categoriaLabel: FACT_CATEGORIES[row.categoria] || row.categoria,
    confianca: Number(row.confianca), status: row.status, fonte: row.fonte_trecho || null,
    fonteDia: row.fonte_dia || null, extraidoPor: row.extraido_por || null, validoAte: row.valido_ate || null,
    alteradoPor: row.alterado_por || null, atualizadoEm: row.atualizado_em,
  };
}

export async function getFactPhone(empresaId, factId, lojaId) {
  const result = await db.queryRead(
    `SELECT f.telefone FROM ai_customer_facts f
      JOIN ai_conversation_summaries s ON s.id = f.fonte_resumo_id AND s.empresa_id = f.empresa_id
     WHERE f.empresa_id = $1 AND f.id = $2 AND s.loja_id = $3
     LIMIT 1`,
    [uuid(empresaId), uuid(factId, 'factId'), uuid(lojaId, 'lojaId')],
  );
  return memoryPhone(result.rows[0]?.telefone);
}

export async function customerMemory(empresaId, telefone, { limitSummaries = 10, lojaId = null } = {}) {
  const phone = memoryPhone(telefone);
  if (!phone) return { telefone: null, facts: [], summaries: [], reviews: [] };
  const id = uuid(empresaId);
  const storeId = lojaId ? uuid(lojaId, 'lojaId') : null;
  const [facts, summaries] = await Promise.all([
    db.queryRead(
      `SELECT f.*, s.dia AS fonte_dia FROM ai_customer_facts f
         LEFT JOIN ai_conversation_summaries s ON s.id = f.fonte_resumo_id AND s.empresa_id = f.empresa_id
        WHERE f.empresa_id = $1 AND f.telefone = $2 AND ($3::uuid IS NULL OR s.loja_id = $3)
        ORDER BY CASE f.status WHEN 'ativo' THEN 0 WHEN 'proposto' THEN 1 WHEN 'contestado' THEN 2 ELSE 3 END, f.confianca DESC`,
      [id, phone, storeId],
    ),
    db.queryRead(
      `SELECT s.id, s.dia, s.resumo, s.resultado, s.sentimento, s.mensagens, s.modelo, r.nota, r.comentario
         FROM ai_conversation_summaries s
         LEFT JOIN ai_judge_reviews r ON r.resumo_id = s.id AND r.empresa_id = s.empresa_id AND r.telefone = s.telefone
        WHERE s.empresa_id = $1 AND s.telefone = $2 AND ($3::uuid IS NULL OR s.loja_id = $3)
        ORDER BY s.dia DESC LIMIT $4`,
      [id, phone, storeId, Math.min(50, Math.max(1, Number(limitSummaries) || 10))],
    ),
  ]);
  return { telefone: phone, facts: facts.rows.map(factView), summaries: summaries.rows.map((row) => ({ ...row, nota: row.nota === null ? null : Number(row.nota) })) };
}

export async function setFactStatus(empresaId, factId, status, operador = '', lojaId = null) {
  if (!['ativo', 'contestado', 'proposto'].includes(status)) throw Object.assign(new Error('Status inválido'), { status: 400, code: 'VALIDATION_ERROR' });
  const storeId = lojaId ? uuid(lojaId, 'lojaId') : null;
  const result = await db.query(
    `UPDATE ai_customer_facts f SET status = $3::varchar, alterado_por = $4, atualizado_em = CURRENT_TIMESTAMP,
            confianca = CASE WHEN $3::varchar = 'ativo' THEN GREATEST(confianca, 0.9) ELSE confianca END
      WHERE f.empresa_id = $1 AND f.id = $2
        AND ($5::uuid IS NULL OR EXISTS (
          SELECT 1 FROM ai_conversation_summaries s
           WHERE s.id = f.fonte_resumo_id AND s.empresa_id = f.empresa_id AND s.loja_id = $5
        ))
      RETURNING f.*`,
    [uuid(empresaId), uuid(factId, 'factId'), status, clean(operador, 160) || null, storeId],
  );
  if (!result.rows[0]) throw Object.assign(new Error('Fato não encontrado'), { status: 404, code: 'NOT_FOUND' });
  return factView(result.rows[0]);
}

/** LGPD: apaga a memória atribuível à loja; sem loja explícita, mantém a operação de esquecimento da empresa inteira. */
export async function forgetCustomer(empresaId, telefone, { lojaId = null } = {}) {
  const id = uuid(empresaId);
  const phone = memoryPhone(telefone);
  if (!phone) throw Object.assign(new Error('Telefone inválido'), { status: 400, code: 'VALIDATION_ERROR' });
  const storeId = lojaId ? uuid(lojaId, 'lojaId') : null;
  return db.transaction(async (trx) => {
    const counts = {};
    if (storeId) {
      counts.fatos = (await trx.query(
        `DELETE FROM ai_customer_facts f USING ai_conversation_summaries s
          WHERE f.empresa_id = $1 AND f.telefone = $2 AND s.id = f.fonte_resumo_id
            AND s.empresa_id = f.empresa_id AND s.loja_id = $3`,
        [id, phone, storeId],
      )).rowCount || 0;
      counts.avaliacoes = (await trx.query(
        `DELETE FROM ai_judge_reviews r USING ai_conversation_summaries s
          WHERE r.empresa_id = $1 AND r.telefone = $2 AND s.id = r.resumo_id
            AND s.empresa_id = r.empresa_id AND s.loja_id = $3`,
        [id, phone, storeId],
      )).rowCount || 0;
      counts.resumos = (await trx.query(
        'DELETE FROM ai_conversation_summaries WHERE empresa_id = $1 AND telefone = $2 AND loja_id = $3',
        [id, phone, storeId],
      )).rowCount || 0;
      // O registro de contatos automáticos (sem conteúdo) fica: é o que impede reenvio e respeita limites/opt-out.
      counts.mensagensNaFila = (await trx.query(
        `UPDATE tarefas_integracao_canais SET status = 'cancelada', payload = '{}'::jsonb, proxima_tentativa_em = NULL, data_atualizacao = CURRENT_TIMESTAMP
          WHERE empresa_id = $1 AND loja_id = $2 AND tipo = 'automacao_ia' AND status IN ('pendente','falha') AND payload->>'telefone' = $3`,
        [id, storeId, phone],
      )).rowCount || 0;
      counts.conversas = (await trx.query(
        `DELETE FROM whatsapp_ai_sessions WHERE empresa_id = $1 AND loja_id = $2
           AND ${phoneMatchKeySql('telefone')} = ${phoneMatchKeySql('$3')}`,
        [id, storeId, phone],
      )).rowCount || 0;
      return { telefone: phone, escopo: 'loja', removidos: counts };
    }
    counts.fatos = (await trx.query('DELETE FROM ai_customer_facts WHERE empresa_id = $1 AND telefone = $2', [id, phone])).rowCount || 0;
    counts.avaliacoes = (await trx.query('DELETE FROM ai_judge_reviews WHERE empresa_id = $1 AND telefone = $2', [id, phone])).rowCount || 0;
    counts.resumos = (await trx.query('DELETE FROM ai_conversation_summaries WHERE empresa_id = $1 AND telefone = $2', [id, phone])).rowCount || 0;
    // O registro de contatos automáticos (sem conteúdo) fica: é o que impede reenvio e respeita limites/opt-out.
    counts.mensagensNaFila = (await trx.query(
      `UPDATE tarefas_integracao_canais SET status = 'cancelada', payload = '{}'::jsonb, proxima_tentativa_em = NULL, data_atualizacao = CURRENT_TIMESTAMP
        WHERE empresa_id = $1 AND tipo = 'automacao_ia' AND status IN ('pendente','falha') AND payload->>'telefone' = $2`,
      [id, phone],
    )).rowCount || 0;
    counts.conversas = (await trx.query(
      `DELETE FROM whatsapp_ai_sessions WHERE empresa_id = $1
         AND ${phoneMatchKeySql('telefone')} = ${phoneMatchKeySql('$2')}`,
      [id, phone],
    )).rowCount || 0;
    return { telefone: phone, removidos: counts };
  });
}

// ── O que vai para o atendimento ─────────────────────────────────────────────

/** Bloco de memória para o prompt. Só chame com personalização autorizada. */
export async function memoryForPrompt(empresaId, telefone) {
  const phone = memoryPhone(telefone);
  if (!phone || !UUID.test(String(empresaId || ''))) return null;
  try {
    const [facts, summaries] = await Promise.all([
      db.queryRead(
        `SELECT categoria, valor, confianca FROM ai_customer_facts
          WHERE empresa_id = $1 AND telefone = $2 AND status = 'ativo' AND (valido_ate IS NULL OR valido_ate >= CURRENT_DATE)
          ORDER BY confianca DESC, atualizado_em DESC LIMIT 12`,
        [empresaId, phone],
      ),
      db.queryRead(
        `SELECT dia, resumo, resultado FROM ai_conversation_summaries
          WHERE empresa_id = $1 AND telefone = $2 ORDER BY dia DESC LIMIT 3`,
        [empresaId, phone],
      ),
    ]);
    if (!facts.rows.length && !summaries.rows.length) return null;
    return {
      fatos: facts.rows.map((row) => ({ tipo: FACT_CATEGORIES[row.categoria] || row.categoria, valor: clean(row.valor, 160) })),
      conversasRecentes: summaries.rows.map((row) => ({ dia: String(row.dia instanceof Date ? row.dia.toISOString().slice(0, 10) : row.dia), resumo: clean(row.resumo, 280), resultado: row.resultado })),
    };
  } catch (error) {
    if (error?.code === '42P01') return null;
    throw error;
  }
}

export async function approvedAnswers(empresaId, limit = 20) {
  if (!UUID.test(String(empresaId || ''))) return [];
  try {
    const result = await db.queryRead(
      `SELECT titulo, proposta FROM ai_learning_proposals
        WHERE empresa_id = $1 AND status = 'aprovado' AND tipo = 'faq' AND proposta IS NOT NULL
        ORDER BY ocorrencias DESC, decidido_em DESC LIMIT $2`,
      [empresaId, Math.min(40, Math.max(1, limit))],
    );
    return result.rows.map((row) => ({ pergunta: clean(row.titulo, 200), resposta: clean(row.proposta, 500) }));
  } catch (error) {
    if (error?.code === '42P01') return [];
    throw error;
  }
}

/** Busca por palavras em todos os resumos de um cliente ("o que ele falou de perfume?"). */
export async function searchCustomerMemory(empresaId, telefone, termo, { lojaId = null } = {}) {
  const phone = memoryPhone(telefone);
  const q = clean(termo, 120);
  if (!phone || !q) return [];
  const storeId = lojaId ? uuid(lojaId, 'lojaId') : null;
  const result = await db.queryRead(
    `SELECT dia, resumo, resultado FROM ai_conversation_summaries
      WHERE empresa_id = $1 AND telefone = $2 AND ($4::uuid IS NULL OR loja_id = $4)
        AND to_tsvector('portuguese', resumo) @@ plainto_tsquery('portuguese', $3)
      ORDER BY dia DESC LIMIT 10`,
    [uuid(empresaId), phone, q, storeId],
  );
  return result.rows;
}

// ── Consentimentos e opt-out no PostgreSQL ────────────────────────────────────
// O "SAIR" do WhatsApp grava em consentimentos_cliente (CRM) e na sessão. As automações
// e o aprendizado cruzam essas fontes com o cadastro da barbearia; na dúvida, bloqueiam.

function mergeConsent(map, phone, patch) {
  const key = memoryPhone(phone);
  if (!key) return;
  const current = map.get(key) || { personalizacao: null, marketing: null, optOut: false };
  for (const [field, value] of Object.entries(patch)) {
    if (field === 'optOut') current.optOut ||= value === true;
    else if (value === false) current[field] = false; // qualquer revogação vence
    else if (value === true && current[field] !== false) current[field] = true;
  }
  map.set(key, current);
}

/** Map telefone → { personalizacao, marketing, optOut } (null = sem registro no CRM). Lança em erro. */
export async function whatsappConsentMap(empresaId, { phone = null } = {}) {
  const id = uuid(empresaId);
  const only = phone ? memoryPhone(phone) : null;
  const map = new Map();
  const phoneSql = (col) => canonicalPhoneSql(col);
  const consents = await db.queryRead(
    `SELECT ${phoneSql('c.telefone')} AS telefone, cc.finalidade, cc.concedido
       FROM consentimentos_cliente cc
       JOIN clientes c ON c.id = cc.cliente_id AND c.empresa_id = cc.empresa_id
      WHERE cc.empresa_id = $1 AND cc.canal = 'whatsapp' AND cc.finalidade IN ('atendimento_personalizado', 'marketing')
        AND ($2::text IS NULL OR ${phoneSql('c.telefone')} = $2::text)`,
    [id, only],
  );
  for (const row of consents.rows) {
    mergeConsent(map, row.telefone, row.finalidade === 'marketing' ? { marketing: row.concedido === true } : { personalizacao: row.concedido === true });
  }
  const optOuts = await db.queryRead(
    `SELECT ${phoneSql('telefone')} AS telefone FROM whatsapp_ai_sessions
      WHERE empresa_id = $1 AND (estado->>'marketingOptOut') = 'true'
        AND ($2::text IS NULL OR ${phoneSql('telefone')} = $2::text)`,
    [id, only],
  );
  for (const row of optOuts.rows) mergeConsent(map, row.telefone, { optOut: true, marketing: false });
  const suppressed = await db.queryRead(
    `SELECT ${phoneSql('telefone')} AS telefone FROM ai_automation_log WHERE empresa_id = $1 AND automacao = 'opt_out' AND ($2::text IS NULL OR ${phoneSql('telefone')} = $2::text)`,
    [id, only],
  );
  for (const row of suppressed.rows) mergeConsent(map, row.telefone, { optOut: true, marketing: false });
  return map;
}

/** Registro permanente de "não quero mensagens automáticas" (sobrevive à retenção das conversas). */
export async function recordAutomationOptOut(query, empresaId, telefone, motivo = 'cliente_pediu') {
  const phone = memoryPhone(telefone);
  if (!phone || !UUID.test(String(empresaId || ''))) return false;
  await query(
    `INSERT INTO ai_automation_log (empresa_id, telefone, automacao, referencia, status, motivo)
     VALUES ($1, $2, 'opt_out', 'permanente', 'bloqueada', $3) ON CONFLICT DO NOTHING`,
    [empresaId, phone, clean(motivo, 80)],
  );
  return true;
}
