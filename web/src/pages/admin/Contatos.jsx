import { useState, useEffect } from 'react'
import { api, fmtDate } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

export default function Contatos() {
  const [itens, setItens] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todos') // todos | naolidas
  const [busy, setBusy] = useState(null)
  const { toast } = useToast()

  const load = async () => {
    setLoading(true)
    try {
      setItens(await api.get('/api/admin/contatos'))
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

  const visiveis = filtro === 'naolidas' ? itens.filter(c => !c.lida) : itens
  const naoLidas = itens.filter(c => !c.lida).length

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: 0 }}>
          Contatos {naoLidas > 0 && <span className="badge badge-yellow" style={{ marginLeft: 8 }}>{naoLidas} não lida(s)</span>}
        </h1>
        <div style={{ display: 'flex', gap: 4 }}>
          {[['todos', 'Todas'], ['naolidas', 'Não lidas']].map(([v, l]) => (
            <button key={v} onClick={() => setFiltro(v)} style={{
              padding: '5px 12px', fontSize: 12, borderRadius: 6, border: '1px solid',
              borderColor: filtro === v ? 'var(--green)' : '#1e4a2e',
              background: filtro === v ? '#5FB33522' : 'transparent',
              color: filtro === v ? '#5FB335' : 'var(--muted)', cursor: 'pointer',
            }}>{l}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--muted)', padding: 16 }}>Carregando…</p>
      ) : visiveis.length === 0 ? (
        <p style={{ color: 'var(--muted)', padding: 16 }}>Nenhuma mensagem.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {visiveis.map(c => (
            <div key={c.id} className="card" style={{ opacity: c.lida ? 0.7 : 1, borderLeft: c.lida ? '3px solid transparent' : '3px solid var(--green)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: '#fff' }}>{c.nome}</div>
                  <a href={`mailto:${c.email}`} style={{ fontSize: 13, color: 'var(--green)' }}>{c.email}</a>
                  <p style={{ marginTop: 8, color: '#cfe', whiteSpace: 'pre-wrap', fontSize: 14 }}>{c.mensagem}</p>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>{c.criadoEm ? fmtDate(c.criadoEm) : ''}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 110 }}>
                  {!c.lida ? (
                    <button className="btn btn-secondary btn-sm" disabled={busy === c.id} onClick={() => marcar(c, true)}>Marcar lida</button>
                  ) : (
                    <button className="btn btn-secondary btn-sm" disabled={busy === c.id} onClick={() => marcar(c, false)}>Marcar não lida</button>
                  )}
                  <a className="btn btn-primary btn-sm" href={`mailto:${c.email}`} style={{ textAlign: 'center', textDecoration: 'none' }}>Responder</a>
                  <button className="btn btn-danger btn-sm" disabled={busy === c.id} onClick={() => excluir(c)}>Excluir</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
