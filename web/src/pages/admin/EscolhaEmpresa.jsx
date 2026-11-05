import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth'

// Tela por empresa aberta sem empresa ativa (administração sem empresa escolhida): pede a
// escolha em vez de abrir a versão antiga, que não tem mais servidor.
export default function EscolhaEmpresa({ modulo }) {
  const { empresasAcessiveis = [], trocarEmpresa } = useAuth() || {}

  const EMPRESAS_PADRAO = [
    {
      id: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
      nome: 'Dino Barbearia & Perfumaria',
      fantasia: 'Barbearia Dino',
      slug: 'dino',
      cnpj: '50.073.355/0002-60',
    },
    {
      id: 'emp-stallone-001',
      nome: 'Stallone',
      fantasia: 'Stallone',
      slug: 'stallone',
    },
  ]

  const lista = Array.isArray(empresasAcessiveis) && empresasAcessiveis.length > 0 ? empresasAcessiveis : EMPRESAS_PADRAO

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
          Este módulo opera por empresa. Selecione a unidade abaixo para abrir as notas fiscais e relatórios:
        </p>

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
              🏢 Abrir em {emp.nome || emp.fantasia || emp.slug}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, paddingTop: 14, borderTop: '1px solid var(--border, #e2e8f0)' }}>
          <Link className="btn btn-secondary" to="/admin" style={{ textDecoration: 'none', color: '#475569', fontSize: 13, fontWeight: 600 }}>
            ← Voltar ao painel
          </Link>
        </div>
      </div>
    </div>
  )
}
