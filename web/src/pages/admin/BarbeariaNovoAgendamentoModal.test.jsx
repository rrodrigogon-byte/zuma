import React from 'react'
import { act, create } from 'react-test-renderer'
import { describe, it, expect, vi } from 'vitest'
import BarbeariaNovoAgendamentoModal from './BarbeariaNovoAgendamentoModal'

function allText(root) {
  if (!root) return ''
  if (typeof root === 'string') return root
  if (Array.isArray(root)) return root.map(allText).join(' ')
  if (root.children) return allText(root.children)
  return ''
}

const clientesMock = [
  { id: 'c1', nome: 'Dino (Guilherme) Cunha', telefone: '65996722055' },
  { id: 'c2', nome: 'Rodrigo S', telefone: '65998080156' },
  { id: 'c3', nome: 'Rodrigo LG', telefone: '65996067163' },
  { id: 'c4', nome: 'Rodrigo Gorla', telefone: '66992087117' },
]

const profissionaisMock = [
  { id: 'p1', nome: 'João', ativo: true },
  { id: 'p2', nome: 'Natani', ativo: true },
  { id: 'p3', nome: 'Dino', ativo: true },
]

const servicosMock = [
  { id: 's1', nome: 'Barba Club', preco: 35, duracaoMinutos: 30, ativo: true },
  { id: 's2', nome: 'Corte Club', preco: 60, duracaoMinutos: 30, ativo: true },
]

describe('Central Dino — Modal Novo Agendamento Dinâmico', () => {
  it('renderiza o modal com busca de cliente por nome e telefone, e botão cadastrar cliente', () => {
    let renderer
    act(() => {
      renderer = create(
        <BarbeariaNovoAgendamentoModal
          aberto={true}
          onClose={vi.fn()}
          dataInicial="2026-10-24"
          horaInicial="16:00"
          clientes={clientesMock}
          profissionais={profissionaisMock}
          servicos={servicosMock}
          onSalvar={vi.fn()}
        />
      )
    })

    const text = allText(renderer.toJSON())
    expect(text).toContain('Novo agendamento')
    expect(text).toContain('Cliente:')
    expect(text).toContain('Nome')
    expect(text).toContain('Cadastrar Cliente')
    expect(text).toContain('Data:')
    expect(text).toContain('Recorrência...')
    expect(text).toContain('Barba Club')
    expect(text).toContain('Forçar Encaixe')
    expect(text).toContain('Adicionar serviço')
  })

  it('abre todos os clientes ao focar no campo de busca', () => {
    let renderer
    act(() => {
      renderer = create(
        <BarbeariaNovoAgendamentoModal
          aberto={true}
          onClose={vi.fn()}
          dataInicial="2026-10-24"
          horaInicial="16:00"
          clientes={clientesMock}
          profissionais={profissionaisMock}
          servicos={servicosMock}
          onSalvar={vi.fn()}
        />
      )
    })

    const root = renderer.root
    const inputBusca = root.findByProps({ className: 'bna-search-input' })

    // Simula clique/focus no campo
    act(() => {
      inputBusca.props.onFocus()
    })

    const textAposFocus = allText(renderer.toJSON())
    // Deve mostrar todos os clientes cadastrados imediatamente
    expect(textAposFocus).toContain('Dino (Guilherme) Cunha')
    expect(textAposFocus).toContain('Rodrigo S')
    expect(textAposFocus).toContain('Rodrigo LG')
    expect(textAposFocus).toContain('Rodrigo Gorla')
  })

  it('permite filtrar por nome e selecionar cliente', () => {
    let renderer
    act(() => {
      renderer = create(
        <BarbeariaNovoAgendamentoModal
          aberto={true}
          onClose={vi.fn()}
          dataInicial="2026-10-24"
          horaInicial="16:00"
          clientes={clientesMock}
          profissionais={profissionaisMock}
          servicos={servicosMock}
          onSalvar={vi.fn()}
        />
      )
    })

    const root = renderer.root
    const inputBusca = root.findByProps({ className: 'bna-search-input' })

    // Digita 'rodr'
    act(() => {
      inputBusca.props.onChange({ target: { value: 'rodr' } })
    })

    const text = allText(renderer.toJSON())
    expect(text).toContain('Rodrigo S')
    expect(text).toContain('Rodrigo LG')
    expect(text).toContain('Rodrigo Gorla')
    expect(text).not.toContain('Dino (Guilherme)')
  })

  it('permite buscar por telefone', () => {
    let renderer
    act(() => {
      renderer = create(
        <BarbeariaNovoAgendamentoModal
          aberto={true}
          onClose={vi.fn()}
          dataInicial="2026-10-24"
          horaInicial="16:00"
          clientes={clientesMock}
          profissionais={profissionaisMock}
          servicos={servicosMock}
          onSalvar={vi.fn()}
        />
      )
    })

    const root = renderer.root
    const selectTipo = root.findByProps({ className: 'bna-tipo-select' })
    const inputBusca = root.findByProps({ className: 'bna-search-input' })

    // Troca para Telefone
    act(() => {
      selectTipo.props.onChange({ target: { value: 'telefone' } })
    })

    // Digita telefone do Dino
    act(() => {
      inputBusca.props.onChange({ target: { value: '9967-22055' } })
    })

    const text = allText(renderer.toJSON())
    expect(text).toContain('Dino (Guilherme) Cunha')
    expect(text).not.toContain('Rodrigo S')
  })

  it('permite adicionar múltiplos serviços com horários encadeados e salvar', () => {
    const onSalvarMock = vi.fn()
    let renderer
    act(() => {
      renderer = create(
        <BarbeariaNovoAgendamentoModal
          aberto={true}
          onClose={vi.fn()}
          dataInicial="2026-10-24"
          horaInicial="16:00"
          clientes={clientesMock}
          profissionais={profissionaisMock}
          servicos={servicosMock}
          onSalvar={onSalvarMock}
        />
      )
    })

    const root = renderer.root

    // Seleciona primeiro cliente da lista
    const inputBusca = root.findByProps({ className: 'bna-search-input' })
    act(() => {
      inputBusca.props.onFocus()
    })
    const itensCli = root.findAll((el) => el.props.className && el.props.className.includes('bna-cliente-item'))
    const itemCli = itensCli[0]
    act(() => {
      itemCli.props.onClick()
    })

    // Clica em "Adicionar serviço"
    const btnAddServico = root.findByProps({ className: 'bna-btn-adicionar-servico' })
    act(() => {
      btnAddServico.props.onClick()
    })

    // Submete form
    const form = root.findByType('form')
    act(() => {
      form.props.onSubmit({ preventDefault: vi.fn() })
    })

    expect(onSalvarMock).toHaveBeenCalled()
    const payload = onSalvarMock.mock.calls[0][0]
    expect(payload.clienteNome).toBe('Dino (Guilherme) Cunha')
    expect(payload.dataAgenda).toBe('2026-10-24')
    expect(payload.linhasServicos.length).toBe(2)
    // Primeiro serviço: 16:00 às 16:30
    expect(payload.linhasServicos[0].horaInicio).toBe('16:00')
    expect(payload.linhasServicos[0].horaFim).toBe('16:30')
    // Segundo serviço: 16:30 às 17:00
    expect(payload.linhasServicos[1].horaInicio).toBe('16:30')
    expect(payload.linhasServicos[1].horaFim).toBe('17:00')
  })
})
