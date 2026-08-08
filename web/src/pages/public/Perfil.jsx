import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, fmtDate } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../hooks/useToast'

const C = {
  bg: '#12283F',
  green: '#FF6B2C',
  lime: '#FF9B72',
  cream: '#FFF4EC',
  gold: '#FF6B2C',
  card: '#17354F',
  cardBorder: '#12283F',
  inputBg: '#12283F',
  inputBorder: '#12283F',
  muted: '#8AA9C0',
  red: '#f87171',
}

const inputStyle = {
  width: '100%',
  padding: '11px 14px',
  background: C.inputBg,
  border: `1px solid ${C.inputBorder}`,
  borderRadius: '8px',
  color: C.cream,
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s',
}

const labelStyle = {
  display: 'block',
  color: C.muted,
  fontSize: '11px',
  fontWeight: '600',
  letterSpacing: '0.8px',
  textTransform: 'uppercase',
  marginBottom: '5px',
}

const cardStyle = {
  background: C.card,
  border: `1px solid ${C.cardBorder}`,
  borderRadius: '14px',
  padding: '24px',
  marginBottom: '20px',
}

const sectionTitle = {
  fontSize: '13px',
  fontWeight: '800',
  color: C.muted,
  letterSpacing: '0.8px',
  textTransform: 'uppercase',
  marginBottom: '18px',
  paddingBottom: '10px',
  borderBottom: `1px solid ${C.cardBorder}`,
}

const STATUS_COLORS = {
  confirmado:  { bg: 'rgba(255,107,44,.15)',  color: '#FF6B2C' },
  pendente:    { bg: 'rgba(255,107,44,.15)', color: '#FF6B2C' },
  cancelado:   { bg: 'rgba(248,113,113,.15)', color: '#f87171' },
  pago:        { bg: 'rgba(255,107,44,.15)',  color: '#FF6B2C' },
}

function StatusBadge({ label, type = 'neutral' }) {
  const s = STATUS_COLORS[label?.toLowerCase()] || { bg: 'rgba(122,158,133,.15)', color: C.muted }
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: '20px',
      fontSize: '11px',
      fontWeight: '700',
      letterSpacing: '0.3px',
      background: s.bg,
      color: s.color,
      textTransform: 'capitalize',
    }}>
      {label || '—'}
    </span>
  )
}

