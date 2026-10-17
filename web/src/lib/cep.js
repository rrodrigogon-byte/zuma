// Busca de CEP única para todas as telas (cadastro de empresa, endereço fiscal, cliente,
// checkout). Usa o resolvedor do servidor (/api/storefront/shipping/address/:cep), que
// consulta ViaCEP, OpenCEP, BrasilAPI e AwesomeAPI em paralelo, confere a UF pela faixa
// oficial dos Correios e guarda cada CEP confirmado no cache permanente do banco.
// Assim, qualquer CEP do Brasil responde igual em qualquer empresa.

export const CEP_LOOKUP_PATH = '/api/storefront/shipping/address'

export function cepDigits(value) {
  return String(value ?? '').replace(/\D/g, '').slice(0, 8)
}

export function formatCep(value) {
  const digits = cepDigits(value)
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
}

export function isCompleteCep(value) {
  return cepDigits(value).length === 8
}

/**
 * Junta o endereço encontrado ao formulário.
 * - Cidade, UF e código IBGE pertencem ao CEP: sempre vêm da consulta.
 * - Rua e bairro vêm da consulta quando ela traz; quando o CEP é geral da cidade
 *   (ex.: 78300-000), a consulta não traz rua nem bairro: o que a pessoa digitou fica
 *   se for da mesma cidade, e é limpo se a cidade mudou.
 * - Número e complemento nunca são apagados.
 * `fields` mapeia o nome do campo no formulário: { logradouro: 'street', ... };
 * false deixa o campo de fora (ex.: { cep: false } quando o formulário guarda o CEP sem máscara).
 */
function sameText(a, b) {
  const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
  return Boolean(norm(a)) && norm(a) === norm(b)
}

export function mergeCepAddress(current, found, fields = {}) {
  const key = name => fields[name] || name
  const next = { ...current }
  if (fields.cep !== false) next[key('cep')] = formatCep(found?.cep || current?.[key('cep')])
  // Mudou de cidade: a rua e o bairro digitados eram da cidade anterior.
  const sameCity = sameText(current?.[key('cidade')], found?.cidade) && sameText(current?.[key('estado')], found?.estado)
  if (found?.cidade && !sameCity) {
    for (const name of ['logradouro', 'bairro']) if (fields[name] !== false) next[key(name)] = ''
  }
  for (const name of ['cidade', 'estado', 'ibge']) {
    if (fields[name] === false) continue
    const value = found?.[name]
    if (value) next[key(name)] = name === 'estado' ? String(value).toUpperCase() : String(value)
  }
  for (const name of ['logradouro', 'bairro']) {
    if (fields[name] === false) continue
    const value = found?.[name]
    if (value) next[key(name)] = String(value)
  }
  return next
}

/** true quando o CEP é geral da cidade: veio cidade/UF mas não rua. */
export function isCityWideCep(found) {
  return Boolean(found?.cidade && found?.estado && !found?.logradouro)
}

/** Mensagem curta para mostrar ao lado do campo, a partir do resultado ou do erro. */
export function cepStatusMessage({ found = null, error = null } = {}) {
  if (error) {
    const code = error?.code || error?.data?.code || ''
    if (code === 'SHIPPING_CEP_NOT_FOUND' || error?.status === 404) return 'CEP não encontrado. Confira os números.'
    if (code === 'SHIPPING_CEP_INVALID') return 'O CEP precisa ter 8 dígitos.'
    return 'Não foi possível consultar o CEP agora. Preencha o endereço manualmente.'
  }
  if (!found) return ''
  if (isCityWideCep(found)) return `CEP geral de ${found.cidade}/${found.estado}: informe rua e bairro.`
  return `${found.cidade}/${found.estado} preenchido pelo CEP.`
}

export async function fetchCepAddress(value, { fetchImpl = (...args) => globalThis.fetch(...args), signal } = {}) {
  const cep = cepDigits(value)
  if (cep.length !== 8) {
    const error = new Error('O CEP precisa ter 8 dígitos.')
    error.code = 'SHIPPING_CEP_INVALID'
    throw error
  }
  const response = await fetchImpl(`${CEP_LOOKUP_PATH}/${cep}`, { headers: { Accept: 'application/json' }, signal })
  let body = null
  try { body = await response.json() } catch { body = null }
  if (!response.ok) {
    const error = new Error(body?.error || body?.message || 'Não foi possível consultar o CEP.')
    error.status = response.status
    error.code = body?.code || ''
    throw error
  }
  return body
}
