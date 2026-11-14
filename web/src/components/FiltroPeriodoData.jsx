import React, { useState, useEffect } from 'react';
import { Calendar, ChevronDown, Download, RefreshCw, Filter } from 'lucide-react';

export const PERIODOS_PADRAO = [
  { id: 'hoje', label: 'Hoje', dias: 1, fator: 1 / 30 },
  { id: 'ontem', label: 'Ontem', dias: 1, fator: 1 / 30 },
  { id: '7d', label: 'Últimos 7 dias', dias: 7, fator: 7 / 30 },
  { id: 'mes_atual', label: 'Mês Atual (Nov/26)', dias: 30, fator: 1.0 },
  { id: 'mes_anterior', label: 'Mês Anterior (Out/26)', dias: 31, fator: 0.94 },
  { id: 'ano_atual', label: 'Ano de 2026 (YTD)', dias: 318, fator: 10.6 },
  { id: 'personalizado', label: 'Personalizado', dias: 0, fator: 1.0 }
];

export default function FiltroPeriodoData({
  periodoSelecionado = 'mes_atual',
  onPeriodoChange,
  dataInicio = '2026-11-01',
  dataFim = '2026-11-30',
  onDatasChange,
  onExportar,
  titulo = 'Período de Apuração'
}) {
  const [periodo, setPeriodo] = useState(periodoSelecionado);
  const [dtInicio, setDtInicio] = useState(dataInicio);
  const [dtFim, setDtFim] = useState(dataFim);

  const handlePeriodoSelect = (id) => {
    setPeriodo(id);
    const hoje = new Date(2026, 10, 14); // 14/11/2026
    const format = (d) => d.toISOString().split('T')[0];

    let ini = '2026-11-01';
    let fim = '2026-11-14';

    if (id === 'hoje') {
      ini = '2026-11-14';
      fim = '2026-11-14';
    } else if (id === 'ontem') {
      ini = '2026-11-13';
      fim = '2026-11-13';
    } else if (id === '7d') {
      ini = '2026-11-07';
      fim = '2026-11-14';
    } else if (id === 'mes_atual') {
      ini = '2026-11-01';
      fim = '2026-11-30';
    } else if (id === 'mes_anterior') {
      ini = '2026-10-01';
      fim = '2026-10-31';
    } else if (id === 'ano_atual') {
      ini = '2026-01-01';
      fim = '2026-11-14';
    }

    setDtInicio(ini);
    setDtFim(fim);

    if (onPeriodoChange) {
      const config = PERIODOS_PADRAO.find(p => p.id === id) || { id, fator: 1.0 };
      onPeriodoChange(id, config);
    }
    if (onDatasChange) onDatasChange(ini, fim);
  };

  const handleDataManual = (tipo, val) => {
    if (tipo === 'inicio') setDtInicio(val);
    if (tipo === 'fim') setDtFim(val);
    setPeriodo('personalizado');
    if (onPeriodoChange) onPeriodoChange('personalizado', { id: 'personalizado', fator: 1.0 });
    if (onDatasChange) {
      onDatasChange(tipo === 'inicio' ? val : dtInicio, tipo === 'fim' ? val : dtFim);
    }
  };

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.03)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: 12,
      padding: '12px 16px',
      marginBottom: 18,
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12
    }}>
      {/* Lado Esquerdo: Título & Botões Rápidos */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 8, color: 'var(--text-muted, #94A3B8)', fontSize: 13, fontWeight: 700 }}>
          <Calendar size={15} color="#FF7A00" />
          <span>{titulo}:</span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {PERIODOS_PADRAO.map(item => {
            const ativo = periodo === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handlePeriodoSelect(item.id)}
                style={{
                  background: ativo ? '#FF7A00' : 'rgba(255, 255, 255, 0.06)',
                  color: ativo ? '#FFF' : 'var(--text-main, #E2E8F0)',
                  border: ativo ? '1px solid #FF7A00' : '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 6,
                  padding: '5px 10px',
                  fontSize: 12,
                  fontWeight: ativo ? 800 : 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lado Direito: Campos de Data & Exportação */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="date"
            value={dtInicio}
            onChange={(e) => handleDataManual('inicio', e.target.value)}
            style={{
              background: '#0D0805',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 6,
              color: '#FFF',
              padding: '4px 8px',
              fontSize: 12,
              fontWeight: 600
            }}
          />
          <span style={{ color: '#94A3B8', fontSize: 12 }}>até</span>
          <input
            type="date"
            value={dtFim}
            onChange={(e) => handleDataManual('fim', e.target.value)}
            style={{
              background: '#0D0805',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 6,
              color: '#FFF',
              padding: '4px 8px',
              fontSize: 12,
              fontWeight: 600
            }}
          />
        </div>

        {onExportar && (
          <button
            type="button"
            onClick={onExportar}
            style={{
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#10B981',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 6,
              padding: '5px 12px',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Download size={13} /> Exportar Relatório
          </button>
        )}
      </div>
    </div>
  );
}