export default function Perfil() {
  const navigate = useNavigate()
  const { user, logout, isAtleta } = useAuth()
  const { toast } = useToast()

  const [me, setMe] = useState(null)
  const [inscricoes, setInscricoes] = useState([])
  const [loadingMe, setLoadingMe] = useState(true)
  const [rankingStats, setRankingStats] = useState(null)

  // Edit profile
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [savingPerfil, setSavingPerfil] = useState(false)

  // Change password
  const [senhaAtual, setSenhaAtual] = useState('')
  const [senhaNova, setSenhaNova] = useState('')
  const [senhaConf, setSenhaConf] = useState('')
  const [savingSenha, setSavingSenha] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get('/api/me').catch(() => null),
      api.get('/api/inscricoes/minhas').catch(() => []),
      api.get('/api/me/ranking').catch(() => null),
    ]).then(([meData, insData, rankData]) => {
      if (meData) {
        setMe(meData)
        setNome(meData.nome || '')
        setEmail(meData.email || '')
        setTelefone(meData.telefone || '')
      }
      setInscricoes(Array.isArray(insData) ? insData : insData?.inscricoes || [])
      if (rankData) setRankingStats(rankData)
      setLoadingMe(false)
    })
  }, [])

  const handleSavePerfil = async (e) => {
    e.preventDefault()
    setSavingPerfil(true)
    try {
      await api.patch('/api/auth/perfil', { nome, email, telefone })
      toast('Perfil atualizado!', 'success')
      setMe(prev => ({ ...prev, nome, email, telefone }))
    } catch (err) {
      toast(err.message || 'Erro ao salvar', 'error')
    } finally {
      setSavingPerfil(false)
    }
  }

  const handleSaveSenha = async (e) => {
    e.preventDefault()
    if (senhaNova !== senhaConf) {
      toast('As senhas não coincidem', 'error')
      return
    }
    if (senhaNova.length < 6) {
      toast('A nova senha deve ter ao menos 6 caracteres', 'error')
      return
    }
    setSavingSenha(true)
    try {
      await api.patch('/api/auth/perfil', { senhaAtual, senhaNova })
      toast('Senha alterada com sucesso!', 'success')
      setSenhaAtual('')
      setSenhaNova('')
      setSenhaConf('')
    } catch (err) {
      toast(err.message || 'Erro ao alterar senha', 'error')
    } finally {
      setSavingSenha(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  if (loadingMe) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{
          width: 28, height: 28,
          border: '3px solid rgba(255,107,44,.3)',
          borderTopColor: C.green,
          borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!user && !me) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: C.muted }}>
        <p style={{ marginBottom: 16 }}>Você precisa estar logado para ver seu perfil.</p>
        <Link to="/login" style={{ color: C.green, fontWeight: 700 }}>Entrar</Link>
      </div>
    )
  }

  const displayName = me?.nome || user?.nome || user?.user || 'Atleta'
  const initial = displayName.charAt(0).toUpperCase()
  const memberSince = me?.criadoEm ? new Date(me.criadoEm).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : null
  const roleLabel = { admin: 'Administrador', organizador: 'Organizador', staff: 'Staff', atleta: 'Atleta' }[me?.role || user?.role] || 'Usuário'

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px 40px', fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: C.cream, margin: 0 }}>Meu Perfil</h1>
        <button
          onClick={handleLogout}
          style={{
            padding: '8px 18px',
            background: 'rgba(248,113,113,.12)',
            border: '1px solid rgba(248,113,113,.3)',
            borderRadius: 8,
            color: C.red,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Sair
        </button>
      </div>

      {/* Avatar card */}
      <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{
          width: 70, height: 70, borderRadius: '50%',
          background: `linear-gradient(135deg, ${C.green}, ${C.lime})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 30, fontWeight: 900, color: '#fff',
          flexShrink: 0,
          boxShadow: '0 4px 20px rgba(255,107,44,.35)',
        }}>
          {initial}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.cream, marginBottom: 4 }}>
            {displayName}
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>
            {me?.email || ''}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{
              display: 'inline-block', padding: '3px 12px', borderRadius: 20,
              fontSize: 11, fontWeight: 700, letterSpacing: '0.3px',
              background: 'rgba(255,107,44,.15)', color: C.green,
            }}>
              {roleLabel}
            </span>
            {memberSince && (
              <span style={{ fontSize: 12, color: C.muted, alignSelf: 'center' }}>
                Membro desde {memberSince}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Meu Ranking */}
      {rankingStats && rankingStats.matches && rankingStats.matches.length > 0 && (
        <div style={cardStyle}>
          <div style={sectionTitle}>🏆 Meu Ranking</div>

          {/* KPIs topo */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 20 }}>
            {/* Posição geral */}
            <div style={{
              background: C.inputBg,
              border: `1px solid ${C.cardBorder}`,
              borderRadius: 10,
              padding: '14px 12px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 26, fontWeight: 900, color: C.gold }}>#{rankingStats.posGeral ?? '—'}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Posição Geral</div>
            </div>

            {/* Pontos totais */}
            <div style={{
              background: C.inputBg,
              border: `1px solid ${C.cardBorder}`,
              borderRadius: 10,
              padding: '14px 12px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 26, fontWeight: 900, color: C.green }}>
                {rankingStats.matches.reduce((s, m) => s + (m.pontos || 0), 0)}
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pontos</div>
            </div>

            {/* Torneios jogados */}
            <div style={{
              background: C.inputBg,
              border: `1px solid ${C.cardBorder}`,
              borderRadius: 10,
              padding: '14px 12px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 26, fontWeight: 900, color: C.cream }}>
                {rankingStats.matches.reduce((s, m) => s + (m.torneios || 0), 0)}
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Torneios</div>
            </div>

            {/* Aproveitamento médio */}
            {(() => {
              const avg = rankingStats.matches.length
                ? Math.round(rankingStats.matches.reduce((s, m) => s + (m.aproveitamento || 0), 0) / rankingStats.matches.length)
                : 0
              const aprColor = avg >= 60 ? C.green : avg >= 40 ? C.gold : '#f87171'
              return (
                <div style={{
                  background: C.inputBg,
                  border: `1px solid ${C.cardBorder}`,
                  borderRadius: 10,
                  padding: '14px 12px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 26, fontWeight: 900, color: aprColor }}>{avg}%</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Aprovt. Médio</div>
                </div>
              )
            })()}
          </div>

          {/* Barra de aproveitamento geral */}
          {(() => {
            const vTotal = rankingStats.matches.reduce((s, m) => s + (m.vitorias || 0), 0)
            const dTotal = rankingStats.matches.reduce((s, m) => s + (m.derrotas || 0), 0)
            const total = vTotal + dTotal
            const pct = total > 0 ? Math.round((vTotal / total) * 100) : 0
            const barColor = pct >= 60 ? C.green : pct >= 40 ? C.gold : '#f87171'
            return total > 0 ? (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.muted, marginBottom: 6 }}>
                  <span>Aproveitamento geral · {vTotal}V / {dTotal}D</span>
                  <span style={{ color: barColor, fontWeight: 700 }}>{pct}%</span>
                </div>
                <div style={{ height: 8, background: 'rgba(255,255,255,.08)', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 8, transition: 'width 0.6s ease' }} />
                </div>
              </div>
            ) : null
          })()}

          {/* Categorias */}
          {rankingStats.matches.length > 1 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>Por categoria</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {rankingStats.matches.map((m, i) => {
                  const pct = m.aproveitamento || 0
                  const barColor = pct >= 60 ? C.green : pct >= 40 ? C.gold : '#f87171'
                  return (
                    <div key={i} style={{
                      background: 'rgba(255,255,255,.04)',
                      border: `1px solid ${C.cardBorder}`,
                      borderRadius: 9,
                      padding: '10px 14px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.cream }}>{m.categoria}</span>
                        <div style={{ display: 'flex', gap: 12, fontSize: 12, color: C.muted }}>
                          <span style={{ color: C.gold, fontWeight: 700 }}>{m.pontos} pts</span>
                          <span>{m.vitorias ?? 0}V / {m.derrotas ?? 0}D</span>
                          <span style={{ color: barColor, fontWeight: 700 }}>{pct}%</span>
                        </div>
                      </div>
                      <div style={{ height: 5, background: 'rgba(255,255,255,.08)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 4 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Títulos */}
          {rankingStats.titulos && rankingStats.titulos.length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>🥇 Títulos conquistados</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {rankingStats.titulos.map((t, i) => (
                  <span key={i} style={{
                    padding: '5px 14px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 700,
                    background: 'rgba(255,107,44,.15)',
                    color: C.gold,
                    border: '1px solid rgba(255,107,44,.3)',
                  }}>
                    🏆 {t.categoria || t.edicao || t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Minhas inscrições */}
      <div style={cardStyle}>
        <div style={sectionTitle}>Minhas Inscrições</div>
        {inscricoes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: C.muted, fontSize: 14 }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🎾</div>
            Você ainda não tem inscrições.{' '}
            <Link to="/inscricao" style={{ color: C.green, fontWeight: 700 }}>Inscrever-se</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {inscricoes.map((ins) => (
              <div key={ins.id} style={{
                background: C.inputBg,
                border: `1px solid ${C.cardBorder}`,
                borderRadius: 10,
                padding: '14px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.cream, marginBottom: 3 }}>
                    {ins.categoria || ins.torneio || 'Torneio'}
                  </div>
                  <div style={{ fontSize: 12, color: C.muted }}>
                    {ins.torneioNome || ins.nome || ''}
                    {ins.criadoEm && ` · ${new Date(ins.criadoEm).toLocaleDateString('pt-BR')}`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <StatusBadge label={ins.status} />
                  {ins.pagamento && <StatusBadge label={ins.pagamento} />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Editar perfil */}
      <div style={cardStyle}>
        <div style={sectionTitle}>Editar Perfil</div>
        <form onSubmit={handleSavePerfil} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>Nome completo</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Seu nome"
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = C.green)}
              onBlur={(e) => (e.target.style.borderColor = C.inputBorder)}
            />
          </div>
          <div>
            <label style={labelStyle}>E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = C.green)}
              onBlur={(e) => (e.target.style.borderColor = C.inputBorder)}
            />
          </div>
          <div>
            <label style={labelStyle}>Telefone</label>
            <input
              type="tel"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="(65) 99999-9999"
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = C.green)}
              onBlur={(e) => (e.target.style.borderColor = C.inputBorder)}
            />
          </div>
          <button
            type="submit"
            disabled={savingPerfil}
            style={{
              padding: '11px 24px',
              background: savingPerfil ? '#12283F' : C.green,
              color: '#fff',
              border: 'none',
              borderRadius: 9,
              fontSize: 14,
              fontWeight: 700,
              cursor: savingPerfil ? 'not-allowed' : 'pointer',
              alignSelf: 'flex-start',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'background 0.2s',
            }}
          >
            {savingPerfil ? (
              <>
                <span style={{
                  width: 14, height: 14,
                  border: '2px solid rgba(255,255,255,.3)',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  display: 'inline-block',
                  animation: 'spin 0.7s linear infinite',
                }} />
                Salvando…
              </>
            ) : 'Salvar alterações'}
          </button>
        </form>
      </div>

      {/* Trocar senha */}
      <div style={cardStyle}>
        <div style={sectionTitle}>Trocar Senha</div>
        <form onSubmit={handleSaveSenha} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>Senha atual</label>
            <input
              type="password"
              value={senhaAtual}
              onChange={(e) => setSenhaAtual(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = C.green)}
              onBlur={(e) => (e.target.style.borderColor = C.inputBorder)}
            />
          </div>
          <div>
            <label style={labelStyle}>Nova senha</label>
            <input
              type="password"
              value={senhaNova}
              onChange={(e) => setSenhaNova(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              required
              autoComplete="new-password"
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = C.green)}
              onBlur={(e) => (e.target.style.borderColor = C.inputBorder)}
            />
          </div>
          <div>
            <label style={labelStyle}>Confirmar nova senha</label>
            <input
              type="password"
              value={senhaConf}
              onChange={(e) => setSenhaConf(e.target.value)}
              placeholder="Repita a nova senha"
              required
              autoComplete="new-password"
              style={{
                ...inputStyle,
                borderColor: senhaConf && senhaNova !== senhaConf ? '#f87171' : C.inputBorder,
              }}
              onFocus={(e) => (e.target.style.borderColor = senhaConf && senhaNova !== senhaConf ? '#f87171' : C.green)}
              onBlur={(e) => (e.target.style.borderColor = senhaConf && senhaNova !== senhaConf ? '#f87171' : C.inputBorder)}
            />
            {senhaConf && senhaNova !== senhaConf && (
              <p style={{ color: C.red, fontSize: 12, marginTop: 4 }}>As senhas não coincidem</p>
            )}
          </div>
          <button
            type="submit"
            disabled={savingSenha}
            style={{
              padding: '11px 24px',
              background: savingSenha ? '#12283F' : C.green,
              color: '#fff',
              border: 'none',
              borderRadius: 9,
              fontSize: 14,
              fontWeight: 700,
              cursor: savingSenha ? 'not-allowed' : 'pointer',
              alignSelf: 'flex-start',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'background 0.2s',
            }}
          >
            {savingSenha ? (
              <>
                <span style={{
                  width: 14, height: 14,
                  border: '2px solid rgba(255,255,255,.3)',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  display: 'inline-block',
                  animation: 'spin 0.7s linear infinite',
                }} />
                Salvando…
              </>
            ) : 'Alterar senha'}
          </button>
        </form>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
