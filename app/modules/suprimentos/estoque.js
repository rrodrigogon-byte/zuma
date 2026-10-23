// Estoque por empresa e unidade (migração 091).
//
// - itens: mercadorias e insumos que a empresa compra e controla;
// - saldo por unidade (loja_id NULL = sem unidade definida);
// - custo médio ponderado do item, recalculado a cada entrada com custo;
// - todo movimento tem chave única por empresa (repetir não duplica) e trava o saldo (FOR UPDATE);
// - ficha técnica = vínculo de um produto vendido (bar, loja online) com os itens que ele consome.
import { ErroDominio, exigirTexto, exigirUuid, transacao } from '../acesso/banco.js';

export const UNIDADES = ['UN', 'KG', 'G', 'L', 'ML', 'CX', 'PCT', 'FD', 'DZ', 'M'];
const TIPOS_ITEM = ['mercadoria', 'insumo', 'embalagem', 'uso_consumo'];
const SEM_LOJA = '00000000-0000-0000-0000-000000000000';

const qtd = (v) => Math.round(Number(v || 0) * 1000) / 1000;
const custo4 = (v) => Math.round(Number(v || 0) * 10000) / 10000;

function numeroPositivo(valor, campo, { zeroOk = false, max = 1e9 } = {}) {
  const n = Number(typeof valor === 'string' ? valor.replace(',', '.') : valor);
  if (!Number.isFinite(n) || n < 0 || (!zeroOk && n === 0) || n > max) throw new ErroDominio('VALIDATION_ERROR', `${campo} inválido`);
  return n;
}
/** A unidade precisa ser desta empresa (nada de loja de outra empresa ou inexistente). */
export async function exigirUnidade(q, empresa, loja) {
  if (!loja) return null;
  const r = await q('SELECT 1 FROM lojas WHERE empresa_id = $1 AND id = $2', [empresa, loja]);
  if (!r.rows[0]) throw new ErroDominio('NOT_FOUND', 'Unidade não encontrada nesta empresa', 404);
  return loja;
}
function uuidOpcional(v, campo) { return v === undefined || v === null || v === '' ? null : exigirUuid(v, campo); }
function textoOpcional(v, max) { const t = String(v ?? '').trim(); return t ? t.slice(0, max) : null; }

export function itemDto(row) {
  return {
    id: row.id, sku: row.sku || null, ean: row.ean || null, nome: row.nome, unidade: row.unidade, tipo: row.tipo,
    categoria: row.categoria || null, ncm: row.ncm || null, custoMedio: Number(row.custo_medio), estoqueMinimo: Number(row.estoque_minimo),
    ativo: row.ativo !== false, saldo: row.saldo === undefined ? undefined : Number(row.saldo || 0),
  };
}

function limparItem(e = {}, { criando = false } = {}) {
  const d = {};
  if (criando || e.nome !== undefined) d.nome = exigirTexto(e.nome, 'Nome', { min: 2, max: 180 });
  if (e.sku !== undefined) { const s = textoOpcional(e.sku, 60); if (s && !/^[A-Za-z0-9._/-]+$/.test(s)) throw new ErroDominio('VALIDATION_ERROR', 'SKU aceita letras, números, ponto, barra, hífen e sublinhado'); d.sku = s; }
  if (e.ean !== undefined) { const s = String(e.ean ?? '').replace(/\D/g, ''); if (s && ![8, 12, 13, 14].includes(s.length)) throw new ErroDominio('VALIDATION_ERROR', 'EAN deve ter 8, 12, 13 ou 14 dígitos'); d.ean = s || null; }
  if (criando || e.unidade !== undefined) { const u = String(e.unidade || 'UN').trim().toUpperCase(); if (!UNIDADES.includes(u)) throw new ErroDominio('VALIDATION_ERROR', `Unidade deve ser uma de: ${UNIDADES.join(', ')}`); d.unidade = u; }
  if (criando || e.tipo !== undefined) { const t = String(e.tipo || 'mercadoria').trim().toLowerCase(); if (!TIPOS_ITEM.includes(t)) throw new ErroDominio('VALIDATION_ERROR', 'Tipo de item inválido'); d.tipo = t; }
  if (e.categoria !== undefined) d.categoria = textoOpcional(e.categoria, 80);
  if (e.ncm !== undefined) { const n = String(e.ncm ?? '').replace(/\D/g, ''); if (n && n.length !== 8) throw new ErroDominio('VALIDATION_ERROR', 'NCM deve ter 8 dígitos'); d.ncm = n || null; }
  if (e.estoqueMinimo !== undefined) d.estoque_minimo = qtd(numeroPositivo(e.estoqueMinimo, 'Estoque mínimo', { zeroOk: true }));
  if (criando && e.custoMedio !== undefined) d.custo_medio = custo4(numeroPositivo(e.custoMedio, 'Custo', { zeroOk: true }));
  if (e.ativo !== undefined) d.ativo = e.ativo === true;
  return d;
}

