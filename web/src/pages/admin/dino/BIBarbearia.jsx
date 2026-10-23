import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../../lib/api'
import { useAuth } from '../../../lib/auth'
import { Table } from '../customer360/shared'
import { downloadCsv, int, money, pct } from './format'
import '../customer360.css'
import './dino-admin.css'

const PERIODS = [[7, '7 dias'], [30, '30 dias'], [90, '90 dias']]
const DAYS = [['seg', 'Seg'], ['ter', 'Ter'], ['qua', 'Qua'], ['qui', 'Qui'], ['sex', 'Sex'], ['sab', 'Sáb'], ['dom', 'Dom']]
const METODOS = { pix: 'Pix', dinheiro: 'Dinheiro', credito: 'Crédito', debito: 'Débito', cartao: 'Cartão', conta: 'Na conta', 'não informado': 'Não informado' }
const TABS = [['visao', 'Visão executiva'], ['financeiro', 'Receita e margem'], ['operacao', 'Agenda e equipe'], ['produtos', 'Serviços e produtos'], ['clientes', 'Clientes']]
const list = (value) => Array.isArray(value) ? value : []

function localDate(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value))
  const field = (type) => parts.find((item) => item.type === type)?.value || ''
  return `${field('year')}-${field('month')}-${field('day')}`
}
function plusDays(date, amount) {
  const value = new Date(`${date}T12:00:00.000Z`)
  value.setUTCDate(value.getUTCDate() + amount)
  return value.toISOString().slice(0, 10)
}
function formatDay(value) {
  if (!value) return '—'
  const [year, month, day] = String(value).slice(0, 10).split('-')
  return year && month && day ? `${day}/${month}` : String(value)
}
function formatRange(periodo) {
  if (!periodo?.de || !periodo?.ate) return '—'
  const end = new Date(periodo.ate)
  end.setUTCDate(end.getUTCDate() - 1)
  return `${formatDay(periodo.de)} a ${formatDay(end.toISOString())}`
}
function numeric(value) { return Number.isFinite(Number(value)) ? Number(value) : 0 }
function paymentLabel(method) {
  const raw = String(method || 'não informado')
  const prefix = 'histórico avec · '
  if (raw.toLowerCase().startsWith(prefix)) {
    const original = raw.slice(prefix.length)
    return `Histórico Avec · ${METODOS[original] || original || 'Não informado'}`
  }
  return METODOS[raw] || raw
}
function variation(current, previous, formatter = money) {
  if (previous == null || !Number.isFinite(Number(previous))) return 'Sem base anterior'
  const delta = numeric(current) - numeric(previous)
  if (!previous) return delta ? `${delta > 0 ? '+' : ''}${formatter(delta)} · sem base percentual` : 'Sem variação'
  return `${delta >= 0 ? '+' : ''}${((delta / Math.abs(previous)) * 100).toFixed(1).replace('.', ',')}% · ${delta >= 0 ? '+' : ''}${formatter(delta)}`
}

function Metric({ label, value, note, delta, alert = false, onClick }) {
  const content = <><span>{label}</span><strong>{value}</strong>{delta && <small className={delta.startsWith('+') ? 'is-positive' : delta.startsWith('-') ? 'is-negative' : ''}>{delta}</small>}{note && <em>{note}</em>}</>
  return onClick ? <button type="button" className={`dadm-metric-button${alert ? ' is-alert' : ''}`} onClick={onClick}>{content}<b aria-hidden="true">Ver detalhes →</b></button> : <article className={alert ? 'is-alert' : ''}>{content}</article>
}

function Bars({ items = [], valueKey = 'receita', labelKey = 'nome', format = money, empty = 'Sem dados no período.', onPick }) {
  const max = Math.max(1, ...items.map((item) => numeric(item[valueKey])))
  if (!items.length) return <p className="c360-empty">{empty}</p>
  const content = (item) => <><span className="label">{item[labelKey]}</span><span className="track" aria-hidden="true"><span className="fill" style={{ width: `${(numeric(item[valueKey]) / max) * 100}%`, display: 'block' }} /></span><span className="value">{format(item[valueKey])}</span></>
  return <ul className="dadm-bars dadm-bars-interactive">
    {items.map((item, index) => <li key={item.id || item[labelKey] || index}>
      {onPick ? <button type="button" onClick={() => onPick(item)} title={`Ver detalhe de ${item[labelKey] || 'item'}`}>{content(item)}</button> : <div>{content(item)}</div>}
    </li>)}
  </ul>
}

