import React, { useState } from 'react';
import { Download, RefreshCw, Sparkles, Filter, ChevronDown, ChevronUp, AlertTriangle, TrendingDown, Edit2 } from 'lucide-react';
const RelatorioRetornoProfissional = () => {
  const [dataAnaliseInicio, setDataAnaliseInicio] = useState('2026-08-01');
  const [dataAnaliseFim, setDataAnaliseFim] = useState('2026-08-31');
  const [dataRetornoInicio, setDataRetornoInicio] = useState('2026-09-01');
  const [dataRetornoFim, setDataRetornoFim] = useState('2026-10-26');
  const [expandedRow, setExpandedRow] = useState(null);
  const profissionais = [
    { id: 1, iniciais: 'GH', nome: 'Gustavo Henrique', analisados: 120, retencao: 85, perdidos: 18, receitaRisco: 1620.00, perfil: '⭐ Premium', clientesPerdidos: [{ nome: 'Carlos Silva', telefone: '(65) 9999-1111', ultimaVisita: '15/08/2026', ticket: 90 }] },
    { id: 2, iniciais: 'GC', nome: 'Guilherme Cunha', analisados: 95, retencao: 60, perdidos: 38, receitaRisco: 2280.00, perfil: '🏷️ Essencial', clientesPerdidos: [{ nome: 'João Pedro', telefone: '(65) 9999-3333', ultimaVisita: '02/08/2026', ticket: 60 }] },
    { id: 3, iniciais: 'BM', nome: 'Bruno Mendes', analisados: 80, retencao: 72, perdidos: 22, receitaRisco: 1320.00, perfil: '🏷️ Essencial', clientesPerdidos: [] },
    { id: 4, iniciais: 'AB', nome: 'Aize Barbara', analisados: 110, retencao: 90, perdidos: 11, receitaRisco: 1980.00, perfil: '⭐ Premium', clientesPerdidos: [] },
    { id: 5, iniciais: 'DI', nome: 'Dino', analisados: 53, retencao: 96, perdidos: 2, receitaRisco: 480.00, perfil: '⭐ Premium', clientesPerdidos: [] }
  ];
  
  const styles = {
    container: { padding: '24px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'var(--font)' },
    headerBox: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
    sup: { fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' },
    h1: { fontSize: '28px', fontWeight: 800, color: 'var(--text)', margin: '0 0 8px 0' },
    actions: { display: 'flex', gap: '12px' },
    btnOutline: { display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' },
    btnPrimary: { display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' },
    
    // AI Insight Card
    aiCard: { background: 'var(--card2)', borderRadius: '12px', border: '1px solid var(--border)', borderLeft: '4px solid var(--accent)', padding: '20px', marginBottom: '24px', position: 'relative', overflow: 'hidden', display: 'flex', gap: '20px', alignItems: 'flex-start' },
    aiIconBox: { background: '#F4EBFA', padding: '12px', borderRadius: '12px', display: 'flex' },
    aiContent: { flex: 1 },
    aiTitle: { fontSize: '16px', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text)' },
    aiText: { fontSize: '14px', lineHeight: '1.6', margin: '0 0 16px 0', color: 'var(--text)' },
    aiStrong: { fontWeight: 700, color: 'var(--text)' },
    aiBtnPrimary: { display: 'flex', alignItems: 'center', gap: '6px', padding: '0', background: 'transparent', color: 'var(--accent)', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '13px' },
    
    // Filter Card
    filterCard: { background: 'var(--surface)', borderRadius: '12px', padding: '24px', marginBottom: '24px', border: '1px solid var(--border)' },
    filterTitle: { fontSize: '16px', fontWeight: 700, margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text)' },
    filterGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' },
    filterGroup: { background: 'var(--bg)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' },
    label: { fontSize: '13px', fontWeight: 700, color: 'var(--text)', marginBottom: '12px', display: 'block' },
    inputRow: { display: 'flex', alignItems: 'center', gap: '12px' },
    input: { flex: 1, padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '14px', outline: 'none' },
    filterSub: { fontSize: '12px', color: 'var(--muted)', marginTop: '8px', display: 'block' },
    
    // KPI Cards
    kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' },
    kpiCard: { background: 'var(--surface)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' },
    kpiLabel: { fontSize: '12px', fontWeight: 600, color: 'var(--muted)', marginBottom: '8px', display: 'block' },
    kpiValue: { fontSize: '28px', fontWeight: 800, color: 'var(--text)', margin: 0 },
    kpiValueGreen: { fontSize: '28px', fontWeight: 800, color: '#10B981', margin: 0 },
    kpiValueRed: { fontSize: '28px', fontWeight: 800, color: 'var(--danger)', margin: 0 },
    kpiValueOrange: { fontSize: '28px', fontWeight: 800, color: 'var(--accent)', margin: 0 },
    kpiSub: { fontSize: '12px', color: 'var(--muted)', marginLeft: '6px', fontWeight: 600 },
    
    // Table
    tableCard: { background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' },
    table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
    th: { padding: '16px 20px', borderBottom: '1px solid var(--border)', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' },
    tr: { borderBottom: '1px solid var(--border)', transition: 'background 0.2s', cursor: 'pointer' },
    td: { padding: '16px 20px', verticalAlign: 'middle' },
    avatarBox: { display: 'flex', alignItems: 'center', gap: '12px' },
    avatar: { width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px' },
    profName: { margin: '0 0 2px 0', fontWeight: 600, color: 'var(--text)', fontSize: '14px' },
    profProfile: { margin: 0, fontSize: '12px', color: 'var(--muted)' },
    metricTitle: { fontSize: '16px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text)' },
    metricSub: { fontSize: '12px', color: 'var(--muted)', margin: 0 },
    expandedBox: { background: 'var(--bg)', padding: '24px', borderBottom: '1px solid var(--border)' },
    expandedTitle: { fontSize: '14px', fontWeight: 700, margin: '0 0 12px 0', color: 'var(--text)' },
    clienteList: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' },
    clienteCard: { background: 'var(--surface)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' },
    clienteName: { margin: '0 0 4px 0', fontWeight: 600, fontSize: '13px', color: 'var(--text)' }
  };
  return (
    <div style={styles.container}>
      <div style={styles.headerBox}>
        <div>
          <span style={styles.sup}>DINO · DINO-MATRIZ — BARBEARIA DINO</span>
          <h1 style={styles.h1}>0011 - Retorno por Profissional</h1>
        </div>
        <div style={styles.actions}>
          <button style={styles.btnOutline}><RefreshCw size={14} /> Atualizar</button>
          <button style={styles.btnPrimary}><Download size={14} /> Exportar CSV</button>
        </div>
      </div>
      
      <div style={styles.aiCard}>
        <div style={styles.aiIconBox}><Sparkles size={24} color="var(--accent)" /></div>
        <div style={styles.aiContent}>
          <h3 style={styles.aiTitle}>Insights da IA de Dino T-Rex</h3>
          <p style={styles.aiText}>
            A taxa de retorno geral caiu <strong style={styles.aiStrong}>5%</strong> neste período selecionado. O profissional <strong style={styles.aiStrong}>Gustavo</strong> possui a maior retenção (85%), mas <strong style={styles.aiStrong}>15 clientes de ticket alto</strong> não retornaram após o último corte. Sugerimos uma campanha de reativação (Modelo Premium) para este grupo específico.
          </p>
          <button style={styles.aiBtnPrimary}><Edit2 size={14} /> Gerar campanha de resgate via WhatsApp agora</button>
        </div>
      </div>
      
      <div style={styles.filterCard}>
        <h3 style={styles.filterTitle}><Filter size={16} /> Filtros de Período Inteligentes</h3>
        <div style={styles.filterGrid}>
          <div style={styles.filterGroup}>
            <span style={styles.label}>1. Data da Última Visita (Análise)</span>
            <div style={styles.inputRow}>
              <input type="date" value={dataAnaliseInicio} onChange={e => setDataAnaliseInicio(e.target.value)} style={styles.input} />
              <span style={{color: 'var(--muted)', fontSize: '13px'}}>até</span>
              <input type="date" value={dataAnaliseFim} onChange={e => setDataAnaliseFim(e.target.value)} style={styles.input} />
            </div>
            <span style={styles.filterSub}>Seleciona clientes que vieram neste período.</span>
          </div>
          <div style={{...styles.filterGroup, background: 'rgba(255, 107, 44, 0.05)', borderColor: 'rgba(255, 107, 44, 0.2)'}}>
            <span style={{...styles.label, color: 'var(--accent)'}}>2. Período de Retorno Esperado</span>
            <div style={styles.inputRow}>
              <input type="date" value={dataRetornoInicio} onChange={e => setDataRetornoInicio(e.target.value)} style={styles.input} />
              <span style={{color: 'var(--muted)', fontSize: '13px'}}>até</span>
              <input type="date" value={dataRetornoFim} onChange={e => setDataRetornoFim(e.target.value)} style={styles.input} />
            </div>
            <span style={{...styles.filterSub, color: 'var(--accent)'}}>Verifica se os clientes acima retornaram nesta data.</span>
          </div>
        </div>
      </div>
      <div style={styles.kpiGrid}>
        <div style={styles.kpiCard}>
          <span style={styles.kpiLabel}>Clientes Analisados</span>
          <h2 style={styles.kpiValue}>458</h2>
        </div>
        <div style={styles.kpiCard}>
          <span style={styles.kpiLabel}>Retornaram</span>
          <h2 style={styles.kpiValueGreen}>312 <span style={styles.kpiSub}>(68%)</span></h2>
        </div>
        <div style={styles.kpiCard}>
          <span style={styles.kpiLabel}>Não Retornaram (Perdidos)</span>
          <h2 style={styles.kpiValueRed}>146 <span style={styles.kpiSub}>(32%)</span></h2>
        </div>
        <div style={styles.kpiCard}>
          <span style={styles.kpiLabel}>Receita em Risco Estimada</span>
          <h2 style={styles.kpiValueOrange}>R$ 11.680</h2>
        </div>
      </div>
      <div style={styles.tableCard}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Profissional</th>
              <th style={styles.th}>Desempenho</th>
              <th style={styles.th}>Impacto Financeiro</th>
              <th style={styles.th}>Ação</th>
            </tr>
          </thead>
          <tbody>
            {profissionais.map(p => (
              <React.Fragment key={p.id}>
                <tr style={styles.tr} onClick={() => setExpandedRow(expandedRow === p.id ? null : p.id)}>
                  <td style={styles.td}>
                    <div style={styles.avatarBox}>
                      <div style={styles.avatar}>{p.iniciais}</div>
                      <div>
                        <p style={styles.profName}>{p.nome}</p>
                        <p style={styles.profProfile}>{p.perfil} • {p.analisados} analisados</p>
                      </div>
                    </div>
                  </td>
                  <td style={styles.td}>
                    <p style={{...styles.metricTitle, color: p.retencao < 70 ? 'var(--danger)' : 'var(--text)'}}>{p.retencao}%</p>
                    <p style={styles.metricSub}>{p.perdidos} perdidos</p>
                  </td>
                  <td style={styles.td}>
                    <p style={{...styles.metricTitle, color: p.receitaRisco > 2000 ? 'var(--danger)' : 'var(--text)'}}>R$ {p.receitaRisco.toFixed(2)}</p>
                    <p style={styles.metricSub}>Receita em risco</p>
                  </td>
                  <td style={styles.td}>
                    {expandedRow === p.id ? <ChevronUp size={20} color="var(--muted)" /> : <ChevronDown size={20} color="var(--muted)" />}
                  </td>
                </tr>
                {expandedRow === p.id && (
                  <tr>
                    <td colSpan="4" style={{padding: 0}}>
                      <div style={styles.expandedBox}>
                        <h4 style={styles.expandedTitle}>Clientes Perdidos ({p.clientesPerdidos.length})</h4>
                        {p.clientesPerdidos.length > 0 ? (
                          <div style={styles.clienteList}>
                            {p.clientesPerdidos.map((c, i) => (
                              <div key={i} style={styles.clienteCard}>
                                <p style={styles.clienteName}>{c.nome}</p>
                                <p style={styles.profProfile}>{c.telefone} • Última visita: {c.ultimaVisita}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p style={styles.metricSub}>Nenhum cliente perdido listado para detalhamento.</p>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default RelatorioRetornoProfissional;