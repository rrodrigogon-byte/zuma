const currencyLocales = { BRL: 'pt-BR', USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB' }
const currencyFormatters = new Map()

function currencyFormatter(currency = 'BRL') {
  const code = String(currency || 'BRL').trim().toUpperCase()
  if (!currencyFormatters.has(code)) {
    currencyFormatters.set(code, new Intl.NumberFormat(currencyLocales[code] || 'en-US', { style: 'currency', currency: /^[A-Z]{3}$/.test(code) ? code : 'BRL' }))
  }
  return currencyFormatters.get(code)
}

function fmtMoney(value, currency = 'BRL') {
  const number = Number(value)
  return currencyFormatter(currency).format(Number.isFinite(number) ? number : 0)
}

function parseCurrencyInput(value) {
  const source = String(value ?? '').trim()
  const cleaned = source.replace(/[^0-9,.-]/g, '')
  if (!cleaned || cleaned === '-' || cleaned === ',' || cleaned === '.') return ''

  const negative = cleaned.startsWith('-')
  const unsigned = cleaned.replace(/-/g, '')
  const comma = unsigned.lastIndexOf(',')
  const dot = unsigned.lastIndexOf('.')
  let integer = unsigned
  let fraction = ''

  if (comma >= 0 && dot >= 0) {
    const decimalIndex = Math.max(comma, dot)
    integer = unsigned.slice(0, decimalIndex).replace(/[.,]/g, '')
    fraction = unsigned.slice(decimalIndex + 1).replace(/[.,]/g, '')
  } else if (comma >= 0 || dot >= 0) {
    const separator = comma >= 0 ? comma : dot
    const candidateFraction = unsigned.slice(separator + 1)
    if (candidateFraction.length <= 2) {
      integer = unsigned.slice(0, separator).replace(/[.,]/g, '')
      fraction = candidateFraction.replace(/[.,]/g, '')
    } else {
      integer = unsigned.replace(/[.,]/g, '')
    }
  } else {
    integer = unsigned
  }

  integer = integer.replace(/^0+(?=\d)/, '') || '0'
  return `${negative ? '-' : ''}${integer}${fraction ? `.${fraction.slice(0, 2)}` : ''}`
}

export { fmtMoney, parseCurrencyInput }
