/**
 * Motor Tributário de Substituição Tributária (ICMS-ST) e Regras Específicas de Mato Grosso (SEFAZ-MT)
 * Implementa cálculo oficial com MVA Original, MVA Ajustada, FCP-MT e conformidade com Convênio ICMS 142/2018.
 */

export const ALIQUOTAS_MT = Object.freeze({
  INTERNA_PADRAO: 17.0, // Alíquota interna básica MT
  INTERNA_MAJORADA: 20.0, // Alíquota majorada (bebidas/cosméticos supérfluos)
  FCP_MT_PADRAO: 2.0, // Adicional FCP (Fundo de Combate à Pobreza MT)
  INTERESTADUAL_SUL_SUDESTE: 7.0, // Alíquota de entrada originária do Sul/Sudeste
  INTERESTADUAL_NORTE_NE_CO: 12.0, // Alíquota de entrada originária do Norte/NE/CO
  IMPORTACAO_CAMEX: 4.0, // Alíquota interestadual com conteúdo de importação > 40% (Resolução SF 13/2012)
});

/**
 * Calcula a MVA Ajustada para operações interestaduais
 * Fórmula: MVA_Ajustada = [((1 + MVA_Original) * (1 - Alíquota_Interestadual)) / (1 - Alíquota_Interna)] - 1
 */
export function calcularMvaAjustada({ mvaOriginal, aliquotaInterestadual, aliquotaInterna }) {
  const mvaOrig = Number(mvaOriginal) / 100;
  const aliqInter = Number(aliquotaInterestadual) / 100;
  const aliqInt = Number(aliquotaInterna) / 100;

  if (aliqInter >= aliqInt) {
    // Não cabe ajuste se a interestadual for maior ou igual à interna
    return Number(mvaOriginal);
  }

  const fator = ((1 + mvaOrig) * (1 - aliqInter)) / (1 - aliqInt);
  const mvaAjustada = (fator - 1) * 100;
  return Number(mvaAjustada.toFixed(4));
}

/**
 * Realiza o cálculo completo da Substituição Tributária (ICMS-ST) para Mato Grosso
 */
