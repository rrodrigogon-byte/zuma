/**
 * ============================================================================
 * ROTAS OMNICHANNEL — KYTTO ERP v4.0
 * ============================================================================
 * Pedidos unificados, canais externos, webhooks idempotentes, CRM e fidelidade.
 * As integrações externas são assíncronas: o webhook somente valida e enfileira
 * trabalho; nenhuma chamada de parceiro bloqueia a resposta ao provedor.
 */

import express from 'express';
import crypto from 'crypto';
import { randomUUID } from 'crypto';
import * as dbPg from '../db-pg.js';
import { autenticar, autorizar } from './auth.js';

const router = express.Router();

const PROVEDORES = new Set(['ifood', 'uber_eats', 'whatsapp', 'web', 'app', 'telefone', 'manual', 'outro']);
const TIPOS_ENTREGA = new Set(['entrega', 'retirada', 'consumo_local']);
const STATUS_PEDIDO = new Set([
  'novo', 'confirmado', 'em_preparo', 'pronto', 'despachado', 'concluido', 'cancelado', 'rejeitado', 'falha',
]);
const ESTADOS_PAGAMENTO = new Set(['pendente', 'autorizado', 'pago', 'recusado', 'estornado', 'na_entrega']);
const TRANSICOES = {
  // O quadro operacional pode iniciar o preparo diretamente; nesse caso a
  // confirmação é implícita e permanece registrada na trilha de status.
  novo: new Set(['confirmado', 'em_preparo', 'rejeitado', 'cancelado']),
  confirmado: new Set(['em_preparo', 'cancelado', 'rejeitado']),
  em_preparo: new Set(['pronto', 'cancelado']),
  pronto: new Set(['despachado', 'concluido', 'cancelado']),
  despachado: new Set(['concluido', 'cancelado']),
  concluido: new Set(),
  cancelado: new Set(),
  rejeitado: new Set(),
  falha: new Set(['novo', 'cancelado']),
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROLES_OPERACAO = ['admin', 'gerente', 'vendedor', 'garcom', 'caixa', 'operador'];
const ROLES_GESTAO = ['admin', 'gerente'];

function numeroSeguro(valor, { minimo = 0, maximo = Number.POSITIVE_INFINITY, casas = 2 } = {}) {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < minimo || numero > maximo) return null;
  return Number(numero.toFixed(casas));
}

function textoSeguro(valor, limite = 250) {
  if (valor === undefined || valor === null) return null;
  return String(valor).trim().slice(0, limite) || null;
}

function gerarNumeroPedido() {
  const instante = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  return `OMNI-${instante}-${randomUUID().slice(0, 6).toUpperCase()}`;
}

function gerarNumeroVenda(tipoVenda) {
  const instante = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  return `${tipoVenda.slice(0, 3).toUpperCase()}-${instante}-${randomUUID().slice(0, 6).toUpperCase()}`;
}

function normalizarStatusOperacional(status) {
  const mapa = {
    novo: 'pendente',
    confirmado: 'pendente',
    em_preparo: 'preparando',
    pronto: 'pronto',
    despachado: 'entregue',
    concluido: 'entregue',
    cancelado: 'cancelado',
    rejeitado: 'cancelado',
    falha: 'pendente',
  };
  return mapa[status] || 'pendente';
}

function normalizarStatusEntrada(status) {
  const mapa = {
    pendente: 'confirmado',
    preparando: 'em_preparo',
    pronto: 'pronto',
    entregue: 'concluido',
    cancelado: 'cancelado',
    rejeitado: 'rejeitado',
    novo: 'novo',
    confirmado: 'confirmado',
    em_preparo: 'em_preparo',
    despachado: 'despachado',
    concluido: 'concluido',
    falha: 'falha',
  };
  return mapa[status] || null;
}

function normalizarPagamentoEntrada(valor) {
  const mapa = {
    'pix-pendente': 'pendente',
    pendente: 'pendente',
    autorizado: 'autorizado',
    pago: 'pago',
    recusado: 'recusado',
    estornado: 'estornado',
    na_entrega: 'na_entrega',
  };
  return mapa[valor] || null;
}

function estadoPagamentoParaAtendimento(estado) {
  if (estado === 'pago') return 'pago';
  if (estado === 'na_entrega') return 'na-entrega';
  return 'pix-pendente';
}

function obterRawBody(req) {
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody;
  if (typeof req.rawBody === 'string') return Buffer.from(req.rawBody, 'utf8');
  return null;
}

function obterReferenciaEvento(payload, req) {
  const candidatos = [
    payload?.id,
    payload?.eventId,
    payload?.event_id,
    payload?.event?.id,
    payload?.metadata?.eventId,
    req.get('x-event-id'),
    req.get('x-request-id'),
  ];
  const referencia = candidatos.find((valor) => typeof valor === 'string' || typeof valor === 'number');
  return referencia ? String(referencia).slice(0, 200) : null;
}

function obterTipoEvento(payload, req) {
  return textoSeguro(
    payload?.type || payload?.eventType || payload?.event?.type || req.get('x-event-type') || 'evento_desconhecido',
    100,
  );
}

function obterReferenciaPedidoExterno(payload) {
  const candidatos = [
    payload?.orderId,
    payload?.order_id,
    payload?.order?.id,
    payload?.data?.orderId,
    payload?.data?.order?.id,
  ];
  const referencia = candidatos.find((valor) => typeof valor === 'string' || typeof valor === 'number');
  return referencia ? String(referencia).slice(0, 200) : null;
}

function obterSegredoDoAmbiente(canal) {
  const referencia = textoSeguro(canal.credencial_referencia, 250);
  const chaveConfigurada = textoSeguro(canal.configuracao?.segredo_env, 150);
  const chave = chaveConfigurada || (referencia?.startsWith('ENV:') ? referencia.slice(4) : null);
  if (!chave || !/^[A-Z][A-Z0-9_]{2,149}$/.test(chave)) return null;
  return process.env[chave] || null;
}

function comparacaoSegura(a, b) {
  const bufferA = Buffer.from(String(a || ''), 'utf8');
  const bufferB = Buffer.from(String(b || ''), 'utf8');
  return bufferA.length === bufferB.length && crypto.timingSafeEqual(bufferA, bufferB);
}

function validarAssinaturaWebhook(req, canal) {
  if (canal.algoritmo_assinatura === 'nenhum') {
    return process.env.NODE_ENV !== 'production';
  }

  const segredo = obterSegredoDoAmbiente(canal);
  const corpo = obterRawBody(req);
  const cabecalho = canal.cabecalho_assinatura || 'x-signature';
  const assinaturaRecebida = req.get(cabecalho);
  if (!segredo || !corpo || !assinaturaRecebida) return false;

  if (canal.algoritmo_assinatura === 'token_estatico') {
    return comparacaoSegura(assinaturaRecebida, segredo);
  }

  const assinaturaEsperada = crypto
    .createHmac('sha256', segredo)
    .update(corpo)
    .digest('hex');
  const assinaturaNormalizada = String(assinaturaRecebida).replace(/^sha256=/i, '').trim();
  return comparacaoSegura(assinaturaNormalizada, assinaturaEsperada);
}

async function registrarAuditoriaSemBloquear(dados) {
  try {
    await dbPg.registrarAuditoria(dados);
  } catch (error) {
    // A operação principal já foi confirmada. O erro permanece visível no log,
    // mas não deve induzir o cliente a reenviar uma ação idempotente.
    console.error('Falha ao registrar auditoria omnichannel:', error.message);
  }
}

async function buscarPedidoDaLoja(id, empresaId, lojaId, client = null, forUpdate = false) {
  const executor = client ? dbPg.queryInTransaction.bind(null, client) : dbPg.query;
  const resultado = await executor(
    `SELECT p.*, c.nome AS cliente_cadastrado_nome, c.telefone AS cliente_cadastrado_telefone,
            ci.provedor AS canal_provedor, ci.nome AS canal_nome
       FROM pedidos_omnichannel p
       LEFT JOIN clientes c ON c.id = p.cliente_id
       LEFT JOIN canais_integracao ci ON ci.id = p.canal_id
      WHERE p.id = $1 AND p.empresa_id = $2 AND p.loja_id = $3
      ${forUpdate ? 'FOR UPDATE' : ''}`,
    [id, empresaId, lojaId],
  );
  return resultado.rows[0] || null;
}

async function buscarItensPedido(pedidoId, client = null) {
  const executor = client ? dbPg.queryInTransaction.bind(null, client) : dbPg.query;
  const resultado = await executor(
    `SELECT i.*, p.codigo_interno, p.codigo_barras
       FROM itens_pedido_omnichannel i
       LEFT JOIN produtos p ON p.id = i.produto_id
      WHERE i.pedido_id = $1
      ORDER BY i.data_criacao, i.id`,
    [pedidoId],
  );
  return resultado.rows;
}

