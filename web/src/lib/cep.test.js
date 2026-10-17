import test from 'node:test'
import assert from 'node:assert/strict'
import { CEP_LOOKUP_PATH, cepDigits, cepStatusMessage, fetchCepAddress, formatCep, isCityWideCep, isCompleteCep, mergeCepAddress } from './cep.js'

test('CEP aceita máscara e corta em 8 dígitos', () => {
  assert.equal(cepDigits('78.300-055'), '78300055')
  assert.equal(cepDigits('783000551234'), '78300055')
  assert.equal(formatCep('78300055'), '78300-055')
  assert.equal(formatCep('783'), '783')
  assert.equal(isCompleteCep('78300-05'), false)
  assert.equal(isCompleteCep('78300-055'), true)
})

test('CEP de rua preenche rua, bairro, cidade, UF e IBGE e mantém número e complemento', () => {
  const current = { cep: '78300055', logradouro: '', numero: '80W', complemento: 'Sala 2', bairro: '', cidade: '', estado: '', ibge: '' }
  const found = { cep: '78300055', logradouro: 'Rua Avelina Jaci Bohn', bairro: 'Jardim Acácia', cidade: 'Tangará da Serra', estado: 'mt', ibge: '5107958' }
  assert.deepEqual(mergeCepAddress(current, found), { cep: '78300-055', logradouro: 'Rua Avelina Jaci Bohn', numero: '80W', complemento: 'Sala 2', bairro: 'Jardim Acácia', cidade: 'Tangará da Serra', estado: 'MT', ibge: '5107958' })
})

test('CEP geral da cidade não apaga a rua digitada e pede rua e bairro', () => {
  const current = { cep: '78300000', logradouro: 'Rua das Flores', bairro: 'Centro', cidade: 'Tangara da Serra', estado: 'mt' }
  const found = { cep: '78300000', logradouro: null, bairro: null, cidade: 'Tangará da Serra', estado: 'MT', ibge: '5107958' }
  const next = mergeCepAddress(current, found)
  assert.equal(next.logradouro, 'Rua das Flores')
  assert.equal(next.bairro, 'Centro')
  assert.equal(next.cidade, 'Tangará da Serra')
  assert.equal(next.estado, 'MT')
  assert.equal(isCityWideCep(found), true)
  assert.match(cepStatusMessage({ found }), /CEP geral de Tangará da Serra\/MT: informe rua e bairro/)
})

test('nomes de campo do formulário podem ser mapeados e campos podem ser ignorados', () => {
  const next = mergeCepAddress({ postalCode: '', street: '', city: '', state: '' }, { cep: '01310100', logradouro: 'Avenida Paulista', bairro: 'Bela Vista', cidade: 'São Paulo', estado: 'SP', ibge: '3550308' }, { cep: 'postalCode', logradouro: 'street', bairro: 'district', cidade: 'city', estado: 'state', ibge: false })
  assert.deepEqual(next, { postalCode: '01310-100', street: 'Avenida Paulista', district: 'Bela Vista', city: 'São Paulo', state: 'SP' })
})

test('mensagens de erro em português', () => {
  assert.match(cepStatusMessage({ error: { code: 'SHIPPING_CEP_NOT_FOUND' } }), /CEP não encontrado/)
  assert.match(cepStatusMessage({ error: { status: 503 } }), /Preencha o endereço manualmente/)
  assert.match(cepStatusMessage({ error: { status: 404, code: 'STOREFRONT_NOT_FOUND' } }), /Preencha o endereço manualmente/)
})

test('consulta usa o resolvedor do servidor e devolve o código do erro', async () => {
  const calls = []
  const ok = await fetchCepAddress('78300-055', { fetchImpl: async url => { calls.push(url); return { ok: true, status: 200, json: async () => ({ cep: '78300055', cidade: 'Tangará da Serra', estado: 'MT' }) } } })
  assert.equal(calls[0], `${CEP_LOOKUP_PATH}/78300055`)
  assert.equal(ok.cidade, 'Tangará da Serra')
  await assert.rejects(
    () => fetchCepAddress('78000000', { fetchImpl: async () => ({ ok: false, status: 404, json: async () => ({ error: 'CEP não encontrado; confira os números', code: 'SHIPPING_CEP_NOT_FOUND' }) }) }),
    error => error.code === 'SHIPPING_CEP_NOT_FOUND' && error.status === 404,
  )
  await assert.rejects(() => fetchCepAddress('7830', { fetchImpl: async () => { throw new Error('não deveria consultar') } }), error => error.code === 'SHIPPING_CEP_INVALID')
})

test('trocar para o CEP geral de outra cidade limpa a rua e o bairro da cidade anterior', () => {
  const current = { cep: '01310-100', logradouro: 'Avenida Paulista', numero: '1000', bairro: 'Bela Vista', cidade: 'São Paulo', estado: 'SP' }
  const next = mergeCepAddress(current, { cep: '78300000', logradouro: null, bairro: null, cidade: 'Tangará da Serra', estado: 'MT' })
  assert.equal(next.logradouro, '')
  assert.equal(next.bairro, '')
  assert.equal(next.numero, '1000')
  assert.equal(next.cidade, 'Tangará da Serra')
})
