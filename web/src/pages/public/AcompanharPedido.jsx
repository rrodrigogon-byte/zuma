import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, CheckCircle2, Clock3, CreditCard, MapPin, PackageCheck, RefreshCw, Star, Truck, XCircle } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { api, fmtR } from '../../lib/api'
import { normalizeStorefrontAlias, storefrontApiBase, storefrontRoute } from '../../lib/storefront'
import './order-tracking.css'

const FINAL_STATUSES = new Set(['delivered', 'picked_up', 'completed'])
const PAID_STATUSES = new Set(['paid', 'processing', 'ready', 'ready_for_pickup', 'shipped', 'delivered', 'picked_up', 'completed'])
const PAYMENT_CONFIRMED = new Set(['captured', 'paid', 'approved', 'authorized'])
const LEGACY_STATUS = { pendente: 'pending_payment', preparando: 'processing', pronto: 'ready_for_pickup', entregue: 'completed', cancelado: 'cancelled' }
const STATUS_STAGE = {
  draft: 0,
  pending_payment: 0,
  payment_failed: 0,
  fraud_review: 0,
  paid: 1,
  processing: 2,
  ready: 2,
  ready_for_pickup: 3,
  shipped: 3,
  out_for_delivery: 3,
  delivered: 4,
  picked_up: 4,
  completed: 4,
}
const JOURNEY = [
  { label: 'Pedido recebido', detail: 'Recebemos os dados da compra.' },
  { label: 'Pagamento confirmado', detail: 'O pagamento foi confirmado pelo provedor.' },
  { label: 'Em preparação', detail: 'A loja está separando os itens.' },
  { label: 'Entrega ou retirada', detail: 'O pedido saiu para entrega ou está pronto para retirada.' },
  { label: 'Concluído', detail: 'Pedido entregue ou retirado.' },
]
const STATUS_COPY = {
  draft: ['Pedido em rascunho', 'A compra ainda não foi enviada.'],
  pending_payment: ['Aguardando pagamento', 'O pedido foi criado e aguarda a conclusão do pagamento no provedor seguro.'],
  payment_failed: ['Pagamento não confirmado', 'O provedor não confirmou o pagamento e o pedido foi encerrado. Para comprar, monte um novo carrinho na loja.'],
  fraud_review: ['Pagamento em análise', 'O provedor está analisando a transação. Aguarde a próxima atualização.'],
  paid: ['Pagamento confirmado', 'O pagamento foi confirmado e a loja iniciará a preparação.'],
  processing: ['Pedido em preparação', 'A equipe está separando e conferindo os produtos.'],
  ready: ['Pronto para envio', 'O pedido está pronto para seguir para a transportadora.'],
  ready_for_pickup: ['Pronto para retirada', 'Apresente o código do pedido no local de retirada.'],
  shipped: ['Pedido enviado', 'O pedido foi entregue à transportadora.'],
  out_for_delivery: ['Saiu para entrega', 'O pedido está na etapa final do transporte.'],
  delivered: ['Pedido entregue', 'A entrega foi concluída. Obrigado por comprar com a Dino.'],
  picked_up: ['Pedido retirado', 'A retirada foi concluída. Obrigado por comprar com a Dino.'],
  completed: ['Pedido concluído', 'Todo o ciclo da compra foi concluído.'],
  cancelled: ['Pedido cancelado', 'Este pedido foi cancelado e não seguirá para preparação.'],
  refunded: ['Pagamento estornado', 'O estorno foi registrado. Consulte o provedor para acompanhar o prazo.'],
  partially_refunded: ['Estorno parcial', 'Parte do valor foi estornada pelo provedor.'],
  returned: ['Pedido devolvido', 'A devolução foi registrada pela operação.'],
}
const EVENT_LABELS = Object.fromEntries(Object.entries(STATUS_COPY).map(([key, value]) => [key, value[0]]))
const FULFILLMENT_LABELS = {
  pending: 'Aguardando preparação', preparing: 'Em separação', ready: 'Pronto para envio', shipped: 'Enviado',
  out_for_delivery: 'Em rota de entrega', delivered: 'Entregue', picked_up: 'Retirado', failed: 'Falha na entrega', cancelled: 'Entrega cancelada',
}

