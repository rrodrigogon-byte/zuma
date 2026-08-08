import { useState } from 'react'
import { api } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

const C = {
  green: '#FF6B2C',
  cream: '#FFF4EC',
  gold: '#FF6B2C',
  card: '#132b1b',
  cardBorder: '#1e3d28',
  inputBg: '#0e2216',
  inputBorder: '#2a4a35',
  muted: '#7a9e85',
}

const inputStyle = {
  width: '100%',
  padding: '11px 14px',
  background: C.inputBg,
  border: `1px solid ${C.inputBorder}`,
  borderRadius: '8px',
  color: C.cream,
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s',
}

const labelStyle = {
  display: 'block',
  color: C.muted,
  fontSize: '11px',
  fontWeight: '600',
  letterSpacing: '0.8px',
  textTransform: 'uppercase',
  marginBottom: '5px',
}

const cardStyle = {
  background: C.card,
  border: `1px solid ${C.cardBorder}`,
  borderRadius: '14px',
  padding: '24px',
  marginBottom: '20px',
}

const INFOS = [
  { icon: '📍', label: 'Endereço', value: 'Tangará Tênis Clube — Tangará da Serra, MT' },
  { icon: '📞', label: 'Telefone', value: '(65) 3326-0000' },
  { icon: '✉️', label: 'E-mail', value: 'contato@agroopen.com.br' },
  { icon: '📸', label: 'Instagram', value: '@agroopentenis', href: 'https://instagram.com/agroopentenis' },
]

export default function Contato() {
  const { toast } = useToast()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/api/contato', { nome, email, mensagem })
      setEnviado(true)
      toast('Mensagem enviada! Entraremos em contato em breve.', 'success')
      setNome('')
      setEmail('')
      setMensagem('')
    } catch {
      toast('Erro ao enviar mensagem. Tente novamente.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px 40px', fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      <h1 style={{ fontSize: 22, fontWeight: 900, color: C.cream, marginBottom: 6 }}>Contato</h1>
      <p style={{ color: C.muted, fontSize: 14, marginBottom: 28 }}>
        Entre em contato com a organização do 4ª Agro Open de Tênis.
      </p>

      {/* Info cards */}
      <div style={cardStyle}>
        <div style={{
          fontSize: 13, fontWeight: 800, color: C.muted, letterSpacing: '0.8px',
          textTransform: 'uppercase', marginBottom: 18, paddingBottom: 10,
          borderBottom: `1px solid ${C.cardBorder}`,
        }}>
          Informações
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          {INFOS.map((info) => (
            <div key={info.label} style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              background: C.inputBg, border: `1px solid ${C.cardBorder}`,
              borderRadius: 10, padding: '14px 16px',
            }}>
              <span style={{ fontSize: 22, flexShrink: 0, lineHeight: 1.2 }}>{info.icon}</span>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 3 }}>
                  {info.label}
                </div>
                {info.href ? (
                  <a
                    href={info.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 14, color: C.green, fontWeight: 600, textDecoration: 'none' }}
                  >
                    {info.value}
                  </a>
                ) : (
                  <div style={{ fontSize: 14, color: C.cream, fontWeight: 500 }}>{info.value}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Map placeholder */}
      <div style={{
        ...cardStyle,
        background: C.inputBg,
        minHeight: 160,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        cursor: 'pointer',
        textDecoration: 'none',
      }}
        onClick={() => window.open('https://maps.google.com/?q=Tangar%C3%A1+T%C3%AAnis+Clube+Tangar%C3%A1+da+Serra+MT', '_blank')}
      >
        <div style={{ fontSize: 40 }}>🗺️</div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.cream, marginBottom: 4 }}>
            Tangará Tênis Clube
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 10 }}>
            Tangará da Serra — MT
          </div>
          <span style={{
            display: 'inline-block',
            padding: '7px 18px',
            background: 'rgba(255,107,44,.12)',
            border: '1px solid rgba(255,107,44,.3)',
            borderRadius: 20,
            color: C.green,
            fontSize: 12,
            fontWeight: 700,
          }}>
            Ver no Google Maps →
          </span>
        </div>
      </div>

      {/* Contact form */}
      <div style={cardStyle}>
        <div style={{
          fontSize: 13, fontWeight: 800, color: C.muted, letterSpacing: '0.8px',
          textTransform: 'uppercase', marginBottom: 18, paddingBottom: 10,
          borderBottom: `1px solid ${C.cardBorder}`,
        }}>
          Enviar Mensagem
        </div>

        {enviado ? (
          <div style={{
            textAlign: 'center', padding: '30px 20px',
            background: 'rgba(255,107,44,.08)',
            border: '1px solid rgba(255,107,44,.2)',
            borderRadius: 12,
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.cream, marginBottom: 6 }}>
              Mensagem enviada!
            </div>
            <div style={{ fontSize: 14, color: C.muted }}>
              Entraremos em contato em breve.
            </div>
            <button
              onClick={() => setEnviado(false)}
              style={{
                marginTop: 16, padding: '8px 20px',
                background: 'transparent', border: `1px solid ${C.cardBorder}`,
                borderRadius: 8, color: C.muted, fontSize: 13, cursor: 'pointer',
              }}
            >
              Enviar outra mensagem
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <div>
                <label style={labelStyle}>Seu nome</label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Nome completo"
                  required
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = C.green)}
                  onBlur={(e) => (e.target.style.borderColor = C.inputBorder)}
                />
              </div>
              <div>
                <label style={labelStyle}>E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = C.green)}
                  onBlur={(e) => (e.target.style.borderColor = C.inputBorder)}
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Mensagem</label>
              <textarea
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                placeholder="Sua dúvida ou mensagem…"
                required
                rows={5}
                style={{
                  ...inputStyle,
                  resize: 'vertical',
                  minHeight: 110,
                  fontFamily: 'inherit',
                }}
                onFocus={(e) => (e.target.style.borderColor = C.green)}
                onBlur={(e) => (e.target.style.borderColor = C.inputBorder)}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '12px 28px',
                background: loading ? '#3d7022' : C.green,
                color: '#fff',
                border: 'none',
                borderRadius: 9,
                fontSize: 14,
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                alignSelf: 'flex-start',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'background 0.2s',
              }}
            >
              {loading ? (
                <>
                  <span style={{
                    width: 14, height: 14,
                    border: '2px solid rgba(255,255,255,.3)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    display: 'inline-block',
                    animation: 'spin 0.7s linear infinite',
                  }} />
                  Enviando…
                </>
              ) : 'Enviar mensagem'}
            </button>
          </form>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
