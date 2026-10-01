import assert from 'node:assert/strict'
import test from 'node:test'
import { fmtMoney, parseCurrencyInput } from './currency.js'

test('fmtMoney formata reais com R$, milhar por ponto e centavos por vírgula', () => {
  assert.equal(fmtMoney(2600, 'BRL'), 'R$ 2.600,00')
  assert.equal(fmtMoney('117750.5', 'BRL'), 'R$ 117.750,50')
})

test('fmtMoney formata dólares com $, milhar por vírgula e centavos por ponto', () => {
  assert.equal(fmtMoney(2600, 'USD'), '$2,600.00')
  assert.equal(fmtMoney('117750.5', 'USD'), '$117,750.50')
})

test('fmtMoney evita números corridos e neutraliza valores inválidos', () => {
  assert.equal(fmtMoney('not-a-number', 'BRL'), 'R$ 0,00')
  assert.equal(fmtMoney(undefined, 'USD'), '$0.00')
})

test('parseCurrencyInput aceita entradas BRL e USD sem alterar o valor numérico salvo', () => {
  assert.equal(parseCurrencyInput('2.600,50'), '2600.50')
  assert.equal(parseCurrencyInput('$2,600.50'), '2600.50')
  assert.equal(parseCurrencyInput('117750'), '117750')
  assert.equal(parseCurrencyInput(''), '')
})
