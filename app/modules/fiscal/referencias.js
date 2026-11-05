// Tabelas oficiais para a classificação fiscal: NCM (Siscomex), CEST (Convênio ICMS 142/2018),
// CFOP, Lista de Serviços Nacional da NFS-e (cTribNac) e indicador da operação (cIndOp).
// As tabelas ficam em app/fiscal-referencias/*.json, cada uma com a fonte e a data da captura.
// Aqui também mora a conferência da classificação (erros bloqueiam; avisos só orientam).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../fiscal-referencias');
const cache = new Map();
function tabela(nome) {
  if (!cache.has(nome)) cache.set(nome, JSON.parse(fs.readFileSync(path.join(DIR, `${nome}.json`), 'utf8')));
  return cache.get(nome);
}

const soDigitos = (v) => String(v ?? '').replace(/\D/g, '');
/** Texto sem acento e em minúsculas, para a busca. */
export const normalizar = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const fmtNcm = (c) => `${c.slice(0, 4)}.${c.slice(4, 6)}.${c.slice(6, 8)}`;
const fmtCest = (c) => `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 7)}`;

// Códigos aceitos pelo emissor (os mesmos do motor fiscal)
export const CSOSN = { 102: 'Tributada sem permissão de crédito', 103: 'Isenção do ICMS para faixa de receita bruta', 300: 'Imune', 400: 'Não tributada', 500: 'ICMS cobrado anteriormente por ST ou antecipação' };
export const CST_ICMS = { '00': 'Tributada integralmente', 20: 'Com redução de base de cálculo', 40: 'Isenta', 41: 'Não tributada', 50: 'Suspensão', 60: 'ICMS cobrado anteriormente por ST' };
export const CST_PIS_COFINS = {
  '01': 'Tributável (alíquota básica)', '02': 'Tributável (alíquota diferenciada)', '03': 'Tributável (alíquota por unidade)',
  '04': 'Monofásica (revenda a alíquota zero)', '05': 'Substituição tributária', '06': 'Alíquota zero', '07': 'Isenta', '08': 'Sem incidência', '09': 'Suspensão',
  49: 'Outras operações de saída', 99: 'Outras operações',
};
export const UNIDADES = { UN: 'Unidade', KG: 'Quilograma', G: 'Grama', L: 'Litro', ML: 'Mililitro', M: 'Metro', M2: 'Metro quadrado', M3: 'Metro cúbico', CX: 'Caixa', PC: 'Peça', PCT: 'Pacote', FD: 'Fardo', DZ: 'Dúzia', PAR: 'Par', KIT: 'Kit', JG: 'Jogo', RL: 'Rolo', SC: 'Saco', TB: 'Tubo', FR: 'Frasco', GF: 'Garrafa', LT: 'Lata', BD: 'Balde' };
const CFOP_ST = new Set(['5401', '5402', '5403', '5405', '5408', '5409', '5410', '5411', '5412', '5413', '5414', '5415', '6401', '6402', '6403', '6404', '6408', '6409', '6410', '6411', '6412', '6413', '6414', '6415', '5656', '5667', '6656', '6667']);

/** Fontes e datas de cada tabela, para mostrar na tela. */
export function fontes() {
  const f = (n, extra = {}) => { const t = tabela(n); return { fonte: t.fonte, obtidoEm: t.obtidoEm || t.capturadoEm, ...extra }; };
  return { ncm: f('ncm', { vigencia: tabela('ncm').vigencia, ato: tabela('ncm').ato }), cest: f('cest'), cfop: f('cfop'), servicos: f('servicos-nacional'), cindop: f('cindop') };
}

// ── NCM ───────────────────────────────────────────────────────────────────────
function caminhoNcm(c) {
  const nos = tabela('ncm').nos;
  const partes = [];
  for (const n of [4, 5, 6, 7, 8]) {
    const d = nos[c.slice(0, n)];
    if (d && partes[partes.length - 1] !== d) partes.push(d);
  }
  return partes.join(' › ');
}
/** NCM vigente de 8 dígitos (com o caminho na nomenclatura) ou null. */
export function obterNcm(codigo) {
  const c = soDigitos(codigo);
  if (c.length !== 8 || !tabela('ncm').nos[c]) return null;
  return { codigo: c, formatado: fmtNcm(c), descricao: tabela('ncm').nos[c], caminho: caminhoNcm(c), capitulo: tabela('ncm').nos[c.slice(0, 2)] || '' };
}
let indiceNcm = null;
function indice() {
  if (!indiceNcm) indiceNcm = Object.keys(tabela('ncm').nos).filter((c) => c.length === 8).map((c) => ({ c, t: normalizar(`${c} ${fmtNcm(c)} ${caminhoNcm(c)}`) }));
  return indiceNcm;
}
/** Busca NCM pelo código (ou começo dele) ou por palavras da descrição (todas precisam aparecer). */
export function buscarNcm(termo, { limite = 30 } = {}) {
  const q = String(termo || '').trim();
  if (!q) return [];
  const dig = soDigitos(q);
  const lim = Math.min(Math.max(Number(limite) || 30, 1), 100);
  if (dig && dig.length >= 2 && /^[\d.\s]+$/.test(q)) {
    return indice().filter((x) => x.c.startsWith(dig)).slice(0, lim).map((x) => obterNcm(x.c));
  }
  const palavras = normalizar(q).split(/\s+/).filter((p) => p.length >= 2);
  if (!palavras.length) return [];
  return indice().filter((x) => palavras.every((p) => x.t.includes(p))).slice(0, lim).map((x) => obterNcm(x.c));
}

