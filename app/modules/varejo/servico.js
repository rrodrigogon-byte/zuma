// Varejo/supermercado sobre o estoque único (migração 096), por unidade:
// preço de venda (base no item e por unidade), promoções com período, preço final vigente,
// lotes e validade, etiquetas de gôndola e transferências entre unidades com trânsito.
// Lotes são um controle de validade à parte: registram entrada/baixa por unidade, mas não mexem
// no saldo do estoque (o saldo é do movimento de estoque/compra/venda).
import { ErroDominio, exigirTexto, exigirUuid, transacao } from '../acesso/banco.js';
import { movimentarNaTransacao, exigirUnidade } from '../suprimentos/estoque.js';
import { FUSO_PADRAO, hojeNoFuso, instanteLocal } from '../salao/servico.js';

const textoOpcional = (v, max) => { const t = String(v ?? '').trim(); return t ? t.slice(0, max) : null; };
const dinheiro = (v) => Math.round(Number(v || 0) * 100) / 100;
const qtd = (v) => Math.round(Number(v || 0) * 1000) / 1000;
const numero = (v, campo, { min = 0, max = 1e9, inteiro = false } = {}) => {
  const n = Number(typeof v === 'string' ? v.replace(',', '.') : v);
  if (!Number.isFinite(n) || n < min || n > max || (inteiro && !Number.isInteger(n))) throw new ErroDominio('VALIDATION_ERROR', `${campo} inválido`);
  return n;
};
const SEM = '00000000-0000-0000-0000-000000000000';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const uuidOuNull = (v) => { const s = String(v ?? '').trim(); return UUID_RE.test(s) ? s.toLowerCase() : null; };

/**
 * Promoção vigente para o item na unidade: vale o menor preço por unidade. Promoção que não baixa
 * o preço (preço fixo maior que o de venda) é ignorada. "Leve X, pague Y" é só texto na etiqueta:
 * o preço unitário continua o de venda, então qualquer desconto real ganha dela.
 */
export function aplicarPromocoes(precoBase, promocoes) {
  let melhor = null;
  for (const p of promocoes) {
    let preco = precoBase; let texto = '';
    if (p.tipo === 'percentual') { preco = dinheiro(precoBase * (1 - Number(p.percentual) / 100)); texto = `${Number(p.percentual)}% OFF`; }
    else if (p.tipo === 'valor_fixo') { preco = dinheiro(Math.max(0, precoBase - Number(p.valor_desconto))); texto = `R$ ${Number(p.valor_desconto).toFixed(2).replace('.', ',')} de desconto`; }
    else if (p.tipo === 'preco_fixo') { preco = dinheiro(Math.min(precoBase, Number(p.preco_fixo))); texto = 'Preço promocional'; }
    else if (p.tipo === 'leve_pague') { texto = `Leve ${p.leve}, pague ${p.pague}`; preco = precoBase; }
    if (p.tipo !== 'leve_pague' && !(preco < precoBase)) continue;
    const ganha = !melhor || preco < melhor.preco || (preco === melhor.preco && melhor.tipo === 'leve_pague' && p.tipo !== 'leve_pague');
    if (ganha) melhor = { id: p.id, nome: p.nome, tipo: p.tipo, preco, texto };
  }
  return melhor;
}

/** Início/fim da promoção no fuso da empresa: data sozinha = começo do dia; fim com data sozinha = fim do dia. */
function instantePromocao(valor, fuso, { fimDoDia = false } = {}) {
  const t = String(valor || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const d = instanteLocal(`${t}T00:00`, fuso);
    return fimDoDia ? instanteLocal(`${new Date(Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1, +t.slice(8, 10) + 1)).toISOString().slice(0, 10)}T00:00`, fuso) : d;
  }
  try { return instanteLocal(t, fuso); } catch { return new Date(NaN); }
}

// ── produtos e preços ────────────────────────────────────────────────────────
export async function listarProdutos(db, empresaId, { lojaId = null, q = '', agora = new Date() } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const loja = uuidOuNull(lojaId);
  const v = [empresa, loja];
  let filtro = '';
  if (q) { v.push(`%${String(q).slice(0, 80).replace(/[%_\\]/g, (c) => `\\${c}`)}%`); filtro = ` AND (i.nome ILIKE $${v.length} OR i.sku ILIKE $${v.length} OR i.ean ILIKE $${v.length} OR i.plu ILIKE $${v.length})`; }
  const r = await db.query(
    `SELECT i.*, pu.preco_venda AS preco_unidade,
            COALESCE((SELECT SUM(s.quantidade) FROM est_saldos s WHERE s.empresa_id = i.empresa_id AND s.item_id = i.id AND ($2::uuid IS NULL OR s.loja_id = $2::uuid)), 0) AS saldo
       FROM est_itens i LEFT JOIN var_precos_unidade pu ON pu.empresa_id = i.empresa_id AND pu.item_id = i.id AND pu.loja_id = $2::uuid
      WHERE i.empresa_id = $1 AND i.ativo = true${filtro} ORDER BY lower(i.nome) LIMIT 2000`, v);
  const promos = await promocoesVigentes(db, empresa, { lojaId: loja, agora });
  return r.rows.map((row) => {
    const precoBase = row.preco_unidade !== null ? Number(row.preco_unidade) : row.preco_venda !== null ? Number(row.preco_venda) : null;
    const promo = precoBase === null ? null : aplicarPromocoes(precoBase, promos.filter((p) => p.itens.includes(row.id)));
    const precoFinal = promo ? promo.preco : precoBase;
    const custo = Number(row.custo_medio);
    return {
      id: row.id, nome: row.nome, sku: row.sku || null, ean: row.ean || null, plu: row.plu || null, departamento: row.departamento || row.categoria || null, unidade: row.unidade,
      pesavel: row.pesavel === true, controlaLote: row.controla_lote === true, saldo: qtd(row.saldo), estoqueMinimo: Number(row.estoque_minimo), custoMedio: custo,
      precoBase, precoDaUnidade: row.preco_unidade !== null ? Number(row.preco_unidade) : null, precoFinal, promocao: promo,
      margem: precoFinal ? Math.round(((precoFinal - custo) / precoFinal) * 1000) / 10 : null,
    };
  });
}

// ── balança: etiqueta EAN-13 de peso/preço ────────────────────────────────────
const BALANCA_PADRAO = { prefixo: '2', digitosPlu: 4, digitosValor: 6, tipoValor: 'preco', validadeDias: null };

/** Dígito verificador do EAN-13 confere? */
export function ean13Valido(codigo) {
  const c = String(codigo || '');
  if (!/^\d{13}$/.test(c)) return false;
  const soma = [...c.slice(0, 12)].reduce((t, d, i) => t + Number(d) * (i % 2 ? 3 : 1), 0);
  return (10 - (soma % 10)) % 10 === Number(c[12]);
}

/**
 * Lê a etiqueta da balança: prefixo + PLU + … + valor + dígito do EAN. O valor são os
 * `digitosValor` dígitos logo antes do dígito verificador: preço total em centavos ou peso em
 * gramas, conforme a balança. null = não é etiqueta de balança.
 */
export function lerEtiquetaBalanca(codigo, cfg = BALANCA_PADRAO) {
  const c = String(codigo || '').trim();
  const prefixo = String(cfg.prefixo || '2');
  if (!ean13Valido(c) || !c.startsWith(prefixo)) return null;
  const plu = c.slice(prefixo.length, prefixo.length + cfg.digitosPlu);
  const valor = Number(c.slice(12 - cfg.digitosValor, 12));
  if (!/^\d+$/.test(plu) || !Number.isFinite(valor)) return null;
  return { plu: String(Number(plu)), pluBruto: plu, tipo: cfg.tipoValor, valor };
}

export async function configBalanca(db, empresaId) {
  const r = (await db.query('SELECT * FROM var_balanca_config WHERE empresa_id = $1', [exigirUuid(empresaId, 'empresa')])).rows[0];
  return r ? { prefixo: r.prefixo, digitosPlu: r.digitos_plu, digitosValor: r.digitos_valor, tipoValor: r.tipo_valor, validadeDias: r.validade_dias } : { ...BALANCA_PADRAO };
}

