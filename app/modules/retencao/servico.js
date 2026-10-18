// Régua de retenção pela IA no WhatsApp (item 4 da especificação Kytto Clube & Academia).
// Este arquivo: configuração, réguas, execução (quem recebe o quê hoje), atribuição de resultados,
// mensagens recebidas (pausa e opt-out) e score de risco. As operações que a IA executa na conversa
// (financeiro, acordo, congelamento, motivos, ocorrências) ficam em operacoes.js.
import { ErroDominio, transacao, exigirUuid, exigirTexto } from '../acesso/banco.js';
import { instanteNoFuso } from '../acesso/regras.js';
import { GATILHOS, avaliarGatilhos, bloqueioDeCadencia, calcularRisco, ehOptOut, pedeCancelamento } from './gatilhos.js';
import { TEXTOS_BASE, TONS, montarTexto, formatarReais } from './textos.js';

const DIA_MS = 86400000;
const FINANCEIROS = ['inadimplente', 'vencimento'];

/* ------------------------------------------------------------------ */
/* Datas no fuso da academia                                           */
/* ------------------------------------------------------------------ */

export function hojeNoFuso(agora, fuso) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
}
function relogioLocal(agora, fuso) {
  const partes = new Intl.DateTimeFormat('en-US', { timeZone: fuso, hourCycle: 'h23', hour: '2-digit', weekday: 'short' }).formatToParts(agora);
  const hora = Number(partes.find((p) => p.type === 'hour').value);
  const dia = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(partes.find((p) => p.type === 'weekday').value);
  return { hora, diaSemana: dia };
}

/* ------------------------------------------------------------------ */
/* Configuração e réguas                                               */
/* ------------------------------------------------------------------ */

const CONFIG_PADRAO = {
  ativo: false, tom: 'proximo', intervaloDias: 3, horaInicio: 8, horaFim: 20, enviaDomingo: false, limiteDiario: 80,
  pausaRespostaDias: 3, fuso: 'America/Cuiaba', telefoneGestor: null, multaPercentual: 2, jurosMesPercentual: 1,
  acordoMaxParcelas: 3, acordoMaxDiasPromessa: 10, mimoAniversario: null, ofertaVolta: null, ofertaRenovacao: null, ativadaEm: null,
  baseLegalMarketing: 'consentimento',
};

function configDeLinha(r) {
  if (!r) return { ...CONFIG_PADRAO };
  return {
    ativo: r.ativo, tom: r.tom, intervaloDias: r.intervalo_dias, horaInicio: r.hora_inicio, horaFim: r.hora_fim,
    enviaDomingo: r.envia_domingo, limiteDiario: r.limite_diario, pausaRespostaDias: r.pausa_resposta_dias, fuso: r.fuso,
    telefoneGestor: r.telefone_gestor, multaPercentual: Number(r.multa_percentual), jurosMesPercentual: Number(r.juros_mes_percentual),
    acordoMaxParcelas: r.acordo_max_parcelas, acordoMaxDiasPromessa: r.acordo_max_dias_promessa,
    mimoAniversario: r.mimo_aniversario, ofertaVolta: r.oferta_volta, ofertaRenovacao: r.oferta_renovacao,
    ativadaEm: r.ativada_em ? new Date(r.ativada_em) : null,
    baseLegalMarketing: r.base_legal_marketing || 'consentimento',
  };
}

export async function obterConfig(db, empresaId) {
  const r = await db.query('SELECT * FROM clube_retencao_config WHERE empresa_id = $1', [exigirUuid(empresaId, 'empresa')]);
  return configDeLinha(r.rows[0]);
}

function inteiroEntre(v, campo, min, max, padrao) {
  if (v === undefined || v === null || v === '') return padrao;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new ErroDominio('VALIDATION_ERROR', `${campo} deve ser inteiro entre ${min} e ${max}`);
  return n;
}
function numeroEntre(v, campo, min, max, padrao) {
  if (v === undefined || v === null || v === '') return padrao;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n < min || n > max) throw new ErroDominio('VALIDATION_ERROR', `${campo} deve estar entre ${min} e ${max}`);
  return n;
}
function textoOpcional(v, campo, max) {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  return exigirTexto(v, campo, { max });
}

