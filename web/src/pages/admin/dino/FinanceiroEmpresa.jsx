import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../../lib/api'
import { useToast } from '../../../hooks/useToast'
import { useAuth } from '../../../lib/auth'
import EscolherUnidade, { useUnidadeAtiva } from '../../../components/EscolherUnidade'
import { useRazaoAtivo } from '../../../lib/razao-estado'
import { brandFromContext } from '../../../lib/brand'
import { Badge, Dialog, Table } from '../customer360/shared'
import { downloadCsv, localDay, money, shortDate } from './format'
import '../customer360.css'
import './dino-admin.css'

const BASE = '/api/admin/barbearia/financeiro'
const EMPTY_FORM = { tipo: 'despesa', categoria: 'Outros', descricao: '', valor: '', vencimento: '', status: 'pendente', obs: '', meses: 1 }
const STATUS = { pendente: { label: 'Pendente', tone: 'warning' }, pago: { label: 'Pago', tone: 'success' }, cancelado: { label: 'Cancelado', tone: 'muted' } }
const ORIGENS = { manual: 'Manual', barbearia_atendimento: 'Atendimento', barbearia_comanda: 'Comanda', barbearia_revenda: 'Revenda', comanda: 'Comanda', contas_receber: 'Conta a receber', estoque: 'Estoque', revenda: 'Revenda', 'avec-import-financeiro-20261022': 'Histórico Avec' }

