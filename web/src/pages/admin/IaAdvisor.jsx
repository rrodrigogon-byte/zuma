import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  TrendingUp, 
  AlertTriangle, 
  Sliders, 
  DollarSign, 
  Calendar, 
  ShieldCheck, 
  RefreshCw, 
  Package, 
  Users, 
  ChevronRight,
  ArrowUpRight
} from 'lucide-react';
import { api } from '../../lib/api';

export default function IaAdvisor() {
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [erro, setErro] = useState(null);

  // Parâmetros do Simulador "What-If"
  const [reajuste, setReajuste] = useState(10);
  const [demanda, setDemanda] = useState(15);
  const [colaboradores, setColaboradores] = useState(1);
  const [simulando, setSimulando] = useState(false);
  const [resultadoSimulacao, setResultadoSimulacao] = useState(null);

  async function carregarDashboard() {
    setLoading(true);
    setErro(null);
    try {
      const res = await api.get('/api/admin/ia-advisor/dashboard');
      setDashboard(res.data);
    } catch (err) {
      console.error('Erro ao carregar IA Advisor:', err);
      setErro('Não foi possível carregar os dados do IA Advisor.');
    } finally {
      setLoading(false);
    }
  }

  async function executarSimulacao() {
    setSimulando(true);
    try {
      const res = await api.post('/api/admin/ia-advisor/simulador-cenarios', {
        reajustePrecoPercentual: reajuste,
        aumentoAtendimentosPercentual: demanda,
        novosColaboradores: colaboradores
      });
      setResultadoSimulacao(res.data);
    } catch (err) {
      console.error('Erro na simulação:', err);
    } finally {
      setSimulando(false);
    }
  }

  useEffect(() => {
    carregarDashboard();
    executarSimulacao();
  }, []);

  const forecast = dashboard?.forecast;
  const auditoria = dashboard?.auditoria;
  const acoes = dashboard?.acoesPrioritarias || [];

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Topo / Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
        color: '#ffffff',
        padding: '28px 32px',
        borderRadius: '16px',
        marginBottom: '28px',
        boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
            padding: '14px',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(168, 85, 247, 0.4)'
          }}>
            <Sparkles size={28} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '24px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>
                Kytto Advisor · Copilot de IA Executiva
              </h1>
              <span style={{
                background: 'rgba(99, 102, 241, 0.25)',
                color: '#c4b5fd',
                padding: '3px 10px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '600',
                border: '1px solid rgba(168, 85, 247, 0.4)'
              }}>
                v2.5 Preditiva
              </span>
            </div>
            <p style={{ color: '#94a3b8', margin: '6px 0 0 0', fontSize: '14px' }}>
              Projeções estocásticas de faturamento, detecção proativa de anomalias e simulação de cenários em tempo real.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.08)',
            padding: '8px 16px',
            borderRadius: '10px',
            fontSize: '13px',
            color: '#cbd5e1',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            Score de Saúde: <strong style={{ color: '#4ade80' }}>{dashboard?.scoreSaude || 92}/100</strong>
          </div>
          <button
            onClick={carregarDashboard}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(255, 255, 255, 0.12)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              padding: '10px 18px',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Atualizar Insights
          </button>
        </div>
      </div>

      {erro && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '16px', borderRadius: '12px', color: '#b91c1c', marginBottom: '24px' }}>
          {erro}
        </div>
      )}

      {/* Grid de KPIs Preditivos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '28px' }}>
        
        {/* KPI 1: Faturamento Projetado */}
        <div style={{
          background: '#ffffff',
          padding: '24px',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Faturamento Projetado (Mês)</span>
            <div style={{ background: '#eff6ff', padding: '8px', borderRadius: '8px', color: '#3b82f6' }}>
              <TrendingUp size={20} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a', marginBottom: '6px' }}>
            {forecast?.faturamentoProjetadoFormatado || 'R$ 0,00'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            <span style={{ color: '#10b981', fontWeight: '600', display: 'flex', alignItems: 'center' }}>
              <ArrowUpRight size={16} /> Probabilidade: {forecast?.probabilidadeMeta || 85}%
            </span>
            <span style={{ color: '#94a3b8' }}>· Meta: {forecast?.metaEmpresaFormatada || 'R$ 25.000,00'}</span>
          </div>
          <div style={{ marginTop: '14px', width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, forecast?.percentualAtingido || 45)}%`, height: '100%', background: '#3b82f6', borderRadius: '3px' }} />
          </div>
        </div>

        {/* KPI 2: Ritmo Diário & Velocidade */}
        <div style={{
          background: '#ffffff',
          padding: '24px',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Velocidade Diária Média</span>
            <div style={{ background: '#ecfdf5', padding: '8px', borderRadius: '8px', color: '#10b981' }}>
              <DollarSign size={20} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a', marginBottom: '6px' }}>
            {forecast?.mediaDiariaFormatada || 'R$ 0,00'}
          </div>
          <div style={{ fontSize: '13px', color: '#64748b' }}>
            Realizado até hoje: <strong>{forecast?.receitaRealizadaFormatada || 'R$ 0,00'}</strong> ({forecast?.diaDoMes || 1} de {forecast?.totalDiasMes || 30} dias)
          </div>
        </div>

        {/* KPI 3: Riscos & Rupturas */}
        <div style={{
          background: '#ffffff',
          padding: '24px',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Alertas & Oportunidades</span>
            <div style={{ background: '#fef3c7', padding: '8px', borderRadius: '8px', color: '#d97706' }}>
              <AlertTriangle size={20} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a', marginBottom: '6px' }}>
            {(auditoria?.totalRiscos || 0) + (auditoria?.totalAnomalias || 0)} Pendência(s)
          </div>
          <div style={{ fontSize: '13px', color: '#64748b' }}>
            Vigia de estoque ativo · Risco de Churn sob controle
          </div>
        </div>
      </div>

      {/* Seção 2 Colunas: Ações Prioritárias & Simulador "What-If" */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '28px' }}>
        
        {/* Coluna 1: Feed de Ações Recomendadas da IA */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={20} color="#8b5cf6" />
            Recomendações Estratégicas Prioritárias
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {acoes.map((acao, idx) => (
              <div key={idx} style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '14px'
              }}>
                <div style={{
                  background: idx === 0 ? '#eff6ff' : (idx === 1 ? '#fffbeb' : '#f5f3ff'),
                  color: idx === 0 ? '#2563eb' : (idx === 1 ? '#d97706' : '#7c3aed'),
                  padding: '8px',
                  borderRadius: '10px',
                  fontWeight: '700',
                  fontSize: '13px'
                }}>
                  #{acao.prioridade}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>{acao.titulo}</span>
                    <span style={{ fontSize: '11px', background: '#e2e8f0', color: '#475569', padding: '2px 8px', borderRadius: '12px', fontWeight: '600' }}>
                      {acao.categoria}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: '1.4' }}>
                    {acao.descricao}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {forecast?.recomendacao && (
            <div style={{ marginTop: '18px', padding: '14px 18px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', fontSize: '13px', color: '#166534', lineHeight: '1.4' }}>
              💡 <strong>Parecer do Copilot:</strong> {forecast.recomendacao}
            </div>
          )}
        </div>

        {/* Coluna 2: Simulador Interativo "What-If" */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sliders size={20} color="#3b82f6" />
            Simulador de Cenários & Margem ("What-If")
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
            {/* Slider 1: Reajuste de Preço */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                <span>Reajuste Médio de Preço dos Serviços</span>
                <span style={{ color: '#2563eb' }}>+{reajuste}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="30"
                step="1"
                value={reajuste}
                onChange={(e) => { setReajuste(Number(e.target.value)); }}
                style={{ width: '100%', accentColor: '#2563eb', cursor: 'pointer' }}
              />
            </div>

            {/* Slider 2: Aumento de Demanda / Clientes */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                <span>Aumento no Volume de Atendimentos</span>
                <span style={{ color: '#10b981' }}>+{demanda}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                step="5"
                value={demanda}
                onChange={(e) => { setDemanda(Number(e.target.value)); }}
                style={{ width: '100%', accentColor: '#10b981', cursor: 'pointer' }}
              />
            </div>

            {/* Slider 3: Novos Colaboradores / Barbeiros */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                <span>Contratação de Novos Barbeiros / Cadeiras</span>
                <span style={{ color: '#8b5cf6' }}>+{colaboradores} profissional(is)</span>
              </div>
              <input
                type="range"
                min="0"
                max="5"
                step="1"
                value={colaboradores}
                onChange={(e) => { setColaboradores(Number(e.target.value)); }}
                style={{ width: '100%', accentColor: '#8b5cf6', cursor: 'pointer' }}
              />
            </div>

            <button
              onClick={executarSimulacao}
              disabled={simulando}
              style={{
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                padding: '10px 16px',
                borderRadius: '8px',
                fontWeight: '600',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {simulando ? 'Simulando...' : 'Recalcular Cenário'}
            </button>
          </div>

          {/* Resultado da Simulação */}
          {resultadoSimulacao && (
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>Nova Receita Estimada</span>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                    {resultadoSimulacao.simulado?.receitaBrutaFormatada}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>Lucro Líquido Projetado</span>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: '#16a34a' }}>
                    {resultadoSimulacao.simulado?.lucroLiquidoFormatado}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '12px', color: '#15803d', background: '#dcfce7', padding: '8px 12px', borderRadius: '8px', fontWeight: '600', marginTop: '6px' }}>
                Impacto Mensal: {resultadoSimulacao.simulado?.deltaLucroMensalFormatado} a mais no caixa!
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
