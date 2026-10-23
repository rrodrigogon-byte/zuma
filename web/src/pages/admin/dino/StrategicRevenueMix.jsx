import { fmtR } from '../../../lib/api'
import './strategic-revenue-mix.css'

const COLORS = { services: '#5FB335', products: '#c9a656', plans: '#7c6ee6' }

export default function StrategicRevenueMix({ mix, title = 'Mix estratégico de receita', periodLabel = 'período selecionado' }) {
  if (!mix) return <section className="dino-strategic-mix" aria-busy="true"><p className="dino-strategic-mix-empty">Carregando o mix de receita…</p></section>
  const hasData = Number(mix.total || 0) > 0
  return <section className="dino-strategic-mix" aria-label={title}>
    <header className="dino-strategic-mix-header">
      <div><span>Receita por linha de negócio</span><h3>{title}</h3><p>Participação sobre valores com itemização confiável no {periodLabel}.</p></div>
      <div className="dino-strategic-mix-total"><span>Base classificada</span><strong>{fmtR(mix.total)}</strong></div>
    </header>
    {!hasData ? <p className="dino-strategic-mix-empty">Ainda não há recebimentos itemizados de serviços, produtos ou planos neste recorte.</p> : <div className="dino-strategic-mix-items">{(mix.items || []).map((item) => <article key={item.id}>
      <div className="dino-strategic-mix-item-top"><span><i style={{ background: COLORS[item.id] || 'var(--muted)' }} />{item.label}</span><strong>{Number(item.percentage || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</strong></div>
      <b><i style={{ width: `${Math.max(0, Math.min(100, Number(item.percentage || 0)))}%`, background: COLORS[item.id] || 'var(--muted)' }} /></b>
      <div className="dino-strategic-mix-item-bottom"><span>{fmtR(item.value)}</span><small>{item.records || 0} registro(s)</small></div>
    </article>)}</div>}
    <footer className="dino-strategic-mix-footnote">
      {Number(mix.unclassifiedConsolidatedRevenue || 0) > 0 && <p><strong>{fmtR(mix.unclassifiedConsolidatedRevenue)}</strong> da receita consolidada permanece sem classificação nesta visão (histórico, e-commerce sem itemização ou ajustes) e não entra nas fatias.</p>}
      {!mix.planPaymentsAvailable && <p>{mix.planPaymentsReason || 'Os recebimentos de planos não estão disponíveis para este escopo.'}</p>}
      <p>{mix.note}</p>
    </footer>
  </section>
}
