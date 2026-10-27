import React, { useState } from 'react';
import { Download, RefreshCw, Sparkles, Filter, Users, MessageCircle, ChevronDown, ChevronUp, AlertTriangle, TrendingDown } from 'lucide-react';

const RelatorioRetornoProfissional = () => {
  const [dataAnaliseInicio, setDataAnaliseInicio] = useState('2026-08-01');
  const [dataAnaliseFim, setDataAnaliseFim] = useState('2026-08-31');
  const [dataRetornoInicio, setDataRetornoInicio] = useState('2026-09-01');
  const [dataRetornoFim, setDataRetornoFim] = useState('2026-10-26');
  const [expandedRow, setExpandedRow] = useState(null);

  // Dados mockados enriquecidos para UI avançada
  const profissionais = [
    { 
      id: 1, iniciais: 'GH', nome: 'Gustavo Henrique', analisados: 120, retencao: 85, perdidos: 18, receitaRisco: 1620.00, perfil: '⭐ Premium',
      clientesPerdidos: [
        { nome: 'Carlos Silva', telefone: '(65) 9999-1111', ultimaVisita: '15/08/2026', ticket: 90 },
        { nome: 'Marcos Paulo', telefone: '(65) 9999-2222', ultimaVisita: '20/08/2026', ticket: 120 }
      ]
    },
    { 
      id: 2, iniciais: 'GC', nome: 'Guilherme Cunha', analisados: 95, retencao: 60, perdidos: 38, receitaRisco: 2280.00, perfil: '🏷️ Essencial',
      clientesPerdidos: [
        { nome: 'João Pedro', telefone: '(65) 9999-3333', ultimaVisita: '02/08/2026', ticket: 60 },
        { nome: 'Lucas Lima', telefone: '(65) 9999-4444', ultimaVisita: '10/08/2026', ticket: 60 },
        { nome: 'Pedro Henrique', telefone: '(65) 9999-5555', ultimaVisita: '12/08/2026', ticket: 60 }
      ]
    },
    { 
      id: 3, iniciais: 'BM', nome: 'Bruno Mendes', analisados: 80, retencao: 72, perdidos: 22, receitaRisco: 1320.00, perfil: '🏷️ Essencial',
      clientesPerdidos: []
    },
    { 
      id: 4, iniciais: 'AB', nome: 'Aize Barbara', analisados: 110, retencao: 90, perdidos: 11, receitaRisco: 1980.00, perfil: '⭐ Premium',
      clientesPerdidos: []
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
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Módulo de Relacionamento</span>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Retorno por Profissional</h1>
          <p className="text-gray-500 mt-1">Análise profunda de retenção e churn (perda) de clientes da sua equipe.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button className="flex-1 md:flex-none flex justify-center items-center px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm font-medium hover:bg-gray-50 transition">
            <RefreshCw className="w-4 h-4 mr-2 text-gray-500" /> Atualizar
          </button>
          <button className="flex-1 md:flex-none flex justify-center items-center px-4 py-2 bg-gray-900 text-white rounded-lg shadow-sm font-medium hover:bg-gray-800 transition">
            <Download className="w-4 h-4 mr-2" /> Exportar Relatório
          </button>
        </div>
      </div>

      {/* AI Insight Card Premium */}
      <div className="bg-gradient-to-r from-indigo-900 via-purple-900 to-indigo-900 rounded-2xl p-6 mb-8 shadow-lg text-white relative overflow-hidden">
        {/* Efeito visual de fundo */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white opacity-5 blur-3xl"></div>
        
        <div className="flex items-start gap-5 relative z-10">
          <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm flex-shrink-0">
            <Sparkles className="w-8 h-8 text-indigo-200" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-xl font-bold text-white">IA Dino: Análise Estratégica</h3>
              <span className="bg-green-500/20 text-green-300 text-xs font-bold px-2 py-0.5 rounded border border-green-500/30">Oportunidade de Receita</span>
            </div>
            <p className="text-indigo-100 leading-relaxed text-lg mb-4">
              Identificamos que <strong>Guilherme Cunha</strong> está com a retenção crítica (60%), gerando um risco de <strong className="text-white bg-red-500/20 px-1 rounded">R$ 2.280,00</strong>. 
              Por outro lado, <strong>Aize Barbara</strong> bateu o recorde do salão com 90% de retenção de clientes VIP.
            </p>
            <div className="flex flex-wrap gap-3 mt-2">
              <button className="bg-white text-indigo-900 text-sm font-bold px-4 py-2 rounded-lg hover:bg-indigo-50 transition shadow-sm flex items-center">
                <MessageCircle className="w-4 h-4 mr-2" /> Criar Campanha de Resgate (Guilherme)
              </button>
              <button className="bg-indigo-800/50 border border-indigo-400/30 text-indigo-100 text-sm font-bold px-4 py-2 rounded-lg hover:bg-indigo-800 transition flex items-center">
                <Users className="w-4 h-4 mr-2" /> Ver perfis dos clientes perdidos
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros Inteligentes Kytto */}
      <div className="bg-white rounded-xl p-1 mb-8 shadow-sm border border-gray-200/60">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 rounded-t-xl flex items-center">
          <Filter className="w-5 h-5 mr-2 text-indigo-500" /> 
          <h3 className="font-bold text-gray-800">Definição do Funil de Retenção</h3>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="relative">
            <div className="absolute -left-3 top-0 bottom-0 w-1 bg-gray-200 rounded-full"></div>
            <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center">
              <span className="bg-gray-200 text-gray-700 w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2">1</span>
              Quando o cliente foi atendido? (Safra)
            </label>
            <div className="flex gap-3 items-center">
              <input type="date" value={dataAnaliseInicio} onChange={e => setDataAnaliseInicio(e.target.value)} className="w-full bg-gray-50 border-gray-200 rounded-lg shadow-sm p-2.5 border focus:ring-2 focus:ring-indigo-500 outline-none transition" />
              <span className="text-gray-400 font-medium">até</span>
              <input type="date" value={dataAnaliseFim} onChange={e => setDataAnaliseFim(e.target.value)} className="w-full bg-gray-50 border-gray-200 rounded-lg shadow-sm p-2.5 border focus:ring-2 focus:ring-indigo-500 outline-none transition" />
            </div>
          </div>
          
          <div className="relative">
            <div className="absolute -left-3 top-0 bottom-0 w-1 bg-indigo-200 rounded-full"></div>
            <label className="block text-sm font-bold text-indigo-900 mb-3 flex items-center">
              <span className="bg-indigo-200 text-indigo-800 w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2">2</span>
              Até quando ele deveria ter voltado? (Retorno)
            </label>
            <div className="flex gap-3 items-center">
              <input type="date" value={dataRetornoInicio} onChange={e => setDataRetornoInicio(e.target.value)} className="w-full bg-indigo-50/30 border-indigo-200 rounded-lg shadow-sm p-2.5 border focus:ring-2 focus:ring-indigo-500 outline-none transition text-indigo-900" />
              <span className="text-indigo-400 font-medium">até</span>
              <input type="date" value={dataRetornoFim} onChange={e => setDataRetornoFim(e.target.value)} className="w-full bg-indigo-50/30 border-indigo-200 rounded-lg shadow-sm p-2.5 border focus:ring-2 focus:ring-indigo-500 outline-none transition text-indigo-900" />
            </div>
          </div>
        </div>
      </div>

      {/* Grid de Dados Kytto (Tabela Avançada) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50/80">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Profissional da Equipe</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Funil de Atendimento</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Desempenho (Taxa de Retenção)</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Impacto Financeiro</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {profissionais.map(prof => (
                <React.Fragment key={prof.id}>
                  {/* Linha Principal */}
                  <tr className={`hover:bg-gray-50 transition ${expandedRow === prof.id ? 'bg-indigo-50/20' : ''}`}>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-gray-700 font-bold text-lg shadow-sm border border-gray-200">
                          {prof.iniciais}
                        </div>
                        <div className="ml-4">
                          <div className="text-base font-bold text-gray-900">{prof.nome}</div>
                          <div className="text-sm text-gray-500">{prof.perfil}</div>
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-5 whitespace-nowrap text-center">
                      <div className="flex flex-col items-center">
                        <span className="text-lg font-bold text-gray-800">{prof.analisados}</span>
                        <span className="text-xs text-gray-400 uppercase font-semibold">Analisados</span>
                      </div>
                    </td>
                    
                    <td className="px-6 py-5 whitespace-nowrap w-1/4">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-lg font-bold ${prof.retencao >= 80 ? 'text-green-600' : 'text-orange-500'}`}>
                          {prof.retencao}% 
                        </span>
                        <span className="text-xs font-bold text-red-500 flex items-center bg-red-50 px-2 py-0.5 rounded">
                          <TrendingDown className="w-3 h-3 mr-1" /> {prof.perdidos} perdidos
                        </span>
                      </div>
                      {/* Barra de Progresso Kytto */}
                      <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden flex">
                        <div className={`h-2.5 rounded-l-full ${prof.retencao >= 80 ? 'bg-green-500' : 'bg-orange-400'}`} style={{ width: `${prof.retencao}%` }}></div>
                        <div className="bg-red-400 h-2.5 rounded-r-full" style={{ width: `${100 - prof.retencao}%` }}></div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-5 whitespace-nowrap text-right">
                      <div className="text-base font-bold text-gray-900">R$ {prof.receitaRisco.toFixed(2)}</div>
                      <div className="text-xs text-gray-500 flex items-center justify-end">
                        <AlertTriangle className="w-3 h-3 mr-1 text-orange-400" /> Receita em risco
                      </div>
                    </td>
                    
                    <td className="px-6 py-5 whitespace-nowrap text-center">
                      <button 
                        onClick={() => toggleRow(prof.id)}
                        className={`inline-flex items-center justify-center p-2 rounded-lg border transition ${expandedRow === prof.id ? 'bg-indigo-100 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        title="Ver detalhamento de clientes"
                      >
                        {expandedRow === prof.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                    </td>
                  </tr>

                  {/* Linha Expandida (Drill-down de clientes) */}
                  {expandedRow === prof.id && (
                    <tr>
                      <td colSpan="5" className="px-0 py-0 border-b border-gray-200 bg-gray-50/50">
                        <div className="px-10 py-6 border-l-4 border-indigo-500 bg-white shadow-inner">
                          <div className="flex justify-between items-center mb-4">
                            <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center">
                              <Users className="w-4 h-4 mr-2 text-indigo-500" />
                              Lista de Clientes Perdidos ({prof.perdidos})
                            </h4>
                            <button className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-600 transition shadow-sm flex items-center">
                              <MessageCircle className="w-4 h-4 mr-2" /> Disparo em Massa (WhatsApp)
                            </button>
                          </div>
                          
                          {prof.clientesPerdidos.length > 0 ? (
                            <table className="min-w-full bg-white border border-gray-200 rounded-lg overflow-hidden">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Nome do Cliente</th>
                                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Telefone</th>
                                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Última Visita</th>
                                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Ticket Anterior</th>
                                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">Ação Individual</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {prof.clientesPerdidos.map((cliente, idx) => (
                                  <tr key={idx} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-sm font-bold text-gray-800">{cliente.nome}</td>
                                    <td className="px-4 py-3 text-sm text-gray-600">{cliente.telefone}</td>
                                    <td className="px-4 py-3 text-sm text-gray-600">{cliente.ultimaVisita}</td>
                                    <td className="px-4 py-3 text-sm font-medium text-orange-600">R$ {cliente.ticket.toFixed(2)}</td>
                                    <td className="px-4 py-3 text-right">
                                      <button className="text-indigo-600 hover:text-indigo-900 text-sm font-semibold border border-indigo-200 rounded px-3 py-1 hover:bg-indigo-50 transition">
                                        Abrir Visão 360º
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                              <p>Os dados individuais dos clientes não foram carregados no mock para este profissional.</p>
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

export default RelatorioRetornoProfissional;
