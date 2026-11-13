import React, { useState } from 'react';
import { 
  Truck, 
  Scale, 
  Layers, 
  Building, 
  Droplets, 
  AlertTriangle, 
  CheckCircle2, 
  Info,
  Sliders,
  Eye,
  Maximize2,
  X,
  Activity,
  Cpu,
  Gauge,
  Thermometer,
  Zap,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  Wifi,
  RefreshCw,
  Clock,
  Radio
} from 'lucide-react';

export default function DigitalTwin({ 
  unit, 
  setUnit, 
  vehicles, 
  silos, 
  dosingPlant, 
  weighbridges, 
  onSelectVehicle, 
  onSelectSilo,
  onOpenBalancaCockpit,
  onNavigateTab
}) {
  const [selectedStation, setSelectedStation] = useState(null);
  const [inspectedVehicle, setInspectedVehicle] = useState(null);

  // Status dot legend
  const STATUS_LEGEND = [
    { label: 'Na fila', color: 'bg-stone-400' },
    { label: 'Na balança', color: 'bg-amber-500 ring-2 ring-amber-300 animate-pulse' },
    { label: 'No pátio', color: 'bg-blue-600' },
    { label: 'Exceção', color: 'bg-rose-500 ring-2 ring-rose-300 animate-bounce' },
    { label: 'Saindo', color: 'bg-emerald-500' },
  ];

  const filteredVehicles = vehicles.filter(v => v.unidade === unit);

  // Handle vehicle click
  const handleVehicleClick = (veh, e) => {
    e.stopPropagation();
    setInspectedVehicle(veh);
  };

  return (
    <div className="bg-white rounded-2xl border border-concrete-200 shadow-xs p-4 flex flex-col h-full relative">
      
      {/* Top Header of the Digital Twin */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-concrete-100 gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-serrano-500 animate-ping" />
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-stone-900">
            {unit === 'usina' ? 'GÊMEO DIGITAL · USINA MT-358' : 'GÊMEO DIGITAL · MINERAÇÃO RIO SANGUE'}
          </h2>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200">
            Telemetria Ativa
          </span>
        </div>

        {/* Status Legend Pills */}
        <div className="flex items-center gap-3 overflow-x-auto text-[11px] font-semibold text-stone-600">
          {STATUS_LEGEND.map(item => (
            <div key={item.label} className="flex items-center gap-1.5 flex-shrink-0">
              <span className={`w-2 h-2 rounded-full ${item.color}`} />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Schematic Operational Canvas */}
      <div className="relative flex-1 min-h-[460px] bg-[#EFECE6] rounded-xl mt-3 p-4 border border-stone-200/80 overflow-hidden select-none">
        
        {/* Unit 1: Usina Concreto MT-358 */}
        {unit === 'usina' && (
          <div className="relative w-full h-full min-h-[440px]">
            
            {/* Roads & Conveyor Belt Paths SVG */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none stroke-stone-300 stroke-[24] fill-none stroke-linecap-round stroke-linejoin-round">
              <path d="M 60 400 L 60 300 L 400 300 L 400 80 L 760 80" />
              <path d="M 400 300 L 760 300" />
              <path d="M 240 300 L 240 80" />
              <path d="M 400 300 L 400 420" strokeDasharray="8 8" stroke="#f43f5e" strokeWidth="16" />
            </svg>

            {/* STATION 1: CCO & Escritório Central */}
            <div 
              onClick={() => setSelectedStation('cco')}
              className="absolute top-4 left-4 w-44 p-3 bg-white/95 rounded-xl border border-stone-200 shadow-xs hover:border-stone-400 cursor-pointer transition-all z-10 hover:shadow-md"
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">CCO · Escritório</div>
              <div className="text-xs font-bold text-stone-900 mt-0.5 flex items-center justify-between">
                <span>Torre de pesagem</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>
              <div className="text-[10px] text-stone-500 mt-1">
                Operador: <span className="font-semibold text-stone-700">Automático</span> (Supervisão Remota)
              </div>
            </div>

            {/* STATION 2: Lavagem de Betoneiras */}
            <div 
              onClick={() => setSelectedStation('lavagem')}
              className="absolute top-4 left-56 w-48 p-3 bg-stone-50/90 border border-dashed border-stone-300 rounded-xl hover:border-blue-400 cursor-pointer transition-all z-10 hover:bg-white hover:shadow-md"
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1">
                <Droplets className="w-3 h-3 text-blue-500" />
                <span>LAVAGEM DE BETONEIRAS</span>
              </div>
              <div className="text-xs font-semibold text-stone-800 mt-1">
                Reciclador de Água & Resíduos
              </div>
              <div className="text-[10px] text-stone-500">
                1 caminhão em limpeza de balão (BT-12)
              </div>
            </div>

            {/* STATION 3: Central Dosadora (Convicta 96t) */}
            <div 
              onClick={() => setSelectedStation('dosadora')}
              className="absolute top-4 right-52 w-48 p-3.5 bg-white rounded-xl border-2 border-stone-800 shadow-sm hover:border-serrano-500 cursor-pointer transition-all z-10 hover:shadow-md"
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">CENTRAL DOSADORA</div>
              <div className="text-sm font-extrabold text-stone-900 flex items-center justify-between mt-0.5">
                <span>Convicta 96t</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 animate-pulse">
                  Dosando 65%
                </span>
              </div>
              {/* Mini Mixing Animation */}
              <div className="mt-2 pt-2 border-t border-stone-100 flex items-center justify-between">
                <div className="text-[10px] text-stone-500">
                  Sensor: <span className="font-mono font-bold text-stone-800">BT-06</span>
                </div>
                <div className="w-6 h-6 rounded-full border border-stone-400 border-t-amber-500 animate-spin" />
              </div>
            </div>

            {/* STATION 4: Silos de Cimento */}
            <div 
              onClick={() => setSelectedStation('silos')}
              className="absolute top-4 right-4 w-44 p-3 bg-white rounded-xl border border-stone-200 shadow-xs hover:border-stone-400 cursor-pointer transition-all z-10 hover:shadow-md"
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 flex items-center justify-between">
                <span>SILOS DE CIMENTO</span>
                <span className="text-[10px] text-stone-400">3 unidades</span>
              </div>
              {/* 3 Silos Graphic */}
              <div className="flex items-end justify-between gap-2 mt-2 h-20 px-1">
                {silos.map((s) => (
                  <div key={s.id} className="flex-1 flex flex-col items-center">
                    <div className="w-full bg-stone-200 rounded-t-sm h-14 relative overflow-hidden flex items-end">
                      <div 
                        className={`absolute bottom-0 w-full transition-all duration-500 ${
                          s.nivelPct < 40 ? 'bg-amber-500' : 'bg-stone-500'
                        }`}
                        style={{ height: `${s.nivelPct}%` }}
                      />
                    </div>
                    <div className="text-[9px] font-bold text-stone-700 mt-1 font-mono">
                      {s.nivelPct}%
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-[10px] font-semibold text-stone-600 text-center mt-1 pt-1 border-t border-stone-100 flex items-center justify-center gap-1">
                <span>CIM-01: 52%</span>
                <span className="text-stone-300">·</span>
                <span className="text-stone-500">62.4t</span>
              </div>
            </div>

            {/* STATION 5: BAL-01 (Balança Usina Rodoviária 21m) */}
            <div 
              onClick={() => onOpenBalancaCockpit && onOpenBalancaCockpit('bal01')}
              className={`absolute top-64 left-80 w-64 p-3.5 rounded-xl border-2 shadow-md cursor-pointer transition-all z-20 hover:scale-102 ${
                weighbridges.bal01.statusPista === 'ocupada'
                  ? 'bg-amber-50/95 border-amber-500 ring-4 ring-amber-100'
                  : 'bg-white border-stone-400'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-stone-800">BAL-01 · 21 METROS</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 font-mono">
                  Sensor BT-05
                </span>
              </div>
              {/* Scale Platform Visual */}
              <div className="mt-2 py-2 px-3 rounded-lg bg-stone-900 text-emerald-400 font-mono font-black text-center text-lg tracking-wider border border-stone-800 shadow-inner flex items-center justify-between">
                <span className="text-[10px] text-stone-400 font-sans font-normal uppercase">Toledo 720i</span>
                <span>{weighbridges.bal01.pesoAtualKg.toLocaleString('pt-BR')} kg</span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="mt-2 text-[10px] text-stone-600 flex items-center justify-between font-medium">
                <span>{weighbridges.bal01.veiculoAtual ? `Caminhão: ${weighbridges.bal01.veiculoAtual.placa}` : 'Pista desimpedida'}</span>
                <span className="text-serrano-600 font-semibold flex items-center gap-0.5">
                  Cockpit <Eye className="w-3 h-3" />
                </span>
              </div>
            </div>

            {/* STATION 6: Baia de Exceção (Antifraude) */}
            <div 
              onClick={() => setSelectedStation('excecao')}
              className="absolute bottom-4 left-80 w-64 p-3 bg-rose-50/90 border-2 border-dashed border-rose-300 rounded-xl hover:border-rose-500 cursor-pointer transition-all z-10 hover:shadow-md"
            >
              <div className="flex items-center justify-between text-[10px] font-bold text-rose-700 uppercase tracking-wide">
                <span className="flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  BAIA DE EXCEÇÃO
                </span>
                <span className="px-1.5 py-0.2 rounded bg-rose-200 text-rose-800">
                  1 retido
                </span>
              </div>
              <div className="text-xs font-semibold text-stone-800 mt-1">
                NJK-3307 (Tara Fora do Padrão)
              </div>
              <div className="text-[10px] text-rose-600 font-medium">
                Auditado pelo Motor KyttoIA · Aguarda decisão
              </div>
            </div>

            {/* STATION 7: Portaria · Totem */}
            <div 
              onClick={() => setSelectedStation('portaria')}
              className="absolute bottom-4 left-4 w-44 p-3 bg-white rounded-xl border border-stone-200 shadow-xs hover:border-stone-400 cursor-pointer transition-all z-10 hover:shadow-md"
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">PORTARIA · TOTEM</div>
              <div className="text-xs font-bold text-stone-900 mt-0.5">Autoatendimento OCR</div>
              <div className="text-[10px] text-stone-500 mt-1 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Check-in via WhatsApp / QR</span>
              </div>
            </div>

            {/* STATION 8: Faixa de Espera */}
            <div className="absolute bottom-4 left-52 w-24 p-2 text-center text-[10px] font-bold text-stone-400 tracking-wider uppercase border border-dashed border-stone-300 rounded-lg">
              Faixa de Espera
            </div>

            {/* STATION 9: Baias de Agregados */}
            <div 
              onClick={() => setSelectedStation('baias')}
              className="absolute bottom-4 right-4 w-60 p-3 bg-white rounded-xl border border-stone-200 shadow-xs hover:border-stone-400 cursor-pointer transition-all z-10 hover:shadow-md"
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 flex items-center justify-between">
                <span>BAIAS DE AGREGADOS</span>
                <span className="text-[9px] font-semibold text-stone-500">5 baias</span>
              </div>
              <div className="text-xs font-semibold text-stone-800 mt-1">
                Areia Média · Brita 0 · Brita 1 · Pedrisco
              </div>
              <div className="text-[10px] text-emerald-700 font-medium mt-0.5">
                Pá-Carregadeira CAT 924K ativa no abastecimento
              </div>
            </div>

            {/* INTERACTIVE VEHICLE MARKERS ON THE MAP */}
            {filteredVehicles.map(veh => {
              const posMap = {
                balanca: { top: '240px', left: '330px' },
                dosadora: { top: '70px', left: '460px' },
                lavagem: { top: '70px', left: '230px' },
                excecao: { top: '380px', left: '330px' },
                portaria: { top: '380px', left: '50px' },
                saindo: { top: '280px', left: '720px' },
                patio: { top: '280px', left: '580px' },
              };
              const pos = posMap[veh.localizacao] || posMap.patio;

              return (
                <div
                  key={veh.id}
                  onClick={(e) => handleVehicleClick(veh, e)}
                  className="absolute z-30 cursor-pointer transform -translate-x-1/2 -translate-y-1/2 group transition-all duration-300"
                  style={{ top: pos.top, left: pos.left }}
                >
                  {/* Vehicle Marker Pill */}
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full shadow-md border text-xs font-bold transition-transform group-hover:scale-110 ${
                    veh.localizacao === 'excecao'
                      ? 'bg-rose-600 text-white border-rose-700 ring-2 ring-rose-300 animate-pulse'
                      : veh.localizacao === 'balanca'
                      ? 'bg-amber-500 text-white border-amber-600 ring-2 ring-amber-300'
                      : 'bg-stone-900 text-white border-stone-800'
                  }`}>
                    <Truck className="w-3.5 h-3.5" />
                    <span>{veh.prefixo}</span>
                    <span className="text-[10px] font-normal opacity-80">({veh.placa})</span>
                  </div>

                  {/* Tooltip on Hover */}
                  <div className="hidden group-hover:block absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2 bg-stone-900 text-white text-[11px] rounded-lg shadow-xl z-50 pointer-events-none">
                    <div className="font-bold text-amber-300">{veh.prefixo} · {veh.tipo}</div>
                    <div className="text-stone-300">Motorista: {veh.motorista}</div>
                    <div className="text-stone-300">Produto: {veh.traco}</div>
                    <div className="text-stone-400 text-[10px] mt-1 font-mono">Tara: {veh.taraKg.toLocaleString('pt-BR')} kg</div>
                  </div>
                </div>
              );
            })}

          </div>
        )}

        {/* Unit 2: Mineração Rio Sangue */}
        {unit === 'mineracao' && (
          <div className="relative w-full h-full min-h-[440px]">
            {/* Roads & Paths */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none stroke-stone-300/80 stroke-[24] fill-none stroke-linecap-round">
              <path d="M 120 400 L 120 300 L 400 300 L 750 300" />
              <path d="M 400 300 L 400 160 L 600 160" />
            </svg>

            {/* Cascalheira & Britagem */}
            <div 
              onClick={() => setSelectedStation('britagem')}
              className="absolute top-4 left-4 w-52 p-3 bg-white rounded-xl border border-stone-200 shadow-xs cursor-pointer hover:border-stone-400 hover:shadow-md transition-all"
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">EXTRAÇÃO & BRITAGEM</div>
              <div className="text-xs font-bold text-stone-900 mt-0.5">Britador Primário Cônico</div>
              <div className="text-[10px] text-emerald-700 font-semibold mt-1">
                Operando: 220 ton/hora
              </div>
            </div>

            {/* Pilhas de Estocagem */}
            <div 
              onClick={() => setSelectedStation('pilhas')}
              className="absolute top-4 right-16 w-60 p-3 bg-white rounded-xl border border-stone-200 shadow-xs cursor-pointer hover:border-stone-400 hover:shadow-md transition-all"
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">PILHAS DE ESTOCAGEM</div>
              <div className="text-xs font-bold text-stone-900 mt-0.5">Areia Média Lavada de Rio</div>
              <div className="text-[10px] text-stone-500 mt-1">
                Estoque no pátio: <span className="font-bold text-stone-800">1.840 t</span>
              </div>
            </div>

            {/* BAL-02 Balança Mineração */}
            <div 
              onClick={() => onOpenBalancaCockpit && onOpenBalancaCockpit('bal02')}
              className="absolute top-52 left-72 w-64 p-3.5 bg-white rounded-xl border-2 border-stone-800 shadow-md cursor-pointer hover:border-serrano-500 transition-all z-20"
            >
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-stone-800">BAL-02 · MINERAÇÃO 18M</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 font-mono">
                  Sensor BM-02
                </span>
              </div>
              <div className="mt-2 py-2 px-3 rounded-lg bg-stone-900 text-emerald-400 font-mono font-black text-center text-lg tracking-wider border border-stone-800 shadow-inner flex items-center justify-between">
                <span className="text-[10px] text-stone-400 font-sans font-normal uppercase">Filizola</span>
                <span>{weighbridges.bal02.pesoAtualKg.toLocaleString('pt-BR')} kg</span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="mt-2 text-[10px] text-stone-600 flex items-center justify-between font-medium">
                <span>Pista desimpedida</span>
                <span className="text-serrano-600 font-semibold flex items-center gap-0.5">
                  Cockpit <Eye className="w-3 h-3" />
                </span>
              </div>
            </div>

            {/* Veículos na Mineração */}
            {filteredVehicles.map(veh => (
              <div
                key={veh.id}
                onClick={(e) => handleVehicleClick(veh, e)}
                className="absolute z-30 cursor-pointer transform -translate-x-1/2 -translate-y-1/2"
                style={{ top: '270px', left: veh.localizacao === 'excecao' ? '280px' : '520px' }}
              >
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full shadow-md border text-xs font-bold ${
                  veh.localizacao === 'excecao'
                    ? 'bg-rose-600 text-white border-rose-700 ring-2 ring-rose-300 animate-pulse'
                    : 'bg-stone-900 text-white'
                }`}>
                  <Truck className="w-3.5 h-3.5" />
                  <span>{veh.prefixo}</span>
                  <span className="text-[10px] font-normal opacity-80">({veh.placa})</span>
                </div>
              </div>
            ))}

          </div>
        )}

      </div>

      {/* Quick Station Info Bar below Canvas */}
      <div className="mt-3 pt-2.5 border-t border-concrete-100 flex flex-wrap items-center justify-between text-xs text-stone-500">
        <div className="flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-stone-400" />
          <span>Clique em qualquer veículo, balança, silo ou estação para inspecionar parâmetros e telemetria ao vivo.</span>
        </div>
        <div className="text-[11px] font-semibold text-stone-700">
          Localização: <span className="font-bold text-serrano-700">{unit === 'usina' ? 'Rodovia MT-358 KM 08' : 'Estrada Rio Sangue KM 12'}</span>
        </div>
      </div>

      {/* MODAL / DRAWER: TELEMETRIA DA ESTAÇÃO SELECIONADA */}
      {selectedStation && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-serrano-500 text-white flex items-center justify-center">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-stone-900 uppercase">
                    {selectedStation === 'dosadora' && 'Central Dosadora Convicta 96t'}
                    {selectedStation === 'silos' && 'Silos Verticais de Cimento (MT-358)'}
                    {selectedStation === 'lavagem' && 'Reciclador de Água & Resíduos NBR 15900'}
                    {selectedStation === 'excecao' && 'Baia de Exceção & Auditoria KyttoIA'}
                    {selectedStation === 'portaria' && 'Portaria & Totem de Autoatendimento'}
                    {selectedStation === 'baias' && 'Baias de Agregados Basalto & Areia'}
                    {selectedStation === 'cco' && 'Torre de Controle CCO Tangará da Serra'}
                    {selectedStation === 'britagem' && 'Extração & Britador Cônico Rio Sangue'}
                    {selectedStation === 'pilhas' && 'Pilhas de Agregados da Mineração'}
                  </h3>
                  <span className="text-[10px] text-stone-500 font-medium">
                    Supervisão em tempo real · Motor KyttoIA 2.5 Flash
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedStation(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body Content */}
            <div className="my-4 space-y-3 text-xs text-stone-700">
              
              {/* DOSADORA */}
              {selectedStation === 'dosadora' && (
                <div className="space-y-3">
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-amber-800">Status Operacional</span>
                      <div className="font-extrabold text-amber-900 text-sm">Dosando Batelada 65% · BT-06</div>
                    </div>
                    <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200">
                      <span className="text-stone-400 uppercase text-[9px] font-bold block">Balança de Agregados</span>
                      <strong className="text-stone-900 font-mono text-xs">4.820 kg / 5.200 kg</strong>
                    </div>
                    <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200">
                      <span className="text-stone-400 uppercase text-[9px] font-bold block">Balança de Cimento</span>
                      <strong className="text-stone-900 font-mono text-xs">1.150 kg / 1.280 kg</strong>
                    </div>
                    <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200">
                      <span className="text-stone-400 uppercase text-[9px] font-bold block">Sonda Umidade Areia</span>
                      <strong className="text-emerald-700 font-mono text-xs">3.8% (Compensada)</strong>
                    </div>
                    <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200">
                      <span className="text-stone-400 uppercase text-[9px] font-bold block">Misturador Duplo Eixo</span>
                      <strong className="text-stone-900 font-mono text-xs">42A · 28 RPM</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* SILOS */}
              {selectedStation === 'silos' && (
                <div className="space-y-2.5">
                  {silos.map(s => (
                    <div key={s.id} className="p-2.5 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-stone-900">{s.codigo} · {s.tipo}</div>
                        <div className="text-[10px] text-stone-500">Capacidade: {s.capacidadeTotalTon}t · Consumo hoje: {s.consumoHojeTon}t</div>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-sm text-stone-900">{s.nivelAtualTon}t</span>
                        <div className="text-[10px] font-bold text-serrano-700">{s.nivelPct}%</div>
                      </div>
                    </div>
                  ))}
                  <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-200 text-[10px] text-emerald-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    <span>Filtros de manga com sistema pulse-jet ativos e conformidade ambiental SEMA-MT.</span>
                  </div>
                </div>
              )}

              {/* LAVAGEM */}
              {selectedStation === 'lavagem' && (
                <div className="space-y-3">
                  <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                    <div className="font-bold text-blue-900">Reciclagem de Concreto em Circuito Fechado</div>
                    <p className="text-[11px] text-blue-800 mt-0.5">
                      Recupera agregados e neutraliza a água de lavagem dos balões das betoneiras, sem descarte no meio ambiente.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200">
                      <span className="text-stone-400 uppercase text-[9px] font-bold block">Tanque Água Clarificada</span>
                      <strong className="text-stone-900 font-mono text-xs">84.000 Litros</strong>
                    </div>
                    <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200">
                      <span className="text-stone-400 uppercase text-[9px] font-bold block">pH da Água de Reúso</span>
                      <strong className="text-emerald-700 font-mono text-xs">7.4 (NBR 15900)</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* EXCECAO */}
              {selectedStation === 'excecao' && (
                <div className="space-y-3">
                  <div className="p-3 bg-rose-50 rounded-xl border border-rose-300">
                    <div className="font-bold text-rose-900 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      <span>Veículo Retido: NJK-3307</span>
                    </div>
                    <p className="text-[11px] text-rose-800 mt-1">
                      Desvio de tara identificado pelo Motor KyttoIA (+6.1% / +590 kg). Suspeita de tanque de água clandestino para adulteração de peso líquido.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedStation(null);
                        const v = vehicles.find(item => item.localizacao === 'excecao');
                        if (v && onSelectVehicle) onSelectVehicle(v);
                      }}
                      className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>Auditar no Painel Antifraude</span>
                    </button>
                  </div>
                </div>
              )}

              {/* PORTARIA */}
              {selectedStation === 'portaria' && (
                <div className="space-y-3">
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                    <div className="font-bold text-stone-900">Totem Inteligente LPR 4K Hikvision</div>
                    <p className="text-[11px] text-stone-600 mt-0.5">
                      Check-in 100% autônomo. Reconhece placa dianteira e traseira em menos de 800ms e libera cancela.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200">
                      <span className="text-stone-400 uppercase text-[9px] font-bold block">Taxa de Reconhecimento</span>
                      <strong className="text-emerald-700 font-mono text-xs">99.8% LPR</strong>
                    </div>
                    <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200">
                      <span className="text-stone-400 uppercase text-[9px] font-bold block">Fila Média Portaria</span>
                      <strong className="text-stone-900 font-mono text-xs">0 veículos</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* BAIAS */}
              {selectedStation === 'baias' && (
                <div className="space-y-2 text-[11px]">
                  <div className="p-2 bg-stone-50 rounded-lg border border-stone-200 flex justify-between">
                    <span>Areia Média Lavada Rio Sangue</span>
                    <strong className="font-mono">1.840 t (Umidade: 3.8%)</strong>
                  </div>
                  <div className="p-2 bg-stone-50 rounded-lg border border-stone-200 flex justify-between">
                    <span>Brita 0 Basalto Industrial</span>
                    <strong className="font-mono">920 t (Umidade: 1.2%)</strong>
                  </div>
                  <div className="p-2 bg-stone-50 rounded-lg border border-stone-200 flex justify-between">
                    <span>Brita 1 Basalto Industrial</span>
                    <strong className="font-mono">1.450 t (Umidade: 0.8%)</strong>
                  </div>
                  <div className="p-2 bg-stone-50 rounded-lg border border-stone-200 flex justify-between">
                    <span>Pedrisco Basalto Limpo</span>
                    <strong className="font-mono">680 t (Umidade: 1.0%)</strong>
                  </div>
                </div>
              )}

              {/* CCO */}
              {selectedStation === 'cco' && (
                <div className="space-y-3">
                  <div className="p-3 bg-stone-900 text-white rounded-xl">
                    <div className="font-bold flex items-center justify-between">
                      <span>Central CCO Serrano MT-358</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500 text-stone-900 font-bold">ONLINE</span>
                    </div>
                    <p className="text-[11px] text-stone-400 mt-1">
                      Servidor local Edge Toledo Modbus TCP com redundância de fibra óptica e Starlink de contingência.
                    </p>
                  </div>
                  <div className="text-[11px] space-y-1 text-stone-600">
                    <div className="flex justify-between">
                      <span>Automação Geral:</span>
                      <strong className="text-emerald-700">88% sem operador</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Pesagens Hoje:</span>
                      <strong className="font-mono text-stone-900">75 tickets emitidos</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Auditoria KyttoIA:</span>
                      <strong className="text-stone-900">Ativa 24/7</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* BRITAGEM */}
              {selectedStation === 'britagem' && (
                <div className="space-y-3">
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                    <div className="font-bold text-stone-900">Britador Primário Cônico · Rio Sangue</div>
                    <p className="text-[11px] text-stone-600 mt-0.5">
                      Processamento de rocha basáltica com capacidade de 220 toneladas por hora para abastecimento da usina de concreto e pavimentação.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200">
                      <span className="text-stone-400 uppercase text-[9px] font-bold block">Taxa Atual</span>
                      <strong className="text-emerald-700 font-mono text-xs">220 t/h</strong>
                    </div>
                    <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200">
                      <span className="text-stone-400 uppercase text-[9px] font-bold block">Consumo Elétrico</span>
                      <strong className="text-stone-900 font-mono text-xs">185 kW</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* PILHAS */}
              {selectedStation === 'pilhas' && (
                <div className="space-y-2 text-[11px]">
                  <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200">
                    <div className="font-bold text-stone-900">Estoque de Agregados Mineração</div>
                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between">
                        <span>Areia de Rio Lavada:</span>
                        <strong className="font-mono text-stone-900">1.840 t</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Brita 1 Basalto:</span>
                        <strong className="font-mono text-stone-900">2.410 t</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Pó de Pedra / Filler:</span>
                        <strong className="font-mono text-stone-900">950 t</strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-stone-100 flex justify-end">
              <button
                onClick={() => setSelectedStation(null)}
                className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl transition-colors"
              >
                Fechar Painel
              </button>
            </div>

          </div>
        </div>
      )}

      {/* POPUP / MODAL: INSPEÇÃO INDIVIDUAL DO VEÍCULO CLICADO */}
      {inspectedVehicle && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
            
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-stone-900 text-white rounded-xl">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-stone-900">
                    {inspectedVehicle.prefixo} · {inspectedVehicle.placa}
                  </h3>
                  <span className="text-[10px] text-stone-500 font-medium">
                    {inspectedVehicle.tipo}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setInspectedVehicle(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-4 space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-stone-100">
                <span className="text-stone-500">Motorista:</span>
                <strong className="text-stone-900">{inspectedVehicle.motorista}</strong>
              </div>
              <div className="flex justify-between py-1.5 border-b border-stone-100">
                <span className="text-stone-500">Localização no Pátio:</span>
                <span className="font-bold text-serrano-700 uppercase text-[11px]">{inspectedVehicle.localizacao}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-stone-100">
                <span className="text-stone-500">Traço / Carga:</span>
                <span className="text-stone-900 font-semibold">{inspectedVehicle.traco || 'Em trânsito vazio'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-stone-100">
                <span className="text-stone-500">Tara Cadastrada:</span>
                <strong className="font-mono text-stone-900">{inspectedVehicle.taraKg.toLocaleString('pt-BR')} kg</strong>
              </div>
              {inspectedVehicle.brutoKg && (
                <div className="flex justify-between py-1.5 border-b border-stone-100">
                  <span className="text-stone-500">Peso Bruto:</span>
                  <strong className="font-mono text-stone-900">{inspectedVehicle.brutoKg.toLocaleString('pt-BR')} kg</strong>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-stone-100 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  const target = inspectedVehicle;
                  setInspectedVehicle(null);
                  if (onSelectVehicle) onSelectVehicle(target);
                }}
                className="px-4 py-2 bg-serrano-500 hover:bg-serrano-600 text-white text-xs font-bold rounded-xl transition-colors shadow-xs flex items-center gap-1.5"
              >
                <span>Acessar no Cockpit / CCO</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
