import React, { useState } from 'react';
import { Download, RefreshCw, Sparkles, Filter, ChevronDown, ChevronUp, AlertTriangle, TrendingDown } from 'lucide-react';
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
    { id: 4, iniciais: 'AB', nome: 'Aize Barbara', analisados: 110, retencao: 90, perdidos: 11, receitaRisco: 1980.00, perfil: '⭐ Premium', clientesPerdidos: [] }
  ];
  
  const styles = {
    container: { padding: '24px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'var(--font)' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' },
    sup: { fontSize: '11px', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px', display: 'block' },
    h1: { fontSize: '28px', fontWeight: 800, color: 'var(--text)', margin: '0 0 8px 0' },
    sub: { fontSize: '15px', color: 'var(--muted)', margin: 0 },
    actions: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
    btnOutline: { display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' },
    btnPrimary: { display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', background: 'var(--text)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' },
    aiCard: { background: 'linear-gradient(135deg, var(--navy) 0%, #2A3B4C 100%)', borderRadius: '16px', padding: '24px', marginBottom: '32px', color: '#fff', position: 'relative', overflow: 'hidden', display: 'flex', gap: '20px', alignItems: 'flex-start' },
    aiIconBox: { background: 'rgba(255,255,255,0.1)', padding: '12px', borderRadius: '12px', display: 'flex' },
    aiContent: { flex: 1 },
    aiTitle: { fontSize: '18px', fontWeight: 700, margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '12px' },
    aiBadge: { background: 'rgba(45, 111, 158, 0.2)', color: '#68B6E3', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(45, 111, 158, 0.4)', fontWeight: 700, textTransform: 'uppercase' },
    aiText: { fontSize: '15px', lineHeight: '1.5', margin: '0 0 16px 0', color: 'rgba(255,255,255,0.8)' },
    aiStrong: { color: '#fff', fontWeight: 700 },
    aiHighlight: { background: 'rgba(240, 61, 46, 0.2)', padding: '2px 6px', borderRadius: '4px' },
    aiActions: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
    aiBtnPrimary: { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' },
    aiBtnSecondary: { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' },
    filterCard: { background: 'var(--surface)', borderRadius: '12px', padding: '20px', marginBottom: '24px', border: '1px solid var(--border)' },
    filterTitle: { fontSize: '16px', fontWeight: 700, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text)' },
    filterGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' },
    filterGroup: { display: 'flex', flexDirection: 'column', gap: '8px' },
    label: { fontSize: '12px', fontWeight: 600, color: 'var(--muted)' },
    input: { padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '14px', outline: 'none' },
    tableCard: { background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' },
    table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
    th: { padding: '16px 20px', borderBottom: '1px solid var(--border)', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' },
    tr: { borderBottom: '1px solid var(--border)', transition: 'background 0.2s', cursor: 'pointer' },
    trHover: { background: 'var(--card2)' },
    td: { padding: '16px 20px', verticalAlign: 'middle' },
    avatarBox: { display: 'flex', alignItems: 'center', gap: '12px' },
    avatar: { width: '36px', height: '36px', borderRadius: '50%', background: 'var(--card2)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px' },
    profName: { margin: '0 0 2px 0', fontWeight: 600, color: 'var(--text)', fontSize: '14px' },
    profProfile: { margin: 0, fontSize: '12px', color: 'var(--muted)' },
    metricTitle: { fontSize: '18px', fontWeight: 700, margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text)' },
    metricSub: { fontSize: '12px', color: 'var(--muted)', margin: 0 },
    expandedBox: { background: 'var(--card2)', padding: '24px', borderBottom: '1px solid var(--border)' },
    expandedTitle: { fontSize: '14px', fontWeight: 700, margin: '0 0 12px 0', color: 'var(--text)' },
    clienteList: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' },
    clienteCard: { background: 'var(--surface)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' },
    clienteName: { margin: '0 0 4px 0', fontWeight: 600, fontSize: '13px', color: 'var(--text)' }
  };
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <span style={styles.sup}>DINO INTELLIGENCE</span>
          <h1 style={styles.h1}>Retorno por Profissional</h1>
          <p style={styles.sub}>Análise profunda de retenção e churn (perda) de clientes da sua equipe.</p>
        </div>
        <div style={styles.actions}>
          <button style={styles.btnOutline}><RefreshCw size={14} /> Atualizar</button>
          <button style={styles.btnOutline}><Download size={14} /> Exportar</button>
        </div>
      </div>
      <div style={styles.aiCard}>
        <div style={styles.aiIconBox}><Sparkles size={24} color="#FF6B2C" /></div>
        <div style={styles.aiContent}>
          <h3 style={styles.aiTitle}>IA Dino: Análise Estratégica <span style={styles.aiBadge}>Oportunidade</span></h3>
          <p style={styles.aiText}>
            Identificamos que <strong style={styles.aiStrong}>Guilherme Cunha</strong> está com a retenção crítica (60%), gerando um risco de <strong style={{...styles.aiStrong, ...styles.aiHighlight}}>R$ 2.280,00</strong>. 
            Por outro lado, <strong style={styles.aiStrong}>Aize Barbara</strong> bateu o recorde do salão com 90% de retenção VIP.
          </p>
          <div style={styles.aiActions}>
            <button style={styles.aiBtnPrimary}><TrendingDown size={14} /> Criar Campanha de Resgate</button>
          </div>
        </div>
      </div>
      <div style={styles.filterCard}>
        <h3 style={styles.filterTitle}><Filter size={16} /> Filtros de Retenção</h3>
        <div style={styles.filterGrid}>
          <div style={styles.filterGroup}>
            <span style={styles.label}>Início do Atendimento (Safra)</span>
            <input type="date" value={dataAnaliseInicio} onChange={e => setDataAnaliseInicio(e.target.value)} style={styles.input} />
          </div>
          <div style={styles.filterGroup}>
            <span style={styles.label}>Fim do Atendimento (Safra)</span>
            <input type="date" value={dataAnaliseFim} onChange={e => setDataAnaliseFim(e.target.value)} style={styles.input} />
          </div>
          <div style={styles.filterGroup}>
            <span style={styles.label}>Início do Retorno Esperado</span>
            <input type="date" value={dataRetornoInicio} onChange={e => setDataRetornoInicio(e.target.value)} style={styles.input} />
          </div>
          <div style={styles.filterGroup}>
            <span style={styles.label}>Fim do Retorno Esperado</span>
            <input type="date" value={dataRetornoFim} onChange={e => setDataRetornoFim(e.target.value)} style={styles.input} />
          </div>
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