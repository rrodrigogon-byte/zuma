import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../../lib/api'
import { useToast } from '../../../hooks/useToast'
import { useAuth } from '../../../lib/auth'
import { lojasDaEmpresa } from '../../../lib/context-selection'
import { Badge, Dialog, Table } from '../customer360/shared'
import { downloadCsv, localDay, money, shortDate, dateTime } from '../dino/format'
import Conciliacao from './Conciliacao'
import '../customer360.css'
import '../dino/dino-admin.css'

// Financeiro da empresa sobre o razão único: tudo o que entra e sai, de todos os módulos, por
// empresa e unidade. Abas: visão geral, lançamentos, a pagar, a receber, DRE, fechamento do dia
// e ajustes (categorias, centros de custo e de onde vêm os lançamentos).
const BASE = '/api/admin/razao'
const ABAS = [
  ['geral', 'Visão geral'], ['lancamentos', 'Lançamentos'], ['pagar', 'A pagar'], ['receber', 'A receber'],
  ['dre', 'DRE'], ['fechamento', 'Fechamento do dia'], ['conciliacao', 'Conciliação bancária'], ['ajustes', 'Ajustes'],
]
const STATUS = { pendente: { label: 'Pendente', tone: 'warning' }, pago: { label: 'Pago', tone: 'success' }, cancelado: { label: 'Cancelado', tone: 'muted' } }
const ORIGENS = {
  manual: 'Manual', bar_comanda: 'Bar', clube_pagamento: 'Clube', a2_conta: 'Conta de cliente', loja_online: 'Loja online',
  estorno: 'Estorno', barbearia_atendimento: 'Atendimento', legado_barbearia_atendimento: 'Atendimento',
  legado_barbearia_comanda: 'Comanda', legado_barbearia_revenda: 'Revenda', legado_manual: 'Manual (antigo)', compra: 'Compra', perda: 'Perda',
}
const FONTES = { bar: 'Bar e restaurante', clube: 'Clube (mensalidades e Pix)', a2: 'Contas de clientes', loja_online: 'Loja online', json: 'Financeiro antigo (barbearia)' }
const MEIOS = [['', '—'], ['dinheiro', 'Dinheiro'], ['pix', 'Pix'], ['credito', 'Crédito'], ['debito', 'Débito'], ['boleto', 'Boleto'], ['transferencia', 'Transferência'], ['outro', 'Outro']]
const origem = (item) => ORIGENS[item.origem] || (String(item.origem || '').startsWith('legado_') ? 'Antigo' : item.origem)
const EMPTY = { tipo: 'despesa', categoria: 'Outros', descricao: '', valor: '', vencimento: '', competencia: '', status: 'pendente', meioPagamento: '', contraparteNome: '', contraparteId: '', documento: '', centroCustoId: '', lojaId: '', observacao: '', meses: 1, parcelarTotal: false, ratear: false, rateio: [] }

/** Soma dos percentuais do rateio (para mostrar e validar antes de enviar). */
export const somaRateio = (rateio = []) => Math.round(rateio.reduce((t, r) => t + (Number(String(r.percentual).replace(',', '.')) || 0), 0) * 100) / 100

function primeiroDia(hoje) { return `${hoje.slice(0, 7)}-01` }
function ultimoDia(hoje) { const [a, m] = hoje.split('-').map(Number); return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10) }

function Fluxo({ fluxo }) {
  const max = Math.max(1, ...fluxo.flatMap((item) => [item.receitas, item.despesas]))
  return <figure className="dadm-flow" aria-label="Receitas e despesas pagas por mês">
    <div className="dadm-legend"><span><i className="s-in" />Recebido</span><span><i className="s-out" />Pago</span></div>
    <div className="dadm-flow-plot">
      {fluxo.map((item) => <div key={item.mes} className="dadm-flow-col" title={`${item.mes}: recebido ${money(item.receitas)} · pago ${money(item.despesas)} · saldo ${money(item.saldo)}`}>
        <div className="dadm-flow-bars"><i className="s-in" style={{ height: `${(item.receitas / max) * 100}%` }} /><i className="s-out" style={{ height: `${(item.despesas / max) * 100}%` }} /></div>
        <small>{item.mes.slice(5)}/{item.mes.slice(2, 4)}</small>
      </div>)}
    </div>
    <figcaption className="sr-only">{fluxo.map((item) => `${item.mes}: recebido ${money(item.receitas)}, pago ${money(item.despesas)}`).join('; ')}</figcaption>
  </figure>
}

