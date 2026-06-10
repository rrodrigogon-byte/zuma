import { useState, useEffect, useRef } from 'react'
import { api, fmtDate } from '../lib/api'
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

function ItemCard({ item, onStatusChange }) {
  const next = STATUS_ORDER[STATUS_ORDER.indexOf(item.status) + 1]
  const color = STATUS_COLOR[item.status] || '#aaa'
  const isPulsing = item.status === 'novo'

  return (
    <div
      onClick={() => next && onStatusChange(item.comandaId, item.idx, next)}
      style={{
        background: '#0f1f13',
        border: `2px solid ${color}`,
        borderRadius: 12,
        padding: '16px 20px',
        cursor: next ? 'pointer' : 'default',
        animation: isPulsing ? 'pulse 1.4s infinite' : 'none',
        userSelect: 'none',
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
          <div style={{ marginTop: 8, fontSize: 14, color: '#888' }}>
            #{item.comandaId} · {fmtDate(item.criadoEm)}
          </div>
        </div>
        <div style={{
          background: color,
          color: '#000',
          borderRadius: 8,
          padding: '6px 14px',
          fontWeight: 800,
          fontSize: 15,
          whiteSpace: 'nowrap',
          alignSelf: 'center',
        }}>
          {STATUS_LABEL[item.status] || item.status}
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
  const [hidePronto, setHidePronto] = useState(false)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const intervalRef = useRef(null)

  async function load() {
    try {
      const data = await api('/api/kds')
      setItems(data)
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
      await api('/api/admin/kds/status', {
        method: 'POST',
        body: JSON.stringify({ comandaId, idx, status: newStatus }),
      })
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

  const barItems = items.filter(i => !i.cozinha)
  const cozinhaItems = items.filter(i => i.cozinha)
  const totalPendentes = items.filter(i => i.status !== 'pronto').length

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button
              onClick={() => setHidePronto(h => !h)}
              style={{
                background: hidePronto ? '#5FB335' : '#1e3a24',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '8px 18px',
                fontWeight: 700,
                fontSize: 15,
                cursor: 'pointer',
              }}
            >
              {hidePronto ? 'Mostrar prontos' : 'Ocultar prontos'}
            </button>
            <button
              onClick={limparProntos}
              style={{
                background: '#1e3a24',
                color: '#C9A656',
                border: '1px solid #C9A656',
                borderRadius: 8,
                padding: '8px 18px',
                fontWeight: 700,
                fontSize: 15,
                cursor: 'pointer',
              }}
            >
              Limpar prontos
            </button>
            <span style={{ fontSize: 28, fontWeight: 700, color: '#C9A656', minWidth: 90, textAlign: 'right' }}>
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
            <Panel
              title="🍺 BAR"
              items={barItems}
              onStatusChange={handleStatusChange}
              hidePronto={hidePronto}
            />
            <div style={{ width: 2, background: '#1e3a24', flexShrink: 0 }} />
            <Panel
              title="🍽 COZINHA"
              items={cozinhaItems}
              onStatusChange={handleStatusChange}
              hidePronto={hidePronto}
            />
          </div>
        )}
      </div>
    </>
  )
}
