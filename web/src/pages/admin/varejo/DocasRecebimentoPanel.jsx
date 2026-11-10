import React, { useState } from 'react';
import { Truck, Thermometer, CheckCircle2, Clock, AlertTriangle, FileText } from 'lucide-react';

export default function DocasRecebimentoPanel({ toast }) {
  const [cargas, setCargas] = useState([
    { id: 'DOCA-01', fornecedor: 'Ambev Brasil Distribuição', nfe: 'NFe 881.203', volume: '18 paletes', status: 'conferencia', temperatura: 'Ambiente (22°C)', chegada: '10:30' },
    { id: 'DOCA-02', fornecedor: 'JBS Friboi Alimentos', nfe: 'NFe 451.982', volume: '12 paletes', status: 'descarregando', temperatura: 'Refrigerado (2.8°C - OK)', chegada: '11:15' },
    { id: 'DOCA-03', fornecedor: 'M. Dias Branco Massas', nfe: 'NFe 190.231', volume: '24 paletes', status: 'agendado', temperatura: 'Ambiente', chegada: 'Previsto 14:00' }
  ]);

  return (
    <div className="super-card animate-fadeIn">
      <div className="super-card-header">
        <div>
          <div className="super-card-tag">LOGÍSTICA DE ENTRADA · RECEBIMENTO & DOCAS</div>
          <h2 className="super-card-title">Gestão de Docas, Agendamento & Conferência Cega</h2>
          <p className="super-card-subtitle">
            Controle de portaria, agendamento de carretas, laudo de temperatura frigorificada e conferência com coletor.
          </p>
        </div>
      </div>

      <div className="super-table-container">
        <table className="super-table">
          <thead>
            <tr>
              <th>Doca / Baia</th>
              <th>Fornecedor / Indústria</th>
              <th>Nota Fiscal (NF-e)</th>
              <th>Carga & Volume</th>
              <th>Laudo Térmico</th>
              <th>Status do Recebimento</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {cargas.map(c => (
              <tr key={c.id}>
                <td><strong>{c.id}</strong></td>
                <td>{c.fornecedor}</td>
                <td><code>{c.nfe}</code></td>
                <td>{c.volume}</td>
                <td>
                  <span className="super-badge blue">
                    <Thermometer size={12} style={{ marginRight: 4 }} />
                    {c.temperatura}
                  </span>
                </td>
                <td>
                  <span className={`super-badge ${c.status === 'conferencia' ? 'yellow' : c.status === 'descarregando' ? 'blue' : 'emerald'}`}>
                    ● {c.status.toUpperCase()}
                  </span>
                </td>
                <td>
                  <button
                    className="super-btn super-btn-sm super-btn-outline"
                    onClick={() => {
                      if (toast) toast('Conferência cega validada para ' + c.nfe, 'success');
                    }}
                  >
                    Conferir Cargas
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
