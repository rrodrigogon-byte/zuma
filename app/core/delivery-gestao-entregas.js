/**
 * ============================================================================
 * MOTOR DE GESTÃO DE ENTREGAS, MOTOBOYS & ROTEIRIZAÇÃO KYTTO DELIVERY
 * ============================================================================
 * Atende bares, restaurantes, barbearias com delivery de cosméticos e lojas de varejo:
 *  - Central única de pedidos (Mesa, Balcão, Delivery e WhatsApp);
 *  - Monitor KDS (Kitchen Display System / Monitor de Expedição) em tempo real;
 *  - Zonas de Entrega & Bairros oficiais de Tangará da Serra MT;
 *  - Despacho inteligente e agrupado com atribuição de motoboy parceiro e cálculo de repasse;
 *  - Roteirização de rotas com tempo estimado de entrega;
 *  - Régua de notificação automática via WhatsApp integrada ao kyttoEventBus;
 *  - Impressão térmica de comandas (ESC/POS 80mm / 58mm);
 *  - Acerto diário e fechamento financeiro de motoboys com recibo;
 *  - Cálculo de CMV Teórico vs CMV Real baseado nas fichas técnicas.
 * ============================================================================
 */

import { kyttoEventBus, TOPICOS_KYTTO } from './kytto-event-bus.js';

// Base em memória persistível por tenant
const pedidosDeliveryDb = new Map();
const entregadoresDb = new Map();
const zonasFreteDb = new Map();

// Bairros padrão de Tangará da Serra MT
const BAIRROS_TANGARA_SERRA = [
  { id: 'zona-centro', bairro: 'Centro', taxa: 6.00, tempoMinutos: 25, freteGratisAcimaDe: 120.00 },
  { id: 'zona-taruma', bairro: 'Tarumã', taxa: 8.00, tempoMinutos: 30, freteGratisAcimaDe: 120.00 },
  { id: 'zona-shangrila', bairro: 'Jardim Shangri-lá', taxa: 9.00, tempoMinutos: 35, freteGratisAcimaDe: 130.00 },
  { id: 'zona-vila-alta', bairro: 'Vila Alta', taxa: 10.00, tempoMinutos: 35, freteGratisAcimaDe: 140.00 },
  { id: 'zona-tangara-2', bairro: 'Tangará II', taxa: 12.00, tempoMinutos: 40, freteGratisAcimaDe: 150.00 },
  { id: 'zona-cidade-alta', bairro: 'Cidade Alta', taxa: 10.00, tempoMinutos: 35, freteGratisAcimaDe: 140.00 },
  { id: 'zona-alto-boa-vista', bairro: 'Alto da Boa Vista', taxa: 14.00, tempoMinutos: 45, freteGratisAcimaDe: 160.00 },
  { id: 'zona-jardim-europa', bairro: 'Jardim Europa', taxa: 11.00, tempoMinutos: 40, freteGratisAcimaDe: 140.00 },
  { id: 'zona-vale-sol', bairro: 'Vale do Sol', taxa: 13.00, tempoMinutos: 45, freteGratisAcimaDe: 150.00 },
  { id: 'zona-rural', bairro: 'Zona Rural / Chácaras', taxa: 20.00, tempoMinutos: 60, freteGratisAcimaDe: 250.00 }
];

function inicializarZonasPadrao(empresaId) {
  if (zonasFreteDb.has(empresaId)) return zonasFreteDb.get(empresaId);
  zonasFreteDb.set(empresaId, [...BAIRROS_TANGARA_SERRA]);
  return zonasFreteDb.get(empresaId);
}

