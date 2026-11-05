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
const lojaEscopo = (valor) => texto(valor, 120);

function registroNaUnidade(registro, lojaId) {
  // Sem lojaId a consulta é corporativa e mantém compatibilidade com legados.
  // Em sessão de loja, somente o vínculo explícito com a unidade é válido:
  // registros legados sem loja nunca são implicitamente compartilhados.
  return !lojaId || !registro?.lojaId || registro?.lojaId === lojaId;
}

function produtoNoEscopo(empresaId, produtoId, lojaId = '') {
  const id = String(produtoId || '');
  const produto = barbearia.listarProdutosRevenda(empresaId, { incluirInativos: true }).find((item) => item.id === id);
  if (!produto) throw new ComprasError('Produto do pedido/nota não encontrado na empresa ativa.', 'PRODUTO_INVALIDO', 404);
  if (lojaId && produto.lojaId !== lojaId) throw new ComprasError('Produto não pertence à unidade ativa.', 'PRODUTO_FORA_DA_UNIDADE', 404);
  return produto;
}

function pedidoNoEscopo(empresaId, pedidoId, lojaId = '') {
  const pedido = estado(empresaId).pedidos[String(pedidoId)];
  if (!pedido || !registroNaUnidade(pedido, lojaId)) throw new ComprasError('Pedido não encontrado na empresa/unidade ativa.', 'PEDIDO_NAO_ENCONTRADO', 404);
  return pedido;
}

export const STATUS_PEDIDO = Object.freeze(['rascunho', 'aprovado', 'enviado', 'recebido_parcial', 'recebido', 'cancelado']);

