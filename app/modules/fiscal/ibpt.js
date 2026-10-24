// IBPT — tributos aproximados (Lei 12.741/2012, "De Olho no Imposto").
//
// A empresa importa o CSV oficial do IBPT da UF dela (um arquivo por UF, separador ";"):
//   codigo;ex;tipo;descricao;nacionalfederal;importadosfederal;estadual;municipal;vigenciainicio;vigenciafim;chave;versao;fonte
// A importação troca a tabela inteira da UF (o arquivo oficial é completo). Sem tabela, a emissão
// não preenche vTotTrib (comportamento anterior).
import { ErroDominio, exigirUuid, transacao } from '../acesso/banco.js';

const COLUNAS = ['codigo', 'ex', 'tipo', 'descricao', 'nacionalfederal', 'importadosfederal', 'estadual', 'municipal', 'vigenciainicio', 'vigenciafim', 'chave', 'versao', 'fonte'];
// origem da mercadoria com conteúdo estrangeiro: usa a alíquota federal de importados
const ORIGENS_IMPORTADAS = new Set(['1', '2', '3', '6', '7', '8']);
const LIMITE_LINHAS = 60000;

const centavos = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;

/** Texto do arquivo: UTF-8 quando válido, senão ISO-8859-1 (o IBPT costuma publicar em Latin-1). */
export function decodificarArquivo(entrada) {
  if (typeof entrada === 'string') return entrada.replace(/^﻿/, '');
  const buf = Buffer.isBuffer(entrada) ? entrada : Buffer.from(entrada || []);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, '');
  } catch {
    return buf.toString('latin1');
  }
}

/** Divide uma linha do CSV respeitando aspas ("a;b" é um campo só; "" é aspas literal). */
function dividirLinha(linha) {
  const campos = []; let atual = ''; let aspas = false;
  for (let i = 0; i < linha.length; i += 1) {
    const c = linha[i];
    if (aspas) {
      if (c === '"' && linha[i + 1] === '"') { atual += '"'; i += 1; } else if (c === '"') aspas = false; else atual += c;
    } else if (c === '"') aspas = true;
    else if (c === ';') { campos.push(atual); atual = ''; } else atual += c;
  }
  campos.push(atual);
  return campos.map((x) => x.trim());
}

const normalizarCabecalho = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
// alíquotas vêm como "4.20" (às vezes "4,20"); vazio é inválido
const numeroBr = (v) => { const t = String(v ?? '').trim(); return t ? Number(t.replace(',', '.')) : NaN; };
function dataBr(v) {
  const t = String(v || '').trim();
  let m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** Lê o CSV do IBPT. Devolve as linhas válidas e quantas foram ignoradas (com o motivo das primeiras). */
export function lerCsvIbpt(entrada) {
  const texto = decodificarArquivo(entrada);
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim());
  if (!linhas.length) throw new ErroDominio('VALIDATION_ERROR', 'Arquivo do IBPT vazio');
  const cab = dividirLinha(linhas[0]).map(normalizarCabecalho);
  const faltando = COLUNAS.filter((c) => !cab.includes(c));
  if (faltando.length) throw new ErroDominio('VALIDATION_ERROR', `Este não parece o CSV oficial do IBPT: faltam as colunas ${faltando.join(', ')}`);
  if (linhas.length - 1 > LIMITE_LINHAS) throw new ErroDominio('VALIDATION_ERROR', `Arquivo grande demais (mais de ${LIMITE_LINHAS} linhas)`);
  const pos = Object.fromEntries(COLUNAS.map((c) => [c, cab.indexOf(c)]));
  const porChave = new Map();
  const erros = [];
  let ignoradas = 0;
  for (let n = 1; n < linhas.length; n += 1) {
    const f = dividirLinha(linhas[n]);
    const v = (c) => f[pos[c]] ?? '';
    const tipo = String(v('tipo')).trim();
    let codigo = String(v('codigo')).replace(/\D/g, '');
    if (tipo === '0' && codigo.length === 7) codigo = `0${codigo}`; // NCM sem o zero à esquerda
    const aliq = ['nacionalfederal', 'importadosfederal', 'estadual', 'municipal'].map((c) => numeroBr(v(c)));
    const motivo = !['0', '1', '2'].includes(tipo) ? 'tipo inválido'
      : !codigo || codigo.length > 12 || (tipo === '0' && codigo.length !== 8) ? 'código inválido'
        : aliq.some((a) => !(a >= 0 && a <= 100)) ? 'alíquota inválida' : null;
    if (motivo) { ignoradas += 1; if (erros.length < 5) erros.push(`linha ${n + 1}: ${motivo}`); continue; }
    const ex = String(v('ex')).replace(/\D/g, '').slice(0, 3);
    porChave.set(`${tipo}|${codigo}|${ex}`, {
      tipo, codigo, ex, descricao: String(v('descricao')).slice(0, 500) || null,
      nacionalFederal: aliq[0], importadosFederal: aliq[1], estadual: aliq[2], municipal: aliq[3],
      vigenciaInicio: dataBr(v('vigenciainicio')), vigenciaFim: dataBr(v('vigenciafim')),
      chave: String(v('chave')).slice(0, 20) || null, versao: String(v('versao')).slice(0, 20) || null, fonte: String(v('fonte')).slice(0, 80) || 'IBPT',
    });
  }
  if (!porChave.size) throw new ErroDominio('VALIDATION_ERROR', `Nenhuma linha válida no CSV do IBPT${erros.length ? ` (${erros.join('; ')})` : ''}`);
  return { linhas: [...porChave.values()], ignoradas, erros };
}