export async function salvarConfig(db, empresaId, dados = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const atual = await obterConfig(db, empresa);
  const c = { ...atual };
  if (dados.ativo !== undefined) c.ativo = Boolean(dados.ativo);
  if (dados.tom !== undefined) {
    if (!TONS.includes(dados.tom)) throw new ErroDominio('VALIDATION_ERROR', `tom deve ser ${TONS.join(', ')}`);
    c.tom = dados.tom;
  }
  c.intervaloDias = inteiroEntre(dados.intervaloDias, 'intervaloDias', 1, 30, c.intervaloDias);
  c.horaInicio = inteiroEntre(dados.horaInicio, 'horaInicio', 0, 23, c.horaInicio);
  c.horaFim = inteiroEntre(dados.horaFim, 'horaFim', 1, 24, c.horaFim);
  if (c.horaFim <= c.horaInicio) throw new ErroDominio('VALIDATION_ERROR', 'horaFim deve ser depois de horaInicio');
  if (dados.enviaDomingo !== undefined) c.enviaDomingo = Boolean(dados.enviaDomingo);
  c.limiteDiario = inteiroEntre(dados.limiteDiario, 'limiteDiario', 0, 5000, c.limiteDiario);
  c.pausaRespostaDias = inteiroEntre(dados.pausaRespostaDias, 'pausaRespostaDias', 0, 30, c.pausaRespostaDias);
  if (dados.fuso !== undefined) {
    try { new Intl.DateTimeFormat('en-US', { timeZone: dados.fuso }); } catch { throw new ErroDominio('VALIDATION_ERROR', 'fuso inválido'); }
    c.fuso = dados.fuso;
  }
  if (dados.telefoneGestor !== undefined) {
    const t = String(dados.telefoneGestor || '').replace(/\D/g, '');
    if (t && (t.length < 10 || t.length > 13)) throw new ErroDominio('VALIDATION_ERROR', 'telefoneGestor inválido');
    c.telefoneGestor = t || null;
  }
  // CDC art. 52 §1º: multa de mora até 2%; juros de mora usuais de 1% ao mês
  c.multaPercentual = numeroEntre(dados.multaPercentual, 'multaPercentual', 0, 2, c.multaPercentual);
  c.jurosMesPercentual = numeroEntre(dados.jurosMesPercentual, 'jurosMesPercentual', 0, 1, c.jurosMesPercentual);
  c.acordoMaxParcelas = inteiroEntre(dados.acordoMaxParcelas, 'acordoMaxParcelas', 1, 12, c.acordoMaxParcelas);
  c.acordoMaxDiasPromessa = inteiroEntre(dados.acordoMaxDiasPromessa, 'acordoMaxDiasPromessa', 0, 30, c.acordoMaxDiasPromessa);
  if (dados.baseLegalMarketing !== undefined) {
    if (!['consentimento', 'legitimo_interesse'].includes(dados.baseLegalMarketing)) throw new ErroDominio('VALIDATION_ERROR', 'baseLegalMarketing deve ser consentimento ou legitimo_interesse');
    c.baseLegalMarketing = dados.baseLegalMarketing;
  }
  for (const [k, campo] of [['mimoAniversario', 'mimoAniversario'], ['ofertaVolta', 'ofertaVolta'], ['ofertaRenovacao', 'ofertaRenovacao']]) {
    if (dados[k] !== undefined) c[k] = textoOpcional(dados[k], campo, 160);
  }
  await db.query(
    `INSERT INTO clube_retencao_config (empresa_id, ativo, tom, intervalo_dias, hora_inicio, hora_fim, envia_domingo, limite_diario,
       pausa_resposta_dias, fuso, telefone_gestor, multa_percentual, juros_mes_percentual, acordo_max_parcelas, acordo_max_dias_promessa,
       mimo_aniversario, oferta_volta, oferta_renovacao, ativada_em, base_legal_marketing, atualizado_em)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18, CASE WHEN $2 THEN CURRENT_TIMESTAMP END, $19, CURRENT_TIMESTAMP)
     ON CONFLICT (empresa_id) DO UPDATE SET ativo = EXCLUDED.ativo, tom = EXCLUDED.tom, intervalo_dias = EXCLUDED.intervalo_dias,
       hora_inicio = EXCLUDED.hora_inicio, hora_fim = EXCLUDED.hora_fim, envia_domingo = EXCLUDED.envia_domingo,
       limite_diario = EXCLUDED.limite_diario, pausa_resposta_dias = EXCLUDED.pausa_resposta_dias, fuso = EXCLUDED.fuso,
       telefone_gestor = EXCLUDED.telefone_gestor, multa_percentual = EXCLUDED.multa_percentual,
       juros_mes_percentual = EXCLUDED.juros_mes_percentual, acordo_max_parcelas = EXCLUDED.acordo_max_parcelas,
       acordo_max_dias_promessa = EXCLUDED.acordo_max_dias_promessa, mimo_aniversario = EXCLUDED.mimo_aniversario,
       oferta_volta = EXCLUDED.oferta_volta, oferta_renovacao = EXCLUDED.oferta_renovacao,
       ativada_em = COALESCE(clube_retencao_config.ativada_em, EXCLUDED.ativada_em),
       base_legal_marketing = EXCLUDED.base_legal_marketing, atualizado_em = CURRENT_TIMESTAMP`,
    [empresa, c.ativo, c.tom, c.intervaloDias, c.horaInicio, c.horaFim, c.enviaDomingo, c.limiteDiario, c.pausaRespostaDias, c.fuso,
      c.telefoneGestor, c.multaPercentual, c.jurosMesPercentual, c.acordoMaxParcelas, c.acordoMaxDiasPromessa,
      c.mimoAniversario, c.ofertaVolta, c.ofertaRenovacao, c.baseLegalMarketing],
  );
  return c;
}

async function reguasDaEmpresa(db, empresa) {
  const r = await db.query('SELECT gatilho, ativo, parametros, textos FROM clube_retencao_reguas WHERE empresa_id = $1', [empresa]);
  return Object.fromEntries(r.rows.map((x) => [x.gatilho, { ativo: x.ativo, parametros: x.parametros || {}, textos: x.textos }]));
}

export async function listarReguas(db, empresaId) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const salvas = await reguasDaEmpresa(db, empresa);
  return Object.entries(GATILHOS).map(([gatilho, g]) => ({
    gatilho,
    prioridade: g.prioridade,
    marketing: g.marketing,
    ativo: salvas[gatilho]?.ativo !== false,
    parametros: { ...g.padrao, ...(salvas[gatilho]?.parametros || {}) },
    textos: salvas[gatilho]?.textos || null,
    textosBase: TEXTOS_BASE[gatilho],
  }));
}

/** Valida os parâmetros de cada gatilho: só as chaves conhecidas, números inteiros em faixa. */
function validarParametros(gatilho, parametros = {}) {
  const padrao = GATILHOS[gatilho].padrao;
  const limpo = {};
  for (const [k, v] of Object.entries(parametros || {})) {
    if (!(k in padrao)) throw new ErroDominio('VALIDATION_ERROR', `parâmetro desconhecido para ${gatilho}: ${k}`);
    if (Array.isArray(padrao[k])) {
      if (!Array.isArray(v) || !v.length || v.length > 6 || v.some((n) => !Number.isInteger(n) || n < 0 || n > 365)) {
        throw new ErroDominio('VALIDATION_ERROR', `${k}: lista de 1 a 6 dias (0 a 365)`);
      }
      limpo[k] = [...new Set(v)];
    } else if (k === 'queda') {
      const n = Number(v);
      if (!(n > 0 && n < 1)) throw new ErroDominio('VALIDATION_ERROR', 'queda: fração entre 0 e 1 (ex.: 0.5)');
      limpo[k] = n;
    } else {
      if (!Number.isInteger(v) || v < 1 || v > 365) throw new ErroDominio('VALIDATION_ERROR', `${k}: inteiro de 1 a 365`);
      limpo[k] = v;
    }
  }
  if (gatilho === 'faltante_leve' && limpo.dias !== undefined && limpo.dias < 2) throw new ErroDominio('VALIDATION_ERROR', 'faltante leve: mínimo 2 dias');
  return limpo;
}

