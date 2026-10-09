import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import './AcceptOperationalInvite.css'

const passwordRules = [
  { id: 'length', label: 'Ao menos 12 caracteres · até 72 bytes', test: value => value.length >= 12 && new TextEncoder().encode(value).length <= 72 },
  { id: 'lowercase', label: 'Uma letra minúscula', test: value => /[a-z]/.test(value) },
  { id: 'uppercase', label: 'Uma letra maiúscula', test: value => /[A-Z]/.test(value) },
  { id: 'number', label: 'Um número', test: value => /[0-9]/.test(value) },
  { id: 'symbol', label: 'Um símbolo', test: value => /[^A-Za-z0-9\s]/.test(value) },
]

function Icon({ children, className = '' }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
}

function ShieldIcon() {
  return <Icon><path d="M12 3 5 6v5c0 4.6 2.9 8.7 7 10 4.1-1.3 7-5.4 7-10V6l-7-3Z" /><path d="m9.2 12 1.8 1.8 3.9-4" /></Icon>
}

function EyeIcon({ hidden }) {
  return hidden
    ? <Icon><path d="m3 3 18 18" /><path d="M10.6 10.7a2 2 0 0 0 2.7 2.7" /><path d="M9.9 4.2A10.9 10.9 0 0 1 12 4c5.5 0 9.4 5.1 10 8-.2 1-.8 2.4-1.8 3.7" /><path d="M6.2 6.2C4.3 7.6 2.7 9.8 2 12c.6 2.9 4.5 8 10 8 1.5 0 2.8-.4 4-1" /></Icon>
    : <Icon><path d="M2 12s3.6-8 10-8 10 8 10 8-3.6 8-10 8S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></Icon>
}

function CheckIcon() {
  return <Icon><path d="m5 12 4.2 4.2L19 6.5" /></Icon>
}

