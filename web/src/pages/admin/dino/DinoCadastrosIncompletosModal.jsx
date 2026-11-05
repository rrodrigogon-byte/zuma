import React, { useState } from 'react';
import Modal from '../../../components/Modal';
import { fmtR } from '../../../lib/api';

export default function DinoCadastrosIncompletosModal({ dados, loading, onClose, onEditarItem }) {
  const [filtroTipo, setFiltroTipo] = useState('todos');

  if (!dados && !loading) return null;

  const totais = dados?.totais || { semNcm: 0, semCusto: 0, semEan: 0, semTipo: 0, duplicados: 0 };
  const pendencias = dados?.pendencias || {};

  const itensFiltrados = () => {
    switch (filtroTipo) {
      case 'ncm': return pendencias.semNcm || [];
      case 'custo': return pendencias.semCusto || [];
      case 'ean': return pendencias.semEan || [];
      case 'tipo': return pendencias.semTipo || [];
      case 'duplicados': return pendencias.duplicados || [];
      default:
        // Une todas as pendências sem duplicação de ID
        const map = new Map();
        [
          ...(pendencias.semNcm || []),
          ...(pendencias.semCusto || []),
          ...(pendencias.semEan || []),
          ...(pendencias.semTipo || [])
        ].forEach(item => {
          if (!map.has(item.id)) map.set(item.id, item);
        });
        return Array.from(map.values());
    }
  };

  const lista = itensFiltrados();

  return (
    <Modal title="Auditoria de Cadastros Incompletos & Saneamento" onClose={onClose} width={880}>
      <div style={{ display: 'grid', gap: 16 }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
          Diagnóstico automatizado de conformidade fiscal e cadastral para produtos e serviços da empresa.
        </p>

        {/* Cards de Filtro Rápido */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          <div
            onClick={() => setFiltroTipo('ncm')}
            style={{
              padding: 12,
              borderRadius: 10,
              background: filtroTipo === 'ncm' ? 'rgba(239, 68, 68, 0.1)' : 'var(--card2, #f8fafc)',
              border: filtroTipo === 'ncm' ? '2px solid #ef4444' : '1px solid var(--line, #e2e8f0)',
              cursor: 'pointer',
              textAlign: 'center'
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, color: '#ef4444' }}>SEM NCM</div>
            <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{totais.semNcm}</div>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>Bloqueia NFC-e</div>
          </div>

          <div
            onClick={() => setFiltroTipo('custo')}
            style={{
              padding: 12,
              borderRadius: 10,
              background: filtroTipo === 'custo' ? 'rgba(245, 158, 11, 0.1)' : 'var(--card2, #f8fafc)',
              border: filtroTipo === 'custo' ? '2px solid #f59e0b' : '1px solid var(--line, #e2e8f0)',
              cursor: 'pointer',
              textAlign: 'center'
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b' }}>SEM CUSTO (R$ 0)</div>
            <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{totais.semCusto}</div>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>Distorce DRE</div>
          </div>

          <div
            onClick={() => setFiltroTipo('ean')}
            style={{
              padding: 12,
              borderRadius: 10,
              background: filtroTipo === 'ean' ? 'rgba(2, 132, 199, 0.1)' : 'var(--card2, #f8fafc)',
              border: filtroTipo === 'ean' ? '2px solid #0284c7' : '1px solid var(--line, #e2e8f0)',
              cursor: 'pointer',
              textAlign: 'center'
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, color: '#0284c7' }}>SEM EAN / BARRAS</div>
            <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{totais.semEan}</div>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>Impede leitor PDV</div>
          </div>

          <div
            onClick={() => setFiltroTipo('tipo')}
            style={{
              padding: 12,
              borderRadius: 10,
              background: filtroTipo === 'tipo' ? 'rgba(100, 116, 139, 0.1)' : 'var(--card2, #f8fafc)',
              border: filtroTipo === 'tipo' ? '2px solid #64748b' : '1px solid var(--line, #e2e8f0)',
              cursor: 'pointer',
              textAlign: 'center'
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b' }}>SEM TIPO</div>
            <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{totais.semTipo}</div>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>Prod/Serv/Plano</div>
          </div>

          <div
            onClick={() => setFiltroTipo('duplicados')}
            style={{
              padding: 12,
              borderRadius: 10,
              background: filtroTipo === 'duplicados' ? 'rgba(168, 85, 247, 0.1)' : 'var(--card2, #f8fafc)',
              border: filtroTipo === 'duplicados' ? '2px solid #a855f7' : '1px solid var(--line, #e2e8f0)',
              cursor: 'pointer',
              textAlign: 'center'
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, color: '#a855f7' }}>DUPLICADOS</div>
            <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{totais.duplicados}</div>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>Mesmo nome</div>
          </div>
        </div>

        {/* Tabela de Itens Pendentes */}
        <div style={{ maxHeight: 380, overflowY: 'auto', border: '1px solid var(--line, #e2e8f0)', borderRadius: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--card2, #f8fafc)', borderBottom: '1px solid var(--line)' }}>
                <th style={{ textAlign: 'left', padding: '10px 12px' }}>Produto / Item</th>
                <th style={{ textAlign: 'left', padding: '10px 12px' }}>Pendência Detectada</th>
                <th style={{ textAlign: 'center', padding: '10px 12px' }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', padding: 24, color: '#10b981', fontWeight: 700 }}>
                    ✅ Nenhum item pendente nesta categoria! Todos os cadastros estão conformes.
                  </td>
                </tr>
              ) : (
                lista.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <strong>{item.nome}</strong>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>ID: {item.id}</div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 12, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontWeight: 700, fontSize: 11 }}>
                        {item.motivo || 'Cadastro incompleto'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <button
                        type="button"
                        style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#0284c7', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                        onClick={() => {
                          onClose();
                          onEditarItem?.(item);
                        }}
                      >
                        Corrigir na Ficha
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 10 }}>
          <button type="button" style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', cursor: 'pointer', fontWeight: 700 }} onClick={onClose}>
            Fechar Auditoria
          </button>
        </div>
      </div>
    </Modal>
  );
}
