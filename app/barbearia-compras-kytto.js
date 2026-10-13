// KYTTO — Compras e estoque da revenda da Barbearia.
// Fornecedores, pedidos de compra com recebimento parcial, entrada por XML de
// NF-e (com prévia e sem duplicar a mesma nota), sugestão de reposição pelo
// estoque mínimo e pelo giro, e curva ABC com margem.
//
// Nada aqui gera pagamento ou lançamento financeiro: a conta a pagar continua
// sendo decisão da gestão. Toda entrada de estoque passa por
// barbearia.entradaEstoqueRevenda (custo médio + movimento auditável).

import crypto from 'node:crypto';
import { DOMParser } from '@xmldom/xmldom';
import { db, save } from './db.js';
import * as barbearia from './barbearia-erp-kytto.js';

export class ComprasError extends Error {
  constructor(message, code = 'COMPRAS_ERRO', status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const DIA_MS = 24 * 60 * 60 * 1000;
const texto = (valor, limite = 240) => String(valor ?? '').trim().replace(/\s+/g, ' ').slice(0, limite);
const soDigitos = (valor) => String(valor ?? '').replace(/\D/g, '');
const dinheiro = (valor) => Number((Number(valor) || 0).toFixed(2));
const numero = (valor, padrao = 0) => { if (valor === undefined || valor === null || String(valor).trim() === '') return padrao; const n = Number(String(valor).replace(',', '.')); return Number.isFinite(n) ? n : padrao; };
const agoraIso = (opcoes = {}) => new Date(opcoes.agora ? new Date(opcoes.agora).valueOf() : Date.now()).toISOString();
const novoId = (prefixo) => `${prefixo}-${crypto.randomBytes(5).toString('hex')}`;

export const STATUS_PEDIDO = Object.freeze(['rascunho', 'enviado', 'recebido_parcial', 'recebido', 'cancelado']);

function estado(empresaId) {
  const raiz = db();
  raiz.barbeariaCompras ||= {};
  const chave = String(empresaId || '');
  raiz.barbeariaCompras[chave] ||= {};
  const atual = raiz.barbeariaCompras[chave];
  atual.fornecedores ||= {};
  atual.pedidos ||= {};
  atual.notasEntrada ||= {};
  // Vínculo aprendido: código do produto no fornecedor (CNPJ:cProd) → produto da revenda.
  atual.vinculos ||= {};
  atual.sequenciaPedido = Number(atual.sequenciaPedido || 0);
  return atual;
}

function cnpjValido(cnpj) {
  const d = soDigitos(cnpj);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const calc = (base) => {
    let soma = 0; let peso = base.length - 7;
    for (let i = 0; i < base.length; i += 1) { soma += Number(base[i]) * peso; peso = peso === 2 ? 9 : peso - 1; }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return calc(d.slice(0, 12)) === Number(d[12]) && calc(d.slice(0, 13)) === Number(d[13]);
}

// ── Fornecedores ────────────────────────────────────────────────────────────

function fornecedorNormalizado(dados = {}, anterior = {}) {
  const cnpj = soDigitos(dados.cnpj ?? anterior.cnpj);
  if (cnpj && !cnpjValido(cnpj)) throw new ComprasError('CNPJ do fornecedor inválido.', 'CNPJ_INVALIDO');
  return {
    nome: texto(dados.nome ?? anterior.nome, 160),
    cnpj: cnpj || '',
    contato: texto(dados.contato ?? anterior.contato, 120),
    telefone: texto(dados.telefone ?? anterior.telefone, 30),
    email: texto(dados.email ?? anterior.email, 160).toLowerCase(),
    prazoEntregaDias: Math.max(0, Math.min(120, Math.round(numero(dados.prazoEntregaDias ?? anterior.prazoEntregaDias, 7)))),
    condicaoPagamento: texto(dados.condicaoPagamento ?? anterior.condicaoPagamento, 120),
    observacoes: texto(dados.observacoes ?? anterior.observacoes, 500),
    ativo: dados.ativo ?? anterior.ativo ?? true,
  };
}

export function listarFornecedores(empresaId, { incluirInativos = false } = {}) {
  return Object.values(estado(empresaId).fornecedores)
    .filter((item) => incluirInativos || item.ativo !== false)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    .map((item) => ({ ...item }));
}

export function salvarFornecedor(empresaId, dados = {}, fornecedorId = '') {
  const atual = estado(empresaId);
  const anterior = fornecedorId ? atual.fornecedores[String(fornecedorId)] : null;
  if (fornecedorId && !anterior) throw new ComprasError('Fornecedor não encontrado.', 'FORNECEDOR_NAO_ENCONTRADO', 404);
  const fornecedor = fornecedorNormalizado(dados, anterior || {});
  if (!fornecedor.nome) throw new ComprasError('Nome do fornecedor é obrigatório.', 'FORNECEDOR_SEM_NOME');
  const duplicado = Object.values(atual.fornecedores).find((item) => item.id !== anterior?.id && item.ativo !== false && fornecedor.cnpj && item.cnpj === fornecedor.cnpj);
  if (duplicado) throw new ComprasError(`Já existe o fornecedor ${duplicado.nome} com este CNPJ.`, 'FORNECEDOR_DUPLICADO', 409);
  const agora = agoraIso();
  if (anterior) {
    Object.assign(anterior, fornecedor, { atualizadoEm: agora });
  } else {
    const id = novoId('forn');
    atual.fornecedores[id] = { id, empresaId: String(empresaId), ...fornecedor, criadoEm: agora, atualizadoEm: agora };
    fornecedorId = id;
  }
  save();
  return { ...atual.fornecedores[String(fornecedorId)] };
}

function fornecedorPorCnpj(empresaId, cnpj) {
  const d = soDigitos(cnpj);
  return d ? Object.values(estado(empresaId).fornecedores).find((item) => item.cnpj === d && item.ativo !== false) || null : null;
}

// ── Pedidos de compra ───────────────────────────────────────────────────────

function visaoPedido(pedido) {
  if (!pedido) return null;
  const itens = pedido.itens.map((item) => ({ ...item, pendente: Math.max(0, item.quantidade - item.recebido) }));
  return { ...pedido, itens, total: dinheiro(itens.reduce((soma, item) => soma + item.quantidade * item.custoUnitario, 0)), totalRecebido: dinheiro(itens.reduce((soma, item) => soma + item.recebido * item.custoUnitario, 0)) };
}

function itensPedidoNormalizados(empresaId, itens = []) {
  if (!Array.isArray(itens) || !itens.length) throw new ComprasError('O pedido precisa de pelo menos um item.', 'PEDIDO_SEM_ITENS');
  const produtos = new Map(barbearia.listarProdutosRevenda(empresaId, { incluirInativos: true }).map((item) => [item.id, item]));
  const porProduto = new Map();
  for (const bruto of itens) {
    const produto = produtos.get(String(bruto?.produtoId || ''));
    if (!produto) throw new ComprasError('Produto do pedido não encontrado na revenda.', 'PRODUTO_INVALIDO');
    const quantidade = Math.round(numero(bruto.quantidade, NaN));
    if (!Number.isFinite(quantidade) || quantidade <= 0) throw new ComprasError(`Quantidade inválida para ${produto.nome}.`, 'QUANTIDADE_INVALIDA');
    const custo = bruto.custoUnitario === undefined || bruto.custoUnitario === '' ? Number(produto.custoUltimaCompra || produto.custoUnitario || 0) : numero(bruto.custoUnitario, -1);
    if (custo < 0) throw new ComprasError(`Custo inválido para ${produto.nome}.`, 'CUSTO_INVALIDO');
    const atual = porProduto.get(produto.id);
    if (atual) atual.quantidade += quantidade;
    else porProduto.set(produto.id, { produtoId: produto.id, nome: produto.nome, sku: produto.sku || '', quantidade, custoUnitario: dinheiro(custo), recebido: 0 });
  }
  return [...porProduto.values()];
}

export function listarPedidos(empresaId, { status = '' } = {}) {
  return Object.values(estado(empresaId).pedidos)
    .filter((item) => !status || item.status === status)
    .sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)))
    .map(visaoPedido);
}

