import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

export default function AcceptOperationalInvite() {
  const [token] = useState(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1))
    const value = fragment.get('token') || ''
    window.history.replaceState(null, '', window.location.pathname)
    return /^[a-zA-Z0-9_-]{32,128}$/.test(value) ? value : ''
  })
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [status, setStatus] = useState(token ? 'ready' : 'invalid')
  useEffect(() => {
    document.title = 'Aceitar convite · Kytto'
    const meta = document.querySelector('meta[name="referrer"]') || document.createElement('meta')
    meta.setAttribute('name', 'referrer')
    meta.setAttribute('content', 'no-referrer')
    document.head.appendChild(meta)
  }, [])
  async function accept(event) {
    event.preventDefault()
    if (!token || password.length < 12 || password !== confirmation) return setStatus('invalid-password')
    setStatus('sending')
    try {
      const response = await fetch('/api/auth/operational-invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
      })
      setStatus(response.ok ? 'done' : 'invalid')
    } catch { setStatus('error') }
    finally { setPassword(''); setConfirmation('') }
  }
  return <main style={{ maxWidth: 460, margin: '12vh auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
    <h1>Convite operacional da Dino</h1>
    <p>Crie sua senha para acessar somente a empresa Dino. Não compartilhe o link do convite.</p>
    {status === 'done' ? <p role="status">Senha definida. <Link to="/login">Acessar o painel</Link></p> : <>
      {status === 'invalid' && <p role="alert">Convite inválido, expirado ou já usado. Peça um novo convite ao administrador.</p>}
      {status === 'error' && <p role="alert">Não foi possível concluir agora. Confira a conexão antes de tentar novamente.</p>}
      {status === 'invalid-password' && <p role="alert">Use no mínimo 12 caracteres e confirme a mesma senha.</p>}
      {token && status !== 'invalid' && <form onSubmit={accept}>
        <label htmlFor="operational-password">Nova senha (mínimo de 12 caracteres)</label>
        <input id="operational-password" type="password" autoComplete="new-password" minLength={12} value={password} onChange={event => setPassword(event.target.value)} required style={{ display: 'block', width: '100%', marginBottom: 16 }} />
        <label htmlFor="operational-confirm">Confirme a senha</label>
        <input id="operational-confirm" type="password" autoComplete="new-password" minLength={12} value={confirmation} onChange={event => setConfirmation(event.target.value)} required style={{ display: 'block', width: '100%', marginBottom: 16 }} />
        <button type="submit" disabled={status === 'sending'}>{status === 'sending' ? 'Concluindo...' : 'Definir senha e aceitar'}</button>
      </form>}
    </>}
  </main>
}
