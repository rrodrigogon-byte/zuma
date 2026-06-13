import { useState, useEffect, useMemo, useCallback } from 'react'
import { api } from '../../lib/api'

/* ─── Paleta ─────────────────────────────────────────────────────────────── */
const C = {
  green: '#5FB335', darkGreen: '#0E2E1C', lightGreen: '#8FD64A',
  gold: '#C9A656', bg: '#F4F6EF', white: '#fff',
  muted: '#7a9a7a', border: '#e8f0dc', danger: '#e05555',
  card: '#fff', surface: '#f8fdf4',
}

/* ─── Tabela de pontos padrão ─────────────────────────────────────────────── */
const POINTS_DEFAULT = [
  { fase: 'Campeão',        pts: 1000, key: 'champion',     icon: '🥇' },
  { fase: 'Finalista',      pts: 600,  key: 'finalist',     icon: '🥈' },
  { fase: 'Semifinal',      pts: 360,  key: 'semi',         icon: '🥉' },
  { fase: 'Quartas',        pts: 180,  key: 'quarter',      icon: '🎾' },
  { fase: 'Oitavas (R16)',  pts: 90,   key: 'r16',          icon: '🎾' },
  { fase: 'R32',            pts: 45,   key: 'r32',          icon: '🎾' },
  { fase: 'R64',            pts: 20,   key: 'r64',          icon: '🎾' },
  { fase: 'Participação',   pts: 5,    key: 'participation', icon: '🎾' },
]

/* ─── helpers ────────────────────────────────────────────────────────────── */
const fmtN = v => Number(v || 0).toLocaleString('pt-BR')
const aprv = p => {
  const t = (p.vitorias || 0) + (p.derrotas || 0)
  return t > 0 ? Math.round((p.vitorias / t) * 100) : (p.aproveitamento ?? 0)
}
function exportCSV(rows, filename) {
  const header = ['#', 'Nome', 'Categoria', 'Pontos', 'Vitórias', 'Derrotas', 'Torneios', 'Aproveitamento%', 'Média/Torneio']
  const lines = rows.map((p, i) => [
    i + 1, p.nome, p.categoria, p.pontos || 0,
    p.vitorias || 0, p.derrotas || 0, p.torneios || 0,
    aprv(p), p.torneios > 0 ? Math.round(p.pontos / p.torneios) : 0,
  ].join(';'))
  const blob = new Blob(['\ufeff' + [header.join(';'), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

/* ─── Donut SVG ──────────────────────────────────────────────────────────── */
function Donut({ pct = 0, size = 40 }) {
  const r = 14, circ = 2 * Math.PI * r, dash = (pct / 100) * circ
  const color = pct >= 70 ? C.green : pct >= 40 ? C.gold : C.danger
  return (
    <svg width={size} height={size} viewBox="0 0 36 36">
      <circle cx="18" cy="18" r={r} fill="none" stroke="#e8e8e8" strokeWidth="4.5" />
      <circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="4.5"
        strokeDasharray={circ} strokeDashoffset={circ - dash}
        strokeLinecap="round" transform="rotate(-90 18 18)" />
      <text x="18" y="22" textAnchor="middle" fontSize="8" fontWeight="800" fill={color}>{pct}%</text>
    </svg>
  )
}

/* ─── Sparkline SVG ──────────────────────────────────────────────────────── */
function Sparkline({ data = [], color = C.green, w = 80, h = 28 }) {
  if (!data || data.length < 2) return <span style={{ color: '#ccc', fontSize: 11 }}>—</span>
  const mn = Math.min(...data), mx = Math.max(...data)
  const range = mx - mn || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - mn) / range) * (h - 4) - 2
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={w} height={h}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts.split(' ').pop().split(',')[0]} cy={pts.split(' ').pop().split(',')[1]} r="3" fill={color} />
    </svg>
  )
}

/* ─── Badge posição ──────────────────────────────────────────────────────── */
function PosBadge({ pos }) {
  if (pos === 1) return <span style={{ fontSize: '1.4rem' }}>🥇</span>
  if (pos === 2) return <span style={{ fontSize: '1.4rem' }}>🥈</span>
  if (pos === 3) return <span style={{ fontSize: '1.4rem' }}>🥉</span>
  return <span style={{ fontWeight: 800, color: pos <= 10 ? C.green : C.muted, fontSize: '0.9rem' }}>{pos}</span>
}