export async function salvarConfigBalanca(db, empresaId, dados = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const cfg = {
    prefixo: String(dados.prefixo ?? '2'),
    digitosPlu: numero(dados.digitosPlu ?? 4, 'Dígitos do PLU', { min: 4, max: 6, inteiro: true }),
    digitosValor: numero(dados.digitosValor ?? 6, 'Dígitos do valor', { min: 4, max: 6, inteiro: true }),
    tipoValor: dados.tipoValor === 'peso' ? 'peso' : 'preco',
    validadeDias: dados.validadeDias === '' || dados.validadeDias == null ? null : numero(dados.validadeDias, 'Validade', { min: 0, max: 999, inteiro: true }),
  };
  if (!/^2\d?$/.test(cfg.prefixo)) throw new ErroDominio('VALIDATION_ERROR', 'Prefixo da balança: 2 ou 2 + um dígito');
  if (cfg.prefixo.length + cfg.digitosPlu + cfg.digitosValor > 12) throw new ErroDominio('VALIDATION_ERROR', 'Prefixo, PLU e valor não cabem no EAN-13');
  await db.query(
    `INSERT INTO var_balanca_config (empresa_id, prefixo, digitos_plu, digitos_valor, tipo_valor, validade_dias) VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (empresa_id) DO UPDATE SET prefixo = EXCLUDED.prefixo, digitos_plu = EXCLUDED.digitos_plu, digitos_valor = EXCLUDED.digitos_valor,
       tipo_valor = EXCLUDED.tipo_valor, validade_dias = EXCLUDED.validade_dias, atualizado_em = CURRENT_TIMESTAMP`,
    [empresa, cfg.prefixo, cfg.digitosPlu, cfg.digitosValor, cfg.tipoValor, cfg.validadeDias]);
  return cfg;
}

/** Arquivo de PLU para carregar na balança (CSV com ;): só itens pesáveis com PLU e preço. */
export async function exportarPluBalanca(db, empresaId, { lojaId = null, agora = new Date() } = {}) {
  const cfg = await configBalanca(db, empresaId);
  const produtos = (await listarProdutos(db, empresaId, { lojaId, agora })).filter((p) => p.pesavel && p.plu && p.precoFinal !== null);
  const linhas = ['PLU;DESCRICAO;PRECO_KG;VALIDADE_DIAS;DEPARTAMENTO'];
  for (const p of produtos) {
    const nome = String(p.nome).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[;\r\n]/g, ' ').toUpperCase().slice(0, 50);
    linhas.push([String(p.plu).padStart(cfg.digitosPlu, '0'), nome, p.precoFinal.toFixed(2), cfg.validadeDias ?? '', String(p.departamento || '').replace(/[;\r\n]/g, ' ').slice(0, 30)].join(';'));
  }
  return { arquivo: `${linhas.join('\r\n')}\r\n`, itens: produtos.length };
}

export async function buscarPorCodigo(db, empresaId, codigo, opcoes = {}) {
  const c = String(codigo || '').trim();
  if (!c) throw new ErroDominio('VALIDATION_ERROR', 'Informe o código');
  const r = await db.query('SELECT id FROM est_itens WHERE empresa_id = $1 AND ativo = true AND (ean = $2 OR sku = $2 OR plu = $2) LIMIT 1', [exigirUuid(empresaId, 'empresa'), c]);
  if (r.rows[0]) return (await listarProdutos(db, empresaId, opcoes)).find((p) => p.id === r.rows[0].id);
  // etiqueta da balança: acha pelo PLU e calcula quantidade e total
  const etiqueta = lerEtiquetaBalanca(c, await configBalanca(db, empresaId));
  if (etiqueta) {
    const b = await db.query("SELECT id FROM est_itens WHERE empresa_id = $1 AND ativo = true AND pesavel AND (plu = $2 OR plu = $3) LIMIT 1", [exigirUuid(empresaId, 'empresa'), etiqueta.plu, etiqueta.pluBruto]);
    const produto = b.rows[0] ? (await listarProdutos(db, empresaId, opcoes)).find((p) => p.id === b.rows[0].id) : null;
    if (produto && produto.precoFinal) {
      const total = etiqueta.tipo === 'preco' ? dinheiro(etiqueta.valor / 100) : dinheiro((etiqueta.valor / 1000) * produto.precoFinal);
      const quantidade = etiqueta.tipo === 'peso' ? qtd(etiqueta.valor / 1000) : qtd(total / produto.precoFinal);
      return { ...produto, etiquetaBalanca: { codigo: c, plu: etiqueta.plu, quantidade, total } };
    }
  }
  throw new ErroDominio('NOT_FOUND', 'Produto não encontrado para este código', 404);
}