// ── CEST ──────────────────────────────────────────────────────────────────────
export function obterCest(codigo) {
  const c = soDigitos(codigo);
  const x = c.length === 7 ? tabela('cest').itens[c] : null;
  return x ? { codigo: c, formatado: fmtCest(c), ...x } : null;
}
const cestCasaNcm = (cest, ncm) => (cest.ncms || []).some((p) => ncm.startsWith(soDigitos(p)));
/** CEST vigentes cujo NCM/SH abrange o NCM informado (o mais específico primeiro). */
export function cestsDoNcm(ncm) {
  const n = soDigitos(ncm);
  if (n.length !== 8) return [];
  return Object.entries(tabela('cest').itens)
    .filter(([, x]) => !x.revogado && cestCasaNcm(x, n))
    .map(([c, x]) => ({ codigo: c, formatado: fmtCest(c), descricao: x.descricao, segmento: x.segmento, especificidade: Math.max(...x.ncms.map((p) => (n.startsWith(soDigitos(p)) ? soDigitos(p).length : 0))) }))
    .sort((a, b) => b.especificidade - a.especificidade || a.codigo.localeCompare(b.codigo));
}

// ── CFOP, serviços e cIndOp ───────────────────────────────────────────────────
export function obterCfop(codigo) {
  const c = soDigitos(codigo);
  const d = tabela('cfop').itens[c];
  return d ? { codigo: c, descricao: d } : null;
}
/** CFOPs de saída (5, 6 e 7), opcionalmente filtrados por texto. */
export function listarCfops(termo = '') {
  const q = normalizar(termo);
  return Object.entries(tabela('cfop').itens).filter(([c, d]) => /^[567]/.test(c) && (!q || normalizar(`${c} ${d}`).includes(q))).map(([codigo, descricao]) => ({ codigo, descricao }));
}
export function obterServico(codigo) {
  const c = soDigitos(codigo).padStart(6, '0');
  const x = soDigitos(codigo).length >= 5 ? tabela('servicos-nacional').itens[c] : null;
  return x ? { codigo: c, ...x } : null;
}
export function buscarServicos(termo = '', { limite = 40 } = {}) {
  const q = normalizar(termo).trim();
  const dig = soDigitos(termo);
  const palavras = q.split(/\s+/).filter((p) => p.length >= 2);
  return Object.entries(tabela('servicos-nacional').itens)
    .filter(([c, x]) => !q || (dig && /^[\d.\s]+$/.test(termo) ? c.startsWith(dig.padStart(Math.min(dig.length, 6), '0')) || c.includes(dig) : palavras.every((p) => normalizar(`${x.descricao} ${x.grupo} ${x.item}`).includes(p))))
    .slice(0, Math.min(Math.max(Number(limite) || 40, 1), 400))
    .map(([codigo, x]) => ({ codigo, ...x }));
}
export function obterCIndOp(codigo) {
  const x = tabela('cindop').itens[soDigitos(codigo)];
  return x ? { codigo: soDigitos(codigo), ...x } : null;
}
export function listarCIndOps() {
  return Object.entries(tabela('cindop').itens).map(([codigo, x]) => ({ codigo, ...x }));
}

// ── conferência ──────────────────────────────────────────────────────────────
const num = (v) => (v === undefined || v === null || v === '' ? null : Number(String(v).replace(',', '.')));
/**
 * Confere uma classificação. `crt` (1/4 = Simples/MEI, 2 = Simples com excesso, 3 = normal) vem do emitente.
 * Erros: código inexistente, campo obrigatório ausente ou combinação impossível. Avisos: o que o contador deve olhar.
 */