function FlowChart({ fluxo, mesSelecionado, onSelectMes }) {
  const max = Math.max(1, ...fluxo.flatMap((item) => [item.receitas, item.despesas]))
  return <figure className="dadm-flow" aria-label="Receitas e despesas pagas por mês" style={{ margin: 0 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
      <div className="dadm-legend">
        <span><i className="s-in" />Receitas pagas</span>
        <span><i className="s-out" />Despesas pagas</span>
        {mesSelecionado && <span style={{ color: 'var(--accent, #b0892e)', fontWeight: 700, marginLeft: 8 }}>
          ● Mês filtrado: {mesSelecionado.slice(5)}/{mesSelecionado.slice(0, 4)}
        </span>}
      </div>
      {mesSelecionado && (
        <button type="button" className="c360-btn ghost" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => onSelectMes(null)}>
          Ver todos os meses ✕
        </button>
      )}
    </div>
    <div className="dadm-flow-plot" style={{ marginTop: 8 }}>
      {fluxo.map((item) => {
        const isSelected = mesSelecionado === item.mes
        return <div
          key={item.mes}
          className="dadm-flow-col"
          onClick={() => onSelectMes(isSelected ? null : item.mes)}
          style={{
            cursor: 'pointer',
            padding: '4px 2px',
            borderRadius: 6,
            background: isSelected ? 'var(--card2, rgba(176, 137, 46, 0.15))' : 'transparent',
            outline: isSelected ? '2px solid var(--accent, #b0892e)' : 'none',
            transition: 'all 0.15s ease',
          }}
          title={`${item.mes}: receitas ${money(item.receitas)} · despesas ${money(item.despesas)} · saldo ${money(item.saldo)} (Clique para filtrar)`}
        >
          <div className="dadm-flow-bars">
            <i className="s-in" style={{ height: `${(item.receitas / max) * 100}%` }} />
            <i className="s-out" style={{ height: `${(item.despesas / max) * 100}%` }} />
          </div>
          <small style={{ fontWeight: isSelected ? 800 : 500, color: isSelected ? 'var(--fg)' : 'var(--muted)' }}>
            {item.mes.slice(5)}/{item.mes.slice(2, 4)}
          </small>
        </div>
      })}
    </div>
    <figcaption className="sr-only">{fluxo.map((item) => `${item.mes}: receitas ${money(item.receitas)}, despesas ${money(item.despesas)}`).join('; ')}</figcaption>
  </figure>
}

export default function FinanceiroEmpresa() {
  const { toast } = useToast()
  const { empresaAtiva, perfil } = useAuth()
  const { unidade } = useUnidadeAtiva()
  const exigeUnidade = useRazaoAtivo() === true && !unidade
  const operador = perfil === 'operador'
  const stallone = brandFromContext(empresaAtiva) === 'stallone'

  const [lancamentos, setLancamentos] = useState([])
  const [resumo, setResumo] = useState(null)
  const [fluxo, setFluxo] = useState([])
  const [categorias, setCategorias] = useState({ receita: [], despesa: [] })
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [filtros, setFiltros] = useState(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search)
      return {
        tipo: sp.get('tipo') || (sp.get('aba') === 'pagar' ? 'despesa' : sp.get('aba') === 'receber' ? 'receita' : ''),
        status: sp.get('status') || (sp.get('aba') === 'pagar' || sp.get('aba') === 'receber' ? 'pendente' : ''),
        categoria: sp.get('categoria') || '',
        q: sp.get('q') || '',
        de: sp.get('de') || '',
        ate: sp.get('ate') || ''
      }
    }
    return { tipo: '', status: '', categoria: '', q: '', de: '', ate: '' }
  })
  const [cardFiltroAtivo, setCardFiltroAtivo] = useState(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search)
      if (sp.get('filtro') === 'vencidos') return 'vencidos'
      if (sp.get('aba') === 'pagar') return 'aPagar'
      if (sp.get('aba') === 'receber') return 'aReceber'
    }
    return null
  })
  const [mesSelecionado, setMesSelecionado] = useState(null)

  const [ordenacao, setOrdenacao] = useState({ campo: 'vencimento', direcao: 'desc' })
  const [itensPorPagina, setItensPorPagina] = useState(50)
  const [paginaAtual, setPaginaAtual] = useState(1)
  const [selecionados, setSelecionados] = useState(new Set())
  const [executandoLote, setExecutandoLote] = useState(false)
  const [modalLiquidarVencidos, setModalLiquidarVencidos] = useState(false)

  const [form, setForm] = useState(null)
  const [cancelando, setCancelando] = useState(null)
  const firstField = useRef(null)
  const hoje = localDay()

  const load = useCallback(async () => {
    setLoading(true)
    if (operador) {
      try { setCategorias((await api.get(`${BASE}/categorias`)) || { receita: [], despesa: [] }); setErro('') }
      catch (error) { setErro(error.message || 'Não foi possível carregar as categorias.') }
      finally { setLoading(false) }
      return
    }
    try {
      const [lista, r, f, c] = await Promise.all([
        api.get(`${BASE}/lancamentos`),
        api.get(`${BASE}/resumo`),
        api.get(`${BASE}/fluxo`),
        api.get(`${BASE}/categorias`)
      ])
      setLancamentos(Array.isArray(lista) ? lista : [])
      setResumo(r)
      setFluxo(Array.isArray(f) ? f : [])
      setCategorias(c || { receita: [], despesa: [] })
      setErro('')
    } catch (error) { setErro(error.message || 'Não foi possível carregar o financeiro.') }
    finally { setLoading(false) }
  }, [operador])

  useEffect(() => { load() }, [load, empresaAtiva?.id])

  const mesAtual = resumo?.mesAtual || hoje.slice(0, 7)

  // Lançamentos vencidos
  const vencidos = useMemo(() => {
    return lancamentos.filter((item) => item.status === 'pendente' && item.vencimento < hoje)
  }, [lancamentos, hoje])

  const totalVencidos = useMemo(() => {
    return vencidos.reduce((sum, item) => sum + item.valor, 0)
  }, [vencidos])

  const vencendo = useMemo(() => {
    const daqui3dias = localDay(new Date(Date.now() + 3 * 86400000))
    return lancamentos.filter((item) => item.status === 'pendente' && item.vencimento >= hoje && item.vencimento <= daqui3dias)
  }, [lancamentos, hoje])

  const resultadoMes = resumo ? resumo.recMes - resumo.despMes : 0
  const margemMes = resumo?.recMes > 0 ? ((resultadoMes / resumo.recMes) * 100).toFixed(1) : 0

  // Manipular clique nos Cards de KPI
  function toggleCardFiltro(tipoCard) {
    if (cardFiltroAtivo === tipoCard) {
      setCardFiltroAtivo(null)
      setFiltros({ tipo: '', status: '', categoria: '', q: '', de: '', ate: '' })
      return
    }
    setCardFiltroAtivo(tipoCard)
    setMesSelecionado(null)
    setPaginaAtual(1)

    if (tipoCard === 'saldo') {
      setFiltros({ tipo: '', status: 'pago', categoria: '', q: '', de: '', ate: '' })
    } else if (tipoCard === 'aReceber') {
      setFiltros({ tipo: 'receita', status: 'pendente', categoria: '', q: '', de: '', ate: '' })
    } else if (tipoCard === 'aPagar') {
      setFiltros({ tipo: 'despesa', status: 'pendente', categoria: '', q: '', de: '', ate: '' })
    } else if (tipoCard === 'recMes') {
      const inicioMes = `${mesAtual}-01`
      const fimMes = `${mesAtual}-31`
      setFiltros({ tipo: 'receita', status: 'pago', categoria: '', q: '', de: inicioMes, ate: fimMes })
    } else if (tipoCard === 'despMes') {
      const inicioMes = `${mesAtual}-01`
      const fimMes = `${mesAtual}-31`
      setFiltros({ tipo: 'despesa', status: 'pago', categoria: '', q: '', de: inicioMes, ate: fimMes })
    } else if (tipoCard === 'resultadoMes') {
      const inicioMes = `${mesAtual}-01`
      const fimMes = `${mesAtual}-31`
      setFiltros({ tipo: '', status: 'pago', categoria: '', q: '', de: inicioMes, ate: fimMes })
    } else if (tipoCard === 'vencidos') {
      setFiltros({ tipo: '', status: 'pendente', categoria: '', q: '', de: '', ate: '' })
    }
  }

  // Manipular clique no gráfico de fluxo
  function handleSelectMesFluxo(mes) {
    setMesSelecionado(mes)
    setCardFiltroAtivo(null)
    setPaginaAtual(1)
    if (!mes) {
      setFiltros((prev) => ({ ...prev, de: '', ate: '' }))
    } else {
      setFiltros((prev) => ({ ...prev, de: `${mes}-01`, ate: `${mes}-31` }))
    }
  }

  function limparTodosFiltros() {
    setCardFiltroAtivo(null)
    setMesSelecionado(null)
    setFiltros({ tipo: '', status: '', categoria: '', q: '', de: '', ate: '' })
    setPaginaAtual(1)
  }

  // Filtragem da lista
  const lista = useMemo(() => {
    return lancamentos.filter((item) => {
      if (cardFiltroAtivo === 'vencidos') {
        if (item.status !== 'pendente' || item.vencimento >= hoje) return false
      }
      if (filtros.tipo && item.tipo !== filtros.tipo) return false
      if (filtros.status && item.status !== filtros.status) return false
      if (filtros.categoria && item.categoria !== filtros.categoria) return false
      if (filtros.q) {
        const busca = filtros.q.toLowerCase()
        const texto = `${item.descricao || ''} ${item.observacao || ''} ${item.categoria || ''}`.toLowerCase()
        if (!texto.includes(busca)) return false
      }
      if (filtros.de && item.vencimento < filtros.de) return false
      if (filtros.ate && item.vencimento > filtros.ate) return false
      return true
    })
  }, [lancamentos, filtros, cardFiltroAtivo, hoje])

  // Ordenação da lista
  const listaOrdenada = useMemo(() => {
    return [...lista].sort((a, b) => {
      let valA = a[ordenacao.campo]
      let valB = b[ordenacao.campo]
      if (ordenacao.campo === 'valor') {
        valA = Number(valA || 0)
        valB = Number(valB || 0)
      } else {
        valA = String(valA || '').toLowerCase()
        valB = String(valB || '').toLowerCase()
      }
      if (valA < valB) return ordenacao.direcao === 'asc' ? -1 : 1
      if (valA > valB) return ordenacao.direcao === 'asc' ? 1 : -1
      return 0
    })
  }, [lista, ordenacao])

  // Paginação
  const totalPaginas = Math.max(1, Math.ceil(listaOrdenada.length / (itensPorPagina || 50)))
  const listaPaginada = useMemo(() => {
    if (itensPorPagina >= 9999) return listaOrdenada
    const inicio = (paginaAtual - 1) * itensPorPagina
    return listaOrdenada.slice(inicio, inicio + itensPorPagina)
  }, [listaOrdenada, paginaAtual, itensPorPagina])

  const totalFiltrado = useMemo(() => {
    const rec = lista.filter((i) => i.tipo === 'receita').reduce((s, i) => s + i.valor, 0)
    const desp = lista.filter((i) => i.tipo === 'despesa').reduce((s, i) => s + i.valor, 0)
    return { rec, desp, saldo: rec - desp }
  }, [lista])

  const todasCategorias = useMemo(() => {
    return [...new Set([...(categorias.receita || []), ...(categorias.despesa || []), ...lancamentos.map((item) => item.categoria)])].filter(Boolean)
  }, [categorias, lancamentos])

  function toggleOrdenar(campo) {
    setOrdenacao((prev) => ({
      campo,
      direcao: prev.campo === campo && prev.direcao === 'desc' ? 'asc' : 'desc'
    }))
  }

  // Seleção em lote
  const todosDaPaginaSelecionados = listaPaginada.length > 0 && listaPaginada.every((item) => selecionados.has(item.id))
  function toggleSelecionarTodosPagina() {
    setSelecionados((prev) => {
      const next = new Set(prev)
      if (todosDaPaginaSelecionados) {
        listaPaginada.forEach((item) => next.delete(item.id))
      } else {
        listaPaginada.forEach((item) => next.add(item.id))
      }
      return next
    })
  }

  function toggleSelecionarLinha(id) {
    setSelecionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Liquidação em lote dos selecionados
  async function liquidarSelecionados() {
    if (!selecionados.size) return
    const ids = Array.from(selecionados)
    setExecutandoLote(true)
    try {
      await api.post(`${BASE}/lancamentos/liquidar-lote`, { ids })
      toast(`${ids.length} lançamento(s) marcado(s) como pago(s).`)
      setSelecionados(new Set())
      await load()
    } catch (err) {
      toast(err.message || 'Erro ao liquidar lançamentos.', true)
    } finally {
      setExecutandoLote(false)
    }
  }

  // Liquidação em lote de todos os 71 vencidos
  async function confirmarLiquidarTodosVencidos() {
    const ids = vencidos.map((item) => item.id)
    setExecutandoLote(true)
    try {
      await api.post(`${BASE}/lancamentos/liquidar-lote`, { ids })
      toast(`${ids.length} despesa(s) vencida(s) liquidada(s) como pagas!`)
      setModalLiquidarVencidos(false)
      setSelecionados(new Set())
      setCardFiltroAtivo(null)
      await load()
    } catch (err) {
      toast(err.message || 'Erro ao liquidar despesas vencidas.', true)
    } finally {
      setExecutandoLote(false)
    }
  }

  function abrirNovo(tipo = 'despesa') { setForm({ ...EMPTY_FORM, tipo, vencimento: hoje }) }
  function abrirEdicao(item) { setForm({ id: item.id, automatico: item.automatico, tipo: item.tipo, categoria: item.categoria, descricao: item.descricao, valor: item.valor, vencimento: item.vencimento, status: item.status, obs: item.observacao || '' }) }

  async function salvar() {
    try {
      const payload = form.automatico ? { status: form.status, obs: form.obs } : { tipo: form.tipo, categoria: form.categoria, descricao: form.descricao, valor: Number(String(form.valor).replace(',', '.')), vencimento: form.vencimento, status: form.status, obs: form.obs, ...(!form.id && Number(form.meses) > 1 ? { recorrencia: { meses: Number(form.meses) } } : {}) }
      if (form.id) await api.patch(`${BASE}/lancamentos/${form.id}`, payload)
      else await api.post(`${BASE}/lancamentos`, payload)
      toast(form.id ? 'Lançamento atualizado.' : (Number(form.meses) > 1 ? `${form.meses} lançamentos mensais criados.` : 'Lançamento criado.'))
      setForm(null); load()
    } catch (error) { toast(error.message, true) }
  }

  async function marcarPago(item) {
    try {
      await api.patch(`${BASE}/lancamentos/${item.id}`, { status: 'pago', pagoEm: new Date().toISOString() })
      toast('Marcado como pago.')
      load()
    } catch (error) { toast(error.message || 'Erro ao marcar como pago.', true) }
  }

  async function encerrarSerie() {
    try { const r = await api.delete(`${BASE}/series/${cancelando.serieId}`); toast(`${r.canceladas} parcela(s) futura(s) cancelada(s).`); setCancelando(null); load() }
    catch (error) { toast(error.message, true) }
  }

  async function confirmarCancelamento() {
    try { await api.delete(`${BASE}/lancamentos/${cancelando.id}`); toast('Lançamento cancelado (fica no histórico).'); setCancelando(null); load() }
    catch (error) { toast(error.message, true) }
  }

  function exportar() {
    downloadCsv(`financeiro_${hoje}.csv`, lista.map((item) => ({
      vencimento: item.vencimento,
      tipo: item.tipo,
      categoria: item.categoria,
      descricao: item.descricao,
      valor: item.valor,
      status: item.status,
      origem: ORIGENS[item.origem] || item.origem,
      pago_em: item.pagoEm ? item.pagoEm.slice(0, 10) : '',
      observacao: item.observacao || ''
    })))
  }

  const columns = [
    {
      key: 'select',
      label: <input type="checkbox" aria-label="Selecionar todos da página" checked={todosDaPaginaSelecionados} onChange={toggleSelecionarTodosPagina} />,
      render: (item) => <input type="checkbox" aria-label={`Selecionar ${item.descricao}`} checked={selecionados.has(item.id)} onChange={() => toggleSelecionarLinha(item.id)} />
    },
    {
      key: 'vencimento',
      label: <span style={{ cursor: 'pointer' }} onClick={() => toggleOrdenar('vencimento')}>
        Vencimento {ordenacao.campo === 'vencimento' ? (ordenacao.direcao === 'asc' ? '▲' : '▼') : ''}
      </span>,
      render: (item) => <span className={item.status === 'pendente' && item.vencimento < hoje ? 'dadm-neg' : ''} style={{ fontWeight: item.status === 'pendente' && item.vencimento < hoje ? 700 : 400 }}>
        {shortDate(item.vencimento)}
      </span>
    },
    {
      key: 'descricao',
      label: <span style={{ cursor: 'pointer' }} onClick={() => toggleOrdenar('descricao')}>
        Descrição {ordenacao.campo === 'descricao' ? (ordenacao.direcao === 'asc' ? '▲' : '▼') : ''}
      </span>,
      render: (item) => <div>
        <div style={{ fontWeight: 600 }}>{item.descricao}</div>
        <small className="dadm-muted" style={{ display: 'block', fontSize: 11, marginTop: 2 }}>
          {item.categoria} · {ORIGENS[item.origem] || item.origem}
          {item.serieParcela ? ` · Parcela ${item.serieParcela}/${item.serieTotal}` : ''}
          {item.pagoEm ? ` · Pago em ${shortDate(item.pagoEm)}` : ''}
        </small>
      </div>
    },
    {
      key: 'valor',
      label: <span style={{ cursor: 'pointer' }} onClick={() => toggleOrdenar('valor')}>
        Valor {ordenacao.campo === 'valor' ? (ordenacao.direcao === 'asc' ? '▲' : '▼') : ''}
      </span>,
      align: 'right',
      render: (item) => <span className={item.tipo === 'receita' ? 'dadm-pos' : 'dadm-neg'} style={{ fontWeight: 700 }}>
        {item.tipo === 'receita' ? '+' : '−'} {money(item.valor)}
      </span>
    },
    {
      key: 'status',
      label: <span style={{ cursor: 'pointer' }} onClick={() => toggleOrdenar('status')}>
        Situação {ordenacao.campo === 'status' ? (ordenacao.direcao === 'asc' ? '▲' : '▼') : ''}
      </span>,
      render: (item) => <Badge tone={STATUS[item.status]?.tone}>{STATUS[item.status]?.label || item.status}</Badge>
    },
    {
      key: 'acoes',
      label: 'Ações',
      render: (item) => item.status === 'cancelado' ? <span className="dadm-muted">—</span> : <div className="dadm-actions">
        {item.status === 'pendente' && <button type="button" className="c360-btn ghost" onClick={() => marcarPago(item)} title="Marcar este lançamento como pago">Marcar pago</button>}
        <button type="button" className="c360-btn ghost" onClick={() => abrirEdicao(item)} title="Editar detalhes">Editar</button>
        {!item.automatico && <button type="button" className="c360-btn ghost" onClick={() => setCancelando(item)} title="Cancelar lançamento">Cancelar</button>}
      </div>
    },
  ]

  const cardStyle = (ativo) => ({
    cursor: 'pointer',
    position: 'relative',
    transition: 'all 0.15s ease',
    outline: ativo ? '2px solid var(--accent, #b0892e)' : 'none',
    boxShadow: ativo ? '0 0 12px rgba(176, 137, 46, 0.25)' : 'none',
    background: ativo ? 'var(--card2, rgba(176, 137, 46, 0.08))' : 'var(--card)',
  })

  return <div className="dadm-page">
    <header className="dadm-head">
      <div>
        <div className="dadm-eyebrow">Gestão · {empresaAtiva?.nome || 'Empresa'}</div>
        <h1>Financeiro</h1>
        <p>{stallone ? 'Contas a pagar e a receber desta empresa. Registre despesas e acompanhe os lançamentos. Pedidos e pagamentos da loja online são consultados no painel da loja; a conciliação financeira precisa ser validada.' : 'Contas a pagar e a receber só desta empresa. Atendimentos pagos, comandas e contas a receber entram sozinhos; aqui você lança aluguel, insumos, contas e outras despesas.'}</p>
      </div>
      <div className="dadm-actions">
        {!operador && <button type="button" className="c360-btn ghost" onClick={exportar} disabled={loading || !lista.length}>Exportar CSV</button>}
        {!operador && <button type="button" className="c360-btn ghost" onClick={() => abrirNovo('receita')} disabled={exigeUnidade}>+ Receita</button>}
        <button type="button" className="c360-btn primary" onClick={() => abrirNovo('despesa')} disabled={exigeUnidade}>+ Despesa</button>
      </div>
    </header>

    {exigeUnidade && <EscolherUnidade motivo="Para lançar receita ou despesa, escolha a unidade." />}
    {erro && <p className="dadm-note danger" role="alert">{erro}</p>}
    {operador && <p className="dadm-note">Seu perfil é de operador: aqui você lança as despesas do dia. Saldo, contas e relatórios ficam com a administração.</p>}

    {operador ? null : loading && !resumo ? <p className="dadm-muted">Carregando indicadores financeiros…</p> : resumo && <>
      {/* Cards de KPI Interativos com Filtro Imediato ao Clicar */}
      <section className="dadm-kpis" aria-label="Resumo financeiro e filtros rápidos">
        <article
          role="button"
          tabIndex={0}
          onClick={() => toggleCardFiltro('saldo')}
          style={cardStyle(cardFiltroAtivo === 'saldo')}
          title="Clique para filtrar todos os lançamentos pagos"
        >
          <span>Saldo realizado</span>
          <strong className={resumo.saldo >= 0 ? '' : 'dadm-neg'}>{money(resumo.saldo)}</strong>
          <small>Receitas − despesas pagas</small>
        </article>

        <article
          role="button"
          tabIndex={0}
          onClick={() => toggleCardFiltro('aReceber')}
          style={cardStyle(cardFiltroAtivo === 'aReceber')}
          title="Clique para filtrar contas a receber pendentes"
        >
          <span>A receber</span>
          <strong>{money(resumo.aReceber)}</strong>
          <small>Pendentes</small>
        </article>

        <article
          role="button"
          tabIndex={0}
          onClick={() => toggleCardFiltro('aPagar')}
          style={cardStyle(cardFiltroAtivo === 'aPagar')}
          title="Clique para filtrar contas a pagar pendentes"
        >
          <span>A pagar</span>
          <strong>{money(resumo.aPagar)}</strong>
          <small>Pendentes</small>
        </article>

        <article
          role="button"
          tabIndex={0}
          onClick={() => toggleCardFiltro('recMes')}
          style={cardStyle(cardFiltroAtivo === 'recMes')}
          title={`Clique para filtrar receitas pagas em ${mesAtual.slice(5)}/${mesAtual.slice(0, 4)}`}
        >
          <span>Receitas do mês</span>
          <strong>{money(resumo.recMes)}</strong>
          <small>Pagas em {mesAtual.slice(5)}/{mesAtual.slice(0, 4)}</small>
        </article>

        <article
          role="button"
          tabIndex={0}
          onClick={() => toggleCardFiltro('despMes')}
          style={cardStyle(cardFiltroAtivo === 'despMes')}
          title="Clique para filtrar despesas pagas no mês"
        >
          <span>Despesas do mês</span>
          <strong>{money(resumo.despMes)}</strong>
          <small>Pagas no mês</small>
        </article>

        <article
          role="button"
          tabIndex={0}
          onClick={() => toggleCardFiltro('resultadoMes')}
          className={resultadoMes < 0 ? 'is-alert' : ''}
          style={cardStyle(cardFiltroAtivo === 'resultadoMes')}
          title="Clique para filtrar receitas e despesas pagas do mês"
        >
          <span>Resultado do mês</span>
          <strong>{money(resultadoMes)}</strong>
          <small>{resumo.recMes > 0 ? `Margem ${margemMes}%` : 'Sem receitas pagas'}</small>
        </article>

        <article
          role="button"
          tabIndex={0}
          onClick={() => toggleCardFiltro('vencidos')}
          className={vencidos.length ? 'is-alert' : ''}
          style={{
            ...cardStyle(cardFiltroAtivo === 'vencidos'),
            borderColor: vencidos.length ? '#e05c5c' : undefined,
          }}
          title="Clique para filtrar apenas os lançamentos vencidos"
        >
          <span>Vencidos</span>
          <strong style={{ color: vencidos.length ? '#e05c5c' : 'inherit' }}>{vencidos.length}</strong>
          <small>{vencidos.length ? money(totalVencidos) : 'Nada atrasado'}</small>
        </article>
      </section>

      {/* Banner de Aviso de Vencimento Próximo */}
      {vencendo.length > 0 && <p className="dadm-note warn">
        {vencendo.length} lançamento(s) vencem nos próximos 3 dias: {vencendo.slice(0, 3).map((item) => `${item.descricao} (${money(item.valor)})`).join(', ')}{vencendo.length > 3 ? '…' : ''}
      </p>}

      {/* Ação Especial em Lote para as 71 despesas vencidas do Avec */}
      {vencidos.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, padding: '12px 16px', background: 'var(--card2, #fdf6ec)', border: '1px solid #f59e0b', borderRadius: 12, margin: '8px 0' }}>
          <div>
            <strong style={{ color: '#b45309' }}>Atenção: Existem {vencidos.length} despesa(s) antiga(s) vencida(s) ({money(totalVencidos)}).</strong>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--muted)' }}>
              Registros históricos do Avec que venceram antes da migração. Você pode liquidá-los em lote para dar baixa e atualizar o razão contábil.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="c360-btn ghost"
              style={{ fontSize: 12 }}
              onClick={() => toggleCardFiltro('vencidos')}
            >
              {cardFiltroAtivo === 'vencidos' ? '✓ Filtrando vencidos' : 'Ver os 71 vencidos'}
            </button>
            <button
              type="button"
              className="c360-btn primary"
              style={{ fontSize: 12, background: '#b45309', borderColor: '#b45309', color: '#fff' }}
              onClick={() => setModalLiquidarVencidos(true)}
              disabled={executandoLote}
            >
              {executandoLote ? 'Liquidando…' : `Liquidar todos os ${vencidos.length} vencidos`}
            </button>
          </div>
        </div>
      )}

      {/* Gráfico Interativo com Clique por Mês */}
      <section className="dadm-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
          <h2>Fluxo dos últimos 12 meses</h2>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>Clique em um mês para filtrar a lista abaixo</span>
        </div>
        <FlowChart fluxo={fluxo} mesSelecionado={mesSelecionado} onSelectMes={handleSelectMesFluxo} />
      </section>
    </>}

    {/* Tabela de Lançamentos Interativa com Busca, Filtros, Ordenação e Paginação */}
    {!operador && <section className="dadm-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h2>Lançamentos</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            Exibindo <strong>{lista.length}</strong> lançamento(s)
            {lista.length > 0 && ` · Saldo: ${money(totalFiltrado.saldo)} (Receitas: ${money(totalFiltrado.rec)} | Despesas: ${money(totalFiltrado.desp)})`}
          </span>
          {(cardFiltroAtivo || mesSelecionado || filtros.q || filtros.tipo || filtros.status || filtros.categoria || filtros.de || filtros.ate) && (
            <button type="button" className="c360-btn ghost" style={{ fontSize: 11, padding: '4px 8px' }} onClick={limparTodosFiltros}>
              Limpar filtros ✕
            </button>
          )}
        </div>
      </div>

      {/* Banner de Filtro Ativo */}
      {(cardFiltroAtivo || mesSelecionado) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 8, margin: '8px 0' }}>
          <span style={{ fontSize: 13 }}>
            Filtro ativo: <strong style={{ color: 'var(--accent, #b0892e)' }}>
              {cardFiltroAtivo === 'vencidos' && `${vencidos.length} Lançamentos Vencidos`}
              {cardFiltroAtivo === 'saldo' && 'Todos os Lançamentos Pagos'}
              {cardFiltroAtivo === 'aReceber' && 'Contas a Receber Pendentes'}
              {cardFiltroAtivo === 'aPagar' && 'Contas a Pagar Pendentes'}
              {cardFiltroAtivo === 'recMes' && `Receitas Pagas do Mês (${mesAtual})`}
              {cardFiltroAtivo === 'despMes' && `Despesas Pagas do Mês (${mesAtual})`}
              {cardFiltroAtivo === 'resultadoMes' && `Movimentações do Mês (${mesAtual})`}
              {mesSelecionado && `Mês do Fluxo: ${mesSelecionado.slice(5)}/${mesSelecionado.slice(0, 4)}`}
            </strong>
          </span>
          <button type="button" className="c360-btn ghost" style={{ fontSize: 11, padding: '2px 8px' }} onClick={limparTodosFiltros}>
            Remover filtro ✕
          </button>
        </div>
      )}

      {/* Barra de Ações em Lote quando há Selecionados */}
      {selecionados.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--card2, rgba(176, 137, 46, 0.15))', border: '1px solid var(--accent, #b0892e)', borderRadius: 10, margin: '10px 0' }}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>
            ✓ {selecionados.size} lançamento(s) selecionado(s)
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="c360-btn ghost" style={{ fontSize: 12 }} onClick={() => setSelecionados(new Set())}>
              Desmarcar todos
            </button>
            <button type="button" className="c360-btn primary" style={{ fontSize: 12 }} onClick={liquidarSelecionados} disabled={executandoLote}>
              {executandoLote ? 'Processando…' : `Marcar ${selecionados.size} como pago(s)`}
            </button>
          </div>
        </div>
      )}

      <div className="dadm-filters" role="group" aria-label="Filtros" style={{ marginTop: 10 }}>
        <input className="c360-input" type="search" placeholder="Buscar descrição..." value={filtros.q} onChange={(event) => { setFiltros({ ...filtros, q: event.target.value }); setPaginaAtual(1); }} aria-label="Buscar descrição" />
        <select className="c360-input" value={filtros.tipo} onChange={(event) => { setFiltros({ ...filtros, tipo: event.target.value }); setCardFiltroAtivo(null); setPaginaAtual(1); }} aria-label="Tipo">
          <option value="">Receitas e despesas</option>
          <option value="receita">Receitas</option>
          <option value="despesa">Despesas</option>
        </select>
        <select className="c360-input" value={filtros.status} onChange={(event) => { setFiltros({ ...filtros, status: event.target.value }); setCardFiltroAtivo(null); setPaginaAtual(1); }} aria-label="Situação">
          <option value="">Todas as situações</option>
          <option value="pendente">Pendentes</option>
          <option value="pago">Pagos</option>
          <option value="cancelado">Cancelados</option>
        </select>
        <select className="c360-input" value={filtros.categoria} onChange={(event) => { setFiltros({ ...filtros, categoria: event.target.value }); setPaginaAtual(1); }} aria-label="Categoria">
          <option value="">Todas as categorias</option>
          {todasCategorias.map((item) => <option key={item}>{item}</option>)}
        </select>
        <label className="dadm-muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          De <input className="c360-input" type="date" value={filtros.de} onChange={(event) => { setFiltros({ ...filtros, de: event.target.value }); setMesSelecionado(null); setPaginaAtual(1); }} />
        </label>
        <label className="dadm-muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          Até <input className="c360-input" type="date" value={filtros.ate} onChange={(event) => { setFiltros({ ...filtros, ate: event.target.value }); setMesSelecionado(null); setPaginaAtual(1); }} />
        </label>
      </div>

      <Table
        caption="Lançamentos financeiros"
        columns={columns}
        rows={listaPaginada}
        empty={lancamentos.length ? 'Nenhum lançamento com estes filtros.' : stallone ? 'Nenhum lançamento financeiro registrado nesta empresa.' : 'Nenhum lançamento ainda. Atendimentos pagos e comandas aparecem aqui automaticamente.'}
      />

      {/* Controles de Paginação */}
      {lista.length > 25 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--muted)' }}>
            <span>Itens por página:</span>
            <select
              className="c360-input"
              style={{ width: 'auto', padding: '4px 8px', fontSize: 12 }}
              value={itensPorPagina}
              onChange={(e) => { setItensPorPagina(Number(e.target.value)); setPaginaAtual(1); }}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={9999}>Todos ({lista.length})</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="c360-btn ghost"
              disabled={paginaAtual <= 1}
              onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
              style={{ fontSize: 12, padding: '5px 10px' }}
            >
              « Anterior
            </button>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              Página <strong>{paginaAtual}</strong> de <strong>{totalPaginas}</strong>
            </span>
            <button
              type="button"
              className="c360-btn ghost"
              disabled={paginaAtual >= totalPaginas}
              onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))}
              style={{ fontSize: 12, padding: '5px 10px' }}
            >
              Próxima »
            </button>
          </div>
        </div>
      )}
    </section>}

    {/* Modal para Editar/Criar Lançamento */}
    <Dialog open={Boolean(form)} title={form?.id ? 'Editar lançamento' : (form?.tipo === 'receita' ? 'Nova receita' : 'Nova despesa')} labelId="fin-form" onClose={() => setForm(null)} onSubmit={salvar} initialFocusRef={firstField}
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setForm(null)}>Voltar</button><button type="submit" className="c360-btn primary">Salvar</button></>}>
      {form && <div style={{ display: 'grid', gap: 12 }}>
        {form.automatico && <p className="dadm-note">Lançamento automático: só a situação e a observação podem mudar.</p>}
        {!form.automatico && <>
          <label className="c360-field">Tipo<select ref={firstField} className="c360-input" value={form.tipo} onChange={(event) => setForm({ ...form, tipo: event.target.value, categoria: 'Outros' })}><option value="despesa">Despesa</option><option value="receita">Receita</option></select></label>
          <label className="c360-field">Categoria<select className="c360-input" value={form.categoria} onChange={(event) => setForm({ ...form, categoria: event.target.value })}>{(categorias[form.tipo] || ['Outros']).map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="c360-field">Descrição<input className="c360-input" required maxLength={240} value={form.descricao} onChange={(event) => setForm({ ...form, descricao: event.target.value })} /></label>
          <label className="c360-field">Valor (R$)<input className="c360-input" required inputMode="decimal" value={form.valor} onChange={(event) => setForm({ ...form, valor: event.target.value })} /></label>
          <label className="c360-field">{form.id ? 'Vencimento' : 'Vencimento (1ª parcela)'}<input className="c360-input" type="date" required value={form.vencimento} onChange={(event) => setForm({ ...form, vencimento: event.target.value })} /></label>
          {!form.id && <label className="c360-field">Repetir<select className="c360-input" value={form.meses} onChange={(event) => setForm({ ...form, meses: Number(event.target.value) })}><option value={1}>Não repetir</option><option value={3}>Todo mês por 3 meses</option><option value={6}>Todo mês por 6 meses</option><option value={12}>Todo mês por 12 meses</option><option value={24}>Todo mês por 24 meses</option></select></label>}
          {!form.id && Number(form.meses) > 1 && <p className="dadm-muted" style={{ margin: 0 }}>Cria {form.meses} lançamentos pendentes no mesmo dia de cada mês (aluguel, internet, pró-labore…). Dá para encerrar a série depois.</p>}
        </>}
        <label className="c360-field">Situação<select ref={form.automatico ? firstField : undefined} className="c360-input" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="pendente">Pendente</option><option value="pago">Pago</option></select></label>
        <label className="c360-field">Observação<textarea className="c360-input" rows={2} maxLength={500} value={form.obs} onChange={(event) => setForm({ ...form, obs: event.target.value })} /></label>
      </div>}
    </Dialog>

    {/* Modal para Cancelamento de Lançamento */}
    <Dialog open={Boolean(cancelando)} title="Cancelar lançamento?" labelId="fin-cancel" onClose={() => setCancelando(null)} danger
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setCancelando(null)}>Voltar</button>{cancelando?.serieId && <button type="button" className="c360-btn ghost" onClick={encerrarSerie}>Encerrar série (futuras)</button>}<button type="button" className="c360-btn primary" onClick={confirmarCancelamento}>Cancelar este</button></>}>
      <p>{cancelando?.descricao} · {money(cancelando?.valor)}. O lançamento fica no histórico como cancelado e sai dos totais.</p>
    </Dialog>

    {/* Modal de Confirmação para Liquidar as 71 despesas vencidas do Avec */}
    <Dialog
      open={modalLiquidarVencidos}
      title="Liquidar todas as 71 despesas vencidas?"
      labelId="fin-liquidar-vencidos"
      onClose={() => setModalLiquidarVencidos(false)}
      actions={<>
        <button type="button" className="c360-btn ghost" onClick={() => setModalLiquidarVencidos(false)}>Voltar</button>
        <button type="button" className="c360-btn primary" onClick={confirmarLiquidarTodosVencidos} disabled={executandoLote}>
          {executandoLote ? 'Processando…' : 'Sim, marcar todas como pagas'}
        </button>
      </>}
    >
      <div style={{ display: 'grid', gap: 10 }}>
        <p>
          Você está prestes a liquidar <strong>{vencidos.length} lançamentos de despesas vencidas</strong> no valor total de <strong>{money(totalVencidos)}</strong>.
        </p>
        <p className="dadm-muted" style={{ fontSize: 13, margin: 0 }}>
          Essas despesas são registros históricos do Avec com vencimento entre 2025 e agosto/2026. Ao marcá-las como pagas, elas saem de "A pagar" e "Vencidos", e passam a integrar o histórico contábil consolidado como liquidadas.
        </p>
      </div>
    </Dialog>
  </div>
}