function validarTextos(textos) {
  if (textos === null || textos === undefined) return null;
  const lista = (l, rotulo) => {
    if (!Array.isArray(l) || !l.length || l.length > 6) throw new ErroDominio('VALIDATION_ERROR', `${rotulo}: de 1 a 6 variações`);
    return l.map((t) => exigirTexto(t, rotulo, { min: 10, max: 600 }));
  };
  if (Array.isArray(textos)) return lista(textos, 'textos');
  const out = {};
  for (const [tom, l] of Object.entries(textos)) {
    if (!TONS.includes(tom)) throw new ErroDominio('VALIDATION_ERROR', `tom desconhecido: ${tom}`);
    out[tom] = lista(l, `textos.${tom}`);
  }
  return out;
}

export async function salvarRegua(db, empresaId, gatilho, dados = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  if (!GATILHOS[gatilho]) throw new ErroDominio('NOT_FOUND', 'Gatilho desconhecido', 404);
  const parametros = validarParametros(gatilho, dados.parametros);
  const textos = validarTextos(dados.textos);
  await db.query(
    `INSERT INTO clube_retencao_reguas (empresa_id, gatilho, ativo, parametros, textos, atualizado_em)
     VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
     ON CONFLICT (empresa_id, gatilho) DO UPDATE SET ativo = EXCLUDED.ativo, parametros = EXCLUDED.parametros,
       textos = EXCLUDED.textos, atualizado_em = CURRENT_TIMESTAMP`,
    [empresa, gatilho, dados.ativo !== false, JSON.stringify(parametros), textos ? JSON.stringify(textos) : null],
  );
  return (await listarReguas(db, empresa)).find((r) => r.gatilho === gatilho);
}

/* ------------------------------------------------------------------ */
/* Foto dos alunos (uma consulta por academia)                         */
/* ------------------------------------------------------------------ */

/**
 * Uma linha por pessoa relevante para a régua: matrícula ativa/congelada, cancelada há até 100 dias,
 * ou interessado em aberto. `extras.checkinsParceiroMes` (item 2) devolve Map customerId -> n.
 */
export async function fotosDaEmpresa(db, empresa, { agora, fuso, extras = {}, ativadaEm = null }) {
  const r = await db.query(
    `WITH mat AS (
       SELECT DISTINCT ON (m.customer_id) m.*, p.valor_mensal
         FROM acesso_matriculas m JOIN acesso_planos p ON p.id = m.plano_id
        WHERE m.empresa_id = $1 AND (m.status IN ('ativa', 'congelada') OR m.cancelada_em > $2::timestamptz - interval '100 days')
        ORDER BY m.customer_id, (m.status = 'ativa') DESC, (m.status = 'congelada') DESC, m.criado_em DESC
     ), pros AS (
       SELECT DISTINCT ON (customer_id) id, customer_id, criado_em, origem FROM clube_prospects
        WHERE empresa_id = $1 AND convertido_em IS NULL AND perdido_em IS NULL ORDER BY customer_id, criado_em DESC
     ), alvo AS (
       SELECT customer_id FROM mat UNION SELECT customer_id FROM pros
     )
     SELECT a.customer_id, c.nome, c.telefone,
            mat.id AS matricula_id, mat.status, mat.pago_ate::text AS pago_ate, mat.inicio::text AS inicio,
            mat.fim_fidelidade::text AS fim_fidelidade, mat.cancelada_em, mat.valor_mensal,
            (SELECT to_char(MAX(e.ocorrido_em) AT TIME ZONE $3, 'YYYY-MM-DD') FROM acesso_eventos e
              WHERE e.empresa_id = $1 AND e.customer_id = a.customer_id AND e.decisao = 'liberado') AS ultimo_acesso,
            (SELECT COUNT(DISTINCT (e.ocorrido_em AT TIME ZONE $3)::date)::int FROM acesso_eventos e
              WHERE e.empresa_id = $1 AND e.customer_id = a.customer_id AND e.decisao = 'liberado'
                AND e.ocorrido_em > $2::timestamptz - interval '28 days' AND e.ocorrido_em <= $2) AS acessos4,
            (SELECT COUNT(DISTINCT (e.ocorrido_em AT TIME ZONE $3)::date)::int FROM acesso_eventos e
              WHERE e.empresa_id = $1 AND e.customer_id = a.customer_id AND e.decisao = 'liberado'
                AND e.ocorrido_em > $2::timestamptz - interval '56 days' AND e.ocorrido_em <= $2::timestamptz - interval '28 days') AS acessos_ant4,
            cp.data_nascimento::text AS data_nascimento,
            pros.id AS prospect_id, to_char(pros.criado_em AT TIME ZONE $3, 'YYYY-MM-DD') AS prospect_desde, pros.origem AS prospect_origem,
            (SELECT (MAX(g.fim) + 1)::text FROM clube_congelamentos g WHERE g.empresa_id = $1 AND g.customer_id = a.customer_id
              AND g.status IN ('ativo', 'encerrado') AND g.fim < ($2::timestamptz AT TIME ZONE $3)::date) AS fim_congelamento,
            ct.optout_em, ct.ultima_resposta_em, ct.promessa_ate::text AS promessa_ate, ct.marketing_consentido_em,
            (SELECT MAX(d.enviado_em) FROM clube_retencao_disparos d
              WHERE d.empresa_id = $1 AND d.customer_id = a.customer_id AND d.status <> 'falhou') AS ultimo_disparo_em,
            EXISTS (SELECT 1 FROM acesso_matriculas m2 WHERE m2.empresa_id = $1 AND m2.customer_id = a.customer_id
                     AND m2.status IN ('ativa', 'congelada')) AS tem_matricula_ativa,
            (SELECT n.nota FROM clube_retencao_notas n WHERE n.empresa_id = $1 AND n.customer_id = a.customer_id
              ORDER BY n.criado_em DESC LIMIT 1) AS ultima_nota,
            EXISTS (SELECT 1 FROM clube_retencao_ocorrencias o WHERE o.empresa_id = $1 AND o.customer_id = a.customer_id
                     AND o.status <> 'resolvida') AS ocorrencia_aberta
       FROM alvo a
       JOIN commerce_customers c ON c.empresa_id = $1 AND c.id = a.customer_id
       LEFT JOIN mat ON mat.customer_id = a.customer_id
       LEFT JOIN pros ON pros.customer_id = a.customer_id
       LEFT JOIN clube_pessoas cp ON cp.empresa_id = $1 AND cp.customer_id = a.customer_id
       LEFT JOIN clube_retencao_contatos ct ON ct.empresa_id = $1 AND ct.customer_id = a.customer_id`,
    [empresa, agora, fuso],
  );
  const hoje = hojeNoFuso(agora, fuso);
  const parceiros = extras.checkinsParceiroMes ? await extras.checkinsParceiroMes(db, empresa, { agora, fuso }) : new Map();
  const temAcessos = (await db.query("SELECT EXISTS (SELECT 1 FROM acesso_eventos WHERE empresa_id = $1 AND decisao = 'liberado') AS ok", [empresa])).rows[0].ok;
  const ativada = ativadaEm ? hojeNoFuso(ativadaEm, fuso) : null;
  return r.rows.map((x) => ({
    customerId: x.customer_id,
    nome: x.nome,
    telefone: x.telefone,
    hoje,
    matricula: x.matricula_id ? {
      id: x.matricula_id,
      status: x.status,
      pagoAte: x.pago_ate,
      inicio: x.inicio,
      fimFidelidade: x.fim_fidelidade,
      canceladaEm: x.cancelada_em ? hojeNoFuso(new Date(x.cancelada_em), fuso) : null,
      valorMensal: x.valor_mensal == null ? null : Number(x.valor_mensal),
    } : null,
    ultimoAcesso: x.ultimo_acesso,
    acessos4: x.acessos4,
    acessosAnt4: x.acessos_ant4,
    dataNascimento: x.data_nascimento,
    prospect: x.prospect_id ? { id: x.prospect_id, criadoEm: x.prospect_desde, origem: x.prospect_origem } : null,
    fimUltimoCongelamento: x.fim_congelamento,
    empresaTemAcessos: temAcessos,
    ativadaEm: ativada,
    optoutEm: x.optout_em,
    marketingConsentidoEm: x.marketing_consentido_em,
    ultimaRespostaEm: x.ultima_resposta_em,
    promessaAte: x.promessa_ate,
    ultimoDisparoEm: x.ultimo_disparo_em,
    temMatriculaAtiva: x.tem_matricula_ativa,
    ultimaNota: x.ultima_nota,
    ocorrenciaAberta: x.ocorrencia_aberta,
    checkinsParceiroMes: parceiros.get(x.customer_id) || 0,
  }));
}

