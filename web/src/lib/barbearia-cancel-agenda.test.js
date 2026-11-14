import test from 'node:test'
import assert from 'node:assert/strict'
import { filtrarAgenda, isStatusCancelado, isItemCancelado } from './barbearia-calendar.js'

test('Cenário Barbearia Dino: agendamento cancelado não aparece na agenda e não gera falso encaixe', () => {
  // Simulação dos agendamentos da captura de tela da Dino Barbearia:
  // Bruno tem corte premium às 17:30 (45min) que foi cancelado.
  // Carlos Silva Cruz agendou às 18:00.
  const agendamentoCancelado = {
    id: 'ag-dino-1730',
    clienteNome: 'CORTE PREMIUM',
    servicoNome: 'Corte Tradicional',
    profissionalId: 'prof-bruno',
    profissionalNome: 'Bruno',
    dataAgenda: '2026-11-13',
    horaLocal: '17:30',
    duracao: 45,
    status: 'cancelado',
  }

  const agendamentoCarlos = {
    id: 'ag-dino-1800',
    clienteNome: 'Carlos Silva Cruz',
    servicoNome: 'Corte e Barba',
    profissionalId: 'prof-bruno',
    profissionalNome: 'Bruno',
    dataAgenda: '2026-11-13',
    horaLocal: '18:00',
    duracao: 45,
    status: 'confirmado',
  }

  const todosItens = [agendamentoCancelado, agendamentoCarlos]

  // 1. O filtro da agenda deve excluir o cancelado por padrão
  const itensAgenda = filtrarAgenda(todosItens)
  assert.equal(itensAgenda.length, 1)
  assert.equal(itensAgenda[0].id, 'ag-dino-1800')
  assert.equal(itensAgenda[0].clienteNome, 'Carlos Silva Cruz')

  // 2. Simulação de processarItensEEncaixes com o cancelado filtrado
  function toMins(h) {
    const [hh, mm] = String(h).split(':').map(Number)
    return (hh || 0) * 60 + (mm || 0)
  }

  function processarItensEEncaixes(lista) {
    const agendamentos = lista.filter((item) => !item.isBloqueio && !isItemCancelado(item))
    for (const ag of agendamentos) {
      ag.isEncaixe = ag.encaixe === true
      ag.temColisao = false
    }
    for (let i = 0; i < agendamentos.length; i++) {
      const ag = agendamentos[i]
      const agIni = toMins(ag.horaLocal)
      const agFim = agIni + ag.duracao
      for (let j = i + 1; j < agendamentos.length; j++) {
        const outro = agendamentos[j]
        const outroIni = toMins(outro.horaLocal)
        const outroFim = outroIni + outro.duracao
        if (agIni < outroFim && agFim > outroIni) {
          ag.temColisao = true
          outro.temColisao = true
          outro.isEncaixe = true
        }
      }
    }
    return agendamentos
  }

  const processados = processarItensEEncaixes(todosItens)
  assert.equal(processados.length, 1)
  const carlos = processados[0]
  // Carlos NÃO pode ser marcado como encaixe porque o das 17:30 foi cancelado!
  assert.equal(carlos.isEncaixe, false, 'Carlos Silva Cruz não deve ser encaixe quando o anterior foi cancelado')
  assert.equal(carlos.temColisao, false, 'Carlos Silva Cruz não deve ter colisão com agendamento cancelado')

  // 3. Simulação da grade de horários simultâneos (slot 17:30 deve estar livre)
  const slotM = toMins('17:30')
  const itensOcupando1730 = todosItens.filter((item) => {
    if (!item.isBloqueio && isItemCancelado(item)) return false
    const iniM = toMins(item.horaLocal)
    const fimM = iniM + item.duracao
    return slotM >= iniM && slotM < fimM
  })

  assert.equal(itensOcupando1730.length, 0, 'O slot 17:30 deve estar 100% desocupado para novas marcações (+ Livre)')
})

test('Filtro de busca e visualização respeita cancelados quando explicitamente solicitado', () => {
  const lista = [
    { id: '1', clienteNome: 'João', status: 'confirmado' },
    { id: '2', clienteNome: 'Marcos', status: 'cancelado' },
    { id: '3', clienteNome: 'Pedro', status: 'cancelado_falta_confirmacao' },
    { id: '4', clienteNome: 'Lucas', status: 'nao_compareceu' },
  ]

  // Sem filtro: apenas ativos
  assert.deepEqual(filtrarAgenda(lista).map((i) => i.id), ['1'])

  // Filtro explícito de cancelados: traz os cancelados
  assert.deepEqual(filtrarAgenda(lista, { status: 'cancelado' }).map((i) => i.id), ['2'])

  // Flag explícita de incluirCancelados
  assert.deepEqual(filtrarAgenda(lista, { incluirCancelados: true }).map((i) => i.id), ['1', '2', '3', '4'])
})
