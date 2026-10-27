import React, { useState } from 'react';
import { Download, RefreshCw, Sparkles, Filter, Search, ChevronDown, ChevronUp } from 'lucide-react';

const RelatorioDesempenhoProfissional = () => {
  const [dataAnaliseInicio, setDataAnaliseInicio] = useState('2026-09-01');
  const [dataAnaliseFim, setDataAnaliseFim] = useState('2026-10-26');
  const [expandedRow, setExpandedRow] = useState(null);

  const profissionais = [
    { id: 1, iniciais: 'DI', nome: 'Dino', comandas: 160, faturamento: 14400.00, ticketMedio: 90.00, crescimento: 12, perfil: 'Dono',
      historico: [{mes: 'Julho', valor: 12000}, {mes: 'Agosto', valor: 13500}, {mes: 'Setembro', valor: 14400}] },
    { id: 4, iniciais: 'AB', nome: 'Aize Barbara', comandas: 105, faturamento: 9975.00, ticketMedio: 95.00, crescimento: 8, perfil: 'Top Performer',
      historico: [{mes: 'Julho', valor: 8500}, {mes: 'Agosto', valor: 9100}, {mes: 'Setembro', valor: 9975}] },
    { id: 1, iniciais: 'GU', nome: 'Gustavo', comandas: 130, faturamento: 8450.00, ticketMedio: 65.00, crescimento: -3, perfil: 'Consistente',
      historico: [{mes: 'Julho', valor: 9000}, {mes: 'Agosto', valor: 8700}, {mes: 'Setembro', valor: 8450}] },
    { id: 3, iniciais: 'BM', nome: 'Bruno Mendes', comandas: 95, faturamento: 6175.00, ticketMedio: 65.00, crescimento: 5, perfil: 'Estável',
      historico: [{mes: 'Julho', valor: 5800}, {mes: 'Agosto', valor: 6000}, {mes: 'Setembro', valor: 6175}] },
    { id: 2, iniciais: 'GC', nome: 'Guilherme Cunha', comandas: 115, faturamento: 5175.00, ticketMedio: 45.00, crescimento: -15, perfil: 'Risco de Churn',
      historico: [{mes: 'Julho', valor: 6500}, {mes: 'Agosto', valor: 5900}, {mes: 'Setembro', valor: 5175}] }
  ];

  const totalFaturado = profissionais.reduce((acc, curr) => acc + curr.faturamento, 0);
  const totalComandas = profissionais.reduce((acc, curr) => acc + curr.comandas, 0);
  const ticketGlobal = totalFaturado / totalComandas;

  const styles = {
    container: { padding: '32px', maxWidth: '100%', margin: '0 auto', fontFamily: 'var(--font-display)', background: '#F8F9FB', minHeight: '100vh', color: '#1A1A24' },
    headerBox: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
    sup: { fontSize: '11px', fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'block' },
    h1: { fontSize: '32px', fontWeight: 900, color: '#111827', margin: '0 0 8px 0' },
    sub: { fontSize: '15px', color: '#6B7280', margin: 0 },
    actions: { display: 'flex', gap: '12px' },
    btnOutline: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#FFFFFF', color: '#374151', border: '1px solid #D1D5DB', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
    btnPrimary: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#6D5BBA', color: '#FFFFFF', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '14px', boxShadow: '0 4px 6px rgba(109, 91, 186, 0.25)' },
    
    // AI Insight Card
    aiCard: { background: '#F5F3FA', borderRadius: '16px', borderLeft: '4px solid #6D5BBA', padding: '28px', marginBottom: '32px', display: 'flex', gap: '24px', alignItems: 'flex-start' },
    aiIconBox: { background: '#EAE5F5', padding: '14px', borderRadius: '12px', display: 'flex' },
    aiContent: { flex: 1 },
    aiTitle: { fontSize: '18px', fontWeight: 800, margin: '0 0 12px 0', color: '#111827' },
    aiText: { fontSize: '15px', lineHeight: '1.6', margin: '0', color: '#4B5563' },
    aiStrong: { fontWeight: 800, color: '#111827' },
    
    // KPI Cards
    kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '32px' },
    kpiCard: { background: '#FFFFFF', padding: '24px', borderRadius: '12px', border: '1px solid #E5E7EB', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' },
    kpiLabel: { fontSize: '13px', fontWeight: 700, color: '#6B7280', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' },
    kpiValue: { fontSize: '36px', fontWeight: 900, color: '#111827', margin: 0, letterSpacing: '-1px' },
    kpiValueGreen: { fontSize: '36px', fontWeight: 900, color: '#059669', margin: 0, letterSpacing: '-1px' },
    
    // Filter Box
    filterRow: { background: '#FFFFFF', padding: '16px 24px', borderRadius: '12px', border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px' },
    input: { padding: '10px 16px', borderRadius: '8px', border: '1px solid #D1D5DB', background: '#FFFFFF', color: '#111827', fontSize: '15px', outline: 'none' },
    
    // Table
    tableCard: { background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E5E7EB', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' },
    table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
    th: { padding: '20px 24px', borderBottom: '1px solid #E5E7EB', fontSize: '12px', fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' },
    tr: { borderBottom: '1px solid #F3F4F6', transition: 'background 0.2s', cursor: 'pointer' },
    td: { padding: '20px 24px', verticalAlign: 'middle' },
    avatarBox: { display: 'flex', alignItems: 'center', gap: '16px' },
    avatar: { width: '42px', height: '42px', borderRadius: '50%', background: '#F3F4F6', color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px' },
    profName: { margin: '0 0 4px 0', fontWeight: 700, color: '#111827', fontSize: '15px' },
    profProfile: { margin: 0, fontSize: '13px', color: '#6B7280' },
    metricTitle: { fontSize: '18px', fontWeight: 800, margin: '0 0 4px 0', color: '#111827' },
    metricSub: { fontSize: '13px', color: '#6B7280', margin: 0 },
    
    expandedBox: { background: '#F9FAFB', padding: '32px', borderBottom: '1px solid #E5E7EB' },
    chartBar: { height: '8px', borderRadius: '4px', background: '#6D5BBA', marginTop: '8px' },
    chartContainer: { background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '20px' }
  };

  return (
    <div style={styles.container}>
      <div style={styles.headerBox}>
        <div>
          <span style={styles.sup}>DINO · DINO-MATRIZ — BARBEARIA DINO</span>
          <h1 style={styles.h1}>Desempenho e Faturamento da Equipe</h1>
          <p style={styles.sub}>Visão detalhada de comandas, faturamento e ticket médio por profissional.</p>
        </div>
        <div style={styles.actions}>
          <button style={styles.btnOutline}><Search size={16} /> Buscar</button>
          <button style={styles.btnOutline}><RefreshCw size={16} /> Atualizar</button>
          <button style={styles.btnPrimary}><Download size={16} /> Exportar CSV</button>
        </div>
      </div>
      
      <div style={styles.filterRow}>
        <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
          <Filter size={18} color="#6B7280" />
          <span style={{fontWeight: 700, color: '#374151'}}>Período Analisado:</span>
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
          <input type="date" value={dataAnaliseInicio} onChange={e => setDataAnaliseInicio(e.target.value)} style={styles.input} />
          <span style={{color: '#9CA3AF'}}>até</span>
          <input type="date" value={dataAnaliseFim} onChange={e => setDataAnaliseFim(e.target.value)} style={styles.input} />
        </div>
      </div>

      <div style={styles.aiCard}>
        <div style={styles.aiIconBox}><Sparkles size={24} color="#6D5BBA" /></div>
        <div style={styles.aiContent}>
          <h3 style={styles.aiTitle}>Insights da IA de Dino T-Rex</h3>
          <p style={styles.aiText}>
            Neste período, <strong style={styles.aiStrong}>Aize Barbara</strong> gerou o maior Ticket Médio (R$ 95,00) através da venda consistente de <strong style={styles.aiStrong}>Barboterapia</strong>. 
            Recomendamos que ela treine o <strong style={styles.aiStrong}>Guilherme Cunha</strong> (cujo ticket caiu 15%, para R$ 45,00) na oferta de combos para aumentar o faturamento global da equipe em até 18%.
          </p>
        </div>
      </div>
      
      <div style={styles.kpiGrid}>
        <div style={styles.kpiCard}>
          <span style={styles.kpiLabel}><DollarSign size={16} /> Faturamento Total</span>
          <h2 style={styles.kpiValueGreen}>R$ {totalFaturado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h2>
        </div>
        <div style={styles.kpiCard}>
          <span style={styles.kpiLabel}><Activity size={16} /> Comandas Geradas</span>
          <h2 style={styles.kpiValue}>{totalComandas} <span style={styles.kpiSub}>comandas pagas</span></h2>
        </div>
        <div style={styles.kpiCard}>
          <span style={styles.kpiLabel}><ChevronUp size={16} /> Ticket Médio Global</span>
          <h2 style={styles.kpiValue}>R$ {ticketGlobal.toFixed(2)}</h2>
        </div>
      </div>

      <div style={styles.tableCard}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Profissional</th>
              <th style={styles.th}>Faturamento Bruto</th>
              <th style={styles.th}>Ticket Médio</th>
              <th style={styles.th}>Desempenho</th>
              <th style={styles.th}>Ação</th>
            </tr>
          </thead>
          <tbody>
            {profissionais.map(p => {
              const maxFaturamento = Math.max(...profissionais.map(x => x.faturamento));
              const percentBar = (p.faturamento / maxFaturamento) * 100;
              
              return (
              <React.Fragment key={p.id}>
                <tr style={{...styles.tr, background: expandedRow === p.id ? '#F9FAFB' : '#FFF'}} onClick={() => setExpandedRow(expandedRow === p.id ? null : p.id)}>
                  <td style={styles.td}>
                    <div style={styles.avatarBox}>
                      <div style={styles.avatar}>{p.iniciais}</div>
                      <div>
                        <p style={styles.profName}>{p.nome}</p>
                        <p style={styles.profProfile}>{p.perfil} • {p.comandas} comandas</p>
                      </div>
                    </div>
                  </td>
                  <td style={styles.td}>
                    <p style={styles.metricTitle}>R$ {p.faturamento.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                    <div style={{width: '120px', background: '#E5E7EB', height: '6px', borderRadius: '3px', marginTop: '6px', overflow: 'hidden'}}>
                      <div style={{width: `${percentBar}%`, background: p.id === 1 ? '#059669' : '#6D5BBA', height: '100%'}}></div>
                    </div>
                  </td>
                  <td style={styles.td}>
                    <p style={styles.metricTitle}>R$ {p.ticketMedio.toFixed(2)}</p>
                  </td>
                  <td style={styles.td}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '4px', color: p.crescimento >= 0 ? '#059669' : '#DC2626'}}>
                      {p.crescimento >= 0 ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      <span style={{fontWeight: 700}}>{Math.abs(p.crescimento)}%</span>
                    </div>
                    <p style={styles.metricSub}>vs. mês anterior</p>
                  </td>
                  <td style={styles.td}>
                    {expandedRow === p.id ? <ChevronUp size={24} color="#6B7280" /> : <ChevronDown size={24} color="#6B7280" />}
                  </td>
                </tr>
                {expandedRow === p.id && (
                  <tr>
                    <td colSpan="5" style={{padding: 0}}>
                      <div style={styles.expandedBox}>
                        <h4 style={{fontSize: '16px', fontWeight: 800, margin: '0 0 16px 0', color: '#111827'}}>Histórico de Faturamento</h4>
                        <div style={{display: 'flex', gap: '24px'}}>
                          {p.historico.map((h, i) => (
                            <div key={i} style={styles.chartContainer}>
                              <p style={{fontSize: '13px', color: '#6B7280', margin: '0 0 4px 0', fontWeight: 700}}>{h.mes}</p>
                              <p style={{fontSize: '18px', color: '#111827', margin: 0, fontWeight: 900}}>R$ {h.valor.toLocaleString('pt-BR')}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            )})}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default RelatorioDesempenhoProfissional;
