import { lazy, Suspense } from 'react'
import { useAuth } from '../../../lib/auth'
import { useRazaoAtivo } from '../../../lib/razao-estado'

const FinanceiroRazao = lazy(() => import('./FinanceiroRazao'))
const DespesaOperador = lazy(() => import('./DespesaOperador'))
const FechamentoDiarioGestao = lazy(() => import('../fechamento/FechamentoDiarioGestao'))

// Liga o Financeiro novo (razão único) quando o servidor diz que ele está ativo
// (FINANCEIRO_RAZAO=1, depois da importação do financeiro antigo). Até lá, mostra a tela nativa imediatamente.
export default function FinanceiroAuto({ aba = 'geral', antigo }) {
  const { empresaAtiva, perfil } = useAuth()
  if (aba === 'fechamento') {
    return <Suspense fallback={<div className="page"><p style={{ color: 'var(--muted)' }}>Carregando…</p></div>}><FechamentoDiarioGestao /></Suspense>
  }
  const ativo = useRazaoAtivo()
  if (ativo === true) {
    // operador: só lança despesa (os números da empresa ficam com a administração)
    if (perfil === 'operador') return <Suspense fallback={<div className="page"><p style={{ color: 'var(--muted)' }}>Carregando…</p></div>}><DespesaOperador /></Suspense>
    return <Suspense fallback={<div className="page"><p style={{ color: 'var(--muted)' }}>Carregando…</p></div>}><FinanceiroRazao key={`${empresaAtiva?.id}-${aba}`} abaInicial={aba} /></Suspense>
  }
  return antigo
}
