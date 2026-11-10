import React, { useState } from 'react';
import { ShoppingBag, CheckCircle2, Clock, MapPin, Smartphone } from 'lucide-react';

export default function PickingEcommercePanel({ toast }) {
  const [pedidosPicking, setPedidosPicking] = useState([
    { id: 'PICK-901', canal: 'App Kytto / WhatsApp', cliente: 'Renata Albuquerque', itens: 14, status: 'separando', coletor: 'Operador Lucas', tempo: '14 min' },
    { id: 'PICK-902', canal: 'Ifood Mercado', cliente: 'Bruno Castro', itens: 8, status: 'aguardando', coletor: 'Fila Aberta', tempo: '4 min' },
    { id: 'PICK-903', canal: 'Site Delivery', cliente: 'Juliana Pires', itens: 22, status: 'concluido', coletor: 'Operadora Carla', tempo: 'Concluído' }
  ]);

  const concluirSeparacao = (p) => {
    setPedidosPicking(pedidosPicking.map(item => item.id === p.id ? { ...item, status: 'concluido' } : item));
    if (toast) toast('Separação e conferência concluída para o pedido ' + p.id, 'success');
  };

  return (
    <div className="super-card animate-fadeIn">
      <div className="super-card-header">
        <div>
          <div className="super-card-tag">DELIVERY & OMNICHANNEL · PICKING DE GÔNDOLA</div>
          <h2 className="super-card-title">Separação de Pedidos de E-commerce & Delivery</h2>
          <p className="super-card-subtitle">
            Roteirização de coleta por corredor para separação rápida de pedidos digitais via aplicativo ou coletor.
          </p>
        </div>
      </div>

      <div className="super-table-container">
        <table className="super-table">
          <thead>
            <tr>
              <th>ID do Pedido</th>
              <th>Canal de Venda</th>
              <th>Cliente Final</th>
              <th>Qtd Itens</th>
              <th>Operador / Coletor</th>
              <th>Status do Picking</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {pedidosPicking.map(p => (
              <tr key={p.id}>
                <td><strong>{p.id}</strong></td>
                <td>{p.canal}</td>
                <td>{p.cliente}</td>
                <td>{p.itens} itens</td>
                <td>{p.coletor}</td>
                <td>
                  <span className={`super-badge ${p.status === 'concluido' ? 'emerald' : p.status === 'separando' ? 'yellow' : 'blue'}`}>
                    ● {p.status.toUpperCase()}
                  </span>
                </td>
                <td>
                  {p.status !== 'concluido' ? (
                    <button className="super-btn super-btn-sm super-btn-primary" onClick={() => concluirSeparacao(p)}>
                      Concluir Separação
                    </button>
                  ) : (
                    <span style={{ fontSize: 12, color: '#10b981', fontWeight: 700 }}>Pronto para Entrega</span>
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
