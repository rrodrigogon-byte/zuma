import { useCallback, useEffect, useRef, useState } from 'react'
import { api, fmtR } from '../../lib/api'

function dataCurta(value) {
  if (!value) return 'Data indisponível'
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? new Date(`${value}T12:00:00`) : new Date(value)
  return Number.isNaN(date.valueOf()) ? 'Data indisponível' : date.toLocaleDateString('pt-BR', { timeZone: 'America/Cuiaba' })
}

function tempoDesde(value) {
  if (value == null || !Number.isFinite(Number(value))) return 'sem data confirmada'
  const days = Number(value)
  return days === 0 ? 'hoje' : days === 1 ? 'há 1 dia' : `há ${days} dias`
}

function Section({ title, description, items, empty, children, renderItem }) {
  return <section style={{ display: 'grid', gap: 6, paddingTop: 10, borderTop: '1px solid var(--line, #d9dce2)' }}>
    <div style={{ fontSize: 13, fontWeight: 800 }}>{title}</div>
    {description && <div style={{ fontSize: 12, opacity: 0.78 }}>{description}</div>}
    {children}
    {items?.length ? <div style={{ display: 'grid', gap: 7 }}>{items.map(renderItem)}</div> : !children && <div style={{ fontSize: 12, opacity: 0.72 }}>{empty}</div>}
  </section>
}

