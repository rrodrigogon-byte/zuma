import test from 'node:test'
import assert from 'node:assert/strict'
import { avecPreviewPayload, avecRowToItem, avecScopeMatches, isAbortError, parseAvecCsv } from './avec-catalog-preview.js'

test('parser AVEC preserva EAN textual, custo zero e os campos da prévia', () => {
  const records = parseAvecCsv('id_origem,sku,ean,ncm,custo,unidade,nome\nAV-001,DINO-001,0012345678905,22030000,0,UN,Produto\n')
  const item = avecRowToItem(records[0])
  assert.equal(item.ean, '0012345678905')
  assert.equal(item.custo, '0')
  assert.equal(item.unidade, 'UN')
  assert.deepEqual(avecPreviewPayload('avec.csv', records), { source: 'avec', sourceLabel: 'avec.csv', items: [item] })
})

test('parser rejeita fórmula e cabeçalho duplicado', () => {
  assert.throws(() => parseAvecCsv('sku,sku\n=DINO-1,DINO-1\n'), /colunas duplicadas/)
  assert.throws(() => parseAvecCsv('sku,nome\n=DINO-1,Produto\n'), /fórmula/)
})

test('frontend só aceita resposta no escopo pedido e reconhece abort', () => {
  const scope = { empresaId: 'empresa', lojaId: 'loja', storefrontId: 'storefront', locationId: 'local' }
  assert.equal(avecScopeMatches({ scope }, scope), true)
  assert.equal(avecScopeMatches({ scope: { ...scope, locationId: 'outro-local' } }, scope), false)
  assert.equal(avecScopeMatches({}, scope), false)
  assert.equal(isAbortError(Object.assign(new Error('aborted'), { name: 'AbortError' })), true)
  assert.equal(isAbortError(new Error('falha')), false)
})

test('CSV brasileiro mantém decimal com vírgula e zeros de código como texto', () => {
  const records = parseAvecCsv('id_origem;sku;código barras;ncm;custo;unidade\nAV-1;SKU-1;0012345678905;22030000;12,50;UN\n')
  const item = avecRowToItem(records[0])
  assert.equal(item.custo, '12,50')
  assert.equal(item.ean, '0012345678905')
})

test('não descarta coluna excedente nem completa coluna ausente silenciosamente', () => {
  assert.throws(() => parseAvecCsv('sku,unidade\nA,UN,EXTRA\n'), /quantidade de colunas/)
  assert.throws(() => parseAvecCsv('sku,unidade\nA\n'), /quantidade de colunas/)
})
