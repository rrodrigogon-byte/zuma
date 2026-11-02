import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth'

// Tela por empresa aberta sem empresa ativa (administração sem empresa escolhida): pede a
// escolha em vez de abrir a versão antiga, que não tem mais servidor.
export default function EscolhaEmpresa({ modulo }) {
  const { empresasAcessiveis = [], trocarEmpresa } = useAuth() || {}
  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <div className="card" role="status" style={{ padding: 28, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Escolha a empresa</div>
        <h1 className="page-title" style={{ margin: 0 }}>{modulo}</h1>
        <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.55 }}>Este módulo é por empresa. Escolha a empresa no seletor do topo para abrir.</p>
        {empresasAcessiveis.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
            {empresasAcessiveis.map((emp) => (
              <button
                key={emp.id}
                type="button"
                className="btn btn-primary"
                onClick={() => trocarEmpresa?.(emp.id)}
              >
                Abrir em {emp.nome || emp.fantasia || emp.slug}
              </button>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}><Link className="btn btn-primary" to="/admin">Voltar ao painel</Link></div>
      </div>
    </div>
  )
}