export async function criarItem(db, empresaId, entrada = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const d = limparItem(entrada, { criando: true });
  const campos = Object.keys(d);
  try {
    const r = await db.query(`INSERT INTO est_itens (empresa_id, ${campos.join(', ')}) VALUES ($1, ${campos.map((_, i) => `$${i + 2}`).join(', ')}) RETURNING *`, [empresa, ...campos.map((c) => d[c])]);
    return itemDto(r.rows[0]);
  } catch (error) {
    if (error?.code === '23505') throw new ErroDominio('CONFLICT', 'Já existe um item com este SKU', 409);
    throw error;
  }
}

export async function atualizarItem(db, empresaId, id, entrada = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const d = limparItem(entrada);
  const campos = Object.keys(d);
  if (!campos.length) return obterItem(db, empresa, id);
  try {
    const r = await db.query(`UPDATE est_itens SET ${campos.map((c, i) => `${c} = $${i + 3}`).join(', ')}, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2 RETURNING *`, [empresa, exigirUuid(id, 'item'), ...campos.map((c) => d[c])]);
    if (!r.rows[0]) throw new ErroDominio('NOT_FOUND', 'Item não encontrado', 404);
    return itemDto(r.rows[0]);
  } catch (error) {
    if (error?.code === '23505') throw new ErroDominio('CONFLICT', 'Já existe um item com este SKU', 409);
    throw error;
  }
}

export async function obterItem(db, empresaId, id) {
  const r = await db.query('SELECT * FROM est_itens WHERE empresa_id = $1 AND id = $2', [exigirUuid(empresaId, 'empresa'), exigirUuid(id, 'item')]);
  if (!r.rows[0]) throw new ErroDominio('NOT_FOUND', 'Item não encontrado', 404);
  return itemDto(r.rows[0]);
}

/** Itens com o saldo da unidade pedida (ou da empresa toda) e o alerta de mínimo. */
export async function listarItens(db, empresaId, { lojaId = null, q = '', abaixoDoMinimo = false, incluirInativos = false } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const v = [empresa];
  let saldoSql = 'SELECT item_id, SUM(quantidade) AS saldo FROM est_saldos WHERE empresa_id = $1';
  if (lojaId === 'sem') saldoSql += ' AND loja_id IS NULL';
  else if (lojaId && lojaId !== 'todas') { v.push(exigirUuid(lojaId, 'unidade')); saldoSql += ` AND loja_id = $${v.length}`; }
  saldoSql += ' GROUP BY item_id';
  let sql = `SELECT i.*, COALESCE(s.saldo, 0) AS saldo FROM est_itens i LEFT JOIN (${saldoSql}) s ON s.item_id = i.id WHERE i.empresa_id = $1`;
  if (!incluirInativos) sql += ' AND i.ativo = true';
  if (q) { v.push(`%${String(q).slice(0, 80).replace(/[%_\\]/g, (c) => `\\${c}`)}%`); sql += ` AND (i.nome ILIKE $${v.length} OR i.sku ILIKE $${v.length} OR i.ean ILIKE $${v.length})`; }
  if (abaixoDoMinimo) sql += ' AND i.estoque_minimo > 0 AND COALESCE(s.saldo, 0) < i.estoque_minimo';
  sql += ' ORDER BY lower(i.nome) LIMIT 2000';
  const r = await db.query(sql, v);
  return r.rows.map((row) => ({ ...itemDto(row), abaixoDoMinimo: Number(row.estoque_minimo) > 0 && Number(row.saldo) < Number(row.estoque_minimo), valorEmEstoque: Math.round(Number(row.saldo) * Number(row.custo_medio) * 100) / 100 }));
}

async function travarSaldo(q, empresa, loja, item) {
  await q(
    `INSERT INTO est_saldos (empresa_id, loja_id, item_id, quantidade) VALUES ($1, $2, $3, 0)
     ON CONFLICT (empresa_id, COALESCE(loja_id, '${SEM_LOJA}'::uuid), item_id) DO NOTHING`,
    [empresa, loja, item],
  );
  const r = await q(`SELECT quantidade FROM est_saldos WHERE empresa_id = $1 AND COALESCE(loja_id, '${SEM_LOJA}'::uuid) = COALESCE($2::uuid, '${SEM_LOJA}'::uuid) AND item_id = $3 FOR UPDATE`, [empresa, loja, item]);
  return Number(r.rows[0].quantidade);
}

/**
 * Movimento dentro de uma transação aberta. `quantidade` com sinal (+ entra, − sai).
 * Saída que deixaria o saldo negativo é recusada, salvo `permitirNegativo` (venda já feita: o
 * dinheiro entrou, o estoque é que estava errado; o saldo negativo aparece como alerta).
 * Retorna null quando a chave já foi usada (idempotência).
 */
