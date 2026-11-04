import React, { useState, useEffect } from 'react';
import { RefreshCw, Download, Calendar, DollarSign, Archive, User, Filter, Eye, X } from 'lucide-react';
const Card = ({ children, style }) => <div style={{ background: 'var(--card)', borderRadius: '12px', ...style }}>{children}</div>;
import { api } from '../../../../lib/api';
import { useToast } from '../../../../hooks/useToast';
import BarbeariaCaixaDetalhado from '../../BarbeariaCaixaDetalhado';

const RelatorioCaixasFechados = () => {
  const toast = useToast();
  const [caixas, setCaixas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [caixaModalId, setCaixaModalId] = useState(null);
  const [dataInicio, setDataInicio] = useState(new Date(new Date().setDate(1)).toISOString().slice(0, 10)); // 1st day of month
  const [dataFim, setDataFim] = useState(new Date().toISOString().slice(0, 10)); // today

  const fetchCaixas = async () => {
    setLoading(true);
    try {
      // Busca todos os caixas com status 'fechado'
      const res = await api.get(`/api/admin/barbearia/operacao/caixas?status=fechado&dataInicio=${dataInicio}&dataFim=${dataFim}`);
      setCaixas(res.data?.caixas || []);
    } catch (error) {
      console.error(error);
      toast('Erro ao buscar caixas fechados', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCaixas();
  }, [dataInicio, dataFim]);

  const styles = {
    container: { padding: '24px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'var(--font)' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' },
    sup: { fontSize: '11px', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px', display: 'block' },
    h1: { fontSize: '28px', fontWeight: 800, color: 'var(--text)', margin: '0 0 8px 0' },
    sub: { fontSize: '15px', color: 'var(--muted)', margin: 0 },
    actions: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
    filterCard: { background: 'var(--card)', borderRadius: '12px', padding: '20px', marginBottom: '24px', border: '1px solid var(--border)' },
    filterTitle: { fontSize: '16px', fontWeight: 700, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text)' },
    filterGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' },
    filterGroup: { display: 'flex', flexDirection: 'column', gap: '8px' },
    label: { fontSize: '12px', fontWeight: 600, color: 'var(--muted)' },
    input: { padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '14px', outline: 'none' },
    btnOutline: { display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' },
    tableWrapper: { background: 'var(--card)', borderRadius: '12px', border: '1px solid var(--border)', overflowX: 'auto' },
    table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
    th: { padding: '16px', borderBottom: '1px solid var(--border)', color: 'var(--muted)', fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap' },
    td: { padding: '16px', borderBottom: '1px solid var(--border)', color: 'var(--text)', fontSize: '14px' },
    badgeSuccess: { background: 'rgba(20, 184, 122, 0.1)', color: '#14b87a', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 700 },
    badgeError: { background: 'rgba(224, 92, 92, 0.1)', color: '#e05c5c', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 700 },
    badgeInfo: { background: 'var(--border)', color: 'var(--text)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 700 },
  };

  const moeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor || 0));
  const formataDataHora = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const totais = caixas.reduce((acc, c) => {
    acc.abertura += Number(c.valorAbertura || 0);
    acc.esperado += Number(c.valorEsperado || 0);
    acc.informado += Number(c.valorInformado || 0);
    acc.divergencia += Number(c.divergencia || 0);
    return acc;
  }, { abertura: 0, esperado: 0, informado: 0, divergencia: 0 });

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <span style={styles.sup}>Caixas & Operação</span>
          <h1 style={styles.h1}>Histórico de Caixas Fechados</h1>
          <p style={styles.sub}>Acompanhamento consolidado de todos os caixas encerrados na unidade</p>
        </div>
        <div style={styles.actions}>
          <button style={styles.btnOutline} onClick={fetchCaixas} disabled={loading}>
            <RefreshCw size={16} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {loading ? 'Atualizando...' : 'Atualizar'}
          </button>
          <button style={styles.btnOutline}>
            <Download size={16} /> Exportar CSV
          </button>
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <Card style={{ padding: '20px', border: '1px solid var(--border)' }}>
          <div style={{ color: 'var(--muted)', fontSize: '13px', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Archive size={16} /> Total de Caixas
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)' }}>
            {caixas.length}
          </div>
        </Card>
        <Card style={{ padding: '20px', border: '1px solid var(--border)' }}>
          <div style={{ color: 'var(--muted)', fontSize: '13px', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <DollarSign size={16} /> Total Esperado
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)' }}>
            {moeda(totais.esperado)}
          </div>
        </Card>
        <Card style={{ padding: '20px', border: '1px solid var(--border)' }}>
          <div style={{ color: 'var(--muted)', fontSize: '13px', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <DollarSign size={16} /> Total Informado (Físico)
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)' }}>
            {moeda(totais.informado)}
          </div>
        </Card>
        <Card style={{ padding: '20px', border: '1px solid var(--border)' }}>
          <div style={{ color: 'var(--muted)', fontSize: '13px', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <DollarSign size={16} /> Divergência Acumulada
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: totais.divergencia < 0 ? '#e05c5c' : (totais.divergencia > 0 ? '#14b87a' : 'var(--text)') }}>
            {moeda(totais.divergencia)}
          </div>
        </Card>
      </div>

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Caixa / Data</th>
              <th style={styles.th}>Responsável</th>
              <th style={styles.th}>Abertura / Fechamento</th>
              <th style={styles.th}>Abertura (R$)</th>
              <th style={styles.th}>Esperado (R$)</th>
              <th style={styles.th}>Contado (R$)</th>
             <th style={styles.th}>Divergência</th>
             <th style={styles.th}>Obs</th>
             <th style={{ ...styles.th, textAlign: 'center' }}>Ação</th>
           </tr>
         </thead>
          <tbody>
            {caixas.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                  Nenhum caixa fechado encontrado.
                </td>
              </tr>
            ) : (
              caixas.map((caixa) => (
                <tr key={caixa.id}>
                  <td style={styles.td}>
                    <div style={{ fontWeight: 700 }}>Caixa {caixa.numeroCaixa}</div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{caixa.data}</div>
                  </td>
                  <td style={styles.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <User size={14} /> {caixa.responsavel || 'Sistema'}
                    </div>
                  </td>
                  <td style={styles.td}>
                    <div style={{ fontSize: '12px', marginBottom: '4px' }}>A: {formataDataHora(caixa.abertoEm)}</div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)' }}>F: {formataDataHora(caixa.fechadoEm)}</div>
                  </td>
                  <td style={styles.td}>{moeda(caixa.valorAbertura)}</td>
                  <td style={styles.td}>{moeda(caixa.valorEsperado)}</td>
                  <td style={styles.td}>{moeda(caixa.valorInformado)}</td>
                  <td style={styles.td}>
                    <span style={Number(caixa.divergencia) === 0 ? styles.badgeSuccess : (Number(caixa.divergencia) < 0 ? styles.badgeError : styles.badgeInfo)}>
                      {moeda(caixa.divergencia)}
                    </span>
                  </td>
                  <td style={styles.td}>
                   <div style={{ fontSize: '12px', maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={caixa.observacao}>
                     {caixa.observacao || '—'}
                   </div>
                 </td>
                 <td style={{ ...styles.td, textAlign: 'center' }}>
                   <button
                     type="button"
                     onClick={() => setCaixaModalId(caixa.id)}
                     style={{ padding: '6px 12px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                   >
                     <Eye size={13} /> Conferir
                   </button>
                 </td>
               </tr>
             ))
           )}
         </tbody>
       </table>
     </div>

     {caixaModalId && (
       <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
         <div style={{ background: 'var(--card)', borderRadius: '14px', maxWidth: '880px', width: '100%', maxHeight: '92vh', overflowY: 'auto', border: '1px solid var(--line)', padding: '20px', position: 'relative' }}>
           <button
             type="button"
             onClick={() => setCaixaModalId(null)}
             style={{ position: 'absolute', top: '16px', right: '16px', background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: '8px', padding: '6px', cursor: 'pointer', color: 'var(--fg)', zIndex: 10 }}
           >
             <X size={20} />
           </button>
           <BarbeariaCaixaDetalhado
             caixaId={caixaModalId}
             onCaixaAtualizado={() => {
               fetchCaixas();
             }}
             toast={(msg, type) => toast(msg, type)}
           />
         </div>
       </div>
     )}
    </div>
  );
};

export default RelatorioCaixasFechados;