function projetarPedidoAtendimento(pedido, itens) {
  return {
    id: pedido.id,
    codigo: pedido.numero_interno,
    status: normalizarStatusOperacional(pedido.status),
    statusFiscal: pedido.status,
    pagamento: estadoPagamentoParaAtendimento(pedido.estado_pagamento),
    total: Number(pedido.valor_total),
    origem: pedido.origem,
    tipoEntrega: pedido.tipo_entrega,
    cliente: {
      id: pedido.cliente_id,
      nome: pedido.cliente_cadastrado_nome || pedido.cliente_nome || 'Cliente não identificado',
      tel: pedido.cliente_cadastrado_telefone || pedido.cliente_telefone || null,
    },
    itens: itens.map((item) => ({
      id: item.id,
      produtoId: item.produto_id,
      nome: item.nome,
      qtd: Number(item.quantidade),
      preco: Number(item.valor_unitario),
      subtotal: Number(item.valor_total),
      observacoes: item.observacoes,
    })),
    observacoes: pedido.observacoes,
    previstoPara: pedido.previsto_para,
    criadoEm: pedido.recebido_em || pedido.data_criacao,
    atualizadoEm: pedido.data_atualizacao,
  };
}

async function localizarOuCriarCliente(client, empresaId, dados) {
  const nome = textoSeguro(dados?.nome, 200);
  const telefone = textoSeguro(dados?.telefone, 30);
  const email = textoSeguro(dados?.email, 200)?.toLowerCase();
  if (!nome && !telefone && !email) return null;

  if (telefone || email) {
    const existente = await dbPg.queryInTransaction(
      client,
      `SELECT * FROM clientes
       WHERE empresa_id = $1
         AND ativo = true
         AND (($2::varchar IS NOT NULL AND telefone = $2) OR ($3::varchar IS NOT NULL AND lower(email) = $3))
       ORDER BY criado_em DESC
       LIMIT 1
       FOR UPDATE`,
      [empresaId, telefone, email],
    );
    if (existente.rows[0]) return existente.rows[0];
  }

  if (!nome) return null;
  const criado = await dbPg.queryInTransaction(
    client,
    `INSERT INTO clientes (empresa_id, nome, telefone, email, endereco_logradouro, endereco_numero, endereco_bairro, cidade, uf, cep)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      empresaId,
      nome,
      telefone,
      email,
      textoSeguro(dados?.endereco?.logradouro, 200),
      textoSeguro(dados?.endereco?.numero, 20),
      textoSeguro(dados?.endereco?.bairro, 100),
      textoSeguro(dados?.endereco?.cidade, 100),
      textoSeguro(dados?.endereco?.uf, 2)?.toUpperCase(),
      textoSeguro(dados?.endereco?.cep, 10),
    ],
  );
  return criado.rows[0];
}

function validarItensEntrada(itens) {
  if (!Array.isArray(itens) || itens.length === 0 || itens.length > 500) {
    throw Object.assign(new Error('Informe entre 1 e 500 itens'), { statusCode: 400 });
  }

  return itens.map((item) => {
    const quantidade = numeroSeguro(item.quantidade ?? item.qtd, { minimo: 0.001, casas: 3 });
    const valorUnitario = numeroSeguro(item.valor_unitario ?? item.preco, { minimo: 0, casas: 2 });
    const desconto = numeroSeguro(item.valor_desconto ?? item.desconto ?? 0, { minimo: 0, casas: 2 });
    const nome = textoSeguro(item.nome, 250);
    if (!nome || quantidade === null || valorUnitario === null || desconto === null) {
      throw Object.assign(new Error('Cada item precisa de nome, quantidade positiva e preço válido'), { statusCode: 400 });
    }
    const valorBruto = Number((quantidade * valorUnitario).toFixed(2));
    if (desconto > valorBruto) {
      throw Object.assign(new Error(`Desconto inválido no item ${nome}`), { statusCode: 400 });
    }
    return {
      produto_id: UUID_REGEX.test(item.produto_id || '') ? item.produto_id : null,
      codigo_externo: textoSeguro(item.codigo_externo, 160),
      nome,
      quantidade,
      valor_unitario: valorUnitario,
      valor_desconto: desconto,
      valor_total: Number((valorBruto - desconto).toFixed(2)),
      observacoes: textoSeguro(item.observacoes, 1000),
      dados_origem: item.dados_origem && typeof item.dados_origem === 'object' ? item.dados_origem : {},
    };
  });
}

const tentativasCheckoutPublico = new Map();

function limitarCheckoutPublico(req, res, next) {
  const chave = `${req.ip || 'desconhecido'}:${req.path.split('/').slice(1, 3).join('/')}`;
  const agora = Date.now();
  const janelaMs = 10 * 60 * 1000;
  const maximo = 20;
  const anteriores = (tentativasCheckoutPublico.get(chave) || []).filter((instante) => agora - instante < janelaMs);
  if (anteriores.length >= maximo) {
    return res.status(429).json({ erro: 'Muitas solicitações. Tente novamente em alguns minutos.' });
  }
  anteriores.push(agora);
  tentativasCheckoutPublico.set(chave, anteriores);
  if (tentativasCheckoutPublico.size > 10000) {
    for (const [chaveAntiga, instantes] of tentativasCheckoutPublico.entries()) {
      if (!instantes.length || agora - instantes[instantes.length - 1] > janelaMs) tentativasCheckoutPublico.delete(chaveAntiga);
    }
  }
  return next();
}

async function resolverLojaPublica(referencia) {
  const codigoPublico = textoSeguro(referencia, 36) || textoSeguro(process.env.KYTTO_LOJA_PUBLICA_CODIGO, 36);
  if (!codigoPublico || !UUID_REGEX.test(codigoPublico)) {
    throw Object.assign(new Error('Loja pública não configurada'), { statusCode: 404 });
  }
  const resultado = await dbPg.query(
    `SELECT id, empresa_id, codigo, nome, nome_fantasia, codigo_publico
       FROM lojas
      WHERE codigo_publico = $1 AND ativa = true`,
    [codigoPublico],
  );
  if (!resultado.rows[0]) throw Object.assign(new Error('Loja não encontrada ou inativa'), { statusCode: 404 });
  return resultado.rows[0];
}

async function montarItensCheckoutPublico(loja, itensEntrada) {
  if (!Array.isArray(itensEntrada) || itensEntrada.length === 0 || itensEntrada.length > 100) {
    throw Object.assign(new Error('Informe entre 1 e 100 itens para finalizar o pedido'), { statusCode: 400 });
  }
  const entradas = itensEntrada.map((item) => ({
    produtoId: textoSeguro(item?.produtoId || item?.produto_id, 36),
    quantidade: numeroSeguro(item?.qtd ?? item?.quantidade, { minimo: 0.001, casas: 3 }),
    observacoes: textoSeguro(item?.observacoes || item?.tamanho, 1000),
  }));
  if (entradas.some((item) => !UUID_REGEX.test(item.produtoId || '') || item.quantidade === null || item.quantidade > 9999)) {
    throw Object.assign(new Error('O carrinho possui produto ou quantidade inválidos'), { statusCode: 400 });
  }

  const ids = [...new Set(entradas.map((item) => item.produtoId))];
  const resultado = await dbPg.query(
    `SELECT p.id, p.nome,
            COALESCE(
              CASE
                WHEN ppl.ativo = true
                 AND (ppl.data_inicio IS NULL OR ppl.data_inicio <= CURRENT_TIMESTAMP)
                 AND (ppl.data_fim IS NULL OR ppl.data_fim >= CURRENT_TIMESTAMP)
                 AND ppl.preco_promocional IS NOT NULL THEN ppl.preco_promocional
                WHEN ppl.ativo = true
                 AND (ppl.data_inicio IS NULL OR ppl.data_inicio <= CURRENT_TIMESTAMP)
                 AND (ppl.data_fim IS NULL OR ppl.data_fim >= CURRENT_TIMESTAMP) THEN ppl.preco_venda
                WHEN p.preco_promocao IS NOT NULL THEN p.preco_promocao
                ELSE p.preco_venda
              END,
              p.preco_venda
            ) AS preco_venda_atual
       FROM produtos p
       LEFT JOIN precos_produto_loja ppl
         ON ppl.produto_id = p.id AND ppl.empresa_id = p.empresa_id AND ppl.loja_id = $2
      WHERE p.empresa_id = $1 AND p.id = ANY($3::uuid[]) AND p.ativo = true`,
    [loja.empresa_id, loja.id, ids],
  );
  if (resultado.rows.length !== ids.length) {
    throw Object.assign(new Error('Um ou mais produtos não estão disponíveis nesta loja'), { statusCode: 409 });
  }
  const produtos = new Map(resultado.rows.map((produto) => [produto.id, produto]));
  return entradas.map((entrada) => {
    const produto = produtos.get(entrada.produtoId);
    return {
      produto_id: produto.id,
      nome: produto.nome,
      quantidade: entrada.quantidade,
      valor_unitario: Number(produto.preco_venda_atual),
      valor_desconto: 0,
      observacoes: entrada.observacoes,
      dados_origem: { checkout_publico: true },
    };
  });
}

function projetarPedidoPublico(pedido, itens) {
  return {
    codigo: pedido.codigo_rastreio,
    status: normalizarStatusOperacional(pedido.status),
    pagamento: estadoPagamentoParaAtendimento(pedido.estado_pagamento),
    tipoEntrega: pedido.tipo_entrega,
    itens: itens.map((item) => ({
      nome: item.nome,
      qtd: Number(item.quantidade),
      preco: Number(item.valor_unitario),
      subtotal: Number(item.valor_total),
    })),
    total: Number(pedido.valor_total),
    previstoPara: pedido.previsto_para,
    criadoEm: pedido.recebido_em || pedido.data_criacao,
  };
}

async function criarPedidoInterno({ client, empresaId, lojaId, usuarioId = null, corpo, origemForcada = null, canalId = null, eventoId = null }) {
  const origem = origemForcada || textoSeguro(corpo.origem, 30) || 'manual';
  if (!PROVEDORES.has(origem)) throw Object.assign(new Error('Origem do pedido inválida'), { statusCode: 400 });
  const tipoEntrega = textoSeguro(corpo.tipo_entrega, 20) || 'retirada';
  if (!TIPOS_ENTREGA.has(tipoEntrega)) throw Object.assign(new Error('Tipo de entrega inválido'), { statusCode: 400 });

  const itens = validarItensEntrada(corpo.itens);
  const valorProdutos = Number(itens.reduce((soma, item) => soma + item.valor_total, 0).toFixed(2));
  const valorDescontoAdicional = numeroSeguro(corpo.valor_desconto_adicional ?? 0, { minimo: 0, casas: 2 });
  const taxaEntrega = numeroSeguro(corpo.taxa_entrega ?? 0, { minimo: 0, casas: 2 });
  const taxaServico = numeroSeguro(corpo.taxa_servico ?? 0, { minimo: 0, casas: 2 });
  if ([valorDescontoAdicional, taxaEntrega, taxaServico].some((valor) => valor === null) || valorDescontoAdicional > valorProdutos) {
    throw Object.assign(new Error('Valores financeiros do pedido são inválidos'), { statusCode: 400 });
  }

  const clienteDados = corpo.cliente || {
    nome: corpo.cliente_nome,
    telefone: corpo.cliente_telefone,
    email: corpo.cliente_email,
    endereco: corpo.endereco_entrega,
  };
  const cliente = await localizarOuCriarCliente(client, empresaId, clienteDados);
  const descontoItens = itens.reduce((soma, item) => soma + item.valor_desconto, 0);
  const descontoTotal = Number((descontoItens + valorDescontoAdicional).toFixed(2));
  const valorTotal = Number((valorProdutos - valorDescontoAdicional + taxaEntrega + taxaServico).toFixed(2));
  const enderecoEntrega = clienteDados?.endereco && typeof clienteDados.endereco === 'object'
    ? clienteDados.endereco
    : {};

  const pedidoResultado = await dbPg.queryInTransaction(
    client,
    `INSERT INTO pedidos_omnichannel
      (empresa_id, loja_id, canal_id, cliente_id, numero_interno, numero_externo, codigo_rastreio, origem, status,
       status_provedor, estado_pagamento, tipo_entrega, cliente_nome, cliente_telefone,
       endereco_entrega, observacoes, valor_produtos, valor_desconto, taxa_entrega, taxa_servico,
       valor_total, previsto_para, dados_origem)
     VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, 'novo', $9, $10, $11, $12, $13, $14::jsonb, $15,
       $16, $17, $18, $19, $20, $21, $22::jsonb)
     RETURNING *`,
    [
      empresaId,
      lojaId,
      canalId,
      cliente?.id || null,
      gerarNumeroPedido(),
      textoSeguro(corpo.numero_externo, 160),
      randomUUID(),
      origem,
      textoSeguro(corpo.status_provedor, 100),
      ESTADOS_PAGAMENTO.has(corpo.estado_pagamento) ? corpo.estado_pagamento : 'pendente',
      tipoEntrega,
      cliente?.nome || textoSeguro(clienteDados?.nome, 200),
      cliente?.telefone || textoSeguro(clienteDados?.telefone, 30),
      JSON.stringify(enderecoEntrega),
      textoSeguro(corpo.observacoes, 5000),
      valorProdutos,
      descontoTotal,
      taxaEntrega,
      taxaServico,
      valorTotal,
      corpo.previsto_para || null,
      JSON.stringify(corpo.dados_origem && typeof corpo.dados_origem === 'object' ? corpo.dados_origem : {}),
    ],
  );
  const pedido = pedidoResultado.rows[0];

  for (const item of itens) {
    await dbPg.queryInTransaction(
      client,
      `INSERT INTO itens_pedido_omnichannel
       (pedido_id, produto_id, codigo_externo, nome, quantidade, valor_unitario, valor_desconto, valor_total, observacoes, dados_origem)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)`,
      [
        pedido.id,
        item.produto_id,
        item.codigo_externo,
        item.nome,
        item.quantidade,
        item.valor_unitario,
        item.valor_desconto,
        item.valor_total,
        item.observacoes,
        JSON.stringify(item.dados_origem),
      ],
    );
  }

  await dbPg.queryInTransaction(
    client,
    `INSERT INTO historico_status_pedido_omnichannel
     (pedido_id, status_anterior, status_novo, origem, usuario_id, evento_integracao_id, observacao)
     VALUES ($1, NULL, 'novo', $2, $3, $4, $5)`,
    [pedido.id, eventoId ? 'canal' : 'operador', usuarioId, eventoId, 'Pedido recebido'],
  );

  if (cliente) {
    await dbPg.queryInTransaction(
      client,
      `INSERT INTO interacoes_cliente (empresa_id, loja_id, cliente_id, pedido_id, usuario_id, tipo, origem, assunto, conteudo)
       VALUES ($1, $2, $3, $4, $5, 'pedido', $6, $7, $8)`,
      [empresaId, lojaId, cliente.id, pedido.id, usuarioId, origem, `Pedido ${pedido.numero_interno}`, 'Pedido registrado no canal omnichannel'],
    );
  }

  return { pedido, itens };
}

async function adicionarAcaoExterna(client, { empresaId, lojaId, pedido, acao, usuarioId = null }) {
  if (!pedido.canal_id || !['ifood', 'uber_eats'].includes(pedido.origem)) return null;
  const resultado = await dbPg.queryInTransaction(
    client,
    `INSERT INTO acoes_externas_pedido (empresa_id, loja_id, pedido_id, canal_id, acao, payload, solicitado_por)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
     RETURNING *`,
    [
      empresaId,
      lojaId,
      pedido.id,
      pedido.canal_id,
      acao,
      JSON.stringify({ numero_externo: pedido.numero_externo, status: pedido.status }),
      usuarioId,
    ],
  );
  return resultado.rows[0];
}

async function creditarFidelidadePorPedido(client, pedido, usuarioId = null) {
  if (!pedido.cliente_id || pedido.estado_pagamento !== 'pago') return null;
  const configuracao = await dbPg.queryInTransaction(
    client,
    `SELECT * FROM configuracoes_fidelidade_loja
      WHERE empresa_id = $1 AND loja_id = $2 AND ativo = true
      FOR UPDATE`,
    [pedido.empresa_id, pedido.loja_id],
  );
  const regra = configuracao.rows[0];
  if (!regra || Number(pedido.valor_total) < Number(regra.valor_minimo_compra)) return null;

  const pontos = Math.floor(Number(pedido.valor_total) * Number(regra.pontos_por_real));
  if (pontos <= 0) return null;
  const expiraEm = regra.validade_dias
    ? new Date(Date.now() + Number(regra.validade_dias) * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const extrato = await dbPg.queryInTransaction(
    client,
    `INSERT INTO extrato_pontos
     (empresa_id, loja_id, cliente_id, pedido_id, venda_id, tipo, pontos, descricao, referencia_id, expira_em)
     VALUES ($1, $2, $3, $4, $5, 'credito', $6, $7, $4, $8)
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [
      pedido.empresa_id,
      pedido.loja_id,
      pedido.cliente_id,
      pedido.id,
      pedido.venda_id,
      pontos,
      `Crédito do pedido ${pedido.numero_interno}`,
      expiraEm,
    ],
  );
  if (!extrato.rows[0]) return null;

  await dbPg.queryInTransaction(
    client,
    `INSERT INTO programa_fidelidade (empresa_id, cliente_id, pontos, total_gasto, atualizado_em)
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
     ON CONFLICT (empresa_id, cliente_id)
     DO UPDATE SET pontos = programa_fidelidade.pontos + EXCLUDED.pontos,
                   total_gasto = programa_fidelidade.total_gasto + EXCLUDED.total_gasto,
                   atualizado_em = CURRENT_TIMESTAMP`,
    [pedido.empresa_id, pedido.cliente_id, pontos, pedido.valor_total],
  );

  await dbPg.queryInTransaction(
    client,
    `INSERT INTO interacoes_cliente (empresa_id, loja_id, cliente_id, pedido_id, usuario_id, tipo, origem, assunto, conteudo, metadados)
     VALUES ($1, $2, $3, $4, $5, 'fidelidade', 'interno', 'Pontos creditados', $6, $7::jsonb)`,
    [
      pedido.empresa_id,
      pedido.loja_id,
      pedido.cliente_id,
      pedido.id,
      usuarioId,
      `${pontos} ponto(s) de fidelidade creditado(s)`,
      JSON.stringify({ pontos, extrato_id: extrato.rows[0].id }),
    ],
  );
  return { pontos, extrato: extrato.rows[0] };
}

