import React, { useState, useEffect, useCallback } from 'react';
import { api, fmtMoney, fmtDate } from '../../../lib/api';
import { useToast } from '../../../hooks/useToast';
import {
  Users,
  Package,
  TrendingUp,
  CreditCard,
  Sparkles,
  RefreshCw,
  Plus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  PauseCircle,
  PlayCircle,
  XCircle,
  Search,
  Filter,
  ArrowUpRight,
  ShieldCheck
} from 'lucide-react';

export default function StalloneClubAdmin() {
  const { toast } = useToast();
  const [metricas, setMetricas] = useState(null);
  const [planos, setPlanos] = useState([]);
  const [assinaturas, setAssinaturas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroPlano, setFiltroPlano] = useState('todos');
  const [modalNovo, setModalNovo] = useState(false);
  const [novoAssinante, setNovoAssinante] = useState({
    clienteNome: '',
    clienteCpf: '',
    clienteTelefone: '',
    clienteEmail: '',
    planoCodigo: 'performance',
    formaPagamento: 'cartao_recorrente',
    diaVencimento: 10,
    enderecoEntrega: 'Retirada no Balcão da Stallone Nutre Sport',
    observacoes: ''
  });

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    try {
      const [resMetricas, resPlanos, resAssinaturas] = await Promise.all([
        api.get('/api/stallone-club/metricas').catch(() => null),
        api.get('/api/stallone-club/planos').catch(() => null),
        api.get('/api/stallone-club/admin/assinaturas').catch(() => null)
      ]);

      if (resMetricas && resMetricas.metricas) {
        setMetricas(resMetricas.metricas);
      }
      if (resPlanos && resPlanos.planos) {
        setPlanos(resPlanos.planos);
      }
      if (resAssinaturas && Array.isArray(resAssinaturas.assinaturas)) {
        setAssinaturas(resAssinaturas.assinaturas);
      }
    } catch (err) {
      toast(err.message || 'Erro ao carregar dados do clube.', 'error');
    } finally {
      setCarregando(false);
    }
  }, [toast]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const handleProcessarCiclo = async (assinaturaId, clienteNome) => {
    if (!window.confirm(`Confirma o faturamento e processamento do ciclo mensal para ${clienteNome}? Isso registrará o crédito de cashback e a liberação do box de suplementos.`)) {
      return;
    }
    setProcessando(true);
    try {
      const res = await api.post(`/api/stallone-club/admin/assinaturas/${assinaturaId}/processar-ciclo`);
      if (res && res.sucesso) {
        toast(`Ciclo processado com sucesso! Cashback gerado: R$ ${res.ciclo?.cashbackGerado?.toFixed(2) || '0,00'}.`, 'success');
        carregarDados();
      } else {
        toast(res.erro || 'Falha ao processar ciclo.', 'error');
      }
    } catch (err) {
      toast(err.message || 'Erro na cobrança do ciclo.', 'error');
    } finally {
      setProcessando(false);
    }
  };

  const handlePausar = async (assinaturaId) => {
    const motivo = window.prompt('Motivo da pausa da assinatura:', 'Férias / Viagem temporária do atleta');
    if (!motivo) return;
    try {
      await api.post(`/api/stallone-club/admin/assinaturas/${assinaturaId}/pausar`, { motivo });
      toast('Assinatura pausada.', 'info');
      carregarDados();
    } catch (err) {
      toast(err.message || 'Erro ao pausar assinatura.', 'error');
    }
  };

  const handleReativar = async (assinaturaId) => {
    try {
      await api.post(`/api/stallone-club/admin/assinaturas/${assinaturaId}/reativar`);
      toast('Assinatura reativada com sucesso!', 'success');
      carregarDados();
    } catch (err) {
      toast(err.message || 'Erro ao reativar assinatura.', 'error');
    }
  };

  const handleCancelar = async (assinaturaId) => {
    const motivo = window.prompt('Confirma o cancelamento da assinatura? Informe o motivo:', 'Mudança de modalidade / Decisão do cliente');
    if (!motivo) return;
    try {
      await api.post(`/api/stallone-club/admin/assinaturas/${assinaturaId}/cancelar`, { motivo });
      toast('Assinatura cancelada.', 'info');
      carregarDados();
    } catch (err) {
      toast(err.message || 'Erro ao cancelar assinatura.', 'error');
    }
  };

  const handleSalvarNovo = async (e) => {
    e.preventDefault();
    if (!novoAssinante.clienteNome || !novoAssinante.clienteCpf) {
      toast('Nome e CPF são obrigatórios.', 'error');
      return;
    }
    setProcessando(true);
    try {
      const res = await api.post('/api/stallone-club/adesao', novoAssinante);
      if (res && res.sucesso) {
        toast(`Assinante ${novoAssinante.clienteNome} cadastrado com sucesso no Stallone VIP Club!`, 'success');
        setModalNovo(false);
        setNovoAssinante({
          clienteNome: '',
          clienteCpf: '',
          clienteTelefone: '',
          clienteEmail: '',
          planoCodigo: 'performance',
          formaPagamento: 'cartao_recorrente',
          diaVencimento: 10,
          enderecoEntrega: 'Retirada no Balcão da Stallone Nutre Sport',
          observacoes: ''
        });
        carregarDados();
      } else {
        toast(res.erro || 'Erro ao cadastrar assinante.', 'error');
      }
    } catch (err) {
      toast(err.message || 'Erro no cadastro de adesão.', 'error');
    } finally {
      setProcessando(false);
    }
  };

  const assinaturasFiltradas = assinaturas.filter(a => {
    const termo = busca.toLowerCase();
    const matchBusca = (a.clienteNome || '').toLowerCase().includes(termo) ||
      (a.clienteCpf || '').includes(termo) ||
      (a.clienteTelefone || '').includes(termo);
    const matchStatus = filtroStatus === 'todos' || a.status === filtroStatus;
    const matchPlano = filtroPlano === 'todos' || a.planoCodigo === filtroPlano;
    return matchBusca && matchStatus && matchPlano;
  });

  return (
    <div className="stallone-club-container" style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', color: '#1e293b' }}>
      {/* Header Executivo */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 28 }}>📦</span>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
              Stallone VIP Club · Gestão de Assinaturas & Box Recorrente
            </h1>
            <span style={{
              background: '#e0e7ff',
              color: '#4338ca',
              fontSize: 11,
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: 6,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4
            }}>
              <Sparkles size={12} /> Motor KyttoIA 2.5 Flash
            </span>
          </div>
          <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>
            Stallone Nutre Sport Ltda. (CNPJ: 56.099.531/0001-38 · Tangará da Serra/MT) — Reposição automática de suplementos, TEF integrado e cashback no Kytto Pay.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={carregarDados}
            disabled={carregando}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              padding: '8px 14px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} className={carregando ? 'spin' : ''} /> Atualizar
          </button>
          <button
            type="button"
            onClick={() => setModalNovo(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: '#E32935',
              color: '#fff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(227, 41, 53, 0.3)'
            }}
          >
            <Plus size={16} /> Nova Adesão no Balcão
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 28 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 18, border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: 12, fontWeight: 600 }}>
            <span>RECEITA RECORRENTE (MRR)</span>
            <TrendingUp size={16} color="#059669" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '8px 0 4px' }}>
            {metricas?.mrrFormatado || fmtMoney(assinaturas.filter(a => ['ativa', 'em_dia'].includes(a.status)).reduce((acc, c) => acc + Number(c.valorMensalidade || 0), 0))}
          </div>
          <div style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>
            Projeção Anual (ARR): {metricas?.arrFormatado || fmtMoney(assinaturas.filter(a => ['ativa', 'em_dia'].includes(a.status)).reduce((acc, c) => acc + Number(c.valorMensalidade || 0), 0) * 12)}
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, padding: 18, border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: 12, fontWeight: 600 }}>
            <span>ASSINANTES ATIVOS</span>
            <Users size={16} color="#4f46e5" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '8px 0 4px' }}>
            {metricas?.assinantesAtivos ?? assinaturas.filter(a => ['ativa', 'em_dia'].includes(a.status)).length}
          </div>
          <div style={{ fontSize: 11, color: '#64748b' }}>
            Total cadastrados: {metricas?.totalAssinantes ?? assinaturas.length} atletas
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, padding: 18, border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: 12, fontWeight: 600 }}>
            <span>CASHBACK DISTRIBUÍDO</span>
            <CreditCard size={16} color="#d97706" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '8px 0 4px' }}>
            {metricas?.totalCashbackFormatado || fmtMoney(assinaturas.reduce((acc, c) => acc + Number(c.saldoCashbackAcumulado || c.cashbackSaldo || 0), 0))}
          </div>
          <div style={{ fontSize: 11, color: '#d97706', fontWeight: 600 }}>
            Retenção de clientes em compras na loja física
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, padding: 18, border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: 12, fontWeight: 600 }}>
            <span>DISTRIBUIÇÃO POR PLANO</span>
            <Package size={16} color="#0284c7" />
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
            <span style={{ fontSize: 12 }}>Starter: <strong>{metricas?.porPlano?.starter ?? assinaturas.filter(a => a.planoCodigo === 'starter').length}</strong></span>
            <span style={{ fontSize: 12 }}>Performance: <strong>{metricas?.porPlano?.performance ?? assinaturas.filter(a => a.planoCodigo === 'performance').length}</strong></span>
            <span style={{ fontSize: 12 }}>Elite: <strong>{metricas?.porPlano?.elite ?? assinaturas.filter(a => a.planoCodigo === 'elite').length}</strong></span>
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
            Performance & Hipertrofia lidera adesões
          </div>
        </div>
      </div>

      {/* Planos Vitrine / Resumo */}
      <div style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px', color: '#0f172a' }}>
          Modalidades Oficiais da Box Mensal de Suplementos
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
          {planos.map(p => (
            <div key={p.codigo} style={{
              background: '#fff',
              border: p.codigo === 'performance' ? '2px solid #E32935' : '1px solid #e2e8f0',
              borderRadius: 12,
              padding: 16,
              boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>{p.nome}</span>
                <span style={{
                  background: p.codigo === 'elite' ? '#fef3c7' : (p.codigo === 'performance' ? '#fee2e2' : '#f0fdf4'),
                  color: p.codigo === 'elite' ? '#b45309' : (p.codigo === 'performance' ? '#b91c1c' : '#15803d'),
                  fontWeight: 800,
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 6
                }}>
                  {p.cashbackPercentual}% CASHBACK
                </span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#E32935', marginBottom: 8 }}>
                {fmtMoney(p.mensalidade)} <small style={{ fontSize: 12, color: '#64748b' }}>/mês</small>
              </div>
              <div style={{ fontSize: 12, color: '#475569', marginBottom: 10, lineHeight: 1.4 }}>
                <strong>Itens do Box:</strong>
                <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                  {p.itensInclusos?.map((item, idx) => (
                    <li key={idx} style={{ fontSize: 11 }}>{item.nome}</li>
                  ))}
                </ul>
              </div>
              <div style={{ fontSize: 11, color: '#64748b', borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
                {p.beneficios?.[0] || 'Atendimento prioritário KyttoIA'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabela de Assinantes */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
              Quadro de Assinantes Cadastrados
            </h3>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              Exibindo {assinaturasFiltradas.length} de {assinaturas.length} assinaturas
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: '#94a3b8' }} />
              <input
                type="text"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar por nome, CPF ou tel..."
                style={{
                  padding: '6px 10px 6px 30px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  fontSize: 12,
                  width: 220
                }}
              />
            </div>

            <select
              value={filtroStatus}
              onChange={e => setFiltroStatus(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
            >
              <option value="todos">Todos os Status</option>
              <option value="ativa">Ativa</option>
              <option value="em_dia">Em dia</option>
              <option value="pausada">Pausada</option>
              <option value="cancelada">Cancelada</option>
            </select>

            <select
              value={filtroPlano}
              onChange={e => setFiltroPlano(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
            >
              <option value="todos">Todos os Planos</option>
              <option value="starter">Plano Starter</option>
              <option value="performance">Plano Performance</option>
              <option value="elite">Plano Elite Pro</option>
            </select>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px' }}>Atleta / Cliente</th>
                <th style={{ padding: '12px 16px' }}>Plano</th>
                <th style={{ padding: '12px 16px' }}>Mensalidade</th>
                <th style={{ padding: '12px 16px' }}>Cashback Saldo</th>
                <th style={{ padding: '12px 16px' }}>Vencimento</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Ações de Gestão</th>
              </tr>
            </thead>
            <tbody>
              {assinaturasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8' }}>
                    {carregando ? 'Carregando assinaturas...' : 'Nenhuma assinatura localizada com os filtros selecionados.'}
                  </td>
                </tr>
              ) : (
                assinaturasFiltradas.map(a => {
                  const statusColors = {
                    ativa: { bg: '#ecfdf5', text: '#047857', label: 'Ativa' },
                    em_dia: { bg: '#f0fdf4', text: '#15803d', label: 'Em Dia' },
                    pausada: { bg: '#fef3c7', text: '#b45309', label: 'Pausada' },
                    cancelada: { bg: '#fef2f2', text: '#b91c1c', label: 'Cancelada' }
                  };
                  const st = statusColors[a.status] || { bg: '#f1f5f9', text: '#475569', label: a.status };

                  return (
                    <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{a.clienteNome}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>CPF: {a.clienteCpf} · {a.clienteTelefone}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontWeight: 600, color: '#334155' }}>{a.planoNome || a.planoCodigo}</span>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a' }}>
                        {fmtMoney(a.valorMensalidade)}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontWeight: 700, color: '#d97706' }}>
                          {fmtMoney(a.saldoCashbackAcumulado || a.cashbackSaldo || 0)}
                        </span>
                        <div style={{ fontSize: 10, color: '#64748b' }}>({a.cashbackPercentual}% do plano)</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div>Dia {a.diaVencimento || a.diaCobranca || 10}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>Próx: {a.proximaCobranca || a.proximoVencimento || '—'}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          background: st.bg,
                          color: st.text,
                          fontWeight: 700,
                          fontSize: 11,
                          padding: '3px 8px',
                          borderRadius: 6
                        }}>
                          {st.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          {['ativa', 'em_dia'].includes(a.status) && (
                            <button
                              type="button"
                              onClick={() => handleProcessarCiclo(a.id, a.clienteNome)}
                              disabled={processando}
                              title="Processar ciclo mensal e liberar reposição de suplementos"
                              style={{
                                background: '#0284c7',
                                color: '#fff',
                                border: 'none',
                                padding: '4px 10px',
                                borderRadius: 6,
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              Processar Ciclo
                            </button>
                          )}
                          {a.status === 'pausada' ? (
                            <button
                              type="button"
                              onClick={() => handleReativar(a.id)}
                              title="Reativar assinatura"
                              style={{
                                background: '#10b981',
                                color: '#fff',
                                border: 'none',
                                padding: '4px 8px',
                                borderRadius: 6,
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              Reativar
                            </button>
                          ) : a.status !== 'cancelada' ? (
                            <button
                              type="button"
                              onClick={() => handlePausar(a.id)}
                              title="Pausar assinatura temporariamente"
                              style={{
                                background: '#f8fafc',
                                border: '1px solid #cbd5e1',
                                color: '#475569',
                                padding: '4px 8px',
                                borderRadius: 6,
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              Pausar
                            </button>
                          ) : null}
                          {a.status !== 'cancelada' && (
                            <button
                              type="button"
                              onClick={() => handleCancelar(a.id)}
                              title="Cancelar assinatura"
                              style={{
                                background: '#fef2f2',
                                border: '1px solid #fecaca',
                                color: '#b91c1c',
                                padding: '4px 8px',
                                borderRadius: 6,
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nova Adesão no Balcão */}
      {modalNovo && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 20
        }}>
          <div style={{
            background: '#fff',
            borderRadius: 14,
            padding: 24,
            width: '100%',
            maxWidth: 540,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
                  Adesão ao Stallone VIP Club (Balcão)
                </h3>
                <span style={{ fontSize: 12, color: '#64748b' }}>Cadastrar novo membro no plano recorrente</span>
              </div>
              <button
                type="button"
                onClick={() => setModalNovo(false)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSalvarNovo} style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: '#334155' }}>
                  Nome Completo do Atleta / Cliente *
                </label>
                <input
                  type="text"
                  required
                  value={novoAssinante.clienteNome}
                  onChange={e => setNovoAssinante({ ...novoAssinante, clienteNome: e.target.value })}
                  placeholder="Ex: Carlos Eduardo Silveira"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: '#334155' }}>
                    CPF do Titular *
                  </label>
                  <input
                    type="text"
                    required
                    value={novoAssinante.clienteCpf}
                    onChange={e => setNovoAssinante({ ...novoAssinante, clienteCpf: e.target.value })}
                    placeholder="000.000.000-00"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: '#334155' }}>
                    WhatsApp / Telefone *
                  </label>
                  <input
                    type="text"
                    required
                    value={novoAssinante.clienteTelefone}
                    onChange={e => setNovoAssinante({ ...novoAssinante, clienteTelefone: e.target.value })}
                    placeholder="(65) 99999-0000"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: '#334155' }}>
                  Plano Escolhido *
                </label>
                <select
                  value={novoAssinante.planoCodigo}
                  onChange={e => setNovoAssinante({ ...novoAssinante, planoCodigo: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                >
                  <option value="starter">Plano Starter Fitness (R$ 169,00/mês · 5% Cashback)</option>
                  <option value="performance">Plano Performance & Hipertrofia (R$ 279,00/mês · 10% Cashback + Bioimpedância)</option>
                  <option value="elite">Plano Elite Pro & Definição (R$ 429,00/mês · 15% Cashback + Consultor KyttoIA)</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: '#334155' }}>
                    Forma de Cobrança *
                  </label>
                  <select
                    value={novoAssinante.formaPagamento}
                    onChange={e => setNovoAssinante({ ...novoAssinante, formaPagamento: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                  >
                    <option value="cartao_recorrente">Cartão Recorrente (TEF / Stone / Sicredi)</option>
                    <option value="pix_recorrente">PIX Automático Kytto Pay</option>
                    <option value="balcao_tef">Pagamento Mensal no Caixa do Balcão</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: '#334155' }}>
                    Dia de Cobrança / Vencimento
                  </label>
                  <select
                    value={novoAssinante.diaVencimento}
                    onChange={e => setNovoAssinante({ ...novoAssinante, diaVencimento: Number(e.target.value) })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                  >
                    <option value={5}>Dia 05 de cada mês</option>
                    <option value={10}>Dia 10 de cada mês</option>
                    <option value={15}>Dia 15 de cada mês</option>
                    <option value={20}>Dia 20 de cada mês</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: '#334155' }}>
                  Entrega / Retirada
                </label>
                <input
                  type="text"
                  value={novoAssinante.enderecoEntrega}
                  onChange={e => setNovoAssinante({ ...novoAssinante, enderecoEntrega: e.target.value })}
                  placeholder="Retirada no Balcão ou Endereço de Entrega em Tangará"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setModalNovo(false)}
                  style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', fontSize: 13, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={processando}
                  style={{
                    padding: '8px 20px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#E32935',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer'
                  }}
                >
                  {processando ? 'Cadastrando...' : 'Confirmar Adesão'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
