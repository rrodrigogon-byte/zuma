import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'

export default function Login() {
  const [user, setUser] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const [aba, setAba] = useState('painel')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [modoRecuperacao, setModoRecuperacao] = useState(false)
  const [emailRecuperacao, setEmailRecuperacao] = useState('')
  const [recuperacaoEnviada, setRecuperacaoEnviada] = useState(false)

  const { login, user: usuarioAtual, isOrg, isStaff } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const proximoSeguro = searchParams.get('next')?.startsWith('/') ? searchParams.get('next') : null

  useEffect(() => {
    if (!usuarioAtual) return
    if (isOrg) navigate(proximoSeguro || '/admin', { replace: true })
    else if (isStaff) navigate(proximoSeguro || '/pdv', { replace: true })
  }, [usuarioAtual, isOrg, isStaff, navigate, proximoSeguro])

  const abrirRecuperacao = () => {
    setEmailRecuperacao(user.includes('@') ? user : '')
    setRecuperacaoEnviada(false)
    setErro('')
    setModoRecuperacao(true)
  }

  const voltarLogin = () => {
    setErro('')
    setRecuperacaoEnviada(false)
    setModoRecuperacao(false)
  }

  const validarRespostaLogin = (data) => {
    if (!data || typeof data !== 'object' || !data.token) {
      const erro = new Error('O servidor não retornou uma sessão válida. Tente novamente.')
      erro.code = 'INVALID_LOGIN_RESPONSE'
      throw erro
    }
    const usuario = data.user && typeof data.user === 'object'
      ? data.user
      : { nome: typeof data.user === 'string' ? data.user : user, role: data.role || '' }
    return { ...data, user: usuario }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErro('')
    setLoading(true)

    try {
      if (modoRecuperacao) {
        await api.post('/api/auth/esqueci-senha', { email: emailRecuperacao })
        setRecuperacaoEnviada(true)
        return
      }
      if (aba === 'painel') {
        const data = validarRespostaLogin(await api.post('/api/admin/login', { user, senha }))
        login(data.token, data.user, false, data.sessao || {})
        if (['org', 'admin', 'organizador', 'gerente'].includes(String(data.user.role || '').toLowerCase())) navigate(proximoSeguro || '/admin', { replace: true })
        else navigate(proximoSeguro || '/pdv', { replace: true })
      } else {
        const data = validarRespostaLogin(await api.post('/api/auth/login', { email: user, senha }))
        login(data.token, data.user, false, data.sessao || {})
        navigate('/meu-painel')
      }
    } catch (err) {
      setErro(err?.message || 'Erro ao processar. Verifique os dados.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: '14px 16px', borderRadius: 12,
    border: '1px solid rgba(18,40,63,0.15)', background: '#fff',
    fontSize: '1rem', color: '#12283F', outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s', boxSizing: 'border-box'
  }

  const labelStyle = { display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#12283F', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }
  const linkStyle = { border: 'none', background: 'transparent', color: '#E4551A', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, textDecoration: 'underline', padding: 0 }
  const focusInput = (e) => { e.target.style.borderColor = '#FF6B2C'; e.target.style.boxShadow = '0 0 0 3px rgba(255,107,44,0.1)' }
  const blurInput = (e) => { e.target.style.borderColor = 'rgba(18,40,63,0.15)'; e.target.style.boxShadow = 'none' }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #FFF4EC 0%, #FFF9F5 100%)', padding: 20, position: 'relative', overflow: 'hidden'
    }}>
      <div style={{ position: 'absolute', top: -200, left: -200, width: 600, height: 600, background: 'radial-gradient(circle, rgba(255,107,44,0.05) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -200, right: -200, width: 800, height: 800, background: 'radial-gradient(circle, rgba(18,40,63,0.03) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />

      <div style={{ textAlign: 'center', marginBottom: 40, position: 'relative', zIndex: 10 }}>
        <img src="/brand/kytto-horizontal.svg" alt="Kytto" style={{ height: 56, marginBottom: 16 }} />
        <div style={{ fontSize: '0.9rem', color: '#5A6570', fontWeight: 600, letterSpacing: '0.02em' }}>Sistemas inteligentes para negócios.</div>
      </div>

      <div style={{ background: '#fff', padding: '40px', borderRadius: 24, boxShadow: '0 24px 48px rgba(18,40,63,0.08), 0 0 0 1px rgba(18,40,63,0.03)', width: '100%', maxWidth: 420, position: 'relative', zIndex: 10, boxSizing: 'border-box' }}>
        {!modoRecuperacao && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 32, background: 'rgba(18,40,63,0.03)', padding: 6, borderRadius: 14 }}>
            <button type="button" onClick={() => setAba('painel')} style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem', background: aba === 'painel' ? '#FF6B2C' : 'transparent', color: aba === 'painel' ? '#fff' : '#5A6570', transition: 'all 0.2s', boxShadow: aba === 'painel' ? '0 4px 12px rgba(255,107,44,0.3)' : 'none' }}>Acesso Plataforma</button>
            <button type="button" onClick={() => setAba('atleta')} style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem', background: aba === 'atleta' ? '#12283F' : 'transparent', color: aba === 'atleta' ? '#fff' : '#5A6570', transition: 'all 0.2s', boxShadow: aba === 'atleta' ? '0 4px 12px rgba(18,40,63,0.2)' : 'none' }}>Portal do Cliente</button>
          </div>
        )}

        {modoRecuperacao ? (
          <>
            <button type="button" onClick={voltarLogin} style={{ ...linkStyle, marginBottom: 22 }}>← Voltar para o login</button>
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ color: '#12283F', fontSize: '1.35rem', margin: '0 0 8px', fontWeight: 800 }}>Recuperar senha</h1>
              <p style={{ color: '#5A6570', fontSize: '0.9rem', lineHeight: 1.55, margin: 0 }}>Enviaremos um link seguro para você criar uma nova senha individual.</p>
            </div>
            {recuperacaoEnviada ? (
              <div role="status" style={{ background: '#FFF4EC', border: '1px solid #FFB48F', color: '#7B3517', borderRadius: 12, padding: 16, lineHeight: 1.55, fontSize: '0.9rem' }}>
                Se o e-mail estiver cadastrado, as instruções chegarão em breve. Verifique também a caixa de spam.
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {erro && <div role="alert" style={{ background: '#FEE2E2', color: '#B91C1C', padding: '12px 16px', borderRadius: 10, fontSize: '0.9rem', fontWeight: 600, border: '1px solid #FCA5A5' }}>{erro}</div>}
                <div>
                  <label style={labelStyle}>E-mail cadastrado</label>
                  <input type="email" value={emailRecuperacao} onChange={e => setEmailRecuperacao(e.target.value)} placeholder="voce@empresa.com" required autoComplete="email" style={inputStyle} onFocus={focusInput} onBlur={blurInput} />
                </div>
                <button type="submit" disabled={loading} style={{ background: '#FF6B2C', color: '#fff', padding: '16px', borderRadius: 12, border: 'none', fontWeight: 800, fontSize: '1.05rem', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, boxShadow: '0 8px 24px rgba(255,107,44,0.25)' }}>{loading ? 'Enviando...' : 'Enviar link'}</button>
              </form>
            )}
          </>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {erro && <div role="alert" style={{ background: '#FEE2E2', color: '#B91C1C', padding: '12px 16px', borderRadius: 10, fontSize: '0.9rem', fontWeight: 600, border: '1px solid #FCA5A5' }}>{erro}</div>}
            <div>
              <label style={labelStyle}>{aba === 'painel' ? 'Usuário ou E-mail' : 'E-mail'}</label>
              <input type={aba === 'painel' ? 'text' : 'email'} value={user} onChange={e => setUser(e.target.value)} placeholder={aba === 'painel' ? 'admin' : 'atleta@email.com'} required autoComplete="username" style={inputStyle} onFocus={focusInput} onBlur={blurInput} />
            </div>
            <div>
              <label style={labelStyle}>Senha</label>
              <div style={{ position: 'relative' }}>
                <input type={mostrarSenha ? 'text' : 'password'} value={senha} onChange={e => setSenha(e.target.value)} placeholder="••••••••" required autoComplete="current-password" style={{ ...inputStyle, paddingRight: 72 }} onFocus={focusInput} onBlur={blurInput} />
                <button type="button" aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={mostrarSenha} onClick={() => setMostrarSenha(value => !value)} style={{ position: 'absolute', right: 10, top: 8, height: 38, minWidth: 44, border: 0, borderRadius: 8, background: 'transparent', color: '#E4551A', cursor: 'pointer', fontSize: 18 }} title={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}>{mostrarSenha ? '◉' : '◌'}</button>
              </div>
              <div style={{ textAlign: 'right', marginTop: 8 }}><button type="button" onClick={abrirRecuperacao} style={linkStyle}>Esqueci minha senha</button></div>
            </div>
            <button type="submit" disabled={loading} style={{ background: '#FF6B2C', color: '#fff', padding: '16px', borderRadius: 12, border: 'none', fontWeight: 800, fontSize: '1.05rem', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: 8, transition: 'background 0.2s, transform 0.2s', boxShadow: '0 8px 24px rgba(255,107,44,0.25)' }} onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = '#e85c22'; e.currentTarget.style.transform = 'translateY(-2px)' } }} onMouseLeave={e => { if (!loading) { e.currentTarget.style.background = '#FF6B2C'; e.currentTarget.style.transform = '' } }}>{loading ? 'Entrando...' : 'Entrar na Plataforma'}</button>
          </form>
        )}
      </div>

      <div style={{ marginTop: 32, fontSize: '0.8rem', color: '#8AA9C0', fontWeight: 600, position: 'relative', zIndex: 10 }}><strong>KYTTO</strong> · Sistemas que fazem o negócio subir</div>
    </div>
  )
}
