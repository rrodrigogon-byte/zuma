import { useState, useMemo } from 'react'
import { fmtDateOnly, fmtR } from '../../lib/api'

const moeda = (value) => fmtR(Number(value || 0))

function Kpi({ label, value, note, color = 'var(--accent)' }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, padding: 16 }}>
      <div style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      <strong style={{ display: 'block', marginTop: 8, color, fontSize: 24 }}>{value}</strong>
      {note && <small style={{ display: 'block', marginTop: 6, color: 'var(--muted)' }}>{note}</small>}
    </div>
  )
}

function statusLabel(status) {
  return ({
    aberto: 'Aberto',
    fechado: 'Fechado',
    recebimento: 'Recebimento',
    sangria: 'Sangria',
    suprimento: 'Suprimento',
    estorno_recebimento: 'Estorno de Recebimento',
    paga: 'Paga',
    em_conta: 'Em Conta',
    cancelada: 'Cancelada / Estornada',
    aberta: 'Aberta',
    aguardando_pagamento: 'Aguardando Pagamento',
  }[status] || status || '—')
}

const MOTIVOS_CANCELAMENTO = [
  'Erro de lançamento no caixa / valor incorreto',
  'Desistência ou solicitação do cliente',
  'Forma de pagamento registrada incorretamente',
  'Comanda lançada em duplicidade',
  'Troca de serviços ou profissional / refazer comanda',
  'Outro motivo (especificar abaixo)',
]

