import React, { useState, useEffect } from 'react';
import { UtensilsCrossed, Clock, CheckCircle2, AlertCircle, ChefHat } from 'lucide-react';
import { api } from '../../../lib/api';

export default function RotisseriaKdsPanel({ toast }) {
  const [pedidos, setPedidos] = useState([
    { id: 'ROT-101', item: 'Frango Assado com Batatas (1 un)', cliente: 'Mesa 04 / Balcão', hora: '11:45', status: 'em_preparo', tempoDecorrido: '18 min' },
    { id: 'ROT-102', item: 'Lasanha à Bolonhesa Familiar (1.2kg)', cliente: 'Retirada 12:30', hora: '11:50', status: 'pronto', tempoDecorrido: '13 min' },
    { id: 'ROT-103', item: 'Costela Suína com Barbecue (800g)', cliente: 'Comanda 19', hora: '12:02', status: 'fila', tempoDecorrido: '2 min' }
  ]);

  const avancarStatus = (pId) => {
    setPedidos(pedidos.map(p => {
      if (p.id === pId) {
        const proximo = p.status === 'fila' ? 'em_preparo' : p.status === 'em_preparo' ? 'pronto' : 'entregue';
        return { ...p, status: proximo };
      }
      return p;
    }));
    if (toast) toast('Status do pedido atualizado no monitor KDS!', 'success');
  };

  return (
    <div className="super-card animate-fadeIn">
      <div className="super-card-header">
        <div>
          <div className="super-card-tag">PRODUÇÃO PRÓPRIA · ROTISSERIA & COZINHA (KDS)</div>
          <h2 className="super-card-title">Monitor KDS da Rotisseria & Alimentos Prontos</h2>
          <p className="super-card-subtitle">
            Fila de preparação de frangos assados, pratos prontos e refeições quentes com controle de tempo.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        {pedidos.map(p => (
          <div key={p.id} style={{
            background: '#fff',
            border: `2px solid ${p.status === 'pronto' ? '#10b981' : p.status === 'em_preparo' ? '#FF6B2C' : '#cbd5e1'}`,
            borderRadius: 12,
            padding: 16,
            boxShadow: '0 4px 12px rgba(0,0,0,0.04)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <strong style={{ fontSize: 16, color: 'var(--navy)' }}>{p.id}</strong>
              <span className={`super-badge ${p.status === 'pronto' ? 'emerald' : p.status === 'em_preparo' ? 'yellow' : 'blue'}`}>
                ● {p.status.toUpperCase()}
              </span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, margin: '8px 0' }}>{p.item}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
              Destino: <strong>{p.cliente}</strong> · Entrada: {p.hora} ({p.tempoDecorrido})
            </div>
            <button
              className="super-btn super-btn-sm"
              style={{
                width: '100%',
                justifyContent: 'center',
                background: p.status === 'pronto' ? '#10b981' : '#FF6B2C',
                color: '#fff',
                border: 'none',
                fontWeight: 800
              }}
              onClick={() => avancarStatus(p.id)}
            >
              {p.status === 'fila' ? 'Iniciar Preparo' : p.status === 'em_preparo' ? 'Marcar como Pronto' : 'Entregar ao Cliente'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
