import React from 'react';
import DreEbitdaCompletoPanel from './financeiro/DreEbitdaCompletoPanel';
import { useToast } from '../../hooks/useToast';

export default function DreEbitdaPage() {
  const { toast } = useToast();
  return (
    <div className="dadm-page" style={{ padding: '24px 32px' }}>
      <header className="dadm-head" style={{ marginBottom: 12 }}>
        <div className="dadm-eyebrow">Controladoria & DRE · ERP Kytto</div>
        <h1 style={{ margin: '4px 0 0 0', fontSize: 24, fontWeight: 800 }}>DRE & EBITDA Operacional</h1>
        <p style={{ margin: '4px 0 0 0', color: 'var(--muted)' }}>
          Demonstrativo do Resultado do Exercício com margem bruta, custos variáveis, CMV e geração de caixa.
        </p>
      </header>
      <DreEbitdaCompletoPanel toast={toast} />
    </div>
  );
}
