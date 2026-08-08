import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'
import { useToast } from '../hooks/useToast'

const COLORS = {
  sand: '#FFF4EC',
  orange: '#FF6B2C',
  orangeDark: '#E4551A',
  navy: '#12283F',
  graphite: '#5A6570',
  line: '#EADFD4',
  white: '#FFFFFF',
  success: '#12B76A',
  danger: '#F03D2E',
}

// mode: 'painel' | 'atleta' | 'cadastro' | 'esqueci'
export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const { toast } = useToast()

  const [mode, setMode] = useState('painel')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [cadNome, setCadNome] = useState('')
  const [cadEmail, setCadEmail] = useState('')
  const [cadSenha, setCadSenha] = useState('')
  const [esqEmail, setEsqEmail] = useState('')
  const [esqSent, setEsqSent] = useState(false)

  const changeMode = (nextMode) => {
    setMode(nextMode)
    setError('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'painel') {
        const data = await api.post('/api/admin/login', { user, pass })
        login(data.token, { nome: data.user, role: data.role })
        navigate(data.role === 'staff' ? '/pdv' : '/admin')
      } else if (mode === 'atleta') {
        const data = await api.post('/api/auth/login', { email, senha })
        login(data.token, data.user || { email, role: 'atleta' }, true)
        navigate('/meu-painel')
      } else if (mode === 'cadastro') {
        const data = await api.post('/api/auth/registro', { nome: cadNome, email: cadEmail, senha: cadSenha })
        login(data.token, data.user || { nome: cadNome, email: cadEmail, role: 'atleta' }, true)
        toast('Conta criada com sucesso. Bem-vindo(a) à Kytto!', 'success')
        navigate('/meu-painel')
      } else if (mode === 'esqueci') {
        await api.post('/api/auth/esqueci-senha', { email: esqEmail }).catch(() => {})
        setEsqSent(true)
      }
    } catch (err) {
      setError(err?.message || 'Erro ao processar. Verifique os dados.')
    } finally {
      setLoading(false)
    }
  }

  const tabStyle = (active) => ({
    flex: 1,
    padding: '10px 0',
    background: active ? COLORS.orange : 'transparent',
    color: active ? '#fff' : COLORS.graphite,
    border: 'none',
    borderRadius: active ? '8px' : '0',
    fontFamily: "'Outfit', 'Work Sans', sans-serif",
    fontWeight: active ? '700' : '600',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all .2s ease',
  })

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    background: COLORS.white,
    border: `1px solid ${COLORS.line}`,
    borderRadius: '10px',
    color: COLORS.navy,
    fontFamily: "'Work Sans', sans-serif",
    fontSize: '15px',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color .2s, box-shadow .2s',
  }

  const labelStyle = {
    display: 'block',
    color: COLORS.graphite,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '11px',
    fontWeight: '700',
    letterSpacing: '.08em',
    textTransform: 'uppercase',
    marginBottom: '7px',
  }

  const linkBtn = {
    background: 'none',
    border: 'none',
    color: COLORS.orangeDark,
    fontFamily: "'Work Sans', sans-serif",
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'underline',
  }

  const onFocus = (event) => {
    event.target.style.borderColor = COLORS.orange
    event.target.style.boxShadow = '0 0 0 3px rgba(255,107,44,.14)'
  }
  const onBlur = (event) => {
    event.target.style.borderColor = COLORS.line
    event.target.style.boxShadow = 'none'
  }

  const submitLabel = { painel: 'Entrar', atleta: 'Entrar', cadastro: 'Criar conta', esqueci: 'Enviar link' }[mode]
  const submitLoadingLabel = { painel: 'Entrando…', atleta: 'Entrando…', cadastro: 'Criando…', esqueci: 'Enviando…' }[mode]

  return (
    <div style={{
      minHeight: '100vh',
      background: `radial-gradient(ellipse at 50% -10%, #FFE4D5 0%, ${COLORS.sand} 50%, #F8EEE7 100%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '40px 16px', fontFamily: "'Work Sans', 'Segoe UI', sans-serif",
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img src="/brand/kytto-horizontal.svg" alt="Kytto" style={{ width: 210, maxWidth: '80%', height: 'auto', display: 'inline-block' }} />
          <div style={{
            color: COLORS.orange, fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
            fontWeight: 700, letterSpacing: '.13em', textTransform: 'uppercase', marginTop: 12,
          }}>
            Kytto Clube
          </div>
          <p style={{ color: COLORS.graphite, marginTop: 8, fontSize: 13, lineHeight: 1.5 }}>
            Gestão para clubes, eventos e operações.
          </p>
        </div>

        <div style={{
          background: COLORS.white, border: `1px solid ${COLORS.line}`,
          borderRadius: 18, padding: '28px 28px 30px',
          boxShadow: '0 20px 54px rgba(18,40,63,.11)',
        }}>
          {(mode === 'painel' || mode === 'atleta') && (
            <div style={{ display: 'flex', background: '#FFF9F5', border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: 4, marginBottom: 24, gap: 2 }}>
              <button type="button" style={tabStyle(mode === 'painel')} onClick={() => changeMode('painel')}>Painel</button>
              <button type="button" style={tabStyle(mode === 'atleta')} onClick={() => changeMode('atleta')}>Atleta</button>
            </div>
          )}

          {(mode === 'cadastro' || mode === 'esqueci') && (
            <div style={{ marginBottom: 22 }}>
              <button type="button" onClick={() => changeMode('atleta')} style={{ ...linkBtn, fontSize: 12, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 4 }}>
                ← Voltar
              </button>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, fontWeight: 800, color: COLORS.navy }}>
                {mode === 'cadastro' ? 'Criar conta de atleta' : 'Recuperar senha'}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {mode === 'painel' && <>
              <div>
                <label style={labelStyle}>Usuário</label>
                <input type="text" value={user} onChange={(e) => setUser(e.target.value)} placeholder="admin" required autoComplete="username" style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
              </div>
              <div>
                <label style={labelStyle}>Senha</label>
                <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="••••••••" required autoComplete="current-password" style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
              </div>
            </>}

            {mode === 'atleta' && <>
              <div>
                <label style={labelStyle}>E-mail</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required autoComplete="email" style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
              </div>
              <div>
                <label style={labelStyle}>Senha</label>
                <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••••" required autoComplete="current-password" style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                <div style={{ textAlign: 'right', marginTop: 8 }}>
                  <button type="button" style={linkBtn} onClick={() => changeMode('esqueci')}>Esqueci minha senha</button>
                </div>
              </div>
            </>}

            {mode === 'cadastro' && <>
              <div>
                <label style={labelStyle}>Nome completo</label>
                <input type="text" value={cadNome} onChange={(e) => setCadNome(e.target.value)} placeholder="Seu nome" required autoComplete="name" style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
              </div>
              <div>
                <label style={labelStyle}>E-mail</label>
                <input type="email" value={cadEmail} onChange={(e) => setCadEmail(e.target.value)} placeholder="seu@email.com" required autoComplete="email" style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
              </div>
              <div>
                <label style={labelStyle}>Senha</label>
                <input type="password" value={cadSenha} onChange={(e) => setCadSenha(e.target.value)} placeholder="Mínimo 6 caracteres" required minLength={6} autoComplete="new-password" style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
              </div>
            </>}

            {mode === 'esqueci' && !esqSent && <div>
              <label style={labelStyle}>E-mail cadastrado</label>
              <input type="email" value={esqEmail} onChange={(e) => setEsqEmail(e.target.value)} placeholder="seu@email.com" required autoComplete="email" style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
              <p style={{ fontSize: 12, color: COLORS.graphite, marginTop: 8, lineHeight: 1.5 }}>Enviaremos um link para redefinir sua senha.</p>
            </div>}

            {mode === 'esqueci' && esqSent && <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ textAlign: 'center', padding: '24px 20px', background: 'rgba(18,183,106,.08)', border: '1px solid rgba(18,183,106,.28)', borderRadius: 12 }}>
                <div style={{ fontSize: 34, marginBottom: 12 }}>✉️</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 800, color: COLORS.navy, marginBottom: 8 }}>Link enviado com sucesso!</div>
                <div style={{ fontSize: 13, color: COLORS.graphite, lineHeight: 1.6 }}>Verifique sua caixa de entrada em <strong style={{ color: COLORS.navy }}>{esqEmail}</strong> para redefinir sua senha.</div>
                <div style={{ fontSize: 12, color: COLORS.graphite, marginTop: 8, opacity: .76 }}>Não recebeu? Cheque também a pasta de spam.</div>
              </div>
              <button type="button" onClick={() => { setEsqSent(false); changeMode('atleta') }} style={{ width: '100%', padding: 12, background: 'transparent', color: COLORS.orangeDark, border: `1px solid ${COLORS.orange}`, borderRadius: 10, fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                ← Voltar para o login
              </button>
            </div>}

            {error && <div style={{ background: 'rgba(240,61,46,.08)', border: '1px solid rgba(240,61,46,.28)', borderRadius: 10, padding: '10px 14px', color: '#BD2D23', fontSize: 13, lineHeight: 1.5 }}>{error}</div>}

            {!(mode === 'esqueci' && esqSent) && <button type="submit" disabled={loading} style={{
              width: '100%', padding: 13, background: loading ? '#F59A70' : COLORS.orange, color: '#fff', border: 'none', borderRadius: 10,
              fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background .2s, transform .1s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4,
            }} onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = COLORS.orangeDark }} onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = COLORS.orange }}>
              {loading && <span style={{ width: 18, height: 18, border: '2.5px solid rgba(255,255,255,.25)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin .65s linear infinite' }} />}
              {loading ? submitLoadingLabel : submitLabel}
            </button>}
          </form>

          {mode === 'atleta' && <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${COLORS.line}`, textAlign: 'center', fontSize: 13, color: COLORS.graphite }}>
            Não tem conta? <button type="button" style={linkBtn} onClick={() => changeMode('cadastro')}>Criar conta grátis</button>
          </div>}
          {mode === 'cadastro' && <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${COLORS.line}`, textAlign: 'center', fontSize: 13, color: COLORS.graphite }}>
            Já tem conta? <button type="button" style={linkBtn} onClick={() => changeMode('atleta')}>Entrar</button>
          </div>}
        </div>

        <p style={{ textAlign: 'center', color: COLORS.graphite, fontSize: 12, marginTop: 22 }}>
          <strong style={{ color: COLORS.navy }}>KYTTO</strong> · Sistemas que fazem o negócio subir
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
