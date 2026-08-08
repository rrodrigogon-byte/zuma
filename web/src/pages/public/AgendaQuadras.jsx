import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import { useAuth } from '../../lib/auth'

const HORAS = Array.from({ length: 31 }, (_, i) => {
  const h = Math.floor(i / 2) + 7
  const m = i % 2 === 0 ? '00' : '30'
  return `${String(h).padStart(2, '0')}:${m}`
}).filter(h => h <= '21:30')

const fmtData = s => s ? new Date(s + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) : '—'

const S = {
  page:  { padding: '24px 20px', maxWidth: 900, margin: '0 auto' },
  title: { fontSize: 26, fontWeight: 900, color: 'var(--cream)', marginBottom: 4 },
  sub:   { fontSize: 14, color: 'var(--muted)', marginBottom: 28 },
  btn:   { padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13 },
  inp:   { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--cream)', fontSize: 14 },
  lbl:   { fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5, fontWeight: 600 },
  card:  { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: 20, marginBottom: 16 },
}

export default function AgendaQuadras() {
  const { toast } = useToast()
  const { user } = useAuth()
  const [quadras, setQuadras] = useState([])
  const [reservas, setReservas] = useState([])
  const [data, setData] = useState(new Date().toISOString().slice(0, 10))
  const [quadraSel, setQuadraSel] = useState(null)
  const [slot, setSlot] = useState({ horaInicio: '', horaFim: '' })
  const [obs, setObs] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmando, setConfirmando] = useState(false)

  useEffect(() => {
    api.get('/api/quadras').then(setQuadras)
  }, [])

  useEffect(() => {
    if (!data) return
    api.get(`/api/reservas?data=${data}`).then(setReservas)
  }, [data])

  function ocupado(qId, hIni, hFim) {
    return reservas.some(r => r.quadraId == qId && r.status !== 'cancelada' && r.horaInicio < hFim && r.horaFim > hIni)
  }

  function selecionarSlot(q, hIni) {
    const idx = HORAS.indexOf(hIni)
    const hFim = HORAS[idx + 2] || HORAS[idx + 1] || hIni
    setQuadraSel(q)
    setSlot({ horaInicio: hIni, horaFim: hFim })
  }

  async function confirmar() {
    if (!user) { toast('Faça login para reservar uma quadra', true); return }
    if (!quadraSel || !slot.horaInicio || !slot.horaFim) { toast('Selecione um horário', true); return }
    setConfirmando(true)
    try {
      await api.post('/api/reservas', { quadraId: quadraSel.id, data, horaInicio: slot.horaInicio, horaFim: slot.horaFim, obs })
      toast(`Reserva confirmada! ${quadraSel.nome} — ${slot.horaInicio} às ${slot.horaFim}`)
      setQuadraSel(null); setSlot({ horaInicio: '', horaFim: '' }); setObs('')
      const r = await api.get(`/api/reservas?data=${data}`)
      setReservas(r)
    } catch (e) { toast(e.message, true) }
    finally { setConfirmando(false) }
  }

  const dataBloqueada = data < new Date().toISOString().slice(0, 10)

  return (
    <div style={S.page}>
      <div style={S.title}>🎾 Reserve sua Quadra</div>
      <div style={S.sub}>Escolha o dia, a quadra e o horário disponível.</div>

      {/* Seletor de data */}
      <div style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={S.lbl}>Data</label>
          <input type="date" value={data} min={new Date().toISOString().slice(0, 10)}
            onChange={e => { setData(e.target.value); setQuadraSel(null); setSlot({ horaInicio: '', horaFim: '' }) }}
            style={S.inp} />
        </div>
        <div style={{ fontSize: 14, color: 'var(--cream)', fontWeight: 600, paddingTop: 20 }}>
          {fmtData(data)}
        </div>
      </div>

      {dataBloqueada && (
        <div style={{ background: '#fef3c7', color: '#92400e', padding: '12px 16px', borderRadius: 10, marginBottom: 16, fontSize: 13, fontWeight: 600 }}>
          Não é possível reservar datas passadas.
        </div>
      )}

      {quadras.length === 0 && (
        <div style={{ color: 'var(--muted)', padding: 32, textAlign: 'center' }}>
          Nenhuma quadra disponível no momento.
        </div>
      )}

      {/* Grade de disponibilidade */}
      {quadras.map(q => (
        <div key={q.id} style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: q.cor }} />
            <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--cream)' }}>{q.nome}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{q.tipo}</div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {HORAS.slice(0, -1).map(h => {
              const hFim = HORAS[HORAS.indexOf(h) + 1]
              const isOcupado = ocupado(q.id, h, hFim)
              const isSel = quadraSel?.id === q.id && slot.horaInicio === h
              return (
                <button key={h} disabled={isOcupado || dataBloqueada}
                  onClick={() => selecionarSlot(q, h)}
                  style={{
                    padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: isOcupado || dataBloqueada ? 'default' : 'pointer',
                    border: isSel ? '2px solid var(--green)' : '1px solid var(--line)',
                    background: isOcupado ? 'rgba(239,68,68,.12)' : isSel ? 'rgba(255,107,44,.2)' : 'var(--bg)',
                    color: isOcupado ? '#ef4444' : isSel ? 'var(--green)' : 'var(--cream)',
                    opacity: isOcupado ? 0.6 : 1,
                  }}>
                  {h}{isOcupado ? ' ✕' : ''}
                </button>
              )
            })}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8, display: 'flex', gap: 16 }}>
            <span>🟢 Livre</span><span style={{ color: '#ef4444' }}>🔴 Ocupado</span><span style={{ color: 'var(--green)' }}>🟩 Selecionado</span>
          </div>
        </div>
      ))}

      {/* Painel de confirmação */}
      {quadraSel && slot.horaInicio && (
        <div style={{ ...S.card, background: 'rgba(255,107,44,.08)', border: '1px solid rgba(255,107,44,.3)' }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--green)', marginBottom: 12 }}>Confirmar Reserva</div>
          <div style={{ fontSize: 14, color: 'var(--cream)', marginBottom: 4 }}>
            🎾 <b>{quadraSel.nome}</b> — {fmtData(data)}
          </div>
          <div style={{ fontSize: 14, color: 'var(--cream)', marginBottom: 14 }}>
            ⏰ <b>{slot.horaInicio}</b> às <b>{slot.horaFim}</b>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'flex-end' }}>
            <label>
              <span style={S.lbl}>Fim do horário</span>
              <select value={slot.horaFim} onChange={e => setSlot(s => ({ ...s, horaFim: e.target.value }))} style={S.inp}>
                {HORAS.filter(h => h > slot.horaInicio).map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </label>
            <div />
          </div>
          <label style={{ display: 'block', margin: '12px 0' }}>
            <span style={S.lbl}>Observações (opcional)</span>
            <input value={obs} onChange={e => setObs(e.target.value)} style={S.inp} placeholder="Treino, aula, amistoso…" />
          </label>
          {!user && (
            <div style={{ background: '#fef3c7', color: '#92400e', padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
              ⚠️ Você precisa estar logado para confirmar a reserva.
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => { setQuadraSel(null); setSlot({ horaInicio: '', horaFim: '' }) }}
              style={{ ...S.btn, background: 'none', border: '1px solid var(--line)', color: 'var(--muted)' }}>Cancelar</button>
            <button onClick={confirmar} disabled={confirmando || !user}
              style={{ ...S.btn, background: 'var(--green)', color: 'var(--deep)', opacity: !user || confirmando ? 0.6 : 1 }}>
              {confirmando ? 'Confirmando…' : '✓ Confirmar Reserva'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
