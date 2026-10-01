function envEnabled(value) {
  return String(value || '').trim() === '1';
}

function blocked(res, status, code, error, details = {}) {
  return res.status(status).json({ ok: false, error, code, ...details });
}

export function createDestructiveAdminGuard(environment = process.env) {
  return function destructiveAdminGuard(req, res, next) {
    // Falha fechada: só libera em desenvolvimento ou teste declarados. NODE_ENV ausente ou
    // escrito errado ("prod", "Production ") não abre mais as operações destrutivas.
    if (['development', 'test'].includes(String(environment.NODE_ENV || '').trim().toLowerCase())) return next();
    console.warn('Operação administrativa destrutiva bloqueada em produção', {
      code: 'DESTRUCTIVE_OPERATION_DISABLED_IN_PRODUCTION',
      method: req.method,
      path: req.originalUrl || req.path,
      requestId: req.requestId || null,
    });
    return blocked(res, 403, 'DESTRUCTIVE_OPERATION_DISABLED_IN_PRODUCTION', 'Esta operação destrutiva é desabilitada em produção.');
  };
}

// Com o Commerce Core ativo, só o dinheiro da LOJA migrou para o Core. Inscrições, ingressos,
// reservas de quadra e mensalidades continuam no fluxo legado; bloqueá-los derrubava o Pix
// do evento. `tipoDoPedido(req)` diz de que é o pagamento; sem resolvedor, bloqueia tudo.
export function createLegacyPaymentMutationGuard(environment = process.env, { tipoDoPedido = null } = {}) {
  return function legacyPaymentMutationGuard(req, res, next) {
    if (!envEnabled(environment.COMMERCE_CORE_ENABLED)) return next();
    if (typeof tipoDoPedido === 'function') {
      let tipo = '';
      try { tipo = String(tipoDoPedido(req) || '').trim().toLowerCase(); } catch { tipo = ''; }
      if (tipo !== 'loja') return next();
    }
    console.warn('Mutação financeira legada bloqueada com Commerce Core ativo', {
      code: 'LEGACY_PAYMENT_MUTATION_DISABLED',
      method: req.method,
      path: req.originalUrl || req.path,
      requestId: req.requestId || null,
    });
    return blocked(res, 410, 'LEGACY_PAYMENT_MUTATION_DISABLED', 'O fluxo financeiro legado foi desativado. Use o checkout e a conciliação do Commerce Core.', {
      replacement: '/api/storefront/orders/:publicCode/payments',
    });
  };
}

export function createLegacyCommerceMutationGuard(environment = process.env) {
  return function legacyCommerceMutationGuard(req, res, next) {
    if (!envEnabled(environment.COMMERCE_CORE_ENABLED)) return next();
    console.warn('Mutação Commerce legada bloqueada com Commerce Core ativo', {
      code: 'LEGACY_COMMERCE_MUTATION_DISABLED',
      method: req.method,
      path: req.originalUrl || req.path,
      requestId: req.requestId || null,
    });
    return blocked(res, 410, 'LEGACY_COMMERCE_MUTATION_DISABLED', 'Este writer legado foi desativado. Use o fluxo tenant-scoped do Commerce Core.', {
      replacement: '/api/admin/commerce',
    });
  };
}

function normalizedKey(value) {
  return String(value || '').trim().toLowerCase();
}

function legacyProductKeys(product = {}) {
  return [...new Set([product.id, product.cod, product.codigo, product.nome].map(normalizedKey).filter(Boolean))];
}

export function compareLegacyAndCoreInventory({ legacyProducts = [], coreMappings = [] } = {}) {
  const mappingByLegacyKey = new Map();
  for (const row of coreMappings) {
    const key = normalizedKey(row.legacy_key || row.legacyKey);
    if (key) mappingByLegacyKey.set(key, row);
  }
  const items = [];
  let mapped = 0;
  let unmapped = 0;
  let divergent = 0;
  for (const product of legacyProducts) {
    const mapping = legacyProductKeys(product).map(key => mappingByLegacyKey.get(key)).find(Boolean) || null;
    const legacyAvailable = Number(product.estoque ?? product.estoqueAtual ?? product.qtd ?? 0);
    if (!mapping) {
      unmapped += 1;
      items.push({
        legacyKey: String(product.cod || product.codigo || product.id || '').slice(0, 180) || null,
        productName: String(product.nome || '').slice(0, 240) || null,
        status: 'unmapped',
        legacyAvailable: Number.isFinite(legacyAvailable) ? legacyAvailable : 0,
        coreAvailable: null,
        delta: null,
      });
      continue;
    }
    mapped += 1;
    const coreAvailable = Number(mapping.core_available ?? mapping.coreAvailable ?? 0);
    const safeLegacy = Number.isFinite(legacyAvailable) ? legacyAvailable : 0;
    const safeCore = Number.isFinite(coreAvailable) ? coreAvailable : 0;
    const delta = safeLegacy - safeCore;
    if (delta !== 0) divergent += 1;
    items.push({
      legacyKey: String(mapping.legacy_key || mapping.legacyKey || '').slice(0, 180) || null,
      productName: String(mapping.product_name || mapping.productName || product.nome || '').slice(0, 240) || null,
      status: delta === 0 ? 'aligned' : 'divergent',
      legacyAvailable: safeLegacy,
      coreAvailable: safeCore,
      delta,
    });
  }
  const missingLegacy = coreMappings.filter(row => !legacyProducts.some(product => legacyProductKeys(product).includes(normalizedKey(row.legacy_key || row.legacyKey))));
  for (const row of missingLegacy) {
    items.push({
      legacyKey: String(row.legacy_key || row.legacyKey || '').slice(0, 180) || null,
      productName: String(row.product_name || row.productName || '').slice(0, 240) || null,
      status: 'legacy_missing',
      legacyAvailable: null,
      coreAvailable: Number(row.core_available ?? row.coreAvailable ?? 0),
      delta: null,
    });
  }
  return {
    sourceOfTruth: 'commerce-core-postgresql',
    mode: 'read-only-observability',
    summary: {
      legacyProducts: legacyProducts.length,
      mapped,
      unmapped,
      divergent,
      legacyMissing: missingLegacy.length,
    },
    items: items.sort((a, b) => a.status.localeCompare(b.status) || String(a.productName || '').localeCompare(String(b.productName || ''))),
  };
}
