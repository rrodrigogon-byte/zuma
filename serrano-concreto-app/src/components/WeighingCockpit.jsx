import React, { useState, useEffect } from 'react';
import { 
  Scale, 
  Camera, 
  CheckCircle2, 
  AlertCircle, 
  Truck, 
  FileText, 
  Printer, 
  RefreshCw, 
  ShieldCheck, 
  Layers, 
  ArrowRight,
  Maximize2,
  Lock,
  Unlock,
  Radio,
  Eye,
  Check,
  ChevronRight,
  Sliders,
  RotateCcw
} from 'lucide-react';

export default function WeighingCockpit({ 
  weighbridges, 
  onPerformWeighing, 
  onOpenTicket,
  onToggleGate,
  vehicles = [],
  fleet = [],
  ticketsHistory = [],
  onAddTicket
}) {
  const [selectedBridge, setSelectedBridge] = useState('bal01');
  const [activeStep, setActiveStep] = useState(1); // 1: Tara/Entrada, 2: Carregamento, 3: Bruto/Saída, 4: Concluído
  
  // Active truck on scale
  const [selectedVehicleId, setSelectedVehicleId] = useState('v1');
  
  // Real-time scale weight & jitter simulation
  const [baseWeight, setBaseWeight] = useState(12920);
  const [displayWeight, setDisplayWeight] = useState(12920);
  const [isStable, setIsStable] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isZeroing, setIsZeroing] = useState(false);

  // Weights recorded during cycle
  const [capturedTara, setCapturedTara] = useState(12920);
  const [capturedBruto, setCapturedBruto] = useState(33540);
  const [lastTicket, setLastTicket] = useState(null);

  // Actuator states
  const [gateInOpen, setGateInOpen] = useState(false);
  const [gateOutOpen, setGateOutOpen] = useState(false);
  const [lightInGreen, setLightInGreen] = useState(false);
  const [lightOutGreen, setLightOutGreen] = useState(false);

  const currentBridge = weighbridges[selectedBridge] || weighbridges.bal01;
  const currentVehicle = vehicles.find(v => v.id === selectedVehicleId) || vehicles[0] || {
    placa: 'QBF-6M02',
    prefixo: 'BT-05',
    motorista: 'Valdir Silveira',
    cliente: 'Construtora Alvorada Ltda',
    obra: 'Residencial Manacá - Laje 4º Pav.',
    traco: 'TR-FCK30B (FCK 30 MPa)',
    volumeM3: 10.0,
    taraKg: 12920
  };

  // Realistic weight jitter when scale is in operation
  useEffect(() => {
    const jitter = setInterval(() => {
      if (!isZeroing) {
        const offset = Math.floor(Math.random() * 9) - 4; // -4 to +4 kg
        setDisplayWeight(Math.max(0, baseWeight + offset));
      }
    }, 1200);
    return () => clearInterval(jitter);
  }, [baseWeight, isZeroing]);

  // Adjust base weight when step or vehicle changes
  useEffect(() => {
    if (activeStep === 1) {
      setBaseWeight(currentVehicle.taraKg || 12920);
    } else if (activeStep === 2) {
      setBaseWeight(currentVehicle.taraKg || 12920);
    } else if (activeStep === 3) {
      const vol = currentVehicle.volumeM3 || 8.0;
      const pesoCarga = Math.round(vol * 2380); // 2380 kg/m³
      setBaseWeight((currentVehicle.taraKg || 12920) + pesoCarga);
    }
  }, [activeStep, currentVehicle]);

  const liquidoKg = Math.max(0, capturedBruto - capturedTara);
  const volumeCalculadoM3 = Number((liquidoKg / 2380).toFixed(2));

  // Handler: Zero Scale (Calibração Eletrônica)
  const handleZeroScale = () => {
    setIsZeroing(true);
    setIsStable(false);
    setTimeout(() => {
      setBaseWeight(0);
      setDisplayWeight(0);
      setIsZeroing(false);
      setIsStable(true);
    }, 800);
  };

  // Handler: Step Capture
  const handleCaptureStep = () => {
    setIsCapturing(true);
    setTimeout(() => {
      setIsCapturing(false);
      if (activeStep === 1) {
        // Travar Tara
        setCapturedTara(displayWeight || 12920);
        setLightInGreen(true);
        setGateInOpen(true);
        setActiveStep(2);
      } else if (activeStep === 2) {
        // Concluir Carregamento
        setActiveStep(3);
        setGateInOpen(false);
        setLightInGreen(false);
      } else if (activeStep === 3) {
        // Travar Bruto e Emitir Ticket
        const bruto = displayWeight || 33540;
        setCapturedBruto(bruto);
        const liq = bruto - capturedTara;
        
        const newTicket = {
          id: `TKT-2026-${Math.floor(8850 + Math.random() * 500)}`,
          balancaId: currentBridge.id,
          placa: currentVehicle.placa,
          prefixo: currentVehicle.prefixo,
          motorista: currentVehicle.motorista,
          cliente: currentVehicle.cliente,
          obra: currentVehicle.obra,
          produto: currentVehicle.traco,
          volumeM3: Number((liq / 2380).toFixed(2)) || currentVehicle.volumeM3 || 8.0,
          taraKg: capturedTara,
          brutoKg: bruto,
          liquidoKg: liq,
          hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          data: new Date().toLocaleDateString('pt-BR'),
          mdfe: `MDF-2026-${Math.floor(400 + Math.random() * 100)}`,
          status: 'Concluído com Sucesso'
        };

        setLastTicket(newTicket);
        if (onAddTicket) onAddTicket(newTicket);

        setLightOutGreen(true);
        setGateOutOpen(true);
        setActiveStep(4);
      }
    }, 600);
  };

  const handleResetCycle = () => {
    setActiveStep(1);
    setGateInOpen(false);
    setGateOutOpen(false);
    setLightInGreen(false);
    setLightOutGreen(false);
    setBaseWeight(currentVehicle.taraKg || 12920);
  };

  return (
    <div className="space-y-4">
      {/* Top Cockpit Header & Weighbridge Selector */}
      <div className="bg-white p-4 rounded-2xl border border-concrete-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-extrabold text-stone-900 tracking-tight">
              COCKPIT DE PESAGEM OPERACIONAL
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Sincronizado via Modbus TCP (Toledo 720i)
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-0.5">
            Supervisão remota da balança rodoviária de 21m · Validação em tempo real pelo <strong className="text-stone-700">Motor KyttoIA 2.5 Flash</strong>
          </p>
        </div>

        {/* Bridge Switcher Pills */}
        <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl">
          <button
            onClick={() => { setSelectedBridge('bal01'); handleResetCycle(); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              selectedBridge === 'bal01'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            BAL-01 · Usina MT-358 (80t)
          </button>
          <button
            onClick={() => { setSelectedBridge('bal02'); handleResetCycle(); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              selectedBridge === 'bal02'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            BAL-02 · Mineração Rio Sangue (60t)
          </button>
        </div>
      </div>

      {/* Main Cockpit Grid: Display LED + 4 Quad Cameras */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left: Giant Industrial LED Scale Display & Hardware Status (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* LED Digital Display */}
          <div className="bg-stone-950 p-6 rounded-2xl border-4 border-stone-800 shadow-xl text-center relative overflow-hidden">
            <div className="flex items-center justify-between text-stone-400 text-xs font-mono uppercase tracking-widest mb-2">
              <span className="flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>{currentBridge.fabricante}</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-stone-900 text-stone-300 border border-stone-800">
                {currentBridge.calibracaoInmetro?.split(' ')[1] || 'INMETRO MT'}
              </span>
            </div>

            {/* Glowing Big Digits */}
            <div className="py-4 font-mono font-black text-5xl sm:text-6xl text-emerald-400 tracking-wider drop-shadow-[0_0_15px_rgba(52,211,153,0.4)]">
              {displayWeight.toLocaleString('pt-BR')}
              <span className="text-xl sm:text-2xl text-emerald-600 ml-2 font-sans font-normal">kg</span>
            </div>

            {/* Scale Secondary Metric & Stability Badge */}
            <div className="flex items-center justify-between pt-3 border-t border-stone-800/80 text-xs font-mono text-stone-400">
              <span className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${isStable ? 'bg-emerald-400' : 'bg-amber-400 animate-ping'}`} />
                <span>{isStable ? 'PESO ESTÁVEL' : 'EM MOVIMENTO'}</span>
              </span>
              <span className="text-stone-300 font-bold">
                {(displayWeight / 1000).toFixed(3)} <span className="text-[10px] text-stone-500 font-normal">t</span>
              </span>
              <span className="text-[11px] text-stone-500">Divisão d = 20 kg</span>
            </div>
          </div>

          {/* Actuators & Hardware Controls (Semáforos e Cancelas) */}
          <div className="bg-white p-4 rounded-2xl border border-concrete-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wide text-stone-800 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-stone-500" />
                <span>Atuadores de Hardware &amp; Periféricos</span>
              </h3>
              <button
                type="button"
                onClick={handleZeroScale}
                disabled={isZeroing}
                className="text-[11px] font-bold text-stone-600 hover:text-stone-900 px-2 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 border border-stone-300 transition-colors flex items-center gap-1"
                title="Calibrar zero eletrônico das células de carga"
              >
                <RotateCcw className={`w-3 h-3 ${isZeroing ? 'animate-spin' : ''}`} />
                <span>Zerar Balança</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              {/* Entrada */}
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
                <span className="font-bold text-stone-700 block text-[11px]">PORTAL DE ENTRADA</span>
                <div className="flex items-center justify-between">
                  <span className="text-stone-500 text-[11px]">Semáforo:</span>
                  <button
                    type="button"
                    onClick={() => setLightInGreen(!lightInGreen)}
                    className={`px-2 py-0.5 rounded-full font-bold text-[10px] border transition-all ${
                      lightInGreen ? 'bg-emerald-100 border-emerald-300 text-emerald-800' : 'bg-rose-100 border-rose-300 text-rose-800'
                    }`}
                  >
                    {lightInGreen ? '● VERDE' : '● VERMELHO'}
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-500 text-[11px]">Cancela:</span>
                  <button
                    type="button"
                    onClick={() => setGateInOpen(!gateInOpen)}
                    className={`px-2 py-0.5 rounded-lg font-bold text-[10px] border transition-all ${
                      gateInOpen ? 'bg-amber-100 border-amber-300 text-amber-900' : 'bg-stone-200 border-stone-300 text-stone-700'
                    }`}
                  >
                    {gateInOpen ? 'ABERTA' : 'FECHADA'}
                  </button>
                </div>
              </div>

              {/* Saída */}
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
                <span className="font-bold text-stone-700 block text-[11px]">PORTAL DE SAÍDA</span>
                <div className="flex items-center justify-between">
                  <span className="text-stone-500 text-[11px]">Semáforo:</span>
                  <button
                    type="button"
                    onClick={() => setLightOutGreen(!lightOutGreen)}
                    className={`px-2 py-0.5 rounded-full font-bold text-[10px] border transition-all ${
                      lightOutGreen ? 'bg-emerald-100 border-emerald-300 text-emerald-800' : 'bg-rose-100 border-rose-300 text-rose-800'
                    }`}
                  >
                    {lightOutGreen ? '● VERDE' : '● VERMELHO'}
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-500 text-[11px]">Cancela:</span>
                  <button
                    type="button"
                    onClick={() => setGateOutOpen(!gateOutOpen)}
                    className={`px-2 py-0.5 rounded-lg font-bold text-[10px] border transition-all ${
                      gateOutOpen ? 'bg-amber-100 border-amber-300 text-amber-900' : 'bg-stone-200 border-stone-300 text-stone-700'
                    }`}
                  >
                    {gateOutOpen ? 'ABERTA' : 'FECHADA'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Scale Cycle Progress Card */}
          <div className="bg-white p-4 rounded-2xl border border-concrete-200 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wide text-stone-800">
                Fluxo do Ciclo de Pesagem
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-serrano-100 text-serrano-800 font-mono">
                Etapa {activeStep} de 4
              </span>
            </div>

            <div className="space-y-2 text-xs">
              {/* Step 1: 1ª Pesagem (Tara) */}
              <div className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                activeStep === 1 ? 'bg-serrano-50 border-serrano-400 text-serrano-900 font-bold shadow-2xs' : activeStep > 1 ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' : 'bg-stone-50 border-stone-200 text-stone-400'
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    activeStep > 1 ? 'bg-emerald-600 text-white' : activeStep === 1 ? 'bg-serrano-500 text-white' : 'bg-stone-300 text-white'
                  }`}>
                    {activeStep > 1 ? <Check className="w-3 h-3 stroke-[3]" /> : '1'}
                  </span>
                  <span>1ª Pesagem: Captura da Tara</span>
                </div>
                <span className="font-mono">{capturedTara.toLocaleString('pt-BR')} kg</span>
              </div>

              {/* Step 2: Carregamento */}
              <div className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                activeStep === 2 ? 'bg-serrano-50 border-serrano-400 text-serrano-900 font-bold shadow-2xs' : activeStep > 2 ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' : 'bg-stone-50 border-stone-200 text-stone-400'
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    activeStep > 2 ? 'bg-emerald-600 text-white' : activeStep === 2 ? 'bg-serrano-500 text-white' : 'bg-stone-300 text-white'
                  }`}>
                    {activeStep > 2 ? <Check className="w-3 h-3 stroke-[3]" /> : '2'}
                  </span>
                  <span>Carregamento Central Dosadora</span>
                </div>
                <span className="text-[11px] font-medium">{currentVehicle.traco?.split(' ')[0] || 'Concreto'}</span>
              </div>

              {/* Step 3: 2ª Pesagem (Bruto) */}
              <div className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                activeStep === 3 ? 'bg-serrano-50 border-serrano-400 text-serrano-900 font-bold shadow-2xs' : activeStep > 3 ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' : 'bg-stone-50 border-stone-200 text-stone-400'
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    activeStep > 3 ? 'bg-emerald-600 text-white' : activeStep === 3 ? 'bg-serrano-500 text-white' : 'bg-stone-300 text-white'
                  }`}>
                    {activeStep > 3 ? <Check className="w-3 h-3 stroke-[3]" /> : '3'}
                  </span>
                  <span>2ª Pesagem: Captura Peso Bruto</span>
                </div>
                <span className="font-mono">{capturedBruto.toLocaleString('pt-BR')} kg</span>
              </div>

              {/* Step 4: Emissão Ticket */}
              <div className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                activeStep === 4 ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold shadow-2xs' : 'bg-stone-50 border-stone-200 text-stone-400'
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    activeStep === 4 ? 'bg-emerald-600 text-white' : 'bg-stone-300 text-white'
                  }`}>
                    {activeStep === 4 ? <Check className="w-3 h-3 stroke-[3]" /> : '4'}
                  </span>
                  <span>Ticket NBR 7212 &amp; MDF-e</span>
                </div>
                <span className="font-semibold text-emerald-700">Líquido: {liquidoKg.toLocaleString('pt-BR')} kg</span>
              </div>
            </div>

            {/* Primary Action Button */}
            <div className="mt-4 pt-3 border-t border-stone-100 flex gap-2">
              {activeStep < 4 ? (
                <button
                  type="button"
                  onClick={handleCaptureStep}
                  disabled={isCapturing}
                  className="flex-1 py-3 bg-serrano-500 hover:bg-serrano-600 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-2"
                >
                  <Scale className="w-4 h-4" />
                  <span>
                    {isCapturing 
                      ? 'Processando Captura...' 
                      : activeStep === 1 
                        ? '1. Capturar Tara (1ª Pesagem)' 
                        : activeStep === 2 
                          ? '2. Concluir Carga -> Ir para 2ª Pesagem' 
                          : '3. Capturar Bruto & Emitir Ticket'}
                  </span>
                </button>
              ) : (
                <div className="flex-1 flex gap-2">
                  <button
                    type="button"
                    onClick={() => lastTicket && onOpenTicket && onOpenTicket(lastTicket)}
                    className="flex-1 py-3 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
                  >
                    <Printer className="w-4 h-4 text-amber-300" />
                    <span>Visualizar / Imprimir Ticket</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleResetCycle}
                    className="px-4 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl border border-stone-300 transition-colors"
                  >
                    Novo Ciclo
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Quad Cameras & Order Details (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Active Truck Selector Bar */}
          <div className="bg-white p-3.5 rounded-2xl border border-concrete-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-serrano-600" />
              <span className="font-bold text-stone-800">Caminhão na Balança:</span>
            </div>
            <select
              value={selectedVehicleId}
              onChange={(e) => {
                setSelectedVehicleId(e.target.value);
                setActiveStep(1);
              }}
              className="p-2 rounded-xl border border-stone-300 font-mono font-bold text-stone-900 focus:outline-none focus:border-serrano-500 bg-stone-50"
            >
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>
                  {v.prefixo || v.placa} — {v.placa} ({v.tipo} · {v.motorista})
                </option>
              ))}
            </select>
          </div>

          {/* Quad Security & LPR Cameras (2x2 Grid) */}
          <div className="bg-white p-4 rounded-2xl border border-concrete-200 shadow-xs">
            <div className="flex items-center justify-between mb-3 text-xs">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-stone-600" />
                <h3 className="font-extrabold text-stone-900 uppercase tracking-wide">
                  Matriz de Visão Computacional (4 Câmeras IP)
                </h3>
              </div>
              <span className="text-[10px] font-mono text-stone-500">
                STREAM 1080p · 30 FPS · H.265
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* CAM 01: LPR Dianteira */}
              <div className="bg-stone-900 rounded-xl overflow-hidden relative aspect-video border border-stone-800 shadow-inner group">
                <div className="w-full h-full flex flex-col items-center justify-center text-stone-600 bg-gradient-to-b from-stone-900 to-stone-950">
                  <Camera className="w-10 h-10 text-stone-700 mb-1" />
                  <span className="text-[10px] font-mono text-stone-400">CAM-01 · LPR FRONTAL 4K</span>
                </div>
                <div className="absolute top-2 left-2 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-black/60 text-emerald-400 border border-emerald-500/30">
                  ● REC · LPR OCR
                </div>
                {/* LPR Bounding Box Overlay */}
                <div className="absolute inset-x-8 bottom-4 py-1 bg-black/75 backdrop-blur-xs rounded border border-emerald-500/50 text-center font-mono text-xs font-bold text-white shadow-lg">
                  <span className="text-emerald-400 mr-1.5">[PLACA]</span>
                  {currentVehicle.placa}
                  <span className="text-[9px] text-stone-400 font-sans ml-2">(99.8%)</span>
                </div>
              </div>

              {/* CAM 02: LPR Traseira */}
              <div className="bg-stone-900 rounded-xl overflow-hidden relative aspect-video border border-stone-800 shadow-inner group">
                <div className="w-full h-full flex flex-col items-center justify-center text-stone-600 bg-gradient-to-b from-stone-900 to-stone-950">
                  <Camera className="w-10 h-10 text-stone-700 mb-1" />
                  <span className="text-[10px] font-mono text-stone-400">CAM-02 · LPR TRASEIRA</span>
                </div>
                <div className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-900/80 text-emerald-300 border border-emerald-700">
                  Placa Confere: {currentVehicle.placa}
                </div>
                <div className="absolute bottom-1 left-2 text-[9px] font-mono text-stone-400">
                  BAL-01 REAR · 30 FPS
                </div>
              </div>

              {/* CAM 03: Zenital / Topo da Carga */}
              <div className="bg-stone-900 rounded-xl overflow-hidden relative aspect-video border border-stone-800 shadow-inner group">
                <div className="w-full h-full flex flex-col items-center justify-center text-stone-600 bg-gradient-to-b from-stone-900 to-stone-950">
                  <Layers className="w-10 h-10 text-stone-700 mb-1" />
                  <span className="text-[10px] font-mono text-stone-400">CAM-03 · ZENITAL TOPO (12M)</span>
                </div>
                <div className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-900/80 text-emerald-300 border border-emerald-700">
                  {activeStep >= 3 ? 'Carga Inspecionada · Concreto Homogêneo' : 'Balão Pré-Carga / Vazio'}
                </div>
                <div className="absolute bottom-1 left-2 text-[9px] font-mono text-stone-400">
                  ZENITH VIEW · BAL-01
                </div>
              </div>

              {/* CAM 04: Posicionamento dos Eixos */}
              <div className="bg-stone-900 rounded-xl overflow-hidden relative aspect-video border border-stone-800 shadow-inner group">
                <div className="w-full h-full flex flex-col items-center justify-center text-stone-600 bg-gradient-to-b from-stone-900 to-stone-950">
                  <Scale className="w-10 h-10 text-stone-700 mb-1" />
                  <span className="text-[10px] font-mono text-stone-400">CAM-04 · SENSORES DE EIXO</span>
                </div>
                <div className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-900/80 text-emerald-300 border border-emerald-700">
                  4 Eixos 100% sobre as Células Toledo
                </div>
                <div className="absolute bottom-1 left-2 text-[9px] font-mono text-stone-400">
                  DLC-10T × 8 SENSORES OK
                </div>
              </div>
            </div>

            {/* AI Diagnostics Banner */}
            <div className="mt-3 p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <div>
                  <span className="font-bold text-emerald-950">Validação Forense Motor KyttoIA: </span>
                  <span className="text-emerald-800 font-medium">Veículo {currentVehicle.placa} posicionado. Tara dentro da tolerância metrológica (Risco 02/100).</span>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-200 text-emerald-900 flex-shrink-0">
                Score: Aprovado
              </span>
            </div>
          </div>

          {/* Active Vehicle & Order Details Card */}
          <div className="bg-white p-4 rounded-2xl border border-concrete-200 shadow-xs text-xs">
            <h4 className="font-extrabold uppercase tracking-wide text-stone-800 mb-2">
              Dados do Veículo &amp; Ordem de Concretagem NBR 7212
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-stone-600">
              <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200">
                <span className="text-[10px] text-stone-400 block font-semibold">MOTORISTA</span>
                <span className="font-bold text-stone-800 text-xs">{currentVehicle.motorista || 'Motorista'}</span>
                <span className="text-[10px] text-stone-500 block">Prefixo: {currentVehicle.prefixo}</span>
              </div>
              <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200">
                <span className="text-[10px] text-stone-400 block font-semibold">CLIENTE &amp; OBRA</span>
                <span className="font-bold text-stone-800 text-xs truncate block">{currentVehicle.cliente}</span>
                <span className="text-[10px] text-stone-500 block truncate">{currentVehicle.obra}</span>
              </div>
              <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200">
                <span className="text-[10px] text-stone-400 block font-semibold">TRAÇO / FCK</span>
                <span className="font-bold text-stone-800 text-xs">{currentVehicle.traco}</span>
                <span className="text-[10px] text-stone-500 block">Volume: {currentVehicle.volumeM3 || 8.0} m³</span>
              </div>
              <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200">
                <span className="text-[10px] text-stone-400 block font-semibold">SEFAZ / MDF-e</span>
                <span className="font-bold text-emerald-700 text-xs">Sincronizado Automático</span>
                <span className="text-[10px] text-stone-500 block">Semáforo Integrado</span>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Bottom: Recent Completed Weighings History Table */}
      <div className="bg-white p-4 rounded-2xl border border-concrete-200 shadow-xs text-xs">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-extrabold uppercase tracking-wide text-stone-900 text-xs">
              Histórico de Pesagens Emitidas Hoje (Turno CCO Serrano)
            </h3>
            <p className="text-[11px] text-stone-500">
              Registros gravados nas balanças Toledo 720i e integrados com a SEFAZ-MT
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-stone-600 bg-stone-100 px-2.5 py-1 rounded-lg border border-stone-200">
            Total Registros: {ticketsHistory.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-stone-200 text-stone-400 font-bold uppercase text-[10px]">
                <th className="py-2">Ticket Nº</th>
                <th>Balança</th>
                <th>Horário</th>
                <th>Placa / Prefixo</th>
                <th>Motorista</th>
                <th>Cliente / Obra</th>
                <th>Produto / Traço</th>
                <th className="text-right">Tara (kg)</th>
                <th className="text-right">Bruto (kg)</th>
                <th className="text-right">Líquido (kg)</th>
                <th className="text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-700">
              {ticketsHistory.map((t, idx) => (
                <tr key={idx} className="hover:bg-stone-50 transition-colors">
                  <td className="py-2.5 font-mono font-bold text-stone-900">{t.id}</td>
                  <td>
                    <span className="px-1.5 py-0.5 rounded bg-stone-100 font-bold text-[10px] text-stone-700">
                      {t.balancaId || 'BAL-01'}
                    </span>
                  </td>
                  <td className="font-mono text-stone-500">{t.hora}</td>
                  <td className="font-mono font-bold text-stone-800">{t.placa} ({t.prefixo})</td>
                  <td className="font-semibold text-stone-900">{t.motorista}</td>
                  <td className="truncate max-w-[150px]">{t.cliente}</td>
                  <td>{t.produto}</td>
                  <td className="text-right font-mono">{t.taraKg?.toLocaleString('pt-BR')} kg</td>
                  <td className="text-right font-mono">{t.brutoKg?.toLocaleString('pt-BR')} kg</td>
                  <td className="text-right font-mono font-bold text-serrano-700">{t.liquidoKg?.toLocaleString('pt-BR')} kg</td>
                  <td className="text-right">
                    <button
                      type="button"
                      onClick={() => onOpenTicket && onOpenTicket(t)}
                      className="px-2.5 py-1 bg-stone-900 hover:bg-stone-800 text-white rounded-lg font-bold text-[11px] transition-colors"
                      title="Imprimir ou visualizar ticket oficial"
                    >
                      Ticket
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
