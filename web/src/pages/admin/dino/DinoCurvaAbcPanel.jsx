import { useState, useEffect, useMemo } from 'react';
import { api } from '../../../lib/api';

const styles = {
  card: {
    background: 'var(--surface, #ffffff)',
    border: '1px solid var(--line, #e2e8f0)',
    borderRadius: 14,
    padding: 20,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))',
    gap: 12,
  },
  kpi: {
    background: 'var(--surface-2, #f8fafc)',
    border: '1px solid var(--line, #e2e8f0)',
    borderRadius: 12,
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--muted, #64748b)',
    textTransform: 'uppercase',
    letterSpacing: '.04em',
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: 900,
    color: 'var(--text, #0f172a)',
  },
  btn: {
    border: '1px solid var(--line, #cbd5e1)',
    background: 'var(--surface, #ffffff)',
    color: 'var(--text, #1e293b)',
    padding: '8px 14px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    transition: 'all .15s ease',
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid var(--line, #cbd5e1)',
    background: 'var(--surface, #ffffff)',
    color: 'var(--text, #0f172a)',
    fontSize: 13,
    boxSizing: 'border-box',
  },
  badge: (bg, cor) => ({
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 8px',
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 800,
    color: cor,
    background: bg,
    whiteSpace: 'nowrap',
  }),
};