/* ------------------------------------------------------------------ */
/* Financeiro (valor atualizado com multa e juros)                     */
/* ------------------------------------------------------------------ */

/**
 * Valor devido estimado a partir do "pago até" e da mensalidade do plano. Se o agro-open tiver a
 * cobrança real (crediário, gateway por empresa), `externo({ empresaId, customerId })` substitui o cálculo.
 */
export function calcularDevido({ pagoAte, valorMensal, hoje, multaPercentual = 2, jurosMesPercentual = 1 }) {
  const atraso = Math.max(0, Math.round((Date.parse(`${hoje}T12:00:00Z`) - Date.parse(`${pagoAte}T12:00:00Z`)) / DIA_MS));
  if (!atraso) return { diasAtraso: 0, mesesEmAberto: 0, valorOriginal: 0, multa: 0, juros: 0, total: 0 };
  const meses = Math.ceil(atraso / 30);
  if (valorMensal === null || valorMensal === undefined) return { diasAtraso: atraso, mesesEmAberto: meses, valorOriginal: null, multa: null, juros: null, total: null };
  const original = Math.round(meses * valorMensal * 100) / 100;
  const multa = Math.round(original * (multaPercentual / 100) * 100) / 100;
  const juros = Math.round(original * (jurosMesPercentual / 100 / 30) * atraso * 100) / 100;
  return { diasAtraso: atraso, mesesEmAberto: meses, valorOriginal: original, multa, juros, total: Math.round((original + multa + juros) * 100) / 100 };
}

/* ------------------------------------------------------------------ */
/* Link de pagamento reaproveitado                                     */
/* ------------------------------------------------------------------ */

/**
 * Um link aberto por aluno e valor por 24 h: cada passo da régua, a catraca e a IA reaproveitam o
 * mesmo link em vez de abrir várias cobranças da mesma dívida (o aluno poderia pagar duas).
 */
export async function linkDePagamento(db, { empresaId, customerId, valor, parcelas = 1, descricao = 'Mensalidade', gerar, agora = new Date() }) {
  if (!gerar) return null;
  // sem valor conhecido (plano sem mensalidade cadastrada): a cobrança do agro-open decide o valor; não reaproveita
  if (!valor) return gerar({ empresaId, customerId, valor: null, parcelas, descricao });
  const v = Math.round(Number(valor) * 100) / 100;
  if (parcelas === 1) {
    const r = await db.query(
      `SELECT link_pagamento FROM clube_retencao_contatos WHERE empresa_id = $1 AND customer_id = $2
        AND link_pagamento IS NOT NULL AND link_valor = $3 AND link_criado_em > $4::timestamptz - interval '24 hours'`,
      [empresaId, customerId, v, agora],
    );
    // reaproveita só se a cobrança do link ainda estiver em aberto e na validade
    if (r.rows[0] && (!gerar.valido || await gerar.valido(r.rows[0].link_pagamento))) return r.rows[0].link_pagamento;
  }
  const link = await gerar({ empresaId, customerId, valor: v, parcelas, descricao });
  if (link && parcelas === 1) {
    await db.query(
      `INSERT INTO clube_retencao_contatos (empresa_id, customer_id, link_pagamento, link_valor, link_criado_em) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (empresa_id, customer_id) DO UPDATE SET link_pagamento = EXCLUDED.link_pagamento, link_valor = EXCLUDED.link_valor, link_criado_em = EXCLUDED.link_criado_em`,
      [empresaId, customerId, String(link).slice(0, 500), v, agora],
    );
  }
  return link;
}

