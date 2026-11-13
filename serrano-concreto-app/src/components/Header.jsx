import React from 'react';
import { 
  Scale, 
  Clock, 
  Sparkles, 
  Play, 
  Pause, 
  FastForward, 
  Truck, 
  Radio, 
  ShieldAlert, 
  RefreshCw,
  Building2
} from 'lucide-react';

export default function Header({ 
  stats, 
  weighbridges, 
  currentTime, 
  simSpeed, 
  setSimSpeed, 
  isPaused, 
  setIsPaused, 
  onTriggerArrival, 
  onTriggerException, 
  onOpenCopilot,
  selectedUnit,
  setSelectedUnit,
  onOpenTicket
}) {
  return (
    <header className="bg-white border-b border-concrete-200 sticky top-0 z-30 px-4 py-2.5 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        
        {/* Logo & Company Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-serrano-500 text-white flex items-center justify-center font-black tracking-wider shadow-sm text-lg flex-shrink-0">
            SC
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold text-stone-900 tracking-tight leading-tight">
                TORRE PESAGEM
              </h1>
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 border border-stone-200">
                Central CCO
              </span>
            </div>
            <p className="text-xs text-stone-500 font-medium">
              Serrano Concreto & Mineração · <span className="text-stone-700 font-semibold">Tangará da Serra (MT)</span>
            </p>
          </div>
        </div>

        {/* Live Weighbridges Status Pill Cards */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
          
          {/* BAL-01: Usina MT-358 */}
          <div 
            onClick={() => onOpenTicket && onOpenTicket('bal01')}
            className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-all ${
              weighbridges.bal01.statusPista === 'ocupada'
                ? 'bg-amber-50/70 border-amber-300 hover:border-amber-400'
                : 'bg-stone-50 border-stone-200 hover:border-stone-300'
            }`}
            title="Clique para inspecionar pesagem e emitir ticket"
          >
            <div className="relative">
              <span className={`w-2.5 h-2.5 rounded-full block ${
                weighbridges.bal01.statusPista === 'ocupada' ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
              }`} />
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-bold text-stone-800">
                <span>BAL-01</span>
                <span className="text-stone-400 font-normal">·</span>
                <span className="font-semibold text-stone-600">Balança Usina</span>
              </div>
              <div className="text-[10px] text-stone-500">
                {weighbridges.bal01.statusPista === 'ocupada' 
                  ? `${weighbridges.bal01.veiculoAtual?.placa || 'Veículo'} · ${weighbridges.bal01.veiculoAtual?.tipoOperacao || 'Pesagem'}` 
                  : 'pista livre · fila 0'}
              </div>
            </div>
            <div className="font-mono font-bold text-sm text-stone-900 bg-white px-2 py-0.5 rounded border border-stone-200 shadow-inner">
              {weighbridges.bal01.pesoAtualKg.toLocaleString('pt-BR')} <span className="text-[10px] font-sans font-normal text-stone-500">kg</span>
            </div>
          </div>

          {/* BAL-02: Mineração Rio Sangue */}
          <div 
            onClick={() => onOpenTicket && onOpenTicket('bal02')}
            className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-all ${
              weighbridges.bal02.statusPista === 'ocupada'
                ? 'bg-amber-50/70 border-amber-300 hover:border-amber-400'
                : 'bg-stone-50 border-stone-200 hover:border-stone-300'
            }`}
            title="Clique para inspecionar pesagem da mineração"
          >
            <div className="relative">
              <span className={`w-2.5 h-2.5 rounded-full block ${
                weighbridges.bal02.statusPista === 'ocupada' ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
              }`} />
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-bold text-stone-800">
                <span>BAL-02</span>
                <span className="text-stone-400 font-normal">·</span>
                <span className="font-semibold text-stone-600">Balança Mineração</span>
              </div>
              <div className="text-[10px] text-stone-500">
                {weighbridges.bal02.statusPista === 'ocupada' 
                  ? 'Veículo em pesagem' 
                  : 'pista livre · fila 0'}
              </div>
            </div>
            <div className="font-mono font-bold text-sm text-stone-900 bg-white px-2 py-0.5 rounded border border-stone-200 shadow-inner">
              {weighbridges.bal02.pesoAtualKg.toLocaleString('pt-BR')} <span className="text-[10px] font-sans font-normal text-stone-500">kg</span>
            </div>
          </div>

        </div>

        {/* Right Section: Time Controls & KyttoIA Copilot */}
        <div className="flex items-center gap-2.5 flex-wrap justify-end">
          
          {/* Simulation Clock & Speed Controls */}
          <div className="flex items-center gap-1.5 bg-stone-100/80 px-2.5 py-1 rounded-lg border border-stone-200 text-xs">
            <Clock className="w-3.5 h-3.5 text-stone-500" />
            <span className="font-mono font-bold text-stone-800 text-xs">{currentTime}</span>
            <div className="h-3 w-px bg-stone-300 mx-0.5" />
            
            {/* Speed Multipliers */}
            <div className="flex items-center gap-1">
              {[
                { speed: 1, label: '1x' },
                { speed: 10, label: '10x' },
                { speed: 30, label: '30x' },
                { speed: 60, label: '60x' }
              ].map(({ speed, label }) => (
                <button
                  key={speed}
                  onClick={() => { setSimSpeed(speed); setIsPaused(false); }}
                  className={`px-1.5 py-0.5 text-[11px] font-semibold rounded transition-colors ${
                    !isPaused && simSpeed === speed 
                      ? 'bg-stone-800 text-white shadow-xs' 
                      : 'text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {label}
                </button>
              ))}

              <button
                onClick={() => setIsPaused(!isPaused)}
                className={`p-1 rounded text-stone-600 hover:bg-stone-200 ${isPaused ? 'text-amber-600 font-bold' : ''}`}
                title={isPaused ? "Retomar simulação" : "Pausar simulação"}
              >
                {isPaused ? <Play className="w-3 h-3 fill-current" /> : <Pause className="w-3 h-3 fill-current" />}
              </button>
            </div>
          </div>

          {/* Quick Simulation Trigger Buttons */}
          <div className="hidden sm:flex items-center gap-1">
            <button
              onClick={onTriggerArrival}
              className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-md border border-stone-200 transition-colors"
              title="Simular chegada de novo caminhão betoneira na usina"
            >
              <Truck className="w-3 h-3 text-serrano-600" />
              <span>+ Chegada</span>
            </button>
            <button
              onClick={onTriggerException}
              className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-md border border-rose-200 transition-colors"
              title="Simular anomalia de pesagem/tara para o Motor KyttoIA"
            >
              <ShieldAlert className="w-3 h-3 text-rose-600" />
              <span>+ Anomalia</span>
            </button>
          </div>

          {/* Copiloto KyttoIA Button */}
          <button
            onClick={onOpenCopilot}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-serrano-500 to-amber-600 text-white text-xs font-semibold rounded-lg shadow-sm hover:from-serrano-600 hover:to-amber-700 transition-all active:scale-98"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-200 animate-spin-slow" />
            <span>Copiloto</span>
            <kbd className="hidden sm:inline-block text-[10px] bg-black/20 text-white/90 px-1 py-0.2 rounded font-mono ml-0.5">
              Ctrl K
            </kbd>
          </button>

        </div>

      </div>
    </header>
  );
}
