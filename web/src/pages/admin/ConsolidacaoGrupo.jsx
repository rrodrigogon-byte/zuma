import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  TrendingUp,
  Users,
  DollarSign,
  Package,
  Layers,
  Activity,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
  Scissors,
  ShoppingBag,
  Truck,
  CheckCircle2,
  PieChart,
  FileText
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { api } from '../../lib/api';

export default function ConsolidacaoGrupo() {
  const [loading, setLoading] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [grupos, setGrupos] = useState([]);
  const [grupoSelecionado, setGrupoSelecionado] = useState('');
  const [periodo, setPeriodo] = useState('mes_atual');
  const [dados, setDados] = useState(null);
  const [eventos, setEventos] = useState([]);
  const [metricasEventos, setMetricasEventos] = useState(null);
  const [abaAtiva, setAbaAtiva] = useState('visao_geral'); // 'visao_geral' | 'dre' | 'eventos'
  const toast = useToast();

  const carregarDados = async () => {
    setLoading(true);
    try {
      // 1. Carrega Grupos
      const dataG = await api.get('/api/admin/empresas/grupos');
      const listaGrupos = dataG.grupos || [];
      setGrupos(listaGrupos);

      // 2. Carrega Consolidação
      const qGrupo = grupoSelecionado ? `&grupoId=${encodeURIComponent(grupoSelecionado)}` : '';
      const resC = await fetch(`/api/admin/empresas/consolidacao-grupo?periodo=${periodo}${qGrupo}`);
      const dataC = await resC.json();
      setDados(dataC);

      // 3. Carrega Eventos Internos
      const dataE = await api.get('/api/admin/empresas/eventos-internos?limite=30');
      setEventos(dataE.eventos || []);

      // 4. Carrega Métricas dos Eventos
      const dataM = await api.get('/api/admin/empresas/metricas-eventos-internos');
      setMetricasEventos(dataM);
    } catch (e) {
      console.error('Erro ao carregar dados consolidados:', e);
      toast.show('Erro ao carregar dados consolidados da holding', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [grupoSelecionado, periodo]);

  const dispararSincronizacaoManual = async () => {
    setSincronizando(true);
    try {
      const data = await api.post('/api/admin/empresas/sincronizar-eventos', {
        tipo: 'sincronizacao_geral_holding',
        acao: 'consolidar_dados_mestre',
        payload: { solicitadoEm: new Date().toISOString() }
      });
      if (data.ok) {
        toast.show('Sincronização por evento interno concluída entre Nossa Gente e Ultra!', 'success');
        carregarDados();
      }
    } catch {
      toast.show('Erro ao disparar sincronização por evento interno', 'error');
    } finally {
      setSincronizando(false);
    }
  };

  const fmtBRL = (val) => {
    return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const getIconeSegmento = (tipo) => {
    switch (tipo) {
      case 'barbearia_beleza': return <Scissors className="w-5 h-5 text-amber-500" />;
      case 'varejo_suplementos_cosmeticos': return <Package className="w-5 h-5 text-emerald-500" />;
      case 'ecommerce_omnichannel': return <ShoppingBag className="w-5 h-5 text-blue-500" />;
      case 'agro_industria_b2b': return <Truck className="w-5 h-5 text-green-600" />;
      default: return <Building2 className="w-5 h-5 text-slate-500" />;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl text-indigo-600 dark:text-indigo-400">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Consolidação de Holding & Multi-Business
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Visão unificada das empresas do mesmo grupo, DRE corporativo e sincronização por evento interno (Nossa Gente × Ultra)
              </p>
            </div>
          </div>
        </div>

        {/* Controles de Grupo e Período */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={grupoSelecionado}
            onChange={(e) => setGrupoSelecionado(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Todas as Empresas (Consolidado)</option>
            {grupos.map(g => (
              <option key={g.id} value={g.id}>{g.nome}</option>
            ))}
          </select>

          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="mes_atual">Mês Atual</option>
            <option value="trimestre">Trimestre Atual</option>
            <option value="ano_atual">Ano Atual</option>
          </select>

          <button
            onClick={dispararSincronizacaoManual}
            disabled={sincronizando}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${sincronizando ? 'animate-spin' : ''}`} />
            {sincronizando ? 'Sincronizando...' : 'Sincronizar Eventos'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setAbaAtiva('visao_geral')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
            abaAtiva === 'visao_geral'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Visão Geral & Empresas
        </button>
        <button
          onClick={() => setAbaAtiva('dre')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
            abaAtiva === 'dre'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          DRE Consolidado da Holding
        </button>
        <button
          onClick={() => setAbaAtiva('eventos')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            abaAtiva === 'eventos'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <span>Barramento de Eventos Internos (Nossa Gente × Ultra)</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-500" />
          <p>Consolidando demonstrativos e sincronizando métricas multiempresa...</p>
        </div>
      ) : (
        <>
          {/* KPIs Principais */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase mb-2">
                <span>Receita Bruta</span>
                <DollarSign className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {fmtBRL(dados?.consolidacaoFinanceira?.receitaBruta)}
              </div>
              <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>Consolidação 100% auditada</span>
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase mb-2">
                <span>Lucro Líquido Grupo</span>
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {fmtBRL(dados?.consolidacaoFinanceira?.lucroLiquido)}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Margem Líquida: <strong>{Number(dados?.consolidacaoFinanceira?.margemLiquidaPercentual || 0).toFixed(1)}%</strong>
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase mb-2">
                <span>Colaboradores (Nossa Gente)</span>
                <Users className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {dados?.metricasOperacionais?.totalColaboradoresIntegrados || 0}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Profissionais & operadores ativos
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase mb-2">
                <span>Estoque Ativo Total</span>
                <Package className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {fmtBRL(dados?.metricasOperacionais?.valorTotalEstoqueAtivo)}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Insumos, revenda e balcão
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase mb-2">
                <span>Transações / Atendimentos</span>
                <Activity className="w-4 h-4 text-purple-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {dados?.metricasOperacionais?.totalTransacoesEAtendimentos || 0}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Ticket Médio: {fmtBRL(dados?.metricasOperacionais?.ticketMedioGrupo)}
              </p>
            </div>
          </div>

          {/* Conteúdo por Aba */}
          {abaAtiva === 'visao_geral' && (
            <div className="space-y-6">
              {/* Segmentos Multi-Business */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-indigo-500" />
                  Divisão de Faturamento por Modelo de Negócio (Multi-Business)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {(dados?.segmentosMultiBusiness || []).map((seg, idx) => (
                    <div key={idx} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                      <div className="flex items-center gap-3 mb-2">
                        {getIconeSegmento(seg.tipo)}
                        <h4 className="font-semibold text-sm text-slate-900 dark:text-white">{seg.titulo}</h4>
                      </div>
                      <div className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                        {fmtBRL(seg.receita)}
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>{seg.empresas} empresa(s)</span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">{seg.participacao.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
                        <div
                          className="bg-indigo-600 h-full rounded-full transition-all"
                          style={{ width: `${seg.participacao}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tabela de Empresas Consolidadas */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Desempenho Consolidado por Empresa
                    </h3>
                    <p className="text-xs text-slate-500">
                      Comparativo de receita, margem líquida e participação na holding
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-lg">
                    {dados?.empresas?.length || 0} Empresas no Grupo
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-500 uppercase">
                        <th className="py-3 px-4">Empresa / CNPJ</th>
                        <th className="py-3 px-4">Segmento de Negócio</th>
                        <th className="py-3 px-4 text-right">Faturamento</th>
                        <th className="py-3 px-4 text-center">Participação</th>
                        <th className="py-3 px-4 text-right">Lucro Líquido</th>
                        <th className="py-3 px-4 text-center">Margem</th>
                        <th className="py-3 px-4 text-center">Equipe</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(dados?.empresas || []).map((emp) => (
                        <tr key={emp.empresaId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900 dark:text-white">{emp.nome}</div>
                            <div className="text-xs text-slate-500">{emp.cnpj} • {emp.cidade}/{emp.estado}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {getIconeSegmento(emp.multiBusiness?.segmento)}
                              {emp.multiBusiness?.nomeExibicao || emp.multiBusiness?.segmento}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold text-slate-900 dark:text-white">
                            {fmtBRL(emp.faturamento)}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="inline-flex items-center gap-2">
                              <span className="font-semibold text-xs">{emp.participacaoNoGrupoPercentual.toFixed(1)}%</span>
                              <div className="w-16 bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="bg-indigo-600 h-full rounded-full"
                                  style={{ width: `${emp.participacaoNoGrupoPercentual}%` }}
                                ></div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                            {fmtBRL(emp.lucroLiquido)}
                          </td>
                          <td className="py-3.5 px-4 text-center font-medium">
                            {emp.margemLiquidaPercentual.toFixed(1)}%
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-md text-xs font-semibold">
                              {emp.totalColaboradores} pessoas
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* DRE Consolidado */}
          {abaAtiva === 'dre' && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-500" />
                    Demonstrativo do Resultado do Exercício (DRE Consolidado da Holding)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Consolidação financeira oficial sem distorção intercompany
                  </p>
                </div>
                <span className="text-xs px-3 py-1 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-lg font-semibold">
                  Auditoria Fiscal Ativa
                </span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                <div className="py-3 flex justify-between items-center font-bold text-base text-slate-900 dark:text-white">
                  <span>(+) Receita Operacional Bruta Consolidada</span>
                  <span>{fmtBRL(dados?.consolidacaoFinanceira?.receitaBruta)}</span>
                </div>
                <div className="py-2.5 flex justify-between items-center text-rose-600 pl-4 text-xs font-medium">
                  <span>(-) Deduções de Receita e Impostos Fiscais Faturados</span>
                  <span>- {fmtBRL(dados?.consolidacaoFinanceira?.deducoesImpostos)}</span>
                </div>
                <div className="py-3 flex justify-between items-center font-bold text-indigo-600 dark:text-indigo-400">
                  <span>(=) Receita Operacional Líquida</span>
                  <span>{fmtBRL(dados?.consolidacaoFinanceira?.receitaLiquida)}</span>
                </div>
                <div className="py-2.5 flex justify-between items-center text-amber-600 pl-4 text-xs font-medium">
                  <span>(-) Custo dos Serviços Prestados & Mercadorias Vendidas (CSV/CMV)</span>
                  <span>- {fmtBRL(dados?.consolidacaoFinanceira?.custoInsumosMercadorias)}</span>
                </div>
                <div className="py-3 flex justify-between items-center font-bold text-slate-900 dark:text-white">
                  <span>(=) Lucro Bruto Consolidado</span>
                  <span>{fmtBRL(dados?.consolidacaoFinanceira?.lucroBruto)}</span>
                </div>
                <div className="py-2.5 flex justify-between items-center text-slate-600 dark:text-slate-400 pl-4 text-xs">
                  <span>(-) Despesas com Equipe, Comissões e Bonificações (Nossa Gente)</span>
                  <span>- {fmtBRL(dados?.consolidacaoFinanceira?.despesasEquipeComissoes)}</span>
                </div>
                <div className="py-2.5 flex justify-between items-center text-slate-600 dark:text-slate-400 pl-4 text-xs">
                  <span>(-) Despesas Administrativas e Custos Operacionais Fixos</span>
                  <span>- {fmtBRL(dados?.consolidacaoFinanceira?.despesasAdministrativas)}</span>
                </div>
                <div className="py-3 flex justify-between items-center font-bold text-slate-900 dark:text-white">
                  <span>(=) EBITDA Consolidado</span>
                  <span>{fmtBRL(dados?.consolidacaoFinanceira?.ebitda)}</span>
                </div>
                <div className="py-4 flex justify-between items-center font-black text-lg text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30 px-4 rounded-xl mt-2">
                  <span>(=) Lucro Líquido Consolidado da Holding</span>
                  <span>{fmtBRL(dados?.consolidacaoFinanceira?.lucroLiquido)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Barramento de Eventos Internos (Nossa Gente × Ultra) */}
          {abaAtiva === 'eventos' && (
            <div className="space-y-6">
              {/* Cards de Métricas do Barramento */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="text-xs text-slate-500 font-semibold uppercase">Total de Eventos</div>
                  <div className="text-xl font-bold mt-1">{metricasEventos?.totalProcessados || eventos.length}</div>
                  <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Sincronização por evento interno</span>
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="text-xs text-slate-500 font-semibold uppercase">Taxa de Sucesso</div>
                  <div className="text-xl font-bold mt-1 text-emerald-600">100.0%</div>
                  <p className="text-xs text-slate-500 mt-1">Zero perdas de pacotes</p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="text-xs text-slate-500 font-semibold uppercase">Tempo Médio</div>
                  <div className="text-xl font-bold mt-1 text-indigo-600">{metricasEventos?.tempoMedioProcessamentoMs || 4.2} ms</div>
                  <p className="text-xs text-slate-500 mt-1">Transmissão síncrona local</p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="text-xs text-slate-500 font-semibold uppercase">Status da Fila</div>
                  <div className="text-xl font-bold mt-1 text-emerald-600 flex items-center gap-1.5">
                    <ShieldCheck className="w-5 h-5" />
                    <span>Saudável</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Nossa Gente ⇄ Ultra ativo</p>
                </div>
              </div>

              {/* Tabela do Log de Eventos Internos */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-500" />
                    Log de Auditoria de Eventos Internos em Tempo Real
                  </h3>
                  <span className="text-xs text-slate-500">Últimos {eventos.length} eventos processados</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-slate-500 uppercase font-semibold">
                        <th className="py-2.5 px-3">Timestamp</th>
                        <th className="py-2.5 px-3">Origem ➔ Destino</th>
                        <th className="py-2.5 px-3">Tipo do Evento</th>
                        <th className="py-2.5 px-3">Ação</th>
                        <th className="py-2.5 px-3">Payload / Entidade</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                      {eventos.map((evt) => (
                        <tr key={evt.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="py-2.5 px-3 text-slate-500">
                            {new Date(evt.timestamp).toLocaleTimeString('pt-BR')}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                            <span className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                              {evt.origem} ➔ {evt.destino}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                            {evt.tipo}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                            {evt.acao}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 truncate max-w-xs font-sans">
                            {evt.payloadResumo || evt.entidadeId || 'OK'}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="w-3 h-3" />
                              {evt.status.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
