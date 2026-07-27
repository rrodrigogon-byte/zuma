import React, { useState } from 'react';

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const mockRanking = [
  { posicao: 1, nome: 'Carlos Silva', cargo: 'Vendedor', total_vendas: 48500, meta_mensal: 45000, pct_meta: 107.8, comissao_estimada: 1455, qtd_vendas: 32, ticket_medio: 1515.63 },
  { posicao: 2, nome: 'Ana Oliveira', cargo: 'Vendedora', total_vendas: 41200, meta_mensal: 40000, pct_meta: 103.0, comissao_estimada: 1236, qtd_vendas: 28, ticket_medio: 1471.43 },
  { posicao: 3, nome: 'Pedro Santos', cargo: 'Vendedor', total_vendas: 35800, meta_mensal: 40000, pct_meta: 89.5, comissao_estimada: 894, qtd_vendas: 24, ticket_medio: 1491.67 },
  { posicao: 4, nome: 'Maria Costa', cargo: 'Vendedora', total_vendas: 28900, meta_mensal: 35000, pct_meta: 82.6, comissao_estimada: 722, qtd_vendas: 19, ticket_medio: 1521.05 },
];

const mockFolha = {
  mes: 7, ano: 2026,
  totais: { bruto: 42800, inss: 4708, irrf: 2140, fgts: 3424, liquido: 35952 },
  colaboradores: [
    { nome: 'Carlos Silva', cargo: 'Vendedor', salario_base: 2500, comissao: 1455, bruto: 3955, inss: 435.05, irrf: 198.25, fgts: 316.40, liquido: 3321.70 },
    { nome: 'Ana Oliveira', cargo: 'Vendedora', salario_base: 2500, comissao: 1236, bruto: 3736, inss: 411.00, irrf: 180.00, fgts: 298.88, liquido: 3145.00 },
    { nome: 'Pedro Santos', cargo: 'Vendedor', salario_base: 2200, comissao: 894, bruto: 3094, inss: 340.34, irrf: 120.00, fgts: 247.52, liquido: 2633.66 },
  ]
};

