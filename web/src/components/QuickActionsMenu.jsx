import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export default function QuickActionsMenu() {
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const clickFora = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setAberto(false);
      }
    };
    document.addEventListener('mousedown', clickFora);
    return () => document.removeEventListener('mousedown', clickFora);
  }, []);

  const acoes = [
    { icone: '📋', titulo: 'Abrir Nova Comanda', rota: '/admin/barbearia-erp?area=operacao&tab=Atendimento&nova=1', desc: 'Atendimento e comanda rápida' },
    { icone: '💰', titulo: 'Lançamento Financeiro', rota: '/admin/financeiro?acao=novo', desc: 'Conta a receber ou despesa' },
    { icone: '🛒', titulo: 'Pedido de Compras (IA)', rota: '/admin/comprador-inteligente', desc: 'Calcular reposição automática' },
    { icone: '📦', titulo: 'Importar NF-e (XML)', rota: '/admin/compras?tab=compras', desc: 'Entrada de estoque fiscal' },
    { icone: '👤', titulo: 'Novo Cliente', rota: '/admin/barbearia-erp?area=relacionamento&tab=Clientes', desc: 'Adicionar à base do salão' },
    { icone: '🔒', titulo: 'Fechar Caixa Diário', rota: '/admin/barbearia-erp?area=operacao&tab=Caixa+e+fechamento', desc: 'Conferência e fechamento cego' },
    { icone: '⚡', titulo: 'Testar Evento Interno', rota: '/admin/barramento-eventos', desc: 'Sincronizar Nossa Gente × Ultra' }
  ];

  const executar = (rota) => {
    setAberto(false);
    navigate(rota);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 14px',
          borderRadius: '8px',
          border: 'none',
          background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
          color: '#ffffff',
          fontWeight: 700,
          fontSize: '12px',
          cursor: 'pointer',
          boxShadow: '0 2px 4px rgba(79, 70, 229, 0.3)',
          transition: 'all 0.15s ease'
        }}
        title="Criar nova ação rápida no ERP"
      >
        <span style={{ fontSize: '14px' }}>⚡</span>
        <span>+ Criar / Lançar</span>
        <span style={{ fontSize: '9px', opacity: 0.8 }}>▼</span>
      </button>

      {aberto && (
        <div style={{
          position: 'absolute',
          top: '42px',
          right: 0,
          width: '260px',
          background: 'var(--surface, #1e293b)',
          border: '1px solid var(--line, #334155)',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          overflow: 'hidden',
          padding: '6px',
          animation: 'fadeIn 0.12s ease'
        }}>
          <div style={{
            padding: '6px 10px 8px',
            fontSize: '11px',
            fontWeight: 800,
            color: 'var(--muted, #94a3b8)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            borderBottom: '1px solid var(--line, #334155)',
            marginBottom: '4px'
          }}>
            Ações Rápidas Globais
          </div>

          {acoes.map((item, idx) => (
            <div
              key={idx}
              onClick={() => executar(item.rota)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 10px',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'background 0.1s ease',
                marginBottom: '2px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.15)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontSize: '16px' }}>{item.icone}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text, #f8fafc)' }}>
                  {item.titulo}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--muted, #94a3b8)' }}>
                  {item.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
