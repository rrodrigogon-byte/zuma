import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, FileText, ChevronRight, BarChart3, Filter } from 'lucide-react';
import { todosRelatorios } from './relatoriosData';

const RelatoriosDinoIndex = () => {
  const [busca, setBusca] = useState('');
  const [categoriaSelecionada, setCategoriaSelecionada] = useState('Todas');

  const categorias = ['Todas', ...new Set(todosRelatorios.map(r => r.categoria))].sort();

  const relatoriosFiltrados = useMemo(() => {
    return todosRelatorios.filter(r => {
      const matchCategoria = categoriaSelecionada === 'Todas' || r.categoria === categoriaSelecionada;
      const termo = busca.toLowerCase();
      const matchBusca = r.nome.toLowerCase().includes(termo) || r.codigo.includes(termo) || r.descricao.toLowerCase().includes(termo);
      return matchCategoria && matchBusca;
    });
  }, [busca, categoriaSelecionada]);

  // Rotas mapeadas para os relatórios já construídos
  const linkRelatorio = (codigo) => {
    if (codigo === '0011') return '/admin/relatorios/dino/retorno';
    if (codigo === '0002') return '/admin/relatorios/dino/clientes-atendidos';
    return '#'; // Placeholder para os não migrados
  };

  return (
    <div className="p-6 bg-[#f4f7fb] min-h-screen text-gray-800 font-sans">
      <div className="flex justify-between items-center mb-6">
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">DINO · INTELIGÊNCIA DE NEGÓCIOS</p>
          <h1 className="text-3xl font-extrabold text-gray-900">Central de Relatórios</h1>
          <p className="text-gray-500 mt-1">Acesse todos os seus {todosRelatorios.length} relatórios gerenciais e insights da IA.</p>
        </div>
      </div>

      {/* Filtros e Busca */}
      <div className="bg-white rounded-xl p-5 mb-6 shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-1/2">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="pl-10 w-full border-gray-300 rounded-lg shadow-sm p-3 border focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Buscar relatório por código, nome ou descrição..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div className="w-full md:w-1/3 flex items-center gap-2">
          <Filter className="h-5 w-5 text-gray-400" />
          <select 
            className="w-full border-gray-300 rounded-lg shadow-sm p-3 border focus:ring-indigo-500"
            value={categoriaSelecionada}
            onChange={(e) => setCategoriaSelecionada(e.target.value)}
          >
            {categorias.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista de Relatórios */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Código</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Categoria</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Relatório & Descrição</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Ação</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {relatoriosFiltrados.map((rel) => {
                const url = linkRelatorio(rel.codigo);
                const isMigrated = url !== '#';

                return (
                  <tr key={rel.codigo} className={`hover:bg-indigo-50 transition duration-150 ${isMigrated ? 'bg-indigo-50/30' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-gray-100 text-gray-800">
                        {rel.codigo}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {rel.categoria}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className={`p-2 rounded-lg mr-3 ${isMigrated ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400'}`}>
                          {isMigrated ? <BarChart3 className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
                            {rel.nome}
                            {isMigrated && <span className="px-2 py-0.5 text-xs bg-indigo-600 text-white rounded-full">Novo Dino IA</span>}
                          </div>
                          <div className="text-sm text-gray-500 mt-1 line-clamp-2">{rel.descricao}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {isMigrated ? (
                        <Link to={url} className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">
                          Acessar <ChevronRight className="ml-2 h-4 w-4" />
                        </Link>
                      ) : (
                        <button disabled className="inline-flex items-center justify-center px-4 py-2 border border-gray-200 rounded-md shadow-sm text-sm font-medium text-gray-400 bg-gray-50 cursor-not-allowed">
                          Em migração
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {relatoriosFiltrados.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              Nenhum relatório encontrado para essa busca.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RelatoriosDinoIndex;
