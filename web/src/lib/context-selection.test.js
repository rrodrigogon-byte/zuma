import assert from 'node:assert/strict'
import test from 'node:test'
import { lojasDaEmpresa, selecionarLojaAutomatica } from './context-selection.js'

const lojas = [
  { id: 'dino-matriz', empresaId: 'dino', nome: 'DINO-MATRIZ' },
  { id: 'agro-matriz', empresaId: 'agro', nome: 'AGRO OPEN TTC' },
  { id: 'agro-filial', empresaId: 'agro', nome: 'Filial Agro' },
  { id: 'inativa', empresaId: 'dino', nome: 'Inativa', ativa: false },
]

test('seleciona automaticamente a única unidade ativa da empresa', () => {
  assert.deepEqual(selecionarLojaAutomatica(lojas, 'dino'), lojas[0])
})

test('não escolhe automaticamente quando a empresa possui várias unidades', () => {
  assert.equal(selecionarLojaAutomatica(lojas, 'agro'), null)
})

test('preserva a unidade atual válida mesmo quando há várias unidades', () => {
  assert.deepEqual(selecionarLojaAutomatica(lojas, 'agro', lojas[2]), lojas[2])
})

test('ignora unidades inativas e nunca mistura empresas', () => {
  assert.deepEqual(lojasDaEmpresa(lojas, 'dino'), [lojas[0]])
  assert.equal(selecionarLojaAutomatica(lojas, 'ausente'), null)
})
