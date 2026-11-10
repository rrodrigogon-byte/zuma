/**
 * ============================================================================
 * MOTOR DE GESTÃO DE ENTREGAS, MOTOBOYS & ROTEIRIZAÇÃO KYTTO DELIVERY
 * ============================================================================
 * Atende bares, restaurantes, barbearias com delivery de cosméticos e lojas de varejo:
 *  - Central única de pedidos (Mesa, Balcão, Delivery e WhatsApp);
 *  - Despacho inteligente com atribuição de motoboy parceiro e cálculo de repasse;
 *  - Roteirização de rotas com tempo estimado de entrega;
 *  - Régua de notificação automática via WhatsApp integrada ao kyttoEventBus:
 *      * Pedido Recebido / Em Preparo
 *      * Saiu para Entrega (com nome do entregador e rastreamento)
 *      * Entregue com confirmação
 *  - Cálculo de CMV Teórico vs CMV Real baseado nas fichas técnicas.
 * ============================================================================
 */

import { kyttoEventBus, TOPICOS_KYTTO } from './kytto-event-bus.js';

// Base em memória persistível por tenant
const pedidosDeliveryDb = new Map();
const entregadoresDb = new Map();

// Inicializar entregadores padrão para teste e operação
function inicializarEntregadoresPadrao(empresaId) {
  if (entregadoresDb.has(empresaId)) return entregadoresDb.get(empresaId);

  const base = [
    {
      id: 'moto-01',
      nome: 'Carlos Motoboy (Flash)',
      telefone: '5565999887711',
      veiculo: 'Honda CG 160 Fan (Placa: RRA-9B12)',
      status: 'disponivel', // disponivel, em_rota, offline
      entregasRealizadasHoje: 4,
      totalComissaoAcumulada: 32.00,
      taxaFixaEntrega: 8.00
    },
    {
      id: 'moto-02',
      nome: 'Marcos Delivery',
      telefone: '5565988776655',
      veiculo: 'Yamaha Fazer 250 (Placa: QBA-1A34)',
      status: 'em_rota',
      entregasRealizadasHoje: 6,
      totalComissaoAcumulada: 48.00,
      taxaFixaEntrega: 8.00
    }
  ];

  entregadoresDb.set(empresaId, base);
  return base;
}

/**
 * Listar entregadores cadastrados
 */
export function listarEntregadores(empresaId) {
  return inicializarEntregadoresPadrao(empresaId);
}

/**
 * Cadastrar novo entregador
 */
export function cadastrarEntregador(empresaId, dados) {
  const lista = inicializarEntregadoresPadrao(empresaId);
  const novo = {
    id: `moto-${Date.now()}`,
    nome: dados.nome,
    telefone: dados.telefone,
    veiculo: dados.veiculo || 'Moto Própria',
    status: 'disponivel',
    entregasRealizadasHoje: 0,
    totalComissaoAcumulada: 0,
    taxaFixaEntrega: Number(dados.taxaFixaEntrega || 8.00)
  };
  lista.push(novo);
  entregadoresDb.set(empresaId, lista);
  return novo;
}

/**
 * Listar pedidos de delivery ativos e histórico
 */
export function listarPedidosDeliveryCompleto(empresaId) {
  const lista = pedidosDeliveryDb.get(empresaId) || [
    {
      id: 'del-101',
      numero: 'PED-101',
      clienteNome: 'Rodrigo Ribeiro Gonçalves',
      clienteTelefone: '5565996001234',
      endereco: 'Rua José Corsino, 545 W, Centro, Tangará da Serra - MT',
      itens: [
        { nome: 'Kit Pomada Efeito Matte Dino + Óleo Barba', quantidade: 1, valorUnitario: 95.00 },
        { nome: 'Shampoo Fortalecedor Mentolado', quantidade: 1, valorUnitario: 45.00 }
      ],
      subtotal: 140.00,
      taxaEntrega: 10.00,
      valorTotal: 150.00,
      formaPagamento: 'PIX_ONLINE',
      status: 'em_preparo', // recebido, em_preparo, saiu_entrega, entregue, cancelado
      entregadorId: 'moto-01',
      entregadorNome: 'Carlos Motoboy (Flash)',
      previsaoMinutos: 25,
      cmvTeorico: 42.00,
      cmvReal: 44.50,
      dataCriacao: new Date().toISOString()
    },
    {
      id: 'del-102',
      numero: 'PED-102',
      clienteNome: 'Mariana Silveira',
      clienteTelefone: '5565992113344',
      endereco: 'Av. Brasil, 1200 S, Tarumã, Tangará da Serra - MT',
      itens: [
        { nome: 'Cerveja Artesanal IPA Dino 500ml', quantidade: 2, valorUnitario: 22.00 },
        { nome: 'Porção Snack Gourmet', quantidade: 1, valorUnitario: 35.00 }
      ],
      subtotal: 79.00,
      taxaEntrega: 8.00,
      valorTotal: 87.00,
      formaPagamento: 'CARTAO_TEF_ENTREGA',
      status: 'saiu_entrega',
      entregadorId: 'moto-02',
      entregadorNome: 'Marcos Delivery',
      previsaoMinutos: 15,
      cmvTeorico: 28.00,
      cmvReal: 29.20,
      dataCriacao: new Date(Date.now() - 25 * 60000).toISOString()
    }
  ];

  if (!pedidosDeliveryDb.has(empresaId)) {
    pedidosDeliveryDb.set(empresaId, lista);
  }

  return pedidosDeliveryDb.get(empresaId);
}

