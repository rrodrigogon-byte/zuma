import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, fmtDate, fmtDateOnly } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../hooks/useToast'

const C = {
  bg: '#091a0f',
  green: '#5FB335',
  lime: '#8FD64A',
  cream: '#F4F6EF',
  gold: '#C9A656',
  card: '#132b1b',
  cardBorder: '#1e3d28',
  inputBg: '#0e2216',
  inputBorder: '#2a4a35',
  muted: '#7a9e85',
  red: '#f87171',
  blue: '#60a5fa',
  purple: '#a78bfa',
}

const card = {
  background: C.card,
  border: `1px solid ${C.cardBorder}`,
  borderRadius: 14,
  padding: '20px 24px',
  marginBottom: 18,
}

const sectionTitle = {
  fontSize: 13,
  fontWeight: 800,
  color: C.muted,
  letterSpacing: '0.8px',
  textTransform: 'uppercase',
  marginBottom: 16,
  paddingBottom: 10,
  borderBottom: `1px solid ${C.cardBorder}`,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

const TABS = [
  { id: 'visao',       label: 'Visão Geral',    icon: '🏠' },
  { id: 'jogos',       label: 'Meus Jogos',     icon: '🎾' },
  { id: 'ranking',     label: 'Ranking',        icon: '🏆' },
  { id: 'inscricoes',  label: 'Inscrições',     icon: '📋' },
  { id: 'chaves',      label: 'Minhas Chaves',  icon: '🎯' },
  { id: 'historico',   label: 'Histórico',      icon: '📊' },
  { id: 'perfil',      label: 'Perfil',         icon: '👤' },
]

function Spinner() {
  return (
    <span style={{
      width: 16, height: 16,
      border: '2.5px solid rgba(95,179,53,.3)',
      borderTopColor: C.green,
      borderRadius: '50%',
      display: 'inline-block',
      animation: 'spin 0.7s linear infinite',
    }} />
  )
}

function KpiCard({ label, value, icon, color = C.green, sub }) {
  return (
    <div style={{
      background: C.inputBg,
      border: `1px solid ${C.cardBorder}`,
      borderLeft: `3px solid ${color}`,
      borderRadius: 10,
      padding: '14px 16px',
      flex: 1,
      minWidth: 120,
    }}>
      <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 26, fontWeight: 900, color, lineHeight: 1 }}>{value ?? '—'}</div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function StatusBadge({ status }) {
  const map = {
    confirmado:        { bg: 'rgba(95,179,53,.15)',  color: C.green,  label: 'Confirmado' },
    aprovada:          { bg: 'rgba(95,179,53,.15)',  color: C.green,  label: 'Aprovada' },
    validada:          { bg: 'rgba(95,179,53,.15)',  color: C.green,  label: 'Paga' },
    pendente:          { bg: 'rgba(201,166,86,.15)', color: C.gold,   label: 'Pendente' },
    cancelado:         { bg: 'rgba(248,113,113,.15)',color: C.red,    label: 'Cancelado' },
    cancelada:         { bg: 'rgba(248,113,113,.15)',color: C.red,    label: 'Cancelada' },
    concluido:         { bg: 'rgba(96,165,250,.15)', color: C.blue,   label: 'Concluído' },
    'dupla-confirmado':{ bg: 'rgba(95,179,53,.15)',  color: C.green,  label: '✓ Confirmado' },
    recusada:          { bg: 'rgba(248,113,113,.15)',color: C.red,    label: 'Recusada' },
  }
  const s = map[(status || '').toLowerCase()] || { bg: 'rgba(122,158,133,.15)', color: C.muted, label: status || '—' }
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 10px',
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.3px',
      background: s.bg,
      color: s.color,
    }}>
      {s.label}
    </span>
  )
}