/* ─── Modal Editar Atleta ────────────────────────────────────────────────── */
function EditModal({ atleta, onSave, onClose }) {
  const [form, setForm] = useState({ ...atleta })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const pct = aprv(form)
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(14,46,28,.65)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ background: C.white, borderRadius: 20, maxWidth: 440, width: '100%', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,.28)' }} onClick={e => e.stopPropagation()}>
        <div style={{ background: `linear-gradient(135deg,${C.darkGreen},#1a4a2e)`, padding: '22px 24px', color: C.white }}>
          <div style={{ fontWeight: 900, fontSize: '1.1rem', marginBottom: 2 }}>✏️ Editar Atleta</div>
          <div style={{ fontSize: '0.82rem', color: '#a0c8a0' }}>{atleta.nome} · {atleta.categoria}</div>
        </div>
        <div style={{ padding: '22px 24px' }}>
          {/* Preview aproveitamento */}
          <div style={{ background: C.surface, borderRadius: 12, padding: '12px 16px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
            <Donut pct={pct} size={48} />
            <div>
              <div style={{ fontWeight: 700, color: C.darkGreen, fontSize: '0.9rem' }}>{form.pontos || 0} pts</div>
              <div style={{ fontSize: '0.75rem', color: C.muted }}>
                {form.vitorias || 0}V · {form.derrotas || 0}D · {form.torneios || 0} torneios
              </div>
              <div style={{ fontSize: '0.72rem', color: C.muted }}>
                Média: {form.torneios > 0 ? Math.round(form.pontos / form.torneios) : 0} pts/torneio
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { k: 'pontos',   label: 'Pontos' },
              { k: 'torneios', label: 'Torneios' },
              { k: 'vitorias', label: 'Vitórias' },
              { k: 'derrotas', label: 'Derrotas' },
            ].map(f => (
              <div key={f.k}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: C.darkGreen, display: 'block', marginBottom: 4 }}>{f.label}</label>
                <input type="number" value={form[f.k] ?? 0} onChange={e => set(f.k, Number(e.target.value))}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #d0dcc8', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = C.green}
                  onBlur={e => e.target.style.borderColor = '#d0dcc8'} />
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1.5px solid #d0dcc8', background: C.white, cursor: 'pointer', fontWeight: 600, color: '#666' }}>Cancelar</button>
            <button onClick={() => onSave(form)} style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg,${C.green},${C.lightGreen})`, color: C.darkGreen, fontWeight: 800, cursor: 'pointer' }}>
              ✓ Salvar alterações
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Modal Adicionar Atleta ─────────────────────────────────────────────── */
function AddModal({ categorias, onSave, onClose }) {
  const [form, setForm] = useState({ nome: '', categoria: categorias[0] || '', pontos: 0, vitorias: 0, derrotas: 0, torneios: 1 })
  const [catCustom, setCatCustom] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const pct = aprv(form)
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(14,46,28,.65)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ background: C.white, borderRadius: 20, maxWidth: 440, width: '100%', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,.28)' }} onClick={e => e.stopPropagation()}>
        <div style={{ background: `linear-gradient(135deg,${C.darkGreen},#1a4a2e)`, padding: '22px 24px', color: C.white }}>
          <div style={{ fontWeight: 900, fontSize: '1.1rem' }}>➕ Adicionar Atleta ao Ranking</div>
          <div style={{ fontSize: '0.82rem', color: '#a0c8a0', marginTop: 4 }}>Inserção manual de pontuação</div>
        </div>
        <div style={{ padding: '22px 24px' }}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: C.darkGreen, display: 'block', marginBottom: 4 }}>Nome completo *</label>
            <input value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Nome do atleta"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #d0dcc8', fontSize: '0.92rem', outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => e.target.style.borderColor = C.green}
              onBlur={e => e.target.style.borderColor = '#d0dcc8'} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: C.darkGreen }}>Categoria *</label>
              {categorias.length > 0 && (
                <button onClick={() => setCatCustom(v => !v)} style={{ fontSize: '0.7rem', background: 'none', border: 'none', color: C.green, cursor: 'pointer', fontWeight: 600 }}>
                  {catCustom ? '← Selecionar existente' : '+ Nova categoria'}
                </button>
              )}
            </div>
            {catCustom || categorias.length === 0 ? (
              <input value={form.categoria} onChange={e => set('categoria', e.target.value)} placeholder="Ex: Masc · 1ª Classe"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #d0dcc8', fontSize: '0.92rem', outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = C.green}
                onBlur={e => e.target.style.borderColor = '#d0dcc8'} />
            ) : (
              <select value={form.categoria} onChange={e => set('categoria', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #d0dcc8', fontSize: '0.92rem', outline: 'none', boxSizing: 'border-box', background: C.white }}>
                {categorias.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[
              { k: 'pontos', label: 'Pontos iniciais' },
              { k: 'torneios', label: 'Torneios jogados' },
              { k: 'vitorias', label: 'Vitórias' },
              { k: 'derrotas', label: 'Derrotas' },
            ].map(f => (
              <div key={f.k}>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: C.darkGreen, display: 'block', marginBottom: 3 }}>{f.label}</label>
                <input type="number" min="0" value={form[f.k]}
                  onChange={e => set(f.k, Number(e.target.value))}
                  style={{ width: '100%', padding: '9px 10px', borderRadius: 10, border: '1.5px solid #d0dcc8', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            ))}
          </div>

          {/* Preview */}
          {form.nome.trim() && (
            <div style={{ background: C.surface, borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.8rem', color: C.muted }}>
              <Donut pct={pct} size={32} />
              <span><strong style={{ color: C.darkGreen }}>{form.nome}</strong> · {form.categoria} · <strong style={{ color: C.green }}>{fmtN(form.pontos)} pts</strong></span>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1.5px solid #d0dcc8', background: C.white, cursor: 'pointer', fontWeight: 600, color: '#666' }}>Cancelar</button>
            <button onClick={() => form.nome.trim() && form.categoria.trim() && onSave(form)} disabled={!form.nome.trim() || !form.categoria.trim()}
              style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none', background: form.nome.trim() ? `linear-gradient(135deg,${C.green},${C.lightGreen})` : '#e0e0e0', color: form.nome.trim() ? C.darkGreen : '#aaa', fontWeight: 800, cursor: form.nome.trim() ? 'pointer' : 'not-allowed' }}>
              ➕ Adicionar ao ranking
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Modal Perfil do Atleta ─────────────────────────────────────────────── */
function AtletaPerfilModal({ atleta, todos, campeoes, onClose, onEdit, onRemover }) {
  if (!atleta) return null
  const catRank = todos.filter(p => p.categoria === atleta.categoria).sort((a, b) => (b.pontos || 0) - (a.pontos || 0))
  const posCat  = catRank.findIndex(p => p.nome === atleta.nome && p.categoria === atleta.categoria) + 1
  const posGeral = todos.indexOf(atleta) + 1
  const pct = aprv(atleta)
  const media = atleta.torneios > 0 ? Math.round(atleta.pontos / atleta.torneios) : 0
  const titulos = campeoes.filter(c => (c.nome || c.campeao)?.toLowerCase() === atleta.nome?.toLowerCase())
  const adversarios = todos.filter(p => p.nome !== atleta.nome).slice(0, 5)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(14,46,28,.7)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto' }} onClick={onClose}>
      <div style={{ background: C.white, borderRadius: 24, maxWidth: 520, width: '100%', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,.32)', margin: 'auto' }} onClick={e => e.stopPropagation()}>

        {/* Header com avatar */}
        <div style={{ background: `linear-gradient(135deg,${C.darkGreen},#1a4a2e)`, padding: '28px 28px 22px', color: C.white }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
              background: `linear-gradient(135deg,${C.green},${C.lightGreen})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.8rem', fontWeight: 900, color: C.darkGreen,
              boxShadow: '0 4px 16px rgba(95,179,53,.4)',
            }}>
              {atleta.nome?.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: '1.2rem', marginBottom: 2 }}>{atleta.nome}</div>
              <div style={{ fontSize: '0.83rem', color: '#a0c8a0', marginBottom: 6 }}>{atleta.categoria}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {titulos.length > 0 && (
                  <span style={{ background: 'rgba(201,166,86,.25)', color: C.gold, padding: '2px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700 }}>
                    🏆 {titulos.length} título{titulos.length > 1 ? 's' : ''}
                  </span>
                )}
                <span style={{ background: 'rgba(255,255,255,.12)', color: '#d0f0a0', padding: '2px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700 }}>
                  #{posGeral} geral · #{posCat}° na cat.
                </span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: '22px 24px' }}>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Pontos',    value: fmtN(atleta.pontos || 0), color: C.green, big: true },
              { label: 'Torneios', value: atleta.torneios || 0,      color: C.darkGreen },
              { label: 'Vitórias', value: atleta.vitorias || 0,      color: C.green },
              { label: 'Derrotas', value: atleta.derrotas || 0,      color: C.danger },
            ].map((k, i) => (
              <div key={i} style={{ background: C.surface, borderRadius: 12, padding: '12px 8px', textAlign: 'center' }}>
                <div style={{ fontWeight: 900, fontSize: k.big ? '1.3rem' : '1.2rem', color: k.color }}>{k.value}</div>
                <div style={{ fontSize: '0.65rem', color: C.muted, fontWeight: 600, marginTop: 2, textTransform: 'uppercase' }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Barra aproveitamento */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 6 }}>
              <span style={{ color: C.muted, fontWeight: 600 }}>Aproveitamento · {atleta.vitorias || 0}V / {atleta.derrotas || 0}D</span>
              <span style={{ fontWeight: 800, color: pct >= 70 ? C.green : pct >= 40 ? C.gold : C.danger }}>{pct}%</span>
            </div>
            <div style={{ height: 9, background: '#e8e8e8', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: pct >= 70 ? C.green : pct >= 40 ? C.gold : C.danger, borderRadius: 8, transition: 'width .6s' }} />
            </div>
          </div>

          {/* Stats secundários */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
            <div style={{ background: C.surface, borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ fontSize: '0.7rem', color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Média por torneio</div>
              <div style={{ fontWeight: 900, color: C.darkGreen, fontSize: '1.1rem' }}>{fmtN(media)} pts</div>
            </div>
            <div style={{ background: C.surface, borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ fontSize: '0.7rem', color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Posição na categoria</div>
              <div style={{ fontWeight: 900, color: C.darkGreen, fontSize: '1.1rem' }}>
                {posCat === 1 ? '🥇' : posCat === 2 ? '🥈' : posCat === 3 ? '🥉' : `#${posCat}`}° de {catRank.length}
              </div>
            </div>
          </div>

          {/* Títulos */}
          {titulos.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: '0.72rem', color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>🏆 Títulos</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {titulos.map((t, i) => (
                  <span key={i} style={{ background: 'rgba(201,166,86,.12)', color: C.gold, border: '1px solid rgba(201,166,86,.3)', padding: '4px 12px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 700 }}>
                    🏆 {t.categoria}{t.edicao ? ` · ${t.edicao}` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Comparativo na categoria (top 5) */}
          {catRank.length > 1 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: '0.72rem', color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                📊 Posição na categoria — {atleta.categoria}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {catRank.slice(0, 5).map((p, i) => {
                  const isMe = p.nome === atleta.nome
                  const maxPts = catRank[0].pontos || 1
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 20, textAlign: 'center', fontSize: '0.8rem' }}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                      </span>
                      <div style={{ flex: 1, height: 6, background: '#eee', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${((p.pontos || 0) / maxPts) * 100}%`, background: isMe ? C.green : '#c8dcc0', borderRadius: 4 }} />
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: isMe ? 800 : 500, color: isMe ? C.darkGreen : C.muted, minWidth: 90, textAlign: 'right' }}>
                        {isMe ? <strong>{p.nome}</strong> : p.nome} · {fmtN(p.pontos)}
                      </span>
                    </div>
                  )
                })}
                {catRank.findIndex(p => p.nome === atleta.nome) >= 5 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 20, textAlign: 'center', fontSize: '0.8rem' }}>#{posCat}</span>
                    <div style={{ flex: 1, height: 6, background: '#eee', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${((atleta.pontos || 0) / (catRank[0].pontos || 1)) * 100}%`, background: C.green, borderRadius: 4 }} />
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: C.darkGreen, minWidth: 90, textAlign: 'right' }}>
                      <strong>{atleta.nome}</strong> · {fmtN(atleta.pontos)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Ações */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { onClose(); onEdit(atleta) }}
              style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1.5px solid ${C.green}`, background: C.white, color: C.green, fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>
              ✏️ Editar
            </button>
            <button onClick={() => { onClose(); onRemover(atleta) }}
              style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1.5px solid ${C.danger}`, background: C.white, color: C.danger, fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>
              🗑 Remover
            </button>
            <button onClick={onClose}
              style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1.5px solid #d0dcc8', background: C.white, color: '#666', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Modal Registrar Partida Avulsa ────────────────────────────────────── */
function PartidaModal({ categorias, onSave, onClose }) {
  const [form, setForm] = useState({ vencedor: '', perdedor: '', categoria: categorias[0] || '', placar: '', descricao: 'Partida avulsa', temporada: new Date().getFullYear().toString() })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(14,46,28,.65)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ background: C.white, borderRadius: 20, maxWidth: 460, width: '100%', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,.28)' }} onClick={e => e.stopPropagation()}>
        <div style={{ background: `linear-gradient(135deg,${C.darkGreen},#1a4a2e)`, padding: '22px 24px', color: C.white }}>
          <div style={{ fontWeight: 900, fontSize: '1.1rem' }}>⚔️ Registrar Partida Avulsa</div>
          <div style={{ fontSize: '0.82rem', color: '#a0c8a0', marginTop: 4 }}>Ranking contínuo — todos os jogos valem pontos</div>
        </div>
        <div style={{ padding: '22px 24px' }}>
          {[
            { k: 'vencedor', label: '✅ Vencedor *', placeholder: 'Nome do vencedor' },
            { k: 'perdedor', label: '❌ Perdedor *', placeholder: 'Nome do perdedor' },
            { k: 'placar',   label: '📊 Placar', placeholder: 'Ex: 6-4, 6-2' },
            { k: 'descricao',label: '📝 Descrição', placeholder: 'Ex: Desafio, Liga, Amistoso...' },
          ].map(f => (
            <div key={f.k} style={{ marginBottom: 12 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: C.darkGreen, display: 'block', marginBottom: 4 }}>{f.label}</label>
              <input value={form[f.k]} onChange={e => set(f.k, e.target.value)} placeholder={f.placeholder}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #d0dcc8', fontSize: '0.92rem', outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = C.green}
                onBlur={e => e.target.style.borderColor = '#d0dcc8'} />
            </div>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: C.darkGreen, display: 'block', marginBottom: 4 }}>Categoria *</label>
              {categorias.length > 0 ? (
                <select value={form.categoria} onChange={e => set('categoria', e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #d0dcc8', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box', background: C.white }}>
                  {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              ) : (
                <input value={form.categoria} onChange={e => set('categoria', e.target.value)} placeholder="Categoria"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #d0dcc8', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' }} />
              )}
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: C.darkGreen, display: 'block', marginBottom: 4 }}>Temporada</label>
              <input value={form.temporada} onChange={e => set('temporada', e.target.value)} placeholder="2025"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #d0dcc8', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>
          {/* Info sobre pontuação */}
          <div style={{ background: '#f0fae8', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: '0.78rem', color: C.muted, lineHeight: 1.6 }}>
            <strong style={{ color: C.darkGreen }}>Como funciona:</strong> Pontos variam conforme o nível dos jogadores — vencer alguém melhor ranqueado vale mais (15 pts) que vencer alguém pior (6 pts). O perdedor sempre ganha pelo menos 1 ponto por jogar.
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1.5px solid #d0dcc8', background: C.white, cursor: 'pointer', fontWeight: 600, color: '#666' }}>Cancelar</button>
            <button
              onClick={() => form.vencedor.trim() && form.perdedor.trim() && form.categoria && onSave(form)}
              disabled={!form.vencedor.trim() || !form.perdedor.trim() || !form.categoria}
              style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none', background: (form.vencedor.trim() && form.perdedor.trim()) ? `linear-gradient(135deg,${C.green},${C.lightGreen})` : '#e0e0e0', color: (form.vencedor.trim() && form.perdedor.trim()) ? C.darkGreen : '#aaa', fontWeight: 800, cursor: (form.vencedor.trim() && form.perdedor.trim()) ? 'pointer' : 'not-allowed' }}>
              ⚔️ Registrar partida
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Componente principal ──────────────────────────────────────────────── */
export default function AdminRanking() {
  const [ranking,       setRanking]       = useState([])
  const [campeoes,      setCampeoes]       = useState([])
  const [loading,       setLoading]       = useState(true)
  const [busca,         setBusca]         = useState('')
  const [catFiltro,     setCatFiltro]     = useState('all')
  const [sortCol,       setSortCol]       = useState('pontos')
  const [sortDir,       setSortDir]       = useState('desc')
  const [tab,           setTab]           = useState('ranking')
  const [editAtleta,    setEditAtleta]    = useState(null)
  const [showAdd,       setShowAdd]       = useState(false)
  const [showPartida,   setShowPartida]   = useState(false)
  const [perfilAtleta,  setPerfilAtleta]  = useState(null)
  const [confirmReset,  setConfirmReset]  = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [msg,           setMsg]           = useState(null)
  const [pontosTbl,     setPontosTbl]     = useState(POINTS_DEFAULT)
  const [editPontos,    setEditPontos]    = useState(false)
  const [pontosDraft,   setPontosDraft]   = useState(null)
  const [catExpand,     setCatExpand]     = useState({})
  const [partidas,      setPartidas]      = useState([])
  const [loadingPart,   setLoadingPart]   = useState(false)
  const [temporadas,    setTemporadas]    = useState([])
  const [tempSelecionada, setTempSelecionada] = useState('all')
  const [confirmTemp,   setConfirmTemp]   = useState(null) // temporada a arquivar

  const showMsg = (text, type = 'ok') => { setMsg({ text, type }); setTimeout(() => setMsg(null), 3500) }

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      api.get('/api/ranking'),
      api.get('/api/admin/campeoes').catch(() => []),
      api.get('/api/ranking/temporadas').catch(() => []),
    ]).then(([r, c, t]) => {
      setRanking(Array.isArray(r) ? r : [])
      setCampeoes(Array.isArray(c) ? c : [])
      setTemporadas(Array.isArray(t) ? t : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const loadPartidas = useCallback(() => {
    setLoadingPart(true)
    api.get('/api/admin/ranking/partidas?limit=100').then(d => {
      setPartidas(Array.isArray(d) ? d : [])
      setLoadingPart(false)
    }).catch(() => setLoadingPart(false))
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (tab === 'partidas') loadPartidas() }, [tab, loadPartidas])

  const categorias = useMemo(() => [...new Set(ranking.map(p => p.categoria).filter(Boolean))].sort(), [ranking])

  /* Ordenação */
  const toggleSort = col => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }
  const SortIcon = ({ col }) => sortCol !== col ? <span style={{ color: '#ccc' }}> ↕</span> : sortDir === 'desc' ? <span style={{ color: C.green }}> ↓</span> : <span style={{ color: C.green }}> ↑</span>

  const filtrado = useMemo(() => {
    let rows = ranking.filter(p => {
      const matchB = !busca || p.nome?.toLowerCase().includes(busca.toLowerCase())
      const matchC = catFiltro === 'all' || p.categoria === catFiltro
      return matchB && matchC
    })
    rows = [...rows].sort((a, b) => {
      let va = a[sortCol] ?? 0, vb = b[sortCol] ?? 0
      if (sortCol === 'aproveitamento') { va = aprv(a); vb = aprv(b) }
      if (sortCol === 'media') { va = a.torneios > 0 ? a.pontos / a.torneios : 0; vb = b.torneios > 0 ? b.pontos / b.torneios : 0 }
      if (sortCol === 'nome') { va = a.nome?.toLowerCase() ?? ''; vb = b.nome?.toLowerCase() ?? '' }
      if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      return sortDir === 'asc' ? va - vb : vb - va
    })
    return rows
  }, [ranking, busca, catFiltro, sortCol, sortDir])

  /* KPIs */
  const totalAtletas  = ranking.length
  const totalCats     = categorias.length
  const totalTorneios = ranking.length > 0 ? Math.max(...ranking.map(p => p.torneios || 0), 0) : 0
  const melhorAtleta  = ranking[0]
  const totalPontos   = ranking.reduce((s, p) => s + (p.pontos || 0), 0)

  /* Por categoria — para a aba Categorias */
  const porCategoria = useMemo(() => {
    return categorias.map(cat => {
      const jogadores = ranking.filter(p => p.categoria === cat).sort((a, b) => (b.pontos || 0) - (a.pontos || 0))
      const lider = jogadores[0]
      return { cat, jogadores, lider }
    })
  }, [ranking, categorias])

  /* Handlers */
  const handleSaveEdit = async (form) => {
    setSaving(true)
    try {
      await api.patch('/api/admin/ranking/atleta', form)
      showMsg('Atleta atualizado com sucesso!')
      setEditAtleta(null); load()
    } catch { showMsg('Erro ao salvar.', 'err') }
    finally { setSaving(false) }
  }

  const handleAddAtleta = async (form) => {
    setSaving(true)
    try {
      await api.post('/api/admin/ranking/atleta', form)
      showMsg('Atleta adicionado ao ranking!')
      setShowAdd(false); load()
    } catch { showMsg('Erro ao adicionar atleta.', 'err') }
    finally { setSaving(false) }
  }

  const handleRemover = async (p) => {
    if (!window.confirm(`Remover ${p.nome} (${p.categoria}) do ranking?`)) return
    setSaving(true)
    try {
      await api.delete('/api/admin/ranking/atleta', { nome: p.nome, categoria: p.categoria })
      showMsg('Atleta removido.')
      load()
    } catch { showMsg('Erro ao remover atleta.', 'err') }
    finally { setSaving(false) }
  }

  const handleReset = async () => {
    setSaving(true)
    try {
      await api.post('/api/admin/reset-ranking', {})
      showMsg('Ranking zerado com sucesso.')
      setConfirmReset(false); load()
    } catch { showMsg('Erro ao resetar ranking.', 'err') }
    finally { setSaving(false) }
  }

  const handleRegistrarPartida = async (form) => {
    setSaving(true)
    try {
      const r = await api.post('/api/admin/ranking/partida', form)
      showMsg(`✅ Partida registrada! ${form.vencedor} +${r.ptsVencedor}pts · ${form.perdedor} +${r.ptsPerdedor}pts`)
      setShowPartida(false); load(); if (tab === 'partidas') loadPartidas()
    } catch (e) { showMsg('Erro ao registrar partida.', 'err') }
    finally { setSaving(false) }
  }

  const handleRemoverPartida = async (id) => {
    if (!window.confirm('Remover esta partida?')) return
    try {
      await api.delete(`/api/admin/ranking/partida/${id}`)
      showMsg('Partida removida.'); loadPartidas()
    } catch { showMsg('Erro ao remover partida.', 'err') }
  }

  const handleArquivarTemporada = async (temp) => {
    setSaving(true)
    try {
      await api.post('/api/admin/ranking/temporada/reset', { temporada: temp })
      showMsg(`Temporada ${temp} arquivada com sucesso!`)
      setConfirmTemp(null); load()
    } catch { showMsg('Erro ao arquivar temporada.', 'err') }
    finally { setSaving(false) }
  }

  /* Edição da tabela de pontos */
  const startEditPontos = () => { setPontosDraft(pontosTbl.map(r => ({ ...r }))); setEditPontos(true) }
  const savePontos = () => { setPontosTbl(pontosDraft); setEditPontos(false); showMsg('Tabela de pontos atualizada!') }

  /* ─── render ─── */
  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'Inter','Segoe UI',sans-serif", paddingBottom: 80 }}>

      {/* Toast */}
      {msg && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 1001, background: msg.type === 'ok' ? C.green : C.danger, color: C.white, padding: '12px 22px', borderRadius: 12, fontWeight: 700, fontSize: '0.88rem', boxShadow: '0 4px 20px rgba(0,0,0,.2)', animation: 'fadeIn .2s' }}>
          {msg.type === 'ok' ? '✓ ' : '⚠ '}{msg.text}
        </div>
      )}

      {/* ── HEADER ── */}
      <div style={{ background: `linear-gradient(135deg,${C.darkGreen},#1a4a2e)`, padding: '28px 28px 0', color: C.white }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.55rem', fontWeight: 900, letterSpacing: '-0.02em' }}>🏆 Gestão de Ranking</h1>
              <p style={{ margin: '4px 0 0', color: '#a0c8a0', fontSize: '0.85rem' }}>Ranking público de torneios · 4ª Agro Open de Tênis</p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a href="/ranking" target="_blank" rel="noreferrer" style={{ background: 'rgba(255,255,255,.12)', color: C.white, padding: '9px 16px', borderRadius: 10, fontWeight: 700, fontSize: '0.8rem', textDecoration: 'none', border: '1px solid rgba(255,255,255,.18)' }}>
                👁 Ver público →
              </a>
              <button onClick={() => exportCSV(filtrado, 'ranking-agro-open.csv')}
                style={{ background: 'rgba(143,214,74,.15)', color: C.lightGreen, border: '1px solid rgba(143,214,74,.3)', borderRadius: 10, padding: '9px 16px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>
                ⬇ Exportar CSV
              </button>
              <button onClick={() => setShowPartida(true)}
                style={{ background: 'rgba(91,106,240,.2)', color: '#b0b8ff', border: '1px solid rgba(91,106,240,.35)', borderRadius: 10, padding: '9px 16px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>
                ⚔️ Registrar partida
              </button>
              <button onClick={() => setShowAdd(true)}
                style={{ background: C.lightGreen, color: C.darkGreen, border: 'none', borderRadius: 10, padding: '9px 18px', fontWeight: 800, cursor: 'pointer', fontSize: '0.85rem' }}>
                ➕ Adicionar atleta
              </button>
              <button onClick={() => setConfirmReset(true)}
                style={{ background: 'rgba(224,85,85,.22)', color: '#ffaaaa', border: '1px solid rgba(224,85,85,.3)', borderRadius: 10, padding: '9px 14px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>
                🗑 Zerar
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 0 }}>
            {[
              { key: 'ranking',    label: '📋 Ranking Geral' },
              { key: 'categorias', label: '🎾 Por Categoria' },
              { key: 'partidas',   label: '⚔️ Partidas Avulsas' },
              { key: 'temporadas', label: '📅 Temporadas' },
              { key: 'campeoes',   label: '🏅 Campeões' },
              { key: 'pontuacao',  label: '⭐ Pontuação' },
              { key: 'stats',      label: '📊 Estatísticas' },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                background: tab === t.key ? C.white : 'transparent',
                color: tab === t.key ? C.darkGreen : 'rgba(255,255,255,.8)',
                border: 'none', borderRadius: '10px 10px 0 0',
                padding: '10px 18px',
                fontWeight: tab === t.key ? 800 : 600,
                fontSize: '0.82rem', cursor: 'pointer', transition: 'all .15s',
                whiteSpace: 'nowrap',
              }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '24px 28px' }}>

        {/* ── KPIs ── */}
        {!loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 24 }}>
            {[
              { icon: '👥', label: 'Atletas',     value: fmtN(totalAtletas),          color: C.green },
              { icon: '🎾', label: 'Categorias',  value: fmtN(totalCats),              color: C.gold },
              { icon: '🏟', label: 'Edições',     value: fmtN(totalTorneios),          color: '#5b8ef0' },
              { icon: '⭐', label: 'Total pts',   value: fmtN(totalPontos),            color: C.darkGreen },
              { icon: '👑', label: 'Líder',        value: melhorAtleta?.nome || '—',   color: C.gold, small: true },
            ].map((k, i) => (
              <div key={i} style={{ background: C.white, borderRadius: 16, padding: '16px 14px', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,.06)', border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>{k.icon}</div>
                <div style={{ fontWeight: 900, fontSize: k.small ? '0.82rem' : '1.55rem', color: k.color, lineHeight: 1, wordBreak: 'break-word' }}>{k.value}</div>
                <div style={{ fontSize: '0.65rem', color: C.muted, fontWeight: 700, marginTop: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>{k.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ════════════════════════════════════════════════════
            TAB: RANKING GERAL
        ════════════════════════════════════════════════════ */}
        {tab === 'ranking' && (
          <>
            {/* Filtros */}
            <div style={{ background: C.white, borderRadius: 16, padding: '14px 18px', marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,.05)' }}>
              <div style={{ flex: '1 1 220px', position: 'relative' }}>
                <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#aaa' }}>🔍</span>
                <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar atleta…"
                  style={{ width: '100%', paddingLeft: 34, paddingRight: 10, paddingTop: 9, paddingBottom: 9, borderRadius: 10, border: '1.5px solid #d0dcc8', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = C.green}
                  onBlur={e => e.target.style.borderColor = '#d0dcc8'} />
              </div>
              {categorias.length > 0 && (
                <select value={catFiltro} onChange={e => setCatFiltro(e.target.value)}
                  style={{ flex: '0 1 210px', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #d0dcc8', fontSize: '0.85rem', outline: 'none', color: C.darkGreen, background: C.white }}>
                  <option value="all">Todas as categorias</option>
                  {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
              <span style={{ fontSize: '0.78rem', color: C.muted, marginLeft: 'auto' }}>
                {filtrado.length} atleta{filtrado.length !== 1 ? 's' : ''}
              </span>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: 60, color: C.green, fontSize: '2.5rem' }}>⏳</div>
            ) : filtrado.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, background: C.white, borderRadius: 18, color: '#aaa' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>{ranking.length === 0 ? '🏆' : '🔍'}</div>
                <div style={{ fontWeight: 700, color: C.darkGreen, marginBottom: 6 }}>
                  {ranking.length === 0 ? 'Ranking vazio' : 'Nenhum atleta encontrado'}
                </div>
                <div style={{ fontSize: '0.84rem' }}>
                  {ranking.length === 0 ? 'Finalize chaves em Torneios ou adicione atletas manualmente.' : 'Tente ajustar os filtros.'}
                </div>
              </div>
            ) : (
              <div style={{ background: C.white, borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,.07)' }}>
                {/* Cabeçalho clicável para ordenar */}
                <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr 90px 100px 100px 80px 80px 80px', background: `linear-gradient(135deg,${C.darkGreen},#1a4a2e)`, padding: '12px 18px', color: C.lightGreen, fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                  <div style={{ textAlign: 'center' }}>#</div>
                  <div style={{ cursor: 'pointer' }} onClick={() => toggleSort('nome')}>Atleta <SortIcon col="nome" /></div>
                  <div style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleSort('pontos')}>Pontos <SortIcon col="pontos" /></div>
                  <div style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => toggleSort('aproveitamento')}>Aprovt. <SortIcon col="aproveitamento" /></div>
                  <div style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => toggleSort('vitorias')}>V – D <SortIcon col="vitorias" /></div>
                  <div style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => toggleSort('torneios')}>Torn. <SortIcon col="torneios" /></div>
                  <div style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => toggleSort('media')}>Média <SortIcon col="media" /></div>
                  <div style={{ textAlign: 'center' }}>Ações</div>
                </div>

                {filtrado.map((p, i) => {
                  const pos = ranking.findIndex(x => x.nome === p.nome && x.categoria === p.categoria) + 1 || i + 1
                  const pct = aprv(p)
                  const media = p.torneios > 0 ? Math.round(p.pontos / p.torneios) : 0
                  return (
                    <div key={`${p.nome}-${p.categoria}-${i}`}
                      style={{ display: 'grid', gridTemplateColumns: '52px 1fr 90px 100px 100px 80px 80px 80px', padding: '11px 18px', alignItems: 'center', borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? C.white : '#fafcf8', cursor: 'pointer', transition: 'background .1s' }}
                      onClick={() => setPerfilAtleta(p)}
                      onMouseEnter={e => e.currentTarget.style.background = '#f0fae8'}
                      onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? C.white : '#fafcf8'}
                    >
                      <div style={{ textAlign: 'center' }}><PosBadge pos={pos} /></div>
                      <div>
                        <div style={{ fontWeight: 700, color: C.darkGreen, fontSize: '0.88rem' }}>{p.nome}</div>
                        <div style={{ fontSize: '0.67rem', color: C.muted, marginTop: 1 }}>{p.categoria}</div>
                      </div>
                      <div style={{ textAlign: 'right', fontWeight: 900, color: C.green, fontSize: '0.92rem' }}>{fmtN(p.pontos || 0)}</div>
                      <div style={{ display: 'flex', justifyContent: 'center' }}><Donut pct={pct} size={36} /></div>
                      <div style={{ textAlign: 'center', fontSize: '0.82rem' }}>
                        <span style={{ color: C.green, fontWeight: 700 }}>{p.vitorias ?? 0}</span>
                        <span style={{ color: '#ddd', margin: '0 3px' }}>–</span>
                        <span style={{ color: C.danger, fontWeight: 700 }}>{p.derrotas ?? 0}</span>
                      </div>
                      <div style={{ textAlign: 'center', color: C.muted, fontWeight: 700, fontSize: '0.84rem' }}>{p.torneios ?? 0}</div>
                      <div style={{ textAlign: 'center', color: '#888', fontSize: '0.8rem' }}>{media > 0 ? fmtN(media) : '—'}</div>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 5 }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => setEditAtleta(p)} title="Editar"
                          style={{ background: '#f0f4e8', border: 'none', borderRadius: 7, padding: '5px 9px', cursor: 'pointer', fontSize: '0.88rem' }}>✏️</button>
                        <button onClick={() => handleRemover(p)} title="Remover"
                          style={{ background: 'rgba(224,85,85,.08)', border: 'none', borderRadius: 7, padding: '5px 9px', cursor: 'pointer', fontSize: '0.88rem' }}>🗑</button>
                      </div>
                    </div>
                  )
                })}

                {/* Rodapé da tabela */}
                <div style={{ padding: '12px 18px', background: C.surface, fontSize: '0.75rem', color: C.muted, display: 'flex', justifyContent: 'space-between' }}>
                  <span>{filtrado.length} atletas exibidos · clique em uma linha para ver o perfil</span>
                  <button onClick={() => exportCSV(filtrado, 'ranking-agro-open.csv')}
                    style={{ background: 'none', border: 'none', color: C.green, cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem' }}>
                    ⬇ Exportar CSV
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════════════
            TAB: POR CATEGORIA
        ════════════════════════════════════════════════════ */}
        {tab === 'categorias' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {porCategoria.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, background: C.white, borderRadius: 18, color: '#aaa' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>🎾</div>
                <div style={{ fontWeight: 700, color: C.darkGreen }}>Nenhuma categoria registrada ainda</div>
              </div>
            ) : porCategoria.map(({ cat, jogadores, lider }) => {
              const expanded = catExpand[cat] !== false
              const maxPts = jogadores[0]?.pontos || 1
              return (
                <div key={cat} style={{ background: C.white, borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,.06)' }}>
                  {/* Header da categoria */}
                  <div style={{ background: `linear-gradient(135deg,${C.darkGreen},#1a4a2e)`, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                    onClick={() => setCatExpand(p => ({ ...p, [cat]: !expanded }))}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: '1.3rem' }}>🎾</span>
                      <div>
                        <div style={{ color: C.white, fontWeight: 800, fontSize: '0.95rem' }}>{cat}</div>
                        <div style={{ color: '#a0c8a0', fontSize: '0.75rem' }}>{jogadores.length} atleta{jogadores.length !== 1 ? 's' : ''}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {lider && (
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: C.gold, fontSize: '0.78rem', fontWeight: 800 }}>👑 {lider.nome}</div>
                          <div style={{ color: '#a0c8a0', fontSize: '0.7rem' }}>{fmtN(lider.pontos)} pts · {aprv(lider)}% aprov.</div>
                        </div>
                      )}
                      <span style={{ color: C.lightGreen, fontSize: '1.1rem', transition: 'transform .2s', transform: expanded ? 'rotate(180deg)' : 'none' }}>▼</span>
                    </div>
                  </div>

                  {/* Pódio top 3 */}
                  {expanded && (
                    <div style={{ padding: '16px 20px' }}>
                      {jogadores.length > 0 && (
                        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                          {jogadores.slice(0, 3).map((p, i) => {
                            const pct = aprv(p)
                            return (
                              <div key={i} onClick={() => setPerfilAtleta(p)}
                                style={{ flex: '1 1 140px', background: i === 0 ? 'linear-gradient(135deg,#fef9ec,#fdf3d0)' : C.surface, borderRadius: 12, padding: '14px', border: i === 0 ? `1.5px solid ${C.gold}` : `1px solid ${C.border}`, cursor: 'pointer', transition: 'transform .15s' }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'none'}
                              >
                                <div style={{ textAlign: 'center', fontSize: '1.8rem', marginBottom: 4 }}>
                                  {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                                </div>
                                <div style={{ fontWeight: 800, color: C.darkGreen, fontSize: '0.85rem', textAlign: 'center', marginBottom: 2 }}>{p.nome}</div>
                                <div style={{ textAlign: 'center', fontWeight: 900, color: i === 0 ? C.gold : C.green, fontSize: '1rem' }}>{fmtN(p.pontos)}</div>
                                <div style={{ textAlign: 'center', fontSize: '0.68rem', color: C.muted, marginTop: 2 }}>{pct}% aprovt.</div>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Lista completa */}
                      {jogadores.length > 3 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {jogadores.slice(3).map((p, i) => {
                            const pos = i + 4
                            const pct = aprv(p)
                            return (
                              <div key={i} onClick={() => setPerfilAtleta(p)}
                                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, background: C.surface, cursor: 'pointer', border: `1px solid ${C.border}`, transition: 'background .1s' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#eaf5e0'}
                                onMouseLeave={e => e.currentTarget.style.background = C.surface}
                              >
                                <span style={{ width: 28, textAlign: 'center', fontWeight: 800, color: C.muted, fontSize: '0.82rem' }}>#{pos}</span>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: 700, color: C.darkGreen, fontSize: '0.85rem' }}>{p.nome}</div>
                                </div>
                                {/* Barra de pontos */}
                                <div style={{ width: 80, height: 5, background: '#e0e0e0', borderRadius: 4, overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${((p.pontos || 0) / maxPts) * 100}%`, background: C.green, borderRadius: 4 }} />
                                </div>
                                <span style={{ fontWeight: 800, color: C.green, fontSize: '0.85rem', minWidth: 60, textAlign: 'right' }}>{fmtN(p.pontos)}</span>
                                <span style={{ fontSize: '0.72rem', color: pct >= 60 ? C.green : pct >= 40 ? C.gold : C.danger, fontWeight: 700, minWidth: 38 }}>{pct}%</span>
                                <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                                  <button onClick={() => setEditAtleta(p)} style={{ background: '#f0f4e8', border: 'none', borderRadius: 7, padding: '4px 8px', cursor: 'pointer', fontSize: '0.8rem' }}>✏️</button>
                                  <button onClick={() => handleRemover(p)} style={{ background: 'rgba(224,85,85,.08)', border: 'none', borderRadius: 7, padding: '4px 8px', cursor: 'pointer', fontSize: '0.8rem' }}>🗑</button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ════════════════════════════════════════════════════
            TAB: PARTIDAS AVULSAS
        ════════════════════════════════════════════════════ */}
        {tab === 'partidas' && (
          <div>
            {/* Info box */}
            <div style={{ background: 'linear-gradient(135deg,#1a3a4e,#0e2e3c)', borderRadius: 16, padding: '18px 22px', marginBottom: 20, color: C.white, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <span style={{ fontSize: '2rem' }}>⚔️</span>
              <div>
                <div style={{ fontWeight: 900, fontSize: '1rem', marginBottom: 4 }}>Ranking Contínuo — Estilo meuranking</div>
                <div style={{ fontSize: '0.82rem', color: '#a0c8c8', lineHeight: 1.6 }}>
                  Registre partidas avulsas e desafios para manter um ranking ativo o ano todo, sem depender de torneios. Pontos variam pela diferença de nível: <strong>vencer alguém melhor = 15 pts · mesma faixa = 10 pts · nível inferior = 6 pts</strong>. O perdedor sempre ganha pontos por jogar.
                </div>
              </div>
            </div>

            {/* Botão registrar */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button onClick={() => setShowPartida(true)}
                style={{ background: `linear-gradient(135deg,${C.green},${C.lightGreen})`, color: C.darkGreen, border: 'none', borderRadius: 10, padding: '10px 22px', fontWeight: 800, cursor: 'pointer', fontSize: '0.88rem', boxShadow: '0 3px 12px rgba(95,179,53,.3)' }}>
                ⚔️ Registrar nova partida
              </button>
            </div>

            {loadingPart ? (
              <div style={{ textAlign: 'center', padding: 60, color: C.green, fontSize: '2rem' }}>⏳</div>
            ) : partidas.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, background: C.white, borderRadius: 18, color: '#aaa' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⚔️</div>
                <div style={{ fontWeight: 700, color: C.darkGreen, marginBottom: 6 }}>Nenhuma partida avulsa registrada</div>
                <div style={{ fontSize: '0.84rem' }}>Registre partidas e desafios para manter o ranking ativo durante todo o ano.</div>
              </div>
            ) : (
              <div style={{ background: C.white, borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,.07)' }}>
                <div style={{ background: `linear-gradient(135deg,${C.darkGreen},#1a4a2e)`, padding: '12px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr 80px 80px 70px 60px', color: C.lightGreen, fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                  <div>Vencedor</div>
                  <div>Perdedor</div>
                  <div style={{ textAlign: 'center' }}>Placar</div>
                  <div style={{ textAlign: 'center' }}>Categoria</div>
                  <div style={{ textAlign: 'center' }}>Data</div>
                  <div style={{ textAlign: 'center' }}>Ação</div>
                </div>
                {partidas.map((p, i) => (
                  <div key={p.id || i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 80px 70px 60px', padding: '11px 18px', alignItems: 'center', borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? C.white : '#fafcf8' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: C.darkGreen, fontSize: '0.88rem' }}>✅ {p.vencedor}</div>
                      {p.descricao !== 'Partida avulsa' && <div style={{ fontSize: '0.68rem', color: C.muted }}>{p.descricao}</div>}
                    </div>
                    <div style={{ fontWeight: 600, color: '#888', fontSize: '0.88rem' }}>❌ {p.perdedor}</div>
                    <div style={{ textAlign: 'center' }}>
                      {p.placar
                        ? <span style={{ fontSize: '0.8rem', background: '#f0f4e8', padding: '2px 8px', borderRadius: 8, fontWeight: 700, color: C.darkGreen }}>{p.placar}</span>
                        : <span style={{ color: '#ccc', fontSize: '0.8rem' }}>—</span>}
                    </div>
                    <div style={{ textAlign: 'center', fontSize: '0.75rem', color: C.muted }}>{p.categoria}</div>
                    <div style={{ textAlign: 'center', fontSize: '0.72rem', color: '#aaa' }}>
                      {p.data ? new Date(p.data).toLocaleDateString('pt-BR') : '—'}
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <button onClick={() => handleRemoverPartida(p.id)}
                        style={{ background: 'rgba(224,85,85,.1)', border: 'none', borderRadius: 7, padding: '4px 9px', cursor: 'pointer', fontSize: '0.88rem' }}>🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════
            TAB: TEMPORADAS
        ════════════════════════════════════════════════════ */}
        {tab === 'temporadas' && (
          <div>
            <div style={{ background: 'linear-gradient(135deg,#2e1a3a,#1a0e2e)', borderRadius: 16, padding: '18px 22px', marginBottom: 20, color: C.white, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <span style={{ fontSize: '2rem' }}>📅</span>
              <div>
                <div style={{ fontWeight: 900, fontSize: '1rem', marginBottom: 4 }}>Gestão de Temporadas</div>
                <div style={{ fontSize: '0.82rem', color: '#c8a0d0', lineHeight: 1.6 }}>
                  Cada temporada corresponde a um ano de competição. Ao final, você pode <strong>arquivar</strong> a temporada (preserva o histórico) e recomeçar o ranking zerado para o novo ano.
                </div>
              </div>
            </div>

            {temporadas.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, background: C.white, borderRadius: 18, color: '#aaa' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📅</div>
                <div style={{ fontWeight: 700, color: C.darkGreen, marginBottom: 6 }}>Nenhuma temporada iniciada</div>
                <div style={{ fontSize: '0.84rem' }}>As temporadas são criadas automaticamente ao registrar pontos (torneios ou partidas avulsas).</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {temporadas.map((temp, i) => {
                  const atletasTemp = ranking.filter(p => p.temporada === temp || !p.temporada)
                  const lider = atletasTemp.sort((a, b) => (b.pontos || 0) - (a.pontos || 0))[0]
                  const totalPts = atletasTemp.reduce((s, p) => s + (p.pontos || 0), 0)
                  const isAtual = i === 0
                  return (
                    <div key={temp} style={{ background: C.white, borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,.07)', border: isAtual ? `2px solid ${C.green}` : `1px solid ${C.border}` }}>
                      <div style={{ background: isAtual ? `linear-gradient(135deg,${C.darkGreen},#1a4a2e)` : '#f8fdf5', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: '1.5rem' }}>{isAtual ? '📅' : '📦'}</span>
                          <div>
                            <div style={{ fontWeight: 900, fontSize: '1.1rem', color: isAtual ? C.white : C.darkGreen }}>
                              Temporada {temp}
                              {isAtual && <span style={{ marginLeft: 10, background: 'rgba(143,214,74,.25)', color: C.lightGreen, borderRadius: 20, padding: '2px 12px', fontSize: '0.72rem', fontWeight: 800 }}>● Em curso</span>}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: isAtual ? '#a0c8a0' : C.muted, marginTop: 2 }}>
                              {atletasTemp.length} atleta{atletasTemp.length !== 1 ? 's' : ''} · {totalPts.toLocaleString('pt-BR')} pontos distribuídos
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {lider && (
                            <div style={{ textAlign: 'right', marginRight: 8 }}>
                              <div style={{ fontSize: '0.72rem', color: isAtual ? '#a0c8a0' : C.muted }}>Líder</div>
                              <div style={{ fontWeight: 800, fontSize: '0.9rem', color: isAtual ? C.lightGreen : C.darkGreen }}>👑 {lider.nome}</div>
                            </div>
                          )}
                          {isAtual && (
                            <button onClick={() => setConfirmTemp(temp)}
                              style={{ background: 'rgba(224,85,85,.2)', color: '#ffaaaa', border: '1px solid rgba(224,85,85,.35)', borderRadius: 10, padding: '7px 14px', fontWeight: 700, cursor: 'pointer', fontSize: '0.78rem' }}>
                              📦 Arquivar
                            </button>
                          )}
                        </div>
                      </div>
                      {/* Top 3 da temporada */}
                      <div style={{ padding: '12px 20px', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {atletasTemp.slice(0, 3).map((p, j) => (
                          <div key={j} style={{ background: j === 0 ? 'rgba(201,166,86,.08)' : '#f8fdf5', border: `1px solid ${j === 0 ? 'rgba(201,166,86,.3)' : C.border}`, borderRadius: 10, padding: '8px 14px', minWidth: 140 }}>
                            <div style={{ fontSize: '1rem', marginBottom: 2 }}>{j === 0 ? '🥇' : j === 1 ? '🥈' : '🥉'}</div>
                            <div style={{ fontWeight: 700, color: C.darkGreen, fontSize: '0.84rem' }}>{p.nome}</div>
                            <div style={{ fontWeight: 900, color: j === 0 ? C.gold : C.green, fontSize: '0.88rem' }}>{(p.pontos || 0).toLocaleString('pt-BR')} pts</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Confirmação de arquivar */}
            {confirmTemp && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(14,46,28,.65)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setConfirmTemp(null)}>
                <div style={{ background: C.white, borderRadius: 20, maxWidth: 380, width: '100%', padding: '28px', boxShadow: '0 20px 60px rgba(0,0,0,.28)', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                  <div style={{ fontSize: '3rem', marginBottom: 12 }}>📦</div>
                  <div style={{ fontWeight: 900, color: C.darkGreen, fontSize: '1.1rem', marginBottom: 8 }}>Arquivar temporada {confirmTemp}?</div>
                  <div style={{ color: C.muted, fontSize: '0.85rem', marginBottom: 24, lineHeight: 1.6 }}>
                    O histórico será preservado em <strong>Temporadas Arquivadas</strong>, mas os pontos atuais serão zerados para iniciar uma nova temporada.
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setConfirmTemp(null)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1.5px solid #d0dcc8', background: C.white, cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
                    <button onClick={() => handleArquivarTemporada(confirmTemp)} disabled={saving} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg,${C.green},${C.lightGreen})`, color: C.darkGreen, fontWeight: 800, cursor: saving ? 'wait' : 'pointer' }}>
                      {saving ? '⏳' : '📦 Arquivar'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════
            TAB: CAMPEÕES
        ════════════════════════════════════════════════════ */}
        {tab === 'campeoes' && (
          <div>
            {campeoes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, background: C.white, borderRadius: 18, color: '#aaa' }}>
                <div style={{ fontSize: '3rem', marginBottom: 12 }}>🏆</div>
                <div style={{ fontWeight: 700, color: C.darkGreen, marginBottom: 6 }}>Nenhum campeão registrado</div>
                <div style={{ fontSize: '0.85rem' }}>Os campeões aparecem aqui quando as chaves são finalizadas em Torneios.</div>
              </div>
            ) : (
              <>
                {/* Resumo */}
                <div style={{ background: `linear-gradient(135deg,${C.darkGreen},#1a4a2e)`, borderRadius: 16, padding: '18px 22px', marginBottom: 20, color: C.white, display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ fontSize: '2.5rem' }}>🏆</span>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: '1rem' }}>{campeoes.length} título{campeoes.length !== 1 ? 's' : ''} registrado{campeoes.length !== 1 ? 's' : ''}</div>
                    <div style={{ color: '#a0c8a0', fontSize: '0.82rem' }}>
                      {[...new Set(campeoes.map(c => c.categoria))].length} categoria{[...new Set(campeoes.map(c => c.categoria))].length !== 1 ? 's' : ''} · {[...new Set(campeoes.map(c => c.edicao).filter(Boolean))].length} edição(ões)
                    </div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 14 }}>
                  {campeoes.map((c, i) => (
                    <div key={i} style={{ background: C.white, borderRadius: 18, overflow: 'hidden', boxShadow: '0 3px 16px rgba(0,0,0,.08)', transition: 'transform .15s' }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                      <div style={{ background: 'linear-gradient(135deg,#C9A656,#f0d080)', padding: '20px', textAlign: 'center' }}>
                        <div style={{ fontSize: '2.8rem' }}>🥇</div>
                      </div>
                      <div style={{ padding: '16px', textAlign: 'center' }}>
                        <div style={{ fontWeight: 900, color: C.darkGreen, fontSize: '1rem', marginBottom: 4 }}>{c.nome || c.campeao}</div>
                        <div style={{ fontSize: '0.78rem', color: C.muted, marginBottom: 8 }}>{c.categoria}</div>
                        {c.edicao && (
                          <span style={{ fontSize: '0.72rem', background: C.bg, borderRadius: 20, padding: '4px 12px', display: 'inline-block', color: C.darkGreen, fontWeight: 700, border: `1px solid ${C.border}` }}>
                            📅 {c.edicao}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════
            TAB: TABELA DE PONTOS
        ════════════════════════════════════════════════════ */}
        {tab === 'pontuacao' && (
          <div style={{ background: C.white, borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 14px rgba(0,0,0,.07)' }}>
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontWeight: 900, color: C.darkGreen, fontSize: '1rem' }}>⭐ Tabela de pontuação por fase</h3>
                <p style={{ margin: '4px 0 0', color: C.muted, fontSize: '0.8rem' }}>Pontos atribuídos automaticamente ao finalizar cada chave de torneio.</p>
              </div>
              {!editPontos
                ? <button onClick={startEditPontos} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 16px', cursor: 'pointer', fontWeight: 700, color: C.darkGreen, fontSize: '0.82rem' }}>✏️ Editar pontos</button>
                : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setEditPontos(false)} style={{ background: C.white, border: '1.5px solid #d0dcc8', borderRadius: 10, padding: '8px 14px', cursor: 'pointer', fontWeight: 600, color: '#666', fontSize: '0.82rem' }}>Cancelar</button>
                    <button onClick={savePontos} style={{ background: `linear-gradient(135deg,${C.green},${C.lightGreen})`, border: 'none', borderRadius: 10, padding: '8px 16px', cursor: 'pointer', fontWeight: 800, color: C.darkGreen, fontSize: '0.82rem' }}>✓ Salvar</button>
                  </div>
                )
              }
            </div>
            {(editPontos ? pontosDraft : pontosTbl).map((row, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '56px 1fr auto', padding: '14px 22px', alignItems: 'center', borderBottom: `1px solid ${C.border}`, background: i === 0 ? 'rgba(201,166,86,.05)' : C.white }}>
                <span style={{ fontSize: '1.5rem', textAlign: 'center' }}>{row.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, color: C.darkGreen, fontSize: '0.9rem' }}>{row.fase}</div>
                  <div style={{ fontSize: '0.68rem', color: C.muted, marginTop: 2 }}>key: <code style={{ background: '#f0f4e8', padding: '1px 5px', borderRadius: 4 }}>{row.key}</code></div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {editPontos ? (
                    <input type="number" value={pontosDraft[i].pts} min={1}
                      onChange={e => setPontosDraft(d => d.map((r, j) => j === i ? { ...r, pts: Number(e.target.value) } : r))}
                      style={{ width: 90, padding: '7px 10px', borderRadius: 8, border: `1.5px solid ${C.green}`, fontSize: '0.95rem', fontWeight: 800, textAlign: 'right', outline: 'none' }} />
                  ) : (
                    <span style={{ fontWeight: 900, fontSize: '1.25rem', color: i === 0 ? C.gold : i <= 2 ? C.green : C.muted }}>
                      {fmtN(row.pts)}
                    </span>
                  )}
                  <span style={{ fontSize: '0.7rem', color: C.muted }}>pts</span>
                </div>
              </div>
            ))}
            <div style={{ padding: '14px 22px', background: C.surface }}>
              <div style={{ fontSize: '0.78rem', color: C.muted, lineHeight: 1.7 }}>
                <strong style={{ color: C.darkGreen }}>Como funciona:</strong> Ao finalizar uma chave em{' '}
                <a href="/admin/torneios" style={{ color: C.green, fontWeight: 600 }}>Torneios</a>, o sistema
                chama <code style={{ background: '#e8f0dc', padding: '1px 5px', borderRadius: 4 }}>applyChaveToRanking()</code> e
                atribui os pontos acima com base na fase mais avançada de cada atleta.
                {editPontos && <span style={{ color: C.gold, fontWeight: 700, marginLeft: 8 }}>⚠ Alterações afetam apenas a exibição local — para persistir, integre com o backend.</span>}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════
            TAB: ESTATÍSTICAS
        ════════════════════════════════════════════════════ */}
        {tab === 'stats' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Distribuição por categoria */}
            <div style={{ background: C.white, borderRadius: 18, padding: '20px 22px', boxShadow: '0 2px 14px rgba(0,0,0,.07)' }}>
              <h3 style={{ margin: '0 0 16px', fontWeight: 900, color: C.darkGreen, fontSize: '1rem' }}>📊 Distribuição de atletas por categoria</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {porCategoria.sort((a, b) => b.jogadores.length - a.jogadores.length).map(({ cat, jogadores }, i) => {
                  const pct = totalAtletas > 0 ? Math.round((jogadores.length / totalAtletas) * 100) : 0
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: '0.8rem', color: C.darkGreen, fontWeight: 700, minWidth: 180 }}>{cat}</span>
                      <div style={{ flex: 1, height: 10, background: '#e8f0dc', borderRadius: 8, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg,${C.green},${C.lightGreen})`, borderRadius: 8 }} />
                      </div>
                      <span style={{ fontSize: '0.78rem', color: C.muted, minWidth: 70, textAlign: 'right' }}>
                        {jogadores.length} atletas · {pct}%
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Top 10 pontuadores */}
            <div style={{ background: C.white, borderRadius: 18, padding: '20px 22px', boxShadow: '0 2px 14px rgba(0,0,0,.07)' }}>
              <h3 style={{ margin: '0 0 16px', fontWeight: 900, color: C.darkGreen, fontSize: '1rem' }}>👑 Top 10 pontuadores</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[...ranking].sort((a, b) => (b.pontos || 0) - (a.pontos || 0)).slice(0, 10).map((p, i) => {
                  const maxP = ranking[0]?.pontos || 1
                  const pct = Math.round(((p.pontos || 0) / maxP) * 100)
                  return (
                    <div key={i} onClick={() => setPerfilAtleta(p)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, background: C.surface, cursor: 'pointer', border: `1px solid ${C.border}`, transition: 'background .1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#eaf5e0'}
                      onMouseLeave={e => e.currentTarget.style.background = C.surface}>
                      <span style={{ width: 28, textAlign: 'center' }}><PosBadge pos={i + 1} /></span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, color: C.darkGreen, fontSize: '0.85rem' }}>{p.nome}</div>
                        <div style={{ fontSize: '0.68rem', color: C.muted }}>{p.categoria}</div>
                      </div>
                      <div style={{ width: 100, height: 7, background: '#e0e0e0', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: i === 0 ? C.gold : C.green, borderRadius: 4 }} />
                      </div>
                      <span style={{ fontWeight: 900, color: i === 0 ? C.gold : C.green, fontSize: '0.88rem', minWidth: 60, textAlign: 'right' }}>{fmtN(p.pontos)}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Top aproveitamento (mín 3 jogos) */}
            <div style={{ background: C.white, borderRadius: 18, padding: '20px 22px', boxShadow: '0 2px 14px rgba(0,0,0,.07)' }}>
              <h3 style={{ margin: '0 0 4px', fontWeight: 900, color: C.darkGreen, fontSize: '1rem' }}>🎯 Maior aproveitamento <span style={{ fontWeight: 400, color: C.muted, fontSize: '0.78rem' }}>(mín. 3 jogos)</span></h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
                {[...ranking]
                  .filter(p => (p.vitorias || 0) + (p.derrotas || 0) >= 3)
                  .sort((a, b) => aprv(b) - aprv(a))
                  .slice(0, 8)
                  .map((p, i) => {
                    const pct = aprv(p)
                    const color = pct >= 70 ? C.green : pct >= 50 ? C.gold : C.danger
                    return (
                      <div key={i} onClick={() => setPerfilAtleta(p)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, background: C.surface, cursor: 'pointer', border: `1px solid ${C.border}`, transition: 'background .1s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#eaf5e0'}
                        onMouseLeave={e => e.currentTarget.style.background = C.surface}>
                        <span style={{ width: 28, textAlign: 'center', fontWeight: 800, color: i < 3 ? color : C.muted, fontSize: '0.85rem' }}>#{i + 1}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, color: C.darkGreen, fontSize: '0.85rem' }}>{p.nome}</div>
                          <div style={{ fontSize: '0.68rem', color: C.muted }}>{p.vitorias ?? 0}V · {p.derrotas ?? 0}D · {p.categoria}</div>
                        </div>
                        <Donut pct={pct} size={36} />
                      </div>
                    )
                  })}
                {ranking.filter(p => (p.vitorias || 0) + (p.derrotas || 0) >= 3).length === 0 && (
                  <div style={{ color: C.muted, fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>Nenhum atleta com 3 ou mais jogos ainda.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal de reset */}
        {confirmReset && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(14,46,28,.65)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setConfirmReset(false)}>
            <div style={{ background: C.white, borderRadius: 20, maxWidth: 380, width: '100%', padding: '28px 28px', boxShadow: '0 20px 60px rgba(0,0,0,.28)', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>⚠️</div>
              <div style={{ fontWeight: 900, color: C.darkGreen, fontSize: '1.1rem', marginBottom: 8 }}>Zerar ranking público?</div>
              <div style={{ color: C.muted, fontSize: '0.85rem', marginBottom: 24 }}>
                Esta ação <strong>não pode ser desfeita</strong>. Todos os pontos, vitórias e derrotas serão perdidos permanentemente.
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setConfirmReset(false)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1.5px solid #d0dcc8', background: C.white, cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
                <button onClick={handleReset} disabled={saving} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: C.danger, color: C.white, fontWeight: 800, cursor: saving ? 'wait' : 'pointer' }}>
                  {saving ? '⏳' : '🗑 Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modais globais */}
      {editAtleta   && <EditModal atleta={editAtleta} onSave={handleSaveEdit} onClose={() => setEditAtleta(null)} />}
      {showAdd      && <AddModal categorias={categorias} onSave={handleAddAtleta} onClose={() => setShowAdd(false)} />}
      {showPartida  && <PartidaModal categorias={categorias} onSave={handleRegistrarPartida} onClose={() => setShowPartida(false)} />}
      {perfilAtleta && <AtletaPerfilModal atleta={perfilAtleta} todos={ranking} campeoes={campeoes} onClose={() => setPerfilAtleta(null)} onEdit={a => { setPerfilAtleta(null); setEditAtleta(a) }} onRemover={handleRemover} />}

      <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(-6px) } to { opacity:1; transform:none } }`}</style>
    </div>
  )
}
