import assert from 'node:assert/strict'
import test from 'node:test'
import { readSidebarCollapsed, SIDEBAR_COLLAPSE_KEY, writeSidebarCollapsed } from './layout-preferences.js'

function memoryStorage() {
  const values = new Map()
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null },
    setItem(key, value) { values.set(key, String(value)) },
  }
}

test('menu inicia expandido quando não existe preferência', () => {
  assert.equal(readSidebarCollapsed(memoryStorage()), false)
})

test('menu persiste recolhimento e reabertura', () => {
  const storage = memoryStorage()
  assert.equal(writeSidebarCollapsed(true, storage), true)
  assert.equal(storage.getItem(SIDEBAR_COLLAPSE_KEY), '1')
  assert.equal(readSidebarCollapsed(storage), true)
  assert.equal(writeSidebarCollapsed(false, storage), true)
  assert.equal(storage.getItem(SIDEBAR_COLLAPSE_KEY), '0')
  assert.equal(readSidebarCollapsed(storage), false)
})

test('falha de armazenamento não quebra a navegação', () => {
  const storage = { getItem() { throw new Error('bloqueado') }, setItem() { throw new Error('bloqueado') } }
  assert.equal(readSidebarCollapsed(storage), false)
  assert.equal(writeSidebarCollapsed(true, storage), false)
})
