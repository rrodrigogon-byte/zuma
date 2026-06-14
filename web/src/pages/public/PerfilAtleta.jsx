import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api } from '../../lib/api'

// ── Paleta ────────────────────────────────────────────────────────────────────
const C = {
  bg:         '#F4F6EF',
  card:       '#fff',
  green:      '#5FB335',
  lime:       '#8FD64A',
  gold:       '#C9A656',
  dark:       '#0E2E1C',
  muted:      '#7a9a7a',
  red:        '#e05555',
  border:     'rgba(95,179,53,0.12)',
  shadow:     '0 4px 20px rgba(0,0,0,0.07)',
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, color, sub }) {
  return (
    <div style={{
      background: C.card, borderRadius: 18, padding: '22px 20px',
      boxShadow: C.shadow, border: `1px solid ${color}22`,
      textAlign: 'center', flex: '1 1 140px', minWidth: 120,
    }}>
      <div style={{ fontSize: '2rem', marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: '0.65rem', fontWeight: 800, color, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: '1.6rem', fontWeight: 900, color: C.dark, lineHeight: 1 }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: '0.75rem', color: C.muted, marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

// ── Resultado badge ───────────────────────────────────────────────────────────
function ResBadge({ res }) {
  const vitoria = res === 'V'
  return (
    <span style={{
      width: 28, height: 28, borderRadius: '50%',
      background: vitoria ? 'rgba(95,179,53,.15)' : 'rgba(224,85,85,.12)',
      color: vitoria ? C.green : C.red,
      border: `1.5px solid ${vitoria ? 'rgba(95,179,53,.4)' : 'rgba(224,85,85,.35)'}`,
      fontWeight: 900, fontSize: 12,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {res}
    </span>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton({ w = '100%', h = 16, r = 8 }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: 'linear-gradient(90deg,#e8f0e8 25%,#d4e8d4 50%,#e8f0e8 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmerLight 1.5s infinite',
    }} />
  )
}

// ── Aviso vazio ───────────────────────────────────────────────────────────────
function Empty({ icon, msg }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 0', color: C.muted }}>
      <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: '0.95rem' }}>{msg}</div>
    </div>
  )
}

// ── Bar de aproveitamento H2H ─────────────────────────────────────────────────
function H2HBar({ v, d }) {
  const total = v + d || 1
  const pct = Math.round((v / total) * 100)
  return (
    <div style={{ height: 6, background: 'rgba(0,0,0,.06)', borderRadius: 3, overflow: 'hidden', flex: 1 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg,${C.green},${C.lime})`, borderRadius: 3, transition: 'width .8s ease' }} />
    </div>
  )
}

// ── Componente Principal ──────────────────────────────────────────────────────
export default function PerfilAtleta() {
  const { nome } = useParams()
  const navigate = useNavigate()

  const [dados, setDados]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro]       = useState(null)
  const [rankingEntry, setRankingEntry] = useState(null)
  const [tabH2H, setTabH2H]   = useState('ranking')  // 'ranking' | 'historico'

  const nomeDecoded = decodeURIComponent(nome || '')

  useEffect(() => {
    if (!nomeDecoded) return
    setLoading(true)
    setErro(null)

    Promise.all([
      api.get(`/api/atleta/${encodeURIComponent(nomeDecoded)}`).catch(() => null),
      api.get('/api/ranking').catch(() => []),
    ]).then(([perfil, ranking]) => {
      if (!perfil || perfil.jogos === 0 && !perfil.nome) {
        setErro('Atleta não encontrado ou sem partidas registradas.')
        setLoading(false)
        return
      }
      setDados(perfil)
      const entry = (Array.isArray(ranking) ? ranking : []).find(r =>
        (r.nome || '').toLowerCase().trim() === nomeDecoded.toLowerCase().trim()
        || (r.nome || '').toLowerCase().includes(nomeDecoded.split(' ')[0].toLowerCase())
      )
      setRankingEntry(entry || null)
      setLoading(false)
    })
  }, [nomeDecoded])

  // ── Loading ──
  if (loading) {
    return (
      <div style={{ background: C.bg, minHeight: '100vh', padding: '40px 24px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Skeleton h={48} r={14} />
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[1,2,3,4].map(i => <Skeleton key={i} w={160} h={100} r={18} />)}
          </div>
          <Skeleton h={220} r={18} />
          <Skeleton h={300} r={18} />
        </div>
        <style>{`
          @keyframes shimmerLight {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
      </div>
    )
  }

  // ── Erro ──
  if (erro) {
    return (
      <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: '3.5rem', marginBottom: 16 }}>🎾</div>
          <h2 style={{ color: C.dark, fontWeight: 900, marginBottom: 8 }}>Atleta não encontrado</h2>
          <p style={{ color: C.muted, marginBottom: 24 }}>{erro}</p>
          <button onClick={() => navigate(-1)} style={{
            background: `linear-gradient(135deg,${C.green},${C.lime})`,
            color: C.dark, border: 'none', borderRadius: 12, padding: '12px 28px',
            fontWeight: 800, cursor: 'pointer',
          }}>← Voltar</button>
        </div>
      </div>
    )
  }

  const { jogos, vitorias, derrotas, aproveitamento, titulos, headToHead, historico, elo } = dados
  const corAproveitamento = aproveitamento >= 60 ? C.green : aproveitamento >= 40 ? C.gold : C.red
  const posRanking = rankingEntry?.posicao || rankingEntry?.pos || null
  const pontosRanking = rankingEntry?.pontos || null
  const movimento = rankingEntry?.movimento ?? 0

  // Iniciais para avatar
  const iniciais = nomeDecoded.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div style={{ background: C.bg, minHeight: '100vh', fontFamily: "'Segoe UI', sans-serif" }}>

      {/* ── HERO ── */}
      <section style={{
        background: 'linear-gradient(160deg, #071a0f 0%, #0E2E1C 40%, #1a4a2e 100%)',
        padding: '56px 24px 72px', position: 'relative', overflow: 'hidden',
      }}>
        {/* bg decorativo */}
        <div style={{ position: 'absolute', top: '10%', right: '5%', fontSize: '10rem', opacity: 0.04, userSelect: 'none' }}>🎾</div>
        <div style={{ position: 'absolute', bottom: '5%', left: '3%', fontSize: '8rem', opacity: 0.04, userSelect: 'none', transform: 'rotate(-20deg)' }}>🎾</div>

        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 28, fontSize: 13 }}>
            <Link to="/" style={{ color: 'rgba(255,255,255,.5)', textDecoration: 'none' }}>Início</Link>
            <span style={{ color: 'rgba(255,255,255,.3)' }}>›</span>
            <Link to="/ranking" style={{ color: 'rgba(255,255,255,.5)', textDecoration: 'none' }}>Ranking</Link>
            <span style={{ color: 'rgba(255,255,255,.3)' }}>›</span>
            <span style={{ color: C.lime }}>{nomeDecoded}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            {/* Avatar */}
            <div style={{
              width: 90, height: 90, borderRadius: '50%', flexShrink: 0,
              background: `linear-gradient(135deg,${C.green},${C.lime})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2.2rem', fontWeight: 900, color: C.dark,
              boxShadow: '0 8px 32px rgba(95,179,53,.35)',
              border: '3px solid rgba(255,255,255,.15)',
            }}>
              {iniciais}
            </div>

            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 'clamp(1.6rem,5vw,2.4rem)', fontWeight: 900, color: '#F4F6EF', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
                {nomeDecoded}
              </h1>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                {posRanking && (
                  <span style={{
                    background: 'rgba(201,166,86,.2)', border: '1px solid rgba(201,166,86,.4)',
                    color: C.gold, borderRadius: 999, padding: '4px 14px',
                    fontSize: 12, fontWeight: 800,
                  }}>
                    🏅 #{posRanking} no ranking
                  </span>
                )}
                {pontosRanking && (
                  <span style={{
                    background: 'rgba(95,179,53,.15)', border: '1px solid rgba(95,179,53,.35)',
                    color: C.lime, borderRadius: 999, padding: '4px 14px',
                    fontSize: 12, fontWeight: 800,
                  }}>
                    ⭐ {pontosRanking} pts
                  </span>
                )}
                {elo && (
                  <span style={{
                    background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)',
                    color: 'rgba(255,255,255,.8)', borderRadius: 999, padding: '4px 14px',
                    fontSize: 12, fontWeight: 700,
                  }}>
                    ELO {Math.round(elo)}
                  </span>
                )}
                {/* Movimento */}
                {movimento !== 0 && (
                  <span style={{
                    background: movimento > 0 ? 'rgba(95,179,53,.15)' : 'rgba(224,85,85,.12)',
                    border: `1px solid ${movimento > 0 ? 'rgba(95,179,53,.4)' : 'rgba(224,85,85,.35)'}`,
                    color: movimento > 0 ? C.lime : C.red,
                    borderRadius: 999, padding: '4px 14px', fontSize: 12, fontWeight: 800,
                  }}>
                    {movimento > 0 ? '▲' : '▼'} {Math.abs(movimento)} posições
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Wave */}
        <svg style={{ position: 'absolute', bottom: 0, left: 0, width: '100%' }} viewBox="0 0 1440 50" preserveAspectRatio="none">
          <path d="M0,50 C360,5 1080,45 1440,15 L1440,50 Z" fill={C.bg} />
        </svg>
      </section>

      {/* ── CONTEÚDO ── */}
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 24px 60px' }}>

        {/* KPIs */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 24 }}>
          <KpiCard icon="🎾" label="Jogos" value={jogos} color={C.green} />
          <KpiCard icon="🏆" label="Vitórias" value={vitorias} color={C.green} />
          <KpiCard icon="📉" label="Derrotas" value={derrotas} color={C.red} />
          <KpiCard icon="📊" label="Aproveitamento" value={`${aproveitamento}%`} color={corAproveitamento} />
          {titulos.length > 0 && <KpiCard icon="🥇" label="Títulos" value={titulos.length} color={C.gold} />}
        </div>

        {/* Barra de aproveitamento */}
        {jogos > 0 && (
          <div style={{
            background: C.card, borderRadius: 16, padding: '18px 22px',
            boxShadow: C.shadow, border: `1px solid ${C.border}`, marginBottom: 24,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.muted }}>Aproveitamento geral — {vitorias}V / {derrotas}D</span>
              <span style={{ fontWeight: 900, fontSize: 18, color: corAproveitamento }}>{aproveitamento}%</span>
            </div>
            <div style={{ height: 10, background: 'rgba(0,0,0,.06)', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${aproveitamento}%`,
                background: `linear-gradient(90deg,${corAproveitamento},${aproveitamento >= 60 ? C.lime : aproveitamento >= 40 ? '#f0d080' : '#f08080'})`,
                borderRadius: 6, transition: 'width .8s ease',
              }} />
            </div>
          </div>
        )}

        {/* Títulos */}
        {titulos.length > 0 && (
          <div style={{ background: C.card, borderRadius: 18, padding: '20px 22px', boxShadow: C.shadow, border: `1px solid rgba(201,166,86,.2)`, marginBottom: 24 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: '0.85rem', fontWeight: 800, color: C.gold, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              🥇 Títulos Conquistados
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {titulos.map((t, i) => (
                <div key={i} style={{
                  background: 'rgba(201,166,86,.08)', border: '1px solid rgba(201,166,86,.25)',
                  borderRadius: 12, padding: '10px 16px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 22, marginBottom: 4 }}>🏆</div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: C.gold }}>{t.categoria || t.edicao || t}</div>
                  {t.ano && <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{t.ano}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabs: Head-to-Head | Histórico */}
        <div style={{ background: C.card, borderRadius: 18, boxShadow: C.shadow, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          {/* Tab bar */}
          <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}` }}>
            {[
              { id: 'ranking', label: '⚔️ Head-to-Head' },
              { id: 'historico', label: '📋 Histórico de Partidas' },
            ].map(tab => (
              <button key={tab.id} onClick={() => setTabH2H(tab.id)} style={{
                flex: 1, padding: '14px 12px',
                background: tabH2H === tab.id ? 'rgba(95,179,53,.06)' : 'transparent',
                border: 'none', borderBottom: `2px solid ${tabH2H === tab.id ? C.green : 'transparent'}`,
                color: tabH2H === tab.id ? C.dark : C.muted,
                fontWeight: tabH2H === tab.id ? 800 : 600,
                fontSize: 13, cursor: 'pointer', transition: 'all .15s',
              }}>
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ padding: '18px 20px' }}>

            {/* H2H */}
            {tabH2H === 'ranking' && (
              <div>
                {headToHead.length === 0 ? (
                  <Empty icon="🤝" msg="Nenhum duelo registrado ainda" />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {headToHead.slice(0, 20).map((h, i) => {
                      const total = h.v + h.d || 1
                      const pct = Math.round(h.v / total * 100)
                      const corH = pct >= 60 ? C.green : pct >= 40 ? C.gold : C.red
                      return (
                        <Link
                          key={i}
                          to={`/atleta/${encodeURIComponent(h.adversario)}`}
                          style={{ textDecoration: 'none' }}
                        >
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                            background: 'rgba(0,0,0,.02)', border: `1px solid rgba(0,0,0,.05)`,
                            borderRadius: 10, transition: 'background .15s',
                            cursor: 'pointer',
                          }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(95,179,53,.05)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,.02)'}
                          >
                            {/* Ranking do adversário */}
                            <div style={{ width: 32, textAlign: 'center', fontSize: 11, fontWeight: 800, color: C.muted, flexShrink: 0 }}>
                              #{i + 1}
                            </div>
                            {/* Avatar mini */}
                            <div style={{
                              width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                              background: `linear-gradient(135deg,${C.green}55,${C.lime}44)`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 11, fontWeight: 800, color: C.dark,
                            }}>
                              {h.adversario.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}
                            </div>
                            {/* Nome + barra */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: 13, color: C.dark, marginBottom: 5 }}>
                                {h.adversario}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <H2HBar v={h.v} d={h.d} />
                                <span style={{ fontSize: 11, color: C.muted, whiteSpace: 'nowrap' }}>
                                  {h.v}V {h.d}D
                                </span>
                              </div>
                            </div>
                            {/* % */}
                            <div style={{ fontWeight: 900, fontSize: 15, color: corH, flexShrink: 0, minWidth: 42, textAlign: 'right' }}>
                              {pct}%
                            </div>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Histórico */}
            {tabH2H === 'historico' && (
              <div>
                {historico.length === 0 ? (
                  <Empty icon="📋" msg="Nenhuma partida no histórico" />
                ) : (
                  <div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(0,0,0,.07)' }}>
                            {['Res.', 'Adversário', 'Placar', 'Categoria', 'Origem'].map(h => (
                              <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: C.muted, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.7 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {historico.slice(0, 30).map((p, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,.015)' }}>
                              <td style={{ padding: '9px 10px' }}>
                                <ResBadge res={p.resultado} />
                              </td>
                              <td style={{ padding: '9px 10px' }}>
                                <Link to={`/atleta/${encodeURIComponent(p.adversario)}`} style={{ color: C.dark, fontWeight: 600, textDecoration: 'none', fontSize: 13 }}
                                  onMouseEnter={e => e.currentTarget.style.color = C.green}
                                  onMouseLeave={e => e.currentTarget.style.color = C.dark}
                                >
                                  {p.adversario}
                                </Link>
                              </td>
                              <td style={{ padding: '9px 10px', color: C.muted, fontFamily: 'monospace', fontSize: 12 }}>{p.placar || '—'}</td>
                              <td style={{ padding: '9px 10px' }}>
                                {p.categoria && (
                                  <span style={{
                                    fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
                                    background: 'rgba(95,179,53,.1)', color: C.green,
                                    border: '1px solid rgba(95,179,53,.25)',
                                  }}>{p.categoria}</span>
                                )}
                              </td>
                              <td style={{ padding: '9px 10px', color: C.muted, fontSize: 11 }}>
                                {p.fonte === 'torneio' ? '🏆 Torneio' : p.fonte === 'liga' ? '🏅 Liga' : p.fonte || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {historico.length > 30 && (
                      <div style={{ textAlign: 'center', marginTop: 14, fontSize: 12, color: C.muted }}>
                        Exibindo 30 de {historico.length} partidas
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Botão voltar */}
        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <button onClick={() => navigate(-1)} style={{
            background: 'transparent', border: `2px solid ${C.border}`,
            color: C.muted, borderRadius: 12, padding: '10px 24px',
            fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all .15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.green; e.currentTarget.style.color = C.green }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted }}
          >
            ← Voltar
          </button>
        </div>
      </div>
    </div>
  )
}
