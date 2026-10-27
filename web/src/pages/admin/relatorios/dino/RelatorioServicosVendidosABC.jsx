import React, { useState } from 'react';
import { Download, RefreshCw, Sparkles, Filter, Search, TrendingUp, Star, Heart, Target } from 'lucide-react';

const RelatorioServicosVendidos = () => {
  const [dataAnaliseInicio, setDataAnaliseInicio] = useState('2026-09-01');
  const [dataAnaliseFim, setDataAnaliseFim] = useState('2026-10-26');

  const servicos = [
    { id: 1, nome: 'Corte Degradê (Fade)', categoria: 'Cabelo', quantidade: 480, faturamento: 28800.00, margem: 85, icon: <Target size={18} /> },
    { id: 2, nome: 'Barboterapia Premium', categoria: 'Barba', quantidade: 310, faturamento: 15500.00, margem: 92, icon: <Heart size={18} /> },
    { id: 3, nome: 'Corte Tradicional', categoria: 'Cabelo', quantidade: 180, faturamento: 9000.00, margem: 85, icon: <Target size={18} /> },
    { id: 4, nome: 'Sobrancelha Navalha', categoria: 'Estética', quantidade: 215, faturamento: 4300.00, margem: 95, icon: <Star size={18} /> },
    { id: 5, nome: 'Selagem / Progressiva', categoria: 'Química', quantidade: 45, faturamento: 6750.00, margem: 70, icon: <Star size={18} /> }
  ];

  const totalFaturado = servicos.reduce((acc, curr) => acc + curr.faturamento, 0);
  const totalQuantidade = servicos.reduce((acc, curr) => acc + curr.quantidade, 0);

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
    
    // Filter Box
    filterRow: { background: '#FFFFFF', padding: '16px 24px', borderRadius: '12px', border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px' },
    input: { padding: '10px 16px', borderRadius: '8px', border: '1px solid #D1D5DB', background: '#FFFFFF', color: '#111827', fontSize: '15px', outline: 'none' },
    
    // Table
    tableCard: { background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E5E7EB', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' },
    table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
    th: { padding: '20px 24px', borderBottom: '1px solid #E5E7EB', fontSize: '12px', fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' },
    tr: { borderBottom: '1px solid #F3F4F6', transition: 'background 0.2s' },
    td: { padding: '20px 24px', verticalAlign: 'middle' },
    iconBox: { width: '42px', height: '42px', borderRadius: '8px', background: '#F3F4F6', color: '#6D5BBA', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    srvName: { margin: '0 0 4px 0', fontWeight: 700, color: '#111827', fontSize: '15px' },
    srvCat: { margin: 0, fontSize: '13px', color: '#6B7280', display: 'inline-block', background: '#E5E7EB', padding: '2px 8px', borderRadius: '4px' },
    metricTitle: { fontSize: '18px', fontWeight: 800, margin: '0', color: '#111827' }
  };

  return (
    <div style={styles.container}>
      <div style={styles.headerBox}>
        <div>
          <span style={styles.sup}>DINO · DINO-MATRIZ — BARBEARIA DINO</span>
          <h1 style={styles.h1}>Curva ABC: Serviços Mais Vendidos</h1>
          <p style={styles.sub}>Identifique o que traz mais volume, faturamento e margem de lucro para a barbearia.</p>
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
            O <strong style={styles.aiStrong}>Corte Degradê</strong> gera o maior faturamento, mas a <strong style={styles.aiStrong}>Barboterapia Premium</strong> traz a maior margem de lucro por minuto trabalhado. 
            Recomendamos empacotar ambos em um "Combo Mensal" para converter os clientes de corte em consumidores de estética facial, aumentando o LTV em até 35%.
          </p>
        </div>
      </div>
      
      <div style={styles.kpiGrid}>
        <div style={styles.kpiCard}>
          <span style={styles.kpiLabel}>Total Faturado em Serviços</span>
          <h2 style={{...styles.kpiValue, color: '#059669'}}>R$ {totalFaturado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h2>
        </div>
        <div style={styles.kpiCard}>
          <span style={styles.kpiLabel}>Serviços Realizados</span>
          <h2 style={styles.kpiValue}>{totalQuantidade} <span style={{fontSize: '15px', color: '#6B7280', fontWeight: 700}}>execuções</span></h2>
        </div>
      </div>

      <div style={styles.tableCard}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Serviço</th>
              <th style={styles.th}>Faturamento (Curva A)</th>
              <th style={styles.th}>Qtd. Realizada</th>
              <th style={styles.th}>Margem de Lucro Bruta</th>
            </tr>
          </thead>
          <tbody>
            {servicos.map((s, idx) => {
              const percentBar = (s.faturamento / totalFaturado) * 100;
              
              return (
              <tr key={s.id} style={styles.tr}>
                <td style={styles.td}>
                  <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
                    <div style={styles.iconBox}>{s.icon}</div>
                    <div>
                      <p style={styles.srvName}>{idx + 1}º {s.nome}</p>
                      <span style={styles.srvCat}>{s.categoria}</span>
                    </div>
                  </div>
                </td>
                <td style={styles.td}>
                  <p style={styles.metricTitle}>R$ {s.faturamento.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                  <div style={{width: '100%', background: '#E5E7EB', height: '6px', borderRadius: '3px', marginTop: '8px', overflow: 'hidden'}}>
                    <div style={{width: `${percentBar}%`, background: idx < 2 ? '#6D5BBA' : '#9CA3AF', height: '100%'}}></div>
                  </div>
                </td>
                <td style={styles.td}>
                  <p style={{fontSize: '16px', fontWeight: 800, color: '#374151'}}>{s.quantidade}</p>
                </td>
                <td style={styles.td}>
                  <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                    <div style={{width: '40px', height: '40px', borderRadius: '50%', background: s.margem > 90 ? '#DEF7EC' : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.margem > 90 ? '#059669' : '#4B5563', fontWeight: 800, fontSize: '13px'}}>
                      {s.margem}%
                    </div>
                    {s.margem > 90 && <span style={{fontSize: '12px', fontWeight: 700, color: '#059669'}}>Alta Margem</span>}
                  </div>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default RelatorioServicosVendidos;