/* ------------------------------------------------------------------ */
/* Execução da régua                                                   */
/* ------------------------------------------------------------------ */

function ofertaPadrao(gatilho, cfg) {
  if (gatilho === 'renovacao') return cfg.ofertaRenovacao || 'uma condição especial de renovação que a gente preparou pra você';
  if (gatilho === 'ex_aluno') return cfg.ofertaVolta || 'uma condição especial de retorno';
  if (gatilho === 'parceiro_frequente') return cfg.ofertaVolta || 'condição de boas-vindas no primeiro mês';
  return '';
}

async function dadosDoTexto(f, candidato, cfg, deps) {
  const primeiro = String(f.nome || '').trim().split(/\s+/)[0] || '';
  const dados = { nome: primeiro, dias: candidato.dados.dias ?? '', mimo: cfg.mimoAniversario || '', oferta: ofertaPadrao(candidato.gatilho, cfg) };
  let valorRisco = f.matricula?.valorMensal ?? null;
  if (FINANCEIROS.includes(candidato.gatilho)) {
    let valor = f.matricula?.valorMensal ?? null;
    if (candidato.gatilho === 'inadimplente') {
      const d = calcularDevido({ pagoAte: f.matricula.pagoAte, valorMensal: f.matricula.valorMensal, hoje: f.hoje, multaPercentual: cfg.multaPercentual, jurosMesPercentual: cfg.jurosMesPercentual });
      valor = d.total;
    }
    valorRisco = valor;
    dados.valor = valor === null ? 'a mensalidade' : formatarReais(valor);
    let link = null;
    if (deps.gerarLinkPagamento && valor) {
      link = await linkDePagamento(deps.db, { empresaId: f.empresaId, customerId: f.customerId, valor, gerar: deps.gerarLinkPagamento, agora: deps.agora }).catch(() => null);
    }
    dados.link = link ? `Pague pelo Pix aqui: ${link}` : 'Quer que eu gere o Pix pra você?';
  }
  return { dados, valorRisco };
}

/**
 * Executa a régua de uma academia. Com `simular: true` não envia nada e ignora o horário:
 * devolve quem receberia agora (prévia do painel).
 * @param {{ agora?: Date, enviarWhatsapp?: Function, gerarLinkPagamento?: Function, extras?: object, simular?: boolean }} opcoes
 */
export const AVISO_PARAR = 'Se não quiser mais receber estas mensagens, responda PARAR.';

export async function executarRegua(db, empresaId, { agora = new Date(), enviarWhatsapp = null, gerarLinkPagamento = null, extras = {}, simular = false } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const cfg = await obterConfig(db, empresa);
  const resumo = { enviados: 0, falhas: 0, candidatos: 0, bloqueados: {}, previa: [] };
  if (!cfg.ativo && !simular) return { ...resumo, desligada: true };
  const reguas = await reguasDaEmpresa(db, empresa);
  const relogio = relogioLocal(agora, cfg.fuso);
  const hoje = hojeNoFuso(agora, cfg.fuso);
  const inicioDia = instanteNoFuso(hoje, '00:00', cfg.fuso);
  const enviados = await db.query(
    "SELECT COUNT(*)::int AS n FROM clube_retencao_disparos WHERE empresa_id = $1 AND enviado_em >= $2 AND status <> 'falhou'",
    [empresa, inicioDia],
  );
  let enviadosHoje = enviados.rows[0].n;
  const fotos = await fotosDaEmpresa(db, empresa, { agora, fuso: cfg.fuso, extras, ativadaEm: cfg.ativadaEm });
  const ja = await db.query(
    `SELECT customer_id, chave, status, tentativas, enviado_em FROM clube_retencao_disparos
      WHERE empresa_id = $1 AND enviado_em > $2::timestamptz - interval '200 days'`,
    [empresa, agora],
  );
  // episódio já tratado: qualquer status, menos falha que ainda pode ser tentada de novo (até 3x, a cada 30 min)
  const bloqueado = new Set(ja.rows
    .filter((d) => !(d.status === 'falhou' && d.tentativas < 3 && agora - new Date(d.enviado_em) > 30 * 60000))
    .map((d) => `${d.customer_id}|${d.chave}`));
  const conta = (motivo) => { resumo.bloqueados[motivo] = (resumo.bloqueados[motivo] || 0) + 1; };

  const escolhidos = [];
  for (const f of fotos) {
    f.empresaId = empresa;
    const candidatos = avaliarGatilhos(f, reguas).filter((c) => !bloqueado.has(`${f.customerId}|${c.chave}`));
    if (!candidatos.length) continue;
    resumo.candidatos += 1;
    if (!f.telefone) { conta('sem_telefone'); continue; }
    let escolhido = null; let motivo = null;
    for (const c of candidatos) {
      // LGPD: marketing só com a base legal escolhida pela academia (padrão: consentimento)
      if (c.marketing && cfg.baseLegalMarketing === 'consentimento' && !f.marketingConsentidoEm) { motivo = 'sem_consentimento'; continue; }
      motivo = bloqueioDeCadencia({
        horaLocal: simular ? cfg.horaInicio : relogio.hora,
        diaSemana: simular ? 1 : relogio.diaSemana,
        enviadosHoje: 0, // o limite diário é aplicado depois, por prioridade entre todos os alunos
        optoutEm: f.optoutEm, ultimaRespostaEm: f.ultimaRespostaEm, ultimoDisparoEm: f.ultimoDisparoEm, agora,
      }, cfg, c);
      if (!motivo) { escolhido = c; break; }
      if (motivo !== 'optout') break; // cadência/horário valem para todos os gatilhos do aluno
    }
    if (!escolhido) { conta(motivo); continue; }
    escolhidos.push({ f, c: escolhido });
  }

  // limite diário do número: os mais importantes primeiro (prioridade, depois valor em jogo)
  escolhidos.sort((a, b) => b.c.prioridade - a.c.prioridade || (b.f.matricula?.valorMensal || 0) - (a.f.matricula?.valorMensal || 0));
  for (const { f, c } of escolhidos) {
    if (enviadosHoje >= cfg.limiteDiario) { conta('limite_diario'); continue; }
    const montar = async (deps) => {
      const { dados, valorRisco } = await dadosDoTexto(f, c, cfg, deps);
      return { texto: montarTexto(c.gatilho, { tom: cfg.tom, personalizados: reguas[c.gatilho]?.textos, semente: `${f.customerId}:${c.chave}`, dados }), valorRisco };
    };
    if (simular) {
      const { texto } = await montar({});
      resumo.previa.push({ customerId: f.customerId, nome: f.nome, gatilho: c.gatilho, texto });
      enviadosHoje += 1;
      continue;
    }
    // reserva o episódio ANTES de gerar link ou texto: outro ciclo nunca gera cobrança para o mesmo episódio
    const textoProvisorio = '(preparando)';
    const reserva = await db.query(
      `INSERT INTO clube_retencao_disparos (empresa_id, customer_id, gatilho, chave, texto, valor_risco, enviado_em)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (empresa_id, customer_id, chave) DO UPDATE
         SET status = 'enviado', texto = EXCLUDED.texto, enviado_em = EXCLUDED.enviado_em, erro = NULL,
             tentativas = clube_retencao_disparos.tentativas + 1
         WHERE clube_retencao_disparos.status = 'falhou' AND clube_retencao_disparos.tentativas < 3
       RETURNING id`,
      [empresa, f.customerId, c.gatilho, c.chave, textoProvisorio, null, agora],
    );
    if (!reserva.rows[0]) continue; // outro ciclo já tratou este episódio
    enviadosHoje += 1;
    try {
      const montado = await montar({ gerarLinkPagamento, db, agora });
      const risco = montado.valorRisco;
      // LGPD: toda mensagem de novidade/campanha diz como parar (cobrança é informativa e não leva)
      const texto = c.marketing ? `${montado.texto}\n\n${AVISO_PARAR}` : montado.texto;
      await db.query('UPDATE clube_retencao_disparos SET texto = $2, valor_risco = $3 WHERE id = $1', [reserva.rows[0].id, texto, risco]);
      if (!enviarWhatsapp) throw new Error('canal de WhatsApp não configurado');
      const envio = await enviarWhatsapp({ empresaId: empresa, customerId: f.customerId, telefone: f.telefone, texto, tipo: 'retencao', gatilho: c.gatilho, marketing: c.marketing });
      // o adaptador do agro-open devolve { ok: false } em vez de lançar (canal inativo, trava de saída)
      if (envio && envio.ok === false) throw new Error(String(envio.error || envio.status || 'não enviado'));
      resumo.enviados += 1;
    } catch (error) {
      enviadosHoje -= 1;
      resumo.falhas += 1;
      await db.query("UPDATE clube_retencao_disparos SET status = 'falhou', erro = $2 WHERE id = $1", [reserva.rows[0].id, String(error?.message || 'falha').slice(0, 240)]);
    }
  }
  return resumo;
}

