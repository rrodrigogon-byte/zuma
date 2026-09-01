import test from 'node:test'
import assert from 'node:assert/strict'
import { parseCsv, rowToItem } from './catalog-import.js'

test('preserva vírgulas em células e converte preço/estoque', () => {
  const rows = parseCsv('sku,produto,categoria,preco_brl,quantidade_total,acao_proposta\nDINO-1,"Perfume, edição especial",Perfumes,"1.250,00",3,publicar\n')
  assert.equal(rows.length, 1)
  assert.deepEqual(rowToItem(rows[0], 0), {
    sku: 'DINO-1',
    nome: 'Perfume, edição especial',
    categoria: 'Perfumes',
    preco: 1250,
    estoque: 3,
    acao: 'publicar',
    pendencia: '',
    fonte: '',
  })
})

test('mantém preço e estoque ausentes como nulos', () => {
  const item = rowToItem(parseCsv('sku,produto,categoria,preco_brl,quantidade_total\nDINO-2,Produto pendente,Perfumes,,\n')[0], 0)
  assert.equal(item.preco, null)
  assert.equal(item.estoque, null)
})

test('rejeita aspas não fechadas e cabeçalhos duplicados', () => {
  assert.throws(() => parseCsv('sku,produto\nDINO-3,"Produto\n'), /sem fechamento/)
  assert.throws(() => parseCsv('sku,sku\nDINO-3,DINO-4\n'), /colunas duplicadas/)
})

test('rejeita estoque fracionário ou negativo', () => {
  assert.throws(() => rowToItem({ sku: 'DINO-4', produto: 'Produto', preco_brl: '10,00', quantidade_total: '1.5' }, 0), /Estoque inválido/)
  assert.throws(() => rowToItem({ sku: 'DINO-5', produto: 'Produto', preco_brl: '10,00', quantidade_total: '-1' }, 0), /Estoque inválido/)
})

test('exige SKU e nome do produto', () => {
  assert.throws(() => rowToItem({ sku: '', produto: '' }, 3), /Linha 5/)
})
