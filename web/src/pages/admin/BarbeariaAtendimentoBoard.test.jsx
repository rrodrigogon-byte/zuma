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
    dataHora: '2026-10-24T14:00:00-04:00',
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

const servicosFixture = [
  { id: 'srv-1', nome: 'Corte Degradê', preco: 50, duracaoMinutos: 30, ativo: true },
  { id: 'srv-2', nome: 'Barba Terapia', preco: 40, duracaoMinutos: 45, ativo: true },
  { id: 'srv-3', nome: 'Combo Corte + Barba', preco: 85, duracaoMinutos: 60, ativo: true },
]

const produtosRevendaFixture = [
  { id: 'prod-1', nome: 'Pomada Efeito Seco', precoVenda: 45, estoqueAtual: 12 },
  { id: 'prod-2', nome: 'Óleo para Barba', precoVenda: 35, estoqueAtual: 8 },
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
          servicos={servicosFixture}
          produtosRevenda={produtosRevendaFixture}
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
          servicos={servicosFixture}
          produtosRevenda={produtosRevendaFixture}
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
          servicos={servicosFixture}
          produtosRevenda={produtosRevendaFixture}
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
          servicos={servicosFixture}
          produtosRevenda={produtosRevendaFixture}
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

  it('filtra por turno ao clicar na pílula correspondente', async () => {
    await act(async () => {
      renderer = create(
        <BarbeariaAtendimentoBoard
          dataSelecionada="2026-10-24"
          onDateChange={vi.fn()}
          agendamentos={agendamentosFixture}
          profissionais={profissionaisFixture}
          servicos={servicosFixture}
          produtosRevenda={produtosRevendaFixture}
          comandas={comandasFixture}
        />
      )
      await tick()
    })

    const botoes = renderer.root.findAllByType('button')
    const btnTarde = botoes.find((b) => allText(b).includes('Tarde'))
    expect(btnTarde).toBeDefined()

    await act(async () => {
      btnTarde.props.onClick()
      await tick()
    })

    const texto = allText(renderer.toJSON())
    expect(texto).toContain('Lucas Oliveira') // Agendado para as 14h
    expect(texto).not.toContain('João Silva') // Agendado para as 10h
  })

  it('alterna o botão de efeitos sonoros entre ligado e mudo', async () => {
    await act(async () => {
      renderer = create(
        <BarbeariaAtendimentoBoard
          dataSelecionada="2026-10-24"
          onDateChange={vi.fn()}
          agendamentos={agendamentosFixture}
          profissionais={profissionaisFixture}
          servicos={servicosFixture}
          produtosRevenda={produtosRevendaFixture}
          comandas={comandasFixture}
        />
      )
      await tick()
    })

    const btnSom = renderer.root.findByProps({ className: 'atendimento-sound-btn active' })
    expect(btnSom).toBeDefined()
    expect(allText(btnSom)).toContain('Som ligado')

    await act(async () => {
      btnSom.props.onClick()
      await tick()
    })

    const btnSomMudo = renderer.root.findByProps({ className: 'atendimento-sound-btn ' })
    expect(allText(btnSomMudo)).toContain('Mudo')
  })

  it('chama onRefresh ao clicar no botão Sincronizar', async () => {
    const onRefresh = vi.fn()
    await act(async () => {
      renderer = create(
        <BarbeariaAtendimentoBoard
          dataSelecionada="2026-10-24"
          onDateChange={vi.fn()}
          agendamentos={agendamentosFixture}
          profissionais={profissionaisFixture}
          servicos={servicosFixture}
          produtosRevenda={produtosRevendaFixture}
          comandas={comandasFixture}
          onRefresh={onRefresh}
        />
      )
      await tick()
    })

    const botoes = renderer.root.findAllByType('button')
    const btnSync = botoes.find((b) => allText(b).includes('Sincronizar'))
    expect(btnSync).toBeDefined()

    await act(async () => {
      btnSync.props.onClick()
      await tick()
    })

    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('abre o modal de Encaixe Rápido ao clicar no botão correspondente', async () => {
    const onCreateEncaixe = vi.fn()
    await act(async () => {
      renderer = create(
        <BarbeariaAtendimentoBoard
          dataSelecionada="2026-10-24"
          onDateChange={vi.fn()}
          agendamentos={agendamentosFixture}
          profissionais={profissionaisFixture}
          servicos={servicosFixture}
          produtosRevenda={produtosRevendaFixture}
          comandas={comandasFixture}
          onCreateEncaixe={onCreateEncaixe}
        />
      )
      await tick()
    })

    const botoes = renderer.root.findAllByType('button')
    const btnEncaixe = botoes.find((b) => allText(b).includes('+ Encaixe Rápido'))
    expect(btnEncaixe).toBeDefined()

    await act(async () => {
      btnEncaixe.props.onClick()
      await tick()
    })

    const textoModal = allText(renderer.toJSON())
    expect(textoModal).toContain('Encaixe Rápido de Cliente')
    expect(textoModal).toContain('Nome do cliente')
    expect(textoModal).toContain('Escolha o serviço')
    expect(textoModal).toContain('Confirmar encaixe')
  })
})
