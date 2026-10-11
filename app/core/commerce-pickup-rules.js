// Regras de conservação que limitam a forma de entrega.
// Itens congelados ou refrigerados não podem seguir por transporte comum:
// enquanto a loja não tiver logística refrigerada, só saem por retirada.
// A regra vale para qualquer empresa e é decidida no servidor (cotação de frete).

const PICKUP_ONLY_PATTERN = /\b(congelad[oa]s?|refrigerad[oa]s?|resfriad[oa]s?|perec[ií]ve(?:l|is))\b/i;

function fold(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** true quando a categoria (ou o nome do produto) indica conservação a frio. */
export function requiresPickupOnly({ categoryName = '', productName = '' } = {}) {
  return PICKUP_ONLY_PATTERN.test(fold(categoryName)) || PICKUP_ONLY_PATTERN.test(fold(productName));
}

/** Itens do carrinho que impedem entrega/transportadora. */
export function pickupOnlyItems(items = []) {
  return (Array.isArray(items) ? items : []).filter(item => requiresPickupOnly(item));
}

export const PICKUP_ONLY_ERROR_CODE = 'SHIPPING_PICKUP_ONLY_ITEMS';
export const PICKUP_ONLY_MESSAGE = 'itens congelados ou refrigerados só podem ser retirados na loja; remova-os ou escolha retirada';
