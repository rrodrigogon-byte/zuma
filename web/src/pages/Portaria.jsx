import { useState, useEffect, useRef } from 'react'
import { api, fmtDate } from '../lib/api'
import { useToast } from '../hooks/useToast'

function KpiCard({ label, value, color }) {
  return (
    <div style={{
      background: '#0f1f13',
      border: `2px solid ${color || '#1e3a24'}`,
      borderRadius: 14,
      padding: '20px 28px',
      textAlign: 'center',
      minWidth: 160,
      flex: 1,
    }}>
      <div style={{ fontSize: 48, fontWeight: 900, color: color || '#f0f0f0', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 16, color: '#aaa', marginTop: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
        {label}
      </div>
    </div>
  )
}

function IngressoModal({ ingresso, onValidar, onClose }) {
  if (!ingresso) return null
  const jaValidado = !!ingresso.validado

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#0a1a0d',
          border: `3px solid ${jaValidado ? '#e74c3c' : '#5FB335'}`,
          borderRadius: 20,
          padding: '40px 48px',
          minWidth: 420,
          maxWidth: 560,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 18, color: '#888', marginBottom: 8, letterSpacing: 2, textTransform: 'uppercase' }}>
          Ingresso
        </div>
        <div style={{ fontSize: 42, fontWeight: 900, color: '#f0f0f0', lineHeight: 1.1, marginBottom: 10 }}>
          {ingresso.nome}
        </div>
        <div style={{
          display: 'inline-block',
          background: '#1e3a24',
          color: '#C9A656',
          borderRadius: 8,
          padding: '6px 20px',
          fontWeight: 700,
          fontSize: 20,
          marginBottom: 24,
        }}>
          {ingresso.tipo}
        </div>

        {jaValidado ? (
          <div style={{
            background: '#3a0a0a',
            border: '2px solid #e74c3c',
            borderRadius: 12,
            padding: '20px 24px',
            marginBottom: 24,
          }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#e74c3c' }}>
              ⛔ JÁ VALIDADO
            </div>
            <div style={{ fontSize: 18, color: '#e74c3c', marginTop: 8 }}>
              Entrada registrada em {fmtDate(ingresso.validadoEm)}
            </div>
          </div>
        ) : (
          <button
            onClick={() => onValidar(ingresso.id)}
            style={{
              background: '#5FB335',
              color: '#000',
              border: 'none',
              borderRadius: 12,
              padding: '20px 40px',
              fontSize: 28,
              fontWeight: 900,
              cursor: 'pointer',
              letterSpacing: 1,
              display: 'block',
              width: '100%',
              marginBottom: 16,
              textTransform: 'uppercase',
            }}
          >
            ✔ VALIDAR ENTRADA
          </button>
        )}

        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            color: '#888',
            border: '1px solid #333',
            borderRadius: 8,
            padding: '10px 28px',
            fontSize: 16,
            cursor: 'pointer',
          }}
        >
          Fechar
        </button>
      </div>
    </div>
  )
}

