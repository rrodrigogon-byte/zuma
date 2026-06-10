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

export default function Login() {
  const navigate = useNavigate()
  const { setToken, setSiteToken } = useAuth()
  const { toast } = useToast()

  const [mode, setMode] = useState('painel') // 'painel' | 'atleta'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // painel fields
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')

  // atleta fields
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'painel') {
        const data = await api.post('/api/admin/login', { user, pass })
        setToken(data.token)
        const role = data.role || data.user?.role
        if (role === 'staff') {
          navigate('/pdv')
        } else {
          navigate('/admin')
        }
      } else {
        const data = await api.post('/api/auth/login', { email, senha })
        setSiteToken(data.token)
        navigate('/')
      }
    } catch (err) {
      const msg = err?.message || 'Erro ao fazer login. Verifique os dados.'
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
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
        }}
      >
        {/* Logo area */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '48px', lineHeight: 1, marginBottom: '12px' }}>🎾</div>
          <div
            style={{
              fontSize: '28px',
              fontWeight: '800',
              color: COLORS.green,
              letterSpacing: '-0.5px',
              marginBottom: '4px',
            }}
          >
            SetPoint
          </div>
          <div
            style={{
              fontSize: '13px',
              color: COLORS.gold,
              fontWeight: '500',
              letterSpacing: '0.5px',
            }}
          >
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
          {/* Tabs */}
          <div
            style={{
              display: 'flex',
              background: COLORS.inputBg,
              borderRadius: '10px',
              padding: '4px',
              marginBottom: '28px',
              gap: '2px',
            }}
          >
            <button style={tabStyle(mode === 'painel')} onClick={() => { setMode('painel'); setError('') }}>
              Painel
            </button>
            <button style={tabStyle(mode === 'atleta')} onClick={() => { setMode('atleta'); setError('') }}>
              Atleta
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {mode === 'painel' ? (
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
                    onFocus={(e) => (e.target.style.borderColor = COLORS.green)}
                    onBlur={(e) => (e.target.style.borderColor = COLORS.inputBorder)}
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
                    onFocus={(e) => (e.target.style.borderColor = COLORS.green)}
                    onBlur={(e) => (e.target.style.borderColor = COLORS.inputBorder)}
                  />
                </div>
              </>
            ) : (
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
                    onFocus={(e) => (e.target.style.borderColor = COLORS.green)}
                    onBlur={(e) => (e.target.style.borderColor = COLORS.inputBorder)}
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
                    onFocus={(e) => (e.target.style.borderColor = COLORS.green)}
                    onBlur={(e) => (e.target.style.borderColor = COLORS.inputBorder)}
                  />
                </div>
              </>
            )}

            {/* Error message */}
            {error && (
              <div
                style={{
                  background: 'rgba(220, 60, 60, 0.12)',
                  border: '1px solid rgba(220, 60, 60, 0.35)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  color: '#f87171',
                  fontSize: '13px',
                  lineHeight: '1.5',
                }}
              >
                {error}
              </div>
            )}

            {/* Submit */}
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
                  <span
                    style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#fff',
                      borderRadius: '50%',
                      display: 'inline-block',
                      animation: 'spin 0.7s linear infinite',
                    }}
                  />
                  Entrando…
                </>
              ) : (
                'Entrar'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p
          style={{
            textAlign: 'center',
            color: COLORS.muted,
            fontSize: '12px',
            marginTop: '24px',
            opacity: 0.7,
          }}
        >
          SetPoint · Gestão Esportiva
        </p>
      </div>

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
