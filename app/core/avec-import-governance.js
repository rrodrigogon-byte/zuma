import { db } from './database.js';
import { CommerceError } from './commerce-core.js';
import { validateAvecScope } from './avec-catalog-preview.js';
import { AvecGovernanceError, validateGovernanceInput, buildGovernanceResult } from './avec-import-governance-common.js';
import { analyzeAvecProducts } from './avec-import-products.js';
import { analyzeAvecFees } from './avec-import-fees.js';
import { analyzeAvecMaterials } from './avec-import-materials.js';
import { analyzeAvecFiscal } from './avec-import-fiscal.js';
import { analyzeAvecAgenda } from './avec-import-agenda.js';

const analyzers = Object.freeze({ products: analyzeAvecProducts, fees: analyzeAvecFees, materials: analyzeAvecMaterials, fiscal: analyzeAvecFiscal, agenda: analyzeAvecAgenda });

export function buildAvecGovernancePreview(input, context) {
  const scope = validateGovernanceInput(input, context);
  const rows = analyzers[input.category](input, scope);
  return buildGovernanceResult(input, scope, rows);
}

export async function previewAvecGovernance(context, input = {}) {
  try {
    validateGovernanceInput(input, context);
    // The same official catalog boundary validates tenant, explicit unit,
    // storefront and inventory location before processing any source data.
    const client = { query: (sql, values) => db.queryRead(sql, values) };
    const scope = await validateAvecScope(client, context, input);
    const result = buildAvecGovernancePreview(input, scope);
    result.scope = { ...result.scope, storefrontId: scope.storefrontId, locationId: scope.locationId };
    return result;
  } catch (error) {
    if (error instanceof AvecGovernanceError) throw new CommerceError('Contrato de preparação AVEC inválido; nenhuma gravação foi executada.', error.code);
    throw error;
  }
}