async function materializarVendaEEstoque(client, pedido, usuarioId) {
  if (pedido.venda_id) return { venda_id: pedido.venda_id, ja_existia: true };
  const itens = await buscarItensPedido(pedido.id, client);
  if (itens.some((item) => !item.produto_id)) {
    throw Object.assign(new Error('Todos os itens precisam estar vinculados ao catálogo antes do preparo'), { statusCode: 409 });
  }

  for (const item of itens) {
    const produto = await dbPg.queryInTransaction(
      client,
      `SELECT id FROM produtos WHERE id = $1 AND empresa_id = $2 AND ativo = true`,
      [item.produto_id, pedido.empresa_id],
    );
    if (!produto.rows[0]) {
      throw Object.assign(new Error(`Produto do item ${item.nome} não está ativo nesta empresa`), { statusCode: 409 });
    }

    const saldos = await dbPg.queryInTransaction(
      client,
      `SELECT id, quantidade, lote, validade
         FROM estoque
        WHERE empresa_id = $1 AND loja_id = $2 AND produto_id = $3 AND quantidade > 0
        ORDER BY validade NULLS LAST, data_atualizacao ASC
        FOR UPDATE`,
      [pedido.empresa_id, pedido.loja_id, item.produto_id],
    );
    const disponivel = saldos.rows.reduce((soma, saldo) => soma + Number(saldo.quantidade), 0);
    if (disponivel < Number(item.quantidade)) {
      throw Object.assign(new Error(`Estoque insuficiente para ${item.nome}`), {
        statusCode: 409,
        disponivel,
        solicitado: Number(item.quantidade),
      });
    }

    let restante = Number(item.quantidade);
    for (const saldo of saldos.rows) {
      if (restante <= 0) break;
      const retirada = Math.min(Number(saldo.quantidade), restante);
      await dbPg.queryInTransaction(
        client,
        `UPDATE estoque SET quantidade = quantidade - $1, data_atualizacao = CURRENT_TIMESTAMP WHERE id = $2`,
        [retirada, saldo.id],
      );
      await dbPg.queryInTransaction(
        client,
        `INSERT INTO movimentacoes_estoque
         (empresa_id, loja_id, produto_id, pedido_omnichannel_id, tipo, quantidade, lote, validade, motivo, usuario_id)
         VALUES ($1, $2, $3, $4, 'saida', $5, $6, $7, $8, $9)`,
        [
          pedido.empresa_id,
          pedido.loja_id,
          item.produto_id,
          pedido.id,
          retirada,
          saldo.lote,
          saldo.validade,
          `Pedido omnichannel ${pedido.numero_interno}`,
          usuarioId,
        ],
      );
      restante -= retirada;
    }
  }

  const tipoVenda = pedido.origem === 'web' || pedido.origem === 'app' ? 'online' : 'delivery';
  const vendaResultado = await dbPg.queryInTransaction(
    client,
    `INSERT INTO vendas
     (empresa_id, loja_id, numero_venda, usuario_vendedor_id, tipo_venda, status, valor_bruto, valor_desconto, valor_liquido, observacoes)
     VALUES ($1, $2, $3, $4, $5, 'aberta', $6, $7, $8, $9)
     RETURNING *`,
    [
      pedido.empresa_id,
      pedido.loja_id,
      gerarNumeroVenda(tipoVenda),
      usuarioId,
      tipoVenda,
      pedido.valor_produtos,
      pedido.valor_desconto,
      pedido.valor_total,
      `Originada pelo pedido omnichannel ${pedido.numero_interno}`,
    ],
  );
  const venda = vendaResultado.rows[0];
  for (const item of itens) {
    await dbPg.queryInTransaction(
      client,
      `INSERT INTO itens_venda (venda_id, produto_id, quantidade, valor_unitario, valor_total, desconto_item, observacoes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        venda.id,
        item.produto_id,
        item.quantidade,
        item.valor_unitario,
        item.valor_total,
        item.valor_desconto,
        item.observacoes,
      ],
    );
  }

  await dbPg.queryInTransaction(
    client,
    `UPDATE pedidos_omnichannel
        SET venda_id = $1, estoque_baixado_em = CURRENT_TIMESTAMP
      WHERE id = $2`,
    [venda.id, pedido.id],
  );
  return { venda_id: venda.id, venda, ja_existia: false };
}

async function restaurarEstoquePedido(client, pedido, usuarioId) {
  if (!pedido.estoque_baixado_em || pedido.estoque_reposto_em) return false;
  const movimentos = await dbPg.queryInTransaction(
    client,
    `SELECT produto_id, quantidade, lote, validade
       FROM movimentacoes_estoque
      WHERE empresa_id = $1 AND loja_id = $2 AND pedido_omnichannel_id = $3 AND tipo = 'saida'
      ORDER BY data_operacao, id
      FOR UPDATE`,
    [pedido.empresa_id, pedido.loja_id, pedido.id],
  );

  for (const movimento of movimentos.rows) {
    const saldo = await dbPg.queryInTransaction(
      client,
      `SELECT id FROM estoque
        WHERE empresa_id = $1 AND loja_id = $2 AND produto_id = $3
          AND lote IS NOT DISTINCT FROM $4 AND validade IS NOT DISTINCT FROM $5
        FOR UPDATE`,
      [pedido.empresa_id, pedido.loja_id, movimento.produto_id, movimento.lote, movimento.validade],
    );
    if (saldo.rows[0]) {
      await dbPg.queryInTransaction(
        client,
        `UPDATE estoque SET quantidade = quantidade + $1, data_atualizacao = CURRENT_TIMESTAMP WHERE id = $2`,
        [movimento.quantidade, saldo.rows[0].id],
      );
    } else {
      await dbPg.queryInTransaction(
        client,
        `INSERT INTO estoque (empresa_id, loja_id, produto_id, quantidade, lote, validade)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [pedido.empresa_id, pedido.loja_id, movimento.produto_id, movimento.quantidade, movimento.lote, movimento.validade],
      );
    }
    await dbPg.queryInTransaction(
      client,
      `INSERT INTO movimentacoes_estoque
       (empresa_id, loja_id, produto_id, pedido_omnichannel_id, tipo, quantidade, lote, validade, motivo, usuario_id)
       VALUES ($1, $2, $3, $4, 'entrada', $5, $6, $7, $8, $9)`,
      [
        pedido.empresa_id,
        pedido.loja_id,
        movimento.produto_id,
        pedido.id,
        movimento.quantidade,
        movimento.lote,
        movimento.validade,
        `Estorno do pedido omnichannel ${pedido.numero_interno}`,
        usuarioId,
      ],
    );
  }

  await dbPg.queryInTransaction(
    client,
    `UPDATE pedidos_omnichannel SET estoque_reposto_em = CURRENT_TIMESTAMP WHERE id = $1`,
    [pedido.id],
  );
  return movimentos.rows.length > 0;
}

