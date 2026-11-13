import React, { useState } from 'react';
import { 
  Truck, 
  Users, 
  Award, 
  ShieldCheck, 
  Plus, 
  CheckCircle2, 
  FileText, 
  AlertTriangle,
  X,
  Check,
  Search,
  ExternalLink
} from 'lucide-react';
import { FLEET as INITIAL_FLEET, DRIVERS as INITIAL_DRIVERS } from '../data/mockData';

export default function MasterDataRules({ fleet = INITIAL_FLEET, drivers = INITIAL_DRIVERS }) {
  const [activeTab, setActiveTab] = useState('fleet'); // fleet | drivers | inmetro | rules
  const [fleetList, setFleetList] = useState(fleet);
  const [driverList, setDriverList] = useState(drivers);
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);
  const [showInmetroModal, setShowInmetroModal] = useState(false);

  // New Vehicle form
  const [newPrefix, setNewPrefix] = useState('');
  const [newPlaca, setNewPlaca] = useState('');
  const [newTipo, setNewTipo] = useState('Betoneira 8m³');
  const [newTara, setNewTara] = useState('13200');
  const [newCapacidade, setNewCapacidade] = useState('8 m³');

  const handleAddVehicle = (e) => {
    e.preventDefault();
    const newV = {
      id: `V-0${fleetList.length + 1}`,
      prefixo: newPrefix || `BT-0${fleetList.length + 1}`,
      placa: newPlaca.toUpperCase(),
      tipo: newTipo,
      modelo: 'Volvo VM 330 8x4',
      taraCadastradaKg: Number(newTara) || 13200,
      capacidadeM3: Number(newCapacidade.replace(/\D/g, '')) || 8,
      status: 'Disponível no Pátio',
      ultimaTaraAferida: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };

    setFleetList([newV, ...fleetList]);
    setShowAddVehicleModal(false);
    setNewPrefix('');
    setNewPlaca('');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white p-4 rounded-2xl border border-concrete-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-stone-900 tracking-tight flex items-center gap-2">
            <span>CADASTROS MESTRES, FROTA &amp; NORMAS ABNT</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-serrano-100 text-serrano-800 border border-serrano-200 font-mono">
              Auditoria NBR 7212 / INMETRO
            </span>
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Parametrização de veículos, motoristas credenciados, células de carga Toledo e regras do Motor KyttoIA
          </p>
        </div>

        {activeTab === 'fleet' && (
          <button
            onClick={() => setShowAddVehicleModal(true)}
            className="px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-colors self-start md:self-auto active:scale-98"
          >
            <Plus className="w-4 h-4 text-amber-300" />
            <span>Adicionar Veículo à Frota</span>
          </button>
        )}
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl text-xs font-bold overflow-x-auto">
        <button
          onClick={() => setActiveTab('fleet')}
          className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'fleet' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <Truck className="w-3.5 h-3.5 text-serrano-600" />
          <span>Frota Operacional ({fleetList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('drivers')}
          className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'drivers' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <Users className="w-3.5 h-3.5 text-serrano-600" />
          <span>Motoristas Credenciados ({driverList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('inmetro')}
          className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'inmetro' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <Award className="w-3.5 h-3.5 text-serrano-600" />
          <span>Laudos Metrológicos IPEM-MT</span>
        </button>

        <button
          onClick={() => setActiveTab('rules')}
          className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'rules' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-serrano-600" />
          <span>Regras KyttoIA &amp; Tolerâncias</span>
        </button>
      </div>

      {/* TAB 1: FLEET */}
      {activeTab === 'fleet' && (
        <div className="bg-white p-4 rounded-2xl border border-concrete-200 shadow-xs text-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-stone-200 text-stone-400 font-bold uppercase text-[10px]">
                  <th className="py-2">Prefixo</th>
                  <th>Placa (Mercosul)</th>
                  <th>Tipo / Modelo</th>
                  <th>Capacidade</th>
                  <th className="text-right">Tara Cadastrada (kg)</th>
                  <th>Última Aferição</th>
                  <th>Status Operacional</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-700">
                {fleetList.map((f, idx) => (
                  <tr key={idx} className="hover:bg-stone-50 transition-colors">
                    <td className="py-2.5 font-mono font-bold text-stone-900">{f.prefixo}</td>
                    <td className="font-mono font-bold text-stone-800">{f.placa}</td>
                    <td>{f.tipo} <span className="text-stone-400 text-[10px]">({f.modelo})</span></td>
                    <td className="font-mono">{f.capacidadeM3} m³</td>
                    <td className="text-right font-mono font-bold">{f.taraCadastradaKg?.toLocaleString('pt-BR')} kg</td>
                    <td className="font-mono text-stone-500">{f.ultimaTaraAferida || 'Hoje · 07:15'}</td>
                    <td>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        f.status?.includes('Em Carga') 
                          ? 'bg-amber-100 text-amber-800' 
                          : f.status?.includes('Em Trânsito')
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {f.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: DRIVERS */}
      {activeTab === 'drivers' && (
        <div className="bg-white p-4 rounded-2xl border border-concrete-200 shadow-xs text-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-stone-200 text-stone-400 font-bold uppercase text-[10px]">
                  <th className="py-2">Motorista</th>
                  <th>CPF</th>
                  <th>CNH / Categoria</th>
                  <th>Exame Toxicológico</th>
                  <th>Treinamento NBR 7212</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-700">
                {driverList.map((d, idx) => (
                  <tr key={idx} className="hover:bg-stone-50 transition-colors">
                    <td className="py-2.5 font-bold text-stone-900">{d.nome}</td>
                    <td className="font-mono text-stone-600">{d.cpf}</td>
                    <td className="font-mono font-bold text-stone-800">{d.cnh} ({d.categoria})</td>
                    <td className="text-emerald-700 font-medium">Válido até 10/2027</td>
                    <td className="text-emerald-700 font-medium">Concluído (40h)</td>
                    <td>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        {d.status || 'Ativo na Balança'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: INMETRO IPEM-MT */}
      {activeTab === 'inmetro' && (
        <div className="bg-white p-5 rounded-2xl border border-concrete-200 shadow-xs text-xs space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div>
              <h3 className="font-extrabold uppercase text-stone-900 text-sm">
                Certificados de Calibração Metrológica das Balanças Toledo
              </h3>
              <p className="text-stone-500 text-[11px] mt-0.5">
                Aferição oficial com caminhão de pesos-padrão do IPEM-MT (Instituto de Pesos e Medidas de Mato Grosso)
              </p>
            </div>
            <button
              onClick={() => setShowInmetroModal(true)}
              className="px-3.5 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl font-bold transition-colors flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-amber-300" />
              <span>Ver Laudo Oficial IPEM</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-stone-800 text-xs">BALANÇA RODOVIÁRIA 01 · USINA MT-358</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                  Aprovada
                </span>
              </div>
              <p className="text-[11px] text-stone-600">
                Toledo 720i · Plataforma Metálica 21,00 m · Capacidade: 80.000 kg · Divisão d = 20 kg
              </p>
              <div className="pt-2 border-t border-stone-200/60 font-mono text-[11px] text-stone-500 flex justify-between">
                <span>Certificado Nº: <strong>IPEM-MT-2026/0894</strong></span>
                <span>Validade: <strong>14/10/2027</strong></span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-stone-800 text-xs">BALANÇA RODOVIÁRIA 02 · MINERAÇÃO RIO SANGUE</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                  Aprovada
                </span>
              </div>
              <p className="text-[11px] text-stone-600">
                Toledo Prix 9094 · Plataforma Concreto 18,00 m · Capacidade: 60.000 kg · Divisão d = 20 kg
              </p>
              <div className="pt-2 border-t border-stone-200/60 font-mono text-[11px] text-stone-500 flex justify-between">
                <span>Certificado Nº: <strong>IPEM-MT-2026/0895</strong></span>
                <span>Validade: <strong>14/10/2027</strong></span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: RULES KYTTOIA */}
      {activeTab === 'rules' && (
        <div className="bg-white p-5 rounded-2xl border border-concrete-200 shadow-xs text-xs space-y-4">
          <h3 className="font-extrabold uppercase text-stone-900 text-sm">
            Parâmetros Forenses &amp; Tolerâncias do Motor KyttoIA 2.5 Flash
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-1">
              <strong className="text-stone-900 block font-bold text-xs">Tolerância de Tara Residual</strong>
              <div className="text-base font-black font-mono text-serrano-700">± 1,5% (máx 200 kg)</div>
              <p className="text-[11px] text-stone-500">
                Detecta resíduos de concreto curado no balão ou divergência de combustível.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-1">
              <strong className="text-stone-900 block font-bold text-xs">Posicionamento na Balança</strong>
              <div className="text-base font-black font-mono text-serrano-700">Visão Computacional 4 Câmeras</div>
              <p className="text-[11px] text-stone-500">
                Bloqueia pesagem automática se algum pneu estiver tocando o guard-rail ou meio-fio da plataforma.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-1">
              <strong className="text-stone-900 block font-bold text-xs">Janela Crítica NBR 7212</strong>
              <div className="text-base font-black font-mono text-serrano-700">150 minutos (2h30)</div>
              <p className="text-[11px] text-stone-500">
                Alerta automático de início de pega. Exige laudo tecnológico se ultrapassar o tempo limite.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Adicionar Veículo */}
      {showAddVehicleModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-concrete-300 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 bg-stone-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-amber-300" />
                <h3 className="font-extrabold text-sm tracking-tight">ADICIONAR VEÍCULO À FROTA</h3>
              </div>
              <button
                onClick={() => setShowAddVehicleModal(false)}
                className="p-1.5 rounded-xl text-stone-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddVehicle} className="p-5 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Prefixo:</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: BT-09"
                    value={newPrefix}
                    onChange={(e) => setNewPrefix(e.target.value)}
                    className="w-full p-2 rounded-xl border border-stone-300 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Placa Mercosul:</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: RMT-9A88"
                    value={newPlaca}
                    onChange={(e) => setNewPlaca(e.target.value)}
                    className="w-full p-2 rounded-xl border border-stone-300 font-mono uppercase font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">Tipo de Veículo:</label>
                <select
                  value={newTipo}
                  onChange={(e) => setNewTipo(e.target.value)}
                  className="w-full p-2 rounded-xl border border-stone-300 font-semibold"
                >
                  <option value="Betoneira 8m³ (4 Eixos)">Betoneira 8m³ (4 Eixos)</option>
                  <option value="Betoneira 10m³ (4 Eixos)">Betoneira 10m³ (4 Eixos)</option>
                  <option value="Carreta Basculante Brita (30t)">Carreta Basculante Brita (30t)</option>
                  <option value="Caminhão Truck Caçamba (14m³)">Caminhão Truck Caçamba (14m³)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Tara Padrão (kg):</label>
                  <input
                    type="number"
                    required
                    value={newTara}
                    onChange={(e) => setNewTara(e.target.value)}
                    className="w-full p-2 rounded-xl border border-stone-300 font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Capacidade (m³):</label>
                  <input
                    type="text"
                    required
                    value={newCapacidade}
                    onChange={(e) => setNewCapacidade(e.target.value)}
                    className="w-full p-2 rounded-xl border border-stone-300 font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddVehicleModal(false)}
                  className="px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-100 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold shadow-md transition-colors"
                >
                  Cadastrar Veículo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Laudo IPEM-MT */}
      {showInmetroModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-concrete-300 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 bg-stone-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-400" />
                <h3 className="font-extrabold text-sm tracking-tight">LAUDO METROLÓGICO IPEM-MT Nº 2026/0894</h3>
              </div>
              <button
                onClick={() => setShowInmetroModal(false)}
                className="p-1.5 rounded-xl text-stone-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs font-mono text-stone-700">
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1">
                <div>ÓRGÃO: <strong>IPEM-MT / INMETRO (Cuiabá-MT)</strong></div>
                <div>ESTABELECIMENTO: <strong>SERRANO CONCRETO E MINERAÇÃO LTDA</strong></div>
                <div>LOCAL: <strong>Rodovia MT-358, KM 12 - Tangará da Serra/MT</strong></div>
                <div>EQUIPAMENTO: <strong>Balança Rodoviária Eletrônica Toledo 720i</strong></div>
                <div>CAPACIDADE: <strong>80.000 kg · d = 20 kg · e = 20 kg</strong></div>
              </div>

              <div className="space-y-1">
                <span className="font-bold text-stone-900 block">ENSAIOS EXECUTADOS COM PESOS-PADRÃO:</span>
                <div>1. Erro de Indicação a 20.000 kg: 0 kg (Erro máximo permitido: ±20 kg)</div>
                <div>2. Erro de Indicação a 40.000 kg: +10 kg (Erro máximo permitido: ±40 kg)</div>
                <div>3. Erro de Indicação a 60.000 kg: 0 kg (Erro máximo permitido: ±40 kg)</div>
                <div>4. Excentricidade nos 4 apoios: APROVADO</div>
                <div>5. Repetibilidade de 3 pesagens sucessivas: APROVADO</div>
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-950 font-bold">
                CONCLUSÃO: INSTRUMENTO AFERIDO E LACRADO COM LACRE INMETRO Nº 882941-MT. APROVADO PARA USO EM TRANSAÇÕES COMERCIAIS ATÉ OUTUBRO/2027.
              </div>

              <div className="pt-2 text-right">
                <button
                  type="button"
                  onClick={() => setShowInmetroModal(false)}
                  className="px-4 py-2 rounded-xl bg-stone-900 text-white font-bold"
                >
                  Fechar Laudo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