export function obterPedido(empresaId, pedidoId) {
  return visaoPedido(estado(empresaId).pedidos[String(pedidoId)]);
}

export function criarPedido(empresaId, dados = {}, opcoes = {}) {
  const atual = estado(empresaId);
  const fornecedor = atual.fornecedores[String(dados.fornecedorId || '')];
  if (!fornecedor || fornecedor.ativo === false) throw new ComprasError('Escolha um fornecedor ativo.', 'FORNECEDOR_NAO_ENCONTRADO');
  const itens = itensPedidoNormalizados(empresaId, dados.itens);
  atual.sequenciaPedido += 1;
  const agora = agoraIso(opcoes);
  const pedido = {
    id: novoId('pc'),
    numero: `PC-${String(atual.sequenciaPedido).padStart(5, '0')}`,
    empresaId: String(empresaId),
    fornecedorId: fornecedor.id,
    fornecedorNome: fornecedor.nome,
    status: 'rascunho',
    origem: texto(dados.origem, 40) || 'manual',
    previsaoEntrega: texto(dados.previsaoEntrega, 10) || new Date(Date.parse(agora) + fornecedor.prazoEntregaDias * DIA_MS).toISOString().slice(0, 10),
    observacoes: texto(dados.observacoes, 500),
    itens,
    recebimentos: [],
    criadoPor: texto(dados.usuario, 160) || null,
    criadoEm: agora,
    atualizadoEm: agora,
  };
  atual.pedidos[pedido.id] = pedido;
  save();
  return visaoPedido(pedido);
}

