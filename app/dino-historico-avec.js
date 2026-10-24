// Leitura do histórico Avec gravado no ERP.
//
// No cadastro canônico da Dino coexistem duas importações do Avec: a parcial
// (origem "importacao_avec", 09/10, sem unidade) e a completa de 22/10 (origem
// "avec-import-20261022"), gravada com os ids legados (emp-kytto-001 /
// dino-web-estoque). Para ler sem duplicar e sem perder a completa:
// - ids legados da Dino viram os canônicos (empresa e unidade);
// - quando a importação completa existe, a parcial deixa de ser somada (não é apagada).
import { legacyEmpresaIdFromCommerce, legacyLojaIdFromCommerce } from './core/legacy-commerce-scope.js';

const SUBSTITUIDA_POR = new Map([['importacao_avec', 'avec-import-20261022']]);

const origemDe = (item) => String(item?.origem || item?.origemImportacao || '');

export function canonizarRegistroAvec(item) {
  if (!item || typeof item !== 'object') return item;
  const empresaOriginal = item.empresaId;
  const empresaId = empresaOriginal ? legacyEmpresaIdFromCommerce(empresaOriginal) : empresaOriginal;
  const lojaId = item.lojaId ? legacyLojaIdFromCommerce(item.lojaId, empresaOriginal || empresaId) : item.lojaId;
  return empresaId === empresaOriginal && lojaId === item.lojaId ? item : { ...item, empresaId, lojaId };
}

export function historicoAvecVigente(registros = []) {
  const itens = (Array.isArray(registros) ? registros : Object.values(registros || {})).filter(Boolean);
  const origens = new Set(itens.map(origemDe));
  const descartar = new Set([...SUBSTITUIDA_POR].filter(([, nova]) => origens.has(nova)).map(([antiga]) => antiga));
  return itens.filter((item) => !descartar.has(origemDe(item))).map(canonizarRegistroAvec);
}
