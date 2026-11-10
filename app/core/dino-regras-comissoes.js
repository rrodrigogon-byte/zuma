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
  const subtotal = Number(item.subtotal || (Number(item.precoUnitario || item.preco || 0) * Number(item.quantidade || 1)));

  if (isBebida) {
    return {
      isBebida: true,
      subtotal,
      percentualAplicado: 0,
      valorComissao: 0,
    };
  }

  const comissaoPercent = Number(item.comissaoPercentual ?? prof?.comissaoProdutos ?? prof?.percentualComissaoProduto ?? 10);
  const valorComissao = Number((subtotal * (comissaoPercent / 100)).toFixed(2));

  return {
    isBebida: false,
    subtotal,
    percentualAplicado: comissaoPercent,
    valorComissao,
  };
}
