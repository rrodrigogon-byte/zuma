import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../../lib/api'
import { useToast } from '../../../hooks/useToast'
import { useAuth } from '../../../lib/auth'
import { Badge, Dialog, Table } from '../customer360/shared'
import { downloadCsv, localDay, money, shortDate } from './format'
import '../customer360.css'
import './dino-admin.css'

const BASE = '/api/admin/barbearia/financeiro'
const EMPTY_FORM = { tipo: 'despesa', categoria: 'Outros', descricao: '', valor: '', vencimento: '', status: 'pendente', obs: '', meses: 1 }
const STATUS = { pendente: { label: 'Pendente', tone: 'warning' }, pago: { label: 'Pago', tone: 'success' }, cancelado: { label: 'Cancelado', tone: 'muted' } }
const ORIGENS = { manual: 'Manual', barbearia_atendimento: 'Atendimento', barbearia_comanda: 'Comanda', barbearia_revenda: 'Revenda', comanda: 'Comanda', contas_receber: 'Conta a receber', estoque: 'Estoque', revenda: 'Revenda' }

function FlowChart({ fluxo }) {
  const max = Math.max(1, ...fluxo.flatMap((item) => [item.receitas, item.despesas]))
  return <figure className="dadm-flow" aria-label="Receitas e despesas pagas por mês">
    <div className="dadm-legend"><span><i className="s-in" />Receitas pagas</span><span><i className="s-out" />Despesas pagas</span></div>
    <div className="dadm-flow-plot">
      {fluxo.map((item) => <div key={item.mes} className="dadm-flow-col" title={`${item.mes}: receitas ${money(item.receitas)} · despesas ${money(item.despesas)} · saldo ${money(item.saldo)}`}>
        <div className="dadm-flow-bars">
          <i className="s-in" style={{ height: `${(item.receitas / max) * 100}%` }} />
          <i className="s-out" style={{ height: `${(item.despesas / max) * 100}%` }} />
        </div>
        <small>{item.mes.slice(5)}/{item.mes.slice(2, 4)}</small>
      </div>)}
    </div>
    <figcaption className="sr-only">{fluxo.map((item) => `${item.mes}: receitas ${money(item.receitas)}, despesas ${money(item.despesas)}`).join('; ')}</figcaption>
  </figure>
}

