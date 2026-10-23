// Compras por empresa (migração 091): pedido ao fornecedor, recebimento (com ou sem NF-e) que dá
// entrada no estoque e gera as contas a pagar no razão financeiro, tudo numa transação só.
import { ErroDominio, exigirData, exigirTexto, exigirUuid, transacao } from '../acesso/banco.js';
import { lerXmlNfe } from '../../barbearia-compras-kytto.js';
import { movimentarNaTransacao } from './estoque.js';
import { registrarAutomaticoNaTransacao, hojeNoFuso, FUSO_PADRAO } from '../razao/servico.js';

const dinheiro = (v) => Math.round(Number(v || 0) * 100) / 100;
const qtd = (v) => Math.round(Number(v || 0) * 1000) / 1000;
function positivo(v, campo, { zeroOk = false } = {}) {
  const n = Number(typeof v === 'string' ? v.replace(',', '.') : v);
  if (!Number.isFinite(n) || n < 0 || (!zeroOk && n === 0) || n > 1e9) throw new ErroDominio('VALIDATION_ERROR', `${campo} inválido`);
  return n;
}
const uuidOpcional = (v, c) => (v === undefined || v === null || v === '' ? null : exigirUuid(v, c));
const textoOpcional = (v, max) => { const t = String(v ?? '').trim(); return t ? t.slice(0, max) : null; };
const normalizar = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Parcelas a partir da condição de pagamento: 'a_vista', '30', '30/60', '28/56/84' (dias a partir
 * da data base). O centavo que sobra da divisão vai para a primeira parcela.
 */
export function parcelasDaCondicao(total, condicao, dataBase) {
  const valor = dinheiro(total);
  const c = String(condicao || 'a_vista').trim().toLowerCase();
  const dias = c === 'a_vista' || c === '0' ? [0] : c.split('/').map((d) => Number(d.trim()));
  if (!dias.length || dias.some((d) => !Number.isInteger(d) || d < 0 || d > 365) || dias.length > 12) throw new ErroDominio('VALIDATION_ERROR', 'Condição de pagamento inválida (use a_vista, 30 ou 30/60/90)');
  const base = Math.floor((valor / dias.length) * 100) / 100;
  const resto = dinheiro(valor - base * dias.length);
  const [a, m, d] = dataBase.split('-').map(Number);
  return dias.map((n, i) => ({
    vencimento: new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10),
    valor: dinheiro(base + (i === 0 ? resto : 0)),
  }));
}

function pedidoDto(row, itens = []) {
  return {
    id: row.id, numero: row.numero, lojaId: row.loja_id || null, fornecedorId: row.fornecedor_id || null, fornecedorNome: row.fornecedor_nome,
    status: row.status, previsao: row.previsao ? String(row.previsao instanceof Date ? row.previsao.toISOString() : row.previsao).slice(0, 10) : null,
    condicaoPagamento: row.condicao_pagamento, observacao: row.observacao || null, total: Number(row.total), criadoPor: row.criado_por, criadoEm: row.criado_em,
    itens: itens.map((i) => ({ id: i.id, itemId: i.item_id, nome: i.nome, unidade: i.unidade, quantidade: Number(i.quantidade), custoUnitario: Number(i.custo_unitario), recebido: Number(i.recebido), pendente: qtd(Number(i.quantidade) - Number(i.recebido)) })),
  };
}

async function fornecedorDaEmpresa(q, empresa, fornecedorId) {
  if (!fornecedorId) return null;
  const r = await q('SELECT id, nome, cnpj FROM a2_fornecedores WHERE empresa_id = $1 AND id = $2', [empresa, exigirUuid(fornecedorId, 'fornecedor')]);
  if (!r.rows[0]) throw new ErroDominio('NOT_FOUND', 'Fornecedor não encontrado nesta empresa', 404);
  return r.rows[0];
}

