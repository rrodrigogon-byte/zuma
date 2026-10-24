// Ponte explícita entre o tenant Commerce da Barbearia Dino e o estado legado
// usado pelo ERP operacional. O mapeamento é exato e não faz fallback entre
// empresas: IDs desconhecidos continuam sendo tratados como IDs legados.

export const DINO_COMMERCE_EMPRESA_ID = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
export const DINO_COMMERCE_LOJA_ID = 'ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8';
export const DINO_LEGACY_EMPRESA_ID = 'emp-kytto-001';
export const DINO_LEGACY_LOJA_ID = 'dino-web-estoque';

const clean = (value) => String(value || '').trim();

export function legacyEmpresaIdFromCommerce(empresaId) {
  const value = clean(empresaId);
  return value === DINO_COMMERCE_EMPRESA_ID ? DINO_LEGACY_EMPRESA_ID : value;
}

export function legacyLojaIdFromCommerce(lojaId, empresaId = '') {
  const store = clean(lojaId);
  const company = clean(empresaId);
  if (store === DINO_COMMERCE_LOJA_ID && (company === DINO_COMMERCE_EMPRESA_ID || company === DINO_LEGACY_EMPRESA_ID)) {
    return DINO_LEGACY_LOJA_ID;
  }
  return store;
}

// Volta do id legado para o canônico do Commerce. Usado onde o dado pertence ao
// Commerce (conexão WhatsApp, dono da instância, IA), mesmo atrás das rotas do ERP.
export function commerceEmpresaIdFromLegacy(empresaId) {
  const value = clean(empresaId);
  return value === DINO_LEGACY_EMPRESA_ID ? DINO_COMMERCE_EMPRESA_ID : value;
}

export function commerceLojaIdFromLegacy(lojaId, empresaId = '') {
  const store = clean(lojaId);
  const company = clean(empresaId);
  if (store === DINO_LEGACY_LOJA_ID && (company === DINO_LEGACY_EMPRESA_ID || company === DINO_COMMERCE_EMPRESA_ID)) {
    return DINO_COMMERCE_LOJA_ID;
  }
  return store;
}
