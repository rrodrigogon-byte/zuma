import { useState, useEffect, useMemo } from 'react'
import { api, fmtDate } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

function exportCSV(itens) {
  const headers = ['ID', 'Nome', 'E-mail', 'Mensagem', 'Lida', 'Recebido em']
  const rows = itens.map(c => [
    c.id, c.nome || '', c.email || '',
    (c.mensagem || '').replace(/\n/g, ' '),
    c.lida ? 'Sim' : 'Não',
    c.criadoEm ? new Date(c.criadoEm).toLocaleString('pt-BR') : '',
  ])
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }))
  a.download = `contatos_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
}

function KpiCard({ label, value, color, sub }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--line)',
      borderRadius: 10, padding: '14px 18px', flex: 1, minWidth: 110,
    }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: color || 'var(--cream)' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

/** Modal de resposta com template de e-mail */
function ResponderModal({ contato, onClose }) {
  const assunto = `Re: Mensagem recebida pelo site`
  const corpo = `Olá ${contato.nome},\n\nObrigado pelo contato!\n\n---\nMensagem original:\n${contato.mensagem}`
  const mailto = `mailto:${contato.email}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--line)',
        borderRadius: 14, padding: 28, maxWidth: 520, width: '95%',
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 16px', color: 'var(--cream)', fontSize: 16 }}>
          📧 Responder — {contato.nome}
        </h3>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Para</label>
          <div style={{ color: 'var(--green)', fontSize: 14, marginTop: 4 }}>{contato.email}</div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Assunto</label>
          <div style={{ color: 'var(--cream)', fontSize: 14, marginTop: 4 }}>{assunto}</div>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Corpo (template)</label>
          <pre style={{
            marginTop: 6, padding: '10px 14px', background: 'var(--deep)',
            borderRadius: 8, fontSize: 13, color: 'var(--cream)',
            whiteSpace: 'pre-wrap', border: '1px solid var(--line)',
          }}>{corpo}</pre>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
          <a className="btn btn-primary btn-sm" href={mailto}
            style={{ textDecoration: 'none', textAlign: 'center' }}
            onClick={onClose}
          >
            Abrir no e-mail
          </a>
        </div>
      </div>
    </div>
  )
}

