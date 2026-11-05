import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
} from 'lucide-react';

const moeda = (val) => fmtR(Number(val || 0));

function dataHojeStr() {
  const d = new Date();
  return d.toLocaleDateString('sv', { timeZone: 'America/Cuiaba' });
}

function dataOntemStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString('sv', { timeZone: 'America/Cuiaba' });
}

export default function FechamentoDiarioGestao() {
  const { user, empresaAtiva, lojaAtiva } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const isDino = isDinoBrandContext(empresaAtiva);
  const dataQuery = searchParams.get('data') || dataHojeStr();
  const [dataSelecionada, setDataSelecionada] = useState(dataQuery);
  const [carregando, setCarregando] = useState(true);
  const [dados, setDados] = useState(null);

  // Abas internas
  const [abaAtiva, setAbaAtiva] = useState('conciliacao'); // 'conciliacao' | 'caixas' | 'comandas' | 'historico'
  const [buscaComanda, setBuscaComanda] = useState('');

  // Modais
  const [modalFechamento, setModalFechamento] = useState(false);
  const [fecharCaixasAutomatico, setFecharCaixasAutomatico] = useState(true);
  const [obsFechamento, setObsFechamento] = useState('');
  const [senhaGerenteFechamento, setSenhaGerenteFechamento] = useState('');
  const [processandoFechamento, setProcessandoFechamento] = useState(false);

  const [modalReabrir, setModalReabrir] = useState(false);
  const [motivoReabertura, setMotivoReabertura] = useState('');
  const [senhaGerenteReabertura, setSenhaGerenteReabertura] = useState('');
  const [reabrirCaixasFisicos, setReabrirCaixasFisicos] = useState(true);
  const [processandoReabertura, setProcessandoReabertura] = useState(false);

  const [modalImpressao, setModalImpressao] = useState(false);

  // Carrega dados da conciliação da data selecionada
  const carregarDados = useCallback(async (dataAlvo) => {
    const dia = dataAlvo || dataSelecionada || dataHojeStr();
    try {
      setCarregando(true);
      const res = await api.get(`/api/admin/fechamento-diario/conciliacao?data=${dia}`);
      if (res && res.ok) {
        setDados(res);
      } else {
        // Fallback para rota barbearia se necessário
        const fallback = await api.get(`/api/admin/barbearia/operacao/fechamento-conciliacao?data=${dia}`);
        if (fallback && fallback.ok) setDados(fallback);
      }
    } catch (e) {
      console.error(e);
      toast(e.message || 'Erro ao carregar dados do fechamento diário e conciliação', 'error');
    } finally {
      setCarregando(false);
    }
  }, [dataSelecionada, toast]);

  useEffect(() => {
    carregarDados(dataSelecionada);
  }, [dataSelecionada, carregarDados]);

  const trocarData = (novaData) => {
    setDataSelecionada(novaData);
    setSearchParams({ data: novaData });
  };

  // Executa fechamento diário integrado
  const handleExecutarFechamento = async (e) => {
    e.preventDefault();
    try {
      setProcessandoFechamento(true);
      const payload = {
        confirmado: true,
        data: dataSelecionada,
        lojaId: lojaAtiva?.id || undefined,
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
        await carregarDados(dataSelecionada);
      }
    } catch (err) {
      toast(err.message || 'Erro ao realizar fechamento diário', 'error');
    } finally {
      setProcessandoFechamento(false);
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
        data: dataSelecionada,
        lojaId: lojaAtiva?.id || undefined,
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
        await carregarDados(dataSelecionada);
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
    if (!buscaComanda.trim()) return comandas;
    const q = buscaComanda.toLowerCase().trim();
    return comandas.filter((c) =>
      String(c.numeroComanda || '').includes(q) ||
      String(c.clienteNome || '').toLowerCase().includes(q) ||
      String(c.profissionalNome || '').toLowerCase().includes(q) ||
      String(c.itensResumo || '').toLowerCase().includes(q)
    );
  }, [comandas, buscaComanda]);

  const diaFechado = dados?.diaFechado || false;
  const statusGeral = dados?.statusGeral || 'conciliado';

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* ── CABEÇALHO PRINCIPAL ── */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--text, #0f172a)' }}>
                Fechamento Diário &amp; Conciliação ERP
              </h1>
              {diaFechado ? (
                <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Lock size={12} /> Dia Fechado Oficialmente
                </span>
              ) : (
                <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Unlock size={12} /> Dia em Operação (Prévia)
                </span>
              )}
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted, #64748b)' }}>
              {isDino ? 'Barbearia Dino' : (empresaAtiva?.nome || 'Kytto ERP')} &bull; Conciliação unificada entre a Operação de Caixa (Balcão/Gaveta/Comandas) e o Livro-Caixa / Razão Financeiro.
            </p>
          </div>
        </div>

        {/* ── SELETOR DE DATA E AÇÕES RÁPIDAS ── */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: 'var(--card, #fff)', border: '1px solid var(--line, #e2e8f0)', borderRadius: 10, padding: 3 }}>
            <button
              type="button"
              onClick={() => trocarData(dataHojeStr())}
              style={{
                border: 'none',
                background: dataSelecionada === dataHojeStr() ? '#2563eb' : 'transparent',
                color: dataSelecionada === dataHojeStr() ? '#fff' : 'inherit',
                fontWeight: 600,
                fontSize: 12,
                padding: '6px 12px',
                borderRadius: 7,
                cursor: 'pointer',
              }}
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => trocarData(dataOntemStr())}
              style={{
                border: 'none',
                background: dataSelecionada === dataOntemStr() ? '#2563eb' : 'transparent',
                color: dataSelecionada === dataOntemStr() ? '#fff' : 'inherit',
                fontWeight: 600,
                fontSize: 12,
                padding: '6px 12px',
                borderRadius: 7,
                cursor: 'pointer',
              }}
            >
              Ontem
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--card, #fff)', border: '1px solid var(--line, #e2e8f0)', borderRadius: 10, padding: '4px 10px' }}>
            <Calendar size={15} color="#64748b" />
            <input
              type="date"
              value={dataSelecionada}
              onChange={(e) => trocarData(e.target.value)}
              style={{ border: 'none', background: 'transparent', fontSize: 13, fontWeight: 600, color: 'inherit', outline: 'none' }}
            />
          </div>

          <button
            type="button"
            onClick={() => carregarDados(dataSelecionada)}
            disabled={carregando}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'var(--card, #fff)', border: '1px solid var(--line, #e2e8f0)', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            title="Atualizar dados do fechamento"
          >
            <RefreshCw size={14} style={{ animation: carregando ? 'spin 1s linear infinite' : 'none' }} /> Atualizar
          </button>

          <button
            type="button"
            onClick={() => setModalImpressao(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--card, #fff)', border: '1px solid var(--line, #e2e8f0)', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#0f172a', cursor: 'pointer' }}
            title="Imprimir Comprovante de Fechamento"
          >
            <Printer size={15} color="#2563eb" /> Imprimir Fechamento
          </button>

          <button
            type="button"
            onClick={() => navigate('/admin/barbearia-erp?area=operacao&tab=Caixa+e+fechamento')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--card, #fff)', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#334155', cursor: 'pointer' }}
            title="Ir para o Caixa do ERP da Barbearia"
          >
            💈 Abrir Caixa Barbearia
          </button>

          {diaFechado ? (
            <button
              type="button"
              onClick={() => setModalReabrir(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              <Unlock size={15} /> Reabrir Fechamento
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setModalFechamento(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)' }}
            >
              <Lock size={15} /> Fechar o Dia no ERP
            </button>
          )}
        </div>
      </div>

      {/* ── BANNER DE STATUS DA CONCILIAÇÃO ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          padding: '14px 18px',
          borderRadius: 12,
          marginBottom: 20,
          background: statusGeral === 'conciliado'
            ? 'linear-gradient(90deg, rgba(34,197,94,0.12), rgba(34,197,94,0.04))'
            : statusGeral === 'pendente'
            ? 'linear-gradient(90deg, rgba(245,158,11,0.12), rgba(245,158,11,0.04))'
            : 'linear-gradient(90deg, rgba(239,68,68,0.12), rgba(239,68,68,0.04))',
          border: `1px solid ${statusGeral === 'conciliado' ? '#86efac' : statusGeral === 'pendente' ? '#fde68a' : '#fca5a5'}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {statusGeral === 'conciliado' && <CheckCircle2 size={24} color="#16a34a" />}
          {statusGeral === 'pendente' && <AlertCircle size={24} color="#d97706" />}
          {statusGeral === 'divergente' && <AlertTriangle size={24} color="#dc2626" />}
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: statusGeral === 'conciliado' ? '#15803d' : statusGeral === 'pendente' ? '#b45309' : '#b91c1c' }}>
              {statusGeral === 'conciliado' && '✅ Operação de Caixa e ERP 100% Conciliados'}
              {statusGeral === 'pendente' && '🟡 Dia em Operação (Prévia em Tempo Real)'}
              {statusGeral === 'divergente' && '🔴 Divergência Identificada na Conciliação'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted, #64748b)', marginTop: 2 }}>
              {dados?.mensagemStatus || 'Conferência automática realizada entre as comandas faturadas e o Livro-Caixa do ERP.'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--muted, #64748b)', textTransform: 'uppercase', fontWeight: 600 }}>Divergência Total</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: kpis.totalDivergencias > 0 ? '#dc2626' : '#16a34a' }}>
              {moeda(kpis.totalDivergencias)}
            </div>
          </div>
          <div style={{ height: 28, width: 1, background: 'var(--line, #cbd5e1)' }} />
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--muted, #64748b)', textTransform: 'uppercase', fontWeight: 600 }}>Caixas Operados</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text, #0f172a)' }}>
              {kpis.caixasFechados} / {kpis.totalCaixas} fechados
            </div>
          </div>
        </div>
      </div>

      {/* ── KPIS DE GESTÃO CONSOLIDADA DA EMPRESA ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 24 }}>
        
        {/* Faturamento Bruto */}
        <div style={{ background: 'var(--card, #fff)', padding: '16px 18px', borderRadius: 12, border: '1px solid var(--line, #e2e8f0)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted, #64748b)', textTransform: 'uppercase' }}>Faturamento Bruto</span>
            <TrendingUp size={18} color="#2563eb" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>{moeda(kpis.faturamentoBruto)}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            ✂️ Serviços: {moeda(kpis.valorServicos)} ({kpis.totalServicos}) &bull; 🧴 Produtos: {moeda(kpis.valorProdutos)}
          </div>
        </div>

        {/* Total Recebido Líquido */}
        <div style={{ background: 'var(--card, #fff)', padding: '16px 18px', borderRadius: 12, border: '1px solid var(--line, #e2e8f0)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted, #64748b)', textTransform: 'uppercase' }}>Recebido Líquido</span>
            <ArrowDownRight size={18} color="#16a34a" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#16a34a' }}>{moeda(kpis.totalRecebidoLiquido)}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            Entradas no Balcão (Dinheiro + Pix + Cartões)
          </div>
        </div>

        {/* Faturado Em Conta */}
        <div style={{ background: 'var(--card, #fff)', padding: '16px 18px', borderRadius: 12, border: '1px solid var(--line, #e2e8f0)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted, #64748b)', textTransform: 'uppercase' }}>Lançado em Conta</span>
            <Receipt size={18} color="#f59e0b" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#b45309' }}>{moeda(kpis.totalEmConta)}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            Crediário a Receber de Clientes (Futuro)
          </div>
        </div>

        {/* Despesas Pagas */}
        <div style={{ background: 'var(--card, #fff)', padding: '16px 18px', borderRadius: 12, border: '1px solid var(--line, #e2e8f0)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted, #64748b)', textTransform: 'uppercase' }}>Despesas Pagas</span>
            <ArrowUpRight size={18} color="#dc2626" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#dc2626' }}>{moeda(kpis.totalDespesasPagas)}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            Saídas Operacionais pagas no dia
          </div>
        </div>

        {/* Saldo Líquido do Dia */}
        <div style={{ background: 'var(--card, #fff)', padding: '16px 18px', borderRadius: 12, border: '1px solid var(--line, #e2e8f0)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted, #64748b)', textTransform: 'uppercase' }}>Resultado Líquido</span>
            <DollarSign size={18} color={kpis.saldoLiquidoDia >= 0 ? '#16a34a' : '#dc2626'} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: kpis.saldoLiquidoDia >= 0 ? '#16a34a' : '#dc2626' }}>
            {moeda(kpis.saldoLiquidoDia)}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            Recebido Líquido &minus; Despesas Pagas
          </div>
        </div>

        {/* Comandas e Clientes */}
        <div style={{ background: 'var(--card, #fff)', padding: '16px 18px', borderRadius: 12, border: '1px solid var(--line, #e2e8f0)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted, #64748b)', textTransform: 'uppercase' }}>Comandas Fechadas</span>
            <Users size={18} color="#8b5cf6" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#6d28d9' }}>{kpis.comandasFechadas} / {kpis.totalComandas}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            {kpis.comandasAbertas > 0 ? `⚠️ ${kpis.comandasAbertas} ainda em aberto` : 'Todas as comandas finalizadas'}
          </div>
        </div>

      </div>

      {/* ── NAVEGAÇÃO DE ABAS DO MÓDULO ── */}
      <div style={{ display: 'flex', gap: 6, borderBottom: '2px solid var(--line, #e2e8f0)', marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => setAbaAtiva('conciliacao')}
          style={{
            padding: '10px 16px',
            border: 'none',
            background: 'transparent',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
            color: abaAtiva === 'conciliacao' ? '#2563eb' : 'var(--muted, #64748b)',
            borderBottom: abaAtiva === 'conciliacao' ? '2px solid #2563eb' : '2px solid transparent',
            marginBottom: -2,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          ⚖️ Conciliação Caixa ⟷ ERP
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva('caixas')}
          style={{
            padding: '10px 16px',
            border: 'none',
            background: 'transparent',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
            color: abaAtiva === 'caixas' ? '#2563eb' : 'var(--muted, #64748b)',
            borderBottom: abaAtiva === 'caixas' ? '2px solid #2563eb' : '2px solid transparent',
            marginBottom: -2,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          📦 Caixas Físicos da Data ({caixas.length})
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva('comandas')}
          style={{
            padding: '10px 16px',
            border: 'none',
            background: 'transparent',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
            color: abaAtiva === 'comandas' ? '#2563eb' : 'var(--muted, #64748b)',
            borderBottom: abaAtiva === 'comandas' ? '2px solid #2563eb' : '2px solid transparent',
            marginBottom: -2,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          🧾 Comandas Fechadas ({comandas.length})
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva('historico')}
          style={{
            padding: '10px 16px',
            border: 'none',
            background: 'transparent',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
            color: abaAtiva === 'historico' ? '#2563eb' : 'var(--muted, #64748b)',
            borderBottom: abaAtiva === 'historico' ? '2px solid #2563eb' : '2px solid transparent',
            marginBottom: -2,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          📜 Histórico de Fechamentos ({historico.length})
        </button>
      </div>

      {/* ── CONTEÚDO DA ABA 1: CONCILIAÇÃO CAIXA ⟷ ERP ── */}
      {abaAtiva === 'conciliacao' && (
        <div>
          <div style={{ background: 'var(--card, #fff)', borderRadius: 12, border: '1px solid var(--line, #e2e8f0)', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line, #e2e8f0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                  Matriz de Conciliação Financeira: Caixa Balcão ⟷ ERP Razão
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted, #64748b)' }}>
                  Comparativo meio a meio entre o apurado na operação da barbearia e os registros do Livro-Caixa do ERP.
                </p>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '4px 10px', borderRadius: 8 }}>
                Data: {fmtDateOnly(dataSelecionada)}
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: 12, textTransform: 'uppercase' }}>
                    <th style={{ padding: '12px 18px' }}>Forma de Pagamento / Movimentação</th>
                    <th style={{ padding: '12px 18px', textAlign: 'right' }}>Apurado no Caixa (Operação)</th>
                    <th style={{ padding: '12px 18px', textAlign: 'right' }}>Registrado no ERP (Financeiro)</th>
                    <th style={{ padding: '12px 18px', textAlign: 'right' }}>Divergência</th>
                    <th style={{ padding: '12px 18px', textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {conciliacaoLinhas.map((linha) => {
                    const temBandeiras = linha.bandeiras && Object.keys(linha.bandeiras).length > 0;
                    return (
                      <React.Fragment key={linha.chave}>
                        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '14px 18px', fontWeight: 600, color: '#0f172a' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {linha.chave === 'dinheiro' && <DollarSign size={16} color="#16a34a" />}
                              {linha.chave === 'pix' && <Zap size={16} color="#06b6d4" />}
                              {(linha.chave === 'cartao_debito' || linha.chave === 'cartao_credito') && <CreditCard size={16} color="#3b82f6" />}
                              {linha.chave === 'conta' && <Receipt size={16} color="#f59e0b" />}
                              {linha.chave === 'sangrias' && <ArrowUpRight size={16} color="#dc2626" />}
                              {linha.chave === 'suprimentos' && <ArrowDownRight size={16} color="#10b981" />}
                              <span>{linha.label}</span>
                            </div>
                            {linha.chave === 'dinheiro' && linha.esperadoGaveta != null && (
                              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, marginLeft: 24 }}>
                                Saldo esperado gaveta: <strong>{moeda(linha.esperadoGaveta)}</strong>
                                {linha.informadoGaveta > 0 && ` · Contado no fechamento: ${moeda(linha.informadoGaveta)}`}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                            {moeda(linha.operacao)}
                          </td>
                          <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                            {moeda(linha.erp)}
                          </td>
                          <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 700, color: linha.diferenca !== 0 ? '#dc2626' : '#16a34a' }}>
                            {moeda(linha.diferenca)}
                          </td>
                          <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                            {linha.status === 'conciliado' ? (
                              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: '#dcfce7', color: '#15803d' }}>
                                ✅ Conciliado
                              </span>
                            ) : (
                              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: '#fee2e2', color: '#b91c1c' }}>
                                ⚠️ Divergente
                              </span>
                            )}
                          </td>
                        </tr>

                        {/* Detalhamento de bandeiras de cartão caso existam */}
                        {temBandeiras && Object.entries(linha.bandeiras).map(([bandeira, valor]) => (
                          <tr key={`${linha.chave}-${bandeira}`} style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9', fontSize: 12 }}>
                            <td style={{ padding: '8px 18px 8px 44px', color: '#64748b' }}>
                              &bull; Bandeira <strong>{bandeira}</strong>
                            </td>
                            <td style={{ padding: '8px 18px', textAlign: 'right', color: '#475569' }}>
                              {moeda(valor)}
                            </td>
                            <td style={{ padding: '8px 18px', textAlign: 'right', color: '#475569' }}>
                              {moeda(valor)}
                            </td>
                            <td style={{ padding: '8px 18px', textAlign: 'right', color: '#16a34a' }}>
                              {moeda(0)}
                            </td>
                            <td style={{ padding: '8px 18px', textAlign: 'center' }}>
                              <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 600 }}>100% TEF</span>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#f1f5f9', fontWeight: 800, borderTop: '2px solid #cbd5e1' }}>
                    <td style={{ padding: '14px 18px', color: '#0f172a' }}>TOTAL FATURAMENTO OPERACIONAL</td>
                    <td style={{ padding: '14px 18px', textAlign: 'right', color: '#0f172a' }}>{moeda(kpis.faturamentoBruto)}</td>
                    <td style={{ padding: '14px 18px', textAlign: 'right', color: '#0f172a' }}>{moeda(kpis.faturamentoBruto)}</td>
                    <td style={{ padding: '14px 18px', textAlign: 'right', color: kpis.totalDivergencias > 0 ? '#dc2626' : '#16a34a' }}>
                      {moeda(kpis.totalDivergencias)}
                    </td>
                    <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                      {kpis.totalDivergencias === 0 ? (
                        <span style={{ fontSize: 12, fontWeight: 800, color: '#15803d' }}>100% OK</span>
                      ) : (
                        <span style={{ fontSize: 12, fontWeight: 800, color: '#b91c1c' }}>VERIFICAR</span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── CONTEÚDO DA ABA 2: CAIXAS FÍSICOS DA DATA ── */}
      {abaAtiva === 'caixas' && (
        <div>
          {caixas.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', background: 'var(--card, #fff)', borderRadius: 12, border: '1px solid var(--line, #e2e8f0)', color: 'var(--muted, #64748b)' }}>
              📦 Nenhum caixa físico foi aberto nesta data ({fmtDateOnly(dataSelecionada)}).
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
              {caixas.map((c) => (
                <div
                  key={c.id}
                  style={{
                    background: 'var(--card, #fff)',
                    borderRadius: 12,
                    border: `1px solid ${c.status === 'aberto' ? '#3b82f6' : '#cbd5e1'}`,
                    padding: 20,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a' }}>
                        {c.nomeCaixa} (Caixa {c.numeroCaixa})
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                        👤 Operador: <strong>{c.responsavel}</strong>
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 6,
                        background: c.status === 'aberto' ? '#dbeafe' : '#f1f5f9',
                        color: c.status === 'aberto' ? '#1e40af' : '#475569',
                      }}
                    >
                      {c.status === 'aberto' ? '🟢 Aberto' : '🔒 Fechado'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: '#f8fafc', padding: 12, borderRadius: 8, fontSize: 13, marginBottom: 14 }}>
                    <div>Fundo Abertura: <strong>{moeda(c.valorAbertura)}</strong></div>
                    <div>Recebido Dinheiro: <strong style={{ color: '#16a34a' }}>{moeda(c.recebimentosDinheiro)}</strong></div>
                    <div>Suprimentos: <strong style={{ color: '#10b981' }}>{moeda(c.suprimentos)}</strong></div>
                    <div>Sangrias: <strong style={{ color: '#dc2626' }}>{moeda(c.sangrias)}</strong></div>
                  </div>

                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14 }}>
                    <span style={{ fontWeight: 600, color: '#475569' }}>Saldo Esperado na Gaveta:</span>
                    <strong style={{ fontSize: 16, color: '#0f172a' }}>{moeda(c.valorEsperado)}</strong>
                  </div>

                  {c.status === 'fechado' && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, marginTop: 6, color: c.quebraCaixa !== 0 ? '#dc2626' : '#16a34a' }}>
                      <span>Valor Informado: <strong>{moeda(c.valorInformado)}</strong></span>
                      <span>Diferença: <strong>{moeda(c.quebraCaixa)}</strong></span>
                    </div>
                  )}

                  <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => navigate('/admin/barbearia-erp?area=operacao&tab=Caixa+e+fechamento')}
                      style={{ flex: 1, padding: '8px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#1e293b', cursor: 'pointer' }}
                    >
                      Ver Detalhes Padrão Avec &rarr;
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── CONTEÚDO DA ABA 3: COMANDAS FECHADAS ── */}
      {abaAtiva === 'comandas' && (
        <div style={{ background: 'var(--card, #fff)', borderRadius: 12, border: '1px solid var(--line, #e2e8f0)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line, #e2e8f0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Comandas da Data ({comandasFiltradas.length})</h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted, #64748b)' }}>
                Todas as comandas faturadas ou em aberto vinculadas à data do fechamento.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '4px 10px', width: 280 }}>
              <Search size={14} color="#64748b" />
              <input
                type="text"
                placeholder="Buscar cliente, profissional, item..."
                value={buscaComanda}
                onChange={(e) => setBuscaComanda(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 12, width: '100%' }}
              />
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: 12 }}>
                  <th style={{ padding: '10px 16px' }}>Comanda</th>
                  <th style={{ padding: '10px 16px' }}>Cliente</th>
                  <th style={{ padding: '10px 16px' }}>Profissional</th>
                  <th style={{ padding: '10px 16px' }}>Itens Executados</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right' }}>Total</th>
                  <th style={{ padding: '10px 16px' }}>Meio de Pagamento</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {comandasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ padding: 30, textAlign: 'center', color: '#64748b' }}>
                      Nenhuma comanda encontrada para os critérios selecionados.
                    </td>
                  </tr>
                ) : (
                  comandasFiltradas.map((c) => (
                    <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a' }}>
                        Nº {c.numeroComanda || String(c.id).slice(-4)}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600 }}>{c.clienteNome}</div>
                        {c.clienteTelefone && <div style={{ fontSize: 11, color: '#64748b' }}>{c.clienteTelefone}</div>}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#475569' }}>
                        {c.profissionalNome}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#334155', maxWidth: 300 }}>
                        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.itensResumo}>
                          {c.itensResumo || `${c.itensQuantidade || 0} itens`}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                        {moeda(c.totalFaturado || c.total)}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {(c.pagamentos || []).map((p, idx) => (
                          <span
                            key={idx}
                            style={{
                              display: 'inline-block',
                              fontSize: 11,
                              fontWeight: 600,
                              padding: '2px 6px',
                              borderRadius: 4,
                              background: '#e2e8f0',
                              color: '#1e293b',
                              marginRight: 4,
                            }}
                          >
                            {p.meio?.toUpperCase()} ({moeda(p.valor)})
                          </span>
                        ))}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: c.status === 'paga' ? '#dcfce7' : c.status === 'em_conta' ? '#fef3c7' : '#f1f5f9',
                            color: c.status === 'paga' ? '#15803d' : c.status === 'em_conta' ? '#b45309' : '#475569',
                          }}
                        >
                          {c.status?.toUpperCase()}
                        </span>
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
        <div style={{ background: 'var(--card, #fff)', borderRadius: 12, border: '1px solid var(--line, #e2e8f0)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line, #e2e8f0)' }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Histórico de Fechamentos Auditados ({historico.length})</h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted, #64748b)' }}>
              Registros históricos de encerramento do dia gravados no Financeiro Central do ERP.
            </p>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: 12 }}>
                  <th style={{ padding: '10px 16px' }}>Data Fechamento</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right' }}>Recebido</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right' }}>Pago (Despesas)</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right' }}>Saldo Líquido</th>
                  <th style={{ padding: '10px 16px' }}>Responsável</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center' }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {historico.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ padding: 30, textAlign: 'center', color: '#64748b' }}>
                      Nenhum fechamento registrado no histórico ainda.
                    </td>
                  </tr>
                ) : (
                  historico.map((f) => (
                    <tr key={f.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700 }}>
                        {fmtDateOnly(f.data)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                        {moeda(f.recebimentos ?? f.totais?.recebido)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>
                        {moeda(f.pagamentos ?? f.totais?.pago)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                        {moeda(f.saldoDia ?? (Number(f.recebimentos || 0) - Number(f.pagamentos || 0)))}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#475569' }}>
                        {f.responsavel}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => trocarData(String(f.data).slice(0, 10))}
                          style={{
                            padding: '4px 10px',
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            color: '#2563eb',
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

      {/* ── MODAL: EXECUTAR FECHAMENTO DIÁRIO INTEGRADO ── */}
      {modalFechamento && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 540, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(135deg, #10b981, #059669)', padding: '18px 24px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Lock size={20} />
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Fechamento Diário Integrado</h3>
              </div>
              <button type="button" onClick={() => setModalFechamento(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleExecutarFechamento} style={{ padding: '20px 24px' }}>
              <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: 16, fontSize: 13 }}>
                <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
                  Data do Fechamento: {fmtDateOnly(dataSelecionada)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, color: '#475569' }}>
                  <div>Faturamento Total: <strong>{moeda(kpis.faturamentoBruto)}</strong></div>
                  <div>Recebido Líquido: <strong style={{ color: '#16a34a' }}>{moeda(kpis.totalRecebidoLiquido)}</strong></div>
                  <div>Lançado em Conta: <strong>{moeda(kpis.totalEmConta)}</strong></div>
                  <div>Despesas Pagas: <strong style={{ color: '#dc2626' }}>{moeda(kpis.totalDespesasPagas)}</strong></div>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#1e293b', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={fecharCaixasAutomatico}
                    onChange={(e) => setFecharCaixasAutomatico(e.target.checked)}
                  />
                  <span>Fechar automaticamente todos os caixas operacionais abertos com o saldo conferido</span>
                </label>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Observações do Fechamento (Opcional):
                </label>
                <textarea
                  rows={2}
                  value={obsFechamento}
                  onChange={(e) => setObsFechamento(e.target.value)}
                  placeholder="Ex.: Fechamento sem divergências, troco de gaveta conferido."
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: 18, background: '#fef3c7', padding: '12px 14px', borderRadius: 8, border: '1px solid #fde68a' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#b45309', marginBottom: 6 }}>
                  <ShieldCheck size={16} /> Trava de Segurança: Senha de Gerente
                </div>
                <input
                  type="password"
                  placeholder="Digite a senha de gerente ou administrador..."
                  value={senhaGerenteFechamento}
                  onChange={(e) => setSenhaGerenteFechamento(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d97706', fontSize: 13, boxSizing: 'border-box' }}
                />
                <small style={{ color: '#92400e', fontSize: 11, marginTop: 4, display: 'block' }}>
                  Apenas usuários com perfil de Gerente ou Administrador podem oficializar o fechamento do dia.
                </small>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setModalFechamento(false)}
                  style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={processandoFechamento}
                  style={{ padding: '8px 20px', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  {processandoFechamento ? 'Processando...' : 'Confirmar e Fechar o Dia'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: REABRIR FECHAMENTO DIÁRIO ── */}
      {modalReabrir && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
            <div style={{ background: '#f59e0b', padding: '18px 24px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Unlock size={20} />
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Reabrir Fechamento do Dia</h3>
              </div>
              <button type="button" onClick={() => setModalReabrir(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleReabrirFechamento} style={{ padding: '20px 24px' }}>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
                Esta ação cancela o fechamento oficial do dia <strong>{fmtDateOnly(dataSelecionada)}</strong> no Livro-Caixa e permite realizar novas movimentações, correções de comandas ou estornos.
              </p>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#1e293b', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={reabrirCaixasFisicos}
                    onChange={(e) => setReabrirCaixasFisicos(e.target.checked)}
                  />
                  <span>Reabrir também os caixas operacionais fechados nesta data</span>
                </label>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Motivo da Reabertura (Obrigatório):
                </label>
                <input
                  type="text"
                  required
                  value={motivoReabertura}
                  onChange={(e) => setMotivoReabertura(e.target.value)}
                  placeholder="Ex.: Correção de valor de comanda ou inclusão de item"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: 18, background: '#fee2e2', padding: '12px 14px', borderRadius: 8, border: '1px solid #fca5a5' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#b91c1c', marginBottom: 6 }}>
                  <ShieldCheck size={16} /> Senha de Gerente Obrigatória
                </div>
                <input
                  type="password"
                  required
                  placeholder="Digite sua senha de gerente..."
                  value={senhaGerenteReabertura}
                  onChange={(e) => setSenhaGerenteReabertura(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #dc2626', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setModalReabrir(false)}
                  style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={processandoReabertura}
                  style={{ padding: '8px 20px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  {processandoReabertura ? 'Reabrindo...' : 'Confirmar Reabertura'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL DE IMPRESSÃO: COMPROVANTE OFICIAL DE FECHAMENTO ── */}
      {modalImpressao && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Printer size={18} color="#2563eb" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Comprovante Oficial de Fechamento Diário</h3>
              </div>
              <button type="button" onClick={() => setModalImpressao(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} color="#64748b" />
              </button>
            </div>

            {/* ÁREA IMPRIMÍVEL */}
            <div id="area-impressao-fechamento" style={{ padding: '24px 28px', color: '#0f172a', fontFamily: 'monospace, sans-serif' }}>
              <div style={{ textAlign: 'center', borderBottom: '2px dashed #94a3b8', paddingBottom: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 18, fontWeight: 800, textTransform: 'uppercase' }}>
                  {isDino ? 'BARBEARIA DINO' : (empresaAtiva?.nome || 'KYTTO ERP')}
                </div>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                  RELATÓRIO CONSOLIDADO DE FECHAMENTO DIÁRIO
                </div>
                <div style={{ fontSize: 12, color: '#475569' }}>
                  Data: <strong>{fmtDateOnly(dataSelecionada)}</strong> &bull; Emissão: {new Date().toLocaleString('pt-BR')}
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontWeight: 800, fontSize: 13, borderBottom: '1px solid #cbd5e1', paddingBottom: 4, marginBottom: 6 }}>
                  1. RESUMO DE FATURAMENTO
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span>Serviços Realizados ({kpis.totalServicos}):</span>
                  <strong>{moeda(kpis.valorServicos)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span>Produtos de Revenda ({kpis.totalProdutos}):</span>
                  <strong>{moeda(kpis.valorProdutos)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 800, borderTop: '1px solid #e2e8f0', marginTop: 4, paddingTop: 4 }}>
                  <span>TOTAL FATURADO:</span>
                  <span>{moeda(kpis.faturamentoBruto)}</span>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontWeight: 800, fontSize: 13, borderBottom: '1px solid #cbd5e1', paddingBottom: 4, marginBottom: 6 }}>
                  2. MEIOS DE PAGAMENTO APURADOS
                </div>
                {conciliacaoLinhas.filter(l => l.tipo !== 'movimento_caixa').map((l) => (
                  <div key={l.chave} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                    <span>{l.label}:</span>
                    <strong>{moeda(l.operacao)}</strong>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 800, borderTop: '1px solid #e2e8f0', marginTop: 4, paddingTop: 4 }}>
                  <span>TOTAL RECEBIDO LÍQUIDO:</span>
                  <span>{moeda(kpis.totalRecebidoLiquido)}</span>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontWeight: 800, fontSize: 13, borderBottom: '1px solid #cbd5e1', paddingBottom: 4, marginBottom: 6 }}>
                  3. MOVIMENTAÇÕES DE GAVETA &amp; DESPESAS
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span>Suprimentos de Fundo de Troco:</span>
                  <strong>{moeda(conciliacaoLinhas.find(l => l.chave === 'suprimentos')?.operacao || 0)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span>Sangrias / Retiradas:</span>
                  <strong style={{ color: '#dc2626' }}>{moeda(conciliacaoLinhas.find(l => l.chave === 'sangrias')?.operacao || 0)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span>Despesas Operacionais do Dia:</span>
                  <strong style={{ color: '#dc2626' }}>{moeda(kpis.totalDespesasPagas)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 800, borderTop: '1px solid #e2e8f0', marginTop: 4, paddingTop: 4 }}>
                  <span>RESULTADO LÍQUIDO DO DIA:</span>
                  <span style={{ color: kpis.saldoLiquidoDia >= 0 ? '#16a34a' : '#dc2626' }}>{moeda(kpis.saldoLiquidoDia)}</span>
                </div>
              </div>

              <div style={{ marginTop: 30, borderTop: '1px solid #94a3b8', paddingTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, textAlign: 'center', fontSize: 11 }}>
                <div>
                  <div style={{ borderBottom: '1px solid #334155', height: 24, marginBottom: 4 }} />
                  <div>Assinatura do Operador</div>
                </div>
                <div>
                  <div style={{ borderBottom: '1px solid #334155', height: 24, marginBottom: 4 }} />
                  <div>Assinatura do Gerente</div>
                </div>
              </div>
            </div>

            <div style={{ padding: '16px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setModalImpressao(false)}
                style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                style={{ padding: '8px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Printer size={15} /> Imprimir Agora
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
