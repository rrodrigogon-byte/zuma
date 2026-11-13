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
  Maximize2
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
  onOpenBalancaCockpit 
}) {
  const [selectedStation, setSelectedStation] = useState(null);

  // Status dot legend
  const STATUS_LEGEND = [
    { label: 'Na fila', color: 'bg-stone-400' },
    { label: 'Na balança', color: 'bg-amber-500 ring-2 ring-amber-300 animate-pulse' },
    { label: 'No pátio', color: 'bg-blue-600' },
    { label: 'Exceção', color: 'bg-rose-500 ring-2 ring-rose-300 animate-bounce' },
    { label: 'Saindo', color: 'bg-emerald-500' },
  ];

  const filteredVehicles = vehicles.filter(v => v.unidade === unit);

  return (
    <div className="bg-white rounded-2xl border border-concrete-200 shadow-xs p-4 flex flex-col h-full">
      
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

      {/* Interactive Plant Diagram Canvas */}
      <div className="relative mt-4 flex-1 min-h-[460px] bg-[#EFECE6] rounded-xl p-4 overflow-hidden border border-concrete-200 select-none">
        
        {/* Unit 1: Usina de Concreto MT-358 */}
        {unit === 'usina' && (
          <div className="relative w-full h-full min-h-[440px]">
            
            {/* Paved Road Lines (SVG Tráfego) */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none stroke-stone-300/80 stroke-[24] fill-none stroke-linecap-round stroke-linejoin-round">
              {/* Portaria to Balança */}
              <path d="M 120 400 L 120 330 L 400 330" />
              {/* Balança to Central Dosadora */}
              <path d="M 460 330 L 560 330 L 560 210 L 560 170" />
              {/* Central Dosadora to Silos & Agregados */}
              <path d="M 560 170 L 660 170 L 660 330 L 800 330" />
              {/* Balança to Baia de Exceção */}
              <path d="M 400 330 L 400 420" strokeDasharray="8 8" stroke="#f43f5e" strokeWidth="16" />
              {/* Lavagem to Saída */}
              <path d="M 280 180 L 280 270 L 400 270" strokeDasharray="4 4" strokeWidth="14" />
            </svg>

            {/* STATION 1: CCO · Escritório / Torre Central */}
            <div 
              onClick={() => setSelectedStation('cco')}
              className="absolute top-4 left-4 w-44 p-3 bg-white/95 backdrop-blur-sm rounded-xl border border-stone-200 shadow-xs hover:border-serrano-400 cursor-pointer transition-all z-10"
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
              className="absolute top-4 left-56 w-48 p-3 bg-stone-50/90 border border-dashed border-stone-300 rounded-xl hover:border-blue-400 cursor-pointer transition-all z-10"
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
              className="absolute top-4 right-52 w-48 p-3.5 bg-white rounded-xl border-2 border-stone-800 shadow-sm hover:border-serrano-500 cursor-pointer transition-all z-10"
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">CENTRAL DOSADORA</div>
              <div className="text-sm font-extrabold text-stone-900 flex items-center justify-between mt-0.5">
                <span>Convicta 96t</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 animate-pulse">
                  Dosando 65%
                </span>
              </div>
              
              {/* Mini Mixing Animation / Crosshair */}
              <div className="mt-2 pt-2 border-t border-stone-100 flex items-center justify-between">
                <div className="text-[10px] text-stone-500">
                  Sensor: <span className="font-mono font-bold text-stone-800">BT-06</span>
                </div>
                <div className="w-6 h-6 rounded-full border border-stone-400 border-t-amber-500 animate-spin" />
              </div>
            </div>

            {/* STATION 4: Silos de Cimento (Interactive Fill Gauge) */}
            <div 
              onClick={() => onSelectSilo && onSelectSilo(silos[0])}
              className="absolute top-4 right-4 w-44 p-3 bg-white rounded-xl border border-stone-200 shadow-xs hover:border-stone-400 cursor-pointer transition-all z-10"
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 flex items-center justify-between">
                <span>SILOS DE CIMENTO</span>
                <span className="text-[10px] text-stone-400">3 unidades</span>
              </div>
              
              {/* 3 Silos Graphic */}
              <div className="flex items-end justify-between gap-2 mt-2 h-20 px-1">
                {silos.map((s, idx) => (
                  <div key={s.id} className="flex-1 flex flex-col items-center">
                    <div className="w-full bg-stone-200 rounded-t-lg h-16 relative overflow-hidden border border-stone-300">
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
              className={`absolute top-64 left-80 w-64 p-3.5 rounded-xl border-2 shadow-md cursor-pointer transition-all z-20 ${
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
              className="absolute bottom-4 left-80 w-64 p-3 bg-rose-50/90 border-2 border-dashed border-rose-300 rounded-xl hover:border-rose-500 cursor-pointer transition-all z-10"
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
              className="absolute bottom-4 left-4 w-44 p-3 bg-white rounded-xl border border-stone-200 shadow-xs hover:border-stone-400 cursor-pointer transition-all z-10"
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
              className="absolute bottom-4 right-4 w-60 p-3 bg-white rounded-xl border border-stone-200 shadow-xs hover:border-stone-400 cursor-pointer transition-all z-10"
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
              // Map locations to absolute coordinates on the canvas
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
                  onClick={(e) => { e.stopPropagation(); onSelectVehicle && onSelectVehicle(veh); }}
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
            <div className="absolute top-4 left-4 w-52 p-3 bg-white rounded-xl border border-stone-200 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">EXTRAÇÃO & BRITAGEM</div>
              <div className="text-xs font-bold text-stone-900 mt-0.5">Britador Primário Cônico</div>
              <div className="text-[10px] text-emerald-700 font-semibold mt-1">
                Operando: 220 ton/hora
              </div>
            </div>

            {/* Pilhas de Estocagem */}
            <div className="absolute top-4 right-16 w-60 p-3 bg-white rounded-xl border border-stone-200 shadow-xs">
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
                onClick={() => onSelectVehicle && onSelectVehicle(veh)}
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
          <span>Clique em qualquer veículo, balança ou silo para inspecionar parâmetros e telemetria.</span>
        </div>
        <div className="text-[11px] font-semibold text-stone-700">
          Localização: <span className="font-bold text-serrano-700">{unit === 'usina' ? 'Rodovia MT-358 KM 08' : 'Estrada Rio Sangue KM 12'}</span>
        </div>
      </div>

    </div>
  );
}
