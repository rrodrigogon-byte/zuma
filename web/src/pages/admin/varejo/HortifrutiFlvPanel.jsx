import React, { useState } from 'react';
import { Apple, Scale, AlertTriangle, TrendingDown, RefreshCw, CheckCircle2 } from 'lucide-react';

export default function HortifrutiFlvPanel({ toast }) {
  const [itensFlv, setItensFlv] = useState([
    { id: 'FLV-01', nome: 'Banana Prata Climatizada', plu: 2011, estoqueKg: 145.5, diasBancada: 2, maturacao: 'maduro', perdaEstimada: '2.1%' },
    { id: 'FLV-02', nome: 'Tomate Longa Vida Extra', plu: 2005, estoqueKg: 98.0, diasBancada: 3, maturacao: 'ponto_ideal', perdaEstimada: '1.5%' },
    { id: 'FLV-03', nome: 'Mamão Formosa Granel', plu: 2018, estoqueKg: 64.2, diasBancada: 4, maturacao: 'avancado', perdaEstimada: '4.8%' },
    { id: 'FLV-04', nome: 'Batata Inglesa Lavada', plu: 2001, estoqueKg: 320.0, diasBancada: 1, maturacao: 'fresco', perdaEstimada: '0.8%' }
  ]);

  const aplicarRemarcacaoDinamica = (item) => {
    if (toast) toast(`Remarcação dinâmica de 30% aplicada para ${item.nome}!`, 'success');
  };

  return (
    <div className="super-card animate-fadeIn">
      <div className="super-card-header">
        <div>
          <div className="super-card-tag">PERECÍVEIS · HORTIFRÚTI (FLV) & PESÁVEIS</div>
          <h2 className="super-card-title">Gestão de Hortifrúti, Maturação & Quebras de Bancada</h2>
          <p className="super-card-subtitle">
            Acompanhamento do ciclo de vida das frutas, legumes e verduras com sugestão de remarcação anti-desperdício.
          </p>
        </div>
      </div>

      <div className="super-table-container">
        <table className="super-table">
          <thead>
            <tr>
              <th>Item FLV / Fruta / Legume</th>
              <th>PLU Balança</th>
              <th>Estoque em Bancada</th>
              <th>Dias em Exposição</th>
              <th>Estágio de Maturação</th>
              <th>Perda Estimada</th>
              <th>Ação Anti-Quebra</th>
            </tr>
          </thead>
          <tbody>
            {itensFlv.map(item => (
              <tr key={item.id}>
                <td>
                  <strong>{item.nome}</strong>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Código: {item.id}</div>
                </td>
                <td><span className="super-badge blue">PLU {item.plu}</span></td>
                <td style={{ fontWeight: 800 }}>{item.estoqueKg.toFixed(1)} kg</td>
                <td>{item.diasBancada} dia(s)</td>
                <td>
                  <span className={`super-badge ${item.maturacao === 'avancado' ? 'red' : item.maturacao === 'maduro' ? 'yellow' : 'emerald'}`}>
                    ● {item.maturacao.toUpperCase()}
                  </span>
                </td>
                <td style={{ color: item.maturacao === 'avancado' ? '#dc2626' : 'var(--muted)', fontWeight: 700 }}>
                  {item.perdaEstimada}
                </td>
                <td>
                  {item.maturacao === 'avancado' ? (
                    <button className="super-btn super-btn-sm super-btn-primary" onClick={() => aplicarRemarcacaoDinamica(item)}>
                      Remarcar -30%
                    </button>
                  ) : (
                    <span style={{ fontSize: 12, color: '#10b981' }}>Em conformidade</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
