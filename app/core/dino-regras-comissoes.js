/**
 * Módulo de Regras de Comissionamento da Dino Barbearia & Ecossistema Kytto
 * 
 * Regra Operacional Oficial:
 * - Serviços (corte, barba, selagem, etc.): comissão do profissional (ex: 40% a 50%, com metas).
 * - Produtos de Revenda (pomadas, óleos, balms, shampoos, etc.): comissão do profissional (ex: 10% base).
 * - Bebidas & Bar (água mineral, cervejas, refrigerantes, energéticos, doses, café): 0% de comissão.
 *   "Bebidas eles não têm comissão" — Diretoria Dino Barbearia.
 */

const CATEGORIAS_BEBIDAS = new Set([
  'bebida',
  'bebidas',
  'bebidas & bar',
  'bebidas e bar',
  'bebidas e snacks',
  'bebidas/snacks',
  'bar',
  'frigobar',
  'bebida & bar',
  'bebida e bar',
]);

const TERMOS_BEBIDAS = [
  'água', 'agua', 'cerveja', 'heineken', 'budweiser', 'corona', 'stella',
  'refrigerante', 'coca-cola', 'coca cola', 'guaraná', 'guarana', 'red bull',
  'energético', 'energetico', 'café', 'cafe', 'expresso', 'whisky', 'whiskey',
  'dose', 'suco', 'chopp', 'gelo', 'long neck', 'lata 350ml', '500ml', 'gourmet'
];

/**
 * Verifica se um produto pertence à categoria de Bebidas/Bar (comissão ZERO)
 */
export function isProdutoBebida(item = {}) {
  if (!item) return false;

  // Flag explícita no cadastro do produto
  if (item.geraComissao === false || item.gera_comissao === false) return true;
  if (item.comissaoPercentual === 0 || item.comissao_percentual === 0) return true;

  const categoria = String(item.categoria || item.categoriaNome || '').toLowerCase().trim();
  const nome = String(item.nome || item.descricao || '').toLowerCase().trim();

  if (CATEGORIAS_BEBIDAS.has(categoria) || [...CATEGORIAS_BEBIDAS].some(c => categoria.includes(c))) {
    return true;
  }

  // Se o nome contiver termos característicos de bebida e não for produto capilar/barba
  const ehCosmetico = ['pomada', 'óleo', 'oleo', 'balm', 'shampoo', 'condicionador', 'cera', 'loção', 'locao', 'tônico', 'tonico'].some(t => nome.includes(t));
  if (!ehCosmetico && TERMOS_BEBIDAS.some(termo => nome.includes(termo))) {
    return true;
  }

  return false;
}

/**
 * Calcula a comissão de um item de produto considerando se é bebida ou cosmético
 */
export function calcularComissaoItemProduto(item, prof = {}) {
  const isBebida = isProdutoBebida(item);
  const subtotal = (item && item.subtotal !== undefined && item.subtotal !== null && item.subtotal !== '')
    ? Number(item.subtotal)
    : (Number(item?.precoUnitario ?? item?.preco ?? 0) * Number(item?.quantidade ?? 1));

  if (isBebida) {
    return {
      isBebida: true,
      subtotal,
      percentualAplicado: 0,
      valorComissao: 0,
    };
  }

  const comissaoPercent = Number(item?.comissaoPercentual ?? prof?.percentualComissaoProduto ?? prof?.comissaoProdutos ?? 10);
  const valorComissao = Number((subtotal * (comissaoPercent / 100)).toFixed(2));

  return {
    isBebida: false,
    subtotal,
    percentualAplicado: comissaoPercent,
    valorComissao,
  };
}

/**
 * Obtém o percentual de comissão de serviços configurado para o profissional
 * respeitando `percentualComissao`, `comissaoPercentual`, `comissaoServicos` e exceções por serviço (`comissoesPorServico`).
 */
export function obterPercentualComissaoServico(prof = null, item = null, profId = '') {
  if (!prof || profId === '__sem_profissional__') return 0;
  const servicoId = item?.servicoId ? String(item.servicoId) : '';
  if (servicoId && prof.comissoesPorServico && Object.prototype.hasOwnProperty.call(prof.comissoesPorServico, servicoId)) {
    const exc = Number(prof.comissoesPorServico[servicoId]);
    if (Number.isFinite(exc) && (exc > 0 || Number(item?.subtotal ?? item?.precoUnitario ?? 0) === 0)) {
      return exc;
    }
  }
  const nomeNorm = String(prof.nome || prof.apelido || '').toLowerCase().trim();
  const raw = prof.percentualComissao ?? prof.comissaoPercentual ?? prof.comissaoServicos;
  if (raw !== undefined && raw !== null && raw !== '') {
    const val = Number(raw);
    if (Number.isFinite(val)) {
      if ((nomeNorm === 'nati' || nomeNorm.includes('natani')) && val === 50 && !prof.comissaoCustomizadaManual) {
        return 40;
      }
      return val;
    }
  }
  if (nomeNorm === 'nati' || nomeNorm.includes('natani')) return 40;
  if (nomeNorm === 'ester' || nomeNorm === 'ster' || nomeNorm.includes('jhenyffer')) return 0;
  return 50;
}

/**
 * Obtém o percentual de comissão de produtos de revenda configurado para o profissional
 */
export function obterPercentualComissaoProduto(prof = null, item = null, profId = '') {
  if (isProdutoBebida(item)) return 0;
  if (!prof || profId === '__sem_profissional__') return 0;
  const raw = item?.comissaoPercentual ?? prof.percentualComissaoProduto ?? prof.comissaoProdutos;
  if (raw !== undefined && raw !== null && raw !== '') {
    const val = Number(raw);
    if (Number.isFinite(val)) return val;
  }
  return 10;
}
