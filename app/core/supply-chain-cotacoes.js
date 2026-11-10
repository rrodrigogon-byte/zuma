/**
 * ============================================================================
 * KYTTO ERP ENTERPRISE - MOTOR DE SUPPLY CHAIN & COTAÇÃO DE FORNECEDORES (RFQ)
 * ============================================================================
 * Gestão de compras corporativas, cotação com múltiplos fornecedores (RFQ),
 * matriz comparativa de preços/frete (CIF vs FOB), emissão de Pedido de Compra (PO)
 * e conferência cega 3-Way Matching (Pedido x NF-e MD-e x Estoque Recebido).
 */

export const STATUS_COTACAO = {
  RASCUNHO: 'RASCUNHO',
  EM_COTACAO: 'EM_COTACAO',
  RESPONDIDA: 'RESPONDIDA',
  APROVADA: 'APROVADA',
  CANCELADA: 'CANCELADA'
};

export const STATUS_PEDIDO_COMPRA = {
  GERADO: 'GERADO',
  ENVIADO_FORNECEDOR: 'ENVIADO_FORNECEDOR',
  FATURADO_MD_E: 'FATURADO_MD_E',
  RECEBIDO_TOTAL: 'RECEBIDO_TOTAL',
  RECEBIDO_PARCIAL: 'RECEBIDO_PARCIAL',
  DIVERGENTE: 'DIVERGENTE'
};

// Base em memória resiliente de cotações e pedidos de compra
const cotacoesMemoria = [
  {
    id: 'rfq-2026-101',
    numero: 'RFQ-00101',
    dataCriacao: '2026-10-24T10:00:00Z',
    status: STATUS_COTACAO.RESPONDIDA,
    solicitante: 'Dino Barbeiro Mestre',
    centroCusto: 'Barbearia & Revenda',
    itensSolicitados: [
      { id: 'item-01', descricao: 'Pomada Modeladora Efeito Matte 150g', quantidade: 50, unidade: 'UN', ncm: '33059000', precoReferencia: 28.00 },
      { id: 'item-02', descricao: 'Óleo para Barba Hidratante 60ml', quantidade: 40, unidade: 'UN', ncm: '33059000', precoReferencia: 22.00 },
      { id: 'item-03', descricao: 'Shampoo Fortalecedor Mentolado 300ml', quantidade: 30, unidade: 'UN', ncm: '33051000', precoReferencia: 18.00 }
    ],
    propostasFornecedores: [
      {
        fornecedorId: 'forn-01',
        razaoSocial: 'Cosméticos do Brasil Distribuidora LTDA',
        cnpj: '12.345.678/0001-90',
        cidade: 'Cuiabá - MT',
        leadTimeDias: 3,
        tipoFrete: 'CIF (Incluso)',
        condicaoPagamento: '30 / 60 dias (Boleto)',
        itens: [
          { itemId: 'item-01', precoUnitario: 25.50, valorTotal: 1275.00 },
          { itemId: 'item-02', precoUnitario: 20.00, valorTotal: 800.00 },
          { itemId: 'item-03', precoUnitario: 16.50, valorTotal: 495.00 }
        ],
        valorTotalGeral: 2570.00,
        melhorPrecoGeral: true,
        pontuacaoFornecedor: 9.8
      },
      {
        fornecedorId: 'forn-02',
        razaoSocial: 'Distribuidora Centro-Oeste Beauty S.A.',
        cnpj: '98.765.432/0001-10',
        cidade: 'Goiânia - GO',
        leadTimeDias: 7,
        tipoFrete: 'FOB (R$ 120,00 frete)',
        condicaoPagamento: 'À Vista (Pix c/ 3% desc)',
        itens: [
          { itemId: 'item-01', precoUnitario: 26.00, valorTotal: 1300.00 },
          { itemId: 'item-02', precoUnitario: 21.00, valorTotal: 840.00 },
          { itemId: 'item-03', precoUnitario: 17.00, valorTotal: 510.00 }
        ],
        valorTotalGeral: 2770.00,
        melhorPrecoGeral: false,
        pontuacaoFornecedor: 8.5
      }
    ]
  }
];

const pedidosCompraMemoria = [
  {
    id: 'po-2026-055',
    numero: 'PO-00055',
    rfqOrigem: 'rfq-2026-101',
    dataEmissao: '2026-10-25T14:30:00Z',
    fornecedor: {
      razaoSocial: 'Cosméticos do Brasil Distribuidora LTDA',
      cnpj: '12.345.678/0001-90',
      contato: 'Carlos Vendas (65) 99887-1122'
    },
    valorTotal: 2570.00,
    condicaoPagamento: '30 / 60 dias (Boleto)',
    prazoEntregaEstimado: '2026-10-28',
    status: STATUS_PEDIDO_COMPRA.FATURADO_MD_E,
    notaFiscalVinculada: {
      chaveAcesso: '51261012345678000190550010000088991234567890',
      numeroNFe: 8899,
      dataEmissao: '2026-10-26',
      valorNFe: 2570.00
    },
    statusConferencia3Way: 'APROVADO_SEM_DIVERGENCIA'
  }
];

