import { test } from 'node:test'
import assert from 'node:assert/strict'
import { destinoInicialDino, ehHostDino, ehHostLojaDino, ehHostBarbeariaDino, lojaDinoPorEndereco } from './dominios-dino.js'

test('domínios próprios da Dino', () => {
  assert.equal(destinoInicialDino('dinobarbearia.com.br'), '/agendar/dino')
  assert.equal(destinoInicialDino('WWW.DinoBarbearia.com.br'), '/agendar/dino')
  assert.equal(destinoInicialDino('dinoperfumaria.com.br'), '/perfumaria/dino')
  assert.equal(destinoInicialDino('www.dinoperfumaria.com.br'), '/perfumaria/dino')
  assert.equal(destinoInicialDino('dino.kytto.com.br'), null, 'domínio antigo segue pelo cadastro do storefront')
  assert.equal(destinoInicialDino('kytto.com.br'), null)
  assert.equal(destinoInicialDino('dinobarbearia.com.br.evil.test'), null)
  assert.equal(ehHostLojaDino('dino.kytto.com.br'), true)
  assert.equal(lojaDinoPorEndereco('dino.kytto.com.br'), false)
  assert.equal(ehHostBarbeariaDino('dinoperfumaria.com.br'), false)
  assert.equal(ehHostDino('loja.kytto.com.br'), false)
})