function Heatmap({ cells = [] }) {
  const hours = Array.from({ length: 13 }, (_, index) => index + 8)
  const max = Math.max(1, ...cells.map((cell) => numeric(cell.valor)))
  const value = (day, hour) => cells.find((cell) => cell.dia === day && cell.hora === hour)?.valor || 0
  if (!cells.length) return <p className="c360-empty">Sem agendamentos no período.</p>
  return <div className="dadm-heat" style={{ '--cols': hours.length }} role="table" aria-label="Agendamentos por dia da semana e hora">
    <span />{hours.map((hour) => <span key={hour} className="hd" role="columnheader">{hour}h</span>)}
    {DAYS.map(([day, label]) => [<span key={day} role="rowheader">{label}</span>, ...hours.map((hour) => {
      const total = value(day, hour)
      return <span key={`${day}-${hour}`} role="cell" className={`cell${total ? '' : ' zero'}`} style={total ? { opacity: 0.25 + 0.75 * (total / max) } : undefined} title={`${label} ${hour}h: ${total} agendamento(s)`} aria-label={`${label} ${hour}h: ${total} agendamento(s)`} />
    })])}
  </div>
}

function RevenueSeries({ rows = [] }) {
  const max = Math.max(1, ...rows.map((item) => numeric(item.total)))
  if (!rows.length) return <p className="c360-empty">Sem movimentos para construir a série diária.</p>
  return <><div className="dadm-series" role="img" aria-label="Série diária de faturamento bruto consolidado">
    {rows.map((item) => <div key={item.dia} className="dadm-series-column" title={`${formatDay(item.dia)}: ${money(item.total)}`}><span className="dadm-series-bar" style={{ height: `${Math.max(2, numeric(item.total) / max * 100)}%` }} aria-hidden="true" /><small>{formatDay(item.dia)}</small></div>)}
  </div><details className="dadm-details"><summary>Ver tabela diária acessível</summary><div className="dadm-table-wrap"><table><thead><tr><th>Dia</th><th>Serviços</th><th>Revenda</th><th>E-commerce confirmado</th><th>Histórico Avec</th><th>Total</th></tr></thead><tbody>{rows.map((item) => <tr key={item.dia}><td>{formatDay(item.dia)}</td><td>{money(item.servicos)}</td><td>{money(item.revenda)}</td><td>{money(item.ecommerce)}</td><td>{money(item.historicoAvec)}</td><td><strong>{money(item.total)}</strong></td></tr>)}</tbody></table></div></details></>
}

function ResultBreakdown({ result = {}, resumo = {} }) {
  return <dl className="dadm-result">
    <div><dt>Faturamento bruto consolidado</dt><dd>{money(resumo.faturamentoBruto)}</dd></div>
    <div><dt>(−) Comissões indicativas</dt><dd>{money(result.comissoes)}</dd></div>
    <div><dt>(−) CMV da revenda</dt><dd>{money(result.cmvRevenda)}</dd></div>
    {result.custoLoja > 0 && <div><dt>(−) Custo do E-commerce confirmado</dt><dd>{money(result.custoLoja)}</dd></div>}
    <div><dt>(−) Despesas operacionais pagas</dt><dd>{money(result.despesasPagas)}</dd></div>
    <div><dt>(−) Despesas históricas Avec</dt><dd>{money(result.despesasHistoricasAvec)}</dd></div>
    <div className="total"><dt>= Resultado estimado</dt><dd className={numeric(result.resultado) < 0 ? 'dadm-neg' : ''}>{money(result.resultado)}</dd></div>
  </dl>
}

function DetailCallout({ detail, onClose }) {
  if (!detail) return null
  return <aside className="dadm-detail-callout" role="status" aria-live="polite"><div><span>DETALHE DO INDICADOR</span><strong>{detail.kind}: {detail.label}</strong><small>{detail.quantity == null ? `Valor: ${money(detail.value)}` : `${detail.quantityLabel}: ${int(detail.quantity)} · Valor: ${money(detail.value)}`}</small>{detail.note && <em>{detail.note}</em>}</div><button type="button" className="c360-btn ghost" onClick={onClose}>Fechar detalhe</button></aside>
}

