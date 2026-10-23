import { lazy, Suspense } from 'react'
import { useAuth } from '../../../lib/auth'
import { useRazaoAtivo } from '../../../lib/razao-estado'

const FinanceiroRazao = lazy(() => import('./FinanceiroRazao'))
const DespesaOperador = lazy(() => import('./DespesaOperador'))

// Liga o Financeiro novo (razão único) quando o servidor diz que ele está ativo
// (FINANCEIRO_RAZAO=1, depois da importação do financeiro antigo). Até lá, mostra a tela antiga.
export default function FinanceiroAuto({ aba = 'geral', antigo }) {
  const { empresaAtiva, perfil } = useAuth()
  const ativo = useRazaoAtivo()
  if (ativo === null) return <div className="page"><p style={{ color: 'var(--muted)' }}>Carregando…</p></div>
  if (!ativo) return antigo
  // operador: só lança despesa (os números da empresa ficam com a administração)
  if (perfil === 'operador') return <Suspense fallback={<div className="page"><p style={{ color: 'var(--muted)' }}>Carregando…</p></div>}><DespesaOperador /></Suspense>
  return <Suspense fallback={<div className="page"><p style={{ color: 'var(--muted)' }}>Carregando…</p></div>}><FinanceiroRazao key={`${empresaAtiva?.id}-${aba}`} abaInicial={aba} /></Suspense>
}
