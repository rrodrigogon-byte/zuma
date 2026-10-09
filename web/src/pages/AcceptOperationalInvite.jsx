import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

export default function AcceptOperationalInvite() {
  const [token] = useState(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1))
    const value = fragment.get('token') || ''
    return /^[a-zA-Z0-9_-]{32,128}$/.test(value) ? value : ''
  })
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [status, setStatus] = useState(token ? 'ready' : 'invalid')
  const submitting = useRef(false)
  useEffect(() => {
    // O initializer deve ser puro: StrictMode o executa duas vezes. Limpar
    // somente após o estado reter o token evita invalidar o link no segundo mount.
    const fragment = new URLSearchParams(window.location.hash.slice(1))
    fragment.delete('token')
    const cleanHash = fragment.toString()
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${cleanHash ? `#${cleanHash}` : ''}`)
    document.title = 'Aceitar convite · Kytto'
    const meta = document.querySelector('meta[name="referrer"]') || document.createElement('meta')
    meta.setAttribute('name', 'referrer')
    meta.setAttribute('content', 'no-referrer')
    document.head.appendChild(meta)
  }, [])
  async function accept(event) {
    event.preventDefault()
    if (submitting.current) return
    if (!token || password.length < 12 || password.length > 128 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9\s]/.test(password) || password !== confirmation) return setStatus('invalid-password')
    submitting.current = true
    setStatus('sending')
    try {
      const response = await fetch('/api/auth/operational-invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
      })
      const result = response.ok ? {} : await response.json().catch(() => ({}))
      setStatus(response.ok ? 'done' : result.code === 'INVALID_PASSWORD' ? 'invalid-password' : response.status === 429 || response.status >= 500 ? 'error' : 'invalid')
    } catch { setStatus('error') }
    finally { submitting.current = false; setPassword(''); setConfirmation('') }
  }
  return <main style={{ maxWidth: 460, margin: '12vh auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
    <h1>Aceitar convite</h1>
    <p>Crie sua senha para acessar a empresa indicada no convite. Não compartilhe o link pessoal.</p>
    {status === 'done' ? <p role="status">Senha definida. <Link to="/login">Acessar o painel</Link></p> : <>
      {status === 'invalid' && <p role="alert">Convite inválido, expirado ou já usado. Peça um novo convite ao administrador.</p>}
      {status === 'error' && <p role="alert">Não foi possível concluir agora. Confira a conexão antes de tentar novamente.</p>}
      {status === 'invalid-password' && <p role="alert">Use de 12 a 128 caracteres com maiúscula, minúscula, número e símbolo; confirme a mesma senha.</p>}
      {token && status !== 'invalid' && <form onSubmit={accept}>
        <label htmlFor="operational-password">Nova senha (12 a 128 caracteres, com maiúscula, minúscula, número e símbolo)</label>
        <input id="operational-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} disabled={status === 'sending'} value={password} onChange={event => setPassword(event.target.value)} required style={{ display: 'block', width: '100%', marginBottom: 16 }} />
        <label htmlFor="operational-confirm">Confirme a senha</label>
        <input id="operational-confirm" type="password" autoComplete="new-password" minLength={12} maxLength={128} disabled={status === 'sending'} value={confirmation} onChange={event => setConfirmation(event.target.value)} required style={{ display: 'block', width: '100%', marginBottom: 16 }} />
        <button type="submit" disabled={status === 'sending'}>{status === 'sending' ? 'Concluindo...' : 'Definir senha e aceitar'}</button>
      </form>}
    </>}
  </main>
}
