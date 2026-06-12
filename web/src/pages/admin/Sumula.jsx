import { useState, useEffect, useRef } from 'react'
import { api, fmtDateOnly } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

const TODAY = new Date().toISOString().slice(0, 10)

const STATUS_OPTS = [
  { value: 'pendente',     label: 'Aguardando',   color: '#C9A656' },
  { value: 'em_andamento', label: 'Em andamento',  color: '#8FD64A' },
  { value: 'concluido',    label: 'Concluída',     color: '#5FB335' },
]

function statusInfo(s) {
  return STATUS_OPTS.find(o => o.value === s) || { label: s || 'Pendente', color: '#888' }
}

// ── Timer da partida ──────────────────────────────────────────────────────────
function PartidaTimer({ jogoSel }) {
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef(null)

  useEffect(() => {
    if (jogoSel?.status !== 'em_andamento') { setElapsed(0); return }
    // Tenta calcular a partir de criadoEm ou usa 0
    const base = jogoSel.iniciadoEm || jogoSel.criadoEm || null
    const offset = base ? Math.floor((Date.now() - new Date(base).getTime()) / 1000) : 0
    setElapsed(Math.max(0, offset))
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(timerRef.current)
  }, [jogoSel?.id, jogoSel?.status])

  if (!jogoSel || jogoSel.status !== 'em_andamento') return null

  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60
  const urgent = mins >= 120  // > 2h — alerta
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: urgent ? 'rgba(224,92,92,.15)' : 'rgba(143,214,74,.1)',
      border: `1px solid ${urgent ? '#e05c5c' : '#8FD64A'}`,
      borderRadius: 8, padding: '0.4rem 0.9rem',
    }}>
      <span style={{ fontSize: 16 }}>⏱</span>
      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 800, fontSize: '1rem', color: urgent ? '#e05c5c' : '#8FD64A' }}>
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </span>
      <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>em andamento</span>
    </div>
  )
}

// ── Set Score Component ───────────────────────────────────────────────────────
function SetScore({ label, sets, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      {sets.map((v, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--muted)', width: 44 }}>Set {i + 1}</span>
          <button
            style={btnCount}
            onClick={() => onChange(sets.map((s, j) => j === i ? Math.max(0, s - 1) : s))}
          >−</button>
          <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--fg)', minWidth: 36, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{v}</span>
          <button
            style={btnCount}
            onClick={() => onChange(sets.map((s, j) => j === i ? s + 1 : s))}
          >+</button>
        </div>
      ))}
    </div>
  )
}

