import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, fmtR, fmtDateOnly } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { isDinoBrandContext, DINO_BARBERSHOP_LOGO } from '../../../lib/brand';
import { useToast } from '../../../hooks/useToast';
import {
  Calendar,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Printer,
  Lock,
  Unlock,
  DollarSign,
  CreditCard,
  ArrowDownRight,
  ArrowUpRight,
  Scissors,
  ShoppingBag,
  Eye,
  Search,
  ChevronRight,
  FileText,
  X,
  ShieldCheck,
  TrendingUp,
  Receipt,
  Users,
  Zap,
  Building2,
  Store,
  Layers,
  PlusCircle,
  Clock,
} from 'lucide-react';

const moeda = (val) => fmtR(Number(val || 0));

function dataHojeStr() {
  const agora = new Date();
  return agora.toLocaleDateString('sv', { timeZone: 'America/Cuiaba' });
}

export default function FechamentoDiarioGestao() {
  const { empresaAtiva, empresasAcessiveis, trocarEmpresa, lojaAtiva, lojasAcessiveis, trocarLoja } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Multi-Empresa selecionada
  const [empresaSelecionadaId, setEmpresaSelecionadaId] = useState(
    searchParams.get('empresaId') || empresaAtiva?.id || 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6'
  );
  const [lojaSelecionadaId, setLojaSelecionadaId] = useState(
    searchParams.get('lojaId') || lojaAtiva?.id || ''
  );

  const dataQuery = searchParams.get('data') || dataHojeStr();
  const [dataSelecionada, setDataSelecionada] = useState(dataQuery);
  const [carregando, setCarregando] = useState(true);
  const [dados, setDados] = useState(null);

  // Lista de empresas cadastradas no sistema
  const [listaEmpresas, setListaEmpresas] = useState([]);

  // Abas internas
  const [abaAtiva, setAbaAtiva] = useState('conciliacao'); // 'conciliacao' | 'caixas' | 'comandas' | 'historico'
  const [buscaComanda, setBuscaComanda] = useState('');
  const [filtroStatusComanda, setFiltroStatusComanda] = useState('todas'); // 'todas' | 'paga' | 'em_conta' | 'aberta'

  // Modais de Fechamento e Reabertura Geral
  const [modalFechamento, setModalFechamento] = useState(false);
  const [fecharCaixasAutomatico, setFecharCaixasAutomatico] = useState(true);
  const [obsFechamento, setObsFechamento] = useState('');
  const [senhaGerenteFechamento, setSenhaGerenteFechamento] = useState('');
  const [processandoFechamento, setProcessandoFechamento] = useState(false);

  // Modal Fechar Todos os Caixas da Empresa
  const [modalFecharTodosCaixas, setModalFecharTodosCaixas] = useState(false);
  const [valoresPorCaixa, setValoresPorCaixa] = useState({});
  const [senhaGerenteLote, setSenhaGerenteLote] = useState('');
  const [processandoLote, setProcessandoLote] = useState(false);

  // Modal Fechar Caixa Individual
  const [caixaParaFechar, setCaixaParaFechar] = useState(null);
  const [valorContadoIndividual, setValorContadoIndividual] = useState('');
  const [obsCaixaIndividual, setObsCaixaIndividual] = useState('');
  const [processandoFechamentoIndividual, setProcessandoFechamentoIndividual] = useState(false);

  // Modal Abrir Caixa
  const [modalAbrirCaixa, setModalAbrirCaixa] = useState(false);
  const [novoCaixaNumero, setNovoCaixaNumero] = useState(1);
  const [novoCaixaNome, setNovoCaixaNome] = useState('Caixa Balcão');
  const [novoCaixaValorAbertura, setNovoCaixaValorAbertura] = useState('100.00');
  const [novoCaixaOperador, setNovoCaixaOperador] = useState('');
  const [processandoAberturaCaixa, setProcessandoAberturaCaixa] = useState(false);

  // Modal Reabertura
  const [modalReabrir, setModalReabrir] = useState(false);
  const [motivoReabertura, setMotivoReabertura] = useState('');
  const [senhaGerenteReabertura, setSenhaGerenteReabertura] = useState('');
  const [reabrirCaixasFisicos, setReabrirCaixasFisicos] = useState(true);
  const [processandoReabertura, setProcessandoReabertura] = useState(false);

  // Modal Impressão
  const [modalImpressao, setModalImpressao] = useState(false);

  // Carrega lista de empresas
  useEffect(() => {
    async function carregarEmpresas() {
      try {
        const res = await api.get('/api/admin/fechamento-diario/empresas');
        if (res && res.ok && Array.isArray(res.empresas)) {
          setListaEmpresas(res.empresas);
        } else if (Array.isArray(empresasAcessiveis) && empresasAcessiveis.length) {
          setListaEmpresas(empresasAcessiveis);
        }
      } catch (err) {
        if (Array.isArray(empresasAcessiveis) && empresasAcessiveis.length) {
          setListaEmpresas(empresasAcessiveis);
        }
      }
    }
    carregarEmpresas();
  }, []);

  const buscandoRef = useRef(false);
  // Carrega dados da conciliação da data e empresa selecionada
  const carregarDados = useCallback(async (dataAlvo, empresaAlvo, lojaAlvo) => {
    if (buscandoRef.current) return;
    buscandoRef.current = true;
    const dia = dataAlvo || dataHojeStr();
    const empId = empresaAlvo || '';
    const ljId = lojaAlvo !== undefined ? lojaAlvo : '';
    try {
      setCarregando(true);
      const url = `/api/admin/fechamento-diario?data=${dia}&empresaId=${empId}${ljId ? `&lojaId=${ljId}` : ''}`;
      const res = await api.get(url);
      if (res && res.ok) {
        setDados(res);
        if (Array.isArray(res.empresas) && res.empresas.length) {
          setListaEmpresas(res.empresas);
        }
      }
    } catch (e) {
      console.error(e);
      toast?.(e.message || 'Erro ao carregar dados do fechamento diário e conciliação', 'error');
    } finally {
      setCarregando(false);
      buscandoRef.current = false;
    }
  }, [toast]);

  useEffect(() => {
    carregarDados(dataSelecionada, empresaSelecionadaId, lojaSelecionadaId);
  }, [dataSelecionada, empresaSelecionadaId, lojaSelecionadaId, carregarDados]);

  const trocarData = (novaData) => {
    setDataSelecionada(novaData);
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set('data', novaData);
      return p;
    });
  };

  const handleMudarEmpresa = (novaEmpresaId) => {
    setEmpresaSelecionadaId(novaEmpresaId);
    setLojaSelecionadaId('');
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set('empresaId', novaEmpresaId);
      p.delete('lojaId');
      return p;
    });
    // Se o usuário tem essa empresa no contexto geral, atualiza no useAuth
    if (trocarEmpresa && empresasAcessiveis?.some((e) => e.id === novaEmpresaId)) {
      trocarEmpresa(novaEmpresaId);
    }
  };

  const handleMudarLoja = (novaLojaId) => {
    setLojaSelecionadaId(novaLojaId);
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      if (novaLojaId) p.set('lojaId', novaLojaId);
      else p.delete('lojaId');
      return p;
    });
    if (trocarLoja && novaLojaId) trocarLoja(novaLojaId);
  };

  // Empresa ativa encontrada no cadastro
  const empresaAtualObj = useMemo(() => {
    return listaEmpresas.find((e) => e.id === empresaSelecionadaId) ||
      empresasAcessiveis?.find((e) => e.id === empresaSelecionadaId) ||
      empresaAtiva || { id: empresaSelecionadaId, nome: 'Empresa Ativa' };
  }, [listaEmpresas, empresasAcessiveis, empresaAtiva, empresaSelecionadaId]);

  const isDino = isDinoBrandContext(empresaAtualObj);

  // Executa fechamento diário integrado
  const handleExecutarFechamento = async (e) => {
    e.preventDefault();
    try {
      setProcessandoFechamento(true);
      const payload = {
        confirmado: true,
        empresaId: empresaSelecionadaId,
        data: dataSelecionada,
        lojaId: lojaSelecionadaId || undefined,
        fecharCaixasAbertos: fecharCaixasAutomatico,
        observacao: obsFechamento || 'Fechamento diário unificado homologado',
        senhaGerente: senhaGerenteFechamento || undefined,
      };

      const res = await api.post('/api/admin/fechamento-diario/executar', payload);
      if (res && res.ok) {
        toast(`Fechamento diário realizado com sucesso! (${res.caixasFechados || 0} caixa(s) fechado(s))`, 'success');
        setModalFechamento(false);
        setSenhaGerenteFechamento('');
        setObsFechamento('');
        await carregarDados(dataSelecionada, empresaSelecionadaId, lojaSelecionadaId);
      }
    } catch (err) {
      toast(err.message || 'Erro ao realizar fechamento diário', 'error');
    } finally {
      setProcessandoFechamento(false);
    }
  };

  // Executa fechamento de todos os caixas da empresa
  const handleFecharTodosCaixas = async (e) => {
    e.preventDefault();
    try {
      setProcessandoLote(true);
      const payload = {
        confirmado: true,
        empresaId: empresaSelecionadaId,
        data: dataSelecionada,
        lojaId: lojaSelecionadaId || undefined,
        valoresPorCaixa,
        senhaGerente: senhaGerenteLote || undefined,
        observacao: 'Fechamento em lote dos caixas da empresa',
      };

      const res = await api.post('/api/admin/fechamento-diario/fechar-todos-caixas', payload);
      if (res && res.ok) {
        toast(`Todos os ${res.caixasFechados || 0} caixa(s) foram fechados com sucesso!`, 'success');
        setModalFecharTodosCaixas(false);
        setSenhaGerenteLote('');
        setValoresPorCaixa({});
        await carregarDados(dataSelecionada, empresaSelecionadaId, lojaSelecionadaId);
      }
    } catch (err) {
      toast(err.message || 'Erro ao fechar caixas em lote', 'error');
    } finally {
      setProcessandoLote(false);
    }
  };

  // Executa fechamento de caixa individual
  const handleFecharCaixaIndividual = async (e) => {
    e.preventDefault();
    if (!caixaParaFechar) return;
    try {
      setProcessandoFechamentoIndividual(true);
      const payload = {
        empresaId: empresaSelecionadaId,
        caixaId: caixaParaFechar.id,
        valorInformado: valorContadoIndividual !== '' ? Number(valorContadoIndividual) : undefined,
        observacao: obsCaixaIndividual || 'Fechamento individual de caixa',
      };

      const res = await api.post('/api/admin/fechamento-diario/fechar-caixa-individual', payload);
      if (res && res.ok) {
        toast(`Caixa ${caixaParaFechar.numeroCaixa} fechado com sucesso!`, 'success');
        setCaixaParaFechar(null);
        setValorContadoIndividual('');
        setObsCaixaIndividual('');
        await carregarDados(dataSelecionada, empresaSelecionadaId, lojaSelecionadaId);
      }
    } catch (err) {
      toast(err.message || 'Erro ao fechar caixa individual', 'error');
    } finally {
      setProcessandoFechamentoIndividual(false);
    }
  };

  // Executa abertura de novo caixa
  const handleAbrirNovoCaixa = async (e) => {
    e.preventDefault();
    try {
      setProcessandoAberturaCaixa(true);
      const payload = {
        empresaId: empresaSelecionadaId,
        lojaId: lojaSelecionadaId || undefined,
        data: dataSelecionada,
        numeroCaixa: Number(novoCaixaNumero || 1),
        nomeCaixa: novoCaixaNome || `Caixa ${novoCaixaNumero}`,
        valorAbertura: Number(novoCaixaValorAbertura || 0),
        responsavel: novoCaixaOperador || 'Operador',
      };

      const res = await api.post('/api/admin/fechamento-diario/abrir-caixa', payload);
      if (res && res.ok) {
        toast(`Caixa ${res.numeroCaixa || novoCaixaNumero} aberto com sucesso!`, 'success');
        setModalAbrirCaixa(false);
        await carregarDados(dataSelecionada, empresaSelecionadaId, lojaSelecionadaId);
      }
    } catch (err) {
      toast(err.message || 'Erro ao abrir novo caixa', 'error');
    } finally {
      setProcessandoAberturaCaixa(false);
    }
  };

  // Reabre fechamento diário
  const handleReabrirFechamento = async (e) => {
    e.preventDefault();
    if (!senhaGerenteReabertura) {
      toast('Informe a senha de gerente para autorizar a reabertura.', 'error');
      return;
    }
    try {
      setProcessandoReabertura(true);
      const payload = {
        empresaId: empresaSelecionadaId,
        data: dataSelecionada,
        lojaId: lojaSelecionadaId || undefined,
        reabrirCaixas: reabrirCaixasFisicos,
        motivo: motivoReabertura || 'Reabertura para conferência e correções',
        senhaGerente: senhaGerenteReabertura,
      };

      const res = await api.post('/api/admin/fechamento-diario/reabrir', payload);
      if (res && res.ok) {
        toast(`Fechamento diário reaberto com sucesso! (${res.caixasReabertos || 0} caixa(s) reaberto(s))`, 'success');
        setModalReabrir(false);
        setSenhaGerenteReabertura('');
        setMotivoReabertura('');
        await carregarDados(dataSelecionada, empresaSelecionadaId, lojaSelecionadaId);
      }
    } catch (err) {
      toast(err.message || 'Erro ao reabrir fechamento diário', 'error');
    } finally {
      setProcessandoReabertura(false);
    }
  };

  const kpis = dados?.kpisGestao || {
    faturamentoBruto: 0,
    totalRecebidoLiquido: 0,
    totalEmConta: 0,
    totalDespesasPagas: 0,
    saldoLiquidoDia: 0,
    totalComandas: 0,
    comandasFechadas: 0,
    comandasAbertas: 0,
    totalServicos: 0,
    valorServicos: 0,
    totalProdutos: 0,
    valorProdutos: 0,
    caixasAbertos: 0,
    caixasFechados: 0,
    totalDivergencias: 0,
  };

  const conciliacaoLinhas = dados?.conciliacao || [];
  const caixas = dados?.caixas || [];
  const comandas = dados?.comandas || [];
  const historico = dados?.historicoFechamentos || [];

  const comandasFiltradas = useMemo(() => {
    let filtradas = comandas;
    if (filtroStatusComanda !== 'todas') {
      if (filtroStatusComanda === 'paga') filtradas = filtradas.filter((c) => c.status === 'paga');
      else if (filtroStatusComanda === 'em_conta') filtradas = filtradas.filter((c) => c.status === 'em_conta');
      else if (filtroStatusComanda === 'aberta') filtradas = filtradas.filter((c) => ['aberta', 'aguardando_pagamento', 'parcialmente_paga'].includes(c.status));
    }
    if (!buscaComanda.trim()) return filtradas;
    const q = buscaComanda.toLowerCase().trim();
    return filtradas.filter((c) =>
      String(c.numeroComanda || '').includes(q) ||
      String(c.clienteNome || '').toLowerCase().includes(q) ||
      String(c.profissionalNome || '').toLowerCase().includes(q) ||
      String(c.itensResumo || '').toLowerCase().includes(q) ||
      String(c.moduloOrigem || '').toLowerCase().includes(q)
    );
  }, [comandas, buscaComanda, filtroStatusComanda]);

  const diaFechado = dados?.diaFechado || false;
  const statusGeral = dados?.statusGeral || 'conciliado';
  const caixasAbertosCount = caixas.filter((c) => c.status === 'aberto').length;

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* ── BARRA SUPERIOR: MULTI-EMPRESA E UNIDADE ── */}
      <div style={{ background: 'var(--card, #ffffff)', border: '1px solid var(--line, #e2e8f0)', borderRadius: 16, padding: '16px 20px', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <Building2 size={18} color="#2563eb" />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>Empresa:</span>
            <select
              value={empresaSelecionadaId}
              onChange={(e) => handleMudarEmpresa(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontWeight: 800, color: '#0f172a', background: '#fff', fontSize: 13, cursor: 'pointer' }}
            >
              {listaEmpresas.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.nome} ({emp.tipo || 'geral'})
                </option>
              ))}
            </select>
          </div>

          {Array.isArray(empresaAtualObj?.lojas) && empresaAtualObj.lojas.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <Store size={18} color="#14b87a" />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>Unidade:</span>
              <select
                value={lojaSelecionadaId}
                onChange={(e) => handleMudarLoja(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontWeight: 700, color: '#0f172a', background: '#fff', fontSize: 13, cursor: 'pointer' }}
              >
                <option value="">Todas as Unidades</option>
                {empresaAtualObj.lojas.map((lj) => (
                  <option key={lj.id} value={lj.id}>
                    {lj.nome}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Ações Rápidas de Fechamento por Empresa */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {caixasAbertosCount > 0 && (
            <button
              type="button"
              onClick={() => {
                const initValores = {};
                caixas.filter((c) => c.status === 'aberto').forEach((c) => {
                  initValores[c.id] = c.valorEsperado != null ? String(c.valorEsperado) : String(c.valorAbertura || 0);
                });
                setValoresPorCaixa(initValores);
                setModalFecharTodosCaixas(true);
              }}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: '1px solid #f59e0b',
                background: '#fffbeb',
                color: '#b45309',
                fontWeight: 800,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Lock size={15} />
              <span>Fechar Todos os Caixas da Empresa ({caixasAbertosCount})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setModalAbrirCaixa(true)}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid #14b87a',
              background: '#14b87a',
              color: '#fff',
              fontWeight: 800,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <PlusCircle size={15} />
            <span>+ Abrir Caixa</span>
          </button>
        </div>
      </div>

      {/* ── CABEÇALHO PRINCIPAL DA PÁGINA ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {isDino ? (
            <img
              src={DINO_BARBERSHOP_LOGO}
              alt="Barbearia Dino"
              style={{ width: 60, height: 60, objectFit: 'contain', background: '#0f172a', borderRadius: 12, padding: 4, border: '1px solid #334155' }}
            />
          ) : (
            <div style={{ width: 56, height: 56, borderRadius: 12, background: 'linear-gradient(135deg, #FF6B2C, #e05316)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 26, fontWeight: 800 }}>
              🔐
            </div>
          )}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: 'var(--text, #0f172a)' }}>
                Fechamento Diário &amp; Conciliação ERP
              </h1>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  padding: '4px 10px',
                  borderRadius: 20,
                  background: diaFechado ? '#dcfce7' : '#fef3c7',
                  color: diaFechado ? '#166534' : '#92400e',
                  border: `1px solid ${diaFechado ? '#86efac' : '#fcd34d'}`,
                }}
              >
                {diaFechado ? '🔒 Dia Fechado Oficialmente' : '🔓 Dia em Operação (Prévia)'}
              </span>
            </div>
            <p style={{ margin: '4px 0 0', color: 'var(--muted, #64748b)', fontSize: 13 }}>
              {empresaAtualObj.nome} · Conciliação unificada entre a Operação de Caixa (Balcão/Gaveta/Comandas/Vendas) e o Livro-Caixa / Razão Financeiro.
            </p>
          </div>
        </div>

        {/* Seletores de Data e Ações Globais */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: '#f1f5f9', padding: 3, borderRadius: 10, border: '1px solid #cbd5e1' }}>
            <button
              type="button"
              onClick={() => trocarData(dataHojeStr())}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: 'none',
                background: dataSelecionada === dataHojeStr() ? '#2563eb' : 'transparent',
                color: dataSelecionada === dataHojeStr() ? '#fff' : '#475569',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => {
                const ontem = new Date();
                ontem.setDate(ontem.getDate() - 1);
                trocarData(ontem.toLocaleDateString('sv', { timeZone: 'America/Cuiaba' }));
              }}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: 'none',
                background: 'transparent',
                color: '#475569',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Ontem
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #cbd5e1', borderRadius: 10, padding: '6px 12px' }}>
            <Calendar size={16} color="#64748b" />
            <input
              type="date"
              value={dataSelecionada}
              onChange={(e) => trocarData(e.target.value)}
              style={{ border: 'none', outline: 'none', fontSize: 13, fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}
            />
          </div>

          <button
            type="button"
            onClick={() => carregarDados(dataSelecionada, empresaSelecionadaId, lojaSelecionadaId)}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              background: '#fff',
              cursor: 'pointer',
              color: '#334155',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              fontWeight: 700,
            }}
            title="Atualizar dados da data"
          >
            <RefreshCw size={15} className={carregando ? 'spin' : ''} />
            <span>Atualizar</span>
          </button>

          <button
            type="button"
            onClick={() => setModalImpressao(true)}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid #2563eb',
              background: '#eff6ff',
              color: '#2563eb',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Printer size={16} />
            <span>Imprimir Fechamento</span>
          </button>

          {isDino && (
            <button
              type="button"
              onClick={() => navigate('/admin/barbearia-erp?area=operacao&tab=Caixa+e+fechamento')}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: '#0f172a',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              💈 Abrir Caixa Barbearia
            </button>
          )}

          {!diaFechado ? (
            <button
              type="button"
              onClick={() => setModalFechamento(true)}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                background: '#16a34a',
                color: '#fff',
                fontWeight: 800,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 2px 4px rgba(22, 163, 74, 0.25)',
              }}
            >
              <Lock size={16} />
              <span>Fechar o Dia no ERP</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setModalReabrir(true)}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid #dc2626',
                background: '#fef2f2',
                color: '#dc2626',
                fontWeight: 800,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Unlock size={16} />
              <span>Reabrir Fechamento</span>
            </button>
          )}
        </div>
      </div>

      {/* ── BANNER DE STATUS DA CONCILIAÇÃO ── */}
      <div
        style={{
          padding: '16px 20px',
          borderRadius: 14,
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          background: statusGeral === 'conciliado' ? '#f0fdf4' : statusGeral === 'pendente' ? '#fffbeb' : '#fef2f2',
          border: `1px solid ${statusGeral === 'conciliado' ? '#bbf7d0' : statusGeral === 'pendente' ? '#fde68a' : '#fecaca'}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {statusGeral === 'conciliado' && <CheckCircle2 size={24} color="#16a34a" />}
          {statusGeral === 'pendente' && <AlertTriangle size={24} color="#d97706" />}
          {statusGeral === 'divergente' && <AlertCircle size={24} color="#dc2626" />}
          <div>
            <strong style={{ fontSize: 15, color: statusGeral === 'conciliado' ? '#166534' : statusGeral === 'pendente' ? '#92400e' : '#991b1b' }}>
              {statusGeral === 'conciliado' && '✅ Operação de Caixa e ERP 100% Conciliados'}
              {statusGeral === 'pendente' && '⚠️ Dia em Operação (Caixas ou Comandas em Aberto)'}
              {statusGeral === 'divergente' && '🚨 Atenção: Divergência Apurada entre Caixa e ERP'}
            </strong>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#475569' }}>
              {dados?.mensagemStatus || 'Conferência automática realizada entre a operação de balcão e o Livro-Caixa do ERP.'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 24, textAlign: 'right' }}>
          <div>
            <small style={{ color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Divergência Total</small>
            <div style={{ fontSize: 16, fontWeight: 800, color: kpis.totalDivergencias > 0.05 ? '#dc2626' : '#16a34a' }}>
              {moeda(kpis.totalDivergencias)}
            </div>
          </div>
          <div>
            <small style={{ color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Caixas Operados</small>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
              {kpis.caixasFechados} / {kpis.totalCaixas} fechados
            </div>
          </div>
        </div>
      </div>

      {/* ── CARDS DE KPIS DE GESTÃO DA EMPRESA ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 24 }}>
        
        {/* Faturamento Bruto */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '16px 18px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Faturamento Bruto</span>
            <TrendingUp size={16} color="#2563eb" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>{moeda(kpis.faturamentoBruto)}</div>
          <small style={{ color: '#64748b', fontSize: 12, display: 'block', marginTop: 4 }}>
            ✂️ Serviços: {moeda(kpis.valorServicos)} ({kpis.totalServicos}) · 🧴 Produtos: {moeda(kpis.valorProdutos)}
          </small>
        </div>

        {/* Recebido Líquido */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '16px 18px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Recebido Líquido</span>
            <ArrowDownRight size={16} color="#16a34a" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#16a34a' }}>{moeda(kpis.totalRecebidoLiquido)}</div>
          <small style={{ color: '#64748b', fontSize: 12, display: 'block', marginTop: 4 }}>
            Entradas no Balcão (Dinheiro + Pix + Cartões)
          </small>
        </div>

        {/* Lançado em Conta (Crediário) */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '16px 18px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Lançado em Conta</span>
            <Receipt size={16} color="#d97706" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#d97706' }}>{moeda(kpis.totalEmConta)}</div>
          <small style={{ color: '#64748b', fontSize: 12, display: 'block', marginTop: 4 }}>
            Crediário a Receber de Clientes (Futuro)
          </small>
        </div>

        {/* Despesas Pagas */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '16px 18px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Despesas Pagas</span>
            <ArrowUpRight size={16} color="#dc2626" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#dc2626' }}>{moeda(kpis.totalDespesasPagas)}</div>
          <small style={{ color: '#64748b', fontSize: 12, display: 'block', marginTop: 4 }}>
            Saídas Operacionais pagas no dia
          </small>
        </div>

        {/* Resultado Líquido do Dia */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '16px 18px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Resultado Líquido</span>
            <DollarSign size={16} color={kpis.saldoLiquidoDia >= 0 ? '#16a34a' : '#dc2626'} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: kpis.saldoLiquidoDia >= 0 ? '#16a34a' : '#dc2626' }}>
            {moeda(kpis.saldoLiquidoDia)}
          </div>
          <small style={{ color: '#64748b', fontSize: 12, display: 'block', marginTop: 4 }}>
            Recebido Líquido − Despesas Pagas
          </small>
        </div>

        {/* Comandas e Vendas */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '16px 18px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Comandas &amp; Vendas</span>
            <Users size={16} color="#6d28d9" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#6d28d9' }}>{kpis.comandasFechadas} / {kpis.totalComandas}</div>
          <small style={{ color: '#64748b', fontSize: 12, display: 'block', marginTop: 4 }}>
            {kpis.comandasAbertas > 0 ? `⚠️ ${kpis.comandasAbertas} ainda em aberto` : 'Todas finalizadas'}
          </small>
        </div>

      </div>

      {/* ── ABAS DE DETALHAMENTO & AUDITORIA ── */}
      <div style={{ borderBottom: '1px solid #e2e8f0', marginBottom: 20, display: 'flex', gap: 24, overflowX: 'auto' }}>
        <button
          type="button"
          onClick={() => setAbaAtiva('conciliacao')}
          style={{
            padding: '12px 6px',
            border: 'none',
            background: 'transparent',
            fontWeight: 800,
            fontSize: 14,
            cursor: 'pointer',
            color: abaAtiva === 'conciliacao' ? '#2563eb' : 'var(--muted, #64748b)',
            borderBottom: abaAtiva === 'conciliacao' ? '2px solid #2563eb' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          ⚖️ Conciliação Caixa ⟷ ERP
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva('caixas')}
          style={{
            padding: '12px 6px',
            border: 'none',
            background: 'transparent',
            fontWeight: 800,
            fontSize: 14,
            cursor: 'pointer',
            color: abaAtiva === 'caixas' ? '#2563eb' : 'var(--muted, #64748b)',
            borderBottom: abaAtiva === 'caixas' ? '2px solid #2563eb' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          📦 Caixas Físicos da Data ({caixas.length})
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva('comandas')}
          style={{
            padding: '12px 6px',
            border: 'none',
            background: 'transparent',
            fontWeight: 800,
            fontSize: 14,
            cursor: 'pointer',
            color: abaAtiva === 'comandas' ? '#2563eb' : 'var(--muted, #64748b)',
            borderBottom: abaAtiva === 'comandas' ? '2px solid #2563eb' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          🧾 Comandas &amp; Vendas Fechadas ({comandas.length})
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva('historico')}
          style={{
            padding: '12px 6px',
            border: 'none',
            background: 'transparent',
            fontWeight: 800,
            fontSize: 14,
            cursor: 'pointer',
            color: abaAtiva === 'historico' ? '#2563eb' : 'var(--muted, #64748b)',
            borderBottom: abaAtiva === 'historico' ? '2px solid #2563eb' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          📜 Histórico de Fechamentos ({historico.length})
        </button>
      </div>

      {/* ── CONTEÚDO DA ABA 1: CONCILIAÇÃO CAIXA <-> ERP ── */}
      {abaAtiva === 'conciliacao' && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                Matriz de Conciliação Financeira: Caixa Balcão ⟷ ERP Razão
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748b' }}>
                Comparativo meio a meio entre o apurado na operação da barbearia/loja e os registros do Livro-Caixa do ERP.
              </p>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '4px 10px', borderRadius: 8 }}>
              Data: {fmtDateOnly(dataSelecionada)}
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '1px solid #e2e8f0', textTransform: 'uppercase', fontSize: 11, letterSpacing: '.05em' }}>
                  <th style={{ padding: '12px 20px' }}>Forma de Pagamento / Movimentação</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Apurado no Caixa (Operação)</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Registrado no ERP (Financeiro)</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Divergência</th>
                  <th style={{ padding: '12px 20px', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {conciliacaoLinhas.map((linha) => (
                  <tr key={linha.chave} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '14px 20px', fontWeight: 700, color: '#0f172a' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {linha.chave === 'dinheiro' && <DollarSign size={16} color="#16a34a" />}
                        {linha.chave === 'pix' && <Zap size={16} color="#06b6d4" />}
                        {linha.chave.startsWith('cartao') && <CreditCard size={16} color="#2563eb" />}
                        {linha.chave === 'conta' && <Receipt size={16} color="#d97706" />}
                        {linha.chave === 'sangrias' && <ArrowUpRight size={16} color="#dc2626" />}
                        {linha.chave === 'suprimentos' && <ArrowDownRight size={16} color="#16a34a" />}
                        <span>{linha.label}</span>
                      </div>
                      {linha.esperadoGaveta != null && (
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 3, fontWeight: 500 }}>
                          Esperado gaveta física: <strong>{moeda(linha.esperadoGaveta)}</strong> · Informado: {moeda(linha.informadoGaveta)}
                        </div>
                      )}
                      {linha.bandeiras && Object.keys(linha.bandeiras).length > 0 && (
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 3, fontWeight: 500 }}>
                          Bandeiras: {Object.entries(linha.bandeiras).map(([b, v]) => `${b}: ${moeda(v)}`).join(' · ')}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                      {moeda(linha.operacao)}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, color: '#475569' }}>
                      {moeda(linha.erp)}
                    </td>
                    <td
                      style={{
                        padding: '14px 16px',
                        textAlign: 'right',
                        fontWeight: 800,
                        color: Math.abs(linha.diferenca) < 0.05 ? '#16a34a' : '#dc2626',
                      }}
                    >
                      {moeda(linha.diferenca)}
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: 6,
                          background: linha.status === 'conciliado' ? '#dcfce7' : '#fee2e2',
                          color: linha.status === 'conciliado' ? '#166534' : '#991b1b',
                        }}
                      >
                        {linha.status === 'conciliado' ? '✅ Conciliado' : '⚠️ Divergente'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0', fontWeight: 800 }}>
                  <td style={{ padding: '14px 20px', textTransform: 'uppercase', color: '#0f172a' }}>
                    Total Faturamento Operacional
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right', color: '#0f172a', fontSize: 14 }}>
                    {moeda(kpis.faturamentoBruto)}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right', color: '#0f172a', fontSize: 14 }}>
                    {moeda(kpis.totalRecebidoLiquido + kpis.totalEmConta)}
                  </td>
                  <td
                    style={{
                      padding: '14px 16px',
                      textAlign: 'right',
                      color: kpis.totalDivergencias < 0.05 ? '#16a34a' : '#dc2626',
                      fontSize: 14,
                    }}
                  >
                    {moeda(kpis.totalDivergencias)}
                  </td>
                  <td style={{ padding: '14px 20px', textAlign: 'center', color: '#16a34a' }}>
                    {kpis.totalDivergencias < 0.05 ? '100% OK' : 'Ajustar'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── CONTEÚDO DA ABA 2: CAIXAS FÍSICOS DA DATA ── */}
      {abaAtiva === 'caixas' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                Caixas Físicos da Empresa ({caixas.length})
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748b' }}>
                Acompanhamento individual de gavetas, fundo de abertura, suprimentos, sangrias e saldo esperado em dinheiro físico.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setModalAbrirCaixa(true)}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: 'none',
                background: '#14b87a',
                color: '#fff',
                fontWeight: 800,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <PlusCircle size={16} />
              <span>+ Abrir Novo Caixa</span>
            </button>
          </div>

          {caixas.length === 0 ? (
            <div style={{ background: '#fff', border: '1px dashed #cbd5e1', borderRadius: 14, padding: '40px 20px', textAlign: 'center' }}>
              <Layers size={36} color="#94a3b8" style={{ margin: '0 auto 10px' }} />
              <strong style={{ display: 'block', fontSize: 15, color: '#334155' }}>Nenhum caixa físico registrado nesta data</strong>
              <p style={{ color: '#64748b', fontSize: 13, margin: '4px 0 16px' }}>
                Abra um novo caixa operacional para registrar recebimentos de balcão e suprimentos.
              </p>
              <button
                type="button"
                onClick={() => setModalAbrirCaixa(true)}
                style={{ padding: '8px 16px', borderRadius: 8, background: '#2563eb', color: '#fff', border: 'none', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
              >
                + Abrir Caixa Agora
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
              {caixas.map((c) => (
                <div
                  key={c.id}
                  style={{
                    background: '#fff',
                    border: `1px solid ${c.status === 'aberto' ? '#86efac' : '#e2e8f0'}`,
                    borderRadius: 14,
                    padding: 18,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <strong style={{ fontSize: 16, color: '#0f172a' }}>{c.nomeCaixa}</strong>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: 12,
                            background: c.status === 'aberto' ? '#dcfce7' : '#f1f5f9',
                            color: c.status === 'aberto' ? '#166534' : '#475569',
                          }}
                        >
                          {c.status === 'aberto' ? '🟢 Aberto' : '🔒 Fechado'}
                        </span>
                      </div>
                      <small style={{ color: '#64748b', fontSize: 12, display: 'block', marginTop: 2 }}>
                        Operador: {c.responsavel} · Data: {fmtDateOnly(c.data)}
                      </small>
                    </div>

                    {c.status === 'aberto' && (
                      <button
                        type="button"
                        onClick={() => {
                          setCaixaParaFechar(c);
                          setValorContadoIndividual(String(c.valorEsperado != null ? c.valorEsperado : c.valorAbertura));
                        }}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 6,
                          border: '1px solid #f59e0b',
                          background: '#fffbeb',
                          color: '#b45309',
                          fontSize: 12,
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        Fechar Caixa
                      </button>
                    )}
                  </div>

                  <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12, marginBottom: 12 }}>
                    <div>
                      <span style={{ color: '#64748b' }}>Fundo Abertura:</span>
                      <strong style={{ display: 'block', color: '#0f172a', fontSize: 13 }}>{moeda(c.valorAbertura)}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Entradas Dinheiro:</span>
                      <strong style={{ display: 'block', color: '#16a34a', fontSize: 13 }}>{moeda(c.recebimentosDinheiro)}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Suprimentos (+):</span>
                      <strong style={{ display: 'block', color: '#2563eb', fontSize: 13 }}>{moeda(c.suprimentos)}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Sangrias (-):</span>
                      <strong style={{ display: 'block', color: '#dc2626', fontSize: 13 }}>{moeda(c.sangrias)}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
                    <div>
                      <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Saldo Esperado em Dinheiro</span>
                      <div style={{ fontSize: 17, fontWeight: 900, color: '#0f172a' }}>{moeda(c.valorEsperado)}</div>
                    </div>
                    {c.valorInformado != null && (
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Contado / Quebra</span>
                        <div style={{ fontSize: 14, fontWeight: 800, color: Math.abs(c.quebraCaixa || 0) < 0.05 ? '#16a34a' : '#dc2626' }}>
                          {moeda(c.valorInformado)} ({c.quebraCaixa >= 0 ? `+${moeda(c.quebraCaixa)}` : moeda(c.quebraCaixa)})
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── CONTEÚDO DA ABA 3: COMANDAS & VENDAS FECHADAS ── */}
      {abaAtiva === 'comandas' && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                Comandas &amp; Vendas Fechadas no Dia ({comandasFiltradas.length})
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748b' }}>
                Relação detalhada de serviços executados, produtos vendidos e comprovantes de recebimento.
              </p>
            </div>

            {/* Filtros e Busca */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', background: '#f1f5f9', padding: 2, borderRadius: 8 }}>
                {[
                  { id: 'todas', label: 'Todas' },
                  { id: 'paga', label: 'Pagas' },
                  { id: 'em_conta', label: 'Em Conta' },
                  { id: 'aberta', label: 'Em Aberto' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFiltroStatusComanda(f.id)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 6,
                      border: 'none',
                      background: filtroStatusComanda === f.id ? '#2563eb' : 'transparent',
                      color: filtroStatusComanda === f.id ? '#fff' : '#475569',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: '6px 10px' }}>
                <Search size={15} color="#64748b" />
                <input
                  type="text"
                  placeholder="Buscar cliente, profissional, itens..."
                  value={buscaComanda}
                  onChange={(e) => setBuscaComanda(e.target.value)}
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 12, width: 200 }}
                />
              </div>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '1px solid #e2e8f0', textTransform: 'uppercase', fontSize: 11, letterSpacing: '.05em' }}>
                  <th style={{ padding: '12px 20px' }}>Comanda / Venda</th>
                  <th style={{ padding: '12px 16px' }}>Módulo</th>
                  <th style={{ padding: '12px 16px' }}>Cliente</th>
                  <th style={{ padding: '12px 16px' }}>Profissional / Atendente</th>
                  <th style={{ padding: '12px 16px' }}>Itens Fechados</th>
                  <th style={{ padding: '12px 16px' }}>Forma de Pagamento</th>
                  <th style={{ padding: '12px 20px', textAlign: 'right' }}>Total (R$)</th>
                </tr>
              </thead>
              <tbody>
                {comandasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '36px 20px', textAlign: 'center', color: '#94a3b8' }}>
                      Nenhuma comanda ou venda encontrada para os filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  comandasFiltradas.map((cmd) => (
                    <tr key={cmd.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 20px', fontWeight: 800, color: '#0f172a' }}>
                        #{cmd.numeroComanda}
                        <span
                          style={{
                            display: 'block',
                            fontSize: 10,
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: 4,
                            marginTop: 4,
                            width: 'fit-content',
                            background: cmd.status === 'paga' ? '#dcfce7' : cmd.status === 'em_conta' ? '#fef3c7' : '#fee2e2',
                            color: cmd.status === 'paga' ? '#166534' : cmd.status === 'em_conta' ? '#92400e' : '#991b1b',
                          }}
                        >
                          {cmd.status === 'paga' ? 'Paga' : cmd.status === 'em_conta' ? 'Em Conta' : cmd.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: '#f1f5f9', color: '#475569' }}>
                          {cmd.moduloOrigem || 'Operação'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a' }}>
                        {cmd.clienteNome}
                        {cmd.clienteTelefone && (
                          <small style={{ display: 'block', color: '#64748b', fontSize: 11, fontWeight: 400 }}>
                            {cmd.clienteTelefone}
                          </small>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#334155' }}>
                        {cmd.profissionalNome}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#475569', fontSize: 12 }}>
                        {cmd.itensResumo || `${cmd.itensQuantidade || 0} item(ns)`}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {cmd.pagamentos && cmd.pagamentos.length > 0 ? (
                          cmd.pagamentos.map((p, idx) => (
                            <span
                              key={idx}
                              style={{
                                display: 'inline-block',
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: 6,
                                background: '#eff6ff',
                                color: '#1e40af',
                                margin: '2px 4px 2px 0',
                              }}
                            >
                              {p.meio} {p.bandeira ? `(${p.bandeira})` : ''} · {moeda(p.valor)}
                            </span>
                          ))
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: 12 }}>Em aberto</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 900, color: '#0f172a', fontSize: 14 }}>
                        {moeda(cmd.totalFaturado || cmd.total)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── CONTEÚDO DA ABA 4: HISTÓRICO DE FECHAMENTOS ── */}
      {abaAtiva === 'historico' && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
              Histórico Consolidado de Fechamentos da Empresa ({historico.length})
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748b' }}>
              Registro auditável de todos os fechamentos anteriores com faturamento, despesas e resultado líquido.
            </p>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '1px solid #e2e8f0', textTransform: 'uppercase', fontSize: 11, letterSpacing: '.05em' }}>
                  <th style={{ padding: '12px 20px' }}>Data do Fechamento</th>
                  <th style={{ padding: '12px 16px' }}>Responsável</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Faturamento Bruto</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Recebido Líquido</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Despesas Pagas</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Resultado Líquido</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Caixas</th>
                  <th style={{ padding: '12px 20px', textAlign: 'center' }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {historico.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '36px 20px', textAlign: 'center', color: '#94a3b8' }}>
                      Nenhum fechamento histórico registrado ainda para esta empresa.
                    </td>
                  </tr>
                ) : (
                  historico.map((f, i) => (
                    <tr key={f.id || i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '14px 20px', fontWeight: 800, color: '#0f172a' }}>
                        {fmtDateOnly(f.data)}
                        {String(f.data).slice(0, 10) === dataSelecionada && (
                          <span style={{ marginLeft: 8, fontSize: 10, background: '#eff6ff', color: '#2563eb', padding: '2px 6px', borderRadius: 4, fontWeight: 800 }}>
                            Atual
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px', color: '#475569', fontWeight: 600 }}>
                        {f.responsavel || 'Gerência'}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                        {moeda(f.faturamentoBruto)}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>
                        {moeda(f.totalRecebidoLiquido)}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 800, color: '#dc2626' }}>
                        {moeda(f.totalDespesasPagas)}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 900, color: (f.saldoLiquidoDia ?? 0) >= 0 ? '#16a34a' : '#dc2626' }}>
                        {moeda(f.saldoLiquidoDia)}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 700, color: '#64748b' }}>
                        {f.caixasFechados || 1}
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => trocarData(String(f.data).slice(0, 10))}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 6,
                            border: '1px solid #2563eb',
                            background: '#eff6ff',
                            color: '#2563eb',
                            fontWeight: 800,
                            fontSize: 12,
                            cursor: 'pointer',
                          }}
                        >
                          🔍 Carregar este dia
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MODAL: FECHAR O DIA NO ERP ── */}
      {modalFechamento && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, maxWidth: 520, width: '100%', padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Lock size={22} color="#16a34a" />
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#0f172a' }}>Fechar o Dia no ERP</h3>
              </div>
              <button type="button" onClick={() => setModalFechamento(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleExecutarFechamento}>
              <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: 12, marginBottom: 16, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#64748b' }}>Data do Fechamento:</span>
                  <strong>{fmtDateOnly(dataSelecionada)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#64748b' }}>Faturamento Total:</span>
                  <strong>{moeda(kpis.faturamentoBruto)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#64748b' }}>Recebimentos no Balcão:</span>
                  <strong style={{ color: '#16a34a' }}>{moeda(kpis.totalRecebidoLiquido)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Divergência Apurada:</span>
                  <strong style={{ color: kpis.totalDivergencias < 0.05 ? '#16a34a' : '#dc2626' }}>{moeda(kpis.totalDivergencias)}</strong>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#0f172a', fontWeight: 700, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={fecharCaixasAutomatico}
                    onChange={(e) => setFecharCaixasAutomatico(e.target.checked)}
                  />
                  <span>Encerrar e fechar automaticamente todos os caixas operacionais abertos</span>
                </label>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#475569', marginBottom: 4, textTransform: 'uppercase' }}>
                  Observações do Turno
                </label>
                <textarea
                  rows={2}
                  value={obsFechamento}
                  onChange={(e) => setObsFechamento(e.target.value)}
                  placeholder="Observações da conferência de caixa..."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, resize: 'none' }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#dc2626', marginBottom: 4, textTransform: 'uppercase' }}>
                  🔒 Senha de Gerente / Administrador
                </label>
                <input
                  type="password"
                  required
                  placeholder="Digite sua senha de autorização"
                  value={senhaGerenteFechamento}
                  onChange={(e) => setSenhaGerenteFechamento(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 700 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setModalFechamento(false)}
                  style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={processandoFechamento}
                  style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
                >
                  {processandoFechamento ? 'Fechando...' : 'Confirmar e Fechar o Dia'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: FECHAR TODOS OS CAIXAS DA EMPRESA EM LOTE ── */}
      {modalFecharTodosCaixas && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, maxWidth: 580, width: '100%', padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Lock size={22} color="#b45309" />
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#0f172a' }}>
                  Fechar Todos os Caixas da Empresa ({caixas.filter((c) => c.status === 'aberto').length})
                </h3>
              </div>
              <button type="button" onClick={() => setModalFecharTodosCaixas(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleFecharTodosCaixas}>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: '#475569' }}>
                Informe o valor contado em dinheiro para cada gaveta física. O sistema apurará a quebra e efetuará o encerramento em lote.
              </p>

              <div style={{ maxHeight: 260, overflowY: 'auto', display: 'grid', gap: 10, marginBottom: 18 }}>
                {caixas.filter((c) => c.status === 'aberto').map((c) => (
                  <div key={c.id} style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ display: 'block', fontSize: 14, color: '#0f172a' }}>{c.nomeCaixa}</strong>
                      <small style={{ color: '#64748b', fontSize: 12 }}>
                        Esperado em Gaveta: <strong>{moeda(c.valorEsperado)}</strong>
                      </small>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Contado: R$</span>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={valoresPorCaixa[c.id] || ''}
                        onChange={(e) => setValoresPorCaixa({ ...valoresPorCaixa, [c.id]: e.target.value })}
                        style={{ width: 100, padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontWeight: 800, fontSize: 13 }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#dc2626', marginBottom: 4, textTransform: 'uppercase' }}>
                  🔒 Senha de Gerente / Administrador
                </label>
                <input
                  type="password"
                  required
                  placeholder="Digite sua senha de autorização"
                  value={senhaGerenteLote}
                  onChange={(e) => setSenhaGerenteLote(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 700 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setModalFecharTodosCaixas(false)}
                  style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={processandoLote}
                  style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#b45309', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
                >
                  {processandoLote ? 'Fechando em lote...' : 'Confirmar Fechamento em Lote'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: FECHAR CAIXA INDIVIDUAL ── */}
      {caixaParaFechar && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, maxWidth: 460, width: '100%', padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Lock size={20} color="#b45309" />
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: '#0f172a' }}>
                  Fechar {caixaParaFechar.nomeCaixa}
                </h3>
              </div>
              <button type="button" onClick={() => setCaixaParaFechar(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleFecharCaixaIndividual}>
              <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 10, marginBottom: 16, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: '#64748b' }}>Saldo Esperado em Gaveta:</span>
                  <strong style={{ fontSize: 15, color: '#0f172a' }}>{moeda(caixaParaFechar.valorEsperado)}</strong>
                </div>
                <small style={{ color: '#64748b' }}>
                  Abertura: {moeda(caixaParaFechar.valorAbertura)} · Recs: {moeda(caixaParaFechar.recebimentosDinheiro)} · Supr: {moeda(caixaParaFechar.suprimentos)} · Sang: {moeda(caixaParaFechar.sangrias)}
                </small>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#475569', marginBottom: 4, textTransform: 'uppercase' }}>
                  Valor Contado em Dinheiro Físico (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={valorContadoIndividual}
                  onChange={(e) => setValorContadoIndividual(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 16, fontWeight: 800 }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#475569', marginBottom: 4, textTransform: 'uppercase' }}>
                  Observação de Fechamento
                </label>
                <input
                  type="text"
                  placeholder="Ex: Turno manhã finalizado sem pendências"
                  value={obsCaixaIndividual}
                  onChange={(e) => setObsCaixaIndividual(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setCaixaParaFechar(null)}
                  style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={processandoFechamentoIndividual}
                  style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#b45309', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
                >
                  {processandoFechamentoIndividual ? 'Fechando...' : 'Confirmar Fechamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: ABRIR NOVO CAIXA ── */}
      {modalAbrirCaixa && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, maxWidth: 460, width: '100%', padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <PlusCircle size={20} color="#14b87a" />
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: '#0f172a' }}>
                  Abrir Novo Caixa Operacional
                </h3>
              </div>
              <button type="button" onClick={() => setModalAbrirCaixa(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAbrirNovoCaixa}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#475569', marginBottom: 4 }}>
                    Número
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={novoCaixaNumero}
                    onChange={(e) => setNovoCaixaNumero(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 700 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#475569', marginBottom: 4 }}>
                    Identificação / Nome
                  </label>
                  <input
                    type="text"
                    required
                    value={novoCaixaNome}
                    onChange={(e) => setNovoCaixaNome(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 700 }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#475569', marginBottom: 4 }}>
                  Fundo de Troco Inicial (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={novoCaixaValorAbertura}
                  onChange={(e) => setNovoCaixaValorAbertura(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 15, fontWeight: 800 }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#475569', marginBottom: 4 }}>
                  Operador Responsável
                </label>
                <input
                  type="text"
                  placeholder="Nome do operador de balcão"
                  value={novoCaixaOperador}
                  onChange={(e) => setNovoCaixaOperador(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setModalAbrirCaixa(false)}
                  style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={processandoAberturaCaixa}
                  style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#14b87a', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
                >
                  {processandoAberturaCaixa ? 'Abrindo...' : 'Abrir Caixa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: REABRIR FECHAMENTO ── */}
      {modalReabrir && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, maxWidth: 500, width: '100%', padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Unlock size={22} color="#dc2626" />
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#0f172a' }}>Reabrir Fechamento Diário</h3>
              </div>
              <button type="button" onClick={() => setModalReabrir(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleReabrirFechamento}>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: '#475569' }}>
                A reabertura remove o status de oficializado no ERP e permite fazer ajustes em comandas e caixas da data selecionada (<strong>{fmtDateOnly(dataSelecionada)}</strong>).
              </p>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#0f172a', fontWeight: 700, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={reabrirCaixasFisicos}
                    onChange={(e) => setReabrirCaixasFisicos(e.target.checked)}
                  />
                  <span>Reabrir também os caixas físicos operacionais fechados</span>
                </label>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#475569', marginBottom: 4, textTransform: 'uppercase' }}>
                  Motivo da Reabertura (Obrigatório)
                </label>
                <textarea
                  rows={2}
                  required
                  value={motivoReabertura}
                  onChange={(e) => setMotivoReabertura(e.target.value)}
                  placeholder="Ex: Ajuste de comanda faturada errada..."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, resize: 'none' }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#dc2626', marginBottom: 4, textTransform: 'uppercase' }}>
                  🔒 Senha de Gerente / Administrador
                </label>
                <input
                  type="password"
                  required
                  placeholder="Digite sua senha de autorização"
                  value={senhaGerenteReabertura}
                  onChange={(e) => setSenhaGerenteReabertura(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 700 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setModalReabrir(false)}
                  style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={processandoReabertura}
                  style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
                >
                  {processandoReabertura ? 'Reabrindo...' : 'Confirmar Reabertura'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL DE IMPRESSÃO / COMPROVANTE OFICIAL ── */}
      {modalImpressao && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, maxWidth: 600, width: '100%', padding: 24, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid #e2e8f0', paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Printer size={20} color="#2563eb" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Comprovante Oficial de Fechamento Diário</h3>
              </div>
              <button type="button" onClick={() => setModalImpressao(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>

            {/* Espelho do cupom impresso */}
            <div
              id="cupom-fechamento-print"
              style={{
                fontFamily: 'monospace',
                fontSize: 12,
                background: '#fafafa',
                padding: '20px 24px',
                borderRadius: 10,
                border: '1px dashed #cbd5e1',
                color: '#0f172a',
                lineHeight: 1.5,
              }}
            >
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <strong style={{ fontSize: 15, textTransform: 'uppercase' }}>{empresaAtualObj.nome}</strong>
                <div style={{ fontSize: 11, color: '#64748b' }}>RELATÓRIO CONSOLIDADO DE FECHAMENTO DIÁRIO</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>Data: {fmtDateOnly(dataSelecionada)} · Emissão: {new Date().toLocaleString('pt-BR')}</div>
              </div>

              <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: 10, marginBottom: 10 }}>
                <strong>1. RESUMO DE FATURAMENTO</strong>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Serviços Realizados ({kpis.totalServicos}):</span>
                  <strong>{moeda(kpis.valorServicos)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Produtos de Revenda ({kpis.totalProdutos}):</span>
                  <strong>{moeda(kpis.valorProdutos)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, borderTop: '1px solid #e2e8f0', paddingTop: 4 }}>
                  <strong>TOTAL FATURADO:</strong>
                  <strong>{moeda(kpis.faturamentoBruto)}</strong>
                </div>
              </div>

              <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: 10, marginBottom: 10 }}>
                <strong>2. MEIOS DE PAGAMENTO APURADOS</strong>
                {conciliacaoLinhas.filter((l) => l.tipo !== 'movimento_caixa').map((l) => (
                  <div key={l.chave} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{l.label}:</span>
                    <span>{moeda(l.operacao)}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, borderTop: '1px solid #e2e8f0', paddingTop: 4 }}>
                  <strong>TOTAL RECEBIDO LÍQUIDO:</strong>
                  <strong style={{ color: '#16a34a' }}>{moeda(kpis.totalRecebidoLiquido)}</strong>
                </div>
              </div>

              <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: 10, marginBottom: 10 }}>
                <strong>3. MOVIMENTAÇÕES DE GAVETA &amp; DESPESAS</strong>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Suprimentos de Fundo de Troco:</span>
                  <span>{moeda(conciliacaoLinhas.find((l) => l.chave === 'suprimentos')?.operacao)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Sangrias / Retiradas:</span>
                  <span style={{ color: '#dc2626' }}>{moeda(conciliacaoLinhas.find((l) => l.chave === 'sangrias')?.operacao)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Despesas Operacionais do Dia:</span>
                  <span style={{ color: '#dc2626' }}>{moeda(kpis.totalDespesasPagas)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, borderTop: '1px solid #e2e8f0', paddingTop: 4 }}>
                  <strong>RESULTADO LÍQUIDO DO DIA:</strong>
                  <strong style={{ color: kpis.saldoLiquidoDia >= 0 ? '#16a34a' : '#dc2626' }}>{moeda(kpis.saldoLiquidoDia)}</strong>
                </div>
              </div>

              <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: 24, marginTop: 20, display: 'flex', justifyContent: 'space-around', textAlign: 'center', fontSize: 10 }}>
                <div>
                  ____________________________________
                  <div style={{ marginTop: 4 }}>Assinatura do Operador</div>
                </div>
                <div>
                  ____________________________________
                  <div style={{ marginTop: 4 }}>Assinatura do Gerente</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button
                type="button"
                onClick={() => setModalImpressao(false)}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Printer size={16} />
                <span>Imprimir Agora</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