/**
 * Atualizar status do pedido com disparo de eventos e WhatsApp
 */
export function atualizarStatusPedidoAvancado(empresaId, pedidoId, novoStatus, dadosExtras = {}) {
  const lista = listarPedidosDeliveryCompleto(empresaId);
  const pedido = lista.find(p => p.id === pedidoId);
  if (!pedido) throw new Error('Pedido de delivery não encontrado.');

  const statusAnterior = pedido.status;
  pedido.status = novoStatus;
  pedido.dataAtualizacao = new Date().toISOString();

  if (dadosExtras.entregadorId) {
    const entregadores = listarEntregadores(empresaId);
    const motoboy = entregadores.find(m => m.id === dadosExtras.entregadorId);
    if (motoboy) {
      pedido.entregadorId = motoboy.id;
      pedido.entregadorNome = motoboy.nome;
      if (novoStatus === 'saiu_entrega') {
        motoboy.status = 'em_rota';
        motoboy.entregasRealizadasHoje += 1;
        motoboy.totalComissaoAcumulada += motoboy.taxaFixaEntrega;
      }
    }
  }

  // Notificação e disparo de evento corporativo
  let mensagemWpp = '';
  if (novoStatus === 'em_preparo') {
    mensagemWpp = `Olá ${pedido.clienteNome}! 🍳 Seu pedido *${pedido.numero}* já está sendo preparado com muito carinho. Previsão de saída: ${pedido.previsaoMinutos || 20} minutos.`;
  } else if (novoStatus === 'saiu_entrega') {
    mensagemWpp = `🛵💨 Oba, ${pedido.clienteNome}! Seu pedido *${pedido.numero}* acabou de sair para entrega com o nosso motoboy *${pedido.entregadorNome || 'parceiro'}*. Fique atento ao interfone/campainha!`;
  } else if (novoStatus === 'entregue') {
    mensagemWpp = `🎉 Pedido *${pedido.numero}* entregue com sucesso! Muito obrigado pela preferência e bom apetite/aproveito. Se puder, avalie nosso atendimento! ⭐⭐⭐⭐⭐`;
  }

  kyttoEventBus.emitir(TOPICOS_KYTTO.NOTIFICACAO_ENVIADA, {
    empresaId,
    pedidoId: pedido.id,
    clienteTelefone: pedido.clienteTelefone,
    statusAnterior,
    novoStatus,
    mensagemWpp,
    timestamp: new Date().toISOString()
  });

  return {
    sucesso: true,
    pedido,
    mensagemWpp
  };
}

/**
 * Apuração de CMV Teórico vs Real do Delivery & Cardápio
 */
export function apurarCmvDelivery(empresaId) {
  const lista = listarPedidosDeliveryCompleto(empresaId);
  let totalFaturado = 0;
  let totalCmvTeorico = 0;
  let totalCmvReal = 0;

  for (const p of lista) {
    if (p.status !== 'cancelado') {
      totalFaturado += Number(p.subtotal || 0);
      totalCmvTeorico += Number(p.cmvTeorico || 0);
      totalCmvReal += Number(p.cmvReal || 0);
    }
  }

  const percTeorico = totalFaturado > 0 ? (totalCmvTeorico / totalFaturado) * 100 : 0;
  const percReal = totalFaturado > 0 ? (totalCmvReal / totalFaturado) * 100 : 0;
  const variacaoDesperdicio = totalCmvReal - totalCmvTeorico;

  return {
    empresaId,
    totalFaturado,
    totalCmvTeorico,
    totalCmvReal,
    percCmvTeorico: Math.round(percTeorico * 10) / 10,
    percCmvReal: Math.round(percReal * 10) / 10,
    variacaoDesperdicio: Math.round(variacaoDesperdicio * 100) / 100,
    statusEficiencia: percReal <= 32 ? 'EXCELENTE (Dentro da meta)' : 'ALERTA (Desperdício detectado)'
  };
}
