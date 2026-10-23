import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { AREAS, CATALOGO, PLANO_IMPLANTACAO, catalogoPorArea, contagemPorEstado, estadoDoModulo, planoDaRota } from './catalogo-modulos.js'
import { EM_IMPLANTACAO } from './disponibilidade.js'

const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8')
const rotas = new Set([...app.matchAll(/path="([^"]+)"/g)].map((m) => m[1]))
const existe = (to) => {
  const p = String(to).split('?')[0]
  if (rotas.has(p)) return true
  // rotas com parâmetro (/admin/clube/:secao)
  return [...rotas].some((r) => r.includes(':') && new RegExp(`^${r.replace(/:[^/]+/g, '[^/]+')}$`).test(p))
}

test('todo módulo do catálogo aponta para uma tela que existe no App', () => {
  for (const item of CATALOGO) assert.equal(existe(item.to), true, item.to)
})

test('rotas e áreas do catálogo são únicas e conhecidas', () => {
  const vistas = new Set()
  for (const item of CATALOGO) {
    assert.equal(vistas.has(item.to), false, `repetida: ${item.to}`)
    vistas.add(item.to)
    assert.ok(AREAS.includes(item.area), item.area)
  }
})

test('cada tela em implantação está no catálogo e tem onda e o que falta', () => {
  assert.deepEqual(Object.keys(PLANO_IMPLANTACAO).sort(), Object.keys(EM_IMPLANTACAO).sort())
  for (const rota of Object.keys(EM_IMPLANTACAO)) {
    assert.ok(CATALOGO.some((item) => item.to === rota), rota)
    const plano = planoDaRota(`${rota}?aba=x`)
    assert.ok(plano.onda >= 1 && plano.onda <= 5, rota)
    assert.ok(plano.falta.length > 10, rota)
  }
})

test('estado: em implantação, evento, fora do contrato e no ar', () => {
  const item = (to) => CATALOGO.find((m) => m.to === to)
  assert.equal(estadoDoModulo(item('/admin/oficina')), 'em_implantacao')
  assert.equal(estadoDoModulo(item('/admin/supermercado')), 'no_ar')
  assert.equal(estadoDoModulo(item('/admin/torneios')), 'evento')
  assert.equal(estadoDoModulo(item('/admin/financeiro')), 'no_ar')
  assert.equal(estadoDoModulo(item('/admin/lojas')), 'no_ar')
  assert.equal(estadoDoModulo(item('/admin/notas')), 'homologacao', 'fiscal novo só em homologação')
  assert.equal(estadoDoModulo(item('/admin/financeiro'), { modulos: ['clube'] }), 'nao_contratado')
  assert.equal(estadoDoModulo(item('/admin/financeiro'), { modulos: ['Financeiro'] }), 'no_ar')
  // sem contrato definido, nada é marcado como fora do contrato
  assert.equal(estadoDoModulo(item('/admin/clube/alunos'), {}), 'no_ar')
})

test('agrupa por área na ordem das áreas e conta os estados', () => {
  const grupos = catalogoPorArea()
  assert.deepEqual(grupos.map((g) => g.area), AREAS.filter((a) => CATALOGO.some((i) => i.area === a)))
  const contagem = contagemPorEstado()
  assert.equal(Object.values(contagem).reduce((a, b) => a + b, 0), CATALOGO.length)
  assert.equal(contagem.em_implantacao, Object.keys(EM_IMPLANTACAO).length)
})
