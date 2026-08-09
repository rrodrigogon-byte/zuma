/**
 * Domínio tributário do motor fiscal Kytto.
 *
 * O módulo é puro e não conversa com PDV, banco, XML ou SEFAZ. Ele recebe a
 * classificação fiscal configurada pelo contador e devolve tributos calculados,
 * totalizações e pendências. Isso permite versionar regras por empresa/UF sem
 * contaminar a operação comercial.
 */

const REGIMES = new Set(['simples', 'lucro_presumido', 'lucro_real']);
const CST_ICMS_NORMAL = new Set(['00', '10', '20', '30', '40', '41', '50', '51', '60', '70', '90']);
const CSOSN_VALIDOS = new Set(['101', '102', '103', '201', '202', '203', '300', '400', '500', '900']);
const CST_PIS_COFINS = new Set(['01', '02', '03', '04', '05', '06', '07', '08', '09', '49', '50', '51', '52', '53', '54', '55', '56', '60', '61', '62', '63', '64', '65', '66', '67', '70', '71', '72', '73', '74', '75', '98', '99']);

function texto(value, tamanho = 120) {
  return String(value ?? '').trim().slice(0, tamanho);
}

function digitos(value, tamanho = null) {
  const normalizado = String(value ?? '').replace(/\D/g, '');
  return tamanho ? normalizado.slice(0, tamanho) : normalizado;
}

function numero(value, fallback = 0) {
  const convertido = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(convertido) ? convertido : fallback;
}

function percentual(value, fallback = 0) {
  return Math.min(100, Math.max(0, numero(value, fallback)));
}

export function arredondarFiscal(value, casas = 2) {
  const fator = 10 ** casas;
  return Math.round((Number(value) + Number.EPSILON) * fator) / fator;
}

export function normalizarClassificacaoFiscalProduto(raw = {}) {
  const origem = texto(raw.origem ?? raw.origemMercadoria ?? '0', 1);
  const ncm = digitos(raw.ncm, 8);
  const cest = digitos(raw.cest, 7);
  const cfop = digitos(raw.cfop || '5102', 4);
  const csosn = texto(raw.csosn || '102', 3);
  const cstIcms = texto(raw.cstIcms ?? raw.cst_icms ?? '00', 2);
  const cstPis = texto(raw.cstPis ?? raw.cst_pis ?? '49', 2);
  const cstCofins = texto(raw.cstCofins ?? raw.cst_cofins ?? '49', 2);
  return {
    ncm,
    cest,
    cfop,
    origem: /^[0-8]$/.test(origem) ? origem : '0',
    unidadeTributavel: texto(raw.unidadeTributavel ?? raw.unidade_tributavel ?? raw.unidade ?? 'UN', 6).toUpperCase() || 'UN',
    csosn: CSOSN_VALIDOS.has(csosn) ? csosn : '102',
    cstIcms: CST_ICMS_NORMAL.has(cstIcms) ? cstIcms : '00',
    cstPis: CST_PIS_COFINS.has(cstPis) ? cstPis : '49',
    cstCofins: CST_PIS_COFINS.has(cstCofins) ? cstCofins : '49',
    aliquotaIcms: percentual(raw.aliquotaIcms ?? raw.pIcms),
    aliquotaIcmsSt: percentual(raw.aliquotaIcmsSt ?? raw.pIcmsSt),
    margemValorAgregadoSt: percentual(raw.margemValorAgregadoSt ?? raw.pMvaSt),
    aliquotaFcp: percentual(raw.aliquotaFcp ?? raw.pFcp),
    aliquotaPis: percentual(raw.aliquotaPis ?? raw.pPis),
    aliquotaCofins: percentual(raw.aliquotaCofins ?? raw.pCofins),
    aliquotaIbptNacional: percentual(raw.aliquotaIbptNacional ?? raw.pIbptNacional),
    aliquotaIbptImportado: percentual(raw.aliquotaIbptImportado ?? raw.pIbptImportado),
    enquadramentoLegal: texto(raw.enquadramentoLegal, 300),
  };
}

export function validarClassificacaoFiscalProduto(raw = {}, { exigirNcm = false } = {}) {
  const fiscal = normalizarClassificacaoFiscalProduto(raw);
  const pendencias = [];
  if (exigirNcm && fiscal.ncm.length !== 8) pendencias.push('Informe NCM com 8 dígitos para o produto.');
  if (!/^\d{4}$/.test(fiscal.cfop)) pendencias.push('Informe CFOP com 4 dígitos.');
  if (!fiscal.unidadeTributavel) pendencias.push('Informe a unidade tributável.');
  return { valido: pendencias.length === 0, pendencias, fiscal };
}

function regraAplicada(fiscal, contexto) {
  const regras = contexto.regras && typeof contexto.regras === 'object' ? contexto.regras : {};
  const porOperacao = regras[contexto.operacao || 'venda_presencial'] || regras.padrao || {};
  return normalizarClassificacaoFiscalProduto({ ...porOperacao, ...fiscal });
}

