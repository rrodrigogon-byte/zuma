import React, { useState, useEffect } from 'react';
import { Tv, Play, CheckCircle2, AlertTriangle, ShieldCheck, RefreshCw, Barcode, Scale, CreditCard, QrCode } from 'lucide-react';
import { api } from '../../../lib/api';

export default function SelfCheckoutTotemPanel({ toast }) {
  const [terminaisTotem, setTerminaisTotem] = useState([
    { id: 'TOTEM-01', nome: 'Totem Autoatendimento 01 - Entrada', ip: '192.168.1.101', status: 'operando', balancaPeso: '0.000 kg', cupomAtual: 142, ultimoBi: '12:34:10' },
    { id: 'TOTEM-02', nome: 'Totem Autoatendimento 02 - Central', ip: '192.168.1.102', status: 'operando', balancaPeso: '0.000 kg', cupomAtual: 189, ultimoBi: '12:33:45' },
    { id: 'TOTEM-03', nome: 'Totem Autoatendimento 03 - Saída Express', ip: '192.168.1.103', status: 'aguardando_cliente', balancaPeso: '0.000 kg', cupomAtual: 0, ultimoBi: '12:20:00' }
  ]);
  const [travaBalancaAtiva, setTravaBalancaAtiva] = useState(true);

  return (
    <div className="super-card animate-fadeIn">
      <div className="super-card-header">
        <div>
          <div className="super-card-tag">FRENTE DE CAIXA · AUTOATENDIMENTO (SELF-CHECKOUT)</div>
          <h2 className="super-card-title">Monitor de Totens de Autoatendimento</h2>
          <p className="super-card-subtitle">
            Gerenciamento de terminais autônomos com balança de conferência no prato e TEF/Pix síncrono.
          </p>
        </div>
        <button
          className="super-btn super-btn-outline"
          onClick={() => {
            setTravaBalancaAtiva(!travaBalancaAtiva);
            if (toast) toast(travaBalancaAtiva ? 'Trava de balança desativada' : 'Trava de balança de conferência ativada!', 'info');
          }}
        >
          <Scale size={16} />
          {travaBalancaAtiva ? 'Balança de Conferência: ATIVA' : 'Balança de Conferência: DESATIVADA'}
        </button>
      </div>

      <div className="super-kpi-grid">
        <div className="super-kpi-card">
          <div className="super-kpi-title">Totens em Operação</div>
          <div className="super-kpi-value text-emerald">3 Terminais</div>
          <div className="super-kpi-hint">100% de disponibilidade</div>
        </div>
        <div className="super-kpi-card">
          <div className="super-kpi-title">Segurança Antifurto</div>
          <div className="super-kpi-value text-blue">Balança Ativa</div>
          <div className="super-kpi-hint">Tolerância: ± 5g por bipe</div>
        </div>
        <div className="super-kpi-card">
          <div className="super-kpi-title">Tempo Médio de Atendimento</div>
          <div className="super-kpi-value text-navy">1m 14s</div>
          <div className="super-kpi-hint">Fila rápida de até 15 volumes</div>
        </div>
        <div className="super-kpi-card">
          <div className="super-kpi-title">Pagamentos Aceitos</div>
          <div className="super-kpi-value text-purple">TEF + Pix</div>
          <div className="super-kpi-hint">Sem manuseio de cédulas</div>
        </div>
      </div>

      <div className="super-table-container">
        <table className="super-table">
          <thead>
            <tr>
              <th>Identificação do Terminal</th>
              <th>Endereço IP</th>
              <th>Balança de Conferência</th>
              <th>Status do Totem</th>
              <th>Último Bipe</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {terminaisTotem.map(t => (
              <tr key={t.id}>
                <td>
                  <strong>{t.nome}</strong>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Código: {t.id}</div>
                </td>
                <td><code>{t.ip}</code></td>
                <td>
                  <span className="super-badge blue">
                    <Scale size={12} style={{ marginRight: 4 }} />
                    {t.balancaPeso}
                  </span>
                </td>
                <td>
                  <span className={`super-badge ${t.status === 'operando' ? 'emerald' : 'yellow'}`}>
                    ● {t.status === 'operando' ? 'Em Atendimento' : 'Livre / Aguardando'}
                  </span>
                </td>
                <td style={{ fontSize: 12 }}>{t.ultimoBi}</td>
                <td>
                  <button
                    className="super-btn super-btn-sm super-btn-outline"
                    onClick={() => {
                      window.open('/pdv?modo=totem&terminal=' + t.id, '_blank');
                    }}
                  >
                    <Play size={12} /> Abrir Tela Touch
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
