import { db as defaultDb } from './core/database.js';
import { runAiTask, routerStatus } from './core/ai-router.js';
import {
  enqueueDinoEffect,
  fingerprintPayload,
  sanitizePayload,
} from './core/dino-operational-outbox.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MONTH = /^\d{4}-(?:0[1-9]|1[0-2])$/;
const PROMPT_VERSION = '1.0.0';
const EFFECT = 'forecast.ai.analyze';
const MAX_TEXT = 700;

export class DinoForecastAiError extends Error {
  constructor(message, code = 'DINO_FORECAST_AI_ERROR', { status = 400, retryable = false } = {}) {
    super(message);
    this.name = 'DinoForecastAiError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

function text(value, max = MAX_TEXT) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function isoTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  return Number.isFinite(date.valueOf()) ? date.toISOString() : new Date().toISOString();
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function money(value) {
  return Number(Math.max(0, number(value)).toFixed(2));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, number(value, min)));
}

function validScope(empresaId, lojaId) {
  return UUID.test(String(empresaId || '')) && UUID.test(String(lojaId || ''));
}

function monthStart(mes) {
  if (!MONTH.test(String(mes || ''))) throw new DinoForecastAiError('Competência inválida.', 'DINO_FORECAST_MONTH_INVALID');
  return `${mes}-01`;
}

