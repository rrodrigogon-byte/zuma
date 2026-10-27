import React, { useState } from 'react';
import { Download, RefreshCw, Sparkles, Filter, Users, TrendingUp, DollarSign, Calendar, Clock, ChevronDown, ChevronUp, UserCheck, Activity } from 'lucide-react';

const RelatorioClientesAtendidos = () => {
  const [dataInicio, setDataInicio] = useState('2026-10-01');
  const [dataFim, setDataFim] = useState('2026-10-26');
  const [profissionalFilter, setProfissionalFilter] = useState('ALL');
  const [expandedRow, setExpandedRow] = useState(null);

  // Dados mockados ultra ricos
  const clientes = [
    { 
      id: 1, nome: 'João Silva', celular: '(65) 99999-1111', qtdVisitas: 3, totalGasto: 150.00, ticketMedio: 50.00, servicosMaisFeitos: 'Corte Adulto', perfil: 'Sempre Vip', status: 'Ativo',
      historico: [
        { data: '05/10/2026', hora: '14:30', servico: 'Corte Adulto', valor: 50.00, barbeiro: 'Gustavo Henrique' },
        { data: '15/10/2026', hora: '10:00', servico: 'Corte Adulto', valor: 50.00, barbeiro: 'Gustavo Henrique' },
        { data: '25/10/2026', hora: '16:00', servico: 'Corte Adulto', valor: 50.00, barbeiro: 'Gustavo Henrique' }
      ]
    },
    { 
      id: 2, nome: 'Marcos Paulo', celular: '(65) 98888-2222', qtdVisitas: 1, totalGasto: 80.00, ticketMedio: 80.00, servicosMaisFeitos: 'Corte + Barba', perfil: 'Foco Estética', status: 'Novo',
      historico: [
        { data: '12/10/2026', hora: '11:00', servico: 'Corte + Barba', valor: 80.00, barbeiro: 'Guilherme Cunha' }
      ]
    },
    { 
      id: 3, nome: 'Carlos Eduardo', celular: '(65) 97777-3333', qtdVisitas: 4, totalGasto: 240.00, ticketMedio: 60.00, servicosMaisFeitos: 'Corte Infantil', perfil: 'Pai & Filho', status: 'Ativo',
      historico: []
    }
  ];

  const toggleRow = (id) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  return (
    <div className="p-6 bg-[#f4f7fb] min-h-screen text-gray-800 font-sans">
      {/* Header Premium */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2 py-0.5 rounded-full">DINO INTELLIGENCE</span>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Módulo de Operações</span>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Tráfego & Clientes Atendidos</h1>
          <p className="text-gray-500 mt-1">Visão completa de quem frequentou sua barbearia, perfis e faturamento individual.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button className="flex-1 md:flex-none flex justify-center items-center px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm font-medium hover:bg-gray-50 transition">
            <RefreshCw className="w-4 h-4 mr-2 text-gray-500" /> Atualizar
          </button>
          <button className="flex-1 md:flex-none flex justify-center items-center px-4 py-2 bg-gray-900 text-white rounded-lg shadow-sm font-medium hover:bg-gray-800 transition">
            <Download className="w-4 h-4 mr-2" /> Exportar Dados (CSV)
          </button>
        </div>
      </div>

      {/* AI Insight Card Moderno */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-2xl p-6 mb-8 shadow-lg text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-indigo-500 opacity-10 blur-3xl"></div>
        <div className="flex items-start gap-5 relative z-10">
          <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm border border-white/10 flex-shrink-0">
            <Sparkles className="w-8 h-8 text-indigo-300" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-xl font-bold text-white">Resumo Operacional IA</h3>
              <span className="bg-blue-500/20 text-blue-300 text-xs font-bold px-2 py-0.5 rounded border border-blue-500/30">Crescimento Saudável</span>
            </div>
            <p className="text-gray-300 leading-relaxed text-lg mb-4">
              O fluxo de clientes subiu <strong className="text-white">12%</strong> este mês. <strong>Corte + Barba</strong> representou 45% do faturamento total. 
              Temos <strong>30 clientes</strong> que já vieram mais de 3 vezes (hiperativos). Deseja convertê-los para o Clube de Assinaturas?
            </p>
            <div className="flex flex-wrap gap-3 mt-2">
              <button className="bg-indigo-500 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-indigo-600 transition shadow-sm flex items-center">
                <Sparkles className="w-4 h-4 mr-2" /> Gerar Campanha de Conversão para o Clube
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros em Grid Kytto */}
      <div className="bg-white rounded-xl p-1 mb-8 shadow-sm border border-gray-200/60">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 rounded-t-xl flex items-center">
          <Filter className="w-5 h-5 mr-2 text-indigo-500" /> 
          <h3 className="font-bold text-gray-800">Parâmetros do Relatório</h3>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-bold text-gray-700 mb-2">Período de Atendimento</label>
            <div className="flex gap-2 items-center">
              <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="w-full bg-gray-50 border-gray-200 rounded-lg shadow-sm p-2.5 border focus:ring-2 focus:ring-indigo-500 outline-none transition" />
              <span className="text-gray-400 font-medium">até</span>
              <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="w-full bg-gray-50 border-gray-200 rounded-lg shadow-sm p-2.5 border focus:ring-2 focus:ring-indigo-500 outline-none transition" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Filtro por Barbeiro</label>
            <select value={profissionalFilter} onChange={e => setProfissionalFilter(e.target.value)} className="w-full bg-gray-50 border-gray-200 rounded-lg shadow-sm p-2.5 border focus:ring-2 focus:ring-indigo-500 outline-none transition">
              <option value="ALL">Visualizar Todos</option>
              <option value="1">Gustavo Henrique</option>
              <option value="2">Guilherme Cunha</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Buscar Cliente</label>
            <input type="text" placeholder="Nome ou telefone..." className="w-full bg-gray-50 border-gray-200 rounded-lg shadow-sm p-2.5 border focus:ring-2 focus:ring-indigo-500 outline-none transition" />
          </div>
        </div>
      </div>

      {/* Mini-Dash de KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Clientes Únicos', value: '342', meta: '+12% vs Mês Anterior', icon: <Users className="w-6 h-6 text-blue-600"/>, color: 'text-gray-900', bg: 'bg-blue-50' },
          { label: 'Total de Atendimentos', value: '458', meta: 'Média de 1.3/cliente', icon: <Activity className="w-6 h-6 text-indigo-600"/>, color: 'text-gray-900', bg: 'bg-indigo-50' },
          { label: 'Ticket Médio Global', value: 'R$ 68,50', meta: 'Estável', icon: <TrendingUp className="w-6 h-6 text-emerald-600"/>, color: 'text-gray-900', bg: 'bg-emerald-50' },
          { label: 'Faturamento Total', value: 'R$ 31.373', meta: '+5% vs Mês Anterior', icon: <DollarSign className="w-6 h-6 text-amber-600"/>, color: 'text-gray-900', bg: 'bg-amber-50' }
        ].map((kpi, idx) => (
          <div key={idx} className="bg-white rounded-xl p-5 shadow-sm border border-gray-200/60 relative overflow-hidden group hover:border-gray-300 transition">
            <div className={`absolute top-0 right-0 p-3 rounded-bl-2xl ${kpi.bg}`}>
              {kpi.icon}
            </div>
            <p className="text-sm font-bold text-gray-500 mb-1">{kpi.label}</p>
            <p className={`text-3xl font-extrabold ${kpi.color} mb-2`}>{kpi.value}</p>
            <p className="text-xs font-semibold text-gray-400">{kpi.meta}</p>
          </div>
        ))}
      </div>

      {/* Tabela de Dados com Drill-down */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200/60 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h3 className="font-bold text-gray-800">Listagem Analítica</h3>
          <span className="text-xs font-semibold text-gray-500">Mostrando {clientes.length} resultados de 342</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-white">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Cliente (Perfil)</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Métricas de Frequência</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Consumo (R$)</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Serviço Principal</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Histórico (Visões)</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {clientes.map(cli => (
                <React.Fragment key={cli.id}>
                  <tr className={`hover:bg-gray-50 transition ${expandedRow === cli.id ? 'bg-indigo-50/20' : ''}`}>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center text-indigo-700 font-bold border border-indigo-200">
                          {cli.nome.charAt(0)}
                        </div>
                        <div className="ml-4">
                          <div className="text-base font-bold text-gray-900 flex items-center gap-2">
                            {cli.nome}
                            {cli.status === 'Novo' && <span className="bg-green-100 text-green-800 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">Novo</span>}
                          </div>
                          <div className="text-sm text-gray-500">{cli.celular} • <span className="text-indigo-600 font-medium">{cli.perfil}</span></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 inline-flex text-sm font-bold rounded-lg ${cli.qtdVisitas > 2 ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-800'}`}>
                          {cli.qtdVisitas} {cli.qtdVisitas === 1 ? 'Visita' : 'Visitas'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="text-base font-bold text-gray-900">R$ {cli.totalGasto.toFixed(2)}</div>
                      <div className="text-xs font-medium text-gray-400">TM: R$ {cli.ticketMedio.toFixed(2)}</div>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap text-sm font-medium text-gray-600">
                      {cli.servicosMaisFeitos}
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap text-right">
                      <button 
                        onClick={() => toggleRow(cli.id)}
                        className={`inline-flex items-center justify-center px-4 py-2 border rounded-lg text-sm font-bold transition ${expandedRow === cli.id ? 'bg-indigo-100 border-indigo-200 text-indigo-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                      >
                        {expandedRow === cli.id ? 'Fechar Timeline' : 'Ver Timeline'}
                        {expandedRow === cli.id ? <ChevronUp className="w-4 h-4 ml-2" /> : <ChevronDown className="w-4 h-4 ml-2" />}
                      </button>
                    </td>
                  </tr>
                  
                  {/* Linha Expandida: Timeline de Visitas */}
                  {expandedRow === cli.id && (
                    <tr>
                      <td colSpan="5" className="px-0 py-0 border-b border-gray-200 bg-gray-50/50">
                        <div className="px-10 py-6 border-l-4 border-indigo-500 bg-white shadow-inner">
                          <div className="flex justify-between items-center mb-5">
                            <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center">
                              <Calendar className="w-4 h-4 mr-2 text-indigo-500" />
                              Timeline de Serviços ({cli.qtdVisitas} neste período)
                            </h4>
                            <button className="text-indigo-600 hover:text-indigo-900 text-sm font-bold underline flex items-center">
                              Abrir Cliente 360 Completo
                            </button>
                          </div>

                          {cli.historico.length > 0 ? (
                            <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent">
                              {cli.historico.map((hist, idx) => (
                                <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                  {/* Ponto central na timeline */}
                                  <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-indigo-100 text-indigo-600 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 relative z-10">
                                    <Clock className="w-4 h-4" />
                                  </div>
                                  
                                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition">
                                    <div className="flex justify-between items-start mb-1">
                                      <div className="font-bold text-gray-800 text-base">{hist.servico}</div>
                                      <div className="font-bold text-green-600">R$ {hist.valor.toFixed(2)}</div>
                                    </div>
                                    <div className="text-sm text-gray-500 flex justify-between items-center mt-2">
                                      <span className="flex items-center"><UserCheck className="w-3 h-3 mr-1" /> {hist.barbeiro}</span>
                                      <span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-bold">{hist.data} às {hist.hora}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                              <p>Histórico detalhado não disponível no mock.</p>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RelatorioClientesAtendidos;
