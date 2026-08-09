// ============================================================================
// COMPRAS KYTTO
// Pedidos multientidade com aprovação e recebimento parcial/total.
// ============================================================================

import { db } from './db.js';

const agora = () => new Date().toISOString();
const texto = (valor, limite = 240) => String(valor ?? '').trim().slice(0, limite);
const moeda = (valor) => Number(Number(valor || 0).toFixed(2));

function storeEmpresa(empresaId) {
  const estado = db();
  estado.comprasKytto ||= { empresas: {} };
  estado.comprasKytto.empresas ||= {};
  const chave = String(empresaId || 'emp-kytto-001');
  estado.comprasKytto.empresas[chave] ||= { pedidos: {}, sequencia: 0 };
  const store = estado.comprasKytto.empresas[chave];
  store.pedidos ||= {};
  store.sequencia ||= 0;
  return store;
}

function proximoNumero(empresaId) {
  const store = storeEmpresa(empresaId);
  store.sequencia += 1;
  return `PC${new Date().getFullYear()}${String(store.sequencia).padStart(6, '0')}`;
}

function serializar(pedido) {
  return { ...pedido, itens: pedido.itens.map((item) => ({ ...item })) };
}

export function criarPedidoCompra(empresaId, dados = {}) {
  const fornecedorId = texto(dados.fornecedorId ?? dados.fornecedor_id, 100);
  if (!fornecedorId) throw new Error('Fornecedor é obrigatório para o pedido de compra.');
  const itensOriginais = Array.isArray(dados.itens) ? dados.itens : [];
  if (!itensOriginais.length) throw new Error('Informe ao menos um item para o pedido de compra.');
  const itens = itensOriginais.map((item, indice) => {
    const produtoId = texto(item.produtoId ?? item.produto_id, 120);
    const quantidade = Number(item.quantidade ?? item.qtd);
    const valorUnitario = moeda(item.valorUnitario ?? item.valor_unitario ?? item.custo);
    if (!produtoId || !Number.isFinite(quantidade) || quantidade <= 0 || !Number.isFinite(valorUnitario) || valorUnitario < 0) {
      throw new Error(`Item ${indice + 1} do pedido é inválido.`);
    }
    return {
      id: `pci-${Date.now().toString(36)}-${String(indice + 1).padStart(3, '0')}`,
      produtoId,
      descricao: texto(item.descricao, 180),
      quantidade: Number(quantidade),
      quantidadeRecebida: 0,
      unidade: texto(item.unidade || 'UN', 20),
      valorUnitario,
      valorTotal: moeda(quantidade * valorUnitario),
      status: 'pendente',
    };
  });
  const valorFrete = moeda(dados.valorFrete ?? dados.valor_frete);
  const subtotal = moeda(itens.reduce((soma, item) => soma + item.valorTotal, 0));
  const valorTotal = moeda(subtotal + valorFrete);
  const limiteAprovacao = Math.max(0, Number(dados.limiteAprovacao ?? 5000));
  const status = valorTotal > limiteAprovacao ? 'aguardando_aprovacao' : 'aprovado';
  const store = storeEmpresa(empresaId);
  const pedido = {
    id: `pc-${Date.now().toString(36)}-${Object.keys(store.pedidos).length + 1}`,
    empresaId: String(empresaId),
    numero: proximoNumero(empresaId),
    fornecedorId,
    status,
    itens,
    subtotal,
    valorFrete,
    valorTotal,
    condicaoPagamento: texto(dados.condicaoPagamento ?? dados.condicao_pagamento, 120),
    previsaoEntrega: dados.previsaoEntrega || dados.data_previsao_entrega || null,
    observacao: texto(dados.observacao, 400),
    solicitante: texto(dados.solicitante, 120),
    aprovador: null,
    aprovadoEm: null,
    recebidoEm: null,
    criadoEm: agora(),
    atualizadoEm: agora(),
  };
  store.pedidos[pedido.id] = pedido;
  return { pedido: serializar(pedido), requerAprovacao: status === 'aguardando_aprovacao' };
}

export function listarPedidosCompra(empresaId, filtros = {}) {
  const status = texto(filtros.status, 50).toLowerCase();
  return Object.values(storeEmpresa(empresaId).pedidos)
    .filter((pedido) => pedido.empresaId === String(empresaId))
    .filter((pedido) => !status || pedido.status === status)
    .sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)))
    .map(serializar);
}

export function obterPedidoCompra(empresaId, pedidoId) {
  const pedido = storeEmpresa(empresaId).pedidos[String(pedidoId)];
  return pedido?.empresaId === String(empresaId) ? serializar(pedido) : null;
}

export function aprovarPedidoCompra(empresaId, pedidoId, aprovador) {
  const pedido = storeEmpresa(empresaId).pedidos[String(pedidoId)];
  if (!pedido || pedido.empresaId !== String(empresaId)) return null;
  if (pedido.status !== 'aguardando_aprovacao') throw new Error('O pedido não está aguardando aprovação.');
  pedido.status = 'aprovado';
  pedido.aprovador = texto(aprovador, 120);
  pedido.aprovadoEm = agora();
  pedido.atualizadoEm = agora();
  return serializar(pedido);
}

export function receberPedidoCompra(empresaId, pedidoId, itensRecebidos = [], recebidoPor = '') {
  const pedido = storeEmpresa(empresaId).pedidos[String(pedidoId)];
  if (!pedido || pedido.empresaId !== String(empresaId)) return null;
  if (!['aprovado', 'parcial'].includes(pedido.status)) throw new Error('O pedido precisa estar aprovado para recebimento.');
  const recebimentos = Array.isArray(itensRecebidos) && itensRecebidos.length ? itensRecebidos : pedido.itens.map((item) => ({ itemId: item.id, quantidade: item.quantidade - item.quantidadeRecebida }));
  const movimentos = [];
  for (const recebido of recebimentos) {
    const item = pedido.itens.find((atual) => atual.id === String(recebido.itemId ?? recebido.item_id));
    if (!item) throw new Error('Item de pedido não encontrado.');
    const quantidade = Number(recebido.quantidade ?? recebido.quantidade_recebida ?? recebido.qtd);
    const pendente = item.quantidade - item.quantidadeRecebida;
    if (!Number.isFinite(quantidade) || quantidade <= 0 || quantidade > pendente) {
      throw new Error(`Quantidade de recebimento inválida para ${item.descricao || item.produtoId}.`);
    }
    item.quantidadeRecebida = Number((item.quantidadeRecebida + quantidade).toFixed(4));
    item.status = item.quantidadeRecebida >= item.quantidade ? 'recebido' : 'parcial';
    movimentos.push({
      id: `rec-${pedido.id}-${item.id}-${Date.now().toString(36)}`,
      produtoId: item.produtoId,
      descricao: item.descricao,
      quantidade,
      unidade: item.unidade,
      valorUnitario: item.valorUnitario,
      valorTotal: moeda(quantidade * item.valorUnitario),
      itemId: item.id,
    });
  }
  const completo = pedido.itens.every((item) => item.quantidadeRecebida >= item.quantidade);
  pedido.status = completo ? 'recebido' : 'parcial';
  pedido.recebidoEm = agora();
  pedido.recebidoPor = texto(recebidoPor, 120);
  pedido.atualizadoEm = agora();
  return { pedido: serializar(pedido), movimentos };
}
