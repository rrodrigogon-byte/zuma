import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, fmtR } from '../../../lib/api'
import { useToast } from '../../../hooks/useToast'
import { API, Avatar, Badge, daysLabel, Dialog, EmptyLine, profilePath, REASONS, SEGMENTS } from './shared'
import DinoRecuperacaoAvecPanel from '../dino/DinoRecuperacaoAvecPanel'

const SEGMENT_ORDER = ['vip', 'recorrente', 'novo', 'em_risco', 'inativo', 'sem_historico']
const SORTS = [
  ['valor', 'Maior valor'],
  ['recente', 'Atividade mais recente'],
  ['sumidos', 'Há mais tempo sem vir'],
  ['visitas', 'Mais visitas'],
  ['saldo', 'Maior saldo a receber'],
  ['nome', 'Nome (A–Z)'],
]
const SOURCES = [
  ['', 'Todas as origens'],
  ['ambas', 'Barbearia e loja'],
  ['barbearia', 'Só barbearia'],
  ['loja', 'Só loja online'],
]
const PARAM_KEYS = ['q', 'segmento', 'fonte', 'saldo', 'carrinho', 'etiqueta', 'ordem', 'pagina']

// Cache em memória no cliente para renderização instantânea (0ms) ao voltar da ficha
const clientPortfolioCache = new Map()

function useDebounced(value, delay = 250) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

function SummaryCards({ resumo, onSegment, active }) {
  if (!resumo) return null
  const cards = [
    ['Clientes', resumo.clientes.toLocaleString('pt-BR'), `${resumo.ambasFontes} compram na barbearia e na loja`, ''],
    ['Valor da carteira', fmtR(resumo.valorTotal), `${fmtR(resumo.ticketPorCliente)} por cliente`, ''],
    ['VIP', resumo.porSegmento.vip, 'Alto valor ou alta frequência', 'vip'],
    ['Em risco', resumo.porSegmento.em_risco, '45 a 90 dias sem atividade', 'em_risco'],
    ['Inativos', resumo.porSegmento.inativo, 'Mais de 90 dias sem atividade', 'inativo'],
    ['A receber', fmtR(resumo.aReceber), `${resumo.comSaldo} cliente(s) com saldo`, ''],
  ]
  return (
    <div className="c360-kpis">
      {cards.map(([label, value, hint, segment]) =>
        segment ? (
          <button
            key={label}
            type="button"
            className={`c360-kpi-button${active === segment ? ' is-active' : ''}`}
            onClick={() => onSegment(active === segment ? '' : segment)}
            aria-pressed={active === segment}
          >
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{hint}</small>
          </button>
        ) : (
          <article key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{hint}</small>
          </article>
        )
      )}
    </div>
  )
}

function SummaryCardsSkeleton() {
  return (
    <div className="c360-kpis c360-kpis-skeleton" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, idx) => (
        <article key={idx} className="c360-skeleton-kpi">
          <div className="c360-sk-line short" />
          <div className="c360-sk-line big" />
          <div className="c360-sk-line medium" />
        </article>
      ))}
    </div>
  )
}