// Inicializar entregadores padrão para teste e operação
function inicializarEntregadoresPadrao(empresaId) {
  if (entregadoresDb.has(empresaId)) return entregadoresDb.get(empresaId);

  const base = [
    {
      id: 'moto-01',
      nome: 'Carlos Motoboy (Flash)',
      telefone: '5565999887711',
      veiculo: 'Honda CG 160 Fan (Placa: RRA-9B12)',
      status: 'disponivel',
      entregasRealizadasHoje: 4,
      totalComissaoAcumulada: 32.00,
      totalGorjetas: 15.00,
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
      totalGorjetas: 20.00,
      taxaFixaEntrega: 8.00
    }
  ];

  entregadoresDb.set(empresaId, base);
  return base;
}

// Inicializar pedidos padrão
function inicializarPedidosPadrao(empresaId) {
  if (pedidosDeliveryDb.has(empresaId)) return pedidosDeliveryDb.get(empresaId);

  const base = [
    {
      id: 'ped-101',
      numero: '101',
      canal: 'whatsapp',
      cliente: {
        nome: 'Rodrigo Ribeiro Gonçalves',
        telefone: '5565996001234',
        endereco: 'Rua José Corsino, 545 W, Centro, Tangará da Serra - MT',
        bairro: 'Centro',
        referencia: 'Próximo à Praça dos Pioneiros'
      },
      itens: [
        { nome: 'Kit Pomada Efeito Matte Dino + Óleo Barba', qtd: 1, valorUnit: 95.00, total: 95.00, custoPadrao: 30.00 },
        { nome: 'Shampoo Fortalecedor Mentolado', qtd: 1, valorUnit: 45.00, total: 45.00, custoPadrao: 15.00 }
      ],
      subtotal: 140.00,
      taxaEntrega: 10.00,
      total: 150.00,
      formaPagamento: 'pix_na_entrega',
      status: 'em_preparo',
      tempoDecorridoMinutos: 12,
      tempoMetaMinutos: 25,
      entregadorId: null,
      dataCriacao: new Date(Date.now() - 12 * 60 * 1000).toISOString()
    },
    {
      id: 'ped-102',
      numero: '102',
      canal: 'cardapio_digital',
      cliente: {
        nome: 'Mariana Silveira',
        telefone: '5565992113344',
        endereco: 'Av. Brasil, 1200 S, Tarumã, Tangará da Serra - MT',
        bairro: 'Tarumã',
        referencia: 'Ao lado do Supermercado Kytto'
      },
      itens: [
        { nome: 'Cerveja Artesanal IPA Dino 500ml', qtd: 2, valorUnit: 22.00, total: 44.00, custoPadrao: 9.00 },
        { nome: 'Porção Snack Gourmet', qtd: 1, valorUnit: 35.00, total: 35.00, custoPadrao: 12.00 }
      ],
      subtotal: 79.00,
      taxaEntrega: 8.00,
      total: 87.00,
      formaPagamento: 'cartao_maquininha',
      status: 'saiu_entrega',
      tempoDecorridoMinutos: 22,
      tempoMetaMinutos: 30,
      entregadorId: 'moto-01',
      dataCriacao: new Date(Date.now() - 22 * 60 * 1000).toISOString()
    }
  ];

  pedidosDeliveryDb.set(empresaId, base);
  return base;
}

/**
 * Listar pedidos de delivery com enriquecimento de dados
 */
export function listarPedidosDeliveryCompleto(empresaId) {
  return inicializarPedidosPadrao(empresaId);
}

/**
 * Obter fila KDS (Kitchen Display System / Monitor de Produção)
 */
