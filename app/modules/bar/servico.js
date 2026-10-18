import { randomUUID } from 'node:crypto';
import { ErroDominio, exigirTexto, exigirUuid, transacao } from '../acesso/banco.js';

const SETORES = new Set(['bar', 'cozinha', 'chapa']);
const TIPOS_MESA = new Set(['fisica', 'virtual']);
const MEIOS_PAGAMENTO = new Set(['pix', 'tef', 'cartao', 'dinheiro', 'carteira', 'conta']);
const STATUS_ITEM = new Set(['pendente', 'preparando', 'pronto', 'servido', 'cancelado']);
const TRANSICOES_ITEM = {
  pendente: new Set(['pendente', 'preparando', 'cancelado']),
  preparando: new Set(['preparando', 'pronto', 'cancelado']),
  pronto: new Set(['pronto', 'servido']),
  servido: new Set(['servido']),
  cancelado: new Set(['cancelado']),
};

function empresa(valor) {
  return exigirUuid(valor, 'empresa');
}
function numero(valor, campo, { minimo = 0, maximo = 100000000 } = {}) {
  const n = Number(valor);
  if (!Number.isFinite(n) || n < minimo || n > maximo) throw new ErroDominio('VALIDATION_ERROR', `${campo} inválido`);
  return n;
}
function textoOpcional(valor, maximo = 300) {
  if (valor === undefined || valor === null || valor === '') return null;
  const s = String(valor).trim();
  if (!s || s.length > maximo) throw new ErroDominio('VALIDATION_ERROR', 'texto inválido');
  return s;
}
function dinheiro(valor, campo = 'valor') {
  return Number(numero(valor ?? 0, campo, { minimo: 0, maximo: 100000000 }).toFixed(2));
}
function linhaNumerica(row, campo) {
  return row?.[campo] === null || row?.[campo] === undefined ? 0 : Number(row[campo]);
}
function mapProduto(row) {
  if (!row) return null;
  return {
    id: row.id,
    nome: row.nome,
    cat: row.categoria,
    categoria: row.categoria,
    preco: linhaNumerica(row, 'preco'),
    setor: row.setor,
    unidade: row.unidade,
    fatorEstoque: linhaNumerica(row, 'fator_estoque'),
    estoqueAtual: linhaNumerica(row, 'estoque_atual'),
    estoqueMinimo: linhaNumerica(row, 'estoque_minimo'),
    qtd: linhaNumerica(row, 'estoque_atual'),
    min: linhaNumerica(row, 'estoque_minimo'),
    statusEstoque: linhaNumerica(row, 'estoque_atual') <= 0 ? 'SEM_ESTOQUE' : (linhaNumerica(row, 'estoque_minimo') > 0 && linhaNumerica(row, 'estoque_atual') <= linhaNumerica(row, 'estoque_minimo') ? 'BAIXO' : 'OK'),
    indisponivel: row.ativo === false,
    ativo: row.ativo !== false,
    ordem: row.ordem || 0,
  };
}
function mapMesa(row) {
  return {
    id: row.id,
    num: row.numero,
    numero: row.numero,
    nome: row.nome || '',
    tipo: row.tipo,
    status: row.comanda_status || 'livre',
    comandaId: row.comanda_id || null,
    total: linhaNumerica(row, 'comanda_total'),
  };
}
function mapComanda(row, itens = [], pagamentos = []) {
  const subtotal = linhaNumerica(row, 'total');
  const valorFinal = row.valor_final === null || row.valor_final === undefined ? subtotal : linhaNumerica(row, 'valor_final');
  const valorPago = pagamentos.reduce((soma, pagamento) => soma + linhaNumerica(pagamento, 'valor'), 0);
  return {
    id: row.id,
    empresaId: row.empresa_id,
    mesa: row.mesa_nome || row.mesa_numero ? (row.mesa_nome || `Mesa ${row.mesa_numero}`) : (row.nome || ''),
    mesaNum: row.mesa_numero || null,
    nome: row.nome || '',
    status: row.status,
    total: subtotal,
    subtotal,
    totalFinal: valorFinal,
    valorPago,
    saldoPendente: Math.max(0, Number((valorFinal - valorPago).toFixed(2))),
    clienteId: row.cliente_id || null,
    meioPagamento: row.meio_pagamento || null,
    incluirServico: row.incluir_servico !== false,
    descontoPercentual: linhaNumerica(row, 'desconto_percentual'),
    divididoEm: Number(row.dividido_em || 1),
    pagamentos: pagamentos.map((pagamento) => ({ id: pagamento.id, meio: pagamento.meio, valor: linhaNumerica(pagamento, 'valor'), referencia: pagamento.referencia || null, criadoEm: pagamento.criado_em })),
    abertaEm: row.aberta_em,
    itens: itens.map((item, indice) => ({
      id: item.id,
      idx: indice,
      produtoId: item.produto_id,
      nome: item.produto_nome,
      qtd: linhaNumerica(item, 'quantidade'),
      quantidade: linhaNumerica(item, 'quantidade'),
      preco: linhaNumerica(item, 'valor_unitario'),
      valor: linhaNumerica(item, 'valor_unitario') * linhaNumerica(item, 'quantidade'),
      setor: item.setor,
      obs: item.observacoes || '',
      status: item.status,
    })),
  };
}

