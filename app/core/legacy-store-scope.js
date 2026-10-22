const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function matchesLegacyStoreScope({ legacyEmpresaId, legacyLojaId, empresaId, commerceLojaId } = {}) {
  const legacyCompany = String(legacyEmpresaId || '').trim();
  const legacyStore = String(legacyLojaId || '').trim();
  const commerceCompany = String(empresaId || '').trim();
  const commerceStore = String(commerceLojaId || '').trim();
  return UUID.test(legacyCompany) && UUID.test(legacyStore) && UUID.test(commerceCompany) && UUID.test(commerceStore)
    && legacyCompany === commerceCompany && legacyStore === commerceStore;
}
