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
  ShieldCheck,
  Download,
  Send,
  Truck,
  DollarSign,
  Calculator
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

  // Modais
  const [modalNovo, setModalNovo] = useState(false);
  const [modalExtrato, setModalExtrato] = useState(null);
  const [modalSimulador, setModalSimulador] = useState(false);

  // Estado do Simulador de Taxas TEF
  const [simuladorValor, setSimuladorValor] = useState(250);
  const [simuladorModalidade, setSimuladorModalidade] = useState('credito_avista');
  const [simuladorParcelas, setSimuladorParcelas] = useState(1);
  const [resultadoSimulador, setResultadoSimulador] = useState(null);

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

  const handleDespacharBox = async (assinaturaId, clienteNome) => {
    const modalidade = window.confirm(`Deseja despachar para Retirada no Balcão? Clique em OK para Balcão ou Cancelar para Entrega Expressa.`)
      ? 'retirada_balcao'
      : 'delivery_express';

    setProcessando(true);
    try {
      const res = await api.post(`/api/stallone-club/admin/assinaturas/${assinaturaId}/despachar`, {
        modalidade,
        observacoes: 'Despacho registrado via Cockpit Administrativo Stallone'
      });
      if (res && res.sucesso) {
        toast(res.mensagem || 'Box despachado e estoque atualizado com sucesso!', 'success');
        carregarDados();
      } else {
        toast(res.erro || 'Falha ao despachar box.', 'error');
      }
    } catch (err) {
      toast(err.message || 'Erro no despacho do box.', 'error');
    } finally {
      setProcessando(false);
    }
  };

  const handleNotificarWhatsApp = async (assinaturaId) => {
    try {
      const res = await api.get(`/api/stallone-club/admin/assinaturas/${assinaturaId}/notificar-whatsapp`);
      if (res && res.sucesso && res.mensagem) {
        const telLimpo = String(res.telefone || '').replace(/\D/g, '');
        const urlZap = `https://wa.me/55${telLimpo}?text=${encodeURIComponent(res.mensagem)}`;
        window.open(urlZap, '_blank');
        toast('Mensagem gerada e encaminhada para o WhatsApp!', 'success');
      } else {
        toast('Não foi possível gerar a mensagem de notificação.', 'error');
      }
    } catch (err) {
      toast(err.message || 'Erro ao notificar via WhatsApp.', 'error');
    }
  };

  const handleVerExtrato = async (assinaturaId) => {
    try {
      const res = await api.get(`/api/stallone-club/admin/assinaturas/${assinaturaId}/extrato-cashback`);
      if (res && res.sucesso) {
        setModalExtrato(res);
      } else {
        toast('Não foi possível carregar o extrato.', 'error');
      }
    } catch (err) {
      toast(err.message || 'Erro ao consultar extrato.', 'error');
    }
  };

  const handleExecutarSimuladorTef = async () => {
    try {
      const res = await api.post('/api/tef/simular-taxas', {
        valor: simuladorValor,
        modalidade: simuladorModalidade,
        parcelas: simuladorParcelas
      });
      if (res && res.ok && res.melhorOpcao) {
        setResultadoSimulador(res);
      }
    } catch (err) {
      toast('Erro ao rodar simulação TEF.', 'error');
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

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              setModalSimulador(true);
              handleExecutarSimuladorTef();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: '#f0fdf4',
              color: '#15803d',
              border: '1px solid #bbf7d0',
              padding: '8px 14px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <Calculator size={15} /> Simulador TEF MDR
          </button>

          <button
            type="button"
            onClick={() => window.open('/api/stallone-club/admin/assinaturas/exportar-csv?download=true', '_blank')}
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
            <Download size={14} /> Exportar CSV
          </button>

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
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Ações de Gestão & Operação</th>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 700, color: '#d97706' }}>
                            {fmtMoney(a.saldoCashbackAcumulado || a.cashbackSaldo || 0)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleVerExtrato(a.id)}
                            title="Ver extrato de cashback"
                            style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}
                          >
                            extrato
                          </button>
                        </div>
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
                        <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {['ativa', 'em_dia'].includes(a.status) && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleProcessarCiclo(a.id, a.clienteNome)}
                                disabled={processando}
                                title="Processar ciclo mensal e liberar reposição de suplementos"
                                style={{
                                  background: '#0284c7',
                                  color: '#fff',
                                  border: 'none',
                                  padding: '4px 8px',
                                  borderRadius: 6,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                              >
                                Cobrar Ciclo
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDespacharBox(a.id, a.clienteNome)}
                                disabled={processando}
                                title="Despachar Box e dar baixa no estoque físico"
                                style={{
                                  background: '#059669',
                                  color: '#fff',
                                  border: 'none',
                                  padding: '4px 8px',
                                  borderRadius: 6,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4
                                }}
                              >
                                <Truck size={12} /> Despachar Box
                              </button>
                              <button
                                type="button"
                                onClick={() => handleNotificarWhatsApp(a.id)}
                                title="Notificar cliente via WhatsApp institucional que o box está pronto"
                                style={{
                                  background: '#25D366',
                                  color: '#fff',
                                  border: 'none',
                                  padding: '4px 8px',
                                  borderRadius: 6,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4
                                }}
                              >
                                <Send size={12} /> Zap
                              </button>
                            </>
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

      {/* Modal Simulador de Taxas TEF MDR */}
      {modalSimulador && (
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
            maxWidth: 680,
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
                  Simulador de Economia de Taxas MDR (Multi-Maquininhas)
                </h3>
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  Orienta o operador de caixa sobre qual adquirente retém menor taxa na Stallone Nutre Sport
                </span>
              </div>
              <button
                type="button"
                onClick={() => setModalSimulador(false)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 10, alignItems: 'flex-end', marginBottom: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 4, color: '#334155' }}>
                  Valor da Venda (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={simuladorValor}
                  onChange={e => setSimuladorValor(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 4, color: '#334155' }}>
                  Modalidade
                </label>
                <select
                  value={simuladorModalidade}
                  onChange={e => setSimuladorModalidade(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                >
                  <option value="debito">Débito</option>
                  <option value="credito_avista">Crédito à Vista</option>
                  <option value="credito_parcelado">Crédito Parcelado</option>
                  <option value="pix">PIX no Pinpad</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 4, color: '#334155' }}>
                  Parcelas
                </label>
                <select
                  disabled={simuladorModalidade !== 'credito_parcelado'}
                  value={simuladorParcelas}
                  onChange={e => setSimuladorParcelas(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                >
                  <option value={2}>2x</option>
                  <option value={3}>3x</option>
                  <option value={4}>4x</option>
                  <option value={5}>5x</option>
                  <option value={6}>6x</option>
                  <option value={10}>10x</option>
                  <option value={12}>12x</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleExecutarSimuladorTef}
                style={{
                  background: '#0284c7',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: 6,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                Simular
              </button>
            </div>

            {resultadoSimulador && (
              <div>
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#166534', fontWeight: 800, fontSize: 14 }}>
                    <ShieldCheck size={18} /> Recomendação para o Caixa: {resultadoSimulador.melhorOpcao?.adquirenteNome}
                  </div>
                  <div style={{ fontSize: 12, color: '#15803d', marginTop: 4 }}>
                    Taxa MDR de apenas <strong>{resultadoSimulador.melhorOpcao?.taxaMdrPercentual}%</strong> (retém R$ {resultadoSimulador.melhorOpcao?.valorTaxaMdr.toFixed(2)} · Líquido no Caixa: R$ {resultadoSimulador.melhorOpcao?.valorLiquido.toFixed(2)} · Prazo: {resultadoSimulador.melhorOpcao?.prazoLiquidacao}). Economia máxima de <strong>R$ {resultadoSimulador.economiaMaxima.toFixed(2)}</strong> frente à pior opção.
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                        <th style={{ padding: '8px 10px' }}>Ranking</th>
                        <th style={{ padding: '8px 10px' }}>Adquirente</th>
                        <th style={{ padding: '8px 10px' }}>Taxa MDR</th>
                        <th style={{ padding: '8px 10px' }}>Desconto Taxa</th>
                        <th style={{ padding: '8px 10px' }}>Líquido Loja</th>
                        <th style={{ padding: '8px 10px' }}>Prazo Depósito</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultadoSimulador.comparativo?.map((c) => (
                        <tr key={c.adquirenteId} style={{ borderBottom: '1px solid #f1f5f9', background: c.recomendado ? '#f0fdf4' : 'transparent' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 700 }}>
                            {c.recomendado ? '⭐ 1º' : `${c.posicaoRanking}º`}
                          </td>
                          <td style={{ padding: '8px 10px', fontWeight: 600 }}>{c.adquirenteNome}</td>
                          <td style={{ padding: '8px 10px' }}>{c.taxaMdrPercentual}%</td>
                          <td style={{ padding: '8px 10px', color: '#b91c1c' }}>- {fmtMoney(c.valorTaxaMdr)}</td>
                          <td style={{ padding: '8px 10px', fontWeight: 700, color: '#047857' }}>{fmtMoney(c.valorLiquido)}</td>
                          <td style={{ padding: '8px 10px' }}>{c.prazoLiquidacao}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Extrato de Cashback */}
      {modalExtrato && (
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
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
                  Extrato de Cashback Kytto Pay
                </h3>
                <span style={{ fontSize: 12, color: '#64748b' }}>{modalExtrato.clienteNome} · CPF: {modalExtrato.clienteCpf}</span>
              </div>
              <button
                type="button"
                onClick={() => setModalExtrato(null)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}
              >
                ×
              </button>
            </div>

            <div style={{ background: '#fef3c7', borderRadius: 8, padding: 12, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#92400e', fontWeight: 600, fontSize: 13 }}>Saldo Acumulado Disponível:</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: '#b45309' }}>{fmtMoney(modalExtrato.saldoAtual)}</span>
            </div>

            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              {modalExtrato.lancamentos?.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8', fontSize: 12 }}>
                  Nenhum lançamento de cashback registrado até o momento.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {modalExtrato.lancamentos?.map((l) => (
                    <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, borderRadius: 6, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 12 }}>
                      <div>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{l.descricao}</div>
                        <div style={{ fontSize: 10, color: '#64748b' }}>{fmtDate(l.data)}</div>
                      </div>
                      <span style={{ fontWeight: 800, color: '#15803d' }}>+ {fmtMoney(l.valor)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button
                type="button"
                onClick={() => setModalExtrato(null)}
                style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', fontSize: 13, cursor: 'pointer' }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

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
