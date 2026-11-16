/**
 * ============================================================================
 * KYTTO ERP · COTAÇÃO INTELIGENTE DE COMPRAS & CURVA ABC (KYTTOIA)
 * ============================================================================
 * Motor de cotação multiformecedor com tomada de preços, análise preditiva de
 * reposição por Curva ABC e integração ao Barramento Central de Eventos Internos.
 * ============================================================================
 */

import { kyttoEventBus } from '../eventos/kytto-eventbus.js';

export const COTACOES_EM_ANDAMENTO = [
  {
    id: 'COT-2026-0081',
    titulo: 'Reposição Preventiva de Autopeças & Filtros Pesados - Tangará da Serra',
    setor: 'Manutenção de Frotas & Usina de Concreto',
    solicitante: 'Carlos Mecânico Chefe',
    status: 'EM_ANALISE_KYTTOIA',
    dataAbertura: '2026-11-15T09:30:00Z',
    dataLimite: '2026-11-17T18:00:00Z',
    itens: [
      { item: 'Pastilha de Freio Cerâmica Amarok 2.0/3.0', codigoOem: '2H0698151A', quantidade: 12, unidade: 'JG' },
      { item: 'Filtro de Ar Motor Hilux 2.8 Diesel', codigoOem: '17801-0L040', quantidade: 20, unidade: 'UN' },
      { item: 'Amortecedor Turbogás Dianteiro Toro', codigoOem: '52063851', quantidade: 8, unidade: 'UN' },
      { item: 'Óleo Motor 100% Sintético 5W30 DPF (Castrol/Mobil)', codigoOem: 'CASTROL-5W30-D', quantidade: 60, unidade: 'L' }
    ],
    propostas: [
      {
        fornecedorId: 'FORN-01',
        nomeFornecedor: 'Pellegrino Distribuidora Centro-Oeste',
        cidade: 'Cuiabá / MT',
        valorTotal: 16980.00,
        prazoEntregaDias: 2,
        condicaoPagamento: '30 / 60 dias no boleto',
        frete: 'CIF (Incluso)',
        recomendadaKyttoIA: true,
        scoreEconomia: 'MELHOR PREÇO (-11.6%)'
      },
      {
        fornecedorId: 'FORN-02',
        nomeFornecedor: 'Distribuidora Real de Peças Tangará',
        cidade: 'Tangará da Serra / MT',
        valorTotal: 18450.00,
        prazoEntregaDias: 1,
        condicaoPagamento: '28 / 42 dias',
        frete: 'Entrega Imediata (Balcão)',
        recomendadaKyttoIA: false,
        scoreEconomia: 'ENTREGA MAIS RÁPIDA (24h)'
      },
      {
        fornecedorId: 'FORN-03',
        nomeFornecedor: 'Atacadão de Autopeças e Lubrificantes MT',
        cidade: 'Várzea Grande / MT',
        valorTotal: 19200.00,
        prazoEntregaDias: 3,
        condicaoPagamento: 'À vista com 3% desc.',
        frete: 'FOB (R$ 150 frete)',
        recomendadaKyttoIA: false,
        scoreEconomia: 'PROPOSTA PADRÃO'
      }
    ],
    analiseKyttoIA: {
      motor: 'KyttoIA 2.5 Flash',
      parecerExecutivo: 'A proposta da Pellegrino Distribuidora apresenta a maior vantajabilidade econômica, proporcionando economia direta de R$ 2.220,00 (-11,6%) em relação ao mercado local, com excelente fluxo de caixa (30/60 dias). O prazo de entrega de 48h atende confortavelmente ao estoque de segurança da frota.',
      economiaEstimadaRs: 2220.00,
      fornecedorVencedorSugerido: 'Pellegrino Distribuidora Centro-Oeste'
    }
  }
];

export const CURVA_ABC_ESTOQUE = {
  classeA: [
    { sku: 'AP-AM-003', item: 'Amortecedor Turbogás Dianteiro', valorInvestido: 45600.00, percentualAcumulado: '54.2%', giro: 'ALTO' },
    { sku: 'AP-OL-004', item: 'Óleo Motor 100% Sintético 5W30 DPF', valorInvestido: 23400.00, percentualAcumulado: '82.0%', giro: 'MUITO ALTO' }
  ],
  classeB: [
    { sku: 'AP-FR-001', item: 'Pastilha de Freio Dianteira Cerâmica', valorInvestido: 8900.00, percentualAcumulado: '92.5%', giro: 'MÉDIO' },
    { sku: 'AP-FA-002', item: 'Filtro de Ar Motor Alto Fluxo', valorInvestido: 3450.00, percentualAcumulado: '96.6%', giro: 'MÉDIO' }
  ],
  classeC: [
    { sku: 'AP-RET-091', item: 'Retentor do Volante Motor', valorInvestido: 1200.00, percentualAcumulado: '98.5%', giro: 'BAIXO' },
    { sku: 'AP-PAR-102', item: 'Parafuso de Roda Cônico M14', valorInvestido: 650.00, percentualAcumulado: '100.0%', giro: 'BAIXO' }
  ]
};

export function listarCotacoes() {
  return COTACOES_EM_ANDAMENTO;
}

export function obterCurvaAbc() {
  return CURVA_ABC_ESTOQUE;
}

export function aprovarCotacao({ cotacaoId, fornecedorVencedorId, usuarioAprovador = 'Rodrigo Gonçalves' }) {
  const cot = COTACOES_EM_ANDAMENTO.find(c => c.id === cotacaoId);
  if (!cot) {
    return { ok: false, error: 'Cotação não localizada.' };
  }

  const prop = cot.propostas.find(p => p.fornecedorId === fornecedorVencedorId) || cot.propostas[0];
  cot.status = 'APROVADA_ORDEM_COMPRA_EMITIDA';
  cot.ordemCompra = {
    numero: `OC-2026-${Math.floor(Math.random() * 9000) + 1000}`,
    fornecedor: prop.nomeFornecedor,
    valorTotal: prop.valorTotal,
    condicaoPagamento: prop.condicaoPagamento,
    aprovadoPor: usuarioAprovador,
    aprovadoEm: new Date().toISOString()
  };

  // Disparar sincronização por evento interno no KyttoEventBus
  const evt = kyttoEventBus.dispararEventoInterno({
    tipo: 'COTACAO_COMPRA_APROVADA',
    origem: 'compras',
    destino: 'financeiro',
    payload: {
      cotacaoId: cot.id,
      ordemCompra: cot.ordemCompra,
      itens: cot.itens
    }
  });

  return {
    ok: true,
    mensagem: `Cotação ${cot.id} aprovada com sucesso! Ordem de Compra ${cot.ordemCompra.numero} emitida.`,
    ordemCompra: cot.ordemCompra,
    eventoInterno: evt
  };
}
