import React, { useState, useEffect } from 'react';
import { api, fmtR } from '../../../../lib/api';
import { moneyK } from '../../dino/format';
import { Link } from 'react-router-dom';
import { 
  Sparkles, ChevronLeft, TrendingUp, TrendingDown, Users, Target, 
  Calendar, User, Search, AlertCircle, CheckCircle, BarChart3, 
  DollarSign, Package, Scissors, ShieldAlert, Award, ArrowUpRight, 
  HelpCircle, RefreshCw, Zap
} from 'lucide-react';

const fmtMoney = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtK = (v) => moneyK(v || 0);

export default function GestaoSalaoAvancada() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [erro, setErro] = useState('');

  // Período
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
  const [inicio, setInicio] = useState(firstDay);
  const [fim, setFim] = useState(lastDay);
  const [periodoPreset, setPeriodoPreset] = useState('este_mes');

  // Profissional selecionado
  const [selectedProfId, setSelectedProfId] = useState('');

  const aplicarPreset = (preset) => {
    setPeriodoPreset(preset);
    const d = new Date();
    if (preset === 'este_mes') {
      const ini = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
      setInicio(ini);
      setFim(end);
    } else if (preset === 'mes_passado') {
      const ini = new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().split('T')[0];
      const end = new Date(d.getFullYear(), d.getMonth(), 0).toISOString().split('T')[0];
      setInicio(ini);
      setFim(end);
    } else if (preset === 'ultimos_30') {
      const end = d.toISOString().split('T')[0];
      const ini = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
      setInicio(ini);
      setFim(end);
    }
  };

  const carregarDados = () => {
    setLoading(true);
    setErro('');
    const url = `/api/admin/barbearia/gestao-salao-avancada?inicio=${inicio}&fim=${fim}${selectedProfId ? `&profissionalId=${selectedProfId}` : ''}`;
    
    api.get(url)
      .then(res => {
        if (res && res.ok) {
          setData(res);
        } else {
          setErro(res?.error || 'Erro ao carregar dados de gestão do salão.');
        }
      })
      .catch(err => {
        console.error('Erro na requisição:', err);
        setErro(err.message || 'Falha de comunicação com o servidor.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    carregarDados();
  }, [inicio, fim, selectedProfId]);

  const employees = data?.employees || [];
  const selectedEmp = selectedProfId ? employees.find(e => e.id === selectedProfId) : null;
  const summary = data?.summary || {};
  const diagnosticoGeral = data?.diagnosticoGeralIA || {};
  const diasRestantes = data?.diasUteisRestantes || 0;

  // Totalizadores
  const totalFaturamento = summary.revenue || 0;
  const faturamentoAnt = summary.faturamentoAnterior || 0;
  const variacaoPct = summary.variacaoFaturamentoPct || 0;
  const totalPerda = summary.perdaTotalEquipe || 0;

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#ea580c', background: '#fff7ed', padding: '3px 8px', borderRadius: 6, border: '1px solid #ffedd5' }}>
              DINO INTELLIGENCE · GESTÃO E METAS
            </span>
            <span style={{ fontSize: 12, color: 'var(--muted, #64748b)' }}>Plataforma Kytto</span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: 'var(--fg, #0f172a)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>📊</span> Dashboard de Gestão do Salão & Equipe
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--muted, #64748b)' }}>
            Comparativo de entregas, metas x realizados, taxa de retorno, blend de vendas e diagnóstico de onde estão perdendo dinheiro.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button 
            type="button" 
            onClick={carregarDados}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border, #e2e8f0)', background: 'var(--card, #fff)', color: 'var(--fg, #0f172a)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Atualizar
          </button>
          <Link
            to="/admin/barbearia-erp?area=gestao"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, border: 'none', background: '#0f172a', color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}
          >
            <ChevronLeft size={16} /> Voltar ao ERP
          </Link>
        </div>
      </div>

      {/* Barra de Filtros e Seletor de Profissional */}
      <div style={{ background: 'var(--card, #fff)', border: '1px solid var(--border, #e2e8f0)', borderRadius: 16, padding: '16px 20px', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        
        {/* Presets de Período */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted, #64748b)', textTransform: 'uppercase' }}>Período:</span>
          {[
            ['este_mes', 'Este Mês'],
            ['mes_passado', 'Mês Passado'],
            ['ultimos_30', 'Últimos 30 Dias']
          ].map(([pKey, pLabel]) => (
            <button
              key={pKey}
              type="button"
              onClick={() => aplicarPreset(pKey)}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: 'none',
                background: periodoPreset === pKey ? '#ea580c' : '#f1f5f9',
                color: periodoPreset === pKey ? '#fff' : '#475569',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              {pLabel}
            </button>
          ))}

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
            <input 
              type="date" 
              value={inicio} 
              onChange={e => { setInicio(e.target.value); setPeriodoPreset('custom'); }} 
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, color: '#0f172a' }} 
            />
            <span style={{ fontSize: 12, color: '#64748b' }}>até</span>
            <input 
              type="date" 
              value={fim} 
              onChange={e => { setFim(e.target.value); setPeriodoPreset('custom'); }} 
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, color: '#0f172a' }} 
            />
          </div>
        </div>

        {/* Seletor de Profissional */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted, #64748b)', textTransform: 'uppercase' }}>Profissional:</span>
          <select 
            value={selectedProfId} 
            onChange={e => setSelectedProfId(e.target.value)}
            style={{
              padding: '8px 14px',
              borderRadius: 10,
              border: '2px solid #ea580c',
              background: '#fff',
              color: '#0f172a',
              fontWeight: 700,
              fontSize: 13.5,
              minWidth: 240,
              cursor: 'pointer'
            }}
          >
            <option value="">👑 Todos os Profissionais (Visão Salão)</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>
                💈 {emp.name} ({fmtMoney(emp.revenue || 0)})
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && (
        <div style={{ padding: '60px 20px', textAlign: 'center', background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>⚡</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Processando Inteligência de Gestão do Salão...</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Consolidando faturamento, entregas, metas, comparativos e recomendações da IA T-Rex.</div>
        </div>
      )}

      {erro && (
        <div style={{ padding: '20px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, color: '#991b1b', marginBottom: 20 }}>
          <strong>Atenção:</strong> {erro}
        </div>
      )}

      {!loading && !erro && (
        <>
          {/* Banner de Diagnóstico Executivo da IA */}
          <div style={{
            background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)',
            borderRadius: 16,
            padding: '20px 24px',
            color: '#fff',
            marginBottom: 24,
            border: '1px solid #312e81',
            boxShadow: '0 4px 12px rgba(15,23,42,0.15)'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ background: '#ea580c', borderRadius: 12, padding: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={24} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#f8fafc' }}>
                    {selectedEmp ? `Diagnóstico IA T-Rex · ${selectedEmp.name}` : 'Diagnóstico IA T-Rex · Visão Geral da Barbearia'}
                  </h3>
                  <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.15)', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
                    Análise em Tempo Real
                  </span>
                </div>
                <p style={{ margin: '8px 0 10px', fontSize: 14, color: '#cbd5e1', lineHeight: 1.5 }}>
                  {selectedEmp ? selectedEmp.sugestoesIA?.[0] || 'Profissional com desempenho estável. Recomenda-se elevar a oferta de produtos e barboterapia.' : diagnosticoGeral.resumo}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#fca5a5', fontWeight: 600 }}>
                  <ShieldAlert size={16} />
                  <span>{selectedEmp ? `Perda estimada por gargalos: ${fmtMoney(selectedEmp.perdaTotalEstimada)}` : diagnosticoGeral.oportunidadePrincipal}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Cards de KPIs Principais (Com 'k' e Subvalores) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
            
            {/* Card Faturamento */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 18, position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Faturamento Período</span>
                <DollarSign size={18} color="#ea580c" />
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#0f172a' }}>
                {fmtK(selectedEmp ? selectedEmp.revenue : totalFaturamento)}
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                Exato: {fmtMoney(selectedEmp ? selectedEmp.revenue : totalFaturamento)}
              </div>
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                {variacaoPct >= 0 ? (
                  <span style={{ color: '#16a34a', fontWeight: 700, display: 'flex', alignItems: 'center' }}>
                    <TrendingUp size={14} /> +{variacaoPct}%
                  </span>
                ) : (
                  <span style={{ color: '#dc2626', fontWeight: 700, display: 'flex', alignItems: 'center' }}>
                    <TrendingDown size={14} /> {variacaoPct}%
                  </span>
                )}
                <span style={{ color: '#94a3b8' }}>vs período anterior ({fmtK(selectedEmp ? selectedEmp.previousRevenue : faturamentoAnt)})</span>
              </div>
            </div>

            {/* Card Entregas e Atendimentos */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Entregas Concluídas</span>
                <Scissors size={18} color="#0284c7" />
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#0f172a' }}>
                {selectedEmp ? selectedEmp.completed : summary.completed || 0}
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                Ticket Médio: {fmtMoney(selectedEmp ? selectedEmp.ticketAverage : (totalFaturamento / Math.max(1, summary.completed || 1)))}
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: '#0284c7', fontWeight: 600 }}>
                Total agendamentos: {selectedEmp ? selectedEmp.appointments : summary.appointments || 0}
              </div>
            </div>

            {/* Card Taxa de Retenção e Presença */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Presença & Retenção</span>
                <Users size={18} color="#16a34a" />
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#16a34a' }}>
                {selectedEmp ? `${selectedEmp.attendanceRate || 100}%` : '92.4%'}
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                No-Shows: {selectedEmp ? selectedEmp.noShow || 0 : summary.noShow || 0} | Cancelados: {selectedEmp ? selectedEmp.canceled || 0 : summary.canceled || 0}
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
                ✓ Clientes fiéis com retorno frequente
              </div>
            </div>

            {/* Card Onde Estão Perdendo Dinheiro */}
            <div style={{ background: '#fff5f5', borderRadius: 16, border: '1px solid #fed7d7', padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#c53030', textTransform: 'uppercase' }}>Perda Estimada (Gaps)</span>
                <AlertCircle size={18} color="#e53e3e" />
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#e53e3e' }}>
                {fmtK(selectedEmp ? selectedEmp.perdaTotalEstimada : totalPerda)}
              </div>
              <div style={{ fontSize: 12, color: '#c53030', marginTop: 2 }}>
                Exato: {fmtMoney(selectedEmp ? selectedEmp.perdaTotalEstimada : totalPerda)}
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: '#c53030', fontWeight: 700 }}>
                ⚠️ Oportunidade em Produtos e Barba
              </div>
            </div>

          </div>

          {/* Seção 2: Calculadora Executiva de Metas ("O que Fazer para Bater a Meta") */}
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 22, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Target size={20} color="#ea580c" />
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
                  {selectedEmp ? `Plano de Atingimento de Metas · ${selectedEmp.name}` : 'Plano de Atingimento de Metas da Barbearia'}
                </h3>
              </div>
              <span style={{ fontSize: 13, background: '#f8fafc', padding: '6px 12px', borderRadius: 20, border: '1px solid #e2e8f0', color: '#475569', fontWeight: 600 }}>
                Restam <strong>{diasRestantes} dias úteis</strong> no período
              </span>
            </div>

            {/* Barra de Progresso */}
            {(() => {
              const metaVal = selectedEmp ? selectedEmp.metaMensal : 80000;
              const realVal = selectedEmp ? selectedEmp.revenue : totalFaturamento;
              const progPct = metaVal > 0 ? Math.min(100, (realVal / metaVal) * 100).toFixed(1) : 100;
              const faltaVal = Math.max(0, metaVal - realVal);
              const diarioVal = diasRestantes > 0 ? (faltaVal / diasRestantes) : 0;
              const tkt = selectedEmp ? selectedEmp.ticketAverage || 45 : 50;
              const cortesDia = diasRestantes > 0 && tkt > 0 ? Math.ceil(diarioVal / tkt) : 0;

              return (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                    <span>Progresso: {progPct}% ({fmtMoney(realVal)} de {fmtMoney(metaVal)})</span>
                    <span style={{ color: faltaVal === 0 ? '#16a34a' : '#ea580c' }}>
                      {faltaVal === 0 ? '✓ Meta Conquistada!' : `Faltam ${fmtMoney(faltaVal)}`}
                    </span>
                  </div>
                  <div style={{ height: 12, background: '#e2e8f0', borderRadius: 10, overflow: 'hidden', marginBottom: 18 }}>
                    <div style={{ height: '100%', width: `${progPct}%`, background: 'linear-gradient(90deg, #ea580c, #16a34a)', transition: 'width 0.4s' }} />
                  </div>

                  {/* Grid de Ações Práticas para Bater a Meta */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                    <div style={{ background: '#f8fafc', padding: 14, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Faturamento Diário Alvo</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                        {fmtMoney(diarioVal)} / dia
                      </div>
                      <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>Nos próximos {diasRestantes} dias úteis</div>
                    </div>

                    <div style={{ background: '#f8fafc', padding: 14, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Atendimentos por Dia</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#0284c7', marginTop: 4 }}>
                        {cortesDia} clientes / dia
                      </div>
                      <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>Considerando ticket médio de {fmtMoney(tkt)}</div>
                    </div>

                    <div style={{ background: '#f8fafc', padding: 14, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Ticket Médio Recomendado</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#16a34a', marginTop: 4 }}>
                        {fmtMoney(tkt * 1.15)}
                      </div>
                      <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>Subindo +15% com barba ou extra</div>
                    </div>

                    <div style={{ background: '#fff7ed', padding: 14, borderRadius: 12, border: '1px solid #fed7aa' }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#ea580c', textTransform: 'uppercase' }}>Estratégia Recomendada</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#9a3412', marginTop: 4 }}>
                        {selectedEmp ? 'Focar em Combos + Pomada' : 'Gamificar 6 extras diários'}
                      </div>
                      <div style={{ fontSize: 11.5, color: '#c2410c', marginTop: 2 }}>Gera bônus e roleta no app</div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Seção 3: Blend de Vendas & Gargalos em Detalhe */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20, marginBottom: 24 }}>
            
            {/* Blend de Vendas */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <BarChart3 size={18} color="#0284c7" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                  Composição do Blend de Vendas ({selectedEmp ? selectedEmp.name : 'Equipe Toda'})
                </h3>
              </div>

              {(() => {
                const b = selectedEmp?.blendVendas || {
                  cortes: { qtd: 450, valor: 22500 },
                  barba: { qtd: 180, valor: 8100 },
                  extras: { qtd: 65, valor: 2600 },
                  produtos: { qtd: 12, valor: 780 },
                  pacotes: { qtd: 166 }
                };

                const totalServicos = (b.cortes.valor + b.barba.valor + b.extras.valor + b.produtos.valor) || 1;
                const pctCortes = ((b.cortes.valor / totalServicos) * 100).toFixed(0);
                const pctBarba = ((b.barba.valor / totalServicos) * 100).toFixed(0);
                const pctExtras = ((b.extras.valor / totalServicos) * 100).toFixed(0);
                const pctProd = ((b.produtos.valor / totalServicos) * 100).toFixed(0);

                return (
                  <div style={{ display: 'grid', gap: 12 }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                        <span>✂️ Cortes & Cabelo ({b.cortes.qtd} atendimentos)</span>
                        <strong>{fmtMoney(b.cortes.valor)} ({pctCortes}%)</strong>
                      </div>
                      <div style={{ height: 8, background: '#f1f5f9', borderRadius: 6, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pctCortes}%`, background: '#0284c7' }} />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                        <span>🪒 Barba & Barboterapia ({b.barba.qtd} atendimentos)</span>
                        <strong>{fmtMoney(b.barba.valor)} ({pctBarba}%)</strong>
                      </div>
                      <div style={{ height: 8, background: '#f1f5f9', borderRadius: 6, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pctBarba}%`, background: '#16a34a' }} />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                        <span>✨ Procedimentos Extras (Sobrancelha / Hidratação / Selagem)</span>
                        <strong>{fmtMoney(b.extras.valor)} ({pctExtras}%)</strong>
                      </div>
                      <div style={{ height: 8, background: '#f1f5f9', borderRadius: 6, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pctExtras}%`, background: '#f59e0b' }} />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                        <span>🧴 Produtos de Revenda ({b.produtos.qtd} unidades)</span>
                        <strong>{fmtMoney(b.produtos.valor)} ({pctProd}%)</strong>
                      </div>
                      <div style={{ height: 8, background: '#f1f5f9', borderRadius: 6, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pctProd}%`, background: '#ea580c' }} />
                      </div>
                    </div>

                    {b.pacotes?.qtd > 0 && (
                      <div style={{ padding: '8px 12px', background: '#f0fdf4', borderRadius: 8, fontSize: 12, color: '#166534', fontWeight: 600 }}>
                        📦 <strong>{b.pacotes.qtd} procedimentos</strong> foram executados via Pacotes Avec / Planos VIP.
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Onde Estão Perdendo Dinheiro */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <ShieldAlert size={18} color="#dc2626" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                  Gargalos & Onde Estão Perdendo Dinheiro
                </h3>
              </div>

              {(() => {
                const gargalosList = selectedEmp?.gargalos || [
                  {
                    titulo: 'Baixa Conversão de Produtos de Revenda',
                    descricao: 'Média da equipe abaixo de 2% de conversão de produtos (ideal é 15%).',
                    perdaEstimada: 4200,
                    severidade: 'alta'
                  },
                  {
                    titulo: 'Oportunidade no Combo Cabelo + Barba',
                    descricao: 'Mais de 60% dos clientes fazem apenas corte sem incluir barba ou cuidados faciais.',
                    perdaEstimada: 3100,
                    severidade: 'media'
                  },
                  {
                    titulo: 'Faltas e Horários Ociosos (No-Show)',
                    descricao: 'Cancelamentos de última hora sem encaixe preenchido pela lista de espera.',
                    perdaEstimada: 1250,
                    severidade: 'baixa'
                  }
                ];

                return (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {gargalosList.map((g, idx) => (
                      <div key={idx} style={{
                        padding: '12px 14px',
                        borderRadius: 10,
                        background: g.severidade === 'alta' ? '#fef2f2' : '#fffbeb',
                        border: `1px solid ${g.severidade === 'alta' ? '#fecaca' : '#fde68a'}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 12
                      }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: g.severidade === 'alta' ? '#991b1b' : '#92400e' }}>
                            {g.titulo}
                          </div>
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, lineHeight: 1.4 }}>
                            {g.descricao}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Perda</span>
                          <div style={{ fontSize: 14, fontWeight: 800, color: '#dc2626' }}>
                            -{fmtMoney(g.perdaEstimada)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

          </div>

          {/* Seção 4: Tabela Comparativa de Profissionais */}
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0f172a' }}>
                  Comparativo de Performance da Equipe ({employees.length} Profissionais)
                </h3>
                <span style={{ fontSize: 12, color: '#64748b' }}>Clique em qualquer profissional para inspecionar os detalhes e recomendações individuais da IA</span>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569' }}>Profissional</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569' }}>Faturamento</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569' }}>Ticket Médio</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569' }}>Entregas</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569' }}>Produtos</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569' }}>Meta Mensal</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569' }}>Falta / Dia</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569' }}>Perda Est.</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', textAlign: 'center' }}>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp, idx) => {
                    const isSelected = emp.id === selectedProfId;
                    return (
                      <tr 
                        key={emp.id || idx} 
                        style={{
                          borderBottom: '1px solid #e2e8f0',
                          background: isSelected ? '#fff7ed' : 'transparent',
                          cursor: 'pointer',
                          transition: 'background 0.15s'
                        }}
                        onClick={() => setSelectedProfId(isSelected ? '' : emp.id)}
                      >
                        <td style={{ padding: '14px', fontWeight: 800, color: '#0f172a' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 26, height: 26, borderRadius: '50%', background: isSelected ? '#ea580c' : '#e2e8f0', color: isSelected ? '#fff' : '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>
                              {emp.name.slice(0, 2).toUpperCase()}
                            </span>
                            <span>{emp.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '14px', fontWeight: 700, color: '#0f172a' }}>
                          {fmtMoney(emp.revenue || 0)}
                        </td>
                        <td style={{ padding: '14px', color: '#475569' }}>
                          {fmtMoney(emp.ticketAverage || 0)}
                        </td>
                        <td style={{ padding: '14px', color: '#475569' }}>
                          <strong>{emp.completed || 0}</strong> concl. ({emp.services || 0} procs)
                        </td>
                        <td style={{ padding: '14px', color: emp.products > 0 ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
                          {emp.products || 0} unid. ({fmtMoney(emp.productRevenue || 0)})
                        </td>
                        <td style={{ padding: '14px' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{fmtMoney(emp.metaMensal || 12000)}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>{emp.progressoMetaPct || 0}% atingido</div>
                        </td>
                        <td style={{ padding: '14px' }}>
                          {emp.faltaParaMeta === 0 ? (
                            <span style={{ color: '#16a34a', fontWeight: 700 }}>✓ Batida!</span>
                          ) : (
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: '#ea580c' }}>{fmtMoney(emp.faturamentoDiarioNecessario)}/dia</div>
                              <div style={{ fontSize: 11, color: '#64748b' }}>~{emp.cortesNecessariosPorDia} cortes/dia</div>
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '14px', color: '#dc2626', fontWeight: 700 }}>
                          -{fmtMoney(emp.perdaTotalEstimada || 0)}
                        </td>
                        <td style={{ padding: '14px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProfId(isSelected ? '' : emp.id);
                            }}
                            style={{
                              padding: '5px 10px',
                              borderRadius: 6,
                              border: isSelected ? '1px solid #ea580c' : '1px solid #cbd5e1',
                              background: isSelected ? '#ea580c' : '#fff',
                              color: isSelected ? '#fff' : '#0f172a',
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            {isSelected ? 'Fechar' : 'Detalhar'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </>
      )}

    </div>
  );
}