/**
 * Checkout web público: recebe somente IDs e quantidades; produtos, preços e
 * unidade são revalidados no servidor antes de criar o pedido omnichannel.
 */
router.post('/loja/pedido', limitarCheckoutPublico, async (req, res) => {
  let client;
  try {
    const loja = await resolverLojaPublica(req.body?.loja_publica || req.get('x-kytto-loja'));
    const itens = await montarItensCheckoutPublico(loja, req.body?.itens);
    const clienteEntrada = req.body?.cliente && typeof req.body.cliente === 'object' ? req.body.cliente : {};
    const corpo = {
      origem: 'web',
      tipo_entrega: TIPOS_ENTREGA.has(req.body?.tipo_entrega)
        ? req.body.tipo_entrega
        : (clienteEntrada.endereco ? 'entrega' : 'retirada'),
      estado_pagamento: normalizarPagamentoEntrada(req.body?.estado_pagamento) || 'pendente',
      cliente: {
        nome: clienteEntrada.nome,
        telefone: clienteEntrada.telefone || clienteEntrada.tel,
        email: clienteEntrada.email,
        endereco: clienteEntrada.endereco,
      },
      itens,
      observacoes: textoSeguro(req.body?.observacoes, 5000),
      taxa_entrega: 0,
      taxa_servico: 0,
      dados_origem: { checkout_publico: true, ip: textoSeguro(req.ip, 100) },
    };
    client = await dbPg.beginTransaction();
    const { pedido, itens: itensCriados } = await criarPedidoInterno({
      client,
      empresaId: loja.empresa_id,
      lojaId: loja.id,
      corpo,
      origemForcada: 'web',
    });
    await dbPg.commitTransaction(client);
    client = null;
    await registrarAuditoriaSemBloquear({
      empresa_id: loja.empresa_id,
      loja_id: loja.id,
      tabela: 'pedidos_omnichannel',
      operacao: 'INSERT',
      registro_id: pedido.id,
      dados_novo: { origem: 'web', codigo_rastreio: pedido.codigo_rastreio, total: pedido.valor_total },
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
    });
    return res.status(201).json({
      codigo: pedido.codigo_rastreio,
      pedido: projetarPedidoPublico(pedido, itensCriados),
    });
  } catch (error) {
    if (client) await dbPg.rollbackTransaction(client);
    const status = error.statusCode || 500;
    if (status >= 500) console.error('Erro no checkout público omnichannel:', error);
    return res.status(status).json({ erro: status >= 500 ? 'Não foi possível registrar o pedido agora' : error.message });
  }
});