export async function movimentarNaTransacao(q, empresaId, { lojaId = null, itemId, tipo, quantidade, custoUnitario = null, origem = 'manual', origemId = null, chave, motivo = null, usuario = null, permitirNegativo = false }) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const item = exigirUuid(itemId, 'item');
  const loja = uuidOpcional(lojaId, 'unidade');
  const n = qtd(quantidade);
  if (!n) throw new ErroDominio('VALIDATION_ERROR', 'quantidade não pode ser zero');
  if (!chave) throw new ErroDominio('VALIDATION_ERROR', 'chave do movimento é obrigatória');
  await exigirUnidade(q, empresa, loja);
  // a trava do item serializa movimentos concorrentes do mesmo item: a checagem da chave vem
  // depois dela, então dois envios iguais ao mesmo tempo resultam em um movimento e um "já existe"
  const it = await q('SELECT id, custo_medio FROM est_itens WHERE empresa_id = $1 AND id = $2 FOR UPDATE', [empresa, item]);
  if (!it.rows[0]) throw new ErroDominio('NOT_FOUND', 'Item não encontrado nesta empresa', 404);
  const ja = await q('SELECT id FROM est_movimentos WHERE empresa_id = $1 AND chave = $2', [empresa, String(chave).slice(0, 200)]);
  if (ja.rows[0]) return null;
  const saldo = await travarSaldo(q, empresa, loja, item);
  const novo = qtd(saldo + n);
  if (novo < 0 && !permitirNegativo) throw new ErroDominio('ESTOQUE_INSUFICIENTE', `Saldo insuficiente: há ${saldo} na unidade`, 409);
  let custoMov = custo4(it.rows[0].custo_medio);
  if (n > 0 && custoUnitario !== null && custoUnitario !== undefined) {
    custoMov = custo4(numeroPositivo(custoUnitario, 'Custo unitário', { zeroOk: true }));
    // custo médio ponderado pelo saldo da empresa toda (saldo negativo não pesa)
    const total = await q('SELECT COALESCE(SUM(quantidade), 0) AS t FROM est_saldos WHERE empresa_id = $1 AND item_id = $2', [empresa, item]);
    const antes = Math.max(0, Number(total.rows[0].t));
    const medio = antes + n > 0 ? (antes * Number(it.rows[0].custo_medio) + n * custoMov) / (antes + n) : custoMov;
    await q('UPDATE est_itens SET custo_medio = $3, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2', [empresa, item, custo4(medio)]);
  }
  await q(`UPDATE est_saldos SET quantidade = $4, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND COALESCE(loja_id, '${SEM_LOJA}'::uuid) = COALESCE($2::uuid, '${SEM_LOJA}'::uuid) AND item_id = $3`, [empresa, loja, item, novo]);
  const r = await q(
    `INSERT INTO est_movimentos (empresa_id, loja_id, item_id, tipo, quantidade, custo_unitario, saldo_apos, origem, origem_id, chave, motivo, usuario)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [empresa, loja, item, tipo, n, custoMov, novo, String(origem).slice(0, 40), origemId ? String(origemId).slice(0, 160) : null, String(chave).slice(0, 200), textoOpcional(motivo, 240), textoOpcional(usuario, 180)],
  );
  return movimentoDto(r.rows[0]);
}

function movimentoDto(row) {
  return { id: row.id, lojaId: row.loja_id || null, itemId: row.item_id, tipo: row.tipo, quantidade: Number(row.quantidade), custoUnitario: Number(row.custo_unitario), saldoApos: Number(row.saldo_apos), origem: row.origem, origemId: row.origem_id || null, motivo: row.motivo || null, usuario: row.usuario || null, criadoEm: row.criado_em, itemNome: row.item_nome, unidade: row.unidade };
}

/**
 * Movimento manual: entrada (com custo), saída, ajuste de saldo (informa o saldo contado) ou perda
 * (com motivo). `idempotencia` vem do cliente para um clique duplo não lançar duas vezes.
 */
export async function movimentar(db, empresaId, { lojaId = null, itemId, tipo, quantidade, custoUnitario = null, motivo = null, idempotencia = null }, { usuario } = {}) {
  const t = String(tipo || '').toLowerCase();
  if (!['entrada', 'saida', 'ajuste', 'perda'].includes(t)) throw new ErroDominio('VALIDATION_ERROR', 'tipo deve ser entrada, saída, ajuste ou perda');
  if ((t === 'perda' || t === 'ajuste') && !textoOpcional(motivo, 240)) throw new ErroDominio('VALIDATION_ERROR', 'Informe o motivo');
  const chave = idempotencia ? `manual:${String(idempotencia).slice(0, 80)}` : `manual:${t}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
  return transacao(db, async (q) => {
    let delta;
    if (t === 'ajuste') {
      const contado = qtd(numeroPositivo(quantidade, 'Saldo contado', { zeroOk: true }));
      const atual = await travarSaldo(q, exigirUuid(empresaId, 'empresa'), uuidOpcional(lojaId, 'unidade'), exigirUuid(itemId, 'item'));
      delta = qtd(contado - atual);
      if (!delta) return { semMudanca: true };
    } else {
      const n = qtd(numeroPositivo(quantidade, 'Quantidade'));
      delta = t === 'entrada' ? n : -n;
    }
    const mov = await movimentarNaTransacao(q, empresaId, { lojaId, itemId, tipo: t, quantidade: delta, custoUnitario: t === 'entrada' ? custoUnitario : null, origem: 'manual', chave, motivo, usuario });
    if (!mov) throw new ErroDominio('DUPLICATE', 'Este movimento já foi registrado', 409);
    return mov;
  });
}

