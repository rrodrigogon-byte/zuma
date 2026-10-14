import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const postcss = require('postcss')
const css = readFileSync(new URL('../pages/admin/ecommerce-admin.css', import.meta.url), 'utf8')
const marker = '/* Dino Commerce admin —'
const patch = css.slice(css.indexOf(marker))
const root = postcss.parse(patch)
function luminance(hex) {
  const channels = hex.replace('#', '').match(/../g).map(x => parseInt(x, 16) / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4)
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722
}
function contrast(a, b) { const values = [luminance(a), luminance(b)].sort((x, y) => y - x); return (values[0] + .05) / (values[1] + .05) }

test('identidade de catálogo só se aplica ao Commerce administrativo da Dino', () => {
  assert.ok(css.includes(marker))
  let count = 0
  root.walkRules(rule => {
    for (const selector of rule.selectors) {
      assert.match(selector, /^html\[data-brand='dino'\]/)
      assert.ok(selector.includes('.ecommerce-admin-shell'), selector)
      count++
    }
  })
  assert.ok(count > 20)
  assert.doesNotMatch(patch, /!important|pointer-events|display\s*:\s*none|visibility\s*:\s*hidden/)
})
test('cabeçalho, CTA e qualidade usam azul e dourado sem verde decorativo', () => {
  assert.match(patch, /--dino-admin-hero-start: #102B43/)
  assert.match(patch, /--dino-admin-hero-end: #204968/)
  assert.match(patch, /--dino-admin-gold: #E8C58E/)
  assert.match(patch, /\.commerce-product-quality\.complete>span i \{ background: var\(--gold\)/)
  assert.doesNotMatch(patch, /#(?:c8f169|112f27|1c4b3e|396d4e|8fcf41)/i)
})
test('modo escuro explícito e automático preservam escolha clara do usuário', () => {
  assert.match(patch, /prefers-color-scheme: dark/)
  assert.match(patch, /:not\(\[data-theme='light'\]\)/)
  assert.match(patch, /html\[data-brand='dino'\]\[data-theme='dark'\]/)
})
test('novos pares de cor de texto atingem WCAG AA 4.5:1', () => {
  for (const [fg, bg] of [['#FFFFFF','#204968'],['#E1EAF2','#204968'],['#E8C58E','#204968'],['#102B43','#E8C58E'],['#FFFFFF','#183B59'],['#FFFFFF','#245377'],['#183B59','#EAF0F6'],['#B3D0EA','#202F43'],['#151922','#B3D0EA'],['#76531B','#FFFFFF']]) {
    assert.ok(contrast(fg, bg) >= 4.5, `${fg}/${bg}: ${contrast(fg, bg).toFixed(2)}`)
  }
})
test('foco visível permanece distinguível e estados semânticos não são reclassificados', () => {
  assert.match(patch, /:focus-visible \{ outline: 3px solid var\(--focus-ring\)/)
  assert.match(patch, /\.commerce-product-hero :focus-visible/)
  assert.doesNotMatch(patch, /\.commerce-stock-pill\.(success|warning|danger)|\.commerce-product-status\.(published|draft|archived)/)
})
