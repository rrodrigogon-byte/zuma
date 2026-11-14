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
  MapPin,
  X,
  Droplet,
  Send,
  Check
} from 'lucide-react';
import { SCHEDULED_POURS as INITIAL_POURS } from '../data/mockData';

export default function QueueSchedule({ 
  vehicles = [], 
  pours = INITIAL_POURS, 
  onAddPour, 
  onDispatchMixer,
  onOpenTicket
}) {
  const [scheduledPours, setScheduledPours] = useState(pours);
  const [selectedPour, setSelectedPour] = useState(pours[0] || null);
  const [showNewModal, setShowNewModal] = useState(false);

  // New Pour form state
  const [newClient, setNewClient] = useState('');
  const [newObra, setNewObra] = useState('');
  const [newEndereco, setNewEndereco] = useState('');
  const [newTraco, setNewTraco] = useState('TR-FCK30B');
  const [newVolume, setNewVolume] = useState('48');
  const [newHora, setNewHora] = useState('14:30');
  const [newBomba, setNewBomba] = useState('Bomba Lança Schwing 36m (B-02)');

  const handleCreatePour = (e) => {
    e.preventDefault();
    const newPourObj = {
      id: `SCH-${String(scheduledPours.length + 1).padStart(2, '0')}`,
      obra: newObra || 'Nova Obra Tangará',
      cliente: newClient || 'Construtora Cliente',
      endereco: newEndereco || 'Tangará da Serra (MT)',
      elemento: 'Estrutura / Laje',
      volumeTotalM3: Number(newVolume) || 40.0,
      volumeEntregueM3: 0.0,
      traco: newTraco,
      slump: '16 ± 3 cm',
      bomba: newBomba,
      intervaloBateladasMin: 25,
      horaInicio: newHora,
      previsaoTermino: '18:00',
      betoneirasDesignadas: ['BT-05 (10m³)', 'BT-06 (8m³)'],
      status: 'Aguardando Início (0%)'
    };

    setScheduledPours(prev => [newPourObj, ...prev]);
    setSelectedPour(newPourObj);
    if (onAddPour) onAddPour(newPourObj);
    setShowNewModal(false);

    // Reset fields
    setNewClient('');
    setNewObra('');
    setNewEndereco('');
    setNewVolume('48');
  };

  const handleDispatchTruck = (pourId) => {
    setScheduledPours(prev => prev.map(p => {
      if (p.id === pourId) {
        const novoEntregue = Math.min(p.volumeTotalM3, p.volumeEntregueM3 + 8.0);
        const pct = Math.round((novoEntregue / p.volumeTotalM3) * 100);
        return {
          ...p,
          volumeEntregueM3: novoEntregue,
          status: pct >= 100 ? 'Concluído (100%)' : `Em andamento (${pct}%)`
        };
      }
      return p;
    }));

    if (selectedPour && selectedPour.id === pourId) {
      const novoEntregue = Math.min(selectedPour.volumeTotalM3, selectedPour.volumeEntregueM3 + 8.0);
      const pct = Math.round((novoEntregue / selectedPour.volumeTotalM3) * 100);
      setSelectedPour(prev => ({
        ...prev,
        volumeEntregueM3: novoEntregue,
        status: pct >= 100 ? 'Concluído (100%)' : `Em andamento (${pct}%)`
      }));
    }

    if (onDispatchMixer) onDispatchMixer(pourId);
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="bg-white p-4 rounded-2xl border border-concrete-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-stone-900 tracking-tight flex items-center gap-2">
            <span>PROGRAMAÇÃO DE CONCRETAGEM &amp; FILA INTELIGENTE</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-serrano-100 text-serrano-800 border border-serrano-200 font-mono">
              ABNT NBR 7212
            </span>
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Logística de betoneiras em Tangará da Serra · Controle térmico da hidratação e janela crítica de 150 min
          </p>
        </div>

        <button
          onClick={() => setShowNewModal(true)}
          className="px-3.5 py-2 bg-serrano-500 hover:bg-serrano-600 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-colors self-start md:self-auto active:scale-98"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Agendamento</span>
        </button>
      </div>

      {/* Critical Slump & Pega Alert Banner */}
      <div className="bg-amber-500/10 border border-amber-300 p-3.5 rounded-2xl flex items-start gap-3 text-xs">
        <Flame className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <strong className="text-amber-950 font-bold">ALERTA TÉRMICO OPERACIONAL (Tangará da Serra · 33°C):</strong>
            <span className="text-[10px] bg-amber-200/80 text-amber-900 font-bold px-1.5 py-0.2 rounded font-mono">
              Slump Loss +1,8 cm/h
            </span>
          </div>
          <p className="text-amber-900/90 mt-0.5 leading-relaxed text-[11px]">
            Conforme a ABNT NBR 7212, o descarregamento deve iniciar em até 150 minutos da batelada. Devido à temperatura ambiente acima de 30°C, a KyttoIA recomenda aplicação do aditivo retardador TecFlow R e velocidade constante de giro do balão (2 a 4 RPM) para preservar o abatimento especificado.
          </p>
        </div>
      </div>

      {/* Main Grid: Scheduled Pours List (7 cols) + Pour Detail & Dispatch (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left: Active Scheduled Pours */}
        <div className="lg:col-span-7 space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wide text-stone-700 flex items-center justify-between">
            <span>Concretagens Agendadas Hoje ({scheduledPours.length} Obras)</span>
            <span className="text-[10px] text-stone-400 font-normal">Sincronizado CCO</span>
          </h3>

          <div className="space-y-2.5">
            {scheduledPours.map(pour => {
              const isSelected = selectedPour?.id === pour.id;
              const pct = Math.round((pour.volumeEntregueM3 / pour.volumeTotalM3) * 100);
              return (
                <div
                  key={pour.id}
                  onClick={() => setSelectedPour(pour)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    isSelected 
                      ? 'bg-white border-serrano-500 shadow-md ring-2 ring-serrano-100' 
                      : 'bg-white border-concrete-200 hover:border-concrete-300 shadow-2xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-stone-900">{pour.id}</span>
                        <h4 className="font-bold text-stone-900 text-xs">{pour.obra}</h4>
                      </div>
                      <p className="text-[11px] text-stone-500 flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3 h-3 text-stone-400" />
                        <span>{pour.cliente} · {pour.endereco}</span>
                      </p>
                    </div>

                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      pct >= 100 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : pct > 0 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-stone-100 text-stone-700'
                    }`}>
                      {pour.status}
                    </span>
                  </div>

                  {/* Progress Bar of Concrete Delivery */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono">
                      <span className="text-stone-500">Volume Entregue:</span>
                      <strong className="text-stone-900">
                        {pour.volumeEntregueM3.toFixed(1)} / {pour.volumeTotalM3.toFixed(1)} m³ ({pct}%)
                      </strong>
                    </div>
                    <div className="h-2 w-full bg-stone-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-serrano-500 rounded-full transition-all duration-500" 
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Designated Mixers Tags */}
                  <div className="flex items-center gap-2 mt-3 pt-2 border-t border-stone-100 text-[11px] text-stone-600 flex-wrap">
                    <span className="font-semibold text-stone-500">Traço:</span>
                    <span className="font-mono font-bold text-stone-800 bg-stone-100 px-1.5 py-0.2 rounded">
                      {pour.traco}
                    </span>
                    <span className="text-stone-400">·</span>
                    <span className="font-semibold text-stone-500">Bomba:</span>
                    <span className="text-stone-700 truncate max-w-[140px]">{pour.bomba}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Pour Logistics Detail & Dispatch Controls */}
        <div className="lg:col-span-5 space-y-4">
          {selectedPour ? (
            <div className="bg-white p-5 rounded-2xl border border-concrete-200 shadow-xs space-y-4 text-xs">
              <div className="border-b border-stone-100 pb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono font-bold text-serrano-700 uppercase tracking-widest">
                    DETALHES LOGÍSTICOS DO CANTEIRO
                  </span>
                  <span className="font-mono text-stone-400">{selectedPour.id}</span>
                </div>
                <h3 className="font-black text-stone-900 text-sm leading-snug">
                  {selectedPour.obra}
                </h3>
                <p className="text-stone-500 text-[11px] flex items-center gap-1 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-stone-400" />
                  <span>{selectedPour.endereco}</span>
                </p>
              </div>

              {/* Slump Loss Real-Time Gauge */}
              <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-800 flex items-center gap-1.5 text-[11px]">
                    <Timer className="w-4 h-4 text-serrano-600" />
                    <span>Janela de Hidratação NBR 7212</span>
                  </span>
                  <span className="font-mono font-bold text-stone-900 text-[11px]">
                    Máx. 150 min
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center pt-1 font-mono text-[11px]">
                  <div className="bg-white p-2 rounded-lg border border-stone-200">
                    <span className="text-[10px] text-stone-400 block font-sans">SLUMP ALVO</span>
                    <strong className="text-stone-800 text-xs">{selectedPour.slump}</strong>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-stone-200">
                    <span className="text-[10px] text-stone-400 block font-sans">INTERVALO BETONEIRAS</span>
                    <strong className="text-stone-800 text-xs">{selectedPour.intervaloBateladasMin} min</strong>
                  </div>
                </div>
              </div>

              {/* Designated Mixers List */}
              <div>
                <label className="font-bold text-stone-800 block mb-2 text-[11px] uppercase tracking-wide">
                  Betoneiras Escaladas na Linha:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {selectedPour.betoneirasDesignadas.map((b, idx) => (
                    <div 
                      key={idx}
                      className="p-2.5 rounded-xl bg-stone-50 border border-stone-200 flex items-center gap-2 text-stone-800 font-mono text-[11px]"
                    >
                      <Truck className="w-3.5 h-3.5 text-serrano-600" />
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dispatch Action Button */}
              <div className="pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => handleDispatchTruck(selectedPour.id)}
                  className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 active:scale-98"
                >
                  <Send className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Despachar Próxima Betoneira (8.0 m³)</span>
                </button>
                <p className="text-[10px] text-stone-400 text-center mt-1.5">
                  Gera batelada Convicta 96T, autoriza MDF-e na SEFAZ e envia caminhão para a BAL-01
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white p-8 rounded-2xl border border-concrete-200 text-center text-stone-400 text-xs">
              Selecione uma concretagem agendada para ver a logística
            </div>
          )}
        </div>

      </div>

      {/* Modal: Novo Agendamento */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-concrete-300 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 bg-stone-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-serrano-500 flex items-center justify-center text-white font-bold">
                  <CalendarClock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm tracking-tight">
                    NOVO AGENDAMENTO DE CONCRETAGEM
                  </h3>
                  <p className="text-[11px] text-stone-400">
                    Programação de canteiro em Tangará da Serra (NBR 7212)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowNewModal(false)}
                className="p-1.5 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePour} className="p-5 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Cliente / Construtora:</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Construtora Buritis"
                    value={newClient}
                    onChange={(e) => setNewClient(e.target.value)}
                    className="w-full p-2 rounded-xl border border-stone-300 focus:outline-none focus:border-serrano-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Nome da Obra:</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Edifício Tangará Prime"
                    value={newObra}
                    onChange={(e) => setNewObra(e.target.value)}
                    className="w-full p-2 rounded-xl border border-stone-300 focus:outline-none focus:border-serrano-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">Endereço do Canteiro em Tangará da Serra:</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Av. Tancredo Neves, 840 - Jardim Europa"
                  value={newEndereco}
                  onChange={(e) => setNewEndereco(e.target.value)}
                  className="w-full p-2 rounded-xl border border-stone-300 focus:outline-none focus:border-serrano-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Traço FCK:</label>
                  <select
                    value={newTraco}
                    onChange={(e) => setNewTraco(e.target.value)}
                    className="w-full p-2 rounded-xl border border-stone-300 font-mono focus:outline-none focus:border-serrano-500"
                  >
                    <option value="TR-FCK30B">TR-FCK30B (30 MPa)</option>
                    <option value="TR-FCK25">TR-FCK25 (25 MPa)</option>
                    <option value="TR-FCK35B">TR-FCK35B (35 MPa)</option>
                    <option value="TR-FCK40ARI">TR-FCK40ARI (40 MPa)</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Volume (m³):</label>
                  <input
                    type="number"
                    required
                    min="6"
                    max="500"
                    value={newVolume}
                    onChange={(e) => setNewVolume(e.target.value)}
                    className="w-full p-2 rounded-xl border border-stone-300 font-mono focus:outline-none focus:border-serrano-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Início:</label>
                  <input
                    type="time"
                    required
                    value={newHora}
                    onChange={(e) => setNewHora(e.target.value)}
                    className="w-full p-2 rounded-xl border border-stone-300 font-mono focus:outline-none focus:border-serrano-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">Bomba Designada:</label>
                <select
                  value={newBomba}
                  onChange={(e) => setNewBomba(e.target.value)}
                  className="w-full p-2 rounded-xl border border-stone-300 focus:outline-none focus:border-serrano-500"
                >
                  <option value="Bomba Lança Schwing 36m (B-02)">Bomba Lança Schwing 36m (B-02)</option>
                  <option value="Bomba Estacionária Putzmeister (B-01)">Bomba Estacionária Putzmeister (B-01)</option>
                  <option value="Descarga Direta em Calha (Sem Bomba)">Descarga Direta em Calha (Sem Bomba)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-100 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold shadow-md transition-colors flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Cadastrar Agendamento</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
