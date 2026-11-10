import React, { useState } from 'react';
import { Moon, CheckCircle2, AlertTriangle, ShieldCheck, RefreshCw } from 'lucide-react';

export default function AuditoriaNoturnaPanel({ toast }) {
  const [auditorias, setAuditorias] = useState([
    { id: 'AUD-NOT-01', setor: 'Perfumaria & Fórmulas Infantis', data: '10/11/2026 02:30', status: 'concluida', quebras: 0, conformidade: '100%' },
    { id: 'AUD-NOT-02', setor: 'Bebidas Destiladas & Whisky', data: '10/11/2026 03:15', status: 'concluida', quebras: 1, conformidade: '98.5%' },
    { id: 'AUD-NOT-03', setor: 'Açougue & Cortes Nobres (Vácuo)', data: '10/11/2026 04:00', status: 'concluida', quebras: 0, conformidade: '100%' }
  ]);

  return (
    <div className="super-card animate-fadeIn">
      <div className="super-card-header">
        <div>
          <div className="super-card-tag">FECHAMENTO OPERACIONAL · AUDITORIA NOTURNA DE GÔNDOLA</div>
          <h2 className="super-card-title">Auditoria Noturna de Alto Risco & Fechamento Diário</h2>
          <p className="super-card-subtitle">
            Conferência cega noturna das gôndolas de alto valor agregado (PAR) e conferência de trancamento de armários antifurto.
          </p>
        </div>
      </div>

      <div className="super-table-container">
        <table className="super-table">
          <thead>
            <tr>
              <th>Setor de Alto Risco (PAR)</th>
              <th>Horário da Ronda</th>
              <th>Status da Auditoria</th>
              <th>Divergências Encontradas</th>
              <th>Índice de Acuracidade</th>
            </tr>
          </thead>
          <tbody>
            {auditorias.map(a => (
              <tr key={a.id}>
                <td><strong>{a.setor}</strong></td>
                <td>{a.data}</td>
                <td>
                  <span className="super-badge emerald">
                    <CheckCircle2 size={12} style={{ marginRight: 4 }} />
                    Concluída com Sucesso
                  </span>
                </td>
                <td>{a.quebras === 0 ? 'Nenhuma quebra' : `${a.quebras} item avariado`}</td>
                <td><strong style={{ color: '#10b981' }}>{a.conformidade}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
