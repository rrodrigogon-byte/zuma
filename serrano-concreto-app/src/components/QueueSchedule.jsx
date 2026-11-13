import React, { useState } from 'react';
import { 
  CalendarClock, 
  Truck, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Plus, 
  Building2, 
  Flame, 
  Timer, 
  ArrowRight,
  MapPin
} from 'lucide-react';
import { SCHEDULED_POURS } from '../data/mockData';

export default function QueueSchedule({ vehicles, onScheduleNew }) {
  const [selectedPour, setSelectedPour] = useState(SCHEDULED_POURS[0]);
  const [showNewModal, setShowNewModal] = useState(false);

  // New Pour form state
  const [newClient, setNewClient] = useState('');
  const [newObra, setNewObra] = useState('');
  const [newTraco, setNewTraco] = useState('TR-FCK30B');
  const [newVolume, setNewVolume] = useState('40');
  const [newHora, setNewHora] = useState('14:30');

  const handleCreatePour = (e) => {
    e.preventDefault();
    alert(`Novo agendamento criado com sucesso para ${newClient || 'Cliente'} (${newVolume} m³ de ${newTraco})!`);
    setShowNewModal(false);
  };

  return (
    <div className="space-y-4">
      
      {/* Top Header */}
      <div className="bg-white p-4 rounded-2xl border border-concrete-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-stone-900 tracking-tight flex items-center gap-2">
            <span>PROGRAMAÇÃO DE CONCRETAGEM & FILA INTELIGENTE</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-serrano-100 text-serrano-800 border border-serrano-200">
              Controle de Slump & Pega
            </span>
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Logística de betoneiras para canteiros de obras em Tangará da Serra · Janela crítica de 2h30 para hidratação
          </p>
        </div>

        <button
          onClick={() => setShowNewModal(true)}
          className="px-3.5 py-2 bg-serrano-500 hover:bg-serrano-600 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-colors self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Agendamento</span>
        </button>
      </div>

      {/* Critical Slump & Pega Alert Banner */}
      <div className="bg-gradient-to-r from-amber-500/10 via-serrano-500/10 to-transparent p-3.5 rounded-2xl border border-amber-200/80 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500 text-white flex-shrink-0">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <span className="font-extrabold text-stone-900">Monitoramento Térmico & Perda de Trabalhabilidade (Slump Loss): </span>
            <span className="text-stone-700">O traço TR-FCK30B possui aditivo retardador garantindo 150 minutos de trabalhabilidade até 32°C. Todas as betoneiras estão dentro do limite seguro.</span>
          </div>
        </div>
        <div className="text-[11px] font-mono font-bold text-stone-800 bg-white px-2.5 py-1 rounded-lg border border-amber-300 self-start sm:self-auto whitespace-nowrap">
          Tempo Médio Ciclo: 48 min
        </div>
      </div>

      {/* Two Columns: Active Scheduled Pours & Fleet Tracking */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left: Scheduled Pours (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wide text-stone-700 flex items-center justify-between">
            <span>Obras Programadas Hoje</span>
            <span className="text-[10px] text-stone-400 font-normal">3 canteiros ativos</span>
          </h3>

          {SCHEDULED_POURS.map(pour => {
            const pct = Math.round((pour.volumeEntregueM3 / pour.volumeTotalM3) * 100);
            const isSelected = selectedPour.id === pour.id;

            return (
              <div 
                key={pour.id}
                onClick={() => setSelectedPour(pour)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  isSelected 
                    ? 'bg-white border-serrano-400 shadow-sm ring-2 ring-serrano-100' 
                    : 'bg-white border-concrete-200 hover:border-stone-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-serrano-700 block">
                      {pour.cliente}
                    </span>
                    <h4 className="font-bold text-sm text-stone-900 mt-0.5">
                      {pour.obra}
                    </h4>
                    <p className="text-xs text-stone-500 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-stone-400 flex-shrink-0" />
                      <span>{pour.endereco} · <strong className="text-stone-700">{pour.elemento}</strong></span>
                    </p>
                  </div>

                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    pct > 50 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {pour.status}
                  </span>
                </div>

                {/* Progress Bar of Volume */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-stone-600">
                      Volume Expedido: <strong className="text-stone-900 font-mono">{pour.volumeEntregueM3} m³</strong> de <strong className="text-stone-900 font-mono">{pour.volumeTotalM3} m³</strong>
                    </span>
                    <span className="font-mono font-bold text-stone-800">{pct}%</span>
                  </div>
                  <div className="w-full bg-stone-100 h-2.5 rounded-full overflow-hidden border border-stone-200">
                    <div 
                      className="bg-gradient-to-r from-serrano-500 to-amber-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Technical Specs Footer */}
                <div className="mt-3 pt-2.5 border-t border-concrete-100 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-stone-600">
                  <div>
                    <span className="text-stone-400 block text-[10px]">TRAÇO / SLUMP</span>
                    <span className="font-bold text-stone-800">{pour.traco}</span> ({pour.slump})
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px]">EQUIPAMENTO</span>
                    <span className="font-semibold text-stone-800">{pour.bomba}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px]">INTERVALO</span>
                    <span className="font-semibold text-stone-800">{pour.intervaloBateladasMin} min / betoneira</span>
                  </div>
                </div>

                {/* Assigned Trucks */}
                <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-stone-400 font-semibold mr-1">FROTA:</span>
                  {pour.betoneirasDesignadas.map(b => (
                    <span key={b} className="text-[10px] font-mono px-2 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-200">
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Real-time Truck Queue in Site (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wide text-stone-700 flex items-center justify-between">
            <span>Fila Operacional de Veículos</span>
            <span className="text-[10px] text-stone-500 font-normal">Tempo real</span>
          </h3>

          <div className="bg-white p-4 rounded-2xl border border-concrete-200 shadow-xs space-y-3">
            {vehicles.map((veh, idx) => (
              <div 
                key={veh.id}
                className="p-3 rounded-xl border border-stone-200 bg-stone-50/60 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-stone-800 text-white font-mono font-bold flex items-center justify-center text-xs flex-shrink-0">
                    {idx + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 font-bold text-stone-900">
                      <span>{veh.prefixo}</span>
                      <span className="text-stone-400 font-normal font-mono">({veh.placa})</span>
                    </div>
                    <div className="text-[11px] text-stone-500">
                      {veh.motorista} · {veh.tipo}
                    </div>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    veh.localizacao === 'balanca' ? 'bg-amber-100 text-amber-800' :
                    veh.localizacao === 'excecao' ? 'bg-rose-100 text-rose-800' :
                    veh.localizacao === 'dosadora' ? 'bg-blue-100 text-blue-800' : 'bg-stone-200 text-stone-700'
                  }`}>
                    {veh.statusTag}
                  </span>
                  <div className="text-[10px] font-mono text-stone-400 mt-1">
                    Entrada: {veh.horaEntrada}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Productivity Target Card */}
          <div className="bg-stone-900 text-white p-4 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-bold text-amber-300 uppercase tracking-wide">Meta de Atendimento</span>
              <span className="font-mono text-stone-300">88% Concluída</span>
            </div>
            <p className="text-[11px] text-stone-300 leading-relaxed">
              Vazão média atual da central Convicta: <strong className="text-white">62 m³/hora</strong>. Nenhum caminhão parado por tempo superior ao limite regulamentar NBR 7212.
            </p>
          </div>

        </div>

      </div>

      {/* Modal Novo Agendamento */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-stone-200">
            <h3 className="text-base font-extrabold text-stone-900 mb-1">
              Novo Agendamento de Concretagem
            </h3>
            <p className="text-xs text-stone-500 mb-4">
              Defina o canteiro, classe de resistência e volume total para programação das betoneiras.
            </p>

            <form onSubmit={handleCreatePour} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-stone-700 block mb-1">Cliente / Construtora</label>
                <input 
                  type="text" 
                  value={newClient}
                  onChange={(e) => setNewClient(e.target.value)}
                  placeholder="Ex: Construtora Pantanal"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:border-serrano-500"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">Nome da Obra & Endereço</label>
                <input 
                  type="text" 
                  value={newObra}
                  onChange={(e) => setNewObra(e.target.value)}
                  placeholder="Ex: Edifício Tangará Tower - Av. Brasil"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:border-serrano-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Traço FCK</label>
                  <select 
                    value={newTraco}
                    onChange={(e) => setNewTraco(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:border-serrano-500"
                  >
                    <option value="TR-FCK20">TR-FCK20 (20 MPa Piso)</option>
                    <option value="TR-FCK25">TR-FCK25 (25 MPa Estrutural)</option>
                    <option value="TR-FCK30B">TR-FCK30B (30 MPa Bombeável)</option>
                    <option value="TR-FCK35B">TR-FCK35B (35 MPa Alta Resistência)</option>
                    <option value="TR-FCK40ARI">TR-FCK40ARI (40 MPa ARI)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-stone-700 block mb-1">Volume Total (m³)</label>
                  <input 
                    type="number" 
                    value={newVolume}
                    onChange={(e) => setNewVolume(e.target.value)}
                    placeholder="40"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:border-serrano-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">Horário de Início</label>
                <input 
                  type="time" 
                  value={newHora}
                  onChange={(e) => setNewHora(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:border-serrano-500"
                  required
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-3.5 py-2 rounded-xl text-stone-600 hover:bg-stone-100 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-serrano-500 hover:bg-serrano-600 text-white rounded-xl font-bold shadow-xs"
                >
                  Confirmar Agendamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