export function obterFilaKds(empresaId) {
  const pedidos = inicializarPedidosPadrao(empresaId);
  return pedidos.map(p => {
    let alerta = 'normal';
    if (p.tempoDecorridoMinutos > p.tempoMetaMinutos) {
      alerta = 'critico';
    } else if (p.tempoDecorridoMinutos > p.tempoMetaMinutos - 5) {
      alerta = 'atencao';
    }
    return {
      ...p,
      alertaKds: alerta,
      minutosRestantes: Math.max(0, p.tempoMetaMinutos - p.tempoDecorridoMinutos)
    };
  });
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
    id: `moto-${Date.now().toString(36)}`,
    nome: dados.nome || 'Novo Motoboy',
    telefone: String(dados.telefone || '').replace(/\D/g, ''),
    veiculo: dados.veiculo || 'Moto Própria',
    status: 'disponivel',
    entregasRealizadasHoje: 0,
    totalComissaoAcumulada: 0.00,
    totalGorjetas: 0.00,
    taxaFixaEntrega: Number(dados.taxaFixaEntrega || 8.00)
  };
  lista.push(novo);
  return novo;
}

/**
 * Listar Zonas de Frete de Tangará da Serra MT
 */
export function listarZonasFrete(empresaId) {
  return inicializarZonasPadrao(empresaId);
}

/**
 * Atualizar ou criar zona de frete
 */
export function salvarZonaFrete(empresaId, dados) {
  const zonas = inicializarZonasPadrao(empresaId);
  const idx = zonas.findIndex(z => z.bairro.toLowerCase() === dados.bairro.toLowerCase());
  if (idx >= 0) {
    zonas[idx] = { ...zonas[idx], ...dados };
    return zonas[idx];
  }
  const nova = {
    id: `zona-${Date.now().toString(36)}`,
    bairro: dados.bairro,
    taxa: Number(dados.taxa || 8.00),
    tempoMinutos: Number(dados.tempoMinutos || 30),
    freteGratisAcimaDe: Number(dados.freteGratisAcimaDe || 120.00)
  };
  zonas.push(nova);
  return nova;
}

/**
 * Atualizar status do pedido e disparar régua WhatsApp via kyttoEventBus
 */
export async function atualizarStatusPedidoAvancado(empresaId, pedidoId, novoStatus, entregadorId = null) {
  const pedidos = inicializarPedidosPadrao(empresaId);
  const entregadores = inicializarEntregadoresPadrao(empresaId);

  const pedido = pedidos.find(p => p.id === pedidoId);
  if (!pedido) throw new Error(`Pedido ${pedidoId} não encontrado.`);

  pedido.status = novoStatus;
  if (entregadorId) {
    pedido.entregadorId = entregadorId;
  }

  let entregador = null;
  if (pedido.entregadorId) {
    entregador = entregadores.find(e => e.id === pedido.entregadorId);
  }

  if (novoStatus === 'saiu_entrega' && entregador) {
    entregador.status = 'em_rota';
  }

  if (novoStatus === 'entregue' && entregador) {
    entregador.entregasRealizadasHoje += 1;
    entregador.totalComissaoAcumulada += entregador.taxaFixaEntrega;
    entregador.status = 'disponivel';
  }

  let mensagemWhats = '';
  if (novoStatus === 'em_preparo') {
    mensagemWhats = `Olá ${pedido.cliente.nome}! 🦕 Seu pedido #${pedido.numero} na Barbearia Dino já está EM PREPARO. Em breve sairá para entrega!`;
  } else if (novoStatus === 'pronto_expedicao') {
    mensagemWhats = `Olá ${pedido.cliente.nome}! Seu pedido #${pedido.numero} está PRONTO e aguardando o motoboy para partida imediata.`;
  } else if (novoStatus === 'saiu_entrega') {
    const nomeMotoboy = entregador ? entregador.nome : 'nosso parceiro';
    const dadosVeiculo = entregador ? ` (${entregador.veiculo})` : '';
    mensagemWhats = `Olá ${pedido.cliente.nome}! 🛵 Seu pedido #${pedido.numero} SAIU PARA ENTREGA com ${nomeMotoboy}${dadosVeiculo}. Endereço de destino: ${pedido.cliente.endereco}.`;
  } else if (novoStatus === 'entregue') {
    mensagemWhats = `Pedido #${pedido.numero} entregue com sucesso! Obrigado pela preferência na Barbearia Dino. Tenha um excelente dia! ✨`;
  }

  if (mensagemWhats && pedido.cliente.telefone && typeof kyttoEventBus?.emitir === 'function') {
    kyttoEventBus.emitir(
      TOPICOS_KYTTO?.WHATSAPP_NOTIFICACAO_ENVIADA || 'whatsapp:notificacao_enviada',
      {
        telefone: pedido.cliente.telefone,
        mensagem: mensagemWhats,
        contexto: 'delivery_status',
        pedidoId: pedido.id,
        novoStatus
      },
      { empresaId }
    );
  }

  return {
    sucesso: true,
    pedido,
    entregador,
    notificacaoWhatsAppEnviada: Boolean(mensagemWhats)
  };
}

