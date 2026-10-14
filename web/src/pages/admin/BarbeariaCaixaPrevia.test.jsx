import React from 'react'
import { act, create } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocked = vi.hoisted(() => ({ post: vi.fn() }))
vi.mock('../../lib/api', () => ({ api: { post: mocked.post }, fmtR: value => `VALOR ${value}` }))
import BarbeariaCaixaPrevia from './BarbeariaCaixaPrevia'
const props = { empresaId: 'tenant-a', lojaId: 'unit-a', servicos: [{ id: 'service-a', nome: 'Serviço fixture' }] }
const output = (escopo = { empresaId: 'tenant-a', lojaId: 'unit-a' }) => ({ somenteLeitura: true, gravacaoAplicada: false, escopo, status: 'pendente_revisao', planHash: 'fixture-hash', totais: { bruto: 100, taxa: null, material: null, liquido: null }, linhas: [], divergencias: [] })
let renderer
const tick = () => new Promise(r => setTimeout(r, 0))
const allText = node => typeof node === 'string' ? node : (node?.children || []).map(allText).join(' ')
async function mount(p = props) { await act(async () => { renderer = create(<BarbeariaCaixaPrevia {...p} />); await tick() }) }
async function submit() { await act(async () => { renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }); await tick() }) }
beforeEach(() => { mocked.post.mockReset(); globalThis.IS_REACT_ACT_ENVIRONMENT = true })
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = null })
describe('prévia taxas e materiais', () => {
  it('não consulta na abertura e botão não grava configuração', async () => {
    await mount()
    expect(mocked.post).not.toHaveBeenCalled()
    expect(allText(renderer.toJSON())).toContain('não cria cobrança')
    mocked.post.mockResolvedValue(output())
    await submit()
    expect(mocked.post).toHaveBeenCalledTimes(1)
    expect(mocked.post.mock.calls[0][0]).toBe('/api/admin/barbearia/caixa/previa-taxas-materiais')
    expect(mocked.post.mock.calls[0][1]).toMatchObject({ empresaId: 'tenant-a', lojaId: 'unit-a' })
    expect(allText(renderer.toJSON())).toContain('Pendente')
    expect(allText(renderer.toJSON())).toContain('gravação aplicada: não')
  })
  it('sem empresa/unidade não dispara requisição', async () => {
    await mount({ ...props, lojaId: '' })
    await submit()
    expect(mocked.post).not.toHaveBeenCalled()
    expect(allText(renderer.toJSON())).toContain('Selecione a empresa')
  })
  it('resultado de outra unidade é rejeitado', async () => {
    await mount()
    mocked.post.mockResolvedValue(output({ empresaId: 'tenant-a', lojaId: 'other-unit' }))
    await submit()
    expect(allText(renderer.toJSON())).toContain('não corresponde à prévia')
    expect(allText(renderer.toJSON())).not.toContain('fixture-hash')
  })
  it('troca empresa/unidade invalida resposta atrasada', async () => {
    let resolve
    mocked.post.mockReturnValue(new Promise(r => { resolve = r }))
    await mount()
    await submit()
    await act(async () => { renderer.update(<BarbeariaCaixaPrevia {...props} empresaId="tenant-b" lojaId="unit-b" />); await tick() })
    await act(async () => { resolve(output()); await tick() })
    expect(allText(renderer.toJSON())).not.toContain('fixture-hash')
  })
  it('editar plano invalida cálculo antigo e gira chave da próxima prévia', async () => {
    let resolve
    mocked.post.mockReturnValue(new Promise(r => { resolve = r }))
    await mount()
    await submit()
    const oldKey = mocked.post.mock.calls[0][1].idempotencyKey
    const input = renderer.root.findAllByType('input').find(i => i.props.placeholder === 'Zero explícito aceito')
    await act(async () => { input.props.onChange({ target: { value: '200' } }); await tick() })
    await act(async () => { resolve(output()); await tick() })
    expect(allText(renderer.toJSON())).not.toContain('fixture-hash')
    mocked.post.mockResolvedValue(output())
    await submit()
    expect(mocked.post.mock.calls[1][1].idempotencyKey).not.toBe(oldKey)
  })
  it('erro limpa resultado, permite nova tentativa e não simula sucesso', async () => {
    await mount()
    mocked.post.mockRejectedValue(new Error('Fixture indisponível'))
    await submit()
    expect(allText(renderer.toJSON())).toContain('Fixture indisponível')
    expect(allText(renderer.toJSON())).not.toContain('fixture-hash')
    expect(renderer.root.findAllByType('button').find(x => x.props.type === 'submit').props.disabled).toBe(false)
  })
})

it('editar a chave invalida resposta pendente', async () => {
  let resolve
  mocked.post.mockReturnValue(new Promise(r => { resolve = r }))
  await mount()
  await submit()
  const input = renderer.root.findAllByType('input').find(x => x.props.required)
  await act(async () => { input.props.onChange({ target: { value: 'nova-chave-fixture' } }); await tick() })
  await act(async () => { resolve(output()); await tick() })
  expect(allText(renderer.toJSON())).not.toContain('fixture-hash')
})