export default function FinanceiroRazao({ abaInicial = 'geral' }) {
  const { toast } = useToast()
  const { empresaAtiva, lojaAtiva, lojasAcessiveis, isPlatformAdmin } = useAuth()
  const [fornecedores, setFornecedores] = useState([])
  const lojas = useMemo(() => lojasDaEmpresa(lojasAcessiveis, empresaAtiva?.id), [lojasAcessiveis, empresaAtiva?.id])
  const nomeLoja = useCallback((id) => (id ? (lojas.find((l) => String(l.id) === String(id))?.nome || 'Outra unidade') : 'Sem unidade'), [lojas])
  const [aba, setAba] = useState(abaInicial)
  // '' = empresa toda; 'sem' = só lançamentos sem unidade; uuid = uma unidade
  const [unidade, setUnidade] = useState(() => (lojaAtiva?.id && lojas.length > 1 ? lojaAtiva.id : ''))
  const [resumo, setResumo] = useState(null)
  // "hoje" no fuso da empresa (vem do servidor); até carregar, o dia do aparelho
  const hoje = resumo?.hoje || localDay()
  const [fluxo, setFluxo] = useState([])
  const [lancamentos, setLancamentos] = useState([])
  const [categorias, setCategorias] = useState({ receita: [], despesa: [], grupos: {} })
  const [centros, setCentros] = useState([])
  const [filtros, setFiltros] = useState({ tipo: '', status: '', categoria: '', origem: '', q: '', de: '', ate: '' })
  const [dre, setDre] = useState(null)
  const [periodo, setPeriodo] = useState({ de: primeiroDia(hoje), ate: ultimoDia(hoje) })
  const [previa, setPrevia] = useState(null)
  const [fechamentos, setFechamentos] = useState([])
  const [estado, setEstado] = useState(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [form, setForm] = useState(null)
  const [acao, setAcao] = useState(null) // { tipo: 'cancelar'|'estornar'|'baixar', item }
  const primeiroCampo = useRef(null)

  const qs = useCallback((extra = {}) => {
    const p = new URLSearchParams()
    if (unidade) p.set('lojaId', unidade)
    for (const [k, v] of Object.entries(extra)) if (v !== '' && v != null) p.set(k, v)
    const s = p.toString()
    return s ? `?${s}` : ''
  }, [unidade])

  // A pagar / A receber: o servidor filtra os pendentes (todos, do mais antigo ao mais novo);
  // nenhuma conta vencida some por estar além dos lançamentos mais recentes.
  const consultaLancamentos = aba === 'pagar' ? { tipo: 'despesa', status: 'pendente', limite: 2000 }
    : aba === 'receber' ? { tipo: 'receita', status: 'pendente', limite: 2000 } : { limite: 1000 }
  const chaveConsulta = JSON.stringify(consultaLancamentos)
  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const [r, f, l, c, cc] = await Promise.all([
        api.get(`${BASE}/resumo${qs()}`), api.get(`${BASE}/fluxo${qs()}`), api.get(`${BASE}/lancamentos${qs(JSON.parse(chaveConsulta))}`),
        api.get(`${BASE}/categorias`), api.get(`${BASE}/centros-custo`),
      ])
      setResumo(r); setFluxo(Array.isArray(f) ? f : []); setLancamentos(Array.isArray(l) ? l : []); setCategorias(c || { receita: [], despesa: [], grupos: {} }); setCentros(cc?.centros || []); setErro('')
    } catch (error) { setErro(error.message || 'Não foi possível carregar o Financeiro.') }
    finally { setCarregando(false) }
  }, [qs, chaveConsulta])
  useEffect(() => { carregar() }, [carregar, empresaAtiva?.id])

  const carregarDre = useCallback(async () => {
    try { setDre(await api.get(`${BASE}/dre${qs({ de: periodo.de, ate: periodo.ate })}`)) }
    catch (error) { toast(error.message || 'Não foi possível montar o DRE.', 'error') }
  }, [qs, periodo, toast])
  const carregarFechamento = useCallback(async () => {
    try {
      const [p, h] = await Promise.all([api.get(`${BASE}/fechamentos/previa${qs({ data: hoje })}`), api.get(`${BASE}/fechamentos${qs()}`)])
      setPrevia(p); setFechamentos(h?.fechamentos || [])
    } catch (error) { toast(error.message || 'Não foi possível carregar o fechamento.', 'error') }
  }, [qs, hoje, toast])
  const carregarEstado = useCallback(async () => {
    try { setEstado(await api.get(`${BASE}/estado`)) } catch { setEstado(null) }
  }, [])
  useEffect(() => { if (aba === 'dre') carregarDre() }, [aba, carregarDre])
  useEffect(() => { if (aba === 'fechamento') carregarFechamento() }, [aba, carregarFechamento])
  useEffect(() => { if (aba === 'ajustes' || aba === 'fechamento') carregarEstado() }, [aba, carregarEstado])

  const visiveis = useMemo(() => {
    const base = aba === 'pagar' ? lancamentos.filter((i) => i.tipo === 'despesa' && i.status === 'pendente')
      : aba === 'receber' ? lancamentos.filter((i) => i.tipo === 'receita' && i.status === 'pendente')
        : lancamentos
    const q = filtros.q.trim().toLowerCase()
    return base.filter((i) => (!filtros.tipo || i.tipo === filtros.tipo) && (!filtros.status || i.status === filtros.status)
      && (!filtros.categoria || i.categoria === filtros.categoria) && (!filtros.origem || origem(i) === filtros.origem)
      && (!filtros.de || i.vencimento >= filtros.de) && (!filtros.ate || i.vencimento <= filtros.ate)
      && (!q || `${i.descricao} ${i.contraparteNome || ''} ${i.documento || ''}`.toLowerCase().includes(q)))
      .sort((a, b) => (aba === 'pagar' || aba === 'receber' ? a.vencimento.localeCompare(b.vencimento) : b.vencimento.localeCompare(a.vencimento)))
  }, [lancamentos, filtros, aba])
  const origensPresentes = useMemo(() => [...new Set(lancamentos.map(origem))].sort(), [lancamentos])
  const totalVisivel = useMemo(() => visiveis.filter((i) => i.status !== 'cancelado').reduce((s, i) => s + (i.tipo === 'receita' ? i.valor : -i.valor), 0), [visiveis])

  // fornecedores do cadastro único (A2): a conta a pagar fica ligada a eles
  useEffect(() => {
    if (!form || form.tipo !== 'despesa' || fornecedores.length) return
    api.get('/api/admin/a2/fornecedores').then((r) => setFornecedores(Array.isArray(r) ? r : r?.fornecedores || [])).catch(() => setFornecedores([]))
  }, [form, fornecedores.length])
  function escolherContraparte(nome) {
    const f = form.tipo === 'despesa' ? fornecedores.find((x) => String(x.nome || x.razaoSocial || '').toLowerCase() === nome.trim().toLowerCase()) : null
    setForm({ ...form, contraparteNome: nome, contraparteId: f?.id || '', contraparteTipo: f ? 'fornecedor' : (form.tipo === 'despesa' ? 'fornecedor' : 'cliente') })
  }
  function abrirNovo(tipo) {
    setForm({ ...EMPTY, tipo, vencimento: hoje, status: 'pendente', lojaId: unidade && unidade !== 'sem' ? unidade : (lojas.length === 1 ? lojas[0].id : '') })
    setTimeout(() => primeiroCampo.current?.focus(), 30)
  }
  function abrirEdicao(item) {
    setForm({ ...EMPTY, ...item, valor: String(item.valor), competencia: item.competencia, observacao: item.observacao || '', meioPagamento: item.meioPagamento || '', centroCustoId: item.centroCustoId || '', lojaId: item.lojaId || '', ratear: Boolean(item.rateio?.length), rateio: (item.rateio || []).map((r) => ({ ...r, percentual: String(r.percentual) })) })
  }
  async function salvar() {
    try {
      const rateio = form.ratear ? form.rateio.filter((r) => r.centroCustoId).map((r) => ({ centroCustoId: r.centroCustoId, percentual: Number(String(r.percentual).replace(',', '.')) })) : []
      if (form.ratear && somaRateio(form.rateio) !== 100) { toast('O rateio precisa somar 100%.', 'error'); return }
      const { ratear: _r, rateio: _ra, ...resto } = form
      const corpo = { ...resto, lojaId: form.lojaId || null, centroCustoId: form.ratear ? null : (form.centroCustoId || null), meioPagamento: form.meioPagamento || null, contraparteId: form.contraparteId || null, contraparteTipo: form.contraparteNome ? (form.contraparteTipo || (form.tipo === 'despesa' ? 'fornecedor' : 'cliente')) : null, rateio }
      if (form.id) {
        const editavel = form.automatico
          ? { lojaId: corpo.lojaId, centroCustoId: corpo.centroCustoId, categoria: corpo.categoria, documento: corpo.documento, observacao: corpo.observacao, rateio }
          : { lojaId: corpo.lojaId, centroCustoId: corpo.centroCustoId, categoria: corpo.categoria, documento: corpo.documento, observacao: corpo.observacao, descricao: corpo.descricao, valor: corpo.valor, vencimento: corpo.vencimento, competencia: corpo.competencia, contraparteNome: corpo.contraparteNome, meioPagamento: corpo.meioPagamento, rateio }
        await api.patch(`${BASE}/lancamentos/${form.id}`, editavel)
        toast('Lançamento atualizado.', 'success')
      } else {
        const criados = await api.post(`${BASE}/lancamentos`, { ...corpo, meses: Number(corpo.meses) || 1, parcelarTotal: Number(corpo.meses) > 1 && form.parcelarTotal === true })
        toast(criados.length > 1 ? `${criados.length} parcelas criadas.` : 'Lançamento criado.', 'success')
      }
      setForm(null); carregar()
    } catch (error) { toast(error.message || 'Não foi possível salvar.', 'error') }
  }
  async function confirmarAcao(dados = {}) {
    const { tipo, item } = acao
    try {
      if (tipo === 'baixar') await api.post(`${BASE}/lancamentos/${item.id}/baixar`, { meioPagamento: dados.meioPagamento || null, pagoEm: dados.pagoEm || undefined })
      if (tipo === 'cancelar') await api.post(`${BASE}/lancamentos/${item.id}/cancelar`, { motivo: dados.motivo })
      if (tipo === 'estornar') await api.post(`${BASE}/lancamentos/${item.id}/estornar`, { motivo: dados.motivo })
      if (tipo === 'serie') await api.post(`${BASE}/series/${item.serieId}/cancelar`, { motivo: dados.motivo })
      toast({ baixar: 'Baixa registrada.', cancelar: 'Lançamento cancelado.', estornar: 'Estorno registrado.', serie: 'Parcelas pendentes canceladas.' }[tipo], 'success')
      setAcao(null); carregar()
    } catch (error) { toast(error.message || 'Não foi possível concluir.', 'error') }
  }
  async function fecharDia() {
    try {
      await api.post(`${BASE}/fechamentos${qs()}`, { data: hoje, lojaId: unidade || undefined })
      toast('Dia fechado.', 'success'); carregarFechamento()
    } catch (error) { toast(error.message || 'Não foi possível fechar o dia.', 'error') }
  }
  async function sincronizar() {
    try { const r = await api.post(`${BASE}/sincronizar`, {}); toast(`Fontes relidas: ${(r.fontes || []).filter((f) => f.inseridos).reduce((s, f) => s + f.inseridos, 0)} lançamento(s) novos.`, 'success'); carregarEstado(); carregar() }
    catch (error) { toast(error.message || 'Não foi possível reler as fontes.', 'error') }
  }
  function exportar() {
    downloadCsv(`financeiro_${aba}_${hoje}.csv`, visiveis.map((i) => ({ vencimento: i.vencimento, competencia: i.competencia, tipo: i.tipo, unidade: nomeLoja(i.lojaId), categoria: i.categoria, descricao: i.descricao, contraparte: i.contraparteNome || '', valor: i.valor, situacao: i.status, pago_em: i.pagoEm ? i.pagoEm.slice(0, 10) : '', meio: i.meioPagamento || '', origem: origem(i), documento: i.documento || '', observacao: i.observacao || '' })))
  }

  const colunas = [
    { key: 'vencimento', label: 'Vencimento', render: (i) => <span className={i.status === 'pendente' && i.vencimento < hoje ? 'dadm-neg' : ''}>{shortDate(i.vencimento)}</span> },
    { key: 'descricao', label: 'Descrição', render: (i) => <div><strong>{i.descricao}</strong><div className="dadm-muted">{i.categoria} · {origem(i)}{i.contraparteNome ? ` · ${i.contraparteNome}` : ''}{!unidade || unidade === 'sem' ? ` · ${nomeLoja(i.lojaId)}` : ''}{i.automatico ? ' · automático' : ''}{i.estornoDe ? ' · estorno' : ''}</div></div> },
    { key: 'valor', label: 'Valor', align: 'right', render: (i) => <span className={i.tipo === 'receita' ? 'dadm-pos' : 'dadm-neg'}>{i.tipo === 'receita' ? '+' : '−'} {money(i.valor)}</span> },
    { key: 'status', label: 'Situação', render: (i) => <Badge tone={STATUS[i.status]?.tone}>{STATUS[i.status]?.label || i.status}</Badge> },
    { key: 'acoes', label: 'Ações', render: (i) => i.status === 'cancelado' ? <span className="dadm-muted">—</span> : <div className="dadm-actions">
      {i.status === 'pendente' && <button type="button" className="c360-btn ghost" onClick={() => setAcao({ tipo: 'baixar', item: i })}>{i.tipo === 'receita' ? 'Receber' : 'Pagar'}</button>}
      <button type="button" className="c360-btn ghost" onClick={() => abrirEdicao(i)}>Editar</button>
      {!i.automatico && i.status === 'pendente' && <button type="button" className="c360-btn ghost" onClick={() => setAcao({ tipo: 'cancelar', item: i })}>Cancelar</button>}
      {i.status === 'pago' && !i.estornoDe && <button type="button" className="c360-btn ghost" onClick={() => setAcao({ tipo: 'estornar', item: i })}>Estornar</button>}
      {i.serieId && i.status === 'pendente' && !i.automatico && <button type="button" className="c360-btn ghost" onClick={() => setAcao({ tipo: 'serie', item: i })}>Cancelar série</button>}
    </div> },
  ]

  const filtrosUi = <div className="dadm-filters" role="group" aria-label="Filtros">
    <input className="c360-input" type="search" placeholder="Buscar descrição, cliente ou fornecedor" value={filtros.q} onChange={(e) => setFiltros({ ...filtros, q: e.target.value })} aria-label="Buscar" />
    {aba === 'lancamentos' && <select className="c360-input" value={filtros.tipo} onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })} aria-label="Tipo"><option value="">Receitas e despesas</option><option value="receita">Receitas</option><option value="despesa">Despesas</option></select>}
    {aba === 'lancamentos' && <select className="c360-input" value={filtros.status} onChange={(e) => setFiltros({ ...filtros, status: e.target.value })} aria-label="Situação"><option value="">Todas as situações</option><option value="pendente">Pendentes</option><option value="pago">Pagos</option><option value="cancelado">Cancelados</option></select>}
    <select className="c360-input" value={filtros.categoria} onChange={(e) => setFiltros({ ...filtros, categoria: e.target.value })} aria-label="Categoria"><option value="">Todas as categorias</option>{[...new Set([...categorias.receita, ...categorias.despesa])].sort().map((c) => <option key={c}>{c}</option>)}</select>
    <select className="c360-input" value={filtros.origem} onChange={(e) => setFiltros({ ...filtros, origem: e.target.value })} aria-label="Origem"><option value="">Todas as origens</option>{origensPresentes.map((o) => <option key={o}>{o}</option>)}</select>
    <label className="dadm-muted">De <input className="c360-input" type="date" value={filtros.de} onChange={(e) => setFiltros({ ...filtros, de: e.target.value })} /></label>
    <label className="dadm-muted">Até <input className="c360-input" type="date" value={filtros.ate} onChange={(e) => setFiltros({ ...filtros, ate: e.target.value })} /></label>
  </div>

  const vencidos = aba === 'pagar' ? visiveis.filter((i) => i.vencimento < hoje) : aba === 'receber' ? visiveis.filter((i) => i.vencimento < hoje) : []

  return <div className="dadm-page">
    <header className="dadm-head">
      <div><div className="dadm-eyebrow">Gestão · {empresaAtiva?.nome || 'Empresa'}</div><h1>Financeiro</h1>
        <p>Tudo o que entra e sai desta empresa num lugar só: atendimentos, comandas do bar, mensalidades, loja online, contas de clientes e o que você lança aqui.</p></div>
      <div className="dadm-actions">
        <label className="dadm-muted">Unidade{' '}
          <select className="c360-input" value={unidade} onChange={(e) => setUnidade(e.target.value)} aria-label="Unidade">
            <option value="">Empresa toda</option>
            {lojas.map((l) => <option key={l.id} value={l.id}>{l.codigo ? `${l.codigo} · ` : ''}{l.nome}</option>)}
            <option value="sem">Sem unidade definida</option>
          </select>
        </label>
        <button type="button" className="c360-btn ghost" onClick={exportar} disabled={!visiveis.length}>Exportar CSV</button>
        <button type="button" className="c360-btn ghost" onClick={() => abrirNovo('receita')}>+ Receita</button>
        <button type="button" className="c360-btn primary" onClick={() => abrirNovo('despesa')}>+ Despesa</button>
      </div>
    </header>

    <div className="dadm-tabs" role="tablist" aria-label="Seções do Financeiro">
      {ABAS.map(([id, rotulo]) => <button key={id} type="button" role="tab" aria-selected={aba === id} onClick={() => setAba(id)}>{rotulo}</button>)}
    </div>

    {erro && <p className="dadm-note danger" role="alert">{erro}</p>}
    {carregando && !resumo && <p className="dadm-muted">Carregando…</p>}

    {aba === 'geral' && resumo && <>
      <section className="dadm-kpis" aria-label="Resumo financeiro">
        <article><span>Saldo realizado</span><strong className={resumo.saldo >= 0 ? '' : 'dadm-neg'}>{money(resumo.saldo)}</strong><small>Tudo o que foi recebido − pago</small></article>
        <article><span>A receber</span><strong>{money(resumo.aReceber)}</strong><small>{resumo.receberVencidos ? `${resumo.receberVencidos} vencido(s): ${money(resumo.receberVencidosValor)}` : 'Nada vencido'}</small></article>
        <article className={resumo.pagarVencidos ? 'is-alert' : ''}><span>A pagar</span><strong>{money(resumo.aPagar)}</strong><small>{resumo.pagarVencidos ? `${resumo.pagarVencidos} vencido(s): ${money(resumo.pagarVencidosValor)}` : 'Nada vencido'}</small></article>
        <article><span>Recebido no mês</span><strong>{money(resumo.recMes)}</strong><small>{resumo.mesAtual?.slice(5)}/{resumo.mesAtual?.slice(0, 4)}</small></article>
        <article><span>Pago no mês</span><strong>{money(resumo.despMes)}</strong><small>Despesas pagas</small></article>
        <article className={resumo.resultadoMes < 0 ? 'is-alert' : ''}><span>Resultado do mês</span><strong>{money(resumo.resultadoMes)}</strong><small>{resumo.recMes > 0 ? `Margem ${((resumo.resultadoMes / resumo.recMes) * 100).toFixed(1).replace('.', ',')}%` : 'Sem recebimentos'}</small></article>
      </section>
      {resumo.vencendo3Dias > 0 && <p className="dadm-note warn">{resumo.vencendo3Dias} conta(s) vencem nos próximos 3 dias. Veja nas abas A pagar e A receber.</p>}
      {resumo.semUnidade > 0 && !unidade && lojas.length > 1 && <p className="dadm-note">{resumo.semUnidade} lançamento(s) ainda sem unidade. Edite para atribuir, ou filtre por “Sem unidade definida”.</p>}
      <section className="dadm-card"><h2>Recebido e pago nos últimos 12 meses</h2><Fluxo fluxo={fluxo} /></section>
    </>}

    {['lancamentos', 'pagar', 'receber'].includes(aba) && <section className="dadm-card">
      <h2>{aba === 'pagar' ? 'Contas a pagar' : aba === 'receber' ? 'Contas a receber' : 'Lançamentos'}</h2>
      {filtrosUi}
      {vencidos.length > 0 && <p className="dadm-note danger">{vencidos.length} vencida(s), somando {money(vencidos.reduce((s, i) => s + i.valor, 0))}.</p>}
      <p className="dadm-muted" style={{ margin: '6px 0' }}>{visiveis.length} lançamento(s) · saldo da lista {money(totalVisivel)}</p>
      <Table caption="Lançamentos financeiros" columns={colunas} rows={visiveis} empty={lancamentos.length ? 'Nada com estes filtros.' : 'Nenhum lançamento ainda. Vendas, mensalidades e pedidos pagos aparecem aqui sozinhos.'} />
    </section>}

    {aba === 'dre' && <section className="dadm-card">
      <h2>Demonstrativo de resultado (por competência)</h2>
      <div className="dadm-filters">
        <label className="dadm-muted">De <input className="c360-input" type="date" value={periodo.de} onChange={(e) => setPeriodo({ ...periodo, de: e.target.value })} /></label>
        <label className="dadm-muted">Até <input className="c360-input" type="date" value={periodo.ate} onChange={(e) => setPeriodo({ ...periodo, ate: e.target.value })} /></label>
      </div>
      {!dre ? <p className="dadm-muted">Carregando…</p> : <table className="c360-table" style={{ marginTop: 12 }}>
        <caption className="sr-only">DRE do período</caption>
        <tbody>
          {dre.grupos.filter((g) => g.linhas.length || ['receita_bruta', 'cmv'].includes(g.grupo)).map((g) => <FragmentoDre key={g.grupo} grupo={g} />)}
          <tr><th scope="row">Receita líquida</th><td className="num"><strong>{money(dre.receitaLiquida)}</strong></td></tr>
          <tr><th scope="row">Lucro bruto</th><td className="num"><strong>{money(dre.lucroBruto)}</strong></td></tr>
          <tr><th scope="row">Resultado operacional</th><td className="num"><strong>{money(dre.resultadoOperacional)}</strong></td></tr>
          <tr><th scope="row">Resultado líquido</th><td className={`num ${dre.resultadoLiquido < 0 ? 'dadm-neg' : 'dadm-pos'}`}><strong>{money(dre.resultadoLiquido)}</strong>{dre.margemLiquida != null && <small className="dadm-muted"> · margem {String(dre.margemLiquida).replace('.', ',')}%</small>}</td></tr>
        </tbody>
      </table>}
      {dre?.perdasEstoque && <p className="dadm-note">Perdas e diferenças de estoque no período (custo, já descontadas as sobras): <strong>{money(dre.perdasEstoque.valor)}</strong>. Já estão dentro das compras do CMV; o valor aparece aqui para acompanhamento.</p>}
    </section>}

    {aba === 'fechamento' && <section className="dadm-card">
      <h2>Fechamento do dia · {shortDate(hoje)}{unidade && unidade !== 'sem' ? ` · ${nomeLoja(unidade)}` : ' · empresa toda'}</h2>
      {!previa ? <p className="dadm-muted">Carregando…</p> : <>
        <section className="dadm-kpis" aria-label="Totais do dia">
          <article><span>Recebido hoje</span><strong>{money(previa.recebido)}</strong><small>{Object.entries(previa.recebidoPorMeio).map(([m, v]) => `${m}: ${money(v)}`).join(' · ') || 'Nada recebido'}</small></article>
          <article><span>Pago hoje</span><strong>{money(previa.pago)}</strong><small>{Object.entries(previa.pagoPorMeio).map(([m, v]) => `${m}: ${money(v)}`).join(' · ') || 'Nada pago'}</small></article>
          <article><span>Saldo do dia</span><strong className={previa.saldoDoDia < 0 ? 'dadm-neg' : ''}>{money(previa.saldoDoDia)}</strong><small>{previa.lancamentos} lançamento(s)</small></article>
          <article className={previa.vencidosAteHoje.receber || previa.vencidosAteHoje.pagar ? 'is-alert' : ''}><span>Vencidos até hoje</span><strong>{previa.vencidosAteHoje.receber + previa.vencidosAteHoje.pagar}</strong><small>Receber {money(previa.vencidosAteHoje.receberValor)} · pagar {money(previa.vencidosAteHoje.pagarValor)}</small></article>
        </section>
        <div className="dadm-actions" style={{ marginTop: 12 }}><button type="button" className="c360-btn primary" onClick={fecharDia} disabled={unidade === 'sem' || fechamentos.some((f) => f.data === hoje && (f.lojaId || '') === (unidade && unidade !== 'sem' ? unidade : (estado?.lojaRestrita || '')))} title={unidade === 'sem' ? 'Escolha uma unidade ou a empresa toda' : ''}>Fechar o dia</button></div>
      </>}
      <h3 style={{ marginTop: 18 }}>Dias fechados</h3>
      <Table caption="Fechamentos" rows={fechamentos} empty="Nenhum dia fechado ainda." columns={[
        { key: 'data', label: 'Dia', render: (f) => shortDate(f.data) },
        { key: 'loja', label: 'Unidade', render: (f) => (f.lojaId ? nomeLoja(f.lojaId) : 'Empresa toda') },
        { key: 'recebido', label: 'Recebido', align: 'right', render: (f) => money(f.totais?.recebido) },
        { key: 'pago', label: 'Pago', align: 'right', render: (f) => money(f.totais?.pago) },
        { key: 'resp', label: 'Responsável', render: (f) => `${f.responsavel} · ${dateTime(f.criadoEm)}` },
      ]} />
    </section>}

    {aba === 'conciliacao' && <Conciliacao categorias={categorias} toast={toast} onMudou={carregar} />}
    {aba === 'ajustes' && <Ajustes categorias={categorias} centros={centros} estado={estado} onSincronizar={sincronizar} onMudou={carregar} toast={toast} lojas={lojas} empresaId={empresaAtiva?.id} plataforma={isPlatformAdmin} />}

    <Dialog open={Boolean(form)} title={form?.id ? 'Editar lançamento' : (form?.tipo === 'receita' ? 'Nova receita' : 'Nova despesa')} labelId="razao-form" onClose={() => setForm(null)} onSubmit={salvar}
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setForm(null)}>Voltar</button><button type="submit" className="c360-btn primary">Salvar</button></>}>
      {form && <div style={{ display: 'grid', gap: 12 }}>
        {form.automatico && <p className="dadm-note">Lançamento automático ({origem(form)}): valor, datas e descrição vêm do módulo de origem. Para corrigir valor, use Estornar.</p>}
        {!form.automatico && !form.id && <label className="c360-field">Tipo<select ref={primeiroCampo} className="c360-input" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value, categoria: 'Outros' })}><option value="despesa">Despesa (sai dinheiro)</option><option value="receita">Receita (entra dinheiro)</option></select></label>}
        <label className="c360-field">Categoria<select className="c360-input" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>{[...new Set([...(categorias[form.tipo] || ['Outros']), form.categoria].filter(Boolean))].map((c) => <option key={c}>{c}</option>)}</select></label>
        <label className="c360-field">Descrição<input className="c360-input" required maxLength={240} disabled={form.automatico} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label className="c360-field">Valor (R$)<input className="c360-input" required inputMode="decimal" disabled={form.automatico} value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></label>
          <label className="c360-field">Vencimento<input className="c360-input" type="date" required disabled={form.automatico} value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} /></label>
        </div>
        {!form.automatico && <label className="c360-field">{form.tipo === 'receita' ? 'Cliente' : 'Fornecedor ou favorecido'} (opcional)<input className="c360-input" maxLength={240} list={form.tipo === 'despesa' ? 'razao-fornecedores' : undefined} value={form.contraparteNome || ''} onChange={(e) => escolherContraparte(e.target.value)} />
          {form.tipo === 'despesa' && <datalist id="razao-fornecedores">{fornecedores.map((f) => <option key={f.id} value={f.nome || f.razaoSocial} />)}</datalist>}
          {form.tipo === 'despesa' && form.contraparteNome && <small className="dadm-muted">{form.contraparteId ? 'Fornecedor do cadastro' : 'Não está no cadastro de fornecedores (fica só o nome)'}</small>}</label>}
        {!form.id && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label className="c360-field">Situação<select className="c360-input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="pendente">A {form.tipo === 'receita' ? 'receber' : 'pagar'}</option><option value="pago">Já {form.tipo === 'receita' ? 'recebido' : 'pago'}</option></select></label>
          <label className="c360-field">Parcelas ou meses<input className="c360-input" type="number" min="1" max="24" value={form.meses} onChange={(e) => setForm({ ...form, meses: e.target.value })} /></label>
        </div>}
        {!form.id && Number(form.meses) > 1 && <label className="dadm-muted"><input type="checkbox" checked={form.parcelarTotal} onChange={(e) => setForm({ ...form, parcelarTotal: e.target.checked })} /> O valor é o total: dividir em {form.meses} parcelas (sem marcar, o valor se repete todo mês)</label>}
        {(form.status === 'pago' || form.id) && <label className="c360-field">Forma de pagamento<select className="c360-input" disabled={form.automatico} value={form.meioPagamento || ''} onChange={(e) => setForm({ ...form, meioPagamento: e.target.value })}>{MEIOS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></label>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label className="c360-field">Unidade<select className="c360-input" value={form.lojaId || ''} onChange={(e) => setForm({ ...form, lojaId: e.target.value })}><option value="">Sem unidade</option>{lojas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}</select></label>
          <label className="c360-field">Centro de custo<select className="c360-input" disabled={form.ratear} value={form.centroCustoId || ''} onChange={(e) => setForm({ ...form, centroCustoId: e.target.value })}><option value="">—</option>{centros.filter((c) => c.ativo).map((c) => <option key={c.id} value={c.id}>{c.codigo} · {c.nome}</option>)}</select></label>
        </div>
        {centros.some((c) => c.ativo) && <label className="dadm-muted"><input type="checkbox" checked={form.ratear} onChange={(e) => setForm({ ...form, ratear: e.target.checked, rateio: e.target.checked && !form.rateio.length ? [{ centroCustoId: form.centroCustoId || '', percentual: '100' }] : form.rateio })} /> Ratear entre centros de custo</label>}
        {form.ratear && <div style={{ display: 'grid', gap: 8 }} role="group" aria-label="Rateio">
          {form.rateio.map((r, i) => <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 110px auto', gap: 8 }}>
            <select className="c360-input" aria-label={`Centro ${i + 1}`} value={r.centroCustoId} onChange={(e) => { const rateio = [...form.rateio]; rateio[i] = { ...r, centroCustoId: e.target.value }; setForm({ ...form, rateio }) }}><option value="">Centro…</option>{centros.filter((c) => c.ativo).map((c) => <option key={c.id} value={c.id}>{c.codigo} · {c.nome}</option>)}</select>
            <input className="c360-input" aria-label={`Percentual ${i + 1}`} inputMode="decimal" value={r.percentual} onChange={(e) => { const rateio = [...form.rateio]; rateio[i] = { ...r, percentual: e.target.value }; setForm({ ...form, rateio }) }} />
            <button type="button" className="c360-btn ghost" onClick={() => setForm({ ...form, rateio: form.rateio.filter((_, j) => j !== i) })}>Remover</button>
          </div>)}
          <div className="dadm-actions"><button type="button" className="c360-btn ghost" onClick={() => setForm({ ...form, rateio: [...form.rateio, { centroCustoId: '', percentual: '' }] })}>+ Centro</button>
            <span className={somaRateio(form.rateio) === 100 ? 'dadm-muted' : 'dadm-neg'}>Soma: {String(somaRateio(form.rateio)).replace('.', ',')}%</span></div>
        </div>}
        <label className="c360-field">Documento (NF, boleto)<input className="c360-input" maxLength={80} value={form.documento || ''} onChange={(e) => setForm({ ...form, documento: e.target.value })} /></label>
        <label className="c360-field">Observação<textarea className="c360-input" rows={2} value={form.observacao || ''} onChange={(e) => setForm({ ...form, observacao: e.target.value })} /></label>
      </div>}
    </Dialog>

    <AcaoDialog acao={acao} hoje={hoje} onClose={() => setAcao(null)} onConfirmar={confirmarAcao} />
  </div>
}

