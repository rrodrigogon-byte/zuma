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
import { brandFromHost } from '../lib/brand'

const LS_KEY = 'sp_cookie_consent'

// Paleta do aviso: verde Agro Open/Kytto por padrão; marcas com identidade própria usam a sua.
export const COOKIE_PALETTES = {
  default: { bg: '#0e2216', panel: '#132b1b', title: '#F4F6EF', body: '#7a9e85', strong: '#a0c8a0', highlight: '#C9A656', accent: '#5FB335', primary: 'linear-gradient(135deg,#5FB335,#7BC142)', primaryText: '#1B4D2E', primaryShadow: '0 3px 12px rgba(95,179,53,0.35)', secondaryText: '#7BC142', secondaryBorder: '1.5px solid #2a4a35', secondaryBorderColor: '#2a4a35', topBorder: '2px solid #1e3d28', panelBorder: '1px solid #1e3d28' },
  stallone: { bg: '#141416', panel: '#1C1C21', title: '#F7F7F5', body: '#B7B7BF', strong: '#F7F7F5', highlight: '#E32935', accent: '#E32935', primary: '#E32935', primaryText: '#FFFFFF', primaryShadow: '0 3px 12px rgba(227,41,53,0.35)', secondaryText: '#F7F7F5', secondaryBorder: '1.5px solid #3A3A42', secondaryBorderColor: '#3A3A42', topBorder: '2px solid #E32935', panelBorder: '1px solid #2A2A31' },
}

export function cookiePalette(brand) {
  return COOKIE_PALETTES[brand] || COOKIE_PALETTES.default
}

export default function CookieConsent() {
  const brand = typeof document !== 'undefined' && document.documentElement.dataset.brand === 'stallone'
    ? 'stallone'
    : (typeof window !== 'undefined' ? brandFromHost(window.location.hostname) : null)
  const pal = cookiePalette(brand)
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
    <>
      {/* Overlay sutil para atrair atenção no mobile */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(0,0,0,0.18)',
          pointerEvents: 'none',
        }}
      />

      <div
        role="dialog"
        aria-modal="false"
        aria-label="Aviso de cookies e privacidade"
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
          background: pal.bg,
          borderTop: pal.topBorder,
          padding: '20px 24px',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.35)',
          fontFamily: "'Segoe UI', sans-serif",
          animation: 'lgpd-slide-up 0.35s ease',
        }}
      >
        <style>{`
          @keyframes lgpd-slide-up {
            from { transform: translateY(100%); opacity: 0; }
            to   { transform: translateY(0);    opacity: 1; }
          }
        `}</style>

        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          {/* Cabeçalho */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: detail ? 14 : 0 }}>
            <span style={{ fontSize: '1.6rem', flexShrink: 0 }}>🍪</span>
            <div style={{ flex: 1 }}>
              <p style={{ margin: '0 0 6px', color: pal.title, fontWeight: 700, fontSize: '0.95rem' }}>
                Usamos cookies e dados de navegação
              </p>
              <p style={{ margin: 0, color: pal.body, fontSize: '0.82rem', lineHeight: 1.6 }}>
                Este site utiliza cookies essenciais para funcionamento e, opcionalmente, cookies analíticos
                para melhorar a experiência. Ao continuar, você concorda com nossa{' '}
                <button
                  onClick={() => setDetail(d => !d)}
                  style={{ background: 'none', border: 'none', color: pal.accent, cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', padding: 0, textDecoration: 'underline' }}
                >
                  Política de Privacidade
                </button>
                {' '}(LGPD — Lei 13.709/2018).
              </p>
            </div>
          </div>

          {/* Detalhe expandível */}
          {detail && (
            <div style={{
              background: pal.panel, borderRadius: 10, padding: '14px 16px',
              marginBottom: 14, border: pal.panelBorder,
            }}>
              <p style={{ margin: '0 0 8px', color: pal.highlight, fontWeight: 700, fontSize: '0.82rem' }}>
                📋 O que coletamos?
              </p>
              <ul style={{ margin: 0, paddingLeft: 18, color: pal.body, fontSize: '0.8rem', lineHeight: 1.8 }}>
                <li><strong style={{ color: pal.strong }}>Cookies essenciais:</strong> Token de autenticação (sessão), preferências de idioma. Obrigatórios para o funcionamento.</li>
                <li><strong style={{ color: pal.strong }}>Cookies analíticos (opcional):</strong> Métricas de uso anônimas para melhorar o sistema. Sem identificação pessoal.</li>
                <li><strong style={{ color: pal.strong }}>Dados de pedido:</strong> Nome, e-mail e telefone informados no checkout. Usados exclusivamente para processamento do pedido.</li>
              </ul>
              <p style={{ margin: '10px 0 0', color: pal.body, fontSize: '0.78rem', lineHeight: 1.6 }}>
                Você pode revogar o consentimento a qualquer momento limpando os dados do navegador.
                Dúvidas: contate o responsável pelo sistema via WhatsApp indicado na plataforma.
              </p>
            </div>
          )}

          {/* Botões de ação */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: detail ? 0 : 14 }}>
            <button
              onClick={() => accept('all')}
              style={{
                flex: 1, minWidth: 160,
                background: pal.primary,
                color: pal.primaryText, border: 'none', borderRadius: 10,
                padding: '11px 20px', fontWeight: 800, fontSize: '0.88rem',
                cursor: 'pointer', boxShadow: pal.primaryShadow,
                transition: 'transform .1s',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseLeave={e => e.currentTarget.style.transform = ''}
            >
              ✅ Aceitar todos
            </button>
            <button
              onClick={() => accept('essential')}
              style={{
                flex: 1, minWidth: 160,
                background: 'transparent', color: pal.secondaryText,
                border: pal.secondaryBorder, borderRadius: 10,
                padding: '11px 20px', fontWeight: 700, fontSize: '0.88rem',
                cursor: 'pointer', transition: 'border-color .15s, transform .1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = pal.accent; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = pal.secondaryBorderColor; e.currentTarget.style.transform = '' }}
            >
              🔒 Apenas essenciais
            </button>
          </div>
        </div>
      </div>
    </>
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
