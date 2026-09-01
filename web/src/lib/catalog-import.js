const MAX_ITEMS = 500

export function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  const source = String(text || '').replace(/^\uFEFF/, '')
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { field += '"'; index += 1 }
      else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === ',') { row.push(field); field = '' }
    else if (char === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (char !== '\r') field += char
  }
  if (quoted) throw new Error('O CSV possui uma célula entre aspas sem fechamento.')
  if (field || row.length) { row.push(field); rows.push(row) }
  const nonEmpty = rows.filter(values => values.some(value => String(value).trim()))
  if (nonEmpty.length < 2) throw new Error('O CSV deve conter cabeçalho e ao menos um produto.')
  const headers = nonEmpty[0].map(value => String(value).trim().toLowerCase())
  if (new Set(headers).size !== headers.length) throw new Error('O CSV possui colunas duplicadas no cabeçalho.')
  const records = nonEmpty.slice(1).map(values => Object.fromEntries(headers.map((header, index) => [header, String(values[index] || '').trim()])))
  if (records.length > MAX_ITEMS) throw new Error(`A importação aceita no máximo ${MAX_ITEMS} itens por lote.`)
  return records
}

function optionalMoney(value) {
  const text = String(value ?? '').trim()
  if (!text) return null
  const normalized = text.replace(/R\$/gi, '').replace(/\s/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.')
  const number = Number(normalized)
  if (!Number.isFinite(number) || number < 0) throw new Error(`Preço inválido: ${value}`)
  return Number(number.toFixed(2))
}

function optionalStock(value) {
  const text = String(value ?? '').trim()
  if (!text) return null
  const number = Number(text)
  if (!Number.isInteger(number) || number < 0) throw new Error(`Estoque inválido: ${value}`)
  return number
}

export function rowToItem(row, index = 0) {
  const sku = row.sku || row.sku_proposto || row.codigo
  const nome = row.nome || row.produto
  if (!sku || !nome) throw new Error(`Linha ${index + 2}: SKU e produto são obrigatórios.`)
  return {
    sku,
    nome,
    categoria: row.categoria || 'Sem categoria',
    preco: optionalMoney(row.preco ?? row.preco_brl ?? row.valor_de_venda),
    estoque: optionalStock(row.estoque ?? row.quantidade ?? row.quantidade_total ?? row.qtde_total),
    acao: row.acao || row.acao_proposta || row.status || 'rascunho',
    pendencia: row.pendencia || '',
    fonte: row.fonte || row.fontes || '',
  }
}

export { MAX_ITEMS, optionalMoney, optionalStock }
