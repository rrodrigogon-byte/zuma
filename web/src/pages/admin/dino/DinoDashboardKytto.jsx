import React, { useState } from 'react'
import { useAuth } from '../../../lib/auth'
import DinoMetasRoletaPanel from './DinoMetasRoletaPanel'
import DinoEquipeDesempenho from '../DinoEquipeDesempenho'

export default function DinoDashboardKytto() {
  const { user, empresaAtiva, lojaAtiva } = useAuth()
  
  // Acesso restrito a admin da loja
  const isAdmin = ['admin', 'organizador', 'gerente'].includes(String(user?.role || '').toLowerCase())
  
  if (!isAdmin) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
        Acesso restrito. Apenas administradores e gerentes da loja podem acessar o painel de gestão.
      </div>
    )
  }

  const [abaAtiva, setAbaAtiva] = useState('painel')

  const tabAtivaStyle = {
    padding: '10px 20px',
    background: '#1e3a8a',
    color: '#fff',
    border: 'none',
    borderRadius: '8px 8px 0 0',
    cursor: 'pointer',
    fontWeight: 700
  }
  
  const tabInativaStyle = {
    padding: '10px 20px',
    background: 'transparent',
    color: 'var(--muted)',
    border: 'none',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
    fontWeight: 600
  }

  return (
    <div style={{ padding: '0 0 40px', maxWidth: 1200, margin: '0 auto', fontFamily: 'var(--font-sans, sans-serif)' }}>
      <div style={{ display: 'flex', gap: 20, marginBottom: 20, borderBottom: '1px solid var(--line, #e2e8f0)' }}>
        <button 
          style={abaAtiva === 'painel' ? tabAtivaStyle : tabInativaStyle}
          onClick={() => setAbaAtiva('painel')}
        >
          Painel de gestão
        </button>
        <button 
          style={abaAtiva === 'comparativo' ? tabAtivaStyle : tabInativaStyle}
          onClick={() => setAbaAtiva('comparativo')}
        >
          Comparativo de períodos (Desempenho)
        </button>
      </div>

      {abaAtiva === 'painel' && <DinoMetasRoletaPanel />}
      {abaAtiva === 'comparativo' && <DinoEquipeDesempenho empresaId={empresaAtiva} lojaId={lojaAtiva} />}
    </div>
  )
}