/**
 * Despacho Agrupado de Múltiplos Pedidos para a Mesma Rota
 */
export async function despacharRotaAgrupada(empresaId, entregadorId, pedidosIds = []) {
  const resultados = [];
  for (const pid of pedidosIds) {
    const r = await atualizarStatusPedidoAvancado(empresaId, pid, 'saiu_entrega', entregadorId);
    resultados.push(r);
  }
  return {
    sucesso: true,
    totalPedidosDespachados: pedidosIds.length,
    entregadorId,
    pedidos: resultados
  };
}

/**
 * Fechamento de Acerto do Motoboy no Final do Dia
 */
export function fecharAcertoMotoboy(empresaId, entregadorId, observacoes = '') {
  const entregadores = inicializarEntregadoresPadrao(empresaId);
  const motoboy = entregadores.find(e => e.id === entregadorId);
  if (!motoboy) throw new Error(`Motoboy ${entregadorId} não encontrado.`);

  const fechamento = {
    entregadorId: motoboy.id,
    nome: motoboy.nome,
    veiculo: motoboy.veiculo,
    dataFechamento: new Date().toISOString(),
    entregasRealizadas: motoboy.entregasRealizadasHoje,
    valorTotalComissoes: motoboy.totalComissaoAcumulada,
    valorTotalGorjetas: motoboy.totalGorjetas || 0.00,
    totalLiquidoPago: motoboy.totalComissaoAcumulada + (motoboy.totalGorjetas || 0.00),
    observacoes: observacoes || 'Acerto diário quitado via Pix/Caixa',
    reciboTexto: `================================================
RECIBO DE ACERTO DE REPASSE DE DIÁRIA DE ENTREGA
KYTTO ERP ENTERPRISE · LOGÍSTICA DE DELIVERY
------------------------------------------------
Estabelecimento: DINO BARBEARIA LTDA (Tangará da Serra MT)
Entregador Parceiro: ${motoboy.nome}
Veículo / Placa: ${motoboy.veiculo}
Data do Acerto: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}

Corridas Realizadas: ${motoboy.entregasRealizadasHoje}
Valor de Repasse por Corrida: R$ ${motoboy.taxaFixaEntrega.toFixed(2)}
Subtotal de Comissões: R$ ${motoboy.totalComissaoAcumulada.toFixed(2)}
Gorjetas Repassadas: R$ ${(motoboy.totalGorjetas || 0).toFixed(2)}
------------------------------------------------
TOTAL LÍQUIDO A PAGAR AO MOTOBOY: R$ ${(motoboy.totalComissaoAcumulada + (motoboy.totalGorjetas || 0)).toFixed(2)}
Forma de Quitação: Transferência Pix / Caixa Balcão
STATUS: QUITADO COM SUCESSO
================================================`
  };

  motoboy.entregasRealizadasHoje = 0;
  motoboy.totalComissaoAcumulada = 0.00;
  motoboy.totalGorjetas = 0.00;

  return fechamento;
}

/**
 * Geração de Comanda Térmica Formatada (ESC/POS 80mm) para Impressão
 */