/* ------------------------------------------------------------------ */
/* Resultados                                                          */
/* ------------------------------------------------------------------ */

async function existeTabela(db, nome) {
  const r = await db.query('SELECT to_regclass($1) IS NOT NULL AS ok', [nome]);
  return r.rows[0].ok;
}

/**
 * Atribui o que aconteceu depois de cada disparo (rotina). Cada regra só olha disparos dos últimos
 * 30 dias ainda não resolvidos, e o resultado é a primeira coisa que aconteceu depois do envio.
 */
export async function atribuirResultados(db, { agora = new Date() } = {}) {
  const resumo = {};
  const marcar = async (nome, sql) => { resumo[nome] = (await db.query(sql, [agora])).rowCount; };
  const abertos = `d.status IN ('enviado', 'respondeu') AND d.enviado_em > $1::timestamptz - interval '30 days'`;
  // o mesmo filtro dentro de cada subconsulta: o custo não cresce com o histórico
  const abertos2 = `d2.status IN ('enviado', 'respondeu') AND d2.enviado_em > $1::timestamptz - interval '30 days'`;

  await marcar('voltou', `
    UPDATE clube_retencao_disparos d SET status = 'resolvido', resultado = 'voltou', resolvido_em = x.em
      FROM (SELECT d2.id, MIN(e.ocorrido_em) AS em FROM clube_retencao_disparos d2
              JOIN acesso_eventos e ON e.empresa_id = d2.empresa_id AND e.customer_id = d2.customer_id
                   AND e.decisao = 'liberado' AND e.ocorrido_em > d2.enviado_em
             WHERE d2.gatilho IN ('faltante_leve', 'faltante_serio', 'risco_cancelar') AND ${abertos2} GROUP BY d2.id) x
     WHERE d.id = x.id AND ${abertos}`);

  if (await existeTabela(db, 'aulas_reservas')) {
    await marcar('reservou', `
      UPDATE clube_retencao_disparos d SET status = 'resolvido', resultado = 'reservou', resolvido_em = x.em
        FROM (SELECT d2.id, MIN(r.criado_em) AS em FROM clube_retencao_disparos d2
                JOIN aulas_reservas r ON r.empresa_id = d2.empresa_id AND r.customer_id = d2.customer_id AND r.criado_em > d2.enviado_em
               WHERE d2.gatilho IN ('faltante_leve', 'faltante_serio', 'risco_cancelar') AND ${abertos2} GROUP BY d2.id) x
       WHERE d.id = x.id AND ${abertos}`);
  }

  await marcar('matriculou', `
    UPDATE clube_retencao_disparos d SET status = 'resolvido', resultado = 'matriculou', resolvido_em = x.em
      FROM (SELECT d2.id, MIN(m.criado_em) AS em FROM clube_retencao_disparos d2
              JOIN acesso_matriculas m ON m.empresa_id = d2.empresa_id AND m.customer_id = d2.customer_id
                   AND m.criado_em > d2.enviado_em AND m.status <> 'cancelada'
             WHERE d2.gatilho IN ('prospect', 'ex_aluno', 'parceiro_frequente') AND ${abertos2} GROUP BY d2.id) x
     WHERE d.id = x.id AND ${abertos}`);

  // renovou: aceitou contrato depois do convite (item 3) ou ganhou nova matrícula/fidelidade
  const temContratos = await existeTabela(db, 'clube_contratos');
  await marcar('renovou', `
    UPDATE clube_retencao_disparos d SET status = 'resolvido', resultado = 'renovou', resolvido_em = x.em
      FROM (SELECT d2.id, LEAST(
                (SELECT MIN(m.atualizado_em) FROM acesso_matriculas m WHERE m.empresa_id = d2.empresa_id AND m.customer_id = d2.customer_id
                   AND m.atualizado_em > d2.enviado_em AND m.fim_fidelidade > split_part(d2.chave, ':', 2)::date)
                ${temContratos ? `, (SELECT MIN(c.aceito_em) FROM clube_contratos c WHERE c.empresa_id = d2.empresa_id AND c.customer_id = d2.customer_id
                   AND c.status = 'aceito' AND c.aceito_em > d2.enviado_em)` : ''}) AS em
              FROM clube_retencao_disparos d2 WHERE d2.gatilho = 'renovacao' AND ${abertos2}) x
     WHERE d.id = x.id AND x.em IS NOT NULL AND ${abertos}`);

  await marcar('avaliou', `
    UPDATE clube_retencao_disparos d SET status = 'resolvido', resultado = 'avaliou', resolvido_em = x.em
      FROM (SELECT d2.id, MIN(n.criado_em) AS em FROM clube_retencao_disparos d2
              JOIN clube_retencao_notas n ON n.empresa_id = d2.empresa_id AND n.customer_id = d2.customer_id AND n.criado_em > d2.enviado_em
             WHERE d2.gatilho = 'pos_aula' AND ${abertos2} GROUP BY d2.id) x
     WHERE d.id = x.id AND ${abertos}`);
  return resumo;
}

