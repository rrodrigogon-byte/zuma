import React, { useState } from 'react';
import { Layers, ArrowDownUp, Box, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../../../lib/api';

export default function WmsEnderecamentoPanel({ toast }) {
  const [enderecos, setEnderecos] = useState([
    { id: 'WMS-01', endereco: 'R-01.M-04.N-03', tipo: 'pulmao', produto: 'Arroz Tio João 5kg', saldoCaixas: 45, capacidade: 60, status: 'normal' },
    { id: 'WMS-02', endereco: 'R-01.M-04.N-01', tipo: 'gondola', produto: 'Arroz Tio João 5kg', saldoCaixas: 4, capacidade: 15, status: 'reabastecer' },
    { id: 'WMS-03', endereco: 'R-03.M-02.N-04', tipo: 'pulmao', produto: 'Óleo de Soja Soya 900ml', saldoCaixas: 80, capacidade: 100, status: 'normal' },
    { id: 'WMS-04', endereco: 'R-03.M-02.N-01', tipo: 'gondola', produto: 'Óleo de Soja Soya 900ml', saldoCaixas: 12, capacidade: 24, status: 'normal' }
  ]);

  const dispararOrdemReabastecimento = (end) => {
    if (toast) toast(`Ordem de descida de pulmão para gôndola gerada para ${end.produto}!`, 'success');
  };

  return (
    <div className="super-card animate-fadeIn">
      <div className="super-card-header">
        <div>
          <div className="super-card-tag">ARMAZÉM & DEPÓSITO · WMS (WAREHOUSE MANAGEMENT)</div>
          <h2 className="super-card-title">Endereçamento Triplo & Descida de Pulmão</h2>
          <p className="super-card-subtitle">
            Localização física tridimensional (Rua, Módulo, Nível) com separação inteligente entre estoque de pulmão e frente de gôndola.
          </p>
        </div>
      </div>

      <div className="super-table-container">
        <table className="super-table">
          <thead>
            <tr>
              <th>Endereço WMS</th>
              <th>Zona de Armazenagem</th>
              <th>Produto Vinculado</th>
              <th>Saldo em Caixas</th>
              <th>Ocupação</th>
              <th>Status do Ponto</th>
              <th>Ordem de Separação</th>
            </tr>
          </thead>
          <tbody>
            {enderecos.map(e => (
              <tr key={e.id}>
                <td><strong><code>{e.endereco}</code></strong></td>
                <td>
                  <span className={`super-badge ${e.tipo === 'pulmao' ? 'blue' : 'purple'}`}>
                    {e.tipo === 'pulmao' ? '▲ Pulmão Aéreo' : '▼ Frente de Gôndola (Picking)'}
                  </span>
                </td>
                <td>{e.produto}</td>
                <td style={{ fontWeight: 800 }}>{e.saldoCaixas} fardos/cx</td>
                <td>{Math.round((e.saldoCaixas / e.capacidade) * 100)}%</td>
                <td>
                  <span className={`super-badge ${e.status === 'reabastecer' ? 'red' : 'emerald'}`}>
                    ● {e.status === 'reabastecer' ? 'Ruptura Eminente' : 'Abastecido'}
                  </span>
                </td>
                <td>
                  {e.status === 'reabastecer' ? (
                    <button className="super-btn super-btn-sm super-btn-primary" onClick={() => dispararOrdemReabastecimento(e)}>
                      Descer Pulmão
                    </button>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