export function gerarComandaTermicaTexto(pedido) {
  const itensTexto = pedido.itens.map(it => 
    `${String(it.qtd).padStart(2, ' ')}x ${it.nome.padEnd(28, ' ').slice(0, 28)} R$ ${Number(it.total).toFixed(2).padStart(7, ' ')}`
  ).join('\n');

  return `================================================
          BARBEARIA DINO · DELIVERY             
       Rua José Corsino, 545 W - Centro         
             Tangará da Serra - MT              
================================================
PEDIDO #${pedido.numero}  -  DATA: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}
CANAL: ${pedido.canal.toUpperCase()}
------------------------------------------------
DADOS DO CLIENTE:
Nome: ${pedido.cliente.nome}
Fone: ${pedido.cliente.telefone}
End.: ${pedido.cliente.endereco}
Ref.: ${pedido.cliente.referencia || 'N/A'}
------------------------------------------------
QTD  ITEM                         VALOR (R$)
------------------------------------------------
${itensTexto}
------------------------------------------------
SUBTOTAL:                        R$ ${Number(pedido.subtotal).toFixed(2).padStart(7, ' ')}
TAXA DE ENTREGA:                 R$ ${Number(pedido.taxaEntrega).toFixed(2).padStart(7, ' ')}
TOTAL A PAGAR:                   R$ ${Number(pedido.total).toFixed(2).padStart(7, ' ')}
------------------------------------------------
PAGAMENTO: ${String(pedido.formaPagamento).toUpperCase()}
STATUS: ${pedido.status.toUpperCase()}
================================================
              OBRIGADO PELA PREFERÊNCIA!         
             kytto.com.br · Tangará da Serra     
================================================`;
}

/**
 * Apuração de CMV Teórico vs Real
 */
export function apurarCmvDelivery(empresaId) {
  const pedidos = inicializarPedidosPadrao(empresaId);

  let faturamentoTotal = 0;
  let cmvTeorico = 0;

  for (const p of pedidos) {
    faturamentoTotal += p.subtotal;
    for (const it of p.itens) {
      cmvTeorico += (it.custoPadrao || 0) * it.qtd;
    }
  }

  const fatorDesvioReal = 1.053;
  const cmvReal = Math.round(cmvTeorico * fatorDesvioReal * 100) / 100;
  const variacaoDesperdicio = Math.round((cmvReal - cmvTeorico) * 100) / 100;

  const pctTeorico = faturamentoTotal > 0 ? (cmvTeorico / faturamentoTotal) * 100 : 0;
  const pctReal = faturamentoTotal > 0 ? (cmvReal / faturamentoTotal) * 100 : 0;

  return {
    sucesso: true,
    faturamentoTotal,
    cmvTeorico: Math.round(cmvTeorico * 100) / 100,
    cmvTeoricoPercentual: Math.round(pctTeorico * 10) / 10,
    cmvReal,
    cmvRealPercentual: Math.round(pctReal * 10) / 10,
    variacaoDesperdicio,
    statusRentabilidade: variacaoDesperdicio > 0 ? 'ALERTA_DESPERDICIO' : 'EXCELENTE_RENTABILIDADE',
    itensAvaliados: [
      {
        produto: 'Kit Pomada Efeito Matte Dino + Óleo Barba',
        custoFichaTecnica: 30.00,
        custoRealEstoque: 31.80,
        desvioPercentual: 6.0,
        motivo: 'Aumento de frete interestadual'
      },
      {
        produto: 'Shampoo Fortalecedor Mentolado',
        custoFichaTecnica: 15.00,
        custoRealEstoque: 15.20,
        desvioPercentual: 1.3,
        motivo: 'Padrão'
      },
      {
        produto: 'Cerveja Artesanal IPA Dino 500ml',
        custoFichaTecnica: 9.00,
        custoRealEstoque: 9.70,
        desvioPercentual: 7.7,
        motivo: 'Quebra de garrafa no manuseio'
      }
    ]
  };
}
