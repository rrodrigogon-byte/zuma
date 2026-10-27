import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Search, Filter } from 'lucide-react';
import { todosRelatorios } from './relatoriosData';
const RelatoriosDinoIndex = () => {
  const [busca, setBusca] = useState('');
  const [categoriaSelecionada, setCategoriaSelecionada] = useState('Todas');
  const categorias = ['Todas', ...new Set(todosRelatorios.map(r => r.categoria))].sort();
  const relatoriosFiltrados = useMemo(() => {
    return todosRelatorios.filter(r => {
      const matchCategoria = categoriaSelecionada === 'Todas' || r.categoria === categoriaSelecionada;
      const termo = busca.toLowerCase();
      const matchBusca = r.nome.toLowerCase().includes(termo) || r.codigo.includes(termo) || r.descricao.toLowerCase().includes(termo);
      return matchCategoria && matchBusca;
    });
  }, [busca, categoriaSelecionada]);
  const linkRelatorio = (codigo) => {
    if (codigo === '0011') return '/admin/relatorios/dino/retorno';
    if (codigo === '0002') return '/admin/relatorios/dino/clientes-atendidos';
    if (codigo === '0021') return '/admin/relatorios/dino/desempenho-profissional';
    if (codigo === '0032') return '/admin/relatorios/dino/servicos-vendidos';
    if (codigo === '0091') return '/admin/relatorios/dino/caixas-fechados';
    return `/admin/relatorios/dino/view/${codigo}`; 
  };
  
  const styles = {
    container: { padding: '24px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'var(--font)' },
    header: { marginBottom: '24px' },
    sup: { fontSize: '11px', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px', display: 'block' },
    h1: { fontSize: '28px', fontWeight: 800, color: 'var(--text)', margin: '0 0 8px 0' },
    sub: { fontSize: '15px', color: 'var(--muted)', margin: 0 },
    filtersCard: { background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '16px 20px', marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', border: '1px solid var(--border)' },
    inputWrapper: { position: 'relative', flex: '1 1 300px' },
    searchIcon: { position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' },
    input: { width: '100%', padding: '12px 16px 12px 40px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '14px', outline: 'none' },
    selectWrapper: { display: 'flex', gap: '12px', alignItems: 'center', flex: '1 1 200px' },
    select: { width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '14px', outline: 'none', cursor: 'pointer' },
    tableCard: { background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflowX: 'auto' },
    table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
    th: { padding: '16px 20px', borderBottom: '1px solid var(--border)', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' },
    tr: { borderBottom: '1px solid var(--border)', transition: 'background 0.2s' },
    td: { padding: '16px 20px', verticalAlign: 'top' },
    code: { fontSize: '13px', fontWeight: 600, color: 'var(--muted)', fontFamily: 'var(--font-mono)' },
    categoryBadge: { display: 'inline-flex', padding: '4px 10px', borderRadius: '4px', background: 'var(--card2)', color: 'var(--accent)', fontSize: '12px', fontWeight: 600 },
    reportName: { fontSize: '15px', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' },
    aiBadge: { background: 'var(--accent)', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 },
    desc: { fontSize: '13px', color: 'var(--muted)', lineHeight: '1.4', margin: 0 },
    btnPrimary: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'var(--text)', color: '#fff', fontSize: '13px', fontWeight: 600, borderRadius: '8px', textDecoration: 'none', transition: 'opacity 0.2s' },
    btnDisabled: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'var(--bg)', color: 'var(--muted)', fontSize: '13px', fontWeight: 600, borderRadius: '8px', border: '1px solid var(--border)', cursor: 'not-allowed' }
  };
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.sup}>DINO · INTELIGÊNCIA DE NEGÓCIOS</span>
        <h1 style={styles.h1}>Central de Relatórios</h1>
        <p style={styles.sub}>Acesse todos os seus {todosRelatorios.length} relatórios gerenciais e insights da IA.</p>
      </div>
      
      
      <div style={{ ...styles.filtersCard, background: 'var(--card2)', borderLeft: '4px solid var(--accent)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Sparkles size={16} color="var(--accent)" /> Gestão de Desempenho Inteligente</h3>
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--muted)' }}>Compare entregas diárias/mensais por profissional, veja novas retenções, acompanhe as metas e receba recomendações geradas pela IA Dino T-Rex para aumentar o faturamento.</p>
        <Link to="/admin/relatorios/dino/gestao-avancada" style={{ ...styles.btnPrimary, marginTop: '8px' }}>Acessar Painel IA</Link>
      </div>

      <div style={styles.filtersCard}>
        <div style={styles.inputWrapper}>
          <Search size={18} style={styles.searchIcon} />
          <input type="text" placeholder="Buscar relatório por código, nome ou descrição..." value={busca} onChange={(e) => setBusca(e.target.value)} style={styles.input} />
        </div>
        <div style={styles.selectWrapper}>
          <Filter size={18} color="var(--muted)" />
          <select value={categoriaSelecionada} onChange={(e) => setCategoriaSelecionada(e.target.value)} style={styles.select}>
            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      
      <div style={styles.tableCard}>
        <table style={styles.table}>
          <thead>
            <tr>
              
              <th style={styles.th}>Categoria</th>
              <th style={styles.th}>Relatório & Descrição</th>
              <th style={styles.th}>Ação</th>
            </tr>
          </thead>
          <tbody>
            {relatoriosFiltrados.map((r, idx) => {
              const isPremium = ['0011', '0002', '0021', '0032'].includes(r.codigo);
              const isMigrated = true; // ALL ENABLED
              return (
                <tr key={idx} style={styles.tr}>
                  
                  <td style={styles.td}><span style={styles.categoryBadge}>{r.categoria}</span></td>
                  <td style={styles.td}>
                    <div style={styles.reportName}>
                      {isMigrated ? <Search size={16} color="var(--accent)" /> : <Search size={16} color="var(--muted)" />}
                      {r.nome}
                      {isPremium && <span style={styles.aiBadge}>IA Dino T-Rex</span>}
                    </div>
                    <p style={styles.desc}>{r.descricao}</p>
                  </td>
                  <td style={styles.td}>
                    {isMigrated ? (
                      <Link to={linkRelatorio(r.codigo)} style={styles.btnPrimary}>
                        Acessar <ChevronRight size={14} />
                      </Link>
                    ) : (
                      <span style={styles.btnDisabled}>Em migração</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {relatoriosFiltrados.length === 0 && (
              <tr>
                <td colSpan="4" style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>Nenhum relatório encontrado para essa busca.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default RelatoriosDinoIndex;
