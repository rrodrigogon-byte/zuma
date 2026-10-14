import React from 'react'
import { act, create } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ situacao: vi.fn(), ativar: vi.fn(), desativar: vi.fn(), testar: vi.fn() }))
vi.mock('../../lib/push-equipe', () => ({ situacaoPush: mock.situacao, ativarPush: mock.ativar, desativarPush: mock.desativar, testarPush: mock.testar }))
import { Avisos } from './ModoBarbeiro'
let ui
const tick = () => new Promise(r => setTimeout(r, 0))
const texto = () => JSON.stringify(ui.toJSON())
const botao = () => ui.root.findAllByType('button').find(b => b.props.children === 'Ligar avisos')
const pronto = { ok: true, ativo: false, motivo: 'permissao_pendente', chavePublica: 'fixture' }
async function mount(contexto = 'context-a') { await act(async () => { ui = create(<Avisos gestao={false} contexto={contexto} />); await tick() }) }
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; Object.values(mock).forEach(fn => fn.mockReset()); mock.situacao.mockResolvedValue(pronto); mock.ativar.mockResolvedValue(true) })
afterEach(async () => { if (ui) await act(async () => ui.unmount()); ui = null })
describe('Avisos do app da equipe', () => {
  it('não ativa no carregamento e só ativa por toque explícito', async () => {
    await mount(); expect(texto()).toContain('Toque em'); expect(mock.ativar).not.toHaveBeenCalled()
    await act(async () => { botao().props.onClick(); await tick() })
    expect(mock.ativar).toHaveBeenCalledTimes(1)
    expect(mock.ativar.mock.calls[0][0].ativo()).toBe(true)
  })
  it('sem configuração não oferece botão de ativação', async () => {
    mock.situacao.mockResolvedValue({ ok: false, motivo: 'servidor' }); await mount()
    expect(botao()).toBeUndefined(); expect(texto()).toContain('administração'); expect(mock.ativar).not.toHaveBeenCalled()
  })
  it('permissão negada mostra erro e libera o controle', async () => {
    mock.ativar.mockRejectedValue(new Error('Permissão recusada.')); await mount()
    await act(async () => { botao().props.onClick(); await tick() })
    expect(texto()).toContain('Permissão recusada'); expect(botao().props.disabled).toBe(false)
  })
  it('resposta de status antiga não substitui o novo contexto', async () => {
    let resolve; mock.situacao.mockReturnValueOnce(new Promise(r => { resolve = r })).mockResolvedValueOnce({ ok: false, motivo: 'servidor' })
    await mount(); await act(async () => { ui.update(<Avisos gestao={false} contexto="context-b" />); await tick(); resolve(pronto); await tick() })
    expect(texto()).toContain('administração'); expect(botao()).toBeUndefined()
  })
  it('desmontagem invalida ativação pendente e não dispara uma leitura nova', async () => {
    let resolve; mock.ativar.mockReturnValue(new Promise(r => { resolve = r })); await mount()
    await act(async () => { botao().props.onClick(); await tick() })
    const ativo = mock.ativar.mock.calls[0][0].ativo
    await act(async () => { ui.unmount(); ui = null; resolve(true); await tick() })
    expect(ativo()).toBe(false); expect(mock.situacao).toHaveBeenCalledTimes(1)
  })
  it('toques simultâneos não duplicam a assinatura', async () => {
    let resolve; mock.ativar.mockReturnValue(new Promise(r => { resolve = r })); await mount()
    const onClick = botao().props.onClick
    await act(async () => { onClick(); onClick(); await tick() })
    expect(mock.ativar).toHaveBeenCalledTimes(1)
    await act(async () => { resolve(true); await tick() })
  })
})