export default function RH() {
  const [aba, setAba] = useState('ranking');
  const mesAtual = new Date().getMonth();
  const anoAtual = new Date().getFullYear();
  const [mes, setMes] = useState(mesAtual);
  const [ano, setAno] = useState(anoAtual);

  const medalha = (pos) => pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : `#${pos}`;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">RH & Comissões</h1>
          <p className="text-gray-500 text-sm mt-1">Folha simplificada, metas e ranking de vendedores</p>
        </div>
        <div className="flex gap-2">
          <select value={mes} onChange={e => setMes(Number(e.target.value))} className="border rounded-lg px-3 py-2 text-sm">
            {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select value={ano} onChange={e => setAno(Number(e.target.value))} className="border rounded-lg px-3 py-2 text-sm">
            {[2025,2026,2027].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
            Calcular Comissões
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total em Comissões', valor: 'R$ 4.307', sub: `${MESES[mes]}/${ano}`, cor: 'indigo' },
          { label: 'Maior Vendedor', valor: 'Carlos Silva', sub: 'R$ 48.500 vendidos', cor: 'green' },
          { label: 'Meta da Equipe', valor: '96,2%', sub: 'R$ 154.400 / R$ 160.000', cor: 'yellow' },
          { label: 'Folha Bruta', valor: 'R$ 42.800', sub: 'Encargos: R$ 6.848', cor: 'purple' },
        ].map((k, i) => (
          <div key={i} className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 mb-1">{k.label}</p>
            <p className={`text-xl font-bold text-${k.cor}-600`}>{k.valor}</p>
            <p className="text-xs text-gray-400 mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Abas */}
      <div className="flex gap-1 mb-6 border-b">
        {[
          { id: 'ranking', label: '🏆 Ranking' },
          { id: 'comissoes', label: '💰 Comissões' },
          { id: 'folha', label: '📋 Folha' },
          { id: 'metas', label: '🎯 Metas' },
          { id: 'colaboradores', label: '👥 Colaboradores' },
        ].map(a => (
          <button key={a.id} onClick={() => setAba(a.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${aba === a.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {a.label}
          </button>
        ))}
      </div>

      {/* Ranking */}
      {aba === 'ranking' && (
        <div className="space-y-3">
          {mockRanking.map((v, i) => (
            <div key={i} className={`bg-white rounded-xl border p-4 flex items-center gap-4 ${i === 0 ? 'border-yellow-300 bg-yellow-50' : ''}`}>
              <div className="text-2xl w-10 text-center">{medalha(v.posicao)}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{v.nome}</span>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{v.cargo}</span>
                </div>
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Meta: R$ {v.meta_mensal.toLocaleString('pt-BR')}</span>
                    <span className={`font-medium ${v.pct_meta >= 100 ? 'text-green-600' : v.pct_meta >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {v.pct_meta}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className={`h-2 rounded-full ${v.pct_meta >= 100 ? 'bg-green-500' : v.pct_meta >= 80 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min(v.pct_meta, 100)}%` }} />
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-gray-900">R$ {v.total_vendas.toLocaleString('pt-BR')}</p>
                <p className="text-xs text-gray-500">{v.qtd_vendas} vendas · TM R$ {v.ticket_medio.toLocaleString('pt-BR', {maximumFractionDigits:0})}</p>
                <p className="text-sm font-medium text-indigo-600 mt-1">Comissão: R$ {v.comissao_estimada.toLocaleString('pt-BR')}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Folha */}
      {aba === 'folha' && (
        <div>
          <div className="grid grid-cols-5 gap-4 mb-6">
            {[
              { label: 'Bruto Total', valor: `R$ ${mockFolha.totais.bruto.toLocaleString('pt-BR')}`, cor: 'gray' },
              { label: 'INSS Total', valor: `R$ ${mockFolha.totais.inss.toLocaleString('pt-BR')}`, cor: 'blue' },
              { label: 'IRRF Total', valor: `R$ ${mockFolha.totais.irrf.toLocaleString('pt-BR')}`, cor: 'orange' },
              { label: 'FGTS Total', valor: `R$ ${mockFolha.totais.fgts.toLocaleString('pt-BR')}`, cor: 'purple' },
              { label: 'Líquido Total', valor: `R$ ${mockFolha.totais.liquido.toLocaleString('pt-BR')}`, cor: 'green' },
            ].map((k, i) => (
              <div key={i} className="bg-white rounded-xl border p-4 text-center">
                <p className="text-xs text-gray-500">{k.label}</p>
                <p className={`text-lg font-bold text-${k.cor}-600 mt-1`}>{k.valor}</p>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Colaborador','Cargo','Salário Base','Comissão','Bruto','INSS','IRRF','FGTS','Líquido'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mockFolha.colaboradores.map((c, i) => (
                  <tr key={i} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{c.nome}</td>
                    <td className="px-4 py-3 text-gray-500">{c.cargo}</td>
                    <td className="px-4 py-3">R$ {c.salario_base.toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3 text-indigo-600">R$ {c.comissao.toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3 font-medium">R$ {c.bruto.toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3 text-red-500">R$ {c.inss.toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3 text-orange-500">R$ {c.irrf.toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3 text-purple-500">R$ {c.fgts.toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3 font-bold text-green-600">R$ {c.liquido.toLocaleString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2 mt-4">
            <button className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700">
              📥 Exportar Holeites PDF
            </button>
            <button className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
              📊 Exportar Excel
            </button>
          </div>
        </div>
      )}

      {/* Metas */}
      {aba === 'metas' && (
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Definir Metas — {MESES[mes]}/{ano}</h3>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Colaborador','Cargo','Meta Valor (R$)','Meta Qtd Vendas','% Comissão'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mockRanking.map((v, i) => (
                <tr key={i} className="border-t">
                  <td className="px-4 py-3 font-medium">{v.nome}</td>
                  <td className="px-4 py-3 text-gray-500">{v.cargo}</td>
                  <td className="px-4 py-3">
                    <input type="number" defaultValue={v.meta_mensal} className="border rounded px-2 py-1 w-32 text-sm" />
                  </td>
                  <td className="px-4 py-3">
                    <input type="number" defaultValue={30} className="border rounded px-2 py-1 w-20 text-sm" />
                  </td>
                  <td className="px-4 py-3">
                    <input type="number" defaultValue={3} step="0.5" className="border rounded px-2 py-1 w-20 text-sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="mt-4 bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
            Salvar Metas
          </button>
        </div>
      )}

      {/* Colaboradores */}
      {aba === 'colaboradores' && (
        <div>
          <div className="flex justify-between mb-4">
            <input placeholder="Buscar colaborador..." className="border rounded-lg px-3 py-2 text-sm w-64" />
            <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
              + Novo Colaborador
            </button>
          </div>
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Nome','Cargo','Departamento','Salário Base','Tipo Comissão','% Comissão','Meta Mensal','Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mockRanking.map((v, i) => (
                  <tr key={i} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{v.nome}</td>
                    <td className="px-4 py-3">{v.cargo}</td>
                    <td className="px-4 py-3 text-gray-500">Vendas</td>
                    <td className="px-4 py-3">R$ 2.500</td>
                    <td className="px-4 py-3"><span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs">Meta</span></td>
                    <td className="px-4 py-3">3%</td>
                    <td className="px-4 py-3">R$ {v.meta_mensal.toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3"><span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs">Ativo</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
