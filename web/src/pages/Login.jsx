import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'

export default function Login() {
  const [user, setUser] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const [aba, setAba] = useState('painel') // 'painel' ou 'atleta'

  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErro('')
    setLoading(true)

    try {
      if (aba === 'painel') {
        const data = await api.post('/api/admin/login', { user, senha })
        login(data.token, data.user, false, data.sessao || {})
        if (['org', 'admin', 'organizador', 'gerente'].includes(data.user.role)) navigate('/admin')
        else navigate('/pdv')
      } else {
        const data = await api.post('/api/auth/login', { email: user, senha })
        login(data.token, data.user, false, data.sessao || {})
        navigate('/meu-painel')
      }
    } catch (err) {
      setErro(err?.message || 'Erro ao fazer login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #FFF4EC 0%, #FFF9F5 100%)',
      padding: 20,
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background elements */}
      <div style={{
        position: 'absolute', top: -200, left: -200, width: 600, height: 600,
        background: 'radial-gradient(circle, rgba(255,107,44,0.05) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', bottom: -200, right: -200, width: 800, height: 800,
        background: 'radial-gradient(circle, rgba(18,40,63,0.03) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none'
      }} />

      <div style={{ textAlign: 'center', marginBottom: 40, position: 'relative', zIndex: 10 }}>
        <img
          src="/brand/kytto-horizontal.svg"
          alt="Kytto"
          style={{ height: 56, marginBottom: 16 }}
        />
        <div style={{
          fontSize: '0.9rem',
          color: '#5A6570',
          fontWeight: 600,
          letterSpacing: '0.02em'
        }}>
          Sistemas inteligentes para negócios.
        </div>
      </div>

      <div style={{
        background: '#fff',
        padding: '40px',
        borderRadius: 24,
        boxShadow: '0 24px 48px rgba(18,40,63,0.08), 0 0 0 1px rgba(18,40,63,0.03)',
        width: '100%',
        maxWidth: 420,
        position: 'relative',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 32, background: 'rgba(18,40,63,0.03)', padding: 6, borderRadius: 14 }}>
          <button
            type="button"
            onClick={() => setAba('painel')}
            style={{
              flex: 1, padding: '12px', borderRadius: 10,
              border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem',
              background: aba === 'painel' ? '#FF6B2C' : 'transparent',
              color: aba === 'painel' ? '#fff' : '#5A6570',
              transition: 'all 0.2s',
              boxShadow: aba === 'painel' ? '0 4px 12px rgba(255,107,44,0.3)' : 'none'
            }}
          >
            Acesso Plataforma
          </button>
          <button
            type="button"
            onClick={() => setAba('atleta')}
            style={{
              flex: 1, padding: '12px', borderRadius: 10,
              border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem',
              background: aba === 'atleta' ? '#12283F' : 'transparent',
              color: aba === 'atleta' ? '#fff' : '#5A6570',
              transition: 'all 0.2s',
              boxShadow: aba === 'atleta' ? '0 4px 12px rgba(18,40,63,0.2)' : 'none'
            }}
          >
            Portal do Cliente
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {erro && (
            <div style={{
              background: '#FEE2E2', color: '#B91C1C', padding: '12px 16px',
              borderRadius: 10, fontSize: '0.9rem', fontWeight: 600,
              border: '1px solid #FCA5A5'
            }}>
              {erro}
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#12283F', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {aba === 'painel' ? 'Usuário ou E-mail' : 'E-mail'}
            </label>
            <input
              type={aba === 'painel' ? 'text' : 'email'}
              value={user}
              onChange={e => setUser(e.target.value)}
              placeholder={aba === 'painel' ? 'admin' : 'atleta@email.com'}
              required
              style={{
                width: '100%', padding: '14px 16px', borderRadius: 12,
                border: '1px solid rgba(18,40,63,0.15)', background: '#fff',
                fontSize: '1rem', color: '#12283F', outline: 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s'
              }}
              onFocus={e => { e.target.style.borderColor = '#FF6B2C'; e.target.style.boxShadow = '0 0 0 3px rgba(255,107,44,0.1)' }}
              onBlur={e => { e.target.style.borderColor = 'rgba(18,40,63,0.15)'; e.target.style.boxShadow = 'none' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#12283F', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Senha
            </label>
            <input
              type="password"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: '100%', padding: '14px 16px', borderRadius: 12,
                border: '1px solid rgba(18,40,63,0.15)', background: '#fff',
                fontSize: '1rem', color: '#12283F', outline: 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s'
              }}
              onFocus={e => { e.target.style.borderColor = '#FF6B2C'; e.target.style.boxShadow = '0 0 0 3px rgba(255,107,44,0.1)' }}
              onBlur={e => { e.target.style.borderColor = 'rgba(18,40,63,0.15)'; e.target.style.boxShadow = 'none' }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              background: '#FF6B2C', color: '#fff', padding: '16px',
              borderRadius: 12, border: 'none', fontWeight: 800, fontSize: '1.05rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              marginTop: 8, transition: 'background 0.2s, transform 0.2s',
              boxShadow: '0 8px 24px rgba(255,107,44,0.25)'
            }}
            onMouseEnter={e => { if(!loading) { e.currentTarget.style.background = '#e85c22'; e.currentTarget.style.transform = 'translateY(-2px)' } }}
            onMouseLeave={e => { if(!loading) { e.currentTarget.style.background = '#FF6B2C'; e.currentTarget.style.transform = '' } }}
          >
            {loading ? 'Entrando...' : 'Entrar na Plataforma'}
          </button>
        </form>
      </div>

      <div style={{ marginTop: 32, fontSize: '0.8rem', color: '#8AA9C0', fontWeight: 600, position: 'relative', zIndex: 10 }}>
        <strong>KYTTO</strong> · Sistemas que fazem o negócio subir
      </div>
    </div>
  )
}
