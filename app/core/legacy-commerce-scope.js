// Ponte explícita entre o tenant Commerce da Barbearia Dino e o estado legado
// usado pelo ERP operacional. O mapeamento é exato e não faz fallback entre
// empresas: IDs desconhecidos continuam sendo tratados como IDs legados.

export const DINO_COMMERCE_EMPRESA_ID = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
export const DINO_COMMERCE_LOJA_ID = 'ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8';
export const DINO_LEGACY_EMPRESA_ID = 'emp-kytto-001';
export const DINO_LEGACY_LOJA_ID = 'dino-web-estoque';

const clean = (value) => String(value || '').trim();

// 24/10/2026: o ERP operacional da Dino é o cadastro sob o id Commerce (UUID):
// agenda (inclusive futura), profissionais, serviços, planos, assinaturas e
// clientes estão lá. Entre 23 e 24/10 o ERP foi apontado para o cadastro legado
// (emp-kytto-001), que só tem a reimportação do Avec de 22/10, e a agenda sumiu
// do painel. Agora o id legado (sessões antigas) também resolve para o canônico.
// O extrato financeiro histórico gravado no cadastro legado continua visível por
// leitura combinada (financeiro-central-kytto) e o razão o lê explicitamente.
export function legacyEmpresaIdFromCommerce(empresaId) {
  const value = clean(empresaId);
  return value === DINO_LEGACY_EMPRESA_ID ? DINO_COMMERCE_EMPRESA_ID : value;
}

export function legacyLojaIdFromCommerce(lojaId, empresaId = '') {
  const store = clean(lojaId);
  const company = clean(empresaId);
  if (store === DINO_LEGACY_LOJA_ID && (company === DINO_COMMERCE_EMPRESA_ID || company === DINO_LEGACY_EMPRESA_ID)) {
    return DINO_COMMERCE_LOJA_ID;
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