/** Consulta pública não enumerável, sem dados pessoais, para acompanhamento. */
router.get('/loja/pedido/:codigo', limitarCheckoutPublico, async (req, res) => {
  try {
    if (!UUID_REGEX.test(req.params.codigo || '')) return res.status(404).json({ erro: 'Pedido não encontrado' });
    const resultado = await dbPg.query(
      `SELECT p.*
         FROM pedidos_omnichannel p
        WHERE p.codigo_rastreio = $1
        LIMIT 1`,
      [req.params.codigo],
    );
    const pedido = resultado.rows[0];
    if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado' });
    const itens = await buscarItensPedido(pedido.id);
    return res.json(projetarPedidoPublico(pedido, itens));
  } catch (error) {
    console.error('Erro ao consultar pedido público omnichannel:', error);
    return res.status(500).json({ erro: 'Não foi possível consultar o pedido agora' });
  }
});

/**
 * Webhook público: busca o canal pelo código público, valida assinatura sobre o
 * corpo original e responde rapidamente após persistir um evento idempotente.
 */
router.post('/webhooks/:codigoPublico', async (req, res) => {
  try {
    if (!UUID_REGEX.test(req.params.codigoPublico)) {
      return res.status(404).json({ erro: 'Canal não encontrado' });
    }
    const canalResultado = await dbPg.query(
      `SELECT * FROM canais_integracao WHERE codigo_publico = $1 AND status = 'ativo'`,
      [req.params.codigoPublico],
    );
    const canal = canalResultado.rows[0];
    if (!canal) return res.status(404).json({ erro: 'Canal não encontrado ou inativo' });

    if (!validarAssinaturaWebhook(req, canal)) {
      return res.status(401).json({ erro: 'Assinatura do webhook inválida' });
    }

    const eventoExternoId = obterReferenciaEvento(req.body, req);
    if (!eventoExternoId) {
      return res.status(400).json({ erro: 'O evento não possui identificador idempotente' });
    }
    const rawBody = obterRawBody(req);
    const hashCorpo = crypto.createHash('sha256').update(rawBody).digest('hex');
    const eventoResultado = await dbPg.query(
      `INSERT INTO eventos_integracao_canais
       (empresa_id, loja_id, canal_id, evento_externo_id, tipo_evento, assinatura_valida, hash_corpo, payload)
       VALUES ($1, $2, $3, $4, $5, true, $6, $7::jsonb)
       ON CONFLICT (canal_id, evento_externo_id) DO NOTHING
       RETURNING *`,
      [
        canal.empresa_id,
        canal.loja_id,
        canal.id,
        eventoExternoId,
        obterTipoEvento(req.body, req),
        hashCorpo,
        JSON.stringify(req.body || {}),
      ],
    );

    if (!eventoResultado.rows[0]) {
      return res.status(202).json({ aceito: true, duplicado: true });
    }
    const evento = eventoResultado.rows[0];
    await dbPg.query(
      `INSERT INTO tarefas_integracao_canais
       (empresa_id, loja_id, canal_id, evento_integracao_id, tipo, referencia_externa, payload)
       VALUES ($1, $2, $3, $4, 'buscar_pedido', $5, $6::jsonb)`,
      [
        canal.empresa_id,
        canal.loja_id,
        canal.id,
        evento.id,
        obterReferenciaPedidoExterno(req.body),
        JSON.stringify({ tipo_evento: evento.tipo_evento }),
      ],
    );

    return res.status(202).json({ aceito: true, evento_id: evento.id });
  } catch (error) {
    console.error('Erro ao receber webhook omnichannel:', error);
    return res.status(500).json({ erro: 'Falha ao receber evento externo' });
  }
});

router.use(autenticar);

/** GET /canais — lista os canais configurados da loja ativa. */
router.get('/canais', autorizar(...ROLES_GESTAO), async (req, res) => {
  try {
    const params = [req.empresaId];
    let sql = `SELECT id, codigo_publico, provedor, nome, status, modo_operacao, cabecalho_assinatura,
              algoritmo_assinatura, credencial_referencia, configuracao, ultimo_evento_em,
              ultima_sincronizacao_em, ultimo_erro, data_criacao, data_atualizacao
         FROM canais_integracao
        WHERE empresa_id = $1`;
    if (req.lojaId) {
      params.push(req.lojaId);
      sql += ` AND (loja_id = $2 OR loja_id IS NULL)`;
    }
    sql += ` ORDER BY nome`;
    const resultado = await dbPg.query(sql, params);
    res.json({ sucesso: true, loja_id: req.lojaId, canais: resultado.rows });
  } catch (error) {
    console.error('Erro ao listar canais omnichannel:', error);
    res.status(500).json({ erro: 'Erro ao listar canais de integração' });
  }
});

/** POST /canais — cadastra um canal; o segredo real permanece no ambiente. */
router.post('/canais', autorizar(...ROLES_GESTAO), async (req, res) => {
  try {
    const provedor = textoSeguro(req.body.provedor, 30);
    const nome = textoSeguro(req.body.nome, 120);
    const status = textoSeguro(req.body.status, 20) || 'rascunho';
    const modoOperacao = textoSeguro(req.body.modo_operacao, 20) || 'webhook';
    const algoritmo = textoSeguro(req.body.algoritmo_assinatura, 30) || 'hmac_sha256';
    const segredoEnv = textoSeguro(req.body.segredo_env, 150);
    if (!PROVEDORES.has(provedor) || !nome || !['rascunho', 'ativo', 'pausado', 'erro', 'desativado'].includes(status)) {
      return res.status(400).json({ erro: 'Dados do canal inválidos' });
    }
    if (!['webhook', 'polling', 'manual', 'misto'].includes(modoOperacao) || !['hmac_sha256', 'token_estatico', 'nenhum'].includes(algoritmo)) {
      return res.status(400).json({ erro: 'Modo ou algoritmo de assinatura inválido' });
    }
    if (segredoEnv && !/^[A-Z][A-Z0-9_]{2,149}$/.test(segredoEnv)) {
      return res.status(400).json({ erro: 'O nome da variável de segredo é inválido' });
    }
    if (status === 'ativo' && algoritmo !== 'nenhum' && !segredoEnv) {
      return res.status(400).json({ erro: 'Canal ativo requer uma referência de segredo em ambiente' });
    }
    if (algoritmo === 'nenhum' && process.env.NODE_ENV === 'production') {
      return res.status(400).json({ erro: 'Não é permitido ativar webhook sem assinatura em produção' });
    }

    const configuracaoEntrada = req.body.configuracao && typeof req.body.configuracao === 'object' ? req.body.configuracao : {};
    const configuracao = { ...configuracaoEntrada, ...(segredoEnv ? { segredo_env: segredoEnv } : {}) };
    const resultado = await dbPg.query(
      `INSERT INTO canais_integracao
       (empresa_id, loja_id, provedor, nome, status, modo_operacao, cabecalho_assinatura,
        algoritmo_assinatura, credencial_referencia, api_base_url, configuracao, criado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12)
       RETURNING id, codigo_publico, provedor, nome, status, modo_operacao, cabecalho_assinatura,
                 algoritmo_assinatura, credencial_referencia, api_base_url, configuracao`,
      [
        req.empresaId,
        req.lojaId,
        provedor,
        nome,
        status,
        modoOperacao,
        textoSeguro(req.body.cabecalho_assinatura, 100) || 'x-signature',
        algoritmo,
        segredoEnv ? `ENV:${segredoEnv}` : null,
        textoSeguro(req.body.api_base_url, 1000),
        JSON.stringify(configuracao),
        req.usuario.usuario_id,
      ],
    );
    const canal = resultado.rows[0];
    await registrarAuditoriaSemBloquear({
      empresa_id: req.empresaId,
      loja_id: req.lojaId,
      usuario_id: req.usuario.usuario_id,
      tabela: 'canais_integracao',
      operacao: 'INSERT',
      registro_id: canal.id,
      dados_novo: { provedor: canal.provedor, status: canal.status },
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
    });
    res.status(201).json({ sucesso: true, canal, webhook_url: `/omnichannel/webhooks/${canal.codigo_publico}` });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ erro: 'Já existe canal deste provedor para esta loja' });
    console.error('Erro ao criar canal omnichannel:', error);
    res.status(500).json({ erro: 'Erro ao criar canal de integração' });
  }
});

