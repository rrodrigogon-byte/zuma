import test from 'node:test'
import assert from 'node:assert/strict'
import { avecMixReportLink, readAvecMixFilters, selectAvecMixRows } from './avec-mix-report.js'
test('link do mix conserva o período civil inclusive e o tipo, incluindo virada de ano', () => {
  const path = avecMixReportLink({ selectedFrom: '2025-12-01', selectedToExclusive: '2026-01-01' }, 'products')
  const query = new URL(path, 'https://fixture.invalid').searchParams
  assert.deepEqual(readAvecMixFilters(query), { range: { inicio: '2025-12-01', fim: '2025-12-31' }, type: 'products' })
  assert.equal(avecMixReportLink(null), '/admin/avec-relatorio')
  assert.equal(readAvecMixFilters('?tipo=inventado').type, '')
})
test('filtro de tipo separa produtos e pacotes sem alterar a base original ou os valores', () => {
  const rows = [{type:'services',value:100},{type:'products',value:50},{type:'plans',value:200},{type:'tips',value:5}]
  assert.deepEqual(selectAvecMixRows(rows,'products'),[rows[1]])
  assert.deepEqual(selectAvecMixRows(rows,'plans'),[rows[2]])
  assert.equal(selectAvecMixRows(rows).reduce((sum,row)=>sum+row.value,0),355)
  assert.equal(rows.length,4)
  assert.deepEqual(selectAvecMixRows(undefined,'products'),[])
})
