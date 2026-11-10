import React from 'react';
import ConciliacaoTefPixPanel from './financeiro/ConciliacaoTefPixPanel';
import { useToast } from '../../hooks/useToast';

export default function ConciliacaoTefPage() {
  const { toast } = useToast();
  return (
    <div className="dadm-page" style={{ padding: '24px 32px' }}>
      <header className="dadm-head" style={{ marginBottom: 12 }}>
        <div className="dadm-eyebrow">Financeiro & Cartões · ERP Kytto</div>
        <h1 style={{ margin: '4px 0 0 0', fontSize: 24, fontWeight: 800 }}>Conciliação TEF, Cartões & PIX</h1>
        <p style={{ margin: '4px 0 0 0', color: 'var(--muted)' }}>
          Auditoria eletrônica de taxas MDR contratuais, repasses e adquirentes Stone, Cielo, Rede e PagBank.
        </p>
      </header>
      <ConciliacaoTefPixPanel toast={toast} />
    </div>
  );
}
