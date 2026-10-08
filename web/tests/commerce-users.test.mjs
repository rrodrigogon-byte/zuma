import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import Renderer, { act } from 'react-test-renderer'
import { build } from 'esbuild'
import { mkdtempSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const web = dirname(dirname(fileURLToPath(import.meta.url)))
const temp = mkdtempSync(join(web, '.commerce-users-test-'))
after(() => rmSync(temp, { recursive: true, force: true }))
await build({ entryPoints: [join(web, 'src/pages/admin/CommerceUsersPanel.jsx')], outfile: join(temp, 'users.cjs'), bundle: true, format: 'cjs', platform: 'node', jsx: 'automatic', packages: 'external', plugins: [{ name: 'api-fixture', setup(builder) {
  builder.onResolve({ filter: /\/lib\/api$/ }, () => ({ path: 'api', namespace: 'fixture' }))
  builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const api={get:(...a)=>globalThis.usersApi.get(...a),post:(...a)=>globalThis.usersApi.post(...a),patch:(...a)=>globalThis.usersApi.patch(...a)}' }))
} }] })
const { default: Users, inviteErrorMessage, inviteStatusLabel } = createRequire(import.meta.url)(join(temp, 'users.cjs'))
const text = node => typeof node === 'string' ? node : (node?.children || []).map(text).join(' ')
const roles = [{ id: 'role-store', codigo: 'store_admin', nome: 'Operação da loja' }]

async function fixture({ state = { ready: true, items: [] }, candidates = [], onRefresh = async () => {} } = {}) {
  const posts = []
  globalThis.usersApi = {
    get: async path => path.includes('/candidates') ? { items: candidates } : state,
    post: (path, body) => new Promise((resolve, reject) => posts.push({ path, body, resolve, reject })),
  }
  let render
  await act(async () => { render = Renderer.create(React.createElement(Users, { roles, isDino: true, platformAdmin: true, empresaId: 'tenant', storefrontId: 'store', onRefresh })) })
  const button = label => render.root.findAllByType('button').find(node => text(node).includes(label))
  const click = async label => { await act(async () => button(label).props.onClick()) }
  const dialog = () => render.root.findByProps({ role: 'dialog' })
  const close = () => act(() => render.unmount())
  return { render, posts, button, click, dialog, close }
}

async function fillInvite(fixture) {
  await act(async () => {
    fixture.dialog().findAllByType('input')[0].props.onChange({ target: { value: 'Operador Sintético' } })
    fixture.dialog().findAllByType('input')[1].props.onChange({ target: { value: 'operator@example.invalid' } })
  })
}

test('erro de envio permanece visível DENTRO do diálogo e duplo submit não reenvia', async () => {
  const f = await fixture()
  try {
    await f.click('Convidar novo operador Dino'); await fillInvite(f)
    const submit = f.dialog().findByType('form').props.onSubmit
    await act(async () => { submit({ preventDefault() {} }); submit({ preventDefault() {} }) })
    assert.equal(f.posts.length, 1)
    await act(async () => f.posts[0].reject(Object.assign(new Error('recusado'), { code: 'MAIL_REJECTED' })))
    assert.match(text(f.dialog().findByProps({ role: 'alert' })), /Resend recusou/)
    assert.equal(f.posts.length, 1)
    assert.equal(f.dialog().findAllByType('input')[1].props.value, 'operator@example.invalid')
  } finally { f.close() }
})

test('canal não configurado desabilita o envio e explica variáveis no modal', async () => {
  const f = await fixture({ state: { ready: false, code: 'MAIL_NOT_CONFIGURED', items: [] } })
  try {
    await f.click('Convidar novo operador Dino')
    assert.match(text(f.dialog().findByProps({ role: 'alert' })), /RESEND_API_KEY e EMAIL_FROM/)
    assert.equal(f.button('Enviar convite pessoal').props.disabled, true)
    await act(async () => f.dialog().findByType('form').props.onSubmit({ preventDefault() {} }))
    assert.equal(f.posts.length, 0)
  } finally { f.close() }
})

test('busca usa o nome fornecido pelo contrato Commerce e erro de salvar fica no modal', async () => {
  const f = await fixture({ candidates: [{ id: 'user', nome: 'Nome do Contrato', email: 'existing@example.invalid' }] })
  try {
    await f.click('Adicionar acesso existente')
    await act(async () => f.dialog().findByProps({ type: 'search' }).props.onChange({ target: { value: 'Nome' } }))
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 350)) })
    assert.match(text(f.dialog()), /Nome do Contrato/)
    await act(async () => {
      const selects = f.dialog().findAllByType('select')
      selects[0].props.onChange({ target: { value: 'user' } })
      selects[2].props.onChange({ target: { value: 'role-store' } })
    })
    await act(async () => { f.dialog().findByType('form').props.onSubmit({ preventDefault() {} }) })
    await act(async () => f.posts[0].reject(new Error('usuário não encontrado no tenant')))
    assert.match(text(f.dialog().findByProps({ role: 'alert' })), /usuário não encontrado/)
  } finally { f.close() }
})