/**
 * Pagamento recebido (painel, Pix da academia, crediário): soma a receita recuperada no disparo mais recente
 * dos últimos 15 dias (preferindo os de cobrança), cumpre acordo aberto e tira a promessa.
 * É o que deixa a "receita recuperada" do painel conferível com os pagamentos.
 */
export async function registrarPagamentoRecebido(db, { empresaId, customerId, valor = null, agora = new Date() }) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const cliente = exigirUuid(customerId, 'cliente');
  return transacao(db, async (q) => {
    const d = await q(
      `SELECT id, gatilho, resultado, valor_risco FROM clube_retencao_disparos
        WHERE empresa_id = $1 AND customer_id = $2 AND status IN ('enviado', 'respondeu', 'resolvido')
          AND enviado_em > $3::timestamptz - interval '15 days' AND enviado_em <= $3
        ORDER BY (gatilho IN ('inadimplente', 'vencimento')) DESC, enviado_em DESC LIMIT 1 FOR UPDATE`,
      [empresa, cliente, agora],
    );
    // acordo só é cumprido quando o total combinado entra (parcela por parcela); sem valor informado, conta como quitado
    const valorPago = valor === null || valor === undefined || valor === '' ? null : Number(valor);
    const acordo = await q(
      `UPDATE clube_retencao_acordos SET valor_pago = valor_pago + COALESCE($3::numeric, valor_total),
              status = CASE WHEN valor_pago + COALESCE($3::numeric, valor_total) >= valor_total - 0.01 THEN 'cumprido' ELSE status END
        WHERE empresa_id = $1 AND customer_id = $2 AND status = 'aberto' RETURNING status`,
      [empresa, cliente, valorPago],
    );
    if (!acordo.rows[0] || acordo.rows.some((a) => a.status === 'cumprido')) {
      await q('UPDATE clube_retencao_contatos SET promessa_ate = NULL WHERE empresa_id = $1 AND customer_id = $2', [empresa, cliente]);
    }
    const alvo = d.rows[0];
    if (!alvo) return { atribuido: false };
    const v = valor === null || valor === undefined ? (alvo.valor_risco == null ? null : Number(alvo.valor_risco)) : Number(valor);
    await q(
      `UPDATE clube_retencao_disparos SET status = 'resolvido', resolvido_em = COALESCE(resolvido_em, $2),
              resultado = COALESCE(resultado, 'pagou'), valor_recuperado = COALESCE(valor_recuperado, 0) + COALESCE($3::numeric, 0)
        WHERE id = $1`,
      [alvo.id, agora, v],
    );
    return { atribuido: true, disparoId: alvo.id, gatilho: alvo.gatilho, valor: v };
  });
}

/* ------------------------------------------------------------------ */
/* Mensagem recebida do aluno (pausa e opt-out)                        */
/* ------------------------------------------------------------------ */

/**
 * Ligar no recebimento de mensagens do WhatsApp (antes da IA responder):
 * - qualquer resposta pausa a régua e marca o último disparo como respondido;
 * - "parar"/"não quero mais" grava o opt-out de marketing na hora (cobrança continua informativa);
 * - pedido de cancelamento é sinalizado para a IA transferir para humano.
 */
export async function registrarMensagemRecebida(db, { empresaId, customerId, texto = '', agora = new Date() }) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const cliente = exigirUuid(customerId, 'cliente');
  const optout = ehOptOut(texto);
  await db.query(
    `INSERT INTO clube_retencao_contatos (empresa_id, customer_id, ultima_resposta_em, optout_em, optout_texto)
     VALUES ($1, $2, $3, CASE WHEN $4 THEN $3::timestamptz END, CASE WHEN $4 THEN $5 END)
     ON CONFLICT (empresa_id, customer_id) DO UPDATE SET ultima_resposta_em = EXCLUDED.ultima_resposta_em,
       optout_em = COALESCE(clube_retencao_contatos.optout_em, EXCLUDED.optout_em),
       optout_texto = COALESCE(clube_retencao_contatos.optout_texto, EXCLUDED.optout_texto),
       marketing_consentido_em = CASE WHEN $4 THEN NULL ELSE clube_retencao_contatos.marketing_consentido_em END`,
    [empresa, cliente, agora, optout, String(texto).slice(0, 200)],
  );
  const ultimo = await db.query(
    `UPDATE clube_retencao_disparos SET status = CASE WHEN $4 AND gatilho NOT IN ('inadimplente', 'vencimento') THEN 'optout' ELSE 'respondeu' END,
            respondido_em = COALESCE(respondido_em, $3)
      WHERE id = (SELECT id FROM clube_retencao_disparos WHERE empresa_id = $1 AND customer_id = $2
                   AND status = 'enviado' AND enviado_em > $3::timestamptz - interval '7 days' ORDER BY enviado_em DESC LIMIT 1)
      RETURNING gatilho`,
    [empresa, cliente, agora, optout],
  );
  return { optout, pedidoCancelamento: pedeCancelamento(texto), respondeuGatilho: ultimo.rows[0]?.gatilho || null };
}