function FragmentoDre({ grupo }) {
  return <>
    <tr><th scope="row">{grupo.rotulo}</th><td className={`num ${grupo.total < 0 ? 'dadm-neg' : ''}`}>{money(grupo.total)}</td></tr>
    {grupo.linhas.map((l) => <tr key={`${grupo.grupo}-${l.tipo}-${l.categoria}`}><td className="dadm-muted" style={{ paddingLeft: 24 }}>{l.categoria}</td><td className="num dadm-muted">{money(l.valor)}</td></tr>)}
  </>
}

function AcaoDialog({ acao, hoje, onClose, onConfirmar }) {
  const [dados, setDados] = useState({ motivo: '', meioPagamento: '', pagoEm: hoje })
  useEffect(() => { setDados({ motivo: '', meioPagamento: acao?.item?.meioPagamento || '', pagoEm: hoje }) }, [acao, hoje])
  if (!acao) return null
  const { tipo, item } = acao
  const titulo = { baixar: item.tipo === 'receita' ? 'Registrar recebimento' : 'Registrar pagamento', cancelar: 'Cancelar lançamento', estornar: 'Estornar lançamento', serie: 'Cancelar parcelas pendentes' }[tipo]
  const precisaMotivo = tipo !== 'baixar'
  return <Dialog open title={titulo} labelId="razao-acao" danger={tipo !== 'baixar'} onClose={onClose} onSubmit={() => onConfirmar(dados)}
    actions={<><button type="button" className="c360-btn ghost" onClick={onClose}>Voltar</button><button type="submit" className="c360-btn primary" disabled={precisaMotivo && dados.motivo.trim().length < 3}>Confirmar</button></>}>
    <p><strong>{item.descricao}</strong> · {money(item.valor)} · vence {shortDate(item.vencimento)}</p>
    {tipo === 'baixar' && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <label className="c360-field">Data<input className="c360-input" type="date" max={hoje} value={dados.pagoEm} onChange={(e) => setDados({ ...dados, pagoEm: e.target.value })} /></label>
      <label className="c360-field">Forma<select className="c360-input" value={dados.meioPagamento} onChange={(e) => setDados({ ...dados, meioPagamento: e.target.value })}>{MEIOS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></label>
    </div>}
    {tipo === 'estornar' && <p className="dadm-note">O estorno cria um lançamento oposto, ligado a este. O original continua no histórico.</p>}
    {precisaMotivo && <label className="c360-field">Motivo<input className="c360-input" required minLength={3} maxLength={240} value={dados.motivo} onChange={(e) => setDados({ ...dados, motivo: e.target.value })} /></label>}
  </Dialog>
}

function Ajustes({ categorias, centros, estado, onSincronizar, onMudou, toast, lojas = [], empresaId, plataforma = false }) {
  const [config, setConfig] = useState(null)
  useEffect(() => { api.get(`${BASE}/config`).then(setConfig).catch(() => setConfig(null)) }, [empresaId])
  async function salvarLojaPadrao(lojaPadrao) {
    try { const r = await api.put(`${BASE}/config`, { lojaPadrao: lojaPadrao || null }); setConfig({ ...config, lojaPadrao: r.lojaPadrao }); toast(r.atribuidos ? `Unidade salva; ${r.atribuidos} lançamento(s) sem unidade passaram para ela.` : 'Unidade salva.', 'success'); onMudou() }
    catch (error) { toast(error.message, 'error') }
  }
  const [novaCat, setNovaCat] = useState({ tipo: 'despesa', nome: '', grupoDre: 'operacional' })
  const [novoCentro, setNovoCentro] = useState({ codigo: '', nome: '' })
  async function criarCategoria(e) {
    e.preventDefault()
    try { await api.post(`${BASE}/categorias`, novaCat); setNovaCat({ ...novaCat, nome: '' }); toast('Categoria criada.', 'success'); onMudou() } catch (error) { toast(error.message, 'error') }
  }
  async function criarCentro(e) {
    e.preventDefault()
    try { await api.post(`${BASE}/centros-custo`, novoCentro); setNovoCentro({ codigo: '', nome: '' }); toast('Centro de custo criado.', 'success'); onMudou() } catch (error) { toast(error.message, 'error') }
  }
  async function alternarCentro(c) {
    try { await api.patch(`${BASE}/centros-custo/${c.id}`, { nome: c.nome, ativo: !c.ativo }); onMudou() } catch (error) { toast(error.message, 'error') }
  }
  return <div style={{ display: 'grid', gap: 16 }}>
    <section className="dadm-card">
      <h2>De onde vêm os lançamentos</h2>
      <p className="dadm-muted">O Financeiro lê sozinho estas fontes (ao abrir e numa rotina a cada poucos minutos). Nada é lançado duas vezes.</p>
      <Table caption="Fontes" rows={estado?.fontes || []} empty="Nenhuma leitura feita ainda." columns={[
        { key: 'fonte', label: 'Fonte', render: (f) => FONTES[f.fonte] || f.fonte },
        { key: 'quando', label: 'Última leitura', render: (f) => dateTime(f.sincronizadoEm) },
        { key: 'lidos', label: 'Lidos', align: 'right' },
        { key: 'inseridos', label: 'Novos', align: 'right' },
        { key: 'erro', label: 'Situação', render: (f) => (f.erro ? <Badge tone="danger">{f.erro}</Badge> : <Badge tone="success">ok</Badge>) },
      ]} />
      <div className="dadm-actions" style={{ marginTop: 10 }}><button type="button" className="c360-btn ghost" onClick={onSincronizar}>Ler as fontes agora</button></div>
    </section>
    {lojas.length > 1 && config && <section className="dadm-card">
      <h2>Unidade das receitas sem unidade</h2>
      <p className="dadm-muted">Bar (sem unidade do bar no Estoque), mensalidades do clube e contas de clientes chegam sem unidade. Elas entram nesta unidade, para o Financeiro e o fechamento por unidade não perderem receita. Ao escolher, as que já entraram sem unidade passam para ela (menos as de dia já fechado).</p>
      <label className="c360-field" style={{ maxWidth: 360 }}>Unidade<select className="c360-input" value={config.lojaPadrao || ''} onChange={(e) => salvarLojaPadrao(e.target.value)}><option value="">Deixar sem unidade</option>{lojas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}</select></label>
    </section>}
    {plataforma && empresaId && <MigracaoJson empresaId={empresaId} toast={toast} onMudou={onMudou} />}
    <section className="dadm-card">
      <h2>Categorias</h2>
      <p className="dadm-muted">Receitas: {categorias.receita.join(', ')}.</p>
      <p className="dadm-muted">Despesas: {categorias.despesa.join(', ')}.</p>
      <form className="dadm-filters" onSubmit={criarCategoria}>
        <select className="c360-input" value={novaCat.tipo} onChange={(e) => setNovaCat({ ...novaCat, tipo: e.target.value })} aria-label="Tipo da categoria"><option value="despesa">Despesa</option><option value="receita">Receita</option></select>
        <input className="c360-input" required minLength={2} maxLength={80} placeholder="Nome da categoria" value={novaCat.nome} onChange={(e) => setNovaCat({ ...novaCat, nome: e.target.value })} aria-label="Nome da categoria" />
        <select className="c360-input" value={novaCat.grupoDre} onChange={(e) => setNovaCat({ ...novaCat, grupoDre: e.target.value })} aria-label="Grupo no DRE">
          <option value="receita_bruta">Receita bruta</option><option value="deducao">Dedução</option><option value="cmv">CMV</option><option value="pessoal">Pessoal</option><option value="operacional">Operacional</option><option value="impostos">Impostos</option><option value="financeiro">Financeiro</option><option value="investimento">Investimento</option><option value="outros">Outros</option>
        </select>
        <button type="submit" className="c360-btn primary">Adicionar</button>
      </form>
    </section>
    <section className="dadm-card">
      <h2>Centros de custo</h2>
      <Table caption="Centros de custo" rows={centros} empty="Nenhum centro de custo. Use para separar, por exemplo, bar, quadras e academia." columns={[
        { key: 'codigo', label: 'Código' }, { key: 'nome', label: 'Nome' },
        { key: 'ativo', label: 'Situação', render: (c) => <button type="button" className="c360-btn ghost" onClick={() => alternarCentro(c)}>{c.ativo ? 'Ativo · desativar' : 'Inativo · ativar'}</button> },
      ]} />
      <form className="dadm-filters" onSubmit={criarCentro} style={{ marginTop: 10 }}>
        <input className="c360-input" required maxLength={30} placeholder="Código (ex.: BAR)" value={novoCentro.codigo} onChange={(e) => setNovoCentro({ ...novoCentro, codigo: e.target.value })} aria-label="Código do centro de custo" />
        <input className="c360-input" required minLength={2} maxLength={120} placeholder="Nome" value={novoCentro.nome} onChange={(e) => setNovoCentro({ ...novoCentro, nome: e.target.value })} aria-label="Nome do centro de custo" />
        <button type="submit" className="c360-btn primary">Adicionar</button>
      </form>
    </section>
  </div>
}

/**
 * Migração do financeiro antigo (JSON) para o razão — só a administração da plataforma.
 * Conferir = ensaio + JSON × razão, centavo a centavo; Liberar = importa e liga a leitura contínua.
 */
export function MigracaoJson({ empresaId, toast, onMudou }) {
  const [incluirQuarentena, setIncluirQuarentena] = useState(false)
  const [r, setR] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  async function chamar(acao) {
    setOcupado(true)
    try {
      const resposta = await api.post(`/api/admin/platform/razao/legado/${acao}`, { empresaId, incluirQuarentena })
      setR(acao === 'liberar' ? { ...resposta.conferencia, config: { jsonLiberadoEm: new Date().toISOString() } } : resposta)
      if (acao === 'liberar') { toast(`Importação liberada: ${resposta.relatorio.inseridos} lançamento(s) novos.`, 'success'); onMudou() }
    } catch (error) { toast(error.message || 'Não foi possível conferir.', 'error') }
    finally { setOcupado(false) }
  }
  return <section className="dadm-card">
    <h2>Financeiro antigo (migração)</h2>
    <p className="dadm-muted">Só a administração da plataforma vê. Confira o ensaio antes de liberar: a leitura contínua do financeiro antigo só começa depois da liberação.</p>
    <label className="dadm-muted"><input type="checkbox" checked={incluirQuarentena} onChange={(e) => setIncluirQuarentena(e.target.checked)} /> Incluir os lançamentos sem unidade (a tela antiga não mostrava esses)</label>
    <div className="dadm-actions" style={{ marginTop: 8 }}>
      <button type="button" className="c360-btn ghost" disabled={ocupado} onClick={() => chamar('conferencia')}>Conferir (ensaio)</button>
      <button type="button" className="c360-btn primary" disabled={ocupado || !r} onClick={() => chamar('liberar')}>Liberar e importar</button>
    </div>
    {r && <>
      {r.config?.jsonLiberadoEm && <p className="dadm-note">Leitura contínua liberada em {dateTime(r.config.jsonLiberadoEm)}{r.config.jsonLiberadoPor ? ` por ${r.config.jsonLiberadoPor}` : ''}.</p>}
      <p className={r.fecha ? 'dadm-note' : 'dadm-note danger'}>{r.fecha ? 'Fecha centavo a centavo: tudo o que o financeiro antigo tem já está no razão.' : `Ainda não fecha: ${r.totalFaltando} lançamento(s) do financeiro antigo não estão no razão.`}</p>
      <Table caption="Conferência" rows={r.conferencia.map((l) => ({ ...l, id: `${l.tipo}-${l.status}` }))} empty="Nada no financeiro antigo." columns={[
        { key: 'tipo', label: 'Tipo' }, { key: 'status', label: 'Situação' },
        { key: 'json', label: 'Antigo', align: 'right', render: (l) => `${l.json.quantidade} · ${money(l.json.valor)}` },
        { key: 'razao', label: 'No razão', align: 'right', render: (l) => `${l.razao.quantidade} · ${money(l.razao.valor)}` },
        { key: 'diferenca', label: 'Diferença', align: 'right', render: (l) => <span className={l.diferenca ? 'dadm-neg' : ''}>{money(l.diferenca)}</span> },
      ]} />
      <p className="dadm-muted">Lidos {r.ensaio.lidos} · válidos {r.ensaio.validos} · ignorados {r.ensaio.ignorados.length} · sem unidade {r.quarentena.quantidade}{r.quarentena.incluida ? ' (incluídos)' : ' (fora da importação)'} · por unidade antiga: {Object.entries(r.porUnidadeLegada || {}).map(([k, v]) => `${k} ${v}`).join(', ') || '—'}</p>
      {r.quarentena.itens.length > 0 && <details><summary>Ver os sem unidade ({r.quarentena.quantidade})</summary>
        <Table caption="Sem unidade" rows={r.quarentena.itens} empty="" columns={[
          { key: 'data', label: 'Data' }, { key: 'tipo', label: 'Tipo' }, { key: 'descricao', label: 'Descrição' }, { key: 'origem', label: 'Origem' },
          { key: 'valor', label: 'Valor', align: 'right', render: (i) => money(i.valor) },
        ]} />
      </details>}
      {r.ensaio.ignorados.length > 0 && <details><summary>Ignorados ({r.ensaio.ignorados.length})</summary><ul>{r.ensaio.ignorados.slice(0, 100).map((i, k) => <li key={k}>{i.id || 'sem id'}: {i.motivo}</li>)}</ul></details>}
    </>}
  </section>
}