export function calcularIcmsStMt(item = {}) {
  const valorOperacao = Number(item.valorOperacao || item.valor || 0);
  const frete = Number(item.frete || 0);
  const seguro = Number(item.seguro || 0);
  const outrasDespesas = Number(item.outrasDespesas || 0);
  const desconto = Number(item.desconto || 0);
  const ipi = Number(item.ipi || 0);

  // Base de Cálculo do ICMS Próprio
  const reducaoBasePropria = Number(item.reducaoBasePropria || 0);
  const basePropriaBruta = valorOperacao + frete + seguro + outrasDespesas - desconto;
  const baseIcmsProprio = Number((basePropriaBruta * (1 - reducaoBasePropria / 100)).toFixed(2));
  
  const aliquotaIcmsProprio = Number(item.aliquotaIcmsProprio ?? ALIQUOTAS_MT.INTERNA_PADRAO);
  const valorIcmsProprio = Number(((baseIcmsProprio * aliquotaIcmsProprio) / 100).toFixed(2));

  // MVA (Margem de Valor Agregado)
  const mvaOriginal = Number(item.mva || item.mvaOriginal || 40.0); // 40% média de cosméticos/perfumaria
  const operacaoInterestadual = Boolean(item.operacaoInterestadual);
  const aliquotaInterestadual = Number(item.aliquotaInterestadual || ALIQUOTAS_MT.INTERESTADUAL_SUL_SUDESTE);
  const aliquotaInternaSt = Number(item.aliquotaInternaSt ?? ALIQUOTAS_MT.INTERNA_PADRAO);
  const aliquotaFcp = Boolean(item.incideFcp) ? Number(item.aliquotaFcp ?? ALIQUOTAS_MT.FCP_MT_PADRAO) : 0.0;

  let mvaAplicada = mvaOriginal;
  if (operacaoInterestadual) {
    mvaAplicada = calcularMvaAjustada({
      mvaOriginal,
      aliquotaInterestadual,
      aliquotaInterna: aliquotaInternaSt + aliquotaFcp,
    });
  }

  // Base de Cálculo do ICMS-ST
  // Base ST = (Valor Operação + Frete + Seguro + Outras + IPI - Desconto) * (1 + MVA / 100)
  const baseCalculoStSemMva = valorOperacao + frete + seguro + outrasDespesas + ipi - desconto;
  const reducaoBaseSt = Number(item.reducaoBaseSt || 0);
  const baseStComMva = baseCalculoStSemMva * (1 + mvaAplicada / 100);
  const baseIcmsSt = Number((baseStComMva * (1 - reducaoBaseSt / 100)).toFixed(2));

  // Valor do Débito de ST = Base ST * (Alíquota Interna MT + FCP)
  const valorDebitoStTotal = Number(((baseIcmsSt * (aliquotaInternaSt + aliquotaFcp)) / 100).toFixed(2));
  
  // Valor do FCP ST
  const valorFcpSt = aliquotaFcp > 0 ? Number(((baseIcmsSt * aliquotaFcp) / 100).toFixed(2)) : 0.0;

  // ICMS-ST a Recolher = Débito ST - ICMS Próprio - FCP
  // No Simples Nacional com CSOSN 201/202, não há dedução de ICMS próprio destacado se emitente for Simples
  const permiteDeducaoProprio = item.crt !== '1' || item.deduzirIcmsProprioSimples === true;
  const deducao = permiteDeducaoProprio ? valorIcmsProprio : 0.0;
  const valorIcmsStLiquido = Number(Math.max(0, valorDebitoStTotal - deducao - valorFcpSt).toFixed(2));

  // Total do Item com ST
  const valorTotalItemComSt = Number((valorOperacao + frete + seguro + outrasDespesas + ipi + valorIcmsStLiquido + valorFcpSt - desconto).toFixed(2));

  // Determinação automática de CST / CSOSN e CFOP
  const regime = item.crt === '1' ? 'simples' : 'normal';
  let cstOuCsosn = '500';
  let cfop = '5405'; // Venda de mercadoria adquirida ou recebida de terceiros com ST em MT

  if (regime === 'simples') {
    if (item.origemOperacao === 'fabricacao_propria') {
      cstOuCsosn = '201'; // Com permissão de crédito
      cfop = operacaoInterestadual ? '6401' : '5401';
    } else {
      cstOuCsosn = valorIcmsStLiquido > 0 ? '202' : '500';
      cfop = operacaoInterestadual ? '6404' : '5405';
    }
  } else {
    cstOuCsosn = valorIcmsStLiquido > 0 ? '10' : '60'; // 10 = Tributada com cobrança de ST, 60 = Cobrado anteriormente
    cfop = operacaoInterestadual ? '6404' : '5405';
  }

  return {
    ncm: String(item.ncm || '33051000').replace(/\D/g, '').padEnd(8, '0'),
    cest: String(item.cest || '2001900').replace(/\D/g, '').padEnd(7, '0'),
    cfop,
    cstOuCsosn,
    regime,
    valoresBase: {
      valorOperacao,
      frete,
      seguro,
      outrasDespesas,
      desconto,
      ipi,
    },
    icmsProprio: {
      baseCalculo: baseIcmsProprio,
      aliquota: aliquotaIcmsProprio,
      valor: valorIcmsProprio,
    },
    icmsSt: {
      mvaOriginal,
      mvaAplicada,
      operacaoInterestadual,
      baseCalculoSt: baseIcmsSt,
      aliquotaInternaSt,
      aliquotaFcp,
      valorDebitoStTotal,
      deducaoProprio: deducao,
      valorFcpSt,
      valorIcmsStLiquido,
    },
    totalItemComSt: valorTotalItemComSt,
    observacaoFiscal: `ICMS-ST MT apurado conf. Conv. ICMS 142/2018 e RICMS-MT. Base ST: R$ ${baseIcmsSt.toFixed(2)} | MVA: ${mvaAplicada.toFixed(2)}% | ST Liq: R$ ${valorIcmsStLiquido.toFixed(2)}`,
  };
}