export default function Contatos() {
  const [itens, setItens]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [filtro, setFiltro]       = useState('todos')   // 'todos'|'naolidas'|'lidas'
  const [busca, setBusca]         = useState('')
  const [busy, setBusy]           = useState(null)
  const [respondendo, setRespondendo] = useState(null)  // contato selecionado
  const { toast } = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.get('/api/admin/contatos')
      setItens(Array.isArray(data) ? data : [])
    } catch (e) {
      toast('Erro ao carregar mensagens', true)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const marcar = async (c, lida) => {
    setBusy(c.id)
    try {
      await api.patch(`/api/admin/contatos/${c.id}`, { lida })
      setItens(prev => prev.map(x => x.id === c.id ? { ...x, lida } : x))
    } catch (e) {
      toast(e.message || 'Erro ao atualizar', true)
    } finally {
      setBusy(null)
    }
  }

  const excluir = async (c) => {
    if (!window.confirm('Excluir esta mensagem?')) return
    setBusy(c.id)
    try {
      await api.delete(`/api/admin/contatos/${c.id}`)
      setItens(prev => prev.filter(x => x.id !== c.id))
      toast('Mensagem excluída')
    } catch (e) {
      toast(e.message || 'Erro ao excluir', true)
    } finally {
      setBusy(null)
    }
  }

  const marcarTodasLidas = async () => {
    const pendentes = itens.filter(c => !c.lida)
    if (!pendentes.length) return
    try {
      await Promise.all(pendentes.map(c => api.patch(`/api/admin/contatos/${c.id}`, { lida: true })))
      setItens(prev => prev.map(c => ({ ...c, lida: true })))
      toast(`${pendentes.length} mensagem(ns) marcadas como lidas`)
    } catch {
      toast('Erro ao marcar todas', true)
    }
  }

  // KPIs
  const kpis = useMemo(() => ({
    total:    itens.length,
    naoLidas: itens.filter(c => !c.lida).length,
    lidas:    itens.filter(c => c.lida).length,
    hoje:     itens.filter(c => c.criadoEm?.slice(0, 10) === new Date().toISOString().slice(0, 10)).length,
  }), [itens])

  // Filtro + busca
  const visiveis = useMemo(() => {
    const q = busca.toLowerCase().trim()
    return itens.filter(c => {
      if (filtro === 'naolidas' && c.lida) return false
      if (filtro === 'lidas' && !c.lida) return false
      if (q && !`${c.nome} ${c.email} ${c.mensagem}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [itens, filtro, busca])

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: 0 }}>
          📬 Contatos
          {kpis.naoLidas > 0 && (
            <span className="badge badge-yellow" style={{ marginLeft: 10, fontSize: 13 }}>
              {kpis.naoLidas} não lida{kpis.naoLidas !== 1 ? 's' : ''}
            </span>
          )}
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {kpis.naoLidas > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={marcarTodasLidas}>✓ Marcar todas lidas</button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => exportCSV(visiveis)}>⬇ CSV</button>
          <button className="btn btn-ghost btn-sm" onClick={load}>↻</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <KpiCard label="Total" value={kpis.total} color="var(--cream)" />
        <KpiCard label="Não lidas" value={kpis.naoLidas} color={kpis.naoLidas > 0 ? '#e74c3c' : 'var(--green)'} />
        <KpiCard label="Lidas" value={kpis.lidas} color="var(--muted)" />
        <KpiCard label="Hoje" value={kpis.hoje} color="var(--gold)" />
      </div>

      {/* Filtros + busca */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
        <input
          className="input" placeholder="🔍 Buscar por nome, e-mail ou mensagem…"
          value={busca} onChange={e => setBusca(e.target.value)}
          style={{ maxWidth: 280 }}
        />
        {[['todos', 'Todas'], ['naolidas', 'Não lidas'], ['lidas', 'Lidas']].map(([v, l]) => (
          <button key={v} className={`btn btn-sm ${filtro === v ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFiltro(v)}>{l}
          </button>
        ))}
        {(busca || filtro !== 'todos') && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setBusca(''); setFiltro('todos') }}>✕ Limpar</button>
        )}
        <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 4 }}>
          {visiveis.length} de {itens.length}
        </span>
      </div>

      {/* Lista */}
      {loading ? (
        <p style={{ color: 'var(--muted)', padding: 16 }}>Carregando…</p>
      ) : visiveis.length === 0 ? (
        <p style={{ color: 'var(--muted)', padding: 16, textAlign: 'center' }}>
          {itens.length === 0 ? 'Nenhuma mensagem recebida ainda.' : 'Nenhum resultado para os filtros aplicados.'}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {visiveis.map(c => (
            <div
              key={c.id}
              className="card"
              style={{
                opacity: c.lida ? 0.75 : 1,
                borderLeft: c.lida ? '3px solid var(--line)' : '3px solid var(--green)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                {/* Conteúdo */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <strong style={{ color: '#fff', fontSize: 15 }}>{c.nome || '—'}</strong>
                    {!c.lida && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 7px',
                        background: 'rgba(231,76,60,.15)', color: '#e74c3c',
                        borderRadius: 999, border: '1px solid rgba(231,76,60,.3)',
                      }}>NOVA</span>
                    )}
                  </div>
                  <a
                    href={`mailto:${c.email}`}
                    style={{ fontSize: 13, color: 'var(--green)', textDecoration: 'none' }}
                  >
                    {c.email}
                  </a>
                  <p style={{
                    marginTop: 10, marginBottom: 6,
                    color: 'var(--cream)', whiteSpace: 'pre-wrap',
                    fontSize: 14, lineHeight: 1.55,
                    maxHeight: 120, overflow: 'hidden',
                  }}>
                    {c.mensagem}
                  </p>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                    {c.criadoEm ? fmtDate(c.criadoEm) : '—'}
                  </div>
                </div>

                {/* Ações */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, minWidth: 120 }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setRespondendo(c)}
                  >
                    📧 Responder
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={busy === c.id}
                    onClick={() => marcar(c, !c.lida)}
                  >
                    {c.lida ? 'Marcar não lida' : 'Marcar lida'}
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    disabled={busy === c.id}
                    onClick={() => excluir(c)}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal responder */}
      {respondendo && (
        <ResponderModal
          contato={respondendo}
          onClose={() => setRespondendo(null)}
        />
      )}
    </div>
  )
}