/** Exportação de BI somente com agregados; nenhuma linha leva cliente ou nome de profissional. */
export function buildBiCsvRows(bi, section, { empresa = '', unidade = '', periodo = '' } = {}) {
  if (!bi) return []
  const head = { empresa, unidade, periodo, fuso: bi.periodo?.timeZone || 'America/Cuiaba' }
  const summary = bi.resumo || {}; const result = bi.resultado || {}; const profile = bi.perfilClientes || {}
  const summaryRows = [
    { ...head, bloco: 'Resumo', indicador: 'Faturamento bruto consolidado', valor: summary.faturamentoBruto },
    { ...head, bloco: 'Resumo', indicador: 'Resultado estimado', valor: result.resultado },
    { ...head, bloco: 'Resumo', indicador: 'Ticket médio bruto', valor: summary.ticketMedioBruto },
    { ...head, bloco: 'Resumo', indicador: 'Transações confirmadas', valor: summary.transacoes },
  ]
  if (section === 'visao') return [...summaryRows, ...list(bi.fontesReceita).map((item) => ({ ...head, bloco: 'Fonte de receita', indicador: item.nome, quantidade: item.quantidade, valor: item.receita, origem: item.origem })), ...list(bi.serieDiaria).map((item) => ({ ...head, bloco: 'Série diária', indicador: item.dia, servicos: item.servicos, revenda: item.revenda, ecommerce_confirmado: item.ecommerce, historico_avec: item.historicoAvec, valor: item.total }))]
  if (section === 'financeiro') return [...summaryRows, ...list(bi.fontesReceita).map((item) => ({ ...head, bloco: 'Fonte de receita', indicador: item.nome, quantidade: item.quantidade, valor: item.receita, origem: item.origem })), ...list(bi.pagamentos).map((item) => ({ ...head, bloco: 'Meio de pagamento', indicador: paymentLabel(item.metodo), valor: item.valor, participacao: item.participacao })), ...list(bi.financeiro?.despesasPorCategoria).map((item) => ({ ...head, bloco: 'Despesa por categoria', indicador: item.categoria, valor: item.valor }))]
  if (section === 'operacao') return [{ ...head, bloco: 'Agenda', indicador: 'Agendamentos', quantidade: bi.agenda?.total }, { ...head, bloco: 'Agenda', indicador: 'Concluídos', quantidade: bi.agenda?.concluidos }, { ...head, bloco: 'Agenda', indicador: 'Cancelados', quantidade: bi.agenda?.cancelados }, { ...head, bloco: 'Agenda', indicador: 'Faltas', quantidade: bi.agenda?.faltas }, ...list(bi.profissionais).map((item, index) => ({ ...head, bloco: 'Profissional agregado', indicador: `Profissional ${index + 1}`, quantidade: item.atendimentos, valor: item.receita, comissao_indicativa: item.comissaoEstimada }))]
  if (section === 'produtos') return [...list(bi.servicos).map((item) => ({ ...head, bloco: 'Serviço', indicador: item.nome, quantidade: item.quantidade, valor: item.receita, custo: item.custo, margem: item.margem })), ...list(bi.revenda).map((item) => ({ ...head, bloco: 'Produto de revenda', indicador: item.nome, quantidade: item.quantidade, valor: item.receita, custo: item.custo, margem: item.margem })), ...list(bi.lojaOnline?.topProdutos).map((item) => ({ ...head, bloco: 'Produto E-commerce confirmado', indicador: item.nome, quantidade: item.quantidade, valor: item.receita, custo: item.custo, margem: item.margem }))]
  return [{ ...head, bloco: 'Clientes', indicador: 'Atendidos', quantidade: bi.clientes?.ativos }, { ...head, bloco: 'Clientes', indicador: 'Recorrentes', quantidade: bi.clientes?.recorrentes }, { ...head, bloco: 'Clientes', indicador: 'Novos cadastros', quantidade: bi.clientes?.novosCadastros }, ...list(profile.faixasEtarias).map((item) => ({ ...head, bloco: 'Faixa etária agregada', indicador: item.nome, quantidade: item.quantidade })), ...list(profile.tipos).map((item) => ({ ...head, bloco: 'Tipo de cadastro agregado', indicador: item.nome, quantidade: item.quantidade })), ...list(profile.origensCadastro).map((item) => ({ ...head, bloco: 'Origem de cadastro agregada', indicador: item.nome, quantidade: item.quantidade }))]
}