function fmtDate(value) {
  if (!value) return 'Atualização recente'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('pt-BR')
}

function shippingPromise(option) {
  const total = option?.deliveryRange?.max ?? option?.deliveryDays
  if (option?.preparationDays !== null && option?.preparationDays !== undefined && option?.providerDeliveryDays !== null && option?.providerDeliveryDays !== undefined && total !== null && total !== undefined) {
    return `${option.carrier || 'Transportadora'} · ${option.preparationDays} dias úteis de preparação + ${option.providerDeliveryDays} dias úteis de transporte · total estimado: ${total} dias úteis`
  }
  return `${option?.carrier || 'Transportadora'}${total ? ` · até ${total} dias úteis` : ''}`
}

function normalizeCoreOrder(order) {
  const paymentConfirmed = PAYMENT_CONFIRMED.has(String(order.payment_status || '').toLowerCase()) || PAID_STATUSES.has(order.status)
  return {
    ...order,
    codigo: order.public_code,
    coreStatus: order.status || null,
    pagamento: paymentConfirmed ? 'pago' : order.status === 'payment_failed' ? 'falhou' : 'pendente',
    itens: (order.items || []).map(item => ({ nome: item.nome, qtd: item.quantidade, preco: item.preco, subtotal: item.subtotal, sku: item.sku })),
    fulfillments: Array.isArray(order.fulfillments) ? order.fulfillments : [],
    timeline: Array.isArray(order.timeline) ? order.timeline : [],
    shippingOption: order.shippingOption || order.shipping_option || null,
    satisfactionEligible: order.satisfactionEligible === true,
    satisfaction: order.satisfaction || { submitted: false },
    isCore: true,
  }
}

function surveyStorageKey(storeAlias, code) {
  return `sp:commerce:${storeAlias || 'host'}:satisfaction:${String(code || '').toUpperCase()}`
}

function surveyIdempotencyKey(storeAlias, code) {
  const key = surveyStorageKey(storeAlias, code)
  const existing = localStorage.getItem(key)
  if (existing) return existing
  const value = `satisfaction-${String(code || '').toUpperCase()}-${crypto.randomUUID()}`
  localStorage.setItem(key, value)
  return value
}

function statusPresentation(order) {
  const fulfillment = order?.fulfillments?.[0]
  const fulfillmentStatus = String(fulfillment?.status || '').toLowerCase()
  const rawStatus = String(order?.coreStatus || order?.status || 'pending_payment').toLowerCase()
  const status = fulfillmentStatus === 'out_for_delivery' ? fulfillmentStatus : (LEGACY_STATUS[rawStatus] || rawStatus)
  const copy = STATUS_COPY[status] || [EVENT_LABELS[order?.coreStatus] || 'Pedido em atualização', 'Acompanhe as próximas movimentações nesta página.']
  return { status, title: copy[0], detail: copy[1], stage: STATUS_STAGE[status] ?? STATUS_STAGE[order?.coreStatus] ?? 0 }
}

