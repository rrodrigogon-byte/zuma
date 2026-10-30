import { useAuth } from '../../../lib/auth'
import WhatsappHumanQueue from './WhatsappHumanQueue'
import { useSearchParams } from 'react-router-dom'
import './dino-admin.css'

export default function WhatsappFilaPage() {
  const { empresaAtiva, lojaAtiva, user } = useAuth()
  const [searchParams] = useSearchParams()
  const tipoCanal = searchParams.get('canal') || 'cliente'

  return (
    <div className="page" style={{ minHeight: '100vh' }}>
      <WhatsappHumanQueue
        empresaId={empresaAtiva?.id}
        lojaId={lojaAtiva?.id}
        tipoCanal={tipoCanal}
        empresaNome={empresaAtiva?.nome}
        lojaNome={lojaAtiva?.nome}
        operatorLabel={user?.nome || user?.name || user?.email}
        standalone={true}
      />
    </div>
  )
}
