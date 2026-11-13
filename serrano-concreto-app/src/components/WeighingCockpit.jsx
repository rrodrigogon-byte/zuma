import React, { useState } from 'react';
import { 
  Scale, 
  Camera, 
  CheckCircle, 
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
  Radio
} from 'lucide-react';

export default function WeighingCockpit({ 
  weighbridges, 
  onPerformWeighing, 
  onOpenTicket,
  onToggleGate 
}) {
  const [selectedBridge, setSelectedBridge] = useState('bal01');
  const [activeStep, setActiveStep] = useState(1); // 1: Tara/Entrada, 2: Carregamento, 3: Bruto/Saída, 4: Concluído
  const [capturedTara, setCapturedTara] = useState(12920);
  const [capturedBruto, setCapturedBruto] = useState(33540);
  const [selectedProduct, setSelectedProduct] = useState('TR-FCK30B (FCK 30 MPa)');
  const [isCapturing, setIsCapturing] = useState(false);

  const currentBridge = weighbridges[selectedBridge];
  const liquidoKg = capturedBruto - capturedTara;

  const handleCapture = () => {
    setIsCapturing(true);
    setTimeout(() => {
      setIsCapturing(false);
      if (activeStep === 1) {
        setActiveStep(2);
      } else if (activeStep === 2) {
        setActiveStep(3);
      } else if (activeStep === 3) {
        setActiveStep(4);
      }
    }, 600);
  };

  const handleResetCycle = () => {
    setActiveStep(1);
    setCapturedBruto(33540);
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
              Sincronizado via Modbus TCP
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-0.5">
            Automação de pesagem rodoviária sem operador · Verificação em tempo real pelo <strong className="text-stone-700">Motor KyttoIA</strong>
          </p>
        </div>

        {/* Bridge Switcher Pills */}
        <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl">
          <button
            onClick={() => setSelectedBridge('bal01')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              selectedBridge === 'bal01'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            BAL-01 · Usina MT-358 (80t)
          </button>
          <button
            onClick={() => setSelectedBridge('bal02')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              selectedBridge === 'bal02'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            BAL-02 · Mineração (60t)
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
              <span className="flex items-center gap-1">
                <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                {currentBridge.fabricante}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-stone-900 text-stone-300 border border-stone-800">
                INMETRO MT-0894
              </span>
            </div>

            {/* Glowing Big Digits */}
            <div className="py-4 font-mono font-black text-5xl sm:text-6xl text-emerald-400 tracking-wider drop-shadow-[0_0_15px_rgba(52,211,153,0.4)]">
              {currentBridge.pesoAtualKg.toLocaleString('pt-BR')}
              <span className="text-xl sm:text-2xl text-emerald-600 font-sans font-bold ml-2">kg</span>
            </div>

            {/* Status indicators in the scale */}
            <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-stone-900 text-[11px] font-mono">
              <div className="bg-stone-900/80 p-2 rounded-lg border border-stone-800/80">
                <span className="text-stone-500 block text-[10px]">ESTABILIDADE</span>
                <span className="text-emerald-400 font-bold">ESTÁVEL</span>
              </div>
              <div className="bg-stone-900/80 p-2 rounded-lg border border-stone-800/80">
                <span className="text-stone-500 block text-[10px]">ZERO</span>
                <span className="text-stone-300 font-bold">CENTRO ZERO</span>
              </div>
              <div className="bg-stone-900/80 p-2 rounded-lg border border-stone-800/80">
                <span className="text-stone-500 block text-[10px]">LÍQUIDO (t)</span>
                <span className="text-amber-400 font-bold">{(liquidoKg / 1000).toFixed(2)} t</span>
              </div>
            </div>

            {/* Hardware Quick Actions */}
            <div className="mt-4 flex items-center justify-between gap-2 pt-2">
              <button 
                onClick={handleCapture}
                disabled={isCapturing}
                className="flex-1 py-2.5 bg-serrano-500 hover:bg-serrano-600 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-1.5"
              >
                <Scale className="w-4 h-4" />
                <span>{isCapturing ? 'Capturando...' : activeStep === 1 ? 'Capturar Tara (1ª)' : 'Capturar Bruto (2ª)'}</span>
              </button>

              <button 
                onClick={() => onToggleGate && onToggleGate(selectedBridge)}
                className="px-3 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold rounded-xl border border-stone-700 transition-colors flex items-center gap-1"
                title="Comando manual de cancela"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>Cancela</span>
              </button>
            </div>
          </div>

          {/* Scale Cycle Progress Card */}
          <div className="bg-white p-4 rounded-2xl border border-concrete-200 shadow-xs">
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-stone-800 mb-3 flex items-center justify-between">
              <span>Fluxo do Ciclo de Pesagem</span>
              <span className="text-[10px] text-stone-500 font-normal">Passo {activeStep} de 4</span>
            </h3>

            <div className="space-y-2.5 text-xs">
              
              {/* Step 1 */}
              <div className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                activeStep === 1 ? 'bg-serrano-50 border-serrano-300 text-serrano-900 font-bold' : activeStep > 1 ? 'bg-emerald-50/60 border-emerald-200 text-emerald-800' : 'bg-stone-50 border-stone-200 text-stone-400'
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    activeStep > 1 ? 'bg-emerald-500 text-white' : activeStep === 1 ? 'bg-serrano-500 text-white' : 'bg-stone-300 text-white'
                  }`}>1</span>
                  <span>1ª Pesagem: Captura da Tara</span>
                </div>
                <span className="font-mono">{capturedTara.toLocaleString('pt-BR')} kg</span>
              </div>

              {/* Step 2 */}
              <div className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                activeStep === 2 ? 'bg-serrano-50 border-serrano-300 text-serrano-900 font-bold' : activeStep > 2 ? 'bg-emerald-50/60 border-emerald-200 text-emerald-800' : 'bg-stone-50 border-stone-200 text-stone-400'
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    activeStep > 2 ? 'bg-emerald-500 text-white' : activeStep === 2 ? 'bg-serrano-500 text-white' : 'bg-stone-300 text-white'
                  }`}>2</span>
                  <span>Carregamento na Usina/Baia</span>
                </div>
                <span className="text-[11px] font-medium">{selectedProduct.split(' ')[0]}</span>
              </div>

              {/* Step 3 */}
              <div className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                activeStep === 3 ? 'bg-serrano-50 border-serrano-300 text-serrano-900 font-bold' : activeStep > 3 ? 'bg-emerald-50/60 border-emerald-200 text-emerald-800' : 'bg-stone-50 border-stone-200 text-stone-400'
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    activeStep > 3 ? 'bg-emerald-500 text-white' : activeStep === 3 ? 'bg-serrano-500 text-white' : 'bg-stone-300 text-white'
                  }`}>3</span>
                  <span>2ª Pesagem: Captura Peso Bruto</span>
                </div>
                <span className="font-mono">{capturedBruto.toLocaleString('pt-BR')} kg</span>
              </div>

              {/* Step 4 */}
              <div className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                activeStep === 4 ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold' : 'bg-stone-50 border-stone-200 text-stone-400'
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    activeStep === 4 ? 'bg-emerald-600 text-white' : 'bg-stone-300 text-white'
                  }`}>4</span>
                  <span>Emissão de Ticket & MDF-e</span>
                </div>
                <span className="font-semibold text-emerald-700">Líquido: {liquidoKg.toLocaleString('pt-BR')} kg</span>
              </div>

            </div>

            {/* Print Ticket Button when Cycle is complete */}
            {activeStep === 4 && (
              <div className="mt-4 pt-3 border-t border-concrete-100 flex items-center gap-2">
                <button
                  onClick={() => onOpenTicket && onOpenTicket(selectedBridge)}
                  className="flex-1 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-300" />
                  <span>Visualizar & Imprimir Ticket</span>
                </button>
                <button
                  onClick={handleResetCycle}
                  className="p-2 text-stone-600 hover:bg-stone-100 rounded-xl border border-stone-200"
                  title="Iniciar novo ciclo"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Right: Quad Camera Inspection & AI Verification (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Quad Cams Header */}
          <div className="bg-white p-4 rounded-2xl border border-concrete-200 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-serrano-600" />
                <h3 className="text-xs font-extrabold uppercase tracking-wide text-stone-800">
                  Câmeras de Segurança & OCR da Balança (4 Canais)
                </h3>
              </div>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                REC 1080p · 30 FPS
              </span>
            </div>

            {/* 4 Camera Feeds in 2x2 Grid */}
            <div className="grid grid-cols-2 gap-3">
              
              {/* CAM 01: Frontal LPR */}
              <div className="bg-stone-900 rounded-xl overflow-hidden relative aspect-video border border-stone-800 shadow-inner group">
                {/* Simulated video content */}
                <div className="w-full h-full flex flex-col items-center justify-center text-stone-600 bg-gradient-to-b from-stone-900 to-stone-950">
                  <Truck className="w-10 h-10 text-stone-700 mb-1" />
                  <span className="text-[10px] font-mono text-stone-400">CAM-01 · LPR DIANTEIRA</span>
                </div>
                {/* LPR Bounding Box Overlay */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 border-2 border-emerald-400 rounded px-2 py-0.5 bg-black/60 backdrop-blur-xs text-center">
                  <div className="text-[9px] text-emerald-300 font-mono">PLACA LIDA (99.7%)</div>
                  <div className="text-xs font-mono font-black text-white">QBF-6M02</div>
                </div>
                {/* Timestamp */}
                <div className="absolute bottom-1 left-2 text-[9px] font-mono text-stone-400">
                  BAL-01 FRONT · 13:36:12
                </div>
              </div>

              {/* CAM 02: Traseira LPR */}
              <div className="bg-stone-900 rounded-xl overflow-hidden relative aspect-video border border-stone-800 shadow-inner group">
                <div className="w-full h-full flex flex-col items-center justify-center text-stone-600 bg-gradient-to-b from-stone-900 to-stone-950">
                  <Truck className="w-10 h-10 text-stone-700 mb-1" />
                  <span className="text-[10px] font-mono text-stone-400">CAM-02 · LPR TRASEIRA</span>
                </div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 border-2 border-emerald-400 rounded px-2 py-0.5 bg-black/60 backdrop-blur-xs text-center">
                  <div className="text-[9px] text-emerald-300 font-mono">CARRETA / BALÃO</div>
                  <div className="text-xs font-mono font-black text-white">BT-05 OK</div>
                </div>
                <div className="absolute bottom-1 left-2 text-[9px] font-mono text-stone-400">
                  BAL-01 REAR · 13:36:12
                </div>
              </div>

              {/* CAM 03: Zenital / Topo da Carga */}
              <div className="bg-stone-900 rounded-xl overflow-hidden relative aspect-video border border-stone-800 shadow-inner group">
                <div className="w-full h-full flex flex-col items-center justify-center text-stone-600 bg-gradient-to-b from-stone-900 to-stone-950">
                  <Layers className="w-10 h-10 text-stone-700 mb-1" />
                  <span className="text-[10px] font-mono text-stone-400">CAM-03 · ZENITAL TOPO</span>
                </div>
                <div className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-900/80 text-emerald-300 border border-emerald-700">
                  Balão Vazio / Pré-carga
                </div>
                <div className="absolute bottom-1 left-2 text-[9px] font-mono text-stone-400">
                  TOP VIEW 12M · 13:36:12
                </div>
              </div>

              {/* CAM 04: Posicionamento dos Eixos */}
              <div className="bg-stone-900 rounded-xl overflow-hidden relative aspect-video border border-stone-800 shadow-inner group">
                <div className="w-full h-full flex flex-col items-center justify-center text-stone-600 bg-gradient-to-b from-stone-900 to-stone-950">
                  <Scale className="w-10 h-10 text-stone-700 mb-1" />
                  <span className="text-[10px] font-mono text-stone-400">CAM-04 · SENSORES DE EIXO</span>
                </div>
                <div className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-900/80 text-emerald-300 border border-emerald-700">
                  4 Eixos 100% na Plataforma
                </div>
                <div className="absolute bottom-1 left-2 text-[9px] font-mono text-stone-400">
                  AXLE SENSOR BT-05 · 13:36:12
                </div>
              </div>

            </div>

            {/* AI Diagnostics Banner */}
            <div className="mt-3 p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <div>
                  <span className="font-bold text-emerald-950">Validação KyttoIA: </span>
                  <span className="text-emerald-800 font-medium">Veículo QBF-6M02 posicionado corretamente. Desvio de tara de +0.15% dentro da margem de tolerância.</span>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-200 text-emerald-900 flex-shrink-0">
                Score Risco: 02/100
              </span>
            </div>
          </div>

          {/* Active Vehicle & Order Details Card */}
          <div className="bg-white p-4 rounded-2xl border border-concrete-200 shadow-xs text-xs">
            <h4 className="font-extrabold uppercase tracking-wide text-stone-800 mb-2">
              Dados do Veículo & Pedido em Pesagem
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-stone-600">
              <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200">
                <span className="text-[10px] text-stone-400 block font-semibold">MOTORISTA</span>
                <span className="font-bold text-stone-800 text-xs">Valdir Silveira</span>
                <span className="text-[10px] text-stone-500 block">CNH: 0492819402</span>
              </div>

              <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200">
                <span className="text-[10px] text-stone-400 block font-semibold">CLIENTE</span>
                <span className="font-bold text-stone-800 text-xs">Construtora Alvorada</span>
                <span className="text-[10px] text-stone-500 block">Obra: Residencial Manacá</span>
              </div>

              <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200">
                <span className="text-[10px] text-stone-400 block font-semibold">PRODUTO / TRAÇO</span>
                <span className="font-bold text-stone-800 text-xs">TR-FCK30B</span>
                <span className="text-[10px] text-stone-500 block">Slump 16±3cm · 10.0 m³</span>
              </div>

              <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200">
                <span className="text-[10px] text-stone-400 block font-semibold">SEFAZ / MDF-e</span>
                <span className="font-bold text-emerald-700 text-xs">Autorizado Automático</span>
                <span className="text-[10px] text-stone-500 block">Emissão sem operador</span>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
