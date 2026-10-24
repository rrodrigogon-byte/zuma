import { avecMixReportLink } from '../../../lib/avec-mix-report'
import { useAuth } from '../../../lib/auth'
import { useState } from 'react'
import { downloadCsv } from './format'
import { Link } from 'react-router-dom'
import { fmtR } from '../../../lib/api'
import './strategic-revenue-mix.css'

const COLORS = { services: '#5FB335', products: '#c9a656', plans: '#7c6ee6', tips: '#db8a42' }

function MixAction({ destination, onClick, children, className = '' }) {
  if (destination?.to) return <Link to={destination.to} className={`dino-strategic-mix-action ${className}`.trim()}>{children} <span aria-hidden="true">→</span></Link>
  if (onClick) return <button type="button" className={`dino-strategic-mix-action ${className}`.trim()} onClick={onClick}>{children} <span aria-hidden="true">→</span></button>
  return null
}

function MixItem({ item, destination, onOpenItem }) {
  const available = item.available !== false
  const percentage = Number(item.percentage || 0)
  const content = <><div className="dino-strategic-mix-item-top"><span><i style={{ background: COLORS[item.id] || 'var(--muted)' }} />{item.label}</span><strong>{available ? `${percentage.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : '—'}</strong></div><b aria-hidden="true"><i style={{ width: available ? `${Math.max(0, Math.min(100, percentage))}%` : '100%', background: COLORS[item.id] || 'var(--muted)' }} /></b><div className="dino-strategic-mix-item-bottom"><span>{available ? fmtR(item.value) : 'Cobertura indisponível'}</span><small>{available ? `${item.records || 0} registro(s)` : item.coverageReason}</small></div>{available && (destination || onOpenItem) && <small className="dino-strategic-mix-item-action">{destination?.label || 'Ver detalhes no BI'} <span aria-hidden="true">→</span></small>}</>
  if (available && destination?.to) return <Link to={destination.to} className="dino-strategic-mix-item-link" aria-label={`${item.label}: ${fmtR(item.value)}, ${percentage.toLocaleString('pt-BR')}%. ${destination.label}.`}>{content}</Link>
  if (available && onOpenItem) return <button type="button" className="dino-strategic-mix-item-link" onClick={() => onOpenItem(item)}>{content}</button>
  return <article className={available ? '' : 'unavailable'}>{content}</article>
}

const TYPE_LABELS = { services: 'Serviço', products: 'Produto', plans: 'Pacote', tips: 'Gorjeta' }
function HistoricalMixDetails({ history }) {
  const [open, setOpen] = useState(false), [limit, setLimit] = useState(50)
  const rows = history.details || []
  function exportItems() {
    downloadCsv('mix_avec_itens.csv', rows.map(row => ({ item: row.name, tipo: TYPE_LABELS[row.type], categoria: row.category, quantidade: row.quantity, registros: row.records, valor_apos_desconto: row.value, origem: 'Avec 0186 — data de venda', de: history.selectedFrom, ate_exclusivo: history.selectedToExclusive, arquivo: history.reportHash })))
  }
  return <details onToggle={event => setOpen(event.currentTarget.open)}><summary>Detalhamento dos itens Avec no período ({rows.length})</summary>{open && <><button type="button" onClick={exportItems} disabled={!rows.length}>Exportar todos os itens do recorte (CSV)</button><div style={{ overflowX: 'auto' }}><table><thead><tr><th>Item</th><th>Tipo</th><th>Categoria</th><th>Quantidade</th><th>Valor após desconto</th></tr></thead><tbody>{rows.slice(0, limit).map(row => <tr key={JSON.stringify([row.type, row.name, row.category])}><td>{row.name}</td><td>{TYPE_LABELS[row.type]}</td><td>{row.category}</td><td>{row.quantity}</td><td>{fmtR(row.value)}</td></tr>)}</tbody></table></div>{rows.length > limit && <button type="button" onClick={() => setLimit(value => value + 50)}>Mostrar mais 50 itens</button>}<p>Exibindo {Math.min(limit, rows.length)} de {rows.length}. O CSV inclui todos os itens do recorte.</p></>}</details>
}

export default function StrategicRevenueMix({ mix, title = 'Mix estratégico de receita', periodLabel = 'período selecionado', destinations = {}, onOpenItem, onOpenOverview }) {
  const { isPlatformAdmin } = useAuth()
  if (!mix) return <section className="dino-strategic-mix" aria-busy="true"><p className="dino-strategic-mix-empty">Carregando o mix de receita…</p></section>
  const hasData = Number(mix.total || 0) > 0
  const overviewDestination = destinations.overview
  const unclassifiedDestination = destinations.unclassified || overviewDestination
  return <section className="dino-strategic-mix" aria-label={title}>
    <header className="dino-strategic-mix-header">
      <div><span>Receita por linha de negócio</span><h3>{title}</h3><p>Participação sobre valores com itemização confiável no {periodLabel}.</p></div>
      <div className="dino-strategic-mix-heading-actions"><div className="dino-strategic-mix-total"><span>Base classificada</span><strong>{fmtR(mix.total)}</strong></div><MixAction destination={overviewDestination} onClick={onOpenOverview}>Ver relatório consolidado</MixAction></div>
    </header>
    {!hasData ? <div className="dino-strategic-mix-empty"><p>Ainda não há itens classificados de serviços, produtos ou planos neste recorte.</p><MixAction destination={overviewDestination} onClick={onOpenOverview}>Ver fontes e cobertura</MixAction></div> : <div className="dino-strategic-mix-items">{(mix.items || []).map((item) => <MixItem key={item.id} item={item} destination={mix.historical?.details?.some(row => row.type === item.id) ? { to: avecMixReportLink(mix.historical, item.id), label: 'Ver itens Avec no período' } : destinations[item.id]} onOpenItem={onOpenItem} />)}</div>}
    <footer className="dino-strategic-mix-footnote">
      {!mix.historical && Number(mix.unclassifiedConsolidatedRevenue || 0) > 0 && <p><strong>{fmtR(mix.unclassifiedConsolidatedRevenue)}</strong> da receita consolidada permanece sem classificação nesta visão (histórico, e-commerce sem itemização ou ajustes) e não entra nas fatias. <MixAction destination={unclassifiedDestination} onClick={onOpenOverview}>Ver fontes e cobertura</MixAction></p>}
      {!mix.planPaymentsAvailable && <p>{mix.planPaymentsReason || 'Os recebimentos de planos não estão disponíveis para este escopo.'}</p>}
      {mix.historicalMixUnavailable && <p role="alert">A fonte histórica Avec está temporariamente indisponível. A base abaixo pode estar incompleta.</p>}
      {mix.historical && <><p><strong>{fmtR(mix.historical.value)}</strong> em itens Avec no recorte. Histórico disponível: {mix.historical.from} a {mix.historical.to}; {mix.historical.heldRows} linhas retidas em todo o arquivo para conferência ({fmtR(mix.historical.heldCents / 100)}).</p><p>Recebimentos consolidados no recorte: <strong>{fmtR(mix.consolidatedRevenue)}</strong>. Venda itemizada e recebimento usam datas e critérios diferentes.</p><HistoricalMixDetails history={mix.historical} /></>}
      <p>{mix.note}</p>
      {mix.historical && <p><Link to="/admin/avec-relatorio">Abrir relatório de todo o histórico Avec</Link></p>}
      {isPlatformAdmin && <Link to="/admin/avec-historico">Conferir histórico Avec</Link>}
    </footer>
  </section>
}
