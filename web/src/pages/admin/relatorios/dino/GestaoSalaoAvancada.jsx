import React, { useState, useEffect } from 'react';
import { apiFetch, fmtMoney } from '../../../../lib/api';
import { Link } from 'react-router-dom';
import { Sparkles, ChevronLeft, TrendingUp, Users, Target, Calendar, User, Search, AlertCircle, CheckCircle, BarChart3, Briefcase } from 'lucide-react';

const GestaoSalaoAvancada = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  
  // Data period
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
  
  const [inicio, setInicio] = useState(firstDay);
  const [fim, setFim] = useState(lastDay);
  
  const [selectedProfId, setSelectedProfId] = useState('');
  const [profDetails, setProfDetails] = useState(null);

  const fetchGeral = () => {
    setLoading(true);
    // Fetch global team performance
    apiFetch(`/api/admin/dino/equipe/desempenho?inicio=${inicio}&fim=${fim}`)
      .then(res => {
        if (res.ok) setData(res);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const fetchProfissional = (id) => {
    if (!id) {
      setProfDetails(null);
      setSelectedProfId('');
      return;
    }
    setLoading(true);
    setSelectedProfId(id);
    apiFetch(`/api/admin/dino/equipe/desempenho?inicio=${inicio}&fim=${fim}&profissionalId=${id}`)
      .then(res => {
        if (res.ok && res.employees && res.employees.length > 0) {
          setProfDetails(res.employees[0]);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!selectedProfId) {
      fetchGeral();
    } else {
      fetchProfissional(selectedProfId);
    }
  }, [inicio, fim]);

  const styles = {
    container: { padding: '24px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'var(--font)' },
    topNav: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' },
    backLink: { display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--muted)', fontSize: '13px', textDecoration: 'none', fontWeight: 600 },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' },
    h1: { fontSize: '24px', fontWeight: 700, color: 'var(--text)', margin: '0 0 8px 0', letterSpacing: '-0.5px' },
    sup: { fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1px' },
    filterCard: { background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: '16px 20px', marginBottom: '24px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' },
    input: { padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '14px', outline: 'none' },
    btnPrimary: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'var(--text)', color: 'var(--bg)', fontSize: '13px', fontWeight: 600, borderRadius: '8px', border: 'none', cursor: 'pointer' },
    btnOutline: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'var(--bg)', color: 'var(--text)', fontSize: '13px', fontWeight: 600, borderRadius: '8px', border: '1px solid var(--border)', cursor: 'pointer' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '24px' },
    kpiCard: { background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: '20px', display: 'flex', flexDirection: 'column' },
    kpiTitle: { fontSize: '13px', color: 'var(--muted)', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' },
    kpiValue: { fontSize: '28px', fontWeight: 800, color: 'var(--text)', margin: '0 0 4px 0' },
    kpiSub: { fontSize: '12px', color: 'var(--muted)' },
    trendPos: { color: '#10B981', fontWeight: 700, display: 'inline-flex', alignItems: 'center' },
    trendNeg: { color: '#EF4444', fontWeight: 700, display: 'inline-flex', alignItems: 'center' },
    tableCard: { background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflowX: 'auto', marginBottom: '24px' },
    table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
    th: { padding: '16px 20px', borderBottom: '1px solid var(--border)', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' },
    tr: { borderBottom: '1px solid var(--border)', transition: 'background 0.2s' },
    td: { padding: '16px 20px', verticalAlign: 'middle', fontSize: '13px', color: 'var(--text)' },
    aiCard: { background: 'var(--card2)', borderRadius: 'var(--radius)', padding: '20px', display: 'flex', gap: '16px', borderLeft: '4px solid var(--accent)' },
    aiTitle: { fontSize: '15px', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' },
    aiText: { fontSize: '13px', color: 'var(--muted)', lineHeight: '1.5', margin: 0 }
  };

  const getMetasInsight = (func) => {
    const revenue = func.revenue || 0;
    // Mocking goal logic since it may not be in API explicitly
    const goal = 10000; 
    const isHitting = revenue >= goal;
    if (isHitting) return "Meta atingida! Mantenha a retenção atual.";
    const diff = goal - revenue;
    const missingClients = Math.ceil(diff / (func.ticketAverage || 50));
    return `Faltam ${fmtMoney(diff)} para a meta mensal ideal. Precisa de aprox. ${missingClients} novos clientes de ticket médio.`;
  };

  return (
    <div style={styles.container}>
      <div style={styles.topNav}>
        <Link to="/admin/relatorios/dino" style={styles.backLink} onClick={(e) => {
          if (selectedProfId) {
            e.preventDefault();
            fetchProfissional('');
          }
        }}>
          <ChevronLeft size={16} />
          {selectedProfId ? 'Voltar para Visão da Equipe' : 'Voltar para Relatórios'}
        </Link>
      </div>

      <div style={styles.header}>
        <div>
          <span style={styles.sup}>DINO · Gestão de Equipe e Metas (IA)</span>
          <h1 style={styles.h1}>{selectedProfId ? (profDetails?.name || 'Profissional') : 'Visão Geral do Salão'}</h1>
        </div>
      </div>

      <div style={styles.filterCard}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={16} color="var(--muted)" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted)' }}>Período:</span>
        </div>
        <input type="date" value={inicio} onChange={e => setInicio(e.target.value)} style={styles.input} />
        <span style={{ fontSize: '13px', color: 'var(--muted)' }}>até</span>
        <input type="date" value={fim} onChange={e => setFim(e.target.value)} style={styles.input} />
        
        <button style={styles.btnPrimary} onClick={() => { selectedProfId ? fetchProfissional(selectedProfId) : fetchGeral() }}>
          <Search size={14} /> Analisar
        </button>
      </div>

      {loading && <div style={{ padding: '40px', textAlign: 'center' }}>Carregando dados operacionais...</div>}

      {!loading && !selectedProfId && data && (
        <>
          <div style={styles.grid}>
            <div style={styles.kpiCard}>
              <div style={styles.kpiTitle}><BarChart3 size={16} /> Faturamento Total</div>
              <h2 style={styles.kpiValue}>{fmtMoney(data.summary?.revenue || 0)}</h2>
              <span style={styles.kpiSub}>Serviços: {data.summary?.services} | Produtos: {data.summary?.products}</span>
            </div>
            <div style={styles.kpiCard}>
              <div style={styles.kpiTitle}><Users size={16} /> Clientes Atendidos (Concluídos)</div>
              <h2 style={styles.kpiValue}>{data.summary?.completed || 0}</h2>
              <span style={styles.kpiSub}>Agendamentos totais: {data.summary?.appointments}</span>
            </div>
            <div style={styles.kpiCard}>
              <div style={styles.kpiTitle}><AlertCircle size={16} /> Faltas (No-Show) / Cancelados</div>
              <h2 style={styles.kpiValue}>{data.summary?.noShow || 0} / {data.summary?.canceled || 0}</h2>
              <span style={styles.kpiSub}>Taxa de comparecimento pode afetar a meta mensal</span>
            </div>
          </div>

          <div style={styles.aiCard}>
            <Sparkles size={24} color="var(--accent)" />
            <div>
              <div style={styles.aiTitle}>Inteligência Dino T-Rex</div>
              <p style={styles.aiText}>
                Com base no desempenho da equipe, a taxa de retorno e a capacidade de novos clientes ditarão as metas do fim do mês. Abaixo, clique em um profissional para ver as recomendações de como atingir a meta individual focando no blend de serviços ou na retenção.
              </p>
            </div>
          </div>

          <div style={styles.tableCard}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Profissional</th>
                  <th style={styles.th}>Faturamento</th>
                  <th style={styles.th}>Ticket Méd.</th>
                  <th style={styles.th}>Concluídos</th>
                  <th style={styles.th}>Metas / Recomendação IA</th>
                  <th style={styles.th}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {(data.employees || []).map((emp, idx) => (
                  <tr key={idx} style={styles.tr}>
                    <td style={styles.td}><strong>{emp.name}</strong></td>
                    <td style={styles.td}>{fmtMoney(emp.revenue || 0)}</td>
                    <td style={styles.td}>{fmtMoney(emp.ticketAverage || 0)}</td>
                    <td style={styles.td}>{emp.completed || 0}</td>
                    <td style={styles.td}>
                      <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'block', maxWidth: '280px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {getMetasInsight(emp)}
                      </span>
                    </td>
                    <td style={styles.td}>
                      {emp.id !== '__sem_profissional__' && (
                        <button style={styles.btnOutline} onClick={() => fetchProfissional(emp.id)}>Detalhar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!loading && selectedProfId && profDetails && (
        <>
          <div style={styles.grid}>
            <div style={styles.kpiCard}>
              <div style={styles.kpiTitle}><User size={16} /> Faturamento Período</div>
              <h2 style={styles.kpiValue}>{fmtMoney(profDetails.revenue || 0)}</h2>
              <span style={styles.kpiSub}>Ticket Médio: {fmtMoney(profDetails.ticketAverage || 0)}</span>
            </div>
            <div style={styles.kpiCard}>
              <div style={styles.kpiTitle}><TrendingUp size={16} /> Crescimento vs. Anterior</div>
              <h2 style={styles.kpiValue}>
                {profDetails.revenueTrendPct ? (
                  <span style={profDetails.revenueTrendPct > 0 ? styles.trendPos : styles.trendNeg}>
                    {profDetails.revenueTrendPct > 0 ? '+' : ''}{profDetails.revenueTrendPct}%
                  </span>
                ) : '-'}
              </h2>
              <span style={styles.kpiSub}>Faturamento Anterior: {fmtMoney(profDetails.previousRevenue || 0)}</span>
            </div>
            <div style={styles.kpiCard}>
              <div style={styles.kpiTitle}><CheckCircle size={16} /> Entregas Diárias / Mensais</div>
              <h2 style={styles.kpiValue}>{profDetails.completed || 0} Atendimentos</h2>
              <span style={styles.kpiSub}>Serviços executados no período selecionado</span>
            </div>
          </div>

          <div style={styles.aiCard}>
            <Sparkles size={24} color="var(--accent)" />
            <div>
              <div style={styles.aiTitle}>Análise do Profissional (Dino T-Rex)</div>
              <p style={styles.aiText} style={{ marginBottom: '12px' }}>
                <strong>Metas:</strong> {getMetasInsight(profDetails)}<br/>
                <strong>Taxa de Retorno & Retenção:</strong> A taxa de comparecimento (Attendance Rate) foi de {profDetails.attendanceRate || 'N/A'}%.
              </p>
              
              {profDetails.strengths && profDetails.strengths.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <strong>Pontos Fortes (Blend de Vendas):</strong>
                  <ul style={{ margin: '4px 0', paddingLeft: '20px', fontSize: '13px' }}>
                    {profDetails.strengths.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}

              {profDetails.attention && profDetails.attention.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <strong>Onde está perdendo dinheiro:</strong>
                  <ul style={{ margin: '4px 0', paddingLeft: '20px', fontSize: '13px', color: '#EF4444' }}>
                    {profDetails.attention.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                </div>
              )}

              {profDetails.suggestions && profDetails.suggestions.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <strong>O que fazer para bater as metas (Recomendações da IA):</strong>
                  <ul style={{ margin: '4px 0', paddingLeft: '20px', fontSize: '13px' }}>
                    {profDetails.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </div>
          
          <div style={styles.tableCard}>
             <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>Curva ABC / Serviços Mais Vendidos do Profissional</div>
             <table style={styles.table}>
               <thead>
                 <tr>
                   <th style={styles.th}>Serviço / Produto</th>
                   <th style={styles.th}>Quantidade</th>
                   <th style={styles.th}>Faturamento</th>
                   <th style={styles.th}>% do Total</th>
                 </tr>
               </thead>
               <tbody>
                 {(profDetails.topServices || []).map((svc, idx) => (
                   <tr key={idx} style={styles.tr}>
                     <td style={styles.td}>{svc.name}</td>
                     <td style={styles.td}>{svc.quantity}</td>
                     <td style={styles.td}>{fmtMoney(svc.revenue)}</td>
                     <td style={styles.td}>{profDetails.revenue ? ((svc.revenue / profDetails.revenue) * 100).toFixed(1) : 0}%</td>
                   </tr>
                 ))}
                 {(!profDetails.topServices || profDetails.topServices.length === 0) && (
                   <tr style={styles.tr}><td colSpan="4" style={{...styles.td, textAlign: 'center'}}>Sem vendas detalhadas no período.</td></tr>
                 )}
               </tbody>
             </table>
          </div>
        </>
      )}

    </div>
  );
};

export default GestaoSalaoAvancada;
