import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, Eye, CheckCircle2, XCircle } from 'lucide-react';

export default function AuditoriaFraudePdvPanel({ toast }) {
  const [eventos, setEventos] = useState([
    { id: 'FRAUDE-01', tipo: 'CANCELAMENTO_SUBSEQUENTE', terminal: 'PDV-02', operador: 'Operador 104', detalhe: '3 cancelamentos de itens consecutivos de alto valor após leitura do cliente', gravidade: 'alta', status: 'em_analise', hora: '11:14' },
    { id: 'FRAUDE-02', tipo: 'GAVETA_ABERTA_SEM_VENDA', terminal: 'PDV-01', operador: 'Operador 101', detalhe: 'Abertura manual de gaveta de cédulas sem emissão de cupom fiscal', gravidade: 'media', status: 'justificado', hora: '09:42' },
    { id: 'FRAUDE-03', tipo: 'BIPES_ULTRARRAPIDOS', terminal: 'PDV-03', operador: 'Operador 108', detalhe: 'Leitura de 8 itens em menos de 2 segundos (possível leitor em loop)', gravidade: 'baixa', status: 'normal', hora: '08:50' }
  ]);

  const julgarEvento = (evId, decisao) => {
    setEventos(eventos.map(e => e.id === evId ? { ...e, status: decisao } : e));
    if (toast) toast(`Evento auditado com decisão: ${decisao.toUpperCase()}`, 'info');
  };

  return (
    <div className="super-card animate-fadeIn">
      <div className="super-card-header">
        <div>
          <div className="super-card-tag">PREVENÇÃO DE PERDAS · SEGURANÇA & FRAUDE EM FRENTE DE CAIXA</div>
          <h2 className="super-card-title">Auditoria de Fraude & Anomalias em Frente de Caixa (PDV)</h2>
          <p className="super-card-subtitle">
            Detecção por telemetria de comportamentos suspeitos em caixas: cancelamentos anormais, abertura indevida e trocas de produto.
          </p>
        </div>
      </div>

      <div className="super-table-container">
        <table className="super-table">
          <thead>
            <tr>
              <th>ID Ocorrência</th>
              <th>Padrão Detectado</th>
              <th>Terminal / Operador</th>
              <th>Descrição do Comportamento</th>
              <th>Risco</th>
              <th>Julgamento</th>
              <th>Ações da Prevenção</th>
            </tr>
          </thead>
          <tbody>
            {eventos.map(e => (
              <tr key={e.id}>
                <td><strong>{e.id}</strong></td>
                <td>
                  <span className={`super-badge ${e.gravidade === 'alta' ? 'red' : e.gravidade === 'media' ? 'yellow' : 'blue'}`}>
                    ● {e.tipo.replace(/_/g, ' ')}
                  </span>
                </td>
                <td>
                  <strong>{e.terminal}</strong>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{e.operador} · {e.hora}</div>
                </td>
                <td style={{ fontSize: 12 }}>{e.detalhe}</td>
                <td>
                  <span style={{
                    fontWeight: 800,
                    color: e.gravidade === 'alta' ? '#dc2626' : e.gravidade === 'media' ? '#f59e0b' : '#0284c7'
                  }}>
                    {e.gravidade.toUpperCase()}
                  </span>
                </td>
                <td>
                  <span className={`super-badge ${e.status === 'em_analise' ? 'yellow' : e.status === 'justificado' ? 'emerald' : 'blue'}`}>
                    {e.status.toUpperCase()}
                  </span>
                </td>
                <td>
                  {e.status === 'em_analise' ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="super-btn super-btn-sm super-btn-primary" onClick={() => julgarEvento(e.id, 'fraude_confirmada')}>
                        Confirmar
                      </button>
                      <button className="super-btn super-btn-sm super-btn-outline" onClick={() => julgarEvento(e.id, 'justificado')}>
                        Justificar
                      </button>
                    </div>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>Concluído</span>
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
