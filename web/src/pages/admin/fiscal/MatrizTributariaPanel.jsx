import React, { useState, useEffect } from 'react';
import { api } from '../../../lib/api';

export default function MatrizTributariaPanel({ toast }) {
  const [regras, setRegras] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtroRegra, setFiltroRegra] = useState('TODAS');
  const [simulacaoNcm, setSimulacaoNcm] = useState('');
  const [simulacaoPreco, setSimulacaoPreco] = useState('100.00');
  const [resultadoSimulacao, setResultadoSimulacao] = useState(null);

  async function carregarRegras() {
    setCarregando(true);
    try {
      const res = await api.get('/api/admin/fiscal/matriz-tributaria')
        .catch(() => api.get('/api/admin/supermercado/tributario/matriz'))
        .catch(() => null);

      if (res && Array.isArray(res)) {
        setRegras(res);
      } else {
        setRegras([]);
      }
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarRegras();
  }, []);

  function handleSimular(e) {
    e?.preventDefault?.();
    const preco = parseFloat(simulacaoPreco) || 0;
    const regraEncontrada = regras.find(r => r.ncm === simulacaoNcm || r.descricao_grupo.toLowerCase().includes(simulacaoNcm.toLowerCase())) || regras[0];
    if (!regraEncontrada) return;

    const aliqIcms = parseFloat(regraEncontrada.aliquota_icms) || 0;
    const redBc = parseFloat(regraEncontrada.reducao_bc_icms) || 0;
    const bcIcms = preco * (1 - (redBc / 100));
    const valorIcms = bcIcms * (aliqIcms / 100);

    const aliqPis = parseFloat(regraEncontrada.aliquota_pis) || 0;
    const valorPis = preco * (aliqPis / 100);

    const aliqCofins = parseFloat(regraEncontrada.aliquota_cofins) || 0;
    const valorCofins = preco * (aliqCofins / 100);

    const totalImpostos = valorIcms + valorPis + valorCofins;
    const cargaEfetivaPct = preco > 0 ? (totalImpostos / preco) * 100 : 0;

    setResultadoSimulacao({
      regra: regraEncontrada,
      preco,
      bcIcms,
      valorIcms,
      valorPis,
      valorCofins,
      totalImpostos,
      cargaEfetivaPct
    });

    if (toast) toast('Simulação tributária calculada!', 'success');
  }

  const regrasFiltradas = regras.filter(r => {
    const matchTipo = filtroRegra === 'TODAS' || r.tipo_regra === filtroRegra;
    const matchBusca = !busca ||
      r.descricao_grupo.toLowerCase().includes(busca.toLowerCase()) ||
      r.ncm.includes(busca) ||
      (r.cest && r.cest.includes(busca));
    return matchTipo && matchBusca;
  });

  return (
    <div className="matriz-tributaria-panel" style={{ marginTop: 16 }}>
      {/* HEADER EXECUTIVO */}
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
        color: '#ffffff',
        padding: '20px 24px',
        borderRadius: '12px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
        marginBottom: 20
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 20 }}>🏛️</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                SEFAZ-MT · Tributação e Parâmetros Fiscais
              </span>
            </div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
              Matriz Tributária Global de Produtos & Insumos
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#c7d2fe' }}>
              Parametrização fiscal automatizada de ICMS, PIS, COFINS, NCM, CEST e Substituição Tributária (ST) para todo o catálogo do grupo.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={carregarRegras}
              style={{
                background: 'rgba(255,255,255,0.15)',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.25)',
                padding: '7px 14px',
                borderRadius: '6px',
                fontSize: 12,
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              🔄 Atualizar Regras
            </button>
          </div>
        </div>

        {/* CARDS RESUMO */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginTop: 20
        }}>
          <div style={{ background: 'rgba(255,255,255,0.06)', padding: '12px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)' }}>
            <div style={{ fontSize: 11, color: '#c7d2fe', textTransform: 'uppercase' }}>Regras Homologadas</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#f8fafc', marginTop: 2 }}>{regras.length} Grupos</div>
            <div style={{ fontSize: 11, color: '#a5b4fc', marginTop: 2 }}>Catálogo completo</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.06)', padding: '12px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)' }}>
            <div style={{ fontSize: 11, color: '#c7d2fe', textTransform: 'uppercase' }}>Cesta Básica & Isenções</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#4ade80', marginTop: 2 }}>
              {regras.filter(r => r.tipo_regra === 'CESTA_BASICA' || r.tipo_regra === 'ISENTO_ALIMENTAR').length} Grupos
            </div>
            <div style={{ fontSize: 11, color: '#86efac', marginTop: 2 }}>Alíquotas reduzidas</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.06)', padding: '12px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)' }}>
            <div style={{ fontSize: 11, color: '#c7d2fe', textTransform: 'uppercase' }}>Substituição Tributária / Monofásico</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#38bdf8', marginTop: 2 }}>
              {regras.filter(r => r.tipo_regra === 'SUBSTITUICAO_TRIBUTARIA' || r.tipo_regra === 'MONOFASICO').length} Grupos
            </div>
            <div style={{ fontSize: 11, color: '#7dd3fc', marginTop: 2 }}>Bebidas e perfumaria</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.06)', padding: '12px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)' }}>
            <div style={{ fontSize: 11, color: '#c7d2fe', textTransform: 'uppercase' }}>Regime Padrão</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#facc15', marginTop: 4 }}>LUCRO REAL / SIMPLES</div>
            <div style={{ fontSize: 11, color: '#fef08a', marginTop: 2 }}>Adequação automática</div>
          </div>
        </div>
      </div>

      {/* SIMULADOR TRIBUTÁRIO RÁPIDO */}
      <div style={{
        background: '#ffffff',
        padding: '16px 20px',
        borderRadius: 8,
        border: '1px solid #e2e8f0',
        marginBottom: 16
      }}>
        <h4 style={{ margin: '0 0 10px 0', fontSize: 14, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>🧮</span> Simulador Rápido de Carga Tributária por Item
        </h4>
        <form onSubmit={handleSimular} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
              NCM ou Grupo do Produto:
            </label>
            <input
              type="text"
              placeholder="Ex: 10063021 ou Arroz"
              value={simulacaoNcm}
              onChange={(e) => setSimulacaoNcm(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
            />
          </div>
          <div style={{ width: 140 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
              Preço de Venda (R$):
            </label>
            <input
              type="number"
              step="0.01"
              value={simulacaoPreco}
              onChange={(e) => setSimulacaoPreco(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
            />
          </div>
          <button
            type="submit"
            style={{
              background: '#4f46e5',
              color: '#ffffff',
              border: 'none',
              padding: '8px 18px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Simular Impostos
          </button>
        </form>

        {resultadoSimulacao && (
          <div style={{
            marginTop: 14,
            padding: '12px 16px',
            background: '#f8fafc',
            borderRadius: 6,
            border: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12
          }}>
            <div>
              <strong style={{ color: '#1e293b' }}>{resultadoSimulacao.regra.descricao_grupo}</strong> (NCM: {resultadoSimulacao.regra.ncm})
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                ICMS ({resultadoSimulacao.regra.aliquota_icms}%): R$ {resultadoSimulacao.valorIcms.toFixed(2)} · PIS/COFINS: R$ {(resultadoSimulacao.valorPis + resultadoSimulacao.valorCofins).toFixed(2)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: '#64748b' }}>Carga Efetiva Estimada:</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#4f46e5' }}>
                R$ {resultadoSimulacao.totalImpostos.toFixed(2)} ({resultadoSimulacao.cargaEfetivaPct.toFixed(2)}%)
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FILTROS E BUSCA */}
      <div style={{
        background: '#ffffff',
        padding: '12px 18px',
        borderRadius: 8,
        border: '1px solid #e2e8f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 16
      }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { id: 'TODAS', label: 'Todos os Grupos' },
            { id: 'CESTA_BASICA', label: 'Cesta Básica' },
            { id: 'SUBSTITUICAO_TRIBUTARIA', label: 'Substituição Tributária (ST)' },
            { id: 'MONOFASICO', label: 'PIS/COFINS Monofásico' },
            { id: 'ISENTO_ALIMENTAR', label: 'Isenção Integral' },
            { id: 'TRIBUTADO_INTEGRAL', label: 'Tributação Normal' }
          ].map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltroRegra(f.id)}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                borderRadius: 6,
                border: '1px solid',
                borderColor: filtroRegra === f.id ? '#4f46e5' : '#cbd5e1',
                background: filtroRegra === f.id ? '#4f46e5' : '#f8fafc',
                color: filtroRegra === f.id ? '#ffffff' : '#334155',
                cursor: 'pointer',
                fontWeight: filtroRegra === f.id ? 700 : 500
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Buscar por Grupo, NCM ou CEST..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid #cbd5e1',
            fontSize: 13,
            minWidth: 260
          }}
        />
      </div>

      {/* TABELA DE MATRIZ TRIBUTÁRIA */}
      <div style={{ background: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600 }}>
              <th style={{ padding: '10px 16px' }}>Grupo Tributário / NCM</th>
              <th style={{ padding: '10px 16px' }}>CEST</th>
              <th style={{ padding: '10px 16px' }}>Regra / CST ICMS</th>
              <th style={{ padding: '10px 16px' }}>Alíq. ICMS (Redução)</th>
              <th style={{ padding: '10px 16px' }}>MVA ST</th>
              <th style={{ padding: '10px 16px' }}>PIS / COFINS</th>
              <th style={{ padding: '10px 16px' }}>IBPT Transparência</th>
            </tr>
          </thead>
          <tbody>
            {regrasFiltradas.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>
                  Nenhuma regra encontrada para o filtro selecionado.
                </td>
              </tr>
            ) : (
              regrasFiltradas.map((r, idx) => (
                <tr key={r.id || idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                  <td style={{ padding: '10px 16px' }}>
                    <strong style={{ color: '#0f172a' }}>{r.descricao_grupo}</strong>
                    <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#64748b' }}>NCM: {r.ncm}</div>
                  </td>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 12, color: '#475569' }}>
                    {r.cest || '-'}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      background: r.tipo_regra === 'CESTA_BASICA' ? '#f0fdf4' : r.tipo_regra === 'SUBSTITUICAO_TRIBUTARIA' ? '#eff6ff' : '#faf5ff',
                      color: r.tipo_regra === 'CESTA_BASICA' ? '#15803d' : r.tipo_regra === 'SUBSTITUICAO_TRIBUTARIA' ? '#1d4ed8' : '#7e22ce',
                      border: '1px solid rgba(0,0,0,0.06)'
                    }}>
                      CST {r.cst_icms} · {r.tipo_regra}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <strong>{r.aliquota_icms}%</strong>
                    {parseFloat(r.reducao_bc_icms) > 0 && (
                      <span style={{ fontSize: 11, color: '#15803d', display: 'block' }}>(-{r.reducao_bc_icms}% BC)</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 16px', color: parseFloat(r.aliquota_mva_st) > 0 ? '#1d4ed8' : '#94a3b8', fontWeight: 600 }}>
                    {parseFloat(r.aliquota_mva_st) > 0 ? `${r.aliquota_mva_st}%` : '-'}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ fontSize: 12 }}>PIS: {r.aliquota_pis}% (CST {r.cst_pis_cofins})</div>
                    <div style={{ fontSize: 12 }}>COFINS: {r.aliquota_cofins}%</div>
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: 11, color: '#64748b' }}>
                    Fed: {r.ibpt_federal}% | Est: {r.ibpt_estadual}%
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