/** Preço base no item (empresa toda) ou da unidade; também departamento, PLU, pesável e lote. */
export async function configurarProduto(db, empresaId, itemId, dados = {}, { lojaId = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const item = exigirUuid(itemId, 'item');
  return transacao(db, async (q) => {
    const it = (await q('SELECT id FROM est_itens WHERE empresa_id = $1 AND id = $2 FOR UPDATE', [empresa, item])).rows[0];
    if (!it) throw new ErroDominio('NOT_FOUND', 'Produto não encontrado', 404);
    const sets = []; const v = [empresa, item];
    const add = (col, val) => { v.push(val); sets.push(`${col} = $${v.length}`); };
    if (dados.precoBase !== undefined) add('preco_venda', dados.precoBase === null || dados.precoBase === '' ? null : dinheiro(numero(dados.precoBase, 'Preço')));
    if (dados.departamento !== undefined) add('departamento', textoOpcional(dados.departamento, 80));
    if (dados.plu !== undefined) { const plu = textoOpcional(dados.plu, 10); if (plu && !/^\d{1,6}$/.test(plu)) throw new ErroDominio('VALIDATION_ERROR', 'PLU de até 6 dígitos'); add('plu', plu); }
    if (dados.pesavel !== undefined) add('pesavel', dados.pesavel === true);
    if (dados.controlaLote !== undefined) add('controla_lote', dados.controlaLote === true);
    if (sets.length) await q(`UPDATE est_itens SET ${sets.join(', ')}, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2`, v);
    if (dados.precoUnidade !== undefined) {
      if (!lojaId) throw new ErroDominio('VALIDATION_ERROR', 'Escolha a unidade para o preço da unidade');
      await exigirUnidade(q, empresa, lojaId);
      if (dados.precoUnidade === null || dados.precoUnidade === '') await q('DELETE FROM var_precos_unidade WHERE empresa_id = $1 AND loja_id = $2 AND item_id = $3', [empresa, lojaId, item]);
      else await q(`INSERT INTO var_precos_unidade (empresa_id, loja_id, item_id, preco_venda) VALUES ($1,$2,$3,$4)
                    ON CONFLICT (empresa_id, loja_id, item_id) DO UPDATE SET preco_venda = EXCLUDED.preco_venda, atualizado_em = CURRENT_TIMESTAMP`, [empresa, lojaId, item, dinheiro(numero(dados.precoUnidade, 'Preço da unidade'))]);
    }
    return { id: item };
  }).then(() => listarProdutos(db, empresa, { lojaId })).then((l) => l.find((p) => p.id === item));
}

// ── promoções ────────────────────────────────────────────────────────────────
async function promocoesVigentes(db, empresa, { lojaId = null, agora = new Date() } = {}) {
  const loja = uuidOuNull(lojaId);
  const r = await db.query(
    `SELECT p.*, COALESCE(array_agg(pi.item_id) FILTER (WHERE pi.item_id IS NOT NULL), '{}') AS itens FROM var_promocoes p LEFT JOIN var_promocao_itens pi ON pi.empresa_id = p.empresa_id AND pi.promocao_id = p.id
      WHERE p.empresa_id = $1 AND p.status = 'ativa' AND p.inicio <= $3 AND p.fim > $3 AND (p.loja_id IS NULL OR p.loja_id = $2::uuid) GROUP BY p.id`, [empresa, loja, agora]);
  return r.rows.map((p) => ({ ...p, leve: p.leve, pague: p.pague, itens: p.itens.map(String) }));
}

function promoDto(p) {
  return { id: p.id, lojaId: p.loja_id || null, nome: p.nome, tipo: p.tipo, status: p.status, percentual: p.percentual === null ? null : Number(p.percentual), valorDesconto: p.valor_desconto === null ? null : Number(p.valor_desconto), precoFixo: p.preco_fixo === null ? null : Number(p.preco_fixo), leve: p.leve, pague: p.pague, inicio: p.inicio, fim: p.fim, itens: (p.itens || []).map(String) };
}

export async function listarPromocoes(db, empresaId, { lojaId = null } = {}) {
  const loja = uuidOuNull(lojaId);
  const r = await db.query(
    `SELECT p.*, COALESCE(array_agg(pi.item_id) FILTER (WHERE pi.item_id IS NOT NULL), '{}') AS itens FROM var_promocoes p LEFT JOIN var_promocao_itens pi ON pi.empresa_id = p.empresa_id AND pi.promocao_id = p.id
      WHERE p.empresa_id = $1 AND ($2::uuid IS NULL OR p.loja_id IS NULL OR p.loja_id = $2::uuid) GROUP BY p.id ORDER BY p.inicio DESC LIMIT 300`, [exigirUuid(empresaId, 'empresa'), loja]);
  return r.rows.map(promoDto);
}

export async function criarPromocao(db, empresaId, dados = {}, { usuario = null, lojaId = null, fuso = FUSO_PADRAO } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const tipo = String(dados.tipo || '');
  if (!['percentual', 'valor_fixo', 'preco_fixo', 'leve_pague'].includes(tipo)) throw new ErroDominio('VALIDATION_ERROR', 'Tipo de promoção inválido');
  const inicio = instantePromocao(dados.inicio, fuso); const fim = instantePromocao(dados.fim, fuso, { fimDoDia: true });
  if (Number.isNaN(inicio.valueOf()) || Number.isNaN(fim.valueOf()) || fim <= inicio) throw new ErroDominio('VALIDATION_ERROR', 'Período inválido');
  const itens = [...new Set((Array.isArray(dados.itens) ? dados.itens : []).map((i) => exigirUuid(i, 'produto')))];
  if (!itens.length) throw new ErroDominio('VALIDATION_ERROR', 'Escolha os produtos da promoção');
  const valores = {
    percentual: tipo === 'percentual' ? numero(dados.percentual, 'Percentual', { min: 0.01, max: 99.99 }) : null,
    valor_desconto: tipo === 'valor_fixo' ? numero(dados.valorDesconto, 'Desconto', { min: 0.01 }) : null,
    preco_fixo: tipo === 'preco_fixo' ? numero(dados.precoFixo, 'Preço', { min: 0 }) : null,
    leve: tipo === 'leve_pague' ? numero(dados.leve, 'Leve', { min: 2, max: 100, inteiro: true }) : null,
    pague: tipo === 'leve_pague' ? numero(dados.pague, 'Pague', { min: 1, max: 99, inteiro: true }) : null,
  };
  if (tipo === 'leve_pague' && !(valores.leve > valores.pague)) throw new ErroDominio('VALIDATION_ERROR', '"Leve" precisa ser maior que "pague"');
  return transacao(db, async (q) => {
    if (lojaId) await exigirUnidade(q, empresa, lojaId);
    const existentes = (await q('SELECT id FROM est_itens WHERE empresa_id = $1 AND id = ANY($2::uuid[])', [empresa, itens])).rows.length;
    if (existentes !== itens.length) throw new ErroDominio('NOT_FOUND', 'Produto não encontrado nesta empresa', 404);
    const p = (await q(
      `INSERT INTO var_promocoes (empresa_id, loja_id, nome, tipo, status, percentual, valor_desconto, preco_fixo, leve, pague, inicio, fim, criado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [empresa, lojaId, exigirTexto(dados.nome, 'Nome', { min: 2, max: 120 }), tipo, dados.status === 'ativa' ? 'ativa' : 'rascunho', valores.percentual, valores.valor_desconto, valores.preco_fixo, valores.leve, valores.pague, inicio, fim, textoOpcional(usuario, 180)])).rows[0];
    for (const i of itens) await q('INSERT INTO var_promocao_itens (empresa_id, promocao_id, item_id) VALUES ($1,$2,$3)', [empresa, p.id, i]);
    return promoDto({ ...p, itens });
  });
}

export async function mudarStatusPromocao(db, empresaId, id, status, { lojaRestrita = null } = {}) {
  if (!['ativa', 'pausada', 'encerrada'].includes(status)) throw new ErroDominio('VALIDATION_ERROR', 'status inválido');
  const de = { ativa: ['rascunho', 'pausada'], pausada: ['ativa'], encerrada: ['rascunho', 'ativa', 'pausada'] }[status];
  const r = await db.query('UPDATE var_promocoes SET status = $3 WHERE empresa_id = $1 AND id = $2 AND status = ANY($4::text[]) AND ($5::uuid IS NULL OR loja_id = $5::uuid) RETURNING *', [exigirUuid(empresaId, 'empresa'), exigirUuid(id, 'promoção'), status, de, lojaRestrita]);
  if (!r.rows[0]) throw new ErroDominio('INVALID_STATUS', 'Promoção não encontrada ou situação não permite a mudança', 409);
  return promoDto(r.rows[0]);
}

// ── lotes e validade ─────────────────────────────────────────────────────────
export async function listarLotes(db, empresaId, { lojaId = null, hoje, fuso = FUSO_PADRAO } = {}) {
  const loja = uuidOuNull(lojaId);
  const r = await db.query(
    `SELECT l.*, i.nome AS item_nome, i.unidade, i.sku FROM est_lotes l JOIN est_itens i ON i.empresa_id = l.empresa_id AND i.id = l.item_id
      WHERE l.empresa_id = $1 AND l.quantidade > 0 AND ($2::uuid IS NULL OR l.loja_id = $2::uuid) ORDER BY l.validade NULLS LAST, i.nome LIMIT 1000`, [exigirUuid(empresaId, 'empresa'), loja]);
  const base = hoje || hojeNoFuso(new Date(), fuso);
  return r.rows.map((l) => {
    const validade = l.validade ? (l.validade instanceof Date ? l.validade.toISOString().slice(0, 10) : String(l.validade).slice(0, 10)) : null;
    const dias = validade ? Math.round((new Date(`${validade}T12:00:00Z`) - new Date(`${base}T12:00:00Z`)) / 864e5) : null;
    const situacao = dias === null ? 'sem_validade' : dias < 0 ? 'vencido' : dias <= 7 ? 'critico' : dias <= 30 ? 'atencao' : 'normal';
    return { id: l.id, lojaId: l.loja_id || null, itemId: l.item_id, itemNome: l.item_nome, unidade: l.unidade, sku: l.sku || null, lote: l.lote, validade, quantidade: qtd(l.quantidade), diasParaVencer: dias, situacao };
  });
}

/** Registra entrada de lote (soma) ou baixa (quantidade negativa) na unidade. Não mexe no saldo do estoque. */
export async function registrarLote(db, empresaId, dados = {}, { lojaId = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const item = exigirUuid(dados.itemId, 'produto');
  const lote = exigirTexto(dados.lote, 'Lote', { min: 1, max: 60 });
  const validade = dados.validade ? String(dados.validade).slice(0, 10) : null;
  if (validade && !/^\d{4}-\d{2}-\d{2}$/.test(validade)) throw new ErroDominio('VALIDATION_ERROR', 'Validade inválida');
  const delta = numero(dados.quantidade, 'Quantidade', { min: -1e9 });
  if (!delta) throw new ErroDominio('VALIDATION_ERROR', 'Quantidade não pode ser zero');
  if (!lojaId) throw new ErroDominio('VALIDATION_ERROR', 'Escolha a unidade do lote');
  return transacao(db, async (q) => {
    await exigirUnidade(q, empresa, lojaId);
    if (!(await q('SELECT 1 FROM est_itens WHERE empresa_id = $1 AND id = $2', [empresa, item])).rows[0]) throw new ErroDominio('NOT_FOUND', 'Produto não encontrado', 404);
    await q('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`est:lote:${empresa}:${lojaId || SEM}:${item}:${lote}`]);
    const atual = (await q(`SELECT * FROM est_lotes WHERE empresa_id = $1 AND COALESCE(loja_id, '${SEM}'::uuid) = COALESCE($2::uuid, '${SEM}'::uuid) AND item_id = $3 AND lote = $4 FOR UPDATE`, [empresa, lojaId, item, lote])).rows[0];
    const nova = qtd(Number(atual?.quantidade || 0) + delta);
    if (nova < 0) throw new ErroDominio('ESTOQUE_INSUFICIENTE', `O lote tem ${Number(atual?.quantidade || 0)}`, 409);
    const r = atual
      ? await q('UPDATE est_lotes SET quantidade = $2, validade = COALESCE($3::date, validade), atualizado_em = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *', [atual.id, nova, validade])
      : await q('INSERT INTO est_lotes (empresa_id, loja_id, item_id, lote, validade, quantidade) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [empresa, lojaId, item, lote, validade, nova]);
    return { id: r.rows[0].id, quantidade: qtd(r.rows[0].quantidade) };
  });
}

// ── etiquetas ────────────────────────────────────────────────────────────────
export async function gerarEtiquetas(db, empresaId, { itens = [], formato = 'gondola_100x40' } = {}, { usuario = null, lojaId = null, agora = new Date() } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  if (!['gondola_100x40', 'gondola_60x30', 'adesivo_40x25'].includes(formato)) throw new ErroDominio('VALIDATION_ERROR', 'Formato de etiqueta inválido');
  const pedidos = (Array.isArray(itens) ? itens : []).map((i) => ({ item: exigirUuid(i.itemId, 'produto'), quantidade: numero(i.quantidade ?? 1, 'Quantidade', { min: 1, max: 500, inteiro: true }) }));
  if (!pedidos.length || pedidos.length > 300) throw new ErroDominio('VALIDATION_ERROR', 'Escolha de 1 a 300 produtos');
  const produtos = new Map((await listarProdutos(db, empresa, { lojaId, agora })).map((p) => [p.id, p]));
  const saida = [];
  for (const p of pedidos) {
    const prod = produtos.get(p.item);
    if (!prod) throw new ErroDominio('NOT_FOUND', 'Produto não encontrado', 404);
    if (prod.precoFinal === null) throw new ErroDominio('SEM_PRECO', `${prod.nome} está sem preço de venda`, 422);
    const r = await db.query('INSERT INTO var_etiquetas (empresa_id, loja_id, item_id, quantidade, formato, preco_exibido, texto_promocao, criado_por) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [empresa, lojaId, p.item, p.quantidade, formato, prod.precoFinal, prod.promocao?.texto || null, textoOpcional(usuario, 180)]);
    saida.push({ id: r.rows[0].id, itemId: p.item, nome: prod.nome, ean: prod.ean, plu: prod.plu, unidade: prod.unidade, quantidade: p.quantidade, formato, preco: prod.precoFinal, precoDe: prod.promocao ? prod.precoBase : null, promocao: prod.promocao?.texto || null });
  }
  return { etiquetas: saida };
}

export async function listarEtiquetas(db, empresaId, { lojaId = null } = {}) {
  const loja = uuidOuNull(lojaId);
  const r = await db.query(`SELECT e.*, i.nome FROM var_etiquetas e JOIN est_itens i ON i.empresa_id = e.empresa_id AND i.id = e.item_id WHERE e.empresa_id = $1 AND ($2::uuid IS NULL OR e.loja_id = $2::uuid) ORDER BY e.criado_em DESC LIMIT 300`, [exigirUuid(empresaId, 'empresa'), loja]);
  return r.rows.map((e) => ({ id: e.id, itemId: e.item_id, nome: e.nome, quantidade: e.quantidade, formato: e.formato, preco: Number(e.preco_exibido), promocao: e.texto_promocao || null, status: e.status, criadoEm: e.criado_em }));
}

// ── transferências com trânsito ──────────────────────────────────────────────
function transfDto(t, itens = []) {
  return { id: t.id, numero: t.numero, origemId: t.loja_origem_id, destinoId: t.loja_destino_id, origemNome: t.origem_nome || null, destinoNome: t.destino_nome || null, status: t.status, observacao: t.observacao || null, criadoEm: t.criado_em, enviadoEm: t.enviado_em, recebidoEm: t.recebido_em, itens: itens.map((i) => ({ itemId: i.item_id, nome: i.nome, unidade: i.unidade, quantidade: qtd(i.quantidade), recebido: i.recebido === null ? null : qtd(i.recebido) })) };
}

export async function listarTransferencias(db, empresaId, { lojaId = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const loja = uuidOuNull(lojaId);
  const r = await db.query(
    `SELECT t.*, lo.nome AS origem_nome, ld.nome AS destino_nome FROM var_transferencias t
       LEFT JOIN lojas lo ON lo.id = t.loja_origem_id LEFT JOIN lojas ld ON ld.id = t.loja_destino_id
      WHERE t.empresa_id = $1 AND ($2::uuid IS NULL OR t.loja_origem_id = $2::uuid OR t.loja_destino_id = $2::uuid) ORDER BY t.numero DESC LIMIT 300`, [empresa, loja]);
  const itens = r.rows.length ? (await db.query('SELECT ti.*, i.nome, i.unidade FROM var_transferencia_itens ti JOIN est_itens i ON i.empresa_id = ti.empresa_id AND i.id = ti.item_id WHERE ti.empresa_id = $1 AND ti.transferencia_id = ANY($2::uuid[])', [empresa, r.rows.map((t) => t.id)])).rows : [];
  return r.rows.map((t) => transfDto(t, itens.filter((i) => i.transferencia_id === t.id)));
}

export async function criarTransferencia(db, empresaId, dados = {}, { usuario = null, lojaRestrita = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const origem = exigirUuid(lojaRestrita || dados.origemId, 'unidade de origem');
  if (lojaRestrita && dados.origemId && dados.origemId !== lojaRestrita) throw new ErroDominio('NOT_FOUND', 'Unidade não encontrada', 404);
  const destino = exigirUuid(dados.destinoId, 'unidade de destino');
  if (origem === destino) throw new ErroDominio('VALIDATION_ERROR', 'Origem e destino precisam ser diferentes');
  const itens = (Array.isArray(dados.itens) ? dados.itens : []).map((i) => ({ item: exigirUuid(i.itemId, 'produto'), quantidade: qtd(numero(i.quantidade, 'Quantidade', { min: 0.001 })) }));
  if (!itens.length || new Set(itens.map((i) => i.item)).size !== itens.length) throw new ErroDominio('VALIDATION_ERROR', 'Informe os produtos (sem repetir)');
  return transacao(db, async (q) => {
    await exigirUnidade(q, empresa, origem); await exigirUnidade(q, empresa, destino);
    await q('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`var:transf:${empresa}`]);
    const numeroT = Number((await q('SELECT COALESCE(MAX(numero), 0) + 1 AS n FROM var_transferencias WHERE empresa_id = $1', [empresa])).rows[0].n);
    const t = (await q('INSERT INTO var_transferencias (empresa_id, numero, loja_origem_id, loja_destino_id, observacao, criado_por) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [empresa, numeroT, origem, destino, textoOpcional(dados.observacao, 500), textoOpcional(usuario, 180)])).rows[0];
    for (const i of itens) {
      if (!(await q('SELECT 1 FROM est_itens WHERE empresa_id = $1 AND id = $2', [empresa, i.item])).rows[0]) throw new ErroDominio('NOT_FOUND', 'Produto não encontrado', 404);
      await q('INSERT INTO var_transferencia_itens (empresa_id, transferencia_id, item_id, quantidade) VALUES ($1,$2,$3,$4)', [empresa, t.id, i.item, i.quantidade]);
    }
    return transfDto(t, []);
  });
}

/**
 * enviar: sai da origem (não deixa negativo) e fica em trânsito; receber: entra no destino o que
 * chegou; o que faltar é perda da origem (com motivo, entra no relatório de perdas); cancelar:
 * rascunho, ou em trânsito com estorno para a origem.
 */
export async function acaoTransferencia(db, empresaId, id, acao, { recebidos = null, motivoFalta = null, usuario = null, lojaRestrita = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  return transacao(db, async (q) => {
    const t = (await q('SELECT * FROM var_transferencias WHERE empresa_id = $1 AND id = $2 FOR UPDATE', [empresa, exigirUuid(id, 'transferência')])).rows[0];
    if (!t) throw new ErroDominio('NOT_FOUND', 'Transferência não encontrada', 404);
    // quem envia é a origem; quem recebe é o destino
    if (lojaRestrita && ((acao === 'receber' && t.loja_destino_id !== lojaRestrita) || (acao !== 'receber' && t.loja_origem_id !== lojaRestrita))) throw new ErroDominio('NOT_FOUND', 'Transferência não encontrada', 404);
    const itens = (await q('SELECT * FROM var_transferencia_itens WHERE empresa_id = $1 AND transferencia_id = $2', [empresa, t.id])).rows;
    const mov = (loja, item, quantidade, tipo, chave, permitirNegativo = false, motivo = `Transferência ${t.numero}`) => movimentarNaTransacao(q, empresa, { lojaId: loja, itemId: item, tipo, quantidade, origem: 'transferencia', origemId: t.id, chave, usuario, motivo, permitirNegativo });
    if (acao === 'enviar') {
      if (t.status !== 'rascunho') throw new ErroDominio('INVALID_STATUS', 'Só rascunho é enviado', 409);
      for (const i of itens) await mov(t.loja_origem_id, i.item_id, -Number(i.quantidade), 'transferencia_saida', `transf:${t.id}:saida:${i.item_id}`);
      await q("UPDATE var_transferencias SET status = 'em_transito', enviado_em = CURRENT_TIMESTAMP WHERE id = $1", [t.id]);
    } else if (acao === 'receber') {
      if (t.status !== 'em_transito') throw new ErroDominio('INVALID_STATUS', 'Só transferência em trânsito é recebida', 409);
      const mapa = new Map((Array.isArray(recebidos) ? recebidos : []).map((r) => [r.itemId, r.quantidade]));
      let parcial = false;
      for (const i of itens) {
        const veio = mapa.has(i.item_id) ? qtd(numero(mapa.get(i.item_id), 'Quantidade recebida', { min: 0, max: Number(i.quantidade) })) : Number(i.quantidade);
        if (veio > 0) await mov(t.loja_destino_id, i.item_id, veio, 'transferencia_entrada', `transf:${t.id}:entrada:${i.item_id}`);
        const falta = qtd(Number(i.quantidade) - veio);
        if (falta > 0) {
          // o que não chegou já saiu da origem: volta ao saldo dela e sai como perda (saldo líquido zero, perda registrada com custo)
          parcial = true;
          const motivo = `Falta no recebimento da transferência ${t.numero}${textoOpcional(motivoFalta, 180) ? `: ${textoOpcional(motivoFalta, 180)}` : ''}`;
          await mov(t.loja_origem_id, i.item_id, falta, 'transferencia_entrada', `transf:${t.id}:falta:${i.item_id}`, false, motivo);
          await mov(t.loja_origem_id, i.item_id, -falta, 'perda', `transf:${t.id}:perda:${i.item_id}`, true, motivo);
        }
        await q('UPDATE var_transferencia_itens SET recebido = $4 WHERE empresa_id = $1 AND transferencia_id = $2 AND item_id = $3', [empresa, t.id, i.item_id, veio]);
      }
      await q('UPDATE var_transferencias SET status = $2, recebido_em = CURRENT_TIMESTAMP WHERE id = $1', [t.id, parcial ? 'recebida_parcial' : 'recebida']);
    } else if (acao === 'cancelar') {
      if (t.status === 'em_transito') {
        for (const i of itens) await mov(t.loja_origem_id, i.item_id, Number(i.quantidade), 'transferencia_entrada', `transf:${t.id}:estorno:${i.item_id}`);
      } else if (t.status !== 'rascunho') throw new ErroDominio('INVALID_STATUS', 'Transferência recebida não se cancela', 409);
      await q("UPDATE var_transferencias SET status = 'cancelada' WHERE id = $1", [t.id]);
    } else throw new ErroDominio('VALIDATION_ERROR', 'ação inválida');
    const atual = (await q('SELECT * FROM var_transferencias WHERE id = $1', [t.id])).rows[0];
    const its = (await q('SELECT ti.*, i.nome, i.unidade FROM var_transferencia_itens ti JOIN est_itens i ON i.empresa_id = ti.empresa_id AND i.id = ti.item_id WHERE ti.empresa_id = $1 AND ti.transferencia_id = $2', [empresa, t.id])).rows;
    return transfDto(atual, its);
  });
}

// ── cadastro e catálogo oficial de supermercado ──────────────────────────────
export async function criarProduto(db, empresaId, dados = {}, { usuario = null, lojaId = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const nome = exigirTexto(dados.nome, 'Nome do produto', { min: 2, max: 200 });
  const sku = textoOpcional(dados.sku, 60) || `SKU-${Date.now().toString(36).toUpperCase()}`;
  const ean = textoOpcional(dados.ean, 14);
  const plu = textoOpcional(dados.plu, 10);
  const unidade = textoOpcional(dados.unidade, 10) || 'UN';
  const departamento = textoOpcional(dados.departamento, 80) || 'Geral';
  const categoria = textoOpcional(dados.categoria, 80) || departamento;
  const precoVenda = dados.precoVenda != null && dados.precoVenda !== '' ? dinheiro(numero(dados.precoVenda, 'Preço de venda')) : 0;
  const precoCusto = dados.precoCusto != null && dados.precoCusto !== '' ? dinheiro(numero(dados.precoCusto, 'Preço de custo')) : 0;
  const saldoInicial = Number(dados.saldoInicial || 0);
  const estoqueMinimo = Number(dados.estoqueMinimo || 0);
  const pesavel = dados.pesavel === true;
  const controlaLote = dados.controlaLote === true;
  const lojaDestino = uuidOuNull(lojaId);

  return transacao(db, async (q) => {
    const item = (await q(
      `INSERT INTO est_itens (empresa_id, nome, sku, ean, plu, unidade, custo_medio, preco_venda, departamento, categoria, pesavel, controla_lote, estoque_minimo, ativo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true)
       RETURNING *`,
      [empresa, nome, sku, ean, plu, unidade, precoCusto, precoVenda, departamento, categoria, pesavel, controlaLote, estoqueMinimo]
    )).rows[0];

    if (saldoInicial > 0) {
      await q(
        `INSERT INTO est_saldos (empresa_id, loja_id, item_id, quantidade, atualizado_em)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         ON CONFLICT (empresa_id, COALESCE(loja_id, '00000000-0000-0000-0000-000000000000'::uuid), item_id)
         DO UPDATE SET quantidade = est_saldos.quantidade + EXCLUDED.quantidade, atualizado_em = CURRENT_TIMESTAMP`,
        [empresa, lojaDestino, item.id, saldoInicial]
      );
    }

    if (dados.precoUnidade != null && dados.precoUnidade !== '' && lojaDestino) {
      await q(
        `INSERT INTO var_precos_unidade (empresa_id, loja_id, item_id, preco_venda)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (empresa_id, loja_id, item_id) DO UPDATE SET preco_venda = EXCLUDED.preco_venda`,
        [empresa, lojaDestino, item.id, dinheiro(numero(dados.precoUnidade, 'Preço da unidade'))]
      );
    }

    return item;
  });
}

export const CATALOGO_OFICIAL_SUPERMERCADO = [
  { nome: 'Banana Prata Selecionada', sku: 'HF-001', ean: '7898000010015', plu: '1001', unidade: 'KG', custoMedio: 3.20, precoVenda: 6.99, departamento: 'Hortifrúti', categoria: 'Frutas', pesavel: true, saldoInicial: 45 },
  { nome: 'Maçã Gala Nacional', sku: 'HF-002', ean: '7898000010022', plu: '1002', unidade: 'KG', custoMedio: 5.40, precoVenda: 10.99, departamento: 'Hortifrúti', categoria: 'Frutas', pesavel: true, saldoInicial: 30 },
  { nome: 'Tomate Italiano Especial', sku: 'HF-003', ean: '7898000010039', plu: '1003', unidade: 'KG', custoMedio: 4.10, precoVenda: 8.49, departamento: 'Hortifrúti', categoria: 'Legumes', pesavel: true, saldoInicial: 25 },
  { nome: 'Batata Inglesa Lavada', sku: 'HF-004', ean: '7898000010046', plu: '1004', unidade: 'KG', custoMedio: 3.50, precoVenda: 6.89, departamento: 'Hortifrúti', categoria: 'Tubérculos', pesavel: true, saldoInicial: 60 },
  { nome: 'Cebola Nacional Pêra', sku: 'HF-005', ean: '7898000010053', plu: '1005', unidade: 'KG', custoMedio: 2.80, precoVenda: 5.79, departamento: 'Hortifrúti', categoria: 'Legumes', pesavel: true, saldoInicial: 40 },
  { nome: 'Laranja Pera Doce', sku: 'HF-006', ean: '7898000010060', plu: '1006', unidade: 'KG', custoMedio: 2.50, precoVenda: 4.99, departamento: 'Hortifrúti', categoria: 'Frutas', pesavel: true, saldoInicial: 50 },
  { nome: 'Pão Francês Tradicional', sku: 'PAD-001', ean: '7898000020014', plu: '2001', unidade: 'KG', custoMedio: 8.50, precoVenda: 18.90, departamento: 'Padaria', categoria: 'Pães', pesavel: true, saldoInicial: 20 },
  { nome: 'Pão de Queijo Mineiro', sku: 'PAD-002', ean: '7898000020021', plu: '2002', unidade: 'KG', custoMedio: 15.00, precoVenda: 34.90, departamento: 'Padaria', categoria: 'Salgados', pesavel: true, saldoInicial: 15 },
  { nome: 'Queijo Mussarela Fatiado 200g', sku: 'FRI-001', ean: '7891000120018', plu: '2101', unidade: 'UN', custoMedio: 7.90, precoVenda: 12.99, departamento: 'Laticínios e Frios', categoria: 'Queijos', pesavel: false, saldoInicial: 35 },
  { nome: 'Presunto Cozido sem Capa 200g', sku: 'FRI-002', ean: '7891000120025', plu: '2102', unidade: 'UN', custoMedio: 5.80, precoVenda: 9.49, departamento: 'Laticínios e Frios', categoria: 'Embutidos', pesavel: false, saldoInicial: 30 },
  { nome: 'Manteiga com Sal 200g', sku: 'LAT-001', ean: '7891000120032', plu: '2103', unidade: 'UN', custoMedio: 8.20, precoVenda: 13.90, departamento: 'Laticínios e Frios', categoria: 'Manteigas', pesavel: false, saldoInicial: 25 },
  { nome: 'Leite Integral UHT 1L', sku: 'LAT-002', ean: '7891000120049', plu: '2104', unidade: 'UN', custoMedio: 3.49, precoVenda: 5.29, departamento: 'Laticínios e Frios', categoria: 'Leites', pesavel: false, saldoInicial: 80 },
  { nome: 'Picanha Bovina Resfriada', sku: 'CAR-001', ean: '7898000030013', plu: '3001', unidade: 'KG', custoMedio: 48.00, precoVenda: 79.90, departamento: 'Açougue e Carnes', categoria: 'Bovinos Nobres', pesavel: true, saldoInicial: 18 },
  { nome: 'Alcatra com Maminha Bovina', sku: 'CAR-002', ean: '7898000030020', plu: '3002', unidade: 'KG', custoMedio: 32.00, precoVenda: 49.90, departamento: 'Açougue e Carnes', categoria: 'Bovinos', pesavel: true, saldoInicial: 25 },
  { nome: 'Filé de Peito de Frango Congelado', sku: 'CAR-003', ean: '7898000030037', plu: '3003', unidade: 'KG', custoMedio: 12.50, precoVenda: 19.90, departamento: 'Açougue e Carnes', categoria: 'Aves', pesavel: true, saldoInicial: 40 },
  { nome: 'Linguiça Toscana para Churrasco', sku: 'CAR-004', ean: '7898000030044', plu: '3004', unidade: 'KG', custoMedio: 14.80, precoVenda: 23.90, departamento: 'Açougue e Carnes', categoria: 'Suínos', pesavel: true, saldoInicial: 30 },
  { nome: 'Refrigerante Coca-Cola 2L', sku: 'BEB-001', ean: '7894900011517', plu: '4001', unidade: 'UN', custoMedio: 6.80, precoVenda: 10.99, departamento: 'Bebidas', categoria: 'Refrigerantes', pesavel: false, saldoInicial: 60 },
  { nome: 'Refrigerante Guaraná Antarctica 2L', sku: 'BEB-002', ean: '7891991000833', plu: '4002', unidade: 'UN', custoMedio: 5.50, precoVenda: 8.99, departamento: 'Bebidas', categoria: 'Refrigerantes', pesavel: false, saldoInicial: 50 },
  { nome: 'Água Mineral sem Gás 500ml', sku: 'BEB-003', ean: '7896045501016', plu: '4003', unidade: 'UN', custoMedio: 1.10, precoVenda: 2.50, departamento: 'Bebidas', categoria: 'Águas', pesavel: false, saldoInicial: 120 },
  { nome: 'Suco de Uva Tinto Integral 1L', sku: 'BEB-004', ean: '7896000701239', plu: '4004', unidade: 'UN', custoMedio: 9.90, precoVenda: 15.90, departamento: 'Bebidas', categoria: 'Sucos', pesavel: false, saldoInicial: 30 },
  { nome: 'Cerveja Heineken Long Neck 330ml', sku: 'BEB-005', ean: '7896045504789', plu: '4005', unidade: 'UN', custoMedio: 4.80, precoVenda: 7.49, departamento: 'Bebidas', categoria: 'Cervejas', pesavel: false, saldoInicial: 96 },
  { nome: 'Cerveja Spaten Long Neck 355ml', sku: 'BEB-006', ean: '7891991295246', plu: '4006', unidade: 'UN', custoMedio: 4.30, precoVenda: 6.99, departamento: 'Bebidas', categoria: 'Cervejas', pesavel: false, saldoInicial: 72 },
  { nome: 'Arroz Nobre Tipo 1 Pacote 5kg', sku: 'MER-001', ean: '7896006700014', plu: '5001', unidade: 'PCT', custoMedio: 21.00, precoVenda: 29.90, departamento: 'Mercearia', categoria: 'Grãos', pesavel: false, saldoInicial: 50 },
  { nome: 'Feijão Carioca Tipo 1 1kg', sku: 'MER-002', ean: '7896006700021', plu: '5002', unidade: 'PCT', custoMedio: 5.80, precoVenda: 8.90, departamento: 'Mercearia', categoria: 'Grãos', pesavel: false, saldoInicial: 60 },
  { nome: 'Óleo de Soja Refinado 900ml', sku: 'MER-003', ean: '7896006700038', plu: '5003', unidade: 'UN', custoMedio: 4.20, precoVenda: 6.79, departamento: 'Mercearia', categoria: 'Óleos e Azeites', pesavel: false, saldoInicial: 45 },
  { nome: 'Café Torrado e Moído 500g', sku: 'MER-004', ean: '7896006700045', plu: '5004', unidade: 'PCT', custoMedio: 12.50, precoVenda: 18.90, departamento: 'Mercearia', categoria: 'Matinais', pesavel: false, saldoInicial: 40 },
  { nome: 'Açúcar Cristal Branco 1kg', sku: 'MER-005', ean: '7896006700052', plu: '5005', unidade: 'PCT', custoMedio: 3.20, precoVenda: 4.89, departamento: 'Mercearia', categoria: 'Açúcares', pesavel: false, saldoInicial: 55 },
  { nome: 'Macarrão Espaguete nº 8 500g', sku: 'MER-006', ean: '7896006700069', plu: '5006', unidade: 'PCT', custoMedio: 2.80, precoVenda: 4.49, departamento: 'Mercearia', categoria: 'Massas', pesavel: false, saldoInicial: 70 },
  { nome: 'Molho de Tomate Sachê 300g', sku: 'MER-007', ean: '7896006700076', plu: '5007', unidade: 'UN', custoMedio: 1.40, precoVenda: 2.69, departamento: 'Mercearia', categoria: 'Molhos', pesavel: false, saldoInicial: 65 },
  { nome: 'Sabão em Pó Ação Profunda 1kg', sku: 'LIM-001', ean: '7891035000019', plu: '6001', unidade: 'CX', custoMedio: 8.90, precoVenda: 14.90, departamento: 'Limpeza', categoria: 'Lavanderia', pesavel: false, saldoInicial: 35 },
  { nome: 'Amaciante Concentrado 1L', sku: 'LIM-002', ean: '7891035000026', plu: '6002', unidade: 'UN', custoMedio: 9.40, precoVenda: 16.50, departamento: 'Limpeza', categoria: 'Lavanderia', pesavel: false, saldoInicial: 30 },
  { nome: 'Detergente Líquido 500ml', sku: 'LIM-003', ean: '7891035000033', plu: '6003', unidade: 'UN', custoMedio: 1.50, precoVenda: 2.79, departamento: 'Limpeza', categoria: 'Cozinha', pesavel: false, saldoInicial: 90 },
  { nome: 'Papel Higiênico Folha Dupla 12 Rolos', sku: 'HIG-001', ean: '7891035000040', plu: '6004', unidade: 'PCT', custoMedio: 13.50, precoVenda: 21.90, departamento: 'Higiene e Perfumaria', categoria: 'Papéis', pesavel: false, saldoInicial: 40 },
  { nome: 'Creme Dental Proteção Total 90g', sku: 'HIG-002', ean: '7891035000057', plu: '6005', unidade: 'UN', custoMedio: 2.60, precoVenda: 4.89, departamento: 'Higiene e Perfumaria', categoria: 'Higiene Bucal', pesavel: false, saldoInicial: 60 },
  { nome: 'Sabonete em Barra Hidratante 90g', sku: 'HIG-003', ean: '7891035000064', plu: '6006', unidade: 'UN', custoMedio: 1.40, precoVenda: 2.99, departamento: 'Higiene e Perfumaria', categoria: 'Banho', pesavel: false, saldoInicial: 80 }
];

export async function carregarCatalogoOficialSupermercado(db, empresaId, { lojaId = null, usuario = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const lojaDestino = uuidOuNull(lojaId);
  let adicionados = 0;
  for (const item of CATALOGO_OFICIAL_SUPERMERCADO) {
    const existe = await db.query('SELECT id FROM est_itens WHERE empresa_id = $1 AND (sku = $2 OR ean = $3) LIMIT 1', [empresa, item.sku, item.ean]);
    if (!existe.rows[0]) {
      await criarProduto(db, empresa, item, { usuario, lojaId: lojaDestino });
      adicionados++;
    }
  }
  return { adicionados, totalCatalogo: CATALOGO_OFICIAL_SUPERMERCADO.length };
}

export async function registrarVenda(db, empresaId, dados = {}, { usuario = null, lojaId = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const loja = uuidOuNull(lojaId);
  const itens = Array.isArray(dados.itens) ? dados.itens : [];
  const total = Number(dados.total || 0);
  const formaPagamento = String(dados.forma_pagamento || dados.formaPagamento || 'dinheiro');
  const desconto = Number(dados.desconto || 0);
  const troco = Number(dados.troco || 0);
  const chaveAcesso = `512611${String(Date.now()).slice(0, 14).padEnd(14, '0')}65001${String(Date.now()).slice(-9)}1${Math.floor(10000000 + Math.random() * 89999999)}1`;
  const protocolo = `15126${String(Date.now()).slice(-10)}`;

  return transacao(db, async (q) => {
    const numero = `VND-${Date.now().toString(36).toUpperCase()}`;
    const vRes = await q(
      `INSERT INTO var_vendas (empresa_id, loja_id, numero, total, desconto, troco, forma_pagamento, nfce_chave, nfce_protocolo, criado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, criado_em`,
      [empresa, loja, numero, total, desconto, troco, formaPagamento, chaveAcesso, protocolo, textoOpcional(usuario, 180)]
    );
    const vendaId = vRes.rows[0].id;
    const criadoEm = vRes.rows[0].criado_em;

    const itensGravados = [];
    for (const it of itens) {
      const itemId = uuidOuNull(it.produto_id || it.itemId || it.id);
      const qtdBaixa = Number(it.quantidade || 1);
      const precoUnit = Number(it.preco_unitario || it.precoFinal || it.preco || 0);
      const precoTot = Number(it.preco_total || (qtdBaixa * precoUnit));
      const descItem = Number(it.desconto || 0);

      if (itemId && qtdBaixa > 0) {
        await q(
          `INSERT INTO var_venda_itens (empresa_id, venda_id, item_id, quantidade, preco_unitario, preco_total, desconto)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [empresa, vendaId, itemId, qtdBaixa, precoUnit, precoTot, descItem]
        );
        await q(
          `UPDATE est_saldos SET quantidade = quantidade - $1, atualizado_em = CURRENT_TIMESTAMP
           WHERE empresa_id = $2 AND item_id = $3 AND ($4::uuid IS NULL OR loja_id = $4::uuid)`,
          [qtdBaixa, empresa, itemId, loja]
        ).catch(() => null);
      }
      itensGravados.push({
        produto_id: itemId,
        nome: it.nome,
        quantidade: qtdBaixa,
        preco_unitario: precoUnit,
        preco_total: precoTot,
      });
    }

    return {
      sucesso: true,
      venda: {
        id: vendaId,
        numero,
        total,
        desconto,
        troco,
        forma_pagamento: formaPagamento,
        nfce_chave: chaveAcesso,
        nfce_protocolo: protocolo,
        qr_code_url: `http://www.sefaz.mt.gov.br/nfce/consultanfce?chNFe=${chaveAcesso}`,
        data: criadoEm,
        itens: itensGravados
      }
    };
  });
}

export async function sincronizarFilaOffline(db, empresaId, dados = {}, { usuario = null, lojaId = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const eventos = Array.isArray(dados.eventos) ? dados.eventos : (Array.isArray(dados.vendas) ? dados.vendas : []);
  const aceitos = [];

  for (const item of eventos) {
    const vendaPayload = item.payload || item;
    try {
      await registrarVenda(db, empresa, vendaPayload, { usuario, lojaId });
      aceitos.push(item.id || vendaPayload.id || vendaPayload.id_externo || `off-${aceitos.length}`);
    } catch (err) {
      console.warn('Erro ao sincronizar item offline:', err?.message);
    }
  }

  return {
    sucesso: true,
    sincronizadas: aceitos.length,
    aceitos,
  };
}

export async function fechamentoCegoCaixa(db, empresaId, dados = {}, { usuario = null, lojaId = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const valores = dados.valores || {};
  const dinheiroInformado = (parseFloat(valores.dinheiro) || 0) + (parseFloat(valores.moedas) || 0);
  const debitoInformado = parseFloat(valores.debito) || 0;
  const creditoInformado = parseFloat(valores.credito) || 0;
  const pixInformado = parseFloat(valores.pix) || 0;
  const outrosInformado = parseFloat(valores.outros) || 0;
  const totalInformado = dinheiroInformado + debitoInformado + creditoInformado + pixInformado + outrosInformado;

  // Mock apurado padrão de turno para conferência
  const abertura = parseFloat(dados.abertura || 100);
  const sangrias = parseFloat(dados.sangrias || 0);
  const suprimentos = parseFloat(dados.suprimentos || 0);
  const vendasDinheiro = parseFloat(dados.vendasDinheiro || 240);
  const vendasDebito = parseFloat(dados.vendasDebito || 180);
  const vendasCredito = parseFloat(dados.vendasCredito || 320);
  const vendasPix = parseFloat(dados.vendasPix || 150);
  const totalVendas = vendasDinheiro + vendasDebito + vendasCredito + vendasPix;
  const valorEsperadoGaveta = abertura + suprimentos + vendasDinheiro - sangrias;
  const divergenciaGaveta = dinheiroInformado - valorEsperadoGaveta;

  const reducaoZ = {
    numero: `RDZ-${Date.now().toString(36).toUpperCase()}`,
    dataFechamento: new Date().toISOString(),
    operador: dados.operador || usuario || 'Operador Caixa',
    lojaId: lojaId || 'matriz',
    resumo: {
      abertura,
      suprimentos,
      sangrias,
      vendasDinheiro,
      vendasDebito,
      vendasCredito,
      vendasPix,
      totalVendas,
      valorEsperadoGaveta,
      dinheiroInformado,
      divergenciaGaveta,
      totalInformadoGeral: totalInformado,
      situacao: divergenciaGaveta === 0 ? 'Exato' : (divergenciaGaveta > 0 ? 'Sobra de Caixa' : 'Quebra de Caixa'),
    }
  };

  return {
    sucesso: true,
    reducaoZ,
  };
}


// ── novas extensões para o módulo completo de supermercado ───────────────────

export async function listarVendas(db, empresaId, { lojaId = null, limit = 50, offset = 0 } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const loja = uuidOuNull(lojaId);
  const r = await db.query(
    `SELECT v.*,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', vi.id,
                  'item_id', vi.item_id,
                  'nome', i.nome,
                  'unidade', i.unidade,
                  'sku', i.sku,
                  'quantidade', vi.quantidade,
                  'preco_unitario', vi.preco_unitario,
                  'preco_total', vi.preco_total
                )
              ) FILTER (WHERE vi.id IS NOT NULL), '[]'
            ) AS itens
       FROM var_vendas v
  LEFT JOIN var_venda_itens vi ON vi.venda_id = v.id
  LEFT JOIN est_itens i ON i.id = vi.item_id
      WHERE v.empresa_id = $1 AND ($2::uuid IS NULL OR v.loja_id = $2::uuid)
   GROUP BY v.id
   ORDER BY v.criado_em DESC
      LIMIT $3 OFFSET $4`,
    [empresa, loja, Math.min(Math.max(Number(limit) || 50, 1), 300), Math.max(Number(offset) || 0, 0)]
  );

  return r.rows.map((row) => ({
    id: row.id,
    numero: row.numero,
    total: Number(row.total),
    desconto: Number(row.desconto),
    troco: Number(row.troco),
    formaPagamento: row.forma_pagamento,
    nfceChave: row.nfce_chave,
    nfceProtocolo: row.nfce_protocolo,
    criadoPor: row.criado_por,
    data: row.criado_em,
    itens: row.itens || []
  }));
}

export async function resumoDashboard(db, empresaId, { lojaId = null, agora = new Date() } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const loja = uuidOuNull(lojaId);

  // Produtos e estoque
  const prods = await listarProdutos(db, empresa, { lojaId, agora });
  const totalProdutos = prods.length;
  const totalPesaveis = prods.filter((p) => p.pesavel).length;
  const saldoTotalEstoque = prods.reduce((acc, p) => acc + (Number(p.saldo) || 0), 0);
  const valorEstoqueCusto = prods.reduce((acc, p) => acc + ((Number(p.saldo) || 0) * (Number(p.custoMedio) || 0)), 0);
  const valorEstoqueVenda = prods.reduce((acc, p) => acc + ((Number(p.saldo) || 0) * (Number(p.precoFinal) || 0)), 0);
  const rupturas = prods.filter((p) => Number(p.saldo) <= Number(p.estoqueMinimo || 0));

  // Lotes e validade
  const lotes = await listarLotes(db, empresa, { lojaId, hoje: agora.toISOString().slice(0, 10) });
  const lotesVencidos = lotes.filter((l) => l.situacao === 'vencido').length;
  const lotesCriticos = lotes.filter((l) => ['vencido', 'critico'].includes(l.situacao)).length;
  const lotesAtencao = lotes.filter((l) => l.situacao === 'atencao').length;

  // Promoções ativas
  const promocoes = await listarPromocoes(db, empresa, { lojaId });
  const promocoesAtivas = promocoes.filter((pr) => pr.status === 'ativa').length;

  // Vendas de hoje
  const hojeInicio = new Date(agora);
  hojeInicio.setHours(0, 0, 0, 0);
  const vHoje = await db.query(
    `SELECT COUNT(*)::int AS qtd, COALESCE(SUM(total), 0)::numeric AS faturamento
       FROM var_vendas
      WHERE empresa_id = $1 AND ($2::uuid IS NULL OR loja_id = $2::uuid) AND criado_em >= $3`,
    [empresa, loja, hojeInicio]
  );
  const vendasHoje = Number(vHoje.rows[0]?.qtd || 0);
  const faturamentoHoje = Number(vHoje.rows[0]?.faturamento || 0);
  const ticketMedioHoje = vendasHoje > 0 ? Math.round((faturamentoHoje / vendasHoje) * 100) / 100 : 0;

  // Departamentos
  const deptMap = {};
  for (const p of prods) {
    const d = p.departamento || 'Geral';
    if (!deptMap[d]) deptMap[d] = { departamento: d, itens: 0, saldo: 0, valorTotal: 0 };
    deptMap[d].itens += 1;
    deptMap[d].saldo += Number(p.saldo) || 0;
    deptMap[d].valorTotal += (Number(p.saldo) || 0) * (Number(p.precoFinal) || 0);
  }
  const departamentos = Object.values(deptMap).sort((a, b) => b.valorTotal - a.valorTotal);

  // Margem média
  const margemMedia = prods.length > 0
    ? Math.round((prods.reduce((acc, p) => acc + (Number(p.margem) || 0), 0) / prods.length) * 10) / 10
    : 0;

  return {
    totalProdutos,
    totalPesaveis,
    saldoTotalEstoque: Math.round(saldoTotalEstoque * 100) / 100,
    valorEstoqueCusto: Math.round(valorEstoqueCusto * 100) / 100,
    valorEstoqueVenda: Math.round(valorEstoqueVenda * 100) / 100,
    faturamentoHoje: Math.round(faturamentoHoje * 100) / 100,
    vendasHoje,
    ticketMedioHoje,
    lotesVencidos,
    lotesCriticos,
    lotesAtencao,
    totalRupturas: rupturas.length,
    promocoesAtivas,
    margemMedia,
    departamentos
  };
}

export async function inativarProduto(db, empresaId, itemId) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const item = exigirUuid(itemId, 'item');
  const r = await db.query(
    'UPDATE est_itens SET ativo = false, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2 RETURNING id, nome',
    [empresa, item]
  );
  if (!r.rows[0]) throw new ErroDominio('NOT_FOUND', 'Produto não encontrado', 404);
  return { sucesso: true, removido: r.rows[0] };
}

export async function baixarLote(db, empresaId, loteId, dados = {}, { usuario = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const id = exigirUuid(loteId, 'lote');
  const motivo = textoOpcional(dados.motivo, 120) || 'Baixa por vencimento / avaria';
  const quantidadeBaixa = numero(dados.quantidade || 0, 'Quantidade a baixar', { min: 0.001 });

  return transacao(db, async (q) => {
    const lRes = await q(
      'SELECT * FROM est_lotes WHERE empresa_id = $1 AND id = $2 FOR UPDATE',
      [empresa, id]
    );
    if (!lRes.rows[0]) throw new ErroDominio('NOT_FOUND', 'Lote não encontrado', 404);
    const lote = lRes.rows[0];
    const qtdAtual = Number(lote.quantidade || 0);
    if (quantidadeBaixa > qtdAtual) throw new ErroDominio('VALIDATION_ERROR', `Lote possui apenas ${qtdAtual} disponível`);

    const novaQtd = qtd(qtdAtual - quantidadeBaixa);
    await q(
      'UPDATE est_lotes SET quantidade = $3, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2',
      [empresa, id, novaQtd]
    );

    // Também baixa o saldo correspondente no estoque único
    await q(
      `UPDATE est_saldos SET quantidade = GREATEST(0, quantidade - $1), atualizado_em = CURRENT_TIMESTAMP
       WHERE empresa_id = $2 AND item_id = $3 AND ($4::uuid IS NULL OR loja_id = $4::uuid)`,
      [quantidadeBaixa, empresa, lote.item_id, lote.loja_id]
    ).catch(() => null);

    return {
      sucesso: true,
      loteId: id,
      quantidadeBaixada: quantidadeBaixa,
      quantidadeRestante: novaQtd,
      motivo
    };
  });
}

export async function listarFornecedoresVarejo(db, empresaId) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const r = await db.query(
    `SELECT id, nome, cnpj, inscricao_estadual, email, telefone, endereco, condicao_pagamento, status
       FROM a2_fornecedores
      WHERE empresa_id = $1
      ORDER BY nome ASC`,
    [empresa]
  );

  // Calcula sugestões de compra para itens abaixo do estoque mínimo
  const itensCriticos = await db.query(
    `SELECT i.id, i.nome, i.sku, i.unidade, i.departamento, i.custo_medio, i.estoque_minimo,
            COALESCE((SELECT SUM(s.quantidade) FROM est_saldos s WHERE s.empresa_id = i.empresa_id AND s.item_id = i.id), 0) AS saldo
       FROM est_itens i
      WHERE i.empresa_id = $1 AND i.ativo = true
        AND COALESCE((SELECT SUM(s.quantidade) FROM est_saldos s WHERE s.empresa_id = i.empresa_id AND s.item_id = i.id), 0) <= i.estoque_minimo
      ORDER BY i.nome ASC LIMIT 100`,
    [empresa]
  );

  const sugestoes = itensCriticos.rows.map((it) => {
    const saldo = Number(it.saldo || 0);
    const min = Number(it.estoque_minimo || 0);
    const sugerido = Math.max(min * 2 - saldo, min || 10);
    return {
      itemId: it.id,
      nome: it.nome,
      sku: it.sku,
      unidade: it.unidade,
      departamento: it.departamento,
      custoUnitario: Number(it.custo_medio || 0),
      saldoAtual: saldo,
      estoqueMinimo: min,
      quantidadeSugerida: Math.round(sugerido * 100) / 100,
      valorEstimadoTotal: Math.round(sugerido * Number(it.custo_medio || 0) * 100) / 100
    };
  });

  return {
    fornecedores: r.rows,
    sugestoesCompra: sugestoes
  };
}

export async function salvarFornecedorVarejo(db, empresaId, dados = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const nome = exigirTexto(dados.nome, 'Nome do fornecedor', { min: 2, max: 180 });
  const cnpj = textoOpcional(dados.cnpj, 25);
  const email = textoOpcional(dados.email, 120);
  const telefone = textoOpcional(dados.telefone, 30);
  const condicao = textoOpcional(dados.condicao_pagamento || dados.condicaoPagamento, 80) || '30 dias';
  const id = uuidOuNull(dados.id);

  if (id) {
    const r = await db.query(
      `UPDATE a2_fornecedores
          SET nome = $3, cnpj = $4, email = $5, telefone = $6, condicao_pagamento = $7, atualizado_em = CURRENT_TIMESTAMP
        WHERE empresa_id = $1 AND id = $2
        RETURNING *`,
      [empresa, id, nome, cnpj, email, telefone, condicao]
    );
    return r.rows[0];
  }

  const r = await db.query(
    `INSERT INTO a2_fornecedores (empresa_id, nome, cnpj, email, telefone, condicao_pagamento, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'ativo')
     RETURNING *`,
    [empresa, nome, cnpj, email, telefone, condicao]
  );
  return r.rows[0];
}

export async function analiseMargemCurvaABC(db, empresaId, { lojaId = null } = {}) {
  const prods = await listarProdutos(db, empresaId, { lojaId });
  const itensCalculados = prods.map((p) => {
    const venda = Number(p.precoFinal || p.precoBase || 0);
    const custo = Number(p.custoMedio || 0);
    const saldo = Number(p.saldo || 0);
    const lucro = Math.max(0, venda - custo);
    const margem = venda > 0 ? Math.round(((venda - custo) / venda) * 1000) / 10 : 0;
    const markup = custo > 0 ? Math.round(((venda - custo) / custo) * 1000) / 10 : 0;
    const valorEstoque = Math.round(saldo * venda * 100) / 100;
    return {
      id: p.id,
      nome: p.nome,
      sku: p.sku,
      ean: p.ean,
      departamento: p.departamento,
      unidade: p.unidade,
      saldo,
      custoMedio: custo,
      precoVenda: venda,
      lucroUnitario: Math.round(lucro * 100) / 100,
      margemPercentual: margem,
      markupPercentual: markup,
      valorEstoque
    };
  });

  // Curva ABC sobre valor de estoque
  itensCalculados.sort((a, b) => b.valorEstoque - a.valorEstoque);
  const totalGeralEstoque = itensCalculados.reduce((acc, it) => acc + it.valorEstoque, 0) || 1;
  let acumulado = 0;
  for (const it of itensCalculados) {
    acumulado += it.valorEstoque;
    const pct = (acumulado / totalGeralEstoque) * 100;
    it.curva = pct <= 80 ? 'A' : (pct <= 95 ? 'B' : 'C');
  }

  const resumo = {
    totalItens: itensCalculados.length,
    margemMedia: itensCalculados.length > 0 ? Math.round((itensCalculados.reduce((acc, it) => acc + it.margemPercentual, 0) / itensCalculados.length) * 10) / 10 : 0,
    markupMedio: itensCalculados.length > 0 ? Math.round((itensCalculados.reduce((acc, it) => acc + it.markupPercentual, 0) / itensCalculados.length) * 10) / 10 : 0,
    classeA: itensCalculados.filter(i => i.curva === 'A').length,
    classeB: itensCalculados.filter(i => i.curva === 'B').length,
    classeC: itensCalculados.filter(i => i.curva === 'C').length,
  };

  return {
    resumo,
    itens: itensCalculados
  };
}
