import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'

const COR = {
  inscricao: '#27ae60', pagamento: '#e05c5c',
  reserva: '#C9A656', contato: '#8FD64A', estoque: '#C9A656',
}

function tempoRelativo(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export default function NotifBell() {
  const { isStaff } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [notifs, setNotifs] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const ref = useRef(null)

  const carregar = useCallback(async () => {
    if (!isStaff) return
    try {
      const d = await api.get('/api/admin/notificacoes')
      setNotifs(d.notificacoes || [])
      setTotal(d.total || 0)
    } catch {}
  }, [isStaff])

  // Poll a cada 30s
  useEffect(() => {
    if (!isStaff) return
    carregar()
    const t = setInterval(carregar, 30000)
    return () => clearInterval(t)
  }, [carregar, isStaff])

  // Fechar ao clicar fora
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!isStaff) return null

  const handleOpen = () => {
    setOpen(o => !o)
    if (!open) carregar()
  }

  const irPara = (link) => { setOpen(false); navigate(link) }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Bell Button */}
      <button onClick={handleOpen} style={{
        position: 'relative', width: 38, height: 38, borderRadius: '50%',
        border: open ? '1px solid var(--green)' : '1px solid var(--line)',
        background: open ? 'rgba(95,179,53,.12)' : 'var(--surface)',
        cursor: 'pointer', fontSize: 17, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        transition: 'all .15s', color: open ? 'var(--green)' : 'var(--muted)',
      }}>
        🔔
        {total > 0 && (
          <span style={{
            position: 'absolute', top: -3, right: -3,
            background: '#e05c5c', color: '#fff',
            borderRadius: '50%', fontSize: 9, fontWeight: 900,
            width: 17, height: 17, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--bg)',
          }}>
            {total > 9 ? '9+' : total}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 46, right: 0,
          width: 320, maxHeight: 440, overflowY: 'auto',
          background: 'var(--surface)', border: '1px solid var(--line)',
          borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,.4)',
          zIndex: 200,
        }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--cream)' }}>
              🔔 Notificações
              {total > 0 && <span style={{ marginLeft: 6, background: '#e05c5c', color: '#fff',
                borderRadius: 10, fontSize: 10, padding: '1px 6px', fontWeight: 800 }}>{total}</span>}
            </span>
            <button onClick={() => { api.post('/api/admin/notificacoes/ler').then(carregar).catch(() => {}); setOpen(false) }}
              style={{ border: 'none', background: 'none', color: 'var(--muted)',
                cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
              Limpar
            </button>
          </div>

          {notifs.length === 0 ? (
            <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--muted)' }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>✅</div>
              <div style={{ fontSize: 13 }}>Tudo em dia!</div>
            </div>
          ) : notifs.map((n, i) => (
            <div key={i} onClick={() => irPara(n.link)} style={{
              padding: '12px 16px', borderBottom: '1px solid var(--line)',
              cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'flex-start',
              transition: 'background .12s',
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(95,179,53,.06)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                background: `${COR[n.tipo] || '#5FB335'}20`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                {n.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--cream)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {n.titulo}
                </div>
                {n.detalhe && (
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {n.detalhe}
                  </div>
                )}
              </div>
              <span style={{ fontSize: 10, color: 'var(--muted)', flexShrink: 0, marginTop: 2 }}>
                {tempoRelativo(n.data)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