export function conferirClassificacao(dados = {}, { crt = null } = {}) {
  const erros = []; const avisos = [];
  const tipo = dados.tipo === 'servico' || dados.fonte === 'servico' ? 'servico' : 'produto';
  const detalhes = {};
  if (tipo === 'servico') {
    const ct = soDigitos(dados.cTribNac);
    if (!ct) erros.push({ campo: 'cTribNac', mensagem: 'Informe o código de tributação nacional (cTribNac) do serviço.' });
    else if (ct.length !== 6) erros.push({ campo: 'cTribNac', mensagem: 'cTribNac tem 6 dígitos (item, subitem e desdobro da Lista de Serviços Nacional).' });
    else {
      const s = obterServico(ct);
      if (!s) erros.push({ campo: 'cTribNac', mensagem: `cTribNac ${ct} não existe na Lista de Serviços Nacional da NFS-e.` });
      else detalhes.servico = s;
    }
    const iss = num(dados.aliquotaIss);
    if (iss !== null && (Number.isNaN(iss) || iss < 0 || iss > 5)) erros.push({ campo: 'aliquotaIss', mensagem: 'Alíquota do ISS entre 0% e 5% (LC 116/2003).' });
    else if (iss !== null && iss > 0 && iss < 2) avisos.push({ campo: 'aliquotaIss', mensagem: 'ISS abaixo de 2% só vale nas exceções da LC 116 (art. 8º-A); confirme com a prefeitura.' });
    else if (iss === null || iss === 0) avisos.push({ campo: 'aliquotaIss', mensagem: 'Sem alíquota de ISS: vale a do município. Confirme com a prefeitura.' });
    const ind = soDigitos(dados.cIndOp);
    if (ind) { const x = obterCIndOp(ind); if (!x) erros.push({ campo: 'cIndOp', mensagem: `Indicador da operação ${ind} não existe no Anexo C da NFS-e.` }); else detalhes.cIndOp = x; }
    return { tipo, erros, avisos, detalhes };
  }
  // produto
  const ncm = soDigitos(dados.ncm); const cfop = soDigitos(dados.cfop); const cest = soDigitos(dados.cest);
  const csosn = soDigitos(dados.csosn); const cst = soDigitos(dados.cstIcms);
  // padrão de categoria pode ficar sem NCM (cada produto informa o seu)
  const ncmOpcional = dados.fonte === 'categoria';
  if (!ncm) { if (!ncmOpcional) erros.push({ campo: 'ncm', mensagem: 'Informe o NCM.' }); }
  else if (ncm.length !== 8) erros.push({ campo: 'ncm', mensagem: 'NCM tem 8 dígitos.' });
  else {
    const n = obterNcm(ncm);
    if (!n) erros.push({ campo: 'ncm', mensagem: `NCM ${fmtNcm(ncm)} não existe na tabela NCM vigente (${tabela('ncm').vigencia}).` });
    else detalhes.ncm = n;
  }
  if (!cfop) erros.push({ campo: 'cfop', mensagem: 'Informe o CFOP.' });
  else {
    const c = obterCfop(cfop);
    if (!c) erros.push({ campo: 'cfop', mensagem: `CFOP ${cfop} não existe.` });
    else if (!/^[567]/.test(cfop)) erros.push({ campo: 'cfop', mensagem: `CFOP ${cfop} é de entrada; na venda use um CFOP de saída (5, 6 ou 7).` });
    else detalhes.cfop = c;
  }
  const simples = crt === '1' || crt === '4' || crt === 1 || crt === 4;
  const normal = crt === '2' || crt === '3' || crt === 2 || crt === 3;
  if (csosn && !CSOSN[csosn]) erros.push({ campo: 'csosn', mensagem: `CSOSN ${csosn} não é aceito pelo emissor (${Object.keys(CSOSN).join(', ')}).` });
  if (cst && !CST_ICMS[cst.padStart(2, '0')]) erros.push({ campo: 'cstIcms', mensagem: `CST ${cst} não é aceito pelo emissor (${Object.keys(CST_ICMS).join(', ')}).` });
  if (simples && !csosn) erros.push({ campo: 'csosn', mensagem: 'Empresa do Simples Nacional: informe o CSOSN.' });
  if (normal && !cst) erros.push({ campo: 'cstIcms', mensagem: 'Empresa do regime normal (ou Simples com excesso de sublimite): informe o CST do ICMS.' });
  if (!crt && !csosn && !cst) erros.push({ campo: 'csosn', mensagem: 'Informe o CSOSN (Simples) ou o CST do ICMS (regime normal).' });
  if (simples && cst && !csosn) avisos.push({ campo: 'cstIcms', mensagem: 'Empresa do Simples usa CSOSN; o CST só vale para o regime normal.' });
  const comSt = csosn === '500' || cst === '60';
  if (cst === '20' && num(dados.reducaoBaseIcms) === null) erros.push({ campo: 'reducaoBaseIcms', mensagem: 'CST 20 exige o percentual de redução da base do ICMS.' });
  // CEST
  const opcoes = ncm.length === 8 ? cestsDoNcm(ncm) : [];
  detalhes.cestsDoNcm = opcoes.slice(0, 20);
  if (cest) {
    const c = obterCest(cest);
    if (cest.length !== 7) erros.push({ campo: 'cest', mensagem: 'CEST tem 7 dígitos.' });
    else if (!c) avisos.push({ campo: 'cest', mensagem: `CEST ${fmtCest(cest)} não está na tabela de referência do Convênio ICMS 142/2018; confira no Convênio.` });
    else if (c.revogado) erros.push({ campo: 'cest', mensagem: `CEST ${fmtCest(cest)} foi revogado.${opcoes.length ? ` Para este NCM: ${opcoes.slice(0, 3).map((o) => o.formatado).join(', ')}.` : ''}` });
    else if (ncm.length === 8 && !cestCasaNcm(c, ncm)) erros.push({ campo: 'cest', mensagem: `CEST ${fmtCest(cest)} (${c.descricao}) não abrange o NCM ${fmtNcm(ncm)}.${opcoes.length ? ` Para este NCM: ${opcoes.slice(0, 3).map((o) => `${o.formatado} ${o.descricao}`).join('; ')}.` : ' Este NCM não está no Convênio 142/2018.'}` });
    else detalhes.cest = c;
  }
  if (comSt && !cest) erros.push({ campo: 'cest', mensagem: `Com substituição tributária (CSOSN 500 / CST 60) o CEST é obrigatório.${opcoes.length ? ` Para este NCM: ${opcoes.slice(0, 3).map((o) => `${o.formatado} ${o.descricao}`).join('; ')}.` : ''}` });
  if (comSt && ncm.length === 8 && !opcoes.length && !cest) avisos.push({ campo: 'ncm', mensagem: 'Este NCM não está no Convênio ICMS 142/2018: confirme se há mesmo ST.' });
  if (!comSt && opcoes.length && !cest) avisos.push({ campo: 'cest', mensagem: `Este NCM está no Convênio ICMS 142/2018 (ex.: ${opcoes[0].formatado} ${opcoes[0].descricao}). Confirme com o contador se há ST em MT; se houver, use CSOSN 500 / CST 60 e o CEST.` });
  // CFOP × ST
  if (cfop && comSt && !CFOP_ST.has(cfop)) avisos.push({ campo: 'cfop', mensagem: `CSOSN 500 / CST 60 costuma sair com CFOP 5405 (ST já retida); ${cfop} é de operação sem ST.` });
  if (cfop && !comSt && (cfop === '5405' || cfop === '6404')) avisos.push({ campo: 'cfop', mensagem: `CFOP ${cfop} é de mercadoria com ST; com ${csosn ? `CSOSN ${csosn}` : `CST ${cst || '—'}`} o comum é 5102.` });
  // origem, PIS/COFINS e unidade
  const origem = String(dados.origem ?? '0');
  if (!/^[0-8]$/.test(origem)) erros.push({ campo: 'origem', mensagem: 'Origem da mercadoria de 0 a 8.' });
  for (const [campo, rot] of [['cstPis', 'PIS'], ['cstCofins', 'COFINS']]) {
    const v = soDigitos(dados[campo]);
    if (v && !CST_PIS_COFINS[v.padStart(2, '0')]) erros.push({ campo, mensagem: `CST do ${rot} ${v} não existe nesta tabela (${Object.keys(CST_PIS_COFINS).join(', ')}).` });
  }
  if (simples && (soDigitos(dados.cstPis) && !['49', '99'].includes(soDigitos(dados.cstPis)))) avisos.push({ campo: 'cstPis', mensagem: 'No Simples o PIS/COFINS vai no DAS: o usual na nota é CST 49 (ou 99).' });
  const un = String(dados.unidadeTributavel || '').trim().toUpperCase();
  if (un && !UNIDADES[un]) avisos.push({ campo: 'unidadeTributavel', mensagem: `Unidade ${un} fora da lista usual (${Object.keys(UNIDADES).slice(0, 8).join(', ')}…).` });
  return { tipo, erros, avisos, detalhes };
}

/** Uma linha curta para a lista: o que cada código significa. */
export function descreverClassificacao(c) {
  if (!c) return null;
  if (c.tipo === 'servico') { const s = obterServico(c.cTribNac); return { servico: s ? `${s.item} ${s.descricao}` : null }; }
  const n = obterNcm(c.ncm); const ce = c.cest ? obterCest(c.cest) : null; const cf = obterCfop(c.cfop);
  return { ncm: n ? n.descricao : null, ncmCaminho: n ? n.caminho : null, cest: ce ? ce.descricao : null, cfop: cf ? cf.descricao : null };
}