const btnCount = {
  width: 40, height: 40, borderRadius: 8, border: '2px solid var(--line)',
  background: 'var(--surface)', color: 'var(--fg)', fontSize: '1.3rem', fontWeight: 700,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'background .1s',
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Sumula() {
  const { toast } = useToast()
  const [todos, setTodos] = useState([])         // todos os jogos carregados
  const [loading, setLoading] = useState(true)
  const [jogoSel, setJogoSel] = useState(null)
  const [saving, setSaving] = useState(false)

  // Filtros da lista
  const [dataSel, setDataSel] = useState(TODAY)
  const [verConcluidos, setVerConcluidos] = useState(false)

  // Placar por sets: [[sets J1], [sets J2]], games
  const [setsJ1, setSetsJ1] = useState([0, 0, 0])
  const [setsJ2, setSetsJ2] = useState([0, 0, 0])
  const [gamesJ1, setGamesJ1] = useState(0)
  const [gamesJ2, setGamesJ2] = useState(0)
  const [statusPartida, setStatusPartida] = useState('pendente')
  const [vencedor, setVencedor] = useState('')
  const [obs, setObs] = useState('')

  function loadJogos() {
    setLoading(true)
    api.get('/api/admin/agenda')
      .then(all => setTodos(all || []))
      .catch(() => toast('Erro ao carregar agenda', 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadJogos() }, [])

  // ── Filtra jogos conforme data e toggle concluídos ──
  const jogos = todos.filter(j => {
    if (j.data !== dataSel) return false
    if (!verConcluidos && (j.status === 'concluido' || j.vencedor)) return false
    return true
  })

  // Datas únicas disponíveis para o selector
  const datasDisponiveis = [...new Set(todos.map(j => j.data))].sort()

  function selecionarJogo(j) {
    setJogoSel(j)
    setSetsJ1([0, 0, 0])
    setSetsJ2([0, 0, 0])
    setGamesJ1(0)
    setGamesJ2(0)
    setStatusPartida(j.status || 'pendente')
    setVencedor(j.vencedor || '')
    setObs(j.obs || '')
  }

  function placarTexto() {
    return setsJ1.map((s, i) => `${s}-${setsJ2[i]}`).join(' ')
  }

  async function iniciarPartida() {
    if (!jogoSel) return
    setSaving(true)
    try {
      await api.patch(`/api/admin/agenda/${jogoSel.id}`, { status: 'em_andamento', iniciadoEm: new Date().toISOString() })
      setStatusPartida('em_andamento')
      setJogoSel(j => ({ ...j, status: 'em_andamento', iniciadoEm: new Date().toISOString() }))
      toast('Partida iniciada')
    } catch (e) { toast(e.message, 'error') } finally { setSaving(false) }
  }

  async function finalizarPartida() {
    if (!jogoSel) return
    if (!vencedor) { toast('Selecione o vencedor antes de finalizar', 'error'); return }
    if (!confirm(`Finalizar partida? Vencedor: ${vencedor}\nPlacar: ${placarTexto()}`)) return
    setSaving(true)
    try {
      await api.patch(`/api/admin/agenda/${jogoSel.id}`, {
        placar1: setsJ1.join('/'),
        placar2: setsJ2.join('/'),
        vencedor,
        status: 'concluido',
        obs,
      })
      toast('Partida finalizada com sucesso!')
      setJogoSel(null)
      loadJogos()
    } catch (e) { toast(e.message, 'error') } finally { setSaving(false) }
  }

  const [j1, j2] = jogoSel ? (jogoSel.confronto || '').split(' vs ') : ['', '']

  // ── Tela de seleção ───────────────────────────────────────────────────────
  if (!jogoSel) {
    return (
      <div style={{ padding: '1.5rem', maxWidth: 800, margin: '0 auto' }}>
        {/* Cabeçalho */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.25rem' }}>
          <span style={{ fontSize: 28 }}>🎾</span>
          <h1 style={{ color: 'var(--fg)', fontWeight: 800, fontSize: '1.5rem', margin: 0 }}>Súmula Eletrônica</h1>
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: 12, marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Seletor de data */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ color: 'var(--muted)', fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
              📅 Data:
            </label>
            <input
              type="date"
              value={dataSel}
              onChange={e => setDataSel(e.target.value)}
              style={{
                padding: '0.4rem 0.6rem', borderRadius: 8,
                border: '1px solid var(--line)', background: 'var(--surface)',
                color: 'var(--fg)', fontSize: '0.9rem', cursor: 'pointer',
              }}
            />
          </div>

          {/* Atalhos de datas disponíveis */}
          {datasDisponiveis.length > 0 && datasDisponiveis.length <= 10 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {datasDisponiveis.map(d => (
                <button
                  key={d}
                  onClick={() => setDataSel(d)}
                  style={{
                    padding: '0.3rem 0.7rem', borderRadius: 6, border: '1px solid var(--line)',
                    background: dataSel === d ? 'var(--green)' : 'var(--surface)',
                    color: dataSel === d ? '#fff' : 'var(--muted)',
                    fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {d === TODAY ? 'Hoje' : fmtDateOnly(d)}
                </button>
              ))}
            </div>
          )}

          {/* Toggle concluídos */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginLeft: 'auto' }}>
            <input
              type="checkbox"
              checked={verConcluidos}
              onChange={e => setVerConcluidos(e.target.checked)}
              style={{ accentColor: 'var(--green)', width: 16, height: 16 }}
            />
            <span style={{ color: 'var(--muted)', fontSize: '0.85rem', fontWeight: 600 }}>Ver concluídas</span>
          </label>
        </div>

        {/* Contador */}
        <p style={{ color: 'var(--muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
          {fmtDateOnly(dataSel)} — {jogos.length} {verConcluidos ? 'jogo(s)' : 'jogo(s) pendente(s)'}
        </p>

        {loading ? (
          <p style={{ color: 'var(--muted)' }}>Carregando…</p>
        ) : jogos.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '3rem', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--line)' }}>
            {todos.filter(j => j.data === dataSel).length > 0
              ? 'Todos os jogos desta data já foram concluídos. Ative "Ver concluídas" para visualizá-los.'
              : 'Nenhum jogo cadastrado para esta data.'}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {jogos.map(j => {
              const si = statusInfo(j.status)
              const concluido = j.status === 'concluido' || !!j.vencedor
              return (
                <div
                  key={j.id}
                  onClick={() => !concluido && selecionarJogo(j)}
                  style={{
                    background: 'var(--surface)', border: `1px solid ${concluido ? 'var(--line)' : 'var(--line)'}`,
                    borderRadius: 12,
                    padding: '1.1rem 1.25rem', cursor: concluido ? 'default' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 16,
                    opacity: concluido ? 0.7 : 1,
                    transition: 'border-color .15s, box-shadow .15s',
                    boxShadow: '0 1px 4px rgba(0,0,0,.06)',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--fg)', marginBottom: 4 }}>
                      {j.confronto || 'Confronto não definido'}
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {j.hora     && <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>⏰ {j.hora}</span>}
                      {j.quadra   && <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>🎾 {j.quadra}</span>}
                      {j.categoria && <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>📋 {j.categoria}</span>}
                      {j.fase     && <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>🏆 {j.fase}</span>}
                      {j.vencedor && <span style={{ color: '#5FB335', fontSize: '0.85rem', fontWeight: 700 }}>🏅 {j.vencedor}</span>}
                    </div>
                    {/* Placar final */}
                    {concluido && j.placar1 && (
                      <div style={{ marginTop: 4, fontSize: '0.82rem', color: 'var(--muted)' }}>
                        Placar: {j.placar1} | {j.placar2}
                      </div>
                    )}
                  </div>
                  <span style={{
                    padding: '0.25rem 0.7rem', borderRadius: 12, fontSize: '0.78rem', fontWeight: 700,
                    background: si.color + '22', color: si.color, flexShrink: 0,
                  }}>{si.label}</span>
                  {!concluido && <span style={{ color: 'var(--muted)', fontSize: 18 }}>›</span>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── Tela de controle da partida ───────────────────────────────────────────
  const si = statusInfo(statusPartida)

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)', padding: '1rem',
      display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 700, margin: '0 auto',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'var(--surface)', borderRadius: 12, padding: '1rem 1.25rem',
        border: '1px solid var(--line)',
      }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setJogoSel(null)}
          style={{ padding: '0.35rem 0.7rem', flexShrink: 0 }}
        >← Voltar</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          {jogoSel.hora   && <span style={{ color: 'var(--muted)', fontSize: '0.9rem', marginRight: 8 }}>⏰ {jogoSel.hora}</span>}
          {jogoSel.quadra && <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>🎾 {jogoSel.quadra}</span>}
        </div>
        <span style={{
          padding: '0.25rem 0.75rem', borderRadius: 12, fontSize: '0.8rem', fontWeight: 700,
          background: si.color + '22', color: si.color, flexShrink: 0,
        }}>{si.label}</span>
      </div>

      {/* Timer da partida */}
      {statusPartida === 'em_andamento' && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <PartidaTimer jogoSel={jogoSel} />
        </div>
      )}

      {/* Jogadores + Sets */}
      <div style={{
        background: 'var(--surface)', borderRadius: 12, padding: '1.25rem',
        border: '1px solid var(--line)',
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'center',
          marginBottom: '1.5rem',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--fg)', lineHeight: 1.2 }}>{j1 || 'Jogador 1'}</div>
          </div>
          <div style={{ fontSize: '1.1rem', color: 'var(--muted)', fontWeight: 700 }}>VS</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--fg)', lineHeight: 1.2 }}>{j2 || 'Jogador 2'}</div>
          </div>
        </div>

        {/* Sets */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.25rem' }}>
          <SetScore label={j1 || 'J1'} sets={setsJ1} onChange={setSetsJ1} />
          <SetScore label={j2 || 'J2'} sets={setsJ2} onChange={setSetsJ2} />
        </div>

        {/* Games em curso */}
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: '1.25rem' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>Game em curso</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            {[['J1', gamesJ1, setGamesJ1], ['J2', gamesJ2, setGamesJ2]].map(([lbl, val, setVal]) => (
              <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--muted)', width: 28 }}>{lbl === 'J1' ? (j1 || 'J1').slice(0, 8) : (j2 || 'J2').slice(0, 8)}</span>
                <button style={btnCount} onClick={() => setVal(v => Math.max(0, v - 1))}>−</button>
                <span style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--green)', minWidth: 40, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{val}</span>
                <button style={btnCount} onClick={() => setVal(v => v + 1)}>+</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Vencedor + obs */}
      <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '1.25rem', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={{ fontSize: '0.82rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>Vencedor</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[j1 || 'Jogador 1', j2 || 'Jogador 2'].map(nome => (
              <button
                key={nome}
                onClick={() => setVencedor(nome)}
                style={{
                  padding: '0.7rem', borderRadius: 8, fontWeight: 700, fontSize: '0.9rem',
                  border: `2px solid ${vencedor === nome ? 'var(--green)' : 'var(--line)'}`,
                  background: vencedor === nome ? 'rgba(95,179,53,.15)' : 'var(--bg)',
                  color: vencedor === nome ? 'var(--green)' : 'var(--fg)',
                  cursor: 'pointer', transition: 'all .15s',
                }}
              >{vencedor === nome ? '✓ ' : ''}{nome}</button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.82rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Observações / Incidentes</div>
          <textarea
            style={{
              width: '100%', padding: '0.6rem 0.75rem', borderRadius: 8,
              border: '1px solid var(--line)', background: 'var(--bg)',
              color: 'var(--fg)', fontSize: '0.9rem', resize: 'vertical', minHeight: 70,
              boxSizing: 'border-box',
            }}
            value={obs}
            onChange={e => setObs(e.target.value)}
            placeholder="Informe incidentes, reclamações ou observações…"
          />
        </div>
      </div>

      {/* Ações */}
      <div style={{ display: 'flex', gap: 12, flexDirection: 'column' }}>
        {statusPartida === 'pendente' && (
          <button className="btn btn-primary" onClick={iniciarPartida} disabled={saving} style={{ padding: '0.9rem', fontSize: '1rem', fontWeight: 700 }}>
            {saving ? 'Aguarde…' : '▶ Iniciar Partida'}
          </button>
        )}
        {statusPartida === 'em_andamento' && (
          <button
            onClick={finalizarPartida}
            disabled={saving || !vencedor}
            style={{
              padding: '0.9rem', fontSize: '1rem', fontWeight: 700, borderRadius: 8,
              border: 'none', cursor: vencedor ? 'pointer' : 'not-allowed',
              background: vencedor ? 'var(--green)' : 'var(--line)',
              color: vencedor ? '#fff' : 'var(--muted)',
              transition: 'background .15s',
            }}
          >{saving ? 'Salvando…' : '✔ Finalizar Partida'}</button>
        )}
        <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem' }}>
          Placar atual: {setsJ1.map((s, i) => `${s}–${setsJ2[i]}`).join('  ')}
        </div>
      </div>
    </div>
  )
}