function estado(empresaId) {
  const raiz = db();
  raiz.barbeariaCompras ||= {};
  const chave = String(empresaId || '');
  raiz.barbeariaCompras[chave] ||= {};
  const atual = raiz.barbeariaCompras[chave];
  atual.fornecedores ||= {};
  atual.pedidos ||= {};
  atual.notasEntrada ||= {};
  atual.transacoesEntrada ||= {};
  atual.vinculos ||= {};
  atual.sequenciaPedido = Number(atual.sequenciaPedido || 0);

  // Seed Fornecedores
  if (Object.keys(atual.fornecedores).length === 0) {
    const fornecedoresPadrao = [
      {
        id: 'forn-alfa-barber',
        nome: 'Distribuidora Alfa Cosméticos & Barber Pro',
        cnpj: '14829301000192',
        contato: 'Carlos Eduardo (Vendas Barber)',
        telefone: '(11) 98765-4321',
        email: 'comercial@barberprodistribuidora.com.br',
        prazoEntregaDias: 4,
        condicaoPagamento: 'Boleto 30 dias',
        observacoes: 'Fornecedor homologado de pomadas, shaving e óleos.',
        ativo: true,
        criadoEm: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
      },
      {
        id: 'forn-ambev-bebidas',
        nome: 'Ambev & Cia de Bebidas SP',
        cnpj: '02808708000107',
        contato: 'Mariana Lima (Key Account)',
        telefone: '(11) 97123-4567',
        email: 'pedidos.direto@ambevdistribuidor.com.br',
        prazoEntregaDias: 2,
        condicaoPagamento: 'Boleto 14 dias',
        observacoes: 'Bebidas alcoólicas, refrigerantes e águas para o bar.',
        ativo: true,
        criadoEm: new Date(Date.now() - 25 * 24 * 3600 * 1000).toISOString()
      },
      {
        id: 'forn-descartaveis-cia',
        nome: 'Descartáveis & Cia Hospitalar e Estética',
        cnpj: '28192481000144',
        contato: 'Roberto Mendes',
        telefone: '(11) 99888-1122',
        email: 'vendas@descartaveisecia.com.br',
        prazoEntregaDias: 3,
        condicaoPagamento: 'PIX ou Boleto 28 dias',
        observacoes: 'Lâminas, toalhas descartáveis, golas higiênicas e luvas nitrílicas.',
        ativo: true,
        criadoEm: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString()
      },
      {
        id: 'forn-perfumaria-fina',
        nome: 'Perfumaria Nobre & Essências Importadas',
        cnpj: '33918271000110',
        contato: 'Fernanda Souza',
        telefone: '(11) 96543-2109',
        email: 'pedidos@perfumarianobre.com.br',
        prazoEntregaDias: 5,
        condicaoPagamento: 'Boleto 30/60 dias',
        observacoes: 'Perfumes artesanais, colônias masculinas e balms aromáticos.',
        ativo: true,
        criadoEm: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString()
      }
    ];
    for (const f of fornecedoresPadrao) {
      atual.fornecedores[f.id] = f;
    }
  }

  // Seed Pedidos de Compra
  if (Object.keys(atual.pedidos).length === 0) {
    const p1Id = 'ped-1082';
    const p2Id = 'ped-1085';
    const p3Id = 'ped-1088';
    atual.sequenciaPedido = 1088;

    atual.pedidos[p1Id] = {
      id: p1Id,
      numero: 'PC-1082',
      fornecedorId: 'forn-alfa-barber',
      fornecedorNome: 'Distribuidora Alfa Cosméticos & Barber Pro',
      fornecedorCnpj: '14829301000192',
      fornecedorEmail: 'comercial@barberprodistribuidora.com.br',
      condicaoPagamento: 'Boleto 30 dias',
      status: 'recebido',
      itens: [
        { produtoId: 'BEB-AGUAG-500', nome: 'Água Mineral com Gás 500ml', quantidade: 40, recebido: 40, pendente: 0, precoUnitario: 2.20, total: 88.00 },
        { produtoId: 'BEB-AGUA-500', nome: 'Água Mineral sem Gás 500ml', quantidade: 60, recebido: 60, pendente: 0, precoUnitario: 1.80, total: 108.00 }
      ],
      totalItens: 2,
      valorTotal: 196.00,
      previsaoEntrega: '2026-11-02',
      criadoEm: '2026-10-30T10:00:00.000Z',
      criadoPor: 'admin',
      aprovadoEm: '2026-10-30T14:30:00.000Z',
      aprovadoPor: 'Rodrigo Gonçalves (Gestor)',
      enviadoEm: '2026-10-30T15:00:00.000Z',
      enviadoPor: 'admin',
      recebidoEm: '2026-11-02T11:20:00.000Z',
      recebimentos: [{ chave: 'rec-1', em: '2026-11-02T11:20:00.000Z', usuario: 'admin', itens: 2 }]
    };

    atual.pedidos[p2Id] = {
      id: p2Id,
      numero: 'PC-1085',
      fornecedorId: 'forn-ambev-bebidas',
      fornecedorNome: 'Ambev & Cia de Bebidas SP',
      fornecedorCnpj: '02808708000107',
      fornecedorEmail: 'pedidos.direto@ambevdistribuidor.com.br',
      condicaoPagamento: 'Boleto 14 dias',
      status: 'aprovado',
      itens: [
        { produtoId: 'cerveja-long-neck', nome: 'Cerveja Long Neck Premium', quantidade: 48, recebido: 0, pendente: 48, precoUnitario: 4.40, total: 211.20 },
        { produtoId: 'refrigerante-lata', nome: 'Refrigerante Lata 350ml', quantidade: 36, recebido: 0, pendente: 36, precoUnitario: 2.80, total: 100.80 }
      ],
      totalItens: 2,
      valorTotal: 312.00,
      previsaoEntrega: '2026-11-08',
      criadoEm: '2026-11-04T09:15:00.000Z',
      criadoPor: 'admin',
      aprovadoEm: '2026-11-04T16:00:00.000Z',
      aprovadoPor: 'Rodrigo Gonçalves (Gestor)'
    };

    atual.pedidos[p3Id] = {
      id: p3Id,
      numero: 'PC-1088',
      fornecedorId: 'forn-descartaveis-cia',
      fornecedorNome: 'Descartáveis & Cia Hospitalar e Estética',
      fornecedorCnpj: '28192481000144',
      fornecedorEmail: 'vendas@descartaveisecia.com.br',
      condicaoPagamento: 'Boleto 28 dias',
      status: 'enviado',
      itens: [
        { produtoId: 'lamina-barbear', nome: 'Lâminas Descartáveis Barber (cx 100un)', quantidade: 5, recebido: 0, pendente: 5, precoUnitario: 35.00, total: 175.00 },
        { produtoId: 'gola-higienica', nome: 'Golas Higiênicas Descartáveis (rolo 500un)', quantidade: 4, recebido: 0, pendente: 4, precoUnitario: 22.50, total: 90.00 }
      ],
      totalItens: 2,
      valorTotal: 265.00,
      previsaoEntrega: '2026-11-07',
      criadoEm: '2026-11-05T08:30:00.000Z',
      criadoPor: 'admin',
      aprovadoEm: '2026-11-05T09:00:00.000Z',
      aprovadoPor: 'Rodrigo Gonçalves (Gestor)',
      enviadoEm: '2026-11-05T09:10:00.000Z',
      enviadoPor: 'admin',
      emailDestinatario: 'vendas@descartaveisecia.com.br'
    };
  }

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

function chaveNfeValida(chave) {
  if (!/^\d{44}$/.test(String(chave || ''))) return false;
  let soma = 0;
  let peso = 2;
  for (let i = 42; i >= 0; i -= 1) {
    soma += Number(chave[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const digito = resto < 2 ? 0 : 11 - resto;
  return digito === Number(chave[43]);
}

// O cadastro mestre é a única fonte local para o CNPJ da empresa destinatária.
// Sem esse vínculo não há como afirmar que uma NF-e pertence ao tenant atual.
function cnpjEmpresa(empresaId) {
  const raiz = db();
  const chave = String(empresaId || '');
  const empresa = raiz.cadastrosMestresKytto?.empresas?.[chave] || raiz.empresas?.[chave];
  const candidatos = [empresa?.cnpjNormalizado, empresa?.cnpj].map(soDigitos);
  return candidatos.find((cnpj) => cnpjValido(cnpj)) || '';
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

function itensPedidoNormalizados(empresaId, itens = [], lojaId = '') {
  if (!Array.isArray(itens) || !itens.length) throw new ComprasError('O pedido precisa de pelo menos um item.', 'PEDIDO_SEM_ITENS');
  const produtos = new Map(barbearia.listarProdutosRevenda(empresaId, { incluirInativos: true }).map((item) => [item.id, item]));
  const porProduto = new Map();
  for (const bruto of itens) {
    const produto = produtos.get(String(bruto?.produtoId || ''));
    if (!produto) throw new ComprasError('Produto do pedido não encontrado na revenda.', 'PRODUTO_INVALIDO');
    if (lojaId && produto.lojaId !== lojaId) throw new ComprasError('Produto do pedido não pertence à unidade ativa.', 'PRODUTO_FORA_DA_UNIDADE', 404);
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

export function listarPedidos(empresaId, { status = '', lojaId = '' } = {}) {
  return Object.values(estado(empresaId).pedidos)
    .filter((item) => !status || item.status === status)
    .filter((item) => registroNaUnidade(item, lojaEscopo(lojaId)))
    .sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)))
    .map(visaoPedido);
}

export function obterPedido(empresaId, pedidoId, { lojaId = '' } = {}) {
  const pedido = estado(empresaId).pedidos[String(pedidoId)];
  return registroNaUnidade(pedido, lojaEscopo(lojaId)) ? visaoPedido(pedido) : null;
}

export function criarPedido(empresaId, dados = {}, opcoes = {}) {
  const atual = estado(empresaId);
  const fornecedor = atual.fornecedores[String(dados.fornecedorId || '')];
  if (!fornecedor || fornecedor.ativo === false) throw new ComprasError('Escolha um fornecedor ativo.', 'FORNECEDOR_NAO_ENCONTRADO');
  const lojaId = lojaEscopo(dados.lojaId ?? opcoes.lojaId);
  const itens = itensPedidoNormalizados(empresaId, dados.itens, lojaId);
  atual.sequenciaPedido += 1;
  const agora = agoraIso(opcoes);
  const pedido = {
    id: novoId('pc'),
    numero: `PC-${String(atual.sequenciaPedido).padStart(5, '0')}`,
    empresaId: String(empresaId),
    lojaId: lojaId || null,
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
  const pedido = pedidoNoEscopo(empresaId, pedidoId, lojaEscopo(dados.lojaId));
  if (pedido.status !== 'rascunho') throw new ComprasError('Só pedido em rascunho pode ser editado.', 'PEDIDO_FECHADO', 409);
  if (dados.itens) pedido.itens = itensPedidoNormalizados(empresaId, dados.itens, lojaEscopo(dados.lojaId) || pedido.lojaId || '');
  if (dados.previsaoEntrega !== undefined) pedido.previsaoEntrega = texto(dados.previsaoEntrega, 10);
  if (dados.observacoes !== undefined) pedido.observacoes = texto(dados.observacoes, 500);
  pedido.atualizadoEm = agoraIso();
  save();
  return visaoPedido(pedido);
}

export function aprovarPedido(empresaId, pedidoId, { usuario = '', lojaId = '' } = {}) {
  const pedido = pedidoNoEscopo(empresaId, pedidoId, lojaEscopo(lojaId));
  if (['aprovado', 'enviado', 'recebido', 'recebido_parcial'].includes(pedido.status)) return visaoPedido(pedido);
  Object.assign(pedido, {
    status: 'aprovado',
    aprovadoEm: agoraIso(),
    aprovadoPor: texto(usuario, 160) || 'Gestor de Compras',
    atualizadoEm: agoraIso(),
  });
  save();
  return visaoPedido(pedido);
}
export function enviarPedido(empresaId, pedidoId, { usuario = '', lojaId = '', emailDestinatario = '', mensagem = '' } = {}) {
  const pedido = pedidoNoEscopo(empresaId, pedidoId, lojaEscopo(lojaId));
  if (pedido.status === 'enviado') return visaoPedido(pedido);
  if (!['rascunho', 'aprovado'].includes(pedido.status)) throw new ComprasError('Só pedido em rascunho ou aprovado pode ser marcado como enviado.', 'PEDIDO_FECHADO', 409);
  Object.assign(pedido, { status: 'enviado', enviadoEm: agoraIso(), enviadoPor: texto(usuario, 160) || null, emailDestinatario: texto(emailDestinatario, 160) || pedido.fornecedorEmail || null, mensagemEnvio: texto(mensagem, 500) || null, atualizadoEm: agoraIso() });
  save();
  return visaoPedido(pedido);
}

export function cancelarPedido(empresaId, pedidoId, { motivo = '', usuario = '', lojaId = '' } = {}) {
  const pedido = pedidoNoEscopo(empresaId, pedidoId, lojaEscopo(lojaId));
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
  const lojaId = lojaEscopo(dados.lojaId ?? opcoes.lojaId);
  const pedido = pedidoNoEscopo(empresaId, pedidoId, lojaId);
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
    barbearia.entradaEstoqueRevenda(empresaId, item.produtoId, { lojaId: pedido.lojaId || null, quantidade, custoUnitario: custo, origem: 'pedido_compra', referencia: pedido.numero, fornecedorId: pedido.fornecedorId, chaveIdempotencia: `pc:${pedido.id}:${chave}:${item.produtoId}`, usuario: dados.usuario, observacao: `Recebimento do pedido ${pedido.numero}` });
    item.recebido += quantidade;
  }
  pedido.recebimentos.push({ chave, lojaId: pedido.lojaId || null, em: agora, usuario: texto(dados.usuario, 160) || null, notaChave: texto(dados.notaChave, 44) || null, itens: aplicar.map(({ item, quantidade, custo }) => ({ produtoId: item.produtoId, quantidade, custoUnitario: custo })) });
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

/**
 * Lê o XML da NF-e (nfeProc ou NFe) e devolve emitente, nota e itens.
 *
 * A presença de `protNFe` isoladamente não prova autorização: só cStat 100/150
 * com chNFe igual à chave do infNFe é tratado como evidência de autorização.
 * Não há tentativa de validar ou fabricar assinatura, certificado ou consulta
 * à SEFAZ neste domínio.
 */
export function lerXmlNfe(xml) {
  const limpo = String(xml || '').replace(/^﻿/, '').trim();
  if (!limpo.startsWith('<')) throw new ComprasError('Arquivo não parece um XML.', 'XML_INVALIDO');
  if (limpo.length > 5_000_000) throw new ComprasError('XML muito grande.', 'XML_GRANDE');
  const errosParser = [];
  let doc;
  try {
    doc = new DOMParser({ onError: (mensagem) => errosParser.push(String(mensagem || 'XML inválido')) }).parseFromString(limpo, 'text/xml');
  } catch {
    throw new ComprasError('XML malformado ou ilegível.', 'XML_INVALIDO');
  }
  if (errosParser.length) throw new ComprasError('XML malformado ou ilegível.', 'XML_INVALIDO');
  const raiz = doc?.documentElement;
  const nomeRaiz = raiz?.localName || raiz?.nodeName;
  if (!raiz || !['nfeProc', 'NFe'].includes(nomeRaiz)) throw new ComprasError('XML não é de uma NF-e.', 'XML_NAO_NFE');
  const inf = primeiro(doc, 'infNFe');
  if (!inf) throw new ComprasError('XML não é de uma NF-e (infNFe ausente).', 'XML_NAO_NFE');
  const id = texto(inf.getAttribute('Id'), 80);
  if (!/^NFe\d{44}$/.test(id)) throw new ComprasError('Chave da NF-e ausente ou malformada no XML.', 'CHAVE_INVALIDA');
  const chave = id.slice(3);
  if (!chaveNfeValida(chave)) throw new ComprasError('Dígito verificador da chave da NF-e inválido.', 'CHAVE_INVALIDA');
  const ide = el(inf, 'ide');
  const emit = el(inf, 'emit');
  const dest = el(inf, 'dest');
  const total = el(inf, 'total', 'ICMSTot');
  if (!ide || !emit || !dest || !total || !txt(ide, 'nNF') || !txt(ide, 'serie')) {
    throw new ComprasError('XML de NF-e incompleto: ide, emitente, destinatário e total são obrigatórios.', 'XML_INCOMPLETO');
  }
  const emitenteCnpj = soDigitos(txt(emit, 'CNPJ'));
  const destinatarioCnpj = soDigitos(txt(dest, 'CNPJ'));
  if (!cnpjValido(emitenteCnpj)) throw new ComprasError('CNPJ do emitente ausente ou inválido no XML.', 'CNPJ_EMITENTE_INVALIDO');
  if (!cnpjValido(destinatarioCnpj)) throw new ComprasError('CNPJ do destinatário ausente ou inválido no XML.', 'CNPJ_DESTINATARIO_INVALIDO');
  const dets = filhos(inf, 'det');
  if (!dets.length) throw new ComprasError('XML de NF-e sem itens.', 'XML_SEM_ITENS');
  const itensUsados = new Set();
  const itens = dets.map((det) => {
    const prod = el(det, 'prod');
    if (!prod) throw new ComprasError('Item da NF-e sem grupo prod.', 'ITEM_NFE_INCOMPLETO');
    const item = Number(det.getAttribute('nItem') || 0);
    const codigo = txt(prod, 'cProd');
    const descricao = txt(prod, 'xProd');
    const qCom = numero(txt(prod, 'qCom'), NaN);
    const valorUnitario = numero(txt(prod, 'vUnCom'), NaN);
    const vProd = numero(txt(prod, 'vProd'), NaN);
    const vDesc = numero(txt(prod, 'vDesc'), 0);
    if (!Number.isInteger(item) || item <= 0 || itensUsados.has(item) || !codigo || !descricao) {
      throw new ComprasError('Item da NF-e incompleto ou duplicado.', 'ITEM_NFE_INCOMPLETO');
    }
    if (!Number.isFinite(qCom) || qCom <= 0 || !Number.isFinite(valorUnitario) || valorUnitario < 0 || !Number.isFinite(vProd) || vProd < 0 || !Number.isFinite(vDesc) || vDesc < 0 || vDesc > vProd) {
      throw new ComprasError(`Valores inválidos no item ${item} da NF-e.`, 'ITEM_NFE_INVALIDO');
    }
    itensUsados.add(item);
    const ean = soDigitos(txt(prod, 'cEAN'));
    return {
      item,
      codigo,
      ean: ean && !/^0+$/.test(ean) ? ean : '',
      descricao,
      ncm: txt(prod, 'NCM'),
      cfop: txt(prod, 'CFOP'),
      unidade: txt(prod, 'uCom'),
      quantidade: qCom,
      valorUnitario,
      valorTotal: vProd,
      desconto: vDesc,
      // Custo efetivo por unidade: valor do item menos o desconto do item.
      custoUnitario: Number(((vProd - vDesc) / qCom).toFixed(4)),
    };
  });
  const protocolo = filhos(raiz, 'protNFe')[0] || null;
  const infProt = protocolo ? el(protocolo, 'infProt') : null;
  const chaveProtocoladaBruta = txt(infProt, 'chNFe');
  const chaveProtocolada = /^\d{44}$/.test(chaveProtocoladaBruta) ? chaveProtocoladaBruta : '';
  const cStat = txt(infProt, 'cStat');
  const vinculoChave = chaveProtocolada === chave;
  const autorizada = Boolean(infProt && ['100', '150'].includes(cStat) && vinculoChave);
  const valorProdutos = numero(txt(total, 'vProd'), NaN);
  const valorNota = numero(txt(total, 'vNF'), NaN);
  if (!Number.isFinite(valorProdutos) || valorProdutos < 0 || !Number.isFinite(valorNota) || valorNota < 0) {
    throw new ComprasError('XML de NF-e incompleto: totais vProd e vNF são obrigatórios.', 'XML_INCOMPLETO');
  }
  return {
    chave,
    numero: txt(ide, 'nNF'),
    serie: txt(ide, 'serie'),
    emissao: txt(ide, 'dhEmi') || txt(ide, 'dEmi'),
    emitente: { cnpj: emitenteCnpj, nome: txt(emit, 'xNome'), fantasia: txt(emit, 'xFant') },
    destinatarioCnpj,
    valorProdutos,
    valorNota,
    autorizada,
    validacao: {
      chave: true,
      emitenteCnpj: true,
      destinatarioCnpj: true,
      protocolo: Boolean(infProt),
      chaveProtocolada,
      vinculoChave,
      cStat: cStat || null,
      autorizacaoVerificavel: autorizada,
    },
    itens,
  };
}

const normalizarNome = (valor) => String(valor || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function validarNotaParaEntrada(empresaId, nota) {
  if (!nota.autorizada) {
    throw new ComprasError('A NF-e não apresenta autorização verificável (cStat 100/150 e chave protocolada correspondente).', 'NFE_NAO_AUTORIZADA', 422);
  }
  const esperado = cnpjEmpresa(empresaId);
  if (!esperado) throw new ComprasError('CNPJ destinatário da empresa não está configurado para vincular a NF-e.', 'CNPJ_DESTINATARIO_NAO_CONFIGURADO', 422);
  if (nota.destinatarioCnpj !== esperado) {
    throw new ComprasError('CNPJ destinatário da NF-e diverge do CNPJ da empresa atual.', 'CNPJ_DESTINATARIO_DIVERGENTE', 422);
  }
  return esperado;
}

function snapshotEscopo(empresaId) {
  const raiz = db();
  const chave = String(empresaId || '');
  return {
    compras: raiz.barbeariaCompras?.[chave] === undefined ? undefined : structuredClone(raiz.barbeariaCompras[chave]),
    // o histórico importado da empresa não muda no recebimento de NF-e: segue por referência
    erp: raiz.barbearias?.[chave] === undefined ? undefined : barbearia.copiarEstadoEmpresaSemHistorico(raiz.barbearias[chave]),
  };
}

function restaurarEscopo(empresaId, snapshot) {
  const raiz = db();
  const chave = String(empresaId || '');
  raiz.barbeariaCompras ||= {};
  raiz.barbearias ||= {};
  if (snapshot.compras === undefined) delete raiz.barbeariaCompras[chave];
  else raiz.barbeariaCompras[chave] = structuredClone(snapshot.compras);
  if (snapshot.erp === undefined) delete raiz.barbearias[chave];
  else raiz.barbearias[chave] = barbearia.copiarEstadoEmpresaSemHistorico(snapshot.erp);
  if (!Object.keys(raiz.barbeariaCompras).length) delete raiz.barbeariaCompras;
  if (!Object.keys(raiz.barbearias).length) delete raiz.barbearias;
}

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
export function previaNotaEntrada(empresaId, xml, opcoes = {}) {
  const lojaId = lojaEscopo(opcoes.lojaId);
  const nota = lerXmlNfe(xml);
  const lancada = estado(empresaId).notasEntrada[nota.chave] || null;
  const destinatarioEsperado = cnpjEmpresa(empresaId);
  const produtos = barbearia.listarProdutosRevenda(empresaId, { incluirInativos: false, lojaId });
  const fornecedor = fornecedorPorCnpj(empresaId, nota.emitente.cnpj);
  const itens = nota.itens.map((item) => {
    const sugestao = sugestaoDeProduto(empresaId, nota, item, produtos);
    const produto = produtos.find((p) => p.id === sugestao.produtoId);
    const fracionado = !Number.isInteger(item.quantidade);
    return { ...item, ...sugestao, produtoNome: produto?.nome || '', estoqueAtual: produto?.estoqueAtual ?? null, custoAtual: produto?.custoUnitario ?? null, alerta: fracionado ? 'quantidade_fracionada' : null };
  });
  return {
    nota: { chave: nota.chave, numero: nota.numero, serie: nota.serie, emissao: nota.emissao, emitente: nota.emitente, destinatarioCnpj: nota.destinatarioCnpj, valorProdutos: nota.valorProdutos, valorNota: nota.valorNota, autorizada: nota.autorizada, validacao: nota.validacao },
    fornecedor: fornecedor ? { id: fornecedor.id, nome: fornecedor.nome } : null,
    destinatarioCnpjEsperado: destinatarioEsperado || null,
    destinatarioVinculado: Boolean(destinatarioEsperado && destinatarioEsperado === nota.destinatarioCnpj),
    aceitaEntrada: Boolean(nota.autorizada && destinatarioEsperado && destinatarioEsperado === nota.destinatarioCnpj),
    jaLancada: Boolean(lancada && registroNaUnidade(lancada, lojaId)),
    lancadaEm: lancada && registroNaUnidade(lancada, lojaId) ? lancada.lancadaEm : null,
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
  const lojaId = lojaEscopo(dados.lojaId ?? opcoes.lojaId);
  const nota = lerXmlNfe(xml);
  validarNotaParaEntrada(empresaId, nota);
  const snapshot = snapshotEscopo(empresaId);
  const atual = estado(empresaId);
  const notaExistente = atual.notasEntrada[nota.chave];
  if (notaExistente) {
    if (!registroNaUnidade(notaExistente, lojaId)) throw new ComprasError('NF-e não encontrada na empresa/unidade ativa.', 'NFE_FORA_DA_UNIDADE', 404);
    return { ...notaExistente, repetida: true };
  }
  const txId = novoId('nfe-tx');
  const transacao = {
    id: txId,
    empresaId: String(empresaId),
    lojaId: lojaId || null,
    chave: nota.chave,
    status: 'processando',
    iniciadoEm: agoraIso(opcoes),
    iniciadoPor: texto(dados.usuario, 160) || null,
    itensPlanejados: nota.itens.map((item) => item.item),
  };
  atual.transacoesEntrada[txId] = transacao;
  save();
  const entradas = [];
  try {
    const decisoes = new Map((dados.itens || []).map((item) => [Number(item.item), item]));
    let fornecedor = fornecedorPorCnpj(empresaId, nota.emitente.cnpj);
    if (!fornecedor && nota.emitente.nome) {
      fornecedor = salvarFornecedor(empresaId, { nome: nota.emitente.fantasia || nota.emitente.nome, cnpj: nota.emitente.cnpj });
    }
    const todosProdutos = barbearia.listarProdutosRevenda(empresaId, { incluirInativos: false });
    const produtos = lojaId ? todosProdutos.filter((produto) => produto.lojaId === lojaId) : todosProdutos;
    const produtosPorId = new Map(todosProdutos.map((produto) => [produto.id, produto]));
    const plano = [];
    for (const item of nota.itens) {
      const decisao = decisoes.get(item.item) || {};
      if (decisao.ignorar === true) { plano.push({ item, ignorado: true }); continue; }
      if (!Number.isInteger(item.quantidade) && !decisao.fatorConversao) throw new ComprasError(`Item ${item.item} (${item.descricao}) tem quantidade fracionada: informe o fator de conversão ou ignore.`, 'QUANTIDADE_FRACIONADA');
      // Fator de conversão: caixa com 12 = 12 unidades no estoque.
      const fator = Math.max(1, Math.round(numero(decisao.fatorConversao, 1)));
      if (!Number.isSafeInteger(fator) || fator <= 0) throw new ComprasError(`Fator de conversão inválido no item ${item.item}.`, 'FATOR_CONVERSAO_INVALIDO');
      let produtoId = decisao.produtoId ? String(decisao.produtoId) : sugestaoDeProduto(empresaId, nota, item, produtos).produtoId;
      if (produtoId) {
        if (!produtosPorId.has(produtoId)) throw new ComprasError(`Produto informado no item ${item.item} não pertence à revenda desta empresa.`, 'PRODUTO_INVALIDO', 404);
      }
      if (!produtoId && decisao.criarProduto === true) {
        const precoVenda = numero(decisao.precoVenda, 0);
        if (precoVenda <= 0) throw new ComprasError(`Informe o preço de venda para criar ${item.descricao}.`, 'PRECO_OBRIGATORIO');
        const criado = barbearia.criarProdutoRevenda(empresaId, { lojaId: lojaId || null, nome: texto(decisao.nome || item.descricao, 140), sku: item.codigo, ean: item.ean, precoVenda, custoUnitario: item.custoUnitario / fator, estoqueAtual: 0, estoqueMinimo: Math.round(numero(decisao.estoqueMinimo, 0)), categoria: decisao.categoria || 'Revenda' });
        produtoId = criado.id;
        produtosPorId.set(criado.id, criado);
        produtos.push(criado);
      }
      if (!produtoId) throw new ComprasError(`Item ${item.item} (${item.descricao}) sem produto: vincule, crie ou ignore.`, 'ITEM_SEM_PRODUTO');
      const quantidade = Math.round(item.quantidade * fator);
      if (!Number.isSafeInteger(quantidade) || quantidade <= 0) throw new ComprasError(`Quantidade resultante inválida no item ${item.item}.`, 'QUANTIDADE_INVALIDA');
      plano.push({ item, produtoId, quantidade, custo: Number((item.custoUnitario / fator).toFixed(4)) });
    }
    const agora = agoraIso(opcoes);
    for (const passo of plano) {
      if (passo.ignorado) continue;
      produtoNoEscopo(empresaId, passo.produtoId, lojaId);
      const r = barbearia.entradaEstoqueRevenda(empresaId, passo.produtoId, { lojaId: lojaId || null, quantidade: passo.quantidade, custoUnitario: passo.custo, origem: 'nfe_entrada', referencia: `NF-e ${nota.numero}/${nota.serie}`, fornecedorId: fornecedor?.id, chaveIdempotencia: `nfe:${nota.chave}:${passo.item.item}`, usuario: dados.usuario, observacao: `NF-e ${nota.numero} · ${nota.emitente.nome}` });
      if (nota.emitente.cnpj && passo.item.codigo) atual.vinculos[`${nota.emitente.cnpj}:${passo.item.codigo}`] = passo.produtoId;
      entradas.push({ item: passo.item.item, produtoId: passo.produtoId, produtoNome: r.produto.nome, quantidade: passo.quantidade, custoUnitario: passo.custo, estoquePosterior: r.produto.estoqueAtual, movimentoId: r.movimento?.id || null });
    }
    // Baixa o pendente do pedido de compra, se informado, sem nova entrada de estoque.
    if (dados.pedidoId) {
      const pedido = pedidoNoEscopo(empresaId, dados.pedidoId, lojaId);
      if (['enviado', 'recebido_parcial', 'rascunho'].includes(pedido.status)) {
        for (const entrada of entradas) {
          const linha = pedido.itens.find((it) => it.produtoId === entrada.produtoId);
          if (linha) linha.recebido = Math.min(linha.quantidade, linha.recebido + entrada.quantidade);
        }
        pedido.recebimentos.push({ chave: `nfe:${nota.chave}`, lojaId: pedido.lojaId || null, em: agora, usuario: texto(dados.usuario, 160) || null, notaChave: nota.chave, itens: entradas.map((e) => ({ produtoId: e.produtoId, quantidade: e.quantidade, custoUnitario: e.custoUnitario })) });
        pedido.status = pedido.itens.every((it) => it.recebido >= it.quantidade) ? 'recebido' : 'recebido_parcial';
        pedido.atualizadoEm = agora;
      }
    }
    const registro = {
      chave: nota.chave,
      empresaId: String(empresaId),
      lojaId: lojaId || null,
      numero: nota.numero,
      serie: nota.serie,
      emissao: nota.emissao,
      fornecedorId: fornecedor?.id || null,
      fornecedorNome: fornecedor?.nome || nota.emitente.nome,
      valorNota: nota.valorNota,
      pedidoId: dados.pedidoId || null,
      transacaoId: txId,
      entradas: entradas.map(({ movimentoId, ...entrada }) => ({ ...entrada, movimentoId })),
      ignorados: plano.filter((p) => p.ignorado).map((p) => ({ item: p.item.item, descricao: p.item.descricao })),
      lancadaEm: agora,
      lancadaPor: texto(dados.usuario, 160) || null,
    };
    atual.transacoesEntrada[txId] = { ...transacao, status: 'concluida', concluidaEm: agora, entradas: entradas.map((entrada) => ({ item: entrada.item, produtoId: entrada.produtoId, movimentoId: entrada.movimentoId })) };
    atual.notasEntrada[nota.chave] = registro;
    save();
    return { ...registro };
  } catch (error) {
    const compensacoes = entradas.map((entrada) => ({ item: entrada.item, produtoId: entrada.produtoId, movimentoId: entrada.movimentoId, tipo: 'restauracao_snapshot', status: 'compensada' }));
    restaurarEscopo(empresaId, snapshot);
    const restaurado = estado(empresaId);
    restaurado.transacoesEntrada[txId] = {
      ...transacao,
      status: 'compensada',
      compensadaEm: agoraIso(opcoes),
      falha: { code: error?.code || 'NFE_ENTRADA_FALHOU', message: String(error?.message || error) },
      compensacoes,
    };
    save();
    throw error;
  }
}

export function listarNotasEntrada(empresaId, { lojaId = '' } = {}) {
  const escopo = lojaEscopo(lojaId);
  return Object.values(estado(empresaId).notasEntrada)
    .filter((item) => registroNaUnidade(item, escopo))
    .sort((a, b) => String(b.lancadaEm).localeCompare(String(a.lancadaEm)))
    .map((item) => ({ ...item }));
}

// Trilha operacional das tentativas, inclusive lançamentos compensados, para
// reconciliação sem expor referências mutáveis do banco em memória.
export function listarTransacoesEntrada(empresaId, { lojaId = '' } = {}) {
  const escopo = lojaEscopo(lojaId);
  return Object.values(estado(empresaId).transacoesEntrada)
    .filter((item) => registroNaUnidade(item, escopo))
    .sort((a, b) => String(b.iniciadoEm).localeCompare(String(a.iniciadoEm)))
    .map((item) => ({ ...item, itensPlanejados: [...(item.itensPlanejados || [])], entradas: item.entradas ? item.entradas.map((entrada) => ({ ...entrada })) : undefined, compensacoes: item.compensacoes ? item.compensacoes.map((compensacao) => ({ ...compensacao })) : undefined }));
}

// ── Vendas de revenda no período (base do giro e da curva ABC) ──────────────

function vendasPorProduto(empresaId, { inicioMs, fimMs, lojaId = '' }) {
  const dentro = (iso) => { const ms = Date.parse(iso || ''); return Number.isFinite(ms) && ms >= inicioMs && ms <= fimMs; };
  const mapa = new Map();
  const somar = (produtoId, quantidade, receita) => {
    const atual = mapa.get(produtoId) || { quantidade: 0, receita: 0 };
    atual.quantidade += Number(quantidade || 0);
    atual.receita += Number(receita || 0);
    mapa.set(produtoId, atual);
  };
  for (const venda of barbearia.listarVendasRevenda(empresaId, { status: 'pago', lojaId })) {
    if (!dentro(venda.pagamento?.confirmadoEm || venda.atualizadoEm)) continue;
    for (const item of venda.itens) somar(item.produtoId, item.quantidade, item.subtotal);
  }
  for (const comanda of barbearia.listarComandasBarbearia(empresaId, { lojaId })) {
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
export function sugestaoReposicao(empresaId, { dias = 60, coberturaDias = 30, lojaId = '' } = {}, opcoes = {}) {
  const escopo = lojaEscopo(lojaId || opcoes.lojaId);
  const j = { ...janela(dias, opcoes), lojaId: escopo };
  const vendas = vendasPorProduto(empresaId, j);
  const fornecedores = new Map(listarFornecedores(empresaId, { incluirInativos: true }).map((f) => [f.id, f]));
  const pendentes = new Map();
  for (const pedido of listarPedidos(empresaId, { lojaId: escopo })) {
    if (!['rascunho', 'enviado', 'recebido_parcial'].includes(pedido.status)) continue;
    for (const item of pedido.itens) pendentes.set(item.produtoId, (pendentes.get(item.produtoId) || 0) + item.pendente);
  }
  const itens = [];
  for (const produto of barbearia.listarProdutosRevenda(empresaId, { lojaId: escopo })) {
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
export function gerarPedidosDeReposicao(empresaId, { fornecedorPadraoId = '', usuario = '', produtosIds = null, lojaId = '' } = {}, opcoes = {}) {
  const escopo = lojaEscopo(lojaId || opcoes.lojaId);
  if (Array.isArray(produtosIds)) produtosIds.forEach((produtoId) => produtoNoEscopo(empresaId, produtoId, escopo));
  const sugestao = sugestaoReposicao(empresaId, { lojaId: escopo }, opcoes);
  const grupos = new Map();
  const semFornecedor = [];
  for (const item of sugestao.itens) {
    if (Array.isArray(produtosIds) && !produtosIds.includes(item.produtoId)) continue;
    const fornecedorId = item.fornecedorId || fornecedorPadraoId;
    if (!fornecedorId) { semFornecedor.push(item.nome); continue; }
    if (!grupos.has(fornecedorId)) grupos.set(fornecedorId, []);
    grupos.get(fornecedorId).push({ produtoId: item.produtoId, quantidade: item.quantidadeSugerida, custoUnitario: item.custoUnitario });
  }
  const pedidos = [...grupos.entries()].map(([fornecedorId, itens]) => criarPedido(empresaId, { fornecedorId, lojaId: escopo || null, itens, origem: 'reposicao_automatica', usuario, observacoes: 'Gerado pela sugestão de reposição (estoque mínimo + giro).' }, { ...opcoes, lojaId: escopo }));
  return { pedidos, semFornecedor };
}

// ── Curva ABC e margem ──────────────────────────────────────────────────────

/**
 * Classifica os produtos pela receita do período: A até 80% acumulado, B até 95%,
 * C o restante. Traz margem bruta (receita − custo médio × quantidade), giro e
 * itens parados (com estoque e sem venda no período).
 */
export function curvaAbc(empresaId, { dias = 90, criterio = 'receita', lojaId = '' } = {}, opcoes = {}) {
  const escopo = lojaEscopo(lojaId || opcoes.lojaId);
  const j = { ...janela(dias, opcoes), lojaId: escopo };
  const vendas = vendasPorProduto(empresaId, j);
  const produtos = barbearia.listarProdutosRevenda(empresaId, { incluirInativos: true, lojaId: escopo });
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