/** GET /pedidos — quadro operacional de pedidos da loja ativa. */
router.get('/pedidos', autorizar(...ROLES_OPERACAO), async (req, res) => {
  try {
    const { status, origem, data_inicio, data_fim, limit = 100, offset = 0 } = req.query;
    const parametros = [req.empresaId, req.lojaId];
    let indice = 3;
    let sql = `SELECT p.*, c.nome AS cliente_cadastrado_nome, c.telefone AS cliente_cadastrado_telefone
                 FROM pedidos_omnichannel p
                 LEFT JOIN clientes c ON c.id = p.cliente_id
                WHERE p.empresa_id = $1 AND p.loja_id = $2`;
    if (status) {
      const statusNormalizado = normalizarStatusEntrada(status) || status;
      if (!STATUS_PEDIDO.has(statusNormalizado)) return res.status(400).json({ erro: 'Filtro de status inválido' });
      sql += ` AND p.status = $${indice}`;
      parametros.push(statusNormalizado);
      indice += 1;
    }
    if (origem) {
      if (!PROVEDORES.has(origem)) return res.status(400).json({ erro: 'Filtro de origem inválido' });
      sql += ` AND p.origem = $${indice}`;
      parametros.push(origem);
      indice += 1;
    }
    if (data_inicio) { sql += ` AND p.recebido_em >= $${indice}`; parametros.push(data_inicio); indice += 1; }
    if (data_fim) { sql += ` AND p.recebido_em <= $${indice}`; parametros.push(data_fim); indice += 1; }
    const limite = Math.min(Math.max(Number(limit) || 100, 1), 500);
    const deslocamento = Math.max(Number(offset) || 0, 0);
    sql += ` ORDER BY p.recebido_em ASC LIMIT $${indice} OFFSET $${indice + 1}`;
    parametros.push(limite, deslocamento);

    const pedidosResultado = await dbPg.query(sql, parametros);
    const pedidos = [];
    for (const pedido of pedidosResultado.rows) {
      pedidos.push(projetarPedidoAtendimento(pedido, await buscarItensPedido(pedido.id)));
    }
    // Mantém o formato de array esperado pela central operacional legada.
    res.json(pedidos);
  } catch (error) {
    console.error('Erro ao listar pedidos omnichannel:', error);
    res.json([]);
  }
});

/** POST /pedidos — registra pedido manual, web/app interno ou importação controlada. */
router.post('/pedidos', autorizar(...ROLES_OPERACAO), async (req, res) => {
  const client = await dbPg.beginTransaction();
  try {
    const { pedido, itens } = await criarPedidoInterno({
      client,
      empresaId: req.empresaId,
      lojaId: req.lojaId,
      usuarioId: req.usuario.usuario_id,
      corpo: req.body,
    });
    await dbPg.commit(client);
    const projetado = projetarPedidoAtendimento({ ...pedido, cliente_cadastrado_nome: pedido.cliente_nome, cliente_cadastrado_telefone: pedido.cliente_telefone }, itens);
    await registrarAuditoriaSemBloquear({
      empresa_id: req.empresaId,
      loja_id: req.lojaId,
      usuario_id: req.usuario.usuario_id,
      tabela: 'pedidos_omnichannel',
      operacao: 'INSERT',
      registro_id: pedido.id,
      dados_novo: { numero_interno: pedido.numero_interno, origem: pedido.origem, valor_total: pedido.valor_total },
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
    });
    res.status(201).json({ sucesso: true, pedido: projetado });
  } catch (error) {
    await dbPg.rollback(client);
    console.error('Erro ao criar pedido omnichannel:', error);
    res.status(error.statusCode || 500).json({ erro: error.message || 'Erro ao criar pedido' });
  }
});

/** GET /pedidos/:id — detalhe completo de um pedido da loja ativa. */
router.get('/pedidos/:id', autorizar(...ROLES_OPERACAO), async (req, res) => {
  try {
    const pedido = await buscarPedidoDaLoja(req.params.id, req.empresaId, req.lojaId);
    if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado nesta loja' });
    const [itens, historico] = await Promise.all([
      buscarItensPedido(pedido.id),
      dbPg.query(
        `SELECT h.*, u.nome_completo AS usuario_nome
           FROM historico_status_pedido_omnichannel h
           LEFT JOIN usuarios u ON u.id = h.usuario_id
          WHERE h.pedido_id = $1
          ORDER BY h.criado_em DESC`,
        [pedido.id],
      ),
    ]);
    res.json({ sucesso: true, pedido: projetarPedidoAtendimento(pedido, itens), historico: historico.rows });
  } catch (error) {
    console.error('Erro ao obter pedido omnichannel:', error);
    res.status(500).json({ erro: 'Erro ao obter pedido' });
  }
});

/** PATCH /pedidos/:id — atualiza status/pagamento com máquina de estados e estoque. */
router.patch('/pedidos/:id', autorizar(...ROLES_OPERACAO), async (req, res) => {
  const client = await dbPg.beginTransaction();
  try {
    const pedido = await buscarPedidoDaLoja(req.params.id, req.empresaId, req.lojaId, client, true);
    if (!pedido) {
      await dbPg.rollback(client);
      return res.status(404).json({ erro: 'Pedido não encontrado nesta loja' });
    }

    const novoStatus = req.body.status !== undefined ? normalizarStatusEntrada(req.body.status) : null;
    const novoPagamento = req.body.pagamento !== undefined
      ? normalizarPagamentoEntrada(req.body.pagamento)
      : (req.body.estado_pagamento !== undefined ? normalizarPagamentoEntrada(req.body.estado_pagamento) : null);
    if (req.body.status !== undefined && !novoStatus) {
      await dbPg.rollback(client);
      return res.status(400).json({ erro: 'Status inválido' });
    }
    if ((req.body.pagamento !== undefined || req.body.estado_pagamento !== undefined) && !novoPagamento) {
      await dbPg.rollback(client);
      return res.status(400).json({ erro: 'Estado de pagamento inválido' });
    }
    if (!novoStatus && !novoPagamento) {
      await dbPg.rollback(client);
      return res.status(400).json({ erro: 'Informe status ou pagamento' });
    }
    if (novoStatus && novoStatus !== pedido.status && !TRANSICOES[pedido.status]?.has(novoStatus)) {
      await dbPg.rollback(client);
      return res.status(409).json({ erro: `Transição inválida: ${pedido.status} → ${novoStatus}` });
    }

    let venda = null;
    if (novoStatus === 'em_preparo' && !pedido.venda_id) {
      const materializacao = await materializarVendaEEstoque(client, pedido, req.usuario.usuario_id);
      venda = materializacao.venda || null;
      pedido.venda_id = materializacao.venda_id;
      pedido.estoque_baixado_em = new Date().toISOString();
    }
    if (novoStatus === 'cancelado') {
      await restaurarEstoquePedido(client, pedido, req.usuario.usuario_id);
      if (pedido.venda_id) {
        await dbPg.queryInTransaction(
          client,
          `UPDATE vendas SET status = 'cancelada' WHERE id = $1 AND empresa_id = $2 AND loja_id = $3 AND status = 'aberta'`,
          [pedido.venda_id, req.empresaId, req.lojaId],
        );
      }
    }

    const statusFinal = novoStatus || pedido.status;
    const pagamentoFinal = novoPagamento || pedido.estado_pagamento;
    const atualizacao = await dbPg.queryInTransaction(
      client,
      `UPDATE pedidos_omnichannel
          SET status = $1,
              estado_pagamento = $2,
              confirmado_em = CASE WHEN $1 IN ('confirmado', 'em_preparo') THEN COALESCE(confirmado_em, CURRENT_TIMESTAMP) ELSE confirmado_em END,
              concluido_em = CASE WHEN $1 = 'concluido' THEN COALESCE(concluido_em, CURRENT_TIMESTAMP) ELSE concluido_em END,
              cancelado_em = CASE WHEN $1 IN ('cancelado', 'rejeitado') THEN COALESCE(cancelado_em, CURRENT_TIMESTAMP) ELSE cancelado_em END,
              cancelado_por = CASE WHEN $1 IN ('cancelado', 'rejeitado') THEN $3 ELSE cancelado_por END,
              motivo_cancelamento = CASE WHEN $1 IN ('cancelado', 'rejeitado') THEN COALESCE($4, motivo_cancelamento) ELSE motivo_cancelamento END
        WHERE id = $5
        RETURNING *`,
      [
        statusFinal,
        pagamentoFinal,
        req.usuario.usuario_id,
        textoSeguro(req.body.motivo_cancelamento, 1000),
        pedido.id,
      ],
    );
    const pedidoAtualizado = atualizacao.rows[0];

    if (novoStatus && novoStatus !== pedido.status) {
      await dbPg.queryInTransaction(
        client,
        `INSERT INTO historico_status_pedido_omnichannel
         (pedido_id, status_anterior, status_novo, origem, usuario_id, observacao)
         VALUES ($1, $2, $3, 'operador', $4, $5)`,
        [pedido.id, pedido.status, novoStatus, req.usuario.usuario_id, textoSeguro(req.body.observacao, 1000)],
      );
      const acaoMapa = {
        confirmado: 'aceitar',
        rejeitado: 'rejeitar',
        em_preparo: 'iniciar_preparo',
        pronto: 'pronto',
        despachado: 'despachar',
        cancelado: 'cancelar',
      };
      if (acaoMapa[novoStatus]) await adicionarAcaoExterna(client, {
        empresaId: req.empresaId,
        lojaId: req.lojaId,
        pedido: pedidoAtualizado,
        acao: acaoMapa[novoStatus],
        usuarioId: req.usuario.usuario_id,
      });
    }

    if (novoStatus === 'concluido' && pagamentoFinal === 'pago') {
      if (pedidoAtualizado.venda_id) {
        await dbPg.queryInTransaction(
          client,
          `UPDATE vendas SET status = 'fechada' WHERE id = $1 AND empresa_id = $2 AND loja_id = $3 AND status = 'aberta'`,
          [pedidoAtualizado.venda_id, req.empresaId, req.lojaId],
        );
      }
      await creditarFidelidadePorPedido(client, pedidoAtualizado, req.usuario.usuario_id);
    }

    await dbPg.commit(client);
    const itens = await buscarItensPedido(pedidoAtualizado.id);
    await registrarAuditoriaSemBloquear({
      empresa_id: req.empresaId,
      loja_id: req.lojaId,
      usuario_id: req.usuario.usuario_id,
      tabela: 'pedidos_omnichannel',
      operacao: 'UPDATE',
      registro_id: pedidoAtualizado.id,
      dados_anterior: { status: pedido.status, estado_pagamento: pedido.estado_pagamento },
      dados_novo: { status: pedidoAtualizado.status, estado_pagamento: pedidoAtualizado.estado_pagamento, venda_id: pedidoAtualizado.venda_id },
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
    });
    res.json({ sucesso: true, pedido: projetarPedidoAtendimento(pedidoAtualizado, itens), venda });
  } catch (error) {
    await dbPg.rollback(client);
    console.error('Erro ao atualizar pedido omnichannel:', error);
    res.status(error.statusCode || 500).json({
      erro: error.message || 'Erro ao atualizar pedido',
      ...(error.disponivel !== undefined ? { disponivel: error.disponivel, solicitado: error.solicitado } : {}),
    });
  }
});

