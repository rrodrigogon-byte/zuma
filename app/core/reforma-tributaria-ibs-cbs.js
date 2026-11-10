/**
 * ============================================================================
 * KYTTO ENTERPRISE ERP - MOTOR DA REFORMA TRIBUTÁRIA (EC 132/2023)
 * Módulo: app/core/reforma-tributaria-ibs-cbs.js
 * 
 * Implementação técnica dos tributos do novo Sistema Tributário Nacional:
 * 1. IBS (Imposto sobre Bens e Serviços) - Competência Estadual e Municipal
 * 2. CBS (Contribuição sobre Bens e Serviços) - Competência Federal
 * 3. IS (Imposto Seletivo) - Bens e serviços prejudiciais à saúde/meio ambiente
 * 4. Split Payment Tributário Inteligente (Recolhimento automático na liquidação)
 * 5. Simulador de Transição (2026 a 2033) e Análise de Carga Tributária Atual vs Dual
 * ============================================================================
 */

export const CONFIG_REFORMA_TRIBUTARIA = {
  anoVigenciaTeste: 2026,
  anoTransicaoPlena: 2033,
  aliquotasReferencia: {
    cbsFederalPadrao: 0.088,      // 8,8% CBS estimada
    ibsEstadualPadrao: 0.177,     // 17,7% IBS estimado (MT)
    aliquotaTeste2026: {
      cbsTeste: 0.009,            // 0,9% CBS de teste em 2026
      ibsTeste: 0.001             // 0,1% IBS de teste em 2026
    },
    aliquotasDiferenciadas: {
      saudeEducacaoReducao: 0.60, // 60% de redução (alíquota efetiva 40%)
      cestaBasicaNacional: 0.00,  // Alíquota zero
      servicosProfissionais: 0.30 // 30% de redução para profissões regulamentadas
    },
    impostoSeletivo: {
      bebidasAlcoolicas: 0.12,    // 12% IS
      cigarrosTabaco: 0.25,       // 25% IS
      refrigerantesAcucarados: 0.06 // 6% IS
    }
  }
};

/**
 * Calcula a tributação dual (IBS + CBS + IS) para um item ou operação
 */
export function calcularTributacaoReforma({
  valorOperacao = 0,
  tipoOperacao = 'servico', // 'servico', 'mercadoria', 'bebida_alcoolica', 'cesta_basica'
  anoCompetencia = 2026,
  ufDestino = 'MT',
  optanteSimplesNacional = false,
  aliquotaIbsManual = null,
  aliquotaCbsManual = null
}) {
  const vOp = Number(valorOperacao) || 0;
  if (vOp <= 0) {
    return {
      valorOperacao: 0,
      ibs: { base: 0, aliquota: 0, valor: 0 },
      cbs: { base: 0, aliquota: 0, valor: 0 },
      is: { base: 0, aliquota: 0, valor: 0 },
      totalTributosDual: 0,
      valorLiquidoRecebedor: 0
    };
  }

  let aliqCbs = aliquotaCbsManual !== null ? aliquotaCbsManual : CONFIG_REFORMA_TRIBUTARIA.aliquotasReferencia.aliquotaTeste2026.cbsTeste;
  let aliqIbs = aliquotaIbsManual !== null ? aliquotaIbsManual : CONFIG_REFORMA_TRIBUTARIA.aliquotasReferencia.aliquotaTeste2026.ibsTeste;
  let aliqIs = 0;

  // Ajuste por tipo de produto/serviço
  if (tipoOperacao === 'cesta_basica') {
    aliqCbs = 0;
    aliqIbs = 0;
  } else if (tipoOperacao === 'bebida_alcoolica') {
    aliqIs = CONFIG_REFORMA_TRIBUTARIA.aliquotasReferencia.impostoSeletivo.bebidasAlcoolicas;
  } else if (tipoOperacao === 'refrigerante') {
    aliqIs = CONFIG_REFORMA_TRIBUTARIA.aliquotasReferencia.impostoSeletivo.refrigerantesAcucarados;
  }

  // Se a simulação for no regime pleno definitivo (pós transição)
  if (anoCompetencia >= 2033) {
    aliqCbs = CONFIG_REFORMA_TRIBUTARIA.aliquotasReferencia.cbsFederalPadrao;
    aliqIbs = CONFIG_REFORMA_TRIBUTARIA.aliquotasReferencia.ibsEstadualPadrao;
  }

  // Base de cálculo é o valor da operação por fora (sem tributo na sua própria base)
  const baseCalculo = vOp;
  const valorCbs = Number((baseCalculo * aliqCbs).toFixed(2));
  const valorIbs = Number((baseCalculo * aliqIbs).toFixed(2));
  const valorIs = Number((baseCalculo * aliqIs).toFixed(2));
  const totalTributos = Number((valorCbs + valorIbs + valorIs).toFixed(2));

  return {
    anoCompetencia,
    ufDestino,
    tipoOperacao,
    baseCalculo,
    ibs: {
      base: baseCalculo,
      aliquotaPercentual: Number((aliqIbs * 100).toFixed(2)),
      valor: valorIbs,
      reparticao: {
        estadualMT: Number((valorIbs * 0.75).toFixed(2)),
        municipalTangara: Number((valorIbs * 0.25).toFixed(2))
      }
    },
    cbs: {
      base: baseCalculo,
      aliquotaPercentual: Number((aliqCbs * 100).toFixed(2)),
      valor: valorCbs
    },
    is: {
      incide: aliqIs > 0,
      base: baseCalculo,
      aliquotaPercentual: Number((aliqIs * 100).toFixed(2)),
      valor: valorIs
    },
    totalTributosDual: totalTributos,
    cargaEfetivaPercentual: Number(((totalTributos / vOp) * 100).toFixed(2)),
    splitPayment: {
      retencaoAutomaticaTributos: totalTributos,
      repasseLiquidoEmpresa: Number((vOp - totalTributos).toFixed(2)),
      protocoloSplit: `SPLIT-${anoCompetencia}-${Date.now().toString(36).toUpperCase()}`
    }
  };
}