function calcularIcms(base, fiscal, regime) {
  const st = ['10', '30', '60', '70', '90'].includes(fiscal.cstIcms) || ['201', '202', '203', '500', '900'].includes(fiscal.csosn);
  const isento = ['40', '41', '50'].includes(fiscal.cstIcms) || ['103', '300', '400'].includes(fiscal.csosn);
  const tributadoNormal = regime !== 'simples' && ['00', '10', '20', '51', '70', '90'].includes(fiscal.cstIcms);
  const baseIcms = isento ? 0 : base;
  const valorIcms = tributadoNormal ? arredondarFiscal(baseIcms * fiscal.aliquotaIcms / 100) : 0;
  const baseSt = st && fiscal.aliquotaIcmsSt > 0 ? arredondarFiscal(base * (1 + fiscal.margemValorAgregadoSt / 100)) : 0;
  const valorSt = baseSt > 0 ? arredondarFiscal(Math.max(0, baseSt * fiscal.aliquotaIcmsSt / 100 - valorIcms)) : 0;
  const valorFcp = fiscal.aliquotaFcp > 0 ? arredondarFiscal(baseIcms * fiscal.aliquotaFcp / 100) : 0;
  return {
    origem: fiscal.origem,
    cst: regime === 'simples' ? null : fiscal.cstIcms,
    csosn: regime === 'simples' ? fiscal.csosn : null,
    baseCalculo: baseIcms,
    aliquota: tributadoNormal ? fiscal.aliquotaIcms : 0,
    valor: valorIcms,
    baseSt,
    aliquotaSt: baseSt > 0 ? fiscal.aliquotaIcmsSt : 0,
    valorSt,
    aliquotaFcp: fiscal.aliquotaFcp,
    valorFcp,
  };
}

function calcularPisCofins(base, fiscal, regime) {
  const permiteCalculo = !['04', '05', '06', '07', '08', '09'].includes(fiscal.cstPis);
  const aliquotaPis = permiteCalculo && regime !== 'simples' ? fiscal.aliquotaPis : 0;
  const aliquotaCofins = permiteCalculo && regime !== 'simples' ? fiscal.aliquotaCofins : 0;
  return {
    pis: { cst: fiscal.cstPis, baseCalculo: base, aliquota: aliquotaPis, valor: arredondarFiscal(base * aliquotaPis / 100) },
    cofins: { cst: fiscal.cstCofins, baseCalculo: base, aliquota: aliquotaCofins, valor: arredondarFiscal(base * aliquotaCofins / 100) },
  };
}

export function calcularTributosItem(item = {}, contexto = {}) {
  const regime = REGIMES.has(contexto.regimeTributario) ? contexto.regimeTributario : 'simples';
  const fiscal = regraAplicada(item.fiscal || item.classificacaoFiscal || {}, contexto);
  const quantidade = Math.max(0, numero(item.quantidade ?? item.qtd, 1));
  const valorUnitario = Math.max(0, numero(item.valorUnitario ?? item.valor_unitario ?? item.preco ?? item.valor, 0));
  const desconto = Math.max(0, numero(item.desconto, 0));
  const valorProduto = arredondarFiscal(quantidade * valorUnitario);
  const baseCalculo = arredondarFiscal(Math.max(0, valorProduto - desconto));
  const icms = calcularIcms(baseCalculo, fiscal, regime);
  const pisCofins = calcularPisCofins(baseCalculo, fiscal, regime);
  const percentualIbpt = fiscal.origem === '1' || fiscal.origem === '2' || fiscal.origem === '3'
    ? fiscal.aliquotaIbptImportado : fiscal.aliquotaIbptNacional;
  const valorIbpt = arredondarFiscal(baseCalculo * percentualIbpt / 100);
  const pendencias = validarClassificacaoFiscalProduto(fiscal, { exigirNcm: Boolean(contexto.exigirNcm) }).pendencias;
  if (regime !== 'simples' && icms.aliquota <= 0 && !['40', '41', '50'].includes(fiscal.cstIcms)) {
    pendencias.push('Alíquota de ICMS não configurada para item tributável do regime normal.');
  }
  return {
    produtoId: item.produtoId || item.id || null,
    descricao: texto(item.descricao || item.nome, 120),
    quantidade, valorUnitario, valorProduto, desconto, baseCalculo, fiscal,
    icms, ...pisCofins,
    ibpt: { percentual: percentualIbpt, valor: valorIbpt },
    totalTributos: arredondarFiscal(icms.valor + icms.valorSt + icms.valorFcp + pisCofins.pis.valor + pisCofins.cofins.valor),
    pendencias,
  };
}

export function totalizarDocumentoFiscal(itens = [], contexto = {}) {
  const itensCalculados = itens.map((item) => calcularTributosItem(item, contexto));
  const somar = (getter) => arredondarFiscal(itensCalculados.reduce((acumulado, item) => acumulado + Number(getter(item) || 0), 0));
  return {
    itens: itensCalculados,
    totais: {
      valorProdutos: somar((item) => item.valorProduto),
      desconto: somar((item) => item.desconto),
      baseIcms: somar((item) => item.icms.baseCalculo),
      valorIcms: somar((item) => item.icms.valor),
      baseSt: somar((item) => item.icms.baseSt),
      valorSt: somar((item) => item.icms.valorSt),
      valorFcp: somar((item) => item.icms.valorFcp),
      basePis: somar((item) => item.pis.baseCalculo),
      valorPis: somar((item) => item.pis.valor),
      baseCofins: somar((item) => item.cofins.baseCalculo),
      valorCofins: somar((item) => item.cofins.valor),
      valorTributosAproximados: somar((item) => item.ibpt.valor),
      valorTotal: somar((item) => item.baseCalculo),
    },
    pendencias: itensCalculados.flatMap((item, indice) => item.pendencias.map((pendencia) => ({ item: indice + 1, pendencia }))),
  };
}

export default {
  arredondarFiscal,
  normalizarClassificacaoFiscalProduto,
  validarClassificacaoFiscalProduto,
  calcularTributosItem,
  totalizarDocumentoFiscal,
};
