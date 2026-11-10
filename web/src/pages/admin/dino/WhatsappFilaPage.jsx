import { useAuth } from '../../../lib/auth'
import WhatsappHumanQueue from './WhatsappHumanQueue'
import { useSearchParams } from 'react-router-dom'
import './dino-admin.css'

export default function WhatsappFilaPage() {
  const { empresaAtiva, lojaAtiva, user, lojasAcessiveis, empresasAcessiveis } = useAuth()
  const [searchParams] = useSearchParams()
  const tipoCanal = searchParams.get('canal') || 'cliente'

  const empresaIdEfetivo = (empresaAtiva?.id && empresaAtiva.id !== 'principal')
    ? empresaAtiva.id
    : (user?.empresaId || empresasAcessiveis?.[0]?.id || 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6')
  const empresaNomeEfetivo = empresaAtiva?.nome || empresasAcessiveis?.[0]?.nome || 'Dino Barbearia'

  const lojaIdEfetivo = (lojaAtiva?.id && lojaAtiva.id !== 'todas')
    ? (lojaAtiva.id.toLowerCase() === 'dino-matriz' ? 'ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8' : lojaAtiva.id)
    : (user?.lojaId || lojasAcessiveis?.[0]?.id || 'ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8')
  const lojaNomeEfetivo = lojaAtiva?.nome || lojasAcessiveis?.[0]?.nome || 'Matriz Tangará da Serra'

  return (
    <div className="page" style={{ minHeight: '100vh', background: '#f8fafc', padding: '16px' }}>
      <WhatsappHumanQueue
        empresaId={empresaIdEfetivo}
        lojaId={lojaIdEfetivo}
        tipoCanal={tipoCanal}
        empresaNome={empresaNomeEfetivo}
        lojaNome={lojaNomeEfetivo}
        operatorLabel={user?.nome || user?.name || user?.email || 'Atendente Ster'}
        standalone={true}
      />
    </div>
  )
}