/** Troca a tabela IBPT da UF da empresa pelo conteúdo do CSV. */
export async function importarIbpt(db, empresaId, { uf, arquivo }) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const u = String(uf || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(u)) throw new ErroDominio('VALIDATION_ERROR', 'Informe a UF da tabela do IBPT');
  const { linhas, ignoradas, erros } = lerCsvIbpt(arquivo);
  const col = (k) => linhas.map((l) => l[k]);
  return transacao(db, async (q) => {
    await q('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`fis:ibpt:${empresa}:${u}`]);
    await q('DELETE FROM fis_ibpt WHERE empresa_id = $1 AND uf = $2', [empresa, u]);
    await q(
      `INSERT INTO fis_ibpt (empresa_id, uf, tipo, codigo, ex, descricao, nacional_federal, importados_federal, estadual, municipal, vigencia_inicio, vigencia_fim, chave, versao, fonte)
       SELECT $1, $2, x.* FROM unnest($3::text[], $4::text[], $5::text[], $6::text[], $7::numeric[], $8::numeric[], $9::numeric[], $10::numeric[], $11::date[], $12::date[], $13::text[], $14::text[], $15::text[]) AS x`,
      [empresa, u, col('tipo'), col('codigo'), col('ex'), col('descricao'), col('nacionalFederal'), col('importadosFederal'), col('estadual'), col('municipal'),
        col('vigenciaInicio'), col('vigenciaFim'), col('chave'), col('versao'), col('fonte')]);
    const versao = linhas.find((l) => l.versao)?.versao || null;
    const vigenciaFim = linhas.map((l) => l.vigenciaFim).filter(Boolean).sort().pop() || null;
    return { uf: u, importadas: linhas.length, ignoradas, erros, versao, vigenciaFim };
  });
}

/** Resumo das tabelas importadas (uma por UF). */
export async function listarIbpt(db, empresaId) {
  const r = await db.query(
    `SELECT uf, count(*)::int AS linhas, max(versao) AS versao, min(vigencia_inicio) AS vigencia_inicio, max(vigencia_fim) AS vigencia_fim, max(importado_em) AS importado_em
       FROM fis_ibpt WHERE empresa_id = $1 GROUP BY uf ORDER BY uf`, [exigirUuid(empresaId, 'empresa')]);
  return r.rows.map((x) => ({ uf: x.uf, linhas: x.linhas, versao: x.versao, vigenciaInicio: x.vigencia_inicio, vigenciaFim: x.vigencia_fim, importadoEm: x.importado_em }));
}

/**
 * Tributos aproximados dos itens (produtos por NCM). Devolve null quando a empresa não tem tabela
 * da UF; senão { itens: [valor por item], total, federal, estadual, municipal, versao, chave,
 * mensagens }. Item sem NCM na tabela entra com zero (e uma mensagem).
 */
export async function tributosAproximados(q, empresa, uf, itens, { hoje = new Date() } = {}) {
  const meta = (await q('SELECT versao, chave, vigencia_fim FROM fis_ibpt WHERE empresa_id = $1 AND uf = $2 ORDER BY vigencia_fim DESC NULLS LAST LIMIT 1', [empresa, uf])).rows[0];
  if (!meta) return null;
  const ncms = [...new Set(itens.map((i) => String(i.ncm || '').replace(/\D/g, '')).filter(Boolean))];
  const linhas = ncms.length
    ? (await q("SELECT codigo, nacional_federal, importados_federal, estadual, municipal FROM fis_ibpt WHERE empresa_id = $1 AND uf = $2 AND tipo = '0' AND ex = '' AND codigo = ANY($3::text[])", [empresa, uf, ncms])).rows
    : [];
  const tabela = new Map(linhas.map((l) => [l.codigo, l]));
  const mensagens = [];
  const soma = { federal: 0, estadual: 0, municipal: 0 };
  const porItem = itens.map((i, idx) => {
    const l = tabela.get(String(i.ncm || '').replace(/\D/g, ''));
    if (!l) { mensagens.push({ codigo: 'IBPT_SEM_NCM', mensagem: `Item ${idx + 1}: NCM ${i.ncm || '—'} fora da tabela do IBPT; tributos aproximados zerados.` }); return 0; }
    const base = Number(i.valorProduto || 0);
    const federal = centavos(base * Number(ORIGENS_IMPORTADAS.has(String(i.origem ?? '0')) ? l.importados_federal : l.nacional_federal) / 100);
    const estadual = centavos(base * Number(l.estadual) / 100);
    const municipal = centavos(base * Number(l.municipal) / 100);
    soma.federal += federal; soma.estadual += estadual; soma.municipal += municipal;
    return centavos(federal + estadual + municipal);
  });
  const fim = meta.vigencia_fim ? new Date(meta.vigencia_fim) : null;
  if (fim && fim < new Date(hoje.toISOString().slice(0, 10))) mensagens.push({ codigo: 'IBPT_VENCIDA', mensagem: 'A tabela do IBPT importada está fora da vigência: importe a versão atual.' });
  return {
    itens: porItem, total: centavos(porItem.reduce((s, v) => s + v, 0)),
    federal: centavos(soma.federal), estadual: centavos(soma.estadual), municipal: centavos(soma.municipal),
    fonte: 'IBPT', versao: meta.versao || null, chave: meta.chave || null, mensagens,
  };
}