/** POST /pedidos/:id/vincular-venda — materializa estoque/venda para pedido já confirmado. */
router.post('/pedidos/:id/vincular-venda', autorizar(...ROLES_OPERACAO), async (req, res) => {
  const client = await dbPg.beginTransaction();
  try {
    const pedido = await buscarPedidoDaLoja(req.params.id, req.empresaId, req.lojaId, client, true);
    if (!pedido) {
      await dbPg.rollback(client);
      return res.status(404).json({ erro: 'Pedido não encontrado nesta loja' });
    }
    if (!['confirmado', 'em_preparo', 'pronto', 'despachado'].includes(pedido.status)) {
      await dbPg.rollback(client);
      return res.status(409).json({ erro: 'O pedido precisa estar confirmado para materializar a venda' });
    }
    const resultado = await materializarVendaEEstoque(client, pedido, req.usuario.usuario_id);
    await dbPg.commit(client);
    res.json({ sucesso: true, ...resultado });
  } catch (error) {
    await dbPg.rollback(client);
    console.error('Erro ao materializar venda omnichannel:', error);
    res.status(error.statusCode || 500).json({ erro: error.message || 'Erro ao materializar venda' });
  }
});

/** GET /fidelidade/configuracao — retorna a regra ativa da loja selecionada. */
router.get('/fidelidade/configuracao', autorizar(...ROLES_GESTAO), async (req, res) => {
  try {
    const resultado = await dbPg.query(
      `SELECT * FROM configuracoes_fidelidade_loja
        WHERE empresa_id = $1 AND loja_id = $2
        LIMIT 1`,
      [req.empresaId, req.lojaId],
    );
    return res.json({
      sucesso: true,
      configuracao: resultado.rows[0] || {
        ativo: false,
        pontos_por_real: 1,
        valor_minimo_compra: 0,
        pontos_por_real_resgate: 100,
        valor_por_bloco_resgate: 1,
        percentual_maximo_desconto: 30,
        validade_dias: null,
      },
    });
  } catch (error) {
    console.error('Erro ao consultar configuração de fidelidade:', error);
    return res.status(500).json({ erro: 'Erro ao consultar configuração de fidelidade' });
  }
});

/** PUT /fidelidade/configuracao — cria ou atualiza parâmetros por loja. */
router.put('/fidelidade/configuracao', autorizar(...ROLES_GESTAO), async (req, res) => {
  try {
    const entrada = req.body && typeof req.body === 'object' ? req.body : {};
    const ativo = entrada.ativo === undefined ? true : entrada.ativo;
    if (typeof ativo !== 'boolean') return res.status(400).json({ erro: 'O campo ativo deve ser booleano' });

    const pontosPorReal = numeroSeguro(entrada.pontos_por_real ?? 1, { minimo: 0, casas: 4 });
    const valorMinimo = numeroSeguro(entrada.valor_minimo_compra ?? 0, { minimo: 0, casas: 2 });
    const pontosResgate = numeroSeguro(entrada.pontos_por_real_resgate ?? 100, { minimo: 0.0001, casas: 4 });
    const valorBloco = numeroSeguro(entrada.valor_por_bloco_resgate ?? 1, { minimo: 0.01, casas: 2 });
    const percentualMaximo = numeroSeguro(entrada.percentual_maximo_desconto ?? 30, { minimo: 0, maximo: 100, casas: 2 });
    const validadeDias = entrada.validade_dias === null || entrada.validade_dias === undefined || entrada.validade_dias === ''
      ? null
      : Number(entrada.validade_dias);
    if ([pontosPorReal, valorMinimo, pontosResgate, valorBloco, percentualMaximo].some((valor) => valor === null)
      || (validadeDias !== null && (!Number.isInteger(validadeDias) || validadeDias <= 0))) {
      return res.status(400).json({ erro: 'Parâmetros de fidelidade inválidos' });
    }

    const resultado = await dbPg.query(
      `INSERT INTO configuracoes_fidelidade_loja
       (empresa_id, loja_id, ativo, pontos_por_real, valor_minimo_compra,
        pontos_por_real_resgate, valor_por_bloco_resgate, percentual_maximo_desconto,
        validade_dias, criado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (empresa_id, loja_id) DO UPDATE SET
         ativo = EXCLUDED.ativo,
         pontos_por_real = EXCLUDED.pontos_por_real,
         valor_minimo_compra = EXCLUDED.valor_minimo_compra,
         pontos_por_real_resgate = EXCLUDED.pontos_por_real_resgate,
         valor_por_bloco_resgate = EXCLUDED.valor_por_bloco_resgate,
         percentual_maximo_desconto = EXCLUDED.percentual_maximo_desconto,
         validade_dias = EXCLUDED.validade_dias,
         data_atualizacao = CURRENT_TIMESTAMP
       RETURNING *`,
      [req.empresaId, req.lojaId, ativo, pontosPorReal, valorMinimo, pontosResgate, valorBloco, percentualMaximo, validadeDias, req.usuario.usuario_id],
    );
    const configuracao = resultado.rows[0];
    await registrarAuditoriaSemBloquear({
      empresa_id: req.empresaId,
      loja_id: req.lojaId,
      usuario_id: req.usuario.usuario_id,
      tabela: 'configuracoes_fidelidade_loja',
      operacao: 'UPDATE',
      registro_id: configuracao.id,
      dados_novo: {
        ativo: configuracao.ativo,
        pontos_por_real: configuracao.pontos_por_real,
        percentual_maximo_desconto: configuracao.percentual_maximo_desconto,
      },
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
    });
    return res.json({ sucesso: true, configuracao });
  } catch (error) {
    console.error('Erro ao salvar configuração de fidelidade:', error);
    return res.status(500).json({ erro: 'Erro ao salvar configuração de fidelidade' });
  }
});

/** GET /clientes — busca clientes para consulta CRM e operação de fidelidade. */
router.get('/clientes', autorizar(...ROLES_OPERACAO), async (req, res) => {
  try {
    const termo = textoSeguro(req.query.busca, 120);
    const limite = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
    const parametros = [req.empresaId, req.lojaId];
    let sql = `SELECT c.id, c.nome, c.telefone, c.email, c.ativo,
                      COALESCE(pf.pontos, 0) AS pontos,
                      COUNT(DISTINCT po.id)::int AS total_pedidos_loja,
                      MAX(po.recebido_em) AS ultimo_pedido_em
                 FROM clientes c
            LEFT JOIN programa_fidelidade pf
                   ON pf.empresa_id = c.empresa_id AND pf.cliente_id = c.id
            LEFT JOIN pedidos_omnichannel po
                   ON po.empresa_id = c.empresa_id AND po.loja_id = $2 AND po.cliente_id = c.id
                WHERE c.empresa_id = $1 AND c.ativo = true`;
    if (termo) {
      parametros.push(`%${termo}%`);
      sql += ` AND (c.nome ILIKE $3 OR c.telefone ILIKE $3 OR c.email ILIKE $3)`;
    }
    sql += ` GROUP BY c.id, c.nome, c.telefone, c.email, c.ativo, pf.pontos
             ORDER BY ultimo_pedido_em DESC NULLS LAST, c.nome ASC
             LIMIT $${parametros.length + 1}`;
    parametros.push(limite);
    const resultado = await dbPg.query(sql, parametros);
    return res.json({ sucesso: true, clientes: resultado.rows });
  } catch (error) {
    console.error('Erro ao listar clientes omnichannel:', error);
    return res.status(500).json({ erro: 'Erro ao listar clientes' });
  }
});

