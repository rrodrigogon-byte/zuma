import React from 'react'
import { act, create } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import BarbeariaAtendimentoBoard from './BarbeariaAtendimentoBoard'

vi.mock('../../lib/api', () => ({
  fmtR: (value) => `R$ ${Number(value || 0).toFixed(2)}`,
}))

vi.mock('../../lib/barbearia-calendar', () => ({
  hojeAgenda: () => '2026-10-24',
}))

const agendamentosFixture = [
  {
    id: 'ag-1',
    dataHora: '2026-10-24T10:00:00-04:00',
    clienteNome: 'João Silva',
    clienteTelefone: '65999990001',
    servicoNome: 'Corte Degradê',
    servicoId: 'srv-1',
    profissionalNome: 'Carlos Barbeiro',
    profissionalId: 'prof-1',
    duracaoMinutos: 30,
    valor: 50,
    status: 'agendado',
  },
  {
    id: 'ag-2',
    dataHora: '2026-10-24T10:30:00-04:00',
    clienteNome: 'Pedro Santos',
    clienteTelefone: '65999990002',
    servicoNome: 'Barba Terapia',
    servicoId: 'srv-2',
    profissionalNome: 'Marcos Barbeiro',
    profissionalId: 'prof-2',
    duracaoMinutos: 45,
    valor: 40,
    status: 'confirmado',
  },
  {
    id: 'ag-3',
    dataHora: '2026-10-24T11:00:00-04:00',
    clienteNome: 'Lucas Oliveira',
    clienteTelefone: '65999990003',
    servicoNome: 'Combo Corte + Barba',
    servicoId: 'srv-3',
    profissionalNome: 'Carlos Barbeiro',
    profissionalId: 'prof-1',
    duracaoMinutos: 60,
    valor: 85,
    status: 'em_atendimento',
  },
  {
    id: 'ag-4',
    dataHora: '2026-10-24T09:00:00-04:00',
    clienteNome: 'Rafael Souza',
    clienteTelefone: '65999990004',
    servicoNome: 'Corte Tradicional',
    servicoId: 'srv-1',
    profissionalNome: 'Carlos Barbeiro',
    profissionalId: 'prof-1',
    duracaoMinutos: 30,
    valor: 45,
    status: 'concluido',
  },
]

const profissionaisFixture = [
  { id: 'prof-1', nome: 'Carlos Barbeiro', ativo: true },
  { id: 'prof-2', nome: 'Marcos Barbeiro', ativo: true },
]

const comandasFixture = [
  {
    id: 'com-1',
    agendamentoId: 'ag-3',
    status: 'aberta',
    total: 85,
    saldoPendente: 85,
  },
  {
    id: 'com-2',
    agendamentoId: 'ag-4',
    status: 'paga',
    total: 45,
    saldoPendente: 0,
  },
]

let renderer
const tick = () => new Promise((r) => setTimeout(r, 0))
const allText = (node) =>
  typeof node === 'string' || typeof node === 'number'
    ? String(node)
    : Array.isArray(node)
    ? node.map(allText).join(' ')
    : Array.isArray(node?.children)
    ? node.children.map(allText).join(' ')
    : node?.props?.children
    ? allText(node.props.children)
    : ''

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
})

afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount())
  renderer = null
})

describe('BarbeariaAtendimentoBoard', () => {
  it('renderiza as 4 colunas principais do Kanban e resumo KPI', async () => {
    await act(async () => {
      renderer = create(
        <BarbeariaAtendimentoBoard
          dataSelecionada="2026-10-24"
          onDateChange={vi.fn()}
          agendamentos={agendamentosFixture}
          profissionais={profissionaisFixture}
          comandas={comandasFixture}
          onStatusChange={vi.fn()}
        />
      )
      await tick()
    })

    const texto = allText(renderer.toJSON())
    expect(texto).toContain('Quadro de Atendimento Dinâmico')
    expect(texto).toContain('Agendado')
    expect(texto).toContain('Confirmado')
    expect(texto).toContain('Em Atendimento')
    expect(texto).toContain('Concluído')
    expect(texto).toContain('João Silva')
    expect(texto).toContain('Pedro Santos')
    expect(texto).toContain('Lucas Oliveira')
    expect(texto).toContain('Rafael Souza')
  })

  it('exibe botões de transição rápida no fluxo de atendimento', async () => {
    const onStatusChange = vi.fn()
    await act(async () => {
      renderer = create(
        <BarbeariaAtendimentoBoard
          dataSelecionada="2026-10-24"
          onDateChange={vi.fn()}
          agendamentos={agendamentosFixture}
          profissionais={profissionaisFixture}
          comandas={comandasFixture}
          onStatusChange={onStatusChange}
        />
      )
      await tick()
    })

    const texto = allText(renderer.toJSON())
    expect(texto).toContain('Confirmar')
    expect(texto).toContain('Iniciar atendimento')
    expect(texto).toContain('Concluir serviço')
  })

  it('permite alternar para o modo lista compacta', async () => {
    await act(async () => {
      renderer = create(
        <BarbeariaAtendimentoBoard
          dataSelecionada="2026-10-24"
          onDateChange={vi.fn()}
          agendamentos={agendamentosFixture}
          profissionais={profissionaisFixture}
          comandas={comandasFixture}
        />
      )
      await tick()
    })

    const botoes = renderer.root.findAllByType('button')
    const btnLista = botoes.find((b) => allText(b).includes('Ver em Lista'))
    expect(btnLista).toBeDefined()

    await act(async () => {
      btnLista.props.onClick()
      await tick()
    })

    const textoDepois = allText(renderer.toJSON())
    expect(textoDepois).toContain('Ver em Kanban')
  })

  it('filtra cards ao digitar no campo de busca', async () => {
    await act(async () => {
      renderer = create(
        <BarbeariaAtendimentoBoard
          dataSelecionada="2026-10-24"
          onDateChange={vi.fn()}
          agendamentos={agendamentosFixture}
          profissionais={profissionaisFixture}
          comandas={comandasFixture}
        />
      )
      await tick()
    })

    const inputBusca = renderer.root.findByProps({
      className: 'atendimento-search-input',
    })

    await act(async () => {
      inputBusca.props.onChange({ target: { value: 'Pedro' } })
      await tick()
    })

    const texto = allText(renderer.toJSON())
    expect(texto).toContain('Pedro Santos')
    expect(texto).not.toContain('João Silva')
  })

  it('filtra por profissional ao clicar na pílula correspondente', async () => {
    await act(async () => {
      renderer = create(
        <BarbeariaAtendimentoBoard
          dataSelecionada="2026-10-24"
          onDateChange={vi.fn()}
          agendamentos={agendamentosFixture}
          profissionais={profissionaisFixture}
          comandas={comandasFixture}
        />
      )
      await tick()
    })

    const botoes = renderer.root.findAllByType('button')
    const pillMarcos = botoes.find((b) => allText(b).includes('Marcos Barbeiro'))
    expect(pillMarcos).toBeDefined()

    await act(async () => {
      pillMarcos.props.onClick()
      await tick()
    })

    const texto = allText(renderer.toJSON())
    expect(texto).toContain('Pedro Santos')
    expect(texto).not.toContain('João Silva')
  })
})