export function atualizarPedido(empresaId, pedidoId, dados = {}) {
  const pedido = estado(empresaId).pedidos[String(pedidoId)];
  if (!pedido) throw new ComprasError('Pedido não encontrado.', 'PEDIDO_NAO_ENCONTRADO', 404);
  if (pedido.status !== 'rascunho') throw new ComprasError('Só pedido em rascunho pode ser editado.', 'PEDIDO_FECHADO', 409);
  if (dados.itens) pedido.itens = itensPedidoNormalizados(empresaId, dados.itens);
  if (dados.previsaoEntrega !== undefined) pedido.previsaoEntrega = texto(dados.previsaoEntrega, 10);
  if (dados.observacoes !== undefined) pedido.observacoes = texto(dados.observacoes, 500);
  pedido.atualizadoEm = agoraIso();
  save();
  return visaoPedido(pedido);
}

export function enviarPedido(empresaId, pedidoId, { usuario = '' } = {}) {
  const pedido = estado(empresaId).pedidos[String(pedidoId)];
  if (!pedido) throw new ComprasError('Pedido não encontrado.', 'PEDIDO_NAO_ENCONTRADO', 404);
  if (pedido.status === 'enviado') return visaoPedido(pedido);
  if (pedido.status !== 'rascunho') throw new ComprasError('Só pedido em rascunho pode ser marcado como enviado.', 'PEDIDO_FECHADO', 409);
  Object.assign(pedido, { status: 'enviado', enviadoEm: agoraIso(), enviadoPor: texto(usuario, 160) || null, atualizadoEm: agoraIso() });
  save();
  return visaoPedido(pedido);
}

export function cancelarPedido(empresaId, pedidoId, { motivo = '', usuario = '' } = {}) {
  const pedido = estado(empresaId).pedidos[String(pedidoId)];
  if (!pedido) throw new ComprasError('Pedido não encontrado.', 'PEDIDO_NAO_ENCONTRADO', 404);
  if (pedido.itens.some((item) => item.recebido > 0)) throw new ComprasError('Pedido com recebimento não pode ser cancelado; encerre o saldo pendente.', 'PEDIDO_COM_RECEBIMENTO', 409);
  if (pedido.status === 'cancelado') return visaoPedido(pedido);
  Object.assign(pedido, { status: 'cancelado', canceladoEm: agoraIso(), canceladoPor: texto(usuario, 160) || null, motivoCancelamento: texto(motivo, 300), atualizadoEm: agoraIso() });
  save();
  return visaoPedido(pedido);
}

/**
 * Recebe itens do pedido (parcial ou total). Cada linha dá entrada no estoque
 * com o custo informado (ou o do pedido). Idempotente por chave do recebimento.
 */
export function receberPedido(empresaId, pedidoId, dados = {}, opcoes = {}) {
  const atual = estado(empresaId);
  const pedido = atual.pedidos[String(pedidoId)];
  if (!pedido) throw new ComprasError('Pedido não encontrado.', 'PEDIDO_NAO_ENCONTRADO', 404);
  if (!['enviado', 'recebido_parcial', 'rascunho'].includes(pedido.status)) throw new ComprasError('Este pedido não aceita recebimento.', 'PEDIDO_FECHADO', 409);
  const chave = texto(dados.chaveIdempotencia, 120) || `rec-${pedido.recebimentos.length + 1}`;
  if (pedido.recebimentos.some((item) => item.chave === chave)) return { ...visaoPedido(pedido), repetido: true };
  const linhas = Array.isArray(dados.itens) && dados.itens.length
    ? dados.itens
    : pedido.itens.map((item) => ({ produtoId: item.produtoId, quantidade: item.quantidade - item.recebido }));
  const aplicar = [];
  for (const linha of linhas) {
    const item = pedido.itens.find((it) => it.produtoId === String(linha.produtoId));
    if (!item) throw new ComprasError('Item recebido não pertence ao pedido.', 'ITEM_FORA_DO_PEDIDO');
    const quantidade = Math.round(numero(linha.quantidade, 0));
    if (quantidade <= 0) continue;
    if (quantidade > item.quantidade - item.recebido) throw new ComprasError(`Recebimento de ${item.nome} maior que o pendente (${item.quantidade - item.recebido}).`, 'RECEBIMENTO_EXCEDENTE');
    const custo = linha.custoUnitario === undefined || linha.custoUnitario === '' ? item.custoUnitario : dinheiro(numero(linha.custoUnitario, item.custoUnitario));
    aplicar.push({ item, quantidade, custo });
  }
  if (!aplicar.length) throw new ComprasError('Nada a receber.', 'RECEBIMENTO_VAZIO');
  const agora = agoraIso(opcoes);
  for (const { item, quantidade, custo } of aplicar) {
    barbearia.entradaEstoqueRevenda(empresaId, item.produtoId, { quantidade, custoUnitario: custo, origem: 'pedido_compra', referencia: pedido.numero, fornecedorId: pedido.fornecedorId, chaveIdempotencia: `pc:${pedido.id}:${chave}:${item.produtoId}`, usuario: dados.usuario, observacao: `Recebimento do pedido ${pedido.numero}` });
    item.recebido += quantidade;
  }
  pedido.recebimentos.push({ chave, em: agora, usuario: texto(dados.usuario, 160) || null, notaChave: texto(dados.notaChave, 44) || null, itens: aplicar.map(({ item, quantidade, custo }) => ({ produtoId: item.produtoId, quantidade, custoUnitario: custo })) });
  pedido.status = pedido.itens.every((item) => item.recebido >= item.quantidade) ? 'recebido' : 'recebido_parcial';
  pedido.atualizadoEm = agora;
  save();
  return visaoPedido(pedido);
}

