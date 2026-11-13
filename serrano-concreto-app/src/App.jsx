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
import ArrivalModal from './components/ArrivalModal';
import AnomalyModal from './components/AnomalyModal';
import DanfeModal from './components/DanfeModal';
import confetti from 'canvas-confetti';
import { 
  INITIAL_STATS, 
  WEIGHBRIDGES, 
  SILOS, 
  DOSING_PLANT, 
  INITIAL_VEHICLES, 
  INITIAL_FEED_EVENTS,
  FLEET as INITIAL_FLEET,
  DRIVERS as INITIAL_DRIVERS
} from './data/mockData';

export default function App() {
  // Main Navigation state & embedded mode (inside ERP Kytto)
  const [activeTab, setActiveTab] = useState('torre');
  const [selectedUnit, setSelectedUnit] = useState('usina'); // 'usina' | 'mineracao'
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isEmbedded, setIsEmbedded] = useState(false);

  // Operational Data state
  const [stats, setStats] = useState(INITIAL_STATS);
  const [weighbridges, setWeighbridges] = useState(WEIGHBRIDGES);
  const [silos, setSilos] = useState(SILOS);
  const [vehicles, setVehicles] = useState(INITIAL_VEHICLES);
  const [events, setEvents] = useState(INITIAL_FEED_EVENTS);

  // Tickets History
  const [ticketsHistory, setTicketsHistory] = useState([
    {
      id: 'TKT-2026-0075',
      balancaId: 'BAL-01',
      placa: 'QBF-6M02',
      prefixo: 'BT-05',
      motorista: 'Valdir Silveira',
      cliente: 'Construtora Alvorada Ltda',
      obra: 'Residencial Manacá - Laje 4º Pav.',
      produto: 'TR-FCK30B (FCK 30 MPa)',
      volumeM3: 8.66,
      taraKg: 12920,
      brutoKg: 33540,
      liquidoKg: 20620,
      hora: '11:42',
      data: 'Hoje',
      mdfe: 'MDF-2026-482',
      status: 'Concluído com Sucesso'
    },
    {
      id: 'TKT-2026-0074',
      balancaId: 'BAL-02',
      placa: 'QBM-4J11',
      prefixo: 'CB-01',
      motorista: 'José Roberto Lima',
      cliente: 'Pavimentadora Pantanal Ltda',
      obra: 'Duplicação Av. Lions Internacional',
      produto: 'Pedra Britada nº 1 (Basalto)',
      volumeM3: 20.0,
      taraKg: 14850,
      brutoKg: 46200,
      liquidoKg: 31350,
      hora: '10:15',
      data: 'Hoje',
      mdfe: 'MDF-2026-480',
      status: 'Concluído com Sucesso'
    },
    {
      id: 'TKT-2026-0073',
      balancaId: 'BAL-01',
      placa: 'QBC-8821',
      prefixo: 'BT-03',
      motorista: 'Carlos Eduardo Ramos',
      cliente: 'Engenharia & Obras Tangará ME',
      obra: 'Galpão Logístico Distrito Industrial',
      produto: 'TR-FCK25 (FCK 25 MPa)',
      volumeM3: 8.0,
      taraKg: 12800,
      brutoKg: 31840,
      liquidoKg: 19040,
      hora: '08:30',
      data: 'Hoje',
      mdfe: 'MDF-2026-478',
      status: 'Concluído com Sucesso'
    }
  ]);

  // Simulation Time / Real Time
  const [isRealTime, setIsRealTime] = useState(true);
  const [currentTime, setCurrentTime] = useState(
    new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );
  const [simSpeed, setSimSpeed] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const [simSeconds, setSimSeconds] = useState(13 * 3600 + 36 * 60);

  // Modals state
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [isDecisionModalOpen, setIsDecisionModalOpen] = useState(false);
  const [activeDecisionData, setActiveDecisionData] = useState(null);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [activeTicketData, setActiveTicketData] = useState(null);
  const [showArrivalModal, setShowArrivalModal] = useState(false);
  const [showAnomalyModal, setShowAnomalyModal] = useState(false);
  const [showDanfeModal, setShowDanfeModal] = useState(false);
  const [activeDanfeDoc, setActiveDanfeDoc] = useState(null);

  // Read URL parameters for direct deep-link or ERP embedding
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam && ['torre', 'pesagem', 'fila', 'antifraude', 'clientes', 'fiscal', 'relatorios', 'cadastros'].includes(tabParam)) {
        setActiveTab(tabParam);
      }
      if (params.get('embedded') === 'true' || window.self !== window.top) {
        setIsEmbedded(true);
      }
    } catch (e) {}
  }, []);

  // Clock runner: Real Time or Simulator
  useEffect(() => {
    const timer = setInterval(() => {
      if (isRealTime) {
        setCurrentTime(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      } else if (!isPaused) {
        setSimSeconds(prev => {
          const next = prev + simSpeed;
          const h = Math.floor(next / 3600) % 24;
          const m = Math.floor((next % 3600) / 60);
          const s = next % 60;
          setCurrentTime(
            `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
          );
          return next;
        });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isRealTime, isPaused, simSpeed]);

  // Keyboard shortcut Ctrl+K for Copilot
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

  // Handlers
  const handleOpenTicket = (ticket) => {
    setActiveTicketData(ticket);
    setIsTicketModalOpen(true);
  };

  const handleOpenDanfe = (doc) => {
    setActiveDanfeDoc(doc);
    setShowDanfeModal(true);
  };

  const handleOpenDecisionModal = (data) => {
    setActiveDecisionData(data);
    setIsDecisionModalOpen(true);
  };

  const handleResolveDecision = (action, note) => {
    setIsDecisionModalOpen(false);
    setStats(prev => ({
      ...prev,
      excecoesAbertas: Math.max(0, prev.excecoesAbertas - 1)
    }));

    const newEvt = {
      id: `evt-${Date.now()}`,
      hora: currentTime.slice(0, 5),
      tipo: 'sucesso',
      titulo: `Exceção Resolvida: ${action === 'aprovar' ? 'Liberado com Ressalva' : 'Rejeitado / Retorno ao Pátio'}`,
      descricao: `Operador CCO: "${note}"`,
      veiculo: activeDecisionData?.veiculo || 'BT-06',
      placa: activeDecisionData?.placa || 'QBF-6M02'
    };
    setEvents(prev => [newEvt, ...prev]);

    try {
      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.7 }
      });
    } catch (e) {}
  };

  const handleAddTicket = (newTicket) => {
    setTicketsHistory(prev => [newTicket, ...prev]);
    setStats(prev => ({
      ...prev,
      pesagensHoje: prev.pesagensHoje + 1,
      movimentadoTon: Number((prev.movimentadoTon + (newTicket.liquidoKg / 1000)).toFixed(1)),
      concretoProduzidoM3: Number((prev.concretoProduzidoM3 + (newTicket.volumeM3 || 8.0)).toFixed(1))
    }));

    const newEvt = {
      id: `evt-${Date.now()}`,
      hora: currentTime.slice(0, 5),
      tipo: 'sucesso',
      titulo: `Pesagem Concluída: ${newTicket.id}`,
      descricao: `${newTicket.produto} · Líquido: ${newTicket.liquidoKg.toLocaleString('pt-BR')} kg · Cliente: ${newTicket.cliente}`,
      veiculo: newTicket.prefixo,
      placa: newTicket.placa
    };
    setEvents(prev => [newEvt, ...prev]);

    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (e) {}
  };

  const handleRegisterArrival = (newVehicle) => {
    setVehicles(prev => [newVehicle, ...prev]);
    setStats(prev => ({
      ...prev,
      veiculosNoSite: prev.veiculosNoSite + 1,
      veiculosPatio: prev.veiculosPatio + 1
    }));

    const newEvt = {
      id: `evt-${Date.now()}`,
      hora: currentTime.slice(0, 5),
      tipo: 'info',
      titulo: `Chegada Registrada: ${newVehicle.prefixo} (${newVehicle.placa})`,
      descricao: `Leitura OCR 99.8% · Motorista: ${newVehicle.motorista} · Direcionado: Pátio`,
      veiculo: newVehicle.prefixo,
      placa: newVehicle.placa
    };
    setEvents(prev => [newEvt, ...prev]);

    try {
      confetti({
        particleCount: 50,
        spread: 50,
        origin: { y: 0.6 }
      });
    } catch (e) {}
  };

  const handleInjectAnomaly = (anomaly) => {
    setStats(prev => ({
      ...prev,
      excecoesAbertas: prev.excecoesAbertas + 1
    }));

    const newEvt = {
      id: `evt-${Date.now()}`,
      hora: currentTime.slice(0, 5),
      tipo: 'alerta',
      titulo: `ALERTA ANTIFRAUDE: ${anomaly.tipo}`,
      descricao: `${anomaly.descricao} (Severidade: ${anomaly.severidade})`,
      veiculo: anomaly.prefixo,
      placa: anomaly.placa,
      acao: 'Auditar no CCO'
    };
    setEvents(prev => [newEvt, ...prev]);
    setActiveTab('antifraude');
  };

  return (
    <div className={`w-full bg-concrete-100 font-sans text-stone-900 flex flex-col selection:bg-serrano-500 selection:text-white ${isEmbedded ? 'h-full min-h-full' : 'min-h-screen'}`}>
      {/* 1. Global Header - Oculto quando embutido no ERP Kytto */}
      {!isEmbedded && (
        <Header 
          currentTime={currentTime}
          isRealTime={isRealTime}
          onToggleRealTime={() => setIsRealTime(!isRealTime)}
          simSpeed={simSpeed}
          onSpeedChange={setSimSpeed}
          isPaused={isPaused}
          onTogglePause={() => setIsPaused(!isPaused)}
          onOpenCopilot={() => setIsCopilotOpen(true)}
          onOpenArrivalModal={() => setShowArrivalModal(true)}
          onOpenAnomalyModal={() => setShowAnomalyModal(true)}
          stats={stats}
          weighbridges={weighbridges}
          onOpenTicket={() => handleOpenTicket(ticketsHistory[0])}
        />
      )}

      {/* 2. Main Workspace: Sidebar + Dynamic Content Canvas */}
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

        {/* Dynamic Center Work Area */}
        <main className={`flex-1 overflow-y-auto w-full ${isEmbedded ? 'p-3 md:p-4' : 'p-4 lg:p-6'} space-y-5`}>
          {/* TAB 1: TORRE DE CONTROLE & GÊMEO DIGITAL */}
          {activeTab === 'torre' && (
            <div className="space-y-4">
              {/* Unit Switcher */}
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-black text-stone-900 tracking-tight flex items-center gap-2">
                    <span>TORRE DE CONTROLE &amp; CCO INTEGRADO</span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Tangará da Serra · MT
                    </span>
                  </h1>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Supervisão de pesagem rodoviária, automação Convicta 96T e telemetria Toledo 720i
                  </p>
                </div>

                <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl">
                  <button
                    onClick={() => setSelectedUnit('usina')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                      selectedUnit === 'usina'
                        ? 'bg-stone-900 text-white shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    Usina Concreto (MT-358)
                  </button>
                  <button
                    onClick={() => setSelectedUnit('mineracao')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                      selectedUnit === 'mineracao'
                        ? 'bg-stone-900 text-white shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    Mineração Rio Sangue
                  </button>
                </div>
              </div>

              {/* 6 Real-time KPI Cards */}
              <KPICards 
                stats={stats} 
                onSelectExceptionCard={() => setActiveTab('antifraude')}
              />

              {/* Split Screen: Gêmeo Digital (8 cols) + Feed AGORA (4 cols) */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
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
                        setActiveTab('pesagem');
                      }
                    }}
                   onSelectSilo={() => setActiveTab('relatorios')}
                   onOpenBalancaCockpit={() => setActiveTab('pesagem')}
                   onNavigateTab={setActiveTab}
                 />
               </div>

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
              vehicles={vehicles}
              fleet={vehicles}
              ticketsHistory={ticketsHistory}
              onAddTicket={handleAddTicket}
              onOpenTicket={handleOpenTicket}
            />
          )}

          {/* TAB 3: FILA & AGENDA INTELIGENTE */}
          {activeTab === 'fila' && (
            <QueueSchedule 
              vehicles={vehicles}
              onOpenTicket={handleOpenTicket}
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

          {/* TAB 6: FISCAL & INTEGRAÇÕES */}
          {activeTab === 'fiscal' && (
            <FiscalIntegrations 
              onOpenDanfe={handleOpenDanfe}
            />
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
            <MasterDataRules 
              fleet={INITIAL_FLEET}
              drivers={INITIAL_DRIVERS}
            />
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
       onNavigateTab={setActiveTab}
       onOpenDecisionModal={handleOpenDecisionModal}
       onOpenDanfe={handleOpenDanfe}
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
          onOpenDanfe={handleOpenDanfe}
          onClose={() => setIsTicketModalOpen(false)}
        />
      )}

      {/* 4. Portaria / Arrival Registration Modal */}
      {showArrivalModal && (
        <ArrivalModal 
          isOpen={showArrivalModal}
          onClose={() => setShowArrivalModal(false)}
          onRegisterArrival={handleRegisterArrival}
          fleet={INITIAL_FLEET}
        />
      )}

      {/* 5. Antifraud Anomaly Injection & Audit Modal */}
      {showAnomalyModal && (
        <AnomalyModal 
          isOpen={showAnomalyModal}
          onClose={() => setShowAnomalyModal(false)}
          onInjectAnomaly={handleInjectAnomaly}
        />
      )}

      {/* 6. Official SEFAZ-MT DANFE & NBR 7212 Viewer Modal */}
      {showDanfeModal && (
        <DanfeModal 
          isOpen={showDanfeModal}
          onClose={() => setShowDanfeModal(false)}
          documentData={activeDanfeDoc}
        />
      )}
    </div>
  );
}