export default function AcceptOperationalInvite() {
  const [token] = useState(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1))
    const value = fragment.get('token') || ''
    return /^[a-zA-Z0-9_-]{32,128}$/.test(value) ? value : ''
  })
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [status, setStatus] = useState(token ? 'ready' : 'invalid')
  const submitting = useRef(false)
  const ruleResults = useMemo(() => passwordRules.map(rule => ({ ...rule, passed: rule.test(password) })), [password])
  const passedRules = ruleResults.filter(rule => rule.passed).length
  const passwordIsValid = passedRules === passwordRules.length
  const passwordsMatch = Boolean(confirmation) && password === confirmation
  const strengthLabel = passwordIsValid ? 'Senha forte' : passedRules >= 4 ? 'Quase lá' : passedRules >= 2 ? 'Em desenvolvimento' : 'Crie uma senha forte'
  const showRequirements = Boolean(password) || status === 'invalid-password'

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

  function clearPasswordError() {
    if (status === 'invalid-password') setStatus('ready')
  }

  async function accept(event) {
    event.preventDefault()
    if (submitting.current) return
    if (!token || !passwordIsValid || password !== confirmation) return setStatus('invalid-password')
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
      setStatus(response.ok ? 'done' : ['INVALID_PASSWORD', 'WEAK_PASSWORD'].includes(result.code) ? 'invalid-password' : response.status === 429 || response.status >= 500 ? 'error' : 'invalid')
    } catch { setStatus('error') }
    finally { submitting.current = false; setPassword(''); setConfirmation('') }
  }

  return <main className="accept-invite-page">
    <div className="accept-invite-shell">
      <header className="accept-invite-brand" aria-label="Kytto">
        <span className="accept-invite-logo" aria-hidden="true">K</span>
        <span>Kytto</span>
        <span className="accept-invite-brand-divider" aria-hidden="true" />
        <span className="accept-invite-brand-context">Acesso operacional</span>
      </header>

      <section className="accept-invite-card" aria-labelledby="invite-title">
        {status === 'done' ? <div className="accept-invite-result accept-invite-result-success" role="status">
          <span className="accept-invite-result-icon"><CheckIcon /></span>
          <p className="accept-invite-eyebrow">Acesso confirmado</p>
          <h1 id="invite-title">Senha definida com sucesso</h1>
          <p className="accept-invite-lead">Seu convite foi aceito. Use seu e-mail e a nova senha para entrar no painel.</p>
          <Link className="accept-invite-primary-action" to="/login">Acessar o painel <span aria-hidden="true">→</span></Link>
        </div> : <>
          <div className="accept-invite-card-header">
            <span className="accept-invite-icon"><ShieldIcon /></span>
            <div>
              <p className="accept-invite-eyebrow">Convite de acesso</p>
              <h1 id="invite-title">Crie sua senha</h1>
              <p className="accept-invite-lead">Defina uma senha segura para acessar as operações da empresa indicada no seu convite.</p>
            </div>
          </div>

          <div className="accept-invite-trust" aria-label="Detalhes de segurança do convite">
            <span><ShieldIcon /> Link individual</span>
            <span><span className="accept-invite-trust-dot" aria-hidden="true" /> Uso único</span>
            <span><span className="accept-invite-trust-dot" aria-hidden="true" /> Válido por 24h</span>
          </div>

          {status === 'invalid' && <div className="accept-invite-alert accept-invite-alert-error" role="alert">
            <strong>Este convite não está disponível.</strong>
            <span>Ele pode ter expirado ou já ter sido usado. Peça um novo convite ao administrador.</span>
          </div>}
          {status === 'error' && <div className="accept-invite-alert accept-invite-alert-error" role="alert">
            <strong>Não foi possível concluir agora.</strong>
            <span>Confira sua conexão e tente novamente em instantes.</span>
          </div>}
          {status === 'invalid-password' && <div className="accept-invite-alert accept-invite-alert-error" role="alert">
            <strong>Revise sua senha.</strong>
            <span>Ela deve atender a todos os requisitos e ser igual à confirmação.</span>
          </div>}

          {token && status !== 'invalid' && <form className="accept-invite-form" onSubmit={accept} noValidate>
            <div className="accept-invite-field">
              <label htmlFor="operational-password">Nova senha</label>
              <div className="accept-invite-input-wrap">
                <input
                  id="operational-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={72}
                  disabled={status === 'sending'}
                  value={password}
                  onChange={event => { setPassword(event.target.value); clearPasswordError() }}
                  aria-describedby="operational-password-hint operational-password-feedback"
                  aria-invalid={showRequirements && !passwordIsValid}
                  required
                />
                <button className="accept-invite-password-toggle" type="button" onClick={() => setShowPassword(value => !value)} disabled={status === 'sending'} aria-label={showPassword ? 'Ocultar senhas' : 'Mostrar senhas'} aria-pressed={showPassword}>
                  <EyeIcon hidden={showPassword} />
                  <span>{showPassword ? 'Ocultar' : 'Mostrar'}</span>
                </button>
              </div>
              <p id="operational-password-hint" className="accept-invite-field-hint">Escolha uma senha que você ainda não usa em outros serviços.</p>
            </div>

            <div className="accept-invite-strength" aria-labelledby="password-strength-label">
              <div className="accept-invite-strength-heading">
                <span id="password-strength-label">Segurança da senha</span>
                <strong className={passwordIsValid ? 'is-complete' : ''}>{strengthLabel}</strong>
              </div>
              <div className="accept-invite-meter" aria-hidden="true">
                {passwordRules.map((rule, index) => <span className={index < passedRules ? 'is-active' : ''} key={rule.id} />)}
              </div>
              <ul className="accept-invite-requirements" aria-label="Requisitos da senha">
                {ruleResults.map(rule => <li className={rule.passed ? 'is-complete' : ''} key={rule.id}><span aria-hidden="true">{rule.passed ? '✓' : '○'}</span>{rule.label}</li>)}
              </ul>
              <p id="operational-password-feedback" className="accept-invite-sr-only" aria-live="polite">{strengthLabel}. {passedRules} de {passwordRules.length} requisitos atendidos.</p>
            </div>

            <div className="accept-invite-field">
              <label htmlFor="operational-confirm">Confirmar nova senha</label>
              <div className="accept-invite-input-wrap">
                <input
                  id="operational-confirm"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={72}
                  disabled={status === 'sending'}
                  value={confirmation}
                  onChange={event => { setConfirmation(event.target.value); clearPasswordError() }}
                  aria-describedby={confirmation && !passwordsMatch ? 'operational-confirm-error' : undefined}
                  aria-invalid={Boolean(confirmation) && !passwordsMatch}
                  required
                />
              </div>
              {confirmation && !passwordsMatch && <p id="operational-confirm-error" className="accept-invite-field-error">As senhas não coincidem.</p>}
            </div>

            <button className="accept-invite-primary-action" type="submit" disabled={status === 'sending'}>
              {status === 'sending' ? <><span className="accept-invite-spinner" aria-hidden="true" />Concluindo com segurança...</> : <>Definir senha e aceitar <span aria-hidden="true">→</span></>}
            </button>
          </form>}
        </>}
      </section>

      <p className="accept-invite-footer"><ShieldIcon /> Este é um link pessoal. Não encaminhe este convite.</p>
    </div>
  </main>
}