/** POST /fidelidade/resgatar — aplica desconto de pontos antes de o pedido ser materializado. */
router.post('/fidelidade/resgatar', autorizar(...ROLES_OPERACAO), async (req, res) => {
  const client = await dbPg.beginTransaction();
  try {
    const pedidoId = req.body.pedido_id;
    const valorDesconto = numeroSeguro(req.body.valor_desconto, { minimo: 0.01, casas: 2 });
    if (!UUID_REGEX.test(pedidoId || '') || valorDesconto === null) {
      await dbPg.rollback(client);
      return res.status(400).json({ erro: 'Pedido e valor de desconto válido são obrigatórios' });
    }
    const pedido = await buscarPedidoDaLoja(pedidoId, req.empresaId, req.lojaId, client, true);
    if (!pedido || !pedido.cliente_id) {
      await dbPg.rollback(client);
      return res.status(404).json({ erro: 'Pedido ou cliente não encontrado' });
    }
    if (pedido.venda_id || ['concluido', 'cancelado', 'rejeitado'].includes(pedido.status)) {
      await dbPg.rollback(client);
      return res.status(409).json({ erro: 'Não é possível resgatar pontos após materialização ou encerramento do pedido' });
    }
    const config = await dbPg.queryInTransaction(
      client,
      `SELECT * FROM configuracoes_fidelidade_loja
        WHERE empresa_id = $1 AND loja_id = $2 AND ativo = true
        FOR UPDATE`,
      [req.empresaId, req.lojaId],
    );
    const regra = config.rows[0];
    if (!regra) {
      await dbPg.rollback(client);
      return res.status(409).json({ erro: 'Programa de fidelidade não está ativo nesta loja' });
    }
    const maximo = Number((Number(pedido.valor_produtos) * Number(regra.percentual_maximo_desconto) / 100).toFixed(2));
    if (valorDesconto > maximo || valorDesconto > Number(pedido.valor_total)) {
      await dbPg.rollback(client);
      return res.status(400).json({ erro: 'Desconto acima do limite permitido pelo programa' });
    }
    const pontos = Math.ceil((valorDesconto / Number(regra.valor_por_bloco_resgate)) * Number(regra.pontos_por_real_resgate));
    const programa = await dbPg.queryInTransaction(
      client,
      `SELECT * FROM programa_fidelidade WHERE empresa_id = $1 AND cliente_id = $2 FOR UPDATE`,
      [req.empresaId, pedido.cliente_id],
    );
    if (!programa.rows[0] || Number(programa.rows[0].pontos) < pontos) {
      await dbPg.rollback(client);
      return res.status(409).json({ erro: 'Saldo de pontos insuficiente', pontos_necessarios: pontos, pontos_disponiveis: Number(programa.rows[0]?.pontos || 0) });
    }
    const extrato = await dbPg.queryInTransaction(
      client,
      `INSERT INTO extrato_pontos
       (empresa_id, loja_id, cliente_id, pedido_id, tipo, pontos, descricao, referencia_id)
       VALUES ($1, $2, $3, $4, 'debito', $5, $6, $4)
       RETURNING *`,
      [req.empresaId, req.lojaId, pedido.cliente_id, pedido.id, -pontos, `Resgate no pedido ${pedido.numero_interno}`],
    );
    await dbPg.queryInTransaction(
      client,
      `UPDATE programa_fidelidade
          SET pontos = pontos - $1, atualizado_em = CURRENT_TIMESTAMP
        WHERE empresa_id = $2 AND cliente_id = $3`,
      [pontos, req.empresaId, pedido.cliente_id],
    );
    const pedidoAtualizado = await dbPg.queryInTransaction(
      client,
      `UPDATE pedidos_omnichannel
          SET valor_desconto = valor_desconto + $1,
              valor_total = valor_total - $1
        WHERE id = $2
        RETURNING *`,
      [valorDesconto, pedido.id],
    );
    const resgate = await dbPg.queryInTransaction(
      client,
      `INSERT INTO resgates_fidelidade
       (empresa_id, loja_id, cliente_id, pedido_id, extrato_debito_id, pontos_resgatados, valor_desconto, criado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [req.empresaId, req.lojaId, pedido.cliente_id, pedido.id, extrato.rows[0].id, pontos, valorDesconto, req.usuario.usuario_id],
    );
    await dbPg.commit(client);
    res.status(201).json({ sucesso: true, pedido: pedidoAtualizado.rows[0], resgate: resgate.rows[0], pontos_utilizados: pontos });
  } catch (error) {
    await dbPg.rollback(client);
    console.error('Erro ao resgatar fidelidade:', error);
    res.status(error.statusCode || 500).json({ erro: error.message || 'Erro ao resgatar pontos' });
  }
});

/** GET /clientes/:id/fidelidade — saldo, extrato e consentimentos por cliente. */
router.get('/clientes/:id/fidelidade', autorizar(...ROLES_OPERACAO), async (req, res) => {
  try {
    const cliente = await dbPg.query(
      `SELECT * FROM clientes WHERE id = $1 AND empresa_id = $2`,
      [req.params.id, req.empresaId],
    );
    if (!cliente.rows[0]) return res.status(404).json({ erro: 'Cliente não encontrado' });
    const [programa, extrato, consentimentos] = await Promise.all([
      dbPg.query(`SELECT * FROM programa_fidelidade WHERE empresa_id = $1 AND cliente_id = $2`, [req.empresaId, req.params.id]),
      dbPg.query(
        `SELECT * FROM extrato_pontos WHERE empresa_id = $1 AND cliente_id = $2 ORDER BY criado_em DESC LIMIT 200`,
        [req.empresaId, req.params.id],
      ),
      dbPg.query(
        `SELECT canal, finalidade, concedido, origem, atualizado_em
           FROM consentimentos_cliente WHERE empresa_id = $1 AND cliente_id = $2
          ORDER BY canal, finalidade`,
        [req.empresaId, req.params.id],
      ),
    ]);
    res.json({ sucesso: true, cliente: cliente.rows[0], programa: programa.rows[0] || null, extrato: extrato.rows, consentimentos: consentimentos.rows });
  } catch (error) {
    console.error('Erro ao consultar fidelidade:', error);
    res.status(500).json({ erro: 'Erro ao consultar fidelidade' });
  }
});

/** PUT /clientes/:id/consentimentos — registra consentimentos LGPD com evidência. */
router.put('/clientes/:id/consentimentos', autorizar(...ROLES_OPERACAO), async (req, res) => {
  try {
    const { canal, finalidade, concedido, evidencia = {} } = req.body;
    if (!['email', 'sms', 'whatsapp', 'push', 'telefone'].includes(canal)
      || !['marketing', 'atendimento', 'fidelidade', 'transacional'].includes(finalidade)
      || typeof concedido !== 'boolean') {
      return res.status(400).json({ erro: 'Dados de consentimento inválidos' });
    }
    const cliente = await dbPg.query(`SELECT id FROM clientes WHERE id = $1 AND empresa_id = $2`, [req.params.id, req.empresaId]);
    if (!cliente.rows[0]) return res.status(404).json({ erro: 'Cliente não encontrado' });
    const resultado = await dbPg.query(
      `INSERT INTO consentimentos_cliente
       (empresa_id, cliente_id, canal, finalidade, concedido, origem, evidencia, atualizado_por)
       VALUES ($1, $2, $3, $4, $5, 'operador', $6::jsonb, $7)
       ON CONFLICT (empresa_id, cliente_id, canal, finalidade)
       DO UPDATE SET concedido = EXCLUDED.concedido, origem = EXCLUDED.origem,
                     evidencia = EXCLUDED.evidencia, atualizado_por = EXCLUDED.atualizado_por,
                     atualizado_em = CURRENT_TIMESTAMP
       RETURNING *`,
      [req.empresaId, req.params.id, canal, finalidade, concedido, JSON.stringify(evidencia), req.usuario.usuario_id],
    );
    res.json({ sucesso: true, consentimento: resultado.rows[0] });
  } catch (error) {
    console.error('Erro ao registrar consentimento:', error);
    res.status(500).json({ erro: 'Erro ao registrar consentimento' });
  }
});

/** GET /integracoes/tarefas — acompanha a fila segura de sincronização dos canais. */
router.get('/integracoes/tarefas', autorizar(...ROLES_GESTAO), async (req, res) => {
  try {
    const tarefas = await dbPg.query(
      `SELECT t.*, c.nome AS canal_nome, c.provedor
         FROM tarefas_integracao_canais t
         JOIN canais_integracao c ON c.id = t.canal_id
        WHERE t.empresa_id = $1 AND t.loja_id = $2
        ORDER BY t.criado_em DESC
        LIMIT 200`,
      [req.empresaId, req.lojaId],
    );
    const acoes = await dbPg.query(
      `SELECT a.*, p.numero_interno, c.nome AS canal_nome
         FROM acoes_externas_pedido a
         JOIN pedidos_omnichannel p ON p.id = a.pedido_id
         LEFT JOIN canais_integracao c ON c.id = a.canal_id
        WHERE a.empresa_id = $1 AND a.loja_id = $2
        ORDER BY a.solicitado_em DESC
        LIMIT 200`,
      [req.empresaId, req.lojaId],
    );
    res.json({ sucesso: true, tarefas: tarefas.rows, acoes: acoes.rows });
  } catch (error) {
    console.error('Erro ao consultar fila omnichannel:', error);
    res.json({ sucesso: true, tarefas: [], acoes: [] });
  }
});

export default router;
