import React, { useState } from 'react';
import { Download, RefreshCw, Sparkles, Filter, Search, ChevronDown, ChevronUp } from 'lucide-react';
const RelatorioClientesAtendidos = () => {
  const [dataInicio, setDataInicio] = useState('2026-09-01');
  const [dataFim, setDataFim] = useState('2026-10-26');
  
  const clientes = [
    { id: 1, nome: 'João Pedro', telefone: '(65) 9999-3333', ultimaVisita: '02/10/2026', visitas: 3, ticket: 180, perfil: '🏷️ Essencial' },
    { id: 2, nome: 'Carlos Silva', telefone: '(65) 9999-1111', ultimaVisita: '15/10/2026', visitas: 2, ticket: 180, perfil: '⭐ Premium' },
    { id: 3, nome: 'Marcos Paulo', telefone: '(65) 9999-2222', ultimaVisita: '20/10/2026', visitas: 1, ticket: 120, perfil: '⭐ Premium' },
    { id: 4, nome: 'Lucas Lima', telefone: '(65) 9999-4444', ultimaVisita: '22/10/2026', visitas: 4, ticket: 240, perfil: '🏷️ Essencial' },
    { id: 5, nome: 'Pedro Henrique', telefone: '(65) 9999-5555', ultimaVisita: '25/10/2026', visitas: 1, ticket: 60, perfil: '🔄 Club' }
  ];
  const styles = {
    container: { padding: '0', maxWidth: '100%', margin: '0 auto', fontFamily: 'var(--font)' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' },
    sup: { fontSize: '11px', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px', display: 'block' },
    h1: { fontSize: '28px', fontWeight: 800, color: 'var(--text)', margin: '0 0 8px 0' },
    sub: { fontSize: '15px', color: 'var(--muted)', margin: 0 },
    actions: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
    btnOutline: { display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' },
    aiCard: { background: 'var(--card)', border: '1px solid var(--border)', borderLeft: '4px solid var(--accent)', borderRadius: '16px', padding: '0', marginBottom: '32px', color: 'var(--text)', position: 'relative', overflow: 'hidden', display: 'flex', gap: '20px', alignItems: 'flex-start' },
    aiIconBox: { background: 'var(--accent-soft)', padding: '12px', borderRadius: '12px', display: 'flex' },
    aiContent: { flex: 1 },
    aiTitle: { fontSize: '18px', fontWeight: 700, margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text)' },
    aiBadge: { background: 'var(--text)', color: 'var(--text)', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, textTransform: 'uppercase' },
    aiText: { fontSize: '15px', lineHeight: '1.5', margin: 0, color: 'var(--text)' },
    aiStrong: { color: 'var(--text)', fontWeight: 800 },
    filterCard: { background: 'var(--card)', borderRadius: '12px', padding: '20px', marginBottom: '24px', border: '1px solid var(--border)' },
    filterTitle: { fontSize: '16px', fontWeight: 700, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text)' },
    filterGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' },
    filterGroup: { display: 'flex', flexDirection: 'column', gap: '8px' },
    label: { fontSize: '12px', fontWeight: 600, color: 'var(--muted)' },
    input: { padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '14px', outline: 'none' },
    tableCard: { background: 'var(--card)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' },
    table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
    th: { padding: '16px 20px', borderBottom: '1px solid var(--border)', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' },
    tr: { borderBottom: '1px solid var(--border)', transition: 'background 0.2s', cursor: 'pointer' },
    trHover: { background: 'var(--card2)' },
    td: { padding: '16px 20px', verticalAlign: 'middle' },
    avatarBox: { display: 'flex', alignItems: 'center', gap: '12px' },
    avatar: { width: '36px', height: '36px', borderRadius: '50%', background: 'var(--card2)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px' },
    profName: { margin: '0 0 2px 0', fontWeight: 600, color: 'var(--text)', fontSize: '14px' },
    profProfile: { margin: 0, fontSize: '12px', color: 'var(--muted)' },
    metricTitle: { fontSize: '16px', fontWeight: 700, margin: '0', color: 'var(--text)' },
    badge: { display: 'inline-flex', padding: '4px 8px', borderRadius: '4px', background: 'var(--card2)', color: 'var(--text)', fontSize: '12px', fontWeight: 600 },
    btnIcon: { background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: '4px' }
  };
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <span style={styles.sup}>DINO INTELLIGENCE</span>
          <h1 style={styles.h1}>Clientes Atendidos</h1>
          <p style={styles.sub}>Exibir todos os clientes que foram atendidos e volume de consumo.</p>
        </div>
        <div style={styles.actions}>
          <button style={styles.btnOutline}><RefreshCw size={14} /> Atualizar</button>
          <button style={styles.btnOutline}><Download size={14} /> Exportar</button>
        </div>
      </div>
      <div style={styles.aiCard}>
        <div style={styles.aiIconBox}><Sparkles size={24} color="var(--accent)" /></div>
        <div style={styles.aiContent}>
          <h3 style={styles.aiTitle}>Insights da IA de Dino T-Rex <span style={styles.aiBadge}>Público Alvo</span></h3>
          <p style={styles.aiText}>
            Foram identificados <strong style={styles.aiStrong}>{clientes.length} clientes ativos</strong> neste período. 
            A retenção está alta, porém o ticket médio pode melhorar focando na venda de <strong style={styles.aiStrong}>Serviços Extras</strong> (Barboterapia, Sobrancelha) para os clientes Essenciais.
          </p>
        </div>
      </div>
      <div style={styles.filterCard}>
        <h3 style={styles.filterTitle}><Filter size={16} /> Filtros de Período</h3>
        <div style={styles.filterGrid}>
          <div style={styles.filterGroup}>
            <span style={styles.label}>Data Início</span>
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} style={styles.input} />
          </div>
          <div style={styles.filterGroup}>
            <span style={styles.label}>Data Fim</span>
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} style={styles.input} />
          </div>
        </div>
      </div>
      <div style={styles.tableCard}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Cliente</th>
              <th style={styles.th}>Última Visita</th>
              <th style={styles.th}>Visitas</th>
              <th style={styles.th}>Total Consumido</th>
              <th style={styles.th}>Ação</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map(c => (
              <tr key={c.id} style={styles.tr}>
                <td style={styles.td}>
                  <div style={styles.avatarBox}>
                    <div style={styles.avatar}><User size={16} /></div>
                    <div>
                      <p style={styles.profName}>{c.nome}</p>
                      <p style={styles.profProfile}>{c.telefone}</p>
                    </div>
                  </div>
                </td>
                <td style={styles.td}>
                  <span style={styles.badge}><Calendar size={12} style={{marginRight: '4px'}} /> {c.ultimaVisita}</span>
                </td>
                <td style={styles.td}>
                  <p style={styles.metricTitle}>{c.visitas} visita(s)</p>
                  <p style={styles.profProfile}>{c.perfil}</p>
                </td>
                <td style={styles.td}>
                  <p style={styles.metricTitle}>R$ {c.ticket.toFixed(2)}</p>
                </td>
                <td style={styles.td}>
                  <button style={styles.btnIcon} title="Ver Ficha 360"><ExternalLink size={18} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default RelatorioClientesAtendidos;