/** Transferência entre unidades: uma saída e uma entrada, juntas. */
export async function transferir(db, empresaId, { itemId, deLojaId, paraLojaId, quantidade, idempotencia = null }, { usuario } = {}) {
  const n = qtd(numeroPositivo(quantidade, 'Quantidade'));
  const de = uuidOpcional(deLojaId, 'unidade de origem');
  const para = uuidOpcional(paraLojaId, 'unidade de destino');
  if (de === para) throw new ErroDominio('VALIDATION_ERROR', 'Origem e destino precisam ser unidades diferentes');
  const base = idempotencia ? String(idempotencia).slice(0, 80) : `${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
  return transacao(db, async (q) => {
    const saida = await movimentarNaTransacao(q, empresaId, { lojaId: de, itemId, tipo: 'transferencia_saida', quantidade: -n, origem: 'transferencia', chave: `transf:${base}:saida`, usuario });
    if (!saida) throw new ErroDominio('DUPLICATE', 'Esta transferência já foi registrada', 409);
    const entrada = await movimentarNaTransacao(q, empresaId, { lojaId: para, itemId, tipo: 'transferencia_entrada', quantidade: n, origem: 'transferencia', chave: `transf:${base}:entrada`, usuario });
    return { saida, entrada };
  });
}

export async function listarMovimentos(db, empresaId, { lojaId = null, itemId = null, tipo = null, de = null, ate = null, limite = 300 } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const v = [empresa];
  let sql = 'SELECT m.*, i.nome AS item_nome, i.unidade FROM est_movimentos m JOIN est_itens i ON i.empresa_id = m.empresa_id AND i.id = m.item_id WHERE m.empresa_id = $1';
  if (lojaId === 'sem') sql += ' AND m.loja_id IS NULL';
  else if (lojaId && lojaId !== 'todas') { v.push(exigirUuid(lojaId, 'unidade')); sql += ` AND m.loja_id = $${v.length}`; }
  if (itemId) { v.push(exigirUuid(itemId, 'item')); sql += ` AND m.item_id = $${v.length}`; }
  if (tipo) { v.push(String(tipo).slice(0, 24)); sql += ` AND m.tipo = $${v.length}`; }
  if (de) { v.push(de); sql += ` AND m.criado_em >= $${v.length}::date`; }
  if (ate) { v.push(ate); sql += ` AND m.criado_em < ($${v.length}::date + 1)`; }
  sql += ` ORDER BY m.criado_em DESC LIMIT ${Math.min(Math.max(Number(limite) || 300, 1), 2000)}`;
  const r = await db.query(sql, v);
  return r.rows.map(movimentoDto);
}

/**
 * Perdas e quebras do período, valoradas pelo custo do movimento, líquidas das sobras de ajuste e
 * inventário. É informação gerencial: o CMV do DRE já é a compra (lançada no razão), então a perda
 * não é somada de novo.
 */
export async function perdasDoPeriodo(db, empresaId, { de, ate, lojaId = null, fuso = 'America/Cuiaba' }) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const v = [empresa, de, ate, fuso];
  let sql = `SELECT COALESCE(SUM(-m.quantidade * m.custo_unitario), 0) AS valor, COUNT(*) AS n,
                    COALESCE(SUM(-m.quantidade * m.custo_unitario) FILTER (WHERE m.quantidade < 0), 0) AS bruto
               FROM est_movimentos m
              WHERE m.empresa_id = $1 AND m.tipo IN ('perda', 'ajuste', 'inventario')
                AND (m.criado_em AT TIME ZONE $4)::date BETWEEN $2::date AND $3::date`;
  if (lojaId === 'sem') sql += ' AND m.loja_id IS NULL';
  else if (lojaId && lojaId !== 'todas') { v.push(exigirUuid(lojaId, 'unidade')); sql += ` AND m.loja_id = $${v.length}`; }
  const r = await db.query(sql, v);
  return { valor: Math.round(Number(r.rows[0].valor) * 100) / 100, perdasBrutas: Math.round(Number(r.rows[0].bruto) * 100) / 100, movimentos: Number(r.rows[0].n) };
}

// ── inventário ───────────────────────────────────────────────────────────────
export async function abrirInventario(db, empresaId, { lojaId = null, descricao, itens = null }, { usuario } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const loja = uuidOpcional(lojaId, 'unidade');
  const desc = exigirTexto(descricao || `Inventário de ${new Date().toLocaleDateString('pt-BR')}`, 'Descrição', { max: 160 });
  return transacao(db, async (q) => {
    await exigirUnidade(q, empresa, loja);
    let inv;
    try {
      inv = (await q('INSERT INTO est_inventarios (empresa_id, loja_id, descricao, criado_por) VALUES ($1, $2, $3, $4) RETURNING *', [empresa, loja, desc, textoOpcional(usuario, 180)])).rows[0];
    } catch (error) {
      if (error?.code === '23505') throw new ErroDominio('INVENTORY_OPEN', 'Já há um inventário aberto nesta unidade', 409);
      throw error;
    }
    const filtroItens = Array.isArray(itens) && itens.length ? itens.map((i) => exigirUuid(i, 'item')) : null;
    await q(
      `INSERT INTO est_inventario_itens (empresa_id, inventario_id, item_id, saldo_sistema)
       SELECT i.empresa_id, $2, i.id, COALESCE(s.quantidade, 0)
         FROM est_itens i
         LEFT JOIN est_saldos s ON s.empresa_id = i.empresa_id AND s.item_id = i.id AND COALESCE(s.loja_id, '${SEM_LOJA}'::uuid) = COALESCE($3::uuid, '${SEM_LOJA}'::uuid)
        WHERE i.empresa_id = $1 AND i.ativo = true ${filtroItens ? 'AND i.id = ANY($4::uuid[])' : ''}`,
      filtroItens ? [empresa, inv.id, loja, filtroItens] : [empresa, inv.id, loja],
    );
    return obterInventario({ query: q }, empresa, inv.id);
  });
}

export async function obterInventario(db, empresaId, id) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const inv = (await db.query('SELECT * FROM est_inventarios WHERE empresa_id = $1 AND id = $2', [empresa, exigirUuid(id, 'inventário')])).rows[0];
  if (!inv) throw new ErroDominio('NOT_FOUND', 'Inventário não encontrado', 404);
  const itens = (await db.query(
    `SELECT ii.*, i.nome, i.unidade, i.custo_medio FROM est_inventario_itens ii JOIN est_itens i ON i.empresa_id = ii.empresa_id AND i.id = ii.item_id
      WHERE ii.empresa_id = $1 AND ii.inventario_id = $2 ORDER BY lower(i.nome)`, [empresa, inv.id])).rows;
  return {
    id: inv.id, lojaId: inv.loja_id || null, descricao: inv.descricao, status: inv.status, criadoPor: inv.criado_por, criadoEm: inv.criado_em, concluidoEm: inv.concluido_em,
    itens: itens.map((r) => {
      const dif = r.contado === null ? null : qtd(Number(r.contado) - Number(r.saldo_sistema));
      return { itemId: r.item_id, nome: r.nome, unidade: r.unidade, saldoSistema: Number(r.saldo_sistema), contado: r.contado === null ? null : Number(r.contado), diferenca: dif, valorDiferenca: dif === null ? null : Math.round(dif * Number(r.custo_medio) * 100) / 100 };
    }),
  };
}

export async function listarInventarios(db, empresaId) {
  const r = await db.query('SELECT id, loja_id, descricao, status, criado_por, criado_em, concluido_em FROM est_inventarios WHERE empresa_id = $1 ORDER BY criado_em DESC LIMIT 100', [exigirUuid(empresaId, 'empresa')]);
  return r.rows.map((x) => ({ id: x.id, lojaId: x.loja_id || null, descricao: x.descricao, status: x.status, criadoPor: x.criado_por, criadoEm: x.criado_em, concluidoEm: x.concluido_em }));
}

export async function registrarContagem(db, empresaId, inventarioId, contagens = []) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const inv = exigirUuid(inventarioId, 'inventário');
  return transacao(db, async (q) => {
    const st = (await q('SELECT status, loja_id FROM est_inventarios WHERE empresa_id = $1 AND id = $2 FOR UPDATE', [empresa, inv])).rows[0];
    if (!st) throw new ErroDominio('NOT_FOUND', 'Inventário não encontrado', 404);
    if (st.status !== 'aberto') throw new ErroDominio('INVENTORY_CLOSED', 'Inventário já foi concluído', 409);
    for (const c of Array.isArray(contagens) ? contagens : []) {
      const contado = c.contado === null || c.contado === '' ? null : qtd(numeroPositivo(c.contado, 'Quantidade contada', { zeroOk: true }));
      const item = exigirUuid(c.itemId, 'item');
      // o saldo do sistema no instante da contagem: vendas posteriores continuam valendo na conclusão
      const saldoAgora = contado === null ? null : await travarSaldo(q, empresa, st.loja_id, item);
      await q('UPDATE est_inventario_itens SET contado = $4, saldo_na_contagem = $5, contado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND inventario_id = $2 AND item_id = $3', [empresa, inv, item, contado, saldoAgora]);
    }
    return obterInventario({ query: q }, empresa, inv);
  });
}

/**
 * Conclui: para cada item contado, a diferença entre o contado e o saldo do sistema NO MOMENTO DA
 * CONTAGEM vira um movimento de inventário sobre o saldo atual. Assim, vendas feitas antes da
 * contagem já estão no saldo daquele momento e vendas feitas depois continuam descontadas.
 * Itens não contados ficam como estão. Antes de contar e de concluir, a rota baixa as vendas.
 */
export async function concluirInventario(db, empresaId, inventarioId, { usuario } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const inv = exigirUuid(inventarioId, 'inventário');
  return transacao(db, async (q) => {
    const cab = (await q('SELECT * FROM est_inventarios WHERE empresa_id = $1 AND id = $2 FOR UPDATE', [empresa, inv])).rows[0];
    if (!cab) throw new ErroDominio('NOT_FOUND', 'Inventário não encontrado', 404);
    if (cab.status !== 'aberto') throw new ErroDominio('INVENTORY_CLOSED', 'Inventário já foi concluído', 409);
    const itens = (await q('SELECT item_id, contado, saldo_na_contagem, saldo_sistema FROM est_inventario_itens WHERE empresa_id = $1 AND inventario_id = $2 AND contado IS NOT NULL', [empresa, inv])).rows;
    let ajustes = 0;
    for (const it of itens) {
      await travarSaldo(q, empresa, cab.loja_id, it.item_id);
      const base = it.saldo_na_contagem === null ? Number(it.saldo_sistema) : Number(it.saldo_na_contagem);
      const delta = qtd(Number(it.contado) - base);
      if (!delta) continue;
      await movimentarNaTransacao(q, empresa, { lojaId: cab.loja_id, itemId: it.item_id, tipo: 'inventario', quantidade: delta, origem: 'inventario', origemId: inv, chave: `inventario:${inv}:${it.item_id}`, motivo: cab.descricao, usuario, permitirNegativo: true });
      ajustes += 1;
    }
    await q("UPDATE est_inventarios SET status = 'concluido', concluido_em = CURRENT_TIMESTAMP, concluido_por = $3 WHERE empresa_id = $1 AND id = $2", [empresa, inv, textoOpcional(usuario, 180)]);
    return { ...(await obterInventario({ query: q }, empresa, inv)), ajustes };
  });
}

export async function cancelarInventario(db, empresaId, inventarioId) {
  const r = await db.query("UPDATE est_inventarios SET status = 'cancelado' WHERE empresa_id = $1 AND id = $2 AND status = 'aberto' RETURNING id", [exigirUuid(empresaId, 'empresa'), exigirUuid(inventarioId, 'inventário')]);
  if (!r.rows[0]) throw new ErroDominio('NOT_FOUND', 'Inventário aberto não encontrado', 404);
  return { id: r.rows[0].id, status: 'cancelado' };
}

// ── ficha técnica (vínculos) ─────────────────────────────────────────────────
export async function listarFichas(db, empresaId, { fonte = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const v = [empresa];
  let sql = `SELECT v.*, i.nome AS item_nome, i.unidade, i.custo_medio FROM est_vinculos v JOIN est_itens i ON i.empresa_id = v.empresa_id AND i.id = v.item_id WHERE v.empresa_id = $1`;
  if (fonte) { v.push(String(fonte)); sql += ' AND v.fonte = $2'; }
  const r = await db.query(`${sql} ORDER BY v.fonte, v.fonte_id, lower(i.nome)`, v);
  const porProduto = new Map();
  for (const row of r.rows) {
    const k = `${row.fonte}:${row.fonte_id}`;
    if (!porProduto.has(k)) porProduto.set(k, { fonte: row.fonte, fonteId: row.fonte_id, itens: [], custo: 0 });
    const f = porProduto.get(k);
    f.itens.push({ itemId: row.item_id, nome: row.item_nome, unidade: row.unidade, fator: Number(row.fator), espelho: row.espelho === true });
    f.custo = Math.round((f.custo + Number(row.fator) * Number(row.custo_medio)) * 10000) / 10000;
  }
  return [...porProduto.values()];
}

/** Grava a ficha inteira de um produto (substitui a anterior). */
export async function salvarFicha(db, empresaId, { fonte, fonteId, itens = [] }) {
  const empresa = exigirUuid(empresaId, 'empresa');
  if (!['bar_produto', 'loja_variante'].includes(fonte)) throw new ErroDominio('VALIDATION_ERROR', 'fonte deve ser bar_produto ou loja_variante');
  const id = exigirUuid(fonteId, 'produto');
  const linhas = (Array.isArray(itens) ? itens : []).map((i) => ({ item: exigirUuid(i.itemId, 'item'), fator: numeroPositivo(i.fator, 'Quantidade por venda', { max: 1e6 }), espelho: i.espelho === true }));
  if (new Set(linhas.map((l) => l.item)).size !== linhas.length) throw new ErroDominio('VALIDATION_ERROR', 'Item repetido na ficha');
  if (linhas.filter((l) => l.espelho).length > 1) throw new ErroDominio('VALIDATION_ERROR', 'Só um item pode espelhar o estoque do produto');
  return transacao(db, async (q) => {
    // o produto precisa existir nesta empresa
    const tabela = fonte === 'bar_produto' ? 'bar_produtos' : 'commerce_product_variants';
    const existe = await q(`SELECT 1 FROM ${tabela} WHERE empresa_id = $1 AND id = $2`, [empresa, id]);
    if (!existe.rows[0]) throw new ErroDominio('NOT_FOUND', 'Produto não encontrado nesta empresa', 404);
    const espelho = linhas.find((l) => l.espelho);
    if (espelho) {
      const outro = await q("SELECT 1 FROM est_vinculos WHERE empresa_id = $1 AND item_id = $2 AND espelho = true AND NOT (fonte = $3 AND fonte_id = $4)", [empresa, espelho.item, fonte, id]);
      if (outro.rows[0]) throw new ErroDominio('VALIDATION_ERROR', 'Este item já espelha o estoque de outro produto; a compra somaria duas vezes no bar');
    }
    await q('DELETE FROM est_vinculos WHERE empresa_id = $1 AND fonte = $2 AND fonte_id = $3', [empresa, fonte, id]);
    for (const l of linhas) {
      await q('INSERT INTO est_vinculos (empresa_id, fonte, fonte_id, item_id, fator, espelho) VALUES ($1, $2, $3, $4, $5, $6)', [empresa, fonte, id, l.item, l.fator, l.espelho]);
    }
    return { fonte, fonteId: id, itens: linhas.length };
  });
}

const STATUS_PEDIDO_VENDIDO = ['paid', 'processing', 'ready', 'ready_for_pickup', 'shipped', 'delivered', 'picked_up', 'completed'];

/** Unidade de onde saem os insumos do bar: a configurada; com uma unidade ativa só, ela. */
export async function unidadeDoBar(db, empresaId) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const cfg = (await db.query("SELECT loja_bar FROM est_config WHERE empresa_id = $1", [empresa])).rows[0];
  if (cfg?.loja_bar) return cfg.loja_bar;
  const lojas = (await db.query('SELECT id FROM lojas WHERE empresa_id = $1 AND ativa = true', [empresa])).rows;
  return lojas.length === 1 ? lojas[0].id : null;
}

export async function obterConfig(db, empresaId) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const cfg = (await db.query('SELECT loja_bar FROM est_config WHERE empresa_id = $1', [empresa])).rows[0];
  return { lojaBar: cfg?.loja_bar || null, lojaBarEfetiva: await unidadeDoBar(db, empresa) };
}

export async function salvarConfig(db, empresaId, { lojaBar = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const loja = await exigirUnidade((t, v) => db.query(t, v), empresa, uuidOpcional(lojaBar, 'unidade'));
  await db.query(`INSERT INTO est_config (empresa_id, loja_bar) VALUES ($1, $2)
                  ON CONFLICT (empresa_id) DO UPDATE SET loja_bar = EXCLUDED.loja_bar, atualizado_em = CURRENT_TIMESTAMP`, [empresa, loja]);
  return obterConfig(db, empresa);
}

/**
 * Consumo das vendas pela ficha técnica. Bar: itens de comandas pagas; loja online: itens de
 * pedidos pagos. Cada (venda, item) gera uma saída única. A unidade do bar é a da configuração
 * (o bar não grava unidade na comanda); a da loja online é a do pedido.
 * Venda que saiu do conjunto válido depois de baixada (item cancelado, comanda reaberta, pedido
 * cancelado ou devolvido) tem a baixa estornada: o insumo volta ao estoque.
 */
export async function baixarConsumoDasVendas(db, empresaId, { lojaBar, fuso = 'America/Cuiaba' } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const loja = lojaBar === undefined ? await unidadeDoBar(db, empresa) : uuidOpcional(lojaBar, 'unidade');
  const existe = async (t) => Boolean((await db.query('SELECT to_regclass($1) AS t', [t])).rows[0]?.t);
  const vendas = [];
  const temBar = await existe('bar_comanda_itens');
  const temLoja = await existe('commerce_order_items');
  if (temBar) {
    const r = await db.query(
      `SELECT ci.id AS venda_id, ci.quantidade, v.item_id, v.fator, c.fechada_em
         FROM bar_comanda_itens ci
         JOIN bar_comandas c ON c.empresa_id = ci.empresa_id AND c.id = ci.comanda_id AND c.status = 'paga'
         JOIN est_vinculos v ON v.empresa_id = ci.empresa_id AND v.fonte = 'bar_produto' AND v.fonte_id = ci.produto_id
        WHERE ci.empresa_id = $1 AND ci.status <> 'cancelado'
          AND NOT EXISTS (SELECT 1 FROM est_movimentos m WHERE m.empresa_id = ci.empresa_id AND m.chave = 'venda_bar:' || ci.id || ':' || v.item_id)
        LIMIT 5000`, [empresa]);
    for (const x of r.rows) vendas.push({ chave: `venda_bar:${x.venda_id}:${x.item_id}`, origem: 'venda_bar', origemId: x.venda_id, loja, item: x.item_id, quantidade: -qtd(Number(x.quantidade) * Number(x.fator)) });
  }
  if (temLoja) {
    const r = await db.query(
      `SELECT oi.id AS venda_id, oi.quantidade, v.item_id, v.fator, o.loja_id
         FROM commerce_order_items oi
         JOIN commerce_orders o ON o.empresa_id = oi.empresa_id AND o.id = oi.order_id AND o.status = ANY($2::text[])
         JOIN est_vinculos v ON v.empresa_id = oi.empresa_id AND v.fonte = 'loja_variante' AND v.fonte_id = oi.variant_id
        WHERE oi.empresa_id = $1
          AND NOT EXISTS (SELECT 1 FROM est_movimentos m WHERE m.empresa_id = oi.empresa_id AND m.chave = 'venda_loja:' || oi.id || ':' || v.item_id)
        LIMIT 5000`, [empresa, STATUS_PEDIDO_VENDIDO]);
    for (const x of r.rows) vendas.push({ chave: `venda_loja:${x.venda_id}:${x.item_id}`, origem: 'venda_loja', origemId: x.venda_id, loja: x.loja_id || null, item: x.item_id, quantidade: -qtd(Number(x.quantidade) * Number(x.fator)) });
  }
  // baixas já feitas cuja venda deixou de valer: estorno com a mesma unidade e o mesmo custo
  const desfazer = [];
  if (temBar) {
    const r = await db.query(
      `SELECT m.* FROM est_movimentos m
         LEFT JOIN bar_comanda_itens ci ON ci.empresa_id = m.empresa_id AND ci.id::text = m.origem_id
         LEFT JOIN bar_comandas c ON c.empresa_id = ci.empresa_id AND c.id = ci.comanda_id
        WHERE m.empresa_id = $1 AND m.origem = 'venda_bar' AND m.tipo = 'venda' AND m.quantidade < 0
          AND (ci.id IS NULL OR ci.status = 'cancelado' OR c.status IS DISTINCT FROM 'paga')
          AND NOT EXISTS (SELECT 1 FROM est_movimentos e WHERE e.empresa_id = m.empresa_id AND e.chave = m.chave || ':estorno')
        LIMIT 5000`, [empresa]);
    desfazer.push(...r.rows);
  }
  if (temLoja) {
    const r = await db.query(
      `SELECT m.* FROM est_movimentos m
         LEFT JOIN commerce_order_items oi ON oi.empresa_id = m.empresa_id AND oi.id::text = m.origem_id
         LEFT JOIN commerce_orders o ON o.empresa_id = oi.empresa_id AND o.id = oi.order_id
        WHERE m.empresa_id = $1 AND m.origem = 'venda_loja' AND m.tipo = 'venda' AND m.quantidade < 0
          AND (oi.id IS NULL OR NOT (o.status = ANY($2::text[])))
          AND NOT EXISTS (SELECT 1 FROM est_movimentos e WHERE e.empresa_id = m.empresa_id AND e.chave = m.chave || ':estorno')
        LIMIT 5000`, [empresa, STATUS_PEDIDO_VENDIDO]);
    desfazer.push(...r.rows);
  }
  let baixados = 0; let estornados = 0;
  for (const v of vendas) {
    if (!v.quantidade) continue;
    const mov = await transacao(db, (q) => movimentarNaTransacao(q, empresa, { lojaId: v.loja, itemId: v.item, tipo: 'venda', quantidade: v.quantidade, origem: v.origem, origemId: v.origemId, chave: v.chave, permitirNegativo: true }));
    if (mov) baixados += 1;
  }
  for (const m of desfazer) {
    const mov = await transacao(db, (q) => movimentarNaTransacao(q, empresa, { lojaId: m.loja_id, itemId: m.item_id, tipo: 'venda', quantidade: -Number(m.quantidade), origem: 'estorno_venda', origemId: m.origem_id, chave: `${m.chave}:estorno`, motivo: 'venda cancelada ou devolvida', permitirNegativo: true }));
    if (mov) estornados += 1;
  }
  void fuso;
  return { lidos: vendas.length, baixados, estornados, lojaBar: loja };
}

/** Sugestão de compra: itens abaixo do mínimo, com a quantidade para voltar ao dobro do mínimo. */
export async function sugestaoDeCompra(db, empresaId, { lojaId = null } = {}) {
  const itens = await listarItens(db, empresaId, { lojaId, abaixoDoMinimo: true });
  return itens.map((i) => ({ ...i, sugerido: qtd(Math.max(i.estoqueMinimo * 2 - i.saldo, i.estoqueMinimo)) }));
}

/** Curva ABC pelo valor consumido (vendas + saídas) nos últimos N dias. */
export async function curvaAbc(db, empresaId, { dias = 90 } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const d = Math.min(Math.max(Number(dias) || 90, 7), 365);
  const r = await db.query(
    `SELECT i.id, i.nome, i.unidade, SUM(-m.quantidade) AS quantidade, SUM(-m.quantidade * m.custo_unitario) AS valor
       FROM est_movimentos m JOIN est_itens i ON i.empresa_id = m.empresa_id AND i.id = m.item_id
      WHERE m.empresa_id = $1 AND m.tipo IN ('venda', 'saida') AND m.criado_em >= CURRENT_TIMESTAMP - ($2::int * INTERVAL '1 day')
      GROUP BY i.id, i.nome, i.unidade HAVING SUM(-m.quantidade * m.custo_unitario) > 0 ORDER BY valor DESC`, [empresa, d]);
  const total = r.rows.reduce((s, x) => s + Number(x.valor), 0);
  let acumulado = 0;
  return r.rows.map((x) => {
    acumulado += Number(x.valor);
    const pctAcum = total ? acumulado / total : 0;
    return { itemId: x.id, nome: x.nome, unidade: x.unidade, quantidade: qtd(x.quantidade), valor: Math.round(Number(x.valor) * 100) / 100, participacao: total ? Math.round((Number(x.valor) / total) * 1000) / 10 : 0, classe: pctAcum <= 0.8 ? 'A' : pctAcum <= 0.95 ? 'B' : 'C' };
  });
}