// ── NF-e de entrada (XML) ───────────────────────────────────────────────────

function filhos(no, nome) {
  const out = [];
  for (let c = no?.firstChild; c; c = c.nextSibling) if (c.nodeType === 1 && (c.localName || c.nodeName) === nome) out.push(c);
  return out;
}
function el(raiz, ...caminho) {
  let atual = raiz;
  for (const nome of caminho) { atual = filhos(atual, nome)[0]; if (!atual) return null; }
  return atual;
}
const txt = (raiz, ...caminho) => { const n = el(raiz, ...caminho); return n ? String(n.textContent || '').trim() : ''; };
function primeiro(raiz, nome) {
  const todos = raiz?.getElementsByTagName('*') || [];
  for (let i = 0; i < todos.length; i += 1) if ((todos[i].localName || todos[i].nodeName) === nome) return todos[i];
  return null;
}

/** Lê o XML da NF-e (nfeProc ou NFe) e devolve emitente, nota e itens. */
export function lerXmlNfe(xml) {
  const limpo = String(xml || '').replace(/^﻿/, '').trim();
  if (!limpo.startsWith('<')) throw new ComprasError('Arquivo não parece um XML.', 'XML_INVALIDO');
  if (limpo.length > 5_000_000) throw new ComprasError('XML muito grande.', 'XML_GRANDE');
  const doc = new DOMParser({ onError: () => {} }).parseFromString(limpo, 'text/xml');
  const inf = primeiro(doc, 'infNFe');
  if (!inf) throw new ComprasError('XML não é de uma NF-e (infNFe ausente).', 'XML_NAO_NFE');
  const chave = soDigitos(inf.getAttribute('Id')).slice(-44);
  if (chave.length !== 44) throw new ComprasError('Chave da NF-e inválida no XML.', 'CHAVE_INVALIDA');
  const ide = el(inf, 'ide');
  const emit = el(inf, 'emit');
  const dest = el(inf, 'dest');
  const total = el(inf, 'total', 'ICMSTot');
  const itens = filhos(inf, 'det').map((det) => {
    const prod = el(det, 'prod');
    const qCom = numero(txt(prod, 'qCom'));
    const vProd = numero(txt(prod, 'vProd'));
    const vDesc = numero(txt(prod, 'vDesc'));
    const ean = soDigitos(txt(prod, 'cEAN'));
    return {
      item: Number(det.getAttribute('nItem') || 0),
      codigo: txt(prod, 'cProd'),
      ean: ean && !/^0+$/.test(ean) ? ean : '',
      descricao: txt(prod, 'xProd'),
      ncm: txt(prod, 'NCM'),
      cfop: txt(prod, 'CFOP'),
      unidade: txt(prod, 'uCom'),
      quantidade: qCom,
      valorUnitario: numero(txt(prod, 'vUnCom')),
      valorTotal: vProd,
      desconto: vDesc,
      // Custo efetivo por unidade: valor do item menos o desconto do item.
      custoUnitario: qCom > 0 ? Number(((vProd - vDesc) / qCom).toFixed(4)) : 0,
    };
  });
  return {
    chave,
    numero: txt(ide, 'nNF'),
    serie: txt(ide, 'serie'),
    emissao: txt(ide, 'dhEmi') || txt(ide, 'dEmi'),
    emitente: { cnpj: soDigitos(txt(emit, 'CNPJ')), nome: txt(emit, 'xNome'), fantasia: txt(emit, 'xFant') },
    destinatarioCnpj: soDigitos(txt(dest, 'CNPJ') || txt(dest, 'CPF')),
    valorProdutos: numero(txt(total, 'vProd')),
    valorNota: numero(txt(total, 'vNF')),
    autorizada: Boolean(primeiro(doc, 'protNFe')),
    itens,
  };
}