export function validarTransicaoStatusItem(atual, proximo) {
  if (!STATUS_ITEM.has(atual) || !STATUS_ITEM.has(proximo)) throw new ErroDominio('STATUS_INVALIDO', 'status de produção inválido');
  if (!TRANSICOES_ITEM[atual]?.has(proximo)) throw new ErroDominio('TRANSICAO_INVALIDA', `não é possível mudar de ${atual} para ${proximo}`);
  return proximo;
}

export function consumoDoEstoque(quantidade, fatorEstoque) {
  const qtd = numero(quantidade, 'quantidade', { minimo: 0.001, maximo: 100000 });
  const fator = numero(fatorEstoque, 'fator de estoque', { minimo: 0.000001, maximo: 100000 });
  return Number((qtd * fator).toFixed(6));
}

export async function listarProdutos(db, empresaId, { apenasAtivos = false } = {}) {
  const emp = empresa(empresaId);
  const filtro = apenasAtivos ? ' AND ativo = true' : '';
  const result = await db.queryRead(`SELECT * FROM bar_produtos WHERE empresa_id = $1${filtro} ORDER BY ordem, categoria, nome`, [emp]);
  return result.rows.map(mapProduto);
}

export async function listarClientesConta(db, empresaId) {
  const result = await db.queryRead(`SELECT id, nome, email, telefone, bloqueado FROM commerce_customers WHERE empresa_id=$1 AND bloqueado=false ORDER BY lower(nome)`, [empresa(empresaId)]);
  return result.rows.map((row) => ({ id: row.id, nome: row.nome, email: row.email || '', telefone: row.telefone || '', status: 'ativo', padrao: false }));
}

export async function salvarProduto(db, empresaId, corpo, id = null) {
  const emp = empresa(empresaId);
  const nome = exigirTexto(corpo?.nome, 'nome', { max: 180 });
  const categoria = exigirTexto(corpo?.categoria || corpo?.cat || 'Geral', 'categoria', { max: 80 });
  const setor = String(corpo?.setor || 'bar').trim().toLowerCase();
  if (!SETORES.has(setor)) throw new ErroDominio('VALIDATION_ERROR', 'setor deve ser bar, cozinha ou chapa');
  const preco = dinheiro(corpo?.preco ?? 0, 'preço');
  const fator = Number(corpo?.fatorEstoque ?? corpo?.fator_estoque ?? 1);
  numero(fator, 'fator de estoque', { minimo: 0.000001, maximo: 100000 });
  const unidade = exigirTexto(corpo?.unidade || 'un', 'unidade', { max: 20 });
  const estoque = corpo?.estoqueAtual === undefined ? 0 : numero(corpo.estoqueAtual, 'estoque atual', { minimo: 0, maximo: 100000000 });
  const minimo = corpo?.estoqueMinimo === undefined ? 0 : numero(corpo.estoqueMinimo, 'estoque mínimo', { minimo: 0, maximo: 100000000 });
  const ordem = corpo?.ordem === undefined ? 0 : numero(corpo.ordem, 'ordem', { minimo: 0, maximo: 1000000 });
  if (!id) {
    try {
      const result = await db.query(`INSERT INTO bar_produtos (empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`, [emp, nome, categoria, setor, preco, unidade, fator, estoque, minimo, ordem]);
      return mapProduto(result.rows[0]);
    } catch (error) {
      if (error?.code === '23505') throw new ErroDominio('CONFLICT', 'já existe um produto com este nome', 409);
      throw error;
    }
  }
  const produtoId = exigirUuid(id, 'produto');
  const ativoInformado = corpo.ativo === undefined && corpo.indisponivel !== undefined ? !Boolean(corpo.indisponivel) : (corpo.ativo === undefined ? null : Boolean(corpo.ativo));
  const result = await db.query(`UPDATE bar_produtos SET nome=$1, categoria=$2, setor=$3, preco=$4, unidade=$5, fator_estoque=$6, estoque_minimo=$7, ordem=$9, ativo=COALESCE($8, ativo), atualizado_em=CURRENT_TIMESTAMP WHERE empresa_id=$10 AND id=$11 RETURNING *`, [nome, categoria, setor, preco, unidade, fator, minimo, ativoInformado, ordem, emp, produtoId]);
  if (!result.rows[0]) throw new ErroDominio('NOT_FOUND', 'produto não encontrado', 404);
  return mapProduto(result.rows[0]);
}

export async function removerProduto(db, empresaId, id) {
  const result = await db.query('UPDATE bar_produtos SET ativo = false, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2 RETURNING id', [empresa(empresaId), exigirUuid(id, 'produto')]);
  if (!result.rows[0]) throw new ErroDominio('NOT_FOUND', 'produto não encontrado', 404);
  return { ok: true };
}

