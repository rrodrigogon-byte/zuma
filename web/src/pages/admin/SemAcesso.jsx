import { Link } from 'react-router-dom'
import { NOME_DA_PERMISSAO } from '../../lib/permissoes-rota'

// Mostrada no lugar de uma tela do backoffice cuja permissão a pessoa não tem na empresa ativa
// (ver web/src/lib/permissoes-rota.js). A API continua negando; isto só evita a tela de erros.
export default function SemAcesso({ permissao }) {
  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <div className="card" role="alert" style={{ padding: 28, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Sem acesso</div>
        <h1 className="page-title" style={{ margin: 0 }}>Esta área não está liberada para você</h1>
        <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.55 }}>
          Seu perfil nesta empresa não permite {NOME_DA_PERMISSAO[permissao] || 'abrir esta tela'}. Se precisar, peça ao
          responsável pela empresa para ajustar o seu acesso em Usuários e acessos.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
          <Link className="btn btn-primary" to="/admin">Voltar ao painel</Link>
        </div>
      </div>
    </div>
  )
}
