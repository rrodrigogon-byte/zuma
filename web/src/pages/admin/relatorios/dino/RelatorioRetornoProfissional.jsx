import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, Sparkles, Filter, Search, ChevronDown, ChevronUp } from 'lucide-react';
const RelatorioRetornoProfissional = () => {
  const [dataAnaliseInicio, setDataAnaliseInicio] = useState('2026-08-01');
  const [dataAnaliseFim, setDataAnaliseFim] = useState('2026-08-31');
  const [dataRetornoInicio, setDataRetornoInicio] = useState('2026-09-01');
  const [dataRetornoFim, setDataRetornoFim] = useState('2026-10-26');
  const [expandedRow, setExpandedRow] = useState(null);
  
  // Baseando os dados na realidade extraída do Kytto/Avec
  const [profissionais, setProfissionais] = useState([
    { id: 1, iniciais: 'GU', nome: 'Gustavo', analisados: 120, retencao: 85, perdidos: 18, receitaRisco: 1620.00, perfil: '⭐ Premium', clientesPerdidos: [
      { nome: 'Carlos Silva', telefone: '(65) 9999-1111', ultimaVisita: '15/08/2026', ticket: 90, diasAtraso: 42 },
      { nome: 'Fernando Moraes', telefone: '(65) 9998-1234', ultimaVisita: '28/08/2026', ticket: 110, diasAtraso: 29 },
      { nome: 'Ricardo Neves', telefone: '(65) 9888-5555', ultimaVisita: '10/08/2026', ticket: 140, diasAtraso: 47 }
    ]},
    { id: 2, iniciais: 'GC', nome: 'Guilherme Cunha', analisados: 95, retencao: 60, perdidos: 38, receitaRisco: 2280.00, perfil: '🏷️ Essencial', clientesPerdidos: [
      { nome: 'João Pedro', telefone: '(65) 9999-3333', ultimaVisita: '02/08/2026', ticket: 60, diasAtraso: 55 },
      { nome: 'Lucas Lima', telefone: '(65) 9999-4444', ultimaVisita: '10/08/2026', ticket: 60, diasAtraso: 47 },
      { nome: 'Pedro Henrique', telefone: '(65) 9999-5555', ultimaVisita: '12/08/2026', ticket: 60, diasAtraso: 45 }
    ]},
    { id: 3, iniciais: 'BM', nome: 'Bruno Mendes', analisados: 80, retencao: 72, perdidos: 22, receitaRisco: 1320.00, perfil: '🏷️ Essencial', clientesPerdidos: [] },
    { id: 4, iniciais: 'AB', nome: 'Aize Barbara', analisados: 110, retencao: 90, perdidos: 11, receitaRisco: 1980.00, perfil: '⭐ Premium', clientesPerdidos: [] },
    { id: 5, iniciais: 'DI', nome: 'Dino', analisados: 53, retencao: 96, perdidos: 2, receitaRisco: 480.00, perfil: '⭐ Premium', clientesPerdidos: [] }
  ]);
  
    const [resgatando, setResgatando] = useState(false);
  const [modalCampanha, setModalCampanha] = useState(false);
  const [mensagemCampanha, setMensagemCampanha] = useState(`Olá {Nome do Cliente}! 👋

Sentimos sua falta aqui na Barbearia Dino.

O Gustavo comentou que já faz um tempo desde o seu último corte VIP. Que tal agendar um horário essa semana para dar aquele trato?

👉 Clique aqui para agendar: {Link Agendamento}

Te esperamos!`);
  
  const dispararResgate = () => {
    setResgatando(true);
    setTimeout(() => {
      setResgatando(false);
      setModalCampanha(true);
    }, 800);
  };
  
  // Forçar o modo Claro (protótipo) independentemente do thema do Kytto usando cores CSS explícitas e não variáveis root
  const styles = {
    container: { padding: '32px', maxWidth: '100%', margin: '0 auto', fontFamily: 'var(--font-display)', background: '#F8F9FB', minHeight: '100vh', color: '#1A1A24' },
    headerBox: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
    sup: { fontSize: '11px', fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'block' },
    h1: { fontSize: '32px', fontWeight: 900, color: '#111827', margin: '0 0 8px 0' },
    actions: { display: 'flex', gap: '12px' },
    btnOutline: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#FFFFFF', color: '#374151', border: '1px solid #D1D5DB', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
    btnPrimary: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#6D5BBA', color: '#FFFFFF', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '14px', boxShadow: '0 4px 6px rgba(109, 91, 186, 0.25)' },
    
    // AI Insight Card (Exatamente igual ao protótipo figma)
    aiCard: { background: '#F5F3FA', borderRadius: '16px', borderLeft: '4px solid #6D5BBA', padding: '28px', marginBottom: '32px', display: 'flex', gap: '24px', alignItems: 'flex-start' },
    aiIconBox: { background: '#EAE5F5', padding: '14px', borderRadius: '12px', display: 'flex' },
    aiContent: { flex: 1 },
    aiTitle: { fontSize: '18px', fontWeight: 800, margin: '0 0 12px 0', color: '#111827' },
    aiText: { fontSize: '15px', lineHeight: '1.6', margin: '0 0 20px 0', color: '#4B5563' },
    aiStrong: { fontWeight: 800, color: '#111827' },
    aiBtnPrimary: { display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '0', background: 'transparent', color: '#6D5BBA', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '14px' },
    
    // Filter Card
    filterTitle: { fontSize: '16px', fontWeight: 800, margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '8px', color: '#374151' },
    filterGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px', marginBottom: '32px' },
    filterGroup: { background: '#FFFFFF', padding: '24px', borderRadius: '12px', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' },
    label: { fontSize: '14px', fontWeight: 700, color: '#111827', marginBottom: '16px', display: 'block' },
    inputRow: { display: 'flex', alignItems: 'center', gap: '16px' },
    input: { flex: 1, padding: '12px 16px', borderRadius: '8px', border: '1px solid #D1D5DB', backgroundColor: '#FFFFFF', color: '#111827', fontSize: '15px', outline: 'none' },
    filterSub: { fontSize: '13px', color: '#6B7280', marginTop: '12px', display: 'block' },
    
    // KPI Cards
    kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' },
    kpiCard: { background: '#FFFFFF', padding: '24px', borderRadius: '12px', border: '1px solid #E5E7EB', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' },
    kpiLabel: { fontSize: '13px', fontWeight: 700, color: '#6B7280', marginBottom: '12px', display: 'block' },
    kpiValue: { fontSize: '36px', fontWeight: 900, color: '#111827', margin: 0, letterSpacing: '-1px' },
    kpiValueGreen: { fontSize: '36px', fontWeight: 900, color: '#059669', margin: 0, letterSpacing: '-1px' },
    kpiValueRed: { fontSize: '36px', fontWeight: 900, color: '#DC2626', margin: 0, letterSpacing: '-1px' },
    kpiValueOrange: { fontSize: '36px', fontWeight: 900, color: '#FF6B2C', margin: 0, letterSpacing: '-1px' },
    kpiSub: { fontSize: '15px', color: '#6B7280', marginLeft: '6px', fontWeight: 700 },
    
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
    expandedTitle: { fontSize: '16px', fontWeight: 800, margin: '0 0 16px 0', color: '#111827' },
    clienteList: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' },
    clienteCard: { background: '#FFFFFF', padding: '16px', borderRadius: '8px', border: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    clienteName: { margin: '0 0 4px 0', fontWeight: 700, fontSize: '14px', color: '#111827' }
  };
  return (
    <div style={styles.container}>
      <div style={styles.headerBox}>
        <div>
          <span style={styles.sup}>DINO · DINO-MATRIZ — BARBEARIA DINO</span>
          <h1 style={styles.h1}>Retorno por Profissional</h1>
        </div>
        <div style={styles.actions}>
          <button style={styles.btnOutline}><RefreshCw size={16} /> Atualizar</button>
          <button style={styles.btnPrimary}><Download size={16} /> Exportar CSV</button>
        </div>
      </div>
      
      <div style={styles.aiCard}>
        <div style={styles.aiContent}>
          <h3 style={styles.aiTitle}>Insights da IA de Dino T-Rex</h3>
          <p style={styles.aiText}>
            A taxa de retorno geral caiu <strong style={styles.aiStrong}>5%</strong> neste período selecionado. O profissional <strong style={styles.aiStrong}>Gustavo</strong> possui a maior retenção (85%), mas <strong style={styles.aiStrong}>15 clientes de ticket alto</strong> não retornaram após o último corte. Sugerimos uma campanha de reativação (Modelo Premium) para este grupo específico.
          </p>
          <button onClick={dispararResgate} disabled={resgatando} style={{...styles.aiBtnPrimary, opacity: resgatando ? 0.5 : 1}}>
            <Edit2 size={16} /> {resgatando ? 'Gerando campanha mágica...' : 'Gerar campanha de resgate via WhatsApp agora'}
          </button>
        </div>
      </div>
      
      <div>
        <h3 style={styles.filterTitle}><Filter size={18} /> Filtros de Período Inteligentes</h3>
        <div style={styles.filterGrid}>
          <div style={styles.filterGroup}>
            <span style={styles.label}>1. Data da Última Visita (Análise)</span>
            <div style={styles.inputRow}>
              <input type="date" value={dataAnaliseInicio} onChange={e => setDataAnaliseInicio(e.target.value)} style={styles.input} />
              <span style={{color: '#9CA3AF', fontSize: '14px'}}>até</span>
              <input type="date" value={dataAnaliseFim} onChange={e => setDataAnaliseFim(e.target.value)} style={styles.input} />
            </div>
            <span style={styles.filterSub}>Seleciona clientes que vieram neste período.</span>
          </div>
          <div style={{...styles.filterGroup, background: '#FAF5FF', borderColor: '#E9D8FD'}}>
            <span style={{...styles.label, color: '#6D5BBA'}}>2. Período de Retorno Esperado</span>
            <div style={styles.inputRow}>
              <input type="date" value={dataRetornoInicio} onChange={e => setDataRetornoInicio(e.target.value)} style={styles.input} />
              <span style={{color: '#9CA3AF', fontSize: '14px'}}>até</span>
              <input type="date" value={dataRetornoFim} onChange={e => setDataRetornoFim(e.target.value)} style={styles.input} />
            </div>
            <span style={{...styles.filterSub, color: '#6D5BBA'}}>Verifica se os clientes acima retornaram nesta data.</span>
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
        <div style={{...styles.kpiCard, border: '1px solid rgba(255, 107, 44, 0.2)'}}>
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
                <tr style={{...styles.tr, background: expandedRow === p.id ? '#F9FAFB' : '#FFF'}} onClick={() => setExpandedRow(expandedRow === p.id ? null : p.id)}>
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
                    <p style={{...styles.metricTitle, color: p.retencao < 70 ? '#DC2626' : '#111827'}}>{p.retencao}%</p>
                    <p style={styles.metricSub}>{p.perdidos} perdidos</p>
                  </td>
                  <td style={styles.td}>
                    <p style={{...styles.metricTitle, color: p.receitaRisco > 2000 ? '#DC2626' : '#111827'}}>R$ {p.receitaRisco.toFixed(2)}</p>
                    <p style={styles.metricSub}>Receita em risco</p>
                  </td>
                  <td style={styles.td}>
                    {expandedRow === p.id ? <ChevronUp size={24} color="#6B7280" /> : <ChevronDown size={24} color="#6B7280" />}
                  </td>
                </tr>
                {expandedRow === p.id && (
                  <tr>
                    <td colSpan="4" style={{padding: 0}}>
                      <div style={styles.expandedBox}>
                        <h4 style={styles.expandedTitle}>Clientes Perdidos ({p.clientesPerdidos.length}) - Detalhamento de Risco</h4>
                        {p.clientesPerdidos.length > 0 ? (
                          <div style={styles.clienteList}>
                            {p.clientesPerdidos.map((c, i) => (
                              <div key={i} style={styles.clienteCard}>
                                <div>
                                  <p style={styles.clienteName}>{c.nome}</p>
                                  <p style={styles.profProfile}>{c.telefone} • Há {c.diasAtraso} dias</p>
                                </div>
                                <div>
                                  <span style={{fontSize: '14px', fontWeight: 800, color: '#DC2626'}}>R$ {c.ticket.toFixed(2)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p style={styles.metricSub}>A excelente retenção deste profissional significa que nenhum cliente foi perdido no período analisado.</p>
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

      {modalCampanha && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(17, 24, 39, 0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', backdropFilter: 'blur(4px)'}}>
          <div style={{background: '#FFF', borderRadius: '16px', width: '100%', maxWidth: '680px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'}}>
            <div style={{padding: '24px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <div>
                <h2 style={{fontSize: '20px', fontWeight: 800, color: '#111827', margin: '0 0 4px 0'}}>Campanha de Resgate IA</h2>
                <p style={{fontSize: '14px', color: '#6B7280', margin: 0}}>Edite a mensagem antes de disparar para os 15 clientes VIPs do Gustavo.</p>
              </div>
              <button onClick={() => setModalCampanha(false)} style={{background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px', color: '#6B7280'}}><span style={{fontSize: '24px', lineHeight: 1}}>&times;</span></button>
            </div>
            
            <div style={{padding: '24px', background: '#F9FAFB'}}>
              <label style={{display: 'block', fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '8px'}}>Mensagem Personalizada</label>
              <textarea 
                value={mensagemCampanha}
                onChange={(e) => setMensagemCampanha(e.target.value)}
                style={{width: '100%', height: '180px', padding: '16px', borderRadius: '12px', border: '1px solid #D1D5DB', fontSize: '15px', color: '#111827', lineHeight: '1.5', outline: 'none', resize: 'none', backgroundColor: '#FFFFFF', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'}}
              />
              <div style={{marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
                <span style={{fontSize: '11px', fontWeight: 700, color: '#6D5BBA', background: '#F5F3FA', padding: '4px 10px', borderRadius: '100px'}}>Váriaveis disponíveis:</span>
                <span style={{fontSize: '11px', fontWeight: 600, color: '#4B5563', background: '#E5E7EB', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer'}} onClick={() => setMensagemCampanha(m => m + " {Nome do Cliente}")}>{'{Nome do Cliente}'}</span>
                <span style={{fontSize: '11px', fontWeight: 600, color: '#4B5563', background: '#E5E7EB', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer'}} onClick={() => setMensagemCampanha(m => m + " {Profissional}")}>{'{Profissional}'}</span>
                <span style={{fontSize: '11px', fontWeight: 600, color: '#4B5563', background: '#E5E7EB', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer'}} onClick={() => setMensagemCampanha(m => m + " {Link Agendamento}")}>{'{Link Agendamento}'}</span>
              </div>
            </div>
            
            <div style={{padding: '20px 24px', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: '#FFF'}}>
              <button onClick={() => setModalCampanha(false)} style={{padding: '10px 20px', background: '#F3F4F6', color: '#374151', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '14px'}}>Cancelar</button>
              <button onClick={() => { alert('Campanha disparada com sucesso para 15 clientes!'); setModalCampanha(false); }} style={{display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', background: '#059669', color: '#FFF', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '14px', boxShadow: '0 4px 6px rgba(5, 150, 105, 0.25)'}}>
                <Sparkles size={16} /> Disparar WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

  );
};
export default RelatorioRetornoProfissional;