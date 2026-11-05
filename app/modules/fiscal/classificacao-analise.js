// Pesquisa completa da classificação fiscal: cada item da lista vem com a situação (sem classificação,
// com erro, com aviso, ok), o significado de cada código nas tabelas oficiais e um texto de busca
// (nome, SKU, códigos e descrições). Também resolve o nome dos serviços e produtos da barbearia,
// que antes apareciam só com o código interno (ex.: "srv-mv1a0adk-022").
import { db as getJsonDb } from '../../db.js';
import * as ref from './referencias.js';

const soDigitos = (v) => String(v ?? '').replace(/\D/g, '');

/** CRT do emitente principal da empresa (1/4 Simples/MEI, 2 Simples com excesso, 3 normal) ou null. */
export async function crtDaEmpresa(db, empresaId) {
  try {
    const r = await db.query('SELECT crt FROM fis_emitentes WHERE empresa_id = $1 AND ativo = true ORDER BY loja_id NULLS FIRST LIMIT 1', [empresaId]);
    return r.rows[0]?.crt ? String(r.rows[0].crt) : null;
  } catch { return null; }
}

/** Nomes do cadastro da barbearia desta empresa (serviços e produtos), por id. */
export function cadastroBarbearia(empresaId) {
  const mapa = new Map();
  try {
    const b = getJsonDb()?.barbearias?.[empresaId];
    for (const s of Object.values(b?.servicos || {})) if (s?.id) mapa.set(`servico:${s.id}`, { nome: s.nome, grupo: `Barbearia · ${s.categoria || 'Serviços'}`, ativo: s.ativo !== false, tipo: 'servico' });
    for (const p of Object.values(b?.produtos || {})) if (p?.id) mapa.set(`est_item:${p.id}`, { nome: p.nome, grupo: `Barbearia · ${p.categoria || 'Produtos'}`, ativo: p.ativo !== false, tipo: 'produto', sku: p.sku || p.codigo || null });
  } catch { /* sem barbearia nesta empresa */ }
  return mapa;
}

const ROTULO_FONTE = { bar_produto: 'Bar', loja_variante: 'Loja online', est_item: 'Estoque / barbearia', servico: 'Serviço', categoria: 'Padrão de categoria' };

/** Enriquece a lista de `listarClassificaveis` com situação, conferência, descrições e texto de busca. */
export function analisar(lista = [], { crt = null, cadastro = new Map() } = {}) {
  return lista.map((item) => {
    const chave = `${item.fonte}:${item.fonteId}`;
    const doCadastro = cadastro.get(chave);
    let nome = item.nome; let grupo = item.grupo; let orfa = false;
    // classificação de serviço/produto que só tinha o código interno: usa o nome do cadastro da barbearia
    if ((!nome || nome === item.fonteId) && doCadastro) { nome = doCadastro.nome; grupo = doCadastro.grupo + (doCadastro.ativo ? '' : ' · inativo'); }
    else if (item.fonte === 'servico' && nome === item.fonteId && !doCadastro) { orfa = true; grupo = 'Serviço sem cadastro (código interno)'; }
    const tipo = item.classificacao?.tipo || item.tipo || (item.fonte === 'servico' ? 'servico' : 'produto');
    const c = item.classificacao;
    const conferencia = c ? ref.conferirClassificacao({ ...c, tipo }, { crt }) : null;
    const descricao = c ? ref.descreverClassificacao({ ...c, tipo }) : null;
    // sugestões (NCM do cadastro do estoque e sugestão pelo nome), com a descrição oficial para conferir
    const sugestoes = [];
    if (!c && item.ncmSugerido) {
      const n = ref.obterNcm(item.ncmSugerido);
      sugestoes.push({ origem: 'cadastro', ncm: soDigitos(item.ncmSugerido), descricao: n ? n.caminho : null, valido: Boolean(n), cests: n ? ref.cestsDoNcm(n.codigo).slice(0, 3) : [] });
    }
    if (!c && item.sugestao?.ncm) {
      const n = ref.obterNcm(item.sugestao.ncm); const ce = item.sugestao.cest ? ref.obterCest(item.sugestao.cest) : null;
      sugestoes.push({ origem: 'nome', ncm: soDigitos(item.sugestao.ncm), cest: item.sugestao.cest || null, descricao: n ? n.caminho : item.sugestao.descricao, valido: Boolean(n) && (!item.sugestao.cest || Boolean(ce && !ce.revogado && (ce.ncms || []).some((p) => soDigitos(item.sugestao.ncm).startsWith(soDigitos(p))))), cestDescricao: ce?.descricao || null });
    }
    const situacao = !c ? 'sem' : conferencia.erros.length ? 'erro' : conferencia.avisos.length ? 'aviso' : 'ok';
    const busca = ref.normalizar([
      nome, grupo, item.fonteId, ROTULO_FONTE[item.fonte],
      c?.ncm, c?.ncm && `${c.ncm.slice(0, 4)}.${c.ncm.slice(4, 6)}.${c.ncm.slice(6)}`, c?.cest, c?.cfop, c?.csosn && `csosn ${c.csosn}`, c?.cstIcms && `cst ${c.cstIcms}`, c?.cTribNac,
      descricao?.ncm, descricao?.cest, descricao?.servico,
      ...sugestoes.map((s) => `${s.ncm} ${s.descricao || ''}`),
    ].filter(Boolean).join(' '));
    return {
      ...item, nome, grupo, tipo, orfa, situacao, descricao, sugestoes,
      erros: conferencia?.erros || [], avisos: conferencia?.avisos || [],
      origemRotulo: ROTULO_FONTE[item.fonte] || item.fonte, busca,
    };
  });
}

