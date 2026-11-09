import { useAuth } from '../../../lib/auth'
import WhatsappHumanQueue from './WhatsappHumanQueue'
import { useSearchParams } from 'react-router-dom'
import './dino-admin.css'

export default function WhatsappFilaPage() {
  const { empresaAtiva, lojaAtiva, user, lojasAcessiveis, empresasAcessiveis } = useAuth()
  const [searchParams] = useSearchParams()
  const tipoCanal = searchParams.get('canal') || 'cliente'

  const empresaIdEfetivo = empresaAtiva?.id && empresaAtiva.id !== 'principal'
    ? empresaAtiva.id
    : (empresasAcessiveis?.[0]?.id || '')
  const empresaNomeEfetivo = empresaAtiva?.nome || empresasAcessiveis?.[0]?.nome || 'Empresa'

  const lojaIdEfetivo = lojaAtiva?.id && lojaAtiva.id !== 'todas'
    ? (lojaAtiva.id.toLowerCase() === 'dino-matriz' ? 'ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8' : lojaAtiva.id)
    : (lojasAcessiveis?.[0]?.id || '')
  const lojaNomeEfetivo = lojaAtiva?.nome || lojasAcessiveis?.[0]?.nome || 'Unidade'

  return (
    <div className="page" style={{ minHeight: '100vh' }}>
      <WhatsappHumanQueue
        empresaId={empresaIdEfetivo}
        lojaId={lojaIdEfetivo}
        tipoCanal={tipoCanal}
        empresaNome={empresaNomeEfetivo}
        lojaNome={lojaNomeEfetivo}
        operatorLabel={user?.nome || user?.name || user?.email}
        standalone={true}
      />
    </div>
  )
}