export default function BarbeariaOperacaoPanel({
  data,
  operacao = {},
  comandas: comandasProps = [],
  profissionais = [],
  onOpenComanda,
  onCancelarComandaFinalizada,
  onOpenCaixa,
  onMove,
  onClose,
  onCloseDay,
  onViewDay,
  salvando = false,
}) {
  const [formCaixa, setFormCaixa] = useState({ numeroCaixa: 1, valorAbertura: '', observacao: '', dataAbertura: '' })
  const [formMovimento, setFormMovimento] = useState({ tipo: 'suprimento', valor: '', descricao: '', dataMovimento: '' })
  const [formFechamento, setFormFechamento] = useState({ valorInformado: '', observacao: '', dataFechamento: '' })

  // Filtros e busca de comandas fechadas
  const [filtroCaixaId, setFiltroCaixaId] = useState('')
  const [filtroMeio, setFiltroMeio] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todas_fechadas')
  const [busca, setBusca] = useState('')
  const [comandaExpandida, setComandaExpandida] = useState({})

  // Modal do Procedimento de Cancelamento de Comanda Finalizada
  const [modalCancelamento, setModalCancelamento] = useState(null)
  const [motivoPredefinido, setMotivoPredefinido] = useState(MOTIVOS_CANCELAMENTO[0])
  const [motivoDetalhado, setMotivoDetalhado] = useState('')
  const [reabrirAgendamento, setReabrirAgendamento] = useState(false)
  const [processandoCancelamento, setProcessandoCancelamento] = useState(false)

  const caixaAberto = operacao.caixaAberto
  const caixas = operacao.caixas || []
  const movimentos = operacao.movimentos || []
  const resumo = operacao

  // Unifica comandas disponíveis (vindas de props ou do resumo da operação)
  const todasComandas = useMemo(() => {
    const lista = (operacao.comandas && operacao.comandas.length ? operacao.comandas : comandasProps) || []
    return lista
  }, [operacao.comandas, comandasProps])

  // Filtra comandas do caixa para exibição
  const comandasDoCaixa = useMemo(() => {
    return todasComandas.filter((comanda) => {
      // Por padrão foca nas que foram finalizadas ou canceladas
      const ehFechadaOuCancelada = ['paga', 'em_conta', 'cancelada'].includes(comanda.status) || comanda.estornada || (comanda.pagamentos && comanda.pagamentos.length > 0)
      if (filtroStatus === 'todas_fechadas' && !ehFechadaOuCancelada) return false
      if (filtroStatus === 'paga' && comanda.status !== 'paga') return false
      if (filtroStatus === 'em_conta' && comanda.status !== 'em_conta') return false
      if (filtroStatus === 'cancelada' && comanda.status !== 'cancelada' && !comanda.estornada) return false

      // Filtro por caixa específico
      if (filtroCaixaId) {
        const vinculadoAoCaixa = String(comanda.caixaId) === String(filtroCaixaId) ||
          (comanda.pagamentos || []).some((p) => String(p.caixaId) === String(filtroCaixaId))
        if (!vinculadoAoCaixa) return false
      }

      // Filtro por meio de pagamento
      if (filtroMeio) {
        const temMeio = (comanda.pagamentos || []).some((p) => String(p.meio || '').toLowerCase() === filtroMeio.toLowerCase())
        if (!temMeio) return false
      }

      // Busca textual por cliente, telefone, barbeiro ou ID
      if (busca.trim()) {
        const termo = busca.toLowerCase().trim()
        const matchCliente = String(comanda.clienteNome || '').toLowerCase().includes(termo)
        const matchTelefone = String(comanda.clienteTelefone || '').includes(termo)
        const matchProf = String(comanda.profissionalNome || '').toLowerCase().includes(termo)
        const matchId = String(comanda.id || '').toLowerCase().includes(termo)
        const matchItens = (comanda.itens || []).some((i) => String(i.nome || '').toLowerCase().includes(termo))
        if (!matchCliente && !matchTelefone && !matchProf && !matchId && !matchItens) return false
      }

      return true
    })
  }, [todasComandas, filtroStatus, filtroCaixaId, filtroMeio, busca])

  // Totais das comandas filtradas
  const totaisFiltrados = useMemo(() => {
    let totalFaturado = 0
    let totalDinheiro = 0
    let totalPix = 0
    let totalCartao = 0
    let totalConta = 0
    let pagasCount = 0
    let canceladasCount = 0

    for (const c of comandasDoCaixa) {
      if (c.status === 'cancelada' || c.estornada) {
        canceladasCount++
        continue
      }
      pagasCount++
      const valor = Number(c.totalFaturado ?? c.total ?? 0)
      totalFaturado += valor

      for (const p of c.pagamentos || []) {
        const v = Number(p.valor || 0)
        const m = String(p.meio || '').toLowerCase()
        if (m === 'dinheiro') totalDinheiro += v
        else if (m === 'pix') totalPix += v
        else if (m.includes('cartao') || m === 'credito' || m === 'debito') totalCartao += v
        else if (m === 'conta') totalConta += v
      }
    }

    return { totalFaturado, totalDinheiro, totalPix, totalCartao, totalConta, pagasCount, canceladasCount }
  }, [comandasDoCaixa])

  function toggleExpandir(id) {
    setComandaExpandida((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function abrirCaixa(event) {
    event.preventDefault()
    if (!window.confirm(`Confirmar abertura do caixa ${formCaixa.numeroCaixa}?`)) return
    let customDate = `${data}T12:00:00.000Z`
    if (formCaixa.dataAbertura) {
      customDate = new Date(formCaixa.dataAbertura).toISOString()
    }
    onOpenCaixa({
      ...formCaixa,
      numeroCaixa: Number(formCaixa.numeroCaixa),
      valorAbertura: Number(formCaixa.valorAbertura || 0),
      dataOperacao: customDate,
      abertoEm: formCaixa.dataAbertura ? customDate : undefined,
      confirmado: true,
    })
  }

  function registrarMovimento(event) {
    event.preventDefault()
    if (!caixaAberto) return
    if (!window.confirm(`Confirmar ${formMovimento.tipo === 'sangria' ? 'sangria' : 'suprimento'} de ${moeda(formMovimento.valor)}?`)) return
    let customDate = undefined
    if (formMovimento.dataMovimento) {
      customDate = new Date(formMovimento.dataMovimento).toISOString()
    }
    onMove(caixaAberto, { ...formMovimento, valor: Number(formMovimento.valor || 0), criadoEm: customDate, confirmado: true })
    setFormMovimento({ tipo: 'suprimento', valor: '', descricao: '', dataMovimento: '' })
  }

  function fecharCaixa(event) {
    event.preventDefault()
    if (!caixaAberto) return
    const valor = Number(formFechamento.valorInformado || 0)
    if (!window.confirm(`Confirmar fechamento do caixa ${caixaAberto.numeroCaixa} com valor contado de ${moeda(valor)}?`)) return
    let customDate = undefined
    if (formFechamento.dataFechamento) {
      customDate = new Date(formFechamento.dataFechamento).toISOString()
    }
    onClose(caixaAberto, { ...formFechamento, valorInformado: valor, fechadoEm: customDate, confirmado: true })
  }

  // Aciona o procedimento de cancelamento de comanda finalizada
  async function executarProcedimentoCancelamento(event) {
    event.preventDefault()
    if (!modalCancelamento) return
    const motivoFinal = motivoPredefinido === 'Outro motivo (especificar abaixo)'
      ? motivoDetalhado.trim()
      : `${motivoPredefinido}${motivoDetalhado.trim() ? ` — ${motivoDetalhado.trim()}` : ''}`

    if (!motivoFinal) {
      alert('Por favor, informe a justificativa para o cancelamento.')
      return
    }

    try {
      setProcessandoCancelamento(true)
      if (onCancelarComandaFinalizada) {
        await onCancelarComandaFinalizada(modalCancelamento, {
          motivo: motivoFinal,
          reabrirAgendamento,
          confirmado: true,
        })
      }
      setModalCancelamento(null)
      setMotivoDetalhado('')
    } catch (err) {
      alert(`Erro no cancelamento: ${err.message || 'Falha ao estornar comanda'}`)
    } finally {
      setProcessandoCancelamento(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Top Banner & KPIs */}
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <section style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 12%, var(--card)), var(--card))', border: '1px solid var(--line)', borderRadius: 16, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em' }}>Operação da unidade</div>
              <h2 style={{ margin: '6px 0 4px' }}>Abertura e fechamento do dia</h2>
              <p style={{ color: 'var(--muted)', margin: 0 }}>Controle de caixas, detalhamento de comandas recebidas e estornos auditáveis.</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <strong style={{ display: 'block', fontSize: 18 }}>{fmtDateOnly(data)}</strong>
              <small style={{ color: 'var(--muted)' }}>{resumo.lojaId ? `Unidade ${resumo.lojaId}` : 'Unidade da sessão'}</small>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 18 }}>
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: caixaAberto ? '#14b87a' : '#f59e0b' }} />
            <strong>{caixaAberto ? `Caixa ${caixaAberto.numeroCaixa} aberto` : 'Nenhum caixa aberto'}</strong>
            <span style={{ color: 'var(--muted)' }}>
              {caixaAberto ? `desde ${new Date(caixaAberto.abertoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Abra o caixa para iniciar a operação'}
            </span>
          </div>
        </section>
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 10 }}>
          <Kpi label="Recebido em dinheiro" value={moeda(resumo.recebimentosDinheiro)} note="Movimentos do caixa físico" color="#14b87a" />
          <Kpi label="Receita recebida" value={moeda(resumo.receitaRecebida)} note="Meios pagos (Dinheiro, PIX, Cartão)" color="#14b87a" />
          <Kpi label="Faturamento" value={moeda(resumo.faturamentoComandas)} note={`${resumo.comandasPagas || 0} comanda(s) faturada(s)`} />
          <Kpi label="Faturado em conta" value={moeda(resumo.faturadoEmConta)} note={`${resumo.emConta || 0} comanda(s) a receber`} color="#8b5cf6" />
        </section>
      </div>

      {/* Formulário de Abertura quando não há caixa aberto */}
      {!caixaAberto && (
        <section style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 18 }}>
          <div style={{ marginBottom: 14 }}>
            <h3 style={{ margin: 0 }}>Abrir caixa</h3>
            <p style={{ margin: '5px 0 0', color: 'var(--muted)' }}>A abertura cria o caixa operacional da empresa/unidade ativa.</p>
          </div>
          <form onSubmit={abrirCaixa} style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <label>
              <span style={labelStyle}>Número do caixa</span>
              <input type="number" min="1" value={formCaixa.numeroCaixa} onChange={(event) => setFormCaixa((atual) => ({ ...atual, numeroCaixa: event.target.value }))} style={inputStyle} />
            </label>
            <label>
              <span style={labelStyle}>Fundo de abertura (R$)</span>
              <input type="number" min="0" step="0.01" value={formCaixa.valorAbertura} onChange={(event) => setFormCaixa((atual) => ({ ...atual, valorAbertura: event.target.value }))} style={inputStyle} />
            </label>
            <label>
              <span style={labelStyle}>Data/Hora de abertura</span>
              <input type="datetime-local" value={formCaixa.dataAbertura} onChange={(event) => setFormCaixa((atual) => ({ ...atual, dataAbertura: event.target.value }))} style={inputStyle} />
            </label>
            <label>
              <span style={labelStyle}>Observação</span>
              <input value={formCaixa.observacao} onChange={(event) => setFormCaixa((atual) => ({ ...atual, observacao: event.target.value }))} style={inputStyle} placeholder="Ex.: turno da manhã" />
            </label>
            <button type="submit" disabled={salvando} style={{ ...primary, gridColumn: '1 / -1' }}>Confirmar abertura</button>
          </form>
        </section>
      )}

      {/* Operações com Caixa Aberto (Movimentar e Fechar) */}
      {caixaAberto && (
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          <section style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 18 }}>
            <h3 style={{ margin: 0 }}>Movimentar caixa</h3>
            <p style={{ margin: '5px 0 14px', color: 'var(--muted)' }}>Use suprimento ou sangria para numerário físico. Não registra receita.</p>
            <form onSubmit={registrarMovimento} style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                <label>
                  <span style={labelStyle}>Tipo</span>
                  <select value={formMovimento.tipo} onChange={(event) => setFormMovimento((atual) => ({ ...atual, tipo: event.target.value }))} style={inputStyle}>
                    <option value="suprimento">Suprimento (+)</option>
                    <option value="sangria">Sangria (-)</option>
                  </select>
                </label>
                <label>
                  <span style={labelStyle}>Valor (R$)</span>
                  <input required type="number" min="0.01" step="0.01" value={formMovimento.valor} onChange={(event) => setFormMovimento((atual) => ({ ...atual, valor: event.target.value }))} style={inputStyle} />
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label>
                  <span style={labelStyle}>Descrição</span>
                  <input required value={formMovimento.descricao} onChange={(event) => setFormMovimento((atual) => ({ ...atual, descricao: event.target.value }))} style={inputStyle} placeholder="Motivo do movimento" />
                </label>
                <label>
                  <span style={labelStyle}>Data/Hora</span>
                  <input type="datetime-local" value={formMovimento.dataMovimento} onChange={(event) => setFormMovimento((atual) => ({ ...atual, dataMovimento: event.target.value }))} style={inputStyle} />
                </label>
              </div>
              <button type="submit" disabled={salvando} style={secondary}>Confirmar movimento</button>
            </form>
          </section>
          <section style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 18 }}>
            <h3 style={{ margin: 0 }}>Fechar caixa</h3>
            <p style={{ margin: '5px 0 14px', color: 'var(--muted)' }}>O valor esperado soma abertura, recebimentos líquidos em dinheiro e suprimentos menos sangrias.</p>
            <form onSubmit={fecharCaixa} style={{ display: 'grid', gap: 12 }}>
              <label>
                <span style={labelStyle}>Valor contado (R$)</span>
                <input required type="number" min="0" step="0.01" value={formFechamento.valorInformado} onChange={(event) => setFormFechamento((atual) => ({ ...atual, valorInformado: event.target.value }))} style={inputStyle} placeholder="Informe o numerário físico contado" />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label>
                  <span style={labelStyle}>Observação</span>
                  <input value={formFechamento.observacao} onChange={(event) => setFormFechamento((atual) => ({ ...atual, observacao: event.target.value }))} style={inputStyle} placeholder="Opcional" />
                </label>
                <label>
                  <span style={labelStyle}>Data/Hora</span>
                  <input type="datetime-local" value={formFechamento.dataFechamento} onChange={(event) => setFormFechamento((atual) => ({ ...atual, dataFechamento: event.target.value }))} style={inputStyle} />
                </label>
              </div>
              <button type="submit" disabled={salvando} style={{ ...secondary, color: '#e05c5c', borderColor: 'color-mix(in srgb, #e05c5c 40%, var(--line))' }}>Confirmar fechamento</button>
            </form>
          </section>
        </div>
      )}

      {/* SEÇÃO 1: CAIXAS E MOVIMENTOS DO DIA */}
      <section style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 18, overflowX: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0 }}>Caixas do dia e sessões de atendimento</h3>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }}>Histórico de caixas físicos abertos e fechados na data.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {resumo.fechamentoDia ? (
              <button type="button" style={{ ...primary, background: '#14b87a' }} onClick={() => onViewDay(resumo.fechamentoDia)}>
                Ver relatório de fechamento
              </button>
            ) : (
              <button type="button" style={secondary} onClick={() => onCloseDay(data)} disabled={salvando}>
                Fechar dia financeiro
              </button>
            )}
          </div>
        </div>

        {caixas.length === 0 ? (
          <div style={{ color: 'var(--muted)', padding: '20px 0', textAlign: 'center' }}>Nenhum caixa físico registrado para esta data.</div>
        ) : (
          <table style={{ width: '100%', minWidth: 740, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Caixa</th>
                <th style={th}>Status</th>
                <th style={th}>Abertura</th>
                <th style={th}>Esperado</th>
                <th style={th}>Contado</th>
                <th style={th}>Divergência</th>
                <th style={{ ...th, textAlign: 'right' }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {caixas.map((caixa) => (
                <tr key={caixa.id} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={td}>
                    <strong>Caixa {caixa.numeroCaixa}</strong>
                    <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                      {new Date(caixa.abertoEm).toLocaleDateString('pt-BR')} às {new Date(caixa.abertoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </td>
                  <td style={td}>
                    <span style={{ color: caixa.status === 'aberto' ? '#14b87a' : 'var(--muted)', fontWeight: 800 }}>
                      {statusLabel(caixa.status)}
                    </span>
                  </td>
                  <td style={td}>{moeda(caixa.valorAbertura)}</td>
                  <td style={td}>{caixa.valorEsperado == null ? '—' : moeda(caixa.valorEsperado)}</td>
                  <td style={td}>{caixa.valorInformado == null ? '—' : moeda(caixa.valorInformado)}</td>
                  <td style={{ ...td, color: Number(caixa.divergencia || 0) === 0 ? '#14b87a' : '#e05c5c', fontWeight: 800 }}>
                    {caixa.divergencia == null ? '—' : moeda(caixa.divergencia)}
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <button
                      type="button"
                      style={{
                        padding: '6px 10px',
                        borderRadius: 6,
                        border: '1px solid var(--line)',
                        background: filtroCaixaId === caixa.id ? 'var(--accent)' : 'transparent',
                        color: filtroCaixaId === caixa.id ? '#fff' : 'var(--fg)',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                      onClick={() => setFiltroCaixaId(filtroCaixaId === caixa.id ? '' : caixa.id)}
                    >
                      {filtroCaixaId === caixa.id ? '✓ Vendo este caixa' : 'Ver comandas'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Movimentos do Caixa (suprimentos, sangrias, estornos) */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
            Movimentos físicos recentes (Sangrias, Suprimentos e Estornos)
          </div>
          {movimentos.length === 0 ? (
            <small style={{ color: 'var(--muted)' }}>Nenhum movimento manual registrado.</small>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {movimentos.slice(-10).reverse().map((mov) => {
                const isNeg = mov.tipo === 'sangria' || mov.tipo === 'estorno_recebimento'
                return (
                  <div key={mov.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--line)' }}>
                    <div>
                      <strong style={{ fontSize: 13 }}>{statusLabel(mov.tipo)}</strong>
                      <span style={{ color: 'var(--muted)', fontSize: 12, marginLeft: 8 }}>{mov.descricao || '—'}</span>
                      {mov.usuario && <small style={{ color: 'var(--muted)', display: 'block', fontSize: 11 }}>Registrado por: {mov.usuario}</small>}
                    </div>
                    <strong style={{ color: isNeg ? '#e05c5c' : '#14b87a', fontSize: 14 }}>
                      {isNeg ? `- ${moeda(mov.valor)}` : `+ ${moeda(mov.valor)}`}
                    </strong>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* SEÇÃO 2: DETALHAMENTO DE COMANDAS FECHADAS NO CAIXA */}
      <section style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>🧾</span>
              <h3 style={{ margin: 0 }}>Comandas Fechadas no Caixa</h3>
            </div>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }}>
              Detalhamento de serviços, produtos, formas de pagamento e cancelamento seguro de comandas faturadas.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(20, 184, 122, 0.1)', color: '#14b87a', fontWeight: 800, fontSize: 12 }}>
              {totaisFiltrados.pagasCount} faturada(s): {moeda(totaisFiltrados.totalFaturado)}
            </span>
            {totaisFiltrados.canceladasCount > 0 && (
              <span style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(224, 92, 92, 0.1)', color: '#e05c5c', fontWeight: 800, fontSize: 12 }}>
                {totaisFiltrados.canceladasCount} cancelada(s) / estornada(s)
              </span>
            )}
          </div>
        </div>

        {/* Resumo por Meio de Pagamento */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 14, padding: 12, background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--line)' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase' }}>💵 Dinheiro no Caixa</div>
            <strong style={{ fontSize: 15, color: '#14b87a' }}>{moeda(totaisFiltrados.totalDinheiro)}</strong>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase' }}>🟢 PIX</div>
            <strong style={{ fontSize: 15, color: 'var(--accent)' }}>{moeda(totaisFiltrados.totalPix)}</strong>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase' }}>💳 Cartões</div>
            <strong style={{ fontSize: 15, color: '#3b82f6' }}>{moeda(totaisFiltrados.totalCartao)}</strong>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase' }}>🟣 Em Conta</div>
            <strong style={{ fontSize: 15, color: '#8b5cf6' }}>{moeda(totaisFiltrados.totalConta)}</strong>
          </div>
        </div>

        {/* Barra de Filtros e Busca */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 16 }}>
          <input
            type="text"
            placeholder="🔍 Buscar cliente, profissional ou ID..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={inputStyle}
          />
          <select value={filtroCaixaId} onChange={(e) => setFiltroCaixaId(e.target.value)} style={inputStyle}>
            <option value="">Todos os caixas</option>
            {caixas.map((c) => (
              <option key={c.id} value={c.id}>Caixa {c.numeroCaixa} ({statusLabel(c.status)})</option>
            ))}
          </select>
          <select value={filtroMeio} onChange={(e) => setFiltroMeio(e.target.value)} style={inputStyle}>
            <option value="">Todos os meios</option>
            <option value="dinheiro">Dinheiro</option>
            <option value="pix">PIX</option>
            <option value="debito">Cartão de Débito</option>
            <option value="credito">Cartão de Crédito</option>
            <option value="conta">Em Conta</option>
          </select>
          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} style={inputStyle}>
            <option value="todas_fechadas">Fechadas & Estornadas</option>
            <option value="paga">Somente Pagas</option>
            <option value="em_conta">Somente Em Conta</option>
            <option value="cancelada">Somente Canceladas</option>
          </select>
        </div>

        {/* Lista de Comandas */}
        {comandasDoCaixa.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--muted)', background: 'var(--bg)', borderRadius: 10, border: '1px dashed var(--line)' }}>
            Nenhuma comanda fechada encontrada com os filtros selecionados.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {comandasDoCaixa.map((comanda) => {
              const expandida = Boolean(comandaExpandida[comanda.id])
              const cancelada = comanda.status === 'cancelada' || comanda.estornada
              const horario = comanda.fechadaEm || comanda.atualizadoEm || comanda.criadoEm
              const horaFormatada = horario ? new Date(horario).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'
              const itens = comanda.itens || []
              const servicos = itens.filter((i) => i.tipo === 'servico' || i.tipo === 'pacote')
              const produtos = itens.filter((i) => i.tipo === 'produto')
              const pagamentos = comanda.pagamentos || []

              return (
                <div
                  key={comanda.id}
                  style={{
                    background: cancelada ? 'rgba(224, 92, 92, 0.04)' : 'var(--bg)',
                    border: `1px solid ${cancelada ? 'rgba(224, 92, 92, 0.3)' : 'var(--line)'}`,
                    borderRadius: 12,
                    padding: 14,
                    transition: 'border-color .15s ease',
                  }}
                >
                  {/* Card Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          background: cancelada ? '#e05c5c' : comanda.status === 'em_conta' ? '#8b5cf6' : '#14b87a',
                          color: '#fff',
                        }}
                      >
                        {statusLabel(comanda.status)}
                      </span>
                      <strong style={{ fontSize: 14 }}>{comanda.clienteNome || 'Cliente Eventual'}</strong>
                      {comanda.clienteTelefone && (
                        <span style={{ color: 'var(--muted)', fontSize: 12 }}>({comanda.clienteTelefone})</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                        Fechada às <strong>{horaFormatada}</strong>
                      </span>
                      <strong style={{ fontSize: 16, color: cancelada ? 'var(--muted)' : 'var(--fg)', textDecoration: cancelada ? 'line-through' : 'none' }}>
                        {moeda(comanda.totalFaturado ?? comanda.total)}
                      </strong>
                    </div>
                  </div>

                  {/* Resumo rápido do Profissional e Meios */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 8, fontSize: 12, flexWrap: 'wrap' }}>
                    <div style={{ color: 'var(--muted)' }}>
                      Profissional: <strong style={{ color: 'var(--fg)' }}>{comanda.profissionalNome || 'Profissional da casa'}</strong>
                      {comanda.caixaId && <span style={{ marginLeft: 10 }}>· Caixa vinculado: <strong>Caixa {comanda.caixaId.slice(-1)}</strong></span>}
                    </div>

                    {/* Tags de Meios de Pagamento */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {pagamentos.map((p, idx) => (
                        <span
                          key={p.id || idx}
                          style={{
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: 'var(--card)',
                            border: '1px solid var(--line)',
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {p.meio?.toUpperCase()}: {moeda(p.valor)}
                          {p.caixaId && <small style={{ color: 'var(--muted)', marginLeft: 4 }}>(Cx)</small>}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Alerta de Cancelamento se estornada */}
                  {cancelada && (
                    <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(224, 92, 92, 0.08)', border: '1px solid rgba(224, 92, 92, 0.25)', fontSize: 12 }}>
                      <strong style={{ color: '#e05c5c' }}>Comanda Cancelada / Estornada no Caixa:</strong>
                      <span style={{ marginLeft: 6, color: 'var(--fg)' }}>
                        {comanda.cancelamentoMotivo || 'Estorno operacional de caixa'}
                      </span>
                      {comanda.canceladoPor && (
                        <span style={{ color: 'var(--muted)', marginLeft: 8 }}>(por {comanda.canceladoPor})</span>
                      )}
                    </div>
                  )}

                  {/* Botão de Expansão / Detalhamento do que foi fechado */}
                  <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--line)', paddingTop: 10, flexWrap: 'wrap', gap: 8 }}>
                    <button
                      type="button"
                      style={{ background: 'transparent', border: 0, padding: 0, color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                      onClick={() => toggleExpandir(comanda.id)}
                    >
                      {expandida ? '▲ Ocultar itens fechados' : `▼ Ver o que foi fechado (${itens.length} item(ns))` }
                    </button>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {onOpenComanda && (
                        <button
                          type="button"
                          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                          onClick={() => onOpenComanda(comanda)}
                        >
                          Abrir comanda completa
                        </button>
                      )}

                      {/* Botão para CANCELAR comanda já finalizada */}
                      {!cancelada && (
                        <button
                          type="button"
                          style={{
                            padding: '6px 12px',
                            borderRadius: 6,
                            border: '1px solid rgba(224, 92, 92, 0.4)',
                            background: 'rgba(224, 92, 92, 0.08)',
                            color: '#e05c5c',
                            fontSize: 12,
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                          onClick={() => {
                            setModalCancelamento(comanda)
                            setMotivoPredefinido(MOTIVOS_CANCELAMENTO[0])
                            setMotivoDetalhado('')
                            setReabrirAgendamento(Boolean(comanda.agendamentoId))
                          }}
                        >
                          🚫 Cancelar comanda finalizada
                        </button>
                      )}
                    </div>
                  </div>

                  {/* DETALHAMENTO EXPANDIDO (O QUE FOI FECHADO) */}
                  {expandida && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)', display: 'grid', gap: 12 }}>
                      {/* Serviços */}
                      {servicos.length > 0 && (
                        <div>
                          <strong style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                            Serviços Executados ({servicos.length})
                          </strong>
                          <div style={{ display: 'grid', gap: 4, marginTop: 6 }}>
                            {servicos.map((s, idx) => (
                              <div key={s.id || idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--card)', borderRadius: 6, fontSize: 13 }}>
                                <div>
                                  <span>✂️ <strong>{s.nome}</strong></span>
                                  {s.profissionalNome && <small style={{ color: 'var(--muted)', marginLeft: 8 }}>({s.profissionalNome})</small>}
                                </div>
                                <strong>{moeda(s.preco ?? s.precoUnitario)}</strong>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Produtos */}
                      {produtos.length > 0 && (
                        <div>
                          <strong style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                            Produtos Vendidos ({produtos.length})
                          </strong>
                          <div style={{ display: 'grid', gap: 4, marginTop: 6 }}>
                            {produtos.map((p, idx) => (
                              <div key={p.id || idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--card)', borderRadius: 6, fontSize: 13 }}>
                                <div>
                                  <span>🧴 <strong>{p.nome}</strong></span>
                                  <small style={{ color: 'var(--muted)', marginLeft: 8 }}>({p.quantidade || 1}x {moeda(p.precoUnitario || p.preco)})</small>
                                </div>
                                <strong>{moeda(p.subtotal ?? (Number(p.preco || 0) * Number(p.quantidade || 1)))}</strong>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Discriminação de Subtotal, Desconto e Total */}
                      <div style={{ background: 'var(--card)', padding: '10px 14px', borderRadius: 8, fontSize: 13, display: 'grid', gap: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)' }}>
                          <span>Subtotal dos itens:</span>
                          <span>{moeda(comanda.subtotal || comanda.total)}</span>
                        </div>
                        {Number(comanda.desconto || 0) > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#14b87a' }}>
                            <span>Desconto aplicado {comanda.descontoMotivo ? `(${comanda.descontoMotivo})` : ''}:</span>
                            <span>- {moeda(comanda.desconto)}</span>
                          </div>
                        )}
                        {Number(comanda.gorjeta || 0) > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--accent)' }}>
                            <span>Gorjeta:</span>
                            <span>+ {moeda(comanda.gorjeta)}</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--line)', paddingTop: 6, fontWeight: 800 }}>
                          <span>Total Faturado Fechado:</span>
                          <span style={{ fontSize: 15, color: cancelada ? '#e05c5c' : 'var(--accent)' }}>
                            {moeda(comanda.totalFaturado ?? comanda.total)}
                          </span>
                        </div>
                      </div>

                      {/* Detalhamento dos Recebimentos */}
                      <div>
                        <strong style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                          Recebimentos Registrados no Fechamento
                        </strong>
                        <div style={{ display: 'grid', gap: 4, marginTop: 6 }}>
                          {pagamentos.map((p, idx) => (
                            <div key={p.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--card)', borderRadius: 6, fontSize: 13 }}>
                              <div>
                                <strong>{p.meio?.toUpperCase()}</strong>
                                {p.caixaId && <span style={{ color: 'var(--muted)', fontSize: 11, marginLeft: 8 }}>· Registrado no Caixa {p.caixaId.slice(-1)}</span>}
                                {p.registradoEm && <span style={{ color: 'var(--muted)', fontSize: 11, marginLeft: 8 }}>às {new Date(p.registradoEm).toLocaleTimeString('pt-BR')}</span>}
                              </div>
                              <strong style={{ color: '#14b87a' }}>{moeda(p.valor)}</strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* MODAL DO PROCEDIMENTO DE CANCELAMENTO DE COMANDA FINALIZADA */}
      {modalCancelamento && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !processandoCancelamento) setModalCancelamento(null)
          }}
        >
          <div
            style={{
              background: 'var(--card)',
              border: '1px solid var(--line)',
              borderRadius: 16,
              maxWidth: 540,
              width: '100%',
              padding: 24,
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
              display: 'grid',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--line)', paddingBottom: 14 }}>
              <span style={{ fontSize: 24 }}>⚠️</span>
              <div>
                <h3 style={{ margin: 0, color: '#e05c5c', fontSize: 18 }}>
                  Procedimento de Cancelamento de Comanda Finalizada
                </h3>
                <small style={{ color: 'var(--muted)' }}>
                  Estorno coordenado de caixa, financeiro e estoque
                </small>
              </div>
            </div>

            {/* Resumo da Comanda que será cancelada */}
            <div style={{ background: 'var(--bg)', padding: 12, borderRadius: 10, border: '1px solid var(--line)', fontSize: 13, display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>Comanda:</span>
                <strong>{modalCancelamento.id}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>Cliente:</span>
                <strong>{modalCancelamento.clienteNome || 'Cliente Eventual'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>Valor Faturado a Estornar:</span>
                <strong style={{ color: '#e05c5c', fontSize: 15 }}>
                  {moeda(modalCancelamento.totalFaturado ?? modalCancelamento.total)}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>Meios recebidos:</span>
                <span>
                  {(modalCancelamento.pagamentos || []).map((p) => `${p.meio?.toUpperCase()} (${moeda(p.valor)})`).join(', ') || 'Nenhum'}
                </span>
              </div>
            </div>

            {/* Aviso dos Efeitos do Cancelamento */}
            <div style={{ padding: 12, borderRadius: 10, background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)', fontSize: 12, color: 'var(--fg)', lineHeight: 1.5 }}>
              <strong style={{ color: '#f59e0b', display: 'block', marginBottom: 4 }}>O que acontecerá ao confirmar:</strong>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li><strong>Caixa Operacional:</strong> os recebimentos em dinheiro serão estornados (reduzindo o numerário esperado do caixa).</li>
                <li><strong>Financeiro Central:</strong> lançamentos de receita pagos serão revertidos de forma compensatória e auditada.</li>
                <li><strong>Estoque:</strong> produtos lançados nesta comanda serão devolvidos ao saldo físico de estoque.</li>
                <li><strong>Comissões e Contas:</strong> comissões da comanda serão estornadas e contas em aberto canceladas.</li>
              </ul>
            </div>

            {/* Formulário de Justificativa */}
            <form onSubmit={executarProcedimentoCancelamento} style={{ display: 'grid', gap: 12 }}>
              <label>
                <span style={labelStyle}>Motivo do cancelamento (obrigatório)</span>
                <select
                  value={motivoPredefinido}
                  onChange={(e) => setMotivoPredefinido(e.target.value)}
                  style={inputStyle}
                  disabled={processandoCancelamento}
                >
                  {MOTIVOS_CANCELAMENTO.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </label>

              <label>
                <span style={labelStyle}>Observação / Justificativa adicional</span>
                <textarea
                  rows={2}
                  value={motivoDetalhado}
                  onChange={(e) => setMotivoDetalhado(e.target.value)}
                  style={{ ...inputStyle, resize: 'vertical' }}
                  placeholder="Descreva detalhes que justifiquem o cancelamento desta comanda já finalizada..."
                  disabled={processandoCancelamento}
                />
              </label>

              {modalCancelamento.agendamentoId && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={reabrirAgendamento}
                    onChange={(e) => setReabrirAgendamento(e.target.checked)}
                    disabled={processandoCancelamento}
                  />
                  <span>Reabrir horário do agendamento vinculado na agenda operacional</span>
                </label>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  style={secondary}
                  onClick={() => setModalCancelamento(null)}
                  disabled={processandoCancelamento}
                >
                  Voltar / Manter comanda
                </button>
                <button
                  type="submit"
                  style={{
                    ...primary,
                    background: '#e05c5c',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                  disabled={processandoCancelamento}
                >
                  {processandoCancelamento ? 'Estornando comanda...' : 'Confirmar Cancelamento & Estorno'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  borderRadius: 9,
  border: '1px solid var(--line)',
  background: 'var(--card)',
  color: 'var(--fg)',
  font: 'inherit',
}
const labelStyle = { display: 'block', color: 'var(--muted)', fontSize: 12, fontWeight: 700, marginBottom: 6 }
const primary = {
  padding: '10px 16px',
  border: 0,
  borderRadius: 9,
  background: 'var(--accent)',
  color: '#fff',
  fontWeight: 800,
  cursor: 'pointer',
}
const secondary = {
  padding: '10px 16px',
  border: '1px solid var(--line)',
  borderRadius: 9,
  background: 'transparent',
  color: 'var(--fg)',
  fontWeight: 800,
  cursor: 'pointer',
}
const th = { padding: '10px 8px', textAlign: 'left', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase' }
const td = { padding: '10px 8px', fontSize: 13 }