export async function criarPedido(db, empresaId, entrada = {}, { usuario } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const itens = (Array.isArray(entrada.itens) ? entrada.itens : []).map((i) => ({ item: exigirUuid(i.itemId, 'item'), quantidade: qtd(positivo(i.quantidade, 'Quantidade')), custo: positivo(i.custoUnitario ?? 0, 'Custo', { zeroOk: true }) }));
  if (!itens.length) throw new ErroDominio('VALIDATION_ERROR', 'O pedido precisa de pelo menos um item');
  parcelasDaCondicao(1, entrada.condicaoPagamento, '2026-01-01'); // valida a condição
  return transacao(db, async (q) => {
    const forn = await fornecedorDaEmpresa(q, empresa, entrada.fornecedorId);
    const nome = forn?.nome || exigirTexto(entrada.fornecedorNome, 'Fornecedor', { min: 2, max: 240 });
    await q('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`cmp:numero:${empresa}`]);
    const numero = Number((await q('SELECT COALESCE(MAX(numero), 0) + 1 AS n FROM cmp_pedidos WHERE empresa_id = $1', [empresa])).rows[0].n);
    const total = dinheiro(itens.reduce((s, i) => s + i.quantidade * i.custo, 0));
    const ped = (await q(
      `INSERT INTO cmp_pedidos (empresa_id, loja_id, numero, fornecedor_id, fornecedor_nome, previsao, condicao_pagamento, observacao, total, criado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [empresa, uuidOpcional(entrada.lojaId, 'unidade'), numero, forn?.id || null, nome, entrada.previsao ? exigirData(entrada.previsao, 'Previsão') : null,
        String(entrada.condicaoPagamento || 'a_vista').slice(0, 40), textoOpcional(entrada.observacao, 2000), total, textoOpcional(usuario, 180)],
    )).rows[0];
    for (const i of itens) {
      const existe = await q('SELECT 1 FROM est_itens WHERE empresa_id = $1 AND id = $2', [empresa, i.item]);
      if (!existe.rows[0]) throw new ErroDominio('NOT_FOUND', 'Item não encontrado nesta empresa', 404);
      await q('INSERT INTO cmp_pedido_itens (empresa_id, pedido_id, item_id, quantidade, custo_unitario) VALUES ($1,$2,$3,$4,$5)', [empresa, ped.id, i.item, i.quantidade, i.custo]);
    }
    return obterPedido({ query: q }, empresa, ped.id);
  });
}

export async function obterPedido(db, empresaId, id) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const p = (await db.query('SELECT * FROM cmp_pedidos WHERE empresa_id = $1 AND id = $2', [empresa, exigirUuid(id, 'pedido')])).rows[0];
  if (!p) throw new ErroDominio('NOT_FOUND', 'Pedido não encontrado', 404);
  const itens = (await db.query('SELECT pi.*, i.nome, i.unidade FROM cmp_pedido_itens pi JOIN est_itens i ON i.empresa_id = pi.empresa_id AND i.id = pi.item_id WHERE pi.empresa_id = $1 AND pi.pedido_id = $2 ORDER BY lower(i.nome)', [empresa, p.id])).rows;
  return pedidoDto(p, itens);
}

export async function listarPedidos(db, empresaId, { status = null, lojaId = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const v = [empresa];
  let sql = 'SELECT * FROM cmp_pedidos WHERE empresa_id = $1';
  if (status) { v.push(String(status)); sql += ` AND status = $${v.length}`; }
  if (lojaId && lojaId !== 'todas') { v.push(exigirUuid(lojaId, 'unidade')); sql += ` AND loja_id = $${v.length}`; }
  const r = await db.query(`${sql} ORDER BY numero DESC LIMIT 300`, v);
  return r.rows.map((row) => pedidoDto(row));
}

export async function mudarStatusPedido(db, empresaId, id, acao) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const de = { enviar: ['rascunho'], cancelar: ['rascunho', 'enviado'] }[acao];
  const para = { enviar: 'enviado', cancelar: 'cancelado' }[acao];
  if (!de) throw new ErroDominio('VALIDATION_ERROR', 'ação inválida');
  const r = await db.query('UPDATE cmp_pedidos SET status = $3, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2 AND status = ANY($4::text[]) RETURNING id', [empresa, exigirUuid(id, 'pedido'), para, de]);
  if (!r.rows[0]) throw new ErroDominio('INVALID_STATUS', `Só pedido ${de.join(' ou ')} pode ser ${acao === 'enviar' ? 'enviado' : 'cancelado'}`, 409);
  return obterPedido(db, empresa, id);
}

/**
 * Recebimento: entrada no estoque (custo da nota), contas a pagar no razão (uma por parcela),
 * baixa do pedido e, para item espelhado, soma no estoque do bar. Tudo ou nada.
 */
export async function receber(db, empresaId, entrada = {}, opcoes = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const preparado = prepararRecebimento(empresa, entrada, opcoes);
  return transacao(db, (q) => receberEm(q, empresa, preparado));
}

function prepararRecebimento(empresa, entrada, { usuario, fuso = FUSO_PADRAO, agora = new Date() } = {}) {
  const loja = uuidOpcional(entrada.lojaId, 'unidade');
  const itens = (Array.isArray(entrada.itens) ? entrada.itens : []).map((i) => ({
    item: exigirUuid(i.itemId, 'item'), quantidade: qtd(positivo(i.quantidade, 'Quantidade')), custo: positivo(i.custoUnitario ?? 0, 'Custo', { zeroOk: true }),
    codigo: textoOpcional(i.codigoFornecedor, 60), fator: i.fator === undefined ? 1 : positivo(i.fator, 'Conversão'),
  }));
  if (!itens.length) throw new ErroDominio('VALIDATION_ERROR', 'Informe os itens recebidos');
  const nfe = entrada.nfe || null;
  const dataBase = nfe?.emissao ? String(nfe.emissao).slice(0, 10) : hojeNoFuso(agora, fuso);
  const totalItens = dinheiro(itens.reduce((s, i) => s + i.quantidade * i.custo, 0));
  const total = entrada.valorTotal === undefined ? totalItens : dinheiro(positivo(entrada.valorTotal, 'Valor total', { zeroOk: true }));
  const parcelas = Array.isArray(entrada.parcelas) && entrada.parcelas.length
    ? entrada.parcelas.map((p) => ({ vencimento: exigirData(p.vencimento, 'Vencimento da parcela'), valor: dinheiro(positivo(p.valor, 'Valor da parcela')) }))
    : (total > 0 ? parcelasDaCondicao(total, entrada.condicaoPagamento, dataBase) : []);
  if (parcelas.length && Math.abs(parcelas.reduce((s, p) => s + p.valor, 0) - total) > 0.01) throw new ErroDominio('VALIDATION_ERROR', 'A soma das parcelas precisa bater com o total');
  const pagoNoAto = entrada.pagoNoAto === true;

  return { entrada, loja, itens, nfe, dataBase, total, parcelas, pagoNoAto, usuario, fuso, agora };
}

async function receberEm(q, empresa, { entrada, loja, itens, nfe, dataBase, total, parcelas, pagoNoAto, usuario, fuso, agora }) {
  {
    const pedido = entrada.pedidoId ? (await q('SELECT * FROM cmp_pedidos WHERE empresa_id = $1 AND id = $2 FOR UPDATE', [empresa, exigirUuid(entrada.pedidoId, 'pedido')])).rows[0] : null;
    if (entrada.pedidoId && !pedido) throw new ErroDominio('NOT_FOUND', 'Pedido não encontrado', 404);
    if (pedido && !['enviado', 'parcial', 'rascunho'].includes(pedido.status)) throw new ErroDominio('INVALID_STATUS', `Pedido ${pedido.status} não recebe mais itens`, 409);
    const forn = await fornecedorDaEmpresa(q, empresa, entrada.fornecedorId || pedido?.fornecedor_id);
    const nomeForn = forn?.nome || pedido?.fornecedor_nome || exigirTexto(entrada.fornecedorNome || nfe?.emitenteNome, 'Fornecedor', { min: 2, max: 240 });
    const cnpj = String(forn?.cnpj || nfe?.emitenteCnpj || '').replace(/\D/g, '') || null;
    let rec;
    try {
      rec = (await q(
        `INSERT INTO cmp_recebimentos (empresa_id, loja_id, pedido_id, fornecedor_id, fornecedor_nome, fornecedor_cnpj, nfe_chave, nfe_numero, nfe_serie, emissao, valor_total, parcelas, recebido_por, observacao)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
        [empresa, loja, pedido?.id || null, forn?.id || null, nomeForn, cnpj && cnpj.length === 14 ? cnpj : null, nfe?.chave || null, nfe?.numero || null, nfe?.serie || null,
          nfe?.emissao ? String(nfe.emissao).slice(0, 10) : null, total, JSON.stringify(parcelas), textoOpcional(usuario, 180), textoOpcional(entrada.observacao, 2000)],
      )).rows[0];
    } catch (error) {
      if (error?.code === '23505') throw new ErroDominio('NFE_DUPLICATE', 'Esta NF-e já foi lançada nesta empresa', 409);
      throw error;
    }
    const tipos = new Set();
    for (const [idx, i] of itens.entries()) {
      const it = (await q('SELECT tipo FROM est_itens WHERE empresa_id = $1 AND id = $2', [empresa, i.item])).rows[0];
      if (!it) throw new ErroDominio('NOT_FOUND', 'Item não encontrado nesta empresa', 404);
      tipos.add(it.tipo);
      // conversão: 1 unidade da nota (ex.: caixa) = `fator` unidades do item (ex.: 12 latas)
      const quantidadeItem = qtd(i.quantidade * i.fator);
      const custoItem = i.custo / i.fator;
      await q('INSERT INTO cmp_recebimento_itens (empresa_id, recebimento_id, item_id, quantidade, custo_unitario, codigo_fornecedor) VALUES ($1,$2,$3,$4,$5,$6)', [empresa, rec.id, i.item, quantidadeItem, custoItem, i.codigo]);
      await movimentarNaTransacao(q, empresa, { lojaId: loja, itemId: i.item, tipo: 'entrada', quantidade: quantidadeItem, custoUnitario: custoItem, origem: 'compra', origemId: rec.id, chave: `compra:${rec.id}:${idx}`, usuario });
      if (pedido) await q('UPDATE cmp_pedido_itens SET recebido = recebido + $4 WHERE empresa_id = $1 AND pedido_id = $2 AND item_id = $3', [empresa, pedido.id, i.item, quantidadeItem]);
      if (cnpj && cnpj.length === 14 && i.codigo) {
        await q(`INSERT INTO cmp_codigos_fornecedor (empresa_id, fornecedor_cnpj, codigo, item_id, fator) VALUES ($1,$2,$3,$4,$5)
                 ON CONFLICT (empresa_id, fornecedor_cnpj, codigo) DO UPDATE SET item_id = EXCLUDED.item_id, fator = EXCLUDED.fator, atualizado_em = CURRENT_TIMESTAMP`, [empresa, cnpj, i.codigo, i.item, i.fator]);
      }
      // espelho no bar: a garrafa comprada também entra no estoque operacional do bar
      const espelho = (await q("SELECT fonte_id, fator FROM est_vinculos WHERE empresa_id = $1 AND item_id = $2 AND espelho = true AND fonte = 'bar_produto'", [empresa, i.item])).rows[0];
      if (espelho) {
        const unidadesBar = quantidadeItem / Number(espelho.fator);
        const prod = (await q('SELECT estoque_atual FROM bar_produtos WHERE empresa_id = $1 AND id = $2 FOR UPDATE', [empresa, espelho.fonte_id])).rows[0];
        if (prod) {
          const novo = Number(prod.estoque_atual) + unidadesBar;
          await q('UPDATE bar_produtos SET estoque_atual = $3, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2', [empresa, espelho.fonte_id, novo]);
          await q("INSERT INTO bar_estoque_movimentos (empresa_id, produto_id, tipo, quantidade, saldo_apos, origem, observacao, criado_por) VALUES ($1,$2,'entrada',$3,$4,'compra',$5,$6)", [empresa, espelho.fonte_id, unidadesBar, novo, `Recebimento de compra ${rec.id}`.slice(0, 300), textoOpcional(usuario, 180)]);
        }
      }
    }
    if (pedido) {
      const pend = (await q('SELECT COUNT(*) FILTER (WHERE recebido < quantidade) AS falta FROM cmp_pedido_itens WHERE empresa_id = $1 AND pedido_id = $2', [empresa, pedido.id])).rows[0];
      await q('UPDATE cmp_pedidos SET status = $3, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2', [empresa, pedido.id, Number(pend.falta) > 0 ? 'parcial' : 'recebido']);
    }
    const categoria = [...tipos].every((t) => t === 'insumo') ? 'Insumos' : 'Compras de mercadoria';
    const doc = nfe?.numero ? `NF ${nfe.numero}${nfe.serie ? `/${nfe.serie}` : ''}` : (pedido ? `Pedido ${pedido.numero}` : null);
    const lancamentos = [];
    for (const [i, p] of parcelas.entries()) {
      const r = await registrarAutomaticoNaTransacao(q, empresa, {
        tipo: 'despesa', categoria, descricao: `Compra ${nomeForn}${doc ? ` · ${doc}` : ''}${parcelas.length > 1 ? ` (${i + 1}/${parcelas.length})` : ''}`.slice(0, 240),
        valor: p.valor, vencimento: p.vencimento, competencia: dataBase, status: pagoNoAto && i === 0 ? 'pago' : 'pendente', meioPagamento: pagoNoAto && i === 0 ? entrada.meioPagamento : null,
        natureza: pagoNoAto && i === 0 ? 'avulso' : 'pagar', contraparteTipo: 'fornecedor', contraparteId: forn?.id || null, contraparteNome: nomeForn, documento: doc, lojaId: loja,
      }, { chave: `compra:${rec.id}:parcela:${i + 1}`, origem: 'compra', origemId: rec.id, fuso, agora });
      lancamentos.push(r.lancamento);
    }
    return { recebimento: { id: rec.id, valorTotal: Number(rec.valor_total), parcelas, fornecedorNome: nomeForn, nfeChave: rec.nfe_chave || null }, contasAPagar: lancamentos };
  }
}

export async function listarRecebimentos(db, empresaId, { limite = 100 } = {}) {
  const r = await db.query(`SELECT * FROM cmp_recebimentos WHERE empresa_id = $1 ORDER BY criado_em DESC LIMIT ${Math.min(Number(limite) || 100, 500)}`, [exigirUuid(empresaId, 'empresa')]);
  return r.rows.map((x) => ({ id: x.id, lojaId: x.loja_id || null, pedidoId: x.pedido_id || null, fornecedorNome: x.fornecedor_nome, nfeChave: x.nfe_chave || null, nfeNumero: x.nfe_numero || null, emissao: x.emissao, valorTotal: Number(x.valor_total), parcelas: x.parcelas, recebidoPor: x.recebido_por, criadoEm: x.criado_em }));
}

// ── NF-e de entrada ──────────────────────────────────────────────────────────
/**
 * Lê o XML e sugere, para cada item da nota, o item do estoque: primeiro o que já foi usado com
 * aquele fornecedor, depois EAN, SKU e nome. Confere a autorização, o destinatário (CNPJ de uma
 * unidade da empresa) e se a nota já foi lançada.
 */
export async function previaNfe(db, empresaId, xml) {
  const empresa = exigirUuid(empresaId, 'empresa');
  let nota;
  try { nota = lerXmlNfe(xml); } catch (error) { throw new ErroDominio(error?.code || 'XML_INVALIDO', error?.message || 'XML inválido', 422); }
  const cnpjs = (await db.query("SELECT cnpj FROM lojas WHERE empresa_id = $1 AND cnpj IS NOT NULL AND cnpj <> ''", [empresa])).rows.map((r) => r.cnpj);
  const avisos = [];
  if (!nota.autorizada) avisos.push('A nota não traz o protocolo de autorização da SEFAZ (cStat 100/150). Confira antes de lançar.');
  if (!cnpjs.length) avisos.push('Nenhuma unidade desta empresa tem CNPJ cadastrado; não dá para conferir o destinatário. Cadastre o CNPJ em Unidades.');
  else if (!cnpjs.includes(nota.destinatarioCnpj)) avisos.push('O destinatário da nota não é nenhuma unidade desta empresa.');
  const jaLancada = (await db.query('SELECT id FROM cmp_recebimentos WHERE empresa_id = $1 AND nfe_chave = $2', [empresa, nota.chave])).rows[0];
  const forn = (await db.query("SELECT id, nome FROM a2_fornecedores WHERE empresa_id = $1 AND regexp_replace(COALESCE(cnpj, ''), '\\D', '', 'g') = $2 LIMIT 1", [empresa, nota.emitente.cnpj])).rows[0] || null;
  const itensEst = (await db.query('SELECT id, nome, sku, ean, unidade FROM est_itens WHERE empresa_id = $1 AND ativo = true', [empresa])).rows;
  const aprendidos = new Map((await db.query('SELECT codigo, item_id, fator FROM cmp_codigos_fornecedor WHERE empresa_id = $1 AND fornecedor_cnpj = $2', [empresa, nota.emitente.cnpj])).rows.map((r) => [r.codigo, r]));
  const itens = nota.itens.map((i) => {
    const ap = aprendidos.get(i.codigo);
    let sugestao = null; let criterio = 'sem_correspondencia'; let fator = 1;
    if (ap && itensEst.some((e) => e.id === ap.item_id)) { sugestao = ap.item_id; criterio = 'usado_antes'; fator = Number(ap.fator); }
    else if (i.ean && itensEst.find((e) => e.ean === i.ean)) { sugestao = itensEst.find((e) => e.ean === i.ean).id; criterio = 'ean'; }
    else if (itensEst.find((e) => e.sku && (e.sku === i.codigo || (i.ean && e.sku === i.ean)))) { sugestao = itensEst.find((e) => e.sku && (e.sku === i.codigo || (i.ean && e.sku === i.ean))).id; criterio = 'sku'; }
    else if (itensEst.find((e) => normalizar(e.nome) === normalizar(i.descricao))) { sugestao = itensEst.find((e) => normalizar(e.nome) === normalizar(i.descricao)).id; criterio = 'nome'; }
    return { ...i, sugestao, criterio, fator };
  });
  return {
    chave: nota.chave, numero: nota.numero, serie: nota.serie, emissao: nota.emissao, emitente: nota.emitente, destinatarioCnpj: nota.destinatarioCnpj,
    valorProdutos: nota.valorProdutos, valorNota: nota.valorNota, autorizada: nota.autorizada, jaLancada: Boolean(jaLancada), fornecedor: forn, avisos, itens,
  };
}

/**
 * Lança a NF-e: `mapeamento` diz, para cada nItem, o item do estoque (ou cria um novo) e a
 * conversão de unidade. Exige destinatário conferido e nota autorizada, salvo `confirmarAvisos`.
 */
export async function lancarNfe(db, empresaId, { xml, lojaId = null, mapeamento = [], condicaoPagamento = 'a_vista', parcelas = null, confirmarAvisos = false, pagoNoAto = false, meioPagamento = null }, opcoes = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const previa = await previaNfe(db, empresa, xml);
  if (previa.jaLancada) throw new ErroDominio('NFE_DUPLICATE', 'Esta NF-e já foi lançada nesta empresa', 409);
  if (previa.avisos.length && !confirmarAvisos) throw new ErroDominio('NFE_AVISOS', previa.avisos.join(' '), 422);
  const porItem = new Map((Array.isArray(mapeamento) ? mapeamento : []).map((m) => [Number(m.item), m]));
  for (const i of previa.itens) {
    const m = porItem.get(i.item) || {};
    if (!(m.itemId || i.sugestao || m.criarItem)) throw new ErroDominio('ITEM_NAO_MAPEADO', `Diga a que item do estoque corresponde "${i.descricao}" (item ${i.item} da nota)`, 422);
  }
  // itens novos, fornecedor novo e o recebimento entram juntos: se algo falhar, nada fica pela metade
  return transacao(db, async (q) => {
    const itens = [];
    for (const i of previa.itens) {
      const m = porItem.get(i.item) || {};
      let itemId = m.itemId ? exigirUuid(m.itemId, 'item') : i.sugestao;
      if (!itemId) {
        const novo = (await q('INSERT INTO est_itens (empresa_id, nome, unidade, tipo, ean, ncm) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
          [empresa, exigirTexto(m.criarItem.nome || i.descricao, 'Nome', { min: 2, max: 180 }), String(m.criarItem.unidade || 'UN').toUpperCase().slice(0, 10),
            ['mercadoria', 'insumo', 'embalagem', 'uso_consumo'].includes(m.criarItem.tipo) ? m.criarItem.tipo : 'mercadoria', i.ean || null, /^\d{8}$/.test(i.ncm) ? i.ncm : null])).rows[0];
        itemId = novo.id;
      }
      itens.push({ itemId, quantidade: i.quantidade, custoUnitario: i.custoUnitario, codigoFornecedor: i.codigo, fator: m.fator ?? i.fator ?? 1 });
    }
    let fornecedorId = previa.fornecedor?.id || null;
    if (!fornecedorId) {
      fornecedorId = (await q("INSERT INTO a2_fornecedores (empresa_id, nome, cnpj, status) VALUES ($1, $2, $3, 'ativo') RETURNING id", [empresa, previa.emitente.fantasia || previa.emitente.nome, previa.emitente.cnpj])).rows[0].id;
    }
    const preparado = prepararRecebimento(empresa, {
      lojaId, fornecedorId, itens, valorTotal: previa.valorNota, condicaoPagamento, parcelas, pagoNoAto, meioPagamento,
      nfe: { chave: previa.chave, numero: previa.numero, serie: previa.serie, emissao: previa.emissao, emitenteCnpj: previa.emitente.cnpj, emitenteNome: previa.emitente.nome },
    }, opcoes);
    return receberEm(q, empresa, preparado);
  });
}
