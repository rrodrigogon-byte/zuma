/**
 * CookieConsent — Banner de consentimento de cookies (LGPD / GDPR)
 * ─────────────────────────────────────────────────────────────────
 * Exibe um banner discreto na parte inferior da tela solicitando
 * consentimento do usuário conforme a LGPD (Lei 13.709/2018).
 *
 * O estado é persistido em localStorage ('sp_cookie_consent').
 * Valores possíveis: 'all' | 'essential' | null (não respondido)
 */
import { useState, useEffect } from 'react'
import './CookieConsent.css'

const LS_KEY = 'sp_cookie_consent'

export default function CookieConsent() {
  const [visible, setVisible] = useState(false)
  const [detail, setDetail] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY)
    if (!saved) {
      // Pequeno delay para não sobrepor o carregamento inicial da página
      const t = setTimeout(() => setVisible(true), 1200)
      return () => clearTimeout(t)
    }
  }, [])

  const accept = (type) => {
    localStorage.setItem(LS_KEY, type)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="cookie-consent" role="region" aria-label="Aviso de cookies e privacidade">
      <div className="cookie-consent__body">
        <p className="cookie-consent__title">Usamos cookies e dados de navegação</p>
        <p className="cookie-consent__text">
          Cookies essenciais mantêm o site funcionando; os analíticos são opcionais e anônimos.{' '}
          <button type="button" className="cookie-consent__link" aria-expanded={detail} onClick={() => setDetail(d => !d)}>
            {detail ? 'Ocultar detalhes' : 'Política de Privacidade'}
          </button>{' '}(LGPD — Lei 13.709/2018).
        </p>
        {detail && (
          <ul className="cookie-consent__detail">
            <li><strong>Essenciais:</strong> sessão de login e preferências. Obrigatórios.</li>
            <li><strong>Analíticos (opcional):</strong> métricas de uso anônimas, sem identificação pessoal.</li>
            <li><strong>Dados de pedido:</strong> nome, e-mail e telefone do checkout, usados só para processar o pedido.</li>
            <li>Você pode revogar o consentimento limpando os dados do navegador.</li>
          </ul>
        )}
      </div>
      <div className="cookie-consent__actions">
        <button type="button" className="cookie-consent__btn cookie-consent__btn--primary" onClick={() => accept('all')}>Aceitar todos</button>
        <button type="button" className="cookie-consent__btn" onClick={() => accept('essential')}>Apenas essenciais</button>
      </div>
    </div>
  )
}

/**
 * Hook auxiliar para verificar o status do consentimento em qualquer componente
 * @returns {'all' | 'essential' | null}
 */
export function useCookieConsent() {
  const [consent, setConsent] = useState(() => localStorage.getItem(LS_KEY))

  useEffect(() => {
    // Ouve mudanças de storage entre abas
    const handler = (e) => {
      if (e.key === LS_KEY) setConsent(e.newValue)
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  return consent
}