export default function DinoCurvaAbcPanel({ fmtR, toast }) {
  const [dias, setDias] = useState(90);
  const [criterio, setCriterio] = useState('receita');
  const [filtroClasse, setFiltroClasse] = useState('todas');
  const [busca, setBusca] = useState('');
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(false);

  async function carregarCurvaAbc() {
    setLoading(true);
    try {
      const res = await api.get(`/api/admin/barbearia/compras/curva-abc?dias=${dias}&criterio=${criterio}`);
      setDados(res);
    } catch (err) {
      console.warn('Erro ao carregar Curva ABC:', err);
      toast?.(err.message || 'Erro ao carregar dados da Curva ABC', 'erro');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarCurvaAbc();
  }, [dias, criterio]);

  const linhasFiltradas = useMemo(() => {
    if (!dados?.linhas) return [];
    return dados.linhas.filter((l) => {
      if (filtroClasse === 'parados' && !l.parado) return false;
      if (filtroClasse !== 'todas' && filtroClasse !== 'parados' && l.classe !== filtroClasse) return false;
      if (busca) {
        const termo = busca.toLowerCase();
        if (!l.nome.toLowerCase().includes(termo)) return false;
      }
      return true;
    });
  }, [dados, filtroClasse, busca]);

  const classeA = dados?.resumo?.find((r) => r.classe === 'A') || { itens: 0, receita: 0, margem: 0 };
  const classeB = dados?.resumo?.find((r) => r.classe === 'B') || { itens: 0, receita: 0, margem: 0 };
  const classeC = dados?.resumo?.find((r) => r.classe === 'C') || { itens: 0, receita: 0, margem: 0 };
  const totalParados = dados?.parados?.length || 0;
  const valorParados = (dados?.parados || []).reduce((s, p) => s + (p.valorEmEstoque || 0), 0);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* ── KPIS EXECUTIVOS DA CURVA ABC ── */}
      <div style={styles.kpiGrid}>
        <div style={styles.kpi}>
          <div style={styles.kpiLabel}>Receita de Revenda ({dias} dias)</div>
          <div style={{ ...styles.kpiValue, color: '#0284c7' }}>
            {fmtR(dados?.receitaTotal || 0)}
          </div>
        </div>
        <div style={styles.kpi}>
          <div style={styles.kpiLabel}>Margem Bruta Média</div>
          <div style={{ ...styles.kpiValue, color: '#16a34a' }}>
            {fmtR(dados?.margemTotal || 0)}
          </div>
        </div>
        <div style={styles.kpi}>
          <div style={styles.kpiLabel}>Capital Total em Estoque</div>
          <div style={{ ...styles.kpiValue, color: '#0f172a' }}>
            {fmtR(dados?.valorEmEstoque || 0)}
          </div>
        </div>
        <div style={styles.kpi}>
          <div style={styles.kpiLabel}>Estoque Parado (Sem Giro)</div>
          <div style={{ ...styles.kpiValue, color: totalParados > 0 ? '#ef4444' : '#10b981' }}>
            {totalParados} itens ({fmtR(valorParados)})
          </div>
        </div>
      </div>

      {/* ── CARDS DE DISTRIBUIÇÃO DAS CLASSES A, B, C ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 12 }}>
        {/* Classe A */}
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={styles.badge('#dcfce7', '#15803d')}>CLASSE A · VITAIS (80% RECEITA)</span>
            <span style={{ fontSize: 13, fontWeight: 900, color: '#166534' }}>{classeA.itens} produtos</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#166534', margin: '8px 0 2px' }}>
            {fmtR(classeA.receita)}
          </div>
          <div style={{ fontSize: 11, color: '#166534' }}>
            Itens de alto impacto e giro. <strong>Nunca podem faltar</strong> na bancada nem na revenda.
          </div>
        </div>

        {/* Classe B */}
        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 12, padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={styles.badge('#e0f2fe', '#0369a1')}>CLASSE B · INTERMEDIÁRIOS (15%)</span>
            <span style={{ fontSize: 13, fontWeight: 900, color: '#0369a1' }}>{classeB.itens} produtos</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#0369a1', margin: '8px 0 2px' }}>
            {fmtR(classeB.receita)}
          </div>
          <div style={{ fontSize: 11, color: '#0369a1' }}>
            Itens de importância média. Reposição padrão conforme giro mensal.
          </div>
        </div>

        {/* Classe C */}
        <div style={{ background: '#fefce8', border: '1px solid #fef08a', borderRadius: 12, padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={styles.badge('#fef9c3', '#a16207')}>CLASSE C · CAUDA LONGA (5%)</span>
            <span style={{ fontSize: 13, fontWeight: 900, color: '#a16207' }}>{classeC.itens} produtos</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#a16207', margin: '8px 0 2px' }}>
            {fmtR(classeC.receita)}
          </div>
          <div style={{ fontSize: 11, color: '#a16207' }}>
            Itens de conveniência ou baixo giro. Evitar compras em excesso para não imobilizar capital.
          </div>
        </div>
      </div>

      {/* ── CARD PRINCIPAL DA TABELA ANALÍTICA ── */}
      <div style={styles.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Classificação Curva ABC & Saúde do Estoque</h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted, #64748b)' }}>
              Análise algorítmica de giro e relevância financeira para apoio na decisão de compras e precificação.
            </p>
          </div>

          {/* Filtros de Período e Critério */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', border: '1px solid var(--line, #cbd5e1)', borderRadius: 8, overflow: 'hidden' }}>
              {[
                { v: 30, l: '30 dias' },
                { v: 60, l: '60 dias' },
                { v: 90, l: '90 dias' },
                { v: 180, l: '180 dias' },
              ].map((p) => (
                <button
                  key={p.v}
                  type="button"
                  style={{
                    padding: '6px 12px',
                    fontSize: 11,
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    background: dias === p.v ? '#0284c7' : 'var(--surface, #ffffff)',
                    color: dias === p.v ? '#ffffff' : 'var(--text, #1e293b)',
                  }}
                  onClick={() => setDias(p.v)}
                >
                  {p.l}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', border: '1px solid var(--line, #cbd5e1)', borderRadius: 8, overflow: 'hidden' }}>
              <button
                type="button"
                style={{
                  padding: '6px 12px',
                  fontSize: 11,
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  background: criterio === 'receita' ? '#16a34a' : 'var(--surface, #ffffff)',
                  color: criterio === 'receita' ? '#ffffff' : 'var(--text, #1e293b)',
                }}
                onClick={() => setCriterio('receita')}
              >
                Por Faturamento
              </button>
              <button
                type="button"
                style={{
                  padding: '6px 12px',
                  fontSize: 11,
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  background: criterio === 'margem' ? '#16a34a' : 'var(--surface, #ffffff)',
                  color: criterio === 'margem' ? '#ffffff' : 'var(--text, #1e293b)',
                }}
                onClick={() => setCriterio('margem')}
              >
                Por Margem de Lucro
              </button>
            </div>
          </div>
        </div>

        {/* Filtro por Classe e Campo de Busca */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { id: 'todas', label: 'Todos os Itens' },
              { id: 'A', label: '🟢 Classe A' },
              { id: 'B', label: '🔵 Classe B' },
              { id: 'C', label: '🟡 Classe C' },
              { id: 'parados', label: `🔴 Estoque Parado (${totalParados})` },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                style={{
                  ...styles.btn,
                  background: filtroClasse === f.id ? '#0f172a' : 'var(--surface, #ffffff)',
                  color: filtroClasse === f.id ? '#ffffff' : 'var(--text, #1e293b)',
                  borderColor: filtroClasse === f.id ? '#0f172a' : 'var(--line, #cbd5e1)',
                }}
                onClick={() => setFiltroClasse(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div style={{ width: 260 }}>
            <input
              type="text"
              placeholder="Filtrar por nome do produto..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              style={styles.input}
            />
          </div>
        </div>

        {/* Tabela Curva ABC */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--line, #e2e8f0)', color: 'var(--muted, #64748b)', textAlign: 'left' }}>
                <th style={{ padding: '8px 6px', textAlign: 'center', width: 60 }}>Classe</th>
                <th style={{ padding: '8px 6px' }}>Produto</th>
                <th style={{ textAlign: 'center', padding: '8px 6px' }}>Vendas (Qtd)</th>
                <th style={{ textAlign: 'right', padding: '8px 6px' }}>Receita Gerada</th>
                <th style={{ textAlign: 'right', padding: '8px 6px' }}>Margem Bruta</th>
                <th style={{ textAlign: 'center', padding: '8px 6px' }}>Saldo Estoque</th>
                <th style={{ textAlign: 'right', padding: '8px 6px' }}>Valor em Estoque</th>
                <th style={{ textAlign: 'center', padding: '8px 6px' }}>Giro</th>
                <th style={{ textAlign: 'right', padding: '8px 6px' }}>Part. (%)</th>
                <th style={{ textAlign: 'right', padding: '8px 6px' }}>Acum. (%)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>
                    Calculando giro e curvas de produto...
                  </td>
                </tr>
              ) : linhasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>
                    Nenhum produto encontrado neste filtro.
                  </td>
                </tr>
              ) : (
                linhasFiltradas.map((l) => {
                  let badge = styles.badge('#fef9c3', '#a16207');
                  if (l.classe === 'A') badge = styles.badge('#dcfce7', '#15803d');
                  else if (l.classe === 'B') badge = styles.badge('#e0f2fe', '#0369a1');

                  return (
                    <tr key={l.produtoId} style={{ borderBottom: '1px solid var(--line, #f1f5f9)' }}>
                      <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                        <span style={badge}>{l.classe}</span>
                      </td>
                      <td style={{ padding: '8px 6px' }}>
                        <strong>{l.nome}</strong>
                        {l.parado && (
                          <span style={{ ...styles.badge('#fee2e2', '#b91c1c'), marginLeft: 6, fontSize: 10 }}>
                            ⚠️ Sem Venda ({dias}d)
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', padding: '8px 6px', fontWeight: 700 }}>
                        {l.quantidade} un
                      </td>
                      <td style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 800 }}>
                        {fmtR(l.receita)}
                      </td>
                      <td style={{ textAlign: 'right', padding: '8px 6px', color: '#16a34a', fontWeight: 700 }}>
                        {fmtR(l.margem)}
                        {l.margemPercentual !== null && (
                          <div style={{ fontSize: 10, color: 'var(--muted)' }}>({l.margemPercentual}%)</div>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', padding: '8px 6px', fontWeight: 700 }}>
                        {l.estoqueAtual} un
                      </td>
                      <td style={{ textAlign: 'right', padding: '8px 6px' }}>
                        {fmtR(l.valorEmEstoque)}
                      </td>
                      <td style={{ textAlign: 'center', padding: '8px 6px', fontWeight: 700, color: l.giro > 1 ? '#16a34a' : 'inherit' }}>
                        {l.giro !== null ? `${l.giro}x` : '—'}
                      </td>
                      <td style={{ textAlign: 'right', padding: '8px 6px' }}>
                        {l.participacao}%
                      </td>
                      <td style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 700, color: '#0284c7' }}>
                        {l.acumulado}%
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
