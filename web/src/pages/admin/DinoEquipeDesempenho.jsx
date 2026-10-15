import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { api, fmtR } from '../../lib/api'
import { hojeAgenda } from '../../lib/barbearia-calendar'
import './dino-equipe-desempenho.css'

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const amount = value => value == null ? 'Indisponível' : fmtR(value)
const count = value => value == null ? '—' : Number(value).toLocaleString('pt-BR')
const percent = value => value == null ? 'Sem base' : `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
export function shiftEquipeDate(day, delta) {
  const date = new Date(`${day}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + delta)
  return date.toISOString().slice(0, 10)
}
const initialPeriod = () => { const fim = hojeAgenda(); return { inicio: shiftEquipeDate(fim, -29), fim } }
function dateLabel(value) { return String(value || '').split('-').reverse().join('/') }
function Metric({ label, value, note }) { return <article className="eq-metric"><span>{label}</span><strong>{value}</strong><small>{note}</small></article> }
function Notes({ title, items = [], empty, type = '' }) { return <section className={`eq-notes ${type}`}><h3>{title}</h3>{items.length ? <ul>{items.map((item, i) => <li key={`${item.code}-${i}`}><strong>{item.text}</strong>{typeof item.evidence === 'string' && item.evidence && <small>{item.evidence}</small>}</li>)}</ul> : <p>{empty}</p>}</section> }
function ServiceBars({ items = [] }) {
  const max = Math.max(1, ...items.map(item => item.quantity || 0))
  return items.length ? <div className="eq-services">{items.map((item, i) => <div key={`${item.id}-${i}`}><div><strong>{item.name}</strong><span>{count(item.quantity)} serviços · {amount(item.revenue)}</span></div><i aria-hidden="true"><b style={{ width: `${(item.quantity || 0) / max * 100}%` }} /></i></div>)}</div> : <p className="eq-empty">Sem serviços apurados neste período.</p>
}
function DailyChart({ rows = [] }) {
  const max = Math.max(1, ...rows.map(item => item.revenue || 0))
  return <div className="eq-scroll"><div className="eq-daily" role="img" aria-label="Receita apurada por dia; detalhes na tabela abaixo">{rows.map(item => <div key={item.date} title={`${dateLabel(item.date)}: ${amount(item.revenue)} · ${count(item.services)} serviços`}><i style={{ height: `${Math.max(item.revenue > 0 ? 3 : 0, (item.revenue || 0) / max * 100)}%` }} /><small>{item.date?.slice(8)}</small></div>)}</div><details><summary>Ver valores diários em tabela</summary><table className="eq-table"><thead><tr><th>Dia</th><th>Receita apurada</th><th>Serviços</th></tr></thead><tbody>{rows.map(item => <tr key={item.date}><td>{dateLabel(item.date)}</td><td>{amount(item.revenue)}</td><td>{count(item.services)}</td></tr>)}</tbody></table></details></div>
}
function HourMap({ cells = [] }) {
  const hours = Array.from({ length: 24 }, (_, i) => i)
  const indexed = new Map(cells.map(item => [`${item.day}:${item.hour}`, item]))
  const max = Math.max(1, ...cells.map(item => item.quantity || 0))
  const best = [...cells].filter(item => item.quantity > 0).sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue).slice(0, 3)
  return <><div className="eq-scroll"><table className="eq-hours"><caption>Volume de serviços por dia e hora local — America/Cuiaba</caption><thead><tr><th>Dia</th>{hours.map(hour => <th key={hour}>{hour}h</th>)}</tr></thead><tbody>{DAYS.map((day, index) => <tr key={day}><th scope="row">{day}</th>{hours.map(hour => { const cell = indexed.get(`${index}:${hour}`); return <td key={hour} title={`${day}, ${hour}h: ${count(cell?.quantity || 0)} serviços · ${amount(cell?.revenue || 0)}`}><span aria-label={`${day} ${hour}h: ${count(cell?.quantity || 0)} serviços`} className={cell?.quantity ? 'is-populated' : ''} style={{ '--heat': cell?.quantity ? .15 + cell.quantity / max * .8 : 0 }}>{cell?.quantity || '·'}</span></td> })}</tr>)}</tbody></table></div><p className="eq-muted">{best.length ? `Maiores volumes: ${best.map(item => `${DAYS[item.day]} ${item.hour}h (${count(item.quantity)} serviços)`).join(' · ')}` : 'Sem horários atribuíveis no período.'} Não representa ponto, jornada ou horas efetivamente trabalhadas.</p></>
}

