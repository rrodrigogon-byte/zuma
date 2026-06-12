import { useState, useEffect, useRef, useMemo } from 'react'
import { api } from '../lib/api'
import { useToast } from '../hooks/useToast'

const STATUS_ORDER = ['novo', 'em_preparo', 'pronto']

const STATUS_LABEL = {
  novo: 'NOVO',
  em_preparo: 'EM PREPARO',
  pronto: 'PRONTO ✓',
}

const STATUS_COLOR = {
  novo: '#e74c3c',
  em_preparo: '#C9A656',
  pronto: '#5FB335',
}

// Retorna minutos decorridos desde criadoEm
function minutosDecorridos(criadoEm) {
  if (!criadoEm) return 0
  return Math.floor((Date.now() - new Date(criadoEm).getTime()) / 60000)
}

// Cor de urgência baseada no tempo
function corUrgencia(mins, status) {
  if (status === 'pronto') return STATUS_COLOR.pronto
  if (status === 'novo') {
    if (mins >= 10) return '#ff0000' // crítico: vermelho intenso
    if (mins >= 5)  return '#ff4500' // urgente: laranja-vermelho
    return STATUS_COLOR.novo
  }
  if (status === 'em_preparo') {
    if (mins >= 20) return '#ff6b00' // crítico em preparo
    if (mins >= 12) return '#e6a817'
    return STATUS_COLOR.em_preparo
  }
  return '#aaa'
}

function Clock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
      {now.toLocaleTimeString('pt-BR')}
    </span>
  )
}

// Componente de timer que atualiza a cada segundo
function ElapsedTimer({ criadoEm, status }) {
  const [mins, setMins] = useState(minutosDecorridos(criadoEm))
  useEffect(() => {
    const t = setInterval(() => setMins(minutosDecorridos(criadoEm)), 10000)
    return () => clearInterval(t)
  }, [criadoEm])
  if (!criadoEm || status === 'pronto') return null
  const urgent = mins >= 10 && status === 'novo'
  const warn = mins >= 5 && status === 'novo'
  const urgPreparo = mins >= 20 && status === 'em_preparo'
  return (
    <span style={{
      fontSize: 13, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
      background: (urgent || urgPreparo) ? '#ff000033' : warn ? '#ff450022' : '#1e3a24',
      color: (urgent || urgPreparo) ? '#ff5555' : warn ? '#ff8c42' : '#888',
      animation: (urgent || urgPreparo) ? 'pulse 1s infinite' : 'none',
    }}>
      ⏱ {mins}min
    </span>
  )
}

