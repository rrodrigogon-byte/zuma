import React, { useState } from 'react';
import { 
  Database, 
  Truck, 
  Users, 
  Scale, 
  ShieldCheck, 
  CheckCircle2, 
  Plus, 
  FileCheck,
  Cpu
} from 'lucide-react';
import { WEIGHBRIDGES } from '../data/mockData';

export default function MasterDataRules() {
  const [activeSubTab, setActiveSubTab] = useState('frota');

  const FLEET_LIST = [
    { prefixo: 'BT-05', placa: 'QBF-6M02', modelo: 'Scania P310 8x4', tipo: 'Betoneira 10m³', motorista: 'Valdir Silveira', taraPadraoKg: 12900, status: 'Ativo' },
    { prefixo: 'BT-06', placa: 'RRA-4A20', modelo: 'MB 2730 6x4', tipo: 'Betoneira 8m³', motorista: 'Claudemir Ramos', taraPadraoKg: 11500, status: 'Ativo' },
    { prefixo: 'BT-08', placa: 'NJK-3307', modelo: 'Volvo VM 330 8x4', tipo: 'Betoneira 10m³', motorista: 'Marcos Souza', taraPadraoKg: 13100, status: 'Em Manutenção' },
    { prefixo: 'BT-12', placa: 'OBX-9K31', modelo: 'Scania P280 6x4', tipo: 'Betoneira 8m³', motorista: 'João Paulo Neves', taraPadraoKg: 11620, status: 'Ativo' },
    { prefixo: 'CC-01', placa: 'KAP-8192', modelo: 'Volvo FMX 460 6x4', tipo: 'Caçamba 16m³', motorista: 'Ailton Barbosa', taraPadraoKg: 14200, status: 'Ativo' },
    { prefixo: 'CC-02', placa: 'NJW-5410', modelo: 'VW 31.330 6x4', tipo: 'Caçamba Toco', motorista: 'Rogério Lima', taraPadraoKg: 9800, status: 'Ativo' }
  ];

  return (
    <div className="space-y-4">
      
      {/* Top Header */}
      <div className="bg-white p-4 rounded-2xl border border-concrete-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-stone-900 tracking-tight flex items-center gap-2">
            <span>CADASTROS GERAIS, FROTA & CERTIFICADOS TÉCNICOS</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200">
              Gestão da Usina & Mineração
            </span>
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Cadastro de caminhões betoneira, caçambas, motoristas com CNH e laudos INMETRO das balanças
          </p>
        </div>

        {/* Sub-tab Switcher */}
        <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl text-xs">
          <button
            onClick={() => setActiveSubTab('frota')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeSubTab === 'frota' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Frota de Caminhões
          </button>
          <button
            onClick={() => setActiveSubTab('balancas')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeSubTab === 'balancas' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Balanças & INMETRO
          </button>
        </div>
      </div>

      {/* Content depending on subtab */}
      {activeSubTab === 'frota' && (
        <div className="bg-white p-4 rounded-2xl border border-concrete-200 shadow-xs text-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-stone-800">
              Veículos Cadastrados na Unidade Tangará da Serra
            </h3>
            <button 
              onClick={() => alert('Formulário de cadastro de veículo aberto!')}
              className="px-3 py-1.5 bg-serrano-500 hover:bg-serrano-600 text-white rounded-lg font-bold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Novo Veículo</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-stone-200 text-stone-400 font-bold uppercase text-[10px]">
                  <th className="py-2">Prefixo</th>
                  <th>Placa LPR</th>
                  <th>Modelo Chassi</th>
                  <th>Tipo Carga</th>
                  <th>Motorista Padrão</th>
                  <th>Tara Histórica Média</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-700">
                {FLEET_LIST.map(v => (
                  <tr key={v.prefixo} className="hover:bg-stone-50 transition-colors">
                    <td className="py-2.5 font-bold text-stone-900 font-mono">{v.prefixo}</td>
                    <td className="font-mono font-bold text-stone-800">{v.placa}</td>
                    <td>{v.modelo}</td>
                    <td>{v.tipo}</td>
                    <td className="font-semibold text-stone-900">{v.motorista}</td>
                    <td className="font-mono">{v.taraPadraoKg.toLocaleString('pt-BR')} kg</td>
                    <td>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        v.status === 'Ativo' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {v.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'balancas' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          
          {/* BAL-01 Toledo */}
          <div className="bg-white p-5 rounded-2xl border border-concrete-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-serrano-700 text-xs px-2 py-0.5 rounded bg-serrano-50 border border-serrano-200">
                BAL-01
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                Certificado Válido
              </span>
            </div>

            <h4 className="text-sm font-extrabold text-stone-900">
              Balança Rodoviária Usina MT-358
            </h4>

            <div className="space-y-1.5 text-stone-600 text-[11px]">
              <div><strong>Fabricante:</strong> Toledo do Brasil · Indicador 720i</div>
              <div><strong>Dimensões:</strong> 21,00 metros de comprimento x 3,20 metros</div>
              <div><strong>Capacidade:</strong> 80.000 kg (Divisão d = 10 kg)</div>
              <div><strong>Células de Carga:</strong> 8 células digitais de compressão inox</div>
              <div><strong>Laudo IPEM-MT:</strong> Nº 2026/0894-MT (Vigência: 18/08/2027)</div>
            </div>

            <div className="pt-3 border-t border-concrete-100 flex items-center justify-between text-[11px]">
              <span className="text-stone-400">Última Aferição com Caminhão de Pesos:</span>
              <strong className="text-stone-800">12/08/2026</strong>
            </div>
          </div>

          {/* BAL-02 Filizola */}
          <div className="bg-white p-5 rounded-2xl border border-concrete-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-stone-700 text-xs px-2 py-0.5 rounded bg-stone-100 border border-stone-200">
                BAL-02
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                Certificado Válido
              </span>
            </div>

            <h4 className="text-sm font-extrabold text-stone-900">
              Balança Rodoviária Mineração Rio Sangue
            </h4>

            <div className="space-y-1.5 text-stone-600 text-[11px]">
              <div><strong>Fabricante:</strong> Filizola Industrial · Modelo Titan Plus</div>
              <div><strong>Dimensões:</strong> 18,00 metros de comprimento x 3,00 metros</div>
              <div><strong>Capacidade:</strong> 60.000 kg (Divisão d = 10 kg)</div>
              <div><strong>Células de Carga:</strong> 6 células analógicas com caixa de junção</div>
              <div><strong>Laudo IPEM-MT:</strong> Nº 2026/0412-MT (Vigência: 24/05/2027)</div>
            </div>

            <div className="pt-3 border-t border-concrete-100 flex items-center justify-between text-[11px]">
              <span className="text-stone-400">Última Aferição com Caminhão de Pesos:</span>
              <strong className="text-stone-800">10/05/2026</strong>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
