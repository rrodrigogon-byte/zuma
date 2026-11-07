import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth'

export default function EscolhaEmpresa({ modulo }) {
  const { empresasAcessiveis = [], trocarEmpresa, empresaAtiva } = useAuth() || {}

  const lista = Array.isArray(empresasAcessiveis) ? empresasAcessiveis : []

  // Se o usuário tem apenas 1 empresa autorizada, seleciona automaticamente sem exigir clique
  useEffect(() => {
    if (lista.length === 1 && lista[0]?.id && (!empresaAtiva?.id || empresaAtiva.id !== lista[0].id)) {
      if (trocarEmpresa?.(lista[0].id)) {
        return
      }
      try {
        localStorage.setItem('sp_empresa_ativa', JSON.stringify(lista[0]))
        window.location.reload()
      } catch {
        // fallback
      }
    }
  }, [lista, empresaAtiva, trocarEmpresa])

  function selecionar(emp) {
    if (trocarEmpresa?.(emp.id)) {
      return
    }
    try {
      localStorage.setItem('sp_empresa_ativa', JSON.stringify(emp))
      window.location.reload()
    } catch {
      // fallback
    }
  }

  return (
    <div className="page" style={{ maxWidth: 720, margin: '40px auto' }}>
      <div className="card" role="status" style={{ padding: 28, display: 'grid', gap: 14, background: '#fff', borderRadius: 12, border: '1px solid var(--border, #e2e8f0)', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted, #64748b)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Escolha a empresa</div>
        <h1 className="page-title" style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{modulo}</h1>
        <p style={{ margin: 0, color: 'var(--muted, #475569)', lineHeight: 1.55 }}>
          Este módulo opera por empresa. Selecione a unidade autorizada abaixo para abrir as operações e relatórios:
        </p>

        {lista.length === 0 ? (
          <div style={{ padding: '16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: 14 }}>
            Nenhuma empresa vinculada à sua conta com permissão neste módulo.
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
            {lista.map((emp) => (
              <button
                key={emp.id}
                type="button"
                className="btn btn-primary"
                onClick={() => selecionar(emp)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 20px',
                  fontSize: 14,
                  fontWeight: 600,
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                🏢 Abrir em {emp.nome || emp.fantasia || emp.slug || emp.id}
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, paddingTop: 14, borderTop: '1px solid var(--border, #e2e8f0)' }}>
          <Link className="btn btn-secondary" to="/admin" style={{ textDecoration: 'none', color: '#475569', fontSize: 13, fontWeight: 600 }}>
            ← Voltar ao painel
          </Link>
        </div>
      </div>
    </div>
  )
}
