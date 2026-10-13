import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { stalloneOperation } from '../../lib/stallone-operation'
import './stallone-operation.css'

export default function StalloneOperation(props) {
  const operation = useMemo(() => stalloneOperation(props), [props.products, props.paymentAccounts, props.domains, props.shippingMethods, props.storefront, props.warnings, props.catalogUnavailable])
  return <section className="stallone-operation" aria-labelledby="stallone-operation-title">
    <header><div><span className="stallone-operation-eyebrow">STALLONE · CENTRAL DE OPERAÇÃO</span><h2 id="stallone-operation-title">O próximo passo da sua loja</h2><p>Pendências da loja e do estoque selecionados, com acesso direto à solução.</p></div><Link className="stallone-operation-store" to="/ecommerce/stallone">Ver loja online ↗</Link></header>
    <div className="stallone-operation-summary"><strong>{operation.tasks.length}</strong><span>pontos para conferir</span><small>Configuração e conteúdo; pagamento, fiscal e integrações precisam de homologação própria.</small></div>
    <div className="stallone-operation-tasks">{operation.tasks.map(task => <article key={task.id} data-kind={task.kind}><span>{task.kind === 'critical' ? 'Antes de vender' : task.kind === 'unknown' ? 'Dados indisponíveis' : 'Melhoria da operação'}</span><h3>{task.title}</h3><p>{task.detail}</p><Link aria-label={`Resolver: ${task.title}`} to={`/admin/ecommerce?tab=${task.tab}${['images', 'descriptions', 'stock'].includes(task.id) ? `&attention=${task.id}` : ''}`}>Resolver pendência <span aria-hidden="true">→</span></Link></article>)}</div>
    {!operation.tasks.length && <p>As verificações disponíveis não encontraram pendências. Confirme também pagamento, fiscal e entrega em operação antes de considerar a loja homologada.</p>}
  </section>
}
