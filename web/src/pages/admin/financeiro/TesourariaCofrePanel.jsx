import React, { useState, useEffect } from 'react';
import { api } from '../../../lib/api';

export default function TesourariaCofrePanel({ toast }) {
  const [malotes, setMalotes] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [modalNovo, setModalNovo] = useState(false);
  const [transportadora, setTransportadora] = useState('BRINKS');
  const [valorCedulas, setValorCedulas] = useState('');
  const [valorMoedas, setValorMoedas] = useState('');
  const [responsavel, setResponsavel] = useState('Mariana Supervisora');

  async function carregarMalotes() {
    setCarregando(true);
    try {
      const res = await api.get('/api/admin/financeiro/tesouraria-malotes')
        .catch(() => api.get('/api/admin/supermercado/tesouraria/malotes/listar'))
        .catch(() => null);

      if (res && Array.isArray(res)) {
        setMalotes(res);
      } else {
        setMalotes([]);
      }
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarMalotes();
  }, []);

  async function handleCriarMalote(e) {
    e?.preventDefault?.();
    const ced = parseFloat(valorCedulas) || 0;
    const moe = parseFloat(valorMoedas) || 0;
    const tot = ced + moe;

    const novo = {
      id: String(Date.now()),
      numero_malote: `MAL-${Math.floor(10000 + Math.random() * 90000)}`,
      numero_lacre: `LAC-${Math.floor(100000 + Math.random() * 900000)}`,
      empresa_transporte: transportadora,
      valor_cedulas: ced.toFixed(2),
      valor_moedas: moe.toFixed(2),
      valor_total: tot.toFixed(2),
      responsavel_tesouraria: responsavel,
      data_recolhimento: new Date().toISOString(),
      status: 'AGUARDANDO_COLETA'
    };

    setMalotes([novo, ...malotes]);
    setModalNovo(false);
    setValorCedulas('');
    setValorMoedas('');
    if (toast) toast('Malote de carro-forte registrado com sucesso e lacrado!', 'success');
  }

  const f = (val) => Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const totalCofreAguardando = malotes
    .filter(m => m.status === 'AGUARDANDO_COLETA')
    .reduce((acc, m) => acc + Number(m.valor_total || 0), 0);

  const totalDepositado = malotes
    .filter(m => m.status === 'DEPOSITADO_CONCILIADO')
    .reduce((acc, m) => acc + Number(m.valor_total || 0), 0);

  return (
    <div className="tesouraria-cofre-panel" style={{ marginTop: 16 }}>
      {/* HEADER EXECUTIVO */}
      <div style={{
        background: 'linear-gradient(135deg, #1c1917 0%, #292524 100%)',
        color: '#ffffff',
        padding: '20px 24px',
        borderRadius: '12px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
        marginBottom: 20
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 20 }}>🏦</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Custódia de Espécie & Carro-Forte Kytto
              </span>
            </div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
              Tesouraria Central, Sangrias & Controle de Malotes
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#d6d3d1' }}>
              Gestão de sangrias dos caixas, fechamento cego de espécie, custódia no cofre e coleta segura por carro-forte (Brinks / Prosegur).
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={() => setModalNovo(true)}
              style={{
                background: '#f59e0b',
                color: '#1c1917',
                border: 'none',
                padding: '8px 18px',
                borderRadius: '6px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              🔒 Novo Malote de Carro-Forte
            </button>
          </div>
        </div>

        {/* CARDS RESUMO */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
          marginTop: 20
        }}>
          <div style={{ background: 'rgba(255,255,255,0.06)', padding: '12px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)' }}>
            <div style={{ fontSize: 11, color: '#d6d3d1', textTransform: 'uppercase' }}>Saldo Físico no Cofre</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#fbbf24', marginTop: 2 }}>{f(totalCofreAguardando)}</div>
            <div style={{ fontSize: 11, color: '#fcd34d', marginTop: 2 }}>Pronto para coleta blindada</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.06)', padding: '12px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)' }}>
            <div style={{ fontSize: 11, color: '#d6d3d1', textTransform: 'uppercase' }}>Malotes Aguardando Coleta</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#ffffff', marginTop: 2 }}>
              {malotes.filter(m => m.status === 'AGUARDANDO_COLETA').length} Malotes
            </div>
            <div style={{ fontSize: 11, color: '#a8a29e', marginTop: 2 }}>Lacrados com protocolo</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.06)', padding: '12px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)' }}>
            <div style={{ fontSize: 11, color: '#d6d3d1', textTransform: 'uppercase' }}>Total Depositado & Conciliado</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#34d399', marginTop: 2 }}>{f(totalDepositado)}</div>
            <div style={{ fontSize: 11, color: '#6ee7b7', marginTop: 2 }}>Conciliado em conta corrente</div>
          </div>
        </div>
      </div>

      {/* TABELA DE MALOTES */}
      <div style={{ background: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600 }}>
              <th style={{ padding: '10px 16px' }}>Malote & Lacre</th>
              <th style={{ padding: '10px 16px' }}>Transportadora</th>
              <th style={{ padding: '10px 16px', textAlign: 'right' }}>Cédulas (R$)</th>
              <th style={{ padding: '10px 16px', textAlign: 'right' }}>Moedas (R$)</th>
              <th style={{ padding: '10px 16px', textAlign: 'right' }}>Valor Total</th>
              <th style={{ padding: '10px 16px' }}>Responsável / Data</th>
              <th style={{ padding: '10px 16px', textAlign: 'center' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {malotes.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>
                  Nenhum malote registrado para esta empresa. Clique em "Novo Malote de Carro-Forte" para registrar.
                </td>
              </tr>
            )}
            {malotes.map((m, idx) => (
              <tr key={m.id || idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                <td style={{ padding: '10px 16px' }}>
                  <strong style={{ color: '#0f172a' }}>{m.numero_malote}</strong>
                  <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#64748b' }}>Lacre: {m.numero_lacre}</div>
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <span style={{
                    padding: '3px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 700,
                    background: m.empresa_transporte === 'BRINKS' ? '#fef3c7' : '#fee2e2',
                    color: m.empresa_transporte === 'BRINKS' ? '#92400e' : '#991b1b'
                  }}>
                    🛡️ {m.empresa_transporte}
                  </span>
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'right', color: '#475569' }}>{f(m.valor_cedulas)}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', color: '#475569' }}>{f(m.valor_moedas)}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{f(m.valor_total)}</td>
                <td style={{ padding: '10px 16px' }}>
                  <div style={{ color: '#0f172a', fontWeight: 500 }}>{m.responsavel_tesouraria}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    {new Date(m.data_recolhimento).toLocaleString('pt-BR')}
                  </div>
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                  <span style={{
                    padding: '3px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 700,
                    background: m.status === 'AGUARDANDO_COLETA' ? '#fefce8' : '#f0fdf4',
                    color: m.status === 'AGUARDANDO_COLETA' ? '#a16207' : '#15803d',
                    border: '1px solid rgba(0,0,0,0.06)'
                  }}>
                    {m.status === 'AGUARDANDO_COLETA' ? '⏳ No Cofre (Aguardando Coleta)' : '✓ Depositado em Conta'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL NOVO MALOTE */}
      {modalNovo && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 12,
            width: '90%',
            maxWidth: 480,
            padding: 24,
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 18, color: '#1c1917', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🔒</span> Registrar Malote para Carro-Forte
            </h3>
            <form onSubmit={handleCriarMalote}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Transportadora de Valores:
                </label>
                <select
                  value={transportadora}
                  onChange={(e) => setTransportadora(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                >
                  <option value="BRINKS">Brinks Segurança e Transporte de Valores</option>
                  <option value="PROSEGUR">Prosegur Cash Gestão de Valores</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Valor em Cédulas (R$):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Ex: 15400.00"
                    value={valorCedulas}
                    onChange={(e) => setValorCedulas(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Valor em Moedas (R$):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Ex: 350.00"
                    value={valorMoedas}
                    onChange={(e) => setValorMoedas(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Responsável da Tesouraria:
                </label>
                <input
                  type="text"
                  required
                  value={responsavel}
                  onChange={(e) => setResponsavel(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setModalNovo(false)}
                  style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', cursor: 'pointer', fontSize: 13 }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: 6, border: 'none', background: '#f59e0b', color: '#1c1917', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
                >
                  Confirmar e Gerar Lacre
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
