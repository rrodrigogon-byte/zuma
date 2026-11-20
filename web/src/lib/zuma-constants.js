// ============================================================================
// CONSTANTES CANÔNICAS — ZUMA COZINHA ORIENTAL
// Empresa independente de gastronomia oriental (Sushi, Contemporâneo, Delivery & Salão)
// Provisionada com CNPJ oficial 36.296.848/0001-57 e domínio zuma.kytto.com.br
// ============================================================================

export const ZUMA_EMPRESA_ID = 'c3c3ac01-8e50-4b61-8c79-de4aaa916da3';
export const ZUMA_LOJA_ID = 'c3c3ac01-8e50-4b61-8c79-de4aaa916da0';
export const ZUMA_STOREFRONT_ID = 'b8b8ac01-8e50-4b61-8c79-de4aaa916da0';
export const ZUMA_ACCOUNT_ID = 'a8a8ac01-8e50-4b61-8c79-de4aaa916da0';

export const ZUMA_CNPJ = '36.296.848/0001-57';
export const ZUMA_CNPJ_NUM = '36296848000157';
export const ZUMA_INSCRICAO_ESTADUAL = '13.882.109-8';
export const ZUMA_INSCRICAO_MUNICIPAL = '94820';

export const HOST_ZUMA_SUBDOMINIO = 'zuma.kytto.com.br';
export const HOSTS_ZUMA = new Set([
  'zuma.kytto.com.br',
  'zumacozinhaoriental.com.br',
  'www.zumacozinhaoriental.com.br',
]);

export const ZUMA_COMPANY = Object.freeze({
  id: ZUMA_EMPRESA_ID,
  nome: 'Zuma Cozinha Oriental',
  nomeFantasia: 'Zuma Cozinha Oriental',
  razaoSocial: 'Zuma Cozinha Oriental LTDA',
  cnpj: ZUMA_CNPJ,
  cnpjNormalizado: ZUMA_CNPJ_NUM,
  inscricaoEstadual: ZUMA_INSCRICAO_ESTADUAL,
  inscricaoMunicipal: ZUMA_INSCRICAO_MUNICIPAL,
  tipoNegocio: 'restaurante',
  segmento: 'alimentacao',
  subsegmento: 'gastronomia_oriental_sushi',
  brandKey: 'zuma',
  telefone: '(65) 99800-1447',
  whatsapp: '(65) 99800-1447',
  whatsappNumero: '5565998001447',
  instagram: '@zuma_orientaltga',
  instagramUrl: 'https://www.instagram.com/zuma_orientaltga/',
  email: 'contato@zumacozinhaoriental.com.br',
  website: 'https://zuma.kytto.com.br',
  enderecoLogradouro: 'Av. Brasil',
  enderecoNumero: '1605',
  enderecoComplemento: 'S',
  enderecoBairro: 'Jardim Cidade Alta',
  enderecoCidade: 'Tangará da Serra',
  enderecoEstado: 'MT',
  enderecoCep: '78300000',
  logoUrl: 'https://cdnimages.ligafiles.com.br/preset=logo_square_400/empresa_images/4304/6abafc96a35a9e82qq.webp',
  bannerUrl: 'https://alloydeliveryimages.ligafiles.com.br/loja_images/4212/69b490b2917fe4lx5c.webp',
  ativa: true,
  lojaPadraoId: ZUMA_LOJA_ID,
});

export const ZUMA_STORE = Object.freeze({
  id: ZUMA_LOJA_ID,
  empresaId: ZUMA_EMPRESA_ID,
  codigo: 'ZUMA-MATRIZ',
  nome: 'Zuma Cozinha Oriental - Principal',
  nomeFantasia: 'Zuma Cozinha Oriental',
  cnpj: ZUMA_CNPJ,
  cnpjNormalizado: ZUMA_CNPJ_NUM,
  telefone: '(65) 99800-1447',
  email: 'contato@zumacozinhaoriental.com.br',
  enderecoLogradouro: 'Av. Brasil',
  enderecoNumero: '1605',
  enderecoBairro: 'Jardim Cidade Alta',
  enderecoCidade: 'Tangará da Serra',
  enderecoEstado: 'MT',
  enderecoCep: '78300000',
  timezone: 'America/Cuiaba',
  ativa: true,
});

export function isZumaEmpresa(idOuNome) {
  if (!idOuNome) return false;
  const s = String(idOuNome).toLowerCase().trim();
  return (
    s === ZUMA_EMPRESA_ID.toLowerCase() ||
    s.replace(/\D/g, '') === ZUMA_CNPJ_NUM ||
    s.includes('zuma') ||
    s.includes('cozinha oriental')
  );
}

export function ehHostZuma(host = typeof window === 'undefined' ? '' : window.location.hostname) {
  const h = String(host || '').toLowerCase().trim().replace(/\.$/, '');
  if (HOSTS_ZUMA.has(h) || h.startsWith('zuma.') || h.includes('zuma')) return true;
  if (typeof window !== 'undefined') {
    const p = String(window.location.pathname || '').toLowerCase();
    if (p.startsWith('/zuma') || p.startsWith('/admin/zuma') || p.startsWith('/erp') || p.startsWith('/operacao') || p.startsWith('/pilot')) {
      return true;
    }
  }
  // No ecossistema Zuma, opera 100% exclusivo para a Zuma Cozinha Oriental
  return true;
}