export async function listarMesas(db, empresaId) {
  const result = await db.queryRead(`SELECT m.*, c.id AS comanda_id, c.status AS comanda_status, c.total AS comanda_total FROM bar_mesas m LEFT JOIN bar_comandas c ON c.empresa_id=m.empresa_id AND c.mesa_id=m.id AND c.status IN ('aberta','conta') WHERE m.empresa_id=$1 AND m.ativa=true ORDER BY m.tipo, m.numero`, [empresa(empresaId)]);
  return {
    fisicas: result.rows.filter((row) => row.tipo === 'fisica').map(mapMesa),
    virtuais: result.rows.filter((row) => row.tipo === 'virtual').map(mapMesa),
  };
}

export async function salvarMesa(db, empresaId, corpo, id = null) {
  const emp = empresa(empresaId);
  const numero = numeroInteiro(corpo?.numero ?? corpo?.num, 'número da mesa');
  const tipo = String(corpo?.tipo || 'fisica').trim().toLowerCase();
  if (!TIPOS_MESA.has(tipo)) throw new ErroDominio('VALIDATION_ERROR', 'tipo de mesa inválido');
  const nome = textoOpcional(corpo?.nome, 120);
  if (id) {
    const mesaId = exigirUuid(id, 'mesa');
    const result = await db.query('UPDATE bar_mesas SET numero=$1, nome=$2, tipo=$3, atualizado_em=CURRENT_TIMESTAMP WHERE empresa_id=$4 AND id=$5 AND ativa=true RETURNING *', [numero, nome, tipo, emp, mesaId]);
    if (!result.rows[0]) throw new ErroDominio('NOT_FOUND', 'mesa não encontrada', 404);
    return result.rows[0];
  }
  try {
    const result = await db.query('INSERT INTO bar_mesas (empresa_id, numero, nome, tipo) VALUES ($1,$2,$3,$4) RETURNING *', [emp, numero, nome, tipo]);
    return result.rows[0];
  } catch (error) {
    if (error?.code === '23505') throw new ErroDominio('CONFLICT', 'já existe uma mesa com este número', 409);
    throw error;
  }
}
function numeroInteiro(valor, campo) {
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 1 || n > 100000) throw new ErroDominio('VALIDATION_ERROR', `${campo} inválido`);
  return n;
}
export async function removerMesa(db, empresaId, id) {
  const result = await db.query('UPDATE bar_mesas SET ativa=false, atualizado_em=CURRENT_TIMESTAMP WHERE empresa_id=$1 AND id=$2 RETURNING id', [empresa(empresaId), exigirUuid(id, 'mesa')]);
  if (!result.rows[0]) throw new ErroDominio('NOT_FOUND', 'mesa não encontrada', 404);
  return { ok: true };
}

async function obterComandaRow(db, empresaId, id, bloqueio = false) {
  const bloqueioSql = bloqueio ? ' FOR UPDATE' : '';
  const result = await db.query(`SELECT c.*, m.numero AS mesa_numero, m.nome AS mesa_nome FROM bar_comandas c LEFT JOIN bar_mesas m ON m.empresa_id=c.empresa_id AND m.id=c.mesa_id WHERE c.empresa_id=$1 AND c.id=$2${bloqueioSql}`, [empresa(empresaId), exigirUuid(id, 'comanda')]);
  if (!result.rows[0]) throw new ErroDominio('NOT_FOUND', 'comanda não encontrada', 404);
  return result.rows[0];
}
async function itensDaComanda(db, empresaId, comandaId) {
  const result = await db.queryRead(`SELECT i.*, p.nome AS produto_nome, p.setor FROM bar_comanda_itens i JOIN bar_produtos p ON p.empresa_id=i.empresa_id AND p.id=i.produto_id WHERE i.empresa_id=$1 AND i.comanda_id=$2 AND i.status <> 'cancelado' ORDER BY i.criado_em, i.id`, [empresa(empresaId), exigirUuid(comandaId, 'comanda')]);
  return result.rows;
}
export async function obterComanda(db, empresaId, id) {
  const row = await obterComandaRow(db, empresaId, id);
  const pagamentos = await db.queryRead('SELECT id, meio, valor, referencia, criado_em FROM bar_comanda_pagamentos WHERE empresa_id=$1 AND comanda_id=$2 ORDER BY criado_em, id', [empresa(empresaId), exigirUuid(id, 'comanda')]);
  return mapComanda(row, await itensDaComanda(db, empresaId, id), pagamentos.rows);
}