/**
 * Compara a carga do regime tributário atual (PIS/COFINS/ICMS/ISS) com o Regime Dual da Reforma
 */
export function simularImpactoCargaTributaria({
  faturamentoMensal = 50000,
  regimeAtual = 'simples_nacional', // 'simples_nacional', 'lucro_presumido', 'lucro_real'
  segmento = 'barbearia_salao'
}) {
  const fat = Number(faturamentoMensal) || 0;

  // Carga estimada atual
  let aliqAtual = 0.06; // 6% Anexo III Simples Nacional
  if (regimeAtual === 'lucro_presumido') {
    aliqAtual = 0.1633; // PIS 0,65% + COFINS 3% + ISS 5% + IRPJ/CSLL ~7,68%
  } else if (regimeAtual === 'lucro_real') {
    aliqAtual = 0.24; // Regime não-cumulativo
  }

  const valorTributoAtual = Number((fat * aliqAtual).toFixed(2));

  // No Simples Nacional, a Lei Complementar prevê adesão opcional ou retenção segregada de IBS/CBS
  // Para 2026 (transição): 0,9% CBS + 0,1% IBS = 1,0%
  const cargaTransicao2026 = Number((fat * 0.010).toFixed(2));
  // Cenário definitivo 2033 (com aproveitamento pleno de créditos de insumos)
  const creditosEstimadosCompras = fat * 0.35 * 0.265; // 35% de compras com crédito
  const debitoBruto2033 = fat * 0.265;
  const tributoLiquido2033 = Math.max(0, Number((debitoBruto2033 - creditosEstimadosCompras).toFixed(2)));

  return {
    faturamentoMensal: fat,
    regimeAtual,
    segmento,
    cenarioAtual: {
      aliquotaNominal: Number((aliqAtual * 100).toFixed(2)),
      valorRecolhidoMensal: valorTributoAtual,
      tributosExtintos: ['PIS', 'COFINS', 'ICMS', 'ISS', 'IPI']
    },
    cenarioTransicao2026: {
      aliquotaEfetiva: 1.0,
      valorMensal: cargaTransicao2026,
      compensavelComPisCofins: true,
      impactoCaixa: 'Neutro (Totalmente compensável)'
    },
    cenarioDefinitivo2033: {
      aliquotaPadraoReferencia: 26.5,
      debitoBruto: Number(debitoBruto2033.toFixed(2)),
      creditosInsumosAproveitados: Number(creditosEstimadosCompras.toFixed(2)),
      tributoLiquidoAPagar: tributoLiquido2033,
      naoCumulatividadePlena: true
    },
    recomendacaoEstrategica: regimeAtual === 'simples_nacional'
      ? 'Manter adesão ao Simples Nacional e utilizar a Lei do Salão Parceiro (Lei 13.352/2016) para deduzir a cota-parte dos profissionais parceiros da base do IBS/CBS.'
      : 'Credenciamento antecipado no Domicílio Tributário Eletrônico (DTE) e automatização do Split Payment no TEF/Pix para fluxo de caixa desonerado.'
  };
}
