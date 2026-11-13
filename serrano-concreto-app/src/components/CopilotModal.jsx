import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  X, 
  Search, 
  Send, 
  Cpu, 
  Truck, 
  Scale, 
  Layers, 
  HelpCircle,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  FileText,
  Sliders,
  Droplets,
  Building2
} from 'lucide-react';
import { COPILOT_SUGGESTIONS } from '../data/mockData';

export default function CopilotModal({ 
  isOpen, 
  onClose, 
  stats, 
  silos, 
  vehicles,
  onNavigateTab,
  onOpenDecisionModal,
  onOpenDanfe
}) {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Olá! Sou o **Copiloto KyttoIA 2.5 Flash**, assistente de inteligência artificial da Torre de Pesagem Serrano. Posso responder sobre o status dos silos, auditorias forenses de tara, conformidade ABNT NBR 7212 / NBR 12655, faturamento SEFAZ-MT e telemetria Toledo 720i.',
      actions: [
        { label: '📊 Status dos Silos', query: 'Qual o status dos silos de cimento?' },
        { label: '🚨 Auditar NJK-3307', query: 'Qual o problema da caçamba NJK-3307?' },
        { label: '⚖️ Balança BAL-01', query: 'Como está a telemetria da balança BAL-01?' }
      ]
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleAsk = (questionText) => {
    const q = questionText || query;
    if (!q.trim()) return;

    setMessages(prev => [...prev, { role: 'user', text: q }]);
    setQuery('');
    setIsTyping(true);

    setTimeout(() => {
      let answer = '';
      let actions = [];
      const qLower = q.toLowerCase();

      if (qLower.includes('silo') || qLower.includes('cimento') || qLower.includes('nível') || qLower.includes('estoque')) {
        answer = `📊 **Status dos Silos de Cimento (Usina MT-358):**\n` +
          `• **Silo 01 (CP-II-F-32):** 52% (62,4 toneladas) · Operação normal.\n` +
          `• **Silo 02 (CP-V ARI):** 78% (93,6 toneladas) · Abastecido hoje pela Votorantim.\n` +
          `• **Silo 03 (Pozolana):** 34% (27,2 toneladas) · ⚠️ **Atenção:** Previsão de nível de segurança às 17h00. Pedido de 30t em trânsito.\n\n` +
          `*Filtros de manga com sistema pulse-jet operando em 32 mmH₂O de pressão diferencial.*`;
        actions = [
          { label: 'Ver Nível no Gêmeo Digital', tab: 'torre' },
          { label: 'Relatórios de Consumo', tab: 'relatorios' }
        ];
      } else if (qLower.includes('njk') || qLower.includes('exceção') || qLower.includes('lastro') || qLower.includes('fraude') || qLower.includes('anomalia')) {
        answer = `🚨 **Auditoria Forense Motor KyttoIA · Veículo NJK-3307:**\n` +
          `• **Tara Medida:** 10.190 kg vs média histórica de 9.600 kg (+6,1% / +590 kg).\n` +
          `• **Diagnóstico de Risco:** Padrão clássico de lastro de água não declarado na caçamba antes do carregamento de brita.\n` +
          `• **Ação Automática:** Veículo bloqueado na cancela e encaminhado à Baia de Exceção.\n` +
          `• **Impacto Evitado:** R$ 88,50 por viagem em prejuízo de entrega a menor no canteiro.`;
        actions = [
          { 
            label: 'Abrir Baia de Exceção / Decidir', 
            onClick: () => {
              if (onOpenDecisionModal) onOpenDecisionModal({
                titulo: 'Tara fora do padrão · NJK-3307',
                detalhes: 'Tara 10.190 kg vs média histórica 9.600 kg (+6,1%). Padrão de lastro oculto antes da pesagem de saída.',
                veiculoPlaca: 'NJK-3307'
              });
              onClose();
            }
          },
          { label: 'Ver Painel Antifraude', tab: 'antifraude' }
        ];
      } else if (qLower.includes('alvorada') || qLower.includes('manacá') || qLower.includes('obra') || qLower.includes('canteiro')) {
        answer = `🏗️ **Concretagem Programada · Construtora Alvorada (Residencial Manacá):**\n` +
          `• **Elemento:** Laje 4º Pavimento · Traço TR-FCK30B (Slump 16±3 cm · Brita 0/1 Basalto).\n` +
          `• **Volume Total:** 64,0 m³ programados · 26,0 m³ já entregues (41% concluído).\n` +
          `• **Betoneiras:** BT-05 em pesagem de saída, BT-06 dosando na Convicta 96T e BT-12 retornando da lavagem.\n` +
          `• **Equipamento na Obra:** Bomba lança de 36m com vazão média de 30 m³/h.`;
        actions = [
          { label: 'Ver Fila & Despacho NBR 7212', tab: 'fila' },
          { label: 'Catálogo de Traços FCK', tab: 'clientes' }
        ];
      } else if (qLower.includes('sefaz') || qLower.includes('fiscal') || qLower.includes('mdf') || qLower.includes('danfe') || qLower.includes('xml')) {
        answer = `⚡ **Monitoramento Fiscal SEFAZ-MT / MDF-e:**\n` +
          `• **Webservice SEFAZ-MT:** 100% Operacional (latência: 118 ms).\n` +
          `• **MDF-e emitidos hoje:** 75 manifestos de carga autorizados sem contingência.\n` +
          `• **Certificado A1:** Válido até Outubro/2027.\n` +
          `• **Romaneio NBR 7212:** Todos os dados de pesagem e slump vinculados automaticamente ao XML.`;
        actions = [
          { label: 'Abrir Painel Fiscal SEFAZ', tab: 'fiscal' },
          { 
            label: 'Visualizar DANFE Oficial', 
            onClick: () => {
              if (onOpenDanfe) onOpenDanfe({
                id: '004128',
                tipo: 'NF-e Concreto Usinado',
                cliente: 'Construtora Alvorada Ltda'
              });
              onClose();
            }
          }
        ];
      } else if (qLower.includes('balança') || qLower.includes('bal-01') || qLower.includes('bal-02') || qLower.includes('toledo') || qLower.includes('720i') || qLower.includes('célula')) {
        answer = `⚖️ **Telemetria de Balanças Toledo do Brasil:**\n` +
          `• **BAL-01 (Usina MT-358 · 21m · 80t):** Toledo 720i conectada via Modbus TCP. Peso atual: 12.920 kg (BT-05 posicionado). 8 células DLC-10t com excentricidade em 0.8%.\n` +
          `• **BAL-02 (Mineração Rio Sangue · 18m · 60t):** Filizola Prix conectada. Pista livre (0 kg). Fila: 0 caminhões.\n` +
          `• **Certificado IPEM-MT:** Laudo 2026/0894 válido até 14/10/2027.`;
        actions = [
          { label: 'Ir para o Cockpit de Pesagem', tab: 'pesagem' },
          { label: 'Auditoria de Células de Carga', tab: 'antifraude' }
        ];
      } else if (qLower.includes('slump') || qLower.includes('perda') || qLower.includes('temperatura') || qLower.includes('abatimento')) {
        answer = `🌡️ **Cálculo Térmico de Perda de Abatimento (Slump Loss - ABNT NBR 7212):**\n` +
          `• **Condições Tangará da Serra:** Temperatura ambiente 33°C · Umidade do ar 48% · Vento 12 km/h.\n` +
          `• **Taxa de Slump Loss:** -1,8 cm por hora de transporte no tambor.\n` +
          `• **Slump de Saída:** 16,0 cm na usina -> Chegada estimada na obra: 13,8 cm (perfeitamente dentro do limite de bombeabilidade de 12 a 18 cm).\n` +
          `• **Tempo Máximo Permitido:** 150 minutos conforme NBR 7212:2021.`;
        actions = [
          { label: 'Ver Programação & Slump', tab: 'fila' },
          { label: 'Simulador Convicta 96T', tab: 'clientes' }
        ];
      } else {
        answer = `Entendido! Analisei os parâmetros operacionais da Serrano Concreto através do **Motor KyttoIA 2.5 Flash**.\n\n` +
          `A usina opera hoje com **88% de autonomia sem operador humano**, 75 tickets emitidos, 1.686 toneladas movimentadas e taxa de conformidade metrológica de 99,1%.\n\n` +
          `Deseja verificar alguma área específica?`;
        actions = [
          { label: 'Balança Toledo 720i', tab: 'pesagem' },
          { label: 'Gêmeo Digital', tab: 'torre' },
          { label: 'SEFAZ-MT Fiscal', tab: 'fiscal' },
          { label: 'Fila de Betoneiras', tab: 'fila' }
        ];
      }

      setMessages(prev => [...prev, { role: 'assistant', text: answer, actions }]);
      setIsTyping(false);
    }, 600);
  };

  const handleActionClick = (action) => {
    if (action.onClick) {
      action.onClick();
    } else if (action.tab) {
      if (onNavigateTab) onNavigateTab(action.tab);
      onClose();
    } else if (action.query) {
      handleAsk(action.query);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-5 shadow-2xl border border-stone-200 flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-r from-serrano-500 to-amber-600 text-white shadow-xs">
              <Sparkles className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-extrabold text-stone-900">
                  Copiloto KyttoIA 2.5 Flash
                </h3>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200">
                  Torre Serrano
                </span>
              </div>
              <p className="text-[11px] text-stone-500">
                Assistente de inteligência artificial em tempo real para concreto, mineração e pesagem
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Suggestion Pills */}
        <div className="py-2.5 flex items-center gap-1.5 overflow-x-auto text-xs border-b border-stone-100">
          <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider flex-shrink-0">
            Sugestões:
          </span>
          {COPILOT_SUGGESTIONS.slice(0, 4).map((sug, i) => (
            <button
              key={i}
              onClick={() => handleAsk(sug)}
              className="text-[11px] font-medium px-2.5 py-1 bg-stone-100 hover:bg-serrano-50 hover:text-serrano-700 text-stone-700 rounded-lg whitespace-nowrap border border-stone-200 transition-colors flex-shrink-0"
            >
              {sug}
            </button>
          ))}
        </div>

        {/* Chat History Container */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3 text-xs pr-1">
          {messages.map((m, idx) => (
            <div 
              key={idx}
              className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.role === 'assistant' && (
                <div className="w-6 h-6 rounded-lg bg-serrano-500 text-white flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">
                  K
                </div>
              )}
              <div className={`p-3 rounded-2xl max-w-[85%] leading-relaxed ${
                m.role === 'user' 
                  ? 'bg-stone-900 text-white rounded-tr-xs' 
                  : 'bg-stone-100/90 text-stone-800 rounded-tl-xs border border-stone-200'
              }`}>
                <div className="whitespace-pre-line">{m.text}</div>

                {/* Inline Action Buttons inside Assistant Message */}
                {m.actions && m.actions.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-stone-200 flex flex-wrap gap-1.5">
                    {m.actions.map((act, aIdx) => (
                      <button
                        key={aIdx}
                        onClick={() => handleActionClick(act)}
                        className="px-2.5 py-1 bg-white hover:bg-serrano-500 hover:text-white text-stone-800 border border-stone-300 rounded-lg font-bold text-[10px] flex items-center gap-1 transition-all shadow-2xs active:scale-98"
                      >
                        <span>{act.label}</span>
                        <ArrowRight className="w-3 h-3 opacity-60" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-2.5 justify-start text-xs text-stone-400 items-center">
              <div className="w-6 h-6 rounded-lg bg-serrano-500 text-white flex items-center justify-center font-bold text-[10px]">
                K
              </div>
              <span className="animate-pulse">Motor KyttoIA processando telemetria...</span>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <form 
          onSubmit={(e) => { e.preventDefault(); handleAsk(); }}
          className="pt-3 border-t border-stone-100 flex items-center gap-2"
        >
          <div className="relative flex-1">
            <input 
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pergunte sobre silos, tara de caminhão, SEFAZ, slump loss ou canteiros..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:border-serrano-500"
            />
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-serrano-500 hover:bg-serrano-600 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1"
          >
            <span>Enviar</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>

      </div>
    </div>
  );
}
