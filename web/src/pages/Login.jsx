import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'
import { useToast } from '../hooks/useToast'

const COLORS = {
  bg: '#091a0f',
  green: '#5FB335',
  cream: '#F4F6EF',
  gold: '#C9A656',
  card: '#132b1b',
  cardBorder: '#1e3d28',
  inputBg: '#0e2216',
  inputBorder: '#2a4a35',
  muted: '#7a9e85',
}

// mode: 'painel' | 'atleta' | 'cadastro' | 'esqueci'
export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const { toast } = useToast()

  const [mode, setMode] = useState('painel')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // painel
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')

  // atleta login
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')

  // cadastro
  const [cadNome, setCadNome] = useState('')
  const [cadEmail, setCadEmail] = useState('')
  const [cadSenha, setCadSenha] = useState('')

  // esqueci
  const [esqEmail, setEsqEmail] = useState('')
  const [esqSent, setEsqSent] = useState(false)

  const changeMode = (m) => { setMode(m); setError('') }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'painel') {
        const data = await api.post('/api/admin/login', { user, pass })
        // /api/admin/login devolve { token, user: <nome>, role } — montar objeto com role,
        // senão user.role fica undefined e a sidebar não mostra o menu Admin/Operações.
        login(data.token, { nome: data.user, role: data.role })
        navigate(data.role === 'staff' ? '/pdv' : '/admin')
      } else if (mode === 'atleta') {
        const data = await api.post('/api/auth/login', { email, senha })
        login(data.token, data.user || { email, role: 'atleta' }, true)
        navigate('/meu-painel')
      } else if (mode === 'cadastro') {
        const data = await api.post('/api/auth/registro', { nome: cadNome, email: cadEmail, senha: cadSenha })
        login(data.token, data.user || { nome: cadNome, email: cadEmail, role: 'atleta' }, true)
        toast('Conta criada com sucesso! Bem-vindo(a)! 🎾', 'success')
        navigate('/meu-painel')
      } else if (mode === 'esqueci') {
        await api.post('/api/auth/esqueci-senha', { email: esqEmail }).catch(() => {})
        setEsqSent(true)
      }
    } catch (err) {
      const msg = err?.message || 'Erro ao processar. Verifique os dados.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const tabStyle = (active) => ({
    flex: 1,
    padding: '10px 0',
    background: active ? COLORS.green : 'transparent',
    color: active ? '#fff' : COLORS.muted,
    border: 'none',
    borderRadius: active ? '8px' : '0',
    fontWeight: active ? '700' : '500',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    letterSpacing: '0.3px',
  })

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    background: COLORS.inputBg,
    border: `1px solid ${COLORS.inputBorder}`,
    borderRadius: '8px',
    color: COLORS.cream,
    fontSize: '15px',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  }

  const labelStyle = {
    display: 'block',
    color: COLORS.muted,
    fontSize: '12px',
    fontWeight: '600',
    letterSpacing: '0.8px',
    textTransform: 'uppercase',
    marginBottom: '6px',
  }

  const linkBtn = {
    background: 'none',
    border: 'none',
    color: COLORS.green,
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'underline',
  }

  const onFocus = (e) => (e.target.style.borderColor = COLORS.green)
  const onBlur  = (e) => (e.target.style.borderColor = COLORS.inputBorder)

  const submitLabel = {
    painel: 'Entrar',
    atleta: 'Entrar',
    cadastro: 'Criar conta',
    esqueci: 'Enviar link',
  }[mode]

  const submitLoadingLabel = {
    painel: 'Entrando…',
    atleta: 'Entrando…',
    cadastro: 'Criando…',
    esqueci: 'Enviando…',
  }[mode]

  return (
    <div
      style={{
        minHeight: '100vh',
        background: `radial-gradient(ellipse at 50% 0%, #1a3a22 0%, ${COLORS.bg} 70%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ width: '100%', maxWidth: '400px' }}>
        {/* Logo area */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '48px', lineHeight: 1, marginBottom: '12px' }}>🎾</div>
          <div style={{
            fontSize: '28px', fontWeight: '800', color: COLORS.green,
            letterSpacing: '-0.5px', marginBottom: '4px',
          }}>
            SetPoint
          </div>
          <div style={{
            fontSize: '13px', color: COLORS.gold,
            fontWeight: '500', letterSpacing: '0.5px',
          }}>
            4ª Agro Open de Tênis
          </div>
        </div>

        {/* Card */}
        <div
          style={{
            background: COLORS.card,
            border: `1px solid ${COLORS.cardBorder}`,
            borderRadius: '16px',
            padding: '28px 28px 32px',
            boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
          }}
        >
          {/* Tab switcher — only for painel / atleta */}
          {(mode === 'painel' || mode === 'atleta') && (
            <div style={{
              display: 'flex',
              background: COLORS.inputBg,
              borderRadius: '10px',
              padding: '4px',
              marginBottom: '24px',
              gap: '2px',
            }}>
              <button style={tabStyle(mode === 'painel')} onClick={() => changeMode('painel')}>Painel</button>
              <button style={tabStyle(mode === 'atleta')} onClick={() => changeMode('atleta')}>Atleta</button>
            </div>
          )}

          {/* Section title for sub-modes */}
          {(mode === 'cadastro' || mode === 'esqueci') && (
            <div style={{ marginBottom: '20px' }}>
              <button
                onClick={() => changeMode('atleta')}
                style={{ ...linkBtn, fontSize: '12px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                ← Voltar
              </button>
              <div style={{
                fontSize: '16px', fontWeight: '800', color: COLORS.cream,
              }}>
                {mode === 'cadastro' ? 'Criar conta de atleta' : 'Recuperar senha'}
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

            {/* ── PAINEL ── */}
            {mode === 'painel' && (
              <>
                <div>
                  <label style={labelStyle}>Usuário</label>
                  <input
                    type="text"
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                    placeholder="admin"
                    required
                    autoComplete="username"
                    style={inputStyle}
                    onFocus={onFocus}
                    onBlur={onBlur}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Senha</label>
                  <input
                    type="password"
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    style={inputStyle}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e)}
                  />
                </div>
              </>
            )}

            {/* ── ATLETA LOGIN ── */}
            {mode === 'atleta' && (
              <>
                <div>
                  <label style={labelStyle}>E-mail</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    autoComplete="email"
                    style={inputStyle}
                    onFocus={onFocus}
                    onBlur={onBlur}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Senha</label>
                  <input
                    type="password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    style={inputStyle}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e)}
                  />
                  <div style={{ textAlign: 'right', marginTop: 6 }}>
                    <button type="button" style={linkBtn} onClick={() => changeMode('esqueci')}>
                      Esqueci minha senha
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* ── CADASTRO ── */}
            {mode === 'cadastro' && (
              <>
                <div>
                  <label style={labelStyle}>Nome completo</label>
                  <input
                    type="text"
                    value={cadNome}
                    onChange={(e) => setCadNome(e.target.value)}
                    placeholder="Seu nome"
                    required
                    autoComplete="name"
                    style={inputStyle}
                    onFocus={onFocus}
                    onBlur={onBlur}
                  />
                </div>
                <div>
                  <label style={labelStyle}>E-mail</label>
                  <input
                    type="email"
                    value={cadEmail}
                    onChange={(e) => setCadEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    autoComplete="email"
                    style={inputStyle}
                    onFocus={onFocus}
                    onBlur={onBlur}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Senha</label>
                  <input
                    type="password"
                    value={cadSenha}
                    onChange={(e) => setCadSenha(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    style={inputStyle}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e)}
                  />
                </div>
              </>
            )}

            {/* ── ESQUECI SENHA ── */}
            {mode === 'esqueci' && !esqSent && (
              <div>
                <label style={labelStyle}>E-mail cadastrado</label>
                <input
                  type="email"
                  value={esqEmail}
                  onChange={(e) => setEsqEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  autoComplete="email"
                  style={inputStyle}
                  onFocus={onFocus}
                  onBlur={onBlur}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e)}
                />
                <p style={{ fontSize: 12, color: COLORS.muted, marginTop: 6, lineHeight: 1.5 }}>
                  Enviaremos um link para redefinir sua senha.
                </p>
              </div>
            )}

            {mode === 'esqueci' && esqSent && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{
                  textAlign: 'center', padding: '24px 20px',
                  background: 'rgba(95,179,53,.08)', border: '1px solid rgba(95,179,53,.3)',
                  borderRadius: 12,
                  animation: 'fadeIn 0.4s ease',
                }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📬</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.cream, marginBottom: 8 }}>
                    Link enviado com sucesso!
                  </div>
                  <div style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.6 }}>
                    Verifique sua caixa de entrada em <strong style={{ color: COLORS.cream }}>{esqEmail}</strong> para redefinir sua senha.
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 8, opacity: 0.7 }}>
                    Não recebeu? Cheque também a pasta de spam.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setEsqSent(false); changeMode('atleta') }}
                  style={{
                    width: '100%', padding: '12px',
                    background: 'transparent',
                    color: COLORS.green,
                    border: `1px solid ${COLORS.green}`,
                    borderRadius: '10px', fontSize: '14px',
                    fontWeight: '700', cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.target.style.background = 'rgba(95,179,53,.1)' }}
                  onMouseLeave={e => { e.target.style.background = 'transparent' }}
                >
                  ← Voltar para o login
                </button>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div style={{
                background: 'rgba(220, 60, 60, 0.12)',
                border: '1px solid rgba(220, 60, 60, 0.35)',
                borderRadius: '8px',
                padding: '10px 14px',
                color: '#f87171',
                fontSize: '13px',
                lineHeight: '1.5',
              }}>
                {error}
              </div>
            )}

            {/* Submit button */}
            {!(mode === 'esqueci' && esqSent) && (
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '13px',
                  background: loading ? '#3d7022' : COLORS.green,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '15px',
                  fontWeight: '700',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.3px',
                  transition: 'background 0.2s, transform 0.1s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginTop: '4px',
                }}
                onMouseEnter={(e) => { if (!loading) e.target.style.background = '#4e9a2b' }}
                onMouseLeave={(e) => { if (!loading) e.target.style.background = COLORS.green }}
              >
                {loading ? (
                  <>
                    <span style={{
                      width: '18px', height: '18px',
                      border: '2.5px solid rgba(255,255,255,0.25)',
                      borderTopColor: '#fff',
                      borderRadius: '50%',
                      display: 'inline-block',
                      animation: 'spin 0.65s linear infinite',
                    }} />
                    {submitLoadingLabel}
                  </>
                ) : submitLabel}
              </button>
            )}
          </form>

          {/* Footer links inside card */}
          {mode === 'atleta' && (
            <div style={{
              marginTop: 20, paddingTop: 16,
              borderTop: `1px solid ${COLORS.cardBorder}`,
              textAlign: 'center', fontSize: 13, color: COLORS.muted,
            }}>
              Não tem conta?{' '}
              <button type="button" style={linkBtn} onClick={() => changeMode('cadastro')}>
                Criar conta grátis
              </button>
            </div>
          )}

          {mode === 'cadastro' && (
            <div style={{
              marginTop: 20, paddingTop: 16,
              borderTop: `1px solid ${COLORS.cardBorder}`,
              textAlign: 'center', fontSize: 13, color: COLORS.muted,
            }}>
              Já tem conta?{' '}
              <button type="button" style={linkBtn} onClick={() => changeMode('atleta')}>
                Entrar
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <p style={{
          textAlign: 'center',
          color: COLORS.muted,
          fontSize: '12px',
          marginTop: '24px',
          opacity: 0.7,
        }}>
          SetPoint · Gestão Esportiva
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
