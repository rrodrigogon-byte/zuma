// Fiscal em massa (F2): classificação em lote, planilha (exportar/importar CSV com prévia),
// sugestão de NCM/CEST pelo nome, emissão em lote e rotina de emissão automática das vendas pagas.
//
// Tudo passa pelas mesmas validações do servico.js (salvarClassificacao, emitir): aqui só se
// agrupa, não há regra fiscal nova.
import { ErroDominio, exigirUuid, transacao } from '../acesso/banco.js';
import * as svc from './servico.js';

const soDigitos = (v) => String(v ?? '').replace(/\D/g, '');

// ── sugestão de NCM/CEST pelo nome ───────────────────────────────────────────
// Ponto de partida para o contador conferir (nunca aplicada sozinha). CEST conferido no anexo XX
// (perfumaria, higiene pessoal e cosméticos) do Convênio ICMS 142/2018 em 01/11/2026; nas bebidas o
// CEST fica para o contador (depende do item e da UF).
const SUGESTOES = [
  [/\b(perfume|parfum|eau de parfum|edp|extrato)\b/i, { ncm: '33030010', cest: '2000700', descricao: 'Perfume (extrato)' }],
  [/\b(col[oô]nia|eau de toilette|edt|eau de cologne|body splash|deo col[oô]nia)\b/i, { ncm: '33030020', cest: '2000800', descricao: 'Água-de-colônia' }],
  [/\b(desodorante|antitranspirante|roll[- ]?on)\b/i, { ncm: '33072010', cest: '2002700', descricao: 'Desodorante' }],
  [/\b(shampoo|xampu)\b/i, { ncm: '33051000', cest: '2001700', descricao: 'Xampu' }],
  [/\b(condicionador|pomada|gel|cera|finalizador|t[oô]nico capilar|leave[- ]?in|spray fixador|balm|bal[sç]amo|[oó]leo (para|de) barba|tinta|colora[cç][aã]o)\b/i, { ncm: '33059000', cest: '2002000', descricao: 'Preparação capilar' }],
  [/\b(espuma|creme|gel) de barbear|\bpr[eé][- ]?barba|\bp[oó]s[- ]?barba|aftershave/i, { ncm: '33071000', cest: '2002600', descricao: 'Preparação para barbear' }],
  [/\b(sabonete)\b/i, { ncm: '34011190', cest: '2003400', descricao: 'Sabonete' }],
  [/\b(hidratante|protetor solar|creme facial|s[eé]rum|m[aá]scara facial|esfoliante)\b/i, { ncm: '33049990', descricao: 'Preparação para pele' }],
  [/\b(l[aâ]mina|gilete|aparelho de barbear)\b/i, { ncm: '82121020', descricao: 'Lâmina de barbear' }],
  [/\b(pente|escova de cabelo)\b/i, { ncm: '96151100', descricao: 'Pente' }],
  [/\b(m[aá]quina de cortar|cortador de cabelo|trimmer|aparador)\b/i, { ncm: '85102000', descricao: 'Máquina de cortar cabelo' }],
  [/\b(cerveja|chopp?)\b/i, { ncm: '22030000', descricao: 'Cerveja' }],
  [/\b(refrigerante|soda|guaran[aá])\b/i, { ncm: '22021000', descricao: 'Refrigerante' }],
  [/\b(energ[eé]tico)\b/i, { ncm: '22029900', descricao: 'Energético' }],
  [/\b(água mineral|agua mineral|água com g[aá]s|agua com gas)\b/i, { ncm: '22011000', descricao: 'Água mineral' }],
  [/\b(whisky|u[ií]sque|vodka|gin|rum|cacha[cç]a|tequila|licor)\b/i, { ncm: '22089000', descricao: 'Bebida destilada' }],
  [/\b(vinho|espumante)\b/i, { ncm: '22042100', descricao: 'Vinho' }],
  [/\b(suplemento|whey|creatina|prote[ií]na)\b/i, { ncm: '21069030', descricao: 'Suplemento alimentar' }],
];

