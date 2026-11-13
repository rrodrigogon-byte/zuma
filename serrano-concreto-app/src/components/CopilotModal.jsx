import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Send, 
  X, 
  Bot, 
  User, 
  ArrowRight, 
  ExternalLink,
  ShieldAlert,
  Scale,
  FileText,
  Activity
} from 'lucide-react';
import { consultarKyttoIA } from '../services/api';

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

  const handleAsk = async (questionText) => {
    const q = questionText || query;
    if (!q.trim()) return;

    setMessages(prev => [...prev, { role: 'user', text: q }]);
    setQuery('');
    setIsTyping(true);

    try {
      // 1. Consulta em tempo real à API KyttoIA no backend
      const res = await consultarKyttoIA(q, { stats, silos, vehicles });
      let answer = '';
      let actions = [];
      const qLower = q.toLowerCase();

      if (res?.ok && res.resposta) {
        answer = res.resposta;
        if (res.normasCitadas?.length) {
          answer += `\n\n*(Normas técnicas ABNT: ${res.normasCitadas.join(', ')})*`;
        }
      }

      // 2. Fallback inteligente com respostas operacionais de Tangará da Serra
      if (!answer) {
        if (qLower.includes('silo') || qLower.includes('cimento') || qLower.includes('nível') || qLower.includes('estoque')) {
          answer = `**Status dos Silos de Cimento (Usina MT-358):**\n- **Silo 01 (CP-II-F-32):** 62,4 t (52%)\n- **Silo 02 (CP-V ARI):** 93,6 t (78%)\n- **Silo 03 (Pozolana/Filler):** 27,2 t (34% · Nível de Atenção)\n\nConsumo projetado para hoje: 49,6 t. O Silo 03 atingirá nível de segurança às 17h00. Pedido de recarga já confirmado com a transportadora.`;
          actions = [
            { label: '📊 Telemetria dos Silos', action: 'silos' },
            { label: '📈 Ver Relatórios', action: 'relatorios' }
          ];
        } else if (qLower.includes('exceção') || qLower.includes('njk') || qLower.includes('3307') || qLower.includes('fraude') || qLower.includes('lastro')) {
          answer = `**Auditoria de Exceção Ativa:**\n- **Veículo:** CB-03 (Caçamba Basculante · Placa: NJK-3307)\n- **Incidente:** Desvio de tara histórica de **+590 kg (+6,1%)**.\n- **Diagnóstico Motor KyttoIA 2.5 Flash:** Suspeita de lastro oculto de água para adulteração de peso líquido de agregados.\n- **Ação sugerida:** Retenção imediata na Baia de Exceção com semáforo bloqueado e auditoria visual da caçamba.`;
          actions = [
            { label: '🚨 Auditar Caçamba NJK-3307', action: 'excecao' },
            { label: '🛡️ Painel Antifraude', action: 'antifraude' }
          ];
        } else if (qLower.includes('balança') || qLower.includes('pesagem') || qLower.includes('toledo') || qLower.includes('720i')) {
          answer = `**Balança BAL-01 (Toledo 720i · 21 metros):**\n- **Status:** Operacional via Modbus TCP com 8 células Toledo DLC-10t.\n- **Excentricidade de plataforma:** 0,8% (dentro do limite INMETRO < 3,0%).\n- **Última pesagem:** Betoneira BT-05 (12.920 kg tara).\n- **Tempo médio de pesagem:** 1,8 min sem intervenção manual (88% autônomo).`;
          actions = [
            { label: '⚖️ Abrir Cockpit BAL-01', action: 'cockpit' },
            { label: '📄 Último Ticket Emitido', action: 'ticket' }
          ];
        } else {
          answer = `**Análise Operacional Motor KyttoIA 2.5 Flash:** A operação da Usina MT-358 e Mineração Rio Sangue opera com 88% de automação de pesagem sem operador, 75 tickets emitidos e 1 incidente retido na baia de exceção. Todos os traços atendem à ABNT NBR 7212 e NBR 12655.`;
          actions = [
            { label: '⚖️ Cockpit Balança', action: 'cockpit' },
            { label: '🛡️ Painel Antifraude', action: 'antifraude' },
            { label: '📄 Documentos SEFAZ', action: 'danfe' }
          ];
        }
      } else {
        if (qLower.includes('silo') || qLower.includes('cimento')) {
          actions = [{ label: '📊 Telemetria dos Silos', action: 'silos' }];
        } else if (qLower.includes('danfe') || qLower.includes('fiscal') || qLower.includes('nfe')) {
          actions = [{ label: '📄 Documentos SEFAZ', action: 'danfe' }];
        } else {
          actions = [{ label: '⚖️ Cockpit Balança', action: 'cockpit' }];
        }
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        text: answer,
        actions
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: 'Erro ao consultar o Motor KyttoIA. Verifique a conexão com o servidor da Torre.',
        actions: []
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const executeAction = (actionKey) => {
    onClose();
    if (actionKey === 'cockpit' && onNavigateTab) {
      onNavigateTab('pesagem');
    } else if (actionKey === 'antifraude' && onNavigateTab) {
      onNavigateTab('antifraude');
    } else if (actionKey === 'relatorios' && onNavigateTab) {
      onNavigateTab('relatorios');
    } else if (actionKey === 'silos' && onNavigateTab) {
      onNavigateTab('relatorios');
    } else if (actionKey === 'excecao') {
      if (onNavigateTab) onNavigateTab('antifraude');
      if (onOpenDecisionModal) {
        const excVehicle = vehicles?.find(v => v.localizacao === 'excecao') || {
          veiculo: 'CB-03',
          placa: 'NJK-3307',
          tipo: 'Desvio de Tara Suspeito (+6.1%)',
          descricao: 'Peso registrado na entrada excede a média histórica em +590 kg.',
          severidade: 'alta'
        };
        onOpenDecisionModal(excVehicle);
      }
    } else if (actionKey === 'danfe' && onOpenDanfe) {
      onOpenDanfe();
    } else if (actionKey === 'ticket' && onNavigateTab) {
      onNavigateTab('pesagem');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-stone-200 overflow-hidden flex flex-col h-[520px] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-linear-to-br from-amber-500 to-serrano-500 flex items-center justify-center text-white shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-extrabold text-stone-900">Copiloto KyttoIA 2.5 Flash</h3>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200">
                  Torre Serrano
                </span>
              </div>
              <p className="text-[10px] text-stone-500">
                Assistente de inteligência artificial em tempo real para concreto, mineração e pesagem
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Suggestion Quick Chips */}
        <div className="px-4 py-2 bg-stone-50 border-b border-stone-100 flex items-center gap-1.5 overflow-x-auto text-[11px] no-scrollbar">
          <span className="text-[10px] font-extrabold text-stone-400 uppercase tracking-wider shrink-0">Sugestões:</span>
          <button 
            onClick={() => handleAsk('Qual o nível atual dos silos de cimento?')}
            className="px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-stone-700 hover:border-serrano-500 hover:text-serrano-600 shrink-0 font-medium transition-colors"
          >
            Qual o nível atual dos silos de cimento?
          </button>
          <button 
            onClick={() => handleAsk('Exibir detalhes da exceção da caçamba NJK-3307')}
            className="px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-stone-700 hover:border-serrano-500 hover:text-serrano-600 shrink-0 font-medium transition-colors"
          >
            Exibir detalhes da exceção da caçamba NJK-3307
          </button>
          <button 
            onClick={() => handleAsk('Qual o prazo de pega e transporte segundo a NBR 7212?')}
            className="px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-stone-700 hover:border-serrano-500 hover:text-serrano-600 shrink-0 font-medium transition-colors"
          >
            Qual o prazo de transporte NBR 7212?
          </button>
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
          {messages.map((m, idx) => (
            <div key={idx} className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div className="w-6 h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">
                  K
                </div>
              )}
              <div className="max-w-[85%] space-y-2">
                <div 
                  className={`p-3 rounded-2xl leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user' 
                      ? 'bg-stone-900 text-white rounded-tr-none' 
                      : 'bg-stone-100 text-stone-800 rounded-tl-none border border-stone-200/60'
                  }`}
                >
                  {m.text}
                </div>

                {/* Direct Action Buttons inside Assistant Message */}
                {m.actions && m.actions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {m.actions.map((act, actIdx) => (
                      <button
                        key={actIdx}
                        onClick={() => {
                          if (act.action) {
                            executeAction(act.action);
                          } else if (act.query) {
                            handleAsk(act.query);
                          }
                        }}
                        className="px-2.5 py-1 bg-white hover:bg-stone-50 border border-stone-300 rounded-lg text-[11px] font-bold text-stone-800 shadow-2xs hover:border-serrano-500 transition-all flex items-center gap-1"
                      >
                        <span>{act.label}</span>
                        <ArrowRight className="w-3 h-3 text-stone-400" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {m.role === 'user' && (
                <div className="w-6 h-6 rounded-lg bg-stone-800 text-white flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 text-[10px] font-bold">
                K
              </div>
              <div className="p-3 bg-stone-100 rounded-2xl rounded-tl-none border border-stone-200/60 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-pulse [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-pulse [animation-delay:0.4s]" />
              </div>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-3 border-t border-stone-100 bg-white">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleAsk();
            }}
            className="flex items-center gap-2"
          >
            <div className="flex-1 relative">
              <input 
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Pergunte sobre silos, tara de caminhão, SEFAZ, slump loss ou canteiros..."
                className="w-full pl-8 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:outline-hidden focus:border-serrano-500 focus:bg-white transition-all text-stone-900 placeholder:text-stone-400"
              />
              <Bot className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>
            <button 
              type="submit"
              disabled={!query.trim()}
              className="px-3.5 py-2 bg-serrano-500 hover:bg-serrano-600 disabled:opacity-40 disabled:hover:bg-serrano-500 text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-1 shrink-0"
            >
              <span>Enviar</span>
              <Send className="w-3 h-3" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