export async function abrirComanda(db, empresaId, { mesaId = null, nome = null, operadorId = null } = {}) {
  const emp = empresa(empresaId);
  const resultado = await transacao(db, async (q) => {
    await q('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`bar:mesa:${emp}:${mesaId || nome || randomUUID()}`]);
    let mesa = null;
    if (mesaId) {
      const mesaResult = await q('SELECT * FROM bar_mesas WHERE empresa_id=$1 AND id=$2 AND ativa=true FOR UPDATE', [emp, exigirUuid(mesaId, 'mesa')]);
      mesa = mesaResult.rows[0];
      if (!mesa) throw new ErroDominio('NOT_FOUND', 'mesa não encontrada', 404);
      const existente = await q("SELECT * FROM bar_comandas WHERE empresa_id=$1 AND mesa_id=$2 AND status IN ('aberta','conta') LIMIT 1", [emp, mesa.id]);
      if (existente.rows[0]) return existente.rows[0];
    }
    const result = await q('INSERT INTO bar_comandas (empresa_id, mesa_id, nome, operador_id) VALUES ($1,$2,$3,$4) RETURNING *', [emp, mesa?.id || null, textoOpcional(nome, 120), textoOpcional(operadorId, 180)]);
    return result.rows[0];
  });
  return obterComanda(db, emp, resultado.id);
}
export async function abrirComandaMesa(db, empresaId, numero, corpo = {}, operadorId = null) {
  const mesaResult = await db.queryRead('SELECT id FROM bar_mesas WHERE empresa_id=$1 AND numero=$2 AND tipo=$3 AND ativa=true', [empresa(empresaId), numeroInteiro(numero, 'número da mesa'), 'fisica']);
  if (!mesaResult.rows[0]) throw new ErroDominio('NOT_FOUND', 'mesa não encontrada', 404);
  return abrirComanda(db, empresaId, { mesaId: mesaResult.rows[0].id, nome: corpo?.nome, operadorId });
}
export async function abrirMesaVirtual(db, empresaId, corpo = {}, operadorId = null) {
  const emp = empresa(empresaId);
  const mesa = await salvarMesa(db, emp, { numero: corpo.numero || Math.floor(Date.now() / 1000) % 100000, nome: exigirTexto(corpo.nome, 'nome', { max: 120 }), tipo: 'virtual' });
  return abrirComanda(db, emp, { mesaId: mesa.id, nome: corpo.nome, operadorId });
}

export async function adicionarItens(db, empresaId, comandaId, itens, operadorId = null) {
  const emp = empresa(empresaId);
  if (!Array.isArray(itens) || itens.length === 0 || itens.length > 50) throw new ErroDominio('VALIDATION_ERROR', 'informe ao menos um item');
  await transacao(db, async (q) => {
    const comanda = await q("SELECT id, status FROM bar_comandas WHERE empresa_id=$1 AND id=$2 FOR UPDATE", [emp, exigirUuid(comandaId, 'comanda')]);
    if (!comanda.rows[0]) throw new ErroDominio('NOT_FOUND', 'comanda não encontrada', 404);
    if (!['aberta', 'conta'].includes(comanda.rows[0].status)) throw new ErroDominio('COMANDA_FECHADA', 'comanda não está aberta', 409);
    if (comanda.rows[0].status === 'conta') await q("UPDATE bar_comandas SET status='aberta' WHERE empresa_id=$1 AND id=$2", [emp, comandaId]);
    for (const entrada of itens) {
      const produtoId = exigirUuid(entrada?.produtoId || entrada?.produto_id, 'produto');
      const qtd = numero(entrada?.qtd ?? entrada?.quantidade ?? 1, 'quantidade', { minimo: 0.001, maximo: 100000 });
      const produto = await q('SELECT * FROM bar_produtos WHERE empresa_id=$1 AND id=$2 AND ativo=true FOR UPDATE', [emp, produtoId]);
      if (!produto.rows[0]) throw new ErroDominio('NOT_FOUND', 'produto não encontrado', 404);
      const p = produto.rows[0];
      const consumo = consumoDoEstoque(qtd, p.fator_estoque);
      if (Number(p.estoque_atual) < consumo) throw new ErroDominio('ESTOQUE_INSUFICIENTE', `estoque insuficiente para ${p.nome}`, 409);
      await q('UPDATE bar_produtos SET estoque_atual=estoque_atual-$1, atualizado_em=CURRENT_TIMESTAMP WHERE empresa_id=$2 AND id=$3', [consumo, emp, produtoId]);
      const item = await q('INSERT INTO bar_comanda_itens (empresa_id, comanda_id, produto_id, quantidade, valor_unitario, consumo_estoque, observacoes, status) VALUES ($1,$2,$3,$4,$5,$6,$7,\'pendente\') RETURNING id', [emp, comandaId, produtoId, qtd, p.preco, consumo, textoOpcional(entrada?.obs || entrada?.observacoes, 300)]);
      await q('INSERT INTO bar_estoque_movimentos (empresa_id, produto_id, tipo, quantidade, saldo_apos, origem, referencia_id, criado_por) SELECT $1,$2,\'saida\',$3,estoque_atual,\'comanda\',$4,$5 FROM bar_produtos WHERE empresa_id=$1 AND id=$2', [emp, produtoId, consumo, comandaId, textoOpcional(operadorId, 180)]);
      await q('INSERT INTO bar_fila_impressao (empresa_id, item_id, setor) VALUES ($1,$2,$3)', [emp, item.rows[0].id, p.setor]);
    }
    await q('UPDATE bar_comandas SET total=COALESCE((SELECT SUM(quantidade*valor_unitario) FROM bar_comanda_itens WHERE empresa_id=$1 AND comanda_id=$2 AND status <> \'cancelado\'),0), atualizado_em=CURRENT_TIMESTAMP WHERE empresa_id=$1 AND id=$2', [emp, comandaId]);
  });
  return obterComanda(db, emp, comandaId);
}

export async function cancelarItemPorIndice(db, empresaId, comandaId, indice, operadorId = null) {
  const emp = empresa(empresaId);
  return transacao(db, async (q) => {
    const items = await q("SELECT i.*, p.nome AS produto_nome FROM bar_comanda_itens i JOIN bar_produtos p ON p.empresa_id=i.empresa_id AND p.id=i.produto_id WHERE i.empresa_id=$1 AND i.comanda_id=$2 AND i.status <> 'cancelado' ORDER BY i.criado_em, i.id", [emp, exigirUuid(comandaId, 'comanda')]);
    const item = items.rows[Number(indice)];
    if (!item) throw new ErroDominio('NOT_FOUND', 'item não encontrado', 404);
    await q('UPDATE bar_comanda_itens SET status=\'cancelado\', atualizado_em=CURRENT_TIMESTAMP WHERE empresa_id=$1 AND id=$2', [emp, item.id]);
    await q('UPDATE bar_produtos SET estoque_atual=estoque_atual+$1, atualizado_em=CURRENT_TIMESTAMP WHERE empresa_id=$2 AND id=$3', [item.consumo_estoque, emp, item.produto_id]);
    await q('INSERT INTO bar_estoque_movimentos (empresa_id, produto_id, tipo, quantidade, saldo_apos, origem, referencia_id, criado_por) SELECT $1,$2,\'entrada\',$3,estoque_atual,\'cancelamento\',$4,$5 FROM bar_produtos WHERE empresa_id=$1 AND id=$2', [emp, item.produto_id, item.consumo_estoque, comandaId, textoOpcional(operadorId, 180)]);
    await q('UPDATE bar_comandas SET total=COALESCE((SELECT SUM(quantidade*valor_unitario) FROM bar_comanda_itens WHERE empresa_id=$1 AND comanda_id=$2 AND status <> \'cancelado\'),0), atualizado_em=CURRENT_TIMESTAMP WHERE empresa_id=$1 AND id=$2', [emp, comandaId]);
    return { ok: true };
  });
}

export async function atualizarStatusItem(db, empresaId, comandaId, itemId, status) {
  const emp = empresa(empresaId);
  const proximo = String(status || '').trim().toLowerCase();
  return transacao(db, async (q) => {
    const result = await q('SELECT status FROM bar_comanda_itens WHERE empresa_id=$1 AND comanda_id=$2 AND id=$3 FOR UPDATE', [emp, exigirUuid(comandaId, 'comanda'), exigirUuid(itemId, 'item')]);
    if (!result.rows[0]) throw new ErroDominio('NOT_FOUND', 'item não encontrado', 404);
    validarTransicaoStatusItem(result.rows[0].status, proximo);
    const atualizado = await q('UPDATE bar_comanda_itens SET status=$1, atualizado_em=CURRENT_TIMESTAMP WHERE empresa_id=$2 AND comanda_id=$3 AND id=$4 RETURNING *', [proximo, emp, comandaId, itemId]);
    return atualizado.rows[0];
  });
}

export async function listarPedidosKds(db, empresaId, { setor = null } = {}) {
  const emp = empresa(empresaId);
  const values = [emp];
  const setorSql = setor && SETORES.has(String(setor).toLowerCase()) ? ' AND i.setor = $2' : '';
  if (setorSql) values.push(String(setor).toLowerCase());
  const result = await db.queryRead(`SELECT i.id, i.comanda_id, i.quantidade, i.valor_unitario, i.observacoes, i.status, i.criado_em, p.nome, i.setor, m.numero AS mesa_numero, m.nome AS mesa_nome FROM bar_comanda_itens i JOIN bar_produtos p ON p.empresa_id=i.empresa_id AND p.id=i.produto_id JOIN bar_comandas c ON c.empresa_id=i.empresa_id AND c.id=i.comanda_id LEFT JOIN bar_mesas m ON m.empresa_id=c.empresa_id AND m.id=c.mesa_id WHERE i.empresa_id=$1 AND i.status <> 'cancelado' AND c.status IN ('aberta','conta')${setorSql} ORDER BY i.criado_em`, values);
  return result.rows.map((row) => ({ ...row, id: row.id, comandaId: row.comanda_id, nome: row.nome, qtd: Number(row.quantidade), mesaNum: row.mesa_numero, mesa: row.mesa_nome || (row.mesa_numero ? `Mesa ${row.mesa_numero}` : ''), obs: row.observacoes || '' }));
}

export async function marcarConta(db, empresaId, id) {
  const result = await db.query("UPDATE bar_comandas SET status='conta', atualizado_em=CURRENT_TIMESTAMP WHERE empresa_id=$1 AND id=$2 AND status='aberta' RETURNING *", [empresa(empresaId), exigirUuid(id, 'comanda')]);
  if (!result.rows[0]) throw new ErroDominio('NOT_FOUND', 'comanda aberta não encontrada', 404);
  return obterComanda(db, empresaId, id);
}
export async function pagarComanda(db, empresaId, id, corpo = {}) {
  const emp = empresa(empresaId);
  const comandaId = exigirUuid(id, 'comanda');
  let resposta;
  await transacao(db, async (q) => {
    const atual = await q("SELECT * FROM bar_comandas WHERE empresa_id=$1 AND id=$2 AND status IN ('aberta','conta') FOR UPDATE", [emp, comandaId]);
    if (!atual.rows[0]) throw new ErroDominio('NOT_FOUND', 'comanda não encontrada ou já paga', 404);
    const row = atual.rows[0];
    const meio = String(corpo.meio || 'dinheiro').trim().toLowerCase();
    const meios = Array.isArray(corpo.meios) && corpo.meios.length
      ? corpo.meios.map((pagamento) => ({ meio: String(pagamento?.meio || '').trim().toLowerCase(), valor: dinheiro(pagamento?.valor, 'valor do pagamento'), referencia: textoOpcional(pagamento?.referencia || pagamento?.nsu, 180) }))
      : [{ meio, valor: null, referencia: textoOpcional(corpo.tef?.nsu || corpo.tef?.referencia, 180) }];
    if (meios.some((pagamento) => !MEIOS_PAGAMENTO.has(pagamento.meio))) throw new ErroDominio('VALIDATION_ERROR', 'forma de pagamento inválida');
    const desconto = corpo.desconto === undefined || corpo.desconto === null ? 0 : numero(corpo.desconto, 'desconto', { minimo: 0, maximo: 100 });
    const incluirServico = corpo.servico === undefined ? true : Boolean(corpo.servico);
    const divididoEm = corpo.dividir === undefined ? 1 : Math.max(1, Math.min(99, Math.trunc(numero(corpo.dividir, 'divisão', { minimo: 1, maximo: 99 }))));
    let clienteId = corpo.clienteId ? exigirUuid(corpo.clienteId, 'cliente') : row.cliente_id || null;
    if (meios.some((pagamento) => pagamento.meio === 'conta') && !clienteId) throw new ErroDominio('CUSTOMER_REQUIRED', 'selecione um cliente para lançar a venda em conta');
    if (clienteId) {
      const cliente = await q('SELECT id FROM commerce_customers WHERE empresa_id=$1 AND id=$2 AND bloqueado=false LIMIT 1', [emp, clienteId]);
      if (!cliente.rows[0]) throw new ErroDominio('CUSTOMER_NOT_FOUND', 'cliente não encontrado nesta empresa', 404);
    }
    const subtotal = linhaNumerica(row, 'total');
    const valorComDesconto = subtotal * (1 - desconto / 100);
    const valorFinal = Number((valorComDesconto + (incluirServico ? valorComDesconto * 0.1 : 0)).toFixed(2));
    const pagos = await q('SELECT COALESCE(SUM(valor),0) AS total FROM bar_comanda_pagamentos WHERE empresa_id=$1 AND comanda_id=$2', [emp, comandaId]);
    const jaPago = linhaNumerica(pagos.rows[0], 'total');
    const saldo = Number(Math.max(0, valorFinal - jaPago).toFixed(2));
    if (meios.some((pagamento) => pagamento.valor !== null) && meios.reduce((soma, pagamento) => soma + Number(pagamento.valor || 0), 0) > saldo + 0.01) {
      throw new ErroDominio('PAYMENT_EXCEEDS_BALANCE', `pagamento maior que o saldo pendente de R$ ${saldo.toFixed(2)}`, 409);
    }
    const valorLancado = meios.reduce((soma, pagamento) => soma + (pagamento.valor === null ? saldo : pagamento.valor), 0);
    if (valorLancado <= 0) throw new ErroDominio('VALIDATION_ERROR', 'valor do pagamento deve ser maior que zero');
    for (const pagamento of meios) {
      const valor = pagamento.valor === null ? saldo : pagamento.valor;
      if (valor <= 0) continue;
      await q('INSERT INTO bar_comanda_pagamentos (empresa_id, comanda_id, meio, valor, referencia) VALUES ($1,$2,$3,$4,$5)', [emp, comandaId, pagamento.meio, valor, pagamento.referencia]);
    }
    const totalPago = Number((jaPago + valorLancado).toFixed(2));
    const quitada = totalPago + 0.01 >= valorFinal;
    const status = quitada ? 'paga' : 'conta';
    await q(`UPDATE bar_comandas SET status=$1, cliente_id=$2, meio_pagamento=$3, desconto_percentual=$4, incluir_servico=$5, valor_final=$6, dividido_em=$7, cpf_nota=$8, tef_referencia=$9, pagamentos=(SELECT COALESCE(jsonb_agg(jsonb_build_object('meio', meio, 'valor', valor, 'referencia', referencia) ORDER BY criado_em), '[]'::jsonb) FROM bar_comanda_pagamentos WHERE empresa_id=$10 AND comanda_id=$11), fechada_em=CASE WHEN $12 THEN CURRENT_TIMESTAMP ELSE fechada_em END, atualizado_em=CURRENT_TIMESTAMP WHERE empresa_id=$10 AND id=$11`, [status, clienteId, meios[0].meio, desconto, incluirServico, valorFinal, divididoEm, textoOpcional(corpo.cpf, 14), meios.find((pagamento) => pagamento.referencia)?.referencia || null, emp, comandaId, quitada]);
    resposta = { quitada, saldoPendente: Math.max(0, Number((valorFinal - totalPago).toFixed(2))), valorFinal };
  });
  return { ok: true, ...resposta, comanda: await obterComanda(db, emp, comandaId) };
}

export async function abrirCaixa(db, empresaId, corpo = {}, operadorId = null) {
  const emp = empresa(empresaId);
  const saldo = dinheiro(corpo.saldoInicial ?? corpo.abertura ?? 0, 'saldo inicial');
  try {
    const result = await db.query('INSERT INTO bar_caixas (empresa_id, saldo_inicial, saldo_atual, operador_id) VALUES ($1,$2,$2,$3) RETURNING *', [emp, saldo, textoOpcional(operadorId, 180)]);
    return result.rows[0];
  } catch (error) {
    if (error?.code === '23505') throw new ErroDominio('CAIXA_ABERTO', 'já existe um caixa aberto para esta empresa', 409);
    throw error;
  }
}
export async function registrarMovimentoCaixa(db, empresaId, corpo = {}, operadorId = null) {
  const emp = empresa(empresaId);
  const tipo = String(corpo.tipo || '').trim().toLowerCase();
  if (!['sangria', 'suprimento'].includes(tipo)) throw new ErroDominio('VALIDATION_ERROR', 'tipo de movimento inválido');
  const valor = dinheiro(corpo.valor, 'valor');
  if (valor <= 0) throw new ErroDominio('VALIDATION_ERROR', 'valor deve ser maior que zero');
  return transacao(db, async (q) => {
    const caixa = await q("SELECT * FROM bar_caixas WHERE empresa_id=$1 AND status='aberto' FOR UPDATE", [emp]);
    if (!caixa.rows[0]) throw new ErroDominio('CAIXA_FECHADO', 'não há caixa aberto', 409);
    const atual = Number(caixa.rows[0].saldo_atual) + (tipo === 'suprimento' ? valor : -valor);
    if (atual < 0) throw new ErroDominio('SALDO_INSUFICIENTE', 'sangria maior que o saldo do caixa', 409);
    const mov = await q('INSERT INTO bar_caixa_movimentos (empresa_id, caixa_id, tipo, valor, motivo, criado_por) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [emp, caixa.rows[0].id, tipo, valor, textoOpcional(corpo.motivo, 300), textoOpcional(operadorId, 180)]);
    await q('UPDATE bar_caixas SET saldo_atual=$1 WHERE empresa_id=$2 AND id=$3', [atual, emp, caixa.rows[0].id]);
    return mov.rows[0];
  });
}
export async function resumoCaixa(db, empresaId) {
  const result = await db.queryRead(`SELECT c.*, COALESCE((SELECT SUM(valor) FROM bar_caixa_movimentos m WHERE m.empresa_id=c.empresa_id AND m.caixa_id=c.id AND m.tipo='sangria'),0) AS sangrias, COALESCE((SELECT SUM(valor) FROM bar_caixa_movimentos m WHERE m.empresa_id=c.empresa_id AND m.caixa_id=c.id AND m.tipo='suprimento'),0) AS suprimentos, COALESCE((SELECT SUM(COALESCE(v.valor_final, v.total)) FROM bar_comandas v WHERE v.empresa_id=c.empresa_id AND v.status='paga' AND v.fechada_em >= c.aberto_em),0) AS vendas FROM bar_caixas c WHERE c.empresa_id=$1 AND c.status='aberto' ORDER BY c.aberto_em DESC LIMIT 1`, [empresa(empresaId)]);
  const row = result.rows[0];
  if (!row) return { abertura: 0, sangrias: 0, suprimentos: 0, vendas: 0, saldo: 0, aberto: false };
  return { abertura: linhaNumerica(row, 'saldo_inicial'), sangrias: linhaNumerica(row, 'sangrias'), suprimentos: linhaNumerica(row, 'suprimentos'), vendas: linhaNumerica(row, 'vendas'), saldo: linhaNumerica(row, 'saldo_atual'), aberto: true, id: row.id };
}
export async function listarVendas(db, empresaId, { hoje = false } = {}) {
  const emp = empresa(empresaId);
  const filtro = hoje ? " AND fechada_em >= CURRENT_DATE" : '';
  const result = await db.queryRead(`SELECT id, nome, total, valor_final, status, fechada_em FROM bar_comandas WHERE empresa_id=$1 AND status='paga'${filtro} ORDER BY fechada_em DESC LIMIT 200`, [emp]);
  return result.rows.map((row) => ({ id: row.id, nome: row.nome || '', total: row.valor_final === null || row.valor_final === undefined ? linhaNumerica(row, 'total') : linhaNumerica(row, 'valor_final'), subtotal: linhaNumerica(row, 'total'), status: row.status, data: row.fechada_em }));
}

export async function registrarMovimentoEstoque(db, empresaId, corpo = {}, operadorId = null) {
  const emp = empresa(empresaId);
  const produtoId = exigirUuid(corpo.produtoId || corpo.produto_id, 'produto');
  const tipo = String(corpo.tipo || '').trim().toLowerCase();
  if (!['entrada', 'saida', 'ajuste'].includes(tipo)) throw new ErroDominio('VALIDATION_ERROR', 'tipo de movimento de estoque inválido');
  const quantidade = numero(corpo.quantidade ?? corpo.qtd, 'quantidade', { minimo: 0.000001, maximo: 100000000 });
  return transacao(db, async (q) => {
    const produto = await q('SELECT * FROM bar_produtos WHERE empresa_id=$1 AND id=$2 FOR UPDATE', [emp, produtoId]);
    if (!produto.rows[0]) throw new ErroDominio('NOT_FOUND', 'produto não encontrado', 404);
    const atual = Number(produto.rows[0].estoque_atual);
    const novo = tipo === 'entrada' ? atual + quantidade : tipo === 'saida' ? atual - quantidade : quantidade;
    if (novo < 0) throw new ErroDominio('ESTOQUE_INSUFICIENTE', 'estoque não pode ficar negativo', 409);
    const atualizado = await q('UPDATE bar_produtos SET estoque_atual=$1, atualizado_em=CURRENT_TIMESTAMP WHERE empresa_id=$2 AND id=$3 RETURNING *', [novo, emp, produtoId]);
    const movimento = await q('INSERT INTO bar_estoque_movimentos (empresa_id, produto_id, tipo, quantidade, saldo_apos, origem, observacao, criado_por) VALUES ($1,$2,$3,$4,$5,\'manual\',$6,$7) RETURNING *', [emp, produtoId, tipo, quantidade, novo, textoOpcional(corpo.observacao, 300), textoOpcional(operadorId, 180)]);
    return { produto: mapProduto(atualizado.rows[0]), movimento: movimento.rows[0] };
  });
}

export async function importarLegado(db, empresaId, dados, { aplicar = false } = {}) {
  const emp = empresa(empresaId);
  const produtos = Array.isArray(dados?.cardapio) ? dados.cardapio : [];
  const mesas = Array.isArray(dados?.mesas) ? dados.mesas : [];
  const resumo = { produtos: produtos.length, mesas: mesas.length, novosProdutos: 0, novasMesas: 0, ignorados: 0 };
  if (!aplicar) return { aplicar: false, resumo, aviso: 'prévia; envie aplicar=true somente após conferir o de-para' };
  await transacao(db, async (q) => {
    for (const item of produtos) {
      const origemId = String(item.id || '').trim();
      if (!origemId) { resumo.ignorados += 1; continue; }
      const ja = await q('SELECT 1 FROM bar_importacoes_legado WHERE empresa_id=$1 AND origem=\'json-evento\' AND origem_tipo=\'produto\' AND origem_id=$2', [emp, origemId]);
      if (ja.rows[0]) continue;
      const inserted = await q('INSERT INTO bar_produtos (empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, ordem) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (empresa_id,nome) DO UPDATE SET preco=EXCLUDED.preco, setor=EXCLUDED.setor, atualizado_em=CURRENT_TIMESTAMP RETURNING id', [emp, exigirTexto(item.nome || 'Produto importado', 'nome', { max: 180 }), String(item.cat || item.categoria || 'Geral').slice(0, 80), SETORES.has(String(item.setor || 'bar')) ? String(item.setor || 'bar') : 'bar', dinheiro(item.preco || 0, 'preço'), String(item.unidade || 'un').slice(0, 20), Number(item.fatorEstoque || 1), Number(item.estoqueAtual || 0), Number(item.ordem || 0)]);
      await q('INSERT INTO bar_importacoes_legado (empresa_id, origem, origem_tipo, origem_id, destino_id) VALUES ($1,\'json-evento\',\'produto\',$2,$3) ON CONFLICT DO NOTHING', [emp, origemId, inserted.rows[0].id]);
      resumo.novosProdutos += 1;
    }
    for (const item of mesas) {
      const origemId = String(item.id || item.num || '').trim();
      if (!origemId) { resumo.ignorados += 1; continue; }
      const ja = await q('SELECT 1 FROM bar_importacoes_legado WHERE empresa_id=$1 AND origem=\'json-evento\' AND origem_tipo=\'mesa\' AND origem_id=$2', [emp, origemId]);
      if (ja.rows[0]) continue;
      const numeroMesa = numeroInteiro(item.num || item.numero, 'número da mesa');
      const inserted = await q('INSERT INTO bar_mesas (empresa_id, numero, nome, tipo) VALUES ($1,$2,$3,$4) ON CONFLICT (empresa_id,numero) DO UPDATE SET nome=EXCLUDED.nome, ativa=true RETURNING id', [emp, numeroMesa, textoOpcional(item.nome, 120), item.tipo === 'virtual' ? 'virtual' : 'fisica']);
      await q('INSERT INTO bar_importacoes_legado (empresa_id, origem, origem_tipo, origem_id, destino_id) VALUES ($1,\'json-evento\',\'mesa\',$2,$3) ON CONFLICT DO NOTHING', [emp, origemId, inserted.rows[0].id]);
      resumo.novasMesas += 1;
    }
  });
  return { aplicar: true, resumo };
}
