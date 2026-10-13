const IDENTIFIER_FIELDS = ['id', 'sku', 'cod', 'codigo'];

function text(value) {
  const result = String(value ?? '').trim();
  return result || null;
}

function firstOwnValue(row, fields) {
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(row || {}, field) && row[field] !== null && row[field] !== undefined && row[field] !== '') return row[field];
  }
  return null;
}

function ownField(row, fields) {
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(row || {}, field)) return { present: true, value: row[field] };
  }
  return { present: false, value: null };
}

function meaningfulRawValue(value) {
  return value !== null && value !== undefined && (typeof value !== 'string' || value.trim() !== '');
}

/**
 * Converts a contract money value to integer cents without using binary float
 * arithmetic. Ambiguous locale/thousand separators and more than two decimal
 * places are deliberately not guessed.
 */
export function moneyToCents(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && (!Number.isFinite(value) || value < 0)) return null;
  const raw = String(value).trim();
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(raw)) return null;
  const normalized = raw.replace(',', '.');
  const [whole, fraction = ''] = normalized.split('.');
  const cents = Number(`${whole}${fraction.padEnd(2, '0')}`);
  return Number.isSafeInteger(cents) ? cents : null;
}

function quantity(value) {
  if (value === null || value === undefined || value === '') return null;
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === '') return null;
  const number = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function sourceCandidates(item = {}) {
  // Names/descriptions are intentionally excluded: no fuzzy/name matching.
  return [...new Set(IDENTIFIER_FIELDS.map(field => text(item[field])).filter(Boolean))];
}

function safeIdentifier(item = {}) {
  const id = text(item.id);
  const sku = text(firstOwnValue(item, ['sku', 'cod', 'codigo']));
  return id || sku || null;
}

function same(valueA, valueB) {
  return valueA !== null && valueB !== null && valueA === valueB;
}

