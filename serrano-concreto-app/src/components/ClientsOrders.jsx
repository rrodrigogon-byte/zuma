import React, { useState } from 'react';
import { 
  Building2, 
  Layers, 
  MapPin, 
  CheckCircle2, 
  Plus, 
  Play, 
  RotateCcw, 
  ShieldCheck, 
  FileSpreadsheet, 
  Percent,
  Check,
  X,
  Gauge,
  Droplet
} from 'lucide-react';
import { CONCRETE_MIXES as INITIAL_MIXES, CLIENTS_JOBSITES as INITIAL_CLIENTS } from '../data/mockData';

export default function ClientsOrders() {
  const [mixes, setMixes] = useState(INITIAL_MIXES);
  const [clients, setClients] = useState(INITIAL_CLIENTS);
  const [selectedMix, setSelectedMix] = useState(INITIAL_MIXES[1] || INITIAL_MIXES[0]); // TR-FCK30B
  
  // Batch volume simulation in Convicta 96T (e.g., 8 m³)
  const [batchVolume, setBatchVolume] = useState(8.0);
  const [isDosing, setIsDosing] = useState(false);
  const [dosingProgress, setDosingProgress] = useState(0);
  const [dosedSuccess, setDosedSuccess] = useState(false);

  // New Jobsite modal
  const [showNewJobsite, setShowNewJobsite] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newCnpj, setNewCnpj] = useState('');
  const [newObraName, setNewObraName] = useState('');
  const [newEndereco, setNewEndereco] = useState('');

  const handleStartDosing = () => {
    setIsDosing(true);
    setDosedSuccess(false);
    setDosingProgress(0);

    const interval = setInterval(() => {
      setDosingProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsDosing(false);
          setDosedSuccess(true);
          return 100;
        }
        return prev + 20;
      });
    }, 400);
  };

  const handleAddJobsite = (e) => {
    e.preventDefault();
    const newEntry = {
      id: `CLI-0${clients.length + 1}`,
      cliente: newClientName,
      cnpj: newCnpj || '00.000.000/0001-00',
      inscricaoEstadual: '13.999.888-1 MT',
      obrasAtivas: [
        {
          id: `OBRA-0${Math.floor(Math.random() * 90 + 10)}`,
          nome: newObraName,
          endereco: newEndereco,
          artNumero: `ART-CREA-MT-${Math.floor(Math.random() * 80000 + 10000)}`,
          engenheiroResponsavel: 'Eng. Civil Local',
          crea: '12499/D-MT',
          fckSolicitado: '30 MPa',
          volumeTotalContratadoM3: 150.0,
          volumeConsumidoM3: 0.0
        }
      ]
    };

    setClients([newEntry, ...clients]);
    setShowNewJobsite(false);
    setNewClientName('');
    setNewCnpj('');
    setNewObraName('');
    setNewEndereco('');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white p-4 rounded-2xl border border-concrete-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-stone-900 tracking-tight flex items-center gap-2">
            <span>CENTRAL DOSADORA CONVICTA 96T &amp; ENGENHARIA DE TRAÇOS</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-serrano-100 text-serrano-800 border border-serrano-200 font-mono">
              NBR 12655 / NBR 7212
            </span>
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Automação de pesagem individual de agregados, cimento e aditivos com compensação de umidade de areia
          </p>
        </div>

        <button
          onClick={() => setShowNewJobsite(true)}
          className="px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-colors self-start md:self-auto active:scale-98"
        >
          <Plus className="w-4 h-4 text-amber-300" />
          <span>Cadastrar Canteiro / Obra</span>
        </button>
      </div>

      {/* Main Grid: Traços Catalog + Convicta 96T Real Batch Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left: Traços Catalog (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wide text-stone-700 flex items-center justify-between">
            <span>Catálogo Homologado de Traços ({mixes.length})</span>
            <span className="text-[10px] text-stone-400 font-normal">Lab. Metrológico MT</span>
          </h3>

          <div className="space-y-2">
            {mixes.map(mix => {
              const isSelected = selectedMix?.id === mix.id;
              return (
                <div
                  key={mix.id}
                  onClick={() => { setSelectedMix(mix); setDosedSuccess(false); }}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    isSelected 
                      ? 'bg-white border-serrano-500 shadow-md ring-2 ring-serrano-100' 
                      : 'bg-white border-concrete-200 hover:border-concrete-300 shadow-2xs'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-stone-900">{mix.codigo}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-stone-100 text-stone-700">
                          {mix.fckMpa} MPa
                        </span>
                      </div>
                      <h4 className="font-bold text-stone-800 text-xs mt-0.5">{mix.nome}</h4>
                      <p className="text-[11px] text-stone-500 mt-0.5">{mix.aplicacao}</p>
                    </div>

                    <div className="text-right font-mono text-[11px]">
                      <span className="text-stone-400 text-[10px] block">Slump</span>
                      <strong className="text-stone-900">{mix.slumpCm} cm</strong>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1 mt-2.5 pt-2 border-t border-stone-100 text-[10px] font-mono text-stone-600">
                    <div>a/c: <strong className="text-stone-900">{mix.fatorAguaCimento}</strong></div>
                    <div>Cimento: <strong className="text-stone-900">{mix.proporcaoPorM3.cimentoKg} kg</strong></div>
                    <div>Areia: <strong className="text-stone-900">{mix.proporcaoPorM3.areiaMediaKg} kg</strong></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Convicta 96T Real Batch Calculator & Dosing Panel (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-concrete-200 shadow-xs space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold text-serrano-700 uppercase tracking-widest block">
                  CENTRAL CONVICTA 96T · AUTOMAÇÃO INDUSTRIAL
                </span>
                <h3 className="font-black text-stone-900 text-sm mt-0.5">
                  Batelada de Produção: {selectedMix.codigo} ({selectedMix.fckMpa} MPa)
                </h3>
              </div>

              {/* Volume selector */}
              <div className="flex items-center gap-2 bg-stone-100 p-1 rounded-xl">
                <span className="text-[11px] font-bold text-stone-600 pl-2">Volume:</span>
                {[6, 8, 10].map(vol => (
                  <button
                    key={vol}
                    type="button"
                    onClick={() => { setBatchVolume(vol); setDosedSuccess(false); }}
                    className={`px-2.5 py-1 rounded-lg font-mono font-bold text-xs transition-all ${
                      batchVolume === vol ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-900'
                    }`}
                  >
                    {vol} m³
                  </button>
                ))}
              </div>
            </div>

            {/* Silo Ingredients Real Weights Breakdown */}
            <div className="space-y-2">
              <label className="font-bold text-stone-800 uppercase tracking-wide text-[11px] block">
                Pesagem por Balança Individual de Silo ({batchVolume} m³):
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-[11px]">
                {/* Cimento */}
                <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200">
                  <span className="text-[10px] text-stone-400 font-sans block">SILO CIMENTO CP-II</span>
                  <strong className="text-stone-900 text-xs">
                    {(selectedMix.proporcaoPorM3.cimentoKg * batchVolume).toLocaleString('pt-BR')} kg
                  </strong>
                  <span className="text-[9px] text-stone-500 block font-sans">Tolerância: ±1%</span>
                </div>

                {/* Areia Lavada */}
                <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200">
                  <span className="text-[10px] text-stone-400 font-sans block">SILO AREIA LAVADA</span>
                  <strong className="text-stone-900 text-xs">
                    {(selectedMix.proporcaoPorM3.areiaMediaKg * batchVolume).toLocaleString('pt-BR')} kg
                  </strong>
                  <span className="text-[9px] text-emerald-600 block font-sans">Umidade: 3.8% comp.</span>
                </div>

                {/* Brita 0 */}
                <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200">
                  <span className="text-[10px] text-stone-400 font-sans block">SILO BRITA 0 (PEDRISCO)</span>
                  <strong className="text-stone-900 text-xs">
                    {(selectedMix.proporcaoPorM3.brita0Kg * batchVolume).toLocaleString('pt-BR')} kg
                  </strong>
                  <span className="text-[9px] text-stone-500 block font-sans">Mineração Serrano</span>
                </div>

                {/* Brita 1 */}
                <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200">
                  <span className="text-[10px] text-stone-400 font-sans block">SILO BRITA 1 (GRADUADA)</span>
                  <strong className="text-stone-900 text-xs">
                    {(selectedMix.proporcaoPorM3.brita1Kg * batchVolume).toLocaleString('pt-BR')} kg
                  </strong>
                  <span className="text-[9px] text-stone-500 block font-sans">Mineração Serrano</span>
                </div>

                {/* Água Resfriada */}
                <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200">
                  <span className="text-[10px] text-stone-400 font-sans block">DISPENSADOR ÁGUA RESFR.</span>
                  <strong className="text-stone-900 text-xs">
                    {(selectedMix.proporcaoPorM3.aguaLitros * batchVolume).toLocaleString('pt-BR')} L
                  </strong>
                  <span className="text-[9px] text-blue-600 block font-sans">Chiller a 18°C</span>
                </div>

                {/* Aditivo */}
                <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200">
                  <span className="text-[10px] text-stone-400 font-sans block">DOSADOR ADITIVO TECFLOW</span>
                  <strong className="text-stone-900 text-xs">
                    {((selectedMix.proporcaoPorM3.aditivoLitros || 2.8) * batchVolume).toFixed(1)} L
                  </strong>
                  <span className="text-[9px] text-purple-600 block font-sans">Plastificante Retardador</span>
                </div>
              </div>
            </div>

            {/* Total Batch Weight */}
            <div className="p-3 rounded-xl bg-stone-900 text-white flex items-center justify-between font-mono">
              <div>
                <span className="text-[10px] text-stone-400 block font-sans">PESO TOTAL TEÓRICO DA CARGA:</span>
                <span className="text-base font-black text-emerald-400">
                  {Math.round(2380 * batchVolume).toLocaleString('pt-BR')} kg ({((2380 * batchVolume) / 1000).toFixed(2)} t)
                </span>
              </div>
              <div className="text-right text-[11px] font-sans text-stone-400">
                Densidade Média: <strong className="text-white">2.380 kg/m³</strong>
              </div>
            </div>

            {/* Dosing Action / Progress */}
            <div className="space-y-2 pt-2">
              {isDosing && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono text-stone-600">
                    <span>Dosando Silos Convicta 96T...</span>
                    <strong>{dosingProgress}%</strong>
                  </div>
                  <div className="h-2 w-full bg-stone-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-serrano-500 rounded-full transition-all duration-300"
                      style={{ width: `${dosingProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {dosedSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <div>
                    <strong className="block text-emerald-900 font-bold">Batelada de {batchVolume} m³ Concluída!</strong>
                    <span>Concreto descarregado no balão da betoneira. Encaminhar veículo para a BAL-01 para 2ª pesagem.</span>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleStartDosing}
                  disabled={isDosing}
                  className="flex-1 py-3 bg-serrano-500 hover:bg-serrano-600 text-white font-bold rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>{isDosing ? 'Dosando Silos...' : `Iniciar Batelada Automática de ${batchVolume} m³`}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Active Jobsites Summary */}
          <div className="bg-white p-4 rounded-2xl border border-concrete-200 shadow-xs text-xs space-y-3">
            <h4 className="font-extrabold uppercase tracking-wide text-stone-800">
              Canteiros de Obras Homologados em Tangará da Serra ({clients.length})
            </h4>

            <div className="space-y-2">
              {clients.map(c => (
                <div key={c.id} className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <strong className="text-stone-900 block font-bold text-xs">{c.cliente}</strong>
                      <span className="text-[10px] font-mono text-stone-500">CNPJ: {c.cnpj} · IE: {c.inscricaoEstadual}</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-stone-200 text-stone-700">
                      {c.obrasAtivas.length} Obra(s)
                    </span>
                  </div>

                  <div className="mt-2 pt-2 border-t border-stone-200/60 space-y-1">
                    {c.obrasAtivas.map(o => (
                      <div key={o.id} className="flex items-center justify-between text-[11px] text-stone-600">
                        <span className="font-semibold text-stone-800 truncate max-w-[200px]">{o.nome}</span>
                        <span className="font-mono text-stone-500">{o.artNumero}</span>
                        <span className="text-stone-700">{o.fckSolicitado}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Modal: Novo Canteiro / Obra */}
      {showNewJobsite && (
        <div className="fixed inset-0 z-50 bg-stone-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-concrete-300 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 bg-stone-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-serrano-500 flex items-center justify-center text-white font-bold">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm tracking-tight">
                    NOVO CANTEIRO DE OBRA
                  </h3>
                  <p className="text-[11px] text-stone-400">
                    Cadastro de cliente e alvará de construção para fornecimento
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowNewJobsite(false)}
                className="p-1.5 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddJobsite} className="p-5 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Razão Social / Cliente:</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Construtora Buritis Ltda"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    className="w-full p-2 rounded-xl border border-stone-300 focus:outline-none focus:border-serrano-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-700 block mb-1">CNPJ:</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 14.888.999/0001-22"
                    value={newCnpj}
                    onChange={(e) => setNewCnpj(e.target.value)}
                    className="w-full p-2 rounded-xl border border-stone-300 font-mono focus:outline-none focus:border-serrano-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">Nome da Obra / Empreendimento:</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Residencial Parque dos Ipês - Torre B"
                  value={newObraName}
                  onChange={(e) => setNewObraName(e.target.value)}
                  className="w-full p-2 rounded-xl border border-stone-300 focus:outline-none focus:border-serrano-500"
                />
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">Endereço Completo (Tangará da Serra / MT):</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Av. Brasil, 1500 - Vila Alta"
                  value={newEndereco}
                  onChange={(e) => setNewEndereco(e.target.value)}
                  className="w-full p-2 rounded-xl border border-stone-300 focus:outline-none focus:border-serrano-500"
                />
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewJobsite(false)}
                  className="px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-100 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold shadow-md transition-colors flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Salvar Canteiro</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