export default function Portaria() {
  const [ingressos, setIngressos] = useState([])
  const [busca, setBusca] = useState('')
  const [encontrado, setEncontrado] = useState(null)
  const [ultimosValidados, setUltimosValidados] = useState([])
  const [loading, setLoading] = useState(true)
  const inputRef = useRef(null)
  const { toast } = useToast()

  async function load() {
    try {
      const data = await api('/api/admin/ingressos')
      setIngressos(data)
    } catch {
      toast('Erro ao carregar ingressos', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // focus the search input on mount
    setTimeout(() => inputRef.current?.focus(), 300)
  }, [])

  function handleBusca(e) {
    e.preventDefault()
    if (!busca.trim()) return
    const q = busca.trim().toLowerCase()
    const found = ingressos.find(
      i =>
        (i.qrCode && i.qrCode.toLowerCase() === q) ||
        i.nome.toLowerCase().includes(q) ||
        String(i.id) === q
    )
    if (found) {
      setEncontrado(found)
    } else {
      toast('Ingresso não encontrado', 'error')
    }
  }

  async function handleValidar(id) {
    try {
      await api(`/api/admin/ingressos/${id}/validar`, { method: 'POST' })
      const agora = new Date().toISOString()
      setIngressos(prev =>
        prev.map(i => i.id === id ? { ...i, validado: true, validadoEm: agora } : i)
      )
      const atualizado = { ...ingressos.find(i => i.id === id), validado: true, validadoEm: agora }
      setEncontrado(atualizado)
      setUltimosValidados(prev => [atualizado, ...prev].slice(0, 10))
      toast('Entrada validada!', 'success')
      setBusca('')
    } catch {
      toast('Erro ao validar ingresso', 'error')
    }
  }

  function fecharModal() {
    setEncontrado(null)
    setBusca('')
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const hoje = new Date().toDateString()
  const validadosHoje = ingressos.filter(
    i => i.validado && new Date(i.validadoEm).toDateString() === hoje
  ).length
  const total = ingressos.length
  const restantes = total - ingressos.filter(i => i.validado).length

  return (
    <>
      <IngressoModal ingresso={encontrado} onValidar={handleValidar} onClose={fecharModal} />
      <div style={{
        minHeight: '100vh',
        background: '#060e08',
        color: '#f0f0f0',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        display: 'flex',
        flexDirection: 'column',
        padding: 0,
      }}>
        {/* Header */}
        <div style={{
          background: '#0a1a0d',
          borderBottom: '2px solid #1e3a24',
          padding: '16px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#5FB335', letterSpacing: 2 }}>
              PORTARIA
            </div>
            <div style={{ fontSize: 14, color: '#888', marginTop: 2 }}>
              4ª Agro Open de Tênis
            </div>
          </div>
          <div style={{ fontSize: 14, color: '#888' }}>
            {loading ? 'Carregando…' : `${total} ingressos cadastrados`}
          </div>
        </div>

        <div style={{ flex: 1, padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* KPIs */}
          <div style={{ display: 'flex', gap: 16 }}>
            <KpiCard label="Total Vendidos" value={total} color="#C9A656" />
            <KpiCard label="Validados Hoje" value={validadosHoje} color="#5FB335" />
            <KpiCard label="Restantes" value={restantes} color={restantes > 0 ? '#5FB335' : '#888'} />
          </div>

          {/* Busca */}
          <form onSubmit={handleBusca}>
            <div style={{
              background: '#0f1f13',
              border: '2px solid #1e3a24',
              borderRadius: 14,
              padding: '20px 24px',
            }}>
              <label style={{ fontSize: 18, color: '#aaa', fontWeight: 600, display: 'block', marginBottom: 12 }}>
                Código QR / Nome do participante
              </label>
              <div style={{ display: 'flex', gap: 12 }}>
                <input
                  ref={inputRef}
                  type="text"
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  placeholder="Escaneie o QR ou digite o nome..."
                  autoComplete="off"
                  style={{
                    flex: 1,
                    background: '#060e08',
                    border: '2px solid #2d4a32',
                    borderRadius: 10,
                    padding: '18px 22px',
                    fontSize: 28,
                    color: '#f0f0f0',
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
                <button
                  type="submit"
                  style={{
                    background: '#5FB335',
                    color: '#000',
                    border: 'none',
                    borderRadius: 10,
                    padding: '0 36px',
                    fontSize: 22,
                    fontWeight: 900,
                    cursor: 'pointer',
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                  }}
                >
                  Buscar
                </button>
              </div>
            </div>
          </form>

          {/* Últimos validados */}
          <div style={{
            background: '#0f1f13',
            border: '1px solid #1e3a24',
            borderRadius: 14,
            padding: '20px 24px',
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#C9A656', marginBottom: 14, letterSpacing: 1 }}>
              Últimos validados
            </div>
            {ultimosValidados.length === 0 ? (
              <div style={{ color: '#3a5a40', fontSize: 18, textAlign: 'center', marginTop: 20 }}>
                Nenhuma entrada validada nesta sessão
              </div>
            ) : (
              <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ultimosValidados.map((ing, idx) => (
                  <div
                    key={`${ing.id}-${idx}`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: '#0a1a0d',
                      borderRadius: 10,
                      padding: '14px 18px',
                      borderLeft: '4px solid #5FB335',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#f0f0f0' }}>{ing.nome}</div>
                      <div style={{ fontSize: 15, color: '#888', marginTop: 2 }}>{ing.tipo}</div>
                    </div>
                    <div style={{ fontSize: 15, color: '#5FB335', fontWeight: 600 }}>
                      ✔ {fmtDate(ing.validadoEm)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
