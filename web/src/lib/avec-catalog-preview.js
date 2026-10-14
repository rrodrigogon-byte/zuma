const MAX_ITEMS = 500
const FORMULA_PREFIX = /^[=+\-@]/

function safeCell(value, field, line) {
  const result = String(value ?? '').trim()
  if (result && FORMULA_PREFIX.test(result)) throw new Error(`Linha ${line}: ${field} contém uma fórmula; exporte como texto.`)
  return result
}

export function parseAvecCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  const source = String(text || '').replace(/^\uFEFF/, '')
  let headerQuoted = false; let commas = 0; let semicolons = 0
  for (let i = 0; i < source.length; i += 1) {
    if (source[i] === '\n' && !headerQuoted) break
    if (source[i] === '"') { if (headerQuoted && source[i + 1] === '"') i += 1; else headerQuoted = !headerQuoted }
    else if (!headerQuoted && source[i] === ',') commas += 1
    else if (!headerQuoted && source[i] === ';') semicolons += 1
  }
  const delimiter = semicolons > commas ? ';' : ','
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { field += '"'; index += 1 }
      else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === delimiter) { row.push(field); field = '' }
    else if (char === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (char !== '\r') field += char
  }
  if (quoted) throw new Error('O CSV possui uma célula entre aspas sem fechamento.')
  if (field || row.length) { row.push(field); rows.push(row) }
  const nonEmpty = rows.filter(values => values.some(value => String(value).trim()))
  if (nonEmpty.length < 2) throw new Error('O CSV AVEC deve conter cabeçalho e ao menos um item.')
  const headers = nonEmpty[0].map(value => String(value).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_'))
  if (headers.some(header => !header || FORMULA_PREFIX.test(header))) throw new Error('O cabeçalho contém uma fórmula ou coluna vazia.')
  if (new Set(headers).size !== headers.length) throw new Error('O CSV AVEC possui colunas duplicadas no cabeçalho.')
  nonEmpty.slice(1).forEach((values, index) => { if (values.length !== headers.length) throw new Error(`Linha ${index + 2}: quantidade de colunas difere do cabeçalho.`) })
  const records = nonEmpty.slice(1).map((values, index) => Object.fromEntries(headers.map((header, column) => [header, safeCell(values[column], header, index + 2)])))
  if (records.length > MAX_ITEMS) throw new Error(`A prévia AVEC aceita no máximo ${MAX_ITEMS} itens.`)
  return records
}

export function avecRowToItem(row, index = 0) {
  const sourceId = row.id_origem || row.idorigem || row.avec_id || row.avecid || row.source_id || row.sourceid || row.id
  const sku = row.sku || row.codigo || row.cod || row.codigo_produto || row.codigoproduto
  const ean = row.ean || row.gtin || row.barcode || row.codigo_barras || row.codigobarras
  const ncm = row.ncm
  const custo = row.custo ?? row.custo_unitario ?? row.cost
  const unidade = row.unidade || row.unidade_medida || row.unidademedida || row.unit
  const nome = row.nome || row.produto || row.descricao || row.description
  if (!sourceId && !sku && !ean) throw new Error(`Linha ${index + 2}: informe id_origem, SKU ou EAN.`)
  if (!unidade) throw new Error(`Linha ${index + 2}: unidade é obrigatória para comparar o item.`)
  return { sourceId, sku, ean, ncm, custo, unidade, nome }
}

export function avecPreviewPayload(fileName, records) {
  return { source: 'avec', sourceLabel: fileName || 'export AVEC', items: records.map(avecRowToItem) }
}

export function avecScopeMatches(response, requested = {}) {
  const returned = response?.scope
  if (!returned || typeof returned !== 'object') return false
  return ['empresaId', 'lojaId', 'storefrontId', 'locationId'].every(key => String(returned[key] ?? '') === String(requested[key] ?? ''))
}

export function isAbortError(error) {
  return error?.name === 'AbortError' || error?.code === 'ABORT_ERR'
}

export { MAX_ITEMS }

export function validAvecPreview(response) {
  if (response?.mode !== 'read-only-avec-catalog-preview' || response?.write?.performed !== false || !/^[0-9a-f]{64}$/i.test(response?.datasetHash || '') || !Array.isArray(response?.items)) return false
  const summary = response.summary
  if (!summary || !['total', 'proposable', 'conflict', 'ambiguous', 'absent', 'noChange', 'costMissing', 'costZero'].every(key => Number.isInteger(summary[key]) && summary[key] >= 0 && summary[key] <= MAX_ITEMS)) return false
  if (summary.total !== response.items.length || summary.proposable + summary.conflict + summary.ambiguous + summary.absent !== summary.total || summary.noChange > summary.proposable || summary.costMissing + summary.costZero > summary.total) return false
  return response.items.every(item => item && ['proposable', 'conflict', 'ambiguous', 'absent'].includes(item.status) && Array.isArray(item.reasons) && item.reasons.every(value => typeof value === 'string') && ['sourceId', 'sku', 'ean', 'ncm', 'unidade'].every(key => item[key] == null || typeof item[key] === 'string') && typeof item.custoInformado === 'boolean' && (item.custoCents == null || (Number.isSafeInteger(item.custoCents) && item.custoCents >= 0)))
}
