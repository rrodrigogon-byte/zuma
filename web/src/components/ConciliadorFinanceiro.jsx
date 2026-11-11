import React from 'react';
import { formatarMoeda } from '../lib/formatadores';

export function ConciliadorFinanceiro({
  agendamentosConcluidos = 0,
  comandasPagas = 0,
  comandasPagasNoPlano = 0,
  valorBrutoComandas = 0,
  valorLancadoCaixa = 0,
  divergencias = [],
}) {
  const diferencaCaixa = Number((Number(valorBrutoComandas || 0) - Number(valorLancadoCaixa || 0)).toFixed(2));
  const conciliado = divergencias.length === 0 && Math.abs(diferencaCaixa) <= 5;

  return (
    <section
      aria-label="Conciliação Financeira Agendamento, Comanda, Caixa e Repasse"
      style={{
        borderRadius: 12,
        border: conciliado ? '1px solid #10b981' : '1px solid #f59e0b',
        background: conciliado ? '#f0fdf4' : '#fffbeb',
        padding: 18,
        marginBottom: 16,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
            Conciliação Agendamento → Comanda → Caixa → Repasse
          </h4>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#475569' }}>
            Auditoria automática de integridade operacional e financeira da unidade
          </p>
        </div>
        <span
          style={{
            padding: '4px 10px',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 700,
            background: conciliado ? '#dcfce7' : '#fef3c7',
            color: conciliado ? '#166534' : '#92400e',
          }}
        >
          {conciliado ? '100% Conciliado' : `${divergencias.length} divergência(s) para revisão`}
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: 12,
          marginTop: 14,
        }}
      >
        <div style={{ background: '#ffffff', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 11.5, color: '#64748b' }}>Agendamentos Concluídos</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>{agendamentosConcluidos}</div>
        </div>
        <div style={{ background: '#ffffff', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 11.5, color: '#64748b' }}>Comandas Pagas (Total / Clube)</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
            {comandasPagas} <span style={{ fontSize: 12.5, fontWeight: 500, color: '#64748b' }}>({comandasPagasNoPlano} clube)</span>
          </div>
        </div>
        <div style={{ background: '#ffffff', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 11.5, color: '#64748b' }}>Total Bruto Comandas</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>{formatarMoeda(valorBrutoComandas)}</div>
        </div>
        <div style={{ background: '#ffffff', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 11.5, color: '#64748b' }}>Total Lançado no Caixa</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>{formatarMoeda(valorLancadoCaixa)}</div>
        </div>
      </div>
    </section>
  );
}

export default ConciliadorFinanceiro;