export async function registrarOptout(db, { empresaId, customerId, texto = 'pedido pela conversa', agora = new Date() }) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const cliente = exigirUuid(customerId, 'cliente');
  await db.query(
    `INSERT INTO clube_retencao_contatos (empresa_id, customer_id, optout_em, optout_texto, ultima_resposta_em) VALUES ($1, $2, $3, $4, $3)
     ON CONFLICT (empresa_id, customer_id) DO UPDATE SET optout_em = COALESCE(clube_retencao_contatos.optout_em, EXCLUDED.optout_em),
       optout_texto = COALESCE(clube_retencao_contatos.optout_texto, EXCLUDED.optout_texto), ultima_resposta_em = EXCLUDED.ultima_resposta_em,
       marketing_consentido_em = NULL`,
    [empresa, cliente, agora, String(texto).slice(0, 200)],
  );
  return { optout: true };
}

/**
 * Autorização (ou retirada) para mensagens de marketing no WhatsApp, com evidência: origem
 * ('contrato', 'recepcao', 'conversa'), quem registrou e quando. Retirar vale na hora.
 */
export async function registrarConsentimentoMarketing(db, { empresaId, customerId, concedido, origem, operador = null, detalhe = null, agora = new Date() }) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const cliente = exigirUuid(customerId, 'cliente');
  if (!['contrato', 'recepcao', 'conversa'].includes(origem)) throw new ErroDominio('VALIDATION_ERROR', 'origem do consentimento inválida');
  const evidencia = { origem, concedido: Boolean(concedido), operador: operador ? String(operador).slice(0, 120) : null, detalhe: detalhe ? String(detalhe).slice(0, 300) : null, em: agora.toISOString() };
  await db.query(
    `INSERT INTO clube_retencao_contatos (empresa_id, customer_id, marketing_consentido_em, marketing_evidencia, optout_em)
     VALUES ($1, $2, CASE WHEN $3 THEN $4::timestamptz END, $5::jsonb, CASE WHEN $3 THEN NULL ELSE $4::timestamptz END)
     ON CONFLICT (empresa_id, customer_id) DO UPDATE SET
       marketing_consentido_em = CASE WHEN $3 THEN $4::timestamptz ELSE NULL END,
       marketing_evidencia = $5::jsonb,
       optout_em = CASE WHEN $3 THEN NULL ELSE COALESCE(clube_retencao_contatos.optout_em, $4::timestamptz) END`,
    [empresa, cliente, Boolean(concedido), agora, JSON.stringify(evidencia)],
  );
  return { marketing: Boolean(concedido), evidencia };
}

/** O aluno pode voltar a receber (pedido dele ao atendimento). */
export async function removerOptout(db, empresaId, customerId) {
  await db.query('UPDATE clube_retencao_contatos SET optout_em = NULL, optout_texto = NULL WHERE empresa_id = $1 AND customer_id = $2',
    [exigirUuid(empresaId, 'empresa'), exigirUuid(customerId, 'cliente')]);
  return { optout: false };
}

/* ------------------------------------------------------------------ */
/* Score de risco                                                      */
/* ------------------------------------------------------------------ */

/** Calcula o risco do dia para as matrículas ativas (1x por dia por academia; `forcar` recalcula). */
export async function calcularScores(db, empresaId, { agora = new Date(), forcar = false, extras = {} } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const cfg = await obterConfig(db, empresa);
  const hoje = hojeNoFuso(agora, cfg.fuso);
  if (!forcar) {
    const ja = await db.query('SELECT 1 FROM clube_retencao_score WHERE empresa_id = $1 AND dia = $2 LIMIT 1', [empresa, hoje]);
    if (ja.rows[0]) return { calculados: 0, jaCalculado: true };
  }
  const fotos = (await fotosDaEmpresa(db, empresa, { agora, fuso: cfg.fuso, extras, ativadaEm: cfg.ativadaEm })).filter((f) => f.matricula?.status === 'ativa');
  for (const f of fotos) {
    const { risco, fatores } = calcularRisco(f);
    await db.query(
      `INSERT INTO clube_retencao_score (empresa_id, customer_id, dia, risco, fatores) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (empresa_id, customer_id, dia) DO UPDATE SET risco = EXCLUDED.risco, fatores = EXCLUDED.fatores`,
      [empresa, f.customerId, hoje, risco, JSON.stringify(fatores)],
    );
  }
  return { calculados: fotos.length };
}

/** Rotina: roda a régua, os scores e a atribuição em todas as academias com régua configurada. */
export async function executarRotinaRetencao(db, { agora = new Date(), enviarWhatsapp, gerarLinkPagamento, extras = {} } = {}) {
  const resumo = { academias: 0, enviados: 0, falhas: 0, scores: 0, resultados: null, erros: [] };
  const empresas = await db.query('SELECT empresa_id FROM clube_retencao_config WHERE ativo');
  for (const { empresa_id: empresa } of empresas.rows) {
    try {
      const r = await executarRegua(db, empresa, { agora, enviarWhatsapp, gerarLinkPagamento, extras });
      resumo.academias += 1; resumo.enviados += r.enviados; resumo.falhas += r.falhas;
      resumo.scores += (await calcularScores(db, empresa, { agora, extras })).calculados;
    } catch (error) {
      resumo.erros.push(`${empresa}: ${String(error?.message || error).slice(0, 160)}`);
    }
  }
  resumo.resultados = await atribuirResultados(db, { agora });
  return resumo;
}
