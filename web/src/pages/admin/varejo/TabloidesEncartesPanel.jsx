import React, { useState } from 'react';
import { Percent, Send, FileText, CheckCircle2, Plus, Calendar } from 'lucide-react';
import { api } from '../../../lib/api';

export default function TabloidesEncartesPanel({ toast }) {
  const [tabloides, setTabloides] = useState([
    { id: 'TAB-44', titulo: 'Super Terça & Quarta do Hortifrúti', vigencia: '10/11/2026 a 11/11/2026', totalItens: 28, canal: 'WhatsApp Clube (1.840 clientes)', status: 'ativo' },
    { id: 'TAB-45', titulo: 'Festival de Carnes do Fim de Semana', vigencia: '13/11/2026 a 15/11/2026', totalItens: 16, canal: 'Encarte PDF + Redes Sociais', status: 'planejamento' }
  ]);

  const dispararWhatsApp = (tab) => {
    if (toast) toast(`Disparo programado do tabloide "${tab.titulo}" para os clientes do Clube!`, 'success');
  };

  return (
    <div className="super-card animate-fadeIn">
      <div className="super-card-header">
        <div>
          <div className="super-card-tag">MARKETING & VENDAS · TABLOIDES & ENCARTE DIGITAL</div>
          <h2 className="super-card-title">Gestão de Tabloides, Encartes & Campanhas WhatsApp</h2>
          <p className="super-card-subtitle">
            Criação de encartes de ofertas, geração de folhetos em PDF e disparo em massa no WhatsApp para a base fidelizada.
          </p>
        </div>
      </div>

      <div className="super-table-container">
        <table className="super-table">
          <thead>
            <tr>
              <th>Identificação do Tabloide</th>
              <th>Vigência da Campanha</th>
              <th>Total de Itens em Oferta</th>
              <th>Canal de Distribuição</th>
              <th>Status</th>
              <th>Ações de Disparo</th>
            </tr>
          </thead>
          <tbody>
            {tabloides.map(t => (
              <tr key={t.id}>
                <td>
                  <strong>{t.titulo}</strong>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Código: {t.id}</div>
                </td>
                <td>
                  <span style={{ fontSize: 12 }}>
                    <Calendar size={12} style={{ marginRight: 4, display: 'inline' }} />
                    {t.vigencia}
                  </span>
                </td>
                <td><strong>{t.totalItens} ofertas</strong></td>
                <td style={{ fontSize: 12 }}>{t.canal}</td>
                <td>
                  <span className={`super-badge ${t.status === 'ativo' ? 'emerald' : 'yellow'}`}>
                    ● {t.status === 'ativo' ? 'Ativo na Loja' : 'Em Planejamento'}
                  </span>
                </td>
                <td>
                  <button className="super-btn super-btn-sm super-btn-primary" onClick={() => dispararWhatsApp(t)}>
                    <Send size={12} /> Disparar WhatsApp
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