function uniqueRows(rows) {
  const seen = new Set();
  return rows.filter(row => {
    const key = [text(row.variant_id ?? row.variantId), text(row.product_id ?? row.productId), text(row.legacy_key ?? row.legacyKey), text(row.sku)].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function scopeMatches(item, scope, { mapping = null, authorizedByExactMap = false } = {}) {
  if (!scope.empresaId || !scope.lojaId) return false;
  const itemEmpresa = text(item.empresaId ?? item.empresa_id);
  if (!itemEmpresa && !authorizedByExactMap) return false;
  if (itemEmpresa && itemEmpresa !== String(scope.empresaId)) return false;
  const itemLoja = text(item.lojaId ?? item.loja_id);
  const mappingLoja = text(mapping?.loja_id ?? mapping?.lojaId);
  if (itemLoja && itemLoja !== String(scope.lojaId)) return false;
  if (mappingLoja && mappingLoja !== String(scope.lojaId)) return false;
  return true;
}

function coreRowsInScope(rows, scope) {
  return rows.filter(row => {
    if (!scope.empresaId || !scope.lojaId) return false;
    if (!row.empresa_id || String(row.empresa_id) !== String(scope.empresaId)) return false;
    const loja = text(row.loja_id ?? row.lojaId ?? row.location_loja_id);
    // A tenant-owned global row is retained but can never make store stock
    // comparable. Rows belonging to another store are dropped before matching.
    return !loja || loja === String(scope.lojaId);
  });
}

function priceSnapshot(legacy, core) {
  const legacyValue = firstOwnValue(legacy, ['precoVenda', 'preco_venda', 'preco', 'price']);
  const coreValue = firstOwnValue(core, ['core_price', 'corePrice', 'preco', 'price']);
  const corePromoField = ownField(core, ['core_promotional_price', 'corePromotionalPrice', 'preco_promocional']);
  const promoPresent = corePromoField.present && corePromoField.value !== null && corePromoField.value !== undefined;
  const corePromo = promoPresent ? corePromoField.value : null;
  const corePromotionalCents = moneyToCents(corePromo);
  return {
    legacyCents: moneyToCents(legacyValue),
    coreCents: moneyToCents(coreValue),
    corePromotionalCents,
    promotionalPresent: promoPresent,
    promotionalInvalid: promoPresent && corePromotionalCents === null,
    compared: 'base',
  };
}

function stockSnapshot(legacy, core) {
  return {
    legacyAvailable: quantity(firstOwnValue(legacy, ['estoqueAtual', 'estoque_atual', 'estoque', 'qtd'])),
    coreAvailable: quantity(firstOwnValue(core, ['core_available', 'coreAvailable', 'disponivel'])),
    coreReserved: quantity(firstOwnValue(core, ['core_reserved', 'coreReserved', 'reservado'])),
    coreCommitted: quantity(firstOwnValue(core, ['core_committed', 'coreCommitted', 'comprometido'])),
    compared: 'available',
    reservedComparable: false,
  };
}

function reasonsForMatch(legacy, core, scope) {
  const reasons = [];
  const legacySku = text(firstOwnValue(legacy, ['sku', 'cod', 'codigo']));
  const coreSku = text(firstOwnValue(core, ['sku']));
  if (!legacySku) reasons.push('LEGACY_SKU_MISSING');
  if (!coreSku) reasons.push('CORE_SKU_MISSING');
  if (legacySku && coreSku && legacySku !== coreSku) reasons.push('SKU_MISMATCH');
  const legacyUnit = text(firstOwnValue(legacy, ['unidade', 'unit']));
  const coreUnit = text(firstOwnValue(core, ['core_unit', 'coreUnit', 'unidade', 'unit']));
  if (!text(legacy.lojaId ?? legacy.loja_id)) reasons.push('LEGACY_SCOPE_GLOBAL');
  if (!text(core.loja_id ?? core.lojaId)) reasons.push('CORE_SCOPE_MISSING');
  if (!legacyUnit || !coreUnit) reasons.push('UNIT_NOT_COMPARABLE');
  else if (legacyUnit !== coreUnit) reasons.push('UNIT_MISMATCH');
  const stockScope = text(firstOwnValue(core, ['core_stock_scope', 'coreStockScope', 'stock_scope', 'stockScope', 'inventory_scope']));
  if (stockScope && stockScope.toLowerCase() === 'global') reasons.push('GLOBAL_STOCK');
  if (!scope.lojaId) reasons.push('STORE_SCOPE_REQUIRED');
  if (!scope.storefrontId) reasons.push('STOREFRONT_SCOPE_REQUIRED');
  const price = priceSnapshot(legacy, core);
  if (price.legacyCents === null) reasons.push('LEGACY_PRICE_MISSING');
  if (price.coreCents === null) reasons.push('CORE_PRICE_MISSING');
  const stock = stockSnapshot(legacy, core);
  if (stock.legacyAvailable === null) reasons.push('LEGACY_AVAILABLE_MISSING');
  if (stock.coreAvailable === null) reasons.push('CORE_AVAILABLE_MISSING');
  return { reasons, price, stock };
}

function resultStatus(reasons, price, stock) {
  const hardAmbiguity = reasons.some(reason => reason === 'AMBIGUOUS_MAPPING' || reason === 'DUPLICATE_SKU' || reason === 'DUPLICATE_CORE_SKU');
  if (hardAmbiguity) return 'ambiguous';
  if (reasons.some(reason => reason.endsWith('_MISSING') || reason.endsWith('_NOT_COMPARABLE') || reason === 'STORE_SCOPE_REQUIRED' || reason === 'STOREFRONT_SCOPE_REQUIRED' || reason === 'UNIT_MISMATCH' || reason === 'LEGACY_SCOPE_GLOBAL' || reason === 'GLOBAL_STOCK')) return 'not_verified';
  if (reasons.includes('SKU_MISMATCH') || !same(price.legacyCents, price.coreCents) || !same(stock.legacyAvailable, stock.coreAvailable)) return 'divergent';
  return 'aligned';
}

function itemResult({ source, legacy, core = null, status, reasons = [], price = null, stock = null, variantId = null, selectedCore = true, hideIdentifiers = false }) {
  const chosen = selectedCore && core;
  return {
    source,
    identifier: safeIdentifier(legacy),
    // An ambiguous mapping is evidence, not a selection. Never expose a
    // candidate's SKU, variant, price, or stock as if it had been chosen.
    sku: hideIdentifiers ? null : core ? (chosen ? text(firstOwnValue(core, ['sku', 'cod', 'codigo'])) : null) : text(firstOwnValue(legacy, ['sku', 'cod', 'codigo'])),
    variantId: chosen ? text(variantId || core?.variant_id || core?.variantId) : null,
    status,
    reasons,
    price: hideIdentifiers ? { legacyCents: null, coreCents: null, corePromotionalCents: null, compared: 'not-comparable' } : chosen ? (price || { legacyCents: null, coreCents: null, corePromotionalCents: null, compared: 'base' }) : { legacyCents: null, coreCents: null, corePromotionalCents: null, compared: 'not-comparable' },
    stock: hideIdentifiers ? { legacyAvailable: null, coreAvailable: null, coreReserved: null, coreCommitted: null, compared: 'not-comparable', reservedComparable: false } : chosen ? (stock || { legacyAvailable: null, coreAvailable: null, coreReserved: null, coreCommitted: null, compared: 'available', reservedComparable: false }) : { legacyAvailable: null, coreAvailable: null, coreReserved: null, coreCommitted: null, compared: 'not-comparable', reservedComparable: false },
  };
}

/**
 * Read-only comparison adapter shared by admin diagnostics and future callers.
 * It accepts already-authorized source rows; it performs no I/O and never
 * mutates its inputs. Mapping is exact and case-sensitive.
 */
export function compareScopedCatalog({ sources = [], coreRows = [], scope = {} } = {}) {
  requireDiagnosticScope(scope);
  if (!Array.isArray(sources)) throw scopeError('fontes do diagnóstico indisponíveis', 'SOURCE_READ_FAILED');
  for (const source of sources) {
    if (!source || source.error || !Array.isArray(source.items)) throw scopeError('fonte legada indisponível', 'SOURCE_READ_FAILED');
  }
  const selectedScope = { empresaId: text(scope.empresaId), lojaId: text(scope.lojaId), storefrontId: text(scope.storefrontId) };
  if (!Array.isArray(coreRows)) throw scopeError('fonte Commerce indisponível', 'SOURCE_READ_FAILED');
  const scopedCoreRows = coreRowsInScope(coreRows, selectedScope);
  const mappingByKey = new Map();
  for (const row of scopedCoreRows) {
    const key = text(row.legacy_key ?? row.legacyKey);
    if (!key) continue;
    const list = mappingByKey.get(key) || [];
    list.push(row);
    mappingByKey.set(key, list);
  }
  const coreSkuCounts = new Map();
  for (const row of scopedCoreRows) {
    const sku = text(row.sku);
    if (sku) coreSkuCounts.set(sku, (coreSkuCounts.get(sku) || 0) + 1);
  }
  const sourceRows = [];
  for (const source of Array.isArray(sources) ? sources : []) {
    const sourceName = text(source.name) || 'unknown';
    for (const item of Array.isArray(source.items) ? source.items : []) {
      const exactAuthorizedMapping = sourceCandidates(item).some(key => mappingByKey.has(key));
      const authorizedMapping = exactAuthorizedMapping ? mappingByKey.get(sourceCandidates(item).find(key => mappingByKey.has(key)))?.[0] : null;
      if (!scopeMatches(item, selectedScope, { mapping: authorizedMapping, authorizedByExactMap: exactAuthorizedMapping })) {
        sourceRows.push({ source: sourceName, item, outOfScope: true });
        continue;
      }
      sourceRows.push({ source: sourceName, item, outOfScope: false });
    }
  }
  const sourceSkuCounts = new Map();
  for (const row of sourceRows) {
    if (row.outOfScope) continue;
    const sku = text(firstOwnValue(row.item, ['sku', 'cod', 'codigo']));
    if (sku) sourceSkuCounts.set(sku, (sourceSkuCounts.get(sku) || 0) + 1);
  }
  const items = [];
  const matchedCoreKeys = new Set();
  let outOfScope = sourceRows.filter(row => row.outOfScope).length;
  let mapped = 0;
  let aligned = 0;
  let divergent = 0;
  let ambiguous = 0;
  let unmapped = 0;
  let notVerified = 0;
  for (const sourceRow of sourceRows) {
    if (sourceRow.outOfScope) continue;
    const legacy = sourceRow.item;
    const candidates = sourceCandidates(legacy);
    const matches = uniqueRows(candidates.flatMap(key => mappingByKey.get(key) || []));
    if (!matches.length) {
      unmapped += 1;
      items.push(itemResult({ source: sourceRow.source, legacy, status: 'unmapped', reasons: ['NO_EXACT_MAPPING'] }));
      continue;
    }
    mapped += 1;
    for (const row of matches) matchedCoreKeys.add(`${text(row.legacy_key ?? row.legacyKey)}|${text(row.variant_id ?? row.variantId)}`);
    const sku = text(firstOwnValue(legacy, ['sku', 'cod', 'codigo']));
    const reasons = [];
    if (matches.length !== 1) reasons.push('AMBIGUOUS_MAPPING');
    const core = matches.length === 1 ? matches[0] : null;
    if (sku && sourceSkuCounts.get(sku) > 1) reasons.push('DUPLICATE_SKU');
    if (matches.length === 1 && core?.sku && coreSkuCounts.get(core.sku) > 1) reasons.push('DUPLICATE_CORE_SKU');
    if (matches.length !== 1 || reasons.includes('DUPLICATE_SKU') || reasons.includes('DUPLICATE_CORE_SKU')) {
      ambiguous += 1;
      items.push(itemResult({ source: sourceRow.source, legacy, core: null, status: 'ambiguous', reasons, variantId: null, selectedCore: false, hideIdentifiers: true }));
      continue;
    }
    const evaluated = reasonsForMatch(legacy, core, selectedScope);
    const allReasons = [...reasons, ...evaluated.reasons];
    const unitIncomparable = allReasons.includes('UNIT_NOT_COMPARABLE') || allReasons.includes('UNIT_MISMATCH');
    const stockIncomparable = unitIncomparable || allReasons.includes('LEGACY_SCOPE_GLOBAL') || allReasons.includes('CORE_SCOPE_MISSING') || allReasons.includes('GLOBAL_STOCK');
    const price = unitIncomparable ? { legacyCents: null, coreCents: null, corePromotionalCents: null, compared: 'not-comparable' } : evaluated.price;
    const stock = stockIncomparable ? { legacyAvailable: null, coreAvailable: null, coreReserved: null, coreCommitted: null, compared: 'not-comparable', reservedComparable: false } : evaluated.stock;
    const status = resultStatus(allReasons, price, stock);
    if (status === 'ambiguous') ambiguous += 1;
    else if (status === 'aligned') aligned += 1;
    else if (status === 'divergent') divergent += 1;
    else notVerified += 1;
    items.push(itemResult({
      source: sourceRow.source,
      legacy,
      core,
      status,
      reasons: allReasons,
      price,
      stock,
      variantId: core.variant_id ?? core.variantId,
      selectedCore: !unitIncomparable,
    }));
  }
  for (const row of scopedCoreRows) {
    const key = `${text(row.legacy_key ?? row.legacyKey)}|${text(row.variant_id ?? row.variantId)}`;
    if (matchedCoreKeys.has(key)) continue;
    items.push(itemResult({ source: 'commerce-core', legacy: {}, core: row, status: 'core_only', reasons: ['LEGACY_ITEM_MISSING'], variantId: row.variant_id ?? row.variantId }));
  }
  return {
    mode: 'read-only-diagnostic',
    scope: selectedScope,
    sourceLabels: [...new Set((sources || []).map(source => text(source.name)).filter(Boolean)), 'commerce-core'],
    summary: {
      sourceItems: sourceRows.length - outOfScope,
      mapped,
      aligned,
      divergent,
      ambiguous,
      unmapped,
      notVerified,
      coreOnly: items.filter(item => item.status === 'core_only').length,
      outOfScope,
    },
    items,
  };
}

function commonIdentifierCandidates(item = {}) {
  const candidates = [];
  const itemId = text(item.id);
  const itemSku = text(firstOwnValue(item, ['sku', 'cod', 'codigo']));
  if (itemId) candidates.push({ kind: 'id', value: itemId });
  if (itemSku && itemSku !== itemId) candidates.push({ kind: 'sku', value: itemSku });
  return candidates;
}

function commonRowKey(row = {}) {
  return text(row.variant_id ?? row.variantId)
    || [text(row.legacy_key ?? row.legacyKey), text(row.sku)].join('|');
}

function commonRowsConflict(rows) {
  if (rows.length < 2) return false;
  const fields = [
    ['variant_id', 'variantId'],
    ['sku'],
    ['core_price', 'corePrice', 'preco', 'price'],
    ['core_promotional_price', 'corePromotionalPrice', 'preco_promocional'],
    ['core_available', 'coreAvailable', 'disponivel'],
    ['core_unit', 'coreUnit'],
    ['loja_id', 'lojaId'],
    ['core_storefront_id', 'storefront_id', 'storefrontId'],
    ['core_product_status', 'coreProductStatus', 'product_status', 'productStatus'],
    ['core_variant_active', 'coreVariantActive', 'variant_active', 'variantActive'],
    ['core_published', 'corePublished', 'publicado'],
  ];
  const fingerprints = rows.map(row => fields.map(fieldSet => {
    const field = ownField(row, fieldSet);
    return [field.present, field.value === undefined ? null : field.value];
  }));
  return fingerprints.some(fingerprint => JSON.stringify(fingerprint) !== JSON.stringify(fingerprints[0]));
}

function commonReadItem({ source, status, reasons = [], matchedBy = null, mappingKey = null, row = null, priceCents = null, corePriceCents = null, promotionalPriceCents = null, stockAvailable = null, sourceStockAvailable = null, scope }) {
  const available = status === 'available' && row;
  return {
    source,
    status,
    reasons,
    matchedBy: available ? matchedBy : null,
    mappingKey: available ? mappingKey : null,
    variantId: available ? text(row.variant_id ?? row.variantId) : null,
    sku: available ? text(row.sku) : null,
    priceCents: available ? priceCents : null,
    stockAvailable: available ? stockAvailable : null,
    sourceStockAvailable: available ? sourceStockAvailable : null,
    price: available ? {
      cents: priceCents,
      baseCents: corePriceCents,
      promotionalCents: promotionalPriceCents,
    } : { cents: null, baseCents: null, promotionalCents: null },
    stock: available ? { available: stockAvailable, sourceAvailable: sourceStockAvailable } : { available: null, sourceAvailable: null },
    scope: available ? {
      empresaId: scope.empresaId,
      lojaId: scope.lojaId,
      storefrontId: scope.storefrontId,
    } : null,
  };
}

/**
 * Builds the small common read model used by existing read-only surfaces.
 *
 * This is intentionally stricter than the diagnostic comparison: it only
 * emits a variant/SKU/price/stock when an explicit, case-sensitive ID or SKU
 * match is unique and both sources agree. Missing, ambiguous, duplicated,
 * out-of-scope or divergent data remains blocked/unavailable; no name match,
 * source preference or silent fallback is allowed. The helper is pure and
 * accepts rows already authorized by the tenant/unit/storefront reader.
 */
export function buildCommonCatalogRead({ sources = [], coreRows = [], scope = {} } = {}) {
  requireDiagnosticScope(scope);
  if (!Array.isArray(sources)) throw scopeError('fontes do leitor indisponíveis', 'SOURCE_READ_FAILED');
  for (const source of sources) {
    if (!source || source.error || !Array.isArray(source.items)) throw scopeError('fonte legada indisponível', 'SOURCE_READ_FAILED');
  }
  if (!Array.isArray(coreRows)) throw scopeError('fonte Commerce indisponível', 'SOURCE_READ_FAILED');

  const selectedScope = { empresaId: text(scope.empresaId), lojaId: text(scope.lojaId), storefrontId: text(scope.storefrontId) };
  const scopedCoreRows = coreRowsInScope(coreRows, selectedScope);
  const byLegacyKey = new Map();
  const bySku = new Map();
  const coreSkuCounts = new Map();
  for (const row of scopedCoreRows) {
    const legacyKey = text(row.legacy_key ?? row.legacyKey);
    if (legacyKey) byLegacyKey.set(legacyKey, [...(byLegacyKey.get(legacyKey) || []), row]);
    const sku = text(row.sku);
    if (sku) {
      bySku.set(sku, [...(bySku.get(sku) || []), row]);
      coreSkuCounts.set(sku, (coreSkuCounts.get(sku) || 0) + 1);
    }
  }

  const sourceRows = [];
  for (const source of sources) {
    const sourceName = text(source.name) || 'unknown';
    for (const item of source.items) {
      const candidates = commonIdentifierCandidates(item);
      const explicitRows = candidates.some(candidate => byLegacyKey.has(candidate.value));
      const firstMapping = candidates.map(candidate => byLegacyKey.get(candidate.value)?.[0]).find(Boolean) || null;
      if (!scopeMatches(item, selectedScope, { mapping: firstMapping, authorizedByExactMap: explicitRows })) {
        sourceRows.push({ source: sourceName, item, outOfScope: true, candidates });
        continue;
      }
      sourceRows.push({ source: sourceName, item, outOfScope: false, candidates });
    }
  }

  const inScopeRows = sourceRows.filter(row => !row.outOfScope);
  const sourceIdentifierCounts = new Map();
  for (const sourceRow of inScopeRows) {
    for (const candidate of sourceRow.candidates) {
      const key = `${candidate.kind}:${candidate.value}`;
      sourceIdentifierCounts.set(key, (sourceIdentifierCounts.get(key) || 0) + 1);
    }
  }

  const preliminary = inScopeRows.map(sourceRow => {
    const found = [];
    for (const candidate of sourceRow.candidates) {
      const mapped = byLegacyKey.get(candidate.value) || [];
      for (const row of mapped) found.push({ row, matchedBy: candidate.kind, mappingKey: candidate.value });
      // A SKU match is valid even when no legacy import row exists. It is
      // still exact/case-sensitive and is never used if it conflicts with an
      // explicit ID mapping.
      if (candidate.kind === 'sku') {
        for (const row of bySku.get(candidate.value) || []) found.push({ row, matchedBy: 'sku', mappingKey: candidate.value });
      }
    }
    const grouped = new Map();
    for (const match of found) {
      const key = commonRowKey(match.row);
      grouped.set(key, [...(grouped.get(key) || []), match.row]);
    }
    const duplicateConflictKeys = new Set([...grouped.entries()]
      .filter(([, rows]) => commonRowsConflict(rows))
      .map(([key]) => key));
    const unique = new Map();
    for (const match of found) {
      const key = commonRowKey(match.row);
      const previous = unique.get(key);
      if (!previous || (previous.matchedBy === 'sku' && match.matchedBy === 'id')) unique.set(key, match);
    }
    return { ...sourceRow, matches: [...unique.values()], duplicateConflictKeys };
  });
  const claimedVariants = new Map();
  for (const entry of preliminary) {
    if (entry.matches.length !== 1) continue;
    const variantId = text(entry.matches[0].row.variant_id ?? entry.matches[0].row.variantId);
    if (variantId) claimedVariants.set(variantId, [...(claimedVariants.get(variantId) || []), entry]);
  }

  const items = [];
  let available = 0;
  let blocked = 0;
  let unavailable = 0;
  const reasonCounts = new Map();
  const addReasons = reasons => reasons.forEach(reason => reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1));
  for (const entry of preliminary) {
    if (!entry.matches.length) {
      unavailable += 1;
      const reasons = ['NO_EXACT_MAPPING'];
      addReasons(reasons);
      items.push(commonReadItem({ source: entry.source, status: 'unavailable', reasons, scope: selectedScope }));
      continue;
    }
    if (entry.matches.length !== 1) {
      blocked += 1;
      const duplicateReasons = entry.candidates
        .filter(candidate => candidate.kind === 'sku' && coreSkuCounts.get(candidate.value) > 1)
        .map(() => 'DUPLICATE_CORE_SKU');
      const reasons = ['AMBIGUOUS_MAPPING', ...new Set(duplicateReasons)];
      addReasons(reasons);
      items.push(commonReadItem({ source: entry.source, status: 'blocked', reasons, scope: selectedScope }));
      continue;
    }

    const match = entry.matches[0];
    const row = match.row;
    const rowKey = commonRowKey(row);
    const sourceDuplicate = entry.candidates.some(candidate => sourceIdentifierCounts.get(`${candidate.kind}:${candidate.value}`) > 1);
    const variantId = text(row.variant_id ?? row.variantId);
    const coreSku = text(row.sku);
    const sourceSku = text(firstOwnValue(entry.item, ['sku', 'cod', 'codigo']));
    const sourceUnitId = text(entry.item.lojaId ?? entry.item.loja_id);
    const coreUnitId = text(row.loja_id ?? row.lojaId);
    const coreStorefrontId = text(row.core_storefront_id ?? row.storefront_id ?? row.storefrontId);
    const sourceMeasure = text(firstOwnValue(entry.item, ['unidade', 'unit']));
    const coreMeasure = text(firstOwnValue(row, ['core_unit', 'coreUnit']));
    const productStatus = ownField(row, ['core_product_status', 'coreProductStatus', 'product_status', 'productStatus']);
    const variantActive = ownField(row, ['core_variant_active', 'coreVariantActive', 'variant_active', 'variantActive']);
    const published = ownField(row, ['core_published', 'corePublished', 'publicado']);
    const price = priceSnapshot(entry.item, row);
    const stock = stockSnapshot(entry.item, row);
    const effectiveCorePrice = price.promotionalInvalid ? null : price.corePromotionalCents ?? price.coreCents;
    const reasons = [];
    if (sourceDuplicate) reasons.push('DUPLICATE_SOURCE_IDENTIFIER');
    if (variantId && claimedVariants.get(variantId)?.length > 1) reasons.push('DUPLICATE_VARIANT_MAPPING');
    if (entry.duplicateConflictKeys.has(rowKey)) reasons.push('DUPLICATE_VARIANT_CONFLICT');
    if (!variantId) reasons.push('VARIANT_ID_MISSING');
    if (!coreSku) reasons.push('CORE_SKU_MISSING');
    if (!sourceUnitId) reasons.push('SOURCE_SCOPE_MISSING');
    if (!coreUnitId) reasons.push('CORE_SCOPE_MISSING');
    if (!coreStorefrontId) reasons.push('STOREFRONT_MISSING');
    else if (coreStorefrontId !== selectedScope.storefrontId) reasons.push('STOREFRONT_MISMATCH');
    if (sourceSku && coreSku && sourceSku !== coreSku) reasons.push('SKU_MISMATCH');
    if (coreSku && coreSkuCounts.get(coreSku) > 1) reasons.push('DUPLICATE_CORE_SKU');
    if (sourceUnitId && sourceUnitId !== selectedScope.lojaId) reasons.push('SOURCE_UNIT_MISMATCH');
    if (coreUnitId && coreUnitId !== selectedScope.lojaId) reasons.push('CORE_UNIT_MISMATCH');
    if (!sourceMeasure) reasons.push('SOURCE_UNIT_MISSING');
    if (!coreMeasure) reasons.push('CORE_UNIT_MISSING');
    if (!sourceMeasure || !coreMeasure) reasons.push('UNIT_NOT_COMPARABLE');
    else if (sourceMeasure !== coreMeasure) reasons.push('UNIT_MISMATCH');
    if (!productStatus.present) reasons.push('CORE_PRODUCT_STATUS_MISSING');
    else if (productStatus.value !== 'active') reasons.push('CORE_PRODUCT_NOT_ACTIVE');
    if (!variantActive.present) reasons.push('CORE_VARIANT_ACTIVE_MISSING');
    else if (variantActive.value !== true) reasons.push('CORE_VARIANT_NOT_ACTIVE');
    if (!published.present) reasons.push('CORE_PUBLISHED_MISSING');
    else if (published.value !== true) reasons.push('CORE_NOT_PUBLISHED');
    if (row.core_stock_scope && String(row.core_stock_scope).toLowerCase() === 'global') reasons.push('GLOBAL_STOCK');
    if (price.legacyCents === null) reasons.push('SOURCE_PRICE_MISSING');
    if (price.promotionalInvalid) reasons.push('PROMOTIONAL_PRICE_INVALID');
    if (effectiveCorePrice === null) reasons.push('STOREFRONT_PRICE_MISSING');
    if (price.legacyCents !== null && effectiveCorePrice !== null && price.legacyCents !== effectiveCorePrice) reasons.push('PRICE_DIVERGENCE');
    if (stock.legacyAvailable === null) reasons.push('SOURCE_STOCK_MISSING');
    if (stock.coreAvailable === null) reasons.push('STOREFRONT_STOCK_MISSING');
    if (stock.legacyAvailable !== null && stock.coreAvailable !== null && stock.legacyAvailable !== stock.coreAvailable) reasons.push('STOCK_DIVERGENCE');
    if (reasons.length) {
      blocked += 1;
      addReasons(reasons);
      items.push(commonReadItem({ source: entry.source, status: 'blocked', reasons, scope: selectedScope }));
      continue;
    }
    available += 1;
    items.push(commonReadItem({
      source: entry.source,
      status: 'available',
      reasons: [],
      matchedBy: match.matchedBy,
      mappingKey: match.mappingKey,
      row,
      priceCents: effectiveCorePrice,
      corePriceCents: price.coreCents,
      promotionalPriceCents: price.corePromotionalCents,
      stockAvailable: stock.coreAvailable,
      sourceStockAvailable: stock.legacyAvailable,
      scope: selectedScope,
    }));
  }

  return {
    mode: 'read-only-common-catalog',
    scope: selectedScope,
    sourceLabels: [...new Set(sources.map(source => text(source.name)).filter(Boolean))],
    summary: {
      sourceItems: inScopeRows.length,
      available,
      blocked,
      unavailable,
      outOfScope: sourceRows.length - inScopeRows.length,
      reasonCounts: Object.fromEntries(reasonCounts),
    },
    items,
  };
}

function scopeError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function requireDiagnosticScope(scope) {
  if (!text(scope?.empresaId)) throw scopeError('empresaId é obrigatório para o diagnóstico', 'TENANT_CONTEXT_REQUIRED');
  if (!text(scope?.lojaId)) throw scopeError('lojaId é obrigatório para o diagnóstico', 'STORE_SCOPE_REQUIRED');
  if (!text(scope?.storefrontId)) throw scopeError('storefrontId é obrigatório para o diagnóstico', 'STOREFRONT_REQUIRED');
}

/**
 * Loads only rows for the authorized tenant/unit/storefront. `queryRead` is
 * injected so callers and tests can prove this path performs no DML.
 */
export async function readScopedCatalogDiagnostic({ queryRead, legacyProducts = [], sources = null, scope = {} } = {}) {
  requireDiagnosticScope(scope);
  if (typeof queryRead !== 'function') throw new TypeError('queryRead é obrigatório');
  const selectedScope = { empresaId: text(scope.empresaId), lojaId: text(scope.lojaId), storefrontId: text(scope.storefrontId) };
  const storefront = await queryRead(
    `SELECT id, loja_id FROM commerce_storefronts
      WHERE empresa_id = $1 AND id = $2 AND status = 'active' AND loja_id = $3
      LIMIT 1`,
    [selectedScope.empresaId, selectedScope.storefrontId, selectedScope.lojaId],
  );
  if (!storefront?.rows?.[0]) throw scopeError('storefront fora do escopo da unidade selecionada', 'STORE_SCOPE_MISMATCH');
  const core = await queryRead(
    `SELECT li.legacy_key, p.id AS product_id, p.empresa_id, selected_storefront.loja_id,
            p.status AS core_product_status, v.id AS variant_id, v.sku,
            v.ativo AS core_variant_active, pc.publicado AS core_published,
            pc.storefront_id AS core_storefront_id,
            NULL::text AS core_unit,
            price.preco AS core_price, price.preco_promocional AS core_promotional_price,
            stock.core_available,
            stock.core_reserved,
            stock.core_committed,
            stock.core_stock_scope
       FROM commerce_storefronts selected_storefront
       JOIN commerce_product_channels pc
         ON pc.empresa_id = selected_storefront.empresa_id
        AND pc.storefront_id = selected_storefront.id
       JOIN commerce_products p
         ON p.empresa_id = pc.empresa_id AND p.id = pc.product_id
       JOIN commerce_product_variants v ON v.empresa_id = p.empresa_id AND v.product_id = p.id
       LEFT JOIN commerce_legacy_imports li
         ON li.empresa_id = p.empresa_id
        AND li.entity = 'product'
        AND li.target_id = p.id
        AND li.loja_id = $2
       LEFT JOIN LATERAL (
         SELECT vp.preco, vp.preco_promocional
           FROM commerce_variant_prices vp
          WHERE vp.empresa_id = v.empresa_id AND vp.variant_id = v.id
            AND vp.price_list_id = pc.price_list_id
            AND vp.vigencia_inicio <= CURRENT_TIMESTAMP
            AND (vp.vigencia_fim IS NULL OR vp.vigencia_fim > CURRENT_TIMESTAMP)
          ORDER BY vp.vigencia_inicio DESC
          LIMIT 1
       ) price ON true
       LEFT JOIN LATERAL (
         SELECT SUM(il.disponivel)::integer AS core_available,
                SUM(il.reservado)::integer AS core_reserved,
                SUM(il.comprometido)::integer AS core_committed,
                CASE WHEN BOOL_OR(loc.loja_id IS NULL) THEN 'global' ELSE 'store' END AS core_stock_scope
           FROM commerce_inventory_levels il
           JOIN commerce_inventory_locations loc
             ON loc.empresa_id = il.empresa_id AND loc.id = il.location_id
          WHERE il.empresa_id = v.empresa_id AND il.variant_id = v.id
            AND (loc.loja_id = $2 OR loc.loja_id IS NULL) AND loc.ativo = true
       ) stock ON true
      WHERE selected_storefront.empresa_id = $1
        AND selected_storefront.id = $3
        AND selected_storefront.status = 'active'
        AND selected_storefront.loja_id = $2
      ORDER BY li.legacy_key NULLS LAST, v.sku, v.id`,
    [selectedScope.empresaId, selectedScope.lojaId, selectedScope.storefrontId],
  );
  if (!Array.isArray(core?.rows)) throw scopeError('leitura Commerce incompleta', 'SOURCE_READ_FAILED');
  const readSources = Array.isArray(sources) ? sources : [{ name: 'legacy-revenda', items: Array.isArray(legacyProducts) ? legacyProducts : [] }];
  const report = compareScopedCatalog({
    sources: readSources,
    coreRows: core?.rows || [],
    scope: selectedScope,
  });
  report.commonRead = buildCommonCatalogRead({ sources: readSources, coreRows: core.rows, scope: selectedScope });
  return report;
}