function PortfolioTableSkeleton() {
  return (
    <div className="c360-table-wrap c360-table-skeleton" aria-hidden="true">
      <table className="c360-table c360-portfolio">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Segmento</th>
            <th className="num">Valor</th>
            <th className="num">Visitas</th>
            <th className="num">Pedidos</th>
            <th>Atividade</th>
            <th className="num">A receber</th>
            <th style={{ textAlign: 'center', width: 90 }}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 6 }).map((_, i) => (
            <tr key={i} className="c360-sk-row">
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="c360-sk-circle" />
                  <div style={{ display: 'grid', gap: 4, flex: 1 }}>
                    <div className="c360-sk-line medium" />
                    <div className="c360-sk-line short" />
                  </div>
                </div>
              </td>
              <td><div className="c360-sk-badge" /></td>
              <td className="num"><div className="c360-sk-line short" style={{ marginLeft: 'auto' }} /></td>
              <td className="num"><div className="c360-sk-line tiny" style={{ marginLeft: 'auto' }} /></td>
              <td className="num"><div className="c360-sk-line tiny" style={{ marginLeft: 'auto' }} /></td>
              <td><div className="c360-sk-line medium" /></td>
              <td className="num"><div className="c360-sk-line short" style={{ marginLeft: 'auto' }} /></td>
              <td><div className="c360-sk-line short" style={{ margin: '0 auto' }} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PortfolioTable({ rows, onOpen }) {
  if (!rows.length) return null
  return (
    <div className="c360-table-wrap">
      <table className="c360-table c360-portfolio">
        <caption className="sr-only">Carteira de clientes</caption>
        <thead>
          <tr>
            <th scope="col">Cliente</th>
            <th scope="col">Segmento</th>
            <th scope="col" className="num">Valor vitalício</th>
            <th scope="col" className="num">Visitas</th>
            <th scope="col" className="num">Pedidos</th>
            <th scope="col">Última atividade</th>
            <th scope="col" className="num">A receber</th>
            <th scope="col" style={{ textAlign: 'center', width: 100 }}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const segment = SEGMENTS[row.metricas.segmento] || SEGMENTS.sem_historico
            const phoneDigits = String(row.telefone || '').replace(/\D/g, '')
            const hasWa = phoneDigits.length >= 10
            const waHref = hasWa
              ? `https://wa.me/55${phoneDigits.startsWith('55') ? phoneDigits.slice(2) : phoneDigits}`
              : null
            const agendaHref = `/admin/barbearia?tab=Agenda&clienteId=${encodeURIComponent(row.ref)}&clienteNome=${encodeURIComponent(row.nome)}`

            return (
              <tr key={row.ref} className="c360-row-hoverable">
                <td>
                  <button type="button" className="c360-row-link" onClick={() => onOpen(row.ref)}>
                    <Avatar name={row.nome} />
                    <span>
                      <strong>{row.nome}</strong>
                      <small>{[row.telefone, row.email].filter(Boolean).join(' · ') || 'Sem contato'}</small>
                    </span>
                  </button>
                  <div className="c360-row-tags">
                    {row.fontes.map((fonte) => (
                      <Badge key={fonte} tone={fonte === 'loja' ? 'info' : 'muted'}>
                        {fonte === 'loja' ? 'Loja' : 'Barbearia'}
                      </Badge>
                    ))}
                    {row.etiquetas.slice(0, 3).map((tag) => (
                      <Badge key={tag} tone="accent">
                        #{tag}
                      </Badge>
                    ))}
                    {row.possivelDuplicidade && (
                      <Badge tone="warning" title="Confira na fila de duplicados">
                        Duplicidade?
                      </Badge>
                    )}
                    {row.metricas.carrinhosAbertos > 0 && <Badge tone="warning">Carrinho aberto</Badge>}
                  </div>
                </td>
                <td>
                  <Badge tone={segment.tone} title={segment.hint}>
                    {segment.label}
                  </Badge>
                </td>
                <td className="num">
                  <strong>{fmtR(row.metricas.valorVitalicio)}</strong>
                </td>
                <td className="num">
                  {row.metricas.visitas}
                  {row.metricas.faltas ? <small className="c360-muted"> · {row.metricas.faltas} falta(s)</small> : null}
                </td>
                <td className="num">{row.metricas.pedidos}</td>
                <td>
                  {daysLabel(row.metricas.diasSemAtividade)}
                  {row.metricas.proximoAtendimentoEm && (
                    <small className="c360-muted c360-block">
                      Próximo: {new Date(row.metricas.proximoAtendimentoEm).toLocaleDateString('pt-BR')}
                    </small>
                  )}
                </td>
                <td className={`num${row.metricas.aReceber > 0 ? ' c360-alert-text' : ''}`}>
                  {row.metricas.aReceber > 0 ? fmtR(row.metricas.aReceber) : '—'}
                </td>
                <td style={{ textAlign: 'center' }}>
                  <div className="c360-row-actions">
                    {hasWa && (
                      <a
                        href={waHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="c360-action-btn wa"
                        title={`Conversar com ${row.nome} no WhatsApp`}
                        aria-label="WhatsApp"
                      >
                        💬
                      </a>
                    )}
                    <a
                      href={agendaHref}
                      className="c360-action-btn cal"
                      title={`Agendar horário para ${row.nome}`}
                      aria-label="Agendar"
                    >
                      📅
                    </a>
                    <button
                      type="button"
                      className="c360-action-btn view"
                      onClick={() => onOpen(row.ref)}
                      title="Ver ficha completa 360"
                      aria-label="Ficha"
                    >
                      👤
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Pagination({ page, pages, total, onPage }) {
  if (pages <= 1) return null
  return (
    <nav className="c360-pagination" aria-label="Paginação da carteira">
      <button type="button" className="c360-btn ghost" onClick={() => onPage(page - 1)} disabled={page <= 1}>
        ‹ Anterior
      </button>
      <span aria-live="polite">
        Página {page} de {pages} · {total} clientes
      </span>
      <button type="button" className="c360-btn ghost" onClick={() => onPage(page + 1)} disabled={page >= pages}>
        Próxima ›
      </button>
    </nav>
  )
}

function DuplicateQueue() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [state, setState] = useState({ loading: true, items: [], error: '', podeGerenciar: false })
  const [decision, setDecision] = useState(null)
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setState((current) => ({ ...current, loading: true, error: '' }))
    api
      .get(`${API}/duplicados`)
      .then((data) => setState({ loading: false, items: data.items || [], error: '', podeGerenciar: Boolean(data.podeGerenciar) }))
      .catch((error) => setState({ loading: false, items: [], error: error.message || 'Não foi possível carregar a fila.', podeGerenciar: false }))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function decide() {
    if (!decision || saving) return
    setSaving(true)
    try {
      await api.post(`${API}/${decision.tipo === 'vincular' ? 'vinculos' : 'separacoes'}`, {
        a: decision.item.a.ref,
        b: decision.item.b.ref,
        motivo,
      })
      toast(decision.tipo === 'vincular' ? 'Cadastros unificados na visão do cliente.' : 'Marcado como pessoas diferentes.', 'success')
      setDecision(null)
      setMotivo('')
      load()
    } catch (error) {
      toast(error.message || 'Não foi possível registrar a decisão.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const card = (item) => (
    <div className="c360-dup-card">
      <Badge tone={item.fonte === 'loja' ? 'info' : 'muted'}>{item.fonte === 'loja' ? 'Loja' : 'Barbearia'}</Badge>
      <button type="button" className="c360-link" onClick={() => navigate(profilePath(item.ref))}>
        {item.nome}
      </button>
      <small>{[item.telefone, item.email].filter(Boolean).join(' · ') || 'Sem contato'}</small>
    </div>
  )

  if (state.loading) return <p className="c360-results-meta" aria-live="polite">Procurando possíveis duplicados…</p>
  if (state.error) return <p className="c360-error" role="alert">{state.error}</p>

  return (
    <div className="c360-stack">
      <p className="c360-muted">
        Cadastros que podem ser da mesma pessoa. Vincular junta as fichas sem apagar nada; "pessoas diferentes" impede a
        união automática pelo contato. As decisões ficam registradas na auditoria.
      </p>
      {!state.items.length && (
        <div className="c360-empty-state">
          <strong>Nenhum possível duplicado</strong>
          <span>Os cadastros da barbearia e da loja estão consistentes.</span>
        </div>
      )}
      <ul className="c360-dups">
        {state.items.map((item) => (
          <li key={`${item.a.ref}-${item.b.ref}`}>
            <Badge tone={item.confianca === 'alta' ? 'danger' : item.confianca === 'media' ? 'warning' : 'muted'}>
              Confiança {item.confianca}
            </Badge>
            <p>{item.motivo}</p>
            <div className="c360-dup-pair">
              {card(item.a)}
              <span aria-hidden="true">↔</span>
              {card(item.b)}
            </div>
            {state.podeGerenciar && (
              <div className="c360-dup-actions">
                <button type="button" className="c360-btn primary" onClick={() => setDecision({ tipo: 'vincular', item })}>
                  É a mesma pessoa
                </button>
                <button type="button" className="c360-btn ghost" onClick={() => setDecision({ tipo: 'separar', item })}>
                  São pessoas diferentes
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <Dialog
        open={Boolean(decision)}
        labelId="c360-dup-title"
        title={decision?.tipo === 'vincular' ? 'Unificar cadastros' : 'Marcar como pessoas diferentes'}
        onClose={() => setDecision(null)}
        onSubmit={decide}
        actions={
          <>
            <button type="button" className="c360-btn ghost" onClick={() => setDecision(null)}>
              Cancelar
            </button>
            <button type="submit" className="c360-btn primary" disabled={saving}>
              {saving ? 'Salvando…' : 'Confirmar'}
            </button>
          </>
        }
      >
        <p>
          {decision?.item.a.nome} ({decision?.item.a.fonte}) e {decision?.item.b.nome} ({decision?.item.b.fonte}).
        </p>
        <label className="c360-field">
          Observação (opcional)
          <input
            className="c360-input"
            value={motivo}
            onChange={(event) => setMotivo(event.target.value)}
            maxLength={240}
            placeholder="Ex.: confirmado com o cliente no balcão"
          />
        </label>
      </Dialog>
    </div>
  )
}

export default function Portfolio() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const view = params.get('vista') === 'duplicados' ? 'duplicados' : 'carteira'
  const [query, setQuery] = useState(params.get('q') || '')
  const debounced = useDebounced(query)
  const [recarregando, setRecarregando] = useState(false)

  const filters = useMemo(() => Object.fromEntries(PARAM_KEYS.map((key) => [key, params.get(key) || ''])), [params])

  const setFilter = useCallback(
    (changes) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          for (const [key, value] of Object.entries(changes)) {
            if (value) next.set(key, value)
            else next.delete(key)
          }
          if (!('pagina' in changes)) next.delete('pagina')
          return next
        },
        { replace: true }
      )
    },
    [setParams]
  )

  useEffect(() => {
    if ((params.get('q') || '') !== debounced) {
      setFilter({ q: debounced })
    }
  }, [debounced, params, setFilter])

  const queryString = PARAM_KEYS.filter((key) => filters[key])
    .map((key) => `${key}=${encodeURIComponent(filters[key])}`)
    .join('&')

  const cacheKey = queryString || 'default'

  // Inicialização inteligente com dados em cache para render instantâneo (0ms)
  const [state, setState] = useState(() => {
    const cached = clientPortfolioCache.get(cacheKey)
    return {
      loading: !cached,
      data: cached || null,
      error: '',
    }
  })

  // Carregamento de dados com revalidação em segundo plano (SWR)
  useEffect(() => {
    if (view !== 'carteira') return undefined
    let active = true

    const cachedData = clientPortfolioCache.get(cacheKey)
    if (cachedData) {
      setState({ loading: false, data: cachedData, error: '' })
    } else {
      setState((current) => ({ ...current, loading: true, error: '' }))
    }

    api
      .get(`${API}/carteira?tamanho=25${queryString ? `&${queryString}` : ''}`)
      .then((data) => {
        if (!active) return
        clientPortfolioCache.set(cacheKey, data)
        setState({ loading: false, data, error: '' })
      })
      .catch((error) => {
        if (!active) return
        setState((current) => ({
          ...current,
          loading: false,
          error: current.data ? '' : error.message || 'Não foi possível carregar a carteira.',
        }))
      })

    return () => {
      active = false
    }
  }, [queryString, view, cacheKey])

  // Recarga manual forçada em tempo real
  function recarregar() {
    setRecarregando(true)
    clientPortfolioCache.clear()
    api
      .get(`${API}/carteira?tamanho=25&refresh=1${queryString ? `&${queryString}` : ''}`)
      .then((data) => {
        clientPortfolioCache.set(cacheKey, data)
        setState({ loading: false, data, error: '' })
        toast('Carteira de clientes atualizada em tempo real.', 'info')
      })
      .catch((err) => {
        toast(err.message || 'Erro ao atualizar carteira.', 'error')
      })
      .finally(() => {
        setRecarregando(false)
      })
  }

  // Exportação rápida de clientes filtrados em formato CSV compatível com Excel (UTF-8 BOM)
  function exportarCsv() {
    if (!state.data?.items?.length) {
      toast('Nenhum cliente disponível para exportar no filtro atual.', 'warning')
      return
    }
    const headers = [
      'Nome',
      'Telefone',
      'Email',
      'Origem',
      'Segmento',
      'Valor Vitalicio (R$)',
      'Visitas',
      'Pedidos',
      'Dias Sem Atividade',
      'A Receber (R$)',
      'Etiquetas',
    ]
    const rowsCsv = state.data.items.map((row) => {
      const seg = SEGMENTS[row.metricas.segmento]?.label || row.metricas.segmento || ''
      return [
        `"${(row.nome || '').replace(/"/g, '""')}"`,
        `"${row.telefone || ''}"`,
        `"${row.email || ''}"`,
        `"${row.fontes.join(', ')}"`,
        `"${seg}"`,
        (row.metricas.valorVitalicio || 0).toFixed(2),
        row.metricas.visitas || 0,
        row.metricas.pedidos || 0,
        row.metricas.diasSemAtividade ?? '',
        (row.metricas.aReceber || 0).toFixed(2),
        `"${(row.etiquetas || []).join(', ')}"`,
      ].join(';')
    })
    const csvContent = '\uFEFF' + [headers.join(';'), ...rowsCsv].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `carteira-clientes-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast('Carteira exportada em CSV com sucesso.', 'success')
  }

  const data = state.data
  const storeDown = data?.fontes?.loja && !data.fontes.loja.disponivel
  const anyFilter = ['q', 'segmento', 'fonte', 'saldo', 'carrinho', 'etiqueta'].some((key) => filters[key])

  return (
    <section className="c360" aria-labelledby="c360-portfolio-title">
      <header className="c360-page-head">
        <div>
          <span className="c360-eyebrow">Customer 360</span>
          <h1 id="c360-portfolio-title">Carteira de clientes</h1>
          <p>
            Barbearia e loja online numa visão unificada, com valor vitalício, frequência e risco de cada cliente. Contatos
            mascarados por padrão (LGPD).
          </p>
        </div>
      </header>

      <div className="c360-tabs" role="tablist" aria-label="Visões da carteira">
        {[
          ['carteira', 'Carteira'],
          ['duplicados', 'Possíveis duplicados'],
          ['recuperacao', '⚡ Recuperação e Histórico Avec'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={view === key}
            className={view === key ? 'active' : ''}
            onClick={() => setParams(key === 'carteira' ? {} : { vista: key }, { replace: true })}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'recuperacao' ? (
        <DinoRecuperacaoAvecPanel onAbrirAgenda={() => navigate('/admin/barbearia?tab=Agenda')} />
      ) : view === 'duplicados' ? (
        <DuplicateQueue />
      ) : (
        <>
          {/* CARDS DE RESUMO KPI (COM SKELETON INTEGRADO) */}
          {state.loading && !data ? (
            <SummaryCardsSkeleton />
          ) : (
            <SummaryCards
              resumo={data?.resumo}
              active={filters.segmento}
              onSegment={(segmento) => setFilter({ segmento })}
            />
          )}

          {/* BARRA DE FILTROS, BUSCA E AÇÕES GLOBAIS */}
          <div className="c360-filters">
            <div className="c360-search" role="search">
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nome, telefone ou e-mail..."
                aria-label="Buscar cliente por nome, telefone ou e-mail"
                autoComplete="off"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} aria-label="Limpar busca">
                  ×
                </button>
              )}
            </div>

            <label className="c360-select">
              <span className="sr-only">Origem</span>
              <select
                value={filters.fonte}
                onChange={(event) => setFilter({ fonte: event.target.value })}
                aria-label="Origem do cliente"
              >
                {SOURCES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="c360-select">
              <span className="sr-only">Ordenar</span>
              <select
                value={filters.ordem || 'valor'}
                onChange={(event) => setFilter({ ordem: event.target.value === 'valor' ? '' : event.target.value })}
                aria-label="Ordenar por"
              >
                {SORTS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            {/* BOTÕES DE PERFORMANCE E EXPORTAÇÃO */}
            <div className="c360-toolbar-actions">
              <button
                type="button"
                className="c360-btn ghost c360-btn-sm"
                onClick={recarregar}
                disabled={recarregando || state.loading}
                title="Recarregar dados atualizados do servidor"
              >
                <span className={recarregando ? 'c360-spin' : ''}>🔄</span> Atualizar
              </button>
              <button
                type="button"
                className="c360-btn ghost c360-btn-sm"
                onClick={exportarCsv}
                disabled={!data?.items?.length}
                title="Exportar planilha CSV da lista atual para o Excel"
              >
                📥 Exportar CSV
              </button>
            </div>
          </div>

          {/* CHIPS DE SEGMENTOS E SITUAÇÃO */}
          <div className="c360-chips" role="group" aria-label="Filtrar por segmento e situação">
            <button
              type="button"
              aria-pressed={!filters.segmento}
              className={!filters.segmento ? 'active' : ''}
              onClick={() => setFilter({ segmento: '' })}
            >
              Todos
            </button>
            {SEGMENT_ORDER.map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={filters.segmento === key}
                className={filters.segmento === key ? 'active' : ''}
                onClick={() => setFilter({ segmento: filters.segmento === key ? '' : key })}
              >
                {SEGMENTS[key].label}
                {data?.resumo ? <span>{data.resumo.porSegmento[key]}</span> : null}
              </button>
            ))}
            <span className="c360-chip-sep" aria-hidden="true" />
            <button
              type="button"
              aria-pressed={Boolean(filters.saldo)}
              className={filters.saldo ? 'active' : ''}
              onClick={() => setFilter({ saldo: filters.saldo ? '' : '1' })}
            >
              Com saldo a receber
            </button>
            <button
              type="button"
              aria-pressed={Boolean(filters.carrinho)}
              className={filters.carrinho ? 'active' : ''}
              onClick={() => setFilter({ carrinho: filters.carrinho ? '' : '1' })}
            >
              Carrinho aberto
            </button>
            {(data?.etiquetas || []).slice(0, 8).map(({ tag, total }) => (
              <button
                key={tag}
                type="button"
                aria-pressed={filters.etiqueta === tag}
                className={filters.etiqueta === tag ? 'active' : ''}
                onClick={() => setFilter({ etiqueta: filters.etiqueta === tag ? '' : tag })}
              >
                #{tag}
                <span>{total}</span>
              </button>
            ))}
          </div>

          {storeDown && (
            <p className="c360-note" role="status">
              Clientes da loja online indisponíveis: {REASONS[data.fontes.loja.motivo] || data.fontes.loja.motivo}. A
              carteira mostra só a barbearia.
            </p>
          )}
          {data?.fontes?.metricasIndisponiveis?.length > 0 && (
            <p className="c360-note" role="status">
              Parte das métricas da loja não respondeu; valores podem estar incompletos.
            </p>
          )}

          {state.error && (
            <p className="c360-error" role="alert">
              {state.error}
            </p>
          )}

          <p className="c360-results-meta" aria-live="polite">
            {state.loading && !data
              ? 'Carregando carteira de clientes…'
              : data
              ? `${data.total} cliente${data.total === 1 ? '' : 's'}${anyFilter ? ' no filtro' : ''}`
              : ''}
          </p>

          {/* TABELA DE CLIENTES OU SKELETON DE ALTA PERFORMANCE */}
          {state.loading && !data ? (
            <PortfolioTableSkeleton />
          ) : data?.items?.length > 0 ? (
            <PortfolioTable rows={data.items} onOpen={(ref) => navigate(profilePath(ref))} />
          ) : !state.loading && data && !data.items.length ? (
            <div className="c360-empty-state">
              <strong>Nenhum cliente neste filtro</strong>
              <span>Ajuste o termo de busca ou selecione outro segmento.</span>
              {anyFilter && (
                <button
                  type="button"
                  className="c360-btn ghost"
                  onClick={() => {
                    setQuery('')
                    setParams({}, { replace: true })
                  }}
                >
                  Limpar filtros
                </button>
              )}
            </div>
          ) : !state.loading && !data && !state.error ? (
            <EmptyLine>Sem dados disponíveis.</EmptyLine>
          ) : null}

          {data && (
            <Pagination
              page={data.pagina}
              pages={data.paginas}
              total={data.total}
              onPage={(pagina) => setFilter({ pagina: String(pagina) })}
            />
          )}
        </>
      )}
    </section>
  )
}