export default function FinanceiroEmpresa() {
  const { toast } = useToast()
  const { empresaAtiva } = useAuth()
  const [lancamentos, setLancamentos] = useState([])
  const [resumo, setResumo] = useState(null)
  const [fluxo, setFluxo] = useState([])
  const [categorias, setCategorias] = useState({ receita: [], despesa: [] })
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [filtros, setFiltros] = useState({ tipo: '', status: '', categoria: '', q: '', de: '', ate: '' })
  const [form, setForm] = useState(null)
  const [cancelando, setCancelando] = useState(null)
  const firstField = useRef(null)
  const hoje = localDay()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [lista, r, f, c] = await Promise.all([api.get(`${BASE}/lancamentos`), api.get(`${BASE}/resumo`), api.get(`${BASE}/fluxo`), api.get(`${BASE}/categorias`)])
      setLancamentos(Array.isArray(lista) ? lista : []); setResumo(r); setFluxo(Array.isArray(f) ? f : []); setCategorias(c || { receita: [], despesa: [] }); setErro('')
    } catch (error) { setErro(error.message || 'Não foi possível carregar o financeiro.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load, empresaAtiva?.id])

  const lista = useMemo(() => lancamentos.filter((item) => (!filtros.tipo || item.tipo === filtros.tipo)
    && (!filtros.status || item.status === filtros.status)
    && (!filtros.categoria || item.categoria === filtros.categoria)
    && (!filtros.q || `${item.descricao} ${item.observacao || ''}`.toLowerCase().includes(filtros.q.toLowerCase()))
    && (!filtros.de || item.vencimento >= filtros.de)
    && (!filtros.ate || item.vencimento <= filtros.ate)), [lancamentos, filtros])

  const vencidos = lancamentos.filter((item) => item.status === 'pendente' && item.vencimento < hoje)
  const vencendo = lancamentos.filter((item) => item.status === 'pendente' && item.vencimento >= hoje && item.vencimento <= localDay(new Date(Date.now() + 3 * 86400000)))
  const resultadoMes = resumo ? resumo.recMes - resumo.despMes : 0
  const todasCategorias = [...new Set([...(categorias.receita || []), ...(categorias.despesa || []), ...lancamentos.map((item) => item.categoria)])].filter(Boolean)

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
    try { await api.patch(`${BASE}/lancamentos/${item.id}`, { status: 'pago' }); toast('Marcado como pago.'); load() }
    catch (error) { toast(error.message, true) }
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
    downloadCsv(`financeiro_${hoje}.csv`, lista.map((item) => ({ vencimento: item.vencimento, tipo: item.tipo, categoria: item.categoria, descricao: item.descricao, valor: item.valor, status: item.status, origem: ORIGENS[item.origem] || item.origem, pago_em: item.pagoEm ? item.pagoEm.slice(0, 10) : '', observacao: item.observacao || '' })))
  }

  const columns = [
    { key: 'vencimento', label: 'Vencimento', render: (item) => <span className={item.status === 'pendente' && item.vencimento < hoje ? 'dadm-neg' : ''}>{shortDate(item.vencimento)}</span> },
    { key: 'descricao', label: 'Descrição', render: (item) => <div><strong>{item.descricao}</strong><div className="dadm-muted">{item.categoria} · {ORIGENS[item.origem] || item.origem}{item.automatico ? ' · automático' : ''}{item.serieId ? ` · mensal ${item.serieParcela}/${item.serieTotal}` : ''}</div></div> },
    { key: 'valor', label: 'Valor', align: 'right', render: (item) => <span className={item.tipo === 'receita' ? 'dadm-pos' : 'dadm-neg'}>{item.tipo === 'receita' ? '+' : '−'} {money(item.valor)}</span> },
    { key: 'status', label: 'Situação', render: (item) => <Badge tone={STATUS[item.status]?.tone}>{STATUS[item.status]?.label || item.status}</Badge> },
    { key: 'acoes', label: 'Ações', render: (item) => item.status === 'cancelado' ? <span className="dadm-muted">—</span> : <div className="dadm-actions">
      {item.status === 'pendente' && <button type="button" className="c360-btn ghost" onClick={() => marcarPago(item)}>Marcar pago</button>}
      <button type="button" className="c360-btn ghost" onClick={() => abrirEdicao(item)}>Editar</button>
      {!item.automatico && <button type="button" className="c360-btn ghost" onClick={() => setCancelando(item)}>Cancelar</button>}
    </div> },
  ]

  return <div className="dadm-page">
    <header className="dadm-head">
      <div><div className="dadm-eyebrow">Gestão · {empresaAtiva?.nome || 'Empresa'}</div><h1>Financeiro</h1><p>Contas a pagar e a receber só desta empresa. Atendimentos pagos, comandas e contas a receber entram sozinhos; aqui você lança aluguel, insumos, contas e outras despesas.</p></div>
      <div className="dadm-actions">
        <button type="button" className="c360-btn ghost" onClick={exportar} disabled={!lista.length}>Exportar CSV</button>
        <button type="button" className="c360-btn ghost" onClick={() => abrirNovo('receita')}>+ Receita</button>
        <button type="button" className="c360-btn primary" onClick={() => abrirNovo('despesa')}>+ Despesa</button>
      </div>
    </header>

    {erro && <p className="dadm-note danger" role="alert">{erro}</p>}
    {loading && !resumo ? <p className="dadm-muted">Carregando…</p> : resumo && <>
      <section className="dadm-kpis" aria-label="Resumo financeiro">
        <article><span>Saldo realizado</span><strong className={resumo.saldo >= 0 ? '' : 'dadm-neg'}>{money(resumo.saldo)}</strong><small>Receitas − despesas pagas</small></article>
        <article><span>A receber</span><strong>{money(resumo.aReceber)}</strong><small>Pendentes</small></article>
        <article><span>A pagar</span><strong>{money(resumo.aPagar)}</strong><small>Pendentes</small></article>
        <article><span>Receitas do mês</span><strong>{money(resumo.recMes)}</strong><small>Pagas em {resumo.mesAtual?.slice(5)}/{resumo.mesAtual?.slice(0, 4)}</small></article>
        <article><span>Despesas do mês</span><strong>{money(resumo.despMes)}</strong><small>Pagas no mês</small></article>
        <article className={resultadoMes < 0 ? 'is-alert' : ''}><span>Resultado do mês</span><strong>{money(resultadoMes)}</strong><small>{resumo.recMes > 0 ? `Margem ${((resultadoMes / resumo.recMes) * 100).toFixed(1)}%` : 'Sem receitas pagas'}</small></article>
        <article className={vencidos.length ? 'is-alert' : ''}><span>Vencidos</span><strong>{vencidos.length}</strong><small>{vencidos.length ? money(vencidos.reduce((sum, item) => sum + item.valor, 0)) : 'Nada atrasado'}</small></article>
      </section>
      {vencendo.length > 0 && <p className="dadm-note warn">{vencendo.length} lançamento(s) vencem nos próximos 3 dias: {vencendo.slice(0, 3).map((item) => `${item.descricao} (${money(item.valor)})`).join(', ')}{vencendo.length > 3 ? '…' : ''}</p>}
      <section className="dadm-card"><h2>Fluxo dos últimos 12 meses</h2><FlowChart fluxo={fluxo} /></section>
    </>}

    <section className="dadm-card">
      <h2>Lançamentos</h2>
      <div className="dadm-filters" role="group" aria-label="Filtros">
        <input className="c360-input" type="search" placeholder="Buscar descrição" value={filtros.q} onChange={(event) => setFiltros({ ...filtros, q: event.target.value })} aria-label="Buscar descrição" />
        <select className="c360-input" value={filtros.tipo} onChange={(event) => setFiltros({ ...filtros, tipo: event.target.value })} aria-label="Tipo"><option value="">Receitas e despesas</option><option value="receita">Receitas</option><option value="despesa">Despesas</option></select>
        <select className="c360-input" value={filtros.status} onChange={(event) => setFiltros({ ...filtros, status: event.target.value })} aria-label="Situação"><option value="">Todas as situações</option><option value="pendente">Pendentes</option><option value="pago">Pagos</option><option value="cancelado">Cancelados</option></select>
        <select className="c360-input" value={filtros.categoria} onChange={(event) => setFiltros({ ...filtros, categoria: event.target.value })} aria-label="Categoria"><option value="">Todas as categorias</option>{todasCategorias.map((item) => <option key={item}>{item}</option>)}</select>
        <label className="dadm-muted">De <input className="c360-input" type="date" value={filtros.de} onChange={(event) => setFiltros({ ...filtros, de: event.target.value })} /></label>
        <label className="dadm-muted">Até <input className="c360-input" type="date" value={filtros.ate} onChange={(event) => setFiltros({ ...filtros, ate: event.target.value })} /></label>
      </div>
      <Table caption="Lançamentos financeiros" columns={columns} rows={lista} empty={lancamentos.length ? 'Nenhum lançamento com estes filtros.' : 'Nenhum lançamento ainda. Atendimentos pagos e comandas aparecem aqui automaticamente.'} />
    </section>

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

    <Dialog open={Boolean(cancelando)} title="Cancelar lançamento?" labelId="fin-cancel" onClose={() => setCancelando(null)} danger
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setCancelando(null)}>Voltar</button>{cancelando?.serieId && <button type="button" className="c360-btn ghost" onClick={encerrarSerie}>Encerrar série (futuras)</button>}<button type="button" className="c360-btn primary" onClick={confirmarCancelamento}>Cancelar este</button></>}>
      <p>{cancelando?.descricao} · {money(cancelando?.valor)}. O lançamento fica no histórico como cancelado e sai dos totais.</p>
    </Dialog>
  </div>
}
