import React from 'react';
import TesourariaCofrePanel from './financeiro/TesourariaCofrePanel';
import { useToast } from '../../hooks/useToast';

export default function TesourariaCofrePage() {
  const { toast } = useToast();
  return (
    <div className="dadm-page" style={{ padding: '24px 32px' }}>
      <header className="dadm-head" style={{ marginBottom: 12 }}>
        <div className="dadm-eyebrow">Tesouraria Central · ERP Kytto</div>
        <h1 style={{ margin: '4px 0 0 0', fontSize: 24, fontWeight: 800 }}>Tesouraria, Cofre & Carro-Forte</h1>
        <p style={{ margin: '4px 0 0 0', color: 'var(--muted)' }}>
          Custódia de numerário físico, sangrias de caixa e coleta blindada de malotes Brinks / Prosegur.
        </p>
      </header>
      <TesourariaCofrePanel toast={toast} />
    </div>
  );
}
