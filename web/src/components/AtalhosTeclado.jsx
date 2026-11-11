import React, { useEffect } from 'react';

export function AtalhosTeclado({
  aoBuscarRapido,
  aoDesconto,
  aoFinalizarPagamento,
  aoCancelarModal,
  exibirLegenda = true,
}) {
  useEffect(() => {
    const handler = (ev) => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') {
        if (typeof aoBuscarRapido === 'function') {
          ev.preventDefault();
          aoBuscarRapido();
        }
        return;
      }
      if (ev.key === 'F2' && typeof aoBuscarRapido === 'function') {
        ev.preventDefault();
        aoBuscarRapido();
      } else if (ev.key === 'F4' && typeof aoDesconto === 'function') {
        ev.preventDefault();
        aoDesconto();
      } else if (ev.key === 'F9' && typeof aoFinalizarPagamento === 'function') {
        ev.preventDefault();
        aoFinalizarPagamento();
      } else if (ev.key === 'Escape' && typeof aoCancelarModal === 'function') {
        aoCancelarModal();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [aoBuscarRapido, aoDesconto, aoFinalizarPagamento, aoCancelarModal]);

  if (!exibirLegenda) return null;

  const teclas = [
    { tecla: 'Ctrl+K / F2', descricao: 'Busca rápida' },
    { tecla: 'F4', descricao: 'Desconto' },
    { tecla: 'F9', descricao: 'Finalizar pagamento' },
    { tecla: 'Esc', descricao: 'Fechar janela' },
  ];

  return (
    <div
      aria-label="Atalhos de teclado disponíveis"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 10,
        alignItems: 'center',
        fontSize: 12,
        color: '#475569',
        padding: '6px 10px',
        borderRadius: 8,
        background: 'rgba(148, 163, 184, 0.12)',
      }}
    >
      {teclas.map((t) => (
        <span key={t.tecla} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <kbd
            style={{
              padding: '2px 6px',
              borderRadius: 4,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              fontWeight: 700,
              fontSize: 11,
              color: '#0f172a',
            }}
          >
            {t.tecla}
          </kbd>
          <span>{t.descricao}</span>
        </span>
      ))}
    </div>
  );
}

export default AtalhosTeclado;
