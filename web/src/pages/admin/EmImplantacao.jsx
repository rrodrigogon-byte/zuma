import { Link } from 'react-router-dom'

// Mostrada no lugar de uma tela cujo módulo ainda não está ligado em produção
// (ver web/src/lib/disponibilidade.js). Evita a tela cheia de erros 404.
export default function EmImplantacao({ modulo }) {
  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <div className="card" style={{ padding: 28, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Em implantação</div>
        <h1 className="page-title" style={{ margin: 0 }}>{modulo}</h1>
        <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.55 }}>
          Este módulo ainda não está ligado nesta versão do Kytto. Os dados da sua empresa não foram afetados.
          Quando ele for ativado, a tela volta a aparecer no menu.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
          <Link className="btn btn-primary" to="/admin">Voltar ao painel</Link>
        </div>
      </div>
    </div>
  )
}