function labelCurrency(value) {
  return money(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function jsonObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function cleanProfessional(item = {}) {
  return {
    nome: text(item.nome, 120),
    ativo: item.ativo !== false,
    meta: item.meta ? { receita: money(item.meta.receita), atendimentos: Math.max(0, Math.round(number(item.meta.atendimentos))) } : null,
    realizado: money(item.realizado),
    agendaFutura: money(item.agendaFutura),
    projecao: money(item.projecao),
    diferencaMeta: item.diferencaMeta == null ? null : Number(number(item.diferencaMeta).toFixed(2)),
    noRitmo: item.noRitmo == null ? null : Boolean(item.noRitmo),
    atendimentosConcluidos: Math.max(0, Math.round(number(item.atendimentosConcluidos))),
    atendimentosAgendados: Math.max(0, Math.round(number(item.atendimentosAgendados))),
    ticketMedio: money(item.ticketMedio),
    ocupacao: item.ocupacao == null ? null : Number(clamp(item.ocupacao, 0, 1).toFixed(4)),
    tendencia: text(item.tendencia, 30) || 'estavel',
    historicoMeses: Math.max(0, Math.round(number(item.historicoMeses))),
  };
}

/**
 * Remove IDs internos, clientes e qualquer detalhe que não seja necessário para
 * explicar a previsão. Os valores usados na análise vêm exclusivamente deste
 * snapshot, nunca da resposta livre do modelo.
 */
export function snapshotForecast(projection = {}) {
  const atual = jsonObject(projection.atual);
  const qualidade = jsonObject(projection.qualidade);
  return sanitizePayload({
    mes: text(projection.mes, 7),
    horizonte: Math.max(1, Math.min(6, Math.round(number(projection.horizonte, 6)))),
    qualidade: {
      nivel: text(qualidade.nivel, 30),
      mesesAnalisados: Math.max(0, Math.round(number(qualidade.mesesAnalisados))),
      mesesComDados: Math.max(0, Math.round(number(qualidade.mesesComDados))),
      dataCorte: text(qualidade.dataCorte, 20),
      fontes: jsonObject(qualidade.fontes),
      explicacao: text(qualidade.explicacao, 300),
    },
    atual: {
      tipo: text(atual.tipo, 20),
      realizado: money(atual.realizado),
      servicos: money(atual.servicos),
      revenda: money(atual.revenda),
      agendaFutura: money(atual.agendaFutura),
      atendimentosConcluidos: Math.max(0, Math.round(number(atual.atendimentosConcluidos))),
      atendimentosAgendados: Math.max(0, Math.round(number(atual.atendimentosAgendados))),
      ticketMedio: money(atual.ticketMedio),
      projetadoServicos: money(atual.projetadoServicos),
      projetadoRevenda: money(atual.projetadoRevenda),
      projecao: money(atual.projecao),
      conservador: money(atual.conservador),
      favoravel: money(atual.favoravel),
      metaReceita: atual.metaReceita == null ? null : money(atual.metaReceita),
      diferencaMeta: atual.diferencaMeta == null ? null : Number(number(atual.diferencaMeta).toFixed(2)),
      noRitmo: atual.noRitmo == null ? null : Boolean(atual.noRitmo),
      ritmoPendente: money(atual.ritmoPendente),
    },
    previsoes: (Array.isArray(projection.previsoes) ? projection.previsoes : []).slice(0, 6).map(item => ({
      mes: text(item.mes, 7),
      tipo: text(item.tipo, 20),
      realizado: money(item.realizado),
      projecao: money(item.projecao),
      conservador: money(item.conservador),
      favoravel: money(item.favoravel),
      agendaFutura: money(item.agendaFutura),
      metaReceita: item.metaReceita == null ? null : money(item.metaReceita),
      diferencaMeta: item.diferencaMeta == null ? null : Number(number(item.diferencaMeta).toFixed(2)),
    })),
    historico: (Array.isArray(projection.historico) ? projection.historico : []).slice(-6).map(item => ({
      mes: text(item.mes, 7),
      realizado: money(item.realizado),
      servicos: money(item.servicos),
      revenda: money(item.revenda),
      atendimentosConcluidos: Math.max(0, Math.round(number(item.atendimentosConcluidos))),
      ticketMedio: money(item.ticketMedio),
    })),
    profissionais: (Array.isArray(projection.profissionais) ? projection.profissionais : []).slice(0, 50).map(cleanProfessional),
    fatores: (Array.isArray(projection.fatores) ? projection.fatores : []).slice(0, 10).map(item => ({
      tipo: text(item.tipo, 40),
      severidade: text(item.severidade, 30),
      titulo: text(item.titulo, 180),
      evidencia: text(item.evidencia, 360),
      impacto: item.impacto == null ? null : Number(number(item.impacto).toFixed(2)),
    })),
    acoes: (Array.isArray(projection.acoes) ? projection.acoes : []).slice(0, 8).map(item => ({
      prioridade: text(item.prioridade, 30),
      titulo: text(item.titulo, 180),
      descricao: text(item.descricao, 360),
      aba: text(item.aba, 80),
    })),
  });
}

function confidenceFor(snapshot) {
  const nivel = String(snapshot.qualidade?.nivel || 'insuficiente');
  return nivel === 'alta' ? 0.82 : nivel === 'media' ? 0.64 : nivel === 'baixa' ? 0.38 : 0.16;
}

function trendFrom(snapshot) {
  const history = Array.isArray(snapshot.historico) ? snapshot.historico.filter(item => item.realizado > 0) : [];
  if (history.length < 2) return 'estavel';
  const previous = history.at(-2).realizado;
  const latest = history.at(-1).realizado;
  if (!previous) return latest > 0 ? 'crescimento' : 'estavel';
  const variation = (latest - previous) / previous;
  return variation >= 0.05 ? 'crescimento' : variation <= -0.05 ? 'queda' : 'estavel';
}

function alertTypeFor(fator = {}) {
  const map = { meta: 'meta', tendencia: 'risco', agenda: 'agenda', revenda: 'revenda', capacidade: 'capacidade', profissionais: 'profissional', perdas: 'risco', dados: 'risco' };
  return map[fator.tipo] || 'risco';
}

function severityFor(fator = {}) {
  const value = String(fator.severidade || '').toLowerCase();
  if (value === 'critico' || value === 'crítica' || value === 'critica') return 'critica';
  if (value === 'alerta') return 'alta';
  if (value === 'positivo') return 'info';
  return 'normal';
}

function slug(value) {
  return text(value, 140).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'alerta';
}

export function buildDeterministicAnalysis(projection = {}) {
  const snapshot = snapshotForecast(projection);
  const atual = snapshot.atual;
  const trend = trendFrom(snapshot);
  const confidence = confidenceFor(snapshot);
  const belowTarget = atual.metaReceita != null && atual.projecao < atual.metaReceita;
  const executiveSummary = atual.tipo === 'atual'
    ? `A projeção de ${labelCurrency(atual.projecao)} para ${snapshot.mes} está ${belowTarget ? 'abaixo' : 'em linha ou acima'} da meta configurada${atual.metaReceita != null ? ` de ${labelCurrency(atual.metaReceita)}` : ''}. O resultado combina recebimentos confirmados, agenda futura e histórico recente.`
    : `A projeção de ${labelCurrency(atual.projecao)} para ${snapshot.mes} foi calculada com base no histórico recente e na agenda conhecida. Trata-se de uma estimativa, não de garantia de faturamento.`;
  const causas = snapshot.fatores.map(item => ({
    tipo: text(item.tipo, 40),
    severidade: text(item.severidade, 30),
    titulo: text(item.titulo, 180),
    explicacao: text(item.evidencia, 500),
    evidencia: text(item.evidencia, 500),
  }));
  const recomendacoes = snapshot.acoes.map(item => ({
    prioridade: text(item.prioridade, 30) || 'media',
    titulo: text(item.titulo, 180),
    descricao: text(item.descricao, 500),
    aba: text(item.aba, 80),
    efeitoEsperado: 'Acompanhar o indicador após a ação; o sistema não executa essa ação automaticamente.',
  }));
  const alertas = snapshot.fatores
    .filter(item => ['critico', 'alerta'].includes(String(item.severidade).toLowerCase()))
    .map(item => ({
      chave: `${alertTypeFor(item)}-${slug(item.titulo)}`,
      tipo: alertTypeFor(item),
      severidade: severityFor(item),
      titulo: text(item.titulo, 180),
      mensagem: text(item.evidencia, 500),
      metricas: item.impacto == null ? {} : { impacto: Number(item.impacto.toFixed(2)) },
    }));
  return sanitizePayload({
    versao: PROMPT_VERSION,
    status: 'fallback',
    resumoExecutivo: executiveSummary,
    tendencia: trend,
    confianca: confidence,
    confiancaRotulo: text(snapshot.qualidade?.nivel, 30) || 'insuficiente',
    causas,
    alertas,
    recomendacoes,
    fatos: {
      realizado: atual.realizado,
      projecao: atual.projecao,
      conservador: atual.conservador,
      favoravel: atual.favoravel,
      servicos: atual.servicos,
      revenda: atual.revenda,
      agendaFutura: atual.agendaFutura,
      atendimentosConcluidos: atual.atendimentosConcluidos,
      atendimentosAgendados: atual.atendimentosAgendados,
      metaReceita: atual.metaReceita,
      diferencaMeta: atual.diferencaMeta,
    },
    limitacoes: [
      text(snapshot.qualidade?.explicacao, 300) || 'A projeção depende da qualidade dos lançamentos e da agenda registrada.',
      'A IA interpreta os fatos, mas não substitui a decisão da gestão nem garante o fechamento financeiro.',
    ],
  });
}

function normalizeList(value, limit, mapper) {
  return (Array.isArray(value) ? value : []).slice(0, limit).map(mapper).filter(Boolean);
}

function normalizeAiAnalysis(candidate, projection) {
  const fallback = buildDeterministicAnalysis(projection);
  const source = jsonObject(candidate);
  const causas = normalizeList(source.causas, 8, item => {
    if (!item || typeof item !== 'object') return null;
    const titulo = text(item.titulo || item.title, 180);
    const explicacao = text(item.explicacao || item.evidencia || item.explanation, 500);
    return titulo && explicacao ? { tipo: text(item.tipo, 40) || 'geral', severidade: text(item.severidade, 30) || 'informativo', titulo, explicacao, evidencia: explicacao } : null;
  });
  const recomendacoes = normalizeList(source.recomendacoes || source.recommendations, 8, item => {
    if (!item || typeof item !== 'object') return null;
    const titulo = text(item.titulo || item.title, 180);
    const descricao = text(item.descricao || item.description, 500);
    return titulo && descricao ? { prioridade: text(item.prioridade || item.priority, 30) || 'media', titulo, descricao, aba: text(item.aba || item.module, 80), efeitoEsperado: text(item.efeitoEsperado || item.expectedEffect, 300) || 'Acompanhar o indicador após a ação; nenhuma mudança é executada automaticamente.' } : null;
  });
  const resumo = text(source.resumoExecutivo || source.executiveSummary || source.summary, 900);
  const trend = ['crescimento', 'queda', 'estavel'].includes(String(source.tendencia || source.trend)) ? String(source.tendencia || source.trend) : fallback.tendencia;
  return sanitizePayload({
    ...fallback,
    status: 'ready',
    resumoExecutivo: resumo || fallback.resumoExecutivo,
    tendencia: trend,
    causas: causas.length ? causas : fallback.causas,
    recomendacoes: recomendacoes.length ? recomendacoes : fallback.recomendacoes,
    alertas: fallback.alertas,
    fatos: fallback.fatos,
    limitacoes: [
      ...(Array.isArray(source.limitacoes) ? source.limitacoes.map(item => text(item, 300)).filter(Boolean).slice(0, 3) : []),
      'Os números e alertas são derivados do snapshot determinístico do sistema.',
    ].slice(0, 4),
  });
}

function promptFor(snapshot) {
  return `Você é o analista gerencial do Kytto. Leia o SNAPSHOT JSON abaixo e responda somente JSON válido em português do Brasil.

Regras obrigatórias:
- Não invente números, causas, nomes, eventos ou certezas que não estejam no snapshot.
- Não recomende ações ilegais, discriminatórias ou automáticas sobre pessoas.
- Não execute ferramentas, não altere agenda, caixa, financeiro, estoque ou comissões.
- Use os fatos do snapshot para explicar tendência, meta, agenda, revenda e profissionais.
- Se os dados forem insuficientes, diga isso claramente.
- Em causas, escreva explicações curtas e cite a evidência textual já existente.
- Em recomendações, ordene por prioridade e descreva uma ação humana verificável.
- Não repita o JSON do snapshot e não inclua campos fora do contrato.

Contrato de saída:
{
  "resumoExecutivo": "string",
  "tendencia": "crescimento|queda|estavel",
  "causas": [{"tipo":"string","severidade":"string","titulo":"string","explicacao":"string"}],
  "recomendacoes": [{"prioridade":"alta|media|baixa","titulo":"string","descricao":"string","aba":"string","efeitoEsperado":"string"}],
  "limitacoes": ["string"]
}

SNAPSHOT:
${JSON.stringify(snapshot)}`;
}

function aiSystemPrompt() {
  return 'Você produz análises gerenciais conservadoras para um ERP brasileiro. A resposta será exibida a gestores e deve separar fatos observados de interpretação. Nunca invente dados.';
}

async function persistInsight({ db, empresaId, lojaId, mes, fingerprint, snapshot, analysis, source, provider, model, status, errorCode = null, errorMessage = null }) {
  if (!validScope(empresaId, lojaId)) return null;
  try {
    const result = await db.query(
      `INSERT INTO dino_forecast_ai_insights
        (empresa_id, loja_id, competencia, fingerprint, prompt_version, status, source, snapshot, analysis, confidence, provider, model, erro_codigo, erro, gerado_em, expira_em, atualizado_em)
       VALUES ($1, $2, $3::date, $4, $5, $6::varchar, $7, $8::jsonb, $9::jsonb, $10, $11, $12, $13, $14, CASE WHEN $6::varchar IN ('ready', 'fallback') THEN CURRENT_TIMESTAMP ELSE NULL END, CURRENT_TIMESTAMP + INTERVAL '6 hours', CURRENT_TIMESTAMP)
       ON CONFLICT (empresa_id, loja_id, competencia, fingerprint)
       DO UPDATE SET prompt_version = EXCLUDED.prompt_version, status = EXCLUDED.status, source = EXCLUDED.source,
         snapshot = EXCLUDED.snapshot, analysis = EXCLUDED.analysis, confidence = EXCLUDED.confidence,
         provider = EXCLUDED.provider, model = EXCLUDED.model, erro_codigo = EXCLUDED.erro_codigo, erro = EXCLUDED.erro,
         gerado_em = EXCLUDED.gerado_em, expira_em = EXCLUDED.expira_em, atualizado_em = CURRENT_TIMESTAMP
       RETURNING *`,
      [empresaId, lojaId, monthStart(mes), fingerprint, PROMPT_VERSION, status, source, JSON.stringify(snapshot), JSON.stringify(analysis), confidenceFor(snapshot), provider || null, model || null, errorCode, errorMessage],
    );
    return result.rows?.[0] || null;
  } catch (error) {
    if (error?.code !== '42P01') console.warn('[Dino forecast AI] persistência do insight falhou:', error?.code || error?.message || error);
    return null;
  }
}

function alertRows(projection, analysis) {
  const snapshot = snapshotForecast(projection);
  return snapshot.fatores
    .filter(item => ['critico', 'alerta'].includes(String(item.severidade).toLowerCase()))
    .map(item => ({
      alertKey: `${alertTypeFor(item)}-${slug(item.titulo)}`,
      tipo: alertTypeFor(item),
      severidade: severityFor(item),
      titulo: text(item.titulo, 180),
      mensagem: text(item.evidencia, 600),
      metricas: sanitizePayload({ impacto: item.impacto, tendencia: analysis.tendencia }),
    }));
}

async function persistAlerts({ db, empresaId, lojaId, mes, insightId, projection, analysis }) {
  if (!validScope(empresaId, lojaId)) return [];
  const rows = alertRows(projection, analysis);
  try {
    const keys = rows.map(row => row.alertKey);
    await db.query(
      `UPDATE dino_forecast_ai_alerts
          SET status = 'resolved', resolvido_em = CURRENT_TIMESTAMP, atualizado_em = CURRENT_TIMESTAMP
        WHERE empresa_id = $1 AND loja_id = $2 AND competencia = $3::date
          AND status IN ('active', 'acknowledged')
          AND NOT (alert_key = ANY($4::text[]))`,
      [empresaId, lojaId, monthStart(mes), keys],
    );
    for (const row of rows) {
      await db.query(
        `INSERT INTO dino_forecast_ai_alerts
          (empresa_id, loja_id, competencia, insight_id, alert_key, tipo, severidade, status, titulo, mensagem, metricas, ultimo_sinal_em, atualizado_em)
         VALUES ($1, $2, $3::date, $4::uuid, $5, $6, $7, 'active', $8, $9, $10::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (empresa_id, loja_id, competencia, alert_key)
         DO UPDATE SET insight_id = EXCLUDED.insight_id, tipo = EXCLUDED.tipo, severidade = EXCLUDED.severidade,
           status = CASE WHEN dino_forecast_ai_alerts.status = 'acknowledged' THEN 'acknowledged' ELSE 'active' END,
           titulo = EXCLUDED.titulo, mensagem = EXCLUDED.mensagem, metricas = EXCLUDED.metricas,
           ultimo_sinal_em = CURRENT_TIMESTAMP, atualizado_em = CURRENT_TIMESTAMP, resolvido_em = NULL`,
        [empresaId, lojaId, monthStart(mes), insightId || null, row.alertKey, row.tipo, row.severidade, row.titulo, row.mensagem, JSON.stringify(row.metricas)],
      );
    }
    return rows;
  } catch (error) {
    if (error?.code !== '42P01') console.warn('[Dino forecast AI] persistência de alertas falhou:', error?.code || error?.message || error);
    return [];
  }
}

export async function getForecastAiInsight({ db = defaultDb, empresaId, lojaId, mes, fingerprint = null } = {}) {
  if (!validScope(empresaId, lojaId) || !MONTH.test(String(mes || ''))) return null;
  try {
    const result = await db.queryRead(
      `SELECT * FROM dino_forecast_ai_insights
        WHERE empresa_id = $1 AND loja_id = $2 AND competencia = $3::date
          AND ($4::char(64) IS NULL OR fingerprint = $4)
        ORDER BY atualizado_em DESC
        LIMIT 1`,
      [empresaId, lojaId, monthStart(mes), fingerprint || null],
    );
    return result.rows?.[0] || null;
  } catch (error) {
    if (error?.code !== '42P01') console.warn('[Dino forecast AI] leitura do insight falhou:', error?.code || error?.message || error);
    return null;
  }
}

export async function listForecastAiAlerts({ db = defaultDb, empresaId, lojaId, mes, includeResolved = false } = {}) {
  if (!validScope(empresaId, lojaId) || !MONTH.test(String(mes || ''))) return [];
  try {
    const result = await db.queryRead(
      `SELECT * FROM dino_forecast_ai_alerts
        WHERE empresa_id = $1 AND loja_id = $2 AND competencia = $3::date
          AND ($4::boolean = true OR status <> 'resolved')
        ORDER BY CASE severidade WHEN 'critica' THEN 0 WHEN 'alta' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, ultimo_sinal_em DESC`,
      [empresaId, lojaId, monthStart(mes), Boolean(includeResolved)],
    );
    return result.rows || [];
  } catch (error) {
    if (error?.code !== '42P01') console.warn('[Dino forecast AI] leitura dos alertas falhou:', error?.code || error?.message || error);
    return [];
  }
}

export async function acknowledgeForecastAiAlert({ db = defaultDb, empresaId, lojaId, alertId, usuarioId = null } = {}) {
  if (!validScope(empresaId, lojaId) || !UUID.test(String(alertId || ''))) throw new DinoForecastAiError('Escopo ou alerta inválido.', 'DINO_FORECAST_ALERT_SCOPE_INVALID');
  const result = await db.query(
    `UPDATE dino_forecast_ai_alerts
        SET status = 'acknowledged', reconhecido_em = CURRENT_TIMESTAMP, reconhecido_por = $4::uuid, atualizado_em = CURRENT_TIMESTAMP
      WHERE id = $1::uuid AND empresa_id = $2 AND loja_id = $3 AND status = 'active'
      RETURNING *`,
    [alertId, empresaId, lojaId, UUID.test(String(usuarioId || '')) ? usuarioId : null],
  );
  if (!result.rows?.[0]) throw new DinoForecastAiError('Alerta não encontrado ou já reconhecido.', 'DINO_FORECAST_ALERT_NOT_FOUND', { status: 404 });
  return result.rows[0];
}

export function simulateForecast(projection = {}, factors = {}) {
  const snapshot = snapshotForecast(projection);
  const atendimentos = clamp(factors.atendimentos ?? 1, 0, 3);
  const ticket = clamp(factors.ticket ?? 1, 0, 3);
  const revenda = clamp(factors.revenda ?? 1, 0, 3);
  const ocupacao = clamp(factors.ocupacao ?? 1, 0, 3);
  const base = snapshot.atual;
  const servicosBase = money(base.projetadoServicos || base.servicos);
  const revendaBase = money(base.projetadoRevenda || base.revenda);
  const projetadoServicos = money(servicosBase * ((atendimentos + ticket + ocupacao) / 3));
  const projetadoRevenda = money(revendaBase * revenda);
  const total = money(projetadoServicos + projetadoRevenda);
  return {
    parametros: { atendimentos, ticket, revenda, ocupacao },
    base: { servicos: servicosBase, revenda: revendaBase, total: money(servicosBase + revendaBase) },
    resultado: { servicos: projetadoServicos, revenda: projetadoRevenda, total },
    variacao: Number((total - money(servicosBase + revendaBase)).toFixed(2)),
    aviso: 'Simulação matemática sobre o snapshot; não altera meta, agenda, financeiro ou estoque.',
  };
}

export async function analyzeForecastWithAi({ db = defaultDb, empresaId, lojaId, projection, force = false, allowAi = true, fetchImpl = fetch, runAiTaskImpl = runAiTask } = {}) {
  const snapshot = snapshotForecast(projection);
  const mes = snapshot.mes;
  if (!validScope(empresaId, lojaId)) return { status: 'fallback', source: 'deterministic', analysis: buildDeterministicAnalysis(projection), persisted: false, reason: 'scope_not_uuid' };
  if (!allowAi) return { status: 'fallback', source: 'deterministic', analysis: buildDeterministicAnalysis(projection), persisted: false, reason: 'feature_disabled' };
  const fingerprint = fingerprintPayload(snapshot);
  const cached = force ? null : await getForecastAiInsight({ db, empresaId, lojaId, mes, fingerprint });
  if (cached && ['ready', 'fallback'].includes(cached.status) && cached.expira_em && new Date(cached.expira_em).valueOf() > Date.now()) {
    const alerts = await listForecastAiAlerts({ db, empresaId, lojaId, mes });
    return { status: cached.status, source: cached.source, analysis: cached.analysis, generatedAt: isoTimestamp(cached.gerado_em), provider: cached.provider, model: cached.model, fingerprint, alerts, cached: true, persisted: true };
  }

  const fallback = buildDeterministicAnalysis(projection);
  let analysis = fallback;
  let status = 'fallback';
  let source = 'deterministic';
  let provider = null;
  let model = null;
  let errorCode = null;
  let errorMessage = null;
  try {
    const result = await runAiTaskImpl('previsao_gerencial', {
      system: aiSystemPrompt(),
      user: promptFor(snapshot),
      json: true,
      maxTokens: 1400,
      empresaId,
      fetchImpl,
      ...(process.env.DINO_FORECAST_AI_CAP_CENTS ? { capCents: Number(process.env.DINO_FORECAST_AI_CAP_CENTS) } : {}),
    });
    analysis = normalizeAiAnalysis(result.data, projection);
    status = 'ready';
    source = 'ai';
    provider = result.provider;
    model = result.model;
  } catch (error) {
    errorCode = text(error?.code || 'AI_UNAVAILABLE', 80);
    errorMessage = text(error?.message || 'Provedor de IA indisponível.', 500);
  }
  const persisted = await persistInsight({ db, empresaId, lojaId, mes, fingerprint, snapshot, analysis, source, provider, model, status, errorCode, errorMessage });
  const alerts = await persistAlerts({ db, empresaId, lojaId, mes, insightId: persisted?.id, projection, analysis });
  return { status, source, analysis, generatedAt: isoTimestamp(persisted?.gerado_em), provider, model, fingerprint, alerts, cached: false, persisted: Boolean(persisted), ...(errorCode ? { errorCode, errorMessage } : {}) };
}

export async function enqueueForecastAnalysis({ db = defaultDb, empresaId, lojaId, projection, correlationId = null } = {}) {
  if (!validScope(empresaId, lojaId)) throw new DinoForecastAiError('Empresa e unidade canônicas são obrigatórias para enfileirar a análise.', 'DINO_FORECAST_SCOPE_REQUIRED', { status: 409 });
  const snapshot = snapshotForecast(projection);
  const fingerprint = fingerprintPayload(snapshot);
  const idempotencyKey = `forecast-ai:${snapshot.mes}:${fingerprint}`;
  const input = {
    effect: EFFECT,
    idempotencyKey,
    fingerprint,
    correlationId: correlationId || null,
    payload: { mes: snapshot.mes, projection: snapshot },
  };
  const effect = await enqueueDinoEffect({ empresaId, lojaId }, input, db);
  if (effect.replayed && effect.status === 'succeeded') {
    const persisted = await getForecastAiInsight({ db, empresaId, lojaId, mes: snapshot.mes, fingerprint });
    if (!persisted || !['ready', 'fallback'].includes(String(persisted.status))) {
      // Um efeito antigo pode ter sido concluído antes de a persistência do insight
      // ser confirmada. Uma chave horária permite recuperação idempotente sem
      // duplicar a análise em cada leitura do painel.
      const recoveryInput = {
        ...input,
        idempotencyKey: `${idempotencyKey}:recovery:${Math.floor(Date.now() / 3600000)}`,
        correlationId: correlationId || `forecast-recovery:${new Date().toISOString().slice(0, 13)}`,
      };
      const recovery = await enqueueDinoEffect({ empresaId, lojaId }, recoveryInput, db);
      return { queued: !recovery.replayed, replayed: Boolean(recovery.replayed), effectId: recovery.id, recoveredFromEffectId: effect.id, fingerprint, status: recovery.status };
    }
  }
  return { queued: !effect.replayed, replayed: Boolean(effect.replayed), effectId: effect.id, fingerprint, status: effect.status };
}

export function createDinoForecastAiHandler({ db = defaultDb, fetchImpl = fetch } = {}) {
  return async task => {
    const payload = typeof task?.payload_sanitizado === 'string' ? JSON.parse(task.payload_sanitizado) : (task?.payload_sanitizado || {});
    const empresaId = String(task?.empresa_id || task?.empresaId || '').trim();
    const lojaId = String(task?.loja_id || task?.lojaId || '').trim();
    if (!validScope(empresaId, lojaId) || !payload?.projection?.mes) {
      throw Object.assign(new Error('Tarefa de projeção sem escopo ou snapshot válido.'), { code: 'DINO_FORECAST_TASK_INVALID', retryable: false });
    }
    const result = await analyzeForecastWithAi({ db, empresaId, lojaId, projection: payload.projection, force: true, fetchImpl });
    if (!result.persisted) {
      throw Object.assign(new Error('Insight de projeção não foi persistido; a tarefa será reprocessada.'), { code: 'DINO_FORECAST_INSIGHT_PERSIST_FAILED', retryable: true });
    }
    return result;
  };
}

export function forecastAiStatus() {
  return {
    enabled: process.env.DINO_FORECAST_AI_ENABLED === '1',
    workerEnabled: process.env.DINO_OPERATIONAL_WORKER_ENABLED === '1',
    providers: routerStatus().providers,
    route: routerStatus().routes.find(item => item.task === 'previsao_gerencial') || null,
    promptVersion: PROMPT_VERSION,
  };
}

/**
 * Descobre unidades ativas no Commerce e apenas enfileira snapshots novos.
 * A chamada ao provedor fica no worker com lease/retry; o scheduler nunca faz
 * chamada externa nem bloqueia o boot do servidor.
 */
export function startDinoForecastAiScheduler({ db = defaultDb, projectionFactory, intervalMs } = {}) {
  if (process.env.DINO_FORECAST_AI_ENABLED !== '1' || process.env.DINO_OPERATIONAL_WORKER_ENABLED !== '1') {
    return { started: false, reason: 'disabled', stop() {} };
  }
  if (typeof projectionFactory !== 'function') return { started: false, reason: 'projection_factory_required', stop() {} };
  const configured = Number(intervalMs ?? process.env.DINO_FORECAST_AI_INTERVAL_MS ?? 21600000);
  const delay = Number.isFinite(configured) ? Math.min(86400000, Math.max(900000, Math.floor(configured))) : 21600000;
  let stopped = false;
  let running = false;
  const tick = async () => {
    if (stopped || running) return;
    running = true;
    try {
      const result = await db.queryRead('SELECT empresa_id, id AS loja_id FROM lojas WHERE ativa = true ORDER BY empresa_id, id');
      for (const scope of result.rows || []) {
        if (stopped) break;
        try {
          const projection = projectionFactory(String(scope.empresa_id), String(scope.loja_id));
          await enqueueForecastAnalysis({ db, empresaId: String(scope.empresa_id), lojaId: String(scope.loja_id), projection, correlationId: `forecast-scheduler:${new Date().toISOString().slice(0, 13)}` });
        } catch (error) {
          console.warn('[Dino forecast AI] não foi possível enfileirar unidade:', error?.code || error?.message || error);
        }
      }
    } catch (error) {
      console.warn('[Dino forecast AI] descoberta de unidades adiada:', error?.code || error?.message || error);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(tick, delay);
  timer.unref?.();
  const first = setTimeout(tick, 0);
  first.unref?.();
  return { started: true, intervalMs: delay, stop() { stopped = true; clearInterval(timer); clearTimeout(first); } };
}

export const DINO_FORECAST_AI_EFFECT = EFFECT;
export const DINO_FORECAST_AI_PROMPT_VERSION = PROMPT_VERSION;
export default {
  analyzeForecastWithAi,
  acknowledgeForecastAiAlert,
  buildDeterministicAnalysis,
  createDinoForecastAiHandler,
  enqueueForecastAnalysis,
  forecastAiStatus,
  getForecastAiInsight,
  listForecastAiAlerts,
  simulateForecast,
  snapshotForecast,
  startDinoForecastAiScheduler,
};