/** Lista completa e conferida para a tela. */
export async function analisarClassificaveis(db, empresaId, lista) {
  const crt = await crtDaEmpresa(db, empresaId);
  const itens = analisar(lista, { crt, cadastro: cadastroBarbearia(empresaId) });
  const contar = (f) => itens.filter(f).length;
  return {
    crt,
    regime: crt === '1' || crt === '4' ? 'simples' : crt ? 'normal' : null,
    fontes: ref.fontes(),
    resumo: {
      total: itens.length, sem: contar((i) => i.situacao === 'sem'), erro: contar((i) => i.situacao === 'erro'),
      aviso: contar((i) => i.situacao === 'aviso'), ok: contar((i) => i.situacao === 'ok'), herdadas: contar((i) => i.herdada), orfas: contar((i) => i.orfa),
    },
    itens,
  };
}

/** Consultas para o formulário: NCM, CEST do NCM, CFOP, serviços e cIndOp. */
export function referencias(q = {}) {
  const tipo = String(q.tipo || '');
  const termo = String(q.q || '').slice(0, 120);
  if (tipo === 'ncm') return { itens: ref.buscarNcm(termo, { limite: q.limite }) };
  if (tipo === 'ncm-detalhe') { const n = ref.obterNcm(termo); return { ncm: n, cests: n ? ref.cestsDoNcm(n.codigo) : [] }; }
  if (tipo === 'cest') return { cest: ref.obterCest(termo) };
  if (tipo === 'cfop') return { itens: ref.listarCfops(termo).slice(0, 80) };
  if (tipo === 'servico') return { itens: ref.buscarServicos(termo, { limite: q.limite || 60 }) };
  if (tipo === 'cindop') return { itens: ref.listarCIndOps() };
  return {
    fontes: ref.fontes(),
    csosn: Object.entries(ref.CSOSN).map(([codigo, descricao]) => ({ codigo, descricao })),
    cstIcms: Object.entries(ref.CST_ICMS).map(([codigo, descricao]) => ({ codigo, descricao })),
    cstPisCofins: Object.entries(ref.CST_PIS_COFINS).map(([codigo, descricao]) => ({ codigo, descricao })),
    unidades: Object.entries(ref.UNIDADES).map(([codigo, descricao]) => ({ codigo, descricao })),
    cfopsUsuais: ['5102', '5405', '5101', '5403', '6102', '6108', '6404', '5949'].map((c) => ref.obterCfop(c)).filter(Boolean),
  };
}

/** Middleware: barra a gravação de classificação com erro nas tabelas oficiais (antes do serviço gravar). */
export function barrarClassificacaoInvalida({ lote = false } = {}) {
  return (req, res, next) => {
    try {
      const corpo = req.body || {};
      const c = lote ? { ...(corpo.classificacao || {}) } : corpo;
      if (lote && !c.tipo && Array.isArray(corpo.itens) && corpo.itens.length && corpo.itens.every((i) => i?.fonte === 'servico')) c.tipo = 'servico';
      const r = ref.conferirClassificacao(c, { crt: null });
      if (r.erros.length) return res.status(422).json({ error: r.erros.map((e) => e.mensagem).join(' '), code: 'CLASSIFICACAO_INVALIDA', erros: r.erros, avisos: r.avisos });
    } catch { /* a conferência nunca derruba a gravação por falha própria */ }
    return next();
  };
}

/** Conferência de um rascunho do formulário, com o regime do emitente. */
export function conferir(dados, crt) {
  return { crt, ...ref.conferirClassificacao(dados, { crt }) };
}
