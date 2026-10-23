import { lazy, Suspense, useEffect, useState } from 'react'
import { api } from '../../../lib/api'
import { useAuth } from '../../../lib/auth'

const FinanceiroRazao = lazy(() => import('./FinanceiroRazao'))

// Liga o Financeiro novo (razão único) quando o servidor diz que ele está ativo
// (FINANCEIRO_RAZAO=1, depois da importação do financeiro antigo). Até lá, mostra a tela antiga.
export default function FinanceiroAuto({ aba = 'geral', antigo }) {
  const { empresaAtiva } = useAuth()
  const [ativo, setAtivo] = useState(null)
  useEffect(() => {
    let vivo = true
    setAtivo(null)
    api.get('/api/admin/razao/estado')
      .then((r) => { if (vivo) setAtivo(r?.ativo === true) })
      .catch(() => { if (vivo) setAtivo(false) })
    return () => { vivo = false }
  }, [empresaAtiva?.id])
  if (ativo === null) return <div className="page"><p style={{ color: 'var(--muted)' }}>Carregando…</p></div>
  if (!ativo) return antigo
  return <Suspense fallback={<div className="page"><p style={{ color: 'var(--muted)' }}>Carregando…</p></div>}><FinanceiroRazao key={`${empresaAtiva?.id}-${aba}`} abaInicial={aba} /></Suspense>
}
