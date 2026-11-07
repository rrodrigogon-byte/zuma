import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

const fmtKpi = (v) => {
  if (v == null) return '—'
  const n = Number(v || 0)
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1000000) return `${sign}R$ ${(abs / 1000000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}M`
  if (abs >= 1000) return `${sign}R$ ${(abs / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}K`
  return `${sign}R$ ${abs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const fmtR = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0))
const fmtData = s => s ? new Date(s + 'T12:00:00').toLocaleDateString('pt-BR') : '—'
const mesLabel = s => {
  if (!s || !s.includes('-')) return s || ''
  const [y, m] = s.split('-')
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${meses[parseInt(m, 10) - 1] || m}/${y}`
}

const CAT_RECEITA = ['Serviços & Cortes', 'Venda de Revenda / Bar', 'Mensalidades / Planos', 'Loja Virtual', 'Assinaturas', 'Outros']
const CAT_DESPESA = [
  'Pessoal/RH & Comissões',
  'Aluguel & Ocupação',
  'Produtos & Insumos',
  'Taxas de Cartão / Bancárias',
  'Utilities (Água/Luz)',
  'Internet & Telefonia',
  'Marketing & Tráfego',
  'Impostos/Taxas',
  'Manutenção & Equipamentos',
  'Serviços Terceiros',
  'Outros'
]

function exportCSV(rows, filename) {
  if (!rows?.length) return
  const keys = Object.keys(rows[0])
  const lines = [keys.join(';'), ...rows.map(r => keys.map(k => JSON.stringify(r[k] ?? '')).join(';'))]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const S = {
  page: { padding: '24px 28px', maxWidth: 1200, margin: '0 auto' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 },
  title: { fontSize: 24, fontWeight: 800, color: 'var(--cream)', display: 'flex', alignItems: 'center', gap: 10 },
  cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14, marginBottom: 24 },
  card: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: '16px 20px' },
  table: { width: '100%', borderCollapse: 'collapse', background: 'var(--surface)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)' },
  th: { padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--line)', background: 'rgba(0,0,0,.03)' },
  td: { padding: '12px 16px', fontSize: 13, borderBottom: '1px solid var(--line)' },
  btn: { padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 },
  inp: { padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--cream)', fontSize: 13 },
}

function KpiCard({ label, value, color, sub, icon }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12,
      padding: '16px 20px', borderLeft: `4px solid ${color || 'var(--green)'}`,
      flex: 1, minWidth: 170,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: 700 }}>{label}</div>
        {icon && <span style={{ fontSize: 18 }}>{icon}</span>}
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: color || 'var(--green)', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function Badge({ status, vencimento }) {
  const hoje = new Date().toISOString().slice(0, 10)
  const isVencido = status !== 'pago' && vencimento && vencimento < hoje
  const color = status === 'pago' ? 'var(--lime)' : isVencido ? '#ef4444' : 'var(--gold)'
  const bg = status === 'pago' ? 'rgba(34,197,94,.12)' : isVencido ? 'rgba(239,68,68,.12)' : 'rgba(245,158,11,.12)'
  const texto = status === 'pago' ? '✓ Pago' : isVencido ? '⚠ Vencido' : '⏳ Pendente'
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, color, background: bg, border: `1px solid ${color}30` }}>
      {texto}
    </span>
  )
}