test('sucesso não vira falha de envio quando atualizar a lista falha', async () => {
  const f = await fixture({ onRefresh: async () => { throw new Error('refresh failed') } })
  try {
    await f.click('Convidar novo operador Dino'); await fillInvite(f)
    await act(async () => { f.dialog().findByType('form').props.onSubmit({ preventDefault() {} }) })
    await act(async () => f.posts[0].resolve({ ok: true, status: 'sent' }))
    assert.equal(f.render.root.findAllByProps({ role: 'dialog' }).length, 0)
    assert.match(text(f.render.toJSON()), /Convite aceito pelo provedor/)
    assert.match(text(f.render.root.findByProps({ role: 'alert' })), /não reenvie/)
  } finally { f.close() }
})

test('histórico diferencia convite enviado de aceite e não marca revogado como ativo', () => {
  assert.match(inviteStatusLabel({ status: 'sent', expires_at: new Date(Date.now() + 60000).toISOString() }), /aguardando o titular/)
  assert.match(inviteStatusLabel({ status: 'sent', expires_at: '2020-01-01' }), /Expirado/)
  assert.match(inviteStatusLabel({ status: 'revoked' }), /sem acesso/)
  assert.match(inviteErrorMessage({ code: 'IDENTITY_ALREADY_EXISTS' }), /painel legado/)
})

function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

test('refresh antigo não sobrescreve histórico mais recente', async () => {
  const f = await fixture()
  try {
    const old = deferred(), recent = deferred()
    let count = 0
    globalThis.usersApi.get = () => (++count === 1 ? old.promise : recent.promise)
    await act(async () => { f.button('Atualizar convites').props.onClick(); f.button('Atualizar convites').props.onClick() })
    await act(async () => recent.resolve({ ready: true, items: [{ id: 'new', nome: 'Convite recente', email: 'new@example.invalid', status: 'sent' }] }))
    await act(async () => old.resolve({ ready: true, items: [] }))
    assert.match(text(f.render.toJSON()), /Convite recente/)
  } finally { f.close() }
})

test('resposta tardia da empresa anterior não aparece na empresa selecionada', async () => {
  const f = await fixture()
  try {
    const old = deferred()
    globalThis.usersApi.get = path => path.includes('empresaId=tenant') ? old.promise : Promise.resolve({ ready: true, items: [{ id: 'b', nome: 'Titular Empresa B', status: 'sent' }] })
    await act(async () => { f.button('Atualizar convites').props.onClick() })
    await act(async () => f.render.update(React.createElement(Users, { roles, isDino: true, empresaId: 'company-b', storefrontId: 'store-b' })))
    await act(async () => old.resolve({ ready: true, items: [{ id: 'a', nome: 'Titular Empresa A', status: 'sent' }] }))
    assert.match(text(f.render.toJSON()), /Titular Empresa B/)
    assert.doesNotMatch(text(f.render.toJSON()), /Titular Empresa A/)
  } finally { f.close() }
})
