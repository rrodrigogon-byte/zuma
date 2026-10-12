import test from 'node:test'
import assert from 'node:assert/strict'
import { formatWhatsappPhone, outboundPresentation, linePresentation, statusRefreshInterval } from './whatsapp-view.js'

test('formata somente telefone brasileiro completo', () => {
  assert.equal(formatWhatsappPhone('5565999991234'), '+55 (65) 99999-1234')
  assert.equal(formatWhatsappPhone('+55 (65) 3333-1234'), '+55 (65) 3333-1234')
  assert.equal(formatWhatsappPhone('dino'), '')
  assert.equal(formatWhatsappPhone('65999991234'), '')
})

test('número identificado pelo backend tem prioridade e oferece cópia somente ao gestor', () => {
  const manager = linePresentation({ state: 'open', phoneNumber: '5565999991234', phoneReference: '5565888880000', phoneMasked: '5565•••••1234' })
  assert.equal(manager.value, '+55 (65) 99999-1234')
  assert.equal(manager.verified, true)
  assert.equal(manager.copy, '5565999991234')
  const staff = linePresentation({ state: 'open', phoneMasked: '5565•••••1234' })
  assert.equal(staff.value, '5565•••••1234')
  assert.equal(staff.copy, undefined)
})

test('referência manual nunca equivale a sessão verificada', () => {
  const manual = linePresentation({ state: 'open', phoneReference: '5565999991234' })
  assert.equal(manual.verified, false)
  assert.match(manual.source, /manual/)
  const offline = linePresentation({ state: 'close', phoneNumber: '5565999991234' })
  assert.equal(offline.value, 'Número não informado')
  assert.equal(offline.verified, false)
})

test('painel acelera consultas somente durante pareamento', () => {
  assert.equal(statusRefreshInterval('qr'), 5_000)
  assert.equal(statusRefreshInterval('connecting'), 5_000)
  assert.equal(statusRefreshInterval('open'), 30_000)
})


test('envio permanece pendente quando modo global está on, mas faltam travas da instância', () => {
  const connection = { state: 'open', saida: { modo: 'on' } }
  assert.equal(outboundPresentation(connection, null).ready, false)
  const titles = ['Empresa dona do número', 'Linha verificada', 'Saída das respostas']
  const ready = { conclusoes: titles.map(titulo => ({ titulo, ok: true })) }
  assert.equal(outboundPresentation(connection, ready).ready, true)
  assert.equal(outboundPresentation({ ...connection, state: 'qr' }, ready).ready, false)
  for (const title of titles) {
    assert.equal(outboundPresentation(connection, { conclusoes: ready.conclusoes.map(check => check.titulo === title ? { ...check, ok: false } : check) }).ready, false)
  }
  assert.equal(outboundPresentation({ ...connection, saida: { modo: 'off' } }, ready).ready, false)
});
