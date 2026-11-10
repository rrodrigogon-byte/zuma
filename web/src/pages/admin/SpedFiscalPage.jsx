import React from 'react';
import SpedFiscalBlocoKPanel from './fiscal/SpedFiscalBlocoKPanel';
import { useToast } from '../../hooks/useToast';

export default function SpedFiscalPage() {
  const { toast } = useToast();
  return (
    <div className="dadm-page" style={{ padding: '24px 32px' }}>
      <header className="dadm-head" style={{ marginBottom: 12 }}>
        <div className="dadm-eyebrow">Fiscal & EFD ICMS/IPI · ERP Kytto</div>
        <h1 style={{ margin: '4px 0 0 0', fontSize: 24, fontWeight: 800 }}>SPED Fiscal — Bloco K</h1>
        <p style={{ margin: '4px 0 0 0', color: 'var(--muted)' }}>
          Livro de Registro de Controle da Produção e do Estoque Escriturado.
        </p>
      </header>
      <SpedFiscalBlocoKPanel toast={toast} />
    </div>
  );
}
