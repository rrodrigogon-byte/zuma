// Varejo/supermercado sobre o estoque único (migração 096), por unidade:
// preço de venda (base no item e por unidade), promoções com período, preço final vigente,
// lotes e validade, etiquetas de gôndola e transferências entre unidades com trânsito.
import { ErroDominio, exigirTexto, exigirUuid, transacao } from '../acesso/banco.js';
import { movimentarNaTransacao, exigirUnidade } from '../suprimentos/estoque.js';

const textoOpcional = (v, max) => { const t = String(v ?? '').trim(); return t ? t.slice(0, max) : null; };
const dinheiro = (v) => Math.round(Number(v || 0) * 100) / 100;
const qtd = (v) => Math.round(Number(v || 0) * 1000) / 1000;
const numero = (v, campo, { min = 0, max = 1e9, inteiro = false } = {}) => {
  const n = Number(typeof v === 'string' ? v.replace(',', '.') : v);
  if (!Number.isFinite(n) || n < min || n > max || (inteiro && !Number.isInteger(n))) throw new ErroDominio('VALIDATION_ERROR', `${campo} inválido`);
  return n;
};
const SEM = '00000000-0000-0000-0000-000000000000';

/** Promoção ativa agora para o item na unidade (a mais vantajosa para o cliente). */
function aplicarPromocoes(precoBase, promocoes) {
  let melhor = null;
  for (const p of promocoes) {
    let preco = precoBase; let texto = '';
    if (p.tipo === 'percentual') { preco = dinheiro(precoBase * (1 - Number(p.percentual) / 100)); texto = `${Number(p.percentual)}% OFF`; }
    else if (p.tipo === 'valor_fixo') { preco = dinheiro(Math.max(0, precoBase - Number(p.valor_desconto))); texto = `R$ ${Number(p.valor_desconto).toFixed(2).replace('.', ',')} de desconto`; }
    else if (p.tipo === 'preco_fixo') { preco = dinheiro(p.preco_fixo); texto = 'Preço promocional'; }
    else if (p.tipo === 'leve_pague') { texto = `Leve ${p.leve}, pague ${p.pague}`; preco = precoBase; }
    const efetivo = p.tipo === 'leve_pague' ? dinheiro((precoBase * p.pague) / p.leve) : preco;
    if (!melhor || efetivo < melhor.efetivo) melhor = { id: p.id, nome: p.nome, tipo: p.tipo, preco, efetivo, texto };
  }
  return melhor;
}