export default function DinoSalesAssistantPanel({
  appointmentId, endpointBase = '/api/admin/barbearia/modo-barbeiro/atendimento', currentServiceId = '',
  defaultOpen = false, compact = false,
} = {}) {
  const [open, setOpen] = useState(Boolean(defaultOpen))
  const [state, setState] = useState({ loading: false, data: null, error: '' })
  const requestId = useRef(0)
  const loadedAppointment = useRef('')

  const load = useCallback(async () => {
    if (!appointmentId || loadedAppointment.current === String(appointmentId)) return
    const id = ++requestId.current
    setState({ loading: true, data: null, error: '' })
    try {
      const payload = await api.get(`${endpointBase}/${encodeURIComponent(appointmentId)}/assistente`)
      if (id !== requestId.current) return
      loadedAppointment.current = String(appointmentId)
      setState({ loading: false, data: payload?.assistente || null, error: '' })
    } catch (error) {
      if (id !== requestId.current) return
      setState({ loading: false, data: null, error: error.message || 'Não foi possível carregar o histórico deste atendimento.' })
    }
  }, [appointmentId, endpointBase])

  useEffect(() => {
    if (defaultOpen) load()
    return () => { requestId.current += 1 }
  }, [defaultOpen, load])

  function toggle(event) {
    const nextOpen = Boolean(event.currentTarget.open)
    setOpen(nextOpen)
    if (nextOpen) load()
  }

  const data = state.data
  const disabledReason = data?.motivo === 'cliente_sem_cadastro_vinculado'
    ? 'Este agendamento não está ligado a um cadastro individual do CRM. Nenhum cliente foi inferido pelo telefone.'
    : data?.motivo === 'vinculo_nao_confirmado'
      ? 'O vínculo individual não pôde ser confirmado. O histórico e as recomendações foram ocultados para evitar mistura de clientes.'
      : data?.motivo === 'unidade_nao_selecionada'
        ? 'Selecione a unidade do atendimento para restringir o histórico e as recomendações à loja correta.'
        : 'Assistente indisponível para este atendimento.'

  return <details open={open} onToggle={toggle} style={{ border: '1px solid var(--line, #d9dce2)', borderRadius: 12, padding: compact ? 9 : 12, background: 'var(--card, transparent)', color: 'inherit' }}>
    <summary style={{ cursor: 'pointer', fontWeight: 800, fontSize: 13, listStylePosition: 'inside' }}>Assistente do cliente</summary>
    <div style={{ display: 'grid', gap: 10, paddingTop: 10, fontSize: 13 }}>
      <div style={{ opacity: 0.78 }}>Apoio interno baseado em histórico concluído. Confirme a necessidade com o cliente; o painel não cria venda, comanda ou mensagem.</div>
      {state.loading && <div role="status">Carregando histórico e recomendações…</div>}
      {state.error && <div role="alert" style={{ color: 'var(--danger, #b42318)' }}>{state.error}</div>}
      {!state.loading && data?.disponivel === false && <div role="status">{disabledReason}</div>}
      {!state.loading && data?.disponivel === true && <>
        <Section title="Último serviço por procedimento" description="Histórico concluído do cadastro individual, com fontes e unidade quando disponíveis." items={data.historicoServicos} empty="Nenhum serviço concluído vinculado a este cliente." renderItem={(item) => <div key={item.serviceId || item.nome} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, borderRadius: 8, padding: '7px 9px', background: 'color-mix(in srgb, #5aa9f0 8%, transparent)' }}><span><strong>{item.nome}</strong><div style={{ opacity: 0.75 }}>último: {dataCurta(item.ultimaRealizacaoEm)} · {tempoDesde(item.diasDesdeUltima)} · {item.atendimentos} atendimento(s){item.unidadeIndefinida ? ' · unidade não identificada' : ''}</div></span><span style={{ whiteSpace: 'nowrap', fontSize: 11, opacity: 0.75 }}>{(item.origens || []).join(' · ')}</span></div>} />
        <Section title="Últimas compras do cliente" description="Comandas faturadas e revendas pagas; confira a data e a unidade antes de oferecer." items={data.historicoProdutos} empty="Nenhuma compra local ligada ao cadastro individual." renderItem={(item) => <div key={item.produtoId || item.nome} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, borderRadius: 8, padding: '7px 9px', background: 'color-mix(in srgb, #6e7ce0 7%, transparent)' }}><span><strong>{item.nome}</strong><div style={{ opacity: 0.75 }}>última compra: {dataCurta(item.ultimaCompraEm)} · {tempoDesde(item.diasDesdeUltima)} · {item.compras} compra(s){item.unidadeIndefinida ? ' · unidade não identificada' : ''}</div></span><span style={{ whiteSpace: 'nowrap', fontSize: 11, opacity: 0.75 }}>{item.quantidadeTotal} un. · {(item.origens || []).join(' · ')}</span></div>} />
        <Section title="Serviços no período para oferecer" description="O serviço atual e serviços já agendados não são sugeridos." items={data.servicosParaOferecer} empty="Nenhum procedimento com intervalo atingido e histórico individual confirmado." renderItem={(item) => <div key={item.servicoId} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, borderRadius: 8, padding: '7px 9px', background: 'color-mix(in srgb, #14b87a 10%, transparent)' }}><span><strong>{item.nome}</strong><div style={{ opacity: 0.75 }}>{item.categoria} · último: {dataCurta(item.ultimaRealizacaoEm)} · {tempoDesde(item.diasDesdeUltima)}</div></span><span style={{ whiteSpace: 'nowrap', fontWeight: 700 }}>{item.intervaloDias} dias</span></div>} />
        <Section title="Serviços realizados recentemente" description="Histórico recente evita repetição. Quando a unidade de origem é desconhecida, mostramos apenas como contexto e nunca ofertamos automaticamente." items={data.servicosRecentes} empty="Nenhum procedimento recente encontrado." renderItem={(item) => <div key={item.servicoId} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, borderRadius: 8, padding: '7px 9px', background: 'color-mix(in srgb, #e0b24b 12%, transparent)' }}><span><strong>{item.nome}</strong><div style={{ opacity: 0.75 }}>último: {dataCurta(item.ultimaRealizacaoEm)} · {tempoDesde(item.diasDesdeUltima)}</div></span><span style={{ textAlign: 'right', fontSize: 11, opacity: 0.8 }}>{item.motivo === 'unidade_nao_identificada' ? 'unidade não identificada · sem oferta' : item.intervaloDias ? `${Math.max(0, item.intervaloDias - item.diasDesdeUltima)} dia(s) para o intervalo` : 'configurar intervalo'}</span></div>} />
        <Section title="Oportunidades de produtos" description="Somente itens já comprados, com periodicidade vencida e estoque disponível." items={data.oportunidadesProdutos} empty="Nenhuma recompra identificada com estoque disponível." renderItem={(item) => <div key={item.produtoId} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, borderRadius: 8, padding: '7px 9px', background: 'color-mix(in srgb, #6e7ce0 10%, transparent)' }}><span><strong>{item.nome}</strong><div style={{ opacity: 0.75 }}>última compra: {dataCurta(item.ultimaCompraEm)} · {tempoDesde(item.diasDesdeUltima)}</div></span><span style={{ textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700 }}>{item.precoVenda == null ? '' : fmtR(item.precoVenda)}</span></div>} />
        {data.produtosRecentes?.length > 0 && <div style={{ fontSize: 12, opacity: 0.74 }}>Compras recentes: {data.produtosRecentes.map((item) => `${item.nome} (${tempoDesde(item.diasDesdeUltima)})${item.motivo === 'unidade_nao_identificada' ? ' · unidade não identificada' : ''}`).join(' · ')}.</div>}
        {currentServiceId && <div style={{ fontSize: 11, opacity: 0.7 }}>Referência do atendimento: serviço atual ocultado da lista de ofertas.</div>}
      </>}
    </div>
  </details>
}
