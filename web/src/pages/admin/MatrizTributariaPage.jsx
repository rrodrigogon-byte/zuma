import React from 'react';
import MatrizTributariaPanel from './fiscal/MatrizTributariaPanel';
import { useToast } from '../../hooks/useToast';

export default function MatrizTributariaPage() {
  const { toast } = useToast();
  return (
    <div className="dadm-page" style={{ padding: '24px 32px' }}>
      <header className="dadm-head" style={{ marginBottom: 12 }}>
        <div className="dadm-eyebrow">Tributação & Inteligência Fiscal · ERP Kytto</div>
        <h1 style={{ margin: '4px 0 0 0', fontSize: 24, fontWeight: 800 }}>Matriz Tributária Global</h1>
        <p style={{ margin: '4px 0 0 0', color: 'var(--muted)' }}>
          Regras de ICMS, PIS, COFINS, NCM, CEST e Substituição Tributária (ST) para todas as empresas.
        </p>
      </header>
      <MatrizTributariaPanel toast={toast} />
    </div>
  );
}
