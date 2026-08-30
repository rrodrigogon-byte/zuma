// Catálogo oficial do Bar TTC, transcrito do cardápio em PDF.
// Não adicionar itens fora desta fonte sem validação comercial do operador.
const item = (nome, cat, preco, extras = {}) => ({
  nome,
  marca: 'Bar TTC',
  tipo: extras.tipo || cat,
  embalagem: extras.embalagem || 'Unidade',
  volumeMl: extras.volumeMl ?? null,
  cat,
  subcategoria: extras.subcategoria || cat,
  setor: extras.setor || (cat === 'Bebidas' ? 'bar' : 'cozinha'),
  cozinha: extras.cozinha ?? cat !== 'Bebidas',
  emoji: extras.emoji || '',
  preco,
  unidade: extras.unidade || 'UN',
  indisponivel: false,
  precoPendente: false,
  descricao: extras.descricao || '',
  origemCardapio: 'cardapio_bar_ttc_completo.pdf',
  fiscal: extras.fiscal,
});

export const CATALOGO_BAR_TTC_OFICIAL = [
  // Página 1 — bebidas não alcoólicas.
  item('Água Mineral', 'Bebidas', 5.00, { subcategoria: 'Bebidas não alcoólicas' }),
  item('Água com Gás', 'Bebidas', 6.00, { subcategoria: 'Bebidas não alcoólicas' }),
  item('Refrigerante', 'Bebidas', 8.00, { subcategoria: 'Bebidas não alcoólicas' }),
  item('Suco', 'Bebidas', 10.00, { subcategoria: 'Bebidas não alcoólicas' }),
  item('Gatorade', 'Bebidas', 12.00, { subcategoria: 'Bebidas não alcoólicas' }),
  item('Red Bull', 'Bebidas', 15.00, { subcategoria: 'Bebidas não alcoólicas' }),

  // Página 1 — cervejas long neck.
  item('Stella Artois', 'Bebidas', 12.90, { subcategoria: 'Cervejas long neck', embalagem: 'Long Neck' }),
  item('Corona', 'Bebidas', 12.90, { subcategoria: 'Cervejas long neck', embalagem: 'Long Neck' }),
  item('Budweiser', 'Bebidas', 12.90, { subcategoria: 'Cervejas long neck', embalagem: 'Long Neck' }),
  item('Heineken', 'Bebidas', 12.90, { subcategoria: 'Cervejas long neck', embalagem: 'Long Neck' }),

  // Página 1 — cervejas 600 ml.
  item('Original 600ml', 'Bebidas', 16.90, { subcategoria: 'Cervejas 600 ml', embalagem: 'Garrafa', volumeMl: 600 }),
  item('Stella 600ml', 'Bebidas', 18.90, { subcategoria: 'Cervejas 600 ml', embalagem: 'Garrafa', volumeMl: 600 }),
  item('Corona 600ml', 'Bebidas', 19.90, { subcategoria: 'Cervejas 600 ml', embalagem: 'Garrafa', volumeMl: 600 }),
  item('Heineken 600ml', 'Bebidas', 19.90, { subcategoria: 'Cervejas 600 ml', embalagem: 'Garrafa', volumeMl: 600 }),

  // Página 1 — outras bebidas.
  item('Ice', 'Bebidas', 15.00, { subcategoria: 'Outras bebidas' }),
  item('Campari', 'Bebidas', 18.00, { subcategoria: 'Outras bebidas' }),

  // Página 2 — porções, com classificação operacional da proteína.
  item('Batata Frita', 'Porções', 34.90, { subcategoria: 'Acompanhamentos', unidade: 'PORÇÃO' }),
  item('Frango à Passarinho', 'Porções', 39.90, { subcategoria: 'Aves', unidade: 'PORÇÃO' }),
  item('Isca de Tilápia', 'Porções', 59.90, { subcategoria: 'Peixes', unidade: 'PORÇÃO' }),
  item('Filé com Fritas', 'Porções', 69.90, { subcategoria: 'Bovinos', unidade: 'PORÇÃO' }),

  // Página 2 — espetos simples.
  item('Frango c/ Bacon', 'Espetos', 29.00, { subcategoria: 'Aves · Simples', setor: 'chapa', cozinha: true }),
  item('Alcatra', 'Espetos', 29.90, { subcategoria: 'Bovinos · Simples', setor: 'chapa', cozinha: true }),
  item('Picanha', 'Espetos', 39.90, { subcategoria: 'Bovinos · Simples', setor: 'chapa', cozinha: true }),

  // Página 2 — espetos completos.
  item('Alcatra', 'Espetos', 34.90, { subcategoria: 'Bovinos · Completo', setor: 'chapa', cozinha: true, embalagem: 'Completo' }),
  item('Frango c/ Bacon', 'Espetos', 34.90, { subcategoria: 'Aves · Completo', setor: 'chapa', cozinha: true, embalagem: 'Completo' }),
  item('Picanha', 'Espetos', 44.90, { subcategoria: 'Bovinos · Completo', setor: 'chapa', cozinha: true, embalagem: 'Completo' }),

  // Página 3 — burgers gourmet, todos com hambúrguer de costela 180 g.
  item('Jungle Burger', 'Burgers', 34.90, {
    subcategoria: 'Bovinos · Costela 180g',
    descricao: 'Pão de hambúrguer levemente tostado, molho especial, tomate, alface, picles, hambúrguer de costela 180g, queijo mussarela, bacon.',
  }),
  item('Pantera', 'Burgers', 39.90, {
    subcategoria: 'Bovinos · Costela 180g',
    descricao: 'Pão australiano, molho especial, hambúrguer de costela 180g, queijo cheddar fatiado, cebola caramelizada, bacon.',
  }),
  item('Rei da Floresta', 'Burgers', 39.90, {
    subcategoria: 'Bovinos · Costela 180g',
    descricao: 'Pão brioche levemente tostado, molho especial, hambúrguer de costela 180g, alface, creme de cheddar, anéis de cebola, bacon.',
  }),
];

export const RESUMO_CATALOGO_BAR_TTC = {
  versao: 'bar-ttc-oficial-v1',
  fonte: 'cardapio_bar_ttc_completo.pdf',
  itens: CATALOGO_BAR_TTC_OFICIAL.length,
  categorias: ['Bebidas', 'Porções', 'Espetos', 'Burgers'],
  subcategorias: ['Bebidas não alcoólicas', 'Cervejas long neck', 'Cervejas 600 ml', 'Outras bebidas', 'Acompanhamentos', 'Aves', 'Peixes', 'Bovinos', 'Bovinos · Simples', 'Bovinos · Completo', 'Aves · Simples', 'Aves · Completo', 'Bovinos · Costela 180g'],
};

export const CATALOGO_BAR_TTC_SKUS = Object.freeze(CATALOGO_BAR_TTC_OFICIAL.map((produto, indice) => ({
  ...produto,
  sku: `BAR-TTC-${String(indice + 1).padStart(3, '0')}`,
})));
