import { useState, useMemo } from 'react'
import { useAuth } from '../../../lib/auth'
import WhatsappHumanQueue from './WhatsappHumanQueue'
import { useSearchParams } from 'react-router-dom'
import './dino-admin.css'

export default function WhatsappFilaPage() {
  const { empresaAtiva, lojaAtiva, user, lojasAcessiveis, empresasAcessiveis } = useAuth()
  const [searchParams] = useSearchParams()
  const tipoCanal = searchParams.get('canal') || 'cliente'

  // Preferência para a Dino Barbearia canônica caso o usuário tenha acesso
  const dinoEmpresa = useMemo(() => {
    return (empresasAcessiveis || []).find(e => e.id === 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6' || /dino/i.test(e.nome))
  }, [empresasAcessiveis])

  const [empresaIdSelecionada, setEmpresaIdSelecionada] = useState(() => {
    return dinoEmpresa?.id
      || (empresaAtiva?.id && empresaAtiva.id !== 'principal' ? empresaAtiva.id : '')
      || user?.empresaId
      || empresasAcessiveis?.[0]?.id
      || 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6'
  })

  const empresaEfetiva = useMemo(() => {
    return (empresasAcessiveis || []).find(e => e.id === empresaIdSelecionada) || empresaAtiva || { id: empresaIdSelecionada, nome: 'Barbearia Dino' }
  }, [empresasAcessiveis, empresaIdSelecionada, empresaAtiva])

  const [lojaIdSelecionada, setLojaIdSelecionada] = useState(() => {
    return (lojaAtiva?.id && lojaAtiva.id !== 'todas')
      ? (lojaAtiva.id.toLowerCase() === 'dino-matriz' ? 'ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8' : lojaAtiva.id)
      : (user?.lojaId || lojasAcessiveis?.[0]?.id || 'ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8')
  })

  const lojaEfetiva = useMemo(() => {
    return (lojasAcessiveis || []).find(l => l.id === lojaIdSelecionada) || lojaAtiva || { id: lojaIdSelecionada, nome: 'Matriz Tangará da Serra' }
  }, [lojasAcessiveis, lojaIdSelecionada, lojaAtiva])

  return (
    <div className="page" style={{ minHeight: '100vh', background: '#f8fafc', padding: '16px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14, background: '#fff', padding: '12px 18px', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>🦖</span>
          <div>
            <strong style={{ fontSize: 16, color: '#0f172a', display: 'block' }}>Central de Atendimento WhatsApp</strong>
            <span style={{ fontSize: 12, color: '#64748b' }}>Fila Humana com Takeover Atômico & Inteligência T-Rex</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          {(empresasAcessiveis || []).length > 1 && (
            <label style={{ fontSize: 12, fontWeight: 700, color: '#475467' }}>
              Empresa:
              <select value={empresaIdSelecionada} onChange={e => setEmpresaIdSelecionada(e.target.value)} style={{ marginLeft: 6, padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}>
                {empresasAcessiveis.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
            </label>
          )}
          {(lojasAcessiveis || []).length > 1 && (
            <label style={{ fontSize: 12, fontWeight: 700, color: '#475467' }}>
              Unidade:
              <select value={lojaIdSelecionada} onChange={e => setLojaIdSelecionada(e.target.value)} style={{ marginLeft: 6, padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}>
                {lojasAcessiveis.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
              </select>
            </label>
          )}
        </div>
      </div>
      <WhatsappHumanQueue
        empresaId={empresaIdSelecionada}
        lojaId={lojaIdSelecionada}
        tipoCanal={tipoCanal}
        empresaNome={empresaEfetiva?.nome || 'Barbearia Dino'}
        lojaNome={lojaEfetiva?.nome || 'Matriz Tangará da Serra'}
        operatorLabel={user?.nome || user?.name || user?.email || 'Atendente Ster'}
        standalone={true}
      />
    </div>
  )
}
