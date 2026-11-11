import React, { useState, useEffect, useCallback } from 'react';
import { Activity, Sparkles, Filter, ChevronDown, DollarSign, RefreshCw, Search, ChevronUp, Download } from 'lucide-react';
import { api } from '../../../../lib/api';

const RelatorioDesempenhoProfissional = () => {
  const [dataAnaliseInicio, setDataAnaliseInicio] = useState('2026-10-31');
  const [dataAnaliseFim, setDataAnaliseFim] = useState('2026-11-10');
  const [expandedRow, setExpandedRow] = useState(null);
  const [profissionais, setProfissionais] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  const carregarDadosReais = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const qs = new URLSearchParams({
        de: dataAnaliseInicio,
        ate: dataAnaliseFim,
      }).toString();
      const res = await api(`/api/admin/barbearia/desempenho-equipe?${qs}`).catch(() => null);
      const listaApi = Array.isArray(res?.profissionais)
        ? res.profissionais
        : Array.isArray(res?.ranking)
          ? res.ranking
          : [];

      const normalizados = listaApi.map((p, idx) => {
        const nome = String(p.apelido || p.nome || `Profissional ${idx + 1}`).trim();
        const partes = nome.split(/\s+/);
        const iniciais = partes.length >= 2
          ? `${partes[0][0]}${partes[1][0]}`.toUpperCase()
          : nome.slice(0, 2).toUpperCase();
        const comandas = Number(p.comandas ?? p.atendimentos ?? p.totalAtendimentos ?? 0);
        const faturamento = Number(p.faturamento ?? p.receitaTotal ?? p.totalFaturado ?? 0);
        const ticketMedio = comandas > 0 ? faturamento / comandas : Number(p.ticketMedio || 0);
        return {
          id: p.id || p.profissionalId || `prof-${idx}`,
          iniciais,
          nome,
          comandas,
          faturamento,
          ticketMedio,
          crescimento: Number(p.crescimentoPercentual ?? 0),
          perfil: p.especialidade || p.cargo || 'Equipe Oficial',
          historico: Array.isArray(p.historico) ? p.historico : [],
        };
      });
      setProfissionais(normalizados);
    } catch (e) {
      setErro(e?.message || 'Não foi possível carregar o desempenho real da equipe.');
      setProfissionais([]);
    } finally {
      setCarregando(false);
    }
  }, [dataAnaliseInicio, dataAnaliseFim]);

  useEffect(() => {
    carregarDadosReais();
  }, [carregarDadosReais]);

  const totalFaturado = profissionais.reduce((acc, curr) => acc + curr.faturamento, 0);
  const totalComandas = profissionais.reduce((acc, curr) => acc + curr.comandas, 0);
  const ticketGlobal = totalComandas > 0 ? totalFaturado / totalComandas : 0;
  const lider = profissionais[0] || null;

  const exportarCsv = () => {
    const linhas = [
      ['Profissional', 'Cargo/Perfil', 'Comandas', 'Faturamento (R$)', 'Ticket Médio (R$)'].join(';'),
      ...profissionais.map((p) =>
        [p.nome, p.perfil, p.comandas, p.faturamento.toFixed(2), p.ticketMedio.toFixed(2)].join(';')
      ),
    ];
    const blob = new Blob([linhas.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `desempenho-equipe-${dataAnaliseInicio}-${dataAnaliseFim}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const styles = {
    container: { padding: '32px', maxWidth: '100%', margin: '0 auto', fontFamily: 'var(--font-display)', background: '#F8F9FB', minHeight: '100vh', color: '#1A1A24' },
    headerBox: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
    sup: { fontSize: '11px', fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'block' },
    h1: { fontSize: '32px', fontWeight: 900, color: '#111827', margin: '0 0 8px 0' },
    sub: { fontSize: '15px', color: '#6B7280', margin: 0 },
    actions: { display: 'flex', gap: '12px' },
    btnOutline: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#FFFFFF', color: '#374151', border: '1px solid #D1D5DB', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
    btnPrimary: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#6D5BBA', color: '#FFFFFF', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '14px', boxShadow: '0 4px 6px rgba(109, 91, 186, 0.25)' },
    aiCard: { background: '#F5F3FA', borderRadius: '16px', borderLeft: '4px solid #6D5BBA', padding: '28px', marginBottom: '32px', display: 'flex', gap: '24px', alignItems: 'flex-start' },
    aiIconBox: { background: '#EAE5F5', padding: '14px', borderRadius: '12px', display: 'flex' },
    aiContent: { flex: 1 },
    aiTitle: { fontSize: '18px', fontWeight: 800, margin: '0 0 12px 0', color: '#111827' },
    aiText: { fontSize: '15px', lineHeight: '1.6', margin: '0', color: '#4B5563' },
    aiStrong: { fontWeight: 800, color: '#111827' },
    kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '32px' },
    kpiCard: { background: '#FFFFFF', padding: '24px', borderRadius: '12px', border: '1px solid #E5E7EB', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' },
    kpiLabel: { fontSize: '13px', fontWeight: 700, color: '#6B7280', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' },
    kpiValue: { fontSize: '36px', fontWeight: 900, color: '#111827', margin: 0, letterSpacing: '-1px' },
    kpiValueGreen: { fontSize: '36px', fontWeight: 900, color: '#059669', margin: 0, letterSpacing: '-1px' },
    kpiSub: { fontSize: '15px', color: '#6B7280', marginLeft: '6px', fontWeight: 700 },
    filterRow: { background: '#FFFFFF', padding: '16px 24px', borderRadius: '12px', border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px' },
    input: { padding: '10px 16px', borderRadius: '8px', border: '1px solid #D1D5DB', background: '#FFFFFF', color: '#111827', fontSize: '15px', outline: 'none' },
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
    chartContainer: { background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '20px' },
  };

  return (
    <div style={styles.container}>
      <div style={styles.headerBox}>
        <div>
          <span style={styles.sup}>RELATÓRIO OPERACIONAL · DADOS REAIS DO PERÍODO</span>
          <h1 style={styles.h1}>Desempenho e Faturamento da Equipe</h1>
          <p style={styles.sub}>Visão real de comandas, faturamento e ticket médio por profissional autenticado.</p>
        </div>
        <div style={styles.actions}>
          <button style={styles.btnOutline} onClick={carregarDadosReais}><Search size={16} /> Buscar</button>
          <button style={styles.btnOutline} onClick={carregarDadosReais}><RefreshCw size={16} /> Atualizar</button>
          <button style={styles.btnPrimary} onClick={exportarCsv} disabled={!profissionais.length}><Download size={16} /> Exportar CSV</button>
        </div>
      </div>

      <div style={styles.filterRow}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Filter size={18} color="#6B7280" />
          <span style={{ fontWeight: 700, color: '#374151' }}>Período Analisado:</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <input type="date" value={dataAnaliseInicio} onChange={(e) => setDataAnaliseInicio(e.target.value)} style={styles.input} />
          <span style={{ color: '#9CA3AF' }}>até</span>
          <input type="date" value={dataAnaliseFim} onChange={(e) => setDataAnaliseFim(e.target.value)} style={styles.input} />
        </div>
      </div>

      <div style={styles.aiCard}>
        <div style={styles.aiIconBox}><Sparkles size={24} color="#6D5BBA" /></div>
        <div style={styles.aiContent}>
          <h3 style={styles.aiTitle}>Leitura Real da Equipe</h3>
          <p style={styles.aiText}>
            {carregando ? (
              'Consultando comandas e atendimentos reais do período selecionado...'
            ) : lider ? (
              <>
                No período de <strong style={styles.aiStrong}>{dataAnaliseInicio}</strong> a <strong style={styles.aiStrong}>{dataAnaliseFim}</strong>,{' '}
                <strong style={styles.aiStrong}>{lider.nome}</strong> registrou <strong style={styles.aiStrong}>{lider.comandas} comandas</strong> com faturamento de{' '}
                <strong style={styles.aiStrong}>R$ {lider.faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong> (ticket médio de R$ {lider.ticketMedio.toFixed(2)}).
              </>
            ) : (
              'Nenhuma comanda concluída foi encontrada para o filtro selecionado.'
            )}
          </p>
        </div>
      </div>

      <div style={styles.kpiGrid}>
        <div style={styles.kpiCard}>
          <span style={styles.kpiLabel}><DollarSign size={16} /> Faturamento Total</span>
          <h2 style={styles.kpiValueGreen}>R$ {totalFaturado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
        </div>
        <div style={styles.kpiCard}>
          <span style={styles.kpiLabel}><Activity size={16} /> Comandas Geradas</span>
          <h2 style={styles.kpiValue}>{totalComandas} <span style={styles.kpiSub}>comandas</span></h2>
        </div>
        <div style={styles.kpiCard}>
          <span style={styles.kpiLabel}><ChevronUp size={16} /> Ticket Médio Global</span>
          <h2 style={styles.kpiValue}>R$ {ticketGlobal.toFixed(2)}</h2>
        </div>
      </div>

      {erro && (
        <div style={{ padding: '16px', marginBottom: '16px', borderRadius: '8px', background: '#FEF2F2', color: '#991B1B', fontWeight: 600 }}>
          {erro}
        </div>
      )}

      <div style={styles.tableCard}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Profissional</th>
              <th style={styles.th}>Faturamento Bruto</th>
              <th style={styles.th}>Ticket Médio</th>
              <th style={styles.th}>Variação</th>
              <th style={styles.th}>Ação</th>
            </tr>
          </thead>
          <tbody>
            {profissionais.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ padding: '32px', textAlign: 'center', color: '#6B7280' }}>
                  {carregando ? 'Carregando dados reais da equipe...' : 'Nenhum profissional com movimentação no período selecionado.'}
                </td>
              </tr>
            ) : (
              profissionais.map((p) => {
                const maxFaturamento = Math.max(1, ...profissionais.map((x) => x.faturamento));
                const percentBar = Math.min(100, (p.faturamento / maxFaturamento) * 100);

                return (
                  <React.Fragment key={p.id}>
                    <tr style={{ ...styles.tr, background: expandedRow === p.id ? '#F9FAFB' : '#FFF' }} onClick={() => setExpandedRow(expandedRow === p.id ? null : p.id)}>
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
                        <p style={styles.metricTitle}>R$ {p.faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        <div style={{ width: '120px', background: '#E5E7EB', height: '6px', borderRadius: '3px', marginTop: '6px' }}>
                          <div style={{ width: `${percentBar}%`, background: '#059669', height: '100%' }}></div>
                        </div>
                      </td>
                      <td style={styles.td}>
                        <p style={styles.metricTitle}>R$ {p.ticketMedio.toFixed(2)}</p>
                      </td>
                      <td style={styles.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: p.crescimento >= 0 ? '#059669' : '#DC2626' }}>
                          {p.crescimento >= 0 ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          <span style={{ fontWeight: 700 }}>{Math.abs(p.crescimento)}%</span>
                        </div>
                        <p style={styles.metricSub}>no período</p>
                      </td>
                      <td style={styles.td}>
                        {expandedRow === p.id ? <ChevronUp size={24} color="#6B7280" /> : <ChevronDown size={24} color="#6B7280" />}
                      </td>
                    </tr>
                    {expandedRow === p.id && p.historico.length > 0 && (
                      <tr>
                        <td colSpan="5" style={{ padding: 0 }}>
                          <div style={styles.expandedBox}>
                            <h4 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 16px 0', color: '#111827' }}>Histórico de Faturamento</h4>
                            <div style={{ display: 'flex', gap: '24px' }}>
                              {p.historico.map((h, i) => (
                                <div key={i} style={styles.chartContainer}>
                                  <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 0 4px 0', fontWeight: 700 }}>{h.mes}</p>
                                  <p style={{ fontSize: '18px', color: '#111827', margin: 0, fontWeight: 900 }}>R$ {Number(h.valor || 0).toLocaleString('pt-BR')}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RelatorioDesempenhoProfissional;