const normalizarNome = (valor) => String(valor || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function sugestaoDeProduto(empresaId, nota, item, produtos) {
  const vinculo = estado(empresaId).vinculos[`${nota.emitente.cnpj}:${item.codigo}`];
  if (vinculo && produtos.some((p) => p.id === vinculo)) return { produtoId: vinculo, criterio: 'vinculo_anterior' };
  if (item.ean) {
    const porEan = produtos.find((p) => p.ean && p.ean === item.ean);
    if (porEan) return { produtoId: porEan.id, criterio: 'ean' };
  }
  const porSku = produtos.find((p) => p.sku && (p.sku === item.codigo || (item.ean && p.sku === item.ean)));
  if (porSku) return { produtoId: porSku.id, criterio: 'sku' };
  const nome = normalizarNome(item.descricao);
  const porNome = produtos.find((p) => normalizarNome(p.nome) === nome);
  if (porNome) return { produtoId: porNome.id, criterio: 'nome' };
  return { produtoId: null, criterio: 'sem_correspondencia' };
}

/** Prévia: lê a nota, sugere o produto de cada item e avisa se já foi lançada. */
export function previaNotaEntrada(empresaId, xml) {
  const nota = lerXmlNfe(xml);
  const lancada = estado(empresaId).notasEntrada[nota.chave] || null;
  const produtos = barbearia.listarProdutosRevenda(empresaId, { incluirInativos: false });
  const fornecedor = fornecedorPorCnpj(empresaId, nota.emitente.cnpj);
  const itens = nota.itens.map((item) => {
    const sugestao = sugestaoDeProduto(empresaId, nota, item, produtos);
    const produto = produtos.find((p) => p.id === sugestao.produtoId);
    const fracionado = !Number.isInteger(item.quantidade);
    return { ...item, ...sugestao, produtoNome: produto?.nome || '', estoqueAtual: produto?.estoqueAtual ?? null, custoAtual: produto?.custoUnitario ?? null, alerta: fracionado ? 'quantidade_fracionada' : null };
  });
  return {
    nota: { chave: nota.chave, numero: nota.numero, serie: nota.serie, emissao: nota.emissao, emitente: nota.emitente, valorProdutos: nota.valorProdutos, valorNota: nota.valorNota, autorizada: nota.autorizada },
    fornecedor: fornecedor ? { id: fornecedor.id, nome: fornecedor.nome } : null,
    jaLancada: Boolean(lancada),
    lancadaEm: lancada?.lancadaEm || null,
    itens,
    resumo: { itens: itens.length, comProduto: itens.filter((i) => i.produtoId).length, semProduto: itens.filter((i) => !i.produtoId).length },
  };
}

/**
 * Lança a nota: cada item vinculado (ou criado agora) entra no estoque com o
 * custo da nota. Itens marcados como "ignorar" ficam fora. A mesma chave de NF-e
 * nunca entra duas vezes. Opcionalmente baixa o pendente de um pedido de compra.
 */
export function lancarNotaEntrada(empresaId, xml, dados = {}, opcoes = {}) {
  if (dados.confirmado !== true) throw new ComprasError('Confirme o lançamento da nota.', 'CONFIRMACAO_OBRIGATORIA');
  const nota = lerXmlNfe(xml);
  const atual = estado(empresaId);
  if (atual.notasEntrada[nota.chave]) return { ...atual.notasEntrada[nota.chave], repetida: true };
  const decisoes = new Map((dados.itens || []).map((item) => [Number(item.item), item]));
  let fornecedor = fornecedorPorCnpj(empresaId, nota.emitente.cnpj);
  if (!fornecedor && nota.emitente.nome) {
    fornecedor = salvarFornecedor(empresaId, { nome: nota.emitente.fantasia || nota.emitente.nome, cnpj: cnpjValido(nota.emitente.cnpj) ? nota.emitente.cnpj : '' });
  }
  const produtos = barbearia.listarProdutosRevenda(empresaId, { incluirInativos: false });
  const plano = [];
  for (const item of nota.itens) {
    const decisao = decisoes.get(item.item) || {};
    if (decisao.ignorar === true) { plano.push({ item, ignorado: true }); continue; }
    if (!Number.isInteger(item.quantidade) && !decisao.fatorConversao) throw new ComprasError(`Item ${item.item} (${item.descricao}) tem quantidade fracionada: informe o fator de conversão ou ignore.`, 'QUANTIDADE_FRACIONADA');
    // Fator de conversão: caixa com 12 = 12 unidades no estoque.
    const fator = Math.max(1, Math.round(numero(decisao.fatorConversao, 1)));
    let produtoId = decisao.produtoId || sugestaoDeProduto(empresaId, nota, item, produtos).produtoId;
    if (!produtoId && decisao.criarProduto === true) {
      const precoVenda = numero(decisao.precoVenda, 0);
      if (precoVenda <= 0) throw new ComprasError(`Informe o preço de venda para criar ${item.descricao}.`, 'PRECO_OBRIGATORIO');
      const criado = barbearia.criarProdutoRevenda(empresaId, { nome: texto(decisao.nome || item.descricao, 140), sku: item.codigo, ean: item.ean, precoVenda, custoUnitario: item.custoUnitario / fator, estoqueAtual: 0, estoqueMinimo: Math.round(numero(decisao.estoqueMinimo, 0)), categoria: decisao.categoria || 'Revenda' });
      produtoId = criado.id;
      produtos.push(criado);
    }
    if (!produtoId) throw new ComprasError(`Item ${item.item} (${item.descricao}) sem produto: vincule, crie ou ignore.`, 'ITEM_SEM_PRODUTO');
    plano.push({ item, produtoId, quantidade: Math.round(item.quantidade * fator), custo: Number((item.custoUnitario / fator).toFixed(4)) });
  }
  const agora = agoraIso(opcoes);
  const entradas = [];
  for (const passo of plano) {
    if (passo.ignorado) continue;
    const r = barbearia.entradaEstoqueRevenda(empresaId, passo.produtoId, { quantidade: passo.quantidade, custoUnitario: passo.custo, origem: 'nfe_entrada', referencia: `NF-e ${nota.numero}/${nota.serie}`, fornecedorId: fornecedor?.id, chaveIdempotencia: `nfe:${nota.chave}:${passo.item.item}`, usuario: dados.usuario, observacao: `NF-e ${nota.numero} · ${nota.emitente.nome}` });
    if (nota.emitente.cnpj && passo.item.codigo) atual.vinculos[`${nota.emitente.cnpj}:${passo.item.codigo}`] = passo.produtoId;
    entradas.push({ item: passo.item.item, produtoId: passo.produtoId, produtoNome: r.produto.nome, quantidade: passo.quantidade, custoUnitario: passo.custo, estoquePosterior: r.produto.estoqueAtual });
  }
  // Baixa o pendente do pedido de compra, se informado, sem nova entrada de estoque.
  if (dados.pedidoId) {
    const pedido = atual.pedidos[String(dados.pedidoId)];
    if (pedido && ['enviado', 'recebido_parcial', 'rascunho'].includes(pedido.status)) {
      for (const entrada of entradas) {
        const linha = pedido.itens.find((it) => it.produtoId === entrada.produtoId);
        if (linha) linha.recebido = Math.min(linha.quantidade, linha.recebido + entrada.quantidade);
      }
      pedido.recebimentos.push({ chave: `nfe:${nota.chave}`, em: agora, usuario: texto(dados.usuario, 160) || null, notaChave: nota.chave, itens: entradas.map((e) => ({ produtoId: e.produtoId, quantidade: e.quantidade, custoUnitario: e.custoUnitario })) });
      pedido.status = pedido.itens.every((it) => it.recebido >= it.quantidade) ? 'recebido' : 'recebido_parcial';
      pedido.atualizadoEm = agora;
    }
  }
  const registro = {
    chave: nota.chave,
    numero: nota.numero,
    serie: nota.serie,
    emissao: nota.emissao,
    fornecedorId: fornecedor?.id || null,
    fornecedorNome: fornecedor?.nome || nota.emitente.nome,
    valorNota: nota.valorNota,
    pedidoId: dados.pedidoId || null,
    entradas,
    ignorados: plano.filter((p) => p.ignorado).map((p) => ({ item: p.item.item, descricao: p.item.descricao })),
    lancadaEm: agora,
    lancadaPor: texto(dados.usuario, 160) || null,
  };
  atual.notasEntrada[nota.chave] = registro;
  save();
  return { ...registro };
}

export function listarNotasEntrada(empresaId) {
  return Object.values(estado(empresaId).notasEntrada).sort((a, b) => String(b.lancadaEm).localeCompare(String(a.lancadaEm))).map((item) => ({ ...item }));
}

// ── Vendas de revenda no período (base do giro e da curva ABC) ──────────────

function vendasPorProduto(empresaId, { inicioMs, fimMs }) {
  const dentro = (iso) => { const ms = Date.parse(iso || ''); return Number.isFinite(ms) && ms >= inicioMs && ms <= fimMs; };
  const mapa = new Map();
  const somar = (produtoId, quantidade, receita) => {
    const atual = mapa.get(produtoId) || { quantidade: 0, receita: 0 };
    atual.quantidade += Number(quantidade || 0);
    atual.receita += Number(receita || 0);
    mapa.set(produtoId, atual);
  };
  for (const venda of barbearia.listarVendasRevenda(empresaId, { status: 'pago' })) {
    if (!dentro(venda.pagamento?.confirmadoEm || venda.atualizadoEm)) continue;
    for (const item of venda.itens) somar(item.produtoId, item.quantidade, item.subtotal);
  }
  for (const comanda of barbearia.listarComandasBarbearia(empresaId, {})) {
    if (!['paga', 'em_conta'].includes(comanda.status) || !dentro(comanda.fechadaEm || comanda.atualizadoEm)) continue;
    const subtotal = (comanda.itens || []).reduce((soma, item) => soma + Number(item.subtotal || 0), 0);
    const fator = subtotal > 0 ? Math.max(0, subtotal - Math.min(subtotal, Number(comanda.desconto || 0))) / subtotal : 1;
    for (const item of comanda.itens || []) if (item.tipo === 'produto' && item.produtoId) somar(item.produtoId, item.quantidade, Number(item.subtotal || 0) * fator);
  }
  return mapa;
}

function janela(dias, opcoes = {}) {
  const fimMs = opcoes.agora ? new Date(opcoes.agora).valueOf() : Date.now();
  const d = Math.max(7, Math.min(365, Math.round(numero(dias, 90))));
  return { dias: d, inicioMs: fimMs - d * DIA_MS, fimMs };
}

// ── Reposição: estoque mínimo + giro ────────────────────────────────────────

/**
 * Sugere compra para cada produto ativo em ruptura, abaixo do mínimo ou que
 * acaba antes do próximo recebimento (consumo médio × prazo do fornecedor).
 * Quantidade sugerida cobre o mínimo + 30 dias de giro.
 */
export function sugestaoReposicao(empresaId, { dias = 60, coberturaDias = 30 } = {}, opcoes = {}) {
  const j = janela(dias, opcoes);
  const vendas = vendasPorProduto(empresaId, j);
  const fornecedores = new Map(listarFornecedores(empresaId, { incluirInativos: true }).map((f) => [f.id, f]));
  const pendentes = new Map();
  for (const pedido of listarPedidos(empresaId)) {
    if (!['rascunho', 'enviado', 'recebido_parcial'].includes(pedido.status)) continue;
    for (const item of pedido.itens) pendentes.set(item.produtoId, (pendentes.get(item.produtoId) || 0) + item.pendente);
  }
  const itens = [];
  for (const produto of barbearia.listarProdutosRevenda(empresaId)) {
    const vendido = vendas.get(produto.id)?.quantidade || 0;
    const consumoDia = vendido / j.dias;
    const fornecedor = fornecedores.get(produto.fornecedorPadraoId) || null;
    const prazo = fornecedor?.prazoEntregaDias ?? 7;
    const estoque = Number(produto.estoqueAtual || 0);
    const minimo = Number(produto.estoqueMinimo || 0);
    const emPedido = pendentes.get(produto.id) || 0;
    const diasCobertura = consumoDia > 0 ? Math.floor(estoque / consumoDia) : null;
    const pontoPedido = minimo + Math.ceil(consumoDia * prazo);
    if (estoque + emPedido > pontoPedido && !(estoque <= 0 && emPedido === 0)) continue;
    const alvo = minimo + Math.ceil(consumoDia * (prazo + Math.max(7, coberturaDias)));
    const sugerido = Math.max(1, alvo - estoque - emPedido);
    if (estoque + emPedido >= alvo && estoque + emPedido > 0) continue;
    itens.push({
      produtoId: produto.id,
      nome: produto.nome,
      estoqueAtual: estoque,
      estoqueMinimo: minimo,
      emPedido,
      vendidoNoPeriodo: vendido,
      consumoDiario: Number(consumoDia.toFixed(3)),
      diasCobertura,
      prazoFornecedorDias: prazo,
      fornecedorId: fornecedor?.id || null,
      fornecedorNome: fornecedor?.nome || null,
      quantidadeSugerida: sugerido,
      custoUnitario: Number(produto.custoUltimaCompra || produto.custoUnitario || 0),
      motivo: estoque <= 0 ? 'ruptura' : estoque <= minimo ? 'abaixo_do_minimo' : 'acaba_antes_do_recebimento',
    });
  }
  const prioridade = { ruptura: 0, abaixo_do_minimo: 1, acaba_antes_do_recebimento: 2 };
  itens.sort((a, b) => prioridade[a.motivo] - prioridade[b.motivo] || a.nome.localeCompare(b.nome, 'pt-BR'));
  return { periodoDias: j.dias, coberturaDias, itens, totalEstimado: dinheiro(itens.reduce((s, i) => s + i.quantidadeSugerida * i.custoUnitario, 0)) };
}

/**
 * Gera pedidos em rascunho a partir da sugestão, um por fornecedor. Itens sem
 * fornecedor vão para o fornecedor informado (ou ficam de fora, listados).
 * Nada é enviado: o gestor revisa e marca como enviado.
 */
export function gerarPedidosDeReposicao(empresaId, { fornecedorPadraoId = '', usuario = '', produtosIds = null } = {}, opcoes = {}) {
  const sugestao = sugestaoReposicao(empresaId, {}, opcoes);
  const grupos = new Map();
  const semFornecedor = [];
  for (const item of sugestao.itens) {
    if (Array.isArray(produtosIds) && !produtosIds.includes(item.produtoId)) continue;
    const fornecedorId = item.fornecedorId || fornecedorPadraoId;
    if (!fornecedorId) { semFornecedor.push(item.nome); continue; }
    if (!grupos.has(fornecedorId)) grupos.set(fornecedorId, []);
    grupos.get(fornecedorId).push({ produtoId: item.produtoId, quantidade: item.quantidadeSugerida, custoUnitario: item.custoUnitario });
  }
  const pedidos = [...grupos.entries()].map(([fornecedorId, itens]) => criarPedido(empresaId, { fornecedorId, itens, origem: 'reposicao_automatica', usuario, observacoes: 'Gerado pela sugestão de reposição (estoque mínimo + giro).' }, opcoes));
  return { pedidos, semFornecedor };
}

// ── Curva ABC e margem ──────────────────────────────────────────────────────

/**
 * Classifica os produtos pela receita do período: A até 80% acumulado, B até 95%,
 * C o restante. Traz margem bruta (receita − custo médio × quantidade), giro e
 * itens parados (com estoque e sem venda no período).
 */
export function curvaAbc(empresaId, { dias = 90, criterio = 'receita' } = {}, opcoes = {}) {
  const j = janela(dias, opcoes);
  const vendas = vendasPorProduto(empresaId, j);
  const produtos = barbearia.listarProdutosRevenda(empresaId, { incluirInativos: true });
  const linhas = produtos.map((produto) => {
    const v = vendas.get(produto.id) || { quantidade: 0, receita: 0 };
    const custo = v.quantidade * Number(produto.custoUnitario || 0);
    const margem = v.receita - custo;
    return {
      produtoId: produto.id,
      nome: produto.nome,
      ativo: produto.ativo !== false,
      quantidade: v.quantidade,
      receita: dinheiro(v.receita),
      custo: dinheiro(custo),
      margem: dinheiro(margem),
      margemPercentual: v.receita > 0 ? Number((margem / v.receita * 100).toFixed(1)) : null,
      estoqueAtual: Number(produto.estoqueAtual || 0),
      valorEmEstoque: dinheiro(Number(produto.estoqueAtual || 0) * Number(produto.custoUnitario || 0)),
      giro: produto.estoqueAtual > 0 ? Number((v.quantidade / produto.estoqueAtual).toFixed(2)) : null,
      semCusto: !(Number(produto.custoUnitario || 0) > 0),
    };
  }).filter((linha) => linha.ativo || linha.quantidade > 0);
  const chave = criterio === 'margem' ? 'margem' : 'receita';
  const total = linhas.reduce((soma, l) => soma + Math.max(0, l[chave]), 0);
  linhas.sort((a, b) => b[chave] - a[chave] || a.nome.localeCompare(b.nome, 'pt-BR'));
  let acumulado = 0;
  for (const linha of linhas) {
    const valor = Math.max(0, linha[chave]);
    const antes = total > 0 ? acumulado / total : 1;
    acumulado += valor;
    linha.participacao = total > 0 ? Number((valor / total * 100).toFixed(2)) : 0;
    linha.acumulado = total > 0 ? Number((acumulado / total * 100).toFixed(2)) : 0;
    linha.classe = valor <= 0 ? 'C' : antes < 0.8 ? 'A' : antes < 0.95 ? 'B' : 'C';
    linha.parado = linha.quantidade === 0 && linha.estoqueAtual > 0;
  }
  const resumo = ['A', 'B', 'C'].map((classe) => {
    const grupo = linhas.filter((l) => l.classe === classe);
    return { classe, itens: grupo.length, receita: dinheiro(grupo.reduce((s, l) => s + l.receita, 0)), margem: dinheiro(grupo.reduce((s, l) => s + l.margem, 0)) };
  });
  return {
    periodoDias: j.dias,
    criterio: chave,
    receitaTotal: dinheiro(linhas.reduce((s, l) => s + l.receita, 0)),
    margemTotal: dinheiro(linhas.reduce((s, l) => s + l.margem, 0)),
    valorEmEstoque: dinheiro(linhas.reduce((s, l) => s + l.valorEmEstoque, 0)),
    resumo,
    parados: linhas.filter((l) => l.parado).map((l) => ({ produtoId: l.produtoId, nome: l.nome, estoqueAtual: l.estoqueAtual, valorEmEstoque: l.valorEmEstoque })),
    semCusto: linhas.filter((l) => l.semCusto).length,
    linhas,
  };
}