// ── produtos e preços ────────────────────────────────────────────────────────
export async function listarProdutos(db, empresaId, { lojaId = null, q = '', agora = new Date() } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const v = [empresa, lojaId];
  let filtro = '';
  if (q) { v.push(`%${String(q).slice(0, 80).replace(/[%_\\]/g, (c) => `\\${c}`)}%`); filtro = ` AND (i.nome ILIKE $${v.length} OR i.sku ILIKE $${v.length} OR i.ean ILIKE $${v.length} OR i.plu ILIKE $${v.length})`; }
  const r = await db.query(
    `SELECT i.*, pu.preco_venda AS preco_unidade,
            COALESCE((SELECT SUM(s.quantidade) FROM est_saldos s WHERE s.empresa_id = i.empresa_id AND s.item_id = i.id AND ($2::uuid IS NULL OR s.loja_id = $2::uuid)), 0) AS saldo
       FROM est_itens i LEFT JOIN var_precos_unidade pu ON pu.empresa_id = i.empresa_id AND pu.item_id = i.id AND pu.loja_id = $2::uuid
      WHERE i.empresa_id = $1 AND i.ativo = true${filtro} ORDER BY lower(i.nome) LIMIT 2000`, v);
  const promos = await promocoesVigentes(db, empresa, { lojaId, agora });
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

export async function buscarPorCodigo(db, empresaId, codigo, opcoes = {}) {
  const c = String(codigo || '').trim();
  if (!c) throw new ErroDominio('VALIDATION_ERROR', 'Informe o código');
  const r = await db.query('SELECT id FROM est_itens WHERE empresa_id = $1 AND ativo = true AND (ean = $2 OR sku = $2 OR plu = $2) LIMIT 1', [exigirUuid(empresaId, 'empresa'), c]);
  if (!r.rows[0]) throw new ErroDominio('NOT_FOUND', 'Produto não encontrado para este código', 404);
  return (await listarProdutos(db, empresaId, opcoes)).find((p) => p.id === r.rows[0].id);
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
  const r = await db.query(
    `SELECT p.*, COALESCE(array_agg(pi.item_id) FILTER (WHERE pi.item_id IS NOT NULL), '{}') AS itens FROM var_promocoes p LEFT JOIN var_promocao_itens pi ON pi.empresa_id = p.empresa_id AND pi.promocao_id = p.id
      WHERE p.empresa_id = $1 AND p.status = 'ativa' AND p.inicio <= $3 AND p.fim > $3 AND (p.loja_id IS NULL OR p.loja_id = $2::uuid) GROUP BY p.id`, [empresa, lojaId, agora]);
  return r.rows.map((p) => ({ ...p, leve: p.leve, pague: p.pague, itens: p.itens.map(String) }));
}

function promoDto(p) {
  return { id: p.id, lojaId: p.loja_id || null, nome: p.nome, tipo: p.tipo, status: p.status, percentual: p.percentual === null ? null : Number(p.percentual), valorDesconto: p.valor_desconto === null ? null : Number(p.valor_desconto), precoFixo: p.preco_fixo === null ? null : Number(p.preco_fixo), leve: p.leve, pague: p.pague, inicio: p.inicio, fim: p.fim, itens: (p.itens || []).map(String) };
}

export async function listarPromocoes(db, empresaId, { lojaId = null } = {}) {
  const r = await db.query(
    `SELECT p.*, COALESCE(array_agg(pi.item_id) FILTER (WHERE pi.item_id IS NOT NULL), '{}') AS itens FROM var_promocoes p LEFT JOIN var_promocao_itens pi ON pi.empresa_id = p.empresa_id AND pi.promocao_id = p.id
      WHERE p.empresa_id = $1 AND ($2::uuid IS NULL OR p.loja_id IS NULL OR p.loja_id = $2::uuid) GROUP BY p.id ORDER BY p.inicio DESC LIMIT 300`, [exigirUuid(empresaId, 'empresa'), lojaId]);
  return r.rows.map(promoDto);
}

export async function criarPromocao(db, empresaId, dados = {}, { usuario = null, lojaId = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const tipo = String(dados.tipo || '');
  if (!['percentual', 'valor_fixo', 'preco_fixo', 'leve_pague'].includes(tipo)) throw new ErroDominio('VALIDATION_ERROR', 'Tipo de promoção inválido');
  const inicio = new Date(dados.inicio); const fim = new Date(dados.fim);
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
export async function listarLotes(db, empresaId, { lojaId = null, hoje } = {}) {
  const r = await db.query(
    `SELECT l.*, i.nome AS item_nome, i.unidade, i.sku FROM est_lotes l JOIN est_itens i ON i.empresa_id = l.empresa_id AND i.id = l.item_id
      WHERE l.empresa_id = $1 AND l.quantidade > 0 AND ($2::uuid IS NULL OR l.loja_id = $2::uuid) ORDER BY l.validade NULLS LAST, i.nome LIMIT 1000`, [exigirUuid(empresaId, 'empresa'), lojaId]);
  const base = hoje || new Date().toISOString().slice(0, 10);
  return r.rows.map((l) => {
    const validade = l.validade ? (l.validade instanceof Date ? l.validade.toISOString().slice(0, 10) : String(l.validade).slice(0, 10)) : null;
    const dias = validade ? Math.round((new Date(`${validade}T12:00:00Z`) - new Date(`${base}T12:00:00Z`)) / 864e5) : null;
    const situacao = dias === null ? 'sem_validade' : dias < 0 ? 'vencido' : dias <= 7 ? 'critico' : dias <= 30 ? 'atencao' : 'normal';
    return { id: l.id, lojaId: l.loja_id || null, itemId: l.item_id, itemNome: l.item_nome, unidade: l.unidade, sku: l.sku || null, lote: l.lote, validade, quantidade: qtd(l.quantidade), diasParaVencer: dias, situacao };
  });
}

/** Registra entrada de lote (soma) ou baixa (quantidade negativa). Não mexe no saldo do estoque. */
export async function registrarLote(db, empresaId, dados = {}, { lojaId = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const item = exigirUuid(dados.itemId, 'produto');
  const lote = exigirTexto(dados.lote, 'Lote', { min: 1, max: 60 });
  const validade = dados.validade ? String(dados.validade).slice(0, 10) : null;
  if (validade && !/^\d{4}-\d{2}-\d{2}$/.test(validade)) throw new ErroDominio('VALIDATION_ERROR', 'Validade inválida');
  const delta = numero(dados.quantidade, 'Quantidade', { min: -1e9 });
  if (!delta) throw new ErroDominio('VALIDATION_ERROR', 'Quantidade não pode ser zero');
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
  const r = await db.query(`SELECT e.*, i.nome FROM var_etiquetas e JOIN est_itens i ON i.empresa_id = e.empresa_id AND i.id = e.item_id WHERE e.empresa_id = $1 AND ($2::uuid IS NULL OR e.loja_id = $2::uuid) ORDER BY e.criado_em DESC LIMIT 300`, [exigirUuid(empresaId, 'empresa'), lojaId]);
  return r.rows.map((e) => ({ id: e.id, itemId: e.item_id, nome: e.nome, quantidade: e.quantidade, formato: e.formato, preco: Number(e.preco_exibido), promocao: e.texto_promocao || null, status: e.status, criadoEm: e.criado_em }));
}

// ── transferências com trânsito ──────────────────────────────────────────────
function transfDto(t, itens = []) {
  return { id: t.id, numero: t.numero, origemId: t.loja_origem_id, destinoId: t.loja_destino_id, origemNome: t.origem_nome || null, destinoNome: t.destino_nome || null, status: t.status, observacao: t.observacao || null, criadoEm: t.criado_em, enviadoEm: t.enviado_em, recebidoEm: t.recebido_em, itens: itens.map((i) => ({ itemId: i.item_id, nome: i.nome, unidade: i.unidade, quantidade: qtd(i.quantidade), recebido: i.recebido === null ? null : qtd(i.recebido) })) };
}

export async function listarTransferencias(db, empresaId, { lojaId = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const r = await db.query(
    `SELECT t.*, lo.nome AS origem_nome, ld.nome AS destino_nome FROM var_transferencias t
       LEFT JOIN lojas lo ON lo.id = t.loja_origem_id LEFT JOIN lojas ld ON ld.id = t.loja_destino_id
      WHERE t.empresa_id = $1 AND ($2::uuid IS NULL OR t.loja_origem_id = $2::uuid OR t.loja_destino_id = $2::uuid) ORDER BY t.numero DESC LIMIT 300`, [empresa, lojaId]);
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
 * chegou (o que faltar volta para a origem como devolução); cancelar: rascunho, ou em trânsito
 * com estorno para a origem.
 */
export async function acaoTransferencia(db, empresaId, id, acao, { recebidos = null, usuario = null, lojaRestrita = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  return transacao(db, async (q) => {
    const t = (await q('SELECT * FROM var_transferencias WHERE empresa_id = $1 AND id = $2 FOR UPDATE', [empresa, exigirUuid(id, 'transferência')])).rows[0];
    if (!t) throw new ErroDominio('NOT_FOUND', 'Transferência não encontrada', 404);
    // quem envia é a origem; quem recebe é o destino
    if (lojaRestrita && ((acao === 'receber' && t.loja_destino_id !== lojaRestrita) || (acao !== 'receber' && t.loja_origem_id !== lojaRestrita))) throw new ErroDominio('NOT_FOUND', 'Transferência não encontrada', 404);
    const itens = (await q('SELECT * FROM var_transferencia_itens WHERE empresa_id = $1 AND transferencia_id = $2', [empresa, t.id])).rows;
    const mov = (loja, item, quantidade, tipo, chave, permitirNegativo = false) => movimentarNaTransacao(q, empresa, { lojaId: loja, itemId: item, tipo, quantidade, origem: 'transferencia', origemId: t.id, chave, usuario, motivo: `Transferência ${t.numero}`, permitirNegativo });
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
        if (falta > 0) { parcial = true; await mov(t.loja_origem_id, i.item_id, falta, 'transferencia_entrada', `transf:${t.id}:devolucao:${i.item_id}`); }
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
