import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import KPICards from './components/KPICards';
import DigitalTwin from './components/DigitalTwin';
import LiveFeed from './components/LiveFeed';
import WeighingCockpit from './components/WeighingCockpit';
import QueueSchedule from './components/QueueSchedule';
import AntiFraud from './components/AntiFraud';
import ClientsOrders from './components/ClientsOrders';
import FiscalIntegrations from './components/FiscalIntegrations';
import AnalyticsReports from './components/AnalyticsReports';
import MasterDataRules from './components/MasterDataRules';
import DecisionModal from './components/DecisionModal';
import TicketModal from './components/TicketModal';
import CopilotModal from './components/CopilotModal';
import confetti from 'canvas-confetti';

import { 
  INITIAL_STATS, 
  WEIGHBRIDGES, 
  SILOS, 
  DOSING_PLANT, 
  INITIAL_VEHICLES, 
  INITIAL_FEED_EVENTS 
} from './data/mockData';

export default function App() {
  // Main Navigation state
  const [isEmbedded] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      return p.get('embed') === '1' || window.self !== window.top;
    } catch {
      return false;
    }
  });

  const [activeTab, setActiveTab] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      return p.get('tab') || p.get('view') || p.get('subsecao') || 'torre';
    } catch {
      return 'torre';
    }
  });

  // Listener para sincronização de abas e comandos via postMessage do ERP Pai
  useEffect(() => {
    const handleMessage = (e) => {
      if (e.data?.type === 'CHANGE_TAB' && e.data.tab) {
        setActiveTab(e.data.tab);
      } else if (e.data?.type === 'SET_UNIT' && e.data.unit) {
        setSelectedUnit(e.data.unit);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Notificar o ERP Pai quando a aba ativa mudar internamente
  useEffect(() => {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'TAB_CHANGED', tab: activeTab }, '*');
      }
    } catch {
      // cross-origin guard
    }
  }, [activeTab]);
  const [selectedUnit, setSelectedUnit] = useState('usina'); // 'usina' | 'mineracao'
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Operational Data state
  const [stats, setStats] = useState(INITIAL_STATS);
  const [weighbridges, setWeighbridges] = useState(WEIGHBRIDGES);
  const [silos, setSilos] = useState(SILOS);
  const [vehicles, setVehicles] = useState(INITIAL_VEHICLES);
  const [events, setEvents] = useState(INITIAL_FEED_EVENTS);

  // Simulation Time state
  const [currentTime, setCurrentTime] = useState('13:36');
  const [simSpeed, setSimSpeed] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const [simSeconds, setSimSeconds] = useState(13 * 3600 + 36 * 60);

  // Modals state
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [isDecisionModalOpen, setIsDecisionModalOpen] = useState(false);
  const [activeDecisionData, setActiveDecisionData] = useState(null);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [activeTicketData, setActiveTicketData] = useState(null);

  // Keyboard shortcut Ctrl + K for Copilot
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsCopilotOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Suporte a links diretos para caminhão (?caminhao=1 ou ?betoneira=1)
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      if (p.has('caminhao') || p.has('betoneira')) {
        handleOpenTicket('bal01');
      }
    } catch {
      // ignore
    }
  }, []);

  // Simulation clock ticker
  useEffect(() => {
    if (isPaused) return;

    const intervalTime = 1000 / (simSpeed === 1 ? 1 : simSpeed === 10 ? 3 : simSpeed === 30 ? 6 : 10);
    const timer = setInterval(() => {
      setSimSeconds(prev => {
        const next = prev + 1;
        const hours = Math.floor(next / 3600) % 24;
        const mins = Math.floor((next % 3600) / 60);
        const formatted = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
        setCurrentTime(formatted);
        return next;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [isPaused, simSpeed]);

  // Action: Trigger new vehicle arrival (Simulação rápida)
  const handleTriggerArrival = () => {
    const newVehicle = {
      id: `v-${Date.now()}`,
      placa: 'RRA-9B44',
      prefixo: 'BT-14',
      tipo: 'Betoneira 10m³',
      chassi: 'Volvo VM 330 8x4',
      motorista: 'Carlos Eduardo Mendes',
      localizacao: 'portaria',
      unidade: selectedUnit,
      taraKg: 13050,
      brutoKg: null,
      liquidoKg: null,
      pedidoId: 'PED-4419',
      cliente: 'Construtora Pantanal',
      obra: 'Edifício Tangará Prime',
      traco: 'TR-FCK30B',
      volumeM3: 10.0,
      horaEntrada: currentTime,
      statusTag: 'Na portaria / OCR',
      alerta: null
    };

    setVehicles(prev => [newVehicle, ...prev]);
    setStats(prev => ({
      ...prev,
      veiculosNoSite: prev.veiculosNoSite + 1,
      veiculosFila: prev.veiculosFila + 1
    }));

    const newEvent = {
      id: `evt-${Date.now()}`,
      hora: currentTime,
      tipo: 'lpr',
      categoria: 'KyttoIA',
      titulo: `KyttoIA Placa lida: ${newVehicle.placa}`,
      detalhes: `Portaria Totem · Confiança 99,8% · Veículo ${newVehicle.prefixo} direcionado para Faixa de Espera`,
      severidade: 'info',
      unidade: selectedUnit
    };
    setEvents(prev => [newEvent, ...prev]);
  };

  // Action: Trigger exception / fraud alert (Simulação de Anomalia)
  const handleTriggerException = () => {
    const exceptionEvent = {
      id: `evt-${Date.now()}`,
      hora: currentTime,
      tipo: 'ia_alerta',
      categoria: 'KyttoIA',
      titulo: `KyttoIA Tara fora do padrão · RRA-9B44`,
      detalhes: `Tara 13.050 kg vs média 12.100 kg (+7,8%). Risco de tanque de lastro adulterado detectado pelo Motor KyttoIA.`,
      severidade: 'critico',
      unidade: selectedUnit,
      acao: {
        rotulo: 'Decidir',
        veiculoPlaca: 'RRA-9B44',
        excecaoTipo: 'tara_fora_padrao'
      }
    };

    setEvents(prev => [exceptionEvent, ...prev]);
    setStats(prev => ({
      ...prev,
      excecoesAbertas: prev.excecoesAbertas + 1
    }));
  };

  // Action: Open decision modal
  const handleOpenDecisionModal = (data) => {
    setActiveDecisionData(data);
    setIsDecisionModalOpen(true);
  };

  // Action: Resolve exception from modal
  const handleResolveDecision = (action, justificativa) => {
    setIsDecisionModalOpen(false);
    setStats(prev => ({
      ...prev,
      excecoesAbertas: Math.max(0, prev.excecoesAbertas - 1)
    }));

    const resolvedEvent = {
      id: `evt-${Date.now()}`,
      hora: currentTime,
      tipo: 'sucesso',
      categoria: 'KyttoIA',
      titulo: `Exceção Resolvida: ${activeDecisionData?.veiculoPlaca || 'NJK-3307'}`,
      detalhes: action === 'aprovar' 
        ? `Liberado pelo CCO: "${justificativa}"`
        : action === 'excecao'
        ? 'Veículo mantido retido na Baia de Exceção para fiscalização física'
        : 'Manobra de repesagem com operador acionada na BAL-01',
      severidade: action === 'aprovar' ? 'sucesso' : 'critico',
      unidade: selectedUnit
    };

    setEvents(prev => [resolvedEvent, ...prev]);

    if (action === 'aprovar') {
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.8 } });
    }
  };

  // Action: Open weight ticket modal
  const handleOpenTicket = (bridgeKey = 'bal01') => {
    const bridge = weighbridges[bridgeKey] || weighbridges.bal01;
    setActiveTicketData({
      numero: 'TKT-2026-0075',
      placa: bridge.veiculoAtual?.placa || 'QBF-6M02',
      prefixo: bridge.veiculoAtual?.modelo || 'BT-05 (Scania P310 8x4)',
      balanca: bridge.nome,
    });
    setIsTicketModalOpen(true);
  };

  return (
    <div className={`w-full bg-[#FBF9F5] text-stone-800 flex flex-col font-sans ${isEmbedded ? 'h-full min-h-full' : 'min-h-screen'}`}>
      
      {/* Global Application Header - Oculto quando embutido no ERP Kytto */}
      {!isEmbedded && (
      <Header 
        stats={stats}
        weighbridges={weighbridges}
        currentTime={currentTime}
        simSpeed={simSpeed}
        setSimSpeed={setSimSpeed}
        isPaused={isPaused}
        setIsPaused={setIsPaused}
        onTriggerArrival={handleTriggerArrival}
        onTriggerException={handleTriggerException}
        onOpenCopilot={() => setIsCopilotOpen(true)}
        selectedUnit={selectedUnit}
        setSelectedUnit={setSelectedUnit}
        onOpenTicket={handleOpenTicket}
      />
      )}

      {/* Main Workspace: Sidebar + Dynamic Content Canvas */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Navigation Sidebar - Oculto quando embutido no ERP Kytto */}
        {!isEmbedded && (
        <Sidebar 
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
          stats={stats}
        />
        )}

        {/* Center / Right Content Canvas - 100% da largura útil sem barra lateral duplicada */}
        <main className={`flex-1 overflow-y-auto max-w-[1600px] mx-auto w-full ${isEmbedded ? 'p-3 md:p-4' : 'p-4'}`}>
          
          {/* TAB 1: TORRE DE CONTROLE (Gêmeo Digital + Feed AGORA) */}
          {activeTab === 'torre' && (
            <div className="space-y-4">
              
              {/* Section Sub-Header with Unit Switcher */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-stone-900 tracking-tight">
                    TORRE DE CONTROLE
                  </h2>
                  <p className="text-xs text-stone-500 font-medium">
                    {currentTime} · {stats.veiculosNoSite} veículos nas duas unidades · {stats.excecoesAbertas} exceção(ões) esperando decisão.
                  </p>
                </div>

                {/* Segmented Control: Usina MT-358 vs Mineração */}
                <div className="flex items-center gap-1 bg-stone-200/80 p-1 rounded-xl self-start sm:self-auto">
                  <button
                    onClick={() => setSelectedUnit('usina')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                      selectedUnit === 'usina'
                        ? 'bg-stone-900 text-white shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    Usina Concreto
                  </button>
                  <button
                    onClick={() => setSelectedUnit('mineracao')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                      selectedUnit === 'mineracao'
                        ? 'bg-stone-900 text-white shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    Mineração Agregados
                  </button>
                </div>
              </div>

              {/* 6 Real-time KPI Cards */}
              <KPICards 
                stats={stats} 
                onSelectExceptionCard={() => setActiveTab('antifraude')}
              />

              {/* Split Screen: Gêmeo Digital (70%) + Feed AGORA (30%) */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                
                {/* Gêmeo Digital Interativo (8 cols) */}
                <div className="xl:col-span-8">
                  <DigitalTwin 
                    unit={selectedUnit}
                    setUnit={setSelectedUnit}
                    vehicles={vehicles}
                    silos={silos}
                    dosingPlant={DOSING_PLANT}
                    weighbridges={weighbridges}
                    onSelectVehicle={(v) => {
                      if (v.localizacao === 'excecao') {
                        handleOpenDecisionModal(v);
                      } else {
                        handleOpenTicket('bal01');
                      }
                    }}
                    onSelectSilo={(s) => setActiveTab('relatorios')}
                    onOpenBalancaCockpit={() => setActiveTab('pesagem')}
                  />
                </div>

                {/* Feed em Tempo Real "AGORA" (4 cols) */}
                <div className="xl:col-span-4">
                  <LiveFeed 
                    events={events}
                    onOpenDecisionModal={handleOpenDecisionModal}
                    onSelectEvent={(evt) => {
                      if (evt.acao) handleOpenDecisionModal(evt);
                    }}
                  />
                </div>

              </div>

            </div>
          )}

          {/* TAB 2: PESAGEM & BALANÇA AO VIVO */}
          {activeTab === 'pesagem' && (
            <WeighingCockpit 
              weighbridges={weighbridges}
              onOpenTicket={handleOpenTicket}
              onToggleGate={(bridgeId) => {
                setWeighbridges(prev => ({
                  ...prev,
                  [bridgeId]: {
                    ...prev[bridgeId],
                    cancela: prev[bridgeId].cancela === 'aberta' ? 'fechada' : 'aberta'
                  }
                }));
              }}
            />
          )}

          {/* TAB 3: FILA & AGENDA INTELIGENTE */}
          {activeTab === 'fila' && (
            <QueueSchedule 
              vehicles={vehicles}
              onScheduleNew={() => {}}
            />
          )}

          {/* TAB 4: ANTIFRAUDE & MOTOR KYTTOIA */}
          {activeTab === 'antifraude' && (
            <AntiFraud 
              onOpenDecisionModal={handleOpenDecisionModal}
            />
          )}

          {/* TAB 5: CLIENTES, OBRAS & TRAÇOS */}
          {activeTab === 'clientes' && (
            <ClientsOrders />
          )}

          {/* TAB 6: FISCAL & SEFAZ-MT */}
          {activeTab === 'fiscal' && (
            <FiscalIntegrations />
          )}

          {/* TAB 7: RELATÓRIOS & ANALYTICS */}
          {activeTab === 'relatorios' && (
            <AnalyticsReports 
              stats={stats}
              silos={silos}
            />
          )}

          {/* TAB 8: CADASTROS & REGRAS */}
          {activeTab === 'cadastros' && (
            <MasterDataRules />
          )}

        </main>
      </div>

      {/* MODALS */}
      {/* 1. KyttoIA Copilot Modal (Ctrl + K) */}
      <CopilotModal 
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        stats={stats}
        silos={silos}
        vehicles={vehicles}
      />

      {/* 2. Exception Decision Modal */}
      {isDecisionModalOpen && (
        <DecisionModal 
          exceptionData={activeDecisionData}
          onClose={() => setIsDecisionModalOpen(false)}
          onResolve={handleResolveDecision}
        />
      )}

      {/* 3. Official Printable Weight Ticket Modal */}
      {isTicketModalOpen && (
        <TicketModal 
          ticketData={activeTicketData}
          onClose={() => setIsTicketModalOpen(false)}
        />
      )}

    </div>
  );
}