/** Sugestão de NCM (e CEST, quando a ST é usual) pelo nome do produto. */
export function sugerirClassificacao(nome) {
  const texto = String(nome || '');
  for (const [re, s] of SUGESTOES) if (re.test(texto)) return { ...s };
  return null;
}

// ── perfis prontos por regime (atalhos de preenchimento na tela) ─────────────
export const PERFIS = [
  { id: 'sn_revenda', nome: 'Simples · revenda tributada (sem ST)', regime: 'simples', valores: { cfop: '5102', csosn: '102', cstPis: '49', cstCofins: '49' } },
  { id: 'sn_revenda_st', nome: 'Simples · revenda com ICMS por ST (ex.: perfumaria em MT)', regime: 'simples', valores: { cfop: '5405', csosn: '500', cstPis: '49', cstCofins: '49' } },
  { id: 'sn_isento', nome: 'Simples · não tributada / isenta', regime: 'simples', valores: { cfop: '5102', csosn: '400', cstPis: '49', cstCofins: '49' } },
  { id: 'lp_tributada', nome: 'Lucro presumido · tributada (ICMS 17%, PIS 0,65%, COFINS 3%)', regime: 'normal', valores: { cfop: '5102', cstIcms: '00', aliquotaIcms: 17, cstPis: '01', aliquotaPis: 0.65, cstCofins: '01', aliquotaCofins: 3 } },
  { id: 'lp_st', nome: 'Lucro presumido · ICMS cobrado por ST', regime: 'normal', valores: { cfop: '5405', cstIcms: '60', cstPis: '01', aliquotaPis: 0.65, cstCofins: '01', aliquotaCofins: 3 } },
  { id: 'lr_tributada', nome: 'Lucro real · tributada (ICMS 17%, PIS 1,65%, COFINS 7,6%)', regime: 'normal', valores: { cfop: '5102', cstIcms: '00', aliquotaIcms: 17, cstPis: '01', aliquotaPis: 1.65, cstCofins: '01', aliquotaCofins: 7.6 } },
  { id: 'lr_st', nome: 'Lucro real · ICMS cobrado por ST', regime: 'normal', valores: { cfop: '5405', cstIcms: '60', cstPis: '01', aliquotaPis: 1.65, cstCofins: '01', aliquotaCofins: 7.6 } },
  { id: 'monofasico', nome: 'PIS/COFINS monofásico (revenda, alíquota zero)', regime: 'normal', valores: { cstPis: '04', cstCofins: '04', aliquotaPis: 0, aliquotaCofins: 0 } },
];

// ── classificação em lote ────────────────────────────────────────────────────
/** Aplica a mesma classificação a vários itens, tudo ou nada. */
export async function classificarEmLote(db, empresaId, { itens = [], classificacao = {} } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  if (!Array.isArray(itens) || !itens.length) throw new ErroDominio('VALIDATION_ERROR', 'Escolha os itens a classificar');
  if (itens.length > 2000) throw new ErroDominio('VALIDATION_ERROR', 'No máximo 2000 itens por vez');
  return transacao(db, async (q) => {
    const tx = { query: (t, v) => q(t, v) };
    const salvos = [];
    for (const [idx, item] of itens.entries()) {
      try {
        salvos.push(await svc.salvarClassificacao(tx, empresa, { ...classificacao, fonte: item.fonte, fonteId: item.fonteId }));
      } catch (error) {
        if (error instanceof ErroDominio) throw new ErroDominio(error.code, `Item ${idx + 1}: ${error.message}`, error.status || 422);
        throw error;
      }
    }
    return { ok: true, aplicadas: salvos.length };
  });
}