// ─── ABA VISÃO GERAL ─────────────────────────────────────────────────────────
function TabVisao({ me, inscricoes, jogos, ranking, onTabChange }) {
  const proximos = (jogos?.proximos || []).slice(0, 3)
  const posGeral = ranking?.posGeral
  const totalPontos = (ranking?.matches || []).reduce((s, m) => s + (m.pontos || 0), 0)
  const vitorias = (ranking?.matches || []).reduce((s, m) => s + (m.vitorias || 0), 0)
  const derrotas = (ranking?.matches || []).reduce((s, m) => s + (m.derrotas || 0), 0)
  const aprovadas = inscricoes.filter(i => ['aprovada', 'validada', 'confirmado'].includes(i.status)).length

  return (
    <div>
      {/* KPIs */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <KpiCard label="Posição Geral" value={posGeral ? `#${posGeral}` : '—'} icon="🏅" color={C.gold} />
        <KpiCard label="Pontos" value={totalPontos} icon="⭐" color={C.green} />
        <KpiCard label="Vitórias" value={vitorias} icon="🏆" color={C.lime} />
        <KpiCard label="Inscrições" value={aprovadas} icon="📋" color={C.blue} />
      </div>

      {/* Aproveitamento */}
      {(vitorias + derrotas) > 0 && (() => {
        const total = vitorias + derrotas
        const pct = Math.round((vitorias / total) * 100)
        const cor = pct >= 60 ? C.green : pct >= 40 ? C.gold : C.red
        return (
          <div style={{ ...card, padding: '16px 20px', marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>Aproveitamento geral · {vitorias}V / {derrotas}D</span>
              <span style={{ color: cor, fontWeight: 800, fontSize: 16 }}>{pct}%</span>
            </div>
            <div style={{ height: 8, background: 'rgba(255,255,255,.08)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: cor, borderRadius: 8, transition: 'width 0.8s ease' }} />
            </div>
          </div>
        )
      })()}

      {/* Próximos jogos */}
      <div style={card}>
        <div style={sectionTitle}>
          <span>🎾</span> Próximos Jogos
          {proximos.length > 0 && (
            <button onClick={() => onTabChange('jogos')} style={{
              marginLeft: 'auto', fontSize: 12, color: C.green, background: 'none',
              border: 'none', cursor: 'pointer', fontWeight: 700,
            }}>Ver todos →</button>
          )}
        </div>
        {proximos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: C.muted, fontSize: 14 }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📅</div>
            Nenhum jogo agendado no momento.
          </div>
        ) : proximos.map(j => (
          <div key={j.id} style={{
            background: C.inputBg,
            border: `1px solid ${C.cardBorder}`,
            borderLeft: `3px solid ${C.green}`,
            borderRadius: 10,
            padding: '12px 16px',
            marginBottom: 10,
          }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.cream, marginBottom: 4 }}>
              {j.confronto}
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: C.muted, flexWrap: 'wrap' }}>
              {j.data && <span>📅 {new Date(j.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}</span>}
              {j.hora && <span>🕐 {j.hora}</span>}
              {j.quadra && <span>🏟️ {j.quadra}</span>}
              {j.categoria && <span style={{ color: C.gold }}>🎾 {j.categoria}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Inscrições recentes */}
      <div style={card}>
        <div style={sectionTitle}>
          <span>📋</span> Inscrições Recentes
          <button onClick={() => onTabChange('inscricoes')} style={{
            marginLeft: 'auto', fontSize: 12, color: C.green, background: 'none',
            border: 'none', cursor: 'pointer', fontWeight: 700,
          }}>Ver todas →</button>
        </div>
        {inscricoes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '16px 0', color: C.muted, fontSize: 14 }}>
            Nenhuma inscrição ainda.{' '}
            <Link to="/inscricao" style={{ color: C.green, fontWeight: 700 }}>Inscrever-se</Link>
          </div>
        ) : inscricoes.slice(0, 3).map(ins => (
          <div key={ins.id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 0', borderBottom: `1px solid ${C.cardBorder}`,
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.cream }}>{ins.categoria || ins.torneio || 'Torneio'}</div>
              <div style={{ fontSize: 12, color: C.muted }}>{ins.criadoEm ? fmtDateOnly(ins.criadoEm) : ''}</div>
            </div>
            <StatusBadge status={ins.status} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── ABA MEUS JOGOS ───────────────────────────────────────────────────────────
function TabJogos({ jogos, onConfirmar, confirmando }) {
  const proximos = jogos?.proximos || []
  const concluidos = jogos?.concluidos || []
  const [subTab, setSubTab] = useState('proximos')

  return (
    <div>
      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 18, background: C.inputBg, borderRadius: 10, padding: 4 }}>
        {[['proximos', '📅 Próximos', proximos.length], ['concluidos', '✅ Concluídos', concluidos.length]].map(([id, label, cnt]) => (
          <button key={id} onClick={() => setSubTab(id)} style={{
            flex: 1, padding: '9px 0',
            background: subTab === id ? C.green : 'transparent',
            color: subTab === id ? '#fff' : C.muted,
            border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13,
            cursor: 'pointer', transition: 'all 0.15s',
          }}>
            {label} {cnt > 0 && <span style={{
              marginLeft: 4, background: subTab === id ? 'rgba(255,255,255,.2)' : C.cardBorder,
              borderRadius: 10, padding: '0 6px', fontSize: 11,
            }}>{cnt}</span>}
          </button>
        ))}
      </div>

      {subTab === 'proximos' && (
        proximos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: C.muted }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.cream, marginBottom: 8 }}>Nenhum jogo agendado</div>
            <div style={{ fontSize: 14 }}>Aguarde a publicação da ordem de jogo.</div>
          </div>
        ) : proximos.map(j => (
          <div key={j.id} style={{
            ...card,
            borderLeft: `4px solid ${C.green}`,
            marginBottom: 14,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.cream, marginBottom: 6 }}>{j.confronto}</div>
                <div style={{ display: 'flex', gap: 14, fontSize: 12, color: C.muted, flexWrap: 'wrap' }}>
                  {j.data && (
                    <span>📅 {new Date(j.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</span>
                  )}
                  {j.hora && <span>🕐 {j.hora}</span>}
                  {j.quadra && <span>🏟️ {j.quadra}</span>}
                </div>
                {j.fase && <div style={{ marginTop: 6, fontSize: 12, color: C.gold, fontWeight: 600 }}>⚔️ {j.fase}</div>}
                {j.categoria && <div style={{ marginTop: 4, fontSize: 12, color: C.muted }}>🎾 {j.categoria}</div>}
              </div>
              <StatusBadge status={j.status || 'pendente'} />
            </div>
          </div>
        ))
      )}

      {subTab === 'concluidos' && (
        concluidos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: C.muted }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.cream, marginBottom: 8 }}>Nenhum jogo concluído</div>
          </div>
        ) : concluidos.map(j => {
          const confs = j.confirmacaoAtleta || {}
          const jaConfirmei = Object.values(confs).some(c => c.acao === 'confirmar')
          const jaContestei = Object.values(confs).some(c => c.acao === 'contestar')
          return (
            <div key={j.id} style={{
              ...card,
              borderLeft: `4px solid ${j.vencedor ? C.gold : C.cardBorder}`,
              marginBottom: 14,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: C.cream, marginBottom: 4 }}>{j.confronto}</div>
                  <div style={{ display: 'flex', gap: 14, fontSize: 12, color: C.muted, flexWrap: 'wrap' }}>
                    {j.data && <span>📅 {fmtDateOnly(j.data)}</span>}
                    {j.quadra && <span>🏟️ {j.quadra}</span>}
                    {j.categoria && <span>🎾 {j.categoria}</span>}
                  </div>
                </div>
                <StatusBadge status={j.status} />
              </div>
              {(j.placar1 || j.placar2) && (
                <div style={{
                  background: C.inputBg, borderRadius: 8, padding: '8px 14px',
                  marginBottom: 10, fontSize: 14, fontWeight: 700, color: C.cream,
                }}>
                  Placar: {j.placar1 || '—'} × {j.placar2 || '—'}
                  {j.vencedor && <span style={{ marginLeft: 12, color: C.gold }}>🏆 {j.vencedor}</span>}
                </div>
              )}
              {/* Botões de confirmação */}
              {j.status !== 'dupla-confirmado' && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {!jaConfirmei && !jaContestei ? (
                    <>
                      <button
                        onClick={() => onConfirmar(j.id, 'confirmar')}
                        disabled={confirmando === j.id}
                        style={{
                          padding: '7px 16px', background: 'rgba(95,179,53,.15)',
                          border: '1px solid rgba(95,179,53,.3)', borderRadius: 8,
                          color: C.green, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 6,
                        }}
                      >
                        {confirmando === j.id ? <Spinner /> : '✓'} Confirmar resultado
                      </button>
                      <button
                        onClick={() => onConfirmar(j.id, 'contestar')}
                        disabled={confirmando === j.id}
                        style={{
                          padding: '7px 16px', background: 'rgba(248,113,113,.1)',
                          border: '1px solid rgba(248,113,113,.25)', borderRadius: 8,
                          color: C.red, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        }}
                      >
                        ✗ Contestar
                      </button>
                    </>
                  ) : jaConfirmei ? (
                    <span style={{ fontSize: 12, color: C.green, fontWeight: 700 }}>✓ Você confirmou este resultado</span>
                  ) : (
                    <span style={{ fontSize: 12, color: C.red, fontWeight: 700 }}>⚠ Você contestou — aguardando revisão</span>
                  )}
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

// ─── ABA RANKING ─────────────────────────────────────────────────────────────
function TabRanking({ ranking, rankingGlobal, nomAtleta }) {
  const posGeral = ranking?.posGeral
  const totalPontos = (ranking?.matches || []).reduce((s, m) => s + (m.pontos || 0), 0)
  const vitorias = (ranking?.matches || []).reduce((s, m) => s + (m.vitorias || 0), 0)
  const derrotas = (ranking?.matches || []).reduce((s, m) => s + (m.derrotas || 0), 0)
  const titulos = ranking?.titulos || []

  // Top 10 do ranking global para exibir posição relativa
  const top10 = (rankingGlobal || []).slice(0, 10)

  return (
    <div>
      {/* KPIs */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <KpiCard label="Posição Geral" value={posGeral ? `#${posGeral}` : '—'} icon="🏅" color={C.gold} />
        <KpiCard label="Pontos Totais" value={totalPontos} icon="⭐" color={C.green} />
        <KpiCard label="Vitórias" value={vitorias} icon="🏆" color={C.lime} />
        <KpiCard label="Derrotas" value={derrotas} icon="📉" color={C.red} />
      </div>

      {/* Aproveitamento */}
      {(vitorias + derrotas) > 0 && (() => {
        const total = vitorias + derrotas
        const pct = Math.round((vitorias / total) * 100)
        const cor = pct >= 60 ? C.green : pct >= 40 ? C.gold : C.red
        return (
          <div style={{ ...card, padding: '16px 20px', marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>Aproveitamento · {vitorias}V / {derrotas}D</span>
              <span style={{ color: cor, fontWeight: 800, fontSize: 18 }}>{pct}%</span>
            </div>
            <div style={{ height: 10, background: 'rgba(255,255,255,.08)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: cor, borderRadius: 8, transition: 'width 0.8s ease' }} />
            </div>
          </div>
        )
      })()}

      {/* Por categoria */}
      {(ranking?.matches || []).length > 0 && (
        <div style={card}>
          <div style={sectionTitle}><span>🎾</span> Por Categoria</div>
          {ranking.matches.map((m, i) => {
            const pct = m.aproveitamento || 0
            const cor = pct >= 60 ? C.green : pct >= 40 ? C.gold : C.red
            return (
              <div key={i} style={{
                background: C.inputBg,
                border: `1px solid ${C.cardBorder}`,
                borderRadius: 10,
                padding: '12px 16px',
                marginBottom: 10,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.cream }}>{m.categoria}</span>
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, color: C.muted, alignItems: 'center' }}>
                    <span style={{ color: C.gold, fontWeight: 800, fontSize: 15 }}>{m.pontos} pts</span>
                    <span>{m.vitorias ?? 0}V / {m.derrotas ?? 0}D</span>
                    <span style={{ color: cor, fontWeight: 700 }}>{pct}%</span>
                  </div>
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,.06)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: cor, borderRadius: 4 }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Títulos */}
      {titulos.length > 0 && (
        <div style={card}>
          <div style={sectionTitle}><span>🥇</span> Títulos Conquistados</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {titulos.map((t, i) => (
              <div key={i} style={{
                background: 'rgba(201,166,86,.12)',
                border: '1px solid rgba(201,166,86,.3)',
                borderRadius: 12,
                padding: '10px 16px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 24, marginBottom: 4 }}>🏆</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.gold }}>{t.categoria || t.edicao || t}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top 10 do torneio */}
      {top10.length > 0 && (
        <div style={card}>
          <div style={sectionTitle}><span>🏅</span> Top 10 Geral do Torneio</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {top10.map((p, i) => {
              const isMine = (p.nome || '').toLowerCase().includes((nomAtleta || '').split(' ')[0].toLowerCase())
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px',
                  background: isMine ? 'rgba(95,179,53,.1)' : 'rgba(255,255,255,.03)',
                  border: `1px solid ${isMine ? 'rgba(95,179,53,.3)' : C.cardBorder}`,
                  borderRadius: 9,
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: i === 0 ? 'rgba(201,166,86,.2)' : i === 1 ? 'rgba(200,200,200,.15)' : i === 2 ? 'rgba(180,100,40,.15)' : 'rgba(255,255,255,.06)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 800,
                    color: i === 0 ? C.gold : i === 1 ? '#ccc' : i === 2 ? '#cd7f32' : C.muted,
                  }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: isMine ? 800 : 600, color: isMine ? C.green : C.cream }}>
                    {p.nome} {isMine && '← você'}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: C.gold }}>{p.pontos} pts</div>
                </div>
              )
            })}
          </div>
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <Link to="/ranking" style={{ fontSize: 12, color: C.green, fontWeight: 700 }}>Ver ranking completo →</Link>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── ABA INSCRIÇÕES ───────────────────────────────────────────────────────────
function TabInscricoes({ inscricoes }) {
  const [filtro, setFiltro] = useState('todas')
  const filtradas = filtro === 'todas' ? inscricoes : inscricoes.filter(i => i.status === filtro)

  const grupos = {
    aprovada:  inscricoes.filter(i => ['aprovada', 'validada'].includes(i.status)).length,
    pendente:  inscricoes.filter(i => i.status === 'pendente').length,
    cancelada: inscricoes.filter(i => ['cancelada', 'recusada'].includes(i.status)).length,
  }

  return (
    <div>
      {/* KPIs */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <KpiCard label="Confirmadas" value={grupos.aprovada} icon="✅" color={C.green} />
        <KpiCard label="Pendentes" value={grupos.pendente} icon="⏳" color={C.gold} />
        <KpiCard label="Canceladas" value={grupos.cancelada} icon="❌" color={C.red} />
      </div>

      {/* Filtro */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {[['todas', 'Todas'], ['aprovada', 'Aprovadas'], ['pendente', 'Pendentes'], ['cancelada', 'Canceladas']].map(([v, l]) => (
          <button key={v} onClick={() => setFiltro(v)} style={{
            padding: '6px 14px',
            background: filtro === v ? C.green : 'rgba(255,255,255,.06)',
            border: `1px solid ${filtro === v ? C.green : C.cardBorder}`,
            borderRadius: 20, color: filtro === v ? '#fff' : C.muted,
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>
            {l}
          </button>
        ))}
      </div>

      {filtradas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: C.muted }}>
          <div style={{ fontSize: 42, marginBottom: 10 }}>🎾</div>
          <div style={{ marginBottom: 12, fontSize: 15, color: C.cream }}>Nenhuma inscrição encontrada.</div>
          <Link to="/inscricao" style={{
            display: 'inline-block', padding: '10px 24px',
            background: C.green, color: '#fff', borderRadius: 10,
            fontSize: 14, fontWeight: 700, textDecoration: 'none',
          }}>
            Inscrever-se agora
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtradas.map(ins => (
            <div key={ins.id} style={{
              background: C.card,
              border: `1px solid ${C.cardBorder}`,
              borderRadius: 12,
              padding: '16px 18px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 12,
              flexWrap: 'wrap',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.cream, marginBottom: 4 }}>
                  {ins.categoria || ins.torneio || 'Torneio'}
                </div>
                <div style={{ fontSize: 12, color: C.muted, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {ins.nome && <span>👤 {ins.nome}</span>}
                  {ins.criadoEm && <span>📅 {fmtDateOnly(ins.criadoEm)}</span>}
                  {ins.total > 0 && <span>💰 R$ {Number(ins.total).toFixed(2).replace('.', ',')}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexDirection: 'column', alignItems: 'flex-end' }}>
                <StatusBadge status={ins.status} />
                {ins.pagamento && ins.pagamento !== ins.status && <StatusBadge status={ins.pagamento} />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── ABA MINHAS CHAVES ────────────────────────────────────────────────────────
function TabChaves({ chaves }) {
  if (!chaves || chaves.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: C.muted }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>🎯</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.cream, marginBottom: 8 }}>Você não está em nenhuma chave ainda</div>
        <div style={{ fontSize: 14, marginBottom: 20 }}>Aguarde a publicação do sorteio ou inscreva-se em um torneio.</div>
        <Link to="/inscricao" style={{
          display: 'inline-block', padding: '10px 24px',
          background: C.green, color: '#fff', borderRadius: 10,
          fontSize: 14, fontWeight: 700, textDecoration: 'none',
        }}>Inscrever-se</Link>
      </div>
    )
  }

  return (
    <div>
      {chaves.map(({ categoria, size, finalizada, posicao }) => (
        <div key={categoria} style={{ ...card, marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: C.cream }}>{categoria}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
                Chave de {size} jogadores · Posição #{posicao}
              </div>
            </div>
            <StatusBadge status={finalizada ? 'concluido' : 'pendente'} />
          </div>
          <Link
            to={`/bracket?cat=${encodeURIComponent(categoria)}`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '9px 18px',
              background: 'rgba(95,179,53,.1)',
              border: '1px solid rgba(95,179,53,.25)',
              borderRadius: 9, color: C.green,
              fontSize: 13, fontWeight: 700, textDecoration: 'none',
              transition: 'background 0.15s',
            }}
          >
            🎯 Ver chave completa
          </Link>
        </div>
      ))}
    </div>
  )
}

// ─── ABA HISTÓRICO ────────────────────────────────────────────────────────────
function TabHistorico({ historico: hist }) {
  const historico = hist?.historico || []
  const vitorias = hist?.vitorias || 0
  const derrotas = hist?.derrotas || 0
  const [filtro, setFiltro] = useState('todas')

  const filtradas = filtro === 'todas' ? historico
    : filtro === 'v' ? historico.filter(p => p.resultado === 'V')
    : historico.filter(p => p.resultado === 'D')

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <KpiCard label="Vitórias" value={vitorias} icon="🏆" color={C.green} />
        <KpiCard label="Derrotas" value={derrotas} icon="📉" color={C.red} />
        <KpiCard
          label="Aproveitamento"
          value={vitorias + derrotas > 0 ? `${Math.round((vitorias / (vitorias + derrotas)) * 100)}%` : '—'}
          icon="📊"
          color={C.gold}
        />
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[['todas', 'Todas'], ['v', '✅ Vitórias'], ['d', '❌ Derrotas']].map(([v, l]) => (
          <button key={v} onClick={() => setFiltro(v)} style={{
            padding: '6px 14px',
            background: filtro === v ? C.green : 'rgba(255,255,255,.06)',
            border: `1px solid ${filtro === v ? C.green : C.cardBorder}`,
            borderRadius: 20, color: filtro === v ? '#fff' : C.muted,
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>{l}</button>
        ))}
      </div>

      {filtradas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: C.muted }}>
          <div style={{ fontSize: 42, marginBottom: 10 }}>📊</div>
          Nenhuma partida encontrada.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtradas.map((p, i) => (
            <div key={i} style={{
              background: C.card,
              border: `1px solid ${C.cardBorder}`,
              borderLeft: `4px solid ${p.resultado === 'V' ? C.green : C.red}`,
              borderRadius: 10,
              padding: '12px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{
                    fontSize: 13, fontWeight: 800,
                    color: p.resultado === 'V' ? C.green : C.red,
                  }}>{p.resultado === 'V' ? '✅ Vitória' : '❌ Derrota'}</span>
                  <span style={{ fontSize: 13, color: C.cream, fontWeight: 600 }}>vs {p.adversario}</span>
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 12, color: C.muted, flexWrap: 'wrap' }}>
                  {p.categoria && <span>🎾 {p.categoria}</span>}
                  {p.fase && <span>⚔️ {p.fase}</span>}
                  {p.placar && <span style={{ color: C.cream, fontWeight: 700 }}>🏸 {p.placar}</span>}
                  {p.data && <span>📅 {fmtDateOnly(p.data)}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── ABA PERFIL ───────────────────────────────────────────────────────────────
function TabPerfil({ me, onSaved }) {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [nome, setNome] = useState(me?.nome || '')
  const [email, setEmail] = useState(me?.email || '')
  const [telefone, setTelefone] = useState(me?.telefone || '')
  const [senhaAtual, setSenhaAtual] = useState('')
  const [senhaNova, setSenhaNova] = useState('')
  const [senhaConf, setSenhaConf] = useState('')
  const [saving, setSaving] = useState(false)
  const [savingPw, setSavingPw] = useState(false)

  const inputStyle = {
    width: '100%', padding: '11px 14px', background: C.inputBg,
    border: `1px solid ${C.inputBorder}`, borderRadius: 8,
    color: C.cream, fontSize: 14, outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  }
  const labelStyle = {
    display: 'block', color: C.muted, fontSize: 11,
    fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 5,
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.patch('/api/auth/perfil', { nome, email, telefone })
      toast('Perfil atualizado!', 'success')
      onSaved && onSaved({ nome, email, telefone })
    } catch (err) { toast(err.message, 'error') } finally { setSaving(false) }
  }

  const handleSavePw = async (e) => {
    e.preventDefault()
    if (senhaNova !== senhaConf) { toast('As senhas não coincidem', 'error'); return }
    if (senhaNova.length < 6) { toast('Senha mínima: 6 caracteres', 'error'); return }
    setSavingPw(true)
    try {
      await api.patch('/api/auth/perfil', { senhaAtual, senhaNova })
      toast('Senha alterada!', 'success')
      setSenhaAtual(''); setSenhaNova(''); setSenhaConf('')
    } catch (err) { toast(err.message, 'error') } finally { setSavingPw(false) }
  }

  const criadoEm = me?.criadoEm ? new Date(me.criadoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : null

  return (
    <div>
      {/* Avatar */}
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 20, marginBottom: 18 }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: `linear-gradient(135deg, ${C.green}, ${C.lime})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 30, fontWeight: 900, color: '#fff', flexShrink: 0,
          boxShadow: '0 4px 20px rgba(95,179,53,.35)',
        }}>
          {(me?.nome || '?').charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.cream }}>{me?.nome || '—'}</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 3 }}>{me?.email || ''}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <span style={{
              padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
              background: 'rgba(95,179,53,.15)', color: C.green,
            }}>
              🎾 Atleta
            </span>
            {criadoEm && (
              <span style={{ fontSize: 12, color: C.muted, alignSelf: 'center' }}>
                Membro desde {criadoEm}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Editar */}
      <div style={card}>
        <div style={sectionTitle}><span>✏️</span> Editar Dados</div>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label style={labelStyle}>Nome completo</label>
            <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome" style={inputStyle}
              onFocus={e => e.target.style.borderColor = C.green} onBlur={e => e.target.style.borderColor = C.inputBorder} />
          </div>
          <div><label style={labelStyle}>E-mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" style={inputStyle}
              onFocus={e => e.target.style.borderColor = C.green} onBlur={e => e.target.style.borderColor = C.inputBorder} />
          </div>
          <div><label style={labelStyle}>Telefone</label>
            <input type="tel" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(65) 99999-9999" style={inputStyle}
              onFocus={e => e.target.style.borderColor = C.green} onBlur={e => e.target.style.borderColor = C.inputBorder} />
          </div>
          <button type="submit" disabled={saving} style={{
            padding: '11px 24px', background: saving ? '#3d7022' : C.green,
            color: '#fff', border: 'none', borderRadius: 9, fontSize: 14,
            fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
            alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {saving ? <><Spinner /> Salvando…</> : 'Salvar alterações'}
          </button>
        </form>
      </div>

      {/* Senha */}
      <div style={card}>
        <div style={sectionTitle}><span>🔐</span> Trocar Senha</div>
        <form onSubmit={handleSavePw} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            ['Senha atual', senhaAtual, setSenhaAtual, 'current-password'],
            ['Nova senha', senhaNova, setSenhaNova, 'new-password'],
            ['Confirmar nova senha', senhaConf, setSenhaConf, 'new-password'],
          ].map(([label, val, setter, ac]) => (
            <div key={label}><label style={labelStyle}>{label}</label>
              <input type="password" value={val} onChange={e => setter(e.target.value)}
                placeholder="••••••••" autoComplete={ac} style={{
                  ...inputStyle,
                  borderColor: label.includes('Conf') && senhaConf && senhaNova !== senhaConf ? C.red : C.inputBorder,
                }}
                onFocus={e => e.target.style.borderColor = C.green}
                onBlur={e => e.target.style.borderColor = label.includes('Conf') && senhaConf && senhaNova !== senhaConf ? C.red : C.inputBorder}
              />
            </div>
          ))}
          <button type="submit" disabled={savingPw} style={{
            padding: '11px 24px', background: savingPw ? '#3d7022' : C.green,
            color: '#fff', border: 'none', borderRadius: 9, fontSize: 14,
            fontWeight: 700, cursor: savingPw ? 'not-allowed' : 'pointer',
            alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {savingPw ? <><Spinner /> Salvando…</> : 'Alterar senha'}
          </button>
        </form>
      </div>

      {/* Sair */}
      <div style={{ ...card, borderColor: 'rgba(248,113,113,.2)' }}>
        <div style={sectionTitle}><span>🚪</span> Sair da conta</div>
        <p style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
          Você será desconectado e precisará fazer login novamente.
        </p>
        <button onClick={() => { logout(); navigate('/login') }} style={{
          padding: '10px 24px', background: 'rgba(248,113,113,.1)',
          border: '1px solid rgba(248,113,113,.3)', borderRadius: 9,
          color: C.red, fontSize: 14, fontWeight: 700, cursor: 'pointer',
        }}>
          🚪 Sair
        </button>
      </div>
    </div>
  )
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function MeuPainel() {
  const navigate = useNavigate()
  const { user, isAtleta } = useAuth()
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  // Lê o ?tab= da URL; fallback para 'visao'
  const VALID_TABS = ['visao','jogos','ranking','inscricoes','chaves','historico','perfil']
  const tabParam = searchParams.get('tab')
  const [tab, setTabState] = useState(VALID_TABS.includes(tabParam) ? tabParam : 'visao')

  // Sincroniza URL quando a aba muda
  const setTab = (t) => {
    setTabState(t)
    if (t === 'visao') setSearchParams({}, { replace: true })
    else setSearchParams({ tab: t }, { replace: true })
  }
  const [loading, setLoading] = useState(true)
  const [confirmando, setConfirmando] = useState(null)

  // Data
  const [me, setMe] = useState(null)
  const [inscricoes, setInscricoes] = useState([])
  const [jogos, setJogos] = useState({ proximos: [], concluidos: [] })
  const [ranking, setRanking] = useState(null)
  const [rankingGlobal, setRankingGlobal] = useState([])
  const [historico, setHistorico] = useState(null)
  const [chaves, setChaves] = useState([])

  const loadData = useCallback(async () => {
    try {
      const [meData, insData, jogosData, rankData, rankGlobal, histData, chavesData] = await Promise.all([
        api.get('/api/me').catch(() => null),
        api.get('/api/inscricoes/minhas').catch(() => []),
        api.get('/api/me/jogos').catch(() => ({ proximos: [], concluidos: [] })),
        api.get('/api/me/ranking').catch(() => null),
        api.get('/api/ranking').catch(() => []),
        api.get('/api/me/historico').catch(() => null),
        api.get('/api/me/chave').catch(() => []),
      ])
      if (meData) setMe(meData)
      setInscricoes(Array.isArray(insData) ? insData : [])
      setJogos(jogosData || { proximos: [], concluidos: [] })
      setRanking(rankData)
      setRankingGlobal(Array.isArray(rankGlobal) ? rankGlobal : [])
      setHistorico(histData)
      setChaves(Array.isArray(chavesData) ? chavesData : [])
    } catch (err) {
      toast('Erro ao carregar dados', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    loadData()
  }, [user, navigate, loadData])

  const handleConfirmar = async (jogoId, acao) => {
    setConfirmando(jogoId)
    try {
      await api.post(`/api/me/confirmar-resultado/${jogoId}`, { acao })
      toast(acao === 'confirmar' ? 'Resultado confirmado!' : 'Contestação enviada para revisão.', acao === 'confirmar' ? 'success' : 'warning')
      const jogosData = await api.get('/api/me/jogos').catch(() => jogos)
      setJogos(jogosData)
    } catch (err) {
      toast(err.message || 'Erro ao processar', 'error')
    } finally {
      setConfirmando(null)
    }
  }

  // ── Badges de notificação nas tabs
  const badges = {
    jogos: (jogos?.proximos || []).length,
    inscricoes: inscricoes.filter(i => i.status === 'pendente').length,
    chaves: chaves.length,
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '70vh', gap: 16,
      }}>
        <div style={{
          width: 40, height: 40, border: '4px solid rgba(95,179,53,.2)',
          borderTopColor: C.green, borderRadius: '50%', animation: 'spin 0.7s linear infinite',
        }} />
        <span style={{ color: C.muted, fontSize: 14 }}>Carregando seu painel…</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const displayName = me?.nome || user?.nome || 'Atleta'

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '20px 16px 60px', fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      {/* Header hero */}
      <div style={{
        background: `linear-gradient(135deg, #0e2216 0%, #1a3a22 100%)`,
        border: `1px solid ${C.cardBorder}`,
        borderRadius: 16,
        padding: '24px 28px',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        flexWrap: 'wrap',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: `linear-gradient(135deg, ${C.green}, ${C.lime})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, fontWeight: 900, color: '#fff', flexShrink: 0,
          boxShadow: '0 0 24px rgba(95,179,53,.4)',
        }}>
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 4 }}>
            Meu Painel — Portal do Atleta
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: C.cream }}>
            Olá, {displayName.split(' ')[0]}! 🎾
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
            4ª Agro Open de Tênis · SetPoint
          </div>
        </div>
        {/* Pill de posição */}
        {ranking?.posGeral && (
          <div style={{
            background: 'rgba(201,166,86,.15)',
            border: '1px solid rgba(201,166,86,.3)',
            borderRadius: 12, padding: '10px 18px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: C.gold }}>#{ranking.posGeral}</div>
            <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ranking Geral</div>
          </div>
        )}
      </div>

      {/* Tabs — scroll horizontal no mobile */}
      <div style={{
        overflowX: 'auto', display: 'flex', gap: 4,
        background: C.inputBg, borderRadius: 12, padding: 4,
        marginBottom: 24,
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
      }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flexShrink: 0,
              padding: '9px 14px',
              background: tab === t.id ? C.green : 'transparent',
              color: tab === t.id ? '#fff' : C.muted,
              border: 'none', borderRadius: 9,
              fontWeight: 700, fontSize: 13,
              cursor: 'pointer', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: 6,
              position: 'relative',
              whiteSpace: 'nowrap',
            }}
          >
            <span>{t.icon}</span>
            <span style={{ display: window.innerWidth < 480 && tab !== t.id ? 'none' : 'inline' }}>
              {t.label}
            </span>
            {badges[t.id] > 0 && (
              <span style={{
                background: tab === t.id ? 'rgba(255,255,255,.3)' : C.red,
                color: '#fff', borderRadius: 10, fontSize: 10,
                padding: '0 5px', fontWeight: 800, lineHeight: '16px',
              }}>
                {badges[t.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {tab === 'visao' && (
          <TabVisao me={me} inscricoes={inscricoes} jogos={jogos} ranking={ranking} onTabChange={setTab} />
        )}
        {tab === 'jogos' && (
          <TabJogos jogos={jogos} onConfirmar={handleConfirmar} confirmando={confirmando} />
        )}
        {tab === 'ranking' && (
          <TabRanking ranking={ranking} rankingGlobal={rankingGlobal} nomAtleta={me?.nome || ''} />
        )}
        {tab === 'inscricoes' && (
          <TabInscricoes inscricoes={inscricoes} />
        )}
        {tab === 'chaves' && (
          <TabChaves chaves={chaves} />
        )}
        {tab === 'historico' && (
          <TabHistorico historico={historico} />
        )}
        {tab === 'perfil' && (
          <TabPerfil me={me} onSaved={(upd) => setMe(prev => ({ ...prev, ...upd }))} />
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