export default function DinoEquipeDesempenho({ empresaId = '', lojaId = '', onOpenTab = () => {} }) {
  const [period, setPeriod] = useState(initialPeriod)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('revenue')
  const [employeeId, setEmployeeId] = useState('')
  const [refresh, setRefresh] = useState(0)
  const request = useRef(0)
  const scopeKey = `${empresaId}:${lojaId}`
  const activeScope = useRef(scopeKey)
  activeScope.current = scopeKey
  const periodKey = `${period.inicio}:${period.fim}`
  useLayoutEffect(() => { request.current++; setData(null); setError(''); setEmployeeId(''); setSearch('') }, [scopeKey, periodKey])
  useEffect(() => {
    if (!empresaId || !lojaId) { setLoading(false); return undefined }
    const current = ++request.current
    let alive = true
    setLoading(true); setError(''); setData(null)
    const query = new URLSearchParams({ inicio: period.inicio, fim: period.fim })
    const headers = { 'X-Empresa-Id': empresaId, 'X-Loja-Id': lojaId }
    api.get(`/api/admin/barbearia/equipe/desempenho?${query}`, { headers }).then(payload => {
      if (!alive || request.current !== current || activeScope.current !== scopeKey) return
      if (payload?.scope?.empresaId !== empresaId || payload?.scope?.lojaId !== lojaId || payload?.period?.inicio !== period.inicio || payload?.period?.fim !== period.fim || payload?.readOnly !== true || payload?.writePerformed !== false || !Array.isArray(payload?.employees)) throw new Error('INVALID_PERFORMANCE_SCOPE')
      setData({ ...payload, viewScope: scopeKey, viewPeriod: periodKey })
    }).catch(() => {
      if (alive && request.current === current && activeScope.current === scopeKey) { setData(null); setError('Não foi possível carregar o desempenho neste contexto. Confira a empresa, a unidade, o período e sua permissão de gestão.') }
    }).finally(() => { if (alive && request.current === current) setLoading(false) })
    return () => { alive = false }
  }, [empresaId, lojaId, scopeKey, period.inicio, period.fim, periodKey, refresh])
  const visible = data?.viewScope === scopeKey && data?.viewPeriod === periodKey ? data : null
  const employees = useMemo(() => (visible?.employees || []).filter(item => String(item.name || '').toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))).sort((a, b) => Number(b[sort] || 0) - Number(a[sort] || 0) || String(a.name).localeCompare(String(b.name), 'pt-BR')), [visible, search, sort])
  const selected = visible?.employees?.find(item => item.id === employeeId) || null
  const summary = visible?.summary || {}
  const choosePeriod = days => { const fim = hojeAgenda(); setPeriod({ inicio: shiftEquipeDate(fim, -(days - 1)), fim }) }
  return <div className="eq-panel">
    <header className="eq-hero"><div><span className="eq-kicker">GESTÃO DA EQUIPE · SOMENTE LEITURA</span><h2>Desempenho da equipe</h2><p>Entenda o resultado, reconheça o que funcionou e encontre oportunidades de evolução no período.</p></div><button type="button" className="eq-primary" onClick={() => setRefresh(value => value + 1)} disabled={loading || !empresaId || !lojaId}>Atualizar indicadores</button></header>
    <div className="eq-filterbar"><div className="eq-presets" aria-label="Períodos rápidos">{[[7, '7 dias'], [30, '30 dias'], [90, '90 dias']].map(([days, label]) => <button key={days} type="button" onClick={() => choosePeriod(days)}>{label}</button>)}</div><label>De<input aria-label="Início do período" type="date" value={period.inicio} onChange={event => setPeriod(value => ({ ...value, inicio: event.target.value }))} /></label><label>Até<input aria-label="Fim do período" type="date" value={period.fim} onChange={event => setPeriod(value => ({ ...value, fim: event.target.value }))} /></label><span className="eq-muted">Até 93 dias · horário de Cuiabá</span></div>
    {(!empresaId || !lojaId) && <p className="eq-alert" role="status">Selecione a empresa e uma unidade para consultar. Nenhum relatório sem contexto será carregado.</p>}
    {loading && <p role="status" className="eq-empty">Conferindo os indicadores da unidade…</p>}
    {error && <p role="alert" className="eq-alert">{error}</p>}
    {visible && <>
      <div className="eq-period">{dateLabel(visible.period.inicio)} a {dateLabel(visible.period.fim)}<small>Comparação: {dateLabel(visible.period.previousInicio)} a {dateLabel(visible.period.previousFim)} · mesmo número de dias</small></div>
      <div className="eq-metrics"><Metric label="Receita apurada" value={amount(summary.revenue)} note={visible.quality?.ambiguousCommandsExcluded ? "APURAÇÃO PARCIAL: comandas ambíguas excluídas; não é caixa capturado" : "Serviços e revenda atribuídos; não é caixa capturado"} /><Metric label="Comissão indicativa" value={amount(summary.commission)} note={visible.quality?.ambiguousCommandsExcluded ? "APURAÇÃO PARCIAL: exige revisão dos vínculos" : "Regras atuais; não é folha ou pagamento"} /><Metric label="Repasses registrados" value={amount(summary.paidTransfers)} note="Somente registros com unidade comprovada" /><Metric label="Serviços apurados" value={count(summary.services)} note={`${count(summary.products)} unidades de produtos`} /><Metric label="Agenda concluída" value={count(summary.completed)} note={`${count(summary.appointments)} reservas no período`} /></div>
      <div className="eq-quality"><strong>Qualidade e limites dos dados</strong><p>Equipe do cadastro operacional: pessoas sem movimentos também aparecem. Contas de acesso sem vínculo operacional não recebem vendas ou comissões automaticamente.</p><p>{count(visible.quality?.unscopedExcluded)} registros sem unidade comprovada excluídos · {count(visible.quality?.unattributedEvents)} movimentos sem responsável atribuído.</p>{visible.quality?.transfersAvailable === false && <p>Repasses sem vínculo de unidade estão indisponíveis; ausência de evidência não virou valor zero.</p>}{(visible.quality?.commissionWarnings || []).filter(item => typeof item === 'string').map((warning, index) => <p key={index}>{warning}</p>)}<p>Origem: cadastros e movimentos da barbearia e revenda atribuída. A tela não soma vendas do e-commerce sem responsável operacional comprovado.</p><p>Faltas e cancelamentos não comprovam erro do funcionário. Sugestões são apoio à gestão, não avaliação disciplinar automática.</p></div>
      <section className="eq-card"><div className="eq-section-head"><div><h3>Todos os profissionais</h3><p>Compare o resultado com contexto — volume não mede sozinho a qualidade do atendimento.</p></div><label>Buscar profissional<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Nome do profissional" /></label><label>Ordenar por<select value={sort} onChange={event => setSort(event.target.value)}><option value="revenue">Receita apurada</option><option value="commission">Comissão</option><option value="services">Serviços</option><option value="completed">Agenda concluída</option></select></label></div><div className="eq-scroll"><table className="eq-table eq-employee-table"><caption>{employees.length} profissionais exibidos — selecione um para ver o detalhe</caption><thead><tr><th>Profissional</th><th>Receita apurada</th><th>Comissão indicativa</th><th>Repasses</th><th>Serviços</th><th>Produtos</th><th>Ticket / serviço</th><th>Vs. período anterior</th><th>Detalhe</th></tr></thead><tbody>{employees.map(item => <tr key={item.id} className={item.id === employeeId ? 'is-selected' : ''}><th scope="row">{item.name}<small>{item.active === false ? 'Inativo · histórico' : 'Ativo'}{!item.hasActivity ? ' · sem movimento' : ''}</small></th><td>{amount(item.revenue)}</td><td>{amount(item.commission)}</td><td>{amount(item.paidTransfers)}</td><td>{count(item.services)}</td><td>{count(item.products)}</td><td>{amount(item.ticketAverage)}</td><td>{item.revenueTrendPct == null ? 'Sem base anterior' : `${item.revenueTrendPct > 0 ? '+' : ''}${percent(item.revenueTrendPct)}`}</td><td><button type="button" onClick={() => setEmployeeId(item.id)} aria-label={`Ver desempenho de ${item.name}`} aria-pressed={item.id === employeeId}>Analisar</button></td></tr>)}</tbody></table></div>{!employees.length && <p className="eq-empty">Nenhum profissional corresponde à busca neste contexto.</p>}</section>
      {selected ? <section className="eq-detail" aria-label={`Detalhe de ${selected.name}`}><div className="eq-detail-head"><div><span className="eq-kicker">ANÁLISE INDIVIDUAL</span><h3>{selected.name}</h3></div><button type="button" onClick={() => setEmployeeId('')}>Fechar detalhe</button></div><div className="eq-metrics"><Metric label="Serviços" value={amount(selected.serviceRevenue)} note={`${count(selected.services)} serviços apurados`} /><Metric label="Revenda" value={amount(selected.productRevenue)} note={`${count(selected.products)} unidades vendidas`} /><Metric label="Comissão de serviços" value={amount(selected.serviceCommission)} note="Calculada, não paga automaticamente" /><Metric label="Comissão de produtos" value={amount(selected.productCommission)} note="Regra atual de revenda" /><Metric label="Comparecimento observado" value={percent(selected.attendanceRate)} note="Concluídos / (concluídos + faltas)" /></div>
        <div className="eq-agenda-stats"><span>{count(selected.completed)} concluídos</span><span>{count(selected.canceled)} cancelados</span><span>{count(selected.noShow)} faltas de clientes</span><span>{count(selected.appointments)} reservas</span></div>
        <div className="eq-two-columns"><section className="eq-card"><h3>Serviços mais vendidos</h3><p className="eq-muted">Quantidade apurada e valor atribuído após descontos.</p><ServiceBars items={selected.topServices} /></section><section className="eq-card"><h3>Evolução diária</h3><p className="eq-muted">Receita apurada no período selecionado.</p><DailyChart rows={selected.daily} /></section></div>
        <section className="eq-card"><h3>Dias e horários de maior volume</h3><p className="eq-muted">Início do serviço, quando conhecido. Sem horário confirmado, o registro não entra no mapa.</p><HourMap cells={selected.heatmap} /></section>
        <div className="eq-coaching"><Notes title="O que funcionou" items={selected.strengths} empty="Ainda não há evidência suficiente para destacar um resultado." type="strengths" /><Notes title="Pontos de atenção" items={selected.attention} empty="Nenhum sinal relevante encontrado nas métricas disponíveis; isso não certifica ausência de problemas." type="attention" /><Notes title="Como melhorar no período" items={selected.suggestions} empty="Amplie a base de registros e revise o período com a equipe antes de definir ações." type="suggestions" /></div>
      </section> : <p className="eq-empty">Clique em “Analisar” para ver serviços, horários, evolução e sugestões do profissional.</p>}
      <section className="eq-card eq-definitions"><h3>Como interpretar</h3><ul>{(visible.definitions || []).map((text, i) => <li key={i}>{text}</li>)}</ul><div className="eq-actions"><button type="button" onClick={() => onOpenTab('Comissões')}>Conferir apuração de comissões</button><button type="button" onClick={() => onOpenTab('Extrato e repasses')}>Conferir extratos e repasses</button><button type="button" onClick={() => onOpenTab('Profissionais')}>Conferir cadastro da equipe</button></div><p className="eq-muted">Sem salários, gorjetas ou comissão de planos inferidos. Não há cobrança, alteração de comissão, envio de mensagem ou gravação nesta tela.</p></section>
    </>}
  </div>
}