// ── planilha (CSV) ───────────────────────────────────────────────────────────
// Colunas da planilha (ordem do arquivo exportado; na importação vale o cabeçalho).
const COLUNAS = [
  ['fonte', 'fonte'], ['fonte_id', 'fonteId'], ['grupo', null], ['nome', null], ['tipo', 'tipo'],
  ['ncm', 'ncm'], ['cest', 'cest'], ['cfop', 'cfop'], ['origem', 'origem'], ['csosn', 'csosn'], ['cst_icms', 'cstIcms'],
  ['aliquota_icms', 'aliquotaIcms'], ['reducao_base_icms', 'reducaoBaseIcms'], ['cst_pis', 'cstPis'], ['aliquota_pis', 'aliquotaPis'],
  ['cst_cofins', 'cstCofins'], ['aliquota_cofins', 'aliquotaCofins'], ['unidade', 'unidadeTributavel'], ['ctribnac', 'cTribNac'],
  ['aliquota_iss', 'aliquotaIss'], ['ncm_sugerido', null], ['cest_sugerido', null],
];
const PONTO_E_VIRGULA = ';';
const escaparCsv = (v) => {
  const t = v === null || v === undefined ? '' : String(v);
  return /[;"\n\r,]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
const numeroCsv = (v) => (v === null || v === undefined || v === '' ? '' : String(v).replace('.', ','));

/** Planilha com tudo o que a empresa vende e a classificação atual (para editar no Excel e reimportar). */
export async function exportarClassificacoesCsv(db, empresaId) {
  const lista = await svc.listarClassificaveis(db, empresaId);
  const linhas = [COLUNAS.map(([c]) => c).join(PONTO_E_VIRGULA)];
  for (const i of lista) {
    const c = i.herdada ? {} : (i.classificacao || {});
    const sug = !i.classificacao ? sugerirClassificacao(i.nome) : null;
    const tipo = c.tipo || i.tipo || (i.fonte === 'servico' ? 'servico' : 'produto');
    const valores = {
      fonte: i.fonte, fonte_id: i.fonteId, grupo: i.grupo, nome: i.nome, tipo,
      ncm: c.ncm || '', cest: c.cest || '', cfop: c.cfop || '', origem: c.origem ?? '', csosn: c.csosn || '', cst_icms: c.cstIcms || '',
      aliquota_icms: numeroCsv(c.aliquotaIcms || ''), reducao_base_icms: numeroCsv(c.reducaoBaseIcms), cst_pis: c.cstPis || '', aliquota_pis: numeroCsv(c.aliquotaPis || ''),
      cst_cofins: c.cstCofins || '', aliquota_cofins: numeroCsv(c.aliquotaCofins || ''), unidade: c.unidadeTributavel || '', ctribnac: c.cTribNac || '',
      aliquota_iss: numeroCsv(c.aliquotaIss), ncm_sugerido: i.ncmSugerido || sug?.ncm || '', cest_sugerido: sug?.cest || '',
    };
    linhas.push(COLUNAS.map(([col]) => escaparCsv(valores[col])).join(PONTO_E_VIRGULA));
  }
  // BOM: o Excel abre os acentos certos
  return `﻿${linhas.join('\r\n')}\r\n`;
}

/** Lê CSV (separador ; ou ,; aspas duplas) em linhas de células. */
export function lerCsv(texto) {
  const s = String(texto || '').replace(/^﻿/, '');
  const primeira = s.split(/\r?\n/, 1)[0] || '';
  const sep = (primeira.match(/;/g) || []).length >= (primeira.match(/,/g) || []).length ? ';' : ',';
  const linhas = []; let linha = []; let celula = ''; let aspas = false;
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (aspas) {
      if (ch === '"' && s[i + 1] === '"') { celula += '"'; i += 1; } else if (ch === '"') aspas = false; else celula += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === sep) { linha.push(celula); celula = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i += 1;
      linha.push(celula); celula = '';
      if (linha.some((c) => c.trim() !== '')) linhas.push(linha);
      linha = [];
    } else celula += ch;
  }
  linha.push(celula);
  if (linha.some((c) => c.trim() !== '')) linhas.push(linha);
  return linhas;
}

// "1.234,56" ou "17,5" (Excel pt-BR) → "1234.56" / "17.5"; "17.5" fica como está
function decimalCsv(v) {
  const t = String(v ?? '').trim();
  if (!t) return '';
  return t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
}

/**
 * Importa a planilha. Sem `aplicar` é só a prévia: valida cada linha (com as mesmas regras do
 * cadastro) e desfaz tudo. Com `aplicar`, grava as linhas válidas e devolve os erros das outras.
 * Linhas sem NCM (produto) ou sem cTribNac (serviço) são ignoradas: o item fica como está.
 */
export async function importarClassificacoesCsv(db, empresaId, { arquivo, aplicar = false } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const texto = Buffer.isBuffer(arquivo) ? arquivo.toString('utf8') : String(arquivo || '');
  if (!texto.trim()) throw new ErroDominio('VALIDATION_ERROR', 'Envie a planilha (CSV)');
  if (texto.length > 5_000_000) throw new ErroDominio('VALIDATION_ERROR', 'Planilha grande demais (máximo 5 MB)');
  const [cab, ...dados] = lerCsv(texto);
  const indice = Object.fromEntries((cab || []).map((c, i) => [String(c).trim().toLowerCase(), i]));
  for (const obrigatoria of ['fonte', 'fonte_id']) if (!(obrigatoria in indice)) throw new ErroDominio('VALIDATION_ERROR', `A planilha precisa da coluna "${obrigatoria}" (use a planilha exportada como modelo)`);
  if (dados.length > 5000) throw new ErroDominio('VALIDATION_ERROR', 'No máximo 5000 linhas por planilha');
  const resultado = { linhas: dados.length, validas: 0, ignoradas: 0, aplicadas: 0, erros: [], prevista: !aplicar };
  const DESFAZER = Symbol('desfazer');
  try {
    await transacao(db, async (q) => {
      const tx = { query: (t, v) => q(t, v) };
      for (const [n, celulas] of dados.entries()) {
        const valor = (col) => (col in indice ? String(celulas[indice[col]] ?? '').trim() : '');
        const fonte = valor('fonte'); const fonteId = valor('fonte_id');
        const tipo = valor('tipo') || (fonte === 'servico' ? 'servico' : 'produto');
        const temClassificacao = tipo === 'servico' ? soDigitos(valor('ctribnac')) : soDigitos(valor('ncm'));
        if (!temClassificacao) { resultado.ignoradas += 1; continue; }
        const entrada = { fonte, fonteId, tipo };
        for (const [col, campo] of COLUNAS) {
          if (!campo || ['fonte', 'fonteId', 'tipo'].includes(campo) || !(col in indice)) continue;
          const v = valor(col);
          entrada[campo] = /aliquota|reducao/.test(col) ? decimalCsv(v) : v;
        }
        // savepoint por linha: um erro de banco não derruba as outras linhas
        await q('SAVEPOINT linha_csv');
        try {
          await svc.salvarClassificacao(tx, empresa, entrada);
          await q('RELEASE SAVEPOINT linha_csv');
          resultado.validas += 1;
        } catch (error) {
          await q('ROLLBACK TO SAVEPOINT linha_csv');
          resultado.erros.push({ linha: n + 2, item: valor('nome') || fonteId, mensagem: String(error?.message || error).slice(0, 200) });
        }
      }
      if (!aplicar) throw DESFAZER; // prévia: nada fica gravado
      resultado.aplicadas = resultado.validas;
    });
  } catch (error) {
    if (error !== DESFAZER) throw error;
  }
  return resultado;
}

// ── emissão em lote ──────────────────────────────────────────────────────────
/** Emite uma a uma (cada emissão tem a sua trava e idempotência); devolve o resultado de cada venda. */
export async function emitirEmLote(db, empresaId, { vendas = [], modelo = '65', contingenciaOffline = false } = {}, opcoes = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  if (!Array.isArray(vendas) || !vendas.length) throw new ErroDominio('VALIDATION_ERROR', 'Escolha as vendas');
  if (vendas.length > 50) throw new ErroDominio('VALIDATION_ERROR', 'No máximo 50 vendas por lote');
  const resultados = [];
  for (const v of vendas) {
    try {
      const d = await svc.emitir(db, empresa, { modelo, origem: v.origem, origemId: v.origemId, ...(contingenciaOffline ? { contingenciaOffline: true } : {}) }, opcoes);
      resultados.push({ origem: v.origem, origemId: v.origemId, ok: d.status !== 'rejeitado', documentoId: d.id, numero: d.numero, status: d.status, mensagens: d.mensagens });
    } catch (error) {
      resultados.push({ origem: v.origem, origemId: v.origemId, ok: false, erro: String(error?.message || error).slice(0, 300), codigo: error?.code || null });
    }
  }
  return { total: resultados.length, emitidas: resultados.filter((r) => r.ok).length, falhas: resultados.filter((r) => !r.ok).length, resultados };
}

// ── emissão automática ───────────────────────────────────────────────────────
const ORIGENS_AUTOMATICAS = ['loja_pedido', 'bar_comanda', 'barbearia_comanda'];

function configDto(row) {
  return {
    emissaoAutomatica: Boolean(row?.emissao_automatica), desde: row?.automatica_desde || null,
    origens: row?.origens?.length ? row.origens : ['loja_pedido'], ultimaRodada: row?.ultima_rodada || null, ultimoResumo: row?.ultimo_resumo || null,
  };
}

export async function obterConfigAutomatica(db, empresaId) {
  const empresa = exigirUuid(empresaId, 'empresa');
  return configDto((await db.query('SELECT * FROM fis_config WHERE empresa_id = $1', [empresa])).rows[0]);
}

/** Liga/desliga a emissão automática. Ao ligar, só valem as vendas pagas a partir de agora. */
export async function salvarConfigAutomatica(db, empresaId, { emissaoAutomatica, origens } = {}, { agora = new Date() } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const lista = Array.isArray(origens) && origens.length ? [...new Set(origens.map(String))] : ['loja_pedido'];
  if (lista.some((o) => !ORIGENS_AUTOMATICAS.includes(o))) throw new ErroDominio('VALIDATION_ERROR', `Origens válidas: ${ORIGENS_AUTOMATICAS.join(', ')}`);
  const ligar = emissaoAutomatica === true;
  const r = await db.query(
    `INSERT INTO fis_config (empresa_id, emissao_automatica, automatica_desde, origens) VALUES ($1, $2, CASE WHEN $2 THEN $3::timestamptz ELSE NULL END, $4)
     ON CONFLICT (empresa_id) DO UPDATE SET emissao_automatica = EXCLUDED.emissao_automatica,
       automatica_desde = CASE WHEN EXCLUDED.emissao_automatica AND NOT fis_config.emissao_automatica THEN EXCLUDED.automatica_desde
                               WHEN EXCLUDED.emissao_automatica THEN fis_config.automatica_desde ELSE NULL END,
       origens = EXCLUDED.origens, atualizado_em = CURRENT_TIMESTAMP
     RETURNING *`, [empresa, ligar, agora, lista]);
  return configDto(r.rows[0]);
}

/**
 * Rodada da rotina (a cada poucos minutos, no servidor): para cada empresa com a emissão
 * automática ligada, emite NFC-e das vendas pagas desde que ela foi ligada e transmite as
 * contingências pendentes. Uma empresa com problema não para as outras.
 */
export async function rodarEmissaoAutomatica(db, { env = process.env, agora = new Date(), limitePorEmpresa = 20, transporte = null, esperar = null, empresaId = null } = {}) {
  const tabela = (await db.query("SELECT to_regclass('fis_config') AS t")).rows[0]?.t;
  if (!tabela) return { empresas: 0, emitidas: 0, falhas: 0 };
  const empresas = empresaId
    ? (await db.query('SELECT * FROM fis_config WHERE empresa_id = $1 AND emissao_automatica = true', [exigirUuid(empresaId, 'empresa')])).rows
    : (await db.query('SELECT * FROM fis_config WHERE emissao_automatica = true ORDER BY empresa_id')).rows;
  const total = { empresas: empresas.length, emitidas: 0, falhas: 0, resumos: [] };
  for (const cfg of empresas) {
    // a rotina do servidor e o botão "Emitir pendentes agora" não começam duas rodadas juntas
    // (a emissão é idempotente por venda; isto só evita trabalho dobrado)
    const trava = (await db.query("UPDATE fis_config SET ultima_rodada = $2 WHERE empresa_id = $1 AND (ultima_rodada IS NULL OR ultima_rodada < $2::timestamptz - interval '20 seconds') RETURNING 1", [cfg.empresa_id, agora])).rows[0];
    if (!trava) { total.resumos.push({ empresaId: cfg.empresa_id, emitidas: 0, falhas: 0, erros: ['Já há uma rodada em andamento para esta empresa'] }); continue; }
    const resumo = { emitidas: 0, falhas: 0, erros: [] };
    try {
      const pronta = await svc.prontidao(db, cfg.empresa_id, { env });
      if (!pronta.pronto) {
        resumo.erros.push(`Fiscal não está pronto: ${pronta.pendencias.join(' · ')}`);
      } else {
        const desde = new Date(cfg.automatica_desde || agora);
        const origens = cfg.origens?.length ? cfg.origens : ['loja_pedido'];
        const vendas = (await svc.vendasSemNota(db, cfg.empresa_id, { limite: 200 }))
          .filter((v) => origens.includes(v.origem) && v.data && new Date(v.data) >= desde)
          .slice(0, limitePorEmpresa);
        if (vendas.length) {
          const lote = await emitirEmLote(db, cfg.empresa_id, { vendas, modelo: '65', contingenciaOffline: true }, { usuario: 'emissão automática', env, agora, ...(transporte ? { transporte } : {}), ...(esperar ? { esperar } : {}) });
          resumo.emitidas = lote.emitidas; resumo.falhas = lote.falhas;
          resumo.erros.push(...lote.resultados.filter((r) => !r.ok).map((r) => `${r.origemId}: ${r.erro || r.status}`).slice(0, 10));
        }
        const cont = await svc.transmitirContingencias(db, cfg.empresa_id, { usuario: 'emissão automática', env, agora, ...(transporte ? { transporte } : {}) });
        if (cont.autorizadas || cont.rejeitadas || cont.falhas) resumo.contingencias = { autorizadas: cont.autorizadas, rejeitadas: cont.rejeitadas, falhas: cont.falhas };
      }
    } catch (error) {
      resumo.erros.push(String(error?.message || error).slice(0, 300));
    }
    total.emitidas += resumo.emitidas; total.falhas += resumo.falhas;
    total.resumos.push({ empresaId: cfg.empresa_id, ...resumo });
    await db.query('UPDATE fis_config SET ultima_rodada = $2, ultimo_resumo = $3 WHERE empresa_id = $1', [cfg.empresa_id, agora, JSON.stringify(resumo)]);
  }
  return total;
}

/** "Emitir pendentes agora": a rodada da emissão automática só desta empresa, na hora. */
export async function emitirPendentesAgora(db, empresaId, opcoes = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const cfg = (await db.query('SELECT emissao_automatica FROM fis_config WHERE empresa_id = $1', [empresa])).rows[0];
  if (!cfg?.emissao_automatica) throw new ErroDominio('AUTOMATICA_DESLIGADA', 'Ligue a emissão automática para emitir as pendentes por aqui (ou use "Emitir marcadas"/"Emitir todas" na lista de vendas)', 409);
  const r = await rodarEmissaoAutomatica(db, { ...opcoes, empresaId: empresa });
  return { ...(r.resumos[0] || { emitidas: 0, falhas: 0, erros: [] }), config: await obterConfigAutomatica(db, empresa) };
}
let rodando = false;
/** Liga a rotina no servidor (uma rodada por vez). FISCAL_ROTINA_AUTOMATICA=0 desliga. */
export function iniciarRotinaFiscal(db, { env = process.env, intervaloMs = 120_000, log = console } = {}) {
  if (env.FISCAL_ROTINA_AUTOMATICA === '0') return null;
  const timer = setInterval(async () => {
    if (rodando) return;
    rodando = true;
    try {
      const r = await rodarEmissaoAutomatica(db, { env });
      if (r.emitidas || r.falhas) log.info?.(`[fiscal] emissão automática: ${r.emitidas} emitida(s), ${r.falhas} falha(s)`);
    } catch (error) {
      log.warn?.('[fiscal] emissão automática falhou:', String(error?.message || error).slice(0, 200));
    } finally { rodando = false; }
  }, intervaloMs);
  timer.unref?.();
  return timer;
}