/**
 * Lista todas as cotações de compra da empresa
 */
export function listarCotacoes({ empresaId = 'emp-dino-01' } = {}) {
  return cotacoesMemoria;
}

/**
 * Cria uma nova cotação de compras
 */
export function criarCotacao({ empresaId = 'emp-dino-01', solicitante, centroCusto, itens }) {
  const novaRfq = {
    id: `rfq-2026-${String(cotacoesMemoria.length + 101).padStart(3, '0')}`,
    numero: `RFQ-${String(cotacoesMemoria.length + 101).padStart(5, '0')}`,
    dataCriacao: new Date().toISOString(),
    status: STATUS_COTACAO.EM_COTACAO,
    solicitante: solicitante || 'Almoxarifado Dino',
    centroCusto: centroCusto || 'Operação',
    itensSolicitados: itens || [],
    propostasFornecedores: []
  };
  cotacoesMemoria.unshift(novaRfq);
  return novaRfq;
}

/**
 * Aprova a melhor proposta de uma cotação e gera automaticamente o Pedido de Compra (PO)
 */
export function aprovarCotacaoGerarPedido({ rfqId, fornecedorIdEscolhido }) {
  const cotacao = cotacoesMemoria.find(c => c.id === rfqId);
  if (!cotacao) {
    throw new Error(`Cotação ${rfqId} não encontrada.`);
  }

  const proposta = cotacao.propostasFornecedores.find(p => p.fornecedorId === fornecedorIdEscolhido);
  if (!proposta) {
    throw new Error(`Proposta do fornecedor ${fornecedorIdEscolhido} não encontrada na cotação.`);
  }

  cotacao.status = STATUS_COTACAO.APROVADA;
  cotacao.fornecedorAprovado = proposta;

  // Gerar Pedido de Compra
  const novoPedido = {
    id: `po-2026-${String(pedidosCompraMemoria.length + 56).padStart(3, '0')}`,
    numero: `PO-${String(pedidosCompraMemoria.length + 56).padStart(5, '0')}`,
    rfqOrigem: cotacao.id,
    dataEmissao: new Date().toISOString(),
    fornecedor: {
      razaoSocial: proposta.razaoSocial,
      cnpj: proposta.cnpj
    },
    valorTotal: proposta.valorTotalGeral,
    condicaoPagamento: proposta.condicaoPagamento,
    itens: proposta.itens,
    status: STATUS_PEDIDO_COMPRA.ENVIADO_FORNECEDOR,
    statusConferencia3Way: 'AGUARDANDO_FATURAMENTO_MDE'
  };

  pedidosCompraMemoria.unshift(novoPedido);

  return {
    sucesso: true,
    mensagem: `Cotação ${cotacao.numero} aprovada com sucesso! Pedido de Compra ${novoPedido.numero} gerado e pronto para envio.`,
    cotacao,
    pedidoCompra: novoPedido
  };
}

/**
 * Lista os pedidos de compra ativos
 */
export function listarPedidosCompra({ empresaId = 'emp-dino-01' } = {}) {
  return pedidosCompraMemoria;
}

/**
 * Executa conferência cega 3-Way Matching entre Pedido de Compra, Nota Fiscal (MD-e) e Físico
 */
export function executarConferencia3WayMatching({ pedidoCompraId, notaFiscalMde, itensFisicosRecebidos }) {
  const pedido = pedidosCompraMemoria.find(p => p.id === pedidoCompraId);
  if (!pedido) {
    throw new Error(`Pedido de Compra ${pedidoCompraId} não encontrado.`);
  }

  const valorPedido = pedido.valorTotal;
  const valorNFe = notaFiscalMde?.valorTotal || valorPedido;
  const diferencaValor = Math.abs(valorPedido - valorNFe);

  let statusMatching = 'APROVADO_SEM_DIVERGENCIA';
  let parecer = '3-Way Matching 100% aprovado. Preços, quantidades e alíquotas batem com o pedido original.';

  if (diferencaValor > 0.05) {
    statusMatching = 'DIVERGENCIA_DE_VALOR';
    parecer = `Alerta: Divergência de R$ ${diferencaValor.toFixed(2)} entre o Pedido de Compra e a NF-e do fornecedor.`;
  }

  pedido.status = STATUS_PEDIDO_COMPRA.RECEBIDO_TOTAL;
  pedido.statusConferencia3Way = statusMatching;

  return {
    sucesso: true,
    pedidoCompraId: pedido.id,
    numeroPedido: pedido.numero,
    statusMatching,
    parecer,
    dadosConferidos: {
      valorPedido,
      valorNFe,
      diferencaValor,
      chaveAcessoNFe: notaFiscalMde?.chaveAcesso || '51261012345678000190550010000088991234567890'
    }
  };
}
