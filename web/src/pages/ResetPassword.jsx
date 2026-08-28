import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

const COLORS = { navy: '#12283F', orange: '#FF6B2C', cream: '#FFF9F5', text: '#344454', muted: '#6C7884', border: 'rgba(18,40,63,0.15)', soft: '#FFF4EC', danger: '#B91C1C' }

function getToken() {
  if (typeof window === 'undefined') return ''
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  return params.get('token') || ''
}

function passwordError(value) {
  if (value.length < 10) return 'Use pelo menos 10 caracteres.'
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/[0-9]/.test(value)) return 'Inclua letras maiúsculas, minúsculas e números.'
  return ''
}

export default function ResetPassword() {
  const navigate = useNavigate()
  const token = useMemo(getToken, [])
  const [validating, setValidating] = useState(true)
  const [valid, setValid] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    if (!token) {
      setValidating(false)
      setError('Este link não contém um token válido.')
      return () => { alive = false }
    }
    api.get(`/api/auth/redefinir-senha/validar?token=${encodeURIComponent(token)}`)
      .then(result => {
        if (!alive) return
        setValid(Boolean(result?.ok))
        if (!result?.ok) setError('Este link é inválido ou já expirou. Solicite uma nova recuperação.')
      })
      .catch(() => { if (alive) setError('Não foi possível validar o link. Solicite uma nova recuperação.') })
      .finally(() => { if (alive) setValidating(false) })
    return () => { alive = false }
  }, [token])

  const submit = async event => {
    event.preventDefault()
    setError('')
    const policy = passwordError(password)
    if (policy) return setError(policy)
    if (password !== confirmation) return setError('As senhas não coincidem.')
    setLoading(true)
    try {
      await api.post('/api/auth/redefinir-senha', { token, novaSenha: password, confirmacao: confirmation })
      setDone(true)
    } catch (err) {
      setError(err?.message || 'Não foi possível alterar a senha. Solicite um novo link.')
      setValid(false)
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '14px 16px', borderRadius: 12, border: `1px solid ${COLORS.border}`, background: '#fff', color: COLORS.navy, fontSize: '1rem', outline: 'none' }
  const fieldLabel = { display: 'block', color: COLORS.navy, fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }
  const focusInput = e => { e.target.style.borderColor = COLORS.orange; e.target.style.boxShadow = '0 0 0 3px rgba(255,107,44,0.1)' }
  const blurInput = e => { e.target.style.borderColor = COLORS.border; e.target.style.boxShadow = 'none' }
  const toggleStyle = { position: 'absolute', right: 10, top: 8, height: 38, minWidth: 44, border: 0, borderRadius: 8, background: 'transparent', color: '#E4551A', cursor: 'pointer', fontSize: 18 }

  return (
    <main style={{ minHeight: '100vh', background: `linear-gradient(135deg, ${COLORS.cream} 0%, #FFF 100%)`, display: 'grid', placeItems: 'center', padding: 20, fontFamily: "'Work Sans', 'Segoe UI', sans-serif" }}>
      <section style={{ width: '100%', maxWidth: 440 }}>
        <header style={{ textAlign: 'center', marginBottom: 28 }}>
          <img src="/brand/kytto-horizontal.svg" alt="Kytto" style={{ height: 54, maxWidth: '100%', marginBottom: 14 }} />
          <div style={{ color: COLORS.text, fontWeight: 600, fontSize: '0.9rem' }}>Recuperação segura de acesso</div>
        </header>
        <div style={{ background: '#fff', border: '1px solid rgba(18,40,63,0.06)', borderRadius: 24, padding: '34px 32px', boxShadow: '0 24px 48px rgba(18,40,63,0.08)' }}>
          {validating && <div style={{ textAlign: 'center', color: COLORS.muted, padding: 28 }}>Validando link…</div>}
          {!validating && done && <div style={{ textAlign: 'center' }}><div style={{ color: COLORS.orange, fontSize: 42, marginBottom: 12 }}>✓</div><h1 style={{ color: COLORS.navy, fontSize: '1.35rem', margin: '0 0 10px' }}>Senha alterada</h1><p style={{ color: COLORS.muted, lineHeight: 1.6, fontSize: '0.9rem' }}>Sua nova senha já está ativa. Entre novamente na plataforma para continuar.</p><button onClick={() => navigate('/login')} style={{ width: '100%', marginTop: 18, padding: 14, border: 0, borderRadius: 12, background: COLORS.orange, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>Ir para o login</button></div>}
          {!validating && !done && valid && <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div><h1 style={{ color: COLORS.navy, fontSize: '1.35rem', margin: 0 }}>Criar nova senha</h1><p style={{ color: COLORS.muted, fontSize: '0.9rem', lineHeight: 1.55, margin: '8px 0 0' }}>Use uma senha individual com pelo menos 10 caracteres, incluindo maiúsculas, minúsculas e números.</p></div>
            <label style={fieldLabel}>Nova senha<div style={{ position: 'relative', marginTop: 8 }}><input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" style={{ ...inputStyle, paddingRight: 72 }} autoFocus onFocus={focusInput} onBlur={blurInput} /><button type="button" aria-label={showPassword ? 'Ocultar nova senha' : 'Mostrar nova senha'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)} style={toggleStyle}>{showPassword ? '◉' : '◌'}</button></div></label>
            <label style={fieldLabel}>Confirmar senha<div style={{ position: 'relative', marginTop: 8 }}><input type={showConfirmation ? 'text' : 'password'} value={confirmation} onChange={e => setConfirmation(e.target.value)} autoComplete="new-password" style={{ ...inputStyle, paddingRight: 72 }} onFocus={focusInput} onBlur={blurInput} /><button type="button" aria-label={showConfirmation ? 'Ocultar confirmação' : 'Mostrar confirmação'} aria-pressed={showConfirmation} onClick={() => setShowConfirmation(value => !value)} style={toggleStyle}>{showConfirmation ? '◉' : '◌'}</button></div></label>
            {error && <div role="alert" style={{ color: COLORS.danger, background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 10, padding: '11px 13px', fontSize: '0.88rem', lineHeight: 1.5 }}>{error}</div>}
            <button type="submit" disabled={loading} style={{ padding: 15, border: 0, borderRadius: 12, background: loading ? '#F4A17C' : COLORS.orange, color: '#fff', fontSize: '1rem', fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', boxShadow: '0 8px 24px rgba(255,107,44,0.22)' }}>{loading ? 'Salvando…' : 'Salvar nova senha'}</button>
          </form>}
          {!validating && !done && !valid && <div style={{ textAlign: 'center' }}><div style={{ color: COLORS.orange, fontSize: 42, marginBottom: 12 }}>⌛</div><h1 style={{ color: COLORS.navy, fontSize: '1.35rem', margin: '0 0 10px' }}>Link indisponível</h1><p role="alert" style={{ color: COLORS.muted, lineHeight: 1.6, fontSize: '0.9rem' }}>{error}</p><button onClick={() => navigate('/login')} style={{ width: '100%', marginTop: 14, padding: 14, border: `1px solid ${COLORS.orange}`, borderRadius: 12, background: 'transparent', color: '#E4551A', fontWeight: 800, cursor: 'pointer' }}>Solicitar novo link</button></div>}
        </div>
      </section>
    </main>
  )
}