export default function BIBarbearia({ embedded = false, onOpenPerformance }) {
  const { empresaAtiva, lojaAtiva } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const today = localDate()
  const initialEnd = searchParams.get('ate') || today
  const initialStart = searchParams.get('de') || plusDays(initialEnd, -29)
  const [draft, setDraft] = useState({ inicio: initialStart, fim: initialEnd })
  const [range, setRange] = useState({ inicio: initialStart, fim: initialEnd })
  const [bi, setBi] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [tab, setTab] = useState(searchParams.get('secao') || 'visao')
  const [detail, setDetail] = useState(null)
  const request = useRef(0)
  const scopeKey = `${empresaAtiva?.id || ''}:${lojaAtiva?.id || ''}`

  const load = useCallback(() => {
    const current = ++request.current
    const controller = new AbortController()
    setBi(null); setErro(''); setDetail(null)
    if (!range.inicio || !range.fim || range.inicio > range.fim) { setErro('Informe um intervalo válido: a data inicial não pode ser posterior à final.'); setLoading(false); return () => controller.abort() }
    setLoading(true)
    const query = new URLSearchParams({ inicio: range.inicio, fim: range.fim, comparar: '1' })
    api.get(`/api/admin/barbearia/bi?${query}`, { signal: controller.signal }).then((payload) => {
      if (request.current !== current) return
      setBi(payload); setErro('')
    }).catch((error) => {
      if (request.current !== current || error?.name === 'AbortError') return
      setErro(error.message || 'Não foi possível carregar o BI.')
    }).finally(() => { if (request.current === current) setLoading(false) })
    return () => controller.abort()
  }, [range, scopeKey])
  useEffect(() => load(), [load])

  const r = bi?.resultado || {}
  const summary = bi?.resumo || {}
  const previous = bi?.comparacao?.resumo
  const periodLabel = formatRange(bi?.periodo)
  const aiDays = bi?.periodo?.dias === 90 ? 90 : 30
  const aiPath = `/admin/cerebro-ia?tab=ofertas&dias=${aiDays}&origem=bi`
  const showDetail = (kind, item, quantityLabel = 'Registros', note = '') => setDetail({ kind, label: item.nome || item.categoria || item.dia || 'Indicador', quantity: item.quantidade ?? item.atendimentos ?? item.pedidos ?? null, value: item.receita ?? item.valor ?? 0, quantityLabel, note })
  const updateQuery = (next) => {
    const query = new URLSearchParams(searchParams)
    query.set('de', next.inicio); query.set('ate', next.fim); query.set('secao', next.secao)
    setSearchParams(query, { replace: true })
  }
  const setSection = (next) => { setTab(next); setDetail(null); updateQuery({ ...range, secao: next }) }
  const applyRange = () => { setRange({ ...draft }); updateQuery({ ...draft, secao: tab }) }
  const choosePeriod = (days) => { const next = { inicio: plusDays(today, -(days - 1)), fim: today }; setDraft(next); setRange(next); updateQuery({ ...next, secao: tab }) }
  const reportTitle = embedded ? 'Relatórios de gestão' : 'BI & Analytics'
  const exportedRows = useMemo(() => buildBiCsvRows(bi, tab, { empresa: empresaAtiva?.nome || '', unidade: lojaAtiva?.nome || '', periodo: periodLabel }), [bi, tab, empresaAtiva?.nome, lojaAtiva?.nome, periodLabel])
  function exportar() { if (bi) downloadCsv(`relatorio_bi_dino_${tab}_${range.inicio}_${range.fim}.csv`, exportedRows) }
  function openPerformance() { if (onOpenPerformance) onOpenPerformance(); else setSection('operacao') }

  return <div className={`dadm-page dadm-bi${embedded ? ' is-embedded' : ''}`}>
    <header className="dadm-head dadm-bi-print-head"><div><div className="dadm-eyebrow">Gestão consolidada · {empresaAtiva?.nome || 'Empresa'}{lojaAtiva?.nome ? ` · ${lojaAtiva.nome}` : ''}</div><h1>{reportTitle}</h1><p>Faturamento, operação, clientes e Commerce no mesmo recorte, com origem visível e histórico Avec identificado.</p></div><div className="dadm-actions dadm-no-print"><Link className="c360-btn ghost" to={aiPath}>Análise com IA</Link><button type="button" className="c360-btn ghost" onClick={exportar} disabled={!bi}>Exportar esta visão (CSV)</button><button type="button" className="c360-btn ghost" onClick={() => window.print()} disabled={!bi}>Imprimir / PDF</button></div></header>

    <fieldset className="dadm-filterbar dadm-no-print" aria-label="Filtros do relatório"><legend>Período do relatório</legend><div className="c360-chips" role="group" aria-label="Atalhos de período">{PERIODS.map(([days, label]) => <button key={days} type="button" className={range.inicio === plusDays(today, -(days - 1)) && range.fim === today ? 'active' : ''} aria-pressed={range.inicio === plusDays(today, -(days - 1)) && range.fim === today} onClick={() => choosePeriod(days)}>{label}</button>)}</div><label>De<input type="date" value={draft.inicio} max={today} onChange={(event) => setDraft((current) => ({ ...current, inicio: event.target.value }))} /></label><label>Até<input type="date" value={draft.fim} max={today} onChange={(event) => setDraft((current) => ({ ...current, fim: event.target.value }))} /></label><button type="button" className="c360-btn primary" onClick={applyRange} disabled={loading || !draft.inicio || !draft.fim || draft.inicio > draft.fim}>Aplicar</button><span className="dadm-filter-meta">Fuso: America/Cuiaba · comparação: período anterior equivalente</span></fieldset>

    {erro && <p className="dadm-note danger" role="alert">{erro}</p>}
    {loading && <p className="dadm-muted" role="status">Carregando indicadores consolidados para a unidade ativa…</p>}
    {bi && <>
      <nav className="dadm-tabs dadm-no-print" role="tablist" aria-label="Seções do BI">{TABS.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setSection(key)}>{label}</button>)}</nav>
      <p className="dadm-bi-period" role="status">Período: <strong>{periodLabel}</strong> · {bi.periodo?.dias} dia(s) · unidade ativa · leitura somente consulta.</p>
      <section className="dadm-kpis" aria-label="Indicadores consolidados do período"><Metric label="Faturamento bruto" value={money(summary.faturamentoBruto)} delta={variation(summary.faturamentoBruto, previous?.faturamentoBruto)} note="Operação, Commerce confirmado e histórico pago" onClick={() => setSection('financeiro')} /><Metric label="Resultado estimado" value={money(r.resultado)} delta={variation(r.resultado, previous?.resultado)} note={`Margem ${pct(r.margem)}`} alert={numeric(r.resultado) < 0} onClick={() => setSection('financeiro')} /><Metric label="Ticket médio bruto" value={money(summary.ticketMedioBruto)} delta={variation(summary.ticketMedioBruto, previous?.ticketMedioBruto)} note={`${int(summary.transacoes)} transação(ões) confirmadas`} onClick={() => setSection('financeiro')} /><Metric label="Comparecimento" value={pct(bi.agenda?.taxaComparecimento)} delta={variation(bi.agenda?.taxaComparecimento, previous?.agenda?.taxaComparecimento, (value) => `${numeric(value).toFixed(1).replace('.', ',')} p.p.`)} note={`${int(bi.agenda?.faltas)} falta(s) · ${int(bi.agenda?.cancelados)} cancelado(s)`} alert={bi.agenda?.taxaComparecimento != null && bi.agenda.taxaComparecimento < 85} onClick={() => setSection('operacao')} /><Metric label="Clientes atendidos" value={int(bi.clientes?.ativos)} delta={variation(bi.clientes?.ativos, previous?.clientes?.ativos, int)} note={`${pct(bi.clientes?.taxaRecorrencia)} recorrência`} onClick={() => setSection('clientes')} /><Metric label="Agendamentos" value={int(bi.agenda?.total)} delta={variation(bi.agenda?.total, previous?.agenda?.total, int)} note={`${pct(bi.agenda?.participacaoOnline)} vieram da agenda online`} onClick={() => setSection('operacao')} /></section>
      <DetailCallout detail={detail} onClose={() => setDetail(null)} />

      {tab === 'visao' && <><div className="dadm-grid dadm-bi-main-grid"><section className="dadm-card"><h2>Faturamento diário consolidado</h2><p className="dadm-muted">Soma de serviços, revenda, pedidos Commerce confirmados e receitas históricas Avec pagas. Capturas Commerce seguem a data de liquidação e não são somadas novamente.</p><RevenueSeries rows={bi.serieDiaria} /></section><section className="dadm-card"><h2>Composição do faturamento</h2><Bars items={bi.fontesReceita} empty="Sem receita registrada no período." onPick={(item) => { setSection('financeiro'); showDetail('Fonte de receita', item) }} /><p className="dadm-muted">Histórico financeiro Avec está identificado e permanece auditável; não vira uma nova venda operacional.</p></section></div><div className="dadm-grid"><section className="dadm-card"><h2>Leitura rápida do período</h2><dl className="dadm-result"><div><dt>Faturamento operacional</dt><dd>{money(summary.faturamentoOperacional)}</dd></div><div><dt>Receitas históricas Avec pagas</dt><dd>{money(summary.historicoFinanceiroAvec)}</dd></div><div><dt>Commerce confirmado (data do pedido)</dt><dd>{money(summary.ecommerce)}</dd></div><div><dt>Capturas Commerce (data de liquidação)</dt><dd>{money(bi.lojaOnline?.capturadoNoPeriodo)}</dd></div><div><dt>Commerce pendente de pagamento</dt><dd>{money(bi.lojaOnline?.pendentePagamento)}</dd></div></dl>{summary.ecommerceSemCusto && <p className="dadm-note warn">Há Commerce confirmado sem custo completo: entra no faturamento, mas não no resultado estimado até haver custo comprovado.</p>}</section><section className="dadm-card"><h2>IA gerencial, com governança</h2><p>Abre a análise opcional de agregados e nunca modifica agenda, preços, comissões, estoque ou lançamentos.</p><p className="dadm-note">A análise assistida trabalha em janelas de 30 ou 90 dias; este link abre {aiDays} dias. Para um intervalo customizado, o recorte do BI continua sendo a fonte determinística.</p><div className="dadm-actions"><Link className="c360-btn primary" to={aiPath}>Abrir análise gerencial com IA</Link><Link className="c360-btn ghost" to="/admin/barbearia-erp?area=gestao&tab=Proje%C3%A7%C3%A3o%20inteligente">Ver projeções e cenários</Link></div></section></div></>}

      {tab === 'financeiro' && <><div className="dadm-grid"><section className="dadm-card"><h2>Resultado estimado</h2><ResultBreakdown result={r} resumo={summary} />{r.notas?.map((note) => <p key={note} className="dadm-muted">{note}</p>)}<Link className="dadm-muted" to="/admin/financeiro">Abrir livro financeiro e conciliação →</Link></section><section className="dadm-card"><h2>Receitas por fonte</h2><Table caption="Composição do faturamento bruto" rows={bi.fontesReceita} empty="Sem fontes de receita no período." columns={[{ key: 'nome', label: 'Fonte', render: (item) => <button type="button" className="dadm-row-button" onClick={() => showDetail('Fonte de receita', item)}>{item.nome}</button> }, { key: 'quantidade', label: 'Registros', align: 'right', render: (item) => int(item.quantidade) }, { key: 'receita', label: 'Valor', align: 'right', render: (item) => money(item.receita) }, { key: 'origem', label: 'Origem', render: (item) => item.origem }]} /></section></div><div className="dadm-grid"><section className="dadm-card"><h2>Formas de pagamento</h2><Bars items={bi.pagamentos.map((item) => ({ ...item, nome: paymentLabel(item.metodo), quantidade: item.participacao }))} valueKey="valor" empty="Nenhum pagamento no período." onPick={(item) => showDetail('Meio de pagamento', item, 'Participação (%)', `${numeric(item.participacao).toFixed(1).replace('.', ',')}% do mix exibido`)} /></section><section className="dadm-card"><h2>Despesas por categoria</h2><Bars items={(bi.financeiro?.despesasPorCategoria || []).map((item) => ({ ...item, nome: item.categoria }))} valueKey="valor" empty="Nenhuma despesa paga no período." onPick={(item) => showDetail('Categoria de despesa', item)} /><p className="dadm-muted">Saldo do livro no período: {money(bi.financeiro?.saldo)}. Não substitui conciliação bancária nem resultado contábil.</p></section></div></>}

      {tab === 'operacao' && <><div className="dadm-grid"><section className="dadm-card"><h2>Agenda e atendimento</h2><dl className="dadm-result"><div><dt>Agendamentos</dt><dd>{int(bi.agenda?.total)}</dd></div><div><dt>Concluídos</dt><dd>{int(bi.agenda?.concluidos)}</dd></div><div><dt>Cancelados</dt><dd>{int(bi.agenda?.cancelados)}</dd></div><div><dt>Não compareceu</dt><dd>{int(bi.agenda?.faltas)}</dd></div><div><dt>Participação online</dt><dd>{pct(bi.agenda?.participacaoOnline)}</dd></div></dl><p className="dadm-note">{bi.operacao?.ocupacaoMotivo}</p><Link className="dadm-muted" to="/admin/barbearia-erp?area=operacao&tab=Agenda">Abrir agenda operacional →</Link></section><section className="dadm-card"><h2>Quando a agenda enche</h2><p>Volume de horários de agenda, não taxa de ocupação.</p><Heatmap cells={bi.agenda?.heatmap} /></section></div><section className="dadm-card"><div className="dadm-section-heading"><div><h2>Profissionais</h2><p>Receita atribuída somente a serviços e produtos com profissional identificado. Commerce sem vínculo não é imputado à equipe.</p></div><button type="button" className="c360-btn ghost dadm-no-print" onClick={openPerformance}>Abrir desempenho detalhado</button></div>{bi.operacao?.itensServicoHistoricos > 0 && <p className="dadm-note">{int(bi.operacao.itensServicoHistoricos)} serviço(s) históricos Avec integram a atribuição por profissional; o extrato financeiro já é a fonte consolidada.</p>}<Table caption="Desempenho agregado por profissional" rows={bi.profissionais} empty="Sem produção atribuída no período." columns={[{ key: 'nome', label: 'Profissional', render: (item) => <button type="button" className="dadm-row-button" onClick={() => showDetail('Profissional', item, 'Atendimentos', 'Detalhe agregado; use “Abrir desempenho detalhado” para a análise individual.')}>{item.nome}</button> }, { key: 'atendimentos', label: 'Atendimentos', align: 'right', render: (item) => int(item.atendimentos) }, { key: 'receitaServicos', label: 'Serviços atribuídos', align: 'right', render: (item) => money(item.receitaServicos) }, { key: 'receitaProdutos', label: 'Produtos', align: 'right', render: (item) => money(item.receitaProdutos) }, { key: 'ticketMedio', label: 'Ticket médio', align: 'right', render: (item) => money(item.ticketMedio) }, { key: 'comissaoEstimada', label: 'Comissão indicativa', align: 'right', render: (item) => money(item.comissaoEstimada) }]} /></section></>}

      {tab === 'produtos' && <><div className="dadm-grid"><section className="dadm-card"><h2>Serviços que mais faturam</h2><p>{bi.operacao?.itensServicoHistoricos > 0 ? 'O ranking inclui produção histórica Avec para atribuição; o total financeiro não é somado novamente.' : 'Produção com valor e origem disponíveis no período.'}</p><Bars items={bi.servicos} empty="Nenhum serviço concluído ou pago no período." onPick={(item) => showDetail('Serviço', item, 'Itens')} /></section><section className="dadm-card"><h2>Revenda</h2><Table caption="Produtos de revenda no período" rows={bi.revenda} empty="Nenhuma venda de revenda no período." columns={[{ key: 'nome', label: 'Produto', render: (item) => <button type="button" className="dadm-row-button" onClick={() => showDetail('Produto de revenda', item, 'Itens')}>{item.nome}</button> }, { key: 'quantidade', label: 'Qtd.', align: 'right', render: (item) => int(item.quantidade) }, { key: 'receita', label: 'Receita', align: 'right', render: (item) => money(item.receita) }, { key: 'margem', label: 'Margem', align: 'right', render: (item) => item.margem == null ? <span className="dadm-muted">sem custo</span> : pct(item.margem) }]} /></section></div><section className="dadm-card"><h2>E-commerce</h2>{bi.lojaOnline?.disponivel ? <><p>{money(bi.lojaOnline.receitaConfirmada)} em {int(bi.lojaOnline.pedidosConfirmados)} pedido(s) confirmados na data do pedido. Capturado no período de liquidação: {money(bi.lojaOnline.capturadoNoPeriodo)}. Pendências: {int(bi.lojaOnline.pedidosPendentes)} pedido(s), {money(bi.lojaOnline.pendentePagamento)}.</p>{!bi.lojaOnline.detalheDisponivel && <p className="dadm-note warn">O detalhamento de custo/produto Commerce não respondeu neste momento; o faturamento confirmado continua separado e o resultado não presume custo.</p>}<Bars items={bi.lojaOnline.topProdutos} empty="Nenhum produto Commerce confirmado ou detalhamento indisponível." onPick={(item) => showDetail('Produto E-commerce confirmado', item, 'Itens')} /></> : <p className="c360-empty">Commerce indisponível para esta sessão; nenhum valor foi presumido.</p>}</section></>}

      {tab === 'clientes' && <><div className="dadm-grid"><section className="dadm-card"><h2>Relacionamento e recorrência</h2><dl className="dadm-result"><div><dt>Clientes atendidos</dt><dd>{int(bi.clientes?.ativos)}</dd></div><div><dt>Voltaram no período (2+ visitas)</dt><dd>{int(bi.clientes?.recorrentes)}</dd></div><div><dt>Taxa de recorrência</dt><dd>{pct(bi.clientes?.taxaRecorrencia)}</dd></div><div><dt>Novos cadastros associados à unidade</dt><dd>{int(bi.clientes?.novosCadastros)}</dd></div><div><dt>Intervalo médio entre visitas</dt><dd>{bi.clientes?.intervaloMedioDias == null ? '—' : `${String(bi.clientes.intervaloMedioDias).replace('.', ',')} dias`}</dd></div></dl>{bi.clientes?.atendimentosSemCliente > 0 && <p className="dadm-note warn">{int(bi.clientes.atendimentosSemCliente)} atendimento(s) sem cliente identificado não entram em recorrência.</p>}<Link className="dadm-muted" to="/admin/clientes-360">Abrir carteira de clientes →</Link></section><section className="dadm-card"><h2>Perfil agregado dos atendidos</h2><p>Base coberta: {int(bi.perfilClientes?.cadastrosCobertos)} cadastro(s) com atendimento no período e vínculo com a unidade.</p><p>{bi.perfilClientes?.nascimentoInformado ? `Data de nascimento em ${int(bi.perfilClientes.nascimentoInformado)} cadastro(s) (${pct(bi.perfilClientes.coberturaNascimentoPct)} de cobertura).` : 'Não há data de nascimento estruturada suficiente no recorte.'}</p><Bars items={bi.perfilClientes?.faixasEtarias || []} valueKey="quantidade" format={int} empty="Faixas etárias indisponíveis sem datas de nascimento." onPick={(item) => showDetail('Faixa etária agregada', item, 'Cadastros')} /><p className="dadm-note">{bi.perfilClientes?.sexoMotivo}</p></section></div><div className="dadm-grid"><section className="dadm-card"><h2>Tipo de cadastro</h2><Bars items={bi.perfilClientes?.tipos || []} valueKey="quantidade" format={int} empty="Sem cadastros vinculados à unidade no período." onPick={(item) => showDetail('Tipo de cadastro agregado', item, 'Cadastros')} /></section><section className="dadm-card"><h2>Origem de cadastro</h2><Bars items={bi.perfilClientes?.origensCadastro || []} valueKey="quantidade" format={int} empty="Origem estruturada não disponível no cadastro." onPick={(item) => showDetail('Origem de cadastro agregada', item, 'Cadastros')} /><p className="dadm-muted">O relatório não extrai bairro de endereços livres nem infere atributos ausentes.</p></section></div></>}

      <section className="dadm-card dadm-bi-quality"><h2>Fontes, cobertura e definições</h2><div className="dadm-quality-grid"><p><strong>Operação:</strong> {bi.cobertura?.operacao === 'ok' ? 'agenda, comandas e revenda da unidade ativa' : 'cobertura limitada'}.</p><p><strong>Financeiro:</strong> {bi.cobertura?.financeiro === 'ok' ? 'livro da unidade ativa, com lote Avec identificado' : 'cobertura limitada'}.</p><p><strong>Commerce:</strong> {bi.cobertura?.comercio === 'ok' ? 'pedidos confirmados e custos detalhados pela storefront da unidade' : bi.cobertura?.comercio === 'limitado' ? 'pedidos confirmados pela storefront; custo ou ranking Commerce indisponível nesta leitura' : 'indisponível para esta sessão; valores não foram inferidos'}.</p><p><strong>Clientes:</strong> {bi.cobertura?.clientes === 'ok' ? 'perfil agregado dos clientes atendidos no período e vinculados à unidade' : 'perfil limitado por ausência de vínculo de unidade'}.</p></div><p className="dadm-muted">O relatório é somente leitura. “Faturamento bruto” soma fontes identificadas uma vez; “resultado estimado” depende de custos e não substitui apuração contábil ou conciliação bancária.</p></section>
    </>}
  </div>
}
