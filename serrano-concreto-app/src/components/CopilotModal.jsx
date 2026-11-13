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
  AlertCircle
} from 'lucide-react';
import { COPILOT_SUGGESTIONS } from '../data/mockData';

export default function CopilotModal({ isOpen, onClose, stats, silos, vehicles }) {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Olá! Sou o **Copiloto KyttoIA 2.5 Flash**, assistente de inteligência artificial da Torre de Pesagem Serrano. Como posso apoiar a operação da usina de concreto e mineração agora?'
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
      const qLower = q.toLowerCase();

      if (qLower.includes('silo') || qLower.includes('cimento') || qLower.includes('nível')) {
        answer = `📊 **Status dos Silos de Cimento (MT-358):**\n- **Silo 01 (CP-II-F-32):** 52% (62,4 toneladas) · Operação normal.\n- **Silo 02 (CP-V ARI):** 78% (93,6 toneladas) · Abastecido hoje.\n- **Silo 03 (Pozolana):** 34% (27,2 toneladas) · ⚠️ **Atenção:** Previsão de recarga às 17h00 já agendada.`;
      } else if (qLower.includes('njk') || qLower.includes('exceção') || qLower.includes('lastro')) {
        answer = `🚨 **Auditoria KyttoIA da Caçamba NJK-3307:**\n- **Tara Pesada:** 10.190 kg vs média histórica de 9.600 kg (+6,1% / +590 kg).\n- **Diagnóstico:** Padrão de lastro oculto de água antes da pesagem de saída.\n- **Ação:** O veículo foi direcionado preventivamente para a Baia de Exceção aguardando decisão da Torre.`;
      } else if (qLower.includes('alvorada') || qLower.includes('programada') || qLower.includes('obra')) {
        answer = `🏗️ **Concretagem Construtora Alvorada (Residencial Manacá):**\n- **Elemento:** Laje 4º Pavimento · Traço TR-FCK30B (Slump 16±3 cm).\n- **Progresso:** 26,0 m³ entregues de 64,0 m³ (41%).\n- **Betoneiras:** BT-05 em pesagem, BT-06 na dosadora e BT-12 retornando da lavagem.\n- **Intervalo:** 25 minutos por betoneira com bomba lança de 36m.`;
      } else if (qLower.includes('sefaz') || qLower.includes('fiscal') || qLower.includes('mdf')) {
        answer = `⚡ **Status de Integração Fiscal SEFAZ-MT:**\n- **Webservice:** 100% Online (latência média de 118 ms).\n- **MDF-e emitidos hoje:** 75 manifestos sem falha ou rejeição.\n- **NF-e de Concreto:** Emissão automática pós-pesagem na balança BAL-01.`;
      } else if (qLower.includes('balança') || qLower.includes('bal-01') || qLower.includes('ticket')) {
        answer = `⚖️ **Telemetria BAL-01 Toledo 720i:**\n- **Peso ao vivo:** 12.920 kg (Estabilizado).\n- **Semáforo:** Vermelho (Caminhão BT-05 posicionado).\n- **Câmera LPR:** Placa QBF-6M02 lida com 99,7% de confiança.\n- **Ticket:** Pronto para emissão de saída assim que concluída a 2ª pesagem.`;
      } else {
        answer = `Entendido! Analisei os parâmetros operacionais da Serrano Concreto através do **Motor KyttoIA 2.5 Flash**. A usina opera hoje com **88% de autonomia sem intervenção manual**, 75 tickets emitidos e taxa de conformidade dos traços em 99,1%. Deseja que eu execute alguma simulação ou liberação de cancela?`;
      }

      setMessages(prev => [...prev, { role: 'assistant', text: answer }]);
      setIsTyping(false);
    }, 700);
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
                Assistente de inteligência artificial em tempo real para a usina de concreto e mineração
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
          {COPILOT_SUGGESTIONS.slice(0, 3).map((sug, i) => (
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
                  : 'bg-stone-100/80 text-stone-800 rounded-tl-xs border border-stone-200 whitespace-pre-line'
              }`}>
                {m.text}
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
              placeholder="Pergunte sobre silos, tara de caminhão, SEFAZ ou canteiros..."
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
