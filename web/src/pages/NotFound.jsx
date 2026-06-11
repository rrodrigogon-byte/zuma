import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '70vh',
      textAlign: 'center',
      padding: 40,
      gap: 24,
    }}>
      <div style={{
        fontSize: 'clamp(96px, 20vw, 160px)',
        fontWeight: 900,
        lineHeight: 1,
        color: 'var(--green)',
        animation: 'pulse404 2s ease-in-out infinite',
        letterSpacing: '-4px',
      }}>
        404
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h1 style={{ color: 'var(--cream)', fontSize: 24, fontWeight: 600 }}>
          Página não encontrada
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 15, maxWidth: 380 }}>
          O endereço que você tentou acessar não existe ou foi movido.
        </p>
      </div>

      <Link to="/" style={{ textDecoration: 'none' }}>
        <button className="btn btn-primary" style={{ padding: '12px 32px', fontSize: 15 }}>
          Voltar à home
        </button>
      </Link>

      <style>{`
        @keyframes pulse404 {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.75; transform: scale(0.97); }
        }
      `}</style>
    </div>
  )
}
