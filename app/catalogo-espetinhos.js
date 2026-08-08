// Catálogo inicial de espetinhos Kytto.
// Os itens começam indisponíveis e sem preço comercial definido para revisão antes da venda.
const espetinho = (nome, tipo, extras = {}) => ({
  nome: `Espetinho — ${nome}`,
  marca: 'Kytto Cozinha',
  tipo,
  embalagem: 'Unidade',
  volumeMl: null,
  cat: 'Espetinhos',
  subcategoria: extras.subcategoria || 'Espetinhos',
  setor: 'chapa',
  cozinha: true,
  emoji: extras.emoji || '🍢',
  preco: 0,
  precoPendente: true,
  indisponivel: true,
  unidade: 'UN',
  fiscal: { ncm: extras.ncm || '16025000', cfop: '5102', cstCsosn: '102', unidade: 'UN', origem: 0 },
})

export const CATALOGO_ESPETINHOS_KYTTO = [
  espetinho('Carne bovina', 'Bovino', { ncm: '02013000' }),
  espetinho('Carne bovina com bacon', 'Bovino', { ncm: '02013000' }),
  espetinho('Frango temperado', 'Aves', { ncm: '02071400' }),
  espetinho('Frango com bacon', 'Aves', { ncm: '02071400' }),
  espetinho('Coração de frango', 'Aves', { ncm: '02071400' }),
  espetinho('Linguiça toscana', 'Suíno', { ncm: '16010000' }),
  espetinho('Lombo suíno', 'Suíno', { ncm: '02031900' }),
  espetinho('Kafta bovina', 'Bovino', { ncm: '16025000' }),
  espetinho('Medalhão de frango', 'Aves', { ncm: '02071400' }),
  espetinho('Queijo coalho', 'Vegetariano', { emoji: '🧀', ncm: '04069020' }),
  espetinho('Pão de alho', 'Acompanhamento', { emoji: '🧄', ncm: '19059090' }),
  espetinho('Legumes grelhados', 'Vegetariano', { emoji: '🥬', ncm: '20059900' }),
]

export const RESUMO_CATALOGO_ESPETINHOS = {
  itens: CATALOGO_ESPETINHOS_KYTTO.length,
  sabores: CATALOGO_ESPETINHOS_KYTTO.map(item => item.nome.replace('Espetinho — ', '')),
  categoria: 'Espetinhos',
}