function ItemCard({ item, onStatusChange }) {
  const next = STATUS_ORDER[STATUS_ORDER.indexOf(item.status) + 1]
  const mins = minutosDecorridos(item.criadoEm)
  const color = corUrgencia(mins, item.status)
  const isPulsing = item.status === 'novo' || (item.status === 'em_preparo' && mins >= 15)
  const isUrgent = (item.status === 'novo' && mins >= 8) || (item.status === 'em_preparo' && mins >= 20)

  return (
    <div
      onClick={() => next && onStatusChange(item.comandaId, item.idx, next)}
      style={{
        background: isUrgent ? '#1a0a0a' : '#0f1f13',
        border: `2px solid ${color}`,
        borderRadius: 12,
        padding: '16px 20px',
        cursor: next ? 'pointer' : 'default',
        animation: isPulsing ? 'pulse 1.4s infinite' : 'none',
        userSelect: 'none',
        transition: 'border-color 0.5s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#f0f0f0', lineHeight: 1.1 }}>
            <span style={{ fontSize: 40, color: '#C9A656', marginRight: 10 }}>×{item.qtd}</span>
            {item.nome}
          </div>
          {item.obs && (
            <div style={{ marginTop: 6, fontSize: 18, color: '#f1c40f', fontWeight: 600 }}>
              ⚠ {item.obs}
            </div>
          )}
          <div style={{ marginTop: 8, fontSize: 14, color: '#888', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>#{item.comandaId}</span>
            <ElapsedTimer criadoEm={item.criadoEm} status={item.status} />
            {isUrgent && <span style={{ color: '#ff5555', fontWeight: 700, fontSize: 13 }}>🔥 URGENTE</span>}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
          <div style={{
            background: color,
            color: item.status === 'pronto' ? '#000' : '#fff',
            borderRadius: 8,
            padding: '6px 14px',
            fontWeight: 800,
            fontSize: 15,
            whiteSpace: 'nowrap',
          }}>
            {STATUS_LABEL[item.status] || item.status}
          </div>
          {next && (
            <div style={{ fontSize: 11, color: '#555', textAlign: 'center' }}>
              toque para avançar →
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CommandaGroup({ comanda, items, onStatusChange }) {
  const title = comanda.tipo === 'virtual'
    ? `${comanda.mesa} · ${comanda.local || ''}`
    : `Mesa ${comanda.mesa}`

  const allPronto = items.every(i => i.status === 'pronto')

  return (
    <div style={{
      background: '#0a1a0d',
      border: `1px solid ${allPronto ? '#5FB335' : '#1e3a24'}`,
      borderRadius: 16,
      padding: 20,
      marginBottom: 20,
    }}>
      <div style={{
        fontSize: 22,
        fontWeight: 700,
        color: '#C9A656',
        marginBottom: 14,
        borderBottom: '1px solid #1e3a24',
        paddingBottom: 10,
      }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map(item => (
          <ItemCard key={`${item.comandaId}-${item.idx}`} item={item} onStatusChange={onStatusChange} />
        ))}
      </div>
    </div>
  )
}

function Panel({ title, items, onStatusChange, hidePronto }) {
  const visible = hidePronto ? items.filter(i => i.status !== 'pronto') : items
  const pending = visible.filter(i => i.status !== 'pronto').length

  // Group by comandaId
  const grouped = {}
  visible.forEach(item => {
    if (!grouped[item.comandaId]) {
      grouped[item.comandaId] = { meta: item, items: [] }
    }
    grouped[item.comandaId].items.push(item)
  })

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{
        background: '#0f1f13',
        borderRadius: 12,
        padding: '14px 20px',
        marginBottom: 20,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: 26, fontWeight: 800, color: '#5FB335', letterSpacing: 2 }}>
          {title}
        </span>
        <span style={{
          background: pending > 0 ? '#e74c3c' : '#2d4a32',
          color: '#fff',
          borderRadius: 20,
          padding: '4px 16px',
          fontWeight: 800,
          fontSize: 22,
        }}>
          {pending} pendente{pending !== 1 ? 's' : ''}
        </span>
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {Object.keys(grouped).length === 0 ? (
          <div style={{ color: '#3a5a40', textAlign: 'center', marginTop: 60, fontSize: 20 }}>
            Nenhum pedido
          </div>
        ) : (
          Object.values(grouped).map(({ meta, items: gItems }) => (
            <CommandaGroup
              key={meta.comandaId}
              comanda={meta}
              items={gItems}
              onStatusChange={onStatusChange}
            />
          ))
        )}
      </div>
    </div>
  )
}

export default function KDS() {
  const [items, setItems] = useState([])
  const [hidePronto, setHidePronto]     = useState(false)
  const [loading, setLoading]           = useState(true)
  const [filtroSetor, setFiltroSetor]   = useState('todos') // 'todos'|'bar'|'cozinha'
  const [somAtivo, setSomAtivo]         = useState(false)
  const prevPendentesRef = useRef(0)
  const { toast } = useToast()
  const intervalRef = useRef(null)

  async function load() {
    try {
      const data = await api.get('/api/kds')
      setItems(Array.isArray(data) ? data : [])
    } catch {
      // silently retry
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    intervalRef.current = setInterval(load, 8000)
    return () => clearInterval(intervalRef.current)
  }, [])

  async function handleStatusChange(comandaId, idx, newStatus) {
    try {
      await api.post('/api/admin/kds/status', { comandaId, idx, status: newStatus })
      setItems(prev =>
        prev.map(i =>
          i.comandaId === comandaId && i.idx === idx ? { ...i, status: newStatus } : i
        )
      )
    } catch {
      toast('Erro ao atualizar status', 'error')
    }
  }

  function limparProntos() {
    setItems(prev => prev.filter(i => i.status !== 'pronto'))
  }

  async function marcarTodosProntos() {
    const pendentes = items.filter(i => i.status !== 'pronto' &&
      (filtroSetor === 'todos' || (filtroSetor === 'bar' && !i.cozinha) || (filtroSetor === 'cozinha' && i.cozinha)))
    if (!pendentes.length) return
    if (!confirm(`Marcar ${pendentes.length} itens como PRONTOS?`)) return
    for (const item of pendentes) {
      try { await api.post('/api/admin/kds/status', { comandaId:item.comandaId, idx:item.idx, status:'pronto' }) } catch {}
    }
    setItems(prev => prev.map(i => {
      const match = pendentes.find(p => p.comandaId===i.comandaId && p.idx===i.idx)
      return match ? { ...i, status:'pronto' } : i
    }))
    toast(`✅ ${pendentes.length} itens marcados como prontos`)
  }

  // Som melhorado — 3 beeps em sequência
  function tocarSom() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const beep = (delay, freq) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.frequency.value = freq; gain.gain.value = 0.12
        osc.start(ctx.currentTime + delay)
        osc.stop(ctx.currentTime + delay + 0.15)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.15)
      }
      beep(0, 880); beep(0.2, 1100); beep(0.4, 880)
    } catch {}
  }

  const barItems     = useMemo(() => items.filter(i => !i.cozinha), [items])
  const cozinhaItems = useMemo(() => items.filter(i => i.cozinha), [items])
  const totalPendentes   = useMemo(() => items.filter(i => i.status !== 'pronto').length, [items])
  const barPendentes     = useMemo(() => barItems.filter(i => i.status !== 'pronto').length, [barItems])
  const cozinhaPendentes = useMemo(() => cozinhaItems.filter(i => i.status !== 'pronto').length, [cozinhaItems])

  // Alerta sonoro melhorado — 3 beeps quando novos pedidos chegam
  useEffect(() => {
    if (somAtivo && totalPendentes > prevPendentesRef.current) {
      tocarSom()
    }
    prevPendentesRef.current = totalPendentes
  }, [totalPendentes, somAtivo])

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        * { box-sizing: border-box; }
        body { margin: 0; }
      `}</style>
      <div style={{
        minHeight: '100vh',
        background: '#060e08',
        color: '#f0f0f0',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        display: 'flex',
        flexDirection: 'column',
        padding: '0 0 20px',
      }}>
        {/* Header */}
        <div style={{
          background: '#0a1a0d',
          borderBottom: '2px solid #1e3a24',
          padding: '12px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: '#5FB335', letterSpacing: 1 }}>
              KDS — Cozinha & Bar
            </span>
            <span style={{
              background: totalPendentes > 0 ? '#e74c3c' : '#2d4a32',
              color: '#fff',
              borderRadius: 20,
              padding: '4px 16px',
              fontWeight: 700,
              fontSize: 18,
            }}>
              {totalPendentes} pendente{totalPendentes !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap:'wrap' }}>
            {/* Filtro setor */}
            {['todos','bar','cozinha'].map(s => (
              <button key={s} onClick={() => setFiltroSetor(s)} style={{
                background: filtroSetor === s ? (s==='bar' ? '#3498db' : s==='cozinha' ? '#e05c5c' : '#5FB335') : '#1e3a24',
                color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px',
                fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}>
                {s === 'todos' ? '🍽 Tudo' : s === 'bar' ? '🍺 Bar' : '🔥 Cozinha'}
                {s !== 'todos' && (
                  <span style={{ marginLeft:5, background:'rgba(0,0,0,.3)', borderRadius:8, padding:'1px 6px', fontSize:11 }}>
                    {s === 'bar' ? barPendentes : cozinhaPendentes}
                  </span>
                )}
              </button>
            ))}
            <div style={{ width:1, height:28, background:'#1e3a24', margin:'0 4px' }} />
            <button onClick={marcarTodosProntos} title="Marcar todos os visíveis como prontos"
              style={{ background:'#1e3a24', color:'#5FB335', border:'1px solid #5FB335', borderRadius:8, padding:'7px 14px', fontWeight:700, fontSize:13, cursor:'pointer' }}>
              ✅ Todos prontos
            </button>
            <button onClick={() => setHidePronto(h => !h)}
              style={{ background: hidePronto ? '#5FB335' : '#1e3a24', color:'#fff', border:'none', borderRadius:8, padding:'7px 14px', fontWeight:700, fontSize:13, cursor:'pointer' }}>
              {hidePronto ? '👁 Mostrar' : '🙈 Ocultar'} prontos
            </button>
            <button onClick={limparProntos}
              style={{ background:'#1e3a24', color:'#C9A656', border:'1px solid #C9A656', borderRadius:8, padding:'7px 14px', fontWeight:700, fontSize:13, cursor:'pointer' }}>
              🗑 Limpar
            </button>
            <button onClick={() => setSomAtivo(s=>!s)}
              style={{ background: somAtivo ? '#1e3a24' : 'transparent', color: somAtivo ? '#5FB335' : '#555',
                border:`1px solid ${somAtivo ? '#5FB335' : '#333'}`, borderRadius:8, padding:'7px 14px', fontWeight:700, fontSize:13, cursor:'pointer' }}>
              {somAtivo ? '🔔 Som' : '🔇 Mudo'}
            </button>
            <span style={{ fontSize: 24, fontWeight: 700, color: '#C9A656', minWidth: 80, textAlign: 'right' }}>
              <Clock />
            </span>
          </div>
        </div>

        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#3a5a40' }}>
            Carregando pedidos…
          </div>
        ) : (
          <div style={{
            flex: 1,
            display: 'flex',
            gap: 24,
            padding: '20px 24px 0',
            overflow: 'hidden',
          }}>
            {(filtroSetor === 'todos' || filtroSetor === 'bar') && (
              <Panel
                title={`🍺 BAR${barPendentes > 0 ? ` (${barPendentes})` : ''}`}
                items={barItems}
                onStatusChange={handleStatusChange}
                hidePronto={hidePronto}
              />
            )}
            {filtroSetor === 'todos' && <div style={{ width: 2, background: '#1e3a24', flexShrink: 0 }} />}
            {(filtroSetor === 'todos' || filtroSetor === 'cozinha') && (
              <Panel
                title={`🍽 COZINHA${cozinhaPendentes > 0 ? ` (${cozinhaPendentes})` : ''}`}
                items={cozinhaItems}
                onStatusChange={handleStatusChange}
                hidePronto={hidePronto}
              />
            )}
          </div>
        )}
      </div>
    </>
  )
}
