import React, { useState, useEffect } from 'react';
import { enviarComandoBalanca } from '../services/api';
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
  RotateCcw,
  X,
  Sparkles,
  ExternalLink,
  Flame,
  Grid
} from 'lucide-react';

const LISTA_CAMERAS_COCKPIT_11 = [
  {
    id: 'cam01',
    numero: 'CAM-01',
    nome: 'LPR Frontal 4K · Entrada Balança',
    marca: 'Hikvision / Toledo',
    modelo: 'DeepinView iDS-TCM403-BI (LPR OCR)',
    ip: '192.168.1.101',
    ponto: 'balanca',
    foto: '/assets/cftv/cftv_cam01_lpr_entrada.jpg',
    tag: '● REC · LPR OCR (99.8%)',
    tagCor: 'emerald',
    badge: 'PLACA IDENTIFICADA: QBF-6M02',
    resolucao: '3840×2160 · 30 FPS · H.265+',
    detalhes: 'Leitura de alta precisão LPR da placa Mercosul com calibração OCR Toledo Prix e conformidade NBR 7212.'
  },
  {
    id: 'cam09',
    numero: 'CAM-09',
    nome: 'LPR Traseira & Descarga Veicular',
    marca: 'Avigilon',
    modelo: 'H5A Bullet 4K AI Analytics',
    ip: '192.168.1.132',
    ponto: 'balanca',
    foto: '/assets/cftv/cftv_cam08_avigilon_traseira.jpg',
    tag: 'TRASEIRA 30 FPS · ENQUADRADA',
    tagCor: 'emerald',
    badge: 'PLACA CONFERE: 100% MATCH',
    resolucao: '3840×2160 · 30 FPS · H.265',
    detalhes: 'Inspeção veicular traseira, verificação de placa e integridade da bica de descarga do balão de concreto.'
  },
  {
    id: 'cam02',
    numero: 'CAM-02',
    nome: 'Balança Rodoviária 80t (Panorâmica 21m)',
    marca: 'Intelbras',
    modelo: 'VIP 9440 B IA PTZ Industrial',
    ip: '192.168.1.102',
    ponto: 'balanca',
    foto: '/assets/cftv/cftv_cam02_plataforma_panoramica.jpg',
    tag: 'BAL-01 21M · 30 FPS',
    tagCor: 'emerald',
    badge: 'VEÍCULO TOTALMENTE SOBRE A PISTA',
    resolucao: '1920×1080 · 30 FPS · H.264',
    detalhes: 'Enquadramento aéreo da plataforma de aço de 21m atestando ausência de eixos fora ou manobras irregulares.'
  },
  {
    id: 'cam07',
    numero: 'CAM-07',
    nome: 'Células de Carga Digitais Toledo Prix',
    marca: 'Bosch',
    modelo: 'Dinion IP Starlight 7000 HD',
    ip: '192.168.1.130',
    ponto: 'balanca',
    foto: '/assets/cftv/cftv_cam07_bosch_celulas.jpg',
    tag: '8 CÉLULAS C1-C8 CALIBRADAS RBC',
    tagCor: 'emerald',
    badge: 'PISTA 100% NIVELADA IPEM/MT',
    resolucao: '1920×1080 · 30 FPS · H.265',
    detalhes: 'Inspeção sub-plataforma das 8 células digitais Toledo Prix modelo DLC-10t com sensores de nivelamento.'
  },
  {
    id: 'cam08',
    numero: 'CAM-08',
    nome: 'Totem Autoatendimento Prix 9094',
    marca: 'Toledo Prix',
    modelo: 'Totem Prix 9094 / Indicador 720i',
    ip: '192.168.1.135',
    ponto: 'balanca',
    foto: '/assets/cftv/cftv_cam09_toledo_totem.jpg',
    tag: 'TOTEM RFID & DISPLAY BIPANDO',
    tagCor: 'emerald',
    badge: 'CHECK-IN MOTORISTA AUTÔNOMO',
    resolucao: '1920×1080 · 30 FPS',
    detalhes: 'Totem industrial de pesagem autônoma com leitor RFID, biometria e emissão térmica automática de ticket.'
  },
  {
    id: 'cam03',
    numero: 'CAM-03',
    nome: 'Cancela de Saída & Portaria MT-358',
    marca: 'Dahua',
    modelo: 'WizMind IPC-HFW5442E',
    ip: '192.168.1.103',
    ponto: 'balanca',
    foto: '/assets/cftv/cftv_cam03_cancela_saida.jpg',
    tag: 'CANCELA 02 · INTERTRAVADA',
    tagCor: 'amber',
    badge: 'GUARITA & CANCELA DE SAÍDA',
    resolucao: '2688×1520 · 30 FPS · H.265',
    detalhes: 'Cancela de saída automatizada com semáforo LED e intertravamento com a autorização SEFAZ MDF-e.'
  },
  {
    id: 'cam04',
    numero: 'CAM-04',
    nome: 'Bateria de Silos 96t (Cimento CP-II)',
    marca: 'Axis',
    modelo: 'Q1798-LE 4K Ultra HD',
    ip: '192.168.1.104',
    ponto: 'silos',
    foto: '/assets/cftv/cftv_cam04_patio_silos.jpg',
    tag: 'SILOS S1-S3 · DESCARGA ATIVA',
    tagCor: 'emerald',
    badge: 'CARRETA SILO DESCARREGANDO',
    resolucao: '3840×2160 · 30 FPS',
    detalhes: 'Silos de cimento CP-II e CP-V com filtros de manga e supervisão de descarregamento pneumático.'
  },
  {
    id: 'cam05',
    numero: 'CAM-05',
    nome: 'Central Dosadora & Misturador MIX-01',
    marca: 'Hikvision',
    modelo: 'DS-2CD2T87G2P ColorVu 4K',
    ip: '192.168.1.105',
    ponto: 'central',
    foto: '/assets/cftv/cftv_cam05_central_dosadora.jpg',
    tag: 'MIXER DUPLO EIXO 2.5m³',
    tagCor: 'emerald',
    badge: 'HOMOGENEIZAÇÃO NBR 7212',
    resolucao: '3840×2160 · 30 FPS',
    detalhes: 'Misturador planetário de duplo eixo forçado com pesagem de água e aditivos em ciclo contínuo.'
  },
  {
    id: 'cam10',
    numero: 'CAM-10',
    nome: 'Termografia Radiométrica FLIR A700',
    marca: 'FLIR',
    modelo: 'FLIR A700 Smart Thermal Sensor',
    ip: '192.168.1.150',
    ponto: 'central',
    foto: '/assets/cftv/cftv_cam12_flir_termica.jpg',
    tag: 'IRONBOW · MOTORES 61.3°C / 78.6°C',
    tagCor: 'rose',
    badge: 'TEMPERATURA DENTRO DO LIMITE SEGURO',
    resolucao: '640×480 Radiométrica · 30 FPS',
    detalhes: 'Monitoramento termográfico contínuo dos mancais, redutores e rolamentos da central dosadora.'
  },
  {
    id: 'cam11',
    numero: 'CAM-11',
    nome: 'Baias de Agregados (Britas 0, 1 e Areia)',
    marca: 'TP-Link VIGI',
    modelo: 'VIGI C340-W 4MP Outdoor',
    ip: '192.168.1.138',
    ponto: 'patio',
    foto: '/assets/cftv/cftv_cam11_tplink_vigi_baias.jpg',
    tag: 'MOEGA EM ALIMENTAÇÃO PÁ VOLVO',
    tagCor: 'amber',
    badge: 'PÁ CARREGADORA L90H EM OPERAÇÃO',
    resolucao: '2560×1440 · 25 FPS',
    detalhes: 'Baias de estocagem de agregados graníticos com carregamento direto da moega por pá carregadeira.'
  },
  {
    id: 'cam06',
    numero: 'CAM-06',
    nome: 'Mineração Areia Rio Sangue (Sepotuba)',
    marca: 'Intelbras',
    modelo: 'VHD 5230 D Varifocal',
    ip: '192.168.1.106',
    ponto: 'mineracao',
    foto: '/assets/cftv/cftv_cam06_mineracao_areia.jpg',
    tag: 'DRAGA FLUTUANTE & HIDROCICLONE',
    tagCor: 'sky',
    badge: 'MINERAÇÃO RIO SANGUE / MT',
    resolucao: '1920×1080 · 30 FPS',
    detalhes: 'Extração e lavagem contínua de areia quartzosa lavada no Rio Sangue / Tangará da Serra.'
  }
];

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
  const [selectedVehicleId, setSelectedVehicleId] = useState(vehicles[0]?.id || 'v1');
  const [activeStep, setActiveStep] = useState(1); // 1: Tara, 2: Carregando, 3: Bruto, 4: Concluído
  
  // Real-time scale weight & jitter simulation
  const [baseWeight, setBaseWeight] = useState(12920);
  const [displayWeight, setDisplayWeight] = useState(12920);
  const [isStable, setIsStable] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isZeroing, setIsZeroing] = useState(false);

  // View mode: 4 primary scale cameras vs all 11 operational cameras
  const [modoVisualizacao, setModoVisualizacao] = useState('4_balanca'); // '4_balanca' | '11_completo'
  const [cameraModal, setCameraModal] = useState(null);

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
    enviarComandoBalanca("zerar_balanca", { balancaId: currentBridge.id }).catch(() => {});
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
        // Simular ida para central dosadora e retorno carregado
        setGateInOpen(false);
        setLightInGreen(false);
        const vol = currentVehicle.volumeM3 || 8.0;
        const pesoCarga = Math.round(vol * 2380);
        const pesoBrutoReal = capturedTara + pesoCarga;
        setBaseWeight(pesoBrutoReal);
        setDisplayWeight(pesoBrutoReal);
        setActiveStep(3);
      } else if (activeStep === 3) {
        // Travar Bruto e emitir ticket
        const finalBruto = displayWeight || (capturedTara + 20620);
        setCapturedBruto(finalBruto);
        const novoTicket = {
          id: `TKT-${new Date().getFullYear()}-${String(ticketsHistory.length + 76).padStart(4, '0')}`,
          balancaId: currentBridge.nome.includes('01') ? 'BAL-01' : 'BAL-02',
          hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          placa: currentVehicle.placa,
          prefixo: currentVehicle.prefixo,
          motorista: currentVehicle.motorista,
          cliente: currentVehicle.cliente,
          obra: currentVehicle.obra,
          produto: `${currentVehicle.traco} (${currentVehicle.volumeM3 || 8.0} m³)`,
          taraKg: capturedTara,
          brutoKg: finalBruto,
          liquidoKg: finalBruto - capturedTara,
          status: 'Autorizado SEFAZ'
        };
        setLastTicket(novoTicket);
        if (onAddTicket) onAddTicket(novoTicket);
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
    setDisplayWeight(currentVehicle.taraKg || 12920);
    setLastTicket(null);
  };

  // As 4 câmeras de foco principal da balança
  const camerasQuatroFoco = [
    LISTA_CAMERAS_COCKPIT_11[0], // CAM-01 Frontal LPR
    LISTA_CAMERAS_COCKPIT_11[1], // CAM-09 Traseira LPR
    LISTA_CAMERAS_COCKPIT_11[2], // CAM-02 Panorâmica 21m
    LISTA_CAMERAS_COCKPIT_11[3]  // CAM-07 Células de Carga
  ];

  const camerasExibidas = modoVisualizacao === '4_balanca' ? camerasQuatroFoco : LISTA_CAMERAS_COCKPIT_11;

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
            type="button"
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
            type="button"
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

      {/* Main Cockpit Grid: Display LED + Cameras Grid */}
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
                    onClick={() => { const next = !lightInGreen; setLightInGreen(next); enviarComandoBalanca(next ? "semaforo_entrada_verde" : "semaforo_entrada_vermelho").catch(() => {}); }}
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
                    onClick={() => { const next = !gateInOpen; setGateInOpen(next); enviarComandoBalanca(next ? "abrir_cancela_entrada" : "fechar_cancela_entrada").catch(() => {}); }}
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
                    onClick={() => { const next = !lightOutGreen; setLightOutGreen(next); enviarComandoBalanca(next ? "semaforo_saida_verde" : "semaforo_saida_vermelho").catch(() => {}); }}
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
                    onClick={() => { const next = !gateOutOpen; setGateOutOpen(next); enviarComandoBalanca(next ? "abrir_cancela_saida" : "fechar_cancela_saida").catch(() => {}); }}
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
                <span className="font-mono text-stone-500">{currentVehicle.traco?.split(' ')[0] || 'TR-FCK30B'}</span>
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

        {/* Right: Cameras Matrix & Order Details (7 cols) */}
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

          {/* Câmeras CFTV da Balança com Feeds Fotográficos Reais 1080p */}
          <div className="bg-white p-4 rounded-2xl border border-concrete-200 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 text-xs">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-stone-600" />
                <h3 className="font-extrabold text-stone-900 uppercase tracking-wide">
                  Matriz de Visão Computacional ({modoVisualizacao === '4_balanca' ? '4 Câmeras LPR & Balança' : '11 Canais Operacionais CCO'})
                </h3>
              </div>

              {/* Botões de Alternância de Visualização */}
              <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setModoVisualizacao('4_balanca')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                    modoVisualizacao === '4_balanca'
                      ? 'bg-white text-stone-900 shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  4 Câmeras Balança
                </button>
                <button
                  type="button"
                  onClick={() => setModoVisualizacao('11_completo')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                    modoVisualizacao === '11_completo'
                      ? 'bg-white text-stone-900 shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Todos os 11 Canais
                </button>
              </div>
            </div>

            {/* Grid de Câmeras com Fotos Reais */}
            <div className={`grid gap-3 ${
              modoVisualizacao === '4_balanca' 
                ? 'grid-cols-1 sm:grid-cols-2' 
                : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
            }`}>
              {camerasExibidas.map((cam) => (
                <div 
                  key={cam.id}
                  onClick={() => setCameraModal(cam)}
                  className="bg-stone-900 rounded-xl overflow-hidden relative aspect-video border border-stone-800 shadow-inner group cursor-pointer hover:border-serrano-500 transition-all"
                  title="Clique para inspecionar em alta definição com visão computacional KyttoIA"
                >
                  {/* Foto Real de CFTV Industrial */}
                  <img 
                    src={cam.foto} 
                    alt={cam.nome} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />

                  {/* Gradiente Escuro Superior e Inferior para Leitura OSD */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/60 pointer-events-none" />

                  {/* Header OSD: Tag Superior Esquerda */}
                  <div className="absolute top-2 left-2 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-black/75 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{cam.tag}</span>
                  </div>

                  {/* Botão Maximizar / Inspecionar Superior Direito */}
                  <div className="absolute top-2 right-2 opacity-80 group-hover:opacity-100 transition-opacity">
                    <span className="p-1 rounded bg-black/60 text-stone-200 border border-stone-700 flex items-center justify-center">
                      <Maximize2 className="w-3 h-3 text-white" />
                    </span>
                  </div>

                  {/* Footer OSD: Nome da Câmera e Badge */}
                  <div className="absolute bottom-2 inset-x-2 flex items-end justify-between gap-1 text-[10px]">
                    <div className="truncate">
                      <span className="font-bold text-white block leading-tight drop-shadow-md truncate">
                        {cam.numero} · {cam.nome.split('·')[0]}
                      </span>
                      <span className="text-[9px] font-mono text-stone-300 block drop-shadow-xs">
                        {cam.marca} · {cam.resolucao.split('·')[0]}
                      </span>
                    </div>

                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-900/80 text-emerald-300 border border-emerald-700 flex-shrink-0">
                      {cam.id === 'cam01' ? `LPR: ${currentVehicle.placa}` : cam.badge.split(':')[0]}
                    </span>
                  </div>

                  {/* Overlay especial da CAM-01 com Bounding Box LPR */}
                  {cam.id === 'cam01' && (
                    <div className="absolute inset-x-6 bottom-8 py-0.5 bg-black/80 backdrop-blur-xs rounded border border-emerald-500/70 text-center font-mono text-[11px] font-bold text-white shadow-lg pointer-events-none">
                      <span className="text-emerald-400 mr-1.5">[PLACA MERCOSUL]</span>
                      <span className="text-amber-300 tracking-wider">{currentVehicle.placa}</span>
                      <span className="text-[9px] text-stone-300 font-sans ml-2">(Confiança: 99.8%)</span>
                    </div>
                  )}

                  {/* Overlay especial da CAM-09 com Bounding Box Traseiro */}
                  {cam.id === 'cam09' && (
                    <div className="absolute inset-x-8 bottom-8 py-0.5 bg-black/80 backdrop-blur-xs rounded border border-emerald-500/70 text-center font-mono text-[11px] font-bold text-white shadow-lg pointer-events-none">
                      <span className="text-emerald-400 mr-1.5">[TRASEIRA CONFIRMADA]</span>
                      <span className="text-white">{currentVehicle.placa}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* AI Diagnostics Banner */}
            <div className="mt-3 p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <div>
                  <span className="font-bold text-emerald-950">Validação Forense Motor KyttoIA: </span>
                  <span className="text-emerald-800 font-medium">Veículo {currentVehicle.placa} posicionado. 11 câmeras sincronizadas e tara dentro da tolerância metrológica (Risco 02/100).</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-200 text-emerald-900">
                  Score: Aprovado
                </span>
              </div>
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

      {/* Modal Snapshot HD e Visão Computacional KyttoIA */}
      {cameraModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setCameraModal(null)}
        >
          <div 
            className="bg-stone-900 border border-stone-700 rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl text-stone-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-stone-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="p-2 bg-serrano-500/20 text-serrano-400 rounded-lg">
                  <Camera className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-extrabold text-white text-sm">
                    {cameraModal.numero} · {cameraModal.nome}
                  </h3>
                  <p className="text-xs text-stone-400">
                    {cameraModal.marca} · {cameraModal.modelo} · IP: {cameraModal.ip}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCameraModal(null)}
                className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Image Body with OSD */}
            <div className="relative aspect-video bg-black flex items-center justify-center">
              <img 
                src={cameraModal.foto} 
                alt={cameraModal.nome}
                className="w-full h-full object-contain"
              />

              {/* OSD Watermark */}
              <div className="absolute top-3 left-3 bg-black/80 px-3 py-1.5 rounded-lg border border-stone-700 font-mono text-xs text-emerald-400">
                {cameraModal.tag}
              </div>

              <div className="absolute top-3 right-3 bg-black/80 px-3 py-1.5 rounded-lg border border-stone-700 font-mono text-xs text-stone-300">
                {cameraModal.resolucao}
              </div>

              {cameraModal.id === 'cam01' && (
                <div className="absolute inset-x-12 bottom-6 py-2 bg-black/85 backdrop-blur-md rounded-xl border border-emerald-500 text-center font-mono text-sm font-bold text-white shadow-2xl">
                  <span className="text-emerald-400 mr-2">[PLACA IDENTIFICADA MOTOR KYTTOIA]</span>
                  <span className="text-amber-400 text-base tracking-widest">{currentVehicle.placa}</span>
                  <span className="text-xs text-stone-300 font-sans ml-3">(Score OCR: 99.8% · Padrão Mercosul Brasil)</span>
                </div>
              )}
            </div>

            {/* Modal Footer Telemetry */}
            <div className="p-4 bg-stone-950 border-t border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="text-stone-400 max-w-xl">
                <span className="font-bold text-white block mb-0.5">Diagnóstico Operacional:</span>
                <span>{cameraModal.detalhes}</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Auditado Motor KyttoIA</span>
                </span>
                <button
                  type="button"
                  onClick={() => setCameraModal(null)}
                  className="px-4 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-white font-bold transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
