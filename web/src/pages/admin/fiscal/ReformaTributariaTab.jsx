import React, { useState, useEffect } from 'react';

export default function ReformaTributariaTab() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [valorSimulado, setValorSimulado] = useState(150.0);
  const [tipoOperacao, setTipoOperacao] = useState('servico');
  const [resultadoCalc, setResultadoCalc] = useState(null);
  const [simulacaoCarga, setSimulacaoCarga] = useState(null);
  const [faturamentoEmpresa, setFaturamentoEmpresa] = useState(65000);

  const token = localStorage.getItem('token') || localStorage.getItem('sp_token');

  useEffect(() => {
    carregarConfiguracao();
    executarCalculo(valorSimulado, tipoOperacao);
    executarSimulacaoCarga(faturamentoEmpresa);
  }, []);

  async function carregarConfiguracao() {
    try {
      const res = await fetch('/api/admin/fiscal/reforma-tributaria/config', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.ok) setConfig(data.config);
    } catch (e) {
      console.error('Erro ao carregar config da reforma:', e);
    } finally {
      setLoading(false);
    }
  }

  async function executarCalculo(v, tipo) {
    try {
      const res = await fetch('/api/admin/fiscal/reforma-tributaria/calcular', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ valorOperacao: v, tipoOperacao: tipo, anoCompetencia: 2026, ufDestino: 'MT' })
      });
      const data = await res.json();
      if (data.ok) setResultadoCalc(data.resultado);
    } catch (e) {
      console.error('Erro no cálculo:', e);
    }
  }

  async function executarSimulacaoCarga(fat) {
    try {
      const res = await fetch('/api/admin/fiscal/reforma-tributaria/simular', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ faturamentoMensal: fat, regimeAtual: 'simples_nacional', segmento: 'barbearia_salao' })
      });
      const data = await res.json();
      if (data.ok) setSimulacaoCarga(data.simulacao);
    } catch (e) {
      console.error('Erro na simulação de carga:', e);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Banner Informativo */}
      <div style={{ background: '#0F172A', color: '#F8FAFC', padding: '20px 24px', borderRadius: '12px', borderLeft: '6px solid #10B981' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>⚖️</span> Motor da Reforma Tributária Nacional (EC 132/2023)
            </h2>
            <p style={{ margin: '6px 0 0 0', fontSize: '0.875rem', color: '#94A3B8' }}>
              Sistema Dual IBS (Estadual/Municipal MT) + CBS (Federal) com Split Payment Tributário Automático no PDV e Pix.
            </p>
          </div>
          <div style={{ background: '#1E293B', padding: '8px 16px', borderRadius: '8px', border: '1px solid #334155', textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: '#94A3B8', textTransform: 'uppercase' }}>Ano de Vigência Piloto</div>
            <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#38BDF8' }}>2026 (Transição Ativa)</div>
          </div>
        </div>
      </div>

      {/* Grid de Cards dos Tributos da Reforma */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
        <div style={{ background: '#FFFFFF', padding: '18px', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>CBS (Federal)</span>
            <span style={{ background: '#E0F2FE', color: '#0369A1', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>União</span>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A' }}>0,90% <span style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: 400 }}>(Piloto 2026)</span></div>
          <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '6px' }}>
            Substitui PIS e COFINS. Alíquota padrão estimada pós-2033: <strong>8,80%</strong>.
          </div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '18px', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>IBS (Estadual & Municipal)</span>
            <span style={{ background: '#DCFCE7', color: '#15803D', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>SEFAZ-MT / Tangará</span>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A' }}>0,10% <span style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: 400 }}>(Piloto 2026)</span></div>
          <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '6px' }}>
            Substitui ICMS (MT) e ISSQN. Repartição: 75% Estado MT / 25% Tangará da Serra.
          </div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '18px', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>IS (Imposto Seletivo)</span>
            <span style={{ background: '#FEF3C7', color: '#B45309', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>Extra-Fiscal</span>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A' }}>12,0% <span style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: 400 }}>(Bebidas Alcoólicas)</span></div>
          <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '6px' }}>
            Incidência seletiva sobre cervejas, destilados e cigarros do bar.
          </div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '18px', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Split Payment Tributário</span>
            <span style={{ background: '#F3E8FF', color: '#7E22CE', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>Nativo Kytto</span>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#16A34A' }}>100% Automático</div>
          <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '6px' }}>
            Retenção no momento da liquidação em cartão ou Pix com repasse líquido à conta.
          </div>
        </div>
      </div>

      {/* Simulador Interativo de Operação */}
      <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#0F172A', fontWeight: 700 }}>
          Simulador de Tributação na Operação & Split Payment
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
              Valor da Operação (R$)
            </label>
            <input
              type="number"
              value={valorSimulado}
              onChange={(e) => {
                const val = Number(e.target.value);
                setValorSimulado(val);
                executarCalculo(val, tipoOperacao);
              }}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '1rem', fontWeight: 600 }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
              Tipo de Item / Operação
            </label>
            <select
              value={tipoOperacao}
              onChange={(e) => {
                const t = e.target.value;
                setTipoOperacao(t);
                executarCalculo(valorSimulado, t);
              }}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.95rem' }}
            >
              <option value="servico">Serviço de Barbearia / Salão (Corte, Barba)</option>
              <option value="mercadoria">Mercadoria de Revenda (Pomadas, Shampoos)</option>
              <option value="bebida_alcoolica">Bebida Alcoólica do Bar (Cerveja, Destilado - IS 12%)</option>
              <option value="refrigerante">Refrigerante / Bebida Açucarada (IS 6%)</option>
              <option value="cesta_basica">Alimento / Cesta Básica Nacional (Alíquota Zero)</option>
            </select>
          </div>
        </div>

        {resultadoCalc && (
          <div style={{ background: '#F8FAFC', padding: '18px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>CBS Calculada (0,9%)</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0369A1' }}>R$ {resultadoCalc.cbs.valor.toFixed(2)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>IBS Total (0,1%)</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#15803D' }}>R$ {resultadoCalc.ibs.valor.toFixed(2)}</div>
                <div style={{ fontSize: '0.7rem', color: '#64748B' }}>
                  MT: R$ {resultadoCalc.ibs.reparticao.estadualMT.toFixed(2)} | Tangará: R$ {resultadoCalc.ibs.reparticao.municipalTangara.toFixed(2)}
                </div>
              </div>
              {resultadoCalc.is.incide && (
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#B45309', fontWeight: 600 }}>Imposto Seletivo ({resultadoCalc.is.aliquotaPercentual}%)</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#B45309' }}>R$ {resultadoCalc.is.valor.toFixed(2)}</div>
                </div>
              )}
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Total Tributos Retidos</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#DC2626' }}>R$ {resultadoCalc.totalTributosDual.toFixed(2)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Líquido na Conta (Split)</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#16A34A' }}>R$ {resultadoCalc.splitPayment.repasseLiquidoEmpresa.toFixed(2)}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Análise de Carga Tributária e Salão Parceiro */}
      {simulacaoCarga && (
        <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '1.1rem', color: '#0F172A', fontWeight: 700 }}>
            Planejamento Tributário: Simples Nacional vs Regime Dual com Salão Parceiro
          </h3>
          <p style={{ margin: '0 0 16px 0', fontSize: '0.875rem', color: '#64748B' }}>
            {simulacaoCarga.recomendacaoEstrategica}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <div style={{ background: '#F1F5F9', padding: '16px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>Regime Atual (Simples Nacional)</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A' }}>R$ {simulacaoCarga.cenarioAtual.valorRecolhidoMensal.toFixed(2)} / mês</div>
              <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '4px' }}>Alíquota nominal média: {simulacaoCarga.cenarioAtual.aliquotaNominal}%</div>
            </div>

            <div style={{ background: '#ECFDF5', padding: '16px', borderRadius: '8px', border: '1px solid #A7F3D0' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#065F46', marginBottom: '8px' }}>Transição 2026 (CBS 0,9% + IBS 0,1%)</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#047857' }}>R$ {simulacaoCarga.cenarioTransicao2026.valorMensal.toFixed(2)} / mês</div>
              <div style={{ fontSize: '0.8rem', color: '#065F46', marginTop: '4px' }}>Impacto: {simulacaoCarga.cenarioTransicao2026.impactoCaixa}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
