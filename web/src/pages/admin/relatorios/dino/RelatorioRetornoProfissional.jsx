import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, Filter, ChevronDown, RefreshCw, ChevronUp, Edit2, Download } from 'lucide-react';
import { api } from '../../../../lib/api';

const RelatorioRetornoProfissional = () => {
  const [dataAnaliseInicio, setDataAnaliseInicio] = useState('2026-09-01');
  const [dataAnaliseFim, setDataAnaliseFim] = useState('2026-10-30');
  const [dataRetornoInicio, setDataRetornoInicio] = useState('2026-10-31');
  const [dataRetornoFim, setDataRetornoFim] = useState('2026-11-10');
  const [expandedRow, setExpandedRow] = useState(null);
  const [profissionais, setProfissionais] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [resgatando, setResgatando] = useState(false);
  const [modalCampanha, setModalCampanha] = useState(false);
  const [mensagemCampanha, setMensagemCampanha] = useState(
    'Olá {Nome do Cliente}! Sentimos sua falta aqui na Barbearia Dino. Que tal agendar seu próximo horário com {Profissional}? Acesse: {Link Agendamento}'
  );

  const carregarRetornoReal = useCallback(async () => {
    setCarregando(true);
    try {
      const qs = new URLSearchParams({
        de: dataRetornoInicio,
        ate: dataRetornoFim,
      }).toString();
      const res = await api(`/api/admin/barbearia/desempenho-equipe?${qs}`).catch(() => null);
      const listaApi = Array.isArray(res?.profissionais)
        ? res.profissionais
        : Array.isArray(res?.ranking)
          ? res.ranking
          : [];

      const mapeados = listaApi.map((p, idx) => {
        const nome = String(p.apelido || p.nome || `Profissional ${idx + 1}`).trim();
        const partes = nome.split(/\s+/);
        const iniciais = partes.length >= 2
          ? `${partes[0][0]}${partes[1][0]}`.toUpperCase()
          : nome.slice(0, 2).toUpperCase();
        const analisados = Number(p.clientesUnicos ?? p.comandas ?? p.atendimentos ?? 0);
        const retencao = Number(p.taxaRetorno ?? (analisados > 0 ? 100 : 0));
        const perdidos = Math.max(0, Number(p.clientesSemRetorno ?? 0));
        const ticketMedio = Number(p.ticketMedio ?? 0);
        return {
          id: p.id || p.profissionalId || `prof-${idx}`,
          iniciais,
          nome,
          analisados,
          retencao,
          perdidos,
          receitaRisco: Number((perdidos * ticketMedio).toFixed(2)),
          perfil: p.especialidade || p.cargo || 'Equipe Oficial',
          clientesPerdidos: Array.isArray(p.clientesPerdidos) ? p.clientesPerdidos : [],
        };
      });
      setProfissionais(mapeados);
    } catch {
      setProfissionais([]);
    } finally {
      setCarregando(false);
    }
  }, [dataRetornoInicio, dataRetornoFim]);

  useEffect(() => {
    carregarRetornoReal();
  }, [carregarRetornoReal]);

  const totalAnalisados = profissionais.reduce((s, p) => s + p.analisados, 0);
  const totalPerdidos = profissionais.reduce((s, p) => s + p.perdidos, 0);
  const totalRetornaram = Math.max(0, totalAnalisados - totalPerdidos);
  const percRetorno = totalAnalisados > 0 ? Math.round((totalRetornaram / totalAnalisados) * 100) : 0;
  const totalReceitaRisco = profissionais.reduce((s, p) => s + p.receitaRisco, 0);

  const dispararResgate = () => {
    setResgatando(true);
    setModalCampanha(true);
    setResgatando(false);
  };

  const styles = {
    container: { padding: '32px', maxWidth: '100%', margin: '0 auto', fontFamily: 'var(--font-display)', background: '#F8F9FB', minHeight: '100vh', color: '#1A1A24' },
    headerBox: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
    sup: { fontSize: '11px', fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'block' },
    h1: { fontSize: '32px', fontWeight: 900, color: '#111827', margin: '0 0 8px 0' },
    actions: { display: 'flex', gap: '12px' },
    btnOutline: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#FFFFFF', color: '#374151', border: '1px solid #D1D5DB', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
    btnPrimary: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#6D5BBA', color: '#FFFFFF', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '14px', boxShadow: '0 4px 6px rgba(109, 91, 186, 0.25)' },
    aiCard: { background: '#F5F3FA', borderRadius: '16px', borderLeft: '4px solid #6D5BBA', padding: '28px', marginBottom: '32px', display: 'flex', gap: '24px', alignItems: 'flex-start' },
    aiContent: { flex: 1 },
    aiTitle: { fontSize: '18px', fontWeight: 800, margin: '0 0 12px 0', color: '#111827' },
    aiText: { fontSize: '15px', lineHeight: '1.6', margin: '0 0 20px 0', color: '#4B5563' },
    aiStrong: { fontWeight: 800, color: '#111827' },
    aiBtnPrimary: { display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '0', background: 'transparent', color: '#6D5BBA', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '14px' },
    filterTitle: { fontSize: '16px', fontWeight: 800, margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '8px', color: '#374151' },
    filterGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px', marginBottom: '32px' },
    filterGroup: { background: '#FFFFFF', padding: '24px', borderRadius: '12px', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' },
    label: { fontSize: '14px', fontWeight: 700, color: '#111827', marginBottom: '16px', display: 'block' },
    inputRow: { display: 'flex', alignItems: 'center', gap: '16px' },
    input: { flex: 1, padding: '12px 16px', borderRadius: '8px', border: '1px solid #D1D5DB', backgroundColor: '#FFFFFF', color: '#111827', fontSize: '15px', outline: 'none' },
    filterSub: { fontSize: '13px', color: '#6B7280', marginTop: '12px', display: 'block' },
    kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' },
    kpiCard: { background: '#FFFFFF', padding: '24px', borderRadius: '12px', border: '1px solid #E5E7EB', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' },
    kpiLabel: { fontSize: '13px', fontWeight: 700, color: '#6B7280', marginBottom: '12px', display: 'block' },
    kpiValue: { fontSize: '36px', fontWeight: 900, color: '#111827', margin: 0, letterSpacing: '-1px' },
    kpiValueGreen: { fontSize: '36px', fontWeight: 900, color: '#059669', margin: 0, letterSpacing: '-1px' },
    kpiValueRed: { fontSize: '36px', fontWeight: 900, color: '#DC2626', margin: 0, letterSpacing: '-1px' },
    kpiValueOrange: { fontSize: '36px', fontWeight: 900, color: '#FF6B2C', margin: 0, letterSpacing: '-1px' },
    kpiSub: { fontSize: '15px', color: '#6B7280', marginLeft: '6px', fontWeight: 700 },
    tableCard: { background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E5E7EB', overflowX: 'auto', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' },
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
    clienteName: { margin: '0 0 4px 0', fontWeight: 700, fontSize: '14px', color: '#111827' },
  };

  return (
    <div style={styles.container}>
      <div style={styles.headerBox}>
        <div>
          <span style={styles.sup}>RELATÓRIO OPERACIONAL · DADOS REAIS</span>
          <h1 style={styles.h1}>Retorno por Profissional</h1>
        </div>
        <div style={styles.actions}>
          <button style={styles.btnOutline} onClick={carregarRetornoReal}><RefreshCw size={16} /> Atualizar</button>
          <button style={styles.btnPrimary} disabled={!profissionais.length}><Download size={16} /> Exportar CSV</button>
        </div>
      </div>

      <div style={styles.aiCard}>
        <div style={styles.aiContent}>
          <h3 style={styles.aiTitle}>Análise de Retorno da Equipe</h3>
          <p style={styles.aiText}>
            {carregando ? (
              'Calculando retorno real por profissional no período selecionado...'
            ) : (
              <>
                Foram analisados <strong style={styles.aiStrong}>{totalAnalisados} atendimentos</strong> da equipe oficial no período selecionado, com taxa média de retorno de <strong style={styles.aiStrong}>{percRetorno}%</strong>.
              </>
            )}
          </p>
          <button onClick={dispararResgate} disabled={resgatando} style={{ ...styles.aiBtnPrimary, opacity: resgatando ? 0.5 : 1 }}>
            <Edit2 size={16} /> Configurar mensagem de reativação via WhatsApp
          </button>
        </div>
      </div>

      <div>
        <h3 style={styles.filterTitle}><Filter size={18} /> Filtros de Período</h3>
        <div style={styles.filterGrid}>
          <div style={styles.filterGroup}>
            <span style={styles.label}>1. Data da Visita Base (Análise)</span>
            <div style={styles.inputRow}>
              <input type="date" value={dataAnaliseInicio} onChange={(e) => setDataAnaliseInicio(e.target.value)} style={styles.input} />
              <span style={{ color: '#9CA3AF', fontSize: '14px' }}>até</span>
              <input type="date" value={dataAnaliseFim} onChange={(e) => setDataAnaliseFim(e.target.value)} style={styles.input} />
            </div>
            <span style={styles.filterSub}>Seleciona clientes atendidos neste intervalo.</span>
          </div>
          <div style={{ ...styles.filterGroup, background: '#FAF5FF', borderColor: '#E9D8FD' }}>
            <span style={{ ...styles.label, color: '#6D5BBA' }}>2. Período de Retorno Avaliado</span>
            <div style={styles.inputRow}>
              <input type="date" value={dataRetornoInicio} onChange={(e) => setDataRetornoInicio(e.target.value)} style={styles.input} />
              <span style={{ color: '#9CA3AF', fontSize: '14px' }}>até</span>
              <input type="date" value={dataRetornoFim} onChange={(e) => setDataRetornoFim(e.target.value)} style={styles.input} />
            </div>
            <span style={{ ...styles.filterSub, color: '#6D5BBA' }}>Verifica o retorno registrado na agenda e nas comandas.</span>
          </div>
        </div>
      </div>

      <div style={styles.kpiGrid}>
        <div style={styles.kpiCard}>
          <span style={styles.kpiLabel}>Atendimentos Analisados</span>
          <h2 style={styles.kpiValue}>{totalAnalisados}</h2>
        </div>
        <div style={styles.kpiCard}>
          <span style={styles.kpiLabel}>Retornaram</span>
          <h2 style={styles.kpiValueGreen}>{totalRetornaram} <span style={styles.kpiSub}>({percRetorno}%)</span></h2>
        </div>
        <div style={styles.kpiCard}>
          <span style={styles.kpiLabel}>Sem Retorno no Período</span>
          <h2 style={styles.kpiValueRed}>{totalPerdidos}</h2>
        </div>
        <div style={{ ...styles.kpiCard, border: '1px solid rgba(255, 107, 44, 0.2)' }}>
          <span style={styles.kpiLabel}>Receita em Risco Estimada</span>
          <h2 style={styles.kpiValueOrange}>R$ {totalReceitaRisco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
        </div>
      </div>

      <div style={styles.tableCard}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Profissional</th>
              <th style={styles.th}>Retenção</th>
              <th style={styles.th}>Impacto Financeiro</th>
              <th style={styles.th}>Ação</th>
            </tr>
          </thead>
          <tbody>
            {profissionais.length === 0 ? (
              <tr>
                <td colSpan="4" style={{ padding: '32px', textAlign: 'center', color: '#6B7280' }}>
                  {carregando ? 'Carregando dados reais da equipe...' : 'Nenhum registro de retorno encontrado no período selecionado.'}
                </td>
              </tr>
            ) : (
              profissionais.map((p) => (
                <React.Fragment key={p.id}>
                  <tr style={{ ...styles.tr, background: expandedRow === p.id ? '#F9FAFB' : '#FFF' }} onClick={() => setExpandedRow(expandedRow === p.id ? null : p.id)}>
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
                      <p style={{ ...styles.metricTitle, color: p.retencao < 70 ? '#DC2626' : '#111827' }}>{p.retencao}%</p>
                      <p style={styles.metricSub}>{p.perdidos} sem retorno</p>
                    </td>
                    <td style={styles.td}>
                      <p style={{ ...styles.metricTitle, color: p.receitaRisco > 2000 ? '#DC2626' : '#111827' }}>R$ {p.receitaRisco.toFixed(2)}</p>
                      <p style={styles.metricSub}>Receita em risco</p>
                    </td>
                    <td style={styles.td}>
                      {expandedRow === p.id ? <ChevronUp size={24} color="#6B7280" /> : <ChevronDown size={24} color="#6B7280" />}
                    </td>
                  </tr>
                  {expandedRow === p.id && (
                    <tr>
                      <td colSpan="4" style={{ padding: 0 }}>
                        <div style={styles.expandedBox}>
                          <h4 style={styles.expandedTitle}>Clientes sem retorno ({p.clientesPerdidos.length})</h4>
                          {p.clientesPerdidos.length > 0 ? (
                            <div style={styles.clienteList}>
                              {p.clientesPerdidos.map((c, i) => (
                                <div key={i} style={styles.clienteCard}>
                                  <div>
                                    <p style={styles.clienteName}>{c.nome}</p>
                                    <p style={styles.profProfile}>{c.telefone} • Há {c.diasAtraso} dias</p>
                                  </div>
                                  <div>
                                    <span style={{ fontSize: '14px', fontWeight: 800, color: '#DC2626' }}>R$ {Number(c.ticket || 0).toFixed(2)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p style={styles.metricSub}>Nenhum cliente pendente de retorno para este profissional no período analisado.</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalCampanha && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(17, 24, 39, 0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ background: '#FFF', borderRadius: '16px', width: '100%', maxWidth: '680px', overflowX: 'auto' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#111827', margin: '0 0 4px 0' }}>Campanha de Reativação</h2>
                <p style={{ fontSize: '14px', color: '#6B7280', margin: 0 }}>Revise a mensagem antes de enviar pelos canais autorizados.</p>
              </div>
              <button onClick={() => setModalCampanha(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px', color: '#6B7280' }}>
                <span style={{ fontSize: '24px', lineHeight: 1 }}>&times;</span>
              </button>
            </div>
            <div style={{ padding: '24px', background: '#F9FAFB' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '8px' }}>Mensagem Personalizada</label>
              <textarea
                value={mensagemCampanha}
                onChange={(e) => setMensagemCampanha(e.target.value)}
                style={{ width: '100%', height: '160px', padding: '16px', borderRadius: '12px', border: '1px solid #D1D5DB', fontSize: '15px', color: '#111827', lineHeight: '1.5' }}
              />
            </div>
            <div style={{ padding: '20px 24px', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: '#FFF' }}>
              <button onClick={() => setModalCampanha(false)} style={{ padding: '10px 20px', background: '#F3F4F6', color: '#374151', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '14px' }}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RelatorioRetornoProfissional;
