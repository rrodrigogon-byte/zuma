const SENSITIVE_KEYS = /password|senha|token|secret|credential|credencial|credenciais|certificat|certificado|apikey|privatekey|chaveprivada|dbpass|jwt|csc|cookie|authorization|^(?:cpf|nomecliente|clientenome|clientname|customername|telefone|phone|celular|email|observacoes|observations|cardnumber|cvv|cvc|pan|contabancaria|bankaccount|proto|constructor|prototype)$/i;
const record = value => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const normalizedKey = key => key.replace(/[\s_-]/g, '');
export function sensitiveGovernanceKey(key) { return SENSITIVE_KEYS.test(normalizedKey(key)); }
export function minimizedGovernanceTree(value, depth = 0) {
  if (depth > 12 || (typeof value === 'string' && value.length > 1000)) return false;
  if (Array.isArray(value)) return value.every(child => minimizedGovernanceTree(child, depth + 1));
  if (!record(value)) return true;
  return Object.entries(value).every(([key, child]) => !sensitiveGovernanceKey(key) && minimizedGovernanceTree(child, depth + 1));
}
const rootKeys = new Set(['source', 'contractVersion', 'category', 'sourceEstablishmentId', 'empresaId', 'lojaId', 'storefrontId', 'locationId', 'extractedAt', 'cutoff', 'rows', 'reviewScope', 'dataFormat', 'writerEnabled', 'apply', 'execute']);
const scopeKeys = new Set(['empresaId', 'lojaId']);
const formatKeys = new Set(['format', 'version']);
const mappingKeys = new Set(['from', 'to', 'declared']);
const inscriptionKeys = new Set(['state', 'value']);
const addressKeys = new Set(['cep', 'logradouro', 'numero', 'bairro', 'cidade', 'uf', 'complemento', 'municipioCodigo']);
const documentKeys = new Set(['authenticated', 'documentRef', 'digest']);
const fields = {
  products: ['sourceId', 'source_id', 'idOrigem', 'id_origem', 'avecId', 'avec_id', 'id', 'sku', 'codigo', 'cod', 'codigoProduto', 'codigo_produto', 'ean', 'gtin', 'barcode', 'codigoBarras', 'codigo_barras', 'ncm', 'NCM', 'custo', 'custoUnitario', 'custo_unitario', 'cost', 'custoNature', 'unidade', 'unidadeMedida', 'unidade_medida', 'unit', 'nome', 'produto', 'descricao', 'description', 'empresaId', 'empresa_id', 'tenantId', 'tenant_id', 'lojaId', 'loja_id', 'storeId', 'store_id', 'preco', 'price', 'estoque', 'stock', 'publicado', 'statusPublicacao'],
  fees: ['sourceId', 'acquirer', 'method', 'brand', 'installments', 'percent', 'fixedCents', 'anticipationMode', 'settlementDays', 'validFrom', 'validTo', 'contractRef', 'lojaId'],
  materials: ['sourceId', 'sourceServiceId', 'sourceProductId', 'quantity', 'consumptionUnit', 'referenceUnit', 'referenceQuantity', 'costCents', 'costEvidence', 'lojaId', 'serviceUnitConfirmed'],
  fiscal: ['cnpj', 'razaoSocial', 'nomeFantasia', 'inscricaoEstadual', 'inscricaoMunicipal', 'regime', 'regimeMapping', 'address', 'lojaId', 'empresaId', 'fiscalReviewConfirmed', 'reviewScope', 'fiscalReviewScope', 'dataFormat', 'sourceRef', 'documents'],
  agenda: ['sourceAppointmentId', 'sourceClientId', 'sourceProfessionalId', 'sourceServiceId', 'sourceSeriesId', 'lojaId', 'startAt', 'endAt', 'durationMinutes', 'timezone', 'status', 'individualEventVerified', 'originalIdsVerified'],
};
const sets = Object.fromEntries(Object.entries(fields).map(([key, values]) => [key, new Set(values)]));
function known(value, keys) { return !record(value) || Object.keys(value).every(key => keys.has(key)); }
function scalarValues(value) { return Object.values(value).every(child => child === null || ['string', 'boolean', 'number', 'undefined'].includes(typeof child)); }
function typedRecord(value, keys) { return !Array.isArray(value) && (!record(value) || (known(value, keys) && scalarValues(value))); }
function fiscalTree(row) {
  if (!typedRecord(row.address, addressKeys) || !typedRecord(row.inscricaoEstadual, inscriptionKeys) || !typedRecord(row.inscricaoMunicipal, inscriptionKeys)) return false;
  for (const value of [row.reviewScope, row.fiscalReviewScope]) if (!typedRecord(value, scopeKeys)) return false;
  if (!typedRecord(row.dataFormat, formatKeys) || !typedRecord(row.regimeMapping, mappingKeys) || !typedRecord(row.regime, mappingKeys)) return false;
  if (row.documents !== undefined) {
    const docs = Array.isArray(row.documents) ? row.documents : [row.documents];
    if (!docs.every(document => typedRecord(document, documentKeys))) return false;
  }
  return Object.entries(row).every(([key, value]) => ['address', 'inscricaoEstadual', 'inscricaoMunicipal', 'reviewScope', 'fiscalReviewScope', 'dataFormat', 'regimeMapping', 'regime', 'documents'].includes(key) || value === null || ['string', 'boolean', 'number', 'undefined'].includes(typeof value));
}
export function knownGovernanceSchema(input) {
  if (!record(input) || !known(input, rootKeys) || !sets[input.category] || !Array.isArray(input.rows)) return false;
  if (!typedRecord(input.reviewScope, scopeKeys) || !typedRecord(input.dataFormat, formatKeys)) return false;
  if (!Object.entries(input).every(([key, value]) => ['rows', 'reviewScope', 'dataFormat'].includes(key) || value === null || ['string', 'boolean', 'number', 'undefined'].includes(typeof value))) return false;
  return input.rows.every(row => record(row) && known(row, sets[input.category]) && (input.category === 'fiscal' ? fiscalTree(row) : scalarValues(row)));
}
export const AVEC_GOVERNANCE_FILE_LIMIT = 512 * 1024;