export default function AcompanharPedido() {
  const { codigo, storeAlias: routeAlias = '' } = useParams()
  const storeAlias = normalizeStorefrontAlias(routeAlias)
  const storefrontApi = storefrontApiBase(storeAlias)
  const storeRoute = storefrontRoute(storeAlias, 'store')
  const checkoutRoute = storefrontRoute(storeAlias, 'checkout')
  const [pedido, setPedido] = useState(null)
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [survey, setSurvey] = useState({ rating: 0, wouldRecommend: null })
  const [surveyError, setSurveyError] = useState('')
  const [surveySending, setSurveySending] = useState(false)
  const [surveySent, setSurveySent] = useState(false)
  const [statusAnnouncement, setStatusAnnouncement] = useState('')
  const lastAnnouncedStatus = useRef('')

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true)
    try {
      try {
        const core = await api.get(`${storefrontApi}/orders/${encodeURIComponent(codigo)}`)
        setPedido(normalizeCoreOrder(core))
      } catch (coreError) {
        if (storeAlias || coreError.status !== 404) throw coreError
        const legacy = await api.get(`/api/loja/pedido/${encodeURIComponent(codigo)}`)
        setPedido(legacy)
      }
      setErro('')
    } catch (e) {
      setErro(e.message || 'Pedido não encontrado')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [codigo, storefrontApi, storeAlias])

  useEffect(() => {
    load()
    const timer = window.setInterval(() => load({ quiet: true }), 10000)
    return () => window.clearInterval(timer)
  }, [load])

  const presentation = statusPresentation(pedido)
  const cancelled = ['cancelled', 'refunded', 'partially_refunded', 'returned'].includes(presentation.status)
  const latestFulfillment = pedido?.fulfillments?.[0] || null
  const fulfillmentTitle = latestFulfillment
    ? (FULFILLMENT_LABELS[latestFulfillment.status] || latestFulfillment.status)
    : FINAL_STATUSES.has(presentation.status) ? 'Concluída' : 'Ainda não iniciada'
  const fulfillmentDetail = latestFulfillment?.carrier || pedido?.shippingOption?.carrier
    || (FINAL_STATUSES.has(presentation.status) ? 'Pedido entregue ou retirado conforme a modalidade escolhida.' : 'A logística será definida após o pagamento.')
  const submitted = surveySent || pedido?.satisfaction?.submitted === true
  const eligible = pedido?.isCore === true && (pedido?.satisfactionEligible === true || FINAL_STATUSES.has(presentation.status))
  const events = useMemo(() => [...(pedido?.timeline || [])].slice(-8).reverse(), [pedido?.timeline])

  useEffect(() => {
    if (!pedido || !presentation.status || presentation.status === lastAnnouncedStatus.current) return
    lastAnnouncedStatus.current = presentation.status
    setStatusAnnouncement(`Status do pedido: ${presentation.title}. ${presentation.detail}`)
  }, [pedido, presentation.status, presentation.title, presentation.detail])

  async function submitSurvey(event) {
    event.preventDefault()
    if (!survey.rating) return setSurveyError('Selecione uma nota de 1 a 5.')
    if (typeof survey.wouldRecommend !== 'boolean') return setSurveyError('Informe se recomendaria a experiência.')
    setSurveySending(true)
    setSurveyError('')
    try {
      const idempotencyKey = surveyIdempotencyKey(storeAlias, codigo)
      await api.post(`${storefrontApi}/orders/${encodeURIComponent(codigo)}/satisfaction`, {
        rating: survey.rating,
        wouldRecommend: survey.wouldRecommend,
        idempotencyKey,
      }, { headers: { 'X-Idempotency-Key': idempotencyKey } })
      setSurveySent(true)
    } catch (error) {
      if (error.code === 'SATISFACTION_ALREADY_SUBMITTED') setSurveySent(true)
      else setSurveyError(error.message || 'Não foi possível enviar a avaliação.')
    } finally { setSurveySending(false) }
  }

  return <main className="order-tracking-page">
    <div className="order-tracking-shell">
      <Link to={storeRoute} className="order-tracking-back">← Voltar à loja</Link>
      <section className="order-tracking-card">
        <header className="order-tracking-header">
          <div><span className="order-tracking-eyebrow">Acompanhar pedido</span><h1>{codigo}</h1></div>
          <button type="button" className="order-refresh" onClick={() => load({ quiet: true })} disabled={refreshing} aria-label="Atualizar status do pedido"><RefreshCw size={16} className={refreshing ? 'is-spinning' : ''} /> Atualizar</button>
        </header>

        {loading ? <div className="order-loading"><Clock3 size={22} /> Carregando status…</div> : erro ? <div className="order-error" role="alert"><XCircle size={20} /> <span>{erro}. Confira o código do pedido.</span></div> : <>
          <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{statusAnnouncement}</span>
          <section className={`order-current-status ${cancelled ? 'is-negative' : ''}`}>
            <span className="order-status-icon">{cancelled ? <XCircle size={24} /> : <PackageCheck size={24} />}</span>
            <div><span>Status atual</span><h2>{presentation.title}</h2><p>{presentation.detail}</p></div>
            <strong>{fmtDate(pedido.atualizado_em || pedido.atualizadoEm || pedido.criado_em)}</strong>
          </section>

          {!cancelled && <ol className="order-journey" aria-label="Etapas do pedido">
            {JOURNEY.map((step, index) => {
              const done = index < presentation.stage || presentation.stage === JOURNEY.length - 1
              const current = index === presentation.stage
              return <li key={step.label} className={`${done ? 'is-done' : ''} ${current ? 'is-current' : ''}`}>
                <span className="order-journey-dot" aria-hidden="true">{done ? <Check size={16} /> : index + 1}</span>
                <div><strong>{step.label}</strong><small>{step.detail}</small></div>
              </li>
            })}
          </ol>}

          <div className="order-detail-grid">
            <section className="order-detail-card"><CreditCard size={19} /><div><span>Pagamento</span><strong>{pedido.pagamento === 'pago' ? 'Confirmado' : pedido.pagamento === 'falhou' ? 'Não confirmado' : 'Aguardando confirmação'}</strong><small>Processado fora da Kytto pelo provedor seguro.</small></div></section>
            <section className="order-detail-card"><Truck size={19} /><div><span>Entrega</span><strong>{fulfillmentTitle}</strong><small>{fulfillmentDetail}</small></div></section>
            {pedido.endereco_entrega && <section className="order-detail-card"><MapPin size={19} /><div><span>Destino</span><strong>{[pedido.endereco_entrega.cidade, pedido.endereco_entrega.estado].filter(Boolean).join(' / ') || 'Endereço protegido'}</strong><small>CEP {pedido.endereco_entrega.cep || 'protegido'}</small></div></section>}
          </div>

          {pedido.shippingOption?.deliveryDays !== null && pedido.shippingOption?.deliveryDays !== undefined && <section className="order-shipping-promise"><Clock3 size={18} /><div><span>Prazo total estimado</span><strong>{shippingPromise(pedido.shippingOption)}</strong></div></section>}

          {pedido.isCore && presentation.status === 'pending_payment' && <Link className="order-primary-action" to={`${checkoutRoute}?order=${encodeURIComponent(codigo)}`}>Concluir pagamento <ArrowRight size={17} /></Link>}

          {latestFulfillment && <section className="order-fulfillment"><header><div><span>Logística</span><h2>{FULFILLMENT_LABELS[latestFulfillment.status] || latestFulfillment.status}</h2></div>{latestFulfillment.carrier && <strong>{latestFulfillment.carrier}</strong>}</header>{latestFulfillment.trackingCode && <div className="order-tracking-code"><span>Código de rastreio</span><strong>{latestFulfillment.trackingCode}</strong></div>}{latestFulfillment.trackingUrl && <a href={latestFulfillment.trackingUrl} target="_blank" rel="noreferrer">Acompanhar na transportadora <ArrowRight size={15} /></a>}{Array.isArray(latestFulfillment.ocorrencias) && latestFulfillment.ocorrencias.length > 0 && <div className="order-events">{latestFulfillment.ocorrencias.slice(-5).reverse().map((item, index) => <article key={`${item.at || item.data || index}-${index}`}><time>{fmtDate(item.at || item.data)}</time><strong>{item.description || item.descricao || item.status || item.mensagem || 'Movimentação registrada'}</strong></article>)}</div>}</section>}

          <section className="order-items"><header><span>Itens do pedido</span><strong>{(pedido.itens || []).reduce((sum, item) => sum + Number(item.qtd || 0), 0)} unidade(s)</strong></header>{(pedido.itens || []).map((item, index) => <div key={`${item.sku || item.nome}-${index}`}><span><b>{item.qtd}×</b> {item.nome}</span><strong>{fmtR(item.subtotal ?? Number(item.preco || 0) * Number(item.qtd || 1))}</strong></div>)}<footer><span>Total</span><strong>{fmtR(pedido.total || 0)}</strong></footer></section>

          <section className="order-history"><header><div><span>Histórico</span><h2>Atualizações do pedido</h2></div><small>Atualização automática a cada 10 segundos</small></header>{events.length ? <div>{events.map((item, index) => <article key={`${item.at || index}-${index}`}><time>{fmtDate(item.at)}</time><span className="order-history-marker" aria-hidden="true" /><div><strong>{EVENT_LABELS[item.toStatus] || item.toStatus || 'Atualização do pedido'}</strong><small>{item.source === 'system' ? 'Atualização automática' : item.source === 'checkout' ? 'Registrado no checkout' : 'Atualizado pela operação'}</small></div></article>)}</div> : <p>O pedido foi registrado. Novas movimentações aparecerão aqui.</p>}</section>

          {eligible && <section className="order-survey" aria-labelledby="order-survey-title">
            {submitted ? <div className="order-survey-thanks"><CheckCircle2 size={28} /><div><h2 id="order-survey-title">Obrigado pela avaliação</h2><p>Sua resposta foi registrada uma única vez e ajudará a Dino a melhorar.</p></div></div> : <form onSubmit={submitSurvey}>
              <span className="order-tracking-eyebrow">Pesquisa de satisfação</span>
              <h2 id="order-survey-title">Como foi sua experiência?</h2>
              <p>A pesquisa é opcional e aparece somente após a conclusão do pedido.</p>
              <fieldset><legend>Nota de 1 a 5</legend><div className="order-rating">{[1, 2, 3, 4, 5].map(value => <label key={value} className={survey.rating >= value ? 'is-selected' : ''}><input type="radio" name="order-rating" value={value} checked={survey.rating === value} onChange={() => setSurvey(current => ({ ...current, rating: value }))} /><span aria-hidden="true"><Star size={21} fill={survey.rating >= value ? 'currentColor' : 'none'} /></span><span className="order-visually-hidden">{value} {value === 1 ? 'estrela' : 'estrelas'}</span></label>)}</div></fieldset>
              <fieldset><legend>Você recomendaria a Dino?</legend><div className="order-recommend"><label className={survey.wouldRecommend === true ? 'is-selected' : ''}><input type="radio" name="order-recommend" checked={survey.wouldRecommend === true} onChange={() => setSurvey(current => ({ ...current, wouldRecommend: true }))} /><span>Sim</span></label><label className={survey.wouldRecommend === false ? 'is-selected' : ''}><input type="radio" name="order-recommend" checked={survey.wouldRecommend === false} onChange={() => setSurvey(current => ({ ...current, wouldRecommend: false }))} /><span>Não</span></label></div></fieldset>
              {surveyError && <div className="order-error" role="alert">{surveyError}</div>}
              <button type="submit" className="order-primary-action" disabled={surveySending}>{surveySending ? 'Enviando avaliação…' : 'Enviar avaliação'}</button>
              <small>Armazenamos somente a nota e sua resposta de recomendação, sem texto livre ou dados de pagamento.</small>
            </form>}
          </section>}
        </>}
      </section>
      <p className="order-tracking-footnote">Os dados exibidos são limitados a este pedido e atualizados diretamente pelo Commerce Core.</p>
    </div>
  </main>
}