function FluxoChart({ dados }) {
  if (!dados?.length) return null
  const maxVal = Math.max(...dados.map(d => Math.max(d.receitas || 0, d.despesas || 0)), 1)
  return (
    <div style={{ ...S.card, marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontWeight: 800, color: 'var(--cream)', fontSize: 14 }}>📊 Fluxo de Caixa — Últimos 12 Meses</div>
        <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--muted)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 10, height: 10, background: 'var(--green)', borderRadius: 2 }} /> Receitas</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 10, height: 10, background: '#ef4444', borderRadius: 2 }} /> Despesas</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 110, padding: '0 4px' }}>
        {dados.map(d => {
          const recH = Math.max(4, Math.round(((d.receitas || 0) / maxVal) * 90))
          const despH = Math.max(4, Math.round(((d.despesas || 0) / maxVal) * 90))
          return (
            <div key={d.mes} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', width: '100%', justifyContent: 'center' }}>
                <div title={`Receitas: ${fmtR(d.receitas)}`} style={{ width: '45%', height: `${recH}px`, background: 'var(--green)', borderRadius: '3px 3px 0 0' }} />
                <div title={`Despesas: ${fmtR(d.despesas)}`} style={{ width: '45%', height: `${despH}px`, background: '#ef4444', borderRadius: '3px 3px 0 0' }} />
              </div>
              <span style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>{mesLabel(d.mes).split('/')[0]}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Componente Oficial do DRE Gerencial ── */
function DreGerencialView({ mes, onMesChange }) {
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(false)

  const carregarDre = useCallback(async (mesAlvo) => {
    setLoading(true)
    try {
      const res = await api.get(`/api/admin/financeiro/dre?mes=${mesAlvo}`)
      setDados(res)
    } catch (e) {
      console.error('Erro ao carregar DRE:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregarDre(mes)
  }, [mes, carregarDre])

  if (loading) {
    return <div style={{ ...S.card, textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Carregando DRE Gerencial...</div>
  }

  if (!dados) return null

  const rb = dados.receitaBruta || 0
  const rl = dados.receitaLiquida || 0
  const mc = dados.margemContribuicao || 0
  const mcPct = dados.margemContribuicaoPercentual || (rb > 0 ? ((mc / rb) * 100).toFixed(1) : 0)
  const resLiq = dados.resultadoLiquido || 0
  const margemLiqPct = dados.margemLiquidaPercentual || (rb > 0 ? ((resLiq / rb) * 100).toFixed(1) : 0)
  const ebitda = dados.ebitda || 0

  const linhaDRE = (codigo, titulo, valor, cor = 'var(--cream)', negrito = false, nivel = 0, pct = null) => {
    return (
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 14px', borderBottom: '1px solid var(--line)',
        background: nivel === 0 ? 'rgba(0,0,0,.08)' : 'transparent',
        fontWeight: negrito ? 800 : 500, fontSize: nivel === 0 ? 14 : 13
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: nivel * 16 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)', width: 24 }}>{codigo}</span>
          <span style={{ color: negrito ? 'var(--cream)' : 'var(--muted)' }}>{titulo}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {pct != null && (
            <span style={{ fontSize: 11, color: 'var(--muted)', minWidth: 45, textAlign: 'right' }}>
              {pct}%
            </span>
          )}
          <span style={{ fontWeight: 800, color: cor, minWidth: 100, textAlign: 'right' }}>
            {fmtR(valor)}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 16 }}>
      {/* Barra de Ações do DRE */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--cream)' }}>Mês de Apuração:</label>
          <input
            type="month"
            value={mes}
            onChange={(e) => onMesChange(e.target.value)}
            style={{ ...S.inp, fontWeight: 700, color: 'var(--green)' }}
          />
        </div>
        <button
          onClick={() => window.print()}
          style={{ ...S.btn, background: 'rgba(255,107,44,.15)', color: 'var(--green)', border: '1px solid var(--green)' }}
        >
          🖨️ Imprimir DRE Oficial
        </button>
      </div>

      {/* Cards de Destaque Executivo do DRE */}
      <div style={{ ...S.cards, marginBottom: 16 }}>
        <KpiCard label="Receita Operacional Bruta" value={fmtR(rb)} color="var(--green)" icon="💰" sub={`Faturamento apurado em ${mesLabel(mes)}`} />
        <KpiCard label="Margem de Contribuição" value={`${mcPct}%`} color="var(--lime)" icon="📊" sub={fmtR(mc)} />
        <KpiCard label="EBITDA Operacional" value={fmtR(ebitda)} color={ebitda >= 0 ? 'var(--gold)' : '#ef4444'} icon="⚡" sub="Geração de caixa operacional" />
        <KpiCard label="Resultado Líquido" value={fmtR(resLiq)} color={resLiq >= 0 ? 'var(--green)' : '#ef4444'} icon="🏆" sub={`Margem Líquida: ${margemLiqPct}%`} />
      </div>

      {/* Tabela Estruturada do DRE */}
      <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', background: 'rgba(0,0,0,.15)', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 800, color: 'var(--cream)', fontSize: 14 }}>📋 Demonstração do Resultado do Exercício (DRE Gerencial)</span>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>Competência: {mesLabel(mes)}</span>
        </div>

        {linhaDRE('1.0', '(+) RECEITA OPERACIONAL BRUTA', rb, 'var(--green)', true, 0, 100)}
        {linhaDRE('1.1', '  Serviços de Corte & Barbearia', dados.detalhesReceita?.servicos || 0, 'var(--cream)', false, 1, rb > 0 ? (((dados.detalhesReceita?.servicos || 0) / rb) * 100).toFixed(1) : 0)}
        {linhaDRE('1.2', '  Planos, Clubes & Assinaturas', dados.detalhesReceita?.planos || 0, 'var(--cream)', false, 1, rb > 0 ? (((dados.detalhesReceita?.planos || 0) / rb) * 100).toFixed(1) : 0)}
        {linhaDRE('1.3', '  Produtos de Revenda & Bar', dados.detalhesReceita?.revenda || 0, 'var(--cream)', false, 1, rb > 0 ? (((dados.detalhesReceita?.revenda || 0) / rb) * 100).toFixed(1) : 0)}
        {linhaDRE('1.4', '  Outras Receitas Operacionais', dados.detalhesReceita?.outras || 0, 'var(--cream)', false, 1, rb > 0 ? (((dados.detalhesReceita?.outras || 0) / rb) * 100).toFixed(1) : 0)}

        {linhaDRE('2.0', '(-) DEDUÇÕES DA RECEITA BRUTA', -(dados.totalDeducoes || 0), '#ef4444', true, 0, rb > 0 ? (((dados.totalDeducoes || 0) / rb) * 100).toFixed(1) : 0)}
        {linhaDRE('2.1', '  Taxas de Cartão de Crédito/Débito (MDR)', -(dados.detalhesCustos?.taxas || 0), 'var(--muted)', false, 1)}

        {linhaDRE('3.0', '(=) RECEITA OPERACIONAL LÍQUIDA', rl, 'var(--green)', true, 0, rb > 0 ? ((rl / rb) * 100).toFixed(1) : 0)}

        {linhaDRE('4.0', '(-) CUSTOS VARIÁVEIS / SERVIÇOS PRESTADOS', -(dados.totalCustosVariaveis || 0), '#ef4444', true, 0, rb > 0 ? (((dados.totalCustosVariaveis || 0) / rb) * 100).toFixed(1) : 0)}
        {linhaDRE('4.1', '  Comissões & Repasses de Profissionais', -(dados.detalhesCustos?.comissoes || 0), 'var(--muted)', false, 1)}
        {linhaDRE('4.2', '  Consumo de Insumos & Fichas Técnicas', -(dados.detalhesCustos?.insumos || 0), 'var(--muted)', false, 1)}

        {linhaDRE('5.0', '(=) MARGEM DE CONTRIBUIÇÃO / LUCRO BRUTO', mc, mc >= 0 ? 'var(--lime)' : '#ef4444', true, 0, mcPct)}

        {linhaDRE('6.0', '(-) DESPESAS OPERACIONAIS FIXAS', -(dados.totalDespesasOperacionais || 0), '#ef4444', true, 0, rb > 0 ? (((dados.totalDespesasOperacionais || 0) / rb) * 100).toFixed(1) : 0)}
        {(dados.rankingCategorias || []).map((cat, idx) => (
          linhaDRE(`6.${idx + 1}`, `  ${cat.categoria}`, -cat.valor, 'var(--muted)', false, 1, cat.percentual)
        ))}

        {linhaDRE('7.0', '(=) EBITDA OPERACIONAL', ebitda, ebitda >= 0 ? 'var(--gold)' : '#ef4444', true, 0)}

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 18px', background: resLiq >= 0 ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)',
          borderTop: '2px solid var(--line)', marginTop: 8
        }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: 700 }}>8.0 RESULTADO LÍQUIDO FINAL</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: resLiq >= 0 ? 'var(--green)' : '#ef4444' }}>
              {resLiq >= 0 ? 'LUCRO LÍQUIDO DO EXERCÍCIO' : 'PREJUÍZO NO PERÍODO'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: resLiq >= 0 ? 'var(--green)' : '#ef4444' }}>
              {fmtR(resLiq)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Margem Líquida: {margemLiqPct}%</div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Main ── */
export default function Financeiro() {
  const { toast } = useToast()
  const [tab, setTab] = useState('resumo')
  const [lancs, setLancs] = useState([])
  const [fluxo, setFluxo] = useState([])
  const [resumo, setResumo] = useState(null)
  const [mesDRE, setMesDRE] = useState(new Date().toISOString().slice(0, 7))

  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroQ, setFiltroQ] = useState('')
  const [filtroDe, setFiltroDe] = useState('')
  const [filtroAte, setFiltroAte] = useState('')
  const [loading, setLoading] = useState(false)
  const [modalForm, setModalForm] = useState(null)
  const [form, setForm] = useState({ tipo: 'receita', categoria: 'Outros', descricao: '', valor: '', vencimento: '', obs: '', formaPagamento: 'pix' })

  const hoje = new Date().toISOString().slice(0, 10)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [l, f, r] = await Promise.all([
        api.get('/api/admin/financeiro/lancamentos'),
        api.get('/api/admin/financeiro/fluxo'),
        api.get('/api/admin/financeiro/resumo'),
      ])
      setLancs(Array.isArray(l) ? l : [])
      setFluxo(Array.isArray(f) ? f : [])
      setResumo(r || null)
    } catch (err) {
      console.error('Erro ao carregar dados financeiros:', err)
      toast('Erro ao carregar financeiro', true)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  /* filtros */
  let lista = lancs
  if (filtroTipo) lista = lista.filter(l => l.tipo === filtroTipo)
  if (filtroStatus) lista = lista.filter(l => l.status === filtroStatus)
  if (filtroCategoria) lista = lista.filter(l => l.categoria === filtroCategoria)
  if (filtroQ) lista = lista.filter(l => l.descricao?.toLowerCase().includes(filtroQ.toLowerCase()))
  if (filtroDe) lista = lista.filter(l => l.vencimento >= filtroDe)
  if (filtroAte) lista = lista.filter(l => l.vencimento <= filtroAte)

  const listaTabFiltrada = lista.filter(l => tab === 'todos' || l.tipo === (tab === 'receitas' ? 'receita' : 'despesa'))

  function limparFiltros() {
    setFiltroTipo(''); setFiltroStatus(''); setFiltroCategoria('')
    setFiltroQ(''); setFiltroDe(''); setFiltroAte('')
  }
  const temFiltro = filtroTipo || filtroStatus || filtroCategoria || filtroQ || filtroDe || filtroAte

  /* CRUD */
  async function salvar(e) {
    e.preventDefault()
    try {
      if (modalForm?.id) {
        await api.patch(`/api/admin/financeiro/lancamentos/${modalForm.id}`, form)
        toast('Lançamento atualizado')
      } else {
        await api.post('/api/admin/financeiro/lancamentos', form)
        toast('Lançamento criado com sucesso')
      }
      setModalForm(null)
      setForm({ tipo: 'receita', categoria: 'Outros', descricao: '', valor: '', vencimento: '', obs: '', formaPagamento: 'pix' })
      load()
    } catch (e) {
      toast(e.message || 'Erro ao salvar lançamento', true)
    }
  }

  async function marcarPago(id) {
    try {
      await api.patch(`/api/admin/financeiro/lancamentos/${id}`, { status: 'pago' })
      toast('Marcado como pago')
      load()
    } catch (e) {
      toast(e.message || 'Erro ao dar baixa', true)
    }
  }

  async function excluir(id) {
    if (!confirm('Deseja realmente cancelar este lançamento?')) return
    try {
      await api.delete(`/api/admin/financeiro/lancamentos/${id}`)
      toast('Lançamento cancelado')
      load()
    } catch (e) {
      toast(e.message || 'Erro ao excluir', true)
    }
  }

  function abrirEdicao(l) {
    setForm({
      tipo: l.tipo,
      categoria: l.categoria,
      descricao: l.descricao,
      valor: l.valor,
      vencimento: l.vencimento,
      obs: l.obs || '',
      formaPagamento: l.meioPagamento || 'pix'
    })
    setModalForm(l)
  }

  function abrirNovo() {
    setForm({
      tipo: tab === 'despesas' ? 'despesa' : 'receita',
      categoria: tab === 'despesas' ? 'Aluguel & Ocupação' : 'Serviços & Cortes',
      descricao: '',
      valor: '',
      vencimento: hoje,
      obs: '',
      formaPagamento: 'pix'
    })
    setModalForm({})
  }

  const cats = form.tipo === 'receita' ? CAT_RECEITA : CAT_DESPESA
  const catsDisponiveis = tab === 'receitas' ? CAT_RECEITA : tab === 'despesas' ? CAT_DESPESA : [...CAT_RECEITA, ...CAT_DESPESA]

  /* Alertas de vencimento */
  const alertasVencimento = useMemo(() => {
    const pendentes = lancs.filter(l => l.status === 'pendente' && l.vencimento)
    const seteDias = new Date()
    seteDias.setDate(seteDias.getDate() + 7)
    const limiteSemana = seteDias.toISOString().slice(0, 10)
    return {
      jáVencidos: pendentes.filter(l => l.vencimento < hoje),
      vencendoHoje: pendentes.filter(l => l.vencimento === hoje),
      vencendoSemana: pendentes.filter(l => l.vencimento > hoje && l.vencimento <= limiteSemana),
    }
  }, [lancs, hoje])

  const handleExportCSV = () => {
    const rows = listaTabFiltrada.map(l => ({
      ID: l.id,
      Tipo: l.tipo,
      Descricao: l.descricao,
      Categoria: l.categoria,
      Valor: l.valor,
      Vencimento: l.vencimento,
      Status: l.status,
      DataPagamento: l.pagoEm || '',
      Observacao: l.obs || ''
    }))
    exportCSV(rows, `financeiro-${tab}-${hoje}.csv`)
  }

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <div style={S.title}>
            <span>💳</span>
            <span>Gestão Financeira & DRE</span>
          </div>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }}>
            Contas a pagar e receber, fluxo de caixa, conciliação e resultado operacional em tempo real.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={load} style={{ ...S.btn, background: 'rgba(255,255,255,.06)', color: 'var(--cream)', border: '1px solid var(--line)' }}>
            🔄 Atualizar
          </button>
          <button onClick={abrirNovo} style={{ ...S.btn, background: 'var(--green)', color: '#fff' }}>
            + Novo Lançamento
          </button>
        </div>
      </div>

      {/* Alertas Rápidos de Vencimento */}
      {(alertasVencimento.jáVencidos.length > 0 || alertasVencimento.vencendoHoje.length > 0 || alertasVencimento.vencendoSemana.length > 0) && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
          {alertasVencimento.jáVencidos.length > 0 && (
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 8, background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.35)', cursor: 'pointer' }}
              onClick={() => { setTab('todos'); setFiltroStatus('pendente'); setFiltroAte(hoje) }}
            >
              <span>🔴</span>
              <span style={{ fontWeight: 700, color: '#ef4444', fontSize: 13 }}>{alertasVencimento.jáVencidos.length} Vencidos</span>
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>{fmtR(alertasVencimento.jáVencidos.reduce((s, l) => s + (l.valor || 0), 0))}</span>
            </div>
          )}
          {alertasVencimento.vencendoHoje.length > 0 && (
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 8, background: 'rgba(251,191,36,.12)', border: '1px solid rgba(251,191,36,.35)', cursor: 'pointer' }}
              onClick={() => { setTab('todos'); setFiltroDe(hoje); setFiltroAte(hoje) }}
            >
              <span>⚡</span>
              <span style={{ fontWeight: 700, color: '#fbbf24', fontSize: 13 }}>{alertasVencimento.vencendoHoje.length} Vencem Hoje</span>
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>{fmtR(alertasVencimento.vencendoHoje.reduce((s, l) => s + (l.valor || 0), 0))}</span>
            </div>
          )}
          {alertasVencimento.vencendoSemana.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 8, background: 'rgba(255,107,44,.07)', border: '1px solid rgba(255,107,44,.25)' }}>
              <span>📅</span>
              <span style={{ fontWeight: 700, color: 'var(--green)', fontSize: 13 }}>{alertasVencimento.vencendoSemana.length} Esta semana</span>
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>{fmtR(alertasVencimento.vencendoSemana.reduce((s, l) => s + (l.valor || 0), 0))}</span>
            </div>
          )}
        </div>
      )}

      {/* Navegação por Abas */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, borderBottom: '1px solid var(--line)' }}>
        {[
          { id: 'resumo', label: '📊 Visão Geral & Fluxo' },
          { id: 'dre', label: '📋 DRE Gerencial' },
          { id: 'receitas', label: '↑ Contas a Receber' },
          { id: 'despesas', label: '↓ Contas a Pagar' },
          { id: 'todos', label: '📑 Todos os Lançamentos' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '10px 18px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
              background: 'none', color: tab === t.id ? 'var(--green)' : 'var(--muted)',
              borderBottom: tab === t.id ? '3px solid var(--green)' : '3px solid transparent',
              transition: 'all .15s'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Resumo Geral */}
      {tab === 'resumo' && (
        <>
          {resumo && (
            <div style={S.cards}>
              <KpiCard label="Saldo Líquido Operacional" value={fmtR(resumo.saldo)} color={resumo.saldo >= 0 ? 'var(--green)' : '#ef4444'} icon="💼" sub="Receitas pagas menos despesas" />
              <KpiCard label="Receitas do Mês" value={fmtR(resumo.totalReceitas || resumo.recMes)} color="var(--green)" icon="📈" sub="Serviços, revenda e planos" />
              <KpiCard label="Despesas do Mês" value={fmtR(resumo.totalDespesas || resumo.despMes)} color="#ef4444" icon="📉" sub="Comissões e custos fixos" />
              <KpiCard label="A Receber (Pendentes)" value={fmtR(resumo.aReceber)} color="var(--gold)" icon="⏳" sub="Vendas a prazo e crediários" />
              <KpiCard label="A Pagar (Compromissos)" value={fmtR(resumo.aPagar)} color="#f87171" icon="📅" sub="Contas e fornecedores a vencer" />
            </div>
          )}

          <FluxoChart dados={fluxo} />
        </>
      )}

      {/* Tab: DRE Gerencial */}
      {tab === 'dre' && (
        <DreGerencialView mes={mesDRE} onMesChange={setMesDRE} />
      )}

      {/* Tab: Lançamentos (Receitas, Despesas, Todos) */}
      {(tab === 'receitas' || tab === 'despesas' || tab === 'todos') && (
        <>
          {/* Barra de Filtros */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: '16px', marginBottom: 18 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
              {tab === 'todos' && (
                <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={S.inp}>
                  <option value="">Tipo: Todos</option>
                  <option value="receita">↑ Apenas Receitas</option>
                  <option value="despesa">↓ Apenas Despesas</option>
                </select>
              )}
              <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={S.inp}>
                <option value="">Status: Todos</option>
                <option value="pendente">⏳ Pendente</option>
                <option value="pago">✓ Pago / Liquidado</option>
                <option value="cancelado">✕ Cancelado</option>
              </select>
              <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} style={S.inp}>
                <option value="">Categoria: Todas</option>
                {catsDisponiveis.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input
                type="text"
                placeholder="🔍 Buscar descrição ou cliente..."
                value={filtroQ}
                onChange={e => setFiltroQ(e.target.value)}
                style={{ ...S.inp, minWidth: 200, flex: 1 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <label style={{ fontSize: 12, color: 'var(--muted)' }}>De:</label>
              <input type="date" value={filtroDe} onChange={e => setFiltroDe(e.target.value)} style={S.inp} />
              <label style={{ fontSize: 12, color: 'var(--muted)' }}>Até:</label>
              <input type="date" value={filtroAte} onChange={e => setFiltroAte(e.target.value)} style={S.inp} />
              {temFiltro && (
                <button onClick={limparFiltros} style={{ ...S.btn, background: 'none', border: '1px solid var(--line)', color: 'var(--muted)' }}>✕ Limpar</button>
              )}
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}>{listaTabFiltrada.length} lançamentos encontrados</span>
              <button onClick={handleExportCSV} style={{ ...S.btn, background: 'rgba(255,107,44,.15)', color: 'var(--green)', border: '1px solid var(--green)' }}>
                📥 Exportar CSV
              </button>
            </div>
          </div>

          {/* Tabela de Lançamentos */}
          {loading ? (
            <div style={{ ...S.card, textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Carregando lançamentos...</div>
          ) : listaTabFiltrada.length === 0 ? (
            <div style={{ ...S.card, textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
              Nenhum lançamento encontrado para os filtros selecionados.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Tipo</th>
                    <th style={S.th}>Descrição</th>
                    <th style={S.th}>Categoria</th>
                    <th style={S.th}>Valor</th>
                    <th style={S.th}>Vencimento</th>
                    <th style={S.th}>Status</th>
                    <th style={S.th}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {listaTabFiltrada.map(l => (
                    <tr key={l.id} style={{ transition: 'background .15s' }}>
                      <td style={S.td}>
                        <span style={{
                          fontWeight: 800, fontSize: 11, padding: '3px 7px', borderRadius: 6,
                          color: l.tipo === 'receita' ? 'var(--green)' : '#ef4444',
                          background: l.tipo === 'receita' ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)'
                        }}>
                          {l.tipo === 'receita' ? '↑ RECEITA' : '↓ DESPESA'}
                        </span>
                      </td>
                      <td style={{ ...S.td, fontWeight: 600, color: 'var(--cream)' }}>
                        {l.descricao}
                        {l.obs && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{l.obs}</div>}
                      </td>
                      <td style={{ ...S.td, color: 'var(--muted)' }}>{l.categoria}</td>
                      <td style={{ ...S.td, fontWeight: 800, color: l.tipo === 'receita' ? 'var(--green)' : '#ef4444' }}>
                        {fmtR(l.valor)}
                      </td>
                      <td style={{ ...S.td, color: 'var(--cream)' }}>{fmtData(l.vencimento)}</td>
                      <td style={S.td}><Badge status={l.status} vencimento={l.vencimento} /></td>
                      <td style={S.td}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {l.status !== 'pago' && l.status !== 'cancelado' && (
                            <button
                              onClick={() => marcarPago(l.id)}
                              style={{ ...S.btn, padding: '5px 10px', fontSize: 11, background: 'rgba(34,197,94,.15)', color: 'var(--lime)', border: '1px solid var(--lime)' }}
                              title="Marcar como Pago"
                            >
                              ✓ Pagar
                            </button>
                          )}
                          <button
                            onClick={() => abrirEdicao(l)}
                            style={{ ...S.btn, padding: '5px 10px', fontSize: 11, background: 'rgba(255,255,255,.05)', color: 'var(--cream)', border: '1px solid var(--line)' }}
                            title="Editar"
                          >
                            ✎
                          </button>
                          <button
                            onClick={() => excluir(l.id)}
                            style={{ ...S.btn, padding: '5px 10px', fontSize: 11, background: 'rgba(239,68,68,.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,.3)' }}
                            title="Cancelar"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Modal de Criação / Edição de Lançamento */}
      {modalForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: '#1c1b18', border: '1px solid var(--line)', borderRadius: 14, width: '100%', maxWidth: 480, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, color: 'var(--cream)', fontSize: 16 }}>
                {modalForm.id ? '✎ Editar Lançamento Financeiro' : '+ Novo Lançamento Financeiro'}
              </div>
              <button onClick={() => setModalForm(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            <form onSubmit={salvar} style={{ padding: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Tipo de Operação</label>
                  <select
                    value={form.tipo}
                    onChange={e => setForm({ ...form, tipo: e.target.value, categoria: e.target.value === 'receita' ? CAT_RECEITA[0] : CAT_DESPESA[0] })}
                    style={{ ...S.inp, width: '100%' }}
                  >
                    <option value="receita">↑ Receita (Entrada)</option>
                    <option value="despesa">↓ Despesa (Saída)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Categoria</label>
                  <select
                    value={form.categoria}
                    onChange={e => setForm({ ...form, categoria: e.target.value })}
                    style={{ ...S.inp, width: '100%' }}
                  >
                    {cats.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Descrição do Lançamento *</label>
                <input
                  type="text"
                  placeholder="Ex: Fornecedor de Toalhas / Aluguel do Mês / Venda Especial"
                  value={form.descricao}
                  onChange={e => setForm({ ...form, descricao: e.target.value })}
                  style={{ ...S.inp, width: '100%' }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Valor (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={form.valor}
                    onChange={e => setForm({ ...form, valor: e.target.value })}
                    style={{ ...S.inp, width: '100%' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Data de Vencimento *</label>
                  <input
                    type="date"
                    value={form.vencimento}
                    onChange={e => setForm({ ...form, vencimento: e.target.value })}
                    style={{ ...S.inp, width: '100%' }}
                    required
                  />
                </div>
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Observações / Detalhes</label>
                <textarea
                  placeholder="Informações adicionais, nota fiscal ou comprovante..."
                  value={form.obs}
                  onChange={e => setForm({ ...form, obs: e.target.value })}
                  style={{ ...S.inp, width: '100%', height: 60, resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setModalForm(null)} style={{ ...S.btn, background: 'rgba(255,255,255,.05)', color: 'var(--cream)', border: '1px solid var(--line)' }}>
                  Cancelar
                </button>
                <button type="submit" style={{ ...S.btn, background: 'var(--green)', color: '#fff' }}>
                  {modalForm.id ? 'Salvar Alterações' : 'Criar Lançamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
