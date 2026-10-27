import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Search, Filter, Download, Sparkles, ChevronLeft, Calendar, FileText } from 'lucide-react';
import { todosRelatorios } from './relatoriosData';

const RelatorioDinamico = () => {
  const { codigo } = useParams();
  const [dataAnaliseInicio, setDataAnaliseInicio] = useState('2026-09-01');
  const [dataAnaliseFim, setDataAnaliseFim] = useState('2026-10-26');
  const [relatorio, setRelatorio] = useState(null);

  useEffect(() => {
    const found = todosRelatorios.find(r => r.codigo === codigo);
    if (found) setRelatorio(found);
  }, [codigo]);

  if (!relatorio) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Carregando relatório...</div>;
  }

  // Gera colunas dinâmicas baseadas na categoria
  const colunas = relatorio.categoria === 'Clientes' 
    ? ['Nome do Cliente', 'Telefone', 'Email', 'Última Visita', 'Ticket Médio', 'Ação']
    : relatorio.categoria === 'Financeiro' || relatorio.categoria === 'Caixas'
    ? ['Data', 'Transação', 'Descrição', 'Valor', 'Método', 'Status']
    : relatorio.categoria === 'Profissionais'
    ? ['Profissional', 'Serviços', 'Comissão', 'Descontos', 'Total', 'Ação']
    : relatorio.categoria === 'Produtos'
    ? ['Produto', 'Marca', 'Estoque Atual', 'Estoque Mínimo', 'Custo', 'Valor Venda']
    : ['ID', 'Data', 'Descrição', 'Valor', 'Status', 'Ação'];

  // Gera dados mockados
  const mockData = Array.from({ length: 7 }).map((_, i) => {
    if (relatorio.categoria === 'Clientes') {
      return ['Cliente VIP ' + (i+1), '(65) 99999-00' + i, `cliente${i}@email.com`, '2026-10-' + (10+i), 'R$ 150,00', 'Ver Ficha'];
    }
    if (relatorio.categoria === 'Financeiro' || relatorio.categoria === 'Caixas') {
      return ['26/10/2026', 'TRX-' + (1000+i), 'Recebimento de Serviço', 'R$ 80,00', 'PIX', 'Concluído'];
    }
    if (relatorio.categoria === 'Produtos') {
      return ['Produto Exemplo ' + (i+1), 'Marca X', (50 - i*5).toString(), '10', 'R$ 20,00', 'R$ 55,00'];
    }
    if (relatorio.categoria === 'Profissionais') {
      return ['Profissional ' + (i+1), (15+i).toString(), 'R$ ' + (300+i*10) + ',00', 'R$ 0,00', 'R$ ' + (300+i*10) + ',00', 'Ver Ficha'];
    }
    return ['#' + (1000+i), '26/10/2026', 'Registro Automático', 'R$ 0,00', 'Ativo', 'Detalhes'];
  });

  const styles = {
    container: { padding: '24px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'var(--font)' },
    topNav: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' },
    backLink: { display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--muted)', fontSize: '13px', textDecoration: 'none', fontWeight: 600 },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' },
    h1: { fontSize: '24px', fontWeight: 700, color: 'var(--text)', margin: '0 0 8px 0', letterSpacing: '-0.5px' },
    sup: { fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1px' },
    actions: { display: 'flex', gap: '12px' },
    btnPrimary: { display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', background: 'var(--text)', color: 'var(--bg)', fontSize: '13px', fontWeight: 600, borderRadius: '8px', border: 'none', cursor: 'pointer' },
    btnSecondary: { display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', background: 'var(--bg)', color: 'var(--text)', fontSize: '13px', fontWeight: 600, borderRadius: '8px', border: '1px solid var(--border)', cursor: 'pointer' },
    
    // Filtros e Insights
    filterCard: { background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: '20px', marginBottom: '24px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' },
    filterGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
    label: { fontSize: '12px', fontWeight: 600, color: 'var(--muted)' },
    inputGroup: { display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border)' },
    input: { padding: '8px 12px', border: 'none', background: 'transparent', color: 'var(--text)', fontSize: '14px', outline: 'none' },
    
    insightCard: { background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: '24px', marginBottom: '24px', position: 'relative', overflow: 'hidden' },
    insightHeader: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' },
    iconBox: { background: 'var(--card2)', padding: '10px', borderRadius: '12px', color: 'var(--accent)' },
    insightTitle: { fontSize: '16px', fontWeight: 700, color: 'var(--text)', margin: 0 },
    insightText: { fontSize: '14px', color: 'var(--muted)', lineHeight: '1.5', margin: 0, maxWidth: '90%' },
    
    // Tabela
    tableCard: { background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' },
    table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
    th: { padding: '16px 20px', borderBottom: '1px solid var(--border)', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' },
    tr: { borderBottom: '1px solid var(--border)' },
    td: { padding: '16px 20px', verticalAlign: 'middle', fontSize: '13px', color: 'var(--text)', fontWeight: 500 }
  };

  return (
    <div style={styles.container}>
      <div style={styles.topNav}>
        <Link to="/admin/relatorios/dino" style={styles.backLink}>
          <ChevronLeft size={16} />
          Voltar para Central
        </Link>
      </div>

      <div style={styles.header}>
        <div>
          <span style={styles.sup}>DINO · {relatorio.categoria.toUpperCase()}</span>
          <h1 style={styles.h1}>{relatorio.nome}</h1>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '14px', maxWidth: '600px', lineHeight: '1.4' }}>{relatorio.descricao}</p>
        </div>
        <div style={styles.actions}>
          <button style={styles.btnSecondary} onClick={() => window.location.reload()}>
            <Search size={16} /> Buscar
          </button>
          <button style={styles.btnPrimary}>
            <Download size={16} /> Exportar
          </button>
        </div>
      </div>

      <div style={styles.filterCard}>
        <div style={styles.filterGroup}>
          <span style={styles.label}><Filter size={14} style={{verticalAlign: 'text-bottom', marginRight: 4}}/> Período Analisado:</span>
          <div style={styles.inputGroup}>
            <input type="date" value={dataAnaliseInicio} onChange={(e) => setDataAnaliseInicio(e.target.value)} style={styles.input} />
            <span style={{ color: 'var(--muted)', fontSize: '13px' }}>até</span>
            <input type="date" value={dataAnaliseFim} onChange={(e) => setDataAnaliseFim(e.target.value)} style={styles.input} />
          </div>
        </div>
      </div>

      <div style={styles.insightCard}>
        <div style={styles.insightHeader}>
          <div style={styles.iconBox}><Sparkles size={20} /></div>
          <h3 style={styles.insightTitle}>Insights da IA de Dino T-Rex</h3>
        </div>
        <p style={styles.insightText}>
          Com base na sua seleção de <b>{relatorio.categoria}</b> para o período, a inteligência artificial cruzou os dados e sugere que a operação está estabilizada. Note que o padrão de {relatorio.categoria.toLowerCase()} manteve-se consistente em relação ao ciclo anterior, permitindo uma previsibilidade sólida de caixa.
        </p>
      </div>

      <div style={styles.tableCard}>
        <table style={styles.table}>
          <thead>
            <tr>
              {colunas.map((col, idx) => <th key={idx} style={styles.th}>{col}</th>)}
            </tr>
          </thead>
          <tbody>
            {mockData.map((row, idx) => (
              <tr key={idx} style={styles.tr}>
                {row.map((cell, cidx) => (
                  <td key={cidx} style={{...styles.td, color: cidx === row.length -1 ? 'var(--accent)' : 'var(--text)', cursor: cidx === row.length -1 ? 'pointer' : 'default'}}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RelatorioDinamico;
