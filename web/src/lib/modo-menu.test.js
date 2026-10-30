import test from 'node:test'
import assert from 'node:assert/strict'
import { LARGURA_MENU_GAVETA, menuEmGaveta } from './modo-menu.js'

const janela = (innerWidth, semMouse = false) => ({ innerWidth, matchMedia: (q) => ({ matches: q === '(hover: none)' && semMouse }) })

test('computador com mouse: menu recolhido que abre ao passar o mouse', () => {
  assert.equal(menuEmGaveta(janela(1440)), false)
  assert.equal(menuEmGaveta(janela(LARGURA_MENU_GAVETA)), false)
})

test('celular e tela estreita: gaveta pelo botão', () => {
  assert.equal(menuEmGaveta(janela(390)), true)
  assert.equal(menuEmGaveta(janela(LARGURA_MENU_GAVETA - 1)), true)
})

test('iPad deitado (tela larga, sem mouse): gaveta, nunca preso aberto por cima da tela', () => {
  assert.equal(menuEmGaveta(janela(1180, true)), true)
})

test('sem window ou matchMedia quebrado não derruba a tela', () => {
  assert.equal(menuEmGaveta(null), false)
  assert.equal(menuEmGaveta({ innerWidth: 1300, matchMedia: () => { throw new Error('x') } }), false)
})